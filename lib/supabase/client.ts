import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트
 * - 고객 검색, 주문 목록 조회 등 클라이언트 사이드 데이터 페칭에 사용
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();

  return createBrowserClient<Database>(url, anonKey);
}
