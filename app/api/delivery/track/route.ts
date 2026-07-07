import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { CJ_COURIER_NAME } from "@/lib/constants/delivery";
import {
  extractCurrentLocation,
  fetchSmartTrackerTracking,
  mapSmartTrackerToDeliveryStatus,
  mapTrackingHistory,
} from "@/lib/delivery/smart-tracker";
import { createClient } from "@/lib/supabase/server";
import {
  getOrderForDeliveryTrack,
  insertDeliveryTrackingLog,
  listOrdersForDeliveryGroup,
  updateOrderDeliveryStatus,
} from "@/lib/supabase/delivery";
import type { DeliveryStatus, DeliveryTrackItem } from "@/types/delivery";
import { validateOrderId } from "@/lib/validations/order";

function resolveDisplayDeliveryStatus(
  aligoStatus: string,
  deliveryStatus: DeliveryStatus | null | undefined
): DeliveryStatus | null {
  if (aligoStatus !== "success") return null;
  return deliveryStatus ?? "ready";
}

/**
 * GET /api/delivery/track?orderId={uuid}
 * 스마트택배(CJ대한통운) 배송조회 — 송장번호(orders row) 단위
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const orderIdRaw = searchParams.get("orderId") ?? "";

  const idValidation = validateOrderId(orderIdRaw);
  if (!idValidation.success) {
    return NextResponse.json(
      {
        success: false,
        message: "주문 ID가 올바르지 않습니다.",
        errors: idValidation.errors,
      },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: order, error: fetchError } = await getOrderForDeliveryTrack(
      supabase,
      idValidation.id
    );

    if (fetchError) {
      return NextResponse.json(
        {
          success: false,
          message: "주문 조회 중 오류가 발생했습니다.",
          error: fetchError.message,
        },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    let targets = [order];

    if (order.group_id) {
      const { data: siblings, error: groupError } =
        await listOrdersForDeliveryGroup(supabase, order.group_id);

      if (groupError) {
        console.error("[GET /api/delivery/track] group 조회 오류:", groupError.message);
      } else if (siblings.length > 0) {
        targets = siblings;
      }
    }

    const items: DeliveryTrackItem[] = [];

    for (const row of targets) {
      const fallbackStatus = resolveDisplayDeliveryStatus(
        row.aligo_status,
        row.delivery_status as DeliveryStatus | null | undefined
      );

      if (!row.tracking_number?.trim()) {
        items.push({
          order_id: row.id,
          tracking_number: row.tracking_number || "-",
          delivery_status: fallbackStatus ?? "ready",
          location: row.delivery_location ?? null,
          history: [],
          query_success: false,
          query_message: "송장번호가 없습니다.",
        });
        continue;
      }

      if (row.aligo_status !== "success") {
        items.push({
          order_id: row.id,
          tracking_number: row.tracking_number,
          delivery_status: fallbackStatus ?? "ready",
          location: row.delivery_location ?? null,
          history: [],
          query_success: false,
          query_message: "알림톡 발송 완료 후 배송조회가 가능합니다.",
        });
        continue;
      }

      try {
        const trackerData = await fetchSmartTrackerTracking(row.tracking_number);

        if (trackerData.status === false) {
          items.push({
            order_id: row.id,
            tracking_number: row.tracking_number,
            delivery_status:
              (row.delivery_status as DeliveryStatus | null) ?? "ready",
            location: row.delivery_location ?? null,
            history: [],
            query_success: false,
            query_message: trackerData.msg ?? "배송 정보를 찾을 수 없습니다.",
          });
          continue;
        }

        const deliveryStatus = mapSmartTrackerToDeliveryStatus(trackerData);
        const location = extractCurrentLocation(trackerData);
        const history = mapTrackingHistory(trackerData);
        const lastHistory = history[history.length - 1];
        const trackingTime = lastHistory?.timeString
          ? new Date(lastHistory.timeString).toISOString()
          : new Date().toISOString();

        const { error: updateError } = await updateOrderDeliveryStatus(
          supabase,
          row.id,
          {
            delivery_status: deliveryStatus,
            delivery_location: location,
            delivery_updated_at: trackingTime,
          }
        );

        if (updateError) {
          console.error(
            "[GET /api/delivery/track] delivery_status 저장 실패:",
            updateError.message
          );
        }

        const { error: logError } = await insertDeliveryTrackingLog(supabase, {
          order_id: row.id,
          tracking_number: row.tracking_number,
          delivery_status: deliveryStatus,
          location,
          tracking_time: trackingTime,
          raw_response: trackerData,
        });

        if (logError) {
          console.error(
            "[GET /api/delivery/track] delivery log 저장 실패:",
            logError.message
          );
        }

        items.push({
          order_id: row.id,
          tracking_number: row.tracking_number,
          delivery_status: deliveryStatus,
          location,
          history,
          query_success: true,
        });
      } catch (trackError) {
        const message =
          trackError instanceof Error ? trackError.message : String(trackError);
        console.error(
          `[GET /api/delivery/track] 조회 실패 (${row.tracking_number}):`,
          message
        );

        items.push({
          order_id: row.id,
          tracking_number: row.tracking_number,
          delivery_status:
            (row.delivery_status as DeliveryStatus | null) ?? "ready",
          location: row.delivery_location ?? null,
          history: [],
          query_success: false,
          query_message: message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        customer_name: order.customer_name,
        courier_name: CJ_COURIER_NAME,
        items,
      },
      elapsedMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/delivery/track] ❌", message);

    return NextResponse.json(
      {
        success: false,
        message: "배송조회 중 오류가 발생했습니다.",
        error: message,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
