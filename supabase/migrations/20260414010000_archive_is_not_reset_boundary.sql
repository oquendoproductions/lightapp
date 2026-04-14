begin;

create or replace function public.streetlight_utility_signal_counts()
returns table (
  incident_id text,
  reported_count integer,
  reference_count integer,
  latest_reported_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with fixed_cutoffs as (
    select
      trim(coalesce(a.light_id, '')) as incident_id,
      max(a.created_at) as last_fixed_at
    from public.light_actions a
    where a.tenant_key = public.request_tenant_key()
      and lower(trim(coalesce(a.action, ''))) = 'fix'
      and trim(coalesce(a.light_id, '')) <> ''
    group by trim(coalesce(a.light_id, ''))
  ),
  status_after_fix as (
    select
      trim(coalesce(urs.incident_id, '')) as incident_id,
      nullif(btrim(coalesce(urs.report_reference, '')), '') as report_reference,
      coalesce(urs.updated_at, urs.reported_at) as activity_at
    from public.utility_report_status urs
    left join fixed_cutoffs fc
      on fc.incident_id = trim(coalesce(urs.incident_id, ''))
    where urs.tenant_key = public.request_tenant_key()
      and trim(coalesce(urs.incident_id, '')) <> ''
      and (
        fc.last_fixed_at is null
        or coalesce(urs.updated_at, urs.reported_at) > fc.last_fixed_at
      )
  )
  select
    s.incident_id,
    count(*)::integer as reported_count,
    count(*) filter (
      where s.report_reference is not null
    )::integer as reference_count,
    max(s.activity_at) as latest_reported_at
  from status_after_fix s
  group by s.incident_id;
$$;

create or replace function public.incident_repair_progress_public(p_viewer_identity_hash text default null)
returns table (
  domain public.incident_domain,
  incident_id text,
  issue_score integer,
  repair_progress integer,
  last_issue_at timestamptz,
  last_repair_at timestamptz,
  last_movement_at timestamptz,
  archived boolean,
  likely_fixed boolean,
  viewer_is_original_reporter boolean,
  viewer_has_issue_report boolean,
  viewer_has_repair_signal boolean
)
language sql
security definer
set search_path = public
as $$
  with report_rows as (
    select
      r.tenant_key,
      public.map_incident_domain_from_report(r.light_id, null, r.report_type) as domain,
      trim(coalesce(r.light_id, '')) as incident_id,
      case
        when r.reporter_user_id is not null then 'uid:' || r.reporter_user_id::text
        when nullif(lower(trim(coalesce(r.reporter_email, ''))), '') is not null then 'email:' || lower(trim(r.reporter_email))
        when nullif(regexp_replace(coalesce(r.reporter_phone, ''), '[^0-9]', '', 'g'), '') is not null then 'phone:' || regexp_replace(r.reporter_phone, '[^0-9]', '', 'g')
        else null
      end as identity_hash,
      r.created_at as submitted_at
    from public.reports r
    where r.tenant_key = public.request_tenant_key()
      and trim(coalesce(r.light_id, '')) <> ''
      and lower(trim(coalesce(r.report_quality, 'bad'))) <> 'good'
      and lower(trim(coalesce(r.report_type, ''))) not in ('working', 'reported_working', 'is_working')

    union all

    select
      p.tenant_key,
      'potholes'::public.incident_domain as domain,
      'pothole:' || trim(coalesce(p.pothole_id::text, '')) as incident_id,
      case
        when p.reporter_user_id is not null then 'uid:' || p.reporter_user_id::text
        when nullif(lower(trim(coalesce(p.reporter_email, ''))), '') is not null then 'email:' || lower(trim(p.reporter_email))
        when nullif(regexp_replace(coalesce(p.reporter_phone, ''), '[^0-9]', '', 'g'), '') is not null then 'phone:' || regexp_replace(p.reporter_phone, '[^0-9]', '', 'g')
        else null
      end as identity_hash,
      p.created_at as submitted_at
    from public.pothole_reports p
    where p.tenant_key = public.request_tenant_key()
      and trim(coalesce(p.pothole_id::text, '')) <> ''
  ),
  fixed_cutoffs as (
    select
      e.domain,
      e.incident_id,
      max(e.changed_at) filter (where e.new_state = 'fixed'::public.incident_state) as last_reset_at,
      max(e.changed_at) as last_lifecycle_at
    from public.incident_events e
    where e.tenant_key = public.request_tenant_key()
    group by e.domain, e.incident_id
  ),
  report_rows_after_reset as (
    select
      rr.domain,
      rr.incident_id,
      rr.identity_hash,
      rr.submitted_at
    from report_rows rr
    left join fixed_cutoffs fc
      on fc.domain = rr.domain
     and fc.incident_id = rr.incident_id
    where rr.identity_hash is not null
      and (
        fc.last_reset_at is null
        or rr.submitted_at > fc.last_reset_at
      )
  ),
  unique_issue_reporters as (
    select distinct on (domain, incident_id, identity_hash)
      domain,
      incident_id,
      identity_hash,
      submitted_at
    from report_rows_after_reset
    order by domain, incident_id, identity_hash, submitted_at asc
  ),
  issue_summary as (
    select
      u.domain,
      u.incident_id,
      count(*)::int as unique_issue_reporter_count,
      min(u.submitted_at) as first_issue_at,
      max(u.submitted_at) as last_issue_at
    from unique_issue_reporters u
    group by u.domain, u.incident_id
  ),
  original_issue_reporter as (
    select distinct on (u.domain, u.incident_id)
      u.domain,
      u.incident_id,
      u.identity_hash
    from unique_issue_reporters u
    order by u.domain, u.incident_id, u.submitted_at asc, u.identity_hash asc
  ),
  repair_signals_ranked as (
    select
      s.domain,
      trim(coalesce(s.incident_id, '')) as incident_id,
      trim(coalesce(s.identity_hash, '')) as identity_hash,
      s.created_at,
      case
        when o.identity_hash is not null and o.identity_hash = trim(coalesce(s.identity_hash, '')) then 2
        else 1
      end as repair_weight
    from public.incident_repair_signals s
    left join original_issue_reporter o
      on o.domain = s.domain
     and o.incident_id = trim(coalesce(s.incident_id, ''))
    where s.tenant_key = public.request_tenant_key()
      and trim(coalesce(s.incident_id, '')) <> ''
      and trim(coalesce(s.identity_hash, '')) <> ''
  ),
  repair_summary as (
    select
      r.domain,
      r.incident_id,
      least(5, coalesce(sum(r.repair_weight) filter (
        where i.last_issue_at is null or r.created_at > i.last_issue_at
      ), 0))::int as repair_progress,
      max(r.created_at) filter (
        where i.last_issue_at is null or r.created_at > i.last_issue_at
      ) as last_repair_at,
      bool_or(trim(coalesce(r.identity_hash, '')) = trim(coalesce(p_viewer_identity_hash, ''))) as viewer_has_repair_signal
    from repair_signals_ranked r
    left join issue_summary i
      on i.domain = r.domain
     and i.incident_id = r.incident_id
    group by r.domain, r.incident_id
  ),
  all_incidents as (
    select domain, incident_id from issue_summary
    union
    select domain, incident_id from repair_summary
    union
    select domain, incident_id from fixed_cutoffs
  )
  select
    ai.domain,
    ai.incident_id,
    case
      when coalesce(i.unique_issue_reporter_count, 0) <= 0 then 0
      else -least(5, 2 + greatest(coalesce(i.unique_issue_reporter_count, 0) - 1, 0))
    end::int as issue_score,
    coalesce(r.repair_progress, 0)::int as repair_progress,
    i.last_issue_at,
    r.last_repair_at,
    greatest(
      coalesce(i.last_issue_at, '-infinity'::timestamptz),
      coalesce(r.last_repair_at, '-infinity'::timestamptz),
      coalesce(fc.last_lifecycle_at, '-infinity'::timestamptz)
    ) as last_movement_at,
    greatest(
      coalesce(i.last_issue_at, '-infinity'::timestamptz),
      coalesce(r.last_repair_at, '-infinity'::timestamptz),
      coalesce(fc.last_lifecycle_at, '-infinity'::timestamptz)
    ) <= (now() - interval '14 days') as archived,
    coalesce(r.repair_progress, 0) >= 5 as likely_fixed,
    (trim(coalesce(o.identity_hash, '')) <> '' and trim(coalesce(o.identity_hash, '')) = trim(coalesce(p_viewer_identity_hash, ''))) as viewer_is_original_reporter,
    exists (
      select 1
      from unique_issue_reporters ui
      where ui.domain = ai.domain
        and ui.incident_id = ai.incident_id
        and trim(coalesce(ui.identity_hash, '')) = trim(coalesce(p_viewer_identity_hash, ''))
    ) as viewer_has_issue_report,
    coalesce(r.viewer_has_repair_signal, false) as viewer_has_repair_signal
  from all_incidents ai
  left join issue_summary i
    on i.domain = ai.domain
   and i.incident_id = ai.incident_id
  left join original_issue_reporter o
    on o.domain = ai.domain
   and o.incident_id = ai.incident_id
  left join repair_summary r
    on r.domain = ai.domain
   and r.incident_id = ai.incident_id
  left join fixed_cutoffs fc
    on fc.domain = ai.domain
   and fc.incident_id = ai.incident_id
  where ai.domain in (
    'potholes'::public.incident_domain,
    'water_drain_issues'::public.incident_domain,
    'power_outage'::public.incident_domain,
    'water_main'::public.incident_domain
  );
$$;

commit;
