# DEPLOYMENT — Vercel + VPS 하이브리드 SaaS

> **Frontend:** Vercel · **Aligo API:** VPS (고정 IP) · **DB:** Supabase

---

## 아키텍처

```
[PC / 모바일] → HTTPS → [Vercel Next.js UI + API]
                              ↓ HTTPS
                         [VPS aligo-proxy :4000]
                              ↓ (고정 IP)
                         [Aligo API]
                              ↓
                         [Supabase]
```

---

## 1. VPS — Aligo 서버

```bash
cd server/aligo-proxy
cp .env.example .env
# ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER_KEY 입력
npm ci
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

**엔드포인트:**
- `GET /api/aligo/health`
- `POST /api/aligo/send`
- `GET /api/aligo/templates`

**Aligo IP 허용:** VPS **고정 공인 IP** 등록

---

## 2. Vercel — Frontend

```bash
vercel --prod
```

**환경변수 (Vercel Dashboard):**

| 변수 | 필수 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ |
| `AUTH_SESSION_SECRET` | ✅ |
| `ALIGO_API_URL` | ✅ VPS URL |
| `ALIGO_SENDER_PHONE` | ✅ |
| `ALIGO_TEST_MODE` | ✅ |
| `ALIGO_VPS_SECRET` | 선택 |

---

## 3. 배포 흐름

**Vercel:** `git push` → 자동 배포

**VPS:**
```bash
git pull
cd server/aligo-proxy && npm ci
pm2 restart aligo-proxy
```

---

## 4. 스모크 테스트

```bash
# VPS
curl https://your-vps/api/aligo/health

# Vercel
DOMAIN=https://your-app.vercel.app node scripts/prod-smoke.mjs
```

---

## 5. 장애 복구

→ [EMERGENCY_RECOVERY.md](./EMERGENCY_RECOVERY.md)  
→ [VPS_SETUP.md](./VPS_SETUP.md) · [DOMAIN_SSL_SETUP.md](./DOMAIN_SSL_SETUP.md)
