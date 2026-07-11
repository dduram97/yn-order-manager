-- 고객 메모 컬럼 추가 (기존 행은 null, 호환)
alter table customers
  add column if not exists memo text;
