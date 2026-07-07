-- 고객 수동 등급(일반/Silver/Gold) 컬럼 추가
-- 기존 자동 VIP(vip_level/order_count)와 별개로 저장하며, UI에서는 수동 등급이 있으면 우선 표시

alter table customers
  add column if not exists grade text;

update customers
  set grade = 'normal'
  where grade is null;

alter table customers
  alter column grade set default 'normal';

alter table customers
  alter column grade set not null;

do $$
begin
  alter table customers
    add constraint customers_grade_check
    check (grade in ('normal', 'silver', 'gold'));
exception
  when duplicate_object then null;
end $$;

