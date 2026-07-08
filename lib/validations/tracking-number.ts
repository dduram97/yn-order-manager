export const TRACKING_NUMBER_LENGTH = 12;

/** 숫자만 허용, 최대 12자리 */
export function sanitizeTrackingNumberInput(value: string): string {
  return extractTrackingNumberDigits(value);
}

/** 하이픈 제외 숫자만 추출 */
export function extractTrackingNumberDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, TRACKING_NUMBER_LENGTH);
}

/** 12자리 숫자를 ####-####-#### 형식으로 표시 */
export function formatTrackingNumber(value: string): string {
  const digits = extractTrackingNumberDigits(value);
  if (digits.length !== TRACKING_NUMBER_LENGTH) {
    return digits;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
}

/** DB 저장용 운송장번호 정규화 (####-####-####) */
export function normalizeTrackingNumberForStorage(value: string): string {
  return formatTrackingNumber(value);
}

/** 발송 알림 전 운송장번호 검증. 유효하면 null, 실패 시 오류 메시지 반환 */
export function validateTrackingNumber(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return "운송장번호가 입력되지 않았습니다.";
  }

  const digits = extractTrackingNumberDigits(trimmed);

  if (digits.length !== TRACKING_NUMBER_LENGTH) {
    return "운송장번호는 12자리입니다. 입력한 번호를 확인해주세요.";
  }

  return null;
}
