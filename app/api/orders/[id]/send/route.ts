import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { executeOrderAligoSend, canRetryAligoSend } from "@/lib/services/order.service";
import { MAX_ALIGO_RETRY } from "@/lib/constants/order";
import { createClient } from "@/lib/supabase/server";
import { getOrderById, updateOrder } from "@/lib/supabase/orders";
import { ALIGO_FAIL_REASON_LABEL } from "@/lib/constants/aligo";
import {
  validateOrderId,
  validateUpdateOrderInput,
} from "@/lib/validations/order";

/**
 * POST /api/orders/[id]/send
 * 주문 저장 후 알림톡 발송 (재발송 시 retry_count 증가)
 */
export async function POST(
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
      return NextResponse.json(
        {
          success: false,
          message: "주문 ID가 올바르지 않습니다.",
          errors: idValidation.errors,
        },
        { status: 400 }
      );
    }

    let body: unknown = {};
    try {
      const text = await request.text();
      if (text.trim()) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "요청 본문이 올바른 JSON 형식이 아닙니다.",
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: existing, error: fetchError } = await getOrderById(
      supabase,
      idValidation.id
    );

    if (fetchError) {
      console.error("[POST /api/orders/[id]/send] ❌ 조회 오류:", fetchError.message);
      return NextResponse.json(
        {
          success: false,
          message: "주문 조회 중 오류가 발생했습니다.",
          error: fetchError.message,
        },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "주문을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (existing.aligo_status === "failed" && !canRetryAligoSend(existing)) {
      return NextResponse.json(
        {
          success: false,
          message: `재발송 한도(${MAX_ALIGO_RETRY}회)를 초과했습니다.`,
          retryCount: existing.retry_count ?? 0,
        },
        { status: 429 }
      );
    }

    let orderData = existing;

    if (body && typeof body === "object" && Object.keys(body).length > 0) {
      const validation = validateUpdateOrderInput(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            success: false,
            message: "입력값 검증에 실패했습니다.",
            errors: validation.errors,
          },
          { status: 400 }
        );
      }

      const { data: updated, error: updateError } = await updateOrder(
        supabase,
        idValidation.id,
        validation.data
      );

      if (updateError || !updated) {
        return NextResponse.json(
          {
            success: false,
            message: "주문 저장 중 오류가 발생했습니다.",
            error: updateError?.message,
          },
          { status: 500 }
        );
      }

      orderData = updated;
    }

    const incrementRetry = existing.aligo_status !== "pending";

    const result = await executeOrderAligoSend(supabase, orderData, {
      incrementRetry,
    });

    const elapsed = Date.now() - startedAt;

    if (result.success) {
      console.log(
        `[POST /api/orders/[id]/send] ✅ 발송 성공 (retry: ${result.retryCount ?? 0})`
      );
    } else {
      console.error(
        `[POST /api/orders/[id]/send] ❌ 발송 실패: ${result.failReason}`,
        result.failMessage
      );
    }

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? "알림톡 발송이 완료되었습니다."
        : result.failReason
          ? `${ALIGO_FAIL_REASON_LABEL[result.failReason]}: ${result.message}`
          : result.message,
      data: result.order,
      failReason: result.failReason,
      failMessage: result.failMessage,
      retryCount: result.retryCount,
      aligo: {
        code: result.aligoCode,
        message: result.message,
        templtCode: result.templtCode,
      },
      elapsedMs: elapsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/orders/[id]/send] ❌ 예외:", message);

    return NextResponse.json(
      {
        success: false,
        message: "알림톡 발송 중 오류가 발생했습니다.",
        error: message,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
