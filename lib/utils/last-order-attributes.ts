"use client";

import {
  ORDER_ATTRIBUTE_OTHER,
  ORDER_CHANNEL_PRESETS,
  ORDER_PRODUCT_PRESETS,
  type OrderAttributeSelection,
} from "@/lib/constants/order-attributes";

const STORAGE_KEY = "yn:last-order-attributes";

export interface LastOrderAttributes {
  channel: OrderAttributeSelection;
  product: OrderAttributeSelection;
}

const DEFAULT_LAST: LastOrderAttributes = {
  channel: { preset: ORDER_CHANNEL_PRESETS[0], other: "" },
  product: { preset: ORDER_PRODUCT_PRESETS[0], other: "" },
};

export function loadLastOrderAttributes(): LastOrderAttributes {
  if (typeof window === "undefined") return DEFAULT_LAST;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAST;
    const parsed = JSON.parse(raw) as Partial<LastOrderAttributes>;
    return {
      channel: {
        preset:
          typeof parsed.channel?.preset === "string" && parsed.channel.preset
            ? parsed.channel.preset
            : DEFAULT_LAST.channel.preset,
        other:
          typeof parsed.channel?.other === "string"
            ? parsed.channel.other
            : "",
      },
      product: {
        preset:
          typeof parsed.product?.preset === "string" && parsed.product.preset
            ? parsed.product.preset
            : DEFAULT_LAST.product.preset,
        other:
          typeof parsed.product?.other === "string"
            ? parsed.product.other
            : "",
      },
    };
  } catch {
    return DEFAULT_LAST;
  }
}

export function saveLastOrderAttributes(next: LastOrderAttributes): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

export function isOtherPreset(preset: string): boolean {
  return preset === ORDER_ATTRIBUTE_OTHER;
}
