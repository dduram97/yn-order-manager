-- customer_order_statistics: Supabase 기본 RLS로 인해 anon/authenticated insert가 차단됨.
-- 앱은 service role로 통계를 읽고 쓰지만, 테이블 정책도 명시적으로 허용합니다.

alter table customer_order_statistics enable row level security;

drop policy if exists "customer_order_statistics_select_authenticated"
  on customer_order_statistics;
drop policy if exists "customer_order_statistics_insert_authenticated"
  on customer_order_statistics;

create policy "customer_order_statistics_select_authenticated"
  on customer_order_statistics
  for select
  to authenticated
  using (true);

create policy "customer_order_statistics_insert_authenticated"
  on customer_order_statistics
  for insert
  to authenticated
  with check (true);
