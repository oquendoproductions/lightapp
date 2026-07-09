begin;

create table if not exists public.resident_community_feed_views (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade default public.request_tenant_key(),
  user_id uuid not null,
  alerts_last_viewed_at timestamptz,
  events_last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_key, user_id)
);

create index if not exists resident_community_feed_views_user_idx
  on public.resident_community_feed_views (tenant_key, user_id, updated_at desc);

drop trigger if exists trg_resident_community_feed_views_updated_at on public.resident_community_feed_views;
create trigger trg_resident_community_feed_views_updated_at
before update on public.resident_community_feed_views
for each row
execute function public.touch_platform_control_plane_updated_at();

grant select, insert, update, delete on public.resident_community_feed_views to authenticated;

alter table public.resident_community_feed_views enable row level security;

drop policy if exists resident_community_feed_views_select_self on public.resident_community_feed_views;
create policy resident_community_feed_views_select_self
on public.resident_community_feed_views
for select
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

drop policy if exists resident_community_feed_views_insert_self on public.resident_community_feed_views;
create policy resident_community_feed_views_insert_self
on public.resident_community_feed_views
for insert
to authenticated
with check (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

drop policy if exists resident_community_feed_views_update_self on public.resident_community_feed_views;
create policy resident_community_feed_views_update_self
on public.resident_community_feed_views
for update
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
)
with check (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

drop policy if exists resident_community_feed_views_delete_self on public.resident_community_feed_views;
create policy resident_community_feed_views_delete_self
on public.resident_community_feed_views
for delete
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and user_id = auth.uid()
);

commit;
