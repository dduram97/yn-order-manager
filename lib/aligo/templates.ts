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
  택배발송알림: "안녕하세요, #{고객명} 고객님! \n포항 영남수산｜오름과메기 입니다.\n\n주문 하신 상품이 발송되었습니다.\n\n택배사: CJ 대한통운  \n송장번호: #{송장번호}\n\n감사합니다.",
  "선물보내는분 알림": "안녕하세요, #{보내는이} 고객님! \n포항 영남수산｜오름과메기 입니다.\n\n#{받는이}님께 보내는 상품이 발송되었습니다.\n\n※ 해당 택배 발송 메시지는 받는 분께도 발송됩니다. (씨익)\n\n택배사: CJ 대한통운  \n송장번호: #{송장번호}\n\n감사합니다.",
  "선물받는분 알림": "안녕하세요, #{받는이} 고객님! \n포항 영남수산｜오름과메기 입니다.\n\n#{보내는이}님이 보내는 상품이 발송되었습니다.\n\n택배사: CJ 대한통운  \n송장번호: #{송장번호}\n\n감사합니다.",
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
