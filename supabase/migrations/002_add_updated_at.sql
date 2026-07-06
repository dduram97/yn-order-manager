-- orders 테이블에 updated_at 컬럼 추가 및 자동 갱신 트리거

alter table orders
  add column if not exists updated_at timestamptz not null default now();

-- 기존 행의 updated_at을 created_at으로 초기화
update orders
set updated_at = created_at
where updated_at is distinct from created_at;

create or replace function update_orders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated_at on orders;

create trigger trg_orders_updated_at
  before update on orders
  for each row
  execute function update_orders_updated_at();
