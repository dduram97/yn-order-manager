import type { CustomerListParams, CustomerVipFilter } from "@/types/customer";
import {
  normalizePhone,
  type ValidationError,
} from "@/lib/validations/order";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_MEMO_LENGTH = 500;

const VIP_FILTERS: CustomerVipFilter[] = ["all", "silver", "gold", "favorite"];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PHONE_PATTERN = /^0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}$/;

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

export function validateUpdateCustomerInput(body: unknown): {
  success: true;
  data: {
    name: string;
    phone: string;
    memo: string | null;
    order_channel: string | null;
    order_product: string | null;
  };
} | {
  success: false;
  errors: ValidationError[];
} {
  if (!body || typeof body !== "object") {
    return {
      success: false,
      errors: [{ field: "body", message: "요청 본문이 올바르지 않습니다." }],
    };
  }

  const { name, phone, memo, order_channel, order_product } = body as Record<
    string,
    unknown
  >;
  const errors: ValidationError[] = [];

  if (typeof name !== "string" || name.trim() === "") {
    errors.push({ field: "name", message: "고객명은 필수입니다." });
  }

  if (typeof phone !== "string" || phone.trim() === "") {
    errors.push({ field: "phone", message: "휴대폰번호는 필수입니다." });
  } else if (!PHONE_PATTERN.test(phone.trim())) {
    errors.push({
      field: "phone",
      message: "휴대폰번호 형식이 올바르지 않습니다.",
    });
  }

  if (memo !== undefined && memo !== null && typeof memo !== "string") {
    errors.push({ field: "memo", message: "메모는 문자열이어야 합니다." });
  } else if (typeof memo === "string" && memo.length > MAX_MEMO_LENGTH) {
    errors.push({
      field: "memo",
      message: `메모는 ${MAX_MEMO_LENGTH}자 이하여야 합니다.`,
    });
  }

  if (
    order_channel !== undefined &&
    order_channel !== null &&
    typeof order_channel !== "string"
  ) {
    errors.push({
      field: "order_channel",
      message: "주문채널은 문자열이어야 합니다.",
    });
  } else if (typeof order_channel === "string" && order_channel.trim() === "") {
    errors.push({
      field: "order_channel",
      message: "주문채널은 필수입니다.",
    });
  }

  if (
    order_product !== undefined &&
    order_product !== null &&
    typeof order_product !== "string"
  ) {
    errors.push({
      field: "order_product",
      message: "주문상품은 문자열이어야 합니다.",
    });
  } else if (typeof order_product === "string" && order_product.trim() === "") {
    errors.push({
      field: "order_product",
      message: "주문상품은 필수입니다.",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const memoValue =
    typeof memo === "string" && memo.trim() !== "" ? memo.trim() : null;

  return {
    success: true,
    data: {
      name: (name as string).trim(),
      phone: normalizePhone((phone as string).trim()),
      memo: memoValue,
      order_channel:
        typeof order_channel === "string" ? order_channel.trim() : null,
      order_product:
        typeof order_product === "string" ? order_product.trim() : null,
    },
  };
}

export function validateCreateCustomerInput(body: unknown): {
  success: true;
  data: {
    mode: "order" | "crm";
    name: string;
    phone: string;
    grade: "normal" | "silver" | "gold";
    memo: string | null;
    order_channel: string | null;
    order_product: string | null;
  };
} | {
  success: false;
  errors: ValidationError[];
} {
  if (!body || typeof body !== "object") {
    return {
      success: false,
      errors: [{ field: "body", message: "요청 본문이 올바르지 않습니다." }],
    };
  }

  const { name, phone, grade, memo, order_channel, order_product, mode } =
    body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  const modeVal: "order" | "crm" =
    mode === "crm" ? "crm" : "order";

  if (typeof name !== "string" || name.trim() === "") {
    errors.push({ field: "name", message: "고객명은 필수입니다." });
  }

  if (typeof phone !== "string" || phone.trim() === "") {
    errors.push({ field: "phone", message: "휴대폰번호는 필수입니다." });
  } else if (!PHONE_PATTERN.test(phone.trim())) {
    errors.push({
      field: "phone",
      message: "휴대폰번호 형식이 올바르지 않습니다.",
    });
  }

  if (modeVal === "order") {
    if (typeof order_channel !== "string" || order_channel.trim() === "") {
      errors.push({ field: "order_channel", message: "주문채널은 필수입니다." });
    }
    if (typeof order_product !== "string" || order_product.trim() === "") {
      errors.push({ field: "order_product", message: "주문상품은 필수입니다." });
    }
  }

  if (memo !== undefined && memo !== null && typeof memo !== "string") {
    errors.push({ field: "memo", message: "메모는 문자열이어야 합니다." });
  } else if (typeof memo === "string" && memo.length > MAX_MEMO_LENGTH) {
    errors.push({
      field: "memo",
      message: `메모는 ${MAX_MEMO_LENGTH}자 이하여야 합니다.`,
    });
  }

  const allowed = ["normal", "silver", "gold"] as const;
  const gradeVal =
    typeof grade === "string" &&
    allowed.includes(grade as (typeof allowed)[number])
      ? (grade as (typeof allowed)[number])
      : "normal";

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      mode: modeVal,
      name: (name as string).trim(),
      phone: normalizePhone((phone as string).trim()),
      grade: gradeVal,
      memo: typeof memo === "string" && memo.trim() !== "" ? memo.trim() : null,
      order_channel:
        modeVal === "order" ? (order_channel as string).trim() : null,
      order_product:
        modeVal === "order" ? (order_product as string).trim() : null,
    },
  };
}
