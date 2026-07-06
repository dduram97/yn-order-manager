import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

export function isBcryptHash(value: string): boolean {
  return BCRYPT_HASH_PATTERN.test(value);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  const hashLooksValid = isBcryptHash(passwordHash);
  console.log("[auth/password] verifyPassword:", {
    hashLooksValid,
    hashPrefix: passwordHash?.slice(0, 7) ?? null,
    hashLength: passwordHash?.length ?? 0,
  });

  if (!hashLooksValid) {
    console.warn(
      "[auth/password] password_hash가 bcrypt 형식이 아닙니다 ($2a/$2b/$2y$...)"
    );
    return false;
  }

  const valid = await bcrypt.compare(password, passwordHash);
  console.log("[auth/password] bcrypt.compare 결과:", valid);
  return valid;
}
