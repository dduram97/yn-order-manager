-- 여러 송장 발송을 위해 같은 주문 묶음을 식별하는 group_id 추가

alter table orders
  add column if not exists group_id uuid;

create index if not exists orders_group_id_idx on orders(group_id);

