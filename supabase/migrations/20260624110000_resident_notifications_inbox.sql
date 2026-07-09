begin;

create or replace function public.resident_notification_scope()
returns table (
  tenant_key text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select
      auth.uid() as user_id,
      lower(trim(coalesce(public.request_tenant_key(), ''))) as current_tenant
  )
  select distinct scoped.tenant_key
  from (
    select lower(trim(rti.tenant_key)) as tenant_key
    from public.resident_tenant_interests rti
    join viewer v
      on v.user_id is not null
     and rti.user_id = v.user_id

    union all

    select v.current_tenant
    from viewer v
    where v.current_tenant <> ''
  ) scoped
  where scoped.tenant_key <> '';
$$;

grant execute on function public.resident_notification_scope() to anon, authenticated;

create or replace function public.resident_notification_feed_rows(p_tenant_filter text default null)
returns table (
  tenant_key text,
  tenant_label text,
  tenant_primary_subdomain text,
  kind text,
  id bigint,
  topic_key text,
  topic_label text,
  title text,
  summary text,
  body text,
  location_name text,
  location_address text,
  cta_label text,
  cta_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  severity text,
  pinned boolean,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  sort_at timestamptz,
  unread boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as user_id
  ),
  tenant_scope as (
    select scope.tenant_key
    from public.resident_notification_scope() scope
    where (
      nullif(lower(trim(coalesce(p_tenant_filter, ''))), '') is null
      or scope.tenant_key = lower(trim(coalesce(p_tenant_filter, '')))
    )
  ),
  topic_scope as (
    select
      nt.tenant_key,
      nt.topic_key,
      coalesce(nullif(trim(nt.label), ''), nt.topic_key) as topic_label,
      case
        when pref.user_id is not null then (coalesce(pref.in_app_enabled, false) or coalesce(pref.email_enabled, false))
        else coalesce(nt.default_enabled, false)
      end as in_app_enabled
    from tenant_scope ts
    join public.notification_topics nt
      on nt.tenant_key = ts.tenant_key
     and nt.active = true
    left join viewer v on true
    left join public.resident_notification_preferences pref
      on pref.tenant_key = nt.tenant_key
     and pref.topic_key = nt.topic_key
     and pref.user_id = v.user_id
  ),
  feed_views as (
    select
      rcv.tenant_key,
      rcv.alerts_last_viewed_at,
      rcv.events_last_viewed_at
    from public.resident_community_feed_views rcv
    join viewer v
      on v.user_id is not null
     and rcv.user_id = v.user_id
  ),
  alert_rows as (
    select
      a.tenant_key,
      coalesce(nullif(trim(tp.display_name), ''), nullif(trim(t.name), ''), a.tenant_key) as tenant_label,
      coalesce(nullif(trim(t.primary_subdomain), ''), '') as tenant_primary_subdomain,
      'alert'::text as kind,
      a.id,
      a.topic_key,
      ts.topic_label,
      a.title,
      a.summary,
      a.body,
      a.location_name,
      a.location_address,
      a.cta_label,
      a.cta_url,
      a.starts_at,
      a.ends_at,
      false as all_day,
      a.severity,
      a.pinned,
      a.published_at,
      a.created_at,
      a.updated_at,
      coalesce(a.updated_at, a.published_at, a.created_at, a.starts_at, now()) as sort_at,
      case
        when v.user_id is null then false
        else coalesce(a.updated_at, a.published_at, a.created_at, a.starts_at, now())
          > coalesce(fv.alerts_last_viewed_at, '-infinity'::timestamptz)
      end as unread
    from public.municipality_alerts a
    join tenant_scope scope
      on scope.tenant_key = a.tenant_key
    join topic_scope ts
      on ts.tenant_key = a.tenant_key
     and ts.topic_key = a.topic_key
     and ts.in_app_enabled = true
    join public.tenants t
      on t.tenant_key = a.tenant_key
    left join public.tenant_profiles tp
      on tp.tenant_key = a.tenant_key
    left join viewer v on true
    left join feed_views fv
      on fv.tenant_key = a.tenant_key
    where a.status = 'published'
      and (a.starts_at is null or a.starts_at <= now())
      and (a.ends_at is null or a.ends_at >= now())
  ),
  event_rows as (
    select
      e.tenant_key,
      coalesce(nullif(trim(tp.display_name), ''), nullif(trim(t.name), ''), e.tenant_key) as tenant_label,
      coalesce(nullif(trim(t.primary_subdomain), ''), '') as tenant_primary_subdomain,
      'event'::text as kind,
      e.id,
      e.topic_key,
      ts.topic_label,
      e.title,
      e.summary,
      e.body,
      e.location_name,
      e.location_address,
      e.cta_label,
      e.cta_url,
      e.starts_at,
      e.ends_at,
      e.all_day,
      ''::text as severity,
      false as pinned,
      e.published_at,
      e.created_at,
      e.updated_at,
      coalesce(e.updated_at, e.published_at, e.created_at, e.starts_at, now()) as sort_at,
      case
        when v.user_id is null then false
        else coalesce(e.updated_at, e.published_at, e.created_at, e.starts_at, now())
          > coalesce(fv.events_last_viewed_at, '-infinity'::timestamptz)
      end as unread
    from public.municipality_events e
    join tenant_scope scope
      on scope.tenant_key = e.tenant_key
    join topic_scope ts
      on ts.tenant_key = e.tenant_key
     and ts.topic_key = e.topic_key
     and ts.in_app_enabled = true
    join public.tenants t
      on t.tenant_key = e.tenant_key
    left join public.tenant_profiles tp
      on tp.tenant_key = e.tenant_key
    left join viewer v on true
    left join feed_views fv
      on fv.tenant_key = e.tenant_key
    where e.status = 'published'
      and e.starts_at is not null
      and coalesce(
        e.ends_at,
        case
          when e.all_day then date_trunc('day', e.starts_at) + interval '1 day' - interval '1 millisecond'
          else e.starts_at + interval '1 hour'
        end
      ) >= now()
  )
  select * from alert_rows
  union all
  select * from event_rows;
$$;

grant execute on function public.resident_notification_feed_rows(text) to anon, authenticated;

create or replace function public.list_resident_notifications(
  p_tenant_filter text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  tenant_key text,
  tenant_label text,
  tenant_primary_subdomain text,
  kind text,
  id bigint,
  topic_key text,
  topic_label text,
  title text,
  summary text,
  body text,
  location_name text,
  location_address text,
  cta_label text,
  cta_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  all_day boolean,
  severity text,
  pinned boolean,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  sort_at timestamptz,
  unread boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select *
  from public.resident_notification_feed_rows(p_tenant_filter)
  order by sort_at desc, id desc
  limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
$$;

grant execute on function public.list_resident_notifications(text, integer, integer) to anon, authenticated;

create or replace function public.list_resident_notification_location_counts()
returns table (
  tenant_key text,
  tenant_label text,
  tenant_primary_subdomain text,
  item_count bigint,
  unread_count bigint,
  latest_sort_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with tenant_scope as (
    select scope.tenant_key
    from public.resident_notification_scope() scope
  ),
  feed as (
    select *
    from public.resident_notification_feed_rows(null)
  )
  select
    scope.tenant_key,
    coalesce(nullif(trim(tp.display_name), ''), nullif(trim(t.name), ''), scope.tenant_key) as tenant_label,
    coalesce(nullif(trim(t.primary_subdomain), ''), '') as tenant_primary_subdomain,
    count(feed.id) as item_count,
    count(feed.id) filter (where feed.unread) as unread_count,
    max(feed.sort_at) as latest_sort_at
  from tenant_scope scope
  join public.tenants t
    on t.tenant_key = scope.tenant_key
  left join public.tenant_profiles tp
    on tp.tenant_key = scope.tenant_key
  left join feed
    on feed.tenant_key = scope.tenant_key
  group by scope.tenant_key, coalesce(nullif(trim(tp.display_name), ''), nullif(trim(t.name), ''), scope.tenant_key), coalesce(nullif(trim(t.primary_subdomain), ''), '')
  order by
    count(feed.id) filter (where feed.unread) desc,
    max(feed.sort_at) desc nulls last,
    coalesce(nullif(trim(tp.display_name), ''), nullif(trim(t.name), ''), scope.tenant_key) asc;
$$;

grant execute on function public.list_resident_notification_location_counts() to anon, authenticated;

create or replace function public.mark_resident_notification_viewed(
  p_tenant_key text,
  p_kind text,
  p_viewed_at timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_tenant_key text := lower(trim(coalesce(p_tenant_key, '')));
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_viewed_at timestamptz := coalesce(p_viewed_at, now());
begin
  if v_user_id is null or v_tenant_key = '' then
    return false;
  end if;

  if v_kind not in ('alert', 'event', 'alerts', 'events') then
    return false;
  end if;

  if not exists (
    select 1
    from public.resident_notification_scope() scope
    where scope.tenant_key = v_tenant_key
  ) then
    return false;
  end if;

  insert into public.resident_community_feed_views (
    tenant_key,
    user_id,
    alerts_last_viewed_at,
    events_last_viewed_at
  )
  values (
    v_tenant_key,
    v_user_id,
    case when v_kind in ('alert', 'alerts') then v_viewed_at else null end,
    case when v_kind in ('event', 'events') then v_viewed_at else null end
  )
  on conflict (tenant_key, user_id)
  do update
  set
    alerts_last_viewed_at = case
      when v_kind in ('alert', 'alerts') then greatest(
        coalesce(public.resident_community_feed_views.alerts_last_viewed_at, '-infinity'::timestamptz),
        v_viewed_at
      )
      else public.resident_community_feed_views.alerts_last_viewed_at
    end,
    events_last_viewed_at = case
      when v_kind in ('event', 'events') then greatest(
        coalesce(public.resident_community_feed_views.events_last_viewed_at, '-infinity'::timestamptz),
        v_viewed_at
      )
      else public.resident_community_feed_views.events_last_viewed_at
    end,
    updated_at = now();

  return true;
end;
$$;

grant execute on function public.mark_resident_notification_viewed(text, text, timestamptz) to authenticated;

commit;
