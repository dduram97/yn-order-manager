export const TRACKING_NUMBER_LENGTH = 12;

/** 숫자만 허용, 최대 12자리 */
export function sanitizeTrackingNumberInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, TRACKING_NUMBER_LENGTH);
}

/** 발송 알림 전 운송장번호 검증. 유효하면 null, 실패 시 오류 메시지 반환 */
export function validateTrackingNumber(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return "운송장번호가 입력되지 않았습니다.";
  }

  if (!/^\d+$/.test(trimmed)) {
    return "운송장번호는 숫자만 입력해주세요.";
  }

  if (trimmed.length !== TRACKING_NUMBER_LENGTH) {
    return "운송장번호는 12자리입니다. 입력한 번호를 확인해주세요.";
  }

  return null;
}
