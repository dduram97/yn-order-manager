import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { executeOrderAligoSend, canRetryAligoSend } from "@/lib/services/order.service";
import { MAX_ALIGO_RETRY } from "@/lib/constants/order";
import { createClient } from "@/lib/supabase/server";
import { getOrderById, insertOrder, updateOrder } from "@/lib/supabase/orders";
import { ALIGO_FAIL_REASON_LABEL } from "@/lib/constants/aligo";
import type { UpdateOrderInput } from "@/types/order";
import type { OrderAligoSendResult } from "@/lib/services/order.service";
import type { AligoFailReason } from "@/lib/aligo/fail-reason";
import {
  validateOrderId,
  validateUpdateOrderInput,
} from "@/lib/validations/order";
import { validateTrackingNumber } from "@/lib/validations/tracking-number";

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

    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const trackingNumbersRaw = record.tracking_numbers;
    const trackingNumbers =
      Array.isArray(trackingNumbersRaw)
        ? trackingNumbersRaw
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter((v) => v !== "")
        : null;

    const updateBody: Record<string, unknown> = { ...record };
    delete updateBody.tracking_numbers;

    let updatePayload: UpdateOrderInput | null = null;
    if (Object.keys(updateBody).length > 0) {
      const validation = validateUpdateOrderInput(updateBody);
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
      updatePayload = validation.data;
    }

    const incrementRetry = existing.aligo_status !== "pending";

    // 여러 송장 발송: tracking_numbers가 있으면 송장별로 orders row를 생성하여 독립 발송/이력 저장
    if (trackingNumbers && trackingNumbers.length > 0) {
      for (const tn of trackingNumbers) {
        const trackingError = validateTrackingNumber(tn);
        if (trackingError) {
          return NextResponse.json(
            { success: false, message: trackingError },
            { status: 400 }
          );
        }
      }

      const groupId = existing.group_id ?? crypto.randomUUID();
      const [first, ...rest] = Array.from(new Set(trackingNumbers));

      const { data: updated, error: updateError } = await updateOrder(
        supabase,
        idValidation.id,
        ({
          ...(updatePayload ?? {}),
          tracking_number: first,
          group_id: groupId,
        } satisfies UpdateOrderInput)
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

      const results: OrderAligoSendResult[] = [];

      const firstResult = await executeOrderAligoSend(supabase, orderData, {
        incrementRetry,
      });
      results.push(firstResult);

      for (const tn of rest) {
        const { data: cloned, error: insertError } = await insertOrder(supabase, {
          group_id: groupId,
          customer_name: orderData.customer_name,
          phone: orderData.phone,
          tracking_number: tn,
          sender_name: orderData.sender_name ?? null,
          receiver_name: orderData.receiver_name ?? null,
          memo: orderData.memo ?? null,
          sent_date: orderData.sent_date,
          aligo_status: "pending",
          aligo_template_type: orderData.aligo_template_type,
        });

        if (insertError || !cloned) {
          results.push({
            success: false,
            message: "추가 송장 저장에 실패했습니다.",
            failReason: "UNKNOWN_ERROR" satisfies AligoFailReason,
            failMessage: insertError?.message,
            order: null,
          });
          continue;
        }

        const r = await executeOrderAligoSend(supabase, cloned, {
          incrementRetry: false,
        });
        results.push(r);
      }

      const allSuccess = results.every((r) => r.success === true);
      const elapsed = Date.now() - startedAt;

      const firstRes = results[0];

      return NextResponse.json({
        success: allSuccess,
        message: allSuccess
          ? `알림톡 발송이 완료되었습니다. (${results.length}건)`
          : `일부 발송에 실패했습니다. (${results.filter((r) => r.success).length}/${results.length})`,
        data: firstRes.order ?? orderData,
        results: results.map((r) => ({
          success: r.success,
          orderId: r.order?.id ?? null,
          tracking_number: r.order?.tracking_number ?? null,
          failReason: r.failReason ?? null,
          failMessage: r.failMessage ?? null,
          retryCount: r.retryCount ?? null,
        })),
        elapsedMs: elapsed,
      });
    }

    // 단일 송장(기존 방식)
    if (updatePayload) {
      const { data: updated, error: updateError } = await updateOrder(
        supabase,
        idValidation.id,
        updatePayload
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

    const trackingError = validateTrackingNumber(orderData.tracking_number);
    if (trackingError) {
      return NextResponse.json(
        { success: false, message: trackingError },
        { status: 400 }
      );
    }

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
