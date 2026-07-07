-- 배송조회 상태 (스마트택배 연동)

alter table orders
  add column if not exists delivery_status text
    check (delivery_status in ('ready', 'in_transit', 'delivered'));

alter table orders
  add column if not exists delivery_updated_at timestamptz;

alter table orders
  add column if not exists delivery_location text;

create index if not exists orders_delivery_status_idx on orders(delivery_status);

-- 배송조회 이력 (클릭 조회 시 저장)
create table if not exists delivery_tracking_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  tracking_number text not null,
  delivery_status text not null
    check (delivery_status in ('ready', 'in_transit', 'delivered')),
  location text,
  tracking_time timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delivery_tracking_logs_order_id_idx
  on delivery_tracking_logs(order_id);

create index if not exists delivery_tracking_logs_created_at_idx
  on delivery_tracking_logs(created_at desc);
