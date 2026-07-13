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

function formatInvoiceDisplay(digits: string): string {
  if (digits.length === 12) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
  }
  return digits;
}

/**
 * 송장번호 기준 고객용 배송조회
 * - 주문 DB에서 고객명 확인 후 스마트택배 API 조회
 * - 배송상태는 고객용 3단계(배송준비/배송중/배송완료)로 단순화
 * - 조회 성공 시 delivery_tracking_logs에 customer_view(또는 delivery_completed) 기록
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

    const trackerData = await fetchSmartTrackerTracking(normalized);

    if (trackerData.status === false) {
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
      : new Date().toISOString();

    const previousStatus =
      (order.delivery_status as DeliveryStatus | null) ?? null;

    const { error: updateError } = await updateOrderDeliveryStatus(
      supabase,
      order.id,
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

    const eventType = resolveDeliveryTrackingEventType(
      "customer_view",
      deliveryStatus,
      previousStatus
    );

    const { error: logError } = await insertDeliveryTrackingLog({
      order_id: order.id,
      tracking_number: order.tracking_number,
      delivery_status: deliveryStatus,
      event_type: eventType,
      location: location === "-" ? null : location,
      tracking_time: trackingTime,
      raw_response: trackerData,
    });

    if (logError) {
      console.error(
        "[getCustomerTrackingByInvoice] delivery log 저장 실패:",
        logError.message
      );
    }

    return {
      ok: true,
      data: {
        customerName: order.customer_name,
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
