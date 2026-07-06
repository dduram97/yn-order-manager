export const SESSION_COOKIE_NAME = "yn_session";
/** 일반 세션 (브라우저 종료 후에도 유지 — httpOnly cookie) */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
/** 로그인 유지(rememberMe) */
export const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const REMEMBER_ME_STORAGE_KEY = "yn_remember_me";

/** 아이디 저장 — 이메일만 localStorage */
export const SAVED_EMAIL_KEY = "savedEmail";
export const REMEMBER_EMAIL_KEY = "rememberEmail";

/** @deprecated SAVED_EMAIL_KEY 사용 — 하위 호환 */
export const REMEMBER_EMAIL_STORAGE_KEY = "yn_remember_email";

export const ADMIN_ONLY_PATHS = ["/orders/new", "/stats"];
export const ADMIN_ONLY_API_PREFIXES = [
  "/api/stats",
  "/api/aligo",
  "/api/health",
];
