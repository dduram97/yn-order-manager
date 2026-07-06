# 도메인 연결 + HTTPS (Let's Encrypt)

> `yourdomain.com` → Next.js · `api.yourdomain.com` → Aligo VPS API

---

## 1. 도메인 구매

| 업체 | 비고 |
|------|------|
| **가비아** | 국내, .com/.kr |
| **Cloudflare Registrar** | DNS + SSL 관리 편함 |
| **Namecheap** | 해외, 저렴 |

구매 후 **DNS 관리 화면**으로 이동

---

## 2. DNS A 레코드 (VPS IP 연결)

VPS 공인 IP: `123.45.67.89` (예시)

| 타입 | 이름 | 값 | TTL |
|------|------|-----|-----|
| A | `@` | `123.45.67.89` | 300 |
| A | `api` | `123.45.67.89` | 300 |

- `yourdomain.com` → 메인 SaaS (Next.js)
- `api.yourdomain.com` → Aligo API (Vercel `ALIGO_API_URL`)

**확인 (5~30분 후):**

```bash
dig +short yourdomain.com
dig +short api.yourdomain.com
```

---

## 3. Nginx 설치 (VPS)

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

---

## 4. Nginx 설정 적용

```bash
cd /var/www/yn-order-manager
sudo cp deploy/nginx.conf /etc/nginx/sites-available/yn-order
sudo nano /etc/nginx/sites-available/yn-order
# yourdomain.com → 실제 도메인으로 수정 (3곳)
```

```bash
sudo ln -sf /etc/nginx/sites-available/yn-order /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Let's Encrypt SSL (certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

- 이메일 입력
- 약관 동의
- HTTP → HTTPS redirect: **Yes**

**자동 갱신 확인:**

```bash
sudo certbot renew --dry-run
```

cron/systemd timer는 certbot 설치 시 자동 등록됨

---

## 6. HTTPS 확인

```bash
curl -I https://yourdomain.com/login
curl https://yourdomain.com/api/health
curl https://api.yourdomain.com/api/aligo/health
```

브라우저:
- `https://yourdomain.com/login` → 로그인 화면
- 자물쇠 🔒 표시 확인

---

## 7. Vercel 연동 (하이브리드)

Vercel Dashboard → Environment Variables:

```
ALIGO_API_URL=https://api.yourdomain.com
```

Vercel UI는 `your-app.vercel.app` 또는 커스텀 도메인(CNAME) 사용 가능

---

## 8. Cloudflare 사용 시 (선택)

1. DNS → A 레코드 → **프록시 끔(회색 구름)** — Aligo IP 허용 VPS는 실 IP 노출 필요
2. SSL/TLS → **Full (strict)** (Origin에 certbot 인증서 있을 때)

---

## SSL 활성화 체크리스트

- [ ] `http://` 접속 시 `https://` 로 redirect
- [ ] certbot 인증서 만료일 확인: `sudo certbot certificates`
- [ ] `/api/health` → 200 + `"status":"ok"`
- [ ] 모바일/PC 동일 HTTPS URL 접속

---

## 다음

→ [EMERGENCY_RECOVERY.md](./EMERGENCY_RECOVERY.md)
