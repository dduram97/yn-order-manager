"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import type { AligoTemplateType } from "@/lib/constants/aligo";
import {
  getTemplateRegistry,
  type TemplateFieldValues,
} from "@/lib/aligo/template-schema";
import { formatPhone } from "@/lib/utils/format";
import type { CustomerListItemWithVip } from "@/types/customer";

interface FavoriteCustomersApiResponse {
  success: boolean;
  data: CustomerListItemWithVip[];
  message?: string;
}

interface FavoriteCustomersPickerProps {
  templateType: AligoTemplateType;
  disabled?: boolean;
  onSelect: (
    updates: Partial<TemplateFieldValues>,
    meta?: { memo?: string | null }
  ) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

function buildFieldUpdates(
  templateType: AligoTemplateType,
  customer: CustomerListItemWithVip
): Partial<TemplateFieldValues> {
  const { listNameField } = getTemplateRegistry(templateType);

  return {
    phone: customer.phone,
    customer_name: customer.name,
    [listNameField]: customer.name,
  };
}

export function FavoriteCustomersPicker({
  templateType,
  disabled = false,
  onSelect,
}: FavoriteCustomersPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerListItemWithVip[]>([]);

  const loadFavorites = useCallback(async (keyword: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        vip: "favorite",
        limit: "100",
      });
      const trimmed = keyword.trim();
      if (trimmed) {
        params.set("search", trimmed);
      }

      const res = await fetch(`/api/customers?${params.toString()}`);
      const json: FavoriteCustomersApiResponse = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "즐겨찾기 고객을 불러오지 못했습니다.");
      }

      setCustomers(json.data ?? []);
    } catch (err) {
      setCustomers([]);
      setError(
        err instanceof Error ? err.message : "즐겨찾기 고객을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = () => {
    setSearch("");
    setError(null);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setSearch("");
    setError(null);
  };

  const handlePick = (customer: CustomerListItemWithVip) => {
    onSelect(buildFieldUpdates(templateType, customer), {
      memo: customer.memo ?? null,
    });
    handleClose();
  };

  useEffect(() => {
    if (!open) return;

    const delay = search.trim() ? SEARCH_DEBOUNCE_MS : 0;
    const timer = window.setTimeout(() => {
      void loadFavorites(search);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [open, search, loadFavorites]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const emptyMessage = search.trim()
    ? "검색 결과가 없습니다."
    : "즐겨찾기 고객이 없습니다.";

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
      >
        <span aria-hidden>⭐</span>
        즐겨찾기 고객 불러오기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            aria-label="닫기"
            className="absolute inset-0 bg-zinc-900/40"
            onClick={handleClose}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="favorite-customers-title"
            className="relative z-10 flex max-h-[min(80vh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
          >
            <div className="shrink-0 border-b border-zinc-100 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id="favorite-customers-title"
                    className="text-sm font-semibold text-zinc-900"
                  >
                    ⭐ 즐겨찾기 고객
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    고객을 선택하면 이름과 전화번호가 자동 입력됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  닫기
                </button>
              </div>
            </div>

            <div className="sticky top-0 z-10 shrink-0 border-b border-zinc-100 bg-white px-4 py-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름, 전화번호 또는 메모 검색"
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 p-10">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
                  <p className="text-sm text-zinc-500">
                    {search.trim()
                      ? "검색 중..."
                      : "즐겨찾기 고객 불러오는 중..."}
                  </p>
                </div>
              ) : error ? (
                <EmptyState
                  message={error}
                  action={
                    <button
                      type="button"
                      onClick={() => void loadFavorites(search)}
                      className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                    >
                      다시 시도
                    </button>
                  }
                />
              ) : customers.length === 0 ? (
                <EmptyState message={emptyMessage} />
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {customers.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        onClick={() => handlePick(customer)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-amber-50 active:bg-amber-100"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-zinc-900">
                            {customer.name}
                          </span>
                          <span className="mt-0.5 block text-sm text-zinc-500">
                            {formatPhone(customer.phone)}
                          </span>
                          {customer.memo?.trim() ? (
                            <span className="mt-1 block line-clamp-2 whitespace-pre-wrap break-words text-xs text-zinc-400">
                              {customer.memo}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs font-medium text-amber-600">
                          선택
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
