import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { getOrderById, updateOrder } from "@/lib/supabase/orders";
import {
  validateOrderId,
  validateUpdateOrderInput,
} from "@/lib/validations/order";

/**
 * GET   - 주문 상세 조회
 * PATCH - 주문 수정 (메모, 송장번호)
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    const { id } = await context.params;
    const validation = validateOrderId(id);

    if (!validation.success) {
      console.error("[GET /api/orders/[id]] ❌ Validation error:", validation.errors);
      return NextResponse.json(
        {
          success: false,
          message: "주문 ID가 올바르지 않습니다.",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    console.log("[GET /api/orders/[id]] 상세 조회:", validation.id);

    const supabase = await createClient();
    const { data, error } = await getOrderById(supabase, validation.id);

    const elapsed = Date.now() - startedAt;

    if (error) {
      console.error("[GET /api/orders/[id]] ❌ Supabase 오류:", error.message);
      console.error("[GET /api/orders/[id]] 상세:", JSON.stringify(error));

      return NextResponse.json(
        {
          success: false,
          message: "주문 조회 중 오류가 발생했습니다.",
          error: error.message,
          code: error.code ?? null,
          elapsedMs: elapsed,
        },
        { status: 500 }
      );
    }

    if (!data) {
      console.log(`[GET /api/orders/[id]] ❌ 주문 없음 (id: ${validation.id})`);
      return NextResponse.json(
        {
          success: false,
          message: "주문을 찾을 수 없습니다.",
          elapsedMs: elapsed,
        },
        { status: 404 }
      );
    }

    console.log(
      `[GET /api/orders/[id]] ✅ 조회 성공 (id: ${data.id}, ${elapsed}ms)`
    );

    return NextResponse.json({
      success: true,
      data,
      elapsedMs: elapsed,
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);

    console.error("[GET /api/orders/[id]] ❌ 예외 발생:", message);

    return NextResponse.json(
      {
        success: false,
        message: "서버 오류가 발생했습니다.",
        error: message,
        elapsedMs: elapsed,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth({ adminOnly: true });
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    const { id } = await context.params;
    const idValidation = validateOrderId(id);

    if (!idValidation.success) {
      console.error(
        "[PATCH /api/orders/[id]] ❌ Validation error:",
        idValidation.errors
      );
      return NextResponse.json(
        {
          success: false,
          message: "주문 ID가 올바르지 않습니다.",
          errors: idValidation.errors,
        },
        { status: 400 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      console.error("[PATCH /api/orders/[id]] ❌ JSON 파싱 실패");
      return NextResponse.json(
        {
          success: false,
          message: "요청 본문이 올바른 JSON 형식이 아닙니다.",
        },
        { status: 400 }
      );
    }

    const validation = validateUpdateOrderInput(body);
    if (!validation.success) {
      console.error(
        "[PATCH /api/orders/[id]] ❌ Validation error:",
        validation.errors
      );
      return NextResponse.json(
        {
          success: false,
          message: "입력값 검증에 실패했습니다.",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    console.log("[PATCH /api/orders/[id]] 수정 요청:", {
      id: idValidation.id,
      fields: Object.keys(validation.data),
    });

    const supabase = await createClient();
    const { data, error } = await updateOrder(
      supabase,
      idValidation.id,
      validation.data
    );

    const elapsed = Date.now() - startedAt;

    if (error) {
      console.error("[PATCH /api/orders/[id]] ❌ Supabase 오류:", error.message);
      console.error("[PATCH /api/orders/[id]] 상세:", JSON.stringify(error));

      return NextResponse.json(
        {
          success: false,
          message: "주문 수정 중 오류가 발생했습니다.",
          error: error.message,
          code: error.code ?? null,
          elapsedMs: elapsed,
        },
        { status: 500 }
      );
    }

    if (!data) {
      console.log(
        `[PATCH /api/orders/[id]] ❌ 주문 없음 (id: ${idValidation.id})`
      );
      return NextResponse.json(
        {
          success: false,
          message: "주문을 찾을 수 없습니다.",
          elapsedMs: elapsed,
        },
        { status: 404 }
      );
    }

    console.log(
      `[PATCH /api/orders/[id]] ✅ 수정 성공 (id: ${data.id}, ${elapsed}ms)`
    );

    return NextResponse.json({
      success: true,
      message: "주문 수정 성공",
      data,
      elapsedMs: elapsed,
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);

    console.error("[PATCH /api/orders/[id]] ❌ 예외 발생:", message);

    return NextResponse.json(
      {
        success: false,
        message: "서버 오류가 발생했습니다.",
        error: message,
        elapsedMs: elapsed,
      },
      { status: 500 }
    );
  }
}
