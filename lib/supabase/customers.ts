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
  const { page, limit, search, vip } = params;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("customers")
    .select(CUSTOMER_LIST_COLUMNS_WITH_VIP, { count: "exact" });

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
