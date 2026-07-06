import type { AligoApiResponse } from "./client";

export interface AligoSendEvaluation {
  success: boolean;
  message: string;
  partialFailure?: boolean;
  retryRecommended?: boolean;
  scnt?: number;
  fcnt?: number;
  aligoCode: number;
}

const FAILURE_KEYWORDS = ["실패", "fail", "error", "오류"];

/**
 * Aligo API 응답 fail-safe 재검증
 * code=0 이더라도 scnt/fcnt·message 기준으로 실패 분리
 *
 * ⚠️ 실제 카카오 배달 성공/실패는 send API code가 아니라
 *    /akv10/history/detail/ 의 rslt_message 기준 (delivery-result.js)
 */
export function evaluateAligoSendResponse(
  result: AligoApiResponse
): AligoSendEvaluation {
  const scnt = result.info?.scnt;
  const fcnt = result.info?.fcnt;
  const aligoCode = result.code;

  if (aligoCode !== 0) {
    return {
      success: false,
      message: result.message || `Aligo API 오류 (code: ${aligoCode})`,
      retryRecommended: isRetryableCode(aligoCode),
      scnt,
      fcnt,
      aligoCode,
    };
  }

  if (typeof fcnt === "number" && fcnt > 0 && (scnt ?? 0) === 0) {
    return {
      success: false,
      message: `전송 전체 실패 (fcnt=${fcnt}): ${result.message}`,
      partialFailure: true,
      retryRecommended: true,
      scnt,
      fcnt,
      aligoCode,
    };
  }

  if (typeof fcnt === "number" && fcnt > 0) {
    return {
      success: false,
      message: `부분 실패 (성공 ${scnt ?? 0}건, 실패 ${fcnt}건): ${result.message}`,
      partialFailure: true,
      retryRecommended: true,
      scnt,
      fcnt,
      aligoCode,
    };
  }

  const lowerMessage = (result.message ?? "").toLowerCase();
  if (
    FAILURE_KEYWORDS.some((kw) => lowerMessage.includes(kw)) &&
    !lowerMessage.includes("성공")
  ) {
    return {
      success: false,
      message: `응답 메시지 실패 의심: ${result.message}`,
      retryRecommended: true,
      scnt,
      fcnt,
      aligoCode,
    };
  }

  return {
    success: true,
    message: result.message,
    scnt,
    fcnt,
    aligoCode,
  };
}

function isRetryableCode(code: number): boolean {
  // 일시적 오류로 간주되는 Aligo 코드 (네트워크/서버 부하 등)
  return [-99, -100, -101, 500, 503].includes(code);
}

/**
 * send API 응답 로그 — code:0 vs rslt_message 구분 명시 (발송 로직 변경 없음)
 */
export function logAligoSendResponseVerdict(
  context: string,
  result: AligoApiResponse,
  evaluation: AligoSendEvaluation
): void {
  const tag = `[Aligo:response:${context}]`;
  const mid = result.info?.mid;

  console.log(`${tag} ========== send API 응답 판정 ==========`);
  console.log(`${tag} API code:`, result.code);
  console.log(`${tag} API message:`, result.message);
  console.log(`${tag} scnt/fcnt:`, {
    scnt: result.info?.scnt,
    fcnt: result.info?.fcnt,
  });
  console.log(`${tag} mid (history/detail 조회용):`, mid ?? "(없음)");
  console.log(`${tag} evaluateAligoSendResponse → success:`, evaluation.success);
  console.log(`${tag} evaluateAligoSendResponse → message:`, evaluation.message);

  if (result.code === 0) {
    console.log(
      `${tag} ⚠️ API code:0 = Aligo 수신 성공 — 카카오 실제 배달 성공 여부는 rslt_message로 확인`
    );
    console.log(
      `${tag} → Proxy/Next.js 로그 [Aligo:delivery:*] 에서 rslt/rslt_message 비교 확인`
    );
  }

  if (result.code === 0 && evaluation.success && Number(result.info?.fcnt) > 0) {
    console.warn(
      `${tag} 🔴 API code:0 + fcnt>0 — 즉시 실패 징후, rslt_message 확인 권장`
    );
  }

  if (result.code === 0 && evaluation.success) {
    console.log(
      `${tag} pre-send + API 수신 기준 success — 간헐적 실패는 history/detail rslt_message mismatch 추적`
    );
  }

  console.log(`${tag} =====================================`);
}
