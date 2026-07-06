-- 앱 로그인 사용자 (email + password_hash + role)

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  role          text not null check (role in ('admin', 'staff')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_users_email on users (email);
create index if not exists idx_users_role on users (role);
