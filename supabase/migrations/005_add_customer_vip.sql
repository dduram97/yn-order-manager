-- customers VIP 캐시 컬럼 (orders 기준 동기화)

alter table customers
  add column if not exists order_count int not null default 0,
  add column if not exists vip_level text not null default 'normal'
    check (vip_level in ('normal', 'silver', 'gold'));

create index if not exists idx_customers_vip_level on customers (vip_level);
