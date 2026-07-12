/** 고객 수정 화면 유형 (마이그레이션 없이 통계·채널로 추론) */
export type CustomerEditKind = "crm" | "naver" | "wired";

export const NAVER_ORDER_ATTR_EDIT_LOCKED_MESSAGE =
  "주문채널과 주문상품은 등록 후 24시간이 지나 수정할 수 없습니다.\n고객명, 전화번호, 메모는 수정 가능합니다.";

export const NAVER_ORDER_ATTR_EDIT_LOCKED_CODE = "ORDER_ATTR_EDIT_LOCKED";
