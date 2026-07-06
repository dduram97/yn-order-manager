import { resolveVipFields } from "@/lib/vip";
import type { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** orders 테이블 기준 phone별 발송 횟수 집계 (source of truth) */
export async function countOrdersByPhones(
  supabase: ServerSupabaseClient,
  phones: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const uniquePhones = [...new Set(phones.filter(Boolean))];

  if (uniquePhones.length === 0) {
    return counts;
  }

  const { data, error } = await supabase
    .from("orders")
    .select("phone")
    .in("phone", uniquePhones);

  if (error || !data) {
    return counts;
  }

  const rows = data as { phone: string }[];

  for (const row of rows) {
    counts.set(row.phone, (counts.get(row.phone) ?? 0) + 1);
  }

  return counts;
}

/** customers 테이블 VIP 캐시 동기화 */
export async function syncCustomerVipByPhone(
  supabase: ServerSupabaseClient,
  phone: string
) {
  const counts = await countOrdersByPhones(supabase, [phone]);
  const orderCount = counts.get(phone) ?? 0;
  const { vip_level, order_count } = resolveVipFields(orderCount);

  const { error } = await supabase
    .from("customers")
    .update({ order_count, vip_level } as never)
    .eq("phone", phone);

  return {
    order_count,
    vip_level,
    error: error as { message: string; code?: string } | null,
  };
}

export async function attachVipFieldsByPhone<T extends { phone: string }>(
  supabase: ServerSupabaseClient,
  items: T[]
): Promise<(T & ReturnType<typeof resolveVipFields>)[]> {
  if (items.length === 0) return [];

  const counts = await countOrdersByPhones(
    supabase,
    items.map((item) => item.phone)
  );

  return items.map((item) => ({
    ...item,
    ...resolveVipFields(counts.get(item.phone) ?? 0),
  }));
}
