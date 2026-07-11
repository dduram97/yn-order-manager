"use client";

import {
  ORDER_ATTRIBUTE_OTHER,
  ORDER_CHANNEL_PRESETS,
  ORDER_PRODUCT_PRESETS,
  type OrderAttributeSelection,
} from "@/lib/constants/order-attributes";
import { isOtherPreset } from "@/lib/utils/last-order-attributes";

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10";

interface OrderAttributeFieldsProps {
  channel: OrderAttributeSelection;
  product: OrderAttributeSelection;
  disabled?: boolean;
  /** false면 주문채널 UI 숨김 (발송등록) */
  showChannel?: boolean;
  /** 미지정 시 기본(네이버/유선주문/기타). 네이버 주문은 네이버/기타만 전달 */
  channelPresets?: readonly string[];
  onChannelChange: (next: OrderAttributeSelection) => void;
  onProductChange: (next: OrderAttributeSelection) => void;
}

export function OrderAttributeFields({
  channel,
  product,
  disabled = false,
  showChannel = true,
  channelPresets = ORDER_CHANNEL_PRESETS,
  onChannelChange,
  onProductChange,
}: OrderAttributeFieldsProps) {
  const channelOptions = [...channelPresets, ORDER_ATTRIBUTE_OTHER];
  const productOptions = [...ORDER_PRODUCT_PRESETS, ORDER_ATTRIBUTE_OTHER];

  return (
    <div className="space-y-4">
      {showChannel ? (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-zinc-500">주문채널</span>
          <div className="flex flex-wrap gap-2">
            {channelOptions.map((option) => {
              const active = channel.preset === option;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    onChannelChange({
                      preset: option,
                      other:
                        option === ORDER_ATTRIBUTE_OTHER ? channel.other : "",
                    })
                  }
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
          {isOtherPreset(channel.preset) ? (
            <input
              value={channel.other}
              onChange={(e) =>
                onChannelChange({
                  preset: channel.preset,
                  other: e.target.value,
                })
              }
              placeholder="기타 채널 직접 입력 (예: 인스타, 당근)"
              className={inputClass}
              disabled={disabled}
            />
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-zinc-500">주문상품</span>
        <div className="flex flex-wrap gap-2">
          {productOptions.map((option) => {
            const active = product.preset === option;
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onProductChange({
                    preset: option,
                    other:
                      option === ORDER_ATTRIBUTE_OTHER ? product.other : "",
                  })
                }
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {isOtherPreset(product.preset) ? (
          <input
            value={product.other}
            onChange={(e) =>
              onProductChange({ preset: product.preset, other: e.target.value })
            }
            placeholder="기타 상품 직접 입력 (예: 대게, 홍게)"
            className={inputClass}
            disabled={disabled}
          />
        ) : null}
      </div>
    </div>
  );
}
