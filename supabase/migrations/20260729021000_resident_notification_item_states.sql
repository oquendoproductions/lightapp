-- Durable per-item inbox state. This supplements the legacy per-tenant
-- "last viewed" timestamps so a resident can explicitly mark a single Alert
-- or Event unread, or remove it from their inbox without affecting anyone
-- else. Report updates use their own private notification record.

begin;

alter table public.resident_community_feed_views
  add column if not exists alerts_read_ids text[] not null default '{}'::text[],
  add column if not exists events_read_ids text[] not null default '{}'::text[],
  add column if not exists alerts_unread_ids text[] not null default '{}'::text[],
  add column if not exists events_unread_ids text[] not null default '{}'::text[],
  add column if not exists alerts_deleted_ids text[] not null default '{}'::text[],
  add column if not exists events_deleted_ids text[] not null default '{}'::text[];

alter table public.resident_incident_notifications
  add column if not exists deleted_at timestamptz;

create index if not exists resident_incident_notifications_user_inbox_idx
  on public.resident_incident_notifications (user_id, deleted_at, created_at desc);

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
    where nullif(lower(trim(coalesce(p_tenant_filter, ''))), '') is null
      or scope.tenant_key = lower(trim(coalesce(p_tenant_filter, '')))
  ),
  topic_scope as (
    select
      nt.tenant_key,
      nt.topic_key,
      coalesce(nullif(trim(nt.label), ''), nt.topic_key) as topic_label,
      case
        when pref.user_id is not null then (
          coalesce(pref.in_app_enabled, false)
          or coalesce(pref.email_enabled, false)
          or coalesce(pref.web_push_enabled, false)
        )
        else coalesce(nt.default_enabled, false)
      end as in_app_enabled
    from tenant_scope scope
    join public.notification_topics nt
      on nt.tenant_key = scope.tenant_key
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
      rcv.events_last_viewed_at,
      rcv.alerts_read_ids,
      rcv.events_read_ids,
      rcv.alerts_unread_ids,
      rcv.events_unread_ids,
      rcv.alerts_deleted_ids,
      rcv.events_deleted_ids
    from public.resident_community_feed_views rcv
    join viewer v on v.user_id is not null and rcv.user_id = v.user_id
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
        when a.id::text = any(coalesce(fv.alerts_unread_ids, '{}'::text[])) then true
        when a.id::text = any(coalesce(fv.alerts_read_ids, '{}'::text[])) then false
        else coalesce(a.updated_at, a.published_at, a.created_at, a.starts_at, now())
          > coalesce(fv.alerts_last_viewed_at, '-infinity'::timestamptz)
      end as unread
    from public.municipality_alerts a
    join tenant_scope scope on scope.tenant_key = a.tenant_key
    join topic_scope ts on ts.tenant_key = a.tenant_key and ts.topic_key = a.topic_key and ts.in_app_enabled = true
    join public.tenants t on t.tenant_key = a.tenant_key
    left join public.tenant_profiles tp on tp.tenant_key = a.tenant_key
    left join viewer v on true
    left join feed_views fv on fv.tenant_key = a.tenant_key
    where a.status = 'published'
      and (a.starts_at is null or a.starts_at <= now())
      and (a.ends_at is null or a.ends_at >= now())
      and not (a.id::text = any(coalesce(fv.alerts_deleted_ids, '{}'::text[])))
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
        when e.id::text = any(coalesce(fv.events_unread_ids, '{}'::text[])) then true
        when e.id::text = any(coalesce(fv.events_read_ids, '{}'::text[])) then false
        else coalesce(e.updated_at, e.published_at, e.created_at, e.starts_at, now())
          > coalesce(fv.events_last_viewed_at, '-infinity'::timestamptz)
      end as unread
    from public.municipality_events e
    join tenant_scope scope on scope.tenant_key = e.tenant_key
    join topic_scope ts on ts.tenant_key = e.tenant_key and ts.topic_key = e.topic_key and ts.in_app_enabled = true
    join public.tenants t on t.tenant_key = e.tenant_key
    left join public.tenant_profiles tp on tp.tenant_key = e.tenant_key
    left join viewer v on true
    left join feed_views fv on fv.tenant_key = e.tenant_key
    where e.status = 'published'
      and e.starts_at is not null
      and coalesce(e.ends_at, case when e.all_day then date_trunc('day', e.starts_at) + interval '1 day' - interval '1 millisecond' else e.starts_at + interval '1 hour' end) >= now()
      and not (e.id::text = any(coalesce(fv.events_deleted_ids, '{}'::text[])))
  )
  select * from alert_rows
  union all
  select * from event_rows;
$$;

grant execute on function public.resident_notification_feed_rows(text) to anon, authenticated;

commit;
