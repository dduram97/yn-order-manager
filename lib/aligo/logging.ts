import { appendFile, mkdir } from "fs/promises";
import path from "path";
import type { OrderTemplateData } from "./template-schema";

export type AligoLogPhase =
  | "preflight_failed"
  | "validation_failed"
  | "message_failed"
  | "api_failed"
  | "api_partial_failure"
  | "exception"
  | "success";

export interface AligoSendLogEntry {
  timestamp: string;
  phase: AligoLogPhase;
  templateType: string;
  templtCode?: string;
  receiver: string;
  variables: OrderTemplateData;
  payload?: Record<string, unknown>;
  success: boolean;
  aligoCode?: number;
  message: string;
  failureReason?: string;
  retryRecommended?: boolean;
  preflightWarnings?: string[];
  durationMs?: number;
  scnt?: number;
  fcnt?: number;
}

const LOG_DIR = path.join(process.cwd(), "logs", "aligo");
const LOG_FILE = path.join(LOG_DIR, "sends.jsonl");

function sanitizePayload(
  payload: Record<string, string>
): Record<string, unknown> {
  const { apikey, userid, senderkey, ...safe } = payload;
  void apikey;
  void userid;
  void senderkey;
  return safe;
}

async function persistLog(entry: AligoSendLogEntry): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // 서버리스 등 파일시스템 미지원 환경 — 콘솔 로그만 유지
  }
}

export async function logAligoSend(
  entry: Omit<AligoSendLogEntry, "timestamp">
): Promise<AligoSendLogEntry> {
  const full: AligoSendLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  const level = full.success ? "log" : "error";
  console[level]("[Aligo:send-log]", JSON.stringify(full));

  await persistLog(full);
  return full;
}

export async function logAligoRetry(
  base: AligoSendLogEntry,
  reason: string
): Promise<void> {
  const retryEntry: AligoSendLogEntry = {
    ...base,
    timestamp: new Date().toISOString(),
    phase: "api_failed",
    success: false,
    retryRecommended: true,
    failureReason: `재시도 권장: ${reason}`,
    message: reason,
  };

  console.warn("[Aligo:retry-log]", JSON.stringify(retryEntry));
  await persistLog(retryEntry);
}

export function buildLogPayload(
  payload: Record<string, string>
): Record<string, unknown> {
  return sanitizePayload(payload);
}
