import { CJ_SMART_TRACKER_CODE } from "@/lib/constants/delivery";
import type { DeliveryStatus, DeliveryTrackingDetail } from "@/types/delivery";

const SMART_TRACKER_API_URL =
  "https://info.sweettracker.co.kr/api/v1/trackingInfo";

export interface SmartTrackerTrackingDetail {
  kind?: string;
  where?: string;
  timeString?: string;
  level?: number;
}

export interface SmartTrackerResponse {
  status?: boolean;
  msg?: string;
  complete?: boolean;
  completeYN?: string;
  level?: number;
  invoiceNo?: string;
  trackingDetails?: SmartTrackerTrackingDetail[];
  lastStateDetail?: SmartTrackerTrackingDetail;
  lastDetail?: SmartTrackerTrackingDetail;
}

export function getSmartTrackerApiKey(): string | null {
  const key = process.env.SMART_TRACKER_API_KEY?.trim();
  return key || null;
}

export function normalizeTrackingNumber(value: string): string {
  return value.replace(/\D/g, "");
}

/** 스마트택배 이벤트 kind → 내부 배송상태 (고객용 단순화 매핑의 기반) */
export function mapSmartTrackerKindToDeliveryStatus(kind: string): DeliveryStatus {
  const k = kind.trim();
  if (/배송완료|배달완료/.test(k)) return "delivered";
  if (/간선상차|간선하차|배송출발/.test(k)) return "in_transit";
  if (/상품인수/.test(k)) return "ready";
  if (/집화처리/.test(k)) return "in_transit";
  if (k && k !== "-") return "in_transit";
  return "ready";
}

function resolveLastTrackingKind(data: SmartTrackerResponse): string {
  return (
    data.lastStateDetail?.kind ??
    data.lastDetail?.kind ??
    data.trackingDetails?.[data.trackingDetails.length - 1]?.kind ??
    ""
  ).trim();
}

export function mapSmartTrackerToDeliveryStatus(
  data: SmartTrackerResponse
): DeliveryStatus {
  if (data.complete === true || data.completeYN === "Y") {
    return "delivered";
  }

  const lastKind = resolveLastTrackingKind(data);
  if (lastKind) {
    return mapSmartTrackerKindToDeliveryStatus(lastKind);
  }

  return "ready";
}

export function extractCurrentLocation(data: SmartTrackerResponse): string | null {
  const last =
    data.lastStateDetail?.where ??
    data.lastDetail?.where ??
    data.trackingDetails?.[data.trackingDetails.length - 1]?.where;
  return last?.trim() || null;
}

export function mapTrackingHistory(
  data: SmartTrackerResponse
): DeliveryTrackingDetail[] {
  return (data.trackingDetails ?? []).map((item) => ({
    kind: item.kind?.trim() || "-",
    where: item.where?.trim() || "-",
    timeString: item.timeString?.trim() || "-",
    level: item.level,
  }));
}

export async function fetchSmartTrackerTracking(
  trackingNumber: string
): Promise<SmartTrackerResponse> {
  const apiKey = getSmartTrackerApiKey();
  if (!apiKey) {
    throw new Error("SMART_TRACKER_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  const invoice = normalizeTrackingNumber(trackingNumber);
  if (!invoice) {
    return { status: false, msg: "송장번호가 올바르지 않습니다." };
  }

  const url = new URL(SMART_TRACKER_API_URL);
  url.searchParams.set("t_key", apiKey);
  url.searchParams.set("t_code", CJ_SMART_TRACKER_CODE);
  url.searchParams.set("t_invoice", invoice);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`스마트택배 API 오류 (${res.status})`);
  }

  return (await res.json()) as SmartTrackerResponse;
}
