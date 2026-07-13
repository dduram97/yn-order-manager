-- delivery_completed 는 주문당 최대 1회만 허용 (중복 방지)
create unique index if not exists delivery_tracking_logs_order_delivery_completed_uidx
  on delivery_tracking_logs (order_id)
  where event_type = 'delivery_completed';
