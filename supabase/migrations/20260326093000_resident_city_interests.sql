begin;

create table if not exists public.resident_tenant_interests (
  user_id uuid not null,
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tenant_key)
);

create index if not exists resident_tenant_interests_user_idx
  on public.resident_tenant_interests (user_id, updated_at desc);

drop trigger if exists trg_resident_tenant_interests_updated_at on public.resident_tenant_interests;
create trigger trg_resident_tenant_interests_updated_at
before update on public.resident_tenant_interests
for each row
execute function public.touch_platform_control_plane_updated_at();

grant select, insert, update, delete on public.resident_tenant_interests to authenticated;

alter table public.resident_tenant_interests enable row level security;

drop policy if exists resident_tenant_interests_select_self on public.resident_tenant_interests;
create policy resident_tenant_interests_select_self
on public.resident_tenant_interests
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists resident_tenant_interests_insert_self on public.resident_tenant_interests;
create policy resident_tenant_interests_insert_self
on public.resident_tenant_interests
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists resident_tenant_interests_update_self on public.resident_tenant_interests;
create policy resident_tenant_interests_update_self
on public.resident_tenant_interests
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists resident_tenant_interests_delete_self on public.resident_tenant_interests;
create policy resident_tenant_interests_delete_self
on public.resident_tenant_interests
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.list_resident_hub_tenants()
returns table (
  tenant_key text,
  name text,
  primary_subdomain text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    t.tenant_key,
    t.name,
    t.primary_subdomain
  from public.tenants t
  where t.active = true
    and coalesce(t.resident_portal_enabled, false) = true
  order by t.name asc, t.tenant_key asc;
$$;

grant execute on function public.list_resident_hub_tenants() to authenticated;

commit;
