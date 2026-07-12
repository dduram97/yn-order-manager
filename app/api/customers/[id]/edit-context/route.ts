import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { resolveCustomerEditKind } from "@/lib/supabase/customer-order-stats";
import { createClient } from "@/lib/supabase/server";
import { validateOrderId } from "@/lib/validations/order";

/**
 * GET /api/customers/[id]/edit-context
 * 고객 수정 화면용 유형 (crm | naver | wired) — 추가 마이그레이션 없이 추론
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const idValidation = validateOrderId(id);

    if (!idValidation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "고객 ID가 올바르지 않습니다.",
          errors: idValidation.errors,
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const customerId = idValidation.id;

    const { data: row, error } = await supabase
      .from("customers")
      .select("id, order_channel, order_product")
      .eq("id", customerId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "고객 정보 조회 중 오류가 발생했습니다.",
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!row) {
      return NextResponse.json(
        { success: false, message: "고객을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const customer = row as {
      id: string;
      order_channel?: string | null;
      order_product?: string | null;
    };

    const resolved = await resolveCustomerEditKind({
      customer_id: customerId,
      order_channel: customer.order_channel,
      order_product: customer.order_product,
    });

    if (resolved.error) {
      return NextResponse.json(
        {
          success: false,
          message: "고객 유형 조회 중 오류가 발생했습니다.",
          error: resolved.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        kind: resolved.kind,
        showOrderAttributes: resolved.showOrderAttributes,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        message: "서버 오류가 발생했습니다.",
        error: message,
      },
      { status: 500 }
    );
  }
}
