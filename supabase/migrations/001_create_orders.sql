-- orders 테이블 (PRD 기반)
-- Supabase SQL Editor 또는 CLI로 실행

create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone         text not null,
  tracking_number text not null,
  memo          text,
  sent_date     date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  aligo_status  text not null default 'pending'
    check (aligo_status in ('pending', 'success', 'failed')),
  aligo_template_type text not null default '택배발송알림'
);

create index if not exists idx_orders_phone on orders (phone);
create index if not exists idx_orders_customer_name on orders (customer_name);
create index if not exists idx_orders_sent_date on orders (sent_date);
