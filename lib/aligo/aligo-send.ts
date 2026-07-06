import type { AligoApiResponse } from "@/lib/aligo/client";
import { checkVpsHealth, sendViaVps } from "./vps-client";

export interface AligoSendPayload {
  templateType: string;
  templtCode: string;
  sender: string;
  receiver: string;
  recvname: string;
  subject: string;
  message: string;
  button?: string;
  emtitle?: string;
  testMode?: boolean;
  variables?: Record<string, string | null | undefined>;
  debug?: {
    originalTemplate: string;
    requiredPlaceholders: string[];
    mappedSubstitutions: Record<string, string>;
    apiTemplate?: {
      templtCode: string;
      templtContent: string;
      templtTitle?: string;
      templateEmType?: string;
      buttons?: unknown[];
    };
    expectedButton?: string;
    expectedEmtitle?: string;
  };
}

/** @deprecated AligoSendPayload 사용 */
export type AligoProxySendPayload = AligoSendPayload;

/** Vercel → VPS → Aligo 발송 */
export async function sendAligoMessage(
  payload: AligoSendPayload
): Promise<AligoApiResponse> {
  return sendViaVps(payload);
}

/** env-check — VPS health */
export async function checkAligoApiReachable(): Promise<boolean> {
  return checkVpsHealth();
}
