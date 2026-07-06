#!/usr/bin/env bash
# VPS env 파일 생성 — .env.local → server/aligo-proxy/.env
# 사용: bash scripts/vps-setup-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_LOCAL="$ROOT/.env.local"
PROXY_ENV="$ROOT/server/aligo-proxy/.env"

if [ ! -f "$ENV_LOCAL" ]; then
  echo "❌ .env.local 없음 — cp .env.example .env.local 후 값 입력"
  exit 1
fi

get_val() {
  grep -E "^${1}=" "$ENV_LOCAL" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//' || true
}

API_KEY=$(get_val ALIGO_API_KEY)
USER_ID=$(get_val ALIGO_USER_ID)
SENDER_KEY=$(get_val ALIGO_SENDER_KEY)
SENDER_PHONE=$(get_val ALIGO_SENDER_PHONE)
TEST_MODE=$(get_val ALIGO_TEST_MODE)
VPS_SECRET=$(get_val ALIGO_VPS_SECRET)

if [ -z "$API_KEY" ] || [ -z "$USER_ID" ] || [ -z "$SENDER_KEY" ]; then
  echo "❌ .env.local에 ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER_KEY 필요"
  exit 1
fi

mkdir -p "$(dirname "$PROXY_ENV")"
cat > "$PROXY_ENV" <<EOF
ALIGO_API_KEY=${API_KEY}
ALIGO_USER_ID=${USER_ID}
ALIGO_SENDER_KEY=${SENDER_KEY}
ALIGO_SENDER_PHONE=${SENDER_PHONE:-}
ALIGO_TEST_MODE=${TEST_MODE:-N}
PORT=4000
EOF

if [ -n "$VPS_SECRET" ]; then
  echo "ALIGO_VPS_SECRET=${VPS_SECRET}" >> "$PROXY_ENV"
fi

# Vercel/Next용 ALIGO_API_URL (.env.local에 없으면 추가)
if ! grep -q "^ALIGO_API_URL=" "$ENV_LOCAL" 2>/dev/null; then
  API_URL="${ALIGO_API_URL:-http://127.0.0.1:4000}"
  # 마지막 줄에 개행이 없으면 echo >> 가 같은 줄에 붙을 수 있음
  printf '\nALIGO_API_URL=%s\n' "$API_URL" >> "$ENV_LOCAL"
  echo "✅ .env.local에 ALIGO_API_URL 추가"
fi

# 구버전 제거
if grep -q "^ALIGO_PROXY_URL=" "$ENV_LOCAL" 2>/dev/null; then
  if sed --version >/dev/null 2>&1; then
    sed -i '/^ALIGO_PROXY_URL=/d' "$ENV_LOCAL"
  else
    grep -v '^ALIGO_PROXY_URL=' "$ENV_LOCAL" > "${ENV_LOCAL}.tmp" && mv "${ENV_LOCAL}.tmp" "$ENV_LOCAL"
  fi
  echo "✅ ALIGO_PROXY_URL 제거 (ALIGO_API_URL 사용)"
fi

echo "✅ server/aligo-proxy/.env 생성 완료"
