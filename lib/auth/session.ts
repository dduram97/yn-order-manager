import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import {
  REMEMBER_ME_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/constants";
import type { SessionUser } from "@/types/auth";

export interface CreateSessionOptions {
  /** true면 30일 — 기기별 독립 세션, 다른 기기 세션 무효화 없음 */
  rememberMe?: boolean;
}

function getSessionSecret(): Uint8Array {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET 환경 변수가 설정되지 않았거나 32자 미만입니다."
    );
  }
  return new TextEncoder().encode(secret);
}

function sessionMaxAge(options?: CreateSessionOptions): number {
  return options?.rememberMe
    ? REMEMBER_ME_MAX_AGE_SECONDS
    : SESSION_MAX_AGE_SECONDS;
}

/**
 * 기기별 독립 JWT — jti로 구분, 다중 로그인 허용 (기존 세션 invalidate 없음)
 */
export async function createSessionToken(
  user: SessionUser,
  options?: CreateSessionOptions
): Promise<string> {
  const maxAge = sessionMaxAge(options);
  const jti = crypto.randomUUID();

  return new SignJWT({
    email: user.email,
    role: user.role,
    remember: Boolean(options?.rememberMe),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });

    const id = payload.sub;
    const email = payload.email;
    const role = payload.role;

    if (
      typeof id !== "string" ||
      typeof email !== "string" ||
      (role !== "admin" && role !== "staff")
    ) {
      return null;
    }

    return { id, email, role };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

function sessionCookieSecure(): boolean {
  const override = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "false" || override === "0") return false;
  if (override === "true" || override === "1") return true;
  return process.env.NODE_ENV === "production";
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  options?: CreateSessionOptions
): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge(options),
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function getSessionUserFromRequest(
  request: NextRequest
): Promise<SessionUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** JWT payload의 remember 플래그 — httpOnly 쿠키 기준 자동 로그인 판별 */
export async function getSessionRememberMe(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    return payload.remember === true;
  } catch {
    return false;
  }
}
