"use client";

import { useEffect, useState } from "react";
import { CustomerFavoriteStar } from "@/components/customers/customer-favorite-star";
import {
  CustomerCreateModal,
  type CreatedCustomer,
} from "@/components/customers/customer-create-modal";
import { CustomerCrmModal } from "@/components/customers/customer-crm-modal";
import { CustomerEditModal } from "@/components/customers/customer-edit-modal";
import { CustomerNameWithBadge } from "@/components/orders/customer-name-with-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Toast, useToast } from "@/components/ui/toast";
import { AdminMemoModal } from "@/components/admin/admin-memo-modal";
import {
  formatCompactDate,
  formatDateTime,
  formatPhone,
  getDefaultDateRange,
} from "@/lib/utils/format";
import { downloadCustomersXlsx } from "@/lib/utils/export-customers-xlsx";
import type {
  CustomerListItemWithVip,
  CustomerListPagination,
  CustomerVipFilter,
} from "@/types/customer";

interface CustomersApiResponse {
  success: boolean;
  data: CustomerListItemWithVip[];
  pagination: CustomerListPagination;
}

interface CustomersExportApiResponse {
  success: boolean;
  data: Array<
    CustomerListItemWithVip & {
      last_sent_date: string | null;
      last_sent_at: string | null;
      grade?: "normal" | "silver" | "gold";
      vip_level?: "normal" | "silver" | "gold";
    }
  >;
  message?: string;
}

const VIP_TABS: {
  value: CustomerVipFilter;
  label: string;
  description?: string;
}[] = [
  { value: "all", label: "전체 고객" },
  { value: "silver", label: "Silver VIP 👍", description: "5~9건" },
  { value: "gold", label: "Gold VIP 🏆", description: "10건 이상" },
  { value: "favorite", label: "⭐ 즐겨찾기" },
];

function VipBadge({ badge }: { badge?: string }) {
  if (!badge) {
    return <span className="text-xs text-zinc-400">-</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-800">
      {badge}
    </span>
  );
}

export function CustomerList() {
  const { toast, showToast, dismissToast } = useToast();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const defaultRange = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [vipFilter, setVipFilter] = useState<CustomerVipFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CustomerListItemWithVip[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [crmOpen, setCrmOpen] = useState(false);
  const [editCustomer, setEditCustomer] =
    useState<CustomerListItemWithVip | null>(null);
  const [memoOpen, setMemoOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [pagination, setPagination] = useState<CustomerListPagination | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        vip: vipFilter,
        startDate,
        endDate,
      });
      if (query) params.set("search", query);

      try {
        const res = await fetch(`/api/customers?${params.toString()}`);
        const json: CustomersApiResponse = await res.json();

        if (cancelled) return;

        if (!res.ok || !json.success) {
          throw new Error("고객 목록을 불러오지 못했습니다.");
        }

        setData(json.data);
        setPagination(json.pagination);
        setSelectedIds(new Set());
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

    void loadCustomers();

    return () => {
      cancelled = true;
    };
  }, [page, query, vipFilter, startDate, endDate, reloadKey]);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
  };

  const handleReset = () => {
    const range = getDefaultDateRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
    setSearch("");
    setQuery("");
    setPage(1);
  };

  const handleVipFilterChange = (next: CustomerVipFilter) => {
    setVipFilter(next);
    setPage(1);
  };

  const handleToggleFavorite = async (customer: CustomerListItemWithVip) => {
    const previousFavorite = customer.is_favorite ?? false;
    const nextFavorite = !previousFavorite;
    const snapshot = data;

    setTogglingId(customer.id);
    setError(null);

    setData((prev) => {
      if (vipFilter === "favorite" && !nextFavorite) {
        return prev.filter((item) => item.id !== customer.id);
      }
      return prev.map((item) =>
        item.id === customer.id
          ? {
              ...item,
              is_favorite: nextFavorite,
              favorite_at: nextFavorite ? new Date().toISOString() : null,
            }
          : item
      );
    });

    try {
      const res = await fetch(`/api/customers/${customer.id}/favorite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: nextFavorite }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "즐겨찾기 저장에 실패했습니다.");
      }

      setData((prev) => {
        if (vipFilter === "favorite" && !nextFavorite) {
          return prev;
        }
        return prev.map((item) =>
          item.id === customer.id ? json.data : item
        );
      });

      if (vipFilter === "favorite" && !nextFavorite && pagination) {
        setPagination({
          ...pagination,
          totalCount: Math.max(0, pagination.totalCount - 1),
        });
      }
    } catch (err) {
      setData(snapshot);
      setError(
        err instanceof Error ? err.message : "즐겨찾기 저장에 실패했습니다."
      );
    } finally {
      setTogglingId(null);
    }
  };

  const activeTab = VIP_TABS.find((tab) => tab.value === vipFilter);

  const handleExportXlsx = async () => {
    setExporting(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        vip: vipFilter,
        startDate,
        endDate,
      });
      if (query.trim()) params.set("search", query.trim());

      const res = await fetch(`/api/customers/export?${params.toString()}`);
      const json: CustomersExportApiResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "엑셀 저장에 실패했습니다.");
      }

      downloadCustomersXlsx(
        (json.data ?? []).map((row) => ({
          name: row.name,
          phone: row.phone,
          order_count: row.order_count ?? 0,
          last_sent_date: row.last_sent_date ?? null,
          grade: row.grade,
          vip_level: row.vip_level,
          is_favorite: row.is_favorite ?? false,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "엑셀 저장에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  };

  const handleCopyPhones = async () => {
    setCopying(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        vip: vipFilter,
        startDate,
        endDate,
      });
      if (query.trim()) params.set("search", query.trim());

      const res = await fetch(`/api/customers/export?${params.toString()}`);
      const json: CustomersExportApiResponse = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "전화번호 복사에 실패했습니다.");
      }

      const phones = (json.data ?? [])
        .map((row) => String(row.phone ?? "").trim())
        .filter(Boolean);

      if (phones.length === 0) {
        showToast("복사할 전화번호가 없습니다.", "error");
        return;
      }

      const text = phones.join("\n");
      await navigator.clipboard.writeText(text);
      showToast(`${phones.length.toLocaleString()}개의 전화번호를 복사했습니다.`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "전화번호 복사에 실패했습니다.";
      showToast(message, "error");
      setError(message);
    } finally {
      setCopying(false);
    }
  };

  const allVisibleSelected =
    data.length > 0 && data.every((customer) => selectedIds.has(customer.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(data.map((customer) => customer.id)));
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
      const res = await fetch("/api/customers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json: { success: boolean; message?: string } = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "고객 삭제에 실패했습니다.");
      }

      setConfirmOpen(false);
      setSelectedIds(new Set());
      setReloadKey((key) => key + 1);
      showToast("선택한 고객을 삭제했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "고객 삭제에 실패했습니다.");
      setConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Toast toast={toast} onDismiss={dismissToast} />
      <PageHeader
        title="고객 목록"
        description="발송 횟수 기준 VIP 등급이 자동으로 표시됩니다. (5건 이상 👍 · 10건 이상 🏆)"
        action={
          <div className="flex gap-2 overflow-x-auto pb-1 sm:items-center sm:justify-end sm:overflow-visible sm:pb-0">
            <button
              type="button"
              disabled={copying}
              onClick={() => void handleCopyPhones()}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:border-zinc-200 sm:px-4 sm:py-2.5 sm:disabled:opacity-50"
            >
              {copying ? "복사 중..." : "클립보드 복사"}
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={() => void handleExportXlsx()}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 sm:border-zinc-200 sm:px-4 sm:py-2.5 sm:disabled:opacity-50"
            >
              {exporting ? "저장 중..." : "엑셀 저장"}
            </button>
            <button
              type="button"
              onClick={() => setCrmOpen(true)}
              className="shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 sm:border-zinc-200 sm:px-4 sm:py-2.5"
            >
              기존고객추가
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 sm:px-4 sm:py-2.5"
            >
              네이버 주문
            </button>
          </div>
        }
      />

      <CustomerCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created: CreatedCustomer) => {
          const trimmedQuery = query.trim();
          const matchesQuery =
            trimmedQuery === "" ||
            created.name.includes(trimmedQuery) ||
            created.phone.includes(trimmedQuery.replace(/[\s-]/g, ""));

          if (vipFilter === "all" && matchesQuery) {
            setData((prev) => {
              const next = [created as CustomerListItemWithVip, ...prev];
              return next.slice(0, 20);
            });
            setPagination((prev) =>
              prev
                ? {
                    ...prev,
                    totalCount: prev.totalCount + 1,
                    totalPages: Math.ceil((prev.totalCount + 1) / prev.limit),
                    page: 1,
                  }
                : prev
            );
            setPage(1);
          } else {
            setReloadKey((key) => key + 1);
          }
          showToast("네이버 주문을 저장했습니다.");
        }}
      />
      <CustomerCrmModal
        open={crmOpen}
        onClose={() => setCrmOpen(false)}
        onCreated={() => {
          setReloadKey((key) => key + 1);
          showToast("기존고객을 저장했습니다.");
        }}
      />
      <CustomerEditModal
        open={editCustomer != null}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        onUpdated={(updated) => {
          setData((prev) =>
            prev.map((item) => (item.id === updated.id ? updated : item))
          );
          showToast("고객 정보를 저장했습니다.");
        }}
      />
      <AdminMemoModal open={memoOpen} onClose={() => setMemoOpen(false)} />
      <ConfirmDialog
        open={confirmOpen}
        message="선택한 항목을 삭제하시겠습니까?"
        loading={deleting}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        onConfirm={() => void handleDeleteSelected()}
      />

      <div className="flex flex-wrap gap-2">
        {VIP_TABS.map((tab) => {
          const isActive = vipFilter === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleVipFilterChange(tab.value)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {tab.label}
              {tab.description && (
                <span
                  className={`ml-1.5 text-xs ${
                    isActive ? "text-zinc-300" : "text-zinc-400"
                  }`}
                >
                  ({tab.description})
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMemoOpen(true)}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          메모
        </button>
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
              이름 또는 전화번호
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="고객명 또는 전화번호 검색"
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

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <p className="text-xs font-medium text-zinc-500">현재 필터</p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">
          {activeTab?.label}
          {query ? ` · "${query}" 검색` : ""}
          {pagination ? ` · ${pagination.totalCount.toLocaleString()}명` : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <EmptyState message="불러오는 중..." />
        ) : error ? (
          <EmptyState message={error} />
        ) : data.length === 0 ? (
          <EmptyState
            message={
              query
                ? `"${query}" 검색 결과가 없습니다.`
                : vipFilter === "favorite"
                  ? "즐겨찾기 고객이 없습니다."
                  : vipFilter === "all"
                    ? "등록된 고객이 없습니다."
                    : `${activeTab?.label} 고객이 없습니다.`
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-zinc-200">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="w-10 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        aria-label="전체 선택"
                        className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
                      />
                    </th>
                    {["고객명", "전화번호", "메모", "발송 횟수", "최종 주문일", "등록일"].map(
                      (col) => (
                        <th
                          key={col}
                          className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500"
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.map((customer) => (
                    <tr key={customer.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(customer.id)}
                          onChange={() => toggleSelectOne(customer.id)}
                          aria-label={`${customer.name} 선택`}
                          className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <div className="flex items-center gap-2">
                          <CustomerFavoriteStar
                            isFavorite={customer.is_favorite ?? false}
                            disabled={togglingId === customer.id}
                            onToggle={() => handleToggleFavorite(customer)}
                          />
                          <button
                            type="button"
                            onClick={() => setEditCustomer(customer)}
                            className="text-left transition hover:text-zinc-600 hover:underline"
                          >
                            <CustomerNameWithBadge
                              name={customer.name}
                              badge={customer.display_badge ?? customer.vip_badge}
                            />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {formatPhone(customer.phone)}
                      </td>
                      <td className="max-w-[12rem] px-4 py-3 text-sm text-zinc-500">
                        {customer.memo?.trim() ? (
                          <p className="line-clamp-2 whitespace-pre-wrap break-words">
                            {customer.memo}
                          </p>
                        ) : (
                          <span className="text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {customer.order_count}건
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500">
                        {customer.last_sent_at
                          ? formatDateTime(customer.last_sent_at)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-500">
                        {formatDateTime(customer.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-zinc-100 md:hidden">
              {data.map((customer) => (
                <div key={customer.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(customer.id)}
                        onChange={() => toggleSelectOne(customer.id)}
                        aria-label={`${customer.name} 선택`}
                        className="mt-1 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900/20"
                      />
                      <CustomerFavoriteStar
                        isFavorite={customer.is_favorite ?? false}
                        disabled={togglingId === customer.id}
                        onToggle={() => handleToggleFavorite(customer)}
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() => setEditCustomer(customer)}
                          className="text-left font-medium text-zinc-900 transition hover:text-zinc-600 hover:underline"
                        >
                          <CustomerNameWithBadge
                            name={customer.name}
                            badge={customer.display_badge ?? customer.vip_badge}
                          />
                        </button>
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatPhone(customer.phone)}
                        </p>
                        {customer.memo?.trim() ? (
                          <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-xs text-zinc-500">
                            {customer.memo}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <VipBadge badge={customer.display_badge ?? customer.vip_badge} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                    <span>발송 {customer.order_count}건</span>
                    <span>
                      최종 {customer.last_sent_at ? formatDateTime(customer.last_sent_at) : "-"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-end text-xs text-zinc-500">
                    <span>{formatDateTime(customer.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {!loading && !error && data.length > 0 && (
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

      {!loading && !error && pagination && pagination.totalCount > 0 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          unit="명"
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
