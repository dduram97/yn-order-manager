import { NextResponse } from "next/server";

/** GET /api/test — API 연결 확인 (UI 아님) */
export async function GET() {
  return new NextResponse("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
