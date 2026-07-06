/**
 * Aligo 승인 템플릿(raw) vs 실제 전송 payload 1:1 비교 — 디버그 전용
 * 발송 로직 변경 없음
 */

const {
  buildExpectedMessage,
  analyzeLineEndings,
  analyzeButtonStringifyPipeline,
  buildButtonObjectBeforeStringify,
  extractPlaceholders,
} = require("./template-mismatch-debug.js");

const RAW = "[Aligo:debug:template:raw]";
const SEND = "[Aligo:debug:send:payload]";
const FINAL = "[Aligo:debug:FINAL_RESULT]";

const BUTTON_FIELD_KEYS = [
  "ordering",
  "name",
  "linkType",
  "linkTypeName",
  "linkMo",
  "linkPc",
  "linkIos",
  "linkAnd",
];

function charInfo(ch) {
  if (ch === undefined || ch === null) return { display: "(EOF)", code: null };
  if (ch === "\r") return { display: "\\r", code: 13 };
  if (ch === "\n") return { display: "\\n", code: 10 };
  if (ch === " ") return { display: "(space)", code: 32 };
  if (ch === "\t") return { display: "\\t", code: 9 };
  return { display: ch, code: ch.charCodeAt(0) };
}

function findFirstCharDiff(expected, actual) {
  const maxLen = Math.max(expected.length, actual.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (expected[i] !== actual[i]) {
      const lineNumber =
        expected.slice(0, i).split("\n").length ||
        actual.slice(0, i).split("\n").length;
      const exp = charInfo(expected[i]);
      const act = charInfo(actual[i]);
      return {
        index: i,
        lineNumber,
        expectedChar: exp.display,
        expectedCharCode: exp.code,
        actualChar: act.display,
        actualCharCode: act.code,
        expectedSnippet: expected.slice(Math.max(0, i - 20), i + 20),
        actualSnippet: actual.slice(Math.max(0, i - 20), i + 20),
      };
    }
  }
  return null;
}

function buildRawApiButtonJson(apiButtons) {
  if (!apiButtons || apiButtons.length === 0) return null;
  const sorted = [...apiButtons].sort(
    (a, b) => Number(a.ordering) - Number(b.ordering)
  );
  return JSON.stringify({ button: sorted });
}

function parseButtonJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function detectHiddenWhitespaceDiff(label, left, right) {
  const diffs = [];
  const leftEndings = analyzeLineEndings(left);
  const rightEndings = analyzeLineEndings(right);

  if (leftEndings.crlfCount !== rightEndings.crlfCount) {
    diffs.push({
      field: label,
      type: "CRLF_COUNT",
      left: leftEndings.crlfCount,
      right: rightEndings.crlfCount,
    });
  }
  if (leftEndings.loneLfCount !== rightEndings.loneLfCount) {
    diffs.push({
      field: label,
      type: "LONE_LF_COUNT",
      left: leftEndings.loneLfCount,
      right: rightEndings.loneLfCount,
    });
  }
  if (leftEndings.trailingWhitespace !== rightEndings.trailingWhitespace) {
    diffs.push({
      field: label,
      type: "TRAILING_WHITESPACE",
      left: leftEndings.trailingWhitespace,
      right: rightEndings.trailingWhitespace,
    });
  }
  if (left !== right) {
    const byteDiff = findFirstCharDiff(left, right);
    if (byteDiff && (/\s/.test(byteDiff.expectedChar) || /\s/.test(byteDiff.actualChar))) {
      diffs.push({
        field: label,
        type: "HIDDEN_WHITESPACE_BYTE",
        ...byteDiff,
      });
    }
  }
  return diffs;
}

function compareButtonFields(apiButtons, sentButtonRaw) {
  const evidence = [];
  const mismatchFields = [];
  const apiSorted = [...(apiButtons ?? [])].sort(
    (a, b) => Number(a.ordering) - Number(b.ordering)
  );
  const sentParsed = parseButtonJson(sentButtonRaw);
  const sentButtons = sentParsed?.button ?? [];

  if (apiSorted.length !== sentButtons.length) {
    mismatchFields.push("button_count");
    evidence.push({
      check: "button_count",
      apiCount: apiSorted.length,
      sentCount: sentButtons.length,
    });
  }

  const max = Math.max(apiSorted.length, sentButtons.length);
  for (let i = 0; i < max; i += 1) {
    const apiBtn = apiSorted[i];
    const sentBtn = sentButtons[i];
    const slot = i + 1;

    if (!apiBtn || !sentBtn) {
      mismatchFields.push(`button_slot_${slot}_missing`);
      evidence.push({ check: "button_slot", slot, apiBtn: !!apiBtn, sentBtn: !!sentBtn });
      continue;
    }

    for (const key of ["ordering", "name", "linkType", "linkTypeName"]) {
      const apiVal = String(apiBtn[key] ?? "");
      const sentVal = String(sentBtn[key] ?? "");
      if (apiVal !== sentVal) {
        mismatchFields.push(`button[${slot}].${key}`);
        evidence.push({
          check: `button.${key}`,
          slot,
          api: apiVal,
          sent: sentVal,
          byteDiff: findFirstCharDiff(apiVal, sentVal),
        });
      }
    }

    if (String(apiBtn.ordering ?? "") !== String(sentBtn.ordering ?? "")) {
      if (!mismatchFields.includes(`button[${slot}].ordering`)) {
        mismatchFields.push(`button[${slot}].ordering`);
      }
    }
  }

  const apiJson = buildRawApiButtonJson(apiButtons);
  if (apiJson && sentButtonRaw && apiJson !== sentButtonRaw) {
    mismatchFields.push("button_1_json_stringify");
    evidence.push({
      check: "button_1_json_stringify_byte_diff",
      firstDiff: findFirstCharDiff(apiJson, sentButtonRaw),
      apiJsonLength: apiJson.length,
      sentJsonLength: sentButtonRaw.length,
    });
  }

  return {
    match: mismatchFields.length === 0,
    mismatchFields,
    evidence,
    apiJson,
    sentJson: sentButtonRaw ?? null,
  };
}

function compareMessageFields(templtContent, sentMessage, mappedSubstitutions) {
  const evidence = [];
  const mismatchFields = [];

  const expectedMessage = buildExpectedMessage(
    templtContent ?? "",
    mappedSubstitutions ?? {}
  );
  const rawContent = String(templtContent ?? "");
  const sent = String(sentMessage ?? "");

  if (expectedMessage !== sent) {
    mismatchFields.push("message_1");
    evidence.push({
      check: "message_substituted_vs_sent",
      firstDiff: findFirstCharDiff(expectedMessage, sent),
      expectedLineEndings: analyzeLineEndings(expectedMessage),
      sentLineEndings: analyzeLineEndings(sent),
    });
  }

  const whitespaceDiffs = detectHiddenWhitespaceDiff(
    "message_1",
    expectedMessage,
    sent
  );
  for (const ws of whitespaceDiffs) {
    if (!mismatchFields.includes("message_1_whitespace")) {
      mismatchFields.push("message_1_whitespace");
    }
    evidence.push({ check: "message_whitespace", ...ws });
  }

  const remainingPlaceholders = extractPlaceholders(sent);
  if (remainingPlaceholders.length > 0) {
    mismatchFields.push("message_placeholder_remaining");
    evidence.push({
      check: "variable_placeholder_remaining",
      placeholders: remainingPlaceholders,
    });
  }

  if (rawContent !== sent && expectedMessage === sent) {
    evidence.push({
      check: "note",
      detail:
        "raw templtContent(placeholder 포함) ≠ sent message_1 이지만 치환 expected === sent",
    });
  }

  return {
    match: mismatchFields.length === 0,
    mismatchFields,
    evidence,
    expectedMessage,
    rawTempltContent: rawContent,
  };
}

function compareFullPayloadJson(templtCode, templtContent, apiButtons, sentPayload) {
  const mappedSubstitutions = sentPayload.mappedSubstitutions ?? {};
  const expectedMessage = buildExpectedMessage(
    templtContent ?? "",
    mappedSubstitutions
  );
  const btnPipe = analyzeButtonStringifyPipeline(
    apiButtons,
    sentPayload.button_1 ?? null,
    mappedSubstitutions
  );
  const expectedButton =
    btnPipe.expectedStringify ?? buildRawApiButtonJson(apiButtons);
  const approved = {
    tpl_code: templtCode,
    message_1: expectedMessage,
  };
  if (expectedButton) approved.button_1 = expectedButton;

  const sent = {
    tpl_code: sentPayload.tpl_code ?? templtCode,
    message_1: sentPayload.message_1 ?? "",
  };
  if (sentPayload.button_1) sent.button_1 = sentPayload.button_1;

  const approvedJson = JSON.stringify(approved);
  const sentJson = JSON.stringify(sent);
  const match = approvedJson === sentJson;

  const evidence = [];
  const mismatchFields = [];
  if (!match) {
    mismatchFields.push("full_payload_json_stringify");
    evidence.push({
      check: "full_payload_json_stringify_byte_diff",
      firstDiff: findFirstCharDiff(approvedJson, sentJson),
      approvedJson,
      sentJson,
    });
    for (const key of ["tpl_code", "message_1", "button_1"]) {
      if (String(approved[key] ?? "") !== String(sent[key] ?? "")) {
        if (!mismatchFields.includes(key)) mismatchFields.push(key);
        evidence.push({
          check: `payload_field.${key}`,
          approved: approved[key] ?? null,
          sent: sent[key] ?? null,
          firstDiff:
            key === "message_1" || key === "button_1"
              ? findFirstCharDiff(String(approved[key] ?? ""), String(sent[key] ?? ""))
              : null,
        });
      }
    }
  }

  return { match, mismatchFields, evidence, approved, sent, approvedJson, sentJson };
}

function resolveRootCause({ messageCompare, buttonCompare, fullPayloadCompare, variables }) {
  const remaining = messageCompare.evidence.find(
    (e) => e.check === "variable_placeholder_remaining"
  );
  if (remaining) return "VARIABLE_MISMATCH";

  const missingVars = (variables?.missing ?? []).length > 0;
  const nullFields = (variables?.nullOrEmpty ?? []).length > 0;
  if (missingVars || nullFields) return "VARIABLE_MISMATCH";

  if (!buttonCompare.match) return "BUTTON_MISMATCH";
  if (!messageCompare.match) return "MESSAGE_MISMATCH";
  if (!fullPayloadCompare.match) {
    if (
      fullPayloadCompare.mismatchFields.some((f) => f.startsWith("button"))
    ) {
      return "BUTTON_MISMATCH";
    }
    if (fullPayloadCompare.mismatchFields.includes("message_1")) {
      return "MESSAGE_MISMATCH";
    }
  }

  return "UNKNOWN";
}

function logTemplateRaw(apiTemplate) {
  console.log(`${RAW} ========== UF_9460 / ${apiTemplate?.templtCode ?? "?"} ==========`);
  console.log(`${RAW} templtContent:`);
  console.log(apiTemplate?.templtContent ?? "(없음)");
  console.log(`${RAW} buttons (JSON 전체):`);
  console.log(JSON.stringify(apiTemplate?.buttons ?? [], null, 2));
  console.log(`${RAW} templtContent line endings:`, analyzeLineEndings(apiTemplate?.templtContent ?? ""));
  console.log(`${RAW} ========================================`);
}

function logSendPayload(input) {
  const btnPipe = analyzeButtonStringifyPipeline(
    input.apiButtons ?? [],
    input.button1 ?? null,
    input.mappedSubstitutions ?? {}
  );

  console.log(`${SEND} ========== 발송 직전 payload ==========`);
  console.log(`${SEND} tpl_code:`, input.tplCode);
  console.log(`${SEND} message_1 (string 그대로):`);
  console.log(input.message1 ?? "");
  console.log(`${SEND} message_1 line endings:`, analyzeLineEndings(input.message1 ?? ""));
  console.log(`${SEND} button_1 JSON.stringify 직전 객체:`);
  console.log(JSON.stringify(btnPipe.beforeObject, null, 2));
  console.log(`${SEND} button_1 JSON.stringify 직후:`);
  console.log(input.button1 ?? "(없음)");
  console.log(`${SEND} final request payload 전체 JSON:`);
  console.log(JSON.stringify(input.aligoFormPayload ?? {}, null, 2));
  console.log(`${SEND} ========================================`);

  return btnPipe;
}

function logFinalResult(result) {
  console.log(`${FINAL} match:`, result.match);
  console.log(`${FINAL} mismatch_fields:`, result.mismatch_fields);
  console.log(`${FINAL} root_cause:`, result.root_cause);
  console.log(`${FINAL} evidence:`);
  for (const item of result.evidence) {
    console.log(`${FINAL}  -`, JSON.stringify(item));
  }
  console.log(`${FINAL} ========================================`);
}

/**
 * @param {object} input
 * @param {object|null} input.apiTemplate - /template/list matched template
 * @param {string} input.tplCode
 * @param {string} input.message1
 * @param {string|null} input.button1
 * @param {Record<string,string>} input.mappedSubstitutions
 * @param {Record<string,unknown>} input.aligoFormPayload
 * @param {object} [input.variables]
 */
function runAligoRawTemplateCompareDebug(input) {
  const apiTemplate = input.apiTemplate ?? {};
  const templtContent = apiTemplate.templtContent ?? "";
  const apiButtons = apiTemplate.buttons ?? [];
  const mappedSubstitutions = input.mappedSubstitutions ?? {};

  logTemplateRaw(apiTemplate);
  const btnPipe = logSendPayload({
    tplCode: input.tplCode,
    message1: input.message1,
    button1: input.button1,
    apiButtons,
    mappedSubstitutions,
    aligoFormPayload: input.aligoFormPayload,
  });

  const buttonCompare = compareButtonFields(apiButtons, input.button1 ?? null);
  const messageCompare = compareMessageFields(
    templtContent,
    input.message1 ?? "",
    mappedSubstitutions
  );
  const fullPayloadCompare = compareFullPayloadJson(
    input.tplCode ?? apiTemplate.templtCode,
    templtContent,
    apiButtons,
    {
      tpl_code: input.tplCode,
      message_1: input.message1,
      button_1: input.button1,
      mappedSubstitutions,
    }
  );

  const allMismatchFields = [
    ...new Set([
      ...buttonCompare.mismatchFields,
      ...messageCompare.mismatchFields,
      ...fullPayloadCompare.mismatchFields,
    ]),
  ];

  const allEvidence = [
    { section: "(1) template raw buttons vs sent button_1", items: buttonCompare.evidence },
    { section: "(2) template message vs sent message_1", items: messageCompare.evidence },
    { section: "(3) template full schema vs final payload JSON", items: fullPayloadCompare.evidence },
  ];

  if (!btnPipe.stringifyMatch) {
    allMismatchFields.push("button_pipeline_stringify");
    allEvidence.push({
      section: "button stringify pipeline",
      items: [{ check: "pipeline_stringify", diff: btnPipe.stringifyDiff }],
    });
  }

  const flatEvidence = allEvidence.flatMap((block) =>
    (block.items ?? []).map((item) => ({ section: block.section, ...item }))
  );

  const rootCause = resolveRootCause({
    messageCompare,
    buttonCompare,
    fullPayloadCompare,
    variables: input.variables,
  });

  const match = allMismatchFields.length === 0;

  const result = {
    match,
    mismatch_fields: allMismatchFields,
    root_cause: match ? "UNKNOWN" : rootCause,
    evidence: flatEvidence,
    comparisons: {
      buttons: buttonCompare,
      message: messageCompare,
      fullPayload: fullPayloadCompare,
      buttonPipeline: btnPipe,
    },
  };

  logFinalResult(result);
  return result;
}

module.exports = {
  runAligoRawTemplateCompareDebug,
  compareButtonFields,
  compareMessageFields,
  compareFullPayloadJson,
};
