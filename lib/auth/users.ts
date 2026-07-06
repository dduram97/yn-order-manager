import { createAdminClient } from "@/lib/supabase/admin";
import type { AppUser } from "@/types/auth";
import type { AppUserRow } from "@/types/database";
import type { Database } from "@/types/database";

export async function findUserByEmail(email: string): Promise<AppUserRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, password_hash, role, created_at")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as AppUserRow;
}

export async function findUserById(id: string): Promise<AppUser | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, role, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as AppUser;
}

export async function updateUserPasswordHash(
  userId: string,
  passwordHash: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createAdminClient();
  const payload: Database["public"]["Tables"]["users"]["Update"] = {
    password_hash: passwordHash,
  };
  const { error } = await supabase
    .from("users")
    .update(payload as never)
    .eq("id", userId);

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
