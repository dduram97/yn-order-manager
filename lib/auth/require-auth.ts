import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { SessionUser } from "@/types/auth";

type AuthSuccess = { user: SessionUser; error?: never };
type AuthFailure = { user?: never; error: NextResponse };

export async function requireAuth(options?: {
  adminOnly?: boolean;
}): Promise<AuthSuccess | AuthFailure> {
  const user = await getSessionUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, message: "로그인이 필요합니다." },
        { status: 401 }
      ),
    };
  }

  if (options?.adminOnly && user.role !== "admin") {
    return {
      error: NextResponse.json(
        { success: false, message: "관리자 권한이 필요합니다." },
        { status: 403 }
      ),
    };
  }

  return { user };
}
