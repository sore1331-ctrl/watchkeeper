-- Harden the updated_at trigger function: SECURITY INVOKER and no direct
-- RPC execution (it only ever runs via the wk_watches trigger).

create or replace function wk_touch_updated_at() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

revoke execute on function wk_touch_updated_at() from public, anon, authenticated;
