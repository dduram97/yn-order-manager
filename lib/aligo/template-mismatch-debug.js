/**
 * Aligo 템플릿 ↔ 치환 message 1:1 비교·변수 검증 (Next.js / Proxy 공용)
 * 발송 로직·Aligo API 페이로드는 변경하지 않고 디버깅 로그만 제공합니다.
 */

const PLACEHOLDER_PATTERN = /#\{[^}]+\}/g;

/** orders 필드 ↔ Aligo 플레이스홀더 (template-schema.ts 와 동기) */
const ALIGO_VARIABLE_MAP = {
  phone: "#{메시지 수신 휴대폰 번호}",
  customer_name: "#{고객명}",
  sender_name: "#{보내는이}",
  receiver_name: "#{받는이}",
  tracking_number: "#{송장번호}",
};

const PLACEHOLDER_TO_FIELD = Object.fromEntries(
  Object.entries(ALIGO_VARIABLE_MAP).map(([field, placeholder]) => [
    placeholder,
    field,
  ])
);

const FIELD_LABELS = {
  phone: "전화번호",
  customer_name: "고객명",
  sender_name: "보내는이",
  receiver_name: "받는이",
  tracking_number: "송장번호",
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTemplateContent(content) {
  return String(content ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function toAligoLineEndings(text) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\r\n");
}

function extractPlaceholders(content) {
  const normalized = normalizeTemplateContent(content);
  const matches = normalized.match(PLACEHOLDER_PATTERN) ?? [];
  return [...new Set(matches)];
}

function charInfo(ch) {
  if (ch === undefined || ch === null) {
    return { display: "(EOF)", code: null };
  }
  if (ch === "\r") return { display: "\\r", code: 13 };
  if (ch === "\n") return { display: "\\n", code: 10 };
  if (ch === " ") return { display: "(space)", code: 32 };
  if (ch === "\t") return { display: "\\t", code: 9 };
  return { display: ch, code: ch.charCodeAt(0) };
}

function analyzeLineEndings(text) {
  const raw = String(text ?? "");
  const crlf = (raw.match(/\r\n/g) ?? []).length;
  const loneCr = (raw.match(/\r(?!\n)/g) ?? []).length;
  const loneLf = (raw.match(/(?<!\r)\n/g) ?? []).length;
  return {
    totalLength: raw.length,
    crlfCount: crlf,
    loneCrCount: loneCr,
    loneLfCount: loneLf,
    endsWithCrlf: raw.endsWith("\r\n"),
    endsWithLf: raw.endsWith("\n") && !raw.endsWith("\r\n"),
    endsWithCr: raw.endsWith("\r") && !raw.endsWith("\r\n"),
    trailingWhitespace: raw.length - raw.trimEnd().length,
  };
}

function analyzeWhitespacePerLine(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const issues = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line !== line.trimEnd()) {
      issues.push({
        line: i + 1,
        trailingSpaces: line.length - line.trimEnd().length,
        content: JSON.stringify(line),
      });
    }
    if (/\s{2,}/.test(line)) {
      issues.push({
        line: i + 1,
        issue: "연속 공백",
        content: JSON.stringify(line),
      });
    }
  }
  return issues;
}

/** 디버그용 기대 message 재구성 (applyTemplateVariables 와 동일 규칙) */
function buildExpectedMessage(originalTemplate, mappedSubstitutions) {
  let filled = String(originalTemplate ?? "");
  for (const [field, placeholder] of Object.entries(ALIGO_VARIABLE_MAP)) {
    const value = mappedSubstitutions[field] ?? "";
    filled = filled.replace(
      new RegExp(escapeRegExp(placeholder), "g"),
      value
    );
  }
  return toAligoLineEndings(filled);
}

function isNullishValue(value) {
  return value === null || value === undefined;
}

function isEmptyString(value) {
  return typeof value === "string" && value.trim() === "";
}

function findFirstCharDiff(expected, actual) {
  const maxLen = Math.max(expected.length, actual.length);
  for (let i = 0; i < maxLen; i += 1) {
    if (expected[i] !== actual[i]) {
      const start = Math.max(0, i - 20);
      const end = i + 20;
      const expectedInfo = charInfo(expected[i]);
      const actualInfo = charInfo(actual[i]);
      return {
        index: i,
        expectedChar: expectedInfo.display,
        expectedCharCode: expectedInfo.code,
        actualChar: actualInfo.display,
        actualCharCode: actualInfo.code,
        expectedSnippet: expected.slice(start, end),
        actualSnippet: actual.slice(start, end),
        lineNumber: expected.slice(0, i).split(/\r?\n/).length,
      };
    }
  }
  return null;
}

function compareLines(expected, actual) {
  const expectedLines = expected.split(/\r?\n/);
  const actualLines = actual.split(/\r?\n/);
  const max = Math.max(expectedLines.length, actualLines.length);
  const mismatches = [];

  for (let i = 0; i < max; i += 1) {
    const exp = expectedLines[i] ?? "";
    const act = actualLines[i] ?? "";
    if (exp !== act) {
      mismatches.push({
        line: i + 1,
        expected: exp,
        actual: act,
        expectedJson: JSON.stringify(exp),
        actualJson: JSON.stringify(act),
      });
    }
  }

  return mismatches;
}

/**
 * [핵심] Aligo API templtContent 원본 vs 실제 전송 message 비교
 * Aligo는 "원본 template + 변수치환" 결과와 message_1 이 byte-level 일치해야 함
 */
function compareApiTemplateToSentMessage(
  apiTempltContent,
  sentMessage,
  mappedSubstitutions
) {
  const apiRaw = String(apiTempltContent ?? "");
  const sent = String(sentMessage ?? "");

  const apiPlaceholders = extractPlaceholders(apiRaw);
  const sentRemainingPlaceholders = extractPlaceholders(sent);

  const expectedFromApiRaw = buildExpectedMessage(apiRaw, mappedSubstitutions);
  const expectedFromApiNormalized = buildExpectedMessage(
    normalizeTemplateContent(apiRaw),
    mappedSubstitutions
  );

  const matchesApiRawSubstitution = expectedFromApiRaw === sent;
  const matchesApiNormalizedSubstitution = expectedFromApiNormalized === sent;
  const rawVsSentIdentical = apiRaw === sent;

  const apiLineEndings = analyzeLineEndings(apiRaw);
  const sentLineEndings = analyzeLineEndings(sent);
  const expectedLineEndings = analyzeLineEndings(expectedFromApiRaw);

  const apiWhitespaceIssues = analyzeWhitespacePerLine(apiRaw);
  const sentWhitespaceIssues = analyzeWhitespacePerLine(sent);

  const firstDiffApiExpectedVsSent = matchesApiRawSubstitution
    ? null
    : findFirstCharDiff(expectedFromApiRaw, sent);

  const firstDiffRawVsSent = rawVsSentIdentical
    ? null
    : findFirstCharDiff(apiRaw, sent);

  const placeholderMappingTable = apiPlaceholders.map((placeholder) => {
    const field = PLACEHOLDER_TO_FIELD[placeholder] ?? null;
    const mappedValue = field ? (mappedSubstitutions[field] ?? "") : null;
    const stillInSent = sent.includes(placeholder);
    return {
      placeholder,
      field,
      label: field ? FIELD_LABELS[field] : "(매핑 없음)",
      mappedValue,
      stillInSentMessage: stillInSent,
      status: stillInSent ? "❌ 치환 안됨" : "✅ 치환됨",
    };
  });

  return {
    apiTempltContentRaw: apiRaw,
    sentMessageRaw: sent,
    expectedFromApiSubstitution: expectedFromApiRaw,
    apiPlaceholders,
    sentRemainingPlaceholders,
    placeholderMappingTable,
    rawVsSentIdentical,
    matchesApiRawSubstitution,
    matchesApiNormalizedSubstitution,
    apiLineEndings,
    sentLineEndings,
    expectedLineEndings,
    apiWhitespaceIssues,
    sentWhitespaceIssues,
    firstDiffApiExpectedVsSent,
    firstDiffRawVsSent,
    firstMismatchLine:
      firstDiffApiExpectedVsSent?.lineNumber ??
      (compareLines(expectedFromApiRaw, sent)[0]?.line ?? null),
  };
}

const BUTTON_COMPARE_KEYS = [
  "ordering",
  "name",
  "linkType",
  "linkTypeName",
  "linkMo",
  "linkPc",
  "linkIos",
  "linkAnd",
];

function parseButtonJson(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function substituteButtonPlaceholders(btn, mappedSubstitutions) {
  const cloned = { ...(btn ?? {}) };
  for (const key of BUTTON_COMPARE_KEYS) {
    const val = cloned[key];
    if (typeof val === "string" && val.includes("#{")) {
      let filled = val;
      for (const [field, placeholder] of Object.entries(ALIGO_VARIABLE_MAP)) {
        const value = mappedSubstitutions[field] ?? "";
        filled = filled.replace(
          new RegExp(escapeRegExp(placeholder), "g"),
          value
        );
      }
      cloned[key] = filled;
    }
  }
  return cloned;
}

/** JSON.stringify 직전 button 객체 (ordering 정렬 + placeholder 치환) */
function buildButtonObjectBeforeStringify(apiButtons, mappedSubstitutions) {
  if (!apiButtons || apiButtons.length === 0) {
    return { button: [] };
  }

  const sorted = [...apiButtons].sort(
    (a, b) => Number(a.ordering) - Number(b.ordering)
  );
  const substituted = sorted.map((btn) =>
    substituteButtonPlaceholders(btn, mappedSubstitutions)
  );

  return { button: substituted };
}

function inspectNullUndefinedInButtons(buttons) {
  const issues = [];

  for (let index = 0; index < (buttons ?? []).length; index += 1) {
    const btn = buttons[index] ?? {};
    for (const [field, value] of Object.entries(btn)) {
      if (value === null || value === undefined) {
        issues.push({
          arrayIndex: index,
          ordering: btn.ordering ?? String(index + 1),
          field,
          value,
        });
      }
    }
  }

  return issues;
}

function compareButtonArrayOrder(apiButtonsRaw, sentButtonsRaw) {
  const apiSequence = (apiButtonsRaw ?? []).map((btn, index) => ({
    arrayIndex: index,
    ordering: btn?.ordering ?? String(index + 1),
    name: btn?.name ?? "",
  }));
  const sentSequence = (sentButtonsRaw ?? []).map((btn, index) => ({
    arrayIndex: index,
    ordering: btn?.ordering ?? String(index + 1),
    name: btn?.name ?? "",
  }));

  const apiOrderingSeq = apiSequence.map((item) => String(item.ordering));
  const sentOrderingSeq = sentSequence.map((item) => String(item.ordering));

  return {
    apiSequence,
    sentSequence,
    orderingSequenceMatch:
      JSON.stringify(apiOrderingSeq) === JSON.stringify(sentOrderingSeq),
    arrayIndexOrderMatch:
      JSON.stringify(apiSequence.map((item) => item.name)) ===
      JSON.stringify(sentSequence.map((item) => item.name)),
  };
}

function compareLinkTypeFields(apiBtn, sentBtn, context) {
  return ["linkType", "linkTypeName"].map((field) => ({
    ordering: context.ordering,
    name: context.name,
    field,
    templateValue: apiBtn?.[field] ?? null,
    sentValue: sentBtn?.[field] ?? null,
    exactMatch:
      String(apiBtn?.[field] ?? "") === String(sentBtn?.[field] ?? ""),
  }));
}

/**
 * button_1 JSON.stringify 직전 객체 vs 직후 문자열 비교
 */
function analyzeButtonStringifyPipeline(
  apiButtons,
  sentButtonRaw,
  mappedSubstitutions
) {
  const beforeObject = buildButtonObjectBeforeStringify(
    apiButtons,
    mappedSubstitutions
  );
  const expectedStringify =
    beforeObject.button.length > 0 ? JSON.stringify(beforeObject) : null;
  const afterStringify =
    typeof sentButtonRaw === "string" ? sentButtonRaw : null;

  const sentParsed = parseButtonJson(sentButtonRaw);
  const sentButtons = sentParsed?.button ?? [];

  const nullUndefinedFields = inspectNullUndefinedInButtons(beforeObject.button);
  const rawApiNullUndefinedFields = inspectNullUndefinedInButtons(
    apiButtons ?? []
  );

  const apiSorted = [...(apiButtons ?? [])].sort(
    (a, b) => Number(a.ordering) - Number(b.ordering)
  );

  const linkTypeChecks = [];
  for (let i = 0; i < Math.max(apiSorted.length, sentButtons.length); i += 1) {
    const apiRaw = apiSorted[i];
    if (!apiRaw) continue;

    const apiBtn = substituteButtonPlaceholders(apiRaw, mappedSubstitutions);
    const sentBtn = sentButtons[i] ?? {};
    linkTypeChecks.push(
      ...compareLinkTypeFields(apiBtn, sentBtn, {
        ordering: apiRaw.ordering ?? String(i + 1),
        name: apiRaw.name ?? "",
      })
    );
  }

  const orderComparison = compareButtonArrayOrder(
    beforeObject.button,
    sentButtons
  );

  return {
    beforeObject,
    expectedStringify,
    afterStringify,
    stringifyMatch: expectedStringify === afterStringify,
    stringifyDiff:
      expectedStringify === afterStringify
        ? null
        : findFirstCharDiff(expectedStringify ?? "", afterStringify ?? ""),
    nullUndefinedFields,
    rawApiNullUndefinedFields,
    linkTypeChecks,
    linkTypeAllMatch: linkTypeChecks.every((item) => item.exactMatch),
    orderComparison,
  };
}

function normalizeButtonEntry(btn, index) {
  const normalized = {};
  for (const key of BUTTON_COMPARE_KEYS) {
    normalized[key] = String(btn?.[key] ?? "").trim();
  }
  if (!normalized.ordering) {
    normalized.ordering = String(index + 1);
  }
  return normalized;
}

function normalizeButtonList(buttons) {
  return (buttons ?? [])
    .map((btn, index) => normalizeButtonEntry(btn, index))
    .sort((a, b) => Number(a.ordering) - Number(b.ordering));
}

function buildExpectedButton(apiButtons, mappedSubstitutions) {
  const beforeObject = buildButtonObjectBeforeStringify(
    apiButtons,
    mappedSubstitutions
  );
  if (beforeObject.button.length === 0) return undefined;
  return JSON.stringify(beforeObject);
}

function compareButtons(apiButtons, sentButtonRaw, mappedSubstitutions) {
  const templateButtons = apiButtons ?? [];
  const expectedJson = buildExpectedButton(templateButtons, mappedSubstitutions);
  const sentParsed = parseButtonJson(sentButtonRaw);
  const sentButtons = sentParsed?.button ?? [];
  const templateNorm = normalizeButtonList(templateButtons);
  const sentNorm = normalizeButtonList(sentButtons);
  const fieldDiffs = [];

  if (templateNorm.length > 0 && !sentButtonRaw) {
    return {
      match: false,
      reason: "MISSING_BUTTON",
      templateCount: templateNorm.length,
      sentCount: 0,
      expectedJson,
      sentJson: null,
      templateButtons: templateNorm,
      sentButtons: [],
      fieldDiffs: [{ issue: "템플릿에 버튼 있으나 button_1 미전송" }],
    };
  }

  if (templateNorm.length === 0 && sentButtonRaw) {
    return {
      match: false,
      reason: "EXTRA_BUTTON",
      templateCount: 0,
      sentCount: sentNorm.length,
      expectedJson: undefined,
      sentJson: sentButtonRaw,
      templateButtons: [],
      sentButtons: sentNorm,
      fieldDiffs: [{ issue: "템플릿에 버튼 없는데 button_1 전송됨" }],
    };
  }

  if (templateNorm.length !== sentNorm.length) {
    fieldDiffs.push({
      issue: "버튼 개수 불일치",
      expected: templateNorm.length,
      actual: sentNorm.length,
    });
  }

  const max = Math.max(templateNorm.length, sentNorm.length);
  for (let i = 0; i < max; i += 1) {
    const exp = templateNorm[i];
    const act = sentNorm[i];
    if (!exp || !act) {
      fieldDiffs.push({
        ordering: i + 1,
        issue: !exp ? "전송 버튼 초과" : "전송 버튼 누락",
        expected: exp ?? null,
        actual: act ?? null,
      });
      continue;
    }
    for (const key of BUTTON_COMPARE_KEYS) {
      if (exp[key] !== act[key]) {
        fieldDiffs.push({
          ordering: exp.ordering,
          field: key,
          expected: exp[key],
          actual: act[key],
        });
      }
    }
  }

  const jsonMatch = expectedJson === sentButtonRaw;
  return {
    match: fieldDiffs.length === 0 && jsonMatch,
    reason: fieldDiffs.length > 0 ? "BUTTON_FIELD_MISMATCH" : jsonMatch ? null : "BUTTON_JSON_MISMATCH",
    templateCount: templateNorm.length,
    sentCount: sentNorm.length,
    expectedJson,
    sentJson: sentButtonRaw ?? null,
    templateButtons: templateNorm,
    sentButtons: sentNorm,
    fieldDiffs,
    jsonMatch,
    firstJsonDiff: jsonMatch ? null : findFirstCharDiff(expectedJson ?? "", sentButtonRaw ?? ""),
  };
}

function buildExpectedEmTitle(apiTemplate, mappedSubstitutions) {
  const emType = String(apiTemplate?.templateEmType ?? "").toUpperCase();
  const title = apiTemplate?.templtTitle;
  if (emType !== "TEXT" || !title) return undefined;
  return buildExpectedMessage(title, mappedSubstitutions);
}

function compareEmTitle(apiTemplate, sentEmtitle, mappedSubstitutions) {
  const expected = buildExpectedEmTitle(apiTemplate, mappedSubstitutions);
  const emType = String(apiTemplate?.templateEmType ?? "").toUpperCase();

  if (emType === "TEXT" && expected && !sentEmtitle) {
    return {
      match: false,
      reason: "MISSING_EMTITLE",
      required: true,
      expected,
      actual: null,
      firstDiff: null,
    };
  }

  if (!expected && sentEmtitle) {
    return {
      match: false,
      reason: "EXTRA_EMTITLE",
      required: false,
      expected: null,
      actual: sentEmtitle,
      firstDiff: findFirstCharDiff("", sentEmtitle),
    };
  }

  if (!expected && !sentEmtitle) {
    return { match: true, reason: null, required: false, expected: null, actual: null, firstDiff: null };
  }

  const match = expected === sentEmtitle;
  return {
    match,
    reason: match ? null : "EMTITLE_MISMATCH",
    required: emType === "TEXT",
    expected,
    actual: sentEmtitle ?? null,
    firstDiff: match ? null : findFirstCharDiff(expected ?? "", sentEmtitle ?? ""),
  };
}

function buildComparableSendPayload(fields) {
  const payload = {};
  if (fields.message_1 != null) payload.message_1 = fields.message_1;
  if (fields.button_1 != null) payload.button_1 = fields.button_1;
  if (fields.emtitle_1 != null) payload.emtitle_1 = fields.emtitle_1;
  if (fields.subject_1 != null) payload.subject_1 = fields.subject_1;
  if (fields.tpl_code != null) payload.tpl_code = fields.tpl_code;
  return payload;
}

function comparePayloadRaw(expectedPayload, actualPayload) {
  const expectedJson = JSON.stringify(expectedPayload);
  const actualJson = JSON.stringify(actualPayload);
  const match = expectedJson === actualJson;
  return {
    match,
    expectedJson,
    actualJson,
    firstDiff: match ? null : findFirstCharDiff(expectedJson, actualJson),
  };
}

function pinpointRootCause(report) {
  const checks = [];

  const schema =
    report.templateSchemaValidationAnalysis ??
    analyzeTemplateSchemaValidation(buildSchemaValidationInputFromReport(report));

  if (schema && !schema.match) {
    checks.push({
      priority: 1,
      code: "TEMPLATE_SCHEMA_VALIDATION_MISMATCH",
      summary: schema.verdict,
    });
  }

  if (report.buttonsComparison?.reason === "MISSING_BUTTON") {
    checks.push({
      priority: 2,
      code: "MISSING_BUTTON",
      summary: `템플릿 버튼 ${report.buttonsComparison.templateCount}개 — button_1 미전송`,
    });
  }

  if (report.emtitleComparison?.reason === "MISSING_EMTITLE") {
    checks.push({
      priority: 4,
      code: "MISSING_EMTITLE",
      summary: `강조표기형(TEXT) — emtitle_1 누락 (기대: ${JSON.stringify(report.emtitleComparison.expected)})`,
    });
  } else if (report.emtitleComparison && !report.emtitleComparison.match) {
    checks.push({
      priority: 5,
      code: "EMTITLE_MISMATCH",
      summary: "emtitle_1 값 불일치",
    });
  }

  if (report.apiComparison?.sentRemainingPlaceholders?.length > 0) {
    checks.push({
      priority: 6,
      code: "PLACEHOLDER_REMAINING",
      summary: `치환 안 된 placeholder: ${report.apiComparison.sentRemainingPlaceholders.join(", ")}`,
    });
  }

  if (!report.apiComparison?.matchesApiRawSubstitution) {
    const diff = report.apiComparison?.firstDiffApiExpectedVsSent;
    checks.push({
      priority: 7,
      code: "MESSAGE_MISMATCH",
      summary: diff
        ? `message_1 불일치 — index ${diff.index}, 줄 ${diff.lineNumber}, ${diff.expectedChar} vs ${diff.actualChar}`
        : "message_1 불일치",
    });
  } else if (apiLineEndingMismatch(report.apiComparison)) {
    checks.push({
      priority: 90,
      code: "LINE_ENDING_INFO",
      summary:
        "message_1 줄바꿈(CRLF/LF) 형식 차이 — expected=actual 일치 시 단독 root cause 아님",
    });
  }

  if (!report.payloadComparison?.match) {
    checks.push({
      priority: 8,
      code: "PAYLOAD_RAW_MISMATCH",
      summary: "전체 send payload JSON 불일치",
    });
  }

  checks.sort((a, b) => a.priority - b.priority);
  const primary = checks.find((c) => c.code !== "LINE_ENDING_INFO") ?? checks[0] ?? null;

  return {
    primary,
    allChecks: checks,
    note: primary
      ? null
      : "strict validation 5항목 통과 — Aligo API code:0은 수신 성공이며, 카카오 거부는 비동기(fcnt)로 확인 필요",
  };
}

/**
 * @param {object} input
 */
function analyzeTemplateMismatch(input) {
  const originalTemplate = String(input.originalTemplate ?? "");
  const apiFreshTempltContent = String(
    input.apiFreshTempltContent ?? input.originalTemplate ?? ""
  );
  const finalMessage = String(input.finalMessage ?? "");
  const variables = input.variables ?? {};
  const mappedSubstitutions = input.mappedSubstitutions ?? {};
  const requiredPlaceholders =
    input.requiredPlaceholders ??
    extractPlaceholders(apiFreshTempltContent || originalTemplate);

  const apiComparison = compareApiTemplateToSentMessage(
    apiFreshTempltContent,
    finalMessage,
    mappedSubstitutions
  );

  const cachedVsApiIdentical =
    !originalTemplate ||
    !apiFreshTempltContent ||
    originalTemplate === apiFreshTempltContent;
  const cachedVsApiDiff = cachedVsApiIdentical
    ? null
    : findFirstCharDiff(originalTemplate, apiFreshTempltContent);

  const requiredFields = requiredPlaceholders.map((ph) => ({
    placeholder: ph,
    field: PLACEHOLDER_TO_FIELD[ph] ?? null,
    label: PLACEHOLDER_TO_FIELD[ph]
      ? FIELD_LABELS[PLACEHOLDER_TO_FIELD[ph]]
      : ph,
  }));

  const unknownPlaceholders = requiredPlaceholders.filter(
    (ph) => !PLACEHOLDER_TO_FIELD[ph]
  );

  const nullOrEmptyFields = [];
  const substitutionDetails = [];

  for (const { placeholder, field, label } of requiredFields) {
    if (!field) continue;

    const rawValue = variables[field];
    const mappedValue = mappedSubstitutions[field] ?? "";

    substitutionDetails.push({
      field,
      label,
      placeholder,
      rawValue,
      mappedValue,
      isNull: isNullishValue(rawValue),
      isEmpty: isEmptyString(rawValue),
      mappedIsEmpty: mappedValue.trim() === "",
    });

    if (isNullishValue(rawValue)) {
      nullOrEmptyFields.push({
        field,
        label,
        placeholder,
        reason: "null/undefined",
        rawValue,
        mappedValue,
      });
    } else if (isEmptyString(rawValue)) {
      nullOrEmptyFields.push({
        field,
        label,
        placeholder,
        reason: "empty string",
        rawValue,
        mappedValue,
      });
    }
  }

  const passedFieldKeys = Object.keys(variables);
  const requiredFieldKeys = requiredFields
    .map((item) => item.field)
    .filter(Boolean);
  const extraVariables = passedFieldKeys.filter(
    (key) => !requiredFieldKeys.includes(key)
  );

  const missingVariables = requiredFields
    .filter(({ field }) => field && !(field in variables))
    .map(({ field, label, placeholder }) => ({
      field,
      label,
      placeholder,
      reason: "variables 객체에 키 없음",
    }));

  const unmatchedPlaceholders = extractPlaceholders(finalMessage);

  const expectedMessage = buildExpectedMessage(
    apiFreshTempltContent || originalTemplate,
    mappedSubstitutions
  );
  const messageMatchesExpected = expectedMessage === finalMessage;
  const firstCharDiff = messageMatchesExpected
    ? null
    : findFirstCharDiff(expectedMessage, finalMessage);
  const lineMismatches = messageMatchesExpected
    ? []
    : compareLines(expectedMessage, finalMessage);

  const issues = [];

  if (!apiFreshTempltContent.trim()) {
    issues.push(
      "apiFreshTempltContent 없음 — /akv10/template/list/ 조회 결과가 전달되지 않았습니다."
    );
  }

  if (!cachedVsApiIdentical) {
    issues.push(
      `캐시 template ≠ API fresh template (index ${cachedVsApiDiff?.index ?? "?"})`
    );
  }

  if (unknownPlaceholders.length > 0) {
    issues.push(
      `매핑 불가 플레이스홀더: ${unknownPlaceholders.join(", ")}`
    );
  }

  if (missingVariables.length > 0) {
    issues.push(
      `누락 변수: ${missingVariables
        .map((item) => `${item.label}(${item.field})`)
        .join(", ")}`
    );
  }

  if (extraVariables.length > 0) {
    issues.push(`불필요 변수(템플릿에 없음): ${extraVariables.join(", ")}`);
  }

  if (nullOrEmptyFields.length > 0) {
    issues.push(
      `null/빈 값: ${nullOrEmptyFields
        .map((item) => `${item.label}(${item.field}) → ${item.reason}`)
        .join(", ")}`
    );
  }

  if (apiComparison.sentRemainingPlaceholders.length > 0) {
    issues.push(
      `전송 message에 남은 placeholder: ${apiComparison.sentRemainingPlaceholders.join(", ")}`
    );
  }

  if (!apiComparison.matchesApiRawSubstitution) {
    const diff = apiComparison.firstDiffApiExpectedVsSent;
    if (diff) {
      issues.push(
        `[핵심] API templtContent 치환 기대값 ≠ 전송 message — index ${diff.index} (줄 ${diff.lineNumber}): expected ${diff.expectedChar}(code ${diff.expectedCharCode}) vs actual ${diff.actualChar}(code ${diff.actualCharCode})`
      );
    } else {
      issues.push(
        "[핵심] API templtContent 치환 기대값 ≠ 전송 message"
      );
    }

    if (apiComparison.firstMismatchLine) {
      issues.push(
        `[핵심] 첫 불일치 줄 번호: ${apiComparison.firstMismatchLine}`
      );
    }
  }

  if (apiLineEndingMismatch(apiComparison)) {
    issues.push(
      `줄바꿈 형식 차이(참고) — API: CRLF=${apiComparison.apiLineEndings.crlfCount} LF=${apiComparison.apiLineEndings.loneLfCount} | 전송: CRLF=${apiComparison.sentLineEndings.crlfCount} LF=${apiComparison.sentLineEndings.loneLfCount} (expected=actual 일치 시 단독 root cause 아님)`
    );
  }

  for (const mismatch of lineMismatches.slice(0, 5)) {
    issues.push(
      `줄 ${mismatch.line} 불일치 — expected: ${mismatch.expectedJson} | actual: ${mismatch.actualJson}`
    );
  }

  const apiTemplate = input.apiTemplate ?? {};
  const apiTemplateListRaw = input.apiTemplateListRaw ?? null;
  const apiButtons = apiTemplate.buttons ?? [];
  const apiListRawButtons = apiTemplateListRaw?.buttons ?? apiButtons;
  const sentButton = input.sentButton ?? input.aligoFormPayload?.button_1;
  const sentEmtitle = input.sentEmtitle ?? input.aligoFormPayload?.emtitle_1;

  const buttonsComparison = compareButtons(
    apiButtons,
    sentButton,
    mappedSubstitutions
  );
  const buttonStringifyAnalysis = analyzeButtonStringifyPipeline(
    apiButtons,
    sentButton,
    mappedSubstitutions
  );
  const emtitleComparison = compareEmTitle(
    apiTemplate,
    sentEmtitle,
    mappedSubstitutions
  );

  const expectedSendPayload = buildComparableSendPayload({
    tpl_code: input.templtCode,
    message_1: apiComparison.expectedFromApiSubstitution,
    button_1: buttonsComparison.expectedJson,
    emtitle_1: emtitleComparison.expected,
    subject_1: input.sentSubject ?? input.aligoFormPayload?.subject_1,
  });

  const actualSendPayload = buildComparableSendPayload({
    tpl_code: input.templtCode,
    message_1: finalMessage,
    button_1: sentButton,
    emtitle_1: sentEmtitle,
    subject_1: input.sentSubject ?? input.aligoFormPayload?.subject_1,
  });

  const payloadComparison = comparePayloadRaw(
    expectedSendPayload,
    actualSendPayload
  );

  if (buttonsComparison.reason === "MISSING_BUTTON") {
    issues.unshift(
      `[1순위] button_1 누락 — 템플릿 버튼 ${buttonsComparison.templateCount}개`
    );
  } else if (!buttonsComparison.match && apiButtons.length > 0) {
    issues.push(`button_1 불일치 — ${buttonsComparison.reason}`);
    for (const diff of buttonsComparison.fieldDiffs.slice(0, 5)) {
      issues.push(`  button diff: ${JSON.stringify(diff)}`);
    }
  }

  if (emtitleComparison.reason === "MISSING_EMTITLE") {
    issues.unshift(
      `[1순위] emtitle_1 누락 — 강조표기형(TEXT) templtTitle: ${JSON.stringify(emtitleComparison.expected)}`
    );
  } else if (!emtitleComparison.match && emtitleComparison.required) {
    issues.push("emtitle_1 불일치");
    if (emtitleComparison.firstDiff) {
      issues.push(
        `emtitle diff index ${emtitleComparison.firstDiff.index}: ${emtitleComparison.firstDiff.expectedChar} vs ${emtitleComparison.firstDiff.actualChar}`
      );
    }
  }

  if (!payloadComparison.match) {
    issues.push(
      `전체 payload JSON 불일치 — index ${payloadComparison.firstDiff?.index ?? "?"}`
    );
  }

  const report = {
    context: input.context ?? "unknown",
    templtCode: input.templtCode,
    match: issues.length === 0,
    originalTemplate,
    apiFreshTempltContent,
    apiTemplate,
    apiTemplateListRaw,
    cachedVsApiIdentical,
    cachedVsApiDiff,
    finalMessage,
    expectedMessage,
    messageMatchesExpected,
    apiComparison,
    buttonsComparison,
    buttonStringifyAnalysis,
    emtitleComparison,
    expectedSendPayload,
    actualSendPayload,
    payloadComparison,
    requiredPlaceholders,
    requiredFields,
    passedVariables: variables,
    mappedSubstitutions,
    missingVariables,
    extraVariables,
    nullOrEmptyFields,
    unknownPlaceholders,
    unmatchedPlaceholders,
    substitutionDetails,
    firstCharDiff,
    lineMismatches,
    issues,
  };

  report.templateSchemaValidationAnalysis = analyzeTemplateSchemaValidation(
    buildSchemaValidationInputFromReport(report)
  );

  if (!report.templateSchemaValidationAnalysis.match) {
    issues.unshift(`[1순위] ${report.templateSchemaValidationAnalysis.verdict}`);
  }

  report.match = issues.length === 0;
  report.issues = issues;

  report.rootCause = pinpointRootCause(report);
  report.confirmedRootCause = confirmRootCauseFromLogs(report);
  report.mismatchReason = {
    reason: report.confirmedRootCause.confirmedRootCause,
    detail: report.confirmedRootCause.evidence.join(" | "),
  };
  return report;
}

function apiLineEndingMismatch(apiComparison) {
  const api = apiComparison.apiLineEndings;
  const sent = apiComparison.sentLineEndings;
  return (
    api.crlfCount !== sent.crlfCount ||
    api.loneLfCount !== sent.loneLfCount ||
    api.loneCrCount !== sent.loneCrCount
  );
}

/** 치환만 적용 — templtContent 원본 줄바꿈(LF) 유지 (CRLF 변환 없음) */
function buildExpectedMessageLfOnly(originalTemplate, mappedSubstitutions) {
  let filled = String(originalTemplate ?? "");
  for (const [field, placeholder] of Object.entries(ALIGO_VARIABLE_MAP)) {
    const value = mappedSubstitutions[field] ?? "";
    filled = filled.replace(
      new RegExp(escapeRegExp(placeholder), "g"),
      value
    );
  }
  return filled;
}

function buildRawApiButtonJson(apiButtons) {
  if (!apiButtons || apiButtons.length === 0) return null;
  const sorted = [...apiButtons].sort(
    (a, b) => Number(a.ordering) - Number(b.ordering)
  );
  return JSON.stringify({ button: sorted });
}

function extractButtonList(source) {
  if (!source) return [];
  if (typeof source === "string") {
    const parsed = parseButtonJson(source);
    return Array.isArray(parsed?.button) ? parsed.button : [];
  }
  if (Array.isArray(source)) return source;
  if (Array.isArray(source?.button)) return source.button;
  return [];
}

/** Aligo 승인 button slot schema — linkType별 필드 규칙 (name literal 비교 없음) */
const ALIGO_LINK_TYPE_RULES = {
  AC: { linkMo: "empty_ok", linkPc: "empty_ok" },
  WL: { linkMo: "required", linkPc: "required" },
  MD: { linkMo: "empty_ok", linkPc: "empty_ok" },
  AL: { linkMo: "required", linkPc: "required" },
  BK: { linkMo: "empty_ok", linkPc: "empty_ok" },
  DS: { linkMo: "empty_ok", linkPc: "empty_ok" },
  BC: { linkMo: "empty_ok", linkPc: "empty_ok" },
  BT: { linkMo: "empty_ok", linkPc: "empty_ok" },
};

const ALIGO_BUTTON_SCHEMA_FIELDS = [
  "ordering",
  "name",
  "linkType",
  "linkTypeName",
  "linkMo",
  "linkPc",
  "linkIos",
  "linkAnd",
];

/**
 * 승인 템플릿 button definition → validation schema (literal name 값 비교 없음)
 */
function extractApprovedButtonSchemaDefinition(approvedButtons) {
  const sorted = [...(approvedButtons ?? [])].sort(
    (a, b) => Number(a.ordering) - Number(b.ordering)
  );

  return {
    buttonCount: sorted.length,
    rootShape: { wrapperKey: "button", itemType: "object" },
    slots: sorted.map((btn, index) => {
      const linkType = String(btn.linkType ?? "");
      return {
        slotIndex: index,
        ordering: String(btn.ordering ?? index + 1),
        linkType,
        linkTypeNameRequired: true,
        nameRequired: true,
        orderingType:
          typeof btn.ordering === "number" ? "number" : "string",
        allowedKeys: ALIGO_BUTTON_SCHEMA_FIELDS,
        linkRules:
          ALIGO_LINK_TYPE_RULES[linkType] ?? {
            linkMo: "empty_ok",
            linkPc: "empty_ok",
          },
      };
    }),
  };
}

function validateSentButtonAgainstSchema(schema, sentButtonRaw) {
  const violations = [];

  if (schema.buttonCount === 0) {
    if (sentButtonRaw) {
      violations.push({
        code: "BUTTON_UNEXPECTED",
        detail: "schema buttonCount=0 인데 button_1 전송됨",
      });
    }
    return { valid: violations.length === 0, violations, schema };
  }

  if (!sentButtonRaw) {
    violations.push({
      code: "BUTTON_MISSING",
      detail: `schema buttonCount=${schema.buttonCount} — button_1 누락`,
    });
    return { valid: false, violations, schema };
  }

  let parsed;
  try {
    parsed = JSON.parse(String(sentButtonRaw));
  } catch (error) {
    violations.push({
      code: "BUTTON_JSON_INVALID",
      detail: error instanceof Error ? error.message : "JSON parse fail",
    });
    return { valid: false, violations, schema };
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.button)) {
    violations.push({
      code: "BUTTON_ROOT_SHAPE",
      detail: "button_1 must be { button: [...] }",
    });
    return { valid: false, violations, schema };
  }

  const sentButtons = parsed.button;
  if (sentButtons.length !== schema.buttonCount) {
    violations.push({
      code: "BUTTON_COUNT",
      expected: schema.buttonCount,
      actual: sentButtons.length,
    });
  }

  const max = Math.max(schema.slots.length, sentButtons.length);
  for (let i = 0; i < max; i += 1) {
    const slotSchema = schema.slots[i];
    const sentBtn = sentButtons[i];

    if (!slotSchema) {
      violations.push({ code: "BUTTON_EXTRA_SLOT", slotIndex: i });
      continue;
    }
    if (!sentBtn || typeof sentBtn !== "object") {
      violations.push({
        code: "BUTTON_MISSING_SLOT",
        slotIndex: i,
        ordering: slotSchema.ordering,
      });
      continue;
    }

    if (String(sentBtn.linkType ?? "") !== slotSchema.linkType) {
      violations.push({
        code: "BUTTON_SLOT_LINKTYPE",
        slotIndex: i,
        expected: slotSchema.linkType,
        actual: sentBtn.linkType ?? null,
      });
    }

    const sentOrderingType =
      sentBtn.ordering == null ? "missing" : typeof sentBtn.ordering;
    if (
      slotSchema.orderingType === "string" &&
      sentOrderingType !== "string"
    ) {
      violations.push({
        code: "BUTTON_ORDERING_TYPE",
        slotIndex: i,
        expected: "string",
        actual: sentOrderingType,
      });
    } else if (
      slotSchema.orderingType === "number" &&
      sentOrderingType !== "number"
    ) {
      violations.push({
        code: "BUTTON_ORDERING_TYPE",
        slotIndex: i,
        expected: "number",
        actual: sentOrderingType,
      });
    }

    for (const key of ["ordering", "name", "linkType", "linkTypeName"]) {
      const val = sentBtn[key];
      if (val === null || val === undefined || String(val).trim() === "") {
        violations.push({
          code: "BUTTON_REQUIRED_FIELD",
          slotIndex: i,
          field: key,
        });
      }
    }

    for (const key of ALIGO_BUTTON_SCHEMA_FIELDS) {
      const val = sentBtn[key];
      if (val === null || val === undefined) {
        violations.push({
          code: "BUTTON_NULL_FIELD",
          slotIndex: i,
          field: key,
        });
      } else if (key !== "ordering" && typeof val !== "string") {
        violations.push({
          code: "BUTTON_FIELD_TYPE",
          slotIndex: i,
          field: key,
          actualType: typeof val,
        });
      }
    }

    const rules = slotSchema.linkRules;
    for (const linkField of ["linkMo", "linkPc"]) {
      const val = sentBtn[linkField];
      if (
        rules[linkField] === "required" &&
        (val == null || String(val).trim() === "")
      ) {
        violations.push({
          code: "BUTTON_LINKTYPE_RULE",
          slotIndex: i,
          field: linkField,
          linkType: slotSchema.linkType,
        });
      }
    }
  }

  return { valid: violations.length === 0, violations, schema };
}

function buildSchemaValidationInputFromReport(report, deliveryDetail = null) {
  const approvedButtons =
    report.apiTemplateListRaw?.buttons ?? report.apiTemplate?.buttons ?? [];
  return {
    templtCode:
      report.apiTemplateListRaw?.templtCode ??
      report.apiTemplate?.templtCode ??
      report.templtCode ??
      "",
    sentTplCode:
      report.expectedSendPayload?.tpl_code ?? report.templtCode ?? "",
    approvedButtons,
    approvedTempltContent:
      report.apiFreshTempltContent ?? report.apiTemplate?.templtContent ?? "",
    mappedSubstitutions: report.mappedSubstitutions ?? {},
    sentMessage: report.finalMessage ?? "",
    sentButton:
      report.buttonsComparison?.sentJson ??
      report.buttonStringifyAnalysis?.afterStringify ??
      null,
    historyButton: deliveryDetail?.button_json ?? null,
    historyMessage: deliveryDetail?.message ?? null,
    historyTplCode: deliveryDetail?.tpl_code ?? null,
    rsltMessage: deliveryDetail?.rslt_message ?? null,
  };
}

/**
 * Aligo 검증: tpl_code + message_1(template strict) + button_1(schema strict).
 * 승인 schema definition vs sent payload — literal name/string diff root cause 금지.
 */
function analyzeTemplateSchemaValidation(input, deliveryDetail = null) {
  const approvedTplCode = String(input.templtCode ?? "");
  const sentTplCode = String(input.sentTplCode ?? "");
  const approvedMessage = buildExpectedMessage(
    input.approvedTempltContent ?? "",
    input.mappedSubstitutions ?? {}
  );
  const sentMessage = String(input.sentMessage ?? "");

  const buttonSchema = extractApprovedButtonSchemaDefinition(
    input.approvedButtons ?? []
  );
  const buttonValidation = validateSentButtonAgainstSchema(
    buttonSchema,
    input.sentButton ?? null
  );

  const tplCodeMatch = approvedTplCode === sentTplCode;
  const messageMatch = approvedMessage === sentMessage;

  const violations = [];
  if (!tplCodeMatch) {
    violations.push({
      code: "TPL_CODE_MISMATCH",
      approved: approvedTplCode,
      sent: sentTplCode,
    });
  }
  if (!messageMatch) {
    violations.push({
      code: "MESSAGE_TEMPLATE_MISMATCH",
      detail: "templtContent 치환 strict !== message_1",
      firstDiff: findFirstCharDiff(approvedMessage, sentMessage),
      approvedLineEndings: analyzeLineEndings(approvedMessage),
      sentLineEndings: analyzeLineEndings(sentMessage),
    });
  }
  violations.push(...buttonValidation.violations);

  const match = violations.length === 0;
  const rsltMessage =
    input.rsltMessage ?? deliveryDetail?.rslt_message ?? null;

  return {
    sourceOfTruth:
      "Aligo 승인 template schema (tpl_code + message template + button definition)",
    compareTarget: "send payload field-level schema validation",
    match,
    verdict: match
      ? "SCHEMA_VALIDATION_MATCH"
      : `TEMPLATE_SCHEMA_VALIDATION_MISMATCH: ${violations.map((v) => v.code).slice(0, 5).join(", ")}`,
    validations: {
      tpl_code: {
        match: tplCodeMatch,
        approved: approvedTplCode,
        sent: sentTplCode,
      },
      message_1: {
        match: messageMatch,
        templateStrict: messageMatch,
        approvedSubstituted: approvedMessage,
        sent: sentMessage,
      },
      button_1: buttonValidation,
    },
    approvedButtonSchema: buttonSchema,
    violations,
    rsltMessage,
    schemaPassButRsltFailed:
      match && rsltMessage && String(rsltMessage).trim().length > 0,
    history:
      deliveryDetail || input.historyButton
        ? {
            tpl_code: input.historyTplCode ?? deliveryDetail?.tpl_code ?? null,
            message: input.historyMessage ?? deliveryDetail?.message ?? null,
            button_json:
              input.historyButton ?? deliveryDetail?.button_json ?? null,
          }
        : null,
  };
}

function logTemplateSchemaValidationDump(context, schemaResult) {
  const CMP = "[Aligo:debug:compare]";
  const SCH = "[Aligo:debug:schema]";

  console.log(`${SCH} ========== template schema validation (${context}) ==========`);
  console.log(`${SCH} source:`, schemaResult.sourceOfTruth);
  console.log(`${SCH} compare:`, schemaResult.compareTarget);
  console.log(`${SCH} verdict:`, schemaResult.verdict);

  console.log(`${SCH} --- [1] tpl_code ---`);
  console.log(`${SCH} approved:`, schemaResult.validations.tpl_code.approved);
  console.log(`${SCH} sent:`, schemaResult.validations.tpl_code.sent);
  console.log(
    `${SCH} match:`,
    schemaResult.validations.tpl_code.match ? "MATCH" : "MISMATCH"
  );

  console.log(`${SCH} --- [2] message_1 (template strict) ---`);
  console.log(`${SCH} approved (substituted):`, schemaResult.validations.message_1.approvedSubstituted);
  console.log(`${SCH} sent:`, schemaResult.validations.message_1.sent);
  console.log(
    `${SCH} match:`,
    schemaResult.validations.message_1.match ? "MATCH" : "MISMATCH"
  );

  console.log(`${SCH} --- [3] button_1 (approved schema definition) ---`);
  console.log(`${SCH} approved schema:`, JSON.stringify(schemaResult.approvedButtonSchema, null, 2));
  console.log(
    `${SCH} sent valid:`,
    schemaResult.validations.button_1.valid ? "VALID" : "INVALID"
  );
  if (schemaResult.validations.button_1.violations.length > 0) {
    console.warn(`${SCH} violations:`, schemaResult.validations.button_1.violations);
  } else {
    console.log(`${SCH} violations: (none)`);
  }

  if (schemaResult.schemaPassButRsltFailed) {
    console.warn(
      `${SCH} ⚠️ schema validation MATCH but rslt_message=${JSON.stringify(schemaResult.rsltMessage)} — schema 범위 밖 원인 (비동기/Aligo 내부 검증)`
    );
  }

  console.log(`${CMP} schema verdict:`, schemaResult.verdict);
  console.log(`${SCH} ========================================`);
}

function diffButtonLists(expList, actList, labelA, labelB) {
  const diffs = [];
  const max = Math.max(expList.length, actList.length);

  for (let i = 0; i < max; i += 1) {
    const exp = expList[i];
    const act = actList[i];
    if (!exp || !act) {
      diffs.push({
        ordering: i + 1,
        issue: !exp ? `${labelB} button extra` : `${labelB} button missing`,
      });
      continue;
    }
    for (const key of BUTTON_COMPARE_KEYS) {
      const expVal = exp[key] ?? "";
      const actVal = act[key] ?? "";
      if (String(expVal) !== String(actVal)) {
        diffs.push({
          ordering: exp.ordering ?? String(i + 1),
          field: key,
          [`${labelA}Value`]: expVal,
          [`${labelB}Value`]: actVal,
        });
      }
    }
  }

  return { match: diffs.length === 0, diffs };
}

function diffRawApiButtons(apiButtons, sentButtonRaw) {
  const expected = buildRawApiButtonJson(apiButtons);
  if (!expected || !sentButtonRaw) {
    return {
      match: expected === sentButtonRaw,
      diffs: [],
      expected,
      actual: sentButtonRaw ?? null,
    };
  }
  if (expected === sentButtonRaw) {
    return { match: true, diffs: [], expected, actual: sentButtonRaw };
  }

  const expParsed = parseButtonJson(expected);
  const actParsed = parseButtonJson(sentButtonRaw);
  const result = diffButtonLists(
    expParsed?.button ?? [],
    actParsed?.button ?? [],
    "api",
    "sent"
  );

  return {
    ...result,
    expected,
    actual: sentButtonRaw,
    diffs: result.diffs.map((d) => ({
      ordering: d.ordering,
      field: d.field ?? d.issue,
      apiValue: d.apiValue ?? d.leftValue,
      sentValue: d.sentValue ?? d.rightValue,
      issue: d.issue,
    })),
  };
}

function diffButtonJsonStrings(leftRaw, rightRaw, leftLabel = "left", rightLabel = "right") {
  if (leftRaw == null && rightRaw == null) {
    return { match: true, diffs: [] };
  }
  if (leftRaw == null || rightRaw == null) {
    return {
      match: false,
      diffs: [{ issue: `${leftLabel} or ${rightLabel} missing` }],
    };
  }

  const left = String(leftRaw);
  const right = String(rightRaw);
  if (left === right) {
    return { match: true, diffs: [] };
  }

  const leftParsed = parseButtonJson(left);
  const rightParsed = parseButtonJson(right);
  const leftList = leftParsed?.button;
  const rightList = rightParsed?.button;

  if (!Array.isArray(leftList) || !Array.isArray(rightList)) {
    return {
      match: false,
      diffs: [
        {
          issue: "button JSON parse/shape mismatch",
          leftPreview: left.slice(0, 120),
          rightPreview: right.slice(0, 120),
        },
      ],
    };
  }

  return diffButtonLists(leftList, rightList, leftLabel, rightLabel);
}

function collectSchemaValidationEvidence(report, deliveryDetail = null) {
  const schema =
    report.templateSchemaValidationAnalysis ??
    analyzeTemplateSchemaValidation(
      buildSchemaValidationInputFromReport(report, deliveryDetail),
      deliveryDetail
    );

  const evidence = [];
  if (!schema.match) {
    evidence.push(`TEMPLATE_SCHEMA: ${schema.verdict}`);
    evidence.push(`source: ${schema.sourceOfTruth}`);
    for (const violation of schema.violations.slice(0, 8)) {
      evidence.push(
        `[${violation.code}] ${violation.detail ?? JSON.stringify(violation)}`
      );
    }
  } else if (schema.schemaPassButRsltFailed) {
    evidence.push(
      `schema validation MATCH — rslt_message=${JSON.stringify(schema.rsltMessage)} 원인은 schema 범위 밖`
    );
  }

  return {
    hasMismatch: !schema.match,
    schemaPassButRsltFailed: schema.schemaPassButRsltFailed,
    evidence,
    schema,
  };
}

function buildThreeWayDiff(report, deliveryDetail = null) {
  const schemaEvidence = collectSchemaValidationEvidence(
    report,
    deliveryDetail
  );
  const schema = schemaEvidence.schema;

  return {
    templtCode: report.templtCode ?? report.apiTemplate?.templtCode ?? null,
    rsltMessage: deliveryDetail?.rslt_message ?? schema.rsltMessage ?? null,
    schema,
    validations: schema.validations,
    approvedButtonSchema: schema.approvedButtonSchema,
    violations: schema.violations,
    verdict: schema.verdict,
    schemaPassButRsltFailed: schema.schemaPassButRsltFailed,
    evidence: schemaEvidence.evidence,
    history: schema.history,
  };
}

function logThreeWayDiff(context, threeWay, confirmed) {
  logTemplateSchemaValidationDump(context, threeWay.schema ?? threeWay);

  const CMP = "[Aligo:debug:compare]";

  if (confirmed?.confirmedRootCause) {
    console.warn(
      `${CMP} CONFIRMED_ROOT_CAUSE: ${confirmed.confirmedRootCause}`
    );
    if (confirmed.schemaViolations) {
      console.warn(`${CMP} schema violations:`, confirmed.schemaViolations);
    }
    if (confirmed.schemaVerdict) {
      console.warn(`${CMP} schema verdict:`, confirmed.schemaVerdict);
    }
    for (const line of confirmed.evidence) {
      console.warn(`${CMP} evidence: ${line}`);
    }
  } else {
    console.log(`${CMP} CONFIRMED_ROOT_CAUSE: NONE (로그만으로 특정 불가)`);
    for (const line of confirmed?.evidence ?? []) {
      console.log(`${CMP} note: ${line}`);
    }
  }

  console.log(`${CMP} ========================================`);
}

const ROOT_CAUSE_CODES = [
  "VARIABLE_MISMATCH",
  "TEMPLATE_CODE_MISMATCH",
  "TEMPLATE_SCHEMA_VALIDATION_MISMATCH",
  "MESSAGE_MISMATCH",
];

/**
 * 로그 필드만으로 root cause 1개 확정.
 * tpl_code + message_1(template strict) + button_1(schema strict) 우선.
 */
function confirmRootCauseFromLogs(report, deliveryDetail = null) {
  const api = report.apiComparison ?? {};
  const expectedMessage =
    api.expectedFromApiSubstitution ?? report.expectedMessage ?? "";
  const actualMessage = report.finalMessage ?? "";
  const sentTplCode =
    report.expectedSendPayload?.tpl_code ?? report.templtCode ?? "";
  const apiTplCode = report.apiTemplate?.templtCode ?? report.templtCode ?? "";

  const variableEvidence = [];
  if ((api.sentRemainingPlaceholders ?? []).length > 0) {
    variableEvidence.push(
      `sentRemainingPlaceholders: ${api.sentRemainingPlaceholders.join(", ")}`
    );
  }
  if ((report.missingVariables ?? []).length > 0) {
    variableEvidence.push(
      `missingVariables: ${report.missingVariables.map((v) => v.field).join(", ")}`
    );
  }
  if ((report.nullOrEmptyFields ?? []).length > 0) {
    variableEvidence.push(
      `nullOrEmptyFields: ${report.nullOrEmptyFields.map((v) => `${v.field}(${v.reason})`).join(", ")}`
    );
  }
  if (variableEvidence.length > 0) {
    return {
      confirmedRootCause: "VARIABLE_MISMATCH",
      evidence: variableEvidence,
    };
  }

  if (sentTplCode && apiTplCode && sentTplCode !== apiTplCode) {
    return {
      confirmedRootCause: "TEMPLATE_CODE_MISMATCH",
      evidence: [`sent tpl_code=${sentTplCode} vs api templtCode=${apiTplCode}`],
    };
  }

  if (
    deliveryDetail?.tpl_code &&
    sentTplCode &&
    String(deliveryDetail.tpl_code) !== String(sentTplCode)
  ) {
    return {
      confirmedRootCause: "TEMPLATE_CODE_MISMATCH",
      evidence: [
        `history tpl_code=${deliveryDetail.tpl_code} vs sent tpl_code=${sentTplCode}`,
      ],
    };
  }

  if (!report.cachedVsApiIdentical && report.cachedVsApiDiff) {
    return {
      confirmedRootCause: "TEMPLATE_CODE_MISMATCH",
      evidence: [
        `cached templtContent ≠ apiFreshTempltContent at index ${report.cachedVsApiDiff.index}`,
      ],
    };
  }

  const schemaCheck = collectSchemaValidationEvidence(
    report,
    deliveryDetail
  );
  if (schemaCheck.hasMismatch && schemaCheck.schema && !schemaCheck.schema.match) {
    return {
      confirmedRootCause: "TEMPLATE_SCHEMA_VALIDATION_MISMATCH",
      schemaViolations: schemaCheck.schema.violations,
      schemaVerdict: schemaCheck.schema.verdict,
      evidence: schemaCheck.evidence,
    };
  }

  if (schemaCheck.schemaPassButRsltFailed) {
    return {
      confirmedRootCause: null,
      evidence: schemaCheck.evidence,
    };
  }

  if (expectedMessage !== actualMessage) {
    const diff = api.firstDiffApiExpectedVsSent;
    return {
      confirmedRootCause: "MESSAGE_MISMATCH",
      evidence: [
        diff
          ? `expected vs actual byte diff index ${diff.index} line ${diff.lineNumber}: ${diff.expectedChar}(${diff.expectedCharCode}) vs ${diff.actualChar}(${diff.actualCharCode})`
          : "expected message_1 !== actual message_1",
      ],
    };
  }

  if (
    deliveryDetail?.message &&
    String(deliveryDetail.message) !== String(actualMessage)
  ) {
    return {
      confirmedRootCause: "MESSAGE_MISMATCH",
      evidence: [
        "history/detail message !== sent message_1",
        `history: ${JSON.stringify(deliveryDetail.message).slice(0, 160)}`,
        `sent: ${JSON.stringify(actualMessage).slice(0, 160)}`,
      ],
    };
  }

  return {
    confirmedRootCause: null,
    evidence: [
      "pre-send BUTTON/MESSAGE/HISTORY 로그상 diff 없음 — history/detail 수신 후 재판정 필요",
    ],
  };
}

/** @deprecated confirmRootCauseFromLogs 사용 */
function resolveMismatchReason(report, options = {}) {
  const result = confirmRootCauseFromLogs(report);
  return {
    reason: result.confirmedRootCause,
    detail: result.evidence.join(" | "),
  };
}

function logNewlineDiff(tag, expected, actual) {
  const exp = analyzeLineEndings(expected);
  const act = analyzeLineEndings(actual);

  console.log(`${tag} newline analysis — expected:`, exp);
  console.log(`${tag} newline analysis — actual:`, act);

  const diffs = [];
  if (exp.crlfCount !== act.crlfCount) {
    diffs.push(`CRLF count ${exp.crlfCount} vs ${act.crlfCount}`);
  }
  if (exp.loneLfCount !== act.loneLfCount) {
    diffs.push(`LF-only count ${exp.loneLfCount} vs ${act.loneLfCount}`);
  }
  if (exp.loneCrCount !== act.loneCrCount) {
    diffs.push(`CR-only count ${exp.loneCrCount} vs ${act.loneCrCount}`);
  }
  if (exp.trailingWhitespace !== act.trailingWhitespace) {
    diffs.push(
      `trailing whitespace ${exp.trailingWhitespace} vs ${act.trailingWhitespace}`
    );
  }
  if (exp.endsWithCrlf !== act.endsWithCrlf) {
    diffs.push(`endsWith CRLF ${exp.endsWithCrlf} vs ${act.endsWithCrlf}`);
  }
  if (exp.endsWithLf !== act.endsWithLf) {
    diffs.push(`endsWith LF ${exp.endsWithLf} vs ${act.endsWithLf}`);
  }

  const expSpaces = analyzeWhitespacePerLine(expected);
  const actSpaces = analyzeWhitespacePerLine(actual);
  if (expSpaces.length > 0 || actSpaces.length > 0) {
    console.log(`${tag} space/trailing diff — expected lines:`, expSpaces);
    console.log(`${tag} space/trailing diff — actual lines:`, actSpaces);
    if (expSpaces.length !== actSpaces.length) {
      diffs.push(
        `whitespace line issues ${expSpaces.length} vs ${actSpaces.length}`
      );
    }
  }

  if (diffs.length > 0) {
    console.warn(`${tag} ⚠️ \\n / \\r\\n / space 차이:`, diffs);
  } else {
    console.log(`${tag} ✅ \\n / \\r\\n / trailing space 동일`);
  }

  return diffs;
}

/**
 * Proxy · Next.js 공통 — [Aligo:debug:compare|button|message] prefix 로그
 * 발송 payload / 로직 변경 없음
 */
function logAligoCompareDebug(context, report, aligoFormPayload = null) {
  const MSG = "[Aligo:debug:message]";
  const BTN = "[Aligo:debug:button]";
  const CMP = "[Aligo:debug:compare]";

  const api = report.apiComparison ?? {};
  const btnPipe = report.buttonStringifyAnalysis;
  const btnCmp = report.buttonsComparison;

  const expectedMessage =
    api.expectedFromApiSubstitution ?? report.expectedMessage ?? "";
  const actualMessage = report.finalMessage ?? "";
  const expectedButton =
    btnCmp?.expectedJson ?? btnPipe?.expectedStringify ?? null;
  const actualButton =
    btnCmp?.sentJson ??
    btnPipe?.afterStringify ??
    aligoFormPayload?.button_1 ??
    null;

  const messageJsonMatch =
    JSON.stringify(expectedMessage) === JSON.stringify(actualMessage);
  const messageByteMatch = expectedMessage === actualMessage;
  const buttonMatch = expectedButton === actualButton;

  console.log(`${MSG} ========== message_1 비교 (${context}) ==========`);
  console.log(`${MSG} templtCode:`, report.templtCode);
  console.log(`${MSG} --- [1] templtContent 원본 (Aligo API) ---`);
  console.log(report.apiFreshTempltContent);
  console.log(
    `${MSG} templtContent JSON.stringify:`,
    JSON.stringify(report.apiFreshTempltContent)
  );
  console.log(
    `${MSG} templtContent line endings:`,
    analyzeLineEndings(report.apiFreshTempltContent)
  );
  console.log(`${MSG} --- [2] 치환 expected message_1 (raw) ---`);
  console.log(expectedMessage);
  console.log(`${MSG} expected JSON.stringify:`, JSON.stringify(expectedMessage));
  console.log(`${MSG} --- [3] actual message_1 전송값 (raw) ---`);
  console.log(actualMessage);
  console.log(`${MSG} actual JSON.stringify:`, JSON.stringify(actualMessage));
  console.log(`${MSG} JSON.stringify 비교:`, messageJsonMatch ? "EQUAL" : "DIFF");
  console.log(`${MSG} byte 비교 (expected vs actual):`, messageByteMatch ? "EQUAL" : "DIFF");
  logNewlineDiff(MSG, expectedMessage, actualMessage);
  if (api.firstDiffApiExpectedVsSent) {
    console.warn(`${MSG} first char diff:`, api.firstDiffApiExpectedVsSent);
  }
  if ((api.sentRemainingPlaceholders ?? []).length > 0) {
    console.warn(`${MSG} ⚠️ 미치환 placeholder:`, api.sentRemainingPlaceholders);
  }
  console.log(`${MSG} ========================================`);

  console.log(`${BTN} ========== button_1 비교 (${context}) ==========`);
  console.log(`${BTN} --- stringify 직전 객체 ---`);
  console.log(JSON.stringify(btnPipe?.beforeObject ?? { button: [] }, null, 2));
  console.log(`${BTN} --- expected button (stringify 후) ---`);
  console.log(expectedButton ?? "(없음)");
  console.log(`${BTN} --- actual button (stringify 후) ---`);
  console.log(actualButton ?? "(없음)");
  console.log(`${BTN} expected vs actual:`, buttonMatch ? "EQUAL" : "DIFF");

  if (btnPipe) {
    console.log(`${BTN} null/undefined (API 원본):`, btnPipe.rawApiNullUndefinedFields);
    console.log(`${BTN} null/undefined (stringify 직전):`, btnPipe.nullUndefinedFields);
    console.log(`${BTN} linkType/linkTypeName match:`, btnPipe.linkTypeAllMatch);
    for (const check of btnPipe.linkTypeChecks ?? []) {
      const mark = check.exactMatch ? "✅" : "❌";
      console.log(
        `${BTN} ${mark} [${check.ordering}] ${check.field}: template=${JSON.stringify(check.templateValue)} sent=${JSON.stringify(check.sentValue)}`
      );
    }
    console.log(`${BTN} array order match:`, btnPipe.orderComparison.orderingSequenceMatch);
    console.log(`${BTN} api sequence:`, btnPipe.orderComparison.apiSequence);
    console.log(`${BTN} sent sequence:`, btnPipe.orderComparison.sentSequence);
    if (btnPipe.stringifyDiff) {
      console.warn(`${BTN} stringify diff:`, btnPipe.stringifyDiff);
    }
  }

  const schema =
    report.templateSchemaValidationAnalysis ??
    analyzeTemplateSchemaValidation(buildSchemaValidationInputFromReport(report, null));
  logTemplateSchemaValidationDump(`${context} (pre-send)`, schema);

  console.log(`${BTN} ========================================`);

  const mismatch =
    report.confirmedRootCause ??
    confirmRootCauseFromLogs(report, null);

  console.log(`${CMP} ========== 최종 비교 (${context}) ==========`);
  console.log(`${CMP} templtCode:`, report.templtCode);
  console.log(
    `${CMP} expected message vs actual message:`,
    messageByteMatch ? "MATCH" : "MISMATCH"
  );
  console.log(
    `${CMP} expected button vs actual button:`,
    buttonMatch ? "MATCH" : "MISMATCH"
  );

  if (mismatch.confirmedRootCause) {
    console.warn(
      `${CMP} CONFIRMED_ROOT_CAUSE: ${mismatch.confirmedRootCause}`
    );
    for (const line of mismatch.evidence) {
      console.warn(`${CMP} evidence: ${line}`);
    }
  } else {
    console.log(`${CMP} CONFIRMED_ROOT_CAUSE: NONE (pre-send logs all MATCH)`);
    for (const line of mismatch.evidence) {
      console.log(`${CMP} note: ${line}`);
    }
  }

  console.log(`${CMP} codes: ${ROOT_CAUSE_CODES.join(" | ")}`);
  logThreeWayDiff(
    `${context} (pre-send)`,
    buildThreeWayDiff(report, null),
    mismatch
  );

  return mismatch;
}

/**
 * /akv10/template/list/ API 응답 로그 (디버그 전용)
 */
function logAligoTemplateListFetch(context, fetchResult) {
  const tag = `[Aligo:debug:${context}:template-list]`;
  console.log(`${tag} ========== /akv10/template/list/ ==========`);
  console.log(`${tag} API message:`, fetchResult.listMessage);
  console.log(`${tag} total templates:`, fetchResult.totalCount);

  if (fetchResult.matched) {
    const t = fetchResult.matched;
    console.log(`${tag} matched templtCode:`, t.templtCode);
    console.log(`${tag} templateEmType:`, t.templateEmType);
    console.log(`${tag} templtTitle (emtitle 후보):`, t.templtTitle);
    console.log(`${tag} buttons (${(t.buttons ?? []).length}):`, JSON.stringify(t.buttons ?? []));
    console.log(`${tag} --- templtContent 원본 (API 그대로) ---`);
    console.log(t.templtContent);
    console.log(`${tag} templtContent (JSON):`, JSON.stringify(t.templtContent));
    console.log(`${tag} templtContent line endings:`, analyzeLineEndings(t.templtContent));
    console.log(`${tag} templtContent placeholders:`, extractPlaceholders(t.templtContent));
    console.log(`${tag} template raw (JSON):`, JSON.stringify(t));
  } else {
    console.warn(`${tag} ⚠️ templtCode 매칭 실패`);
    console.log(`${tag} available codes:`, fetchResult.availableCodes);
  }

  if (Array.isArray(fetchResult.allTemplates) && fetchResult.allTemplates.length > 0) {
    console.log(`${tag} ===== templateCode별 templtContent 요약 =====`);
    for (const t of fetchResult.allTemplates) {
      console.log(`${tag} [${t.templtCode}] templtContent (JSON.stringify):`, JSON.stringify(t.templtContent));
      console.log(`${tag} [${t.templtCode}] buttons:`, JSON.stringify(t.buttons ?? []));
    }
  }

  console.log(`${tag} ==========================================`);
}

function logTemplateMismatchDebug(context, report, aligoFormPayload = null) {
  logAligoCompareDebug(context, report, aligoFormPayload);
}

module.exports = {
  analyzeTemplateMismatch,
  logTemplateMismatchDebug,
  logAligoCompareDebug,
  logAligoTemplateListFetch,
  logThreeWayDiff,
  buildThreeWayDiff,
  compareApiTemplateToSentMessage,
  extractPlaceholders,
  buildExpectedMessage,
  analyzeLineEndings,
  analyzeButtonStringifyPipeline,
  buildButtonObjectBeforeStringify,
  confirmRootCauseFromLogs,
  resolveMismatchReason,
  analyzeTemplateSchemaValidation,
  buildSchemaValidationInputFromReport,
  logTemplateSchemaValidationDump,
  extractApprovedButtonSchemaDefinition,
  validateSentButtonAgainstSchema,
  collectSchemaValidationEvidence,
  diffRawApiButtons,
};
