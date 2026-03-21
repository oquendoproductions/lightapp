begin;

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.tenant_files'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%file_category%'
  loop
    execute format('alter table public.tenant_files drop constraint if exists %I', c.conname);
  end loop;
end
$$;

alter table public.tenant_files
  add constraint tenant_files_file_category_check
  check (file_category in ('contract', 'asset_coordinates', 'boundary_geojson', 'other'));

grant select, insert, update, delete on public.app_config to authenticated;

alter table public.app_config enable row level security;

drop policy if exists app_config_manage_platform_admin on public.app_config;
create policy app_config_manage_platform_admin
on public.app_config
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

commit;
