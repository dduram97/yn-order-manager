-- delivery_tracking_logs: event_type 추가 + RLS 정리
-- 원인: RLS가 켜진 상태에서 anon 키로 insert → policy violation
-- 앱은 service role로 로그를 읽고 쓰며, RLS는 유지하되 anon 직접 접근은 차단합니다.

alter table delivery_tracking_logs
  add column if not exists event_type text;

update delivery_tracking_logs
set event_type = 'auto_sync'
where event_type is null;

alter table delivery_tracking_logs
  alter column event_type set default 'customer_view';

alter table delivery_tracking_logs
  alter column event_type set not null;

alter table delivery_tracking_logs
  drop constraint if exists delivery_tracking_logs_event_type_check;

alter table delivery_tracking_logs
  add constraint delivery_tracking_logs_event_type_check
  check (
    event_type in (
      'customer_view',
      'delivery_completed',
      'admin_view',
      'auto_sync'
    )
  );

create index if not exists delivery_tracking_logs_order_id_created_at_idx
  on delivery_tracking_logs (order_id, created_at desc);

alter table delivery_tracking_logs enable row level security;

-- anon/authenticated 직접 접근 정책은 두지 않음 (service role만 사용)
drop policy if exists "delivery_tracking_logs_select_authenticated"
  on delivery_tracking_logs;
drop policy if exists "delivery_tracking_logs_insert_authenticated"
  on delivery_tracking_logs;
