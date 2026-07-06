const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseEnv() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const missing = [
      !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
      !SUPABASE_ANON_KEY && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ].filter(Boolean);

    throw new Error(
      `[Supabase] 환경변수가 설정되지 않았습니다: ${missing.join(", ")}`
    );
  }

  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
  };
}

export function logSupabaseConfig() {
  const { url, anonKey } = getSupabaseEnv();
  const maskedKey = `${anonKey.slice(0, 8)}...${anonKey.slice(-4)}`;

  console.log("[Supabase] URL:", url);
  console.log("[Supabase] Anon Key:", maskedKey);
}
