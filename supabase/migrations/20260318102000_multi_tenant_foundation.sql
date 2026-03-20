begin;

-- ---------------------------------------------------------------------------
-- Phase 1: tenant core schema
-- ---------------------------------------------------------------------------

create table if not exists public.tenants (
  tenant_key text primary key,
  name text not null,
  primary_subdomain text not null unique,
  boundary_config_key text not null,
  notification_email_potholes text,
  notification_email_water_drain text,
  is_pilot boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tenant_key ~ '^[a-z0-9-]+$')
);

create table if not exists public.tenant_admins (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  user_id uuid not null,
  role text not null default 'municipality_admin' check (role in ('municipality_admin')),
  created_at timestamptz not null default now(),
  primary key (tenant_key, user_id)
);

create table if not exists public.tenant_unknown_slug_events (
  id bigint generated always as identity primary key,
  host text not null,
  path text not null,
  slug text not null,
  ts timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (slug ~ '^[a-z0-9-]+$')
);

create index if not exists tenant_unknown_slug_events_created_at_idx
  on public.tenant_unknown_slug_events (created_at desc);

create index if not exists tenant_unknown_slug_events_slug_idx
  on public.tenant_unknown_slug_events (slug, created_at desc);

insert into public.tenants (
  tenant_key,
  name,
  primary_subdomain,
  boundary_config_key,
  is_pilot,
  active
)
values (
  'ashtabulacity',
  'Ashtabula City',
  'ashtabulacity.cityreport.io',
  'ashtabula_city_geojson',
  true,
  true
)
on conflict (tenant_key) do update
set
  name = excluded.name,
  primary_subdomain = excluded.primary_subdomain,
  boundary_config_key = excluded.boundary_config_key,
  is_pilot = excluded.is_pilot,
  active = excluded.active,
  updated_at = now();

create or replace function public.request_tenant_key()
returns text
language plpgsql
stable
as $$
declare
  v_headers jsonb;
  v_claims jsonb;
  v text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;

  v := lower(trim(coalesce(v_headers->>'x-tenant-key', '')));
  if v = '' then
    begin
      v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
    exception when others then
      v_claims := null;
    end;
    v := lower(trim(coalesce(v_claims->>'tenant_key', '')));
  end if;

  if v = '' then
    begin
      v := lower(trim(coalesce(current_setting('app.tenant_key', true), '')));
    exception when others then
      v := '';
    end;
  end if;

  if v = '' then
    v := 'ashtabulacity';
  end if;

  v := regexp_replace(v, '[^a-z0-9-]', '', 'g');
  if v = '' then
    v := 'ashtabulacity';
  end if;
  return v;
end;
$$;

create or replace function public.is_platform_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admins a
    where a.user_id = uid
  );
$$;

create or replace function public.is_tenant_admin(uid uuid, tenant text)
returns boolean
language sql
stable
as $$
  select
    public.is_platform_admin(uid)
    or exists (
      select 1
      from public.tenant_admins ta
      where ta.user_id = uid
        and ta.tenant_key = coalesce(nullif(trim(tenant), ''), public.request_tenant_key())
    );
$$;

alter table public.tenants enable row level security;
alter table public.tenant_admins enable row level security;
alter table public.tenant_unknown_slug_events enable row level security;

drop policy if exists tenants_select_request_tenant on public.tenants;
create policy tenants_select_request_tenant
on public.tenants
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
  and active = true
);

drop policy if exists tenants_manage_platform_admin on public.tenants;
create policy tenants_manage_platform_admin
on public.tenants
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_admins_select_platform_admin on public.tenant_admins;
create policy tenant_admins_select_platform_admin
on public.tenant_admins
for select
to authenticated
using (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_admins_manage_platform_admin on public.tenant_admins;
create policy tenant_admins_manage_platform_admin
on public.tenant_admins
for all
to authenticated
using (public.is_platform_admin(auth.uid()))
with check (public.is_platform_admin(auth.uid()));

drop policy if exists tenant_unknown_slug_events_insert_public on public.tenant_unknown_slug_events;
create policy tenant_unknown_slug_events_insert_public
on public.tenant_unknown_slug_events
for insert
to anon, authenticated
with check (true);

drop policy if exists tenant_unknown_slug_events_select_platform_admin on public.tenant_unknown_slug_events;
create policy tenant_unknown_slug_events_select_platform_admin
on public.tenant_unknown_slug_events
for select
to authenticated
using (public.is_platform_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Phase 2: tenant key propagation and backfill
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  has_tenant_col boolean;
  targets text[] := array[
    'reports',
    'fixed_lights',
    'light_actions',
    'official_lights',
    'official_signs',
    'potholes',
    'pothole_reports',
    'water_drain_incidents',
    'utility_report_status',
    'abuse_rate_events',
    'abuse_events',
    'incident_events',
    'incident_state_current',
    'tenant_visibility_config'
  ];
begin
  foreach t in array targets loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    select exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = t
        and c.column_name = 'tenant_key'
    ) into has_tenant_col;

    if not has_tenant_col then
      execute format(
        'alter table public.%I add column tenant_key text default %L',
        t,
        'ashtabulacity'
      );
    end if;

    if t <> 'reports' then
      execute format(
        'update public.%I set tenant_key = %L where coalesce(trim(tenant_key), '''') = ''''',
        t,
        'ashtabulacity'
      );
    end if;

    execute format('alter table public.%I alter column tenant_key set default public.request_tenant_key()', t);
    execute format('alter table public.%I alter column tenant_key set not null', t);
    execute format('create index if not exists %I on public.%I (tenant_key)', t || '_tenant_key_idx', t);
  end loop;
end
$$;

-- Existing default rows were keyed as "default"; remap to explicit tenant slug.
update public.tenant_visibility_config
set tenant_key = 'ashtabulacity'
where tenant_key = 'default';

-- Ensure Ashtabula has visibility rows after key remap.
insert into public.tenant_visibility_config (tenant_key, domain, visibility)
values
  ('ashtabulacity', 'streetlights'::public.incident_domain, 'internal_only'),
  ('ashtabulacity', 'potholes'::public.incident_domain, 'public'),
  ('ashtabulacity', 'street_signs'::public.incident_domain, 'public'),
  ('ashtabulacity', 'power_outage'::public.incident_domain, 'internal_only'),
  ('ashtabulacity', 'water_main'::public.incident_domain, 'internal_only')
on conflict (tenant_key, domain)
do update set
  visibility = excluded.visibility,
  updated_at = now();

-- Re-key lifecycle snapshot uniqueness with tenant dimension.
alter table if exists public.incident_state_current
  drop constraint if exists incident_state_current_pkey;

alter table if exists public.incident_state_current
  add constraint incident_state_current_pkey primary key (tenant_key, domain, incident_id);

create index if not exists incident_events_tenant_incident_idx
  on public.incident_events (tenant_key, domain, incident_id, changed_at desc);

create index if not exists incident_events_tenant_state_idx
  on public.incident_events (tenant_key, domain, new_state, changed_at desc);

create index if not exists incident_state_current_tenant_state_idx
  on public.incident_state_current (tenant_key, domain, state, last_changed_at desc);

do $$
begin
  if to_regclass('public.water_drain_incidents') is not null then
    alter table public.water_drain_incidents
      drop constraint if exists water_drain_incidents_pkey;
    alter table public.water_drain_incidents
      add constraint water_drain_incidents_pkey primary key (tenant_key, incident_id);
  end if;
end
$$;

do $$
begin
  if to_regclass('public.utility_report_status') is not null then
    alter table public.utility_report_status
      drop constraint if exists utility_report_status_pkey;
    alter table public.utility_report_status
      add constraint utility_report_status_pkey primary key (tenant_key, user_id, incident_id);
    create index if not exists utility_report_status_tenant_user_updated_idx
      on public.utility_report_status (tenant_key, user_id, updated_at desc);
  end if;
end
$$;

create index if not exists abuse_rate_events_tenant_domain_identity_created_idx
  on public.abuse_rate_events (tenant_key, domain, identity_hash, created_at desc);

create index if not exists abuse_rate_events_tenant_domain_ip_created_idx
  on public.abuse_rate_events (tenant_key, domain, ip_hash, created_at desc)
  where ip_hash is not null;

create index if not exists abuse_events_tenant_domain_created_idx
  on public.abuse_events (tenant_key, domain, created_at desc);

-- ---------------------------------------------------------------------------
-- Lifecycle function updates (tenant-aware, backward compatible wrapper kept)
-- ---------------------------------------------------------------------------

create or replace function public.emit_incident_state_change_tenant(
  p_tenant_key text,
  p_incident_id text,
  p_domain public.incident_domain,
  p_new_state public.incident_state,
  p_changed_by uuid,
  p_source public.incident_event_source,
  p_metadata jsonb default '{}'::jsonb,
  p_changed_at timestamptz default now(),
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prev public.incident_state;
  v_tenant text := lower(trim(coalesce(p_tenant_key, public.request_tenant_key())));
begin
  if p_incident_id is null or length(trim(p_incident_id)) = 0 then
    return;
  end if;
  if v_tenant = '' then
    v_tenant := 'ashtabulacity';
  end if;

  select state into v_prev
  from public.incident_state_current
  where tenant_key = v_tenant
    and domain = p_domain
    and incident_id = trim(p_incident_id);

  if not p_force then
    if v_prev = p_new_state then
      return;
    end if;
    if not public.is_valid_incident_transition(v_prev, p_new_state) then
      return;
    end if;
  end if;

  insert into public.incident_events (
    tenant_key,
    incident_id,
    domain,
    previous_state,
    new_state,
    changed_by,
    source,
    changed_at,
    metadata
  ) values (
    v_tenant,
    trim(p_incident_id),
    p_domain,
    v_prev,
    p_new_state,
    p_changed_by,
    p_source,
    coalesce(p_changed_at, now()),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.emit_incident_state_change(
  p_incident_id text,
  p_domain public.incident_domain,
  p_new_state public.incident_state,
  p_changed_by uuid,
  p_source public.incident_event_source,
  p_metadata jsonb default '{}'::jsonb,
  p_changed_at timestamptz default now(),
  p_force boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.emit_incident_state_change_tenant(
    public.request_tenant_key(),
    p_incident_id,
    p_domain,
    p_new_state,
    p_changed_by,
    p_source,
    p_metadata,
    p_changed_at,
    p_force
  );
end;
$$;

create or replace function public.apply_incident_event_to_snapshot()
returns trigger
language plpgsql
as $$
begin
  perform set_config('cityreport.incident_snapshot_apply', 'on', true);

  insert into public.incident_state_current (
    tenant_key,
    domain,
    incident_id,
    state,
    last_changed_at,
    reopen_count
  )
  values (
    coalesce(new.tenant_key, public.request_tenant_key()),
    new.domain,
    new.incident_id,
    new.new_state,
    new.changed_at,
    case when new.new_state = 'reopened' then 1 else 0 end
  )
  on conflict (tenant_key, domain, incident_id)
  do update set
    state = excluded.state,
    last_changed_at = excluded.last_changed_at,
    reopen_count = case
      when excluded.state = 'reopened'
        then public.incident_state_current.reopen_count + 1
      else public.incident_state_current.reopen_count
    end;

  perform set_config('cityreport.incident_snapshot_apply', 'off', true);
  return new;
exception when others then
  perform set_config('cityreport.incident_snapshot_apply', 'off', true);
  raise;
end;
$$;

create or replace function public.trg_reports_to_incident_events()
returns trigger
language plpgsql
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_tenant text := lower(trim(coalesce(v_new->>'tenant_key', public.request_tenant_key())));
  v_type text := lower(trim(coalesce(v_new->>'report_type', v_new->>'type', '')));
  v_quality text := lower(trim(coalesce(v_new->>'report_quality', '')));
  v_domain_text text := v_new->>'report_domain';
  v_light_id text := trim(coalesce(v_new->>'light_id', ''));
  v_reporter uuid := public.safe_uuid_or_null(v_new->>'reporter_user_id');
  v_domain public.incident_domain;
  v_current public.incident_state;
  v_next public.incident_state;
  v_ts timestamptz := coalesce((v_new->>'created_at')::timestamptz, now());
begin
  if v_quality = 'good' or v_type in ('working','reported_working','is_working') then
    return new;
  end if;
  if v_light_id = '' then
    return new;
  end if;
  if v_tenant = '' then
    v_tenant := 'ashtabulacity';
  end if;

  v_domain := public.map_incident_domain_from_report(v_light_id, v_domain_text, v_type);

  select state into v_current
  from public.incident_state_current
  where tenant_key = v_tenant
    and domain = v_domain
    and incident_id = v_light_id;

  if v_current is null then
    v_next := 'reported'::public.incident_state;
  elsif v_current in ('fixed','archived') then
    v_next := 'reopened'::public.incident_state;
  elsif v_current = 'reported' then
    v_next := 'aggregated'::public.incident_state;
  else
    return new;
  end if;

  perform public.emit_incident_state_change_tenant(
    v_tenant,
    v_light_id,
    v_domain,
    v_next,
    v_reporter,
    'user'::public.incident_event_source,
    jsonb_build_object('source_table','reports','report_id',v_new->>'id','report_type',v_type),
    v_ts,
    false
  );

  return new;
end;
$$;

create or replace function public.trg_pothole_reports_to_incident_events()
returns trigger
language plpgsql
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_tenant text := lower(trim(coalesce(v_new->>'tenant_key', public.request_tenant_key())));
  v_pothole_id text := trim(coalesce(v_new->>'pothole_id', ''));
  v_incident_id text := 'pothole:' || v_pothole_id;
  v_reporter uuid := public.safe_uuid_or_null(v_new->>'reporter_user_id');
  v_current public.incident_state;
  v_next public.incident_state;
  v_ts timestamptz := coalesce((v_new->>'created_at')::timestamptz, now());
begin
  if v_pothole_id = '' then
    return new;
  end if;
  if v_tenant = '' then
    v_tenant := 'ashtabulacity';
  end if;

  select state into v_current
  from public.incident_state_current
  where tenant_key = v_tenant
    and domain = 'potholes'::public.incident_domain
    and incident_id = v_incident_id;

  if v_current is null then
    v_next := 'reported'::public.incident_state;
  elsif v_current in ('fixed','archived') then
    v_next := 'reopened'::public.incident_state;
  elsif v_current = 'reported' then
    v_next := 'aggregated'::public.incident_state;
  else
    return new;
  end if;

  perform public.emit_incident_state_change_tenant(
    v_tenant,
    v_incident_id,
    'potholes'::public.incident_domain,
    v_next,
    v_reporter,
    'user'::public.incident_event_source,
    jsonb_build_object('source_table','pothole_reports','report_id',v_new->>'id','pothole_id',v_pothole_id),
    v_ts,
    false
  );

  return new;
end;
$$;

create or replace function public.trg_light_actions_to_incident_events()
returns trigger
language plpgsql
as $$
declare
  v_new jsonb := to_jsonb(new);
  v_tenant text := lower(trim(coalesce(v_new->>'tenant_key', public.request_tenant_key())));
  v_action text := lower(trim(coalesce(v_new->>'action', '')));
  v_light_id text := trim(coalesce(v_new->>'light_id', ''));
  v_actor uuid := public.safe_uuid_or_null(v_new->>'actor_user_id');
  v_domain public.incident_domain := public.map_incident_domain_from_light_id(v_light_id);
  v_current public.incident_state;
  v_ts timestamptz := coalesce((v_new->>'created_at')::timestamptz, now());
begin
  if v_light_id = '' then
    return new;
  end if;
  if v_tenant = '' then
    v_tenant := 'ashtabulacity';
  end if;

  select state into v_current
  from public.incident_state_current
  where tenant_key = v_tenant
    and domain = v_domain
    and incident_id = v_light_id;

  if v_action = 'confirm' then
    perform public.emit_incident_state_change_tenant(
      v_tenant,
      v_light_id,
      v_domain,
      'confirmed'::public.incident_state,
      v_actor,
      'admin'::public.incident_event_source,
      jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action',v_action),
      v_ts,
      false
    );
    return new;
  end if;

  if v_action = 'fix' then
    if v_current in ('reported','aggregated','reopened') then
      perform public.emit_incident_state_change_tenant(
        v_tenant,
        v_light_id,
        v_domain,
        'confirmed'::public.incident_state,
        v_actor,
        'admin'::public.incident_event_source,
        jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action','auto_confirm_before_fix'),
        v_ts,
        false
      );
    end if;

    perform public.emit_incident_state_change_tenant(
      v_tenant,
      v_light_id,
      v_domain,
      'fixed'::public.incident_state,
      v_actor,
      'admin'::public.incident_event_source,
      jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action',v_action),
      v_ts,
      false
    );
    return new;
  end if;

  if v_action = 'reopen' then
    perform public.emit_incident_state_change_tenant(
      v_tenant,
      v_light_id,
      v_domain,
      'reopened'::public.incident_state,
      v_actor,
      'admin'::public.incident_event_source,
      jsonb_build_object('source_table','light_actions','action_id',v_new->>'id','action',v_action),
      v_ts,
      false
    );
    return new;
  end if;

  return new;
end;
$$;

create or replace function public.trg_reports_snapshot_self_heal()
returns trigger
language plpgsql
as $function$
declare
  v_tenant text := lower(trim(coalesce(new.tenant_key, public.request_tenant_key())));
  v_type text := lower(trim(coalesce(new.report_type, '')));
  v_quality text := lower(trim(coalesce(new.report_quality, '')));
  v_light_id text := trim(coalesce(new.light_id::text, ''));
  v_domain public.incident_domain;
  v_exists boolean := false;
begin
  if v_quality = 'good' or v_type in ('working','reported_working','is_working') then
    return new;
  end if;
  if v_light_id = '' then
    return new;
  end if;
  if v_tenant = '' then
    v_tenant := 'ashtabulacity';
  end if;

  v_domain := public.map_incident_domain_from_report(v_light_id, null, v_type);

  select exists(
    select 1
    from public.incident_state_current s
    where s.tenant_key = v_tenant
      and s.domain = v_domain
      and s.incident_id = v_light_id
  ) into v_exists;

  if not v_exists then
    perform public.emit_incident_state_change_tenant(
      v_tenant,
      v_light_id,
      v_domain,
      'reported'::public.incident_state,
      new.reporter_user_id,
      'system'::public.incident_event_source,
      jsonb_build_object('source_table','reports','report_id',new.id,'self_heal',true),
      coalesce(new.created_at, now()),
      false
    );
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Phase 3: restrictive tenant RLS overlays
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  rls_tables text[] := array[
    'reports',
    'fixed_lights',
    'light_actions',
    'official_lights',
    'official_signs',
    'potholes',
    'pothole_reports',
    'water_drain_incidents',
    'utility_report_status',
    'abuse_rate_events',
    'abuse_events',
    'incident_events',
    'incident_state_current',
    'tenant_visibility_config'
  ];
begin
  foreach t in array rls_tables loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_tenant_scope_restrictive', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to public using (tenant_key = public.request_tenant_key()) with check (tenant_key = public.request_tenant_key())',
      t || '_tenant_scope_restrictive',
      t
    );
  end loop;
end
$$;

-- Storage: tenant-prefixed object keys.
drop policy if exists report_images_public_insert on storage.objects;
create policy report_images_public_insert
  on storage.objects
  for insert
  with check (
    bucket_id = 'report-images'
    and split_part(name, '/', 1) = public.request_tenant_key()
  );

commit;
