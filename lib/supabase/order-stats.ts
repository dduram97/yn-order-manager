import type { createClient } from "@/lib/supabase/server";
import {
  countByStatus,
  computeRetryMetrics,
  type OrderMonthlyBarItem,
  type OrderStatsResponse,
} from "@/lib/stats/order-stats";
import type { AligoStatus } from "@/types/database";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const MONTH_LABELS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];

function monthDateRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export async function getOrderStats(
  supabase: ServerSupabaseClient,
  year: number,
  month: number
): Promise<{ data: OrderStatsResponse | null; error: { message: string } | null }> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const { start, end } = monthDateRange(year, month);

  const [monthResult, yearResult] = await Promise.all([
    supabase
      .from("orders")
      .select("aligo_status, retry_count")
      .gte("sent_date", start)
      .lte("sent_date", end),
    supabase
      .from("orders")
      .select("sent_date, aligo_status, retry_count")
      .gte("sent_date", yearStart)
      .lte("sent_date", yearEnd),
  ]);

  if (monthResult.error) {
    return { data: null, error: { message: monthResult.error.message } };
  }

  if (yearResult.error) {
    return { data: null, error: { message: yearResult.error.message } };
  }

  const monthRows = (monthResult.data ?? []) as {
    aligo_status: AligoStatus;
    retry_count?: number | null;
  }[];
  const yearRows = (yearResult.data ?? []) as {
    sent_date: string;
    aligo_status: AligoStatus;
    retry_count?: number | null;
  }[];

  const monthCounts = countByStatus(monthRows);
  const retryMetrics = computeRetryMetrics(monthRows);

  const summary = {
    year,
    month,
    ...monthCounts,
    ...retryMetrics,
  };

  const monthlyMap = new Map<number, { aligo_status: AligoStatus }[]>();
  for (let m = 1; m <= 12; m++) {
    monthlyMap.set(m, []);
  }

  for (const row of yearRows) {
    const monthNum = Number(row.sent_date.slice(5, 7));
    if (monthNum >= 1 && monthNum <= 12) {
      monthlyMap.get(monthNum)!.push({ aligo_status: row.aligo_status });
    }
  }

  const monthlyChart: OrderMonthlyBarItem[] = MONTH_LABELS.map((label, index) => {
    const monthNum = index + 1;
    const { total, success, failed, pending } = countByStatus(
      monthlyMap.get(monthNum) ?? []
    );
    return { month: monthNum, label, total, success, failed, pending };
  });

  return {
    data: { summary, monthlyChart },
    error: null,
  };
}
