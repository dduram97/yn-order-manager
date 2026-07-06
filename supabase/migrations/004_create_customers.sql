-- customers 테이블 (고객 마스터)

create table if not exists customers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_name on customers (name);
create index if not exists idx_customers_phone on customers (phone);
