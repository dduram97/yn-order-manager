import type { createClient } from "@/lib/supabase/server";
import type { DeliveryStatus } from "@/types/delivery";
import type { Order } from "@/types/database";
import type { SmartTrackerResponse } from "@/lib/delivery/smart-tracker";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const DELIVERY_ORDER_COLUMNS =
  "id, group_id, customer_name, phone, tracking_number, aligo_status, delivery_status, delivery_location, delivery_updated_at";

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
