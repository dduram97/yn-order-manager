import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import type { SessionUser } from "@/types/auth";

export interface LoginInput {
  email: string;
  password: string;
  rememberMe: boolean;
  next?: string;
}

export type LoginSuccess = {
  ok: true;
  sessionUser: SessionUser;
  rememberMe: boolean;
  token: string;
  redirectTo: string;
};

export type LoginFailure = {
  ok: false;
  status: 400 | 401 | 500;
  message: string;
};

export function resolveLoginRedirect(
  role: SessionUser["role"],
  next?: string
): string {
  if (next && next.startsWith("/") && !next.startsWith("/login")) {
    return next;
  }
  return role === "admin" ? "/orders/new" : "/orders";
}

export async function authenticateLogin(
  input: LoginInput
): Promise<LoginSuccess | LoginFailure> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return {
      ok: false,
      status: 400,
      message: "이메일과 비밀번호를 입력해주세요.",
    };
  }

  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return {
        ok: false,
        status: 401,
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      };
    }

    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
      return {
        ok: false,
        status: 401,
        message: "이메일 또는 비밀번호가 올바르지 않습니다.",
      };
    }

    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const rememberMe = input.rememberMe;
    const token = await createSessionToken(sessionUser, { rememberMe });

    return {
      ok: true,
      sessionUser,
      rememberMe,
      token,
      redirectTo: resolveLoginRedirect(sessionUser.role, input.next),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[authenticateLogin] ❌", message);
    return {
      ok: false,
      status: 500,
      message: "로그인 처리 중 오류가 발생했습니다.",
    };
  }
}

function parseRememberMe(value: FormDataEntryValue | null): boolean {
  if (value == null) return false;
  const raw = String(value).trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "on" || raw === "yes";
}

export function parseLoginFormData(formData: FormData): LoginInput {
  return {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    rememberMe: parseRememberMe(formData.get("rememberMe")),
    next: String(formData.get("next") ?? "") || undefined,
  };
}

export function parseLoginJson(body: unknown): LoginInput {
  const email =
    body &&
    typeof body === "object" &&
    "email" in body &&
    typeof body.email === "string"
      ? body.email
      : "";
  const password =
    body &&
    typeof body === "object" &&
    "password" in body &&
    typeof body.password === "string"
      ? body.password
      : "";
  const rememberMe = Boolean(
    body &&
      typeof body === "object" &&
      "rememberMe" in body &&
      body.rememberMe
  );
  const next =
    body &&
    typeof body === "object" &&
    "next" in body &&
    typeof body.next === "string"
      ? body.next
      : undefined;

  return { email, password, rememberMe, next };
}

export function isFormLoginRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  return (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
}
