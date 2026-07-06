-- 알림톡 템플릿 타입 컬럼 추가

alter table orders
  add column if not exists aligo_template_type text not null default '택배발송알림';
