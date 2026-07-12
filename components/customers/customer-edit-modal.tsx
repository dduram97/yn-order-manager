"use client";

import { useEffect, useMemo, useState } from "react";
import { OrderAttributeFields } from "@/components/orders/order-attribute-fields";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  data?: CustomerListItemWithVip | null;
  errors?: { field: string; message: string }[];
}

const MAX_MEMO_LENGTH = 500;

const ORDER_ATTR_LOCKED_CODE = "ORDER_ATTR_EDIT_LOCKED";
const ORDER_ATTR_LOCKED_MESSAGE =
  "주문 등록 후 24시간이 지난 주문입니다.\n통계 데이터 보호를 위해 주문채널/주문상품 수정이 제한됩니다.";

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
  const [initialChannel, setInitialChannel] = useState<OrderAttributeSelection>({
    preset: ORDER_CHANNEL_PRESETS[0],
    other: "",
  });
  const [initialProduct, setInitialProduct] = useState<OrderAttributeSelection>({
    preset: ORDER_PRODUCT_PRESETS[0],
    other: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockDialogOpen, setLockDialogOpen] = useState(false);

  const canSubmit = useMemo(() => {
    return name.trim() !== "" && phone.trim() !== "" && !loading;
  }, [name, phone, loading]);

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
    setInitialChannel(nextChannel);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInitialProduct(nextProduct);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLockDialogOpen(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !customer) return;

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
    if (memo.length > MAX_MEMO_LENGTH) {
      setError(`메모는 ${MAX_MEMO_LENGTH}자 이하여야 합니다.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          memo: memo.trim() === "" ? null : memo,
          order_channel: orderChannel,
          order_product: orderProduct,
        }),
      });

      const json: UpdateCustomerApiResponse = await res.json();
      if (!res.ok || !json.success || !json.data) {
        if (json.code === ORDER_ATTR_LOCKED_CODE || res.status === 403) {
          setChannel(initialChannel);
          setProduct(initialProduct);
          setLockDialogOpen(true);
          return;
        }
        throw new Error(json.message || "고객 정보 수정에 실패했습니다.");
      }

      onUpdated(json.data);
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
                <p className="mt-0.5 text-xs text-zinc-500">
                  고객명·연락처·주문채널·주문상품·메모를 수정할 수 있습니다.
                  네이버 주문의 채널/상품은 등록 후 24시간 이내만 통계 정정이
                  가능합니다.
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
                disabled={loading}
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
                disabled={loading}
              />
            </label>

            <OrderAttributeFields
              channel={channel}
              product={product}
              disabled={loading}
              onChannelChange={setChannel}
              onProductChange={setProduct}
            />

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
                disabled={loading}
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
        message={ORDER_ATTR_LOCKED_MESSAGE}
        confirmLabel="확인"
        showCancel={false}
        onConfirm={() => setLockDialogOpen(false)}
        onCancel={() => setLockDialogOpen(false)}
      />
    </>
  );
}
