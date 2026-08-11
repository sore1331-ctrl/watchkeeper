-- Wishlist: watches not owned yet. Kept separate from wk_watches so it never
-- pollutes accuracy analytics, and linked to a watch once one is acquired.

create table if not exists wk_wishlist (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  brand text not null,
  model text not null,
  reference text,
  movement_type text check (movement_type in ('automatic','manual','quartz')),
  caliber text,
  target_price numeric,
  currency text not null default 'GBP',
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  status text not null default 'wanted' check (status in ('wanted','watching','reserved','acquired','passed')),
  url text,
  notes text,
  added_at timestamptz not null default now(),
  acquired_watch_id text references wk_watches (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wk_wishlist_user_idx on wk_wishlist (user_id, status);

drop trigger if exists wk_wishlist_touch on wk_wishlist;
create trigger wk_wishlist_touch before update on wk_wishlist
  for each row execute function wk_touch_updated_at();

alter table wk_wishlist enable row level security;

drop policy if exists wk_wishlist_select_own on wk_wishlist;
create policy wk_wishlist_select_own on wk_wishlist
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists wk_wishlist_insert_own on wk_wishlist;
create policy wk_wishlist_insert_own on wk_wishlist
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists wk_wishlist_update_own on wk_wishlist;
create policy wk_wishlist_update_own on wk_wishlist
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists wk_wishlist_delete_own on wk_wishlist;
create policy wk_wishlist_delete_own on wk_wishlist
  for delete to authenticated using ((select auth.uid()) = user_id);
