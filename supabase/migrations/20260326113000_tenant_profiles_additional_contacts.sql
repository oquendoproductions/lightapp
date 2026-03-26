begin;

alter table if exists public.tenant_profiles
  add column if not exists additional_contacts jsonb not null default '[]'::jsonb;

update public.tenant_profiles
set additional_contacts = (
  select coalesce(jsonb_agg(contact), '[]'::jsonb)
  from (
    select jsonb_strip_nulls(jsonb_build_object(
      'name', nullif(trim(contact_technical_name), ''),
      'title', 'Technical Contact',
      'email', nullif(trim(contact_technical_email), ''),
      'phone', nullif(trim(contact_technical_phone), '')
    )) as contact
    where coalesce(nullif(trim(contact_technical_name), ''), nullif(trim(contact_technical_email), ''), nullif(trim(contact_technical_phone), '')) is not null

    union all

    select jsonb_strip_nulls(jsonb_build_object(
      'name', nullif(trim(contact_legal_name), ''),
      'title', 'Legal Contact',
      'email', nullif(trim(contact_legal_email), ''),
      'phone', nullif(trim(contact_legal_phone), '')
    )) as contact
    where coalesce(nullif(trim(contact_legal_name), ''), nullif(trim(contact_legal_email), ''), nullif(trim(contact_legal_phone), '')) is not null
  ) seeded_contacts
)
where additional_contacts = '[]'::jsonb;

commit;
