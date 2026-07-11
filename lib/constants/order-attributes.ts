/** UI/통계 프리셋 — 항목 추가 시 여기만 수정하면 통계 집계에 자동 반영 */

/** 발송등록으로 생성되는 통계의 고정 주문채널 */
export const WIRED_ORDER_CHANNEL = "유선주문" as const;

/** 통계 도넛·고객수정 공통 채널 프리셋 (네이버 / 유선주문 + 기타) */
export const ORDER_CHANNEL_PRESETS = [
  "네이버",
  WIRED_ORDER_CHANNEL,
] as const;

/** 네이버 주문 화면 전용 (유선주문·전화 제외) */
export const NAVER_ORDER_CHANNEL_PRESETS = ["네이버"] as const;

export const ORDER_PRODUCT_PRESETS = ["문어", "과메기", "가자미"] as const;

export const ORDER_ATTRIBUTE_OTHER = "기타" as const;

export type OrderChannelPreset =
  | (typeof ORDER_CHANNEL_PRESETS)[number]
  | typeof ORDER_ATTRIBUTE_OTHER;

export type OrderProductPreset =
  | (typeof ORDER_PRODUCT_PRESETS)[number]
  | typeof ORDER_ATTRIBUTE_OTHER;

export type OrderStatSource = "order_registration" | "customer_add";

export interface OrderAttributeSelection {
  /** 프리셋 선택값 (네이버/유선주문/기타 등) */
  preset: string;
  /** 기타일 때 직접 입력값 */
  other: string;
}

export interface ResolvedOrderAttributes {
  order_channel: string;
  order_product: string;
}

export function isKnownPreset(
  value: string,
  presets: readonly string[]
): boolean {
  return presets.includes(value);
}

export function resolveAttributeValue(
  preset: string,
  other: string,
  presets: readonly string[]
): string | null {
  const trimmedPreset = preset.trim();
  if (!trimmedPreset) return null;

  if (trimmedPreset === ORDER_ATTRIBUTE_OTHER) {
    const custom = other.trim();
    return custom === "" ? null : custom;
  }

  if (presets.includes(trimmedPreset)) {
    return trimmedPreset;
  }

  // 확장: 알려지지 않은 프리셋 문자열이어도 그대로 저장
  return trimmedPreset;
}

/** 레거시 "전화" 값은 유선주문으로 매핑 (표시/편집용, DB 미수정) */
export function normalizeChannelForDisplay(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "전화") return WIRED_ORDER_CHANNEL;
  return trimmed;
}

export function selectionFromStoredValue(
  stored: string | null | undefined,
  presets: readonly string[]
): OrderAttributeSelection {
  const value = normalizeChannelForDisplay(stored ?? "");
  if (!value) {
    return { preset: presets[0] ?? ORDER_ATTRIBUTE_OTHER, other: "" };
  }
  if (presets.includes(value)) {
    return { preset: value, other: "" };
  }
  return { preset: ORDER_ATTRIBUTE_OTHER, other: value };
}

export function categorizeForChart(
  value: string,
  presets: readonly string[]
): { category: string; detail: string | null } {
  const normalized = normalizeChannelForDisplay(value);
  if (presets.includes(normalized)) {
    return { category: normalized, detail: null };
  }
  return { category: ORDER_ATTRIBUTE_OTHER, detail: normalized || value };
}
