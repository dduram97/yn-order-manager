/**
 * Aligo /akv10/history/detail/ — rslt_message 기준 실제 카카오 배달 결과 판정 (로그 전용)
 */

const ALIGO_HISTORY_DETAIL_URL =
  "https://kakaoapi.aligo.in/akv10/history/detail/";

const DELIVERY_SUCCESS_RSLT = new Set(["0"]);
const DELIVERY_FAILURE_RSLT = new Set(["U", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * API code:0 수신 ≠ 카카오 배달 성공.
 * rslt / rslt_message 가 실제 성공·실패 판단 기준.
 */
function evaluateDeliveryByRsltMessage(detailItem) {
  if (!detailItem || typeof detailItem !== "object") {
    return {
      verdict: "unknown",
      deliverySuccess: false,
      deliveryFailed: false,
      pending: true,
      rslt: null,
      rsltMessage: null,
      msgid: null,
      reason: "detail 항목 없음",
      apiCodeMisleading: null,
    };
  }

  const rslt = detailItem.rslt != null ? String(detailItem.rslt) : "";
  const rsltMessage =
    detailItem.rslt_message != null ? String(detailItem.rslt_message).trim() : "";
  const msgid = detailItem.msgid != null ? String(detailItem.msgid) : "";

  const pending =
    msgid.startsWith("Q") ||
    (!rslt && !rsltMessage && !detailItem.rsltdate);

  if (pending) {
    return {
      verdict: "pending",
      deliverySuccess: false,
      deliveryFailed: false,
      pending: true,
      rslt: rslt || null,
      rsltMessage: rsltMessage || null,
      msgid: msgid || null,
      reason: "전송 결과 대기 중 (msgid=Q prefix 또는 rslt/rslt_message 미수신)",
      apiCodeMisleading: true,
    };
  }

  const deliverySuccess =
    DELIVERY_SUCCESS_RSLT.has(rslt) && rsltMessage === "";

  const deliveryFailed =
    DELIVERY_FAILURE_RSLT.has(rslt) ||
    (rsltMessage.length > 0 && !deliverySuccess);

  let verdict = "unknown";
  if (deliverySuccess) verdict = "success";
  else if (deliveryFailed) verdict = "failed";

  return {
    verdict,
    deliverySuccess,
    deliveryFailed,
    pending: false,
    rslt: rslt || null,
    rsltMessage: rsltMessage || null,
    msgid: msgid || null,
    reason:
      verdict === "success"
        ? "rslt=0, rslt_message 없음"
        : rsltMessage || `rslt=${rslt || "(empty)"}`,
    apiCodeMisleading: verdict === "failed",
    tplCode: detailItem.tpl_code ?? null,
    sentMessage: detailItem.message ?? null,
    buttonJson: detailItem.button_json ?? null,
    rsltdate: detailItem.rsltdate ?? null,
  };
}

/**
 * @param {{ apikey: string, userid: string }} credentials
 */
async function fetchAligoHistoryDetail(credentials, mid, page = 1, limit = 50) {
  const axios = require("axios");

  const response = await axios.post(
    ALIGO_HISTORY_DETAIL_URL,
    new URLSearchParams({
      apikey: credentials.apikey ?? credentials.apiKey,
      userid: credentials.userid ?? credentials.userId,
      mid: String(mid),
      page: String(page),
      limit: String(limit),
    }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 15000,
    }
  );

  return response.data;
}

const {
  confirmRootCauseFromLogs,
  buildThreeWayDiff,
  logThreeWayDiff,
} = require("./template-mismatch-debug.js");

function logAligoApiCodeVsDelivery(context, apiSendResult, deliveryEvaluations, options = {}) {
  const tag = `[Aligo:delivery:${context}]`;
  const mismatchReport = options.preSendMismatchReport ?? null;
  const apiCode = apiSendResult?.code;
  const apiMessage = apiSendResult?.message ?? "";
  const mid = apiSendResult?.info?.mid ?? null;
  const scnt = apiSendResult?.info?.scnt;
  const fcnt = apiSendResult?.info?.fcnt;

  console.log(`${tag} ========== API code vs rslt_message ==========`);
  console.log(`${tag} send API code:`, apiCode);
  console.log(`${tag} send API message:`, apiMessage);
  console.log(`${tag} send API scnt/fcnt:`, { scnt, fcnt });
  console.log(`${tag} mid:`, mid);

  const apiSaysSuccess = apiCode === 0;
  console.log(
    `${tag} ⚠️ API code:0 수신 성공 ≠ 카카오 배달 성공 — rslt_message 기준으로 재판정`
  );

  if (!deliveryEvaluations || deliveryEvaluations.length === 0) {
    console.warn(`${tag} history/detail 결과 없음 — rslt_message 확인 불가`);
    if (apiSaysSuccess) {
      console.warn(
        `${tag} 🔴 API code:0 이지만 배달 결과 미확인 — 간헐적 실패 추적 시 history/detail 재조회 필요`
      );
    }
    console.log(`${tag} =============================================`);
    return;
  }

  for (const item of deliveryEvaluations) {
    const evalResult = item.evaluation;
    const detail = item.detail;

    console.log(`${tag} --- detail item ---`);
    console.log(`${tag} phone:`, detail?.phone);
    console.log(`${tag} msgid:`, detail?.msgid);
    console.log(`${tag} rslt:`, evalResult.rslt);
    console.log(`${tag} rslt_message:`, evalResult.rsltMessage ?? "(없음)");
    console.log(`${tag} rsltdate:`, evalResult.rsltdate);
    console.log(`${tag} tpl_code:`, evalResult.tplCode);
    console.log(`${tag} verdict (rslt_message 기준):`, evalResult.verdict);

    if (apiSaysSuccess && evalResult.deliveryFailed) {
      console.error(
        `${tag} 🔴 MISMATCH: API code:0 수신 → rslt_message 실패 — ${evalResult.reason}`
      );

      if (mismatchReport) {
        const confirmed = confirmRootCauseFromLogs(mismatchReport, detail ?? null);
        logThreeWayDiff(
          `${context} (rslt_message)`,
          buildThreeWayDiff(mismatchReport, detail ?? null),
          confirmed
        );
      }

      if (detail?.message) {
        console.error(`${tag} Aligo history 기록 message:`, detail.message);
      }
      if (detail?.button_json) {
        console.error(`${tag} Aligo history 기록 button_json:`, detail.button_json);
      }
    } else if (apiSaysSuccess && evalResult.deliverySuccess) {
      console.log(`${tag} 🟢 rslt_message 기준 배달 성공 확인`);
    } else if (apiSaysSuccess && evalResult.pending) {
      console.warn(
        `${tag} 🟡 API code:0, 배달 결과 pending — ${evalResult.reason}`
      );
    } else if (!apiSaysSuccess && evalResult.deliveryFailed) {
      console.warn(`${tag} 🔴 API 실패 + rslt_message 실패 일치`);
    }
  }

  console.log(`${tag} =============================================`);
}

/**
 * 발송 직후 비동기로 history/detail 조회 (응답 지연 없음)
 */
async function pollAndLogDeliveryResult(context, credentials, apiSendResult, options = {}) {
  const mid = apiSendResult?.info?.mid;
  if (!mid) {
    logAligoApiCodeVsDelivery(context, apiSendResult, [], options);
    return;
  }

  const delays = options.delaysMs ?? [1500, 3000];
  const tag = `[Aligo:delivery:${context}]`;

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    await sleep(delays[attempt]);

    try {
      const detailResponse = await fetchAligoHistoryDetail(credentials, mid);
      const list = detailResponse?.list ?? [];

      if (detailResponse?.code !== 0) {
        console.warn(
          `${tag} history/detail API code ${detailResponse?.code}:`,
          detailResponse?.message
        );
        continue;
      }

      if (list.length === 0) {
        console.warn(`${tag} attempt ${attempt + 1}: detail list 비어있음 (pending)`);
        continue;
      }

      const deliveryEvaluations = list.map((detail) => ({
        detail,
        evaluation: evaluateDeliveryByRsltMessage(detail),
      }));

      const allResolved = deliveryEvaluations.every((item) => !item.evaluation.pending);

      logAligoApiCodeVsDelivery(context, apiSendResult, deliveryEvaluations, options);

      if (allResolved) return;
    } catch (error) {
      console.warn(
        `${tag} history/detail 조회 실패 (attempt ${attempt + 1}):`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.warn(
    `${tag} ${delays.length}회 조회 후에도 rslt_message pending — 나중에 mid=${mid} 로 재조회`
  );
}

module.exports = {
  evaluateDeliveryByRsltMessage,
  fetchAligoHistoryDetail,
  logAligoApiCodeVsDelivery,
  pollAndLogDeliveryResult,
};
