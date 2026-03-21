begin;

alter table if exists public.tenant_profiles
  add column if not exists contact_primary_title text;

commit;
