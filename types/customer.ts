import type { VipFields, VipLevel } from "@/lib/vip";

export type { VipLevel };

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  grade?: VipLevel;
  is_favorite?: boolean;
  favorite_at?: string | null;
  /** 관리자 메모 (선택) */
  memo?: string | null;
  order_channel?: string | null;
  order_product?: string | null;
}

export type CustomerListItemWithVip = CustomerListItem &
  VipFields & {
    display_badge?: string;
    /**
     * 고객의 마지막 주문/발송 시각 (orders.sent_at 우선, 없으면 orders.created_at)
     * 고객 목록 UI의 "최종 주문일" 컬럼에서 사용
     */
    last_sent_at?: string | null;
  };

export type CustomerVipFilter = "all" | "silver" | "gold" | "favorite";

export interface CustomerListParams {
  page: number;
  limit: number;
  search?: string;
  vip?: CustomerVipFilter;
  /** YYYY-MM-DD (KST) */
  startDate?: string;
  /** YYYY-MM-DD (KST) */
  endDate?: string;
}

export interface CustomerListPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}
