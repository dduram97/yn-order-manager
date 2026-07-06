export interface AligoCredentials {
  apiKey: string;
  userId: string;
  senderKey: string;
}

export interface AligoEnv {
  apiUrl: string;
  senderPhone: string;
  testMode: boolean;
}

export type AligoEnvKey =
  | "ALIGO_API_URL"
  | "ALIGO_SENDER_PHONE"
  | "ALIGO_TEST_MODE";

export type EnvLoadStatus = "set" | "empty" | "undefined";

export interface AligoEnvDiagnostic {
  key: AligoEnvKey;
  status: EnvLoadStatus;
}

const SEND_ENV_KEYS: AligoEnvKey[] = [
  "ALIGO_API_URL",
  "ALIGO_SENDER_PHONE",
];

const DIAGNOSTIC_KEYS: AligoEnvKey[] = [
  ...SEND_ENV_KEYS,
  "ALIGO_TEST_MODE",
];

function readEnv(key: AligoEnvKey): string | undefined {
  return process.env[key];
}

export function getEnvLoadStatus(key: AligoEnvKey): EnvLoadStatus {
  const raw = readEnv(key);
  if (raw === undefined) return "undefined";
  if (raw.trim() === "") return "empty";
  return "set";
}

function formatMissingLabel(key: AligoEnvKey, status: EnvLoadStatus): string {
  return status === "empty" ? `${key} (empty)` : `${key} (undefined)`;
}

export function getAligoEnvDiagnostics(): AligoEnvDiagnostic[] {
  return DIAGNOSTIC_KEYS.map((key) => ({
    key,
    status: getEnvLoadStatus(key),
  }));
}

export function getMissingAligoEnvKeys(
  keys: AligoEnvKey[] = SEND_ENV_KEYS
): string[] {
  return getAligoEnvDiagnostics()
    .filter((item) => keys.includes(item.key) && item.status !== "set")
    .map((item) => formatMissingLabel(item.key, item.status));
}

export function logAligoEnvDiagnostics(context = "Aligo") {
  const diagnostics = getAligoEnvDiagnostics();
  const summary = Object.fromEntries(
    diagnostics.map(({ key, status }) => [key, status])
  );

  console.log(`[${context}] env 로딩 상태:`, summary);

  const missing = getMissingAligoEnvKeys();
  if (missing.length > 0) {
    console.error(`[${context}] 누락/비어있음:`, missing.join(", "));
  }
}

export type AligoSendEnvValidation =
  | { ok: true; env: AligoEnv }
  | { ok: false; missing: string[]; missingKeys: AligoEnvKey[]; message: string };

/** Vercel 필수 env (Aligo API 키는 VPS에만 존재) */
export const ALIGO_CORE_ENV_KEYS: AligoEnvKey[] = [
  "ALIGO_API_URL",
  "ALIGO_SENDER_PHONE",
];

export function getAligoEnvCheck(): Record<string, boolean> {
  return {
    ALIGO_API_URL: getEnvLoadStatus("ALIGO_API_URL") === "set",
    ALIGO_SENDER_PHONE: getEnvLoadStatus("ALIGO_SENDER_PHONE") === "set",
    ALIGO_TEST_MODE: getEnvLoadStatus("ALIGO_TEST_MODE") === "set",
  };
}

export function getUnsetAligoEnvKeys(
  keys: AligoEnvKey[] = DIAGNOSTIC_KEYS
): AligoEnvKey[] {
  return keys.filter((key) => getEnvLoadStatus(key) !== "set");
}

export function validateAligoSendEnvironment(): AligoSendEnvValidation {
  const missingKeys = getUnsetAligoEnvKeys(SEND_ENV_KEYS);
  const missing = missingKeys.map((key) =>
    formatMissingLabel(key, getEnvLoadStatus(key))
  );

  if (missing.length > 0) {
    const message = `Aligo 발송 환경변수 누락: ${missing.join(", ")}`;
    return { ok: false, missing, missingKeys, message };
  }

  return {
    ok: true,
    env: {
      apiUrl: readEnv("ALIGO_API_URL")!.trim(),
      senderPhone: readEnv("ALIGO_SENDER_PHONE")!.trim(),
      testMode: readEnv("ALIGO_TEST_MODE")?.trim() === "Y",
    },
  };
}

/** @deprecated VPS에서 Aligo 인증 처리 — Vercel에서는 사용하지 않음 */
export function getAligoCredentials(): AligoCredentials | null {
  return null;
}

export function getAligoSendEnv(): AligoEnv | null {
  const validation = validateAligoSendEnvironment();
  if (!validation.ok) {
    console.error(`[Aligo] ${validation.message}`);
    logAligoEnvDiagnostics("Aligo:send-env");
    return null;
  }
  return validation.env;
}

/** @deprecated getAligoSendEnv() 사용 */
export function getAligoEnv(): AligoEnv | null {
  return getAligoSendEnv();
}
