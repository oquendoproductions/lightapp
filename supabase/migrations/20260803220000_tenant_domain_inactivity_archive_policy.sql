begin;

-- Organization-managed incident domains keep their records until a staff
-- member changes the lifecycle state.  Unmanaged domains use this per-domain
-- setting to remove stale incidents from the public map.
alter table public.tenant_domain_assignments
  add column if not exists public_inactivity_archive_days integer not null default 14
    check (public_inactivity_archive_days between 1 and 365);

alter table public.tenant_domain_configs
  add column if not exists public_inactivity_archive_days integer not null default 14
    check (public_inactivity_archive_days between 1 and 365);

create or replace function public.incident_repair_progress_public(p_viewer_identity_hash text default null)
returns table (
  domain public.incident_domain, incident_id text, issue_score integer, repair_progress integer,
  repair_confirmation_threshold integer, last_issue_at timestamptz, last_repair_at timestamptz,
  last_movement_at timestamptz, archived boolean, likely_fixed boolean,
  viewer_is_original_reporter boolean, viewer_has_issue_report boolean, viewer_has_repair_signal boolean
)
language sql security definer set search_path = public as $$
  with supported_domains as (
    select unnest(array['potholes'::public.incident_domain, 'water_drain_issues'::public.incident_domain, 'power_outage'::public.incident_domain, 'water_main'::public.incident_domain]) as domain
  ),
  domain_thresholds as (
    select tda.domain_key::public.incident_domain as domain,
      coalesce(tda.organization_monitored_repairs, false) as organization_monitored_repairs,
      greatest(1, least(25, coalesce(tda.public_repair_confirmation_threshold, 5)))::int as repair_confirmation_threshold,
      greatest(1, least(365, coalesce(tda.public_inactivity_archive_days, 14)))::int as inactivity_archive_days
    from public.tenant_domain_assignments tda
    where tda.tenant_key = public.request_tenant_key()
      and tda.domain_key in ('potholes', 'water_drain_issues', 'power_outage', 'water_main')
  ),
  report_rows as (
    select mapped.domain, trim(coalesce(r.light_id, '')) as incident_id,
      case when r.reporter_user_id is not null then 'uid:' || r.reporter_user_id::text when nullif(lower(trim(coalesce(r.reporter_email, ''))), '') is not null then 'email:' || lower(trim(r.reporter_email)) when nullif(regexp_replace(coalesce(r.reporter_phone, ''), '[^0-9]', '', 'g'), '') is not null then 'phone:' || regexp_replace(r.reporter_phone, '[^0-9]', '', 'g') else null end as identity_hash,
      r.created_at as submitted_at
    from public.reports r cross join lateral (select public.map_incident_domain_from_report(r.light_id, null, r.report_type) as domain) mapped
    where r.tenant_key = public.request_tenant_key() and trim(coalesce(r.light_id, '')) <> ''
      and lower(trim(coalesce(r.report_quality, 'bad'))) <> 'good' and lower(trim(coalesce(r.report_type, ''))) not in ('working', 'reported_working', 'is_working') and mapped.domain in (select domain from supported_domains)
    union all
    select 'potholes'::public.incident_domain, 'pothole:' || trim(coalesce(p.pothole_id::text, '')),
      case when p.reporter_user_id is not null then 'uid:' || p.reporter_user_id::text when nullif(lower(trim(coalesce(p.reporter_email, ''))), '') is not null then 'email:' || lower(trim(p.reporter_email)) when nullif(regexp_replace(coalesce(p.reporter_phone, ''), '[^0-9]', '', 'g'), '') is not null then 'phone:' || regexp_replace(p.reporter_phone, '[^0-9]', '', 'g') else null end,
      p.created_at
    from public.pothole_reports p where p.tenant_key = public.request_tenant_key() and trim(coalesce(p.pothole_id::text, '')) <> ''
  ),
  fixed_cutoffs as (
    select e.domain, e.incident_id, max(e.changed_at) filter (where e.new_state in ('fixed'::public.incident_state, 'archived'::public.incident_state)) as last_reset_at, max(e.changed_at) as last_lifecycle_at
    from public.incident_events e where e.tenant_key = public.request_tenant_key() and e.domain in (select domain from supported_domains) group by e.domain, e.incident_id
  ),
  unique_issue_reporters as (
    select distinct on (rr.domain, rr.incident_id, rr.identity_hash) rr.domain, rr.incident_id, rr.identity_hash, rr.submitted_at
    from report_rows rr left join fixed_cutoffs fc on fc.domain = rr.domain and fc.incident_id = rr.incident_id
    where rr.identity_hash is not null and (fc.last_reset_at is null or rr.submitted_at > fc.last_reset_at)
    order by rr.domain, rr.incident_id, rr.identity_hash, rr.submitted_at asc
  ),
  issue_summary as (
    select domain, incident_id, count(*)::int as unique_issue_reporter_count, max(submitted_at) as last_issue_at from unique_issue_reporters group by domain, incident_id
  ),
  original_issue_reporter as (
    select distinct on (domain, incident_id) domain, incident_id, identity_hash from unique_issue_reporters order by domain, incident_id, submitted_at asc, identity_hash asc
  ),
  repair_signals_ranked as (
    select s.domain, trim(coalesce(s.incident_id, '')) as incident_id, trim(coalesce(s.identity_hash, '')) as identity_hash, s.created_at,
      case when o.identity_hash is not null and o.identity_hash = trim(coalesce(s.identity_hash, '')) then 2 else 1 end as repair_weight
    from public.incident_repair_signals s left join original_issue_reporter o on o.domain = s.domain and o.incident_id = trim(coalesce(s.incident_id, ''))
    where s.tenant_key = public.request_tenant_key() and s.domain in (select domain from supported_domains) and trim(coalesce(s.incident_id, '')) <> '' and trim(coalesce(s.identity_hash, '')) <> ''
  ),
  repair_summary as (
    select r.domain, r.incident_id,
      least(coalesce(dt.repair_confirmation_threshold, 5), coalesce(sum(r.repair_weight) filter (where i.last_issue_at is null or r.created_at > i.last_issue_at), 0))::int as repair_progress,
      max(r.created_at) filter (where i.last_issue_at is null or r.created_at > i.last_issue_at) as last_repair_at,
      bool_or(trim(coalesce(r.identity_hash, '')) = trim(coalesce(p_viewer_identity_hash, ''))) as viewer_has_repair_signal
    from repair_signals_ranked r left join issue_summary i on i.domain = r.domain and i.incident_id = r.incident_id
    left join domain_thresholds dt on dt.domain = r.domain group by r.domain, r.incident_id, dt.repair_confirmation_threshold
  ),
  all_incidents as (
    select domain, incident_id from issue_summary union select domain, incident_id from repair_summary union select domain, incident_id from fixed_cutoffs
  )
  select ai.domain, ai.incident_id,
    case when coalesce(i.unique_issue_reporter_count, 0) <= 0 then 0 else -least(5, 2 + greatest(coalesce(i.unique_issue_reporter_count, 0) - 1, 0)) end::int,
    coalesce(r.repair_progress, 0)::int, coalesce(dt.repair_confirmation_threshold, 5)::int,
    i.last_issue_at, r.last_repair_at,
    greatest(coalesce(i.last_issue_at, '-infinity'::timestamptz), coalesce(r.last_repair_at, '-infinity'::timestamptz), coalesce(fc.last_lifecycle_at, '-infinity'::timestamptz)),
    case when coalesce(dt.organization_monitored_repairs, false) then false else greatest(coalesce(i.last_issue_at, '-infinity'::timestamptz), coalesce(r.last_repair_at, '-infinity'::timestamptz), coalesce(fc.last_lifecycle_at, '-infinity'::timestamptz)) <= now() - make_interval(days => coalesce(dt.inactivity_archive_days, 14)) end,
    coalesce(r.repair_progress, 0) >= coalesce(dt.repair_confirmation_threshold, 5),
    (trim(coalesce(o.identity_hash, '')) <> '' and trim(coalesce(o.identity_hash, '')) = trim(coalesce(p_viewer_identity_hash, ''))),
    exists (select 1 from unique_issue_reporters ui where ui.domain = ai.domain and ui.incident_id = ai.incident_id and trim(coalesce(ui.identity_hash, '')) = trim(coalesce(p_viewer_identity_hash, ''))),
    coalesce(r.viewer_has_repair_signal, false)
  from all_incidents ai left join issue_summary i on i.domain = ai.domain and i.incident_id = ai.incident_id
  left join original_issue_reporter o on o.domain = ai.domain and o.incident_id = ai.incident_id
  left join repair_summary r on r.domain = ai.domain and r.incident_id = ai.incident_id
  left join fixed_cutoffs fc on fc.domain = ai.domain and fc.incident_id = ai.incident_id
  left join domain_thresholds dt on dt.domain = ai.domain;
$$;

grant execute on function public.incident_repair_progress_public(text) to anon, authenticated;

commit;
