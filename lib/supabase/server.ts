import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseEnv } from "./env";

/**
 * 서버(서버 컴포넌트, API Route)에서 사용하는 Supabase 클라이언트
 * - 주문 등록, 알림톡 발송 후 DB 업데이트 등 서버 사이드 작업에 사용
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component에서 호출 시 쿠키 설정 불가 — 무시
        }
      },
    },
  });
}
