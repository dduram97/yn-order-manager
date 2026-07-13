/**
 * templateType → Aligo templtCode 매핑 최소 단위 테스트
 * 실행: npm run test:aligo-template-codes
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 배포 기준 신규 템플릿 코드 */
const EXPECTED_CODES = {
  택배발송알림: "UJ_4465",
  "선물받는분 알림": "UJ_4466",
  "선물보내는분 알림": "UJ_4467",
};

const LEGACY_CODES = ["UJ_3780", "UJ_3779", "UJ_3622"];

/** lib/aligo/template-schema.ts getTemplateCode 와 동일 우선순위 */
function getTemplateCode(templateType, codes, env = {}) {
  const envKey = `ALIGO_TPL_CODE_${templateType.replace(/\s/g, "_")}`;
  const override = env[envKey];
  if (override) return override;
  return codes[templateType];
}

function extractSchemaCodes(source) {
  const block = source.match(
    /export const ALIGO_TEMPLATE_CODES[\s\S]*?=\s*\{([\s\S]*?)\};/
  );
  assert.ok(block, "ALIGO_TEMPLATE_CODES 블록을 찾지 못했습니다.");
  const codes = {};
  for (const match of block[1].matchAll(
    /(?:"([^"]+)"|([\w가-힣]+))\s*:\s*"([^"]+)"/g
  )) {
    codes[match[1] ?? match[2]] = match[3];
  }
  return codes;
}

function extractSyncCodes(source) {
  const block = source.match(/const TEMPLATE_CODES\s*=\s*\{([\s\S]*?)\};/);
  assert.ok(block, "TEMPLATE_CODES 블록을 찾지 못했습니다.");
  const codes = {};
  for (const match of block[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) {
    codes[match[1]] = match[2];
  }
  return codes;
}

describe("Aligo template code mapping", () => {
  const schemaSource = readFileSync(
    join(ROOT, "lib/aligo/template-schema.ts"),
    "utf8"
  );
  const syncSource = readFileSync(
    join(ROOT, "scripts/sync-aligo-templates.mjs"),
    "utf8"
  );
  const snapshot = JSON.parse(
    readFileSync(join(ROOT, "lib/aligo/dashboard-snapshot.json"), "utf8")
  );

  const schemaCodes = extractSchemaCodes(schemaSource);
  const syncCodes = extractSyncCodes(syncSource);

  it("ALIGO_TEMPLATE_CODES maps each templateType to the new codes", () => {
    assert.deepEqual(schemaCodes, EXPECTED_CODES);
  });

  it("sync TEMPLATE_CODES matches ALIGO_TEMPLATE_CODES", () => {
    assert.deepEqual(syncCodes, EXPECTED_CODES);
  });

  it("dashboard-snapshot.json templtCode matches new codes", () => {
    for (const [type, code] of Object.entries(EXPECTED_CODES)) {
      assert.equal(
        snapshot.templates[type]?.templtCode,
        code,
        `${type} snapshot templtCode`
      );
    }
  });

  it("getTemplateCode returns new codes when env override is unset", () => {
    for (const [type, code] of Object.entries(EXPECTED_CODES)) {
      assert.equal(getTemplateCode(type, schemaCodes, {}), code);
    }
  });

  it("getTemplateCode prefers ALIGO_TPL_CODE_* env override", () => {
    const env = {
      ALIGO_TPL_CODE_택배발송알림: "OVERRIDE_SHIP",
      "ALIGO_TPL_CODE_선물받는분_알림": "OVERRIDE_RECV",
      "ALIGO_TPL_CODE_선물보내는분_알림": "OVERRIDE_SEND",
    };
    assert.equal(
      getTemplateCode("택배발송알림", schemaCodes, env),
      "OVERRIDE_SHIP"
    );
    assert.equal(
      getTemplateCode("선물받는분 알림", schemaCodes, env),
      "OVERRIDE_RECV"
    );
    assert.equal(
      getTemplateCode("선물보내는분 알림", schemaCodes, env),
      "OVERRIDE_SEND"
    );
  });

  it("legacy template codes are absent from schema/sync/snapshot sources", () => {
    const haystack = `${schemaSource}\n${syncSource}\n${JSON.stringify(snapshot)}`;
    for (const legacy of LEGACY_CODES) {
      assert.equal(
        haystack.includes(legacy),
        false,
        `legacy code ${legacy} must not remain`
      );
    }
  });
});
