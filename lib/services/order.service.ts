import { DEFAULT_ALIGO_TEMPLATE_TYPE } from "@/lib/constants/aligo";
import { MAX_ALIGO_RETRY } from "@/lib/constants/order";
import type { createClient } from "@/lib/supabase/server";
import {
  getOrderById,
  listOrders,
  recordAligoSendOutcome,
} from "@/lib/supabase/orders";
import type { Order } from "@/types/database";
import type { OrderListQueryParams } from "@/types/order";
import type { AligoFailReason } from "@/lib/aligo/fail-reason";
import { classifyAligoFailure } from "@/lib/aligo/fail-reason";
import { sendAligoNotificationForOrder } from "@/lib/services/aligo.service";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface OrderAligoSendResult {
  success: boolean;
  message: string;
  order: Order | null;
  failReason?: AligoFailReason;
  failMessage?: string;
  aligoCode?: number;
  templtCode?: string;
  retryCount?: number;
}

export function canRetryAligoSend(order: Pick<Order, "retry_count">): boolean {
  return (order.retry_count ?? 0) < MAX_ALIGO_RETRY;
}

export async function listShipmentOrders(
  supabase: ServerSupabaseClient,
  params: OrderListQueryParams
) {
  return listOrders(supabase, params);
}

export async function executeOrderAligoSend(
  supabase: ServerSupabaseClient,
  order: Order,
  options: { incrementRetry?: boolean } = {}
): Promise<OrderAligoSendResult> {
  const templateType =
    order.aligo_template_type || DEFAULT_ALIGO_TEMPLATE_TYPE;

  const aligoResult = await sendAligoNotificationForOrder({
    customer_name: order.customer_name,
    phone: order.phone,
    sender_name: order.sender_name,
    receiver_name: order.receiver_name,
    tracking_number: order.tracking_number,
    templateType,
  });

  if (aligoResult.success) {
    const { data, error } = await recordAligoSendOutcome(supabase, order.id, {
      success: true,
      incrementRetry: options.incrementRetry,
      aligoResponse: aligoResult.auditLog ?? null,
    });

    if (error) {
      console.error("[order.service] 성공 기록 실패:", error.message);
    }

    return {
      success: true,
      message: aligoResult.message,
      order: data ?? { ...order, aligo_status: "success" },
      aligoCode: aligoResult.aligoCode,
      templtCode: aligoResult.templtCode,
      retryCount: data?.retry_count,
    };
  }

  const failReason =
    aligoResult.failReason ??
    classifyAligoFailure({
      message: aligoResult.message,
      aligoCode: aligoResult.aligoCode,
      isValidationError: Boolean(aligoResult.missingFields?.length),
      isNetworkError: aligoResult.retryRecommended && !aligoResult.aligoCode,
    });

  const failMessage = aligoResult.message;

  const { data, error } = await recordAligoSendOutcome(supabase, order.id, {
    success: false,
    failReason,
    failMessage,
    incrementRetry: options.incrementRetry,
    aligoResponse: aligoResult.auditLog ?? null,
  });

  if (error) {
    console.error("[order.service] 실패 기록 실패:", error.message);
  }

  return {
    success: false,
    message: failMessage,
    order: data ?? {
      ...order,
      aligo_status: "failed",
      aligo_fail_reason: failReason,
      aligo_fail_message: failMessage,
    },
    failReason,
    failMessage,
    aligoCode: aligoResult.aligoCode,
    templtCode: aligoResult.templtCode,
    retryCount: data?.retry_count,
  };
}

export async function loadOrderAndSend(
  supabase: ServerSupabaseClient,
  orderId: string,
  options: { incrementRetry?: boolean } = {}
): Promise<OrderAligoSendResult | { error: string; notFound?: boolean }> {
  const { data: order, error } = await getOrderById(supabase, orderId);

  if (error) {
    return { error: error.message };
  }

  if (!order) {
    return { error: "주문을 찾을 수 없습니다.", notFound: true };
  }

  return executeOrderAligoSend(supabase, order, options);
}
