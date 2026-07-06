# 주문 관리 시스템 (YN Order Manager)

## 목표
전화 주문 고객 정보를 저장하고 알리고 알림톡을 자동 발송하며
배송 및 고객 관리가 가능한 웹 시스템 구축

---

## 주요 기능

### 1. 주문 등록
- 고객 이름
- 전화번호
- 송장번호
- 고객 메모
- 발송일 자동 기록

👉 등록 시 Supabase DB 저장
👉 저장 후 알리고 API로 알림톡 자동 발송

---

### 2. 고객 검색
- 이름 또는 전화번호로 검색
- 이전 주문 이력 조회

---

### 3. 알림톡 발송
- Supabase 저장 후 자동 발송
- 알리고 API 사용

---

### 4. 발송 상태 확인
- 알리고 전송 결과 조회 API 연동
- 성공/실패 상태 표시

---

### 5. 고객 메모
- 주문별 메모 저장 가능

---

### 6. 통계 기능
- 월별 발송 건수
- 날짜별 발송 리스트

---

## DB 구조 (Supabase)

orders
- id
- customer_name
- phone
- tracking_number
- memo
- sent_date
- created_at
- aligo_status

---

## 기술 스택
- Next.js (Frontend + Backend API)
- Supabase (DB)
- Aligo API (알림톡)