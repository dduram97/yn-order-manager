import type { AligoTemplateType } from "@/lib/constants/aligo";
import { getSnapshotTemplateName } from "./dashboard-snapshot";

/** orders / API 필드 키 */
export const TEMPLATE_FIELD_KEYS = [
  "phone",
  "customer_name",
  "sender_name",
  "receiver_name",
  "tracking_number",
] as const;

export type TemplateFieldKey = (typeof TEMPLATE_FIELD_KEYS)[number];

/**
 * Aligo 플레이스홀더 ↔ orders 필드 중앙 매핑 (유일한 변수 정의)
 */
export const ALIGO_VARIABLE_MAP: Record<TemplateFieldKey, string> = {
  phone: "#{메시지 수신 휴대폰 번호}",
  customer_name: "#{고객명}",
  sender_name: "#{보내는이}",
  receiver_name: "#{받는이}",
  tracking_number: "#{송장번호}",
};

export const ALIGO_PLACEHOLDER_TO_FIELD = Object.fromEntries(
  Object.entries(ALIGO_VARIABLE_MAP).map(([field, placeholder]) => [
    placeholder,
    field,
  ])
) as Record<string, TemplateFieldKey>;

export const TEMPLATE_FIELD_LABELS: Record<TemplateFieldKey, string> = {
  phone: "전화번호",
  customer_name: "고객명",
  sender_name: "보내는이",
  receiver_name: "받는이",
  tracking_number: "송장번호",
};

export const COMMON_UI_FIELD_KEYS: readonly TemplateFieldKey[] = ["phone"];

export interface TemplateRegistryEntry {
  dashboardName: string;
  /** 폼 입력 필드 표시 순서 (전화번호 포함) */
  formFieldOrder: TemplateFieldKey[];
  listNameField: TemplateFieldKey;
  recvNameField: TemplateFieldKey;
}

/** UI·DB 동기화 메타 (변수 목록은 remote templtContent에서 파생) */
export const ALIGO_TEMPLATE_REGISTRY: Record<
  AligoTemplateType,
  TemplateRegistryEntry
> = {
  택배발송알림: {
    dashboardName: getSnapshotTemplateName("택배발송알림"),
    formFieldOrder: ["customer_name", "phone", "tracking_number"],
    listNameField: "customer_name",
    recvNameField: "customer_name",
  },
  "선물보내는분 알림": {
    dashboardName: getSnapshotTemplateName("선물보내는분 알림"),
    formFieldOrder: ["sender_name", "receiver_name", "phone", "tracking_number"],
    listNameField: "sender_name",
    recvNameField: "sender_name",
  },
  "선물받는분 알림": {
    dashboardName: getSnapshotTemplateName("선물받는분 알림"),
    formFieldOrder: ["receiver_name", "sender_name", "phone", "tracking_number"],
    listNameField: "receiver_name",
    recvNameField: "receiver_name",
  },
};

export interface TemplateUiField {
  key: TemplateFieldKey;
  label: string;
}

/** remote templtContent 기준으로 파생되는 런타임 schema */
export interface ResolvedTemplateSchema {
  templateType: AligoTemplateType;
  templtName: string;
  templtCode: string;
  placeholders: string[];
  messageFields: TemplateFieldKey[];
  dataRequiredFields: TemplateFieldKey[];
  uiFields: TemplateFieldKey[];
  listNameField: TemplateFieldKey;
  recvNameField: TemplateFieldKey;
}

export interface OrderTemplateData {
  phone: string;
  customer_name: string;
  sender_name?: string | null;
  receiver_name?: string | null;
  tracking_number: string;
}

export type TemplateFieldValues = Record<TemplateFieldKey, string>;

/** Aligo templtCode — UI templateType ↔ 코드 (발송·조회 유일 기준) */
export const ALIGO_TEMPLATE_CODES: Record<AligoTemplateType, string> = {
  택배발송알림: "UF_9460",
  "선물보내는분 알림": "UI_9236",
  "선물받는분 알림": "UG_8203",
};

export const ALLOWED_ALIGO_TEMPLATE_CODES = Object.values(
  ALIGO_TEMPLATE_CODES
) as [string, ...string[]];

/**
 * UI templateType → Aligo templtCode (env ALIGO_TPL_CODE_* 로만 오버라이드)
 */
export function getTemplateCode(templateType: AligoTemplateType): string {
  const envOverride = getTemplateCodeOverride(templateType);
  if (envOverride) return envOverride;
  return ALIGO_TEMPLATE_CODES[templateType];
}

/**
 * Aligo 대시board 등록명 — dashboard-snapshot.json 기준, env로만 오버라이드
 */
export function getDashboardTemplateName(
  templateType: AligoTemplateType
): string {
  const envKey = `ALIGO_TEMPLATE_NAME_${templateType.replace(/\s/g, "_")}`;
  const fromEnv = process.env[envKey];
  if (fromEnv) return fromEnv;

  return getSnapshotTemplateName(templateType);
}

export function getTemplateCodeOverride(
  templateType: AligoTemplateType
): string | undefined {
  const envKey = `ALIGO_TPL_CODE_${templateType.replace(/\s/g, "_")}`;
  return process.env[envKey];
}

export function getTemplateRegistry(
  templateType: AligoTemplateType
): TemplateRegistryEntry {
  return ALIGO_TEMPLATE_REGISTRY[templateType];
}

export function placeholderToFieldKey(
  placeholder: string
): TemplateFieldKey | null {
  return ALIGO_PLACEHOLDER_TO_FIELD[placeholder] ?? null;
}

export function placeholdersToFieldKeys(
  placeholders: string[]
): TemplateFieldKey[] {
  const keys: TemplateFieldKey[] = [];
  for (const ph of placeholders) {
    const key = placeholderToFieldKey(ph);
    if (key && !keys.includes(key)) {
      keys.push(key);
    }
  }
  return keys;
}

export function createEmptyFieldValues(): TemplateFieldValues {
  return {
    phone: "",
    customer_name: "",
    sender_name: "",
    receiver_name: "",
    tracking_number: "",
  };
}

function toUiField(key: TemplateFieldKey): TemplateUiField {
  return { key, label: TEMPLATE_FIELD_LABELS[key] };
}

export function getCommonUiFields(): TemplateUiField[] {
  return COMMON_UI_FIELD_KEYS.map(toUiField);
}

export function getTemplateUiFields(
  templateType: AligoTemplateType
): TemplateUiField[] {
  return getTemplateRegistry(templateType).formFieldOrder
    .filter((key) => key !== "phone")
    .map(toUiField);
}

export function getAllFormFields(
  templateType: AligoTemplateType
): TemplateUiField[] {
  return getTemplateRegistry(templateType).formFieldOrder.map(toUiField);
}

export function orderToFieldValues(
  order: Partial<OrderTemplateData>
): TemplateFieldValues {
  return {
    phone: order.phone ?? "",
    customer_name: order.customer_name ?? "",
    sender_name: order.sender_name ?? "",
    receiver_name: order.receiver_name ?? "",
    tracking_number: order.tracking_number ?? "",
  };
}

export function fieldValuesToOrderData(
  values: TemplateFieldValues
): OrderTemplateData {
  return {
    phone: values.phone.trim(),
    customer_name: values.customer_name.trim(),
    sender_name: values.sender_name.trim() || null,
    receiver_name: values.receiver_name.trim() || null,
    tracking_number: values.tracking_number.trim(),
  };
}

export function mapOrderToTemplateValues(
  data: OrderTemplateData
): TemplateFieldValues {
  const tracking = data.tracking_number?.trim();

  return {
    phone: data.phone,
    customer_name: data.customer_name?.trim() ?? "",
    sender_name: data.sender_name?.trim() ?? "",
    receiver_name: data.receiver_name?.trim() ?? "",
    tracking_number: tracking || "미등록",
  };
}

function isFieldEmpty(key: TemplateFieldKey, data: OrderTemplateData): boolean {
  if (key === "tracking_number") {
    return !data.tracking_number?.trim();
  }
  const raw = data[key];
  return typeof raw !== "string" || raw.trim() === "";
}

export function getMissingTemplateFields(
  schema: ResolvedTemplateSchema,
  data: OrderTemplateData
): TemplateFieldKey[] {
  return schema.dataRequiredFields.filter((key) => isFieldEmpty(key, data));
}

export interface TemplateValidationResult {
  valid: boolean;
  missing: TemplateFieldKey[];
  message: string;
}

export function validateTemplateFields(
  schema: ResolvedTemplateSchema,
  data: OrderTemplateData
): TemplateValidationResult {
  const missing = getMissingTemplateFields(schema, data);

  if (missing.length === 0) {
    return { valid: true, missing: [], message: "" };
  }

  const labels = missing.map((key) => TEMPLATE_FIELD_LABELS[key]).join(", ");
  return {
    valid: false,
    missing,
    message: `[${schema.templtCode}] 필수 변수 누락: ${labels}`,
  };
}

export function resolveListCustomerName(
  schema: ResolvedTemplateSchema,
  data: OrderTemplateData
): string {
  const values = mapOrderToTemplateValues(data);
  return values[schema.listNameField] || data.customer_name || "";
}

export function resolveRecvName(
  schema: ResolvedTemplateSchema,
  data: OrderTemplateData
): string {
  const values = mapOrderToTemplateValues(data);
  return values[schema.recvNameField] || "고객";
}

/** UI/저장용 — remote 없이 registry 기준 */
export function resolveListCustomerNameByType(
  templateType: AligoTemplateType,
  data: OrderTemplateData
): string {
  const registry = getTemplateRegistry(templateType);
  const values = mapOrderToTemplateValues(data);
  return values[registry.listNameField] || data.customer_name || "";
}

/** @deprecated getTemplateRegistry 사용 */
export function getTemplateSchema(templateType: AligoTemplateType) {
  return getTemplateRegistry(templateType);
}
