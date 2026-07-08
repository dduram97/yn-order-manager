import type { createClient } from "@/lib/supabase/server";
import { normalizeTrackingNumber } from "@/lib/delivery/smart-tracker";
import type { DeliveryStatus } from "@/types/delivery";
import type { Order } from "@/types/database";
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

export async function insertDeliveryTrackingLog(
  supabase: ServerSupabaseClient,
  input: {
    order_id: string;
    tracking_number: string;
    delivery_status: DeliveryStatus;
    location?: string | null;
    tracking_time?: string | null;
    raw_response?: SmartTrackerResponse | null;
  }
) {
  const { error } = await supabase.from("delivery_tracking_logs").insert({
    order_id: input.order_id,
    tracking_number: input.tracking_number,
    delivery_status: input.delivery_status,
    location: input.location ?? null,
    tracking_time: input.tracking_time ?? null,
    raw_response: input.raw_response ?? null,
  } as never);

  return {
    error: error as { message: string; code?: string } | null,
  };
}
