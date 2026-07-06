#!/usr/bin/env bash
# VPS 헬스체크 + 배포 검증
# 사용:
#   bash scripts/vps-verify.sh
#   DOMAIN=yourdomain.com bash scripts/vps-verify.sh
set -euo pipefail

DOMAIN="${DOMAIN:-}"
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-ok}"
  if resp=$(curl -sf "$url" 2>/dev/null); then
    if [ "$expect" = "ok" ] && echo "$resp" | grep -q '"status":"ok"\|"success":true'; then
      echo "✅ $name"
    elif [ "$expect" = "any" ]; then
      echo "✅ $name"
    else
      echo "⚠️ $name — 응답: $(echo "$resp" | head -c 120)"
      FAIL=$((FAIL + 1))
    fi
  else
    echo "❌ $name — $url"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== VPS 배포 검증 ==="
echo ""

echo "[로컬 PM2]"
check "Next.js /api/health" "http://127.0.0.1:3000/api/health"
check "aligo-proxy /api/aligo/health" "http://127.0.0.1:4000/api/aligo/health"
check "aligo-proxy /health" "http://127.0.0.1:4000/health"

if [ -n "$DOMAIN" ]; then
  echo ""
  echo "[도메인 HTTPS — $DOMAIN]"
  check "https://$DOMAIN/api/health" "https://$DOMAIN/api/health"
  check "https://$DOMAIN/login" "https://$DOMAIN/login" "any"
  check "https://api.$DOMAIN/health" "https://api.$DOMAIN/health"
fi

echo ""
echo "[PM2]"
pm2 status 2>/dev/null || echo "⚠️ pm2 없음"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "✅ 검증 통과 ($FAIL failures)"
  exit 0
fi
echo "❌ 검증 실패 ($FAIL failures)"
exit 1
