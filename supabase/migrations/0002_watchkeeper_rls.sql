-- Row-Level Security: every wk_* table is restricted to the owning user.

do $$
declare
  t text;
begin
  foreach t in array array[
    'wk_profiles','wk_collections','wk_watches','wk_measurements',
    'wk_daily_offsets','wk_weekly_stats','wk_monthly_stats','wk_services',
    'wk_photos','wk_attachments','wk_notes','wk_notifications',
    'wk_ai_insights','wk_health_scores','wk_settings','wk_exports'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select_own', t);
    execute format('drop policy if exists %I on %I', t || '_insert_own', t);
    execute format('drop policy if exists %I on %I', t || '_update_own', t);
    execute format('drop policy if exists %I on %I', t || '_delete_own', t);
    execute format(
      'create policy %I on %I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t);
    execute format(
      'create policy %I on %I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t);
    execute format(
      'create policy %I on %I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t);
    execute format(
      'create policy %I on %I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t);
  end loop;
end $$;

-- Storage bucket for watch photos & service invoices (private, per-user folder)
insert into storage.buckets (id, name, public)
values ('wk-photos', 'wk-photos', false)
on conflict (id) do nothing;

drop policy if exists "wk photos read own" on storage.objects;
create policy "wk photos read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'wk-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "wk photos write own" on storage.objects;
create policy "wk photos write own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'wk-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "wk photos delete own" on storage.objects;
create policy "wk photos delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'wk-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
