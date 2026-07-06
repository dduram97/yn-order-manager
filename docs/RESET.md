# RESET — 장애 복구 (restart 기준)

---

## VPS Aligo 서버

```bash
cd server/aligo-proxy
pm2 restart aligo-proxy
curl http://127.0.0.1:4000/api/aligo/health
```

---

## Vercel

Vercel Dashboard → Deployments → **Redeploy**

또는:
```bash
vercel --prod
```

---

## env 확인

```bash
curl https://your-app.vercel.app/api/aligo/env-check
# allCoreSet: true, vpsHealthy: true
```

---

## 발송 실패

- Vercel Function Logs → `[ALIGO:FAIL]`
- VPS: `pm2 logs aligo-proxy`

---

## 로컬 dev

```bash
npm run reset && npm run dev
```

`.env.local`에 `ALIGO_API_URL` → VPS 주소 필요
