-- 운영자 개인 메모 (고객과 무관, 독립 테이블)

create table if not exists admin_private_memos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_admin_private_memos_user_id
  on admin_private_memos (user_id);

create or replace function update_admin_private_memos_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_admin_private_memos_updated_at on admin_private_memos;

create trigger trg_admin_private_memos_updated_at
  before update on admin_private_memos
  for each row
  execute function update_admin_private_memos_updated_at();

