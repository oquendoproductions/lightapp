begin;

alter table public.tenants
  add column if not exists resident_portal_enabled boolean not null default false;

update public.tenants
set resident_portal_enabled = false
where resident_portal_enabled is distinct from false;

commit;
