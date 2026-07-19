-- WatchKeeper seed data.
-- Rows are owned by a user, so pick the auth user to seed for. This script
-- seeds the FIRST user in auth.users; adjust the sub-select if needed.
-- The app also ships a rich client-side demo dataset (5 watches, ~150 days of
-- measurements) that loads automatically in local mode — this SQL seed is a
-- minimal cloud-side starter.

do $$
declare
  uid uuid;
begin
  select id into uid from auth.users order by created_at limit 1;
  if uid is null then
    raise notice 'No users found — sign up first, then re-run the seed.';
    return;
  end if;

  insert into wk_profiles (user_id, display_name) values (uid, 'Collector')
  on conflict (user_id) do nothing;

  insert into wk_watches (id, user_id, brand, model, reference, movement_type, caliber,
    beat_rate, power_reserve_hours, jewels, cosc_certified, purchase_date,
    purchase_price, current_value, currency, accent_color, notes)
  values
    ('seed-speedmaster', uid, 'Omega', 'Speedmaster Professional', '310.30.42.50.01.001',
     'manual', '3861', 21600, 50, 26, true, '2022-09-03', 6900, 7200, 'EUR', '#3b82f6',
     'Moonwatch, hand-wound every morning.'),
    ('seed-spb143', uid, 'Seiko', 'Prospex SPB143', 'SPB143J1',
     'automatic', '6R35', 21600, 70, 24, false, '2021-06-20', 1250, 1100, 'EUR', '#d97706',
     'Weekend beater.')
  on conflict (id) do nothing;

  -- 14 days of measurements for the Speedmaster (+3.2 s/d-ish)
  insert into wk_measurements (id, user_id, watch_id, measured_at, reference_time,
    watch_time, offset_seconds, temperature_c, position, worn_today)
  select
    'seed-m-' || d,
    uid,
    'seed-speedmaster',
    now() - (14 - d) * interval '1 day',
    '08:00:00',
    '08:00:0' || least(9, d)::text,
    round((d * 3.2 + (random() - 0.5) * 1.5)::numeric, 1),
    21 + round((random() * 3)::numeric, 1),
    case when d % 3 = 0 then 'dial-up' else 'on-wrist' end,
    d % 3 <> 0
  from generate_series(0, 14) as d
  on conflict (id) do nothing;

  insert into wk_services (id, user_id, watch_id, date, type, watchmaker, cost, currency, notes)
  values ('seed-svc-1', uid, 'seed-speedmaster', '2024-10-08', 'full-service',
    'Omega Boutique', 620, 'EUR', 'Full movement service, new mainspring.')
  on conflict (id) do nothing;
end $$;
