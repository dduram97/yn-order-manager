import type { AligoSendPayload } from "@/lib/aligo/aligo-send";
import type { AligoResponseLog } from "@/types/aligo-audit";

export function buildAligoRequestPayloadSnapshot(
  payload: AligoSendPayload
): Record<string, unknown> {
  return {
    templtCode: payload.templtCode,
    templateType: payload.templateType,
    receiver: payload.receiver,
    recvname: payload.recvname,
    subject: payload.subject,
    message: payload.message,
    button: payload.button,
    emtitle: payload.emtitle,
    testMode: payload.testMode ?? false,
  };
}

export function buildAligoAuditLog(
  partial: Omit<AligoResponseLog, "recordedAt">
): AligoResponseLog {
  return {
    ...partial,
    recordedAt: new Date().toISOString(),
  };
}
