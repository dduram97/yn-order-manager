"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AligoStatusBadge } from "@/components/orders/aligo-status-badge";
import { CustomerNameWithBadge } from "@/components/orders/customer-name-with-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  copyOrdersToClipboard,
  downloadOrdersCsv,
} from "@/lib/utils/export-orders";
import {
  formatDateRangeLabel,
  formatDateTime,
  formatPhone,
  getDefaultDateRange,
} from "@/lib/utils/format";
import type { OrderListItem } from "@/types/order";

interface OrdersApiResponse {
  success: boolean;
  data: OrderListItem[];
  count?: number;
  startDate?: string;
  endDate?: string;
  message?: string;
  error?: string;
}

interface SearchFilters {
  customer_name: string;
  phone: string;
  tracking_number: string;
}

function formatCustomerMemo(memo: string | null | undefined): string {
  const trimmed = memo?.trim();
  return trimmed ? trimmed : "-";
}

const EMPTY_FILTERS: SearchFilters = {
  customer_name: "",
  phone: "",
  tracking_number: "",
};

export function ShipmentList() {
  const router = useRouter();
  const defaultRange = getDefaultDateRange();

  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<SearchFilters>(EMPTY_FILTERS);

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rangeLabel = formatDateRangeLabel(startDate, endDate);

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);
      setExportMessage(null);

      const params = new URLSearchParams({ startDate, endDate });
      if (appliedFilters.customer_name) {
        params.set("customer_name", appliedFilters.customer_name);
      }
      if (appliedFilters.phone) {
        params.set("phone", appliedFilters.phone);
      }
      if (appliedFilters.tracking_number) {
        params.set("tracking_number", appliedFilters.tracking_number);
      }

      try {
        const res = await fetch(`/api/orders?${params.toString()}`);
        const json: OrdersApiResponse = await res.json();

        if (cancelled) return;

        if (!json.success) {
          throw new Error(
            json.message || json.error || "목록을 불러오지 못했습니다."
          );
        }

        setOrders(json.data ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
          setOrders([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, appliedFilters]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedFilters({
      customer_name: draftFilters.customer_name.trim(),
      phone: draftFilters.phone.trim(),
      tracking_number: draftFilters.tracking_number.trim(),
    });
  };

  const handleReset = () => {
    const range = getDefaultDateRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const goToDetail = (id: string) => {
    router.push(`/orders/${id}`);
  };

  const hasData = !loading && orders.length > 0;
  const exportDisabled = loading || exporting || copying || !hasData;

  const handleExcelDownload = useCallback(async () => {
    setExporting(true);
    setExportMessage(null);
    setError(null);

    try {
      if (orders.length === 0) {
        setExportMessage("보낼 데이터가 없습니다.");
        return;
      }
      downloadOrdersCsv(orders, `발송현황_${startDate}_${endDate}.csv`);
      setExportMessage(`${orders.length}건 CSV 다운로드 완료`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }, [orders, startDate, endDate]);

  const handleClipboardCopy = useCallback(async () => {
    setCopying(true);
    setExportMessage(null);
    setError(null);

    try {
      if (orders.length === 0) {
        setExportMessage("복사할 데이터가 없습니다.");
        return;
      }
      await copyOrdersToClipboard(orders);
      setExportMessage(`${orders.length}건 클립보드에 복사됨`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "복사에 실패했습니다.");
    } finally {
      setCopying(false);
    }
  }, [orders]);

  const toolbar = (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={handleExcelDownload}
        disabled={exportDisabled}
        className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {exporting ? "다운로드 중..." : "엑셀 다운로드"}
      </button>
      <button
        type="button"
        onClick={handleClipboardCopy}
        disabled={exportDisabled}
        className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {copying ? "복사 중..." : "클립보드 복사"}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="발송 현황"
        description="기간별 발송 내역을 조회하고 보낼 수 있습니다."
        action={toolbar}
      />

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-xs font-medium text-zinc-500">조회 기간</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
          {rangeLabel}
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">시작일</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">종료일</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">고객명</span>
            <input
              type="search"
              value={draftFilters.customer_name}
              onChange={(e) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  customer_name: e.target.value,
                }))
              }
              placeholder="고객명 검색"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">전화번호</span>
            <input
              type="search"
              value={draftFilters.phone}
              onChange={(e) =>
                setDraftFilters((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="010-1234-5678"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">송장번호</span>
            <input
              type="search"
              value={draftFilters.tracking_number}
              onChange={(e) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  tracking_number: e.target.value,
                }))
              }
              placeholder="송장번호 / 주문 ID"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            />
          </label>
          <div className="flex items-end gap-2 sm:col-span-2 max-md:flex-col">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 sm:flex-none max-md:min-h-12 max-md:w-full max-md:rounded-xl max-md:text-base"
            >
              검색
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 max-md:min-h-12 max-md:w-full max-md:rounded-xl max-md:text-base"
            >
              초기화
            </button>
          </div>
        </div>
      </form>

      {exportMessage && (
        <p className="text-sm text-emerald-600">{exportMessage}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <EmptyState message="불러오는 중..." />
        ) : error ? (
          <EmptyState message={error} />
        ) : orders.length === 0 ? (
          <EmptyState message={`${rangeLabel} 발송 내역이 없습니다.`} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    {[
                      "고객명",
                      "전화번호",
                      "송장번호",
                      "알리고 상태",
                      "고객 메모",
                      "생성일",
                    ].map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => goToDetail(order.id)}
                      className="cursor-pointer transition hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <CustomerNameWithBadge
                          name={order.customer_name}
                          badge={order.vip_badge}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {formatPhone(order.phone)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {order.tracking_number || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <AligoStatusBadge
                            status={order.status ?? order.aligo_status}
                            failReason={order.aligo_fail_reason}
                            failMessage={order.aligo_fail_message}
                            size="sm"
                          />
                          {(order.retry_count ?? 0) > 0 && (
                            <p className="text-xs text-zinc-400">
                              재시도 {order.retry_count}회
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="max-w-[12rem] px-4 py-3 text-sm text-zinc-600">
                        <span
                          className="block truncate"
                          title={
                            order.customer_memo?.trim()
                              ? order.customer_memo
                              : undefined
                          }
                        >
                          {formatCustomerMemo(order.customer_memo)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500">
                        {formatDateTime(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-zinc-100 md:hidden">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => goToDetail(order.id)}
                  className="w-full px-4 py-4 text-left transition hover:bg-zinc-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-900">
                        <CustomerNameWithBadge
                          name={order.customer_name}
                          badge={order.vip_badge}
                        />
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {formatPhone(order.phone)}
                      </p>
                    </div>
                    <AligoStatusBadge
                      status={order.status ?? order.aligo_status}
                      failReason={order.aligo_fail_reason}
                      failMessage={order.aligo_fail_message}
                      size="sm"
                    />
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-zinc-500">
                    <p>송장 {order.tracking_number || "-"}</p>
                    <p
                      className="truncate"
                      title={order.customer_memo?.trim() || undefined}
                    >
                      메모 {formatCustomerMemo(order.customer_memo)}
                    </p>
                    {(order.retry_count ?? 0) > 0 && (
                      <p>재시도 {order.retry_count}회</p>
                    )}
                    <p>{formatDateTime(order.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!loading && !error && (
        <p className="text-sm text-zinc-500">
          {orders.length.toLocaleString()}건 표시
        </p>
      )}
    </div>
  );
}
