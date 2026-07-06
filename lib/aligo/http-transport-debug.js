/**
 * Aligo HTTP transport 디버그 — axios/fetch 요청·응답·에러 raw dump
 * 발송 로직 변경 없음, 로그만 추가
 */

const OUT = "[Aligo:debug:http:outgoing]";
const RES = "[Aligo:debug:http:response]";
const ERR = "[Aligo:debug:http:error]";
const FMT = "[Aligo:debug:http:format]";
const FINAL = "[Aligo:debug:http:FINAL]";
const DEBUG_HTTP = process.env.ALIGO_DEBUG_HTTP === "1";

const SECRET_KEYS = new Set([
  "apikey",
  "api_key",
  "password",
  "token",
  "authorization",
]);

function redactValue(key, value) {
  if (SECRET_KEYS.has(String(key).toLowerCase())) {
    const str = String(value ?? "");
    return `[REDACTED len=${str.length}]`;
  }
  return value;
}

function redactObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = redactValue(key, value);
  }
  return out;
}

function safeJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function byteLength(str) {
  return Buffer.byteLength(String(str ?? ""), "utf8");
}

function isAxiosError(error) {
  return Boolean(error?.isAxiosError);
}

function parseFormBodyPreview(body) {
  if (typeof body !== "string") return { type: typeof body, preview: safeJson(body) };
  const params = new URLSearchParams(body);
  const keys = [...params.keys()];
  const preview = {};
  for (const key of keys) {
    const val = params.get(key) ?? "";
    preview[key] = redactValue(key, val.length > 200 ? `${val.slice(0, 200)}…[len=${val.length}]` : val);
  }
  return {
    type: "application/x-www-form-urlencoded",
    fieldCount: keys.length,
    byteLength: byteLength(body),
    fields: keys,
    preview,
  };
}

function logOutgoingHttpRequest(context, config) {
  if (!DEBUG_HTTP) return;
  const {
    method = "POST",
    url,
    headers = {},
    body,
    bodyEncoding = "unknown",
  } = config;

  console.log(`${OUT} ========== ${context} ==========`);
  console.log(`${OUT} method:`, method);
  console.log(`${OUT} url:`, url);
  console.log(`${OUT} headers:`, redactObject(headers));
  console.log(`${OUT} body encoding:`, bodyEncoding);

  if (bodyEncoding === "application/x-www-form-urlencoded" && typeof body === "string") {
    const parsed = parseFormBodyPreview(body);
    console.log(`${OUT} form body byteLength:`, parsed.byteLength);
    console.log(`${OUT} form fields:`, parsed.fields);
    console.log(`${OUT} form body preview (redacted):`, parsed.preview);
    console.log(`${OUT} form body raw (first 2000 chars):`);
    console.log(String(body).slice(0, 2000));
    if (body.length > 2000) {
      console.log(`${OUT} ... truncated, total ${body.length} chars`);
    }
  } else if (bodyEncoding === "application/json") {
    const jsonStr = typeof body === "string" ? body : safeJson(body);
    console.log(`${OUT} json body byteLength:`, byteLength(jsonStr));
    console.log(`${OUT} json body preview:`, typeof body === "object" ? redactObject(body) : jsonStr.slice(0, 2000));
  } else {
    console.log(`${OUT} body preview:`, typeof body === "string" ? body.slice(0, 500) : body);
  }

  console.log(`${OUT} ========================================`);
}

function logIncomingHttpResponse(context, response) {
  if (!DEBUG_HTTP) return;
  const { status, statusText, headers = {}, data, rawBody } = response;

  console.log(`${RES} ========== ${context} ==========`);
  console.log(`${RES} HTTP status:`, status, statusText ?? "");
  console.log(`${RES} headers:`, headers);
  console.log(`${RES} response body (parsed):`, data);
  if (rawBody != null) {
    console.log(`${RES} response body raw:`, String(rawBody).slice(0, 4000));
    console.log(`${RES} response body byteLength:`, byteLength(rawBody));
  }
  console.log(`${RES} ========================================`);
}

function classifyHttpFailure(error) {
  if (!error) {
    return { kind: "UNKNOWN", detail: "error is null/undefined" };
  }

  if (isAxiosError(error)) {
    const code = error.code ?? null;
    const status = error.response?.status ?? null;

    if (code === "ECONNABORTED" || code === "ETIMEDOUT") {
      return { kind: "TIMEOUT", detail: error.message || code, code, status };
    }
    if (code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EHOSTUNREACH") {
      return { kind: "CONNECTION_REFUSED", detail: error.message || code, code, status };
    }
    if (status != null && status >= 500) {
      return { kind: "HTTP_5XX", detail: error.message, code, status };
    }
    if (status != null && status >= 400) {
      return { kind: "HTTP_4XX", detail: error.message, code, status };
    }
    if (error.response) {
      return { kind: "HTTP_ERROR_WITH_RESPONSE", detail: error.message, code, status };
    }
    if (error.request && !error.response) {
      return { kind: "NO_RESPONSE", detail: error.message || "request sent, no response", code, status };
    }
    return { kind: "AXIOS_ERROR", detail: error.message || code || "axios error", code, status };
  }

  if (error instanceof Error) {
    return {
      kind: "GENERIC_ERROR",
      detail: error.message || "(empty Error.message)",
      name: error.name,
    };
  }

  return { kind: "NON_ERROR_THROW", detail: safeJson(error) };
}

function dumpAxiosError(context, error) {
  const classification = classifyHttpFailure(error);

  if (!DEBUG_HTTP) {
    return classification;
  }

  console.error(`${ERR} ========== ${context} ==========`);
  console.error(`${ERR} classification:`, classification);

  if (isAxiosError(error)) {
    console.error(`${ERR} axios.message:`, error.message || "(empty)");
    console.error(`${ERR} axios.code:`, error.code ?? "(none)");
    console.error(`${ERR} axios.name:`, error.name);
    console.error(`${ERR} config.method:`, error.config?.method);
    console.error(`${ERR} config.url:`, error.config?.url);
    console.error(`${ERR} config.timeout:`, error.config?.timeout);
    console.error(`${ERR} config.headers:`, redactObject(error.config?.headers ?? {}));

    if (error.config?.data != null) {
      const data = error.config.data;
      if (typeof data === "string" && data.includes("=")) {
        console.error(`${ERR} config.data (form preview):`, parseFormBodyPreview(data).preview);
      } else {
        console.error(`${ERR} config.data:`, typeof data === "string" ? data.slice(0, 1000) : data);
      }
    }

    if (error.response) {
      console.error(`${ERR} response.status:`, error.response.status);
      console.error(`${ERR} response.statusText:`, error.response.statusText);
      console.error(`${ERR} response.headers:`, error.response.headers);
      console.error(`${ERR} response.data:`, error.response.data);
      try {
        console.error(`${ERR} response.data raw:`, safeJson(error.response.data));
      } catch {
        /* ignore */
      }
    } else {
      console.error(`${ERR} response: (none — request may not have reached server)`);
    }

    if (error.request) {
      console.error(`${ERR} request: present (socket opened)`);
      console.error(`${ERR} request path:`, error.request?.path ?? error.request?._currentUrl ?? "(unknown)");
    } else {
      console.error(`${ERR} request: (none — failed before send)`);
    }
  } else if (error instanceof Error) {
    console.error(`${ERR} error.name:`, error.name);
    console.error(`${ERR} error.message:`, error.message || "(empty)");
    console.error(`${ERR} error.stack:`, error.stack);
  } else {
    console.error(`${ERR} non-Error throw:`, error);
  }

  console.error(`${ERR} full error object:`, safeJson({
    message: error?.message,
    code: error?.code,
    name: error?.name,
    isAxiosError: error?.isAxiosError,
    status: error?.response?.status,
    responseMessage: error?.response?.data?.message,
    aligoCode: error?.response?.data?.code,
  }));

  console.error(`${ERR} ========================================`);

  return classification;
}

function logAligoFormFormatCheck(context, formPayload) {
  const required = [
    "apikey",
    "userid",
    "senderkey",
    "tpl_code",
    "sender",
    "receiver_1",
    "recvname_1",
    "subject_1",
    "message_1",
  ];

  const missing = required.filter((key) => {
    const val = formPayload?.[key];
    return val == null || String(val).trim() === "";
  });

  const message1 = String(formPayload?.message_1 ?? "");
  const button1 = formPayload?.button_1;

  let buttonParseOk = null;
  let buttonShape = null;
  if (button1) {
    try {
      const parsed = JSON.parse(String(button1));
      buttonParseOk = true;
      buttonShape = {
        hasButtonArray: Array.isArray(parsed?.button),
        count: Array.isArray(parsed?.button) ? parsed.button.length : 0,
      };
    } catch (e) {
      buttonParseOk = false;
      buttonShape = { parseError: e instanceof Error ? e.message : String(e) };
    }
  }

  if (DEBUG_HTTP) {
    console.log(`${FMT} ========== Aligo API format check (${context}) ==========`);
    console.log(`${FMT} transport: application/x-www-form-urlencoded (NOT JSON)`);
    console.log(`${FMT} endpoint pattern: POST /akv10/alimtalk/send/`);
    console.log(`${FMT} required fields missing:`, missing.length ? missing : "(none)");
    console.log(`${FMT} tpl_code:`, formPayload?.tpl_code ?? "(missing)");
    console.log(`${FMT} message_1 byteLength:`, byteLength(message1));
    console.log(`${FMT} message_1 CRLF count:`, (message1.match(/\r\n/g) ?? []).length);
    console.log(`${FMT} message_1 LF-only count:`, (message1.match(/(?<!\r)\n/g) ?? []).length);
    console.log(`${FMT} button_1 present:`, Boolean(button1));
    console.log(`${FMT} button_1 type:`, button1 == null ? "null" : typeof button1);
    console.log(`${FMT} button_1 is JSON string:`, button1 == null ? "n/a" : typeof button1 === "string");
    console.log(`${FMT} button_1 JSON.parse ok:`, buttonParseOk);
    console.log(`${FMT} button_1 shape:`, buttonShape);
    console.log(`${FMT} button_1 byteLength:`, button1 ? byteLength(String(button1)) : 0);
    console.log(`${FMT} emtitle_1:`, formPayload?.emtitle_1 ?? "(not sent)");
    console.log(`${FMT} testMode:`, formPayload?.testMode ?? "(not sent)");
    console.log(`${FMT} ========================================`);
  }

  return { missing, buttonParseOk, buttonShape };
}

function logHttpTransportFinalResult(context, input) {
  if (!DEBUG_HTTP) return;
  const {
    hop,
    success,
    classification,
    httpStatus,
    aligoCode,
    aligoMessage,
    note,
  } = input;

  console.log(`${FINAL} ========== ${context} ==========`);
  console.log(`${FINAL} hop:`, hop);
  console.log(`${FINAL} success:`, success);
  console.log(`${FINAL} http_status:`, httpStatus ?? "(none)");
  console.log(`${FINAL} aligo_code:`, aligoCode ?? "(none)");
  console.log(`${FINAL} aligo_message:`, aligoMessage ?? "(none)");
  console.log(`${FINAL} failure_kind:`, classification?.kind ?? "(none)");
  console.log(`${FINAL} failure_detail:`, classification?.detail ?? "(none)");
  console.log(`${FINAL} note:`, note ?? "");
  console.log(`${FINAL} pre-send template compare: NOT APPLICABLE for HTTP failures`);
  console.log(`${FINAL} ========================================`);
}

function extractErrorMessage(error) {
  if (!error) return "unknown error";
  if (isAxiosError(error)) {
    const data = error.response?.data;
    const fromBody =
      (typeof data === "object" && data?.message ? String(data.message) : "") ||
      (typeof data === "string" ? data.slice(0, 200) : "");
    return (
      fromBody ||
      error.message ||
      error.code ||
      `HTTP ${error.response?.status ?? "?"}` ||
      "axios error (empty message)"
    );
  }
  if (error instanceof Error) {
    return error.message || `${error.name} (empty message)`;
  }
  return String(error);
}

module.exports = {
  logOutgoingHttpRequest,
  logIncomingHttpResponse,
  dumpAxiosError,
  classifyHttpFailure,
  logAligoFormFormatCheck,
  logHttpTransportFinalResult,
  extractErrorMessage,
  parseFormBodyPreview,
  isAxiosError,
};
