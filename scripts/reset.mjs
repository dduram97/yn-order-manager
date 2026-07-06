#!/usr/bin/env node
/**
 * npm run reset — 로컬 dev 환경 복구
 *
 * - .next 삭제
 * - port 3000~3010 node/next 프로세스 종료
 */
import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const withCache = process.argv.includes("--cache");

function run(cmd, silent = false) {
  try {
    execSync(cmd, { stdio: silent ? "pipe" : "inherit", shell: true, cwd: root });
  } catch {
    /* ignore */
  }
}

function killPort(port) {
  try {
    const pids = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      encoding: "utf8",
      cwd: root,
    })
      .trim()
      .split("\n")
      .filter(Boolean);

    for (const pid of pids) {
      let name = "";
      try {
        name = execSync(`ps -p ${pid} -o comm=`, { encoding: "utf8" }).trim();
      } catch {
        continue;
      }
      if (!/node|next/i.test(name)) {
        console.log(`[reset] port ${port} — skip PID ${pid} (${name})`);
        continue;
      }
      console.log(`[reset] port ${port} — kill PID ${pid} (${name})`);
      run(`kill ${pid}`, true);
    }
  } catch {
    /* port free */
  }
}

console.log("[reset] dev 환경 초기화 시작...\n");

const nextDir = join(root, ".next");
if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("[reset] .next 삭제");
}

for (let port = 3000; port <= 3010; port += 1) {
  killPort(port);
}

if (withCache) {
  console.log("[reset] npm cache clean...");
  run("npm cache clean --force");
}

console.log("\n[reset] 완료 → npm run dev");
