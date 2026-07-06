const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** KST(Asia/Seoul) 기준 YYYY-MM-DD */
export function getKstDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** KST 해당 날짜 00:00:00.000 */
export function toKstDayStart(isoDate: string): string {
  if (!ISO_DATE_PATTERN.test(isoDate)) {
    throw new Error(`Invalid date: ${isoDate}`);
  }
  return `${isoDate}T00:00:00.000+09:00`;
}

/** KST 해당 날짜 23:59:59.999 */
export function toKstDayEnd(isoDate: string): string {
  if (!ISO_DATE_PATTERN.test(isoDate)) {
    throw new Error(`Invalid date: ${isoDate}`);
  }
  return `${isoDate}T23:59:59.999+09:00`;
}

export interface KstDateRange {
  startDate: string;
  endDate: string;
  startAt: string;
  endAt: string;
}

/** YYYY-MM-DD → KST 하루 시작·끝 timestamptz (created_at 필터용) */
export function resolveKstDateRange(
  startDate: string,
  endDate: string
): KstDateRange {
  return {
    startDate,
    endDate,
    startAt: toKstDayStart(startDate),
    endAt: toKstDayEnd(endDate),
  };
}
