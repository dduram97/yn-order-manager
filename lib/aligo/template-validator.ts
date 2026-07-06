import type { AligoTemplateType } from "@/lib/constants/aligo";
import { ALIGO_TEMPLATE_OPTIONS } from "@/lib/constants/aligo";
import {
  ALIGO_PLACEHOLDER_TO_FIELD,
  ALIGO_VARIABLE_MAP,
  getTemplateCode,
  getTemplateRegistry,
  mapOrderToTemplateValues,
  placeholdersToFieldKeys,
  TEMPLATE_FIELD_LABELS,
  type OrderTemplateData,
  type ResolvedTemplateSchema,
  type TemplateFieldKey,
} from "./template-schema";
import {
  findRemoteTemplate,
  normalizeTemplateContent,
  type AligoRemoteTemplate,
} from "./template-sync";
import { finalizeApprovedMessage } from "./template-send-extras";

const PLACEHOLDER_PATTERN = /#\{[^}]+\}/g;

/** 운영 가능 여부 검증용 샘플 데이터 */
export const SAMPLE_ORDER_DATA: OrderTemplateData = {
  phone: "01000000000",
  customer_name: "검증용",
  sender_name: "검증용",
  receiver_name: "검증용",
  tracking_number: "0000000000",
};

export interface PreflightValidationResult {
  /** preflight는 발송을 막지 않음 — 항상 true */
  valid: boolean;
  errors: string[];
  warnings: string[];
  foundPlaceholders: string[];
  mappedFields: TemplateFieldKey[];
  unknownPlaceholders: string[];
}

export interface MessageValidationResult {
  valid: boolean;
  message: string;
  remainingPlaceholders?: string[];
  emptySubstitutions?: string[];
}

export interface SchemaSyncItem {
  templateType: AligoTemplateType;
  matched: boolean;
  operational: boolean;
  templtCode?: string;
  templtName?: string;
  expectedDashboardName: string;
  nameMatch: boolean;
  preflight: PreflightValidationResult;
  substitutionCheck: MessageValidationResult;
  resolvedSchema?: ResolvedTemplateSchema;
}

export function extractPlaceholders(content: string): string[] {
  const normalized = normalizeTemplateContent(content);
  const matches = normalized.match(PLACEHOLDER_PATTERN) ?? [];
  return [...new Set(matches)];
}

/**
 * remote templtContent → 런타임 schema (single source of truth)
 */
export function resolveSchemaFromRemote(
  templateType: AligoTemplateType,
  remote: AligoRemoteTemplate
): ResolvedTemplateSchema {
  const registry = getTemplateRegistry(templateType);
  const placeholders = extractPlaceholders(remote.templtContent);
  const messageFields = placeholdersToFieldKeys(placeholders);

  const dataRequiredFields = [
    ...new Set<TemplateFieldKey>(["phone", ...messageFields]),
  ];

  return {
    templateType,
    templtName: remote.templtName,
    templtCode: remote.templtCode,
    placeholders,
    messageFields,
    dataRequiredFields,
    uiFields: registry.formFieldOrder.filter((k) => k !== "phone"),
    listNameField: registry.listNameField,
    recvNameField: registry.recvNameField,
  };
}

/**
 * preflight — 정보 수집·경고만 (발송 차단 없음)
 */
export function preflightValidateRemoteTemplate(
  schema: ResolvedTemplateSchema,
  templtContent: string
): PreflightValidationResult {
  const foundPlaceholders = extractPlaceholders(templtContent);
  const expectedCode = getTemplateCode(schema.templateType);

  const unknownPlaceholders = foundPlaceholders.filter(
    (ph) => !ALIGO_PLACEHOLDER_TO_FIELD[ph]
  );

  const mappedFields = placeholdersToFieldKeys(foundPlaceholders);
  const warnings: string[] = [];

  if (schema.templtCode !== expectedCode) {
    warnings.push(
      `templtCode 불일치: expected '${expectedCode}', actual '${schema.templtCode}'`
    );
  }

  if (unknownPlaceholders.length > 0) {
    warnings.push(
      `매핑 불가 변수(오타 가능): ${unknownPlaceholders.join(", ")}`
    );
  }

  if (foundPlaceholders.length === 0) {
    warnings.push("템플릿 본문에 #{변수}가 없습니다.");
  }

  return {
    valid: true,
    errors: [],
    warnings,
    foundPlaceholders,
    mappedFields,
    unknownPlaceholders,
  };
}

/**
 * 발송 차단 조건 — 치환 실패만 검사
 */
export function validateFinalMessage(
  originalTemplate: string,
  substitutedMessage: string,
  schema: ResolvedTemplateSchema,
  data: OrderTemplateData
): MessageValidationResult {
  const remainingPlaceholders = extractPlaceholders(substitutedMessage);

  if (remainingPlaceholders.length > 0) {
    return {
      valid: false,
      message: `치환되지 않은 변수: ${remainingPlaceholders.join(", ")}`,
      remainingPlaceholders,
    };
  }

  if (!substitutedMessage.trim()) {
    return { valid: false, message: "최종 메시지가 비어 있습니다." };
  }

  const emptySubstitutions: string[] = [];
  const normalizedTemplate = normalizeTemplateContent(originalTemplate);

  for (const key of schema.messageFields) {
    const placeholder = ALIGO_VARIABLE_MAP[key];

    if (placeholder && !normalizedTemplate.includes(placeholder)) {
      continue;
    }

    if (isEmptySubstitution(key, data)) {
      emptySubstitutions.push(TEMPLATE_FIELD_LABELS[key]);
    }
  }

  if (emptySubstitutions.length > 0) {
    return {
      valid: false,
      message: `빈 값 치환: ${emptySubstitutions.join(", ")}`,
      emptySubstitutions,
    };
  }

  const values = mapOrderToTemplateValues(data);
  if (Object.values(values).some((v) => v === "undefined" || v === "null")) {
    return {
      valid: false,
      message: "undefined/null 문자열이 변수에 포함되어 있습니다.",
    };
  }

  return { valid: true, message: "" };
}

function isEmptySubstitution(
  key: TemplateFieldKey,
  data: OrderTemplateData
): boolean {
  if (key === "tracking_number") {
    return !data.tracking_number?.trim();
  }
  const raw = data[key];
  return typeof raw !== "string" || raw.trim() === "";
}

function checkSubstitutionOperational(
  remote: AligoRemoteTemplate,
  schema: ResolvedTemplateSchema
): MessageValidationResult {
  const substituted = finalizeApprovedMessage(
    remote.templtContent,
    SAMPLE_ORDER_DATA
  );

  return validateFinalMessage(
    remote.templtContent,
    substituted,
    schema,
    SAMPLE_ORDER_DATA
  );
}

export function verifyAllTemplatesAgainstSchema(
  remoteTemplates: AligoRemoteTemplate[]
): SchemaSyncItem[] {
  return ALIGO_TEMPLATE_OPTIONS.map((templateType) => {
    const expectedCode = getTemplateCode(templateType);
    const remote = findRemoteTemplate(remoteTemplates, templateType);

    if (!remote) {
      return {
        templateType,
        matched: false,
        operational: false,
        expectedDashboardName: expectedCode,
        nameMatch: false,
        preflight: {
          valid: true,
          errors: [],
          warnings: [
            `templtCode '${expectedCode}' 템플릿을 Aligo에서 찾지 못했습니다.`,
          ],
          foundPlaceholders: [],
          mappedFields: [],
          unknownPlaceholders: [],
        },
        substitutionCheck: {
          valid: false,
          message: "템플릿 미매칭",
        },
      };
    }

    const resolvedSchema = resolveSchemaFromRemote(templateType, remote);
    const nameMatch = remote.templtCode === expectedCode;
    const preflight = preflightValidateRemoteTemplate(
      resolvedSchema,
      remote.templtContent
    );
    const substitutionCheck = checkSubstitutionOperational(
      remote,
      resolvedSchema
    );

    return {
      templateType,
      matched: true,
      operational: substitutionCheck.valid,
      templtCode: remote.templtCode,
      templtName: remote.templtName,
      expectedDashboardName: expectedCode,
      nameMatch,
      preflight,
      substitutionCheck,
      resolvedSchema,
    };
  });
}
