import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";

/**
 * GET - 발송 통계 (?year, ?month)
 */
export async function GET() {
  const auth = await requireAuth({ adminOnly: true });
  if (auth.error) return auth.error;

  return NextResponse.json({ message: "Not implemented" }, { status: 501 });
}
