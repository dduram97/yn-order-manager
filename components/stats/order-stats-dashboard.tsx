"use client";

import { useEffect, useMemo, useState } from "react";
import { DonutChart } from "@/components/stats/donut-chart";
import { PageHeader } from "@/components/ui/page-header";
import { ORDER_ATTRIBUTE_OTHER } from "@/lib/constants/order-attributes";
import type { CustomerOrderStatsResponse } from "@/lib/supabase/customer-order-stats";
import { getYearOptions } from "@/lib/validations/stats";

interface StatsApiResponse {
  success: boolean;
  data: CustomerOrderStatsResponse;
  message?: string;
}

export function OrderStatsDashboard() {
  const now = new Date();
  const yearOptions = useMemo(() => getYearOptions(), []);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "all">(now.getMonth() + 1);
  const [data, setData] = useState<CustomerOrderStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelOtherOpen, setChannelOtherOpen] = useState(false);
  const [productOtherOpen, setProductOtherOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        year: String(year),
        month: month === "all" ? "all" : String(month),
      });

      try {
        const res = await fetch(
          `/api/stats/customer-orders?${params.toString()}`
        );
        const json: StatsApiResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || !json.success) {
          throw new Error(json.message || "통계를 불러오지 못했습니다.");
        }

        setData(json.data);
        setChannelOtherOpen(false);
        setProductOtherOpen(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
          setData(null);
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

  const periodLabel =
    month === "all" ? `${year}년 전체` : `${year}년 ${month}월`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="주문 통계"
        description="발송등록과 고객추가를 합산한 주문 통계입니다."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-500">년도</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="block rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-500">월</span>
          <select
            value={month === "all" ? "all" : String(month)}
            onChange={(e) => {
              const value = e.target.value;
              setMonth(value === "all" ? "all" : Number(value));
            }}
            className="block rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
          >
            <option value="all">전체</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </label>
        <p className="pb-2 text-sm text-zinc-500">{periodLabel}</p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">불러오는 중...</p>
      ) : error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-6 shadow-sm">
            <p className="text-xs font-medium text-zinc-500">총 주문건수</p>
            <p className="mt-2 text-4xl font-semibold tabular-nums text-zinc-900">
              {data.totalCount.toLocaleString()}
              <span className="ml-1 text-lg font-medium text-zinc-500">건</span>
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              발송등록 완료 + 고객추가 완료
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DonutChart
              title="주문채널 통계"
              colorKind="channel"
              slices={data.channels}
              activeLabel={
                channelOtherOpen ? ORDER_ATTRIBUTE_OTHER : null
              }
              onSliceClick={(label) => {
                if (label === ORDER_ATTRIBUTE_OTHER) {
                  setChannelOtherOpen((open) => !open);
                }
              }}
            />
            <DonutChart
              title="주문상품 통계"
              colorKind="product"
              slices={data.products}
              activeLabel={
                productOtherOpen ? ORDER_ATTRIBUTE_OTHER : null
              }
              onSliceClick={(label) => {
                if (label === ORDER_ATTRIBUTE_OTHER) {
                  setProductOtherOpen((open) => !open);
                }
              }}
            />
          </div>

          {channelOtherOpen ? (
            <div className="space-y-3">
              <DonutChart
                title="기타 주문채널 상세"
                colorKind="channel"
                slices={data.channelOtherDetails}
                emptyMessage="기타로 분류된 채널이 없습니다."
              />
              {data.channelOtherDetails.length > 0 ? (
                <ul className="rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
                  {data.channelOtherDetails.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between border-b border-zinc-100 py-2 last:border-b-0"
                    >
                      <span className="text-zinc-800">{row.label}</span>
                      <span className="tabular-nums text-zinc-600">
                        {row.count}건 · {row.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {productOtherOpen ? (
            <div className="space-y-3">
              <DonutChart
                title="기타 주문상품 상세"
                colorKind="product"
                slices={data.productOtherDetails}
                emptyMessage="기타로 분류된 상품이 없습니다."
              />
              {data.productOtherDetails.length > 0 ? (
                <ul className="rounded-xl border border-zinc-200 bg-white p-4 text-sm shadow-sm">
                  {data.productOtherDetails.map((row) => (
                    <li
                      key={row.label}
                      className="flex items-center justify-between border-b border-zinc-100 py-2 last:border-b-0"
                    >
                      <span className="text-zinc-800">{row.label}</span>
                      <span className="tabular-nums text-zinc-600">
                        {row.count}건 · {row.percent}%
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
