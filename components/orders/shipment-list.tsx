"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AligoStatusBadge } from "@/components/orders/aligo-status-badge";
import { CustomerNameWithBadge } from "@/components/orders/customer-name-with-badge";
import { DeliveryStatusBadge } from "@/components/orders/delivery-status-badge";
import { DeliveryTrackingModal } from "@/components/orders/delivery-tracking-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { resolveListDeliveryStatus } from "@/lib/delivery/display";
import { isEligibleForAutoDeliverySync } from "@/lib/delivery/sync-eligibility";
import {
  copyOrdersToClipboard,
  downloadOrdersCsv,
} from "@/lib/utils/export-orders";
import {
  formatDateRangeLabel,
  formatCompactDate,
  formatPhone,
  formatShortSentDate,
  getDefaultDateRange,
} from "@/lib/utils/format";
import { formatTrackingNumber } from "@/lib/validations/tracking-number";
import type { DeliveryStatus } from "@/types/delivery";
import type { OrderListItem, OrderListPagination } from "@/types/order";

interface OrdersApiResponse {
  success: boolean;
  data: OrderListItem[];
  count?: number;
  totalCount?: number;
  currentPage?: number;
  totalPages?: number;
  pagination?: OrderListPagination;
  startDate?: string;
  endDate?: string;
  message?: string;
  error?: string;
}

interface SearchFilters {
  search: string;
}

const EMPTY_FILTERS: SearchFilters = {
  search: "",
};

const TABLE_COLUMNS = [
  { key: "customer_name", label: "고객명", width: "16%" },
  { key: "phone", label: "전화번호", width: "14%" },
  { key: "tracking_number", label: "송장번호", width: "20%" },
  { key: "delivery_status", label: "배송상태", width: "14%" },
  { key: "aligo", label: "알리고", width: "14%" },
  { key: "sent_date", label: "발송일", width: "12%" },
] as const;

const TABLE_HEAD_CELL =
  "px-3 py-3 text-center align-middle text-xs font-semibold uppercase tracking-wide text-zinc-500";
const TABLE_BODY_CELL =
  "px-3 py-3 text-center align-middle text-sm text-zinc-700";
const TABLE_CELL_INNER = "flex items-center justify-center";
const CLICKABLE_DETAIL =
  "cursor-pointer text-zinc-900 transition hover:text-zinc-600 hover:underline";
const CLICKABLE_TRACKING =
  "cursor-pointer tabular-nums text-zinc-700 transition hover:text-zinc-900 hover:underline";

function applyDeliveryUpdates(
  orders: OrderListItem[],
  updates: Array<{
    order_id: string;
    delivery_status: DeliveryStatus;
    delivery_location: string | null;
  }>
): OrderListItem[] {
  if (updates.length === 0) return orders;

  return orders.map((order) => {
    const update = updates.find((item) => item.order_id === order.id);
    if (!update) return order;
    return {
      ...order,
      delivery_status: update.delivery_status,
      delivery_location: update.delivery_location,
    };
  });
}

export function ShipmentList() {
  const router = useRouter();
  const defaultRange = getDefaultDateRange();

  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<SearchFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [pagination, setPagination] = useState<OrderListPagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<OrderListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const rangeLabel = formatDateRangeLabel(startDate, endDate);

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError(null);
      setExportMessage(null);

      const params = new URLSearchParams({
        startDate,
        endDate,
        page: String(page),
        limit: "20",
      });
      if (appliedFilters.search) {
        params.set("search", appliedFilters.search);
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
        setSelectedIds(new Set());
        if (json.pagination) {
          setPagination(json.pagination);
        } else if (
          json.totalCount != null &&
          json.currentPage != null &&
          json.totalPages != null
        ) {
          setPagination({
            page: json.currentPage,
            limit: 20,
            totalCount: json.totalCount,
            totalPages: json.totalPages,
          });
        }

        const eligibleIds = (json.data ?? [])
          .filter((order) =>
            isEligibleForAutoDeliverySync({
              aligo_status: order.aligo_status,
              delivery_status: order.delivery_status,
              delivery_updated_at: order.delivery_updated_at,
              tracking_number: order.tracking_number,
            })
          )
          .map((order) => order.id);

        console.log("[DeliveryAutoSync][ShipmentList] orders fetched", {
          ordersLength: (json.data ?? []).length,
          eligibleIdsLength: eligibleIds.length,
          eligibleIds,
          orders: (json.data ?? []).map((order) => ({
            id: order.id,
            aligo_status: order.aligo_status,
            tracking_number: order.tracking_number,
            delivery_status: order.delivery_status,
            delivery_updated_at: order.delivery_updated_at,
          })),
        });

        if (eligibleIds.length > 0) {
          void (async () => {
            try {
              const syncRes = await fetch("/api/delivery/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderIds: eligibleIds }),
              });
              const syncJson: {
                success: boolean;
                data?: {
                  updates: Array<{
                    order_id: string;
                    delivery_status: DeliveryStatus;
                    delivery_location: string | null;
                  }>;
                };
              } = await syncRes.json();

              if (cancelled) return;

              if (syncJson.success && syncJson.data?.updates?.length) {
                setOrders((prev) =>
                  applyDeliveryUpdates(prev, syncJson.data!.updates)
                );
              }
            } catch {
              // 자동 갱신 실패는 목록 표시에 영향 없음
            }
          })();
        }
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
  }, [startDate, endDate, appliedFilters, page, reloadKey]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters({
      search: draftFilters.search.trim(),
    });
  };

  const handleReset = () => {
    const range = getDefaultDateRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const goToDetail = (id: string) => {
    router.push(`/orders/${id}`);
  };

  const handleDetailClick = (
    e: React.MouseEvent,
    id: string
  ) => {
    e.stopPropagation();
    goToDetail(id);
  };

  const handleDeliveryStatusClick = (
    e: React.MouseEvent,
    order: OrderListItem
  ) => {
    e.stopPropagation();
    setTrackingOrder(order);
  };

  const handleDeliveryTracked = useCallback(
    (
      updates: Array<{
        order_id: string;
        delivery_status: DeliveryStatus;
        delivery_location: string | null;
      }>
    ) => {
      setOrders((prev) => applyDeliveryUpdates(prev, updates));
    },
    []
  );

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

  const allVisibleSelected =
    orders.length > 0 && orders.every((order) => selectedIds.has(order.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(orders.map((order) => order.id)));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json: { success: boolean; message?: string } = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "발송 내역 삭제에 실패했습니다.");
      }

      setConfirmOpen(false);
      setSelectedIds(new Set());
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "발송 내역 삭제에 실패했습니다."
      );
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

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
          <div className="max-md:col-span-full md:hidden">
            <p className="mb-1.5 text-xs font-medium text-zinc-500">조회 기간</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                aria-label="시작일"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-2.5 text-sm tabular-nums outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
              />
              <span className="shrink-0 text-sm text-zinc-400">~</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                aria-label="종료일"
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-2.5 text-sm tabular-nums outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>
            <p className="mt-1.5 text-center text-xs tabular-nums text-zinc-500">
              {formatCompactDate(startDate)} ~ {formatCompactDate(endDate)}
            </p>
          </div>
          <label className="hidden space-y-1.5 md:block">
            <span className="text-xs font-medium text-zinc-500">시작일</span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            />
          </label>
          <label className="hidden space-y-1.5 md:block">
            <span className="text-xs font-medium text-zinc-500">종료일</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
            />
          </label>
          <label className="block space-y-1.5 lg:col-span-3">
            <span className="text-xs font-medium text-zinc-500">
              고객명 또는 전화번호 또는 송장번호
            </span>
            <input
              type="search"
              value={draftFilters.search}
              onChange={(e) =>
                setDraftFilters({ search: e.target.value })
              }
              placeholder="고객명 또는 전화번호 또는 송장번호 검색"
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
              <table className="w-full table-fixed divide-y divide-zinc-200">
                <colgroup>
                  <col style={{ width: "5%" }} />
                  {TABLE_COLUMNS.map((col) => (
                    <col key={col.key} style={{ width: col.width }} />
                  ))}
                </colgroup>
                <thead className="bg-zinc-50">
                  <tr>
                    <th className={TABLE_HEAD_CELL}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        aria-label="전체 선택"
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
                      />
                    </th>
                    {TABLE_COLUMNS.map((col) => (
                      <th key={col.key} className={TABLE_HEAD_CELL}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="transition hover:bg-zinc-50"
                    >
                      <td className={TABLE_BODY_CELL}>
                        <div className={TABLE_CELL_INNER}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.id)}
                            onChange={() => toggleSelectOne(order.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`${order.customer_name} 선택`}
                            className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
                          />
                        </div>
                      </td>
                      <td className={`${TABLE_BODY_CELL} font-medium`}>
                        <div className={TABLE_CELL_INNER}>
                          <button
                            type="button"
                            onClick={(e) => handleDetailClick(e, order.id)}
                            className={CLICKABLE_DETAIL}
                          >
                            <CustomerNameWithBadge
                              name={order.customer_name}
                              badge={order.vip_badge}
                            />
                          </button>
                        </div>
                      </td>
                      <td className={TABLE_BODY_CELL}>
                        <div className={TABLE_CELL_INNER}>
                          <button
                            type="button"
                            onClick={(e) => handleDetailClick(e, order.id)}
                            className={`${CLICKABLE_DETAIL} tabular-nums whitespace-nowrap`}
                          >
                            {formatPhone(order.phone)}
                          </button>
                        </div>
                      </td>
                      <td className={TABLE_BODY_CELL}>
                        <div className={TABLE_CELL_INNER}>
                          <button
                            type="button"
                            onClick={(e) =>
                              handleDeliveryStatusClick(e, order)
                            }
                            className={`${CLICKABLE_TRACKING} whitespace-nowrap`}
                          >
                            {formatTrackingNumber(order.tracking_number) || "-"}
                          </button>
                        </div>
                      </td>
                      <td className={TABLE_BODY_CELL}>
                        <div className={TABLE_CELL_INNER}>
                          {(() => {
                            const deliveryStatus = resolveListDeliveryStatus(
                              order.aligo_status,
                              order.delivery_status
                            );
                            if (!deliveryStatus) {
                              return (
                                <span className="text-sm text-zinc-400">-</span>
                              );
                            }
                            return (
                              <DeliveryStatusBadge
                                status={deliveryStatus}
                                size="sm"
                                onClick={(e) =>
                                  handleDeliveryStatusClick(e, order)
                                }
                              />
                            );
                          })()}
                        </div>
                      </td>
                      <td className={TABLE_BODY_CELL}>
                        <div className={`${TABLE_CELL_INNER} flex-col gap-1`}>
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
                      <td className={`${TABLE_BODY_CELL} tabular-nums text-zinc-500`}>
                        <div className={TABLE_CELL_INNER}>
                          {formatShortSentDate(order.sent_at ?? order.created_at)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-zinc-100 md:hidden">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="w-full px-4 py-4 text-center"
                >
                  <div className="mb-3 flex justify-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(order.id)}
                      onChange={() => toggleSelectOne(order.id)}
                      aria-label={`${order.customer_name} 선택`}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDetailClick(e, order.id)}
                      className={`font-medium ${CLICKABLE_DETAIL}`}
                    >
                      <CustomerNameWithBadge
                        name={order.customer_name}
                        badge={order.vip_badge}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDetailClick(e, order.id)}
                      className={`text-sm tabular-nums ${CLICKABLE_DETAIL}`}
                    >
                      {formatPhone(order.phone)}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeliveryStatusClick(e, order)}
                      className={`text-sm tabular-nums ${CLICKABLE_TRACKING}`}
                    >
                      송장 {formatTrackingNumber(order.tracking_number) || "-"}
                    </button>
                    {(() => {
                      const deliveryStatus = resolveListDeliveryStatus(
                        order.aligo_status,
                        order.delivery_status
                      );
                      if (!deliveryStatus) return null;
                      return (
                        <DeliveryStatusBadge
                          status={deliveryStatus}
                          size="sm"
                          onClick={(e) => handleDeliveryStatusClick(e, order)}
                        />
                      );
                    })()}
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
                    <p className="text-xs tabular-nums text-zinc-500">
                      {formatShortSentDate(order.sent_at ?? order.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {!loading && !error && orders.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={selectedIds.size === 0 || deleting}
            onClick={() => setConfirmOpen(true)}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            선택 삭제
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        message="선택한 항목을 삭제하시겠습니까?"
        loading={deleting}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        onConfirm={() => void handleDeleteSelected()}
      />

      <DeliveryTrackingModal
        open={trackingOrder != null}
        orderId={trackingOrder?.id ?? null}
        customerName={trackingOrder?.customer_name ?? ""}
        onClose={() => setTrackingOrder(null)}
        onTracked={handleDeliveryTracked}
      />

      {!loading && !error && pagination && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          onPageChange={setPage}
        />
      )}

      {!loading && !error && !pagination && (
        <p className="text-sm text-zinc-500">
          {orders.length.toLocaleString()}건 표시
        </p>
      )}
    </div>
  );
}
