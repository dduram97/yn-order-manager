import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** GET /api/health — PM2 / Nginx / 모니터링용 (인증 불필요) */
export async function GET() {
  let db: "connected" | "disconnected" | "error" = "disconnected";

  try {
    const supabase = await createClient();
    const { error } = await supabase.from("orders").select("id").limit(1);
    if (error) {
      db = "error";
    } else {
      db = "connected";
    }
  } catch {
    db = "error";
  }

  const ok = db === "connected";
  const body = {
    status: ok ? "ok" : "degraded",
    server: "alive",
    db,
  };

  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
