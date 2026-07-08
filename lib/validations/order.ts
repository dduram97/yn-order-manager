import type { AligoStatus } from "@/types/database";
import {
  ALIGO_TEMPLATE_OPTIONS,
  type AligoTemplateType,
} from "@/lib/constants/aligo";
import type { CreateOrderInput, OrderListDateRangeParams, OrderListParams, OrderListQueryParams, UpdateOrderInput } from "@/types/order";
import { getDefaultDateRange } from "@/lib/utils/format";
import { resolveKstDateRange, getKstDateString } from "@/lib/utils/kst-date-range";
import { validateTrackingNumber } from "@/lib/validations/tracking-number";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  success: boolean;
  data?: CreateOrderInput;
  errors?: ValidationError[];
}

const PHONE_PATTERN = /^0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{4}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}

export function validateCreateOrderInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return {
      success: false,
      errors: [{ field: "body", message: "요청 본문이 올바르지 않습니다." }],
    };
  }

  const { customer_name, phone, tracking_number, sender_name, receiver_name, memo } =
    body as Record<string, unknown>;
  const errors: ValidationError[] = [];

  if (typeof customer_name !== "string" || customer_name.trim() === "") {
    errors.push({
      field: "customer_name",
      message: "고객 이름은 필수입니다.",
    });
  }

  if (typeof phone !== "string" || phone.trim() === "") {
    errors.push({
      field: "phone",
      message: "전화번호는 필수입니다.",
    });
  } else if (!PHONE_PATTERN.test(phone.trim())) {
    errors.push({
      field: "phone",
      message: "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)",
    });
  }

  if (
    tracking_number !== undefined &&
    tracking_number !== null &&
    typeof tracking_number !== "string"
  ) {
    errors.push({
      field: "tracking_number",
      message: "송장번호는 문자열이어야 합니다.",
    });
  }

  if (memo !== undefined && memo !== null && typeof memo !== "string") {
    errors.push({
      field: "memo",
      message: "메모는 문자열이어야 합니다.",
    });
  }

  for (const [field, label] of [
    ["sender_name", "보내는이"],
    ["receiver_name", "받는이"],
  ] as const) {
    const value = (body as Record<string, unknown>)[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      errors.push({ field, message: `${label}은 문자열이어야 합니다.` });
    }
  }

  const templateTypeRaw = (body as Record<string, unknown>).aligo_template_type;
  const trackingNumbersRaw = (body as Record<string, unknown>).tracking_numbers;

  if (trackingNumbersRaw !== undefined && trackingNumbersRaw !== null) {
    if (!Array.isArray(trackingNumbersRaw)) {
      errors.push({
        field: "tracking_numbers",
        message: "tracking_numbers는 문자열 배열이어야 합니다.",
      });
    } else {
      for (const item of trackingNumbersRaw) {
        if (typeof item !== "string") {
          errors.push({
            field: "tracking_numbers",
            message: "송장번호는 문자열이어야 합니다.",
          });
          break;
        }
      }
    }
  }

  if (
    templateTypeRaw !== undefined &&
    templateTypeRaw !== null &&
    (typeof templateTypeRaw !== "string" ||
      !(ALIGO_TEMPLATE_OPTIONS as readonly string[]).includes(templateTypeRaw))
  ) {
    errors.push({
      field: "aligo_template_type",
      message:
        "aligo_template_type은 택배발송알림, 선물보내는분 알림, 선물받는분 알림 중 하나여야 합니다.",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  const parsedTrackingNumbers = Array.isArray(trackingNumbersRaw)
    ? Array.from(
        new Set(
          trackingNumbersRaw
            .map((v) => (typeof v === "string" ? v.trim() : ""))
            .filter((v) => v !== "")
        )
      )
    : undefined;

  const singleTracking =
    typeof tracking_number === "string" ? tracking_number.trim() : "";

  const resolvedTrackingNumbers =
    parsedTrackingNumbers && parsedTrackingNumbers.length > 0
      ? parsedTrackingNumbers
      : singleTracking !== ""
        ? [singleTracking]
        : undefined;

  const firstTracking =
    resolvedTrackingNumbers?.[0] ?? singleTracking;

  if (!resolvedTrackingNumbers || resolvedTrackingNumbers.length === 0) {
    errors.push({
      field: "tracking_number",
      message: "운송장번호가 입력되지 않았습니다.",
    });
  } else {
    for (const tn of resolvedTrackingNumbers) {
      const trackingError = validateTrackingNumber(tn);
      if (trackingError) {
        errors.push({ field: "tracking_number", message: trackingError });
        break;
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      customer_name: (customer_name as string).trim(),
      phone: normalizePhone((phone as string).trim()),
      tracking_number: firstTracking,
      tracking_numbers: resolvedTrackingNumbers,
      sender_name:
        typeof sender_name === "string" && sender_name.trim() !== ""
          ? sender_name.trim()
          : undefined,
      receiver_name:
        typeof receiver_name === "string" && receiver_name.trim() !== ""
          ? receiver_name.trim()
          : undefined,
      memo:
        typeof memo === "string" && memo.trim() !== "" ? memo.trim() : undefined,
      aligo_template_type:
        typeof templateTypeRaw === "string"
          ? (templateTypeRaw as AligoTemplateType)
          : undefined,
    },
  };
}

export function getTodayDateString(): string {
  return getKstDateString();
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}

export function validateOrderId(
  id: string
):
  | { success: true; id: string }
  | { success: false; errors: ValidationError[] } {
  if (!id || id.trim() === "") {
    return {
      success: false,
      errors: [{ field: "id", message: "주문 ID는 필수입니다." }],
    };
  }

  const trimmed = id.trim();

  if (!UUID_PATTERN.test(trimmed)) {
    return {
      success: false,
      errors: [
        { field: "id", message: "주문 ID는 올바른 UUID 형식이어야 합니다." },
      ],
    };
  }

  return { success: true, id: trimmed };
}

const ALIGO_STATUSES: AligoStatus[] = ["pending", "success", "failed"];

const UPDATE_ORDER_FIELDS = [
  "customer_name",
  "phone",
  "tracking_number",
  "sender_name",
  "receiver_name",
  "memo",
  "aligo_status",
  "aligo_template_type",
] as const;

export function validateUpdateOrderInput(
  body: unknown
):
  | { success: true; data: UpdateOrderInput }
  | { success: false; errors: ValidationError[] } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      success: false,
      errors: [{ field: "body", message: "요청 본문이 올바르지 않습니다." }],
    };
  }

  const record = body as Record<string, unknown>;
  const errors: ValidationError[] = [];
  const update: UpdateOrderInput = {};

  const providedFields = UPDATE_ORDER_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(record, field)
  );

  if (providedFields.length === 0) {
    return {
      success: false,
      errors: [
        {
          field: "body",
          message: "수정할 필드를 하나 이상 포함해야 합니다.",
        },
      ],
    };
  }

  for (const field of providedFields) {
    const value = record[field];

    switch (field) {
      case "customer_name":
        if (typeof value !== "string" || value.trim() === "") {
          errors.push({
            field,
            message: "고객 이름은 비어있을 수 없습니다.",
          });
        } else {
          update.customer_name = value.trim();
        }
        break;

      case "phone":
        if (typeof value !== "string" || value.trim() === "") {
          errors.push({
            field,
            message: "전화번호는 비어있을 수 없습니다.",
          });
        } else if (!PHONE_PATTERN.test(value.trim())) {
          errors.push({
            field,
            message: "전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)",
          });
        } else {
          update.phone = normalizePhone(value.trim());
        }
        break;

      case "tracking_number":
        if (typeof value !== "string" || value.trim() === "") {
          errors.push({
            field,
            message: "송장번호는 비어있을 수 없습니다.",
          });
        } else {
          const trackingError = validateTrackingNumber(value);
          if (trackingError) {
            errors.push({ field, message: trackingError });
          } else {
            update.tracking_number = value.trim();
          }
        }
        break;

      case "sender_name":
      case "receiver_name":
        if (value === null) {
          update[field] = null;
        } else if (typeof value === "string") {
          update[field] = value.trim() === "" ? null : value.trim();
        } else {
          errors.push({
            field,
            message: `${field === "sender_name" ? "보내는이" : "받는이"}는 문자열 또는 null이어야 합니다.`,
          });
        }
        break;

      case "memo":
        if (value === null) {
          update.memo = null;
        } else if (typeof value === "string") {
          update.memo = value.trim() === "" ? null : value.trim();
        } else {
          errors.push({
            field,
            message: "메모는 문자열 또는 null이어야 합니다.",
          });
        }
        break;

      case "aligo_status":
        if (
          typeof value !== "string" ||
          !ALIGO_STATUSES.includes(value as AligoStatus)
        ) {
          errors.push({
            field,
            message:
              "aligo_status는 pending, success, failed 중 하나여야 합니다.",
          });
        } else {
          update.aligo_status = value as AligoStatus;
        }
        break;

      case "aligo_template_type":
        if (
          typeof value !== "string" ||
          !(ALIGO_TEMPLATE_OPTIONS as readonly string[]).includes(value)
        ) {
          errors.push({
            field,
            message:
              "aligo_template_type은 택배발송알림, 선물보내는분 알림, 선물받는분 알림 중 하나여야 합니다.",
          });
        } else {
          update.aligo_template_type = value as AligoTemplateType;
        }
        break;
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: update };
}

export function parseOrderListParams(searchParams: URLSearchParams): {
  success: true;
  data: OrderListParams;
} | {
  success: false;
  errors: ValidationError[];
} {
  const errors: ValidationError[] = [];

  const pageRaw = searchParams.get("page");
  const limitRaw = searchParams.get("limit");
  const searchRaw = searchParams.get("search");
  const customerNameRaw = searchParams.get("customer_name");
  const phoneRaw = searchParams.get("phone");

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

  const customer_name =
    typeof customerNameRaw === "string" && customerNameRaw.trim() !== ""
      ? customerNameRaw.trim()
      : undefined;

  const phone =
    typeof phoneRaw === "string" && phoneRaw.trim() !== ""
      ? phoneRaw.trim()
      : undefined;

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { page, limit, search, customer_name, phone },
  };
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseOrderDateRangeParams(searchParams: URLSearchParams): {
  success: true;
  data: OrderListDateRangeParams;
} | {
  success: false;
  errors: ValidationError[];
} {
  const defaults = getDefaultDateRange();
  const errors: ValidationError[] = [];

  const startRaw = searchParams.get("startDate");
  const endRaw = searchParams.get("endDate");

  let startDate =
    startRaw && startRaw.trim() !== "" ? startRaw.trim() : defaults.startDate;
  let endDate =
    endRaw && endRaw.trim() !== "" ? endRaw.trim() : defaults.endDate;

  if (!ISO_DATE_PATTERN.test(startDate)) {
    errors.push({
      field: "startDate",
      message: "startDate는 YYYY-MM-DD 형식이어야 합니다.",
    });
  }

  if (!ISO_DATE_PATTERN.test(endDate)) {
    errors.push({
      field: "endDate",
      message: "endDate는 YYYY-MM-DD 형식이어야 합니다.",
    });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  return { success: true, data: resolveKstDateRange(startDate, endDate) };
}

export function parseOrderListQueryParams(searchParams: URLSearchParams): {
  success: true;
  data: OrderListQueryParams;
} | {
  success: false;
  errors: ValidationError[];
} {
  const dateResult = parseOrderDateRangeParams(searchParams);
  if (!dateResult.success) {
    return dateResult;
  }

  const pageResult = parseOrderListParams(searchParams);
  if (!pageResult.success) {
    return pageResult;
  }

  const customerNameRaw = searchParams.get("customer_name");
  const phoneRaw = searchParams.get("phone");
  const trackingRaw = searchParams.get("tracking_number");

  const customer_name =
    typeof customerNameRaw === "string" && customerNameRaw.trim() !== ""
      ? customerNameRaw.trim()
      : undefined;

  const phone =
    typeof phoneRaw === "string" && phoneRaw.trim() !== ""
      ? phoneRaw.trim()
      : undefined;

  const tracking_number =
    typeof trackingRaw === "string" && trackingRaw.trim() !== ""
      ? trackingRaw.trim()
      : undefined;

  return {
    success: true,
    data: {
      ...dateResult.data,
      page: pageResult.data.page,
      limit: pageResult.data.limit,
      customer_name,
      phone,
      tracking_number,
    },
  };
}
