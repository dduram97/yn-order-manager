import { NextResponse } from "next/server";
import {
  getSessionRememberMe,
  getSessionUser,
} from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";

export async function GET() {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json(
      { success: false, message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  const user = await findUserById(session.id);

  if (!user) {
    return NextResponse.json(
      { success: false, message: "사용자를 찾을 수 없습니다." },
      { status: 401 }
    );
  }

  const rememberMe = await getSessionRememberMe();

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
      rememberMe,
    },
  });
}
