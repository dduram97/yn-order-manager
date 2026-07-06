"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getYearOptions } from "@/lib/validations/stats";
import type { OrderStatsResponse } from "@/lib/stats/order-stats";

interface StatsApiResponse {
  success: boolean;
  data: OrderStatsResponse;
  message?: string;
}

const KPI_ITEMS = [
  { key: "total", label: "총 발송", color: "text-zinc-900", bg: "bg-zinc-50" },
  {
    key: "success",
    label: "성공",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  { key: "failed", label: "실패", color: "text-red-700", bg: "bg-red-50" },
  {
    key: "pending",
    label: "대기",
    color: "text-amber-700",
    bg: "bg-amber-50",
  },
] as const;

export function OrderStatsDashboard() {
  const now = new Date();
  const yearOptions = useMemo(() => getYearOptions(), []);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<OrderStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
      });

      try {
        const res = await fetch(`/api/stats/orders?${params.toString()}`);
        const json: StatsApiResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || !json.success) {
          throw new Error(json.message || "통계를 불러오지 못했습니다.");
        }

        setData(json.data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const maxBarTotal = Math.max(
    ...(data?.monthlyChart.map((item) => item.total) ?? [0]),
    1
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="통계"
        description="월별 · 연도별 알림톡 발송량을 확인합니다."
      />

      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">년도</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">월</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {year}년 {month}월 발송 기준 (sent_date)
        </p>
      </Card>

      {loading ? (
        <Card>
          <p className="py-8 text-center text-sm text-zinc-500">
            통계를 불러오는 중...
          </p>
        </Card>
      ) : error ? (
        <Card>
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KPI_ITEMS.map((item) => (
              <div
                key={item.key}
                className={`rounded-xl border border-zinc-200 ${item.bg} p-5 shadow-sm`}
              >
                <p className="text-xs font-medium text-zinc-500">{item.label}</p>
                <p className={`mt-2 text-3xl font-bold tabular-nums ${item.color}`}>
                  {data.summary[item.key].toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-zinc-400">건</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-red-50 p-5 shadow-sm">
              <p className="text-xs font-medium text-zinc-500">실패율</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-red-700">
                {data.summary.failureRate}%
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                성공·실패 완료 건 기준
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-blue-50 p-5 shadow-sm">
              <p className="text-xs font-medium text-zinc-500">재발송 성공률</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-blue-700">
                {data.summary.retrySuccessRate}%
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                재발송 {data.summary.retriedCount}건 중{" "}
                {data.summary.retrySuccessCount}건 성공
              </p>
            </div>
          </div>

          <Card
            title={`${year}년 월별 발송량`}
            description="막대 높이 = 해당 월 총 발송 건수"
          >
            <div className="flex h-56 items-end gap-2 border-b border-zinc-100 pb-2 pt-4">
              {data.monthlyChart.map((item) => {
                const heightPct = (item.total / maxBarTotal) * 100;
                const isSelected = item.month === month;

                return (
                  <div
                    key={item.month}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-[10px] font-medium tabular-nums text-zinc-500">
                      {item.total > 0 ? item.total : ""}
                    </span>
                    <div className="flex h-40 w-full items-end justify-center">
                      <div
                        className={`w-full max-w-8 rounded-t-md transition-all ${
                          isSelected ? "bg-zinc-900" : "bg-zinc-300"
                        }`}
                        style={{
                          height: `${Math.max(heightPct, item.total > 0 ? 4 : 0)}%`,
                        }}
                        title={`${item.label}: ${item.total}건`}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-medium ${
                        isSelected ? "text-zinc-900" : "text-zinc-400"
                      }`}
                    >
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-zinc-900" />
                선택한 월
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-zinc-300" />
                기타 월
              </span>
            </div>
          </Card>

          <Card title={`${year}년 ${month}월 상태 분포`}>
            <div className="space-y-3">
              {[
                { label: "성공", value: data.summary.success, color: "bg-emerald-500" },
                { label: "실패", value: data.summary.failed, color: "bg-red-500" },
                { label: "대기", value: data.summary.pending, color: "bg-amber-400" },
              ].map((row) => {
                const pct =
                  data.summary.total > 0
                    ? Math.round((row.value / data.summary.total) * 100)
                    : 0;

                return (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-zinc-600">{row.label}</span>
                      <span className="font-medium tabular-nums text-zinc-900">
                        {row.value.toLocaleString()}건 ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full ${row.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
