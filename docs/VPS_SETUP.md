# VPS 초기 설정 가이드 (완전 초보 · 클릭형)

> Ubuntu 22.04 · 월 ~5,000원대 VPS · YN Order Manager 운영용

---

## 0. VPS 선택 (5천원 기준)

| 추천 | 월 비용 | 특징 |
|------|---------|------|
| **Oracle Cloud Free Tier** | 0원 | ARM 4코어 / 24GB RAM (Always Free) — Aligo IP 고정 가능 |
| **Contabo VPS S** | ~€5 | 저렴, 고정 IP |
| **Vultr / Linode 최소 플랜** | ~$5 | 설정 간단 |

**필수 조건:**
- Ubuntu 22.04 LTS
- **고정 공인 IP** (Aligo IP 허용용)
- 최소 1GB RAM (Next.js + Proxy)

---

## 1. VPS 접속

1. VPS 구매 후 **공인 IP** 확인 (예: `123.45.67.89`)
2. 터미널(Mac) 또는 PuTTY(Windows) 실행
3. 접속:

```bash
ssh root@123.45.67.89
```

비밀번호 입력 → 로그인 성공

---

## 2. Ubuntu 초기 설정

```bash
# 패키지 업데이트
sudo apt update && sudo apt upgrade -y

# 타임존 (한국)
sudo timedatectl set-timezone Asia/Seoul

# swap (RAM 1GB 이하 VPS 권장)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 3. Node.js 20 설치

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v    # v20.x 확인
npm -v
```

---

## 4. PM2 설치

```bash
sudo npm install -g pm2
pm2 -v
```

**기본 명령:**

| 명령 | 설명 |
|------|------|
| `pm2 status` | 프로세스 목록 |
| `pm2 logs` | 로그 |
| `pm2 restart all` | 전체 재시작 |
| `pm2 save` | 부팅 목록 저장 |
| `pm2 startup` | 부팅 시 자동 시작 |

---

## 5. Git + 프로젝트 배포

```bash
sudo apt install -y git
mkdir -p /var/www && cd /var/www

git clone <your-repo-url> yn-order-manager
cd yn-order-manager
```

---

## 6. 환경변수 설정

### 6-1. Next.js (VPS에서 Next 실행 시)

```bash
cp .env.example .env.local
nano .env.local
```

필수 입력:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AUTH_SESSION_SECRET=...
ALIGO_API_URL=https://api.yourdomain.com
ALIGO_SENDER_PHONE=010...
ALIGO_TEST_MODE=N
```

### 6-2. Aligo Proxy (VPS)

```bash
cd server/aligo-proxy
cp .env.example .env
nano .env
```

필수 입력:
```
ALIGO_API_KEY=...
ALIGO_USER_ID=...
ALIGO_SENDER_KEY=...
ALIGO_SENDER_PHONE=010...
PORT=4000
```

---

## 7. 빌드 + PM2 시작

```bash
cd /var/www/yn-order-manager
npm ci
npm run build
cd server/aligo-proxy && npm ci && cd ../..

pm2 start ecosystem.config.js
pm2 save
pm2 startup
# 출력된 sudo 명령 1줄 복사 실행
```

**확인:**

```bash
pm2 status
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:4000/api/aligo/health
```

---

## 8. 방화벽 (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# 외부에서 3000/4000 직접 노출 금지 — Nginx만 공개
sudo ufw enable
sudo ufw status
```

---

## 9. Aligo IP 허용

1. Aligo 대시보드 → API 설정
2. **VPS 고정 IP** 등록
3. 저장

---

## 10. 자동 배포 (이후 업데이트)

```bash
bash scripts/vps-deploy.sh
```

---

## 다음 단계

→ [DOMAIN_SSL_SETUP.md](./DOMAIN_SSL_SETUP.md) — 도메인 + HTTPS  
→ [EMERGENCY_RECOVERY.md](./EMERGENCY_RECOVERY.md) — 10초 복구

---

## 절대 금지

- ❌ VPS에서 `npm run dev`
- ❌ `pm2 start npm -- run dev`
- ❌ localhost / LAN으로 운영 접속
