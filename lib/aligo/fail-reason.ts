export const ALIGO_FAIL_REASONS = [
  "KAKAO_NOT_REGISTERED",
  "INSUFFICIENT_BALANCE",
  "TEMPLATE_VARIABLE_ERROR",
  "NETWORK_ERROR",
  "UNKNOWN_ERROR",
] as const;

export type AligoFailReason = (typeof ALIGO_FAIL_REASONS)[number];

export interface ClassifyAligoFailureInput {
  message: string;
  aligoCode?: number;
  /** validation 단계 실패 여부 */
  isValidationError?: boolean;
  /** fetch/예외 단계 */
  isNetworkError?: boolean;
}

const KAKAO_KEYWORDS = [
  "카카오",
  "kakao",
  "미가입",
  "미사용",
  "수신불가",
  "수신 불가",
  "차단",
  "알림톡 수신",
  "톡 수신",
];

const BALANCE_KEYWORDS = [
  "잔액",
  "충전",
  "포인트",
  "부족",
  "balance",
  "머니",
  "캐시",
];

const TEMPLATE_KEYWORDS = [
  "치환",
  "변수",
  "템플릿",
  "필수",
  "누락",
  "placeholder",
  "tpl",
  "template",
];

const NETWORK_KEYWORDS = [
  "network",
  "timeout",
  "timed out",
  "econnrefused",
  "fetch failed",
  "ip",
  "연결",
  "네트워크",
  "socket",
];

export function classifyAligoFailure(
  input: ClassifyAligoFailureInput
): AligoFailReason {
  const message = (input.message ?? "").toLowerCase();

  if (input.isValidationError) {
    return "TEMPLATE_VARIABLE_ERROR";
  }

  if (
    input.isNetworkError ||
    input.aligoCode === -99 ||
    NETWORK_KEYWORDS.some((kw) => message.includes(kw.toLowerCase()))
  ) {
    return "NETWORK_ERROR";
  }

  if (KAKAO_KEYWORDS.some((kw) => message.includes(kw.toLowerCase()))) {
    return "KAKAO_NOT_REGISTERED";
  }

  if (BALANCE_KEYWORDS.some((kw) => message.includes(kw.toLowerCase()))) {
    return "INSUFFICIENT_BALANCE";
  }

  if (TEMPLATE_KEYWORDS.some((kw) => message.includes(kw.toLowerCase()))) {
    return "TEMPLATE_VARIABLE_ERROR";
  }

  return "UNKNOWN_ERROR";
}

export function isAligoFailReason(value: string): value is AligoFailReason {
  return (ALIGO_FAIL_REASONS as readonly string[]).includes(value);
}
