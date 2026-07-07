import { DEFAULT_ALIGO_TEMPLATE_TYPE } from "@/lib/constants/aligo";
import type { createClient } from "@/lib/supabase/server";
import type { AligoFailReason, AligoStatus, Order } from "@/types/database";
import type { OrderListQueryParams, OrderListItem, UpdateOrderInput } from "@/types/order";
import type { AligoResponseLog } from "@/types/aligo-audit";
import { escapeIlike, normalizePhone } from "@/lib/validations/order";

export interface InsertOrderPayload {
  group_id?: string | null;
  customer_name: string;
  phone: string;
  tracking_number: string;
  sender_name?: string | null;
  receiver_name?: string | null;
  memo: string | null;
  sent_date: string;
  aligo_status: "pending";
  aligo_template_type?: string;
}

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** 목록 조회 — created_at(KST 일자) 기간 필터 + 실패 사유 */
const ORDER_LIST_COLUMNS_BASE =
  "id, customer_name, phone, tracking_number, memo, sent_date, created_at, aligo_status";

const ORDER_LIST_COLUMNS_WITH_FAIL = `${ORDER_LIST_COLUMNS_BASE}, aligo_fail_reason, aligo_fail_message, retry_count, last_retry_at, sent_at`;

export async function insertOrder(
  supabase: ServerSupabaseClient,
  payload: InsertOrderPayload
) {
  // 수동 정의 Database 타입과 postgrest-js v2.110 간 insert 타입 추론 이슈 우회
  let { data, error } = await supabase
    .from("orders")
    .insert(payload as never)
    .select()
    .single();

  if (error?.code === "42703") {
    // group_id 등 신규 컬럼 적용 전 환경 fallback
    const { group_id, ...legacy } = payload;
    void group_id;
    const legacyResult = await supabase
      .from("orders")
      .insert(legacy as never)
      .select()
      .single();
    data = legacyResult.data;
    error = legacyResult.error as unknown as typeof error;
  }

  return {
    data: data as Order | null,
    error: error as { message: string; code?: string } | null,
  };
}

/** 상세/수정 조회용 컬럼 */
const ORDER_DETAIL_COLUMNS =
  "id, customer_name, phone, tracking_number, sender_name, receiver_name, memo, sent_date, created_at, aligo_status, aligo_template_type, aligo_fail_reason, aligo_fail_message, retry_count, last_retry_at, aligo_response, sent_at";

const ORDER_DETAIL_COLUMNS_LEGACY =
  "id, customer_name, phone, tracking_number, sender_name, receiver_name, memo, sent_date, created_at, aligo_status, aligo_template_type";

async function fetchOrderById(
  supabase: ServerSupabaseClient,
  id: string,
  columns: string
) {
  const { data, error } = await supabase
    .from("orders")
    .select(columns)
    .eq("id", id)
    .maybeSingle();

  return {
    data: data as Order | null,
    error: error as { message: string; code?: string } | null,
  };
}

async function getOrderDetailById(supabase: ServerSupabaseClient, id: string) {
  const columnVariants = [
    `${ORDER_DETAIL_COLUMNS}, updated_at`,
    ORDER_DETAIL_COLUMNS,
    `${ORDER_DETAIL_COLUMNS_LEGACY}, updated_at`,
    ORDER_DETAIL_COLUMNS_LEGACY,
    "id, customer_name, phone, tracking_number, memo, sent_date, created_at, aligo_status, aligo_template_type",
    "id, customer_name, phone, tracking_number, memo, sent_date, created_at, aligo_status",
  ];

  for (const columns of columnVariants) {
    const result = await fetchOrderById(supabase, id, columns);
    if (result.error?.code !== "42703") {
      return {
        ...result,
        data: result.data
          ? {
              ...result.data,
              aligo_template_type:
                result.data.aligo_template_type || DEFAULT_ALIGO_TEMPLATE_TYPE,
            }
          : null,
      };
    }
  }

  return fetchOrderById(supabase, id, columnVariants[columnVariants.length - 1]);
}

export async function getOrderById(
  supabase: ServerSupabaseClient,
  id: string
) {
  return getOrderDetailById(supabase, id);
}

export async function updateOrder(
  supabase: ServerSupabaseClient,
  id: string,
  payload: UpdateOrderInput
) {
  const { error: updateError } = await supabase
    .from("orders")
    .update(payload as never)
    .eq("id", id);

  if (updateError) {
    return {
      data: null,
      error: updateError as { message: string; code?: string },
    };
  }

  return getOrderDetailById(supabase, id);
}

export async function updateAligoStatus(
  supabase: ServerSupabaseClient,
  orderId: string,
  aligoStatus: Extract<AligoStatus, "success" | "failed">
) {
  const { error } = await supabase
    .from("orders")
    .update({ aligo_status: aligoStatus } as never)
    .eq("id", orderId);

  return {
    error: error as { message: string; code?: string } | null,
  };
}

export interface RecordAligoSendOutcomeInput {
  success: boolean;
  failReason?: AligoFailReason | null;
  failMessage?: string | null;
  incrementRetry?: boolean;
  aligoResponse?: AligoResponseLog | null;
}

export async function recordAligoSendOutcome(
  supabase: ServerSupabaseClient,
  orderId: string,
  input: RecordAligoSendOutcomeInput
) {
  const { data: current, error: fetchError } = await getOrderById(
    supabase,
    orderId
  );

  if (fetchError || !current) {
    return {
      data: null,
      error: fetchError ?? { message: "주문을 찾을 수 없습니다." },
    };
  }

  const now = new Date().toISOString();
  const nextRetryCount =
    (current.retry_count ?? 0) + (input.incrementRetry ? 1 : 0);

  const payload: UpdateOrderInput = input.success
    ? {
        aligo_status: "success",
        aligo_fail_reason: null,
        aligo_fail_message: null,
        sent_at: now,
        aligo_response: input.aligoResponse ?? null,
        ...(input.incrementRetry
          ? { retry_count: nextRetryCount, last_retry_at: now }
          : {}),
      }
    : {
        aligo_status: "failed",
        aligo_fail_reason: input.failReason ?? "UNKNOWN_ERROR",
        aligo_fail_message: input.failMessage ?? null,
        aligo_response: input.aligoResponse ?? null,
        ...(input.incrementRetry
          ? { retry_count: nextRetryCount, last_retry_at: now }
          : {}),
      };

  return updateOrder(supabase, orderId, payload);
}

async function queryListOrders(
  supabase: ServerSupabaseClient,
  params: OrderListQueryParams,
  columns: string
) {
  const { startAt, endAt, customer_name, phone, tracking_number } = params;

  let query = supabase
    .from("orders")
    .select(columns)
    .gte("created_at", startAt)
    .lte("created_at", endAt);

  if (customer_name) {
    query = query.ilike("customer_name", `%${escapeIlike(customer_name)}%`);
  }

  if (phone) {
    query = query.ilike("phone", `%${normalizePhone(phone)}%`);
  }

  if (tracking_number) {
    const term = escapeIlike(tracking_number.trim());
    query = query.or(
      `tracking_number.ilike.%${term}%,id.ilike.%${term}%`
    );
  }

  return query.order("created_at", { ascending: false });
}

function mapOrderListRow(
  row: Omit<OrderListItem, "customer_memo" | "status"> & {
    memo?: string | null;
    aligo_status: AligoStatus;
  }
): OrderListItem {
  const { memo, aligo_status, ...rest } = row;
  return {
    ...rest,
    aligo_status,
    status: aligo_status,
    customer_memo: memo ?? null,
  };
}

export async function listOrders(
  supabase: ServerSupabaseClient,
  params: OrderListQueryParams
) {
  let result = await queryListOrders(
    supabase,
    params,
    `${ORDER_LIST_COLUMNS_WITH_FAIL}, aligo_response`
  );

  if (result.error?.code === "42703") {
    result = await queryListOrders(supabase, params, ORDER_LIST_COLUMNS_WITH_FAIL);
  }

  if (result.error?.code === "42703") {
    result = await queryListOrders(supabase, params, ORDER_LIST_COLUMNS_BASE);
  }

  const { data, error } = result;

  type OrderListRow = Omit<OrderListItem, "customer_memo" | "status"> & {
    memo?: string | null;
    aligo_status: AligoStatus;
  };

  const rows = (data ?? []) as OrderListRow[];

  return {
    data: rows.map(mapOrderListRow),
    error: error as { message: string; code?: string } | null,
  };
}
