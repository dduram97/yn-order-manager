export type { Order, AligoStatus, AligoTemplateType, AligoFailReason } from "./database";
import type { AligoFailReason, AligoStatus, AligoTemplateType, DeliveryStatus } from "./database";
import type { VipLevel } from "./customer";

export interface CreateOrderInput {
  customer_name: string;
  phone: string;
  tracking_number?: string;
  tracking_numbers?: string[];
  sender_name?: string;
  receiver_name?: string;
  memo?: string;
  aligo_template_type?: AligoTemplateType;
  order_channel: string;
  order_product: string;
}

export interface UpdateOrderInput {
  group_id?: string | null;
  customer_name?: string;
  phone?: string;
  tracking_number?: string;
  sender_name?: string | null;
  receiver_name?: string | null;
  memo?: string | null;
  aligo_status?: AligoStatus;
  aligo_template_type?: AligoTemplateType;
  aligo_fail_reason?: AligoFailReason | null;
  aligo_fail_message?: string | null;
  retry_count?: number;
  last_retry_at?: string | null;
  aligo_response?: import("./aligo-audit").AligoResponseLog | null;
  sent_at?: string | null;
  delivery_status?: DeliveryStatus | null;
  delivery_updated_at?: string | null;
  delivery_location?: string | null;
}

export interface OrderListDateRangeParams {
  /** UI/API 표시용 YYYY-MM-DD (KST) */
  startDate: string;
  endDate: string;
  /** created_at >= startAt (KST 00:00:00.000) */
  startAt: string;
  /** created_at <= endAt (KST 23:59:59.999) */
  endAt: string;
}

export interface OrderListQueryParams extends OrderListDateRangeParams {
  page?: number;
  limit?: number;
  /** 고객명·전화번호·송장번호 통합 검색 */
  search?: string;
  customer_name?: string;
  phone?: string;
  /** 송장번호 검색 */
  tracking_number?: string;
}

export interface OrderListResponse {
  data: OrderListItem[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export interface OrderListItem {
  id: string;
  customer_name: string;
  phone: string;
  tracking_number: string;
  sent_date: string;
  created_at: string;
  /** 발송 상태 (aligo_status 와 동일) */
  status: AligoStatus;
  aligo_status: AligoStatus;
  aligo_template_type?: AligoTemplateType;
  aligo_fail_reason?: AligoFailReason | null;
  aligo_fail_message?: string | null;
  retry_count?: number;
  last_retry_at?: string | null;
  order_count?: number;
  vip_level?: VipLevel;
  vip_badge?: "" | "👍" | "🏆";
  sent_at?: string | null;
  delivery_status?: DeliveryStatus | null;
  delivery_updated_at?: string | null;
  delivery_location?: string | null;
  /** delivery_tracking_logs 기준 주문별 배송조회 횟수 */
  tracking_view_count?: number;
}

export interface OrderListParams {
  page: number;
  limit: number;
  search?: string;
  customer_name?: string;
  phone?: string;
}

export interface OrderListPagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export interface OrderSearchParams {
  query?: string;
  page?: number;
  limit?: number;
}

export interface StatsQueryParams {
  year?: number;
  month?: number;
}
