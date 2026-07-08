import type { CustomerListParams, CustomerVipFilter } from "@/types/customer";
import type { ValidationError } from "@/lib/validations/order";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const VIP_FILTERS: CustomerVipFilter[] = ["all", "silver", "gold", "favorite"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseCustomerListParams(searchParams: URLSearchParams): {
  success: true;
  data: CustomerListParams;
} | {
  success: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  const pageRaw = searchParams.get("page");
  const limitRaw = searchParams.get("limit");
  const searchRaw = searchParams.get("search");
  const vipRaw = searchParams.get("vip");
  const startDateRaw = searchParams.get("startDate");
  const endDateRaw = searchParams.get("endDate");

  let page = DEFAULT_PAGE;
  let limit = DEFAULT_LIMIT;

  if (pageRaw !== null && pageRaw !== "") {
    const parsed = Number(pageRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.push({
        field: "page",
        message: "page는 1 이상의 정수여야 합니다.",
      });
    } else {
      page = parsed;
    }
  }

  if (limitRaw !== null && limitRaw !== "") {
    const parsed = Number(limitRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.push({
        field: "limit",
        message: "limit는 1 이상의 정수여야 합니다.",
      });
    } else {
      limit = Math.min(parsed, MAX_LIMIT);
    }
  }

  const search =
    typeof searchRaw === "string" && searchRaw.trim() !== ""
      ? searchRaw.trim()
      : undefined;

  let vip: CustomerVipFilter = "all";
  if (vipRaw !== null && vipRaw !== "") {
    if (!VIP_FILTERS.includes(vipRaw as CustomerVipFilter)) {
      errors.push({
        field: "vip",
        message: "vip는 all, silver, gold, favorite 중 하나여야 합니다.",
      });
    } else {
      vip = vipRaw as CustomerVipFilter;
    }
  }

  const startDate =
    typeof startDateRaw === "string" && startDateRaw.trim() !== ""
      ? startDateRaw.trim()
      : undefined;
  const endDate =
    typeof endDateRaw === "string" && endDateRaw.trim() !== ""
      ? endDateRaw.trim()
      : undefined;

  if (startDate && !DATE_REGEX.test(startDate)) {
    errors.push({
      field: "startDate",
      message: "startDate는 YYYY-MM-DD 형식이어야 합니다.",
    });
  }
  if (endDate && !DATE_REGEX.test(endDate)) {
    errors.push({
      field: "endDate",
      message: "endDate는 YYYY-MM-DD 형식이어야 합니다.",
    });
  }
  if (startDate && endDate && startDate > endDate) {
    errors.push({
      field: "dateRange",
      message: "시작일은 종료일보다 클 수 없습니다.",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      page,
      limit,
      search,
      vip: vip === "all" ? undefined : vip,
      startDate,
      endDate,
    },
  };
}
