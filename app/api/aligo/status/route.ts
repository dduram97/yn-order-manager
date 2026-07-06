import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  getAligoEnvCheck,
  getUnsetAligoEnvKeys,
  ALIGO_CORE_ENV_KEYS,
} from "@/lib/aligo/env";
import { checkAligoApiReachable } from "@/lib/aligo/aligo-send";
import { LOCAL_TEMPLATE_FALLBACKS } from "@/lib/aligo/templates";
import { verifyAllTemplatesAgainstSchema } from "@/lib/aligo/template-validator";
import {
  fetchRemoteTemplates,
  verifyTemplatesAgainstLocal,
} from "@/lib/aligo/template-sync";

/**
 * GET /api/aligo/status
 * - ?verify=true : 대시보드 템플릿 vs 로컬 fallback 비교
 */
export async function GET(request: Request) {
  const auth = await requireAuth({ adminOnly: true });
  if (auth.error) return auth.error;

  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const verify = searchParams.get("verify") === "true";

  const envCheck = getAligoEnvCheck();
  const missingEnvKeys = getUnsetAligoEnvKeys(ALIGO_CORE_ENV_KEYS);
  const vpsHealthy =
    missingEnvKeys.length === 0 ? await checkAligoApiReachable() : false;

  const preflight = {
    envCheck,
    missingEnvKeys,
    vpsHealthy,
    aligoApiReachable: vpsHealthy,
    ready: missingEnvKeys.length === 0 && vpsHealthy,
  };

  if (missingEnvKeys.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Aligo/VPS 환경변수 누락",
        missing: missingEnvKeys,
        preflight,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }

  if (!vpsHealthy) {
    return NextResponse.json(
      {
        success: false,
        error: "VPS Aligo 서버 연결 실패",
        message:
          "VPS /api/aligo/health 응답 실패 — PM2 aligo-proxy 및 env 확인",
        preflight,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 503 }
    );
  }

  try {
    console.log("[GET /api/aligo/status] VPS 템플릿 조회 시작...");

    const { templates, message } = await fetchRemoteTemplates();

    const response: Record<string, unknown> = {
      success: true,
      message,
      count: templates.length,
      templates: templates.map((t) => ({
        templtCode: t.templtCode,
        templtName: t.templtName,
        templtTitle: t.templtTitle,
        inspStatus: t.inspStatus,
        status: t.status,
        templtContent: t.templtContent,
      })),
      preflight,
      elapsedMs: Date.now() - startedAt,
    };

    if (verify) {
      const verification = verifyTemplatesAgainstLocal(
        templates,
        LOCAL_TEMPLATE_FALLBACKS
      );
      const schemaVerification = verifyAllTemplatesAgainstSchema(templates);
      response.verification = verification;
      response.schemaVerification = schemaVerification;
      response.allTemplatesMatch = verification.every(
        (v) => v.contentMatch === true || v.syncRequired
      );
      response.allSchemaValid = schemaVerification.every((v) => v.operational);
    }

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        message,
        preflight,
        hint: "VPS aligo-proxy 실행 및 Aligo IP 허용(VPS 고정 IP) 확인",
        elapsedMs: Date.now() - startedAt,
      },
      { status: 503 }
    );
  }
}
