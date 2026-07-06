import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireAuth } from "@/lib/auth/require-auth";
import { findUserByEmail, updateUserPasswordHash } from "@/lib/auth/users";

const MIN_PASSWORD_LENGTH = 8;

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
    const newPassword =
      body &&
      typeof body === "object" &&
      "newPassword" in body &&
      typeof body.newPassword === "string"
        ? body.newPassword
        : "";
    const confirmPassword =
      body &&
      typeof body === "object" &&
      "confirmPassword" in body &&
      typeof body.confirmPassword === "string"
        ? body.confirmPassword
        : "";

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "모든 비밀번호 항목을 입력해주세요." },
        { status: 400 }
      );
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          success: false,
          message: `새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`,
        },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "새 비밀번호 확인이 일치하지 않습니다." },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        {
          success: false,
          message: "새 비밀번호는 현재 비밀번호와 달라야 합니다.",
        },
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

    const passwordHash = await hashPassword(newPassword);
    const updated = await updateUserPasswordHash(auth.user.id, passwordHash);

    if (!updated.ok) {
      return NextResponse.json(
        { success: false, message: "비밀번호 변경에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "비밀번호가 변경되었습니다.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/auth/change-password] ❌", message);

    return NextResponse.json(
      { success: false, message: "비밀번호 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
