-- Aligo 발송 실패 추적 및 재발송 필드
alter table orders
  add column if not exists aligo_fail_reason text,
  add column if not exists aligo_fail_message text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_retry_at timestamptz;

create index if not exists idx_orders_aligo_fail_reason on orders (aligo_fail_reason);
create index if not exists idx_orders_retry_count on orders (retry_count);
