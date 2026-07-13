import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { listDeliveryTrackingLogsForOrder } from "@/lib/supabase/delivery";
import { validateOrderId } from "@/lib/validations/order";

/**
 * GET /api/orders/[id]/tracking-logs
 * 발송현황 — 주문 단위 배송조회 이력
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id: orderIdRaw } = await context.params;
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
    const { data, error } = await listDeliveryTrackingLogsForOrder(
      idValidation.id
    );

    if (error) {
      const status = error.message.includes("찾을 수 없습니다") ? 404 : 500;
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/orders/[id]/tracking-logs] ❌", message);
    return NextResponse.json(
      {
        success: false,
        message: "배송조회 이력을 불러오지 못했습니다.",
        error: message,
      },
      { status: 500 }
    );
  }
}
