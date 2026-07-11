import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  ALIGO_FAIL_REASON_LABEL,
  DEFAULT_ALIGO_TEMPLATE_TYPE,
} from "@/lib/constants/aligo";
import { WIRED_ORDER_CHANNEL } from "@/lib/constants/order-attributes";
import { executeOrderAligoSend } from "@/lib/aligo/order-send-outcome";
import { upsertCustomerByPhone } from "@/lib/supabase/customers";
import { createClient } from "@/lib/supabase/server";
import { syncCustomerVipByPhone } from "@/lib/supabase/vip";
import { deleteOrdersByIds, insertOrder } from "@/lib/supabase/orders";
import { insertCustomerOrderStatistic } from "@/lib/supabase/customer-order-stats";
import { listShipmentOrders } from "@/lib/services/order.service";
import type { OrderAligoSendResult } from "@/lib/services/order.service";
import {
  getTodayDateString,
  parseOrderListQueryParams,
  validateCreateOrderInput,
} from "@/lib/validations/order";

/**
 * GET  - 주문 목록 조회 (?startDate, ?endDate)
 * POST - 주문 등록 → DB 저장
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseOrderListQueryParams(searchParams);

    if (!parsed.success) {
      console.error("[GET /api/orders] ❌ Validation error:", parsed.errors);
      return NextResponse.json({
        success: false,
        message: "쿼리 파라미터가 올바르지 않습니다.",
        data: [],
        errors: parsed.errors,
        elapsedMs: Date.now() - startedAt,
      });
    }

    const { startDate, endDate, startAt, endAt, customer_name, phone, tracking_number } =
      parsed.data;
    console.log("[GET /api/orders] 목록 조회:", {
      startDate,
      endDate,
      startAt,
      endAt,
      customer_name,
      phone,
      tracking_number,
    });

    const supabase = await createClient();
    const { data, pagination, error } = await listShipmentOrders(supabase, parsed.data);
    const elapsed = Date.now() - startedAt;

    if (error) {
      console.error("[GET /api/orders] ❌ Supabase 오류:", error.message);
      console.error("[GET /api/orders] 상세:", JSON.stringify(error));

      return NextResponse.json({
        success: false,
        message: "주문 목록 조회 중 오류가 발생했습니다.",
        data: [],
        error: error.message,
        code: error.code ?? null,
        elapsedMs: elapsed,
      });
    }

    console.log(
      `[GET /api/orders] ✅ 조회 성공 (${data.length}건, ${elapsed}ms)`
    );

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
      totalCount: pagination.totalCount,
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      pagination,
      startDate,
      endDate,
      elapsedMs: elapsed,
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);

    console.error("[GET /api/orders] ❌ 예외 발생:", message);

    return NextResponse.json({
      success: false,
      message: "서버 오류가 발생했습니다.",
      data: [],
      error: message,
      elapsedMs: elapsed,
    });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth({ adminOnly: true });
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    console.log("[POST /api/orders] 주문 등록 요청 수신");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      console.error("[POST /api/orders] ❌ JSON 파싱 실패");
      return NextResponse.json(
        {
          success: false,
          message: "요청 본문이 올바른 JSON 형식이 아닙니다.",
        },
        { status: 400 }
      );
    }

    const validation = validateCreateOrderInput(body);
    if (!validation.success || !validation.data) {
      console.error(
        "[POST /api/orders] ❌ Validation error:",
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

    const { customer_name, phone, tracking_number, tracking_numbers, memo, sender_name, receiver_name, order_product } =
      validation.data;
    const order_channel = WIRED_ORDER_CHANNEL;
    const templateType =
      validation.data.aligo_template_type ?? DEFAULT_ALIGO_TEMPLATE_TYPE;
    const sent_date = getTodayDateString();

    const numbers =
      tracking_numbers && tracking_numbers.length > 0
        ? tracking_numbers
        : [tracking_number ?? ""];

    const groupId = numbers.length > 1 ? crypto.randomUUID() : null;

    console.log("[POST /api/orders] 저장 데이터:", {
      customer_name,
      phone,
      tracking_count: numbers.length,
      tracking_numbers: numbers,
      memo: memo ?? "(없음)",
      order_channel,
      order_product,
      sent_date,
      aligo_status: "pending",
    });

    const supabase = await createClient();

    // 신규/기존 무관 — 항상 최신 고객 정보로 upsert
    const { data: customer, error: customerError } = await upsertCustomerByPhone(
      supabase,
      {
        name: customer_name,
        phone,
        memo: memo ?? null,
        order_channel,
        order_product,
      }
    );

    if (customerError) {
      console.error(
        "[POST /api/orders] ⚠️ customers upsert 실패:",
        customerError.message
      );
    } else if (customer) {
      console.log(
        `[POST /api/orders] customers upsert 성공 (id: ${customer.id}, phone: ${customer.phone})`
      );
    }

    // upsert 실패 시에도 기존 고객 id를 조회해 통계에 연결
    let customerId = customer?.id ?? null;
    if (!customerId) {
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();
      customerId = (existingCustomer as { id?: string } | null)?.id ?? null;
    }

    const results: OrderAligoSendResult[] = [];
    let firstOrderData = null;

    for (const tn of numbers) {
      const { data, error } = await insertOrder(supabase, {
        ...(groupId ? { group_id: groupId } : {}),
        customer_name,
        phone,
        tracking_number: tn,
        sender_name: sender_name ?? null,
        receiver_name: receiver_name ?? null,
        memo: memo ?? null,
        sent_date,
        aligo_status: "pending",
        aligo_template_type: templateType,
      });

      if (error || !data) {
        console.error(
          "[POST /api/orders] ❌ Supabase 오류:",
          error?.message ?? "저장된 데이터가 없습니다."
        );

        return NextResponse.json(
          {
            success: false,
            message: "주문 저장 중 오류가 발생했습니다.",
            error: error?.message ?? "저장된 데이터가 없습니다.",
            code: error?.code ?? null,
            elapsedMs: Date.now() - startedAt,
          },
          { status: 500 }
        );
      }

      if (!firstOrderData) {
        firstOrderData = data;
      }

      let aligoSendResult: OrderAligoSendResult | null = null;

      try {
        aligoSendResult = await executeOrderAligoSend(supabase, data, {
          incrementRetry: false,
        });
        results.push(aligoSendResult);

        if (aligoSendResult.success) {
          console.log(
            `[POST /api/orders] Aligo 발송 성공 (${tn}): ${aligoSendResult.message}`
          );
        } else {
          console.error(
            `[POST /api/orders] Aligo 발송 실패 (${tn}): ${aligoSendResult.failReason}`,
            aligoSendResult.failMessage
          );
        }
      } catch (aligoError) {
        const message =
          aligoError instanceof Error ? aligoError.message : String(aligoError);
        console.error("[POST /api/orders] ⚠️ Aligo 발송 처리 예외:", message);
        results.push({
          success: false,
          message,
          order: data,
        });
      }
    }

    const elapsed = Date.now() - startedAt;
    const orderData = results[0]?.order ?? firstOrderData;
    const allSuccess = results.every((r) => r.success);
    const firstResult = results[0];

    console.log(
      `[POST /api/orders] ✅ 주문 등록 성공 (${numbers.length}건, ${elapsed}ms)`
    );

    // 발송등록 완료마다 통계 1건 (기존 고객 재구매 포함) — 채널 고정: 유선주문
    if (customerId && firstOrderData?.id) {
      const { error: statError } = await insertCustomerOrderStatistic({
        customer_id: customerId,
        order_channel: WIRED_ORDER_CHANNEL,
        order_product,
        source: "order_registration",
        source_ref: firstOrderData.id,
      });
      if (statError) {
        console.error(
          "[POST /api/orders] ⚠️ 통계 저장 실패:",
          statError.message
        );
      }
    } else {
      console.error(
        "[POST /api/orders] ⚠️ 통계 저장 생략: customerId 또는 orderId 없음",
        { customerId, orderId: firstOrderData?.id ?? null }
      );
    }

    const { order_count, vip_level, error: vipSyncError } =
      await syncCustomerVipByPhone(supabase, phone);

    if (vipSyncError) {
      console.error(
        "[POST /api/orders] ⚠️ VIP 캐시 동기화 실패:",
        vipSyncError.message
      );
    } else {
      console.log(
        `[POST /api/orders] VIP 동기화: ${phone} → ${order_count}건 (${vip_level})`
      );
    }

    return NextResponse.json(
      {
        success: allSuccess,
        message:
          numbers.length > 1
            ? allSuccess
              ? `주문 등록 및 알림톡 발송 완료 (${results.length}건)`
              : `일부 발송에 실패했습니다. (${results.filter((r) => r.success).length}/${results.length})`
            : "주문 등록 성공",
        data: orderData,
        results:
          numbers.length > 1
            ? results.map((r) => ({
                success: r.success,
                orderId: r.order?.id ?? null,
                tracking_number: r.order?.tracking_number ?? null,
                failReason: r.failReason ?? null,
                failMessage: r.failMessage ?? null,
              }))
            : undefined,
        customer: customer ?? undefined,
        aligo: firstResult
          ? {
              success: firstResult.success,
              message: firstResult.success
                ? firstResult.message
                : firstResult.failReason
                  ? `${ALIGO_FAIL_REASON_LABEL[firstResult.failReason]}: ${firstResult.message}`
                  : firstResult.message,
              failReason: firstResult.failReason,
              failMessage: firstResult.failMessage,
            }
          : undefined,
        elapsedMs: elapsed,
      },
      { status: 201 }
    );
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);

    console.error("[POST /api/orders] ❌ 예외 발생:", message);

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

function parseDeleteOrderIds(body: unknown): {
  success: true;
  ids: string[];
} | {
  success: false;
  message: string;
} {
  if (!body || typeof body !== "object") {
    return { success: false, message: "요청 본문이 올바르지 않습니다." };
  }

  const { ids } = body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, message: "삭제할 항목을 선택해주세요." };
  }

  const cleaned = ids
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return { success: false, message: "삭제할 항목을 선택해주세요." };
  }

  return { success: true, ids: Array.from(new Set(cleaned)) };
}

/**
 * DELETE - 선택 발송(주문) 삭제
 * body: { ids: string[] }
 */
export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    const body = (await request.json()) as unknown;
    const parsed = parseDeleteOrderIds(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { deletedCount, error } = await deleteOrdersByIds(
      supabase,
      parsed.ids
    );
    const elapsed = Date.now() - startedAt;

    if (error) {
      console.error("[DELETE /api/orders] ❌ Supabase 오류:", error.message);
      return NextResponse.json(
        {
          success: false,
          message: "발송 내역 삭제 중 오류가 발생했습니다.",
          error: error.message,
          code: error.code ?? null,
          elapsedMs: elapsed,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      elapsedMs: elapsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /api/orders] ❌ 예외:", message);

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
