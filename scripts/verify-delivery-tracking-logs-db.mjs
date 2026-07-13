/**
 * delivery_tracking_logs 실제 DB 검증
 * 실행: node scripts/verify-delivery-tracking-logs-db.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const env = {};
  if (!existsSync(".env.local")) return env;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    env[t.slice(0, i)] = t.slice(i + 1);
  }
  return env;
}

function resolveEventType(source, deliveryStatus, previousStatus) {
  if (deliveryStatus === "delivered" && previousStatus !== "delivered") {
    return "delivery_completed";
  }
  return source;
}

const COUNTABLE = ["customer_view", "delivery_completed"];
const LABELS = {
  customer_view: "고객 배송조회",
  delivery_completed: "배송완료 확인",
  admin_view: "관리자 조회",
  auto_sync: "자동 동기화",
};

const results = {
  logSave: null,
  countAgg: null,
  modal: null,
  dedupe: null,
  issues: [],
};

function pass(key, msg) {
  results[key] = { ok: true, msg };
  console.log(`✅ [${key}] ${msg}`);
}

function fail(key, msg) {
  results[key] = { ok: false, msg };
  results.issues.push(`${key}: ${msg}`);
  console.error(`❌ [${key}] ${msg}`);
}

async function countableCount(admin, orderId) {
  const { data, error } = await admin
    .from("delivery_tracking_logs")
    .select("id")
    .eq("order_id", orderId)
    .in("event_type", COUNTABLE);
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceKey || !anonKey) {
    console.error("FAIL: Supabase env 누락");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey);
  const anon = createClient(url, anonKey);
  const createdIds = [];

  const { data: orders, error: orderErr } = await admin
    .from("orders")
    .select("id, customer_name, phone, tracking_number, delivery_status")
    .order("created_at", { ascending: false })
    .limit(20);

  if (orderErr || !orders?.length) {
    console.error("FAIL: orders 조회 실패", orderErr?.message || "empty");
    process.exit(1);
  }

  // delivery_completed 가 없는 주문을 우선 사용 (중복 테스트용)
  let order = null;
  for (const candidate of orders) {
    const { data: existing } = await admin
      .from("delivery_tracking_logs")
      .select("id")
      .eq("order_id", candidate.id)
      .eq("event_type", "delivery_completed")
      .limit(1);
    if (!existing?.length) {
      order = candidate;
      break;
    }
  }
  if (!order) order = orders[0];

  console.log("── 대상 주문 ──");
  console.log({
    id: order.id,
    customer_name: order.customer_name,
    tracking_number: order.tracking_number,
    delivery_status: order.delivery_status,
  });

  // 마이그레이션 확인
  const { error: colErr } = await admin
    .from("delivery_tracking_logs")
    .select("id, event_type")
    .limit(1);
  if (colErr) {
    fail("logSave", `마이그레이션 미적용: ${colErr.message}`);
    process.exit(1);
  }
  console.log("OK: event_type column present (018)");

  // anon 차단
  const anonInsert = await anon.from("delivery_tracking_logs").insert({
    order_id: order.id,
    tracking_number: order.tracking_number || "000000000000",
    delivery_status: "ready",
    event_type: "customer_view",
  });
  if (!anonInsert.error) {
    results.issues.push("anon insert가 허용됨 — RLS 재확인 필요");
    console.warn("WARN: anon insert allowed");
  } else {
    console.log("OK: anon insert blocked —", anonInsert.error.message);
  }

  // ── 조회 횟수 0 → 1 → 2 ──
  const baseCount = await countableCount(admin, order.id);
  console.log(`baseline countable count = ${baseCount}`);

  async function insertLog(event_type, delivery_status) {
    const { data, error } = await admin
      .from("delivery_tracking_logs")
      .insert({
        order_id: order.id,
        tracking_number: order.tracking_number || "000000000000",
        delivery_status,
        event_type,
        location: "verify-db-test",
      })
      .select("id, event_type, created_at")
      .single();
    if (error) throw new Error(`${event_type}: ${error.message}`);
    createdIds.push(data.id);
    return data;
  }

  // 고객 배송조회 #1
  const view1 = await insertLog("customer_view", "in_transit");
  const count1 = await countableCount(admin, order.id);
  if (count1 !== baseCount + 1) {
    fail("countAgg", `기대 ${baseCount + 1}, 실제 ${count1} (1회 조회 후)`);
  } else {
    console.log(`count ${baseCount} → ${count1}`);
  }

  // 고객 배송조회 #2 (배송중)
  const view2 = await insertLog("customer_view", "in_transit");
  const count2 = await countableCount(admin, order.id);
  if (count2 !== baseCount + 2) {
    fail("countAgg", `기대 ${baseCount + 2}, 실제 ${count2} (2회 조회 후)`);
  } else {
    console.log(`count ${count1} → ${count2}`);
    pass("countAgg", `0기준 상대증가 ${baseCount}→${count1}→${count2} (customer_view)`);
  }

  pass(
    "logSave",
    `service role로 customer_view 2건 저장 성공 (${view1.id}, ${view2.id})`
  );

  // ── delivery_completed 최초 1회 ──
  const firstType = resolveEventType("customer_view", "delivered", "in_transit");
  if (firstType !== "delivery_completed") {
    fail("dedupe", `최초 전환 event_type 기대 delivery_completed, 실제 ${firstType}`);
  }

  let completedRow = null;
  const { data: existingCompleted } = await admin
    .from("delivery_tracking_logs")
    .select("id")
    .eq("order_id", order.id)
    .eq("event_type", "delivery_completed")
    .limit(1);

  if (existingCompleted?.length) {
    completedRow = existingCompleted[0];
    console.log("기존 delivery_completed 존재 — 신규 insert 생략:", completedRow.id);
  } else {
    completedRow = await insertLog("delivery_completed", "delivered");
    console.log("OK delivery_completed insert:", completedRow.id);
  }

  const afterCompletedCount = await countableCount(admin, order.id);
  // completed was new → +1; if existed, no change from our inserts beyond the 2 views
  console.log("count after delivery_completed path:", afterCompletedCount);

  // 이미 delivered 이후 재조회 → customer_view (중복 delivery_completed 아님)
  const againType = resolveEventType("customer_view", "delivered", "delivered");
  if (againType !== "customer_view") {
    fail("dedupe", `재조회 시 customer_view 여야 함, 실제 ${againType}`);
  } else {
    const view3 = await insertLog("customer_view", "delivered");
    console.log("OK post-delivered view as customer_view:", view3.id);
  }

  // unique index로 중복 delivery_completed 차단
  const dup = await admin.from("delivery_tracking_logs").insert({
    order_id: order.id,
    tracking_number: order.tracking_number || "000000000000",
    delivery_status: "delivered",
    event_type: "delivery_completed",
    location: "verify-dup",
  });

  if (dup.error) {
    pass(
      "dedupe",
      `delivery_completed 중복 차단됨 (${dup.error.code || ""} ${dup.error.message})`
    );
  } else {
    // 혹시 들어갔다면 cleanup에 포함
    const { data: dupRows } = await admin
      .from("delivery_tracking_logs")
      .select("id")
      .eq("order_id", order.id)
      .eq("event_type", "delivery_completed")
      .eq("location", "verify-dup");
    for (const r of dupRows ?? []) createdIds.push(r.id);
    fail("dedupe", "delivery_completed 중복 insert가 허용됨 — 019 unique index 확인");
  }

  // ── admin_view / auto_sync 집계 제외 ──
  const beforeExcluded = await countableCount(admin, order.id);
  for (const event_type of ["admin_view", "auto_sync"]) {
    await insertLog(event_type, "delivered");
  }
  const afterExcluded = await countableCount(admin, order.id);
  if (afterExcluded !== beforeExcluded) {
    fail(
      "countAgg",
      `admin/auto_sync 삽입 후 집계 변경됨 ${beforeExcluded}→${afterExcluded}`
    );
  } else {
    console.log(
      `OK admin_view/auto_sync excluded (count stayed ${afterExcluded})`
    );
  }

  // ── 모달 쿼리 (앱과 동일: countable only, 최신순) ──
  const { data: modalLogs, error: modalErr } = await admin
    .from("delivery_tracking_logs")
    .select("id, event_type, created_at")
    .eq("order_id", order.id)
    .in("event_type", COUNTABLE)
    .order("created_at", { ascending: false });

  if (modalErr) {
    fail("modal", modalErr.message);
  } else {
    const logs = modalLogs ?? [];
    const sorted = [...logs].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    const orderOk = logs.every((row, i) => row.id === sorted[i].id);
    const hasNonCountable = logs.some((r) => !COUNTABLE.includes(r.event_type));
    const preview = logs.slice(0, 5).map((r) => ({
      at: r.created_at,
      type: r.event_type,
      label: LABELS[r.event_type],
    }));

    console.log("modal preview (latest first):", preview);
    console.log("modal total_count:", logs.length);

    if (!orderOk) {
      fail("modal", "created_at 최신순 정렬 불일치");
    } else if (hasNonCountable) {
      fail("modal", "모달에 admin_view/auto_sync 가 포함됨");
    } else if (logs.length === 0) {
      fail("modal", "모달용 로그가 비어 있음");
    } else {
      pass(
        "modal",
        `최신순 ${logs.length}건, 라벨 예: ${preview.map((p) => p.label).join(" / ")}`
      );
    }
  }

  // cleanup — 이번 테스트에서 만든 row만
  if (createdIds.length) {
    const { error: delErr } = await admin
      .from("delivery_tracking_logs")
      .delete()
      .in("id", createdIds);
    if (delErr) {
      results.issues.push(`cleanup 실패: ${delErr.message}`);
      console.warn("WARN cleanup:", delErr.message);
    } else {
      console.log(`OK cleaned ${createdIds.length} test rows`);
    }
  }

  console.log("\n════════ REPORT ════════");
  for (const key of ["logSave", "countAgg", "modal", "dedupe"]) {
    const r = results[key];
    console.log(`- ${key}: ${r?.ok ? "PASS" : "FAIL"} — ${r?.msg ?? "(no result)"}`);
  }
  if (results.issues.length) {
    console.log("- issues:");
    for (const issue of results.issues) console.log(`  • ${issue}`);
  } else {
    console.log("- issues: 없음");
  }

  if (results.issues.some((i) => !i.startsWith("cleanup"))) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
