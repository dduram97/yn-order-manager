import type { ValidationError } from "@/lib/validations/order";

const CURRENT_YEAR = new Date().getFullYear();

export function getYearOptions(): number[] {
  const years: number[] = [];
  for (let y = CURRENT_YEAR - 3; y <= CURRENT_YEAR + 1; y++) {
    years.push(y);
  }
  return years;
}

export function parseStatsQueryParams(searchParams: URLSearchParams): {
  success: true;
  data: { year: number; month: number };
} | {
  success: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const now = new Date();

  const yearRaw = searchParams.get("year");
  const monthRaw = searchParams.get("month");

  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (yearRaw !== null && yearRaw !== "") {
    const parsed = Number(yearRaw);
    if (!Number.isInteger(parsed)) {
      errors.push({ field: "year", message: "year는 정수여야 합니다." });
    } else if (parsed < CURRENT_YEAR - 3 || parsed > CURRENT_YEAR + 1) {
      errors.push({
        field: "year",
        message: `year는 ${CURRENT_YEAR - 3}~${CURRENT_YEAR + 1} 범위여야 합니다.`,
      });
    } else {
      year = parsed;
    }
  }

  if (monthRaw !== null && monthRaw !== "") {
    const parsed = Number(monthRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
      errors.push({
        field: "month",
        message: "month는 1~12 사이의 정수여야 합니다.",
      });
    } else {
      month = parsed;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { year, month } };
}

/** 신규 주문통계 — month=all 또는 생략 시 연도 전체 */
export function parseCustomerOrderStatsQueryParams(
  searchParams: URLSearchParams
): {
  success: true;
  data: { year: number; month: number | null };
} | {
  success: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const now = new Date();

  const yearRaw = searchParams.get("year");
  const monthRaw = searchParams.get("month");

  let year = now.getFullYear();
  let month: number | null = now.getMonth() + 1;

  if (yearRaw !== null && yearRaw !== "") {
    const parsed = Number(yearRaw);
    if (!Number.isInteger(parsed)) {
      errors.push({ field: "year", message: "year는 정수여야 합니다." });
    } else if (parsed < CURRENT_YEAR - 3 || parsed > CURRENT_YEAR + 1) {
      errors.push({
        field: "year",
        message: `year는 ${CURRENT_YEAR - 3}~${CURRENT_YEAR + 1} 범위여야 합니다.`,
      });
    } else {
      year = parsed;
    }
  }

  if (monthRaw === null || monthRaw === "" || monthRaw === "all") {
    month = null;
  } else {
    const parsed = Number(monthRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
      errors.push({
        field: "month",
        message: "month는 1~12 또는 all 이어야 합니다.",
      });
    } else {
      month = parsed;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { year, month } };
}
