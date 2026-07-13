/**
 * Supabase CLI로 자동 생성되는 타입 파일
 * 생성 명령: npx supabase gen types typescript --project-id <id> > types/database.ts
 *
 * 아래는 PRD 기반 수동 정의 (개발 초기용)
 */

export type { AligoResponseLog } from "./aligo-audit";
import type { AligoResponseLog } from "./aligo-audit";
import type { DeliveryTrackingLog } from "./delivery";
import type { AdminPrivateMemo } from "./admin-memo";

export type AligoStatus = "pending" | "success" | "failed";

export type AligoFailReason =
  | "KAKAO_NOT_REGISTERED"
  | "INSUFFICIENT_BALANCE"
  | "TEMPLATE_VARIABLE_ERROR"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export type AligoTemplateType =
  | "택배발송알림"
  | "선물보내는분 알림"
  | "선물받는분 알림";

export type VipLevel = "normal" | "silver" | "gold";

export type DeliveryStatus = "ready" | "in_transit" | "delivered";

export interface Order {
  id: string;
  group_id?: string | null;
  customer_name: string;
  phone: string;
  tracking_number: string;
  sender_name?: string | null;
  receiver_name?: string | null;
  memo: string | null;
  sent_date: string;
  created_at: string;
  updated_at?: string;
  aligo_status: AligoStatus;
  aligo_template_type?: AligoTemplateType;
  aligo_fail_reason?: AligoFailReason | null;
  aligo_fail_message?: string | null;
  retry_count?: number;
  last_retry_at?: string | null;
  aligo_response?: AligoResponseLog | null;
  sent_at?: string | null;
  delivery_status?: DeliveryStatus | null;
  delivery_updated_at?: string | null;
  delivery_location?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  order_count?: number;
  vip_level?: VipLevel;
  grade?: VipLevel;
  is_favorite?: boolean;
  favorite_at?: string | null;
  memo?: string | null;
  order_channel?: string | null;
  order_product?: string | null;
}

export interface AppUserRow {
  id: string;
  email: string;
  password_hash: string;
  role: "admin" | "staff";
  created_at: string;
}

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "12";
  };
  public: {
    Tables: {
      orders: {
        Row: Order;
        Insert: {
          id?: string;
          group_id?: string | null;
          customer_name: string;
          phone: string;
          tracking_number?: string;
          sender_name?: string | null;
          receiver_name?: string | null;
          memo?: string | null;
          sent_date?: string;
          created_at?: string;
          aligo_status?: AligoStatus;
          aligo_template_type?: AligoTemplateType;
          aligo_fail_reason?: AligoFailReason | null;
          aligo_fail_message?: string | null;
          retry_count?: number;
          last_retry_at?: string | null;
          aligo_response?: AligoResponseLog | null;
          sent_at?: string | null;
          delivery_status?: DeliveryStatus | null;
          delivery_updated_at?: string | null;
          delivery_location?: string | null;
        };
        Update: {
          id?: string;
          group_id?: string | null;
          customer_name?: string;
          phone?: string;
          tracking_number?: string;
          sender_name?: string | null;
          receiver_name?: string | null;
          memo?: string | null;
          sent_date?: string;
          created_at?: string;
          updated_at?: string;
          aligo_status?: AligoStatus;
          aligo_template_type?: AligoTemplateType;
          aligo_fail_reason?: AligoFailReason | null;
          aligo_fail_message?: string | null;
          retry_count?: number;
          last_retry_at?: string | null;
          aligo_response?: AligoResponseLog | null;
          sent_at?: string | null;
          delivery_status?: DeliveryStatus | null;
          delivery_updated_at?: string | null;
          delivery_location?: string | null;
        };
        Relationships: [];
      };
      delivery_tracking_logs: {
        Row: DeliveryTrackingLog;
        Insert: {
          id?: string;
          order_id: string;
          tracking_number: string;
          delivery_status: DeliveryStatus;
          event_type: import("./delivery").DeliveryTrackingEventType;
          location?: string | null;
          tracking_time?: string | null;
          raw_response?: unknown;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          tracking_number?: string;
          delivery_status?: DeliveryStatus;
          event_type?: import("./delivery").DeliveryTrackingEventType;
          location?: string | null;
          tracking_time?: string | null;
          raw_response?: unknown;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: Customer;
        Insert: {
          id?: string;
          name: string;
          phone: string;
          created_at?: string;
          order_count?: number;
          vip_level?: VipLevel;
          grade?: VipLevel;
          is_favorite?: boolean;
          favorite_at?: string | null;
          memo?: string | null;
          order_channel?: string | null;
          order_product?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          phone?: string;
          created_at?: string;
          order_count?: number;
          vip_level?: VipLevel;
          grade?: VipLevel;
          is_favorite?: boolean;
          favorite_at?: string | null;
          memo?: string | null;
          order_channel?: string | null;
          order_product?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: AppUserRow;
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          role: "admin" | "staff";
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          role?: "admin" | "staff";
          created_at?: string;
        };
        Relationships: [];
      };
      admin_private_memos: {
        Row: AdminPrivateMemo;
        Insert: {
          id?: string;
          user_id: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_order_statistics: {
        Row: {
          id: string;
          customer_id: string;
          order_channel: string;
          order_product: string;
          source: "order_registration" | "customer_add";
          source_ref: string;
          created_at: string;
          year: number;
          month: number;
          day: number;
        };
        Insert: {
          id?: string;
          customer_id: string;
          order_channel: string;
          order_product: string;
          source: "order_registration" | "customer_add";
          source_ref: string;
          created_at?: string;
          year: number;
          month: number;
          day: number;
        };
        Update: {
          id?: string;
          customer_id?: string;
          order_channel?: string;
          order_product?: string;
          source?: "order_registration" | "customer_add";
          source_ref?: string;
          created_at?: string;
          year?: number;
          month?: number;
          day?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
