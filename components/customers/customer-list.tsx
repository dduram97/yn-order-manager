"use client";

import { useEffect, useState } from "react";
import { CustomerFavoriteStar } from "@/components/customers/customer-favorite-star";
import { CustomerNameWithBadge } from "@/components/orders/customer-name-with-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { formatDateTime, formatPhone } from "@/lib/utils/format";
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
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [vipFilter, setVipFilter] = useState<CustomerVipFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CustomerListItemWithVip[]>([]);
  const [pagination, setPagination] = useState<CustomerListPagination | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        vip: vipFilter,
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
  }, [page, query, vipFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search.trim());
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="고객 목록"
        description="발송 횟수 기준 VIP 등급이 자동으로 표시됩니다. (5건 이상 👍 · 10건 이상 🏆)"
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
      </div>

      <form
        onSubmit={handleSearch}
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1 space-y-1.5">
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
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 max-md:min-h-12 max-md:w-full max-md:rounded-xl max-md:text-base"
          >
            검색
          </button>
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
                    {["고객명", "전화번호", "발송 횟수", "VIP", "등록일"].map(
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
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <div className="flex items-center gap-2">
                          <CustomerFavoriteStar
                            isFavorite={customer.is_favorite ?? false}
                            disabled={togglingId === customer.id}
                            onToggle={() => handleToggleFavorite(customer)}
                          />
                          <CustomerNameWithBadge
                            name={customer.name}
                            badge={customer.vip_badge}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {formatPhone(customer.phone)}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">
                        {customer.order_count}건
                      </td>
                      <td className="px-4 py-3">
                        <VipBadge badge={customer.vip_badge} />
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
                      <CustomerFavoriteStar
                        isFavorite={customer.is_favorite ?? false}
                        disabled={togglingId === customer.id}
                        onToggle={() => handleToggleFavorite(customer)}
                      />
                      <div>
                        <p className="font-medium text-zinc-900">
                          <CustomerNameWithBadge
                            name={customer.name}
                            badge={customer.vip_badge}
                          />
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {formatPhone(customer.phone)}
                        </p>
                      </div>
                    </div>
                    <VipBadge badge={customer.vip_badge} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                    <span>발송 {customer.order_count}건</span>
                    <span>{formatDateTime(customer.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {pagination && (
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
