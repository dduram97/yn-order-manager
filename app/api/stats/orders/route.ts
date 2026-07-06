import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { getOrderStats } from "@/lib/supabase/order-stats";
import { parseStatsQueryParams } from "@/lib/validations/stats";

/**
 * GET /api/stats/orders?year=&month=
 * 월별 KPI + 연도 월간 bar chart 데이터
 */
export async function GET(request: Request) {
  const auth = await requireAuth({ adminOnly: true });
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseStatsQueryParams(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "쿼리 파라미터가 올바르지 않습니다.",
          errors: parsed.errors,
        },
        { status: 400 }
      );
    }

    const { year, month } = parsed.data;
    const supabase = await createClient();
    const { data, error } = await getOrderStats(supabase, year, month);

    if (error || !data) {
      return NextResponse.json(
        {
          success: false,
          message: "통계 조회 중 오류가 발생했습니다.",
          error: error?.message,
          elapsedMs: Date.now() - startedAt,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        message: "서버 오류가 발생했습니다.",
        error: message,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
