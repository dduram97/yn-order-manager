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
}

export type CustomerListItemWithVip = CustomerListItem &
  VipFields & {
    display_badge?: string;
  };

export type CustomerVipFilter = "all" | "silver" | "gold" | "favorite";

export interface CustomerListParams {
  page: number;
  limit: number;
  search?: string;
  vip?: CustomerVipFilter;
}

export interface CustomerListPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}
