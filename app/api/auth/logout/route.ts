import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "로그아웃되었습니다.",
  });

  return clearSessionCookie(response);
}
