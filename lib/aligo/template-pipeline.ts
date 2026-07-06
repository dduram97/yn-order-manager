import { DEFAULT_ALIGO_TEMPLATE_TYPE } from "@/lib/constants/aligo";
import type { AligoTemplateType } from "@/lib/constants/aligo";
import { isAligoTemplateType } from "./templates";
import {
  mapOrderToTemplateValues,
  resolveListCustomerName,
  resolveRecvName,
  type OrderTemplateData,
  type ResolvedTemplateSchema,
  type TemplateFieldValues,
  type TemplateValidationResult,
} from "./template-schema";
import type { ResolvedAligoMessage } from "./templates";
import { resolveTemplateMessage } from "./templates";
import type { AligoRemoteTemplate } from "./template-sync";
import {
  preflightValidateRemoteTemplate,
  resolveSchemaFromRemote,
  validateFinalMessage,
  type MessageValidationResult,
  type PreflightValidationResult,
} from "./template-validator";

export function resolveTemplateType(value?: string): AligoTemplateType {
  return isAligoTemplateType(value ?? "")
    ? (value as AligoTemplateType)
    : DEFAULT_ALIGO_TEMPLATE_TYPE;
}

function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}

export function normalizeOrderTemplateData(
  input: OrderTemplateData
): OrderTemplateData {
  return {
    ...input,
    phone: normalizePhone(input.phone),
  };
}

export interface PreparedAligoMessage {
  templateType: AligoTemplateType;
  schema: ResolvedTemplateSchema;
  templateData: OrderTemplateData;
  originalTemplate: string;
  remoteTemplate: AligoRemoteTemplate;
  validation: TemplateValidationResult;
  preflight: PreflightValidationResult;
  messageValidation: MessageValidationResult;
  resolved?: ResolvedAligoMessage;
}

/**
 * remote → schema 파생 → 메시지 치환 → 치환 실패 시에만 차단
 */
export function prepareAligoMessage(
  templateType: AligoTemplateType,
  remoteTemplate: AligoRemoteTemplate,
  rawData: OrderTemplateData
): PreparedAligoMessage {
  const templateData = normalizeOrderTemplateData(rawData);
  const schema = resolveSchemaFromRemote(templateType, remoteTemplate);
  const preflight = preflightValidateRemoteTemplate(
    schema,
    remoteTemplate.templtContent
  );

  const resolved = resolveTemplateMessage(
    templateType,
    remoteTemplate,
    templateData
  );

  const messageValidation = validateFinalMessage(
    remoteTemplate.templtContent,
    resolved.message,
    schema,
    templateData
  );

  const mappedSubstitutions = mapOrderToTemplateValues(templateData);
  const mismatchReport = analyzeTemplateMismatch({
    context: "Next.js:prepare",
    templtCode: remoteTemplate.templtCode,
    originalTemplate: remoteTemplate.templtContent,
    apiFreshTempltContent: remoteTemplate.templtContent,
    apiTemplate: remoteTemplate,
    finalMessage: resolved.message,
    sentButton: resolved.button,
    sentEmtitle: resolved.emtitle,
    sentSubject: resolved.subject,
    variables: {
      customer_name: templateData.customer_name,
      phone: templateData.phone,
      sender_name: templateData.sender_name ?? null,
      receiver_name: templateData.receiver_name ?? null,
      tracking_number: templateData.tracking_number ?? null,
    },
    mappedSubstitutions,
    requiredPlaceholders: schema.placeholders,
  });
  logTemplateMismatchDebug("Next.js:prepare", mismatchReport);

  const validation: TemplateValidationResult = messageValidation.valid
    ? { valid: true, missing: [], message: "" }
    : { valid: false, missing: [], message: messageValidation.message };

  return {
    templateType,
    schema,
    templateData,
    originalTemplate: remoteTemplate.templtContent,
    remoteTemplate,
    preflight,
    messageValidation,
    validation,
    resolved: messageValidation.valid ? resolved : undefined,
  };
}

export function getAligoRecvName(
  schema: ResolvedTemplateSchema,
  data: OrderTemplateData
): string {
  return resolveRecvName(schema, normalizeOrderTemplateData(data));
}

import type { AligoSendPayload } from "@/lib/aligo/aligo-send";
import {
  analyzeTemplateMismatch,
  logTemplateMismatchDebug,
} from "./template-mismatch-debug.js";

export type { AligoSendPayload };
export function buildAligoSendPayload(
  prepared: PreparedAligoMessage,
  options: { senderPhone: string; testMode: boolean }
): AligoSendPayload {
  if (!prepared.resolved) {
    throw new Error("발송 메시지가 준비되지 않았습니다.");
  }

  const { subject, message, templtCode, button, emtitle } = prepared.resolved;
  const templateData = prepared.templateData;

  return {
    templateType: prepared.templateType,
    templtCode,
    sender: options.senderPhone.replace(/[\s-]/g, ""),
    receiver: templateData.phone,
    recvname: getAligoRecvName(prepared.schema, templateData),
    subject,
    message,
    button,
    emtitle,
    testMode: options.testMode,
    variables: {
      customer_name: templateData.customer_name,
      phone: templateData.phone,
      sender_name: templateData.sender_name ?? null,
      receiver_name: templateData.receiver_name ?? null,
      tracking_number: templateData.tracking_number ?? null,
    },
    debug: {
      originalTemplate: prepared.originalTemplate,
      requiredPlaceholders: prepared.schema.placeholders,
      mappedSubstitutions: mapOrderToTemplateValues(templateData),
      apiTemplate: {
        templtCode: prepared.remoteTemplate.templtCode,
        templtContent: prepared.remoteTemplate.templtContent,
        templtTitle: prepared.remoteTemplate.templtTitle,
        templateEmType: prepared.remoteTemplate.templateEmType,
        buttons: prepared.remoteTemplate.buttons ?? [],
      },
      expectedButton: button,
      expectedEmtitle: emtitle,
    },
  };
}

/** @deprecated buildAligoSendPayload 사용 */
export const buildAligoProxySendPayload = buildAligoSendPayload;

export function getListCustomerName(
  schema: ResolvedTemplateSchema,
  data: OrderTemplateData
): string {
  return resolveListCustomerName(schema, normalizeOrderTemplateData(data));
}

export function getMappedVariablePreview(
  schema: ResolvedTemplateSchema,
  data: OrderTemplateData
): TemplateFieldValues {
  void schema;
  return mapOrderToTemplateValues(normalizeOrderTemplateData(data));
}
