import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  correctNaverOrderStatistic,
  findEditableNaverOrderStatistic,
  insertCustomerOrderStatistic,
  isWithinNaverOrderAttrEditWindow,
  NAVER_ORDER_ATTR_EDIT_LOCKED_CODE,
  NAVER_ORDER_ATTR_EDIT_LOCKED_MESSAGE,
} from "@/lib/supabase/customer-order-stats";
import { updateCustomerById } from "@/lib/supabase/customers";
import { createClient } from "@/lib/supabase/server";
import { validateUpdateCustomerInput } from "@/lib/validations/customer";
import { validateOrderId } from "@/lib/validations/order";

/**
 * PATCH /api/customers/[id]
 * body: { name, phone, memo?, order_channel?, order_product? }
 *
 * 통계:
 * - NULL → 최초 주문정보 입력: +1 (보정)
 * - 네이버 주문(customer_add, backfill 제외) 채널/상품 변경: 해당 통계 1건 정정
 * - 이름/전화/메모만 변경, 유선(order_registration·backfill) 관련: 통계 변경 없음
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
    const orderAttrsChanged =
      prevChannel !== nextChannel || prevProduct !== nextProduct;
    const shouldCreateStat = wasOrderInfoEmpty && nowOrderInfoFilled;
    const shouldCorrectNaverStat =
      !wasOrderInfoEmpty &&
      nowOrderInfoFilled &&
      orderAttrsChanged;

    // 네이버 주문 채널/상품 변경: 24시간 초과면 고객 정보도 저장하지 않음
    if (shouldCorrectNaverStat) {
      const found = await findEditableNaverOrderStatistic({
        customer_id: customerId,
        channel: prevChannel,
        product: prevProduct,
      });

      if (found.error) {
        return NextResponse.json(
          {
            success: false,
            message: "주문 통계 조회 중 오류가 발생했습니다.",
            error: found.error.message,
            elapsedMs: Date.now() - startedAt,
          },
          { status: 500 }
        );
      }

      if (
        found.data &&
        !isWithinNaverOrderAttrEditWindow(found.data.created_at)
      ) {
        return NextResponse.json(
          {
            success: false,
            message: NAVER_ORDER_ATTR_EDIT_LOCKED_MESSAGE,
            code: NAVER_ORDER_ATTR_EDIT_LOCKED_CODE,
            elapsedMs: Date.now() - startedAt,
          },
          { status: 403 }
        );
      }
    }

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

    let statsCreated = false;
    let statsCorrected = false;

    if (shouldCreateStat) {
      const { error: statError } = await insertCustomerOrderStatistic({
        customer_id: customerId,
        order_channel: nextChannel,
        order_product: nextProduct,
        source: "customer_add",
        source_ref: `customer_edit:${customerId}`,
      });

      if (statError) {
        console.error(
          "[PATCH /api/customers/:id] ⚠️ 통계 저장 실패:",
          statError.message
        );
      } else {
        statsCreated = true;
      }
    } else if (shouldCorrectNaverStat) {
      const { error: correctError, updated, locked } =
        await correctNaverOrderStatistic({
          customer_id: customerId,
          prev_channel: prevChannel,
          prev_product: prevProduct,
          next_channel: nextChannel,
          next_product: nextProduct,
        });

      if (correctError) {
        console.error(
          "[PATCH /api/customers/:id] ⚠️ 네이버 주문 통계 정정 실패:",
          correctError.message
        );
      } else if (locked) {
        // 사전 검사에서 막혀야 하지만 방어적으로 처리
        return NextResponse.json(
          {
            success: false,
            message: NAVER_ORDER_ATTR_EDIT_LOCKED_MESSAGE,
            code: NAVER_ORDER_ATTR_EDIT_LOCKED_CODE,
            elapsedMs: Date.now() - startedAt,
          },
          { status: 403 }
        );
      } else {
        statsCorrected = updated === true;
      }
    }

    return NextResponse.json({
      success: true,
      data,
      statsCreated,
      statsCorrected,
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
