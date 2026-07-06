export type AligoFailKind = "PROXY_DOWN" | "NETWORK" | "ALIGO_API";

export interface AligoPayloadSummary {
  templtCode?: string;
  messageLength: number;
  buttonCount: number;
}

export function summarizeAligoPayload(payload: {
  templtCode?: string;
  message?: string;
  button?: string;
}): AligoPayloadSummary {
  let buttonCount = 0;
  if (payload.button) {
    try {
      const parsed = JSON.parse(payload.button) as { button?: unknown[] };
      buttonCount = Array.isArray(parsed?.button) ? parsed.button.length : 0;
    } catch {
      buttonCount = -1;
    }
  }
  return {
    templtCode: payload.templtCode,
    messageLength: String(payload.message ?? "").length,
    buttonCount,
  };
}

export function logAligoFail(input: {
  failure_kind: AligoFailKind;
  reason: string;
  retry_count: number;
  endpoint: string;
  payload?: Partial<AligoPayloadSummary>;
}): void {
  const p = input.payload ?? { messageLength: 0, buttonCount: 0 };
  console.error("[ALIGO:FAIL]");
  console.error(`- failure_kind: ${input.failure_kind}`);
  console.error(`- reason: ${input.reason}`);
  console.error(`- retry_count: ${input.retry_count}`);
  console.error(`- endpoint: ${input.endpoint}`);
  console.error(
    `- payload summary: message_1 length=${p.messageLength}, button count=${p.buttonCount}${p.templtCode ? `, tpl_code=${p.templtCode}` : ""}`
  );
}

export function logAligoProxy(input: {
  direction: "request" | "response";
  endpoint: string;
  http_status?: number | null;
  aligo_code?: number | null;
  aligo_message?: string | null;
  detail?: string;
}): void {
  console.log("[ALIGO:PROXY]");
  console.log(`- direction: ${input.direction}`);
  console.log(`- endpoint: ${input.endpoint}`);
  if (input.http_status != null) console.log(`- http_status: ${input.http_status}`);
  if (input.aligo_code != null) console.log(`- aligo_code: ${input.aligo_code}`);
  if (input.aligo_message != null) {
    console.log(`- aligo_message: ${input.aligo_message}`);
  }
  if (input.detail) console.log(`- detail: ${input.detail}`);
}

export function logAligoFinal(input: {
  success: boolean;
  endpoint: string;
  reason?: string;
  aligo_code?: number | null;
  retry_count?: number;
}): void {
  console.log("[ALIGO:FINAL]");
  console.log(`- success: ${input.success}`);
  console.log(`- endpoint: ${input.endpoint}`);
  if (input.reason) console.log(`- reason: ${input.reason}`);
  if (input.aligo_code != null) console.log(`- aligo_code: ${input.aligo_code}`);
  if (input.retry_count != null) console.log(`- retry_count: ${input.retry_count}`);
}

export function mapTransportToFailKind(kind: string | undefined): AligoFailKind {
  if (kind === "CONNECTION_REFUSED" || kind === "PROXY_DOWN") return "PROXY_DOWN";
  if (kind === "HTTP_4XX" || kind === "ALIGO_API") return "ALIGO_API";
  return "NETWORK";
}
