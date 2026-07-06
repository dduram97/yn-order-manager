-- Aligo 발송 감사 로그 + 발송 시각
-- aligo_status: pending | success | failed (기존 컬럼 — 발송 상태)

alter table orders
  add column if not exists aligo_response jsonb,
  add column if not exists sent_at timestamptz;

create index if not exists idx_orders_sent_at on orders (sent_at);
create index if not exists idx_orders_aligo_status on orders (aligo_status);
