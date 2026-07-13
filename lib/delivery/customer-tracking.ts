import {
  CJ_COURIER_NAME,
  DELIVERY_STATUS_LABEL,
} from "@/lib/constants/delivery";
import {
  extractCurrentLocation,
  fetchSmartTrackerTracking,
  mapSmartTrackerKindToDeliveryStatus,
  mapSmartTrackerToDeliveryStatus,
  mapTrackingHistory,
  normalizeTrackingNumber,
  type SmartTrackerResponse,
} from "@/lib/delivery/smart-tracker";
import { createClient } from "@/lib/supabase/server";
import {
  getOrderByTrackingNumber,
  insertDeliveryTrackingLog,
  resolveDeliveryTrackingEventType,
  updateOrderDeliveryStatus,
} from "@/lib/supabase/delivery";
import type { DeliveryStatus } from "@/types/delivery";
import { validateTrackingNumber } from "@/lib/validations/tracking-number";

export type CustomerTrackingHistoryItem = {
  status: string;
  location: string;
  occurredAt: string;
};

export type CustomerTrackingData = {
  customerName: string;
  carrier: string;
  invoiceNo: string;
  status: string;
  currentLocation: string;
  history: CustomerTrackingHistoryItem[];
};

export type CustomerTrackingResult =
  | { ok: true; data: CustomerTrackingData }
  | { ok: false; errorCode: "INVALID_INVOICE" | "NOT_FOUND" | "UNKNOWN"; message: string };

type MatchedOrder = {
  id: string;
  customer_name: string;
  tracking_number: string;
  delivery_status?: DeliveryStatus | null;
  delivery_location?: string | null;
};

function formatInvoiceDisplay(digits: string): string {
  if (digits.length === 12) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
  }
  return digits;
}

/**
 * 고객이 배송조회를 시도한 시점을 기록.
 * 스마트택배 성공/실패와 무관하게, 주문을 찾은 뒤에는 항상 남긴다.
 */
async function recordCustomerTrackingAttempt(input: {
  order: MatchedOrder;
  deliveryStatus: DeliveryStatus;
  previousStatus: DeliveryStatus | null;
  location: string | null;
  trackingTime: string;
  rawResponse?: SmartTrackerResponse | null;
}) {
  const eventType = resolveDeliveryTrackingEventType(
    "customer_view",
    input.deliveryStatus,
    input.previousStatus
  );

  const { error: logError } = await insertDeliveryTrackingLog({
    order_id: input.order.id,
    tracking_number: input.order.tracking_number,
    delivery_status: input.deliveryStatus,
    event_type: eventType,
    location: input.location,
    tracking_time: input.trackingTime,
    raw_response: input.rawResponse ?? null,
  });

  if (logError) {
    console.error(
      "[getCustomerTrackingByInvoice] delivery log 저장 실패:",
      logError.message
    );
    return;
  }

  console.log("[getCustomerTrackingByInvoice] delivery log 저장", {
    order_id: input.order.id,
    event_type: eventType,
    delivery_status: input.deliveryStatus,
  });
}

/**
 * 송장번호 기준 고객용 배송조회
 * - 주문 DB에서 고객명 확인 후 스마트택배 API 조회
 * - 주문을 찾은 뒤에는 스마트택배 실패(유효하지 않은 송장 등)여도 customer_view 기록
 */
export async function getCustomerTrackingByInvoice(
  invoiceNo: string
): Promise<CustomerTrackingResult> {
  const normalized = normalizeTrackingNumber(invoiceNo);
  const validationError = validateTrackingNumber(normalized);

  if (validationError) {
    return {
      ok: false,
      errorCode: "INVALID_INVOICE",
      message: validationError,
    };
  }

  try {
    const supabase = await createClient();
    const { data: order, error: orderError } = await getOrderByTrackingNumber(
      supabase,
      normalized
    );

    if (orderError) {
      return {
        ok: false,
        errorCode: "UNKNOWN",
        message: "주문 조회 중 오류가 발생했습니다.",
      };
    }

    if (!order || order.aligo_status !== "success") {
      return {
        ok: false,
        errorCode: "NOT_FOUND",
        message: "배송 정보를 찾을 수 없습니다.",
      };
    }

    const matchedOrder: MatchedOrder = {
      id: order.id,
      customer_name: order.customer_name,
      tracking_number: order.tracking_number,
      delivery_status: order.delivery_status as DeliveryStatus | null,
      delivery_location: order.delivery_location,
    };

    const previousStatus =
      (matchedOrder.delivery_status as DeliveryStatus | null) ?? null;
    const nowIso = new Date().toISOString();

    let trackerData: SmartTrackerResponse | null = null;
    try {
      trackerData = await fetchSmartTrackerTracking(normalized);
    } catch (trackerError) {
      const message =
        trackerError instanceof Error
          ? trackerError.message
          : String(trackerError);

      // 택배사 API 예외여도 조회 시도는 기록
      await recordCustomerTrackingAttempt({
        order: matchedOrder,
        deliveryStatus: previousStatus ?? "ready",
        previousStatus,
        location: matchedOrder.delivery_location ?? null,
        trackingTime: nowIso,
        rawResponse: null,
      });

      return {
        ok: false,
        errorCode: "UNKNOWN",
        message,
      };
    }

    // 유효하지 않은 송장 등 — 조회 화면은 실패해도 시도 로그는 남김
    if (trackerData.status === false) {
      await recordCustomerTrackingAttempt({
        order: matchedOrder,
        deliveryStatus: previousStatus ?? "ready",
        previousStatus,
        location: matchedOrder.delivery_location ?? null,
        trackingTime: nowIso,
        rawResponse: trackerData,
      });

      return {
        ok: false,
        errorCode: "NOT_FOUND",
        message: trackerData.msg ?? "배송 정보를 찾을 수 없습니다.",
      };
    }

    const deliveryStatus = mapSmartTrackerToDeliveryStatus(trackerData);
    const rawHistory = mapTrackingHistory(trackerData);
    const location = extractCurrentLocation(trackerData) ?? "-";

    const lastHistory = rawHistory[rawHistory.length - 1];
    const trackingTime = lastHistory?.timeString
      ? new Date(lastHistory.timeString).toISOString()
      : nowIso;

    const { error: updateError } = await updateOrderDeliveryStatus(
      supabase,
      matchedOrder.id,
      {
        delivery_status: deliveryStatus,
        delivery_location: location === "-" ? null : location,
        delivery_updated_at: trackingTime,
      }
    );

    if (updateError) {
      console.error(
        "[getCustomerTrackingByInvoice] delivery_status 저장 실패:",
        updateError.message
      );
    }

    await recordCustomerTrackingAttempt({
      order: matchedOrder,
      deliveryStatus,
      previousStatus,
      location: location === "-" ? null : location,
      trackingTime,
      rawResponse: trackerData,
    });

    return {
      ok: true,
      data: {
        customerName: matchedOrder.customer_name,
        carrier: CJ_COURIER_NAME,
        invoiceNo: formatInvoiceDisplay(normalized),
        status: DELIVERY_STATUS_LABEL[deliveryStatus],
        currentLocation: location,
        history: rawHistory.map((item) => ({
          status:
            DELIVERY_STATUS_LABEL[mapSmartTrackerKindToDeliveryStatus(item.kind)],
          location: item.where,
          occurredAt: item.timeString,
        })),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      errorCode: "UNKNOWN",
      message,
    };
  }
}
