export type DeliveryStatus = "ready" | "in_transit" | "delivered";

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
  location: string | null;
  tracking_time: string | null;
  raw_response: unknown;
  created_at: string;
}
