"use client";

import { useCallback, useEffect, useState } from "react";
import { DeliveryStatusBadge } from "@/components/orders/delivery-status-badge";
import { CJ_COURIER_NAME } from "@/lib/constants/delivery";
import { formatTrackingNumber } from "@/lib/validations/tracking-number";
import type { DeliveryTrackItem, DeliveryTrackResponse } from "@/types/delivery";

interface DeliveryTrackingModalProps {
  open: boolean;
  orderId: string | null;
  customerName: string;
  onClose: () => void;
  onTracked?: (
    updates: Array<{
      order_id: string;
      delivery_status: DeliveryTrackItem["delivery_status"];
      delivery_location: string | null;
    }>
  ) => void;
}

interface TrackApiResponse {
  success: boolean;
  data?: DeliveryTrackResponse;
  message?: string;
  error?: string;
}

export function DeliveryTrackingModal({
  open,
  orderId,
  customerName,
  onClose,
  onTracked,
}: DeliveryTrackingModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DeliveryTrackResponse | null>(null);

  const fetchTracking = useCallback(async () => {
    if (!orderId) return;

    setLoading(true);
    setData(null);
    setError(null);

    try {
      const res = await fetch(
        `/api/delivery/track?orderId=${encodeURIComponent(orderId)}`
      );
      const json: TrackApiResponse = await res.json();

      if (!json.success || !json.data) {
        throw new Error(json.message || json.error || "배송조회에 실패했습니다.");
      }

      setData(json.data);
      onTracked?.(
        json.data.items.map((item) => ({
          order_id: item.order_id,
          delivery_status: item.delivery_status,
          delivery_location: item.location,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "배송조회에 실패했습니다.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, onTracked]);

  useEffect(() => {
    if (!open || !orderId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 모달 오픈 시 배송조회
    void fetchTracking();
  }, [open, orderId, fetchTracking]);

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
        aria-labelledby="delivery-tracking-title"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-100 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="delivery-tracking-title"
                className="text-sm font-semibold text-zinc-900"
              >
                배송조회
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {customerName} · {CJ_COURIER_NAME}
              </p>
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

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {loading && (
            <p className="py-8 text-center text-sm text-zinc-500">
              배송 정보를 조회하는 중...
            </p>
          )}

          {!loading && error && (
            <div className="space-y-3">
              <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                {error}
              </p>
              <button
                type="button"
                onClick={() => void fetchTracking()}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                다시 조회
              </button>
            </div>
          )}

          {!loading && data && (
            <div className="space-y-6">
              {data.items.map((item, index) => (
                <DeliveryTrackItemPanel
                  key={item.order_id}
                  item={item}
                  index={index}
                  total={data.items.length}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeliveryTrackItemPanel({
  item,
  index,
  total,
}: {
  item: DeliveryTrackItem;
  index: number;
  total: number;
}) {
  const showHeader = total > 1;

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
      {showHeader && (
        <p className="text-xs font-semibold text-zinc-500">
          송장번호 {index + 1}
        </p>
      )}

      <dl className="grid gap-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-zinc-500">송장번호</dt>
          <dd className="font-medium text-zinc-900">
            {formatTrackingNumber(item.tracking_number) || "-"}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-20 shrink-0 text-zinc-500">배송상태</dt>
          <dd>
            <DeliveryStatusBadge status={item.delivery_status} size="sm" />
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-zinc-500">현재 위치</dt>
          <dd className="text-zinc-800">{item.location?.trim() || "-"}</dd>
        </div>
      </dl>

      {item.query_message && !item.query_success && (
        <p className="text-xs text-amber-700">{item.query_message}</p>
      )}

      {item.history.length > 0 && (
        <div>
          <p className="mb-3 text-xs font-semibold text-zinc-500">배송 이력</p>
          <ol className="space-y-0">
            {item.history.map((step, stepIndex) => (
              <li key={`${step.timeString}-${stepIndex}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                      stepIndex === item.history.length - 1
                        ? "bg-sky-500"
                        : "bg-zinc-300"
                    }`}
                  />
                  {stepIndex < item.history.length - 1 && (
                    <span className="my-0.5 w-px flex-1 bg-zinc-200" />
                  )}
                </div>
                <div className="min-w-0 pb-4">
                  <p className="text-sm font-medium text-zinc-900">{step.kind}</p>
                  <p className="text-xs text-zinc-500">{step.where}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{step.timeString}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {item.query_success && item.history.length === 0 && (
        <p className="text-xs text-zinc-500">배송 이력이 없습니다.</p>
      )}
    </section>
  );
}
