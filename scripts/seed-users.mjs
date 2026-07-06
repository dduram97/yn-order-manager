/**
 * 초기 admin / staff 계정 생성
 *
 * 사용법:
 *   npm run seed:users
 *
 * 환경 변수 (선택):
 *   ADMIN_EMAIL, ADMIN_PASSWORD
 *   STAFF_EMAIL, STAFF_PASSWORD
 *
 * .env.local 에서 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 를 읽습니다.
 */
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env.local");

const SALT_ROUNDS = 12;

console.log("[seed:users] 시작");
console.log("[seed:users] cwd:", process.cwd());
console.log("[seed:users] env 파일:", ENV_FILE);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`.env.local 파일을 찾을 수 없습니다: ${filePath}`);
  }

  const loaded = {};
  const lines = fs.readFileSync(filePath, "utf8").split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    loaded[key] = value;
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  console.log("[seed:users] .env.local 로드 완료:", Object.keys(loaded).join(", "));
  return loaded;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} 환경 변수가 필요합니다. (.env.local 확인)`
    );
  }
  return value;
}

async function main() {
  loadEnvFile(ENV_FILE);

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[seed:users] Supabase URL:", url);
  console.log("[seed:users] Service Role Key:", serviceKey ? "(설정됨)" : "(없음)");

  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@yn-order.local").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin1234!";
  const staffEmail = (process.env.STAFF_EMAIL ?? "staff@yn-order.local").toLowerCase();
  const staffPassword = process.env.STAFF_PASSWORD ?? "Staff1234!";

  console.log("[seed:users] 대상 계정:", { adminEmail, staffEmail });

  const supabase = createClient(url, serviceKey);

  const users = [
    {
      email: adminEmail,
      password_hash: await bcrypt.hash(adminPassword, SALT_ROUNDS),
      role: "admin",
      plainPassword: adminPassword,
    },
    {
      email: staffEmail,
      password_hash: await bcrypt.hash(staffPassword, SALT_ROUNDS),
      role: "staff",
      plainPassword: staffPassword,
    },
  ];

  for (const user of users) {
    const { plainPassword, ...dbUser } = user;

    console.log(`\n[seed:users] 처리 중: ${user.email} (${user.role})`);
    console.log("[seed:users] hash prefix:", user.password_hash.slice(0, 7));

    const { data: existing, error: fetchError } = await supabase
      .from("users")
      .select("id, email, role")
      .eq("email", user.email)
      .maybeSingle();

    if (fetchError) {
      throw new Error(`조회 실패 (${user.email}): ${fetchError.message}`);
    }

    if (existing) {
      console.log("[seed:users] 기존 사용자 발견 → update", existing.id);

      const { data: updated, error: updateError } = await supabase
        .from("users")
        .update({
          password_hash: dbUser.password_hash,
          role: dbUser.role,
        })
        .eq("email", user.email)
        .select("id, email, role, created_at")
        .single();

      if (updateError) {
        throw new Error(`업데이트 실패 (${user.email}): ${updateError.message}`);
      }

      console.log("[seed:users] ✅ 업데이트 성공:", updated);
    } else {
      console.log("[seed:users] 신규 사용자 → insert");

      const { data: inserted, error: insertError } = await supabase
        .from("users")
        .insert(dbUser)
        .select("id, email, role, created_at")
        .single();

      if (insertError) {
        throw new Error(`생성 실패 (${user.email}): ${insertError.message}`);
      }

      console.log("[seed:users] ✅ 생성 성공:", inserted);
    }

    const { data: verifyRow, error: verifyFetchError } = await supabase
      .from("users")
      .select("password_hash")
      .eq("email", user.email)
      .single();

    if (verifyFetchError || !verifyRow) {
      throw new Error(
        `검증 조회 실패 (${user.email}): ${verifyFetchError?.message ?? "row 없음"}`
      );
    }

    const passwordOk = await bcrypt.compare(
      plainPassword,
      verifyRow.password_hash
    );

    console.log("[seed:users] bcrypt 검증:", passwordOk ? "✅ 일치" : "❌ 불일치");

    if (!passwordOk) {
      throw new Error(
        `seed 후 bcrypt 검증 실패 (${user.email}) — DB hash와 비밀번호 불일치`
      );
    }
  }

  console.log("\n[seed:users] ✅ 완료");
  console.log("초기 계정:");
  console.log(`  admin → ${adminEmail} / ${adminPassword}`);
  console.log(`  staff → ${staffEmail} / ${staffPassword}`);
}

main().catch((err) => {
  console.error("\n[seed:users] ❌ 실패");
  console.error("[seed:users] message:", err.message);
  if (err.stack) {
    console.error("[seed:users] stack:", err.stack);
  }
  process.exit(1);
});
