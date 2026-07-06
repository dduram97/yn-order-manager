import { NextResponse } from "next/server";
import {
  getAligoEnvCheck,
  getUnsetAligoEnvKeys,
  ALIGO_CORE_ENV_KEYS,
} from "@/lib/aligo/env";
import { checkAligoApiReachable } from "@/lib/aligo/aligo-send";

/** GET /api/aligo/env-check — Vercel env + VPS health */
export async function GET() {
  const env = getAligoEnvCheck();
  const missing = getUnsetAligoEnvKeys(ALIGO_CORE_ENV_KEYS);
  const vpsHealthy =
    missing.length === 0 ? await checkAligoApiReachable() : false;

  const allCoreSet = missing.length === 0;

  return NextResponse.json({
    ...env,
    allCoreSet,
    missing,
    vpsHealthy,
    aligoApiReachable: vpsHealthy,
    success: allCoreSet && vpsHealthy,
  });
}
