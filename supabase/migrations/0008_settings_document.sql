-- Settings and snoozed notifications sync as one JSON document per user,
-- newest wins (compared on wk_settings.updated_at, which the client sets).
-- The original typed columns stay for now; the app does not read them.

alter table wk_settings
  add column if not exists data jsonb not null default '{}'::jsonb;

comment on column wk_settings.data is
  'App settings and snoozed notifications: { settings: {...}, dismissed: [{ key, at }] }';
