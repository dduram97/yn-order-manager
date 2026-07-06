import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionRememberMe,
  getSessionUser,
  setSessionCookie,
} from "@/lib/auth/session";

/** POST /api/auth/refresh — 현재 기기 세션만 연장 (다중 로그인 유지) */
export async function POST() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const rememberMe = await getSessionRememberMe();
  const token = await createSessionToken(session, { rememberMe });
  const response = NextResponse.json({
    success: true,
    data: session,
  });
  return setSessionCookie(response, token, { rememberMe });
}
