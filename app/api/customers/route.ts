import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { listCustomers } from "@/lib/supabase/customers";
import { parseCustomerListParams } from "@/lib/validations/customer";

/**
 * GET - 고객 목록 조회 (?page, ?limit, ?search, ?vip=all|silver|gold)
 * 각 고객에 order_count, vip_level, vip_badge 포함
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseCustomerListParams(searchParams);

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

    const supabase = await createClient();
    const { data, pagination, error } = await listCustomers(
      supabase,
      parsed.data
    );

    const elapsed = Date.now() - startedAt;

    if (error) {
      console.error("[GET /api/customers] ❌ Supabase 오류:", error.message);
      return NextResponse.json(
        {
          success: false,
          message: "고객 목록 조회 중 오류가 발생했습니다.",
          error: error.message,
          code: error.code ?? null,
          elapsedMs: elapsed,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      pagination,
      elapsedMs: elapsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/customers] ❌ 예외:", message);

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
