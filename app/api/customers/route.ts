import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { createClient } from "@/lib/supabase/server";
import { listCustomers } from "@/lib/supabase/customers";
import { parseCustomerListParams } from "@/lib/validations/customer";
import { normalizePhone } from "@/lib/validations/order";

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

type CustomerGrade = "normal" | "silver" | "gold";

function validateCreateCustomerInput(body: unknown): {
  success: true;
  data: { name: string; phone: string; grade: CustomerGrade };
} | {
  success: false;
  errors: { field: string; message: string }[];
} {
  if (!body || typeof body !== "object") {
    return {
      success: false,
      errors: [{ field: "body", message: "요청 본문이 올바르지 않습니다." }],
    };
  }

  const { name, phone, grade } = body as Record<string, unknown>;
  const errors: { field: string; message: string }[] = [];

  if (typeof name !== "string" || name.trim() === "") {
    errors.push({ field: "name", message: "고객명은 필수입니다." });
  }

  if (typeof phone !== "string" || phone.trim() === "") {
    errors.push({ field: "phone", message: "휴대폰번호는 필수입니다." });
  }

  const allowed: CustomerGrade[] = ["normal", "silver", "gold"];
  const gradeVal: CustomerGrade =
    typeof grade === "string" && allowed.includes(grade as CustomerGrade)
      ? (grade as CustomerGrade)
      : "normal";

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name: (name as string).trim(),
      phone: normalizePhone((phone as string).trim()),
      grade: gradeVal,
    },
  };
}

/**
 * POST - 고객 직접 추가
 * body: { name, phone, grade(normal|silver|gold) }
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

    // grade 컬럼은 이후 마이그레이션에서 추가될 수 있어, 42703(unknown column) 시 안전하게 fallback
    const insertWithGrade = await supabase
      .from("customers")
      .insert({
        name: validation.data.name,
        phone: validation.data.phone,
        grade: validation.data.grade,
      } as never)
      .select("id, name, phone, created_at, is_favorite, favorite_at, grade")
      .single();

    const insertLegacy =
      insertWithGrade.error?.code === "42703"
        ? await supabase
        .from("customers")
        .insert({
          name: validation.data.name,
          phone: validation.data.phone,
        } as never)
        .select("id, name, phone, created_at, is_favorite, favorite_at")
        .single()
        : null;

    const insertResult = (insertLegacy ?? insertWithGrade) as {
      data: unknown;
      error: { message: string; code?: string } | null;
    };

    const elapsed = Date.now() - startedAt;

    if (insertResult.error || !insertResult.data) {
      const msg =
        insertResult.error?.code === "23505"
          ? "이미 등록된 휴대폰번호입니다."
          : "고객 추가 중 오류가 발생했습니다.";
      return NextResponse.json(
        {
          success: false,
          message: msg,
          error: insertResult.error?.message ?? null,
          code: insertResult.error?.code ?? null,
          elapsedMs: elapsed,
        },
        { status: insertResult.error?.code === "23505" ? 409 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: insertResult.data,
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
