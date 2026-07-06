-- 고객 즐겨찾기

alter table customers
  add column if not exists is_favorite boolean not null default false,
  add column if not exists favorite_at timestamptz;

create index if not exists idx_customers_is_favorite on customers (is_favorite)
  where is_favorite = true;
