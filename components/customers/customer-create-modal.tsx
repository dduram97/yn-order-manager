"use client";

import { useEffect, useMemo, useState } from "react";

export type CustomerGrade = "normal" | "silver" | "gold";

export interface CreatedCustomer {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  is_favorite?: boolean;
  favorite_at?: string | null;
}

interface CustomerCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: CreatedCustomer & { grade?: CustomerGrade }) => void;
}

interface CreateCustomerApiResponse {
  success: boolean;
  message?: string;
  data?: (CreatedCustomer & { grade?: CustomerGrade }) | null;
  errors?: { field: string; message: string }[];
}

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

export function CustomerCreateModal({
  open,
  onClose,
  onCreated,
}: CustomerCreateModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [grade, setGrade] = useState<CustomerGrade>("normal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return name.trim() !== "" && phone.trim() !== "" && !loading;
  }, [name, phone, loading]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName("");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhone("");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGrade("normal");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          grade,
        }),
      });

      const json: CreateCustomerApiResponse = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "고객 추가에 실패했습니다.");
      }

      onCreated(json.data);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "고객 추가에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
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
        aria-labelledby="customer-create-title"
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
      >
        <div className="shrink-0 border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="customer-create-title"
                className="text-sm font-semibold text-zinc-900"
              >
                + 고객 추가
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                고객을 직접 등록하면 발송 대상에도 사용할 수 있습니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
            >
              닫기
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">고객명</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="고객명"
              className={inputClass}
              disabled={loading}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">휴대폰번호</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-1234-5678"
              inputMode="tel"
              className={inputClass}
              disabled={loading}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-500">고객등급</span>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value as CustomerGrade)}
              className={inputClass}
              disabled={loading}
            >
              <option value="normal">일반</option>
              <option value="silver">Silver VIP</option>
              <option value="gold">Gold VIP</option>
            </select>
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

