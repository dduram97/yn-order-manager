import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { listCustomers } from "@/lib/supabase/customers";
import { parseCustomerListParams } from "@/lib/validations/customer";
import type { CustomerListItemWithVip, VipLevel } from "@/types/customer";

type ExportCustomerRow = {
  grade?: VipLevel;
  vip_level?: VipLevel;
  is_favorite?: boolean;
  name: string;
  phone: string;
  order_count: number;
  last_sent_at: string | null;
};

type OrdersPhoneRow = {
  phone: string;
  sent_at: string | null;
  created_at: string;
};

function toKstDateString(iso: string): string {
  const dt = new Date(iso);
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth();
  const d = dt.getUTCDate();
  const kst = new Date(Date.UTC(y, m, d, 0, 0, 0) + 9 * 60 * 60 * 1000);
  const yy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(kst.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

async function loadAllCustomers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    search?: string;
    vip?: "silver" | "gold" | "favorite";
    startDate?: string;
    endDate?: string;
  }
) {
  const limit = 100;
  let page = 1;
  let all: CustomerListItemWithVip[] = [];

  // 최대한 기존 listCustomers 로직을 재사용(필터/검색 일관성 유지)
  for (;;) {
    const result = await listCustomers(supabase, {
      page,
      limit,
      search: params.search,
      vip: params.vip,
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (result.error) {
      return { data: null, error: result.error };
    }

    all = all.concat((result.data ?? []) as CustomerListItemWithVip[]);

    const totalPages = result.pagination?.totalPages ?? 0;
    if (totalPages === 0 || page >= totalPages) break;
    page += 1;
  }

  return { data: all, error: null };
}

/**
 * GET - 고객 엑셀 다운로드용 데이터
 * (?search, ?vip=all|silver|gold|favorite)
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
    const vip =
      parsed.data.vip && parsed.data.vip !== "all" ? parsed.data.vip : undefined;
    const { data: customers, error: listError } = await loadAllCustomers(
      supabase,
      {
        search: parsed.data.search,
        vip,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      }
    );

    if (listError || !customers) {
      return NextResponse.json(
        {
          success: false,
          message: "고객 목록 조회 중 오류가 발생했습니다.",
          error: listError?.message ?? null,
          code: listError?.code ?? null,
          elapsedMs: Date.now() - startedAt,
        },
        { status: 500 }
      );
    }

    const phones = Array.from(
      new Set(customers.map((c) => String(c.phone)).filter(Boolean))
    );

    const lastSentByPhone = new Map<string, string>();
    const chunkSize = 500;

    for (let i = 0; i < phones.length; i += chunkSize) {
      const chunk = phones.slice(i, i + chunkSize);
      const { data: orders, error } = await supabase
        .from("orders")
        .select("phone, sent_at, created_at")
        .in("phone", chunk);

      if (error) {
        console.error("[GET /api/customers/export] ❌ orders 조회 오류:", error);
        return NextResponse.json(
          {
            success: false,
            message: "최근 발송일 조회 중 오류가 발생했습니다.",
            error: error.message,
            code: error.code ?? null,
            elapsedMs: Date.now() - startedAt,
          },
          { status: 500 }
        );
      }

      const rows = (orders ?? []) as unknown as OrdersPhoneRow[];
      for (const row of rows) {
        const phone = String(row.phone ?? "");
        if (!phone) continue;
        const candidate = row.sent_at ?? row.created_at ?? null;
        const prev = lastSentByPhone.get(phone) ?? null;
        const next = maxIso(prev, candidate);
        if (next) lastSentByPhone.set(phone, next);
      }
    }

    const rows: ExportCustomerRow[] = customers.map((c) => ({
      grade: c.grade ?? undefined,
      vip_level: c.vip_level ?? undefined,
      is_favorite: c.is_favorite ?? false,
      name: c.name,
      phone: c.phone,
      order_count: c.order_count ?? 0,
      last_sent_at: lastSentByPhone.get(c.phone) ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        last_sent_date: r.last_sent_at ? toKstDateString(r.last_sent_at) : null,
      })),
      elapsedMs: Date.now() - startedAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[GET /api/customers/export] ❌ 예외:", message);
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

