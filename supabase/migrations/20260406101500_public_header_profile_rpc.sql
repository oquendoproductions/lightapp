begin;

create or replace function public.tenant_header_profile_public()
returns table (
  display_name text,
  contact_primary_email text,
  contact_primary_phone text,
  website_url text
)
language sql
security definer
set search_path = public
as $$
  select
    p.display_name,
    p.contact_primary_email,
    p.contact_primary_phone,
    p.website_url
  from public.tenant_profiles p
  where p.tenant_key = public.request_tenant_key()
  limit 1;
$$;

grant execute on function public.tenant_header_profile_public() to anon, authenticated;

commit;
