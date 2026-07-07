import type { DeliveryStatus } from "@/types/delivery";

/** 스마트택배 택배사 코드 — CJ대한통운 */
export const CJ_SMART_TRACKER_CODE = "04";

export const CJ_COURIER_NAME = "CJ대한통운";

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  ready: "배송준비",
  in_transit: "배송중",
  delivered: "배송완료",
};

export const DELIVERY_STATUS_EMOJI: Record<DeliveryStatus, string> = {
  ready: "🚚",
  in_transit: "🚚",
  delivered: "✅",
};

/** 배송상태 dot 색상 (텍스트는 기본 색상 유지) */
export const DELIVERY_STATUS_DOT: Record<DeliveryStatus, string> = {
  ready: "bg-amber-500",
  in_transit: "bg-sky-500",
  delivered: "bg-emerald-500",
};

export const DELIVERY_STATUS_STYLE: Record<
  DeliveryStatus,
  { bg: string; text: string; dot: string }
> = {
  ready: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    dot: DELIVERY_STATUS_DOT.ready,
  },
  in_transit: {
    bg: "bg-sky-50",
    text: "text-sky-800",
    dot: DELIVERY_STATUS_DOT.in_transit,
  },
  delivered: {
    bg: "bg-emerald-50",
    text: "text-emerald-800",
    dot: DELIVERY_STATUS_DOT.delivered,
  },
};
