import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  DELIVERY_AUTO_SYNC_MAX_ORDERS,
  DELIVERY_AUTO_SYNC_MIN_INTERVAL_MS,
} from "@/lib/constants/delivery";
import { isEligibleForAutoDeliverySync } from "@/lib/delivery/sync-eligibility";
import { trackOrderDelivery } from "@/lib/delivery/track-order";
import { createClient } from "@/lib/supabase/server";
import { listOrdersForDeliverySync } from "@/lib/supabase/delivery";
import type { DeliveryStatus } from "@/types/delivery";
import { validateOrderId } from "@/lib/validations/order";

export interface DeliverySyncUpdate {
  order_id: string;
  delivery_status: DeliveryStatus;
  delivery_location: string | null;
}

/**
 * POST /api/delivery/sync
 * 발송현황 목록 진입 시 배송상태 자동 갱신 (송장번호 단위)
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "요청 본문이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const orderIdsRaw = (body as { orderIds?: unknown })?.orderIds;
  console.log("[DeliveryAutoSync][api/delivery/sync] received body.orderIds", {
    orderIds: orderIdsRaw,
  });
  if (!Array.isArray(orderIdsRaw)) {
    return NextResponse.json(
      { success: false, message: "orderIds 배열이 필요합니다." },
      { status: 400 }
    );
  }

  const validatedIds: string[] = [];
  for (const raw of orderIdsRaw.slice(0, DELIVERY_AUTO_SYNC_MAX_ORDERS)) {
    if (typeof raw !== "string") continue;
    const validation = validateOrderId(raw);
    if (validation.success) {
      validatedIds.push(validation.id);
    }
  }

  if (validatedIds.length === 0) {
    return NextResponse.json({
      success: true,
      data: { updates: [], syncedCount: 0, skippedCount: 0 },
      elapsedMs: Date.now() - startedAt,
    });
  }

  try {
    const supabase = await createClient();
    const { data: orders, error: fetchError } = await listOrdersForDeliverySync(
      supabase,
      validatedIds
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

    const eligible = orders.filter((order) =>
      isEligibleForAutoDeliverySync({
        aligo_status: order.aligo_status,
        delivery_status: order.delivery_status as DeliveryStatus | null,
        delivery_updated_at: order.delivery_updated_at,
        tracking_number: order.tracking_number,
      })
    );

    const excluded = orders
      .filter((order) => !eligible.some((e) => e.id === order.id))
      .map((order) => {
        const reasons: string[] = [];

        if (order.aligo_status !== "success") {
          reasons.push("aligo_status");
        }

        if (!order.tracking_number?.trim()) {
          reasons.push("tracking_number");
        }

        const status =
          (order.delivery_status as DeliveryStatus | null) ?? "ready";
        if (status === "delivered") {
          reasons.push("delivery_status(delivered)");
        } else if (status !== "ready" && status !== "in_transit") {
          reasons.push(`delivery_status(${String(order.delivery_status)})`);
        }

        // ready는 즉시 대상이므로 cooldown 사유에서 제외
        if (status === "in_transit") {
          if (order.delivery_updated_at) {
            const updatedAtMs = new Date(order.delivery_updated_at).getTime();
            if (!Number.isNaN(updatedAtMs)) {
              const elapsed = Date.now() - updatedAtMs;
              if (elapsed < DELIVERY_AUTO_SYNC_MIN_INTERVAL_MS) {
                reasons.push("cooldown");
              }
            }
          }
        }

        return {
          id: order.id,
          reasons: reasons.length ? reasons : ["unknown"],
          aligo_status: order.aligo_status,
          tracking_number: order.tracking_number,
          delivery_status: order.delivery_status,
          delivery_updated_at: order.delivery_updated_at,
        };
      });

    console.log("[DeliveryAutoSync][api/delivery/sync] eligibility result", {
      ordersLength: orders.length,
      eligibleLength: eligible.length,
      excluded,
    });

    const updates: DeliverySyncUpdate[] = [];

    for (const row of eligible) {
      console.log("[DeliveryAutoSync][api/delivery/sync] tracking target", {
        order_id: row.id,
        tracking_number: row.tracking_number,
      });
      const result = await trackOrderDelivery(supabase, {
        id: row.id,
        tracking_number: row.tracking_number,
        aligo_status: row.aligo_status,
        delivery_status: row.delivery_status as DeliveryStatus | null,
        delivery_location: row.delivery_location,
      });

      if (result.query_success) {
        updates.push({
          order_id: result.order_id,
          delivery_status: result.delivery_status,
          delivery_location: result.location,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updates,
        syncedCount: eligible.length,
        skippedCount: orders.length - eligible.length,
      },
      elapsedMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/delivery/sync] ❌", message);

    return NextResponse.json(
      {
        success: false,
        message: "배송상태 자동 갱신 중 오류가 발생했습니다.",
        error: message,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
