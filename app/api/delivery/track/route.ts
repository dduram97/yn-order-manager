import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { CJ_COURIER_NAME } from "@/lib/constants/delivery";
import { trackOrderDelivery } from "@/lib/delivery/track-order";
import { createClient } from "@/lib/supabase/server";
import {
  getOrderForDeliveryTrack,
  listOrdersForDeliveryGroup,
} from "@/lib/supabase/delivery";
import type { DeliveryStatus, DeliveryTrackItem } from "@/types/delivery";
import { validateOrderId } from "@/lib/validations/order";

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
      const result = await trackOrderDelivery(supabase, {
        id: row.id,
        tracking_number: row.tracking_number,
        aligo_status: row.aligo_status,
        delivery_status: row.delivery_status as DeliveryStatus | null,
        delivery_location: row.delivery_location,
      });
      items.push(result);
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
