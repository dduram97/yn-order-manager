import {
  REMEMBER_EMAIL_KEY,
  REMEMBER_EMAIL_STORAGE_KEY,
  REMEMBER_ME_STORAGE_KEY,
  SAVED_EMAIL_KEY,
} from "@/lib/auth/constants";

/** 구버전 yn_remember_email → savedEmail 마이그레이션 */
export function migrateLegacySavedEmail(): void {
  if (typeof window === "undefined") return;

  const legacy = localStorage.getItem(REMEMBER_EMAIL_STORAGE_KEY);
  if (legacy && !localStorage.getItem(SAVED_EMAIL_KEY)) {
    localStorage.setItem(SAVED_EMAIL_KEY, legacy);
    localStorage.setItem(REMEMBER_EMAIL_KEY, "true");
    localStorage.removeItem(REMEMBER_EMAIL_STORAGE_KEY);
  }
}

export function loadSavedEmailPrefs(): {
  email: string;
  rememberEmail: boolean;
  rememberMe: boolean;
} {
  migrateLegacySavedEmail();

  const rememberEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) === "true";
  const savedEmail = rememberEmail
    ? (localStorage.getItem(SAVED_EMAIL_KEY) ?? "")
    : "";
  const rememberMeRaw = localStorage.getItem(REMEMBER_ME_STORAGE_KEY);
  const rememberMe = rememberMeRaw == null ? true : rememberMeRaw === "1";

  return { email: savedEmail, rememberEmail, rememberMe };
}

export function persistLoginPrefs(
  email: string,
  rememberEmail: boolean,
  rememberMe: boolean
): void {
  if (rememberEmail) {
    localStorage.setItem(REMEMBER_EMAIL_KEY, "true");
    localStorage.setItem(SAVED_EMAIL_KEY, email);
  } else {
    localStorage.setItem(REMEMBER_EMAIL_KEY, "false");
    localStorage.removeItem(SAVED_EMAIL_KEY);
  }

  localStorage.setItem(REMEMBER_ME_STORAGE_KEY, rememberMe ? "1" : "0");
  localStorage.removeItem(REMEMBER_EMAIL_STORAGE_KEY);
}

/** 로그아웃 시 — 아이디 저장 미사용이면 이메일 localStorage 정리 */
export function clearSavedEmailOnLogout(): void {
  if (localStorage.getItem(REMEMBER_EMAIL_KEY) !== "true") {
    localStorage.removeItem(SAVED_EMAIL_KEY);
    localStorage.removeItem(REMEMBER_EMAIL_KEY);
    localStorage.removeItem(REMEMBER_EMAIL_STORAGE_KEY);
  }
}

/** 아이디 변경 후 저장된 이메일 갱신 */
export function updateSavedEmail(newEmail: string): void {
  if (localStorage.getItem(REMEMBER_EMAIL_KEY) === "true") {
    localStorage.setItem(SAVED_EMAIL_KEY, newEmail);
  }
}
