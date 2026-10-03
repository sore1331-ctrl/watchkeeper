-- Sync resolves conflicts by "the newer edit wins", comparing updated_at. The
-- client stamps that when the edit is made, but the trigger used to replace it
-- with the moment the row reached the server — so an old offline edit uploaded
-- late beat a newer one. Keep the time the client sent; only stamp the row
-- when an update did not supply one.

create or replace function wk_touch_updated_at() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end $$;

revoke execute on function wk_touch_updated_at() from public, anon, authenticated;
