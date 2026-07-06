import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseEnv, logSupabaseConfig } from "@/lib/supabase/env";

export async function GET() {
  const auth = await requireAuth({ adminOnly: true });
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    logSupabaseConfig();
    console.log("[Supabase Health] 연결 테스트 시작...");

    const { url } = getSupabaseEnv();
    const supabase = await createClient();

    const { data, error, count } = await supabase
      .from("orders")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(5);

    const elapsed = Date.now() - startedAt;

    if (error) {
      console.error("[Supabase Health] ❌ orders 조회 실패:", error.message);
      console.error("[Supabase Health] 상세:", JSON.stringify(error));

      return NextResponse.json(
        {
          success: false,
          message: "Supabase 연결은 되었으나 orders 테이블 조회에 실패했습니다.",
          error: error.message,
          hint: error.hint ?? null,
          code: error.code ?? null,
          supabaseUrl: url,
          elapsedMs: elapsed,
        },
        { status: 503 }
      );
    }

    console.log("[Supabase Health] ✅ 연결 성공");
    console.log(`[Supabase Health] orders 총 ${count ?? 0}건, 샘플 ${data?.length ?? 0}건 조회`);

    return NextResponse.json({
      success: true,
      message: "Supabase 연결 및 orders 테이블 조회 성공",
      supabaseUrl: url,
      orders: {
        totalCount: count ?? 0,
        sampleCount: data?.length ?? 0,
        sample: data ?? [],
      },
      elapsedMs: elapsed,
    });
  } catch (err) {
    const elapsed = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);

    console.error("[Supabase Health] ❌ 연결 실패:", message);

    return NextResponse.json(
      {
        success: false,
        message: "Supabase 연결 실패",
        error: message,
        elapsedMs: elapsed,
      },
      { status: 500 }
    );
  }
}
