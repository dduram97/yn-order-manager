import type { AligoStatus, AligoFailReason } from "@/types/database";

export const ALIGO_FAIL_REASON_LABEL: Record<AligoFailReason, string> = {
  KAKAO_NOT_REGISTERED: "수신 불가",
  INSUFFICIENT_BALANCE: "잔액 부족",
  TEMPLATE_VARIABLE_ERROR: "템플릿 오류",
  NETWORK_ERROR: "네트워크 오류",
  UNKNOWN_ERROR: "기타 오류",
};

export const ALIGO_TEMPLATE_OPTIONS = [
  "택배발송알림",
  "선물보내는분 알림",
  "선물받는분 알림",
] as const;

export type AligoTemplateType = (typeof ALIGO_TEMPLATE_OPTIONS)[number];

export const DEFAULT_ALIGO_TEMPLATE_TYPE: AligoTemplateType = "택배발송알림";

export const ALIGO_STATUS_LABEL: Record<AligoStatus, string> = {
  pending: "대기",
  success: "성공",
  failed: "실패",
};

export const ALIGO_STATUS_STYLE: Record<
  AligoStatus,
  { bg: string; text: string; dot: string }
> = {
  success: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  pending: {
    bg: "bg-zinc-100",
    text: "text-zinc-600",
    dot: "bg-zinc-400",
  },
  failed: {
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};
