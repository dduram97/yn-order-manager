#!/usr/bin/env bash
# VPS 최초 설치 (Ubuntu 22.04) — root 또는 sudo
# 사용: sudo bash scripts/vps-first-install.sh
#
# 환경변수 (선택):
#   REPO_URL=git@github.com:you/yn-order-manager.git
#   DOMAIN=yourdomain.com
set -euo pipefail

REPO_URL="${REPO_URL:-}"
DOMAIN="${DOMAIN:-yourdomain.com}"
APP_DIR="/var/www/yn-order-manager"

log() { echo "[vps-install] $*"; }
need_cmd() { command -v "$1" >/dev/null 2>&1; }

if [ "$(id -u)" -ne 0 ]; then
  echo "sudo bash scripts/vps-first-install.sh 로 실행하세요"
  exit 1
fi

log "1/10 패키지 업데이트"
apt-get update -qq
apt-get install -y curl git ufw nginx certbot python3-certbot-nginx

log "2/10 Node.js 20"
if ! need_cmd node || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

log "3/10 PM2"
if ! need_cmd pm2; then
  npm install -g pm2
fi

log "4/10 프로젝트 clone"
mkdir -p /var/www
if [ ! -d "$APP_DIR/.git" ]; then
  if [ -z "$REPO_URL" ]; then
    echo "REPO_URL 환경변수 필요: REPO_URL=... sudo -E bash scripts/vps-first-install.sh"
    exit 1
  fi
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

log "5/10 env 설정 (수동 확인 필요)"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "⚠️ .env.local 편집 필요: nano $APP_DIR/.env.local"
fi
bash scripts/vps-setup-env.sh || true

log "6/10 build + pm2"
npm ci
npm run build
if [ -f server/aligo-proxy/package-lock.json ]; then
  (cd server/aligo-proxy && npm ci)
else
  (cd server/aligo-proxy && npm install --omit=dev)
fi
pm2 start ecosystem.config.js || pm2 restart ecosystem.config.js
pm2 save
pm2 startup systemd -u "${SUDO_USER:-root}" --hp "/home/${SUDO_USER:-root}" || true

log "7/10 UFW"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "8/10 Nginx"
sed -i "s/yourdomain.com/${DOMAIN}/g" deploy/nginx.conf
cp deploy/nginx.conf /etc/nginx/sites-available/yn-order
ln -sf /etc/nginx/sites-available/yn-order /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

log "9/10 SSL (certbot)"
if [ "$DOMAIN" != "yourdomain.com" ]; then
  certbot --nginx -d "$DOMAIN" -d "api.$DOMAIN" --non-interactive --agree-tos -m "admin@${DOMAIN}" || \
    echo "⚠️ certbot 수동 실행: certbot --nginx -d $DOMAIN -d api.$DOMAIN"
  certbot renew --dry-run || true
else
  echo "⚠️ DOMAIN 설정 후 certbot 실행"
fi

log "10/10 검증"
bash scripts/vps-verify.sh || true

log "✅ VPS 설치 완료 — $APP_DIR"
log "접속: https://${DOMAIN}/login"
log "API:  https://api.${DOMAIN}/health"
