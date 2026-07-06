#!/usr/bin/env bash
# 원격 VPS 배포 (SSH)
# 사용:
#   VPS_HOST=1.2.3.4 VPS_USER=ubuntu bash scripts/vps-remote-deploy.sh
#   VPS_HOST=1.2.3.4 DOMAIN=yourdomain.com bash scripts/vps-remote-deploy.sh --first-install
set -euo pipefail

VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-ubuntu}"
DOMAIN="${DOMAIN:-yourdomain.com}"
APP_DIR="/var/www/yn-order-manager"
FIRST_INSTALL=false

for arg in "$@"; do
  [ "$arg" = "--first-install" ] && FIRST_INSTALL=true
done

if [ -z "$VPS_HOST" ]; then
  echo "VPS_HOST 환경변수 필요"
  echo "예: VPS_HOST=1.2.3.4 bash scripts/vps-remote-deploy.sh"
  exit 1
fi

SSH="ssh -o StrictHostKeyChecking=accept-new ${VPS_USER}@${VPS_HOST}"

echo "=== 원격 VPS 배포 → ${VPS_USER}@${VPS_HOST} ==="

if [ "$FIRST_INSTALL" = true ]; then
  echo "[first-install] bootstrap 실행..."
  $SSH "cd ${APP_DIR} 2>/dev/null && sudo DOMAIN=${DOMAIN} REPO_URL=\$(git remote get-url origin 2>/dev/null || true) bash scripts/vps-first-install.sh" || {
    echo "프로젝트 없음 — clone 후 재실행 필요"
    echo "  ssh ${VPS_USER}@${VPS_HOST}"
    echo "  sudo git clone <REPO_URL> ${APP_DIR}"
    exit 1
  }
else
  echo "[deploy] vps-deploy.sh 실행..."
  $SSH "cd ${APP_DIR} && bash scripts/vps-deploy.sh"
fi

echo ""
echo "[verify] 원격 헬스체크..."
$SSH "cd ${APP_DIR} && bash scripts/vps-verify.sh" || true

if [ "$DOMAIN" != "yourdomain.com" ]; then
  echo ""
  echo "[verify] HTTPS 도메인..."
  DOMAIN="$DOMAIN" bash scripts/vps-verify.sh || true
fi

echo ""
echo "✅ 원격 배포 완료"
echo "  https://${DOMAIN}/login"
echo "  https://api.${DOMAIN}/health"
