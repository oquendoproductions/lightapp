-- Tenant administrators need richer report data for the domains their
-- organization manages, while public/third-party domains must remain on the
-- public-safe map feed.  The direct reports-table policy is intentionally
-- limited to platform administrators and report owners, so expose this small,
-- tenant- and domain-scoped read surface instead of widening that policy.

create or replace function public.tenant_managed_map_reports(p_tenant_key text)
returns table (
  id text,
  created_at timestamptz,
  lat double precision,
  lng double precision,
  report_type text,
  report_quality text,
  note text,
  light_id text,
  report_number text,
  reporter_user_id uuid,
  reporter_name text,
  reporter_phone text,
  reporter_email text,
  report_domain text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_key text := lower(btrim(coalesce(p_tenant_key, '')));
begin
  if v_tenant_key = '' or not public.can_access_tenant_domain_reports(v_tenant_key) then
    raise exception 'Not authorized to view managed tenant reports'
      using errcode = '42501';
  end if;

  return query
  select
    r.id::text,
    r.created_at,
    r.lat,
    r.lng,
    r.report_type,
    r.report_quality,
    r.note,
    r.light_id,
    r.report_number,
    r.reporter_user_id,
    r.reporter_name,
    r.reporter_phone,
    r.reporter_email,
    r.report_domain
  from public.reports r
  where lower(btrim(coalesce(r.tenant_key, ''))) = v_tenant_key
    and exists (
      select 1
      from public.tenant_domain_assignments assignment
      where lower(btrim(coalesce(assignment.tenant_key, ''))) = v_tenant_key
        and lower(btrim(assignment.domain_key::text)) = lower(btrim(coalesce(r.report_domain, '')))
        and assignment.organization_monitored_repairs = true
    )
  order by r.created_at desc, r.id desc;
end;
$$;

revoke all on function public.tenant_managed_map_reports(text) from public;
grant execute on function public.tenant_managed_map_reports(text) to authenticated;

comment on function public.tenant_managed_map_reports(text) is
  'Returns rich map-report fields only for domains managed by the requesting tenant.';
