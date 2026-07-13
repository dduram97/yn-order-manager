export type DeliveryStatus = "ready" | "in_transit" | "delivered";

export type DeliveryTrackingEventType =
  | "customer_view"
  | "delivery_completed"
  | "admin_view"
  | "auto_sync";

export type DeliveryTrackingEventSource = Exclude<
  DeliveryTrackingEventType,
  "delivery_completed"
>;

export interface DeliveryTrackingDetail {
  kind: string;
  where: string;
  timeString: string;
  level?: number;
}

export interface DeliveryTrackItem {
  order_id: string;
  tracking_number: string;
  delivery_status: DeliveryStatus;
  location: string | null;
  history: DeliveryTrackingDetail[];
  query_success: boolean;
  query_message?: string | null;
}

export interface DeliveryTrackResponse {
  customer_name: string;
  courier_name: string;
  items: DeliveryTrackItem[];
}

export interface DeliveryTrackingLog {
  id: string;
  order_id: string;
  tracking_number: string;
  delivery_status: DeliveryStatus;
  event_type: DeliveryTrackingEventType;
  location: string | null;
  tracking_time: string | null;
  raw_response: unknown;
  created_at: string;
}

export interface DeliveryTrackingLogListItem {
  id: string;
  event_type: DeliveryTrackingEventType;
  event_label: string;
  created_at: string;
}

export interface DeliveryTrackingLogsResponse {
  order_id: string;
  customer_name: string;
  order_product: string | null;
  total_count: number;
  logs: DeliveryTrackingLogListItem[];
}
