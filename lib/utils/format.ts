import { getKstDateString } from "./kst-date-range";

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 로컬 타임존 기준 YYYY-MM-DD */
export function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 기본 조회 기간: KST 기준 오늘 - 7일 ~ 오늘 */
export function getDefaultDateRange(): { startDate: string; endDate: string } {
  const endDate = getKstDateString();
  const [y, m, d] = endDate.split("-").map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d));
  startUtc.setUTCDate(startUtc.getUTCDate() - 7);
  return {
    startDate: getKstDateString(startUtc),
    endDate,
  };
}

/** YYYY-MM-DD → YYYY.MM.DD */
export function formatDisplayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${y}.${m}.${d}`;
}

/** YYYY-MM-DD → YY-MM-DD (모바일 조회 기간 표시) */
export function formatCompactDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${y.slice(-2)}-${m}-${d}`;
}

export function formatDateRangeLabel(startDate: string, endDate: string): string {
  return `${formatDisplayDate(startDate)} ~ ${formatDisplayDate(endDate)}`;
}

/** 발송일 표시 — KST 기준 YY.MM.DD */
export function formatShortSentDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}.${month}.${day}`;
}
