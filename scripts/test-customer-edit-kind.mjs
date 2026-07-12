/**
 * 고객 수정 유형 분류 · 24시간 잠금 로직 단위 검증 (DB 불필요)
 * 실행: node scripts/test-customer-edit-kind.mjs
 */

import assert from "node:assert/strict";

const WIRED = "유선주문";
const WINDOW_MS = 24 * 60 * 60 * 1000;
const LOCK_MSG =
  "주문채널과 주문상품은 등록 후 24시간이 지나 수정할 수 없습니다.\n고객명, 전화번호, 메모는 수정 가능합니다.";

function isEditableNaver(source, sourceRef) {
  if (source !== "customer_add") return false;
  return !String(sourceRef).trim().startsWith("backfill:");
}

function classify({ order_channel, order_product, stats }) {
  if (stats.some((r) => isEditableNaver(r.source, r.source_ref))) return "naver";
  const hasWired = stats.some(
    (r) =>
      r.source === "order_registration" ||
      String(r.source_ref ?? "")
        .trim()
        .startsWith("backfill:")
  );
  const channel = String(order_channel ?? "").trim();
  const product = String(order_product ?? "").trim();
  if (hasWired || channel === WIRED) return "wired";
  if (!channel && !product) return "crm";
  return "naver";
}

function withinWindow(createdAt, now) {
  return now.getTime() - new Date(createdAt).getTime() <= WINDOW_MS;
}

function ok(label) {
  console.log(`✓ ${label}`);
}

assert.equal(
  classify({ order_channel: null, order_product: null, stats: [] }),
  "crm"
);
ok("① CRM: 통계 없음 + 채널/상품 없음 → 주문영역 미표시 대상");

assert.equal(
  classify({
    order_channel: "네이버",
    order_product: "과메기",
    stats: [{ source: "customer_add", source_ref: "uuid-1" }],
  }),
  "naver"
);
ok("② 네이버: customer_add 통계");

assert.equal(
  classify({
    order_channel: "유선주문",
    order_product: "문어",
    stats: [{ source: "order_registration", source_ref: "order:1" }],
  }),
  "wired"
);
ok("③ 유선: order_registration");

assert.equal(
  classify({
    order_channel: "유선주문",
    order_product: "문어",
    stats: [{ source: "customer_add", source_ref: "backfill:wired:x:1" }],
  }),
  "wired"
);
ok("③ 유선: backfill");

assert.equal(
  classify({
    order_channel: "네이버",
    order_product: "과메기",
    stats: [
      { source: "order_registration", source_ref: "a" },
      { source: "customer_add", source_ref: "b" },
    ],
  }),
  "naver"
);
ok("혼재 시 네이버 우선");

const now = new Date("2026-07-12T10:00:00.000Z");
const within = new Date(now.getTime() - WINDOW_MS + 60_000).toISOString();
const after = new Date(now.getTime() - WINDOW_MS - 60_000).toISOString();

assert.equal(withinWindow(within, now), true);
assert.equal(withinWindow(after, now), false);
ok("24시간 이내/이후 판정");

assert.ok(LOCK_MSG.includes("고객명, 전화번호, 메모는 수정 가능"));
ok("잠금 안내 문구");

/** PATCH 분기 시뮬레이션: 잠금 시에도 메모 저장, 채널/상품만 유지 */
function simulatePatch({
  kind,
  prevChannel,
  prevProduct,
  nextChannel,
  nextProduct,
  memo,
  matchingNaverCreatedAt,
}) {
  const isCrm = kind === "crm";
  const orderAttrsChanged =
    !isCrm &&
    (prevChannel !== nextChannel || prevProduct !== nextProduct);

  let orderAttrLocked = false;
  let savedChannel = isCrm ? prevChannel : nextChannel;
  let savedProduct = isCrm ? prevProduct : nextProduct;
  let statsCorrected = false;

  if (
    !isCrm &&
    orderAttrsChanged &&
    prevChannel &&
    prevProduct &&
    matchingNaverCreatedAt
  ) {
    if (!withinWindow(matchingNaverCreatedAt, now)) {
      orderAttrLocked = true;
      savedChannel = prevChannel;
      savedProduct = prevProduct;
    } else {
      statsCorrected = true;
    }
  }

  return { savedMemo: memo, savedChannel, savedProduct, orderAttrLocked, statsCorrected };
}

let r = simulatePatch({
  kind: "crm",
  prevChannel: "",
  prevProduct: "",
  nextChannel: "네이버",
  nextProduct: "문어",
  memo: "CRM 메모",
  matchingNaverCreatedAt: null,
});
assert.equal(r.savedChannel, "");
assert.equal(r.savedMemo, "CRM 메모");
assert.equal(r.statsCorrected, false);
ok("① CRM 메모 저장 · 통계/채널 미반영");

r = simulatePatch({
  kind: "naver",
  prevChannel: "네이버",
  prevProduct: "과메기",
  nextChannel: "네이버",
  nextProduct: "문어",
  memo: "ok",
  matchingNaverCreatedAt: within,
});
assert.equal(r.savedProduct, "문어");
assert.equal(r.statsCorrected, true);
ok("② 24h 이내 상품 변경 → 통계 정정");

r = simulatePatch({
  kind: "naver",
  prevChannel: "네이버",
  prevProduct: "과메기",
  nextChannel: "네이버",
  nextProduct: "문어",
  memo: "다음 과메기 주문 예정",
  matchingNaverCreatedAt: after,
});
assert.equal(r.savedProduct, "과메기");
assert.equal(r.savedMemo, "다음 과메기 주문 예정");
assert.equal(r.orderAttrLocked, true);
ok("② 24h 이후 상품 차단 + 메모 저장");

r = simulatePatch({
  kind: "naver",
  prevChannel: "네이버",
  prevProduct: "과메기",
  nextChannel: "네이버",
  nextProduct: "과메기",
  memo: "메모만",
  matchingNaverCreatedAt: after,
});
assert.equal(r.orderAttrLocked, false);
assert.equal(r.savedMemo, "메모만");
ok("② 24h 이후 메모만 → 정상 저장");

r = simulatePatch({
  kind: "wired",
  prevChannel: "유선주문",
  prevProduct: "문어",
  nextChannel: "유선주문",
  nextProduct: "문어",
  memo: "유선 메모",
  matchingNaverCreatedAt: null,
});
assert.equal(r.savedMemo, "유선 메모");
assert.equal(r.statsCorrected, false);
ok("③ 유선 고객정보/메모 수정 · 통계 영향 없음");

console.log("\n모든 단위 테스트 통과");
