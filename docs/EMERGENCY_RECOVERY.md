# 긴급 장애 복구 — 10초 매뉴얼

> 목표: **서버 장애 시 10초 내 서비스 복구**

---

## 헬스체크 (먼저 확인)

```bash
curl https://yourdomain.com/api/health
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/api/aligo/health
pm2 status
sudo systemctl status nginx
```

정상 응답:

```json
{"status":"ok","server":"alive","db":"connected"}
```

---

## 방법 1 — 기본 (10초) ⭐

대부분의 경우 이것으로 해결:

```bash
pm2 restart all
```

확인:

```bash
pm2 status
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:4000/api/aligo/health
```

---

## 방법 2 — 완전 복구 (1~3분)

방법 1 실패 시:

```bash
cd /var/www/yn-order-manager
bash scripts/vps-deploy.sh
```

또는 수동:

```bash
cd /var/www/yn-order-manager
git pull
npm ci && npm run build
cd server/aligo-proxy && npm ci && cd ..
pm2 restart ecosystem.config.js
```

---

## 방법 3 — 최악 상황 (5분)

포트 충돌 / 프로세스 꼬임:

```bash
cd /var/www/yn-order-manager

# port 3000, 4000 정리
sudo fuser -k 3000/tcp 2>/dev/null || true
sudo fuser -k 4000/tcp 2>/dev/null || true

pm2 delete all 2>/dev/null || true

git pull
npm ci
npm run build
cd server/aligo-proxy && npm ci && cd ..

pm2 start ecosystem.config.js
pm2 save

sudo nginx -t && sudo systemctl reload nginx
```

---

## 증상별 빠른 표

| 증상 | 10초 조치 |
|------|-----------|
| UI 502/504 | `pm2 restart yn-order-manager` |
| Aligo 발송 실패 | `pm2 restart aligo-proxy` |
| 전체 down | `pm2 restart all` |
| HTTPS 오류 | `sudo systemctl reload nginx` |
| DB disconnected | Supabase 상태 + `.env.local` 확인 |
| Nginx down | `sudo systemctl restart nginx` |

---

## 로그 확인

```bash
pm2 logs --lines 50
pm2 logs yn-order-manager
pm2 logs aligo-proxy
sudo tail -50 /var/log/nginx/error.log
```

Aligo 발송:

```bash
pm2 logs | grep ALIGO:FAIL
```

---

## dev reset (VPS 금지 — 로컬만)

```bash
npm run reset && npm run dev
```

⚠️ VPS에서 `npm run reset` 실행 시 `.next` 삭제 → **`npm run build` 재필요**

---

## 절대 금지

- ❌ `pm2 start npm -- run dev`
- ❌ VPS에서 `npm run dev`
- ❌ localhost / IP 직접 운영 접속
