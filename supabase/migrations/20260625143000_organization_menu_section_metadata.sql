begin;

create table if not exists public.organization_menu_sections (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null,
  label text not null,
  sort_order integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_menu_sections_tenant_label_key unique (tenant_key, label)
);

create index if not exists organization_menu_sections_tenant_sort_idx
  on public.organization_menu_sections (tenant_key, sort_order, created_at);

create or replace function public.set_organization_menu_sections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_menu_sections_set_updated_at on public.organization_menu_sections;
create trigger organization_menu_sections_set_updated_at
before update on public.organization_menu_sections
for each row
execute function public.set_organization_menu_sections_updated_at();

insert into public.organization_menu_sections (tenant_key, label, sort_order)
select
  oml.tenant_key,
  coalesce(nullif(btrim(oml.section_label), ''), 'General') as label,
  min(coalesce(oml.sort_order, 0)) as sort_order
from public.organization_menu_links oml
group by oml.tenant_key, coalesce(nullif(btrim(oml.section_label), ''), 'General')
on conflict (tenant_key, label) do update
set sort_order = excluded.sort_order;

alter table public.organization_menu_sections enable row level security;

grant select, insert, update, delete on public.organization_menu_sections to anon, authenticated;

drop policy if exists organization_menu_sections_select_scoped on public.organization_menu_sections;
create policy organization_menu_sections_select_scoped
on public.organization_menu_sections
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
);

drop policy if exists organization_menu_sections_insert_scoped on public.organization_menu_sections;
create policy organization_menu_sections_insert_scoped
on public.organization_menu_sections
for insert
to authenticated
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists organization_menu_sections_update_scoped on public.organization_menu_sections;
create policy organization_menu_sections_update_scoped
on public.organization_menu_sections
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

drop policy if exists organization_menu_sections_delete_scoped on public.organization_menu_sections;
create policy organization_menu_sections_delete_scoped
on public.organization_menu_sections
for delete
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

commit;
