import type { createClient } from "@/lib/supabase/server";
import { attachVipFieldsByPhone } from "@/lib/supabase/vip";
import { resolveVipFields, VIP_GOLD_MIN, VIP_SILVER_MIN } from "@/lib/vip";
import type { Customer } from "@/types/database";
import type {
  CustomerListItem,
  CustomerListParams,
} from "@/types/customer";
import { escapeIlike, normalizePhone } from "@/lib/validations/order";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

const CUSTOMER_LIST_COLUMNS_BASE =
  "id, name, phone, created_at, grade, is_favorite, favorite_at";
const CUSTOMER_LIST_COLUMNS_WITH_VIP = `${CUSTOMER_LIST_COLUMNS_BASE}, order_count, vip_level`;

type OrdersPhoneOnlyRow = {
  phone: string;
};

function toKstRangeIso(startDate: string, endDate: string): {
  startIso: string;
  endIso: string;
} {
  const start = new Date(`${startDate}T00:00:00+09:00`);
  const end = new Date(`${endDate}T23:59:59.999+09:00`);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function resolvePhonesWithOrdersInRange(
  supabase: ServerSupabaseClient,
  startDate: string,
  endDate: string
): Promise<Set<string>> {
  const { startIso, endIso } = toKstRangeIso(startDate, endDate);
  const phones = new Set<string>();

  const { data: sentRows, error: sentError } = await supabase
    .from("orders")
    .select("phone")
    .gte("sent_at", startIso)
    .lte("sent_at", endIso);

  if (sentError) throw sentError;
  for (const row of (sentRows ?? []) as unknown as OrdersPhoneOnlyRow[]) {
    const phone = String(row.phone ?? "");
    if (phone) phones.add(phone);
  }

  const { data: createdRows, error: createdError } = await supabase
    .from("orders")
    .select("phone")
    .is("sent_at", null)
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (createdError) throw createdError;
  for (const row of (createdRows ?? []) as unknown as OrdersPhoneOnlyRow[]) {
    const phone = String(row.phone ?? "");
    if (phone) phones.add(phone);
  }

  return phones;
}

export interface UpsertCustomerPayload {
  name: string;
  phone: string;
}

function enrichCustomersFromCache(
  customers: (CustomerListItem & { order_count?: number })[]
) {
  return customers.map((customer) => ({
    ...customer,
    ...resolveVipFields(customer.order_count ?? 0),
    display_badge:
      customer.grade && customer.grade !== "normal"
        ? customer.grade === "silver"
          ? "Silver VIP"
          : "Gold VIP"
        : resolveVipFields(customer.order_count ?? 0).vip_badge,
  }));
}

/**
 * phone 기준 upsert — 동일 번호면 name만 최신값으로 갱신
 */
export async function upsertCustomerByPhone(
  supabase: ServerSupabaseClient,
  payload: UpsertCustomerPayload
) {
  const { data, error } = await supabase
    .from("customers")
    .upsert(payload as never, { onConflict: "phone" })
    .select("id, name, phone, created_at")
    .single();

  return {
    data: data as Customer | null,
    error: error as { message: string; code?: string } | null,
  };
}

export async function listCustomers(
  supabase: ServerSupabaseClient,
  params: CustomerListParams
) {
  const { page, limit, search, vip, startDate, endDate } = params;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("customers")
    .select(CUSTOMER_LIST_COLUMNS_WITH_VIP, { count: "exact" });

  if (startDate && endDate) {
    const phonesInRange = await resolvePhonesWithOrdersInRange(
      supabase,
      startDate,
      endDate
    );
    if (phonesInRange.size === 0) {
      return {
        data: [],
        pagination: { page, limit, totalCount: 0, totalPages: 0 },
        error: null,
      };
    }
    query = query.in("phone", Array.from(phonesInRange));
  }

  if (vip === "favorite") {
    query = query.eq("is_favorite", true);
  } else if (vip === "silver") {
    query = query.gte("order_count", VIP_SILVER_MIN).lt("order_count", VIP_GOLD_MIN);
  } else if (vip === "gold") {
    query = query.gte("order_count", VIP_GOLD_MIN);
  }

  if (search) {
    const escaped = escapeIlike(search);
    const normalizedPhone = normalizePhone(search);
    query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${normalizedPhone}%`);
  }

  if (vip === "favorite") {
    query = query.order("name", { ascending: true });
  } else {
    query = query
      .order("order_count", { ascending: false })
      .order("created_at", { ascending: false });
  }

  query = query.range(from, to);

  let { data, error, count } = await query;

  if (error?.code === "42703") {
    let legacyQuery = supabase
      .from("customers")
      .select("id, name, phone, created_at, is_favorite, favorite_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      const escaped = escapeIlike(search);
      const normalizedPhone = normalizePhone(search);
      legacyQuery = legacyQuery.or(
        `name.ilike.%${escaped}%,phone.ilike.%${normalizedPhone}%`
      );
    }

    const legacyResult = await legacyQuery;
    data = legacyResult.data;
    error = legacyResult.error;
    count = legacyResult.count;

    const customers = (data ?? []) as CustomerListItem[];
    let enriched = await attachVipFieldsByPhone(supabase, customers);

    if (startDate && endDate) {
      try {
        const phonesInRange = await resolvePhonesWithOrdersInRange(
          supabase,
          startDate,
          endDate
        );
        enriched = enriched.filter((c) => phonesInRange.has(String(c.phone)));
      } catch {
        // 레거시 경로에서는 기간 필터 실패 시 목록 표시에 영향 최소화
      }
    }

    if (vip === "silver") {
      enriched = enriched.filter((c) => c.vip_level === "silver");
    } else if (vip === "gold") {
      enriched = enriched.filter((c) => c.vip_level === "gold");
    } else if (vip === "favorite") {
      enriched = enriched.filter((c) => c.is_favorite === true);
    }

    if (vip === "favorite") {
      enriched.sort((a, b) => a.name.localeCompare(b.name, "ko"));
    } else {
      enriched.sort((a, b) => b.order_count - a.order_count);
    }

    return {
      data: enriched.map((c) => ({
        ...c,
        display_badge: c.vip_badge,
      })),
      pagination: {
        page,
        limit,
        totalCount: enriched.length,
        totalPages: enriched.length === 0 ? 0 : Math.ceil(enriched.length / limit),
      },
      error: error as { message: string; code?: string } | null,
    };
  }

  const totalCount = count ?? 0;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  const customers = (data ?? []) as (CustomerListItem & {
    order_count?: number;
  })[];
  const enriched = enrichCustomersFromCache(customers);

  return {
    data: enriched,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
    },
    error: error as { message: string; code?: string } | null,
  };
}

export async function setCustomerFavorite(
  supabase: ServerSupabaseClient,
  customerId: string,
  isFavorite: boolean
) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("customers")
    .update({
      is_favorite: isFavorite,
      favorite_at: isFavorite ? now : null,
    } as never)
    .eq("id", customerId)
    .select(CUSTOMER_LIST_COLUMNS_WITH_VIP)
    .single();

  if (error || !data) {
    return {
      data: null,
      error: error as { message: string; code?: string } | null,
    };
  }

  const row = data as CustomerListItem & { order_count?: number };
  const [enriched] = enrichCustomersFromCache([row]);

  return {
    data: enriched,
    error: null,
  };
}
