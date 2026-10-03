-- Last-write-wins sync needs a comparable timestamp on every synced table.
-- (Applied to the linked project on 2026-08-04, between 0004 and 0005.)
alter table wk_measurements
  add column if not exists updated_at timestamptz not null default now();
alter table wk_services
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists wk_measurements_touch on wk_measurements;
create trigger wk_measurements_touch before update on wk_measurements
  for each row execute function wk_touch_updated_at();

drop trigger if exists wk_services_touch on wk_services;
create trigger wk_services_touch before update on wk_services
  for each row execute function wk_touch_updated_at();

create index if not exists wk_measurements_updated_idx on wk_measurements (user_id, updated_at);
create index if not exists wk_services_updated_idx on wk_services (user_id, updated_at);
