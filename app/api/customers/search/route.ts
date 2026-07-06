import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { listCustomers } from "@/lib/supabase/customers";
import { parseOrderListParams } from "@/lib/validations/order";

/**
 * GET - 고객 검색 (?q=이름 또는 전화번호, ?page, ?limit)
 */
export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);

  const merged = new URLSearchParams(searchParams);
  const q = searchParams.get("q")?.trim();
  if (q && !merged.has("search")) {
    merged.set("search", q);
  }

  const parsed = parseOrderListParams(merged);

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

  try {
    const supabase = await createClient();
    const { data, pagination, error } = await listCustomers(
      supabase,
      parsed.data
    );

    const elapsed = Date.now() - startedAt;

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: "고객 검색 중 오류가 발생했습니다.",
          error: error.message,
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
