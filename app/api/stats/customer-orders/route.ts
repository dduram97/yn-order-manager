import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  ORDER_ATTRIBUTE_OTHER,
  ORDER_CHANNEL_PRESETS,
  ORDER_PRODUCT_PRESETS,
} from "@/lib/constants/order-attributes";
import { getCustomerOrderStats } from "@/lib/supabase/customer-order-stats";
import { parseCustomerOrderStatsQueryParams } from "@/lib/validations/stats";

/**
 * GET /api/stats/customer-orders?year=&month=
 * month 생략 또는 all → 연도 전체
 */
export async function GET(request: Request) {
  const auth = await requireAuth({ adminOnly: true });
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseCustomerOrderStatsQueryParams(searchParams);

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
    const { data, error } = await getCustomerOrderStats(year, month, {
      channelPresets: ORDER_CHANNEL_PRESETS,
      productPresets: ORDER_PRODUCT_PRESETS,
      otherLabel: ORDER_ATTRIBUTE_OTHER,
    });

    if (error || !data) {
      const schemaMissing =
        error?.code === "PGRST205" ||
        error?.code === "42P01" ||
        /customer_order_statistics/i.test(error?.message ?? "");

      return NextResponse.json(
        {
          success: false,
          message: schemaMissing
            ? "통계 테이블이 없습니다. supabase/migrations/016_add_order_attributes_and_statistics.sql 을 Supabase SQL Editor에서 실행해주세요."
            : "통계 조회 중 오류가 발생했습니다.",
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
