"use client";

import { useEffect, useMemo, useState } from "react";
import { OrderAttributeFields } from "@/components/orders/order-attribute-fields";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  NAVER_ORDER_ATTR_EDIT_LOCKED_CODE,
  NAVER_ORDER_ATTR_EDIT_LOCKED_MESSAGE,
  type CustomerEditKind,
} from "@/lib/constants/customer-edit";
import {
  ORDER_CHANNEL_PRESETS,
  ORDER_PRODUCT_PRESETS,
  resolveAttributeValue,
  selectionFromStoredValue,
  type OrderAttributeSelection,
} from "@/lib/constants/order-attributes";
import type { CustomerListItemWithVip } from "@/types/customer";

interface CustomerEditModalProps {
  open: boolean;
  customer: CustomerListItemWithVip | null;
  onClose: () => void;
  onUpdated: (customer: CustomerListItemWithVip) => void;
}

interface UpdateCustomerApiResponse {
  success: boolean;
  message?: string;
  code?: string | null;
  orderAttrLocked?: boolean;
  data?: CustomerListItemWithVip | null;
  errors?: { field: string; message: string }[];
}

interface EditContextApiResponse {
  success: boolean;
  message?: string;
  data?: {
    kind: CustomerEditKind;
    showOrderAttributes: boolean;
  };
}

const MAX_MEMO_LENGTH = 500;

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

export function CustomerEditModal({
  open,
  customer,
  onClose,
  onUpdated,
}: CustomerEditModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [channel, setChannel] = useState<OrderAttributeSelection>({
    preset: ORDER_CHANNEL_PRESETS[0],
    other: "",
  });
  const [product, setProduct] = useState<OrderAttributeSelection>({
    preset: ORDER_PRODUCT_PRESETS[0],
    other: "",
  });
  const [editKind, setEditKind] = useState<CustomerEditKind | null>(null);
  const [showOrderAttributes, setShowOrderAttributes] = useState(true);
  const [contextLoading, setContextLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);
  const [pendingCloseAfterLock, setPendingCloseAfterLock] = useState(false);

  const canSubmit = useMemo(() => {
    return name.trim() !== "" && phone.trim() !== "" && !loading && !contextLoading;
  }, [name, phone, loading, contextLoading]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  useEffect(() => {
    if (!open || !customer) return;
    const nextChannel = selectionFromStoredValue(
      customer.order_channel,
      ORDER_CHANNEL_PRESETS
    );
    const nextProduct = selectionFromStoredValue(
      customer.order_product,
      ORDER_PRODUCT_PRESETS
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(customer.name ?? "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhone(customer.phone ?? "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMemo(customer.memo ?? "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChannel(nextChannel);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProduct(nextProduct);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLockDialogOpen(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingCloseAfterLock(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditKind(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowOrderAttributes(true);
  }, [open, customer]);

  useEffect(() => {
    if (!open || !customer) return;

    let cancelled = false;
    setContextLoading(true);

    void (async () => {
      try {
        const res = await fetch(`/api/customers/${customer.id}/edit-context`);
        const json: EditContextApiResponse = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.success || !json.data) {
          // 실패 시 안전하게 주문정보 표시 (기존 동작)
          setEditKind("naver");
          setShowOrderAttributes(true);
          return;
        }
        setEditKind(json.data.kind);
        setShowOrderAttributes(json.data.showOrderAttributes);
      } catch {
        if (!cancelled) {
          setEditKind("naver");
          setShowOrderAttributes(true);
        }
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, customer]);

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

  const description = useMemo(() => {
    if (editKind === "crm") {
      return "고객명·연락처·메모를 수정할 수 있습니다.";
    }
    if (editKind === "wired") {
      return "고객명·연락처·주문채널·주문상품·메모를 수정할 수 있습니다.";
    }
    return "고객명·연락처·메모는 항상 수정 가능합니다. 주문채널·주문상품은 네이버 주문 등록 후 24시간 이내만 수정할 수 있습니다.";
  }, [editKind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !customer) return;

    if (memo.length > MAX_MEMO_LENGTH) {
      setError(`메모는 ${MAX_MEMO_LENGTH}자 이하여야 합니다.`);
      return;
    }

    const payload: Record<string, string | null> = {
      name: name.trim(),
      phone: phone.trim(),
      memo: memo.trim() === "" ? null : memo,
    };

    if (showOrderAttributes) {
      const orderChannel = resolveAttributeValue(
        channel.preset,
        channel.other,
        ORDER_CHANNEL_PRESETS
      );
      const orderProduct = resolveAttributeValue(
        product.preset,
        product.other,
        ORDER_PRODUCT_PRESETS
      );

      if (!orderChannel) {
        setError("주문채널을 선택하거나 기타 내용을 입력해주세요.");
        return;
      }
      if (!orderProduct) {
        setError("주문상품을 선택하거나 기타 내용을 입력해주세요.");
        return;
      }

      payload.order_channel = orderChannel;
      payload.order_product = orderProduct;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json: UpdateCustomerApiResponse = await res.json();
      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.message || "고객 정보 수정에 실패했습니다.");
      }

      const saved = json.data;
      onUpdated(saved);

      if (json.orderAttrLocked || json.code === NAVER_ORDER_ATTR_EDIT_LOCKED_CODE) {
        const lockedChannel = selectionFromStoredValue(
          saved.order_channel,
          ORDER_CHANNEL_PRESETS
        );
        const lockedProduct = selectionFromStoredValue(
          saved.order_product,
          ORDER_PRODUCT_PRESETS
        );
        setChannel(lockedChannel);
        setProduct(lockedProduct);
        setName(saved.name ?? "");
        setPhone(saved.phone ?? "");
        setMemo(saved.memo ?? "");
        setPendingCloseAfterLock(true);
        setLockDialogOpen(true);
        return;
      }

      handleClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "고객 정보 수정에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open || !customer) return null;

  return (
    <>
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
          aria-labelledby="customer-edit-title"
          className="relative z-10 flex max-h-[min(90vh,40rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl"
        >
          <div className="shrink-0 border-b border-zinc-100 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="customer-edit-title"
                  className="text-sm font-semibold text-zinc-900"
                >
                  고객 정보 수정
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
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

          <form
            onSubmit={handleSubmit}
            className="space-y-4 overflow-y-auto p-4"
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-500">고객명</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="고객명"
                className={inputClass}
                disabled={loading || contextLoading}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-500">
                휴대폰번호
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
                inputMode="tel"
                className={inputClass}
                disabled={loading || contextLoading}
              />
            </label>

            {showOrderAttributes ? (
              <OrderAttributeFields
                channel={channel}
                product={product}
                disabled={loading || contextLoading}
                onChannelChange={setChannel}
                onProductChange={setProduct}
              />
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-zinc-500">
                관리자 메모
              </span>
              <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={5}
                maxLength={MAX_MEMO_LENGTH}
                placeholder={"VIP 고객\n문어만 주문\n배송 전 전화"}
                className={`${inputClass} resize-y`}
                disabled={loading || contextLoading}
              />
              <span className="block text-right text-xs text-zinc-400">
                {memo.length}/{MAX_MEMO_LENGTH}
              </span>
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

      <ConfirmDialog
        open={lockDialogOpen}
        title="수정 제한"
        message={NAVER_ORDER_ATTR_EDIT_LOCKED_MESSAGE}
        confirmLabel="확인"
        showCancel={false}
        onConfirm={() => {
          setLockDialogOpen(false);
          if (pendingCloseAfterLock) {
            setPendingCloseAfterLock(false);
            onClose();
          }
        }}
        onCancel={() => {
          setLockDialogOpen(false);
          if (pendingCloseAfterLock) {
            setPendingCloseAfterLock(false);
            onClose();
          }
        }}
      />
    </>
  );
}
