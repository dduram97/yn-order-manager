import type {
  DeliveryStatus,
  DeliveryTrackingEventType,
} from "@/types/delivery";

/** 스마트택배 택배사 코드 — CJ대한통운 */
export const CJ_SMART_TRACKER_CODE = "04";

export const CJ_COURIER_NAME = "CJ대한통운";

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  ready: "배송준비",
  in_transit: "배송중",
  delivered: "배송완료",
};

export const DELIVERY_TRACKING_EVENT_LABEL: Record<
  DeliveryTrackingEventType,
  string
> = {
  customer_view: "고객 배송조회",
  delivery_completed: "배송완료 확인",
  admin_view: "관리자 조회",
  auto_sync: "자동 동기화",
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

/** 발송현황 자동 배송조회 최소 간격 (30분) */
export const DELIVERY_AUTO_SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;

/** 자동 배송조회 1회 최대 건수 (목록 페이지 limit과 동일) */
export const DELIVERY_AUTO_SYNC_MAX_ORDERS = 20;

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
