import { DELIVERY_AUTO_SYNC_MIN_INTERVAL_MS } from "@/lib/constants/delivery";
import type { AligoStatus } from "@/types/database";
import type { DeliveryStatus } from "@/types/delivery";

export interface AutoDeliverySyncOrder {
  aligo_status: AligoStatus;
  delivery_status?: DeliveryStatus | null;
  delivery_updated_at?: string | null;
  tracking_number?: string;
}

/** 발송현황 자동 배송조회 대상 여부 */
export function isEligibleForAutoDeliverySync(
  order: AutoDeliverySyncOrder
): boolean {
  if (order.aligo_status !== "success") return false;
  if (!order.tracking_number?.trim()) return false;

  const status = order.delivery_status ?? "ready";
  if (status === "delivered") return false;
  if (status !== "ready" && status !== "in_transit") return false;

  // 배송준비는 아직 실제 조회 이력이 없으므로 즉시 자동 조회 대상
  if (status === "ready") return true;

  if (!order.delivery_updated_at) return true;

  const updatedAt = new Date(order.delivery_updated_at).getTime();
  if (Number.isNaN(updatedAt)) return true;

  return Date.now() - updatedAt >= DELIVERY_AUTO_SYNC_MIN_INTERVAL_MS;
}
