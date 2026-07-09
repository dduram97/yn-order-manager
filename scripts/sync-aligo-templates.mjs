/**
 * Aligo 대시보드 템플릿 동기화
 * - templates.ts LOCAL_TEMPLATE_FALLBACKS 갱신
 * - dashboard-snapshot.json 스냅샷 갱신 (SSOT)
 *
 * 사용법: npm run aligo:sync-templates
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TEMPLATES_FILE = path.join(ROOT, "lib/aligo/templates.ts");
const SNAPSHOT_FILE = path.join(ROOT, "lib/aligo/dashboard-snapshot.json");
const ENV_FILE = path.join(ROOT, ".env.local");

const TEMPLATE_TYPES = ["택배발송알림", "선물보내는분 알림", "선물받는분 알림"];

const TEMPLATE_CODES = {
  "택배발송알림": "UF_9460",
  "선물보내는분 알림": "UJ_3622",
  "선물받는분 알림": "UG_8203",
};

const PLACEHOLDER_PATTERN = /#\{[^}]+\}/g;

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return env;
}

function loadSnapshot() {
  return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf8"));
}

function getTemplateCode(templateType, env) {
  const codeKey = `ALIGO_TPL_CODE_${templateType.replace(/\s/g, "_")}`;
  return env[codeKey] || TEMPLATE_CODES[templateType];
}

function findTemplate(templates, templateType, env) {
  const templtCode = getTemplateCode(templateType, env);
  return templates.find((t) => t.templtCode === templtCode) ?? null;
}

function extractPlaceholders(content) {
  const matches = (content || "").match(PLACEHOLDER_PATTERN) ?? [];
  return [...new Set(matches)];
}

function buildFallbacksBlock(fallbacks) {
  const lines = TEMPLATE_TYPES.map((type) => {
    const key = type.includes(" ") ? `"${type}"` : type;
    return `  ${key}: ${JSON.stringify(fallbacks[type] ?? "")},`;
  });
  return `export const LOCAL_TEMPLATE_FALLBACKS: Record<AligoTemplateType, string> = {\n${lines.join("\n")}\n};`;
}

async function main() {
  const env = loadEnv();
  const snapshot = loadSnapshot();
  const ALIGO_API_URL = env.ALIGO_API_URL?.replace(/\/$/, "");

  if (!ALIGO_API_URL) {
    console.error("❌ ALIGO_API_URL (VPS 주소)가 필요합니다.");
    process.exit(1);
  }

  const headers = { "Content-Type": "application/json" };
  if (env.ALIGO_VPS_SECRET) {
    headers["X-Aligo-Vps-Secret"] = env.ALIGO_VPS_SECRET;
  }

  console.log("VPS Aligo 템플릿 목록 조회 중...");
  const { data } = await axios.get(`${ALIGO_API_URL}/api/aligo/templates`, {
    headers,
    timeout: 15000,
  });

  if (!data.success || !data.templates) {
    console.error("❌ VPS API 오류:", data.message);
    process.exit(1);
  }

  const list = data.templates;
  console.log(`✅ ${list.length}개 템플릿 조회됨\n`);

  const fallbacks = {};
  const nextSnapshot = { syncedAt: new Date().toISOString(), templates: {} };
  const report = [];

  for (const type of TEMPLATE_TYPES) {
    const expectedCode = getTemplateCode(type, env);
    const found = findTemplate(list, type, env);

    if (!found) {
      report.push({ type, status: "NOT_FOUND", expectedCode });
      fallbacks[type] = "";
      nextSnapshot.templates[type] = snapshot.templates[type] ?? {
        templtCode: expectedCode,
        placeholders: [],
      };
      continue;
    }

    fallbacks[type] = found.templtContent;
    nextSnapshot.templates[type] = {
      templtCode: found.templtCode,
      templtName: found.templtName,
      placeholders: extractPlaceholders(found.templtContent),
      templtContent: found.templtContent,
    };

    report.push({
      type,
      status: "OK",
      templtCode: found.templtCode,
      templtName: found.templtName,
      placeholders: nextSnapshot.templates[type].placeholders,
    });
  }

  const source = fs.readFileSync(TEMPLATES_FILE, "utf8");
  const block = buildFallbacksBlock(fallbacks);
  const pattern =
    /export const LOCAL_TEMPLATE_FALLBACKS: Record<AligoTemplateType, string> = \{[\s\S]*?\};/;

  if (!pattern.test(source)) {
    console.error("❌ templates.ts에서 LOCAL_TEMPLATE_FALLBACKS 블록을 찾지 못했습니다.");
    process.exit(1);
  }

  fs.writeFileSync(TEMPLATES_FILE, source.replace(pattern, block), "utf8");
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(nextSnapshot, null, 2), "utf8");

  console.log("── 동기화 결과 ──");
  for (const item of report) {
    if (item.status === "OK") {
      console.log(`✅ ${item.type} → ${item.templtCode}`, item.placeholders);
    } else {
      console.log(`❌ ${item.type} → 없음 (기대 templtCode: ${item.expectedCode})`);
    }
  }
  console.log(`\n✅ ${TEMPLATES_FILE}`);
  console.log(`✅ ${SNAPSHOT_FILE}`);
}

main().catch((err) => {
  console.error("❌", err.response?.data?.message || err.message);
  process.exit(1);
});
