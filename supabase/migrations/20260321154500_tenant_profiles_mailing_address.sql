begin;

alter table public.tenant_profiles
  add column if not exists mailing_address text;

commit;
