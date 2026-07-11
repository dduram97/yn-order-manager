import { createAdminClient } from "@/lib/supabase/admin";
import type { OrderStatSource } from "@/lib/constants/order-attributes";
import {
  normalizeChannelForDisplay,
  WIRED_ORDER_CHANNEL,
} from "@/lib/constants/order-attributes";

export interface CustomerOrderStatisticRow {
  id: string;
  customer_id: string;
  order_channel: string;
  order_product: string;
  source: OrderStatSource;
  source_ref: string;
  created_at: string;
  year: number;
  month: number;
  day: number;
}

function kstParts(date = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);

  return { year, month, day };
}

/**
 * 통계 테이블은 RLS가 켜져 있을 수 있어 service role로 기록합니다.
 * (API는 requireAuth로 보호)
 */
export async function insertCustomerOrderStatistic(payload: {
  customer_id: string;
  order_channel: string;
  order_product: string;
  source: OrderStatSource;
  source_ref: string;
}) {
  const supabase = createAdminClient();
  const { year, month, day } = kstParts();

  const { data, error } = await supabase
    .from("customer_order_statistics")
    .insert({
      customer_id: payload.customer_id,
      order_channel: payload.order_channel,
      order_product: payload.order_product,
      source: payload.source,
      source_ref: payload.source_ref,
      year,
      month,
      day,
    } as never)
    .select(
      "id, customer_id, order_channel, order_product, source, source_ref, created_at, year, month, day"
    )
    .single();

  // 동일 요청 재시도(같은 source_ref)는 중복으로 무시
  if (error?.code === "23505") {
    return { data: null, error: null };
  }

  return {
    data: data as CustomerOrderStatisticRow | null,
    error: error as { message: string; code?: string } | null,
  };
}

export interface StatSlice {
  label: string;
  count: number;
  percent: number;
}

export interface CustomerOrderStatsResponse {
  year: number;
  month: number | null;
  totalCount: number;
  channels: StatSlice[];
  products: StatSlice[];
  channelOtherDetails: StatSlice[];
  productOtherDetails: StatSlice[];
}

function toSlices(
  counts: Map<string, number>,
  total: number,
  orderedLabels?: string[]
): StatSlice[] {
  const labels =
    orderedLabels ??
    Array.from(counts.keys()).sort((a, b) => {
      const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b, "ko");
    });

  return labels
    .map((label) => {
      const count = counts.get(label) ?? 0;
      return {
        label,
        count,
        percent: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
      };
    })
    .filter((row) => row.count > 0 || (orderedLabels?.includes(row.label) ?? false));
}

export async function getCustomerOrderStats(
  year: number,
  month: number | null,
  options: {
    channelPresets: readonly string[];
    productPresets: readonly string[];
    otherLabel: string;
  }
): Promise<{
  data: CustomerOrderStatsResponse | null;
  error: { message: string; code?: string } | null;
}> {
  const supabase = createAdminClient();

  let query = supabase
    .from("customer_order_statistics")
    .select("order_channel, order_product, source")
    .eq("year", year);

  if (month != null) {
    query = query.eq("month", month);
  }

  const { data, error } = await query;

  if (error) {
    return {
      data: null,
      error: error as { message: string; code?: string },
    };
  }

  const rows = (data ?? []) as Array<{
    order_channel: string;
    order_product: string;
    source: string;
  }>;

  const totalCount = rows.length;
  const channelMain = new Map<string, number>();
  const productMain = new Map<string, number>();
  const channelOther = new Map<string, number>();
  const productOther = new Map<string, number>();

  for (const preset of options.channelPresets) {
    channelMain.set(preset, 0);
  }
  channelMain.set(options.otherLabel, 0);

  for (const preset of options.productPresets) {
    productMain.set(preset, 0);
  }
  productMain.set(options.otherLabel, 0);

  for (const row of rows) {
    // 발송등록(source=order_registration)은 DB 값과 무관하게 유선주문으로 표시
    // (기존 행 수정 없이 조회 시점 매핑)
    const rawChannel =
      row.source === "order_registration"
        ? WIRED_ORDER_CHANNEL
        : String(row.order_channel ?? "").trim();
    const channel = normalizeChannelForDisplay(rawChannel);
    const product = String(row.order_product ?? "").trim();

    if (options.channelPresets.includes(channel)) {
      channelMain.set(channel, (channelMain.get(channel) ?? 0) + 1);
    } else if (channel) {
      channelMain.set(
        options.otherLabel,
        (channelMain.get(options.otherLabel) ?? 0) + 1
      );
      channelOther.set(channel, (channelOther.get(channel) ?? 0) + 1);
    }

    if (options.productPresets.includes(product)) {
      productMain.set(product, (productMain.get(product) ?? 0) + 1);
    } else if (product) {
      productMain.set(
        options.otherLabel,
        (productMain.get(options.otherLabel) ?? 0) + 1
      );
      productOther.set(product, (productOther.get(product) ?? 0) + 1);
    }
  }

  const channelOrder = [...options.channelPresets, options.otherLabel];
  const productOrder = [...options.productPresets, options.otherLabel];

  return {
    data: {
      year,
      month,
      totalCount,
      channels: toSlices(channelMain, totalCount, channelOrder),
      products: toSlices(productMain, totalCount, productOrder),
      channelOtherDetails: toSlices(channelOther, channelMain.get(options.otherLabel) ?? 0),
      productOtherDetails: toSlices(productOther, productMain.get(options.otherLabel) ?? 0),
    },
    error: null,
  };
}
