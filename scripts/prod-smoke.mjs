#!/usr/bin/env node
/**
 * Production smoke test (Vercel / custom domain)
 *
 *   DOMAIN=https://your-app.vercel.app node scripts/prod-smoke.mjs
 */
const DOMAIN = process.env.DOMAIN?.replace(/\/$/, "");
const BASE_URL = process.env.BASE_URL?.replace(/\/$/, "");
const BASE = BASE_URL || DOMAIN;

if (!BASE) {
  console.error("DOMAIN required: DOMAIN=https://your-app.vercel.app node scripts/prod-smoke.mjs");
  process.exit(1);
}

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✅ ${name}`);
  } catch (e) {
    checks.push({ name, ok: false, error: e.message });
    console.error(`❌ ${name}: ${e.message}`);
  }
}

async function main() {
  console.log(`[prod-smoke] BASE=${BASE}\n`);

  await check("GET /api/test → 200 ok", async () => {
    const res = await fetch(`${BASE}/api/test`);
    const body = await res.text();
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    if (body.trim() !== "ok") throw new Error(`body "${body}"`);
  });

  await check("GET /api/aligo/env-check → allCoreSet true", async () => {
    const res = await fetch(`${BASE}/api/aligo/env-check`);
    const data = await res.json();
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    if (!data.allCoreSet) throw new Error(JSON.stringify(data));
    if (!data.aligoApiReachable && !data.vpsHealthy) throw new Error("vpsHealthy false");
  });

  await check("GET /login → 200 HTML", async () => {
    const res = await fetch(`${BASE}/login`);
    const ct = res.headers.get("content-type") ?? "";
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    if (!ct.includes("text/html")) throw new Error(`content-type ${ct}`);
  });

  await check("GET /api/orders (no auth) → 401", async () => {
    const res = await fetch(`${BASE}/api/orders`);
    if (res.status !== 401) throw new Error(`status ${res.status}, expected 401`);
  });

  await check("GET /orders (no auth) → redirect or 401", async () => {
    const res = await fetch(`${BASE}/orders`, { redirect: "manual" });
    if (res.status === 401) return;
    if (res.status === 307 || res.status === 302) {
      const loc = res.headers.get("location") ?? "";
      if (!loc.includes("/login")) throw new Error(`redirect ${loc}`);
      return;
    }
    throw new Error(`status ${res.status}`);
  });

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n[prod-smoke] ${checks.length - failed.length}/${checks.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main();
