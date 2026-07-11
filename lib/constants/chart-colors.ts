/**
 * 통계 도넛 색상 — 데이터 집계와 분리.
 * 새 채널/상품 프리셋 추가 시 여기만 매핑하면 됩니다.
 */

import {
  ORDER_ATTRIBUTE_OTHER,
  ORDER_PRODUCT_PRESETS,
  WIRED_ORDER_CHANNEL,
} from "@/lib/constants/order-attributes";

/** 주문채널 고정 색상 */
export const CHANNEL_CHART_COLORS: Record<string, string> = {
  네이버: "#86efac", // 연초록
  [WIRED_ORDER_CHANNEL]: "#fde68a", // 연노랑
  [ORDER_ATTRIBUTE_OTHER]: "#d4d4d8", // 기타 (기존 톤)
};

/** 주문상품 파스텔 색상 */
export const PRODUCT_CHART_COLORS: Record<string, string> = {
  문어: "#fda4af", // 로즈
  과메기: "#a5b4fc", // 라벤더 블루
  가자미: "#67e8f9", // 스카이
  [ORDER_ATTRIBUTE_OTHER]: "#fcd34d", // 앰버
};

const FALLBACK_PASTELS = [
  "#bbf7d0",
  "#fbcfe8",
  "#c4b5fd",
  "#fdba74",
  "#99f6e4",
  "#e9d5ff",
];

function hashLabel(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) {
    h = (h * 31 + label.charCodeAt(i)) >>> 0;
  }
  return h;
}

export type ChartColorKind = "channel" | "product";

export function resolveChartColor(
  kind: ChartColorKind,
  label: string
): string {
  const map =
    kind === "channel" ? CHANNEL_CHART_COLORS : PRODUCT_CHART_COLORS;
  const known = map[label];
  if (known) return known;
  return FALLBACK_PASTELS[hashLabel(label) % FALLBACK_PASTELS.length];
}

/** 타입 가드용 — 상품 프리셋 목록 (색상 추가 시 PRODUCT_CHART_COLORS와 함께 유지) */
export const PRODUCT_COLOR_LABELS = [
  ...ORDER_PRODUCT_PRESETS,
  ORDER_ATTRIBUTE_OTHER,
] as const;
