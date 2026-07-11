"use client";

import { useEffect, useMemo, useState } from "react";
import type { CreatedCustomer, CustomerGrade } from "@/components/customers/customer-create-modal";

interface CustomerCrmModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: CreatedCustomer & { grade?: CustomerGrade }) => void;
}

interface CreateCustomerApiResponse {
  success: boolean;
  message?: string;
  data?: (CreatedCustomer & { grade?: CustomerGrade }) | null;
}

const MAX_MEMO_LENGTH = 500;

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

export function CustomerCrmModal({
  open,
  onClose,
  onCreated,
}: CustomerCrmModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
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
    setMemo("");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !canSubmit) return;

    if (memo.length > MAX_MEMO_LENGTH) {
      setError(`메모는 ${MAX_MEMO_LENGTH}자 이하여야 합니다.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "crm",
          name: name.trim(),
          phone: phone.trim(),
          memo: memo.trim() === "" ? null : memo,
        }),
      });

      const json: CreateCustomerApiResponse = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "기존고객 저장에 실패했습니다.");
      }

      onCreated(json.data);
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "기존고객 저장에 실패했습니다."
      );
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
        aria-labelledby="customer-crm-title"
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
      >
        <div className="shrink-0 border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="customer-crm-title"
                className="text-sm font-semibold text-zinc-900"
              >
                기존고객추가
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                주소록용 고객 저장입니다. 주문 통계에는 반영되지 않습니다.
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
            <span className="text-xs font-medium text-zinc-500">관리자 메모</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              maxLength={MAX_MEMO_LENGTH}
              placeholder={"단골 고객\n배송 전 전화"}
              className={`${inputClass} resize-y`}
              disabled={loading}
            />
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
