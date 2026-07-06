# YN Order Manager

가족용 알림톡 SaaS — **Vercel (UI) + VPS (Aligo API)**

---

## 구조

| 레이어 | 역할 |
|--------|------|
| Vercel | Next.js UI + serverless API |
| VPS | `server/aligo-proxy` — Aligo 고정 IP 호출 |
| Supabase | DB |

---

## 로컬 개발

```bash
npm run dev
```

`.env.local`: Supabase + `ALIGO_API_URL` (VPS 주소)

---

## 배포

- **Vercel:** `vercel --prod` 또는 git push
- **VPS:** `cd server/aligo-proxy && pm2 restart aligo-proxy`

→ [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

---

## VPS 실행 (요약)

```bash
cd server/aligo-proxy
cp .env.example .env   # Aligo 키 입력
npm ci
pm2 start ecosystem.config.js
pm2 save
```

---

## API 진단

| URL | 용도 |
|-----|------|
| `/api/aligo/env-check` | Vercel env + VPS health |
| VPS `/api/aligo/health` | VPS Aligo env |
