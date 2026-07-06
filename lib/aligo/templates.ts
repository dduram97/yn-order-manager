import {
  ALIGO_TEMPLATE_OPTIONS,
  DEFAULT_ALIGO_TEMPLATE_TYPE,
  type AligoTemplateType,
} from "@/lib/constants/aligo";
import type { OrderTemplateData } from "./template-schema";
import {
  buildApprovedAligoSendContent,
  finalizeApprovedMessage,
} from "./template-send-extras";
import type { AligoRemoteTemplate } from "./template-sync";
import { normalizeTemplateContent } from "./template-sync";

export type { OrderTemplateData };

export interface ResolvedAligoMessage {
  subject: string;
  message: string;
  templtCode: string;
  button?: string;
  emtitle?: string;
  source: "remote";
}

export const LOCAL_TEMPLATE_FALLBACKS: Record<AligoTemplateType, string> = {
  택배발송알림: "",
  "선물보내는분 알림": "",
  "선물받는분 알림": "",
};

export function isAligoTemplateType(value: string): value is AligoTemplateType {
  return (ALIGO_TEMPLATE_OPTIONS as readonly string[]).includes(value);
}

export function applyTemplateVariables(
  messageTemplate: string,
  data: OrderTemplateData
): string {
  return finalizeApprovedMessage(messageTemplate, data);
}

export function resolveTemplateMessage(
  templateType: AligoTemplateType,
  remote: AligoRemoteTemplate,
  data: OrderTemplateData
): ResolvedAligoMessage {
  const localFallback = LOCAL_TEMPLATE_FALLBACKS[templateType];
  const remoteNormalized = normalizeTemplateContent(remote.templtContent);
  const localNormalized = normalizeTemplateContent(localFallback);

  if (localNormalized && localNormalized !== remoteNormalized) {
    console.warn(
      `[Aligo] templtCode '${remote.templtCode}' 로컬 fallback과 대시보드 템플릿 불일치 → API 본문 사용`
    );
  }

  const approved = buildApprovedAligoSendContent(remote, data);

  return {
    subject: approved.subject,
    message: approved.message,
    button: approved.button,
    emtitle: approved.emtitle,
    templtCode: remote.templtCode,
    source: "remote",
  };
}

export function getDefaultTemplateType(): AligoTemplateType {
  return DEFAULT_ALIGO_TEMPLATE_TYPE;
}
