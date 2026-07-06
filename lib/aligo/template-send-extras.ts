import type { OrderTemplateData } from "./template-schema";
import {
  ALIGO_VARIABLE_MAP,
  mapOrderToTemplateValues,
  TEMPLATE_FIELD_KEYS,
} from "./template-schema";
import type { AligoRemoteTemplate, AligoTemplateButton } from "./template-sync";
import { toAligoLineEndings } from "./template-sync";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 승인 템플릿 원문에서 #{...} 플레이스홀더만 치환 (그 외 문자·공백·줄바꿈 구조 유지)
 */
export function substituteApprovedPlaceholders(
  rawText: string,
  data: OrderTemplateData
): string {
  const values = mapOrderToTemplateValues(data);
  let result = rawText;
  for (const key of TEMPLATE_FIELD_KEYS) {
    const placeholder = ALIGO_VARIABLE_MAP[key];
    result = result.replace(
      new RegExp(escapeRegExp(placeholder), "g"),
      values[key]
    );
  }
  return result;
}

/** message_1 — 치환 후 Aligo CRLF 형식으로 통일 */
export function finalizeApprovedMessage(
  rawTempltContent: string,
  data: OrderTemplateData
): string {
  const substituted = substituteApprovedPlaceholders(rawTempltContent, data);
  return toAligoLineEndings(substituted);
}

const BUTTON_STRING_KEYS = [
  "ordering",
  "name",
  "linkType",
  "linkTypeName",
  "linkMo",
  "linkPc",
  "linkIos",
  "linkAnd",
] as const;

/** 승인 buttons 배열 — ordering 순, #{...}만 치환, AC/WL/DS 등 필드 구조 유지 */
export function cloneApprovedButtons(
  buttons: AligoTemplateButton[],
  data: OrderTemplateData
): AligoTemplateButton[] {
  return [...buttons]
    .sort((a, b) => Number(a.ordering) - Number(b.ordering))
    .map((btn) => {
      const cloned = { ...btn };
      for (const key of BUTTON_STRING_KEYS) {
        const val = cloned[key];
        if (typeof val === "string" && val.includes("#{")) {
          cloned[key] = substituteApprovedPlaceholders(val, data);
        }
      }
      return cloned;
    });
}

/** Aligo send API button_1 — 승인 템플릿 buttons 그대로 JSON */
export function buildAligoButtonField(
  buttons: AligoTemplateButton[] | undefined
): string | undefined {
  if (!buttons || buttons.length === 0) return undefined;
  return JSON.stringify({ button: buttons });
}

/** 강조표기형(TEXT) → emtitle_1 (templtTitle 원문 + #{...} 치환만) */
export function buildAligoEmTitle(
  remote: AligoRemoteTemplate,
  data: OrderTemplateData
): string | undefined {
  const emType = remote.templateEmType?.toUpperCase();
  if (emType !== "TEXT" || !remote.templtTitle) {
    return undefined;
  }
  return substituteApprovedPlaceholders(remote.templtTitle, data);
}

export interface ApprovedAligoSendContent {
  message: string;
  subject: string;
  button?: string;
  emtitle?: string;
  templateButtons: AligoTemplateButton[];
}

/**
 * /akv10/template/list/ 승인 템플릿 원본 기준 send 필드 구성
 * templtContent · buttons · templtTitle(templtName) 을 API 응답 그대로 사용
 */
export function buildApprovedAligoSendContent(
  remote: AligoRemoteTemplate,
  data: OrderTemplateData
): ApprovedAligoSendContent {
  const message = finalizeApprovedMessage(remote.templtContent, data);
  const subject = substituteApprovedPlaceholders(remote.templtName, data);
  const templateButtons = cloneApprovedButtons(remote.buttons ?? [], data);
  const button = buildAligoButtonField(templateButtons);
  const emtitle = buildAligoEmTitle(remote, data);

  return {
    message,
    subject,
    button,
    emtitle,
    templateButtons,
  };
}

export interface AligoSendExtras {
  button?: string;
  emtitle?: string;
  templateEmType?: string;
  templateButtons: AligoTemplateButton[];
}

/** @deprecated buildApprovedAligoSendContent 사용 */
export function resolveAligoSendExtras(
  remote: AligoRemoteTemplate,
  data: OrderTemplateData
): AligoSendExtras {
  const content = buildApprovedAligoSendContent(remote, data);
  return {
    button: content.button,
    emtitle: content.emtitle,
    templateEmType: remote.templateEmType,
    templateButtons: content.templateButtons,
  };
}
