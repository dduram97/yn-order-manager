function summarizeAligoPayload(payload) {
  let buttonCount = 0;
  if (payload.button) {
    try {
      const parsed = JSON.parse(payload.button);
      buttonCount = Array.isArray(parsed?.button) ? parsed.button.length : 0;
    } catch {
      buttonCount = -1;
    }
  }
  return {
    templtCode: payload.templtCode,
    messageLength: String(payload.message ?? "").length,
    buttonCount,
  };
}

function logAligoFail(input) {
  const p = input.payload ?? { messageLength: 0, buttonCount: 0 };
  console.error("[ALIGO:FAIL]");
  console.error(`- failure_kind: ${input.failure_kind}`);
  console.error(`- reason: ${input.reason}`);
  console.error(`- retry_count: ${input.retry_count}`);
  console.error(`- endpoint: ${input.endpoint}`);
  console.error(
    `- payload summary: message_1 length=${p.messageLength}, button count=${p.buttonCount}${p.templtCode ? `, tpl_code=${p.templtCode}` : ""}`
  );
}

function logAligoProxy(input) {
  console.log("[ALIGO:PROXY]");
  console.log(`- direction: ${input.direction}`);
  console.log(`- endpoint: ${input.endpoint}`);
  if (input.http_status != null) console.log(`- http_status: ${input.http_status}`);
  if (input.aligo_code != null) console.log(`- aligo_code: ${input.aligo_code}`);
  if (input.aligo_message != null) {
    console.log(`- aligo_message: ${input.aligo_message}`);
  }
  if (input.detail) console.log(`- detail: ${input.detail}`);
}

function logAligoFinal(input) {
  console.log("[ALIGO:FINAL]");
  console.log(`- success: ${input.success}`);
  console.log(`- endpoint: ${input.endpoint}`);
  if (input.reason) console.log(`- reason: ${input.reason}`);
  if (input.aligo_code != null) console.log(`- aligo_code: ${input.aligo_code}`);
  if (input.retry_count != null) console.log(`- retry_count: ${input.retry_count}`);
}

module.exports = {
  summarizeAligoPayload,
  logAligoFail,
  logAligoProxy,
  logAligoFinal,
};
