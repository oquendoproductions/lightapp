begin;

-- Departments own operational report routing. A department may cover more than
-- one report domain and may have a central mailbox in addition to staff alerts.
create table if not exists public.tenant_departments (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  notification_email text,
  domain_keys text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_key, name)
);

create table if not exists public.tenant_department_members (
  department_id uuid not null references public.tenant_departments(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (department_id, user_id)
);

-- One row per recipient gives each staff member an independent read state.
create table if not exists public.tenant_report_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  recipient_user_id uuid not null,
  department_id uuid references public.tenant_departments(id) on delete set null,
  domain_key text not null,
  source_table text not null,
  source_report_id uuid not null,
  report_number text,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (recipient_user_id, source_table, source_report_id)
);

create index if not exists tenant_departments_tenant_active_idx
  on public.tenant_departments (tenant_key, active, name);
create index if not exists tenant_department_members_user_idx
  on public.tenant_department_members (user_id, department_id);
create index if not exists tenant_report_notifications_recipient_idx
  on public.tenant_report_notifications (recipient_user_id, read_at, created_at desc);

drop trigger if exists trg_tenant_departments_updated_at on public.tenant_departments;
create trigger trg_tenant_departments_updated_at
before update on public.tenant_departments
for each row execute function public.touch_rbac_updated_at();

create or replace function public.create_tenant_report_notifications(
  p_tenant_key text,
  p_domain_key text,
  p_source_table text,
  p_source_report_id uuid,
  p_report_number text,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_department_id uuid;
  v_recipient_count integer := 0;
begin
  select d.id into v_department_id
  from public.tenant_departments d
  where d.tenant_key = lower(trim(p_tenant_key))
    and d.active = true
    and lower(trim(p_domain_key)) = any (
      select lower(trim(domain_key)) from unnest(d.domain_keys) as domain_key
    )
  order by d.name
  limit 1;

  if v_department_id is not null then
    insert into public.tenant_report_notifications (
      tenant_key, recipient_user_id, department_id, domain_key, source_table,
      source_report_id, report_number, title, body
    )
    select
      lower(trim(p_tenant_key)), member.user_id, v_department_id, lower(trim(p_domain_key)), p_source_table,
      p_source_report_id, nullif(trim(p_report_number), ''), p_title, nullif(trim(p_body), '')
    from public.tenant_department_members member
    join public.tenant_user_roles role_row
      on role_row.tenant_key = lower(trim(p_tenant_key))
     and role_row.user_id = member.user_id
     and role_row.role = 'tenant_admin'
     and role_row.status = 'active'
    where member.department_id = v_department_id
    on conflict (recipient_user_id, source_table, source_report_id) do nothing;
    get diagnostics v_recipient_count = row_count;
  end if;

  -- Before departments are configured (or while a department has no assigned
  -- admin), all active tenant admins keep receiving report notifications.
  if v_recipient_count = 0 then
    insert into public.tenant_report_notifications (
      tenant_key, recipient_user_id, department_id, domain_key, source_table,
      source_report_id, report_number, title, body
    )
    select
      lower(trim(p_tenant_key)), role_row.user_id, v_department_id, lower(trim(p_domain_key)), p_source_table,
      p_source_report_id, nullif(trim(p_report_number), ''), p_title, nullif(trim(p_body), '')
    from public.tenant_user_roles role_row
    where role_row.tenant_key = lower(trim(p_tenant_key))
      and role_row.role = 'tenant_admin'
      and role_row.status = 'active'
    on conflict (recipient_user_id, source_table, source_report_id) do nothing;
  end if;
end;
$$;

create or replace function public.notify_tenant_report_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_domain_key text := coalesce(
    nullif(lower(trim(v_row ->> 'report_domain')), ''),
    nullif(split_part(lower(trim(v_row ->> 'light_id')), ':', 1), ''),
    tg_argv[0]
  );
  v_title text;
  v_body text;
begin
  v_title := format('New %s report', replace(initcap(replace(v_domain_key, '_', ' ')), '  ', ' '));
  v_body := coalesce(nullif(trim(v_row ->> 'note'), ''), 'A new report is ready for review.');
  perform public.create_tenant_report_notifications(
    v_row ->> 'tenant_key', v_domain_key, tg_table_name, (v_row ->> 'id')::uuid, v_row ->> 'report_number', v_title, v_body
  );
  return new;
end;
$$;

drop trigger if exists trg_reports_tenant_notifications on public.reports;
create trigger trg_reports_tenant_notifications
after insert on public.reports
for each row execute function public.notify_tenant_report_insert('streetlights');

drop trigger if exists trg_pothole_reports_tenant_notifications on public.pothole_reports;
create trigger trg_pothole_reports_tenant_notifications
after insert on public.pothole_reports
for each row execute function public.notify_tenant_report_insert('potholes');

alter table public.tenant_departments enable row level security;
alter table public.tenant_department_members enable row level security;
alter table public.tenant_report_notifications enable row level security;

create policy tenant_departments_select_scoped on public.tenant_departments for select to authenticated
using (public.can_access_tenant_hub(tenant_key));
create policy tenant_departments_manage_admin on public.tenant_departments for all to authenticated
using (public.is_tenant_admin(auth.uid(), tenant_key))
with check (public.is_tenant_admin(auth.uid(), tenant_key));

create policy tenant_department_members_select_scoped on public.tenant_department_members for select to authenticated
using (exists (select 1 from public.tenant_departments d where d.id = department_id and public.can_access_tenant_hub(d.tenant_key)));
create policy tenant_department_members_manage_admin on public.tenant_department_members for all to authenticated
using (exists (select 1 from public.tenant_departments d where d.id = department_id and public.is_tenant_admin(auth.uid(), d.tenant_key)))
with check (exists (select 1 from public.tenant_departments d where d.id = department_id and public.is_tenant_admin(auth.uid(), d.tenant_key)));

create policy tenant_report_notifications_select_own on public.tenant_report_notifications for select to authenticated
using (recipient_user_id = auth.uid());
create policy tenant_report_notifications_mark_own_read on public.tenant_report_notifications for update to authenticated
using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

grant select, insert, update, delete on public.tenant_departments, public.tenant_department_members to authenticated;
grant select, update on public.tenant_report_notifications to authenticated;
grant execute on function public.create_tenant_report_notifications(text, text, text, uuid, text, text, text) to service_role;

commit;
