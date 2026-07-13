"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeliveryTrackingLogsResponse } from "@/types/delivery";

interface DeliveryTrackingLogsModalProps {
  open: boolean;
  orderId: string | null;
  onClose: () => void;
}

interface LogsApiResponse {
  success: boolean;
  data?: DeliveryTrackingLogsResponse;
  message?: string;
  error?: string;
}

function formatLogDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const formatted = date.toLocaleString("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // sv-SE → "2026-07-12 09:10:00" or "2026-07-12 09:10"
  return formatted.slice(0, 16);
}

export function DeliveryTrackingLogsModal({
  open,
  orderId,
  onClose,
}: DeliveryTrackingLogsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DeliveryTrackingLogsResponse | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/tracking-logs`
      );
      const json: LogsApiResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(
          json.message || json.error || "배송조회 이력을 불러오지 못했습니다."
        );
      }

      setData(json.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "배송조회 이력을 불러오지 못했습니다."
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!open || !orderId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 오픈 시 이력 조회
    void fetchLogs();
  }, [open, orderId, fetchLogs]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="delivery-tracking-logs-title"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="delivery-tracking-logs-title"
                className="text-sm font-semibold text-zinc-900"
              >
                배송조회 이력
              </h2>
              {data && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-sm font-medium text-zinc-800">
                    {data.customer_name}
                  </p>
                  {data.order_product && (
                    <p className="text-xs text-zinc-500">{data.order_product}</p>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
            >
              닫기
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && (
            <p className="py-8 text-center text-sm text-zinc-500">
              이력을 불러오는 중...
            </p>
          )}

          {!loading && error && (
            <div className="space-y-3">
              <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void fetchLogs()}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                다시 시도
              </button>
            </div>
          )}

          {!loading && data && data.logs.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-500">
              배송조회 이력이 없습니다.
            </p>
          )}

          {!loading && data && data.logs.length > 0 && (
            <ul className="space-y-4">
              {data.logs.map((log) => (
                <li key={log.id} className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
                  <p className="text-sm tabular-nums text-zinc-500">
                    {formatLogDateTime(log.created_at)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-900">
                    {log.event_label}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {data && (
          <div className="border-t border-zinc-100 px-4 py-3">
            <p className="text-center text-sm text-zinc-600">
              총 조회 {data.total_count}회
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
