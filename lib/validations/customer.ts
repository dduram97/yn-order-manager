import type { CustomerListParams, CustomerVipFilter } from "@/types/customer";
import type { ValidationError } from "@/lib/validations/order";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const VIP_FILTERS: CustomerVipFilter[] = ["all", "silver", "gold", "favorite"];

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
    },
  };
}
