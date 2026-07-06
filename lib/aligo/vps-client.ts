import axios, { isAxiosError } from "axios";
import type { AligoApiResponse } from "@/lib/aligo/client";
import type { AligoSendPayload } from "@/lib/aligo/aligo-send";
import {
  logAligoFail,
  logAligoFinal,
  mapTransportToFailKind,
  summarizeAligoPayload,
} from "./ops-log";
import {
  classifyHttpFailure,
  extractErrorMessage,
} from "./http-transport-debug.js";

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1_000;
const SEND_PATH = "/api/aligo/send";
const HEALTH_PATH = "/api/aligo/health";
const TEMPLATES_PATH = "/api/aligo/templates";

function getVpsHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret = process.env.ALIGO_VPS_SECRET?.trim();
  if (secret) headers["X-Aligo-Vps-Secret"] = secret;
  return headers;
}

export function getAligoApiUrl(): string {
  const url = process.env.ALIGO_API_URL?.trim();
  if (!url) {
    throw new Error("ALIGO_API_URL 환경 변수가 설정되지 않았습니다.");
  }
  return url.replace(/\/$/, "");
}

export function isAligoVpsConfigured(): boolean {
  return Boolean(process.env.ALIGO_API_URL?.trim());
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error: unknown): boolean {
  if (isAxiosError(error)) {
    const code = error.code ?? "";
    return (
      code === "ECONNREFUSED" ||
      code === "ETIMEDOUT" ||
      code === "ECONNABORTED"
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("ETIMEDOUT") ||
    message.includes("timeout") ||
    message.includes("ECONNABORTED") ||
    message.includes("ECONNREFUSED")
  );
}

export async function checkVpsHealth(): Promise<boolean> {
  try {
    const base = getAligoApiUrl();
    const res = await axios.get(`${base}${HEALTH_PATH}`, {
      timeout: 10_000,
      validateStatus: () => true,
    });
    return res.status === 200 && res.data?.success === true;
  } catch {
    return false;
  }
}

export interface VpsTemplatesResponse {
  success: boolean;
  message: string;
  templates: import("./template-sync").AligoRemoteTemplate[];
}

export async function fetchVpsTemplates(): Promise<VpsTemplatesResponse> {
  const base = getAligoApiUrl();
  const res = await axios.get<VpsTemplatesResponse>(`${base}${TEMPLATES_PATH}`, {
    headers: getVpsHeaders(),
    timeout: 15_000,
  });
  if (!res.data.success || !res.data.templates) {
    throw new Error(res.data.message || "VPS 템플릿 목록 조회 실패");
  }
  return res.data;
}

export async function postVpsSend(
  payload: AligoSendPayload,
  attempt: number
): Promise<AligoApiResponse> {
  const base = getAligoApiUrl();
  const url = `${base}${SEND_PATH}`;
  const response = await axios.post<AligoApiResponse>(url, payload, {
    headers: getVpsHeaders(),
    timeout: 25_000,
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    const err = new Error(
      response.data?.message ||
        `VPS HTTP ${response.status}: ${response.statusText || "error"}`
    ) as Error & { isAxiosError?: boolean; response?: typeof response };
    err.isAxiosError = true;
    err.response = response;
    throw err;
  }

  return response.data;
}

export async function sendViaVps(
  payload: AligoSendPayload
): Promise<AligoApiResponse> {
  const payloadSummary = summarizeAligoPayload(payload);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await postVpsSend(payload, attempt);
      logAligoFinal({
        success: true,
        endpoint: SEND_PATH,
        aligo_code: result.code ?? null,
        retry_count: attempt - 1,
      });
      return result;
    } catch (error) {
      lastError = error;

      if (isAxiosError(error) && error.response) {
        logAligoFail({
          failure_kind: "ALIGO_API",
          reason: extractErrorMessage(error),
          retry_count: attempt - 1,
          endpoint: SEND_PATH,
          payload: payloadSummary,
        });
        logAligoFinal({
          success: false,
          endpoint: SEND_PATH,
          reason: extractErrorMessage(error),
          aligo_code: error.response.data?.code ?? null,
          retry_count: attempt - 1,
        });
        throw error;
      }

      const canRetry =
        attempt < MAX_ATTEMPTS && isRetryableNetworkError(error);

      if (!canRetry) {
        logAligoFail({
          failure_kind: mapTransportToFailKind(classifyHttpFailure(error).kind),
          reason: extractErrorMessage(error),
          retry_count: attempt - 1,
          endpoint: SEND_PATH,
          payload: payloadSummary,
        });
        logAligoFinal({
          success: false,
          endpoint: SEND_PATH,
          reason: extractErrorMessage(error),
          retry_count: attempt - 1,
        });
        break;
      }

      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }

  const wrapped = new Error(extractErrorMessage(lastError));
  (wrapped as Error & { cause?: unknown }).cause = lastError;
  throw wrapped;
}
