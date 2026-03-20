begin;

-- Week 2 completion: Model C (public summary + internal detailed)

-- Bootstrap platform admins table for clean environments.
create table if not exists public.admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

-- 1) Tenant/domain visibility control
create table if not exists public.tenant_visibility_config (
  tenant_key text not null default 'default',
  domain public.incident_domain not null,
  visibility text not null default 'public' check (visibility in ('public', 'internal_only')),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (tenant_key, domain)
);

insert into public.tenant_visibility_config (tenant_key, domain, visibility)
values
  ('default', 'streetlights', 'public'),
  ('default', 'potholes', 'public'),
  ('default', 'power_outage', 'internal_only'),
  ('default', 'water_main', 'internal_only')
on conflict (tenant_key, domain) do nothing;

alter table public.tenant_visibility_config enable row level security;

revoke all on public.tenant_visibility_config from anon, authenticated;

drop policy if exists tenant_visibility_select_public on public.tenant_visibility_config;
create policy tenant_visibility_select_public
on public.tenant_visibility_config
for select
to anon, authenticated
using (visibility = 'public');

drop policy if exists tenant_visibility_admin_manage on public.tenant_visibility_config;
create policy tenant_visibility_admin_manage
on public.tenant_visibility_config
for all
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  )
);

-- 2) Strict guard: snapshot table must only be mutated by trigger path
create or replace function public.guard_incident_state_current_direct_write()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() = 0 then
    raise exception 'incident_state_current is derived from incident_events and cannot be written directly';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_incident_state_current_ins on public.incident_state_current;
create trigger trg_guard_incident_state_current_ins
before insert on public.incident_state_current
for each row execute function public.guard_incident_state_current_direct_write();

drop trigger if exists trg_guard_incident_state_current_upd on public.incident_state_current;
create trigger trg_guard_incident_state_current_upd
before update on public.incident_state_current
for each row execute function public.guard_incident_state_current_direct_write();

create or replace function public.guard_incident_state_current_delete()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() = 0 then
    raise exception 'incident_state_current is derived from incident_events and cannot be deleted directly';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_guard_incident_state_current_del on public.incident_state_current;
create trigger trg_guard_incident_state_current_del
before delete on public.incident_state_current
for each row execute function public.guard_incident_state_current_delete();

-- 3) Internal helper view for timestamps and accountability fields
create or replace view public.incident_timeline_metrics_v1 as
with piv as (
  select
    e.domain,
    e.incident_id,
    min(e.changed_at) filter (where e.new_state = 'reported') as first_reported_at,
    min(e.changed_at) filter (where e.new_state = 'confirmed') as first_confirmed_at,
    min(e.changed_at) filter (where e.new_state = 'fixed') as first_fixed_at,
    max(e.changed_at) as last_state_change_at
  from public.incident_events e
  group by e.domain, e.incident_id
)
select
  s.domain,
  s.incident_id,
  s.state as current_state,
  s.last_changed_at,
  s.reopen_count,
  piv.first_reported_at,
  piv.first_confirmed_at,
  piv.first_fixed_at,
  piv.last_state_change_at,
  case
    when piv.first_reported_at is not null and piv.first_confirmed_at is not null and piv.first_confirmed_at >= piv.first_reported_at
      then extract(epoch from (piv.first_confirmed_at - piv.first_reported_at))::bigint
    else null
  end as time_to_confirm_seconds,
  case
    when piv.first_reported_at is not null and piv.first_fixed_at is not null and piv.first_fixed_at >= piv.first_reported_at
      then extract(epoch from (piv.first_fixed_at - piv.first_reported_at))::bigint
    else null
  end as time_to_fix_seconds,
  (coalesce(s.reopen_count, 0) >= 2) as is_chronic
from public.incident_state_current s
left join piv
  on piv.domain = s.domain
 and piv.incident_id = s.incident_id;

-- 4) Export summary view (preserve existing columns first, append accountability columns)
create or replace view public.export_incident_summary_v1 as
select
  m.domain,
  m.incident_id,
  m.current_state,
  m.last_state_change_at as last_changed_at,
  m.reopen_count,
  case when m.current_state in ('fixed', 'archived') then false else true end as is_open,
  m.first_reported_at,
  m.first_confirmed_at,
  m.first_fixed_at,
  m.time_to_confirm_seconds,
  m.time_to_fix_seconds,
  m.is_chronic,
  m.incident_id as aggregation_id
from public.incident_timeline_metrics_v1 m;

-- 5) Export detail view (preserve existing columns first, append accountability columns)
create or replace view public.export_incident_detail_v1 as
with metrics as (
  select * from public.incident_timeline_metrics_v1
),
streetlights as (
  select
    r.id as report_id,
    r.report_number,
    'streetlights'::public.incident_domain as domain,
    r.light_id as incident_id,
    r.created_at as submitted_at,
    r.note as notes,
    r.reporter_name,
    r.reporter_email,
    r.reporter_phone,
    r.reporter_user_id
  from public.reports r
  where coalesce(lower(r.report_quality), 'bad') = 'bad'
),
potholes as (
  select
    p.id as report_id,
    p.report_number,
    'potholes'::public.incident_domain as domain,
    ('pothole:' || p.pothole_id)::text as incident_id,
    p.created_at as submitted_at,
    p.note as notes,
    p.reporter_name,
    p.reporter_email,
    p.reporter_phone,
    p.reporter_user_id
  from public.pothole_reports p
),
all_rows as (
  select * from streetlights
  union all
  select * from potholes
)
select
  a.report_id as source_report_id,
  a.report_number,
  a.domain,
  a.incident_id,
  a.submitted_at as submission_timestamp,
  m.first_fixed_at as fix_timestamp,
  m.time_to_fix_seconds as time_to_close_seconds,
  m.current_state,
  a.reporter_name,
  a.reporter_email,
  a.reporter_phone,
  a.notes as note,
  'user'::text as source,
  a.report_id,
  a.submitted_at,
  m.first_reported_at,
  m.first_confirmed_at,
  m.first_fixed_at as fixed_at,
  m.last_state_change_at,
  m.time_to_confirm_seconds,
  m.time_to_fix_seconds,
  m.reopen_count,
  m.is_chronic,
  a.reporter_user_id,
  a.notes,
  a.incident_id as aggregation_id
from all_rows a
left join metrics m
  on m.domain = a.domain
 and m.incident_id = a.incident_id;

-- 6) Public summary metrics view (Model C public layer)
create or replace view public.public_metrics_summary_v1 as
select
  s.domain,
  count(*) filter (where s.current_state in ('fixed', 'archived'))::bigint as closed_count,
  count(*) filter (where s.current_state not in ('fixed', 'archived'))::bigint as open_count,
  round(avg(s.time_to_fix_seconds) filter (where s.time_to_fix_seconds is not null)::numeric, 0)::bigint as avg_time_to_fix_seconds,
  case
    when count(*) = 0 then 0::numeric
    else round((sum(case when s.reopen_count > 0 then 1 else 0 end)::numeric / count(*)::numeric) * 100, 2)
  end as reopen_rate_percent,
  max(s.last_changed_at) as last_updated_at
from public.export_incident_summary_v1 s
join public.tenant_visibility_config tv
  on tv.tenant_key = 'default'
 and tv.domain = s.domain
 and tv.visibility = 'public'
group by s.domain
order by s.domain;

create or replace view public.public_metrics_trend_v1 as
with days as (
  select generate_series((current_date - interval '89 days')::date, current_date::date, interval '1 day')::date as day
),
visible_domains as (
  select tv.domain
  from public.tenant_visibility_config tv
  where tv.tenant_key = 'default'
    and tv.visibility = 'public'
),
grid as (
  select d.day, vd.domain
  from days d
  cross join visible_domains vd
),
state_on_day as (
  select
    g.day,
    g.domain,
    count(*) filter (where st.state in ('fixed', 'archived'))::bigint as closed_count,
    count(*) filter (where st.state not in ('fixed', 'archived'))::bigint as open_count
  from grid g
  left join lateral (
    select distinct on (e.incident_id)
      e.incident_id,
      e.new_state as state
    from public.incident_events e
    where e.domain = g.domain
      and e.changed_at < (g.day::timestamptz + interval '1 day')
    order by e.incident_id, e.changed_at desc, e.id desc
  ) st on true
  group by g.day, g.domain
)
select *
from state_on_day
order by day desc, domain;

-- 7) Internal accountability view (Model C internal layer)
create or replace view public.internal_metrics_accountability_v1 as
with report_counts as (
  select domain, incident_id, count(*)::bigint as report_count
  from public.export_incident_detail_v1
  group by domain, incident_id
),
ranked as (
  select
    m.domain,
    m.incident_id,
    m.current_state,
    m.first_reported_at,
    m.first_confirmed_at,
    m.first_fixed_at,
    m.last_state_change_at,
    m.time_to_confirm_seconds,
    m.time_to_fix_seconds,
    m.reopen_count,
    m.is_chronic,
    coalesce(rc.report_count, 0) as report_count,
    m.incident_id as aggregation_id,
    dense_rank() over (
      partition by m.domain
      order by coalesce(rc.report_count, 0) desc, m.last_state_change_at desc nulls last
    ) as recurrence_rank
  from public.incident_timeline_metrics_v1 m
  left join report_counts rc
    on rc.domain = m.domain
   and rc.incident_id = m.incident_id
)
select *
from ranked;

-- 8) Permissions: public summary vs internal detailed
revoke all on public.public_metrics_summary_v1 from public;
revoke all on public.public_metrics_trend_v1 from public;
revoke all on public.internal_metrics_accountability_v1 from public;

grant select on public.public_metrics_summary_v1 to anon, authenticated;
grant select on public.public_metrics_trend_v1 to anon, authenticated;
grant select on public.internal_metrics_accountability_v1 to authenticated;

commit;
