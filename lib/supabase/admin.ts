import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service Role 키를 사용하는 관리자용 Supabase 클라이언트
 * - API Route 내부에서만 사용 (클라이언트에 절대 노출 금지)
 * - RLS를 우회해야 하는 서버 전용 작업에 사용
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);
    throw new Error(
      `Supabase admin 클라이언트 환경 변수 누락: ${missing.join(", ")}`
    );
  }

  return createClient<Database>(url, serviceRoleKey);
}
