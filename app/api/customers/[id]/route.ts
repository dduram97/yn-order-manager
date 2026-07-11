import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { insertCustomerOrderStatistic } from "@/lib/supabase/customer-order-stats";
import { updateCustomerById } from "@/lib/supabase/customers";
import { createClient } from "@/lib/supabase/server";
import { validateUpdateCustomerInput } from "@/lib/validations/customer";
import { validateOrderId } from "@/lib/validations/order";

/**
 * PATCH /api/customers/[id]
 * body: { name, phone, memo?, order_channel?, order_product? }
 *
 * 통계:
 * - 기존 order_channel/order_product 가 모두 비어 있고, 이번에 둘 다 입력되면 +1
 * - 이미 주문정보가 있으면 수정만 (통계 생성 없음)
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "요청 본문이 올바른 JSON 형식이 아닙니다." },
        { status: 400 }
      );
    }

    const validation = validateUpdateCustomerInput(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "요청 본문이 올바르지 않습니다.",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const customerId = idValidation.id;

    const { data: beforeRow, error: beforeError } = await supabase
      .from("customers")
      .select("id, order_channel, order_product")
      .eq("id", customerId)
      .maybeSingle();

    if (beforeError) {
      return NextResponse.json(
        {
          success: false,
          message: "고객 정보 조회 중 오류가 발생했습니다.",
          error: beforeError.message,
          elapsedMs: Date.now() - startedAt,
        },
        { status: 500 }
      );
    }

    if (!beforeRow) {
      return NextResponse.json(
        {
          success: false,
          message: "고객을 찾을 수 없습니다.",
          elapsedMs: Date.now() - startedAt,
        },
        { status: 404 }
      );
    }

    const prevChannel = String(
      (beforeRow as { order_channel?: string | null }).order_channel ?? ""
    ).trim();
    const prevProduct = String(
      (beforeRow as { order_product?: string | null }).order_product ?? ""
    ).trim();
    const wasOrderInfoEmpty = prevChannel === "" && prevProduct === "";
    const nextChannel = validation.data.order_channel?.trim() ?? "";
    const nextProduct = validation.data.order_product?.trim() ?? "";
    const nowOrderInfoFilled = nextChannel !== "" && nextProduct !== "";
    const shouldCreateStat = wasOrderInfoEmpty && nowOrderInfoFilled;

    const { data, error } = await updateCustomerById(
      supabase,
      customerId,
      validation.data
    );
    const elapsed = Date.now() - startedAt;

    if (error) {
      const isDuplicate = error.code === "23505";
      const schemaMissing =
        error.code === "42703" ||
        error.code === "PGRST204" ||
        error.code === "SCHEMA_MISSING";
      return NextResponse.json(
        {
          success: false,
          message: isDuplicate
            ? "이미 등록된 휴대폰번호입니다."
            : schemaMissing
              ? error.message
              : "고객 정보 수정 중 오류가 발생했습니다.",
          error: error.message,
          code: error.code ?? null,
          elapsedMs: elapsed,
        },
        { status: isDuplicate ? 409 : 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          message: "고객을 찾을 수 없습니다.",
          elapsedMs: elapsed,
        },
        { status: 404 }
      );
    }

    if (shouldCreateStat) {
      const { error: statError } = await insertCustomerOrderStatistic({
        customer_id: customerId,
        order_channel: nextChannel,
        order_product: nextProduct,
        source: "customer_add",
        // 고객당 최초 보정 1회만 (재시도·중복 방지)
        source_ref: `customer_edit:${customerId}`,
      });

      if (statError) {
        console.error(
          "[PATCH /api/customers/:id] ⚠️ 통계 저장 실패:",
          statError.message
        );
      }
    }

    return NextResponse.json({
      success: true,
      data,
      statsCreated: shouldCreateStat,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        message: "서버 오류가 발생했습니다.",
        error: message,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
