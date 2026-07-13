import { createAdminClient } from "@/lib/supabase/admin";
import type { createClient } from "@/lib/supabase/server";
import { normalizeTrackingNumber } from "@/lib/delivery/smart-tracker";
import { DELIVERY_TRACKING_EVENT_LABEL } from "@/lib/constants/delivery";
import type {
  DeliveryStatus,
  DeliveryTrackingEventSource,
  DeliveryTrackingEventType,
  DeliveryTrackingLog,
  DeliveryTrackingLogsResponse,
} from "@/types/delivery";
import type { Order } from "@/types/database";
import type { OrderListItem } from "@/types/order";
import type { SmartTrackerResponse } from "@/lib/delivery/smart-tracker";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type DeliveryOrderRow = Pick<
  Order,
  | "id"
  | "group_id"
  | "customer_name"
  | "phone"
  | "tracking_number"
  | "aligo_status"
  | "delivery_status"
  | "delivery_location"
  | "delivery_updated_at"
>;

const DELIVERY_ORDER_COLUMNS =
  "id, group_id, customer_name, phone, tracking_number, aligo_status, delivery_status, delivery_location, delivery_updated_at";

/** 고객용 조회: DB 저장 형식(하이픈/공백 포함)과 무관하게 숫자만으로 비교 */
function buildTrackingNumberLookupCandidates(normalized: string): string[] {
  const candidates = new Set<string>([normalized]);

  if (normalized.length === 12) {
    candidates.add(
      `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`
    );
    candidates.add(
      `${normalized.slice(0, 4)} ${normalized.slice(4, 8)} ${normalized.slice(8, 12)}`
    );
  }

  return [...candidates];
}

function pickLatestOrder(rows: DeliveryOrderRow[]): DeliveryOrderRow | null {
  if (rows.length === 0) return null;
  return rows[0];
}

export function resolveDeliveryTrackingEventType(
  source: DeliveryTrackingEventSource,
  deliveryStatus: DeliveryStatus,
  previousStatus?: DeliveryStatus | null
): DeliveryTrackingEventType {
  // 배송완료로 처음 전환될 때만 delivery_completed (이후 조회는 source 유지)
  if (
    deliveryStatus === "delivered" &&
    previousStatus !== "delivered"
  ) {
    return "delivery_completed";
  }
  return source;
}

/** 발송현황 '배송조회' 숫자에 포함되는 이벤트 */
export const CUSTOMER_TRACKING_VIEW_EVENT_TYPES: DeliveryTrackingEventType[] = [
  "customer_view",
  "delivery_completed",
];


/**
 * 고객용 /api/tracking 전용 — 송장번호를 숫자만 정규화하여 orders 조회
 * (관리자 배송조회 API는 orderId 기반이므로 영향 없음)
 */
export async function getOrderByTrackingNumber(
  supabase: ServerSupabaseClient,
  trackingNumber: string
) {
  const normalized = normalizeTrackingNumber(trackingNumber);

  if (!normalized) {
    return { data: null, error: null };
  }

  const candidates = buildTrackingNumberLookupCandidates(normalized);

  const { data: directMatches, error: directError } = await supabase
    .from("orders")
    .select(DELIVERY_ORDER_COLUMNS)
    .in("tracking_number", candidates)
    .order("created_at", { ascending: false })
    .limit(1);

  if (directError) {
    return {
      data: null,
      error: directError as { message: string; code?: string },
    };
  }

  const directRow = pickLatestOrder((directMatches ?? []) as DeliveryOrderRow[]);
  if (directRow) {
    return { data: directRow, error: null };
  }

  // 후보 문자열과 다른 형식(혼합 구분자 등) 대비 — prefix로 좁힌 뒤 숫자만 비교
  const prefix = normalized.slice(0, 4);
  const { data: prefixMatches, error: prefixError } = await supabase
    .from("orders")
    .select(DELIVERY_ORDER_COLUMNS)
    .ilike("tracking_number", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (prefixError) {
    return {
      data: null,
      error: prefixError as { message: string; code?: string },
    };
  }

  const normalizedMatch = ((prefixMatches ?? []) as DeliveryOrderRow[]).find(
    (row) => normalizeTrackingNumber(row.tracking_number) === normalized
  );

  return {
    data: normalizedMatch ?? null,
    error: null,
  };
}

export async function getOrderForDeliveryTrack(
  supabase: ServerSupabaseClient,
  orderId: string
) {
  const { data, error } = await supabase
    .from("orders")
    .select(DELIVERY_ORDER_COLUMNS)
    .eq("id", orderId)
    .maybeSingle();

  return {
    data: data as Pick<
      Order,
      | "id"
      | "group_id"
      | "customer_name"
      | "phone"
      | "tracking_number"
      | "aligo_status"
      | "delivery_status"
      | "delivery_location"
      | "delivery_updated_at"
    > | null,
    error: error as { message: string; code?: string } | null,
  };
}

export async function listOrdersForDeliveryGroup(
  supabase: ServerSupabaseClient,
  groupId: string
) {
  const { data, error } = await supabase
    .from("orders")
    .select(DELIVERY_ORDER_COLUMNS)
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  return {
    data: (data ?? []) as Pick<
      Order,
      | "id"
      | "group_id"
      | "customer_name"
      | "phone"
      | "tracking_number"
      | "aligo_status"
      | "delivery_status"
      | "delivery_location"
      | "delivery_updated_at"
    >[],
    error: error as { message: string; code?: string } | null,
  };
}

export async function updateOrderDeliveryStatus(
  supabase: ServerSupabaseClient,
  orderId: string,
  input: {
    delivery_status: DeliveryStatus;
    delivery_location?: string | null;
    delivery_updated_at?: string;
  }
) {
  const now = input.delivery_updated_at ?? new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({
      delivery_status: input.delivery_status,
      delivery_location: input.delivery_location ?? null,
      delivery_updated_at: now,
    } as never)
    .eq("id", orderId);

  return {
    error: error as { message: string; code?: string } | null,
  };
}

export async function touchDeliveryUpdatedAt(
  supabase: ServerSupabaseClient,
  orderId: string,
  updatedAt = new Date().toISOString()
) {
  const { error } = await supabase
    .from("orders")
    .update({ delivery_updated_at: updatedAt } as never)
    .eq("id", orderId);

  return {
    error: error as { message: string; code?: string } | null,
  };
}

export async function listOrdersForDeliverySync(
  supabase: ServerSupabaseClient,
  orderIds: string[]
) {
  if (orderIds.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from("orders")
    .select(DELIVERY_ORDER_COLUMNS)
    .in("id", orderIds);

  return {
    data: (data ?? []) as Pick<
      Order,
      | "id"
      | "group_id"
      | "customer_name"
      | "phone"
      | "tracking_number"
      | "aligo_status"
      | "delivery_status"
      | "delivery_location"
      | "delivery_updated_at"
    >[],
    error: error as { message: string; code?: string } | null,
  };
}

/**
 * delivery_tracking_logs insert — service role (RLS 우회)
 */
export async function insertDeliveryTrackingLog(input: {
  order_id: string;
  tracking_number: string;
  delivery_status: DeliveryStatus;
  event_type: DeliveryTrackingEventType;
  location?: string | null;
  tracking_time?: string | null;
  raw_response?: SmartTrackerResponse | null;
}) {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("delivery_tracking_logs").insert({
      order_id: input.order_id,
      tracking_number: input.tracking_number,
      delivery_status: input.delivery_status,
      event_type: input.event_type,
      location: input.location ?? null,
      tracking_time: input.tracking_time ?? null,
      raw_response: input.raw_response ?? null,
    } as never);

    // 주문당 delivery_completed 1회 제약 — 동시 요청 시 무시
    if (
      error?.code === "23505" &&
      input.event_type === "delivery_completed"
    ) {
      return { error: null };
    }

    return {
      error: error as { message: string; code?: string } | null,
    };
  } catch (err) {
    return {
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/** 목록용: order_id별 로그 건수를 한 번에 집계 (N+1 방지) */
export async function countDeliveryTrackingLogsByOrderIds(
  orderIds: string[]
): Promise<{ counts: Map<string, number>; error: { message: string } | null }> {
  const counts = new Map<string, number>();
  if (orderIds.length === 0) {
    return { counts, error: null };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("delivery_tracking_logs")
      .select("order_id")
      .in("order_id", orderIds)
      .in("event_type", CUSTOMER_TRACKING_VIEW_EVENT_TYPES);

    if (error) {
      return {
        counts,
        error: { message: error.message },
      };
    }

    for (const row of (data ?? []) as Array<{ order_id: string }>) {
      counts.set(row.order_id, (counts.get(row.order_id) ?? 0) + 1);
    }

    return { counts, error: null };
  } catch (err) {
    return {
      counts,
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

export async function attachDeliveryTrackingCounts(
  orders: OrderListItem[]
): Promise<OrderListItem[]> {
  if (orders.length === 0) {
    return orders.map((order) => ({ ...order, tracking_view_count: 0 }));
  }

  const { counts, error } = await countDeliveryTrackingLogsByOrderIds(
    orders.map((order) => order.id)
  );

  if (error) {
    console.error(
      "[attachDeliveryTrackingCounts] 집계 실패:",
      error.message
    );
  }

  return orders.map((order) => ({
    ...order,
    tracking_view_count: counts.get(order.id) ?? 0,
  }));
}

export async function listDeliveryTrackingLogsForOrder(
  orderId: string
): Promise<{
  data: DeliveryTrackingLogsResponse | null;
  error: { message: string; code?: string } | null;
}> {
  try {
    const admin = createAdminClient();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, customer_name, phone")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      return {
        data: null,
        error: orderError as { message: string; code?: string },
      };
    }

    if (!order) {
      return { data: null, error: { message: "주문을 찾을 수 없습니다." } };
    }

    const orderRow = order as {
      id: string;
      customer_name: string;
      phone: string;
    };

    const { data: customer } = await admin
      .from("customers")
      .select("order_product")
      .eq("phone", orderRow.phone)
      .maybeSingle();

    const { data: logs, error: logsError } = await admin
      .from("delivery_tracking_logs")
      .select("id, event_type, created_at")
      .eq("order_id", orderId)
      .in("event_type", CUSTOMER_TRACKING_VIEW_EVENT_TYPES)
      .order("created_at", { ascending: false });

    if (logsError) {
      return {
        data: null,
        error: logsError as { message: string; code?: string },
      };
    }

    const rows = (logs ?? []) as Array<
      Pick<DeliveryTrackingLog, "id" | "event_type" | "created_at">
    >;

    return {
      data: {
        order_id: orderRow.id,
        customer_name: orderRow.customer_name,
        order_product:
          (customer as { order_product?: string | null } | null)
            ?.order_product ?? null,
        total_count: rows.length,
        logs: rows.map((row) => ({
          id: row.id,
          event_type: row.event_type,
          event_label:
            DELIVERY_TRACKING_EVENT_LABEL[row.event_type] ?? row.event_type,
          created_at: row.created_at,
        })),
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
