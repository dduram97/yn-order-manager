-- 선물 템플릿용 발송 변수 필드 (nullable, 기존 주문 호환)

alter table orders
  add column if not exists sender_name text,
  add column if not exists receiver_name text;
