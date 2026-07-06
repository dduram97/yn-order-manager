#!/usr/bin/env bash
# VPS 자동 배포 — production only
# 사용: bash scripts/vps-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { echo "[vps-deploy] $*"; }
fail() { echo "[vps-deploy] ❌ $*" >&2; exit 1; }

log "시작 — $(date -Iseconds)"

log "1/6 git pull"
git pull || fail "git pull 실패"

log "2/6 npm ci (root)"
npm ci || fail "npm ci 실패"

log "3/6 npm run build"
npm run build || fail "build 실패"

log "4/6 aligo-proxy deps"
if [ -f server/aligo-proxy/package-lock.json ]; then
  (cd server/aligo-proxy && npm ci) || fail "aligo-proxy npm ci 실패"
else
  (cd server/aligo-proxy && npm install --omit=dev) || fail "aligo-proxy npm install 실패"
fi

log "5/6 env sync"
bash scripts/vps-setup-env.sh || true

log "6/7 pm2 restart"
if pm2 describe yn-order-manager >/dev/null 2>&1; then
  pm2 restart ecosystem.config.js --update-env || fail "pm2 restart 실패"
else
  pm2 start ecosystem.config.js || fail "pm2 start 실패"
fi
pm2 save || true

log "7/7 상태 확인"
pm2 status

HEALTH_OK=true
if curl -sf "http://127.0.0.1:3000/api/health" >/dev/null; then
  log "✅ Next.js /api/health OK"
else
  log "⚠️ Next.js /api/health 실패"
  HEALTH_OK=false
fi

if curl -sf "http://127.0.0.1:4000/api/aligo/health" >/dev/null; then
  log "✅ aligo-proxy /api/aligo/health OK"
else
  log "⚠️ aligo-proxy /api/aligo/health 실패"
  HEALTH_OK=false
fi

if curl -sf "http://127.0.0.1:4000/health" >/dev/null; then
  log "✅ aligo-proxy /health OK"
else
  log "⚠️ aligo-proxy /health 실패"
  HEALTH_OK=false
fi

if [ "$HEALTH_OK" = true ]; then
  log "✅ 배포 성공"
  exit 0
fi

log "⚠️ 배포 완료 — health check 일부 실패 (pm2 logs 확인)"
exit 1
