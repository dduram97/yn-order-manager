const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const axios = require("axios");

const ALIGO_BASE = "https://kakaoapi.aligo.in";
const ALIGO_SEND_URL = `${ALIGO_BASE}/akv10/alimtalk/send/`;
const ALIGO_TEMPLATE_LIST_URL = `${ALIGO_BASE}/akv10/template/list/`;
const PORT = Number(process.env.PORT) || 4000;
const VPS_SECRET = process.env.ALIGO_VPS_SECRET?.trim();

const REQUIRED_ENV = ["ALIGO_API_KEY", "ALIGO_USER_ID", "ALIGO_SENDER_KEY"];

function envStatus(key) {
  const v = process.env[key];
  if (v === undefined) return "undefined";
  if (String(v).trim() === "") return "empty";
  return "set";
}

function missingEnv(keys = REQUIRED_ENV) {
  return keys.filter((k) => envStatus(k) !== "set");
}

function getCredentials() {
  const missing = missingEnv();
  if (missing.length > 0) {
    const err = new Error(`Aligo env 누락: ${missing.join(", ")}`);
    err.statusCode = 500;
    throw err;
  }
  return {
    apiKey: process.env.ALIGO_API_KEY.trim(),
    userId: process.env.ALIGO_USER_ID.trim(),
    senderKey: process.env.ALIGO_SENDER_KEY.trim(),
  };
}

function authPayload(credentials) {
  return {
    apikey: credentials.apiKey,
    userid: credentials.userId,
    senderkey: credentials.senderKey,
  };
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    const err = new Error(`${name} (empty 또는 undefined)`);
    err.statusCode = 400;
    throw err;
  }
  return value.trim();
}

function buildAligoFormPayload(body) {
  const credentials = getCredentials();
  const payload = {
    ...authPayload(credentials),
    tpl_code: requireString(body.templtCode, "templtCode"),
    sender: requireString(body.sender, "sender").replace(/[\s-]/g, ""),
    receiver_1: requireString(body.receiver, "receiver").replace(/[\s-]/g, ""),
    recvname_1: requireString(body.recvname, "recvname"),
    subject_1: requireString(body.subject, "subject"),
    message_1: requireString(body.message, "message"),
  };

  if (typeof body.button === "string" && body.button.trim()) {
    payload.button_1 = body.button;
  }
  if (typeof body.emtitle === "string" && body.emtitle.trim()) {
    payload.emtitle_1 = body.emtitle;
  }
  if (body.testMode === true || body.testMode === "Y") {
    payload.testMode = "Y";
  }

  return payload;
}

function verifyVpsSecret(req, res, next) {
  if (!VPS_SECRET) return next();
  const header = req.headers["x-aligo-vps-secret"];
  if (header !== VPS_SECRET) {
    return res.status(401).json({
      success: false,
      code: -1,
      message: "Unauthorized",
    });
  }
  return next();
}

const app = express();
app.use(express.json({ limit: "1mb" }));

app.get("/api/aligo/health", healthHandler);
app.get("/health", healthHandler);

function healthHandler(_req, res) {
  const missing = missingEnv();
  res.json({
    success: missing.length === 0,
    message:
      missing.length === 0
        ? "aligo-proxy VPS is running"
        : `환경변수 누락: ${missing.join(", ")}`,
    env: Object.fromEntries(
      [...REQUIRED_ENV, "ALIGO_SENDER_PHONE", "ALIGO_TEST_MODE"].map((k) => [
        k,
        envStatus(k),
      ])
    ),
  });
}

app.get("/api/aligo/templates", verifyVpsSecret, async (_req, res) => {
  try {
    if (missingEnv().length > 0) {
      return res.status(500).json({
        success: false,
        code: -99,
        message: `Aligo env 누락: ${missingEnv().join(", ")}`,
      });
    }
    const credentials = getCredentials();
    const response = await axios.post(
      ALIGO_TEMPLATE_LIST_URL,
      new URLSearchParams(authPayload(credentials)).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      }
    );
    const data = response.data;
    if (data.code !== 0 || !data.list) {
      return res.status(502).json({
        success: false,
        code: data.code ?? -99,
        message: data.message || "템플릿 목록 조회 실패",
      });
    }
    return res.json({
      success: true,
      message: data.message,
      templates: data.list,
    });
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    console.error("[VPS:aligo/templates]", message);
    return res.status(500).json({
      success: false,
      code: -99,
      message,
    });
  }
});

app.post("/api/aligo/send", verifyVpsSecret, async (req, res) => {
  try {
    if (missingEnv().length > 0) {
      return res.status(500).json({
        success: false,
        code: -99,
        message: `Aligo env 누락: ${missingEnv().join(", ")}`,
      });
    }

    const aligoPayload = buildAligoFormPayload(req.body ?? {});
    const formBody = new URLSearchParams(aligoPayload).toString();

    const response = await axios.post(ALIGO_SEND_URL, formBody, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 20000,
      validateStatus: () => true,
    });

    console.log(
      `[VPS:aligo/send] code=${response.data?.code} msg=${response.data?.message}`
    );

    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.statusCode || error.response?.status || 500;
    const message = error.response?.data?.message || error.message;
    console.error("[VPS:aligo/send] FAIL:", message);
    console.error("[ALIGO:FAIL]");
    console.error(`- failure_kind: ${error.statusCode === 400 ? "ALIGO_API" : "NETWORK"}`);
    console.error(`- reason: ${message}`);
    console.error("- endpoint: /api/aligo/send");

    if (error.response?.data) {
      return res.status(status).json(error.response.data);
    }
    return res.status(status).json({ code: -99, message, info: null });
  }
});

app.use((_req, res) => {
  res.status(404).json({ success: false, code: -1, message: "Not Found" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[VPS] Aligo proxy listening on port ${PORT}`);
  console.log(`[VPS] POST /api/aligo/send  GET /api/aligo/health`);
  const missing = missingEnv();
  if (missing.length > 0) {
    console.error(`[VPS] ⚠️ env 누락: ${missing.join(", ")}`);
  }
});
