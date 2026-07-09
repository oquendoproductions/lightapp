begin;

drop policy if exists resident_community_feed_views_select_self on public.resident_community_feed_views;
create policy resident_community_feed_views_select_self
on public.resident_community_feed_views
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists resident_community_feed_views_insert_self on public.resident_community_feed_views;
create policy resident_community_feed_views_insert_self
on public.resident_community_feed_views
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists resident_community_feed_views_update_self on public.resident_community_feed_views;
create policy resident_community_feed_views_update_self
on public.resident_community_feed_views
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

drop policy if exists resident_community_feed_views_delete_self on public.resident_community_feed_views;
create policy resident_community_feed_views_delete_self
on public.resident_community_feed_views
for delete
to authenticated
using (
  user_id = auth.uid()
);

commit;
