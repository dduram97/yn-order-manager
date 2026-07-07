import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  createSessionToken,
  getSessionRememberMe,
  setSessionCookie,
} from "@/lib/auth/session";
import { findUserByEmail, updateUserEmail } from "@/lib/auth/users";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "요청 본문이 올바른 JSON 형식이 아닙니다." },
        { status: 400 }
      );
    }

    const currentPassword =
      body &&
      typeof body === "object" &&
      "currentPassword" in body &&
      typeof body.currentPassword === "string"
        ? body.currentPassword
        : "";
    const newEmail =
      body &&
      typeof body === "object" &&
      "newEmail" in body &&
      typeof body.newEmail === "string"
        ? body.newEmail.trim().toLowerCase()
        : "";

    if (!currentPassword || !newEmail) {
      return NextResponse.json(
        { success: false, message: "새 아이디와 현재 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(newEmail)) {
      return NextResponse.json(
        { success: false, message: "올바른 이메일 형식이 아닙니다." },
        { status: 400 }
      );
    }

    if (newEmail === auth.user.email.toLowerCase()) {
      return NextResponse.json(
        { success: false, message: "새 아이디는 현재 아이디와 달라야 합니다." },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(auth.user.email);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const valid = await verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { success: false, message: "현재 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const existing = await findUserByEmail(newEmail);
    if (existing && existing.id !== auth.user.id) {
      return NextResponse.json(
        { success: false, message: "이미 사용 중인 아이디입니다." },
        { status: 409 }
      );
    }

    const updated = await updateUserEmail(auth.user.id, newEmail);
    if (!updated.ok) {
      const status = updated.code === "23505" ? 409 : 500;
      return NextResponse.json(
        { success: false, message: updated.message },
        { status }
      );
    }

    const rememberMe = await getSessionRememberMe();
    const newSession = {
      id: auth.user.id,
      email: newEmail,
      role: auth.user.role,
    };
    const token = await createSessionToken(newSession, { rememberMe });

    const response = NextResponse.json({
      success: true,
      message: "아이디가 변경되었습니다.",
      data: newSession,
    });

    return setSessionCookie(response, token, { rememberMe });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/auth/change-email] ❌", message);

    return NextResponse.json(
      { success: false, message: "아이디 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
