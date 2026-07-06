import {
  logAligoEnvDiagnostics,
  validateAligoSendEnvironment,
} from "./env";
import { isAligoVpsConfigured } from "./vps-client";
import {
  buildLogPayload,
  logAligoRetry,
  logAligoSend,
  type AligoLogPhase,
} from "./logging";
import {
  analyzeTemplateMismatch,
  logTemplateMismatchDebug,
  logAligoTemplateListFetch,
} from "./template-mismatch-debug.js";
import { runAligoRawTemplateCompareDebug } from "./template-raw-compare-debug.js";
import {
  sendAligoMessage,
} from "./aligo-send";
import { evaluateAligoSendResponse, logAligoSendResponseVerdict } from "./response";
import { classifyAligoFailure } from "./fail-reason";
import type { AligoFailReason } from "./fail-reason";
import {
  dumpAxiosError,
  extractErrorMessage,
} from "./http-transport-debug.js";
import {
  logAligoFail,
  logAligoFinal,
  summarizeAligoPayload,
} from "./ops-log";
import type { OrderTemplateData } from "./template-schema";
import {
  buildAligoSendPayload,
  normalizeOrderTemplateData,
  prepareAligoMessage,
  resolveTemplateType,
} from "./template-pipeline";
import type { AligoResponseLog } from "@/types/aligo-audit";
import {
  buildAligoAuditLog,
  buildAligoRequestPayloadSnapshot,
} from "./audit-log";
import {
  fetchRemoteTemplates,
  findRemoteTemplateByCode,
  resolveRemoteTemplate,
} from "./template-sync";

const DEBUG_HTTP = process.env.ALIGO_DEBUG_HTTP === "1";

export type SendOrderNotificationInput = OrderTemplateData & {
  templateType?: string;
};

export interface SendOrderNotificationResult {
  success: boolean;
  message: string;
  error?: string;
  missing?: string[];
  aligoCode?: number;
  aligoMessage?: string;
  mid?: string | number;
  templtCode?: string;
  missingFields?: string[];
  retryRecommended?: boolean;
  failReason?: AligoFailReason;
  failMessage?: string;
  auditLog?: AligoResponseLog;
}

export async function sendOrderNotification(
  input: SendOrderNotificationInput
): Promise<SendOrderNotificationResult> {
  const startedAt = Date.now();

  if (process.env.ALIGO_DEBUG_HTTP === "1") {
    logAligoEnvDiagnostics("Aligo:send");
  }

  const envValidation = validateAligoSendEnvironment();
  if (!envValidation.ok) {
    console.error("[Aligo:send] 발송 실패 —", envValidation.message);
    return {
      success: false,
      message: envValidation.message,
      error: "Aligo 환경변수 누락",
      missing: envValidation.missingKeys,
      failReason: "UNKNOWN_ERROR",
      failMessage: envValidation.message,
      auditLog: buildAligoAuditLog({
        success: false,
        errorMessage: envValidation.message,
      }),
    };
  }

  const sendEnv = envValidation.env;

  if (!isAligoVpsConfigured()) {
    const message = "ALIGO_API_URL (empty 또는 undefined)";
    console.error("[Aligo:send] 발송 실패 —", message);
    return {
      success: false,
      message: `Aligo VPS URL 누락: ${message}`,
      failReason: "UNKNOWN_ERROR",
      failMessage: message,
      auditLog: buildAligoAuditLog({
        success: false,
        errorMessage: message,
      }),
    };
  }

  const templateType = resolveTemplateType(input.templateType);
  const templateData = normalizeOrderTemplateData(input);

  try {
    const remoteTemplate = await resolveRemoteTemplate(templateType);

    const prepared = prepareAligoMessage(
      templateType,
      remoteTemplate,
      templateData
    );

    if (!prepared.validation.valid) {
      const phase: AligoLogPhase = "message_failed";

      await logAligoSend({
        phase,
        templateType,
        templtCode: remoteTemplate.templtCode,
        receiver: templateData.phone,
        variables: templateData,
        success: false,
        message: prepared.validation.message,
        failureReason: prepared.validation.message,
        preflightWarnings: prepared.preflight.warnings,
        durationMs: Date.now() - startedAt,
      });

      return {
        success: false,
        message: prepared.validation.message,
        missingFields: prepared.validation.missing,
        templtCode: remoteTemplate.templtCode,
        failReason: classifyAligoFailure({
          message: prepared.validation.message,
          isValidationError: true,
        }),
        failMessage: prepared.validation.message,
        auditLog: buildAligoAuditLog({
          success: false,
          templtCode: remoteTemplate.templtCode,
          templateType,
          finalMessage: prepared.resolved?.message,
          errorMessage: prepared.validation.message,
        }),
      };
    }

    if (prepared.preflight.warnings.length > 0) {
      console.warn("[Aligo] ⚠️ preflight 경고:", prepared.preflight.warnings);
    }

    const sendPayload = buildAligoSendPayload(prepared, {
      senderPhone: sendEnv.senderPhone,
      testMode: sendEnv.testMode,
    });

    const { templtCode } = prepared.resolved!;
    const safePayload = buildLogPayload({
      templateType,
      templtCode,
      receiver: sendPayload.receiver,
      recvname: sendPayload.recvname,
      subject: sendPayload.subject,
      messagePreview: sendPayload.message.slice(0, 80),
      testMode: String(sendEnv.testMode),
    } as Record<string, string>);

    if (DEBUG_HTTP) {
      console.log("[Aligo] 발송 요청:", {
        templtCode,
        receiver: sendPayload.receiver,
        messagePreview: sendPayload.message.slice(0, 80),
        testMode: sendEnv.testMode,
      });

      let apiFreshTempltContent = prepared.originalTemplate;
      let apiTemplate = sendPayload.debug?.apiTemplate ?? prepared.remoteTemplate;
      let apiTemplateListRaw = null;
      try {
        const { templates, message: listMessage } = await fetchRemoteTemplates();
        const freshTemplate = findRemoteTemplateByCode(templates, templtCode);

        logAligoTemplateListFetch("Next.js:send", {
          listMessage,
          totalCount: templates.length,
          matched: freshTemplate ?? null,
          availableCodes: templates.map((t) => t.templtCode),
          allTemplates: templates,
        });

        if (freshTemplate) {
          apiTemplateListRaw = freshTemplate;
          apiTemplate = freshTemplate;
          if (freshTemplate.templtContent) {
            apiFreshTempltContent = freshTemplate.templtContent;
          }
        }
      } catch (listError) {
        console.warn(
          "[Aligo:debug:Next.js:send] /akv10/template/list/ 조회 실패:",
          listError instanceof Error ? listError.message : listError
        );
      }

      const sendMismatchReport = analyzeTemplateMismatch({
        context: "Next.js:send",
        templtCode,
        originalTemplate: prepared.originalTemplate,
        apiFreshTempltContent,
        apiTemplate,
        apiTemplateListRaw: apiTemplateListRaw ?? undefined,
        finalMessage: sendPayload.message,
        sentButton: sendPayload.button,
        sentEmtitle: sendPayload.emtitle,
        sentSubject: sendPayload.subject,
        aligoFormPayload: {
          tpl_code: templtCode,
          message_1: sendPayload.message,
          button_1: sendPayload.button,
          emtitle_1: sendPayload.emtitle,
          subject_1: sendPayload.subject,
          receiver_1: sendPayload.receiver,
          recvname_1: sendPayload.recvname,
        },
        variables: sendPayload.variables,
        mappedSubstitutions: sendPayload.debug?.mappedSubstitutions,
        requiredPlaceholders: sendPayload.debug?.requiredPlaceholders,
      });
      logTemplateMismatchDebug("Next.js:send", sendMismatchReport, {
        tpl_code: templtCode,
        message_1: sendPayload.message,
        button_1: sendPayload.button,
        emtitle_1: sendPayload.emtitle,
        subject_1: sendPayload.subject,
        receiver_1: sendPayload.receiver,
        recvname_1: sendPayload.recvname,
      });

      runAligoRawTemplateCompareDebug({
        apiTemplate: apiTemplateListRaw ?? apiTemplate ?? undefined,
        tplCode: templtCode,
        message1: sendPayload.message,
        button1: sendPayload.button ?? null,
        mappedSubstitutions: sendPayload.debug?.mappedSubstitutions ?? {},
        aligoFormPayload: {
          tpl_code: templtCode,
          message_1: sendPayload.message,
          button_1: sendPayload.button,
          emtitle_1: sendPayload.emtitle,
          subject_1: sendPayload.subject,
          receiver_1: sendPayload.receiver,
          recvname_1: sendPayload.recvname,
          sender: sendPayload.sender,
        },
        variables: {
          missing: sendMismatchReport.missingVariables,
          nullOrEmpty: sendMismatchReport.nullOrEmptyFields,
        },
      });
    }

    const requestSnapshot = buildAligoRequestPayloadSnapshot(sendPayload);

    const result = await sendAligoMessage(sendPayload);
    const evaluation = evaluateAligoSendResponse(result);
    if (DEBUG_HTTP) {
      logAligoSendResponseVerdict("Next.js:send", result, evaluation);
    }
    const durationMs = Date.now() - startedAt;

    if (DEBUG_HTTP && evaluation.success && Number(evaluation.fcnt) > 0) {
      console.warn(
        "[Aligo:send] ⚠️ API code:0 이지만 fcnt>0 — 카카오 발송 실패 가능. rslt_message 로그 확인"
      );
    }

    if (DEBUG_HTTP && result.code === 0 && evaluation.success) {
      console.log(
        "[Aligo:send] API code:0 수신 — 실제 배달 결과는 [Aligo:delivery] rslt_message 로그 확인"
      );
    }

    if (evaluation.success) {
      logAligoFinal({
        success: true,
        endpoint: "/akv10/alimtalk/send/",
        aligo_code: evaluation.aligoCode,
      });

      await logAligoSend({
        phase: "success",
        templateType,
        templtCode,
        receiver: prepared.templateData.phone,
        variables: prepared.templateData,
        payload: safePayload,
        success: true,
        aligoCode: evaluation.aligoCode,
        message: evaluation.message,
        scnt: evaluation.scnt,
        fcnt: evaluation.fcnt,
        durationMs,
      });

      return {
        success: true,
        message: evaluation.message,
        aligoCode: evaluation.aligoCode,
        aligoMessage: evaluation.message,
        mid: result.info?.mid,
        templtCode,
        auditLog: buildAligoAuditLog({
          success: true,
          templtCode,
          templateType,
          finalMessage: sendPayload.message,
          subject: sendPayload.subject,
          requestPayload: requestSnapshot,
          responseBody: result as unknown as Record<string, unknown>,
          aligoCode: evaluation.aligoCode,
          scnt: evaluation.scnt,
          fcnt: evaluation.fcnt,
        }),
      };
    }

    const logEntry = await logAligoSend({
      phase: evaluation.partialFailure ? "api_partial_failure" : "api_failed",
      templateType,
      templtCode,
      receiver: prepared.templateData.phone,
      variables: prepared.templateData,
      payload: safePayload,
      success: false,
      aligoCode: evaluation.aligoCode,
      message: evaluation.message,
      failureReason: evaluation.message,
      retryRecommended: evaluation.retryRecommended,
      scnt: evaluation.scnt,
      fcnt: evaluation.fcnt,
      durationMs,
    });

    logAligoFail({
      failure_kind: "ALIGO_API",
      reason: evaluation.message,
      retry_count: 0,
      endpoint: "/akv10/alimtalk/send/",
      payload: summarizeAligoPayload({
        templtCode,
        message: sendPayload.message,
        button: sendPayload.button,
      }),
    });

    logAligoFinal({
      success: false,
      endpoint: "/akv10/alimtalk/send/",
      reason: evaluation.message,
      aligo_code: evaluation.aligoCode,
    });

    if (evaluation.retryRecommended) {
      await logAligoRetry(logEntry, evaluation.message);
    }

    return {
      success: false,
      message: evaluation.message,
      aligoCode: evaluation.aligoCode,
      aligoMessage: evaluation.message,
      templtCode,
      retryRecommended: evaluation.retryRecommended,
      failReason: classifyAligoFailure({
        message: evaluation.message,
        aligoCode: evaluation.aligoCode,
      }),
      failMessage: evaluation.message,
      auditLog: buildAligoAuditLog({
        success: false,
        templtCode,
        templateType,
        finalMessage: sendPayload.message,
        subject: sendPayload.subject,
        requestPayload: requestSnapshot,
        responseBody: result as unknown as Record<string, unknown>,
        errorMessage: evaluation.message,
        aligoCode: evaluation.aligoCode,
        scnt: evaluation.scnt,
        fcnt: evaluation.fcnt,
      }),
    };
  } catch (error) {
    if (process.env.ALIGO_DEBUG_HTTP === "1") {
      dumpAxiosError("Next.js:send (outer catch)", error);
    }

    const errorMessage = extractErrorMessage(error);

    await logAligoSend({
      phase: "exception",
      templateType,
      receiver: templateData.phone,
      variables: templateData,
      success: false,
      message: errorMessage,
      failureReason: errorMessage,
      retryRecommended: true,
      durationMs: Date.now() - startedAt,
    });

    logAligoFail({
      failure_kind: "NETWORK",
      reason: errorMessage,
      retry_count: 0,
      endpoint: "/akv10/alimtalk/send/",
    });
    logAligoFinal({
      success: false,
      endpoint: "/akv10/alimtalk/send/",
      reason: errorMessage,
    });

    return {
      success: false,
      message: errorMessage,
      retryRecommended: true,
      failReason: classifyAligoFailure({
        message: errorMessage,
        isNetworkError: true,
      }),
      failMessage: errorMessage,
      auditLog: buildAligoAuditLog({
        success: false,
        templateType,
        errorMessage,
      }),
    };
  }
}
