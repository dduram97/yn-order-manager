import {
  sendOrderNotification,
  type SendOrderNotificationInput,
  type SendOrderNotificationResult,
} from "@/lib/aligo/send";

export type { SendOrderNotificationInput, SendOrderNotificationResult };

/** Aligo 알림톡 발송 (payload 구조 변경 없음 — lib/aligo/send 위임) */
export async function sendAligoNotificationForOrder(
  input: SendOrderNotificationInput
): Promise<SendOrderNotificationResult> {
  return sendOrderNotification(input);
}
