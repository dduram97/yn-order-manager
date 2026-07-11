-- 고객 최신 주문채널/상품 + 통계 전용 테이블

alter table customers
  add column if not exists order_channel text;

alter table customers
  add column if not exists order_product text;

create table if not exists customer_order_statistics (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers (id) on delete cascade,
  order_channel text not null,
  order_product text not null,
  source text not null,
  source_ref text not null,
  created_at timestamptz not null default now(),
  year integer not null,
  month integer not null,
  day integer not null,
  constraint customer_order_statistics_source_check
    check (source in ('order_registration', 'customer_add')),
  constraint customer_order_statistics_source_ref_unique
    unique (source, source_ref)
);

create index if not exists idx_customer_order_statistics_year_month
  on customer_order_statistics (year, month);

create index if not exists idx_customer_order_statistics_channel
  on customer_order_statistics (order_channel);

create index if not exists idx_customer_order_statistics_product
  on customer_order_statistics (order_product);

create index if not exists idx_customer_order_statistics_customer_id
  on customer_order_statistics (customer_id);
