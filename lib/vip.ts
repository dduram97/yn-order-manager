export type VipLevel = "normal" | "silver" | "gold";

export interface VipFields {
  order_count: number;
  vip_level: VipLevel;
  vip_badge: "" | "👍" | "🏆";
}

export const VIP_GOLD_MIN = 10;
export const VIP_SILVER_MIN = 5;

export function getVipLevel(orderCount: number): VipLevel {
  if (orderCount >= VIP_GOLD_MIN) return "gold";
  if (orderCount >= VIP_SILVER_MIN) return "silver";
  return "normal";
}

export function getVipBadge(vipLevel: VipLevel): VipFields["vip_badge"] {
  if (vipLevel === "gold") return "🏆";
  if (vipLevel === "silver") return "👍";
  return "";
}

export function resolveVipFields(orderCount: number): VipFields {
  const vip_level = getVipLevel(orderCount);
  return {
    order_count: orderCount,
    vip_level,
    vip_badge: getVipBadge(vip_level),
  };
}
