begin;

create table if not exists public.organization_menu_links (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null,
  label text not null,
  description text,
  link_type text not null default 'external_url',
  url text,
  phone text,
  email text,
  internal_route text,
  audience text not null default 'public',
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_menu_links_link_type_check
    check (link_type in ('external_url', 'phone', 'email', 'internal_route')),
  constraint organization_menu_links_audience_check
    check (audience in ('public', 'signed_in', 'admin'))
);

create index if not exists organization_menu_links_tenant_sort_idx
  on public.organization_menu_links (tenant_key, sort_order, created_at);

create or replace function public.set_organization_menu_links_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_menu_links_set_updated_at on public.organization_menu_links;
create trigger organization_menu_links_set_updated_at
before update on public.organization_menu_links
for each row
execute function public.set_organization_menu_links_updated_at();

alter table public.organization_menu_links enable row level security;

grant select, insert, update, delete on public.organization_menu_links to anon, authenticated;

drop policy if exists organization_menu_links_select_scoped on public.organization_menu_links;
create policy organization_menu_links_select_scoped
on public.organization_menu_links
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
  and (
    public.can_manage_tenant_communications(tenant_key)
    or (
      enabled = true
      and (
        audience = 'public'
        or (audience = 'signed_in' and auth.uid() is not null)
        or (audience = 'admin' and public.can_manage_tenant_communications(tenant_key))
      )
    )
  )
);

drop policy if exists organization_menu_links_insert_scoped on public.organization_menu_links;
create policy organization_menu_links_insert_scoped
on public.organization_menu_links
for insert
to authenticated
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists organization_menu_links_update_scoped on public.organization_menu_links;
create policy organization_menu_links_update_scoped
on public.organization_menu_links
for update
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
)
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists organization_menu_links_delete_scoped on public.organization_menu_links;
create policy organization_menu_links_delete_scoped
on public.organization_menu_links
for delete
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

commit;
