import type { AligoStatus } from "@/types/database";
import type { DeliveryStatus } from "@/types/delivery";

/** 발송현황 목록용 — 알리고 성공 시 기본 배송준비 */
export function resolveListDeliveryStatus(
  aligoStatus: AligoStatus,
  deliveryStatus?: DeliveryStatus | null
): DeliveryStatus | null {
  if (aligoStatus !== "success") return null;
  return deliveryStatus ?? "ready";
}
