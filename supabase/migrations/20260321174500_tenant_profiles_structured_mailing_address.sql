begin;

alter table if exists public.tenant_profiles
  add column if not exists mailing_address_1 text,
  add column if not exists mailing_address_2 text,
  add column if not exists mailing_city text,
  add column if not exists mailing_state text,
  add column if not exists mailing_zip text;

update public.tenant_profiles
set mailing_address_1 = nullif(trim(mailing_address), '')
where coalesce(nullif(trim(mailing_address_1), ''), '') = ''
  and coalesce(nullif(trim(mailing_address), ''), '') <> '';

commit;
