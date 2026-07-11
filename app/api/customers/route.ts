import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { deleteCustomersByIds, listCustomers } from "@/lib/supabase/customers";
import { insertCustomerOrderStatistic } from "@/lib/supabase/customer-order-stats";
import {
  parseCustomerListParams,
  validateCreateCustomerInput,
} from "@/lib/validations/customer";

type OrdersPhoneRow = {
  phone: string;
  sent_at: string | null;
  created_at: string;
};

function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

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

    const customers = (data ?? []) as Array<{
      phone: string;
      [key: string]: unknown;
    }>;
    const phones = Array.from(
      new Set(customers.map((c) => String(c.phone)).filter(Boolean))
    );

    const lastSentByPhone = new Map<string, string>();
    if (phones.length > 0) {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("phone, sent_at, created_at")
        .in("phone", phones);

      if (ordersError) {
        console.error("[GET /api/customers] ⚠️ orders 조회 오류:", ordersError);
      } else {
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
    }

    return NextResponse.json({
      success: true,
      data: customers.map((c) => ({
        ...c,
        last_sent_at: lastSentByPhone.get(String(c.phone)) ?? null,
      })),
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

/**
 * POST - 고객 저장
 * mode=order(네이버 주문): customers upsert + 통계 +1
 * mode=crm(기존고객추가): customers만 저장, 통계 생성 안 함
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    const body = (await request.json()) as unknown;
    const validation = validateCreateCustomerInput(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "요청 본문이 올바르지 않습니다.",
          errors: validation.errors,
        },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const isCrm = validation.data.mode === "crm";

    type CustomerRow = {
      id: string;
      name: string;
      phone: string;
      created_at: string;
      is_favorite?: boolean;
      favorite_at?: string | null;
      grade?: string;
      memo?: string | null;
      order_channel?: string | null;
      order_product?: string | null;
    };

    let customerRow: CustomerRow | null = null;
    let saveError: { message: string; code?: string } | null = null;

    if (isCrm) {
      // CRM: name/phone/memo만 저장·갱신 (기존 주문채널/상품 유지)
      const existing = (await supabase
        .from("customers")
        .select(
          "id, name, phone, created_at, is_favorite, favorite_at, grade, memo, order_channel, order_product"
        )
        .eq("phone", validation.data.phone)
        .maybeSingle()) as {
        data: CustomerRow | null;
        error: { message: string; code?: string } | null;
      };

      if (existing.error) {
        saveError = existing.error;
      } else if (existing.data) {
        const updated = (await supabase
          .from("customers")
          .update({
            name: validation.data.name,
            phone: validation.data.phone,
            memo: validation.data.memo,
          } as never)
          .eq("id", existing.data.id)
          .select(
            "id, name, phone, created_at, is_favorite, favorite_at, grade, memo, order_channel, order_product"
          )
          .single()) as {
          data: CustomerRow | null;
          error: { message: string; code?: string } | null;
        };
        customerRow = updated.data;
        saveError = updated.error;
      } else {
        const inserted = (await supabase
          .from("customers")
          .insert({
            name: validation.data.name,
            phone: validation.data.phone,
            grade: validation.data.grade,
            memo: validation.data.memo,
          } as never)
          .select(
            "id, name, phone, created_at, is_favorite, favorite_at, grade, memo, order_channel, order_product"
          )
          .single()) as {
          data: CustomerRow | null;
          error: { message: string; code?: string } | null;
        };
        customerRow = inserted.data;
        saveError = inserted.error;
      }
    } else {
      // 네이버 주문: 최신 주문정보 포함 upsert + 통계
      const upsertResult = (await supabase
        .from("customers")
        .upsert(
          {
            name: validation.data.name,
            phone: validation.data.phone,
            grade: validation.data.grade,
            memo: validation.data.memo,
            order_channel: validation.data.order_channel,
            order_product: validation.data.order_product,
          } as never,
          { onConflict: "phone" }
        )
        .select(
          "id, name, phone, created_at, is_favorite, favorite_at, grade, memo, order_channel, order_product"
        )
        .single()) as {
        data: CustomerRow | null;
        error: { message: string; code?: string } | null;
      };
      customerRow = upsertResult.data;
      saveError = upsertResult.error;
    }

    const elapsed = Date.now() - startedAt;

    if (saveError || !customerRow) {
      const schemaMissing =
        saveError?.code === "42703" ||
        saveError?.code === "PGRST204" ||
        /order_channel|order_product/i.test(saveError?.message ?? "");
      return NextResponse.json(
        {
          success: false,
          message: schemaMissing
            ? "DB에 order_channel/order_product 컬럼이 없습니다. supabase/migrations/016_add_order_attributes_and_statistics.sql 을 Supabase SQL Editor에서 실행해주세요."
            : "고객 저장 중 오류가 발생했습니다.",
          error: saveError?.message ?? null,
          code: saveError?.code ?? null,
          elapsedMs: elapsed,
        },
        { status: 500 }
      );
    }

    // CRM(기존고객추가)은 통계 생성 금지. 네이버 주문만 +1
    if (!isCrm && validation.data.order_channel && validation.data.order_product) {
      const { error: statError } = await insertCustomerOrderStatistic({
        customer_id: customerRow.id,
        order_channel: validation.data.order_channel,
        order_product: validation.data.order_product,
        source: "customer_add",
        source_ref: crypto.randomUUID(),
      });

      if (statError) {
        console.error(
          "[POST /api/customers] ⚠️ 통계 저장 실패:",
          statError.message
        );
      }
    }

    return NextResponse.json({
      success: true,
      data: customerRow,
      elapsedMs: elapsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/customers] ❌ 예외:", message);

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

function parseDeleteIds(body: unknown): {
  success: true;
  ids: string[];
} | {
  success: false;
  message: string;
} {
  if (!body || typeof body !== "object") {
    return { success: false, message: "요청 본문이 올바르지 않습니다." };
  }

  const { ids } = body as { ids?: unknown };
  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, message: "삭제할 항목을 선택해주세요." };
  }

  const cleaned = ids
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);

  if (cleaned.length === 0) {
    return { success: false, message: "삭제할 항목을 선택해주세요." };
  }

  return { success: true, ids: Array.from(new Set(cleaned)) };
}

/**
 * DELETE - 선택 고객 삭제
 * body: { ids: string[] }
 */
export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const startedAt = Date.now();

  try {
    const body = (await request.json()) as unknown;
    const parsed = parseDeleteIds(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.message },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { deletedCount, error } = await deleteCustomersByIds(
      supabase,
      parsed.ids
    );
    const elapsed = Date.now() - startedAt;

    if (error) {
      console.error("[DELETE /api/customers] ❌ Supabase 오류:", error.message);
      return NextResponse.json(
        {
          success: false,
          message: "고객 삭제 중 오류가 발생했습니다.",
          error: error.message,
          code: error.code ?? null,
          elapsedMs: elapsed,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      elapsedMs: elapsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[DELETE /api/customers] ❌ 예외:", message);

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
