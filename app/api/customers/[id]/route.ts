import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  NAVER_ORDER_ATTR_EDIT_LOCKED_CODE,
  NAVER_ORDER_ATTR_EDIT_LOCKED_MESSAGE,
} from "@/lib/constants/customer-edit";
import {
  correctNaverOrderStatistic,
  findEditableNaverOrderStatistic,
  isWithinNaverOrderAttrEditWindow,
  resolveCustomerEditKind,
} from "@/lib/supabase/customer-order-stats";
import { updateCustomerById } from "@/lib/supabase/customers";
import { createClient } from "@/lib/supabase/server";
import { validateUpdateCustomerInput } from "@/lib/validations/customer";
import { validateOrderId } from "@/lib/validations/order";

/**
 * PATCH /api/customers/[id]
 * body: { name, phone, memo?, order_channel?, order_product? }
 *
 * - 고객명/전화/메모: 항상 저장 가능
 * - 주문채널/상품: 네이버(customer_add)만 24시간 이내 정정. 초과 시 주문정보만 유지·잠금 안내
 * - CRM: 주문정보·통계 변경 없음
 * - 유선(발송등록·backfill): 고객정보 수정 가능, 통계 정정 없음
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

    const prevChannelRaw = (beforeRow as { order_channel?: string | null })
      .order_channel;
    const prevProductRaw = (beforeRow as { order_product?: string | null })
      .order_product;
    const prevChannel = String(prevChannelRaw ?? "").trim();
    const prevProduct = String(prevProductRaw ?? "").trim();

    const editKind = await resolveCustomerEditKind({
      customer_id: customerId,
      order_channel: prevChannelRaw,
      order_product: prevProductRaw,
    });

    if (editKind.error) {
      return NextResponse.json(
        {
          success: false,
          message: "고객 유형 조회 중 오류가 발생했습니다.",
          error: editKind.error.message,
          elapsedMs: Date.now() - startedAt,
        },
        { status: 500 }
      );
    }

    const isCrm = editKind.kind === "crm";
    const nextChannel = validation.data.order_channel?.trim() ?? "";
    const nextProduct = validation.data.order_product?.trim() ?? "";
    const nowOrderInfoFilled = nextChannel !== "" && nextProduct !== "";
    const orderAttrsChanged =
      !isCrm &&
      (prevChannel !== nextChannel || prevProduct !== nextProduct);

    let orderAttrLocked = false;
    let updatePayload = {
      name: validation.data.name,
      phone: validation.data.phone,
      memo: validation.data.memo,
      order_channel: isCrm
        ? prevChannelRaw ?? null
        : validation.data.order_channel,
      order_product: isCrm
        ? prevProductRaw ?? null
        : validation.data.order_product,
    };

    // 네이버 주문 채널/상품 변경: 24시간 초과면 주문정보만 유지하고 고객정보는 저장
    if (
      !isCrm &&
      orderAttrsChanged &&
      nowOrderInfoFilled &&
      prevChannel !== "" &&
      prevProduct !== ""
    ) {
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
        orderAttrLocked = true;
        updatePayload = {
          ...updatePayload,
          order_channel: prevChannelRaw ?? null,
          order_product: prevProductRaw ?? null,
        };
      }
    }

    const { data, error } = await updateCustomerById(
      supabase,
      customerId,
      updatePayload
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

    let statsCorrected = false;

    // CRM·잠금·유선: 통계 생성/정정 없음. 네이버 24시간 이내 채널·상품 변경만 정정
    if (
      !isCrm &&
      !orderAttrLocked &&
      orderAttrsChanged &&
      nowOrderInfoFilled &&
      prevChannel !== "" &&
      prevProduct !== ""
    ) {
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
        orderAttrLocked = true;
      } else {
        statsCorrected = updated === true;
      }
    }

    return NextResponse.json({
      success: true,
      data,
      statsCorrected,
      orderAttrLocked,
      ...(orderAttrLocked
        ? {
            code: NAVER_ORDER_ATTR_EDIT_LOCKED_CODE,
            message: NAVER_ORDER_ATTR_EDIT_LOCKED_MESSAGE,
          }
        : {}),
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
