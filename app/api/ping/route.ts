import { NextResponse } from "next/server";

/** GET /api/ping — 네트워크/API 연결 확인 (UI 아님) */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      type: "api",
      ui: "/login",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
