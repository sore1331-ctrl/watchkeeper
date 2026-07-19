-- WatchKeeper schema. All tables namespaced wk_* so the app can share a
-- Supabase project with other apps. Client-generated text ids are used for
-- entities that must work offline-first (watches, measurements, services).

create extension if not exists pgcrypto;

-- ── Profiles (Users) ────────────────────────────────────────────────────────
create table if not exists wk_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Collector',
  temperature_unit text not null default 'C' check (temperature_unit in ('C', 'F')),
  created_at timestamptz not null default now()
);

-- ── Collections ─────────────────────────────────────────────────────────────
create table if not exists wk_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

-- ── Watches ─────────────────────────────────────────────────────────────────
create table if not exists wk_watches (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  collection_id uuid references wk_collections (id) on delete set null,
  brand text not null,
  model text not null,
  reference text,
  serial text,
  movement_type text not null check (movement_type in ('automatic', 'manual', 'quartz')),
  caliber text,
  beat_rate integer,
  power_reserve_hours numeric,
  jewels integer,
  cosc_certified boolean not null default false,
  purchase_date date,
  purchase_price numeric,
  current_value numeric,
  currency text not null default 'EUR',
  photo_url text,
  accent_color text not null default '#059669',
  notes text,
  battery_installed_at date,
  battery_life_months integer,
  warranty_until date,
  insured boolean default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Measurements ────────────────────────────────────────────────────────────
create table if not exists wk_measurements (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text not null references wk_watches (id) on delete cascade,
  measured_at timestamptz not null,
  reference_time text not null,
  watch_time text not null,
  offset_seconds numeric not null,
  temperature_c numeric,
  position text check (position in ('dial-up','dial-down','crown-up','crown-down','crown-left','crown-right','on-wrist')),
  power_reserve_pct numeric check (power_reserve_pct between 0 and 100),
  worn_today boolean not null default false,
  notes text,
  photo_url text,
  created_at timestamptz not null default now()
);

-- ── Derived / cached stats ──────────────────────────────────────────────────
create table if not exists wk_daily_offsets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text not null references wk_watches (id) on delete cascade,
  day date not null,
  offset_seconds numeric not null,
  seconds_per_day numeric,
  unique (watch_id, day)
);

create table if not exists wk_weekly_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text not null references wk_watches (id) on delete cascade,
  iso_week text not null,
  avg_spd numeric,
  variance numeric,
  std_dev numeric,
  min_spd numeric,
  max_spd numeric,
  sample_count integer not null default 0,
  unique (watch_id, iso_week)
);

create table if not exists wk_monthly_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text not null references wk_watches (id) on delete cascade,
  month text not null, -- YYYY-MM
  avg_spd numeric,
  variance numeric,
  std_dev numeric,
  wear_ratio numeric,
  sample_count integer not null default 0,
  unique (watch_id, month)
);

-- ── Services ────────────────────────────────────────────────────────────────
create table if not exists wk_services (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text not null references wk_watches (id) on delete cascade,
  date date not null,
  type text not null check (type in ('full-service','regulation','pressure-test','battery','oil-service','polishing','parts-replacement','water-resistance')),
  watchmaker text,
  cost numeric not null default 0,
  currency text not null default 'EUR',
  notes text,
  parts_replaced text[],
  pressure_test_passed boolean,
  water_resistance_rating text,
  created_at timestamptz not null default now()
);

-- ── Media & notes ───────────────────────────────────────────────────────────
create table if not exists wk_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text references wk_watches (id) on delete cascade,
  measurement_id text references wk_measurements (id) on delete cascade,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists wk_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  service_id text references wk_services (id) on delete cascade,
  storage_path text not null,
  kind text not null default 'invoice',
  created_at timestamptz not null default now()
);

create table if not exists wk_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text references wk_watches (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ── Notifications / insights / scores ───────────────────────────────────────
create table if not exists wk_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text references wk_watches (id) on delete cascade,
  kind text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists wk_ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text references wk_watches (id) on delete cascade,
  kind text not null,
  severity text not null default 'neutral' check (severity in ('positive','neutral','warning','critical')),
  text text not null,
  detail text,
  created_at timestamptz not null default now()
);

create table if not exists wk_health_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  watch_id text not null references wk_watches (id) on delete cascade,
  score integer not null check (score between 0 and 100),
  label text not null,
  components jsonb,
  computed_at timestamptz not null default now()
);

-- ── Settings & exports ──────────────────────────────────────────────────────
create table if not exists wk_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  measurement_reminder_days integer not null default 3,
  service_interval_years integer not null default 5,
  theme text not null default 'dark',
  updated_at timestamptz not null default now()
);

create table if not exists wk_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('pdf','csv','xlsx','json')),
  storage_path text,
  created_at timestamptz not null default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists wk_watches_user_idx on wk_watches (user_id);
create index if not exists wk_measurements_watch_idx on wk_measurements (watch_id, measured_at);
create index if not exists wk_measurements_user_idx on wk_measurements (user_id);
create index if not exists wk_services_watch_idx on wk_services (watch_id, date);
create index if not exists wk_notifications_user_idx on wk_notifications (user_id, read);
create index if not exists wk_ai_insights_user_idx on wk_ai_insights (user_id);
create index if not exists wk_health_scores_watch_idx on wk_health_scores (watch_id, computed_at);

-- ── updated_at trigger ──────────────────────────────────────────────────────
create or replace function wk_touch_updated_at() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists wk_watches_touch on wk_watches;
create trigger wk_watches_touch before update on wk_watches
  for each row execute function wk_touch_updated_at();
