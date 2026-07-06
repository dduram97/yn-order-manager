import type { AligoStatus } from "@/types/database";

export interface OrderStatsSummary {
  year: number;
  month: number;
  total: number;
  success: number;
  failed: number;
  pending: number;
  failureRate: number;
  retrySuccessRate: number;
  retriedCount: number;
  retrySuccessCount: number;
}

export interface OrderMonthlyBarItem {
  month: number;
  label: string;
  total: number;
  success: number;
  failed: number;
  pending: number;
}

export interface OrderStatsResponse {
  summary: OrderStatsSummary;
  monthlyChart: OrderMonthlyBarItem[];
}

export function countByStatus(
  rows: { aligo_status: AligoStatus }[]
): Omit<OrderStatsSummary, "year" | "month"> {
  return rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.aligo_status === "success") acc.success += 1;
      else if (row.aligo_status === "failed") acc.failed += 1;
      else acc.pending += 1;
      return acc;
    },
    {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0,
      failureRate: 0,
      retrySuccessRate: 0,
      retriedCount: 0,
      retrySuccessCount: 0,
    }
  );
}

export function computeRetryMetrics(
  rows: {
    aligo_status: AligoStatus;
    retry_count?: number | null;
  }[]
): Pick<
  OrderStatsSummary,
  "failureRate" | "retrySuccessRate" | "retriedCount" | "retrySuccessCount"
> {
  const completed = rows.filter(
    (row) => row.aligo_status === "success" || row.aligo_status === "failed"
  );
  const failed = completed.filter((row) => row.aligo_status === "failed").length;
  const failureRate =
    completed.length > 0 ? Math.round((failed / completed.length) * 100) : 0;

  const retried = rows.filter((row) => (row.retry_count ?? 0) > 0);
  const retrySuccessCount = retried.filter(
    (row) => row.aligo_status === "success"
  ).length;
  const retrySuccessRate =
    retried.length > 0
      ? Math.round((retrySuccessCount / retried.length) * 100)
      : 0;

  return {
    failureRate,
    retrySuccessRate,
    retriedCount: retried.length,
    retrySuccessCount,
  };
}
