begin;

-- A report domain can route to several departments; the domain owns this
-- relationship rather than the department owning a list of domains.
create table if not exists public.tenant_domain_departments (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  domain_key text not null references public.domain_definitions(key) on delete cascade,
  department_id uuid not null references public.tenant_departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_key, domain_key, department_id)
);

create index if not exists tenant_domain_departments_route_idx
  on public.tenant_domain_departments (tenant_key, domain_key, department_id);

-- Retire the earlier inverse mapping. Keep the column for a non-destructive
-- transition, but the notification logic below only reads the canonical table.
alter table public.tenant_departments
  alter column domain_keys set default '{}'::text[];

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
  v_recipient_count integer := 0;
begin
  insert into public.tenant_report_notifications (
    tenant_key, recipient_user_id, department_id, domain_key, source_table,
    source_report_id, report_number, title, body
  )
  select
    lower(trim(p_tenant_key)), member.user_id, routing.department_id, lower(trim(p_domain_key)), p_source_table,
    p_source_report_id, nullif(trim(p_report_number), ''), p_title, nullif(trim(p_body), '')
  from public.tenant_domain_departments routing
  join public.tenant_departments department
    on department.id = routing.department_id
   and department.tenant_key = lower(trim(p_tenant_key))
   and department.active = true
  join public.tenant_department_members member
    on member.department_id = department.id
  join public.tenant_user_roles role_row
    on role_row.tenant_key = lower(trim(p_tenant_key))
   and role_row.user_id = member.user_id
   and role_row.status = 'active'
  where routing.tenant_key = lower(trim(p_tenant_key))
    and routing.domain_key = lower(trim(p_domain_key))
  on conflict (recipient_user_id, source_table, source_report_id) do nothing;
  get diagnostics v_recipient_count = row_count;

  -- Safe rollout behavior: existing tenants retain the original tenant-admin
  -- notifications until a routed department has at least one active employee.
  if v_recipient_count = 0 then
    insert into public.tenant_report_notifications (
      tenant_key, recipient_user_id, department_id, domain_key, source_table,
      source_report_id, report_number, title, body
    )
    select
      lower(trim(p_tenant_key)), role_row.user_id, null, lower(trim(p_domain_key)), p_source_table,
      p_source_report_id, nullif(trim(p_report_number), ''), p_title, nullif(trim(p_body), '')
    from public.tenant_user_roles role_row
    where role_row.tenant_key = lower(trim(p_tenant_key))
      and role_row.role = 'tenant_admin'
      and role_row.status = 'active'
    on conflict (recipient_user_id, source_table, source_report_id) do nothing;
  end if;
end;
$$;

alter table public.tenant_domain_departments enable row level security;

drop policy if exists tenant_departments_select_scoped on public.tenant_departments;
create policy tenant_departments_select_scoped on public.tenant_departments for select to authenticated
using (public.can_access_tenant_hub(tenant_key) or public.is_platform_admin(auth.uid()));
drop policy if exists tenant_departments_manage_admin on public.tenant_departments;
create policy tenant_departments_manage_admin on public.tenant_departments for all to authenticated
using (public.is_tenant_admin(auth.uid(), tenant_key) or public.is_platform_admin(auth.uid()))
with check (public.is_tenant_admin(auth.uid(), tenant_key) or public.is_platform_admin(auth.uid()));

drop policy if exists tenant_department_members_select_scoped on public.tenant_department_members;
create policy tenant_department_members_select_scoped on public.tenant_department_members for select to authenticated
using (exists (select 1 from public.tenant_departments d where d.id = department_id and (public.can_access_tenant_hub(d.tenant_key) or public.is_platform_admin(auth.uid()))));
drop policy if exists tenant_department_members_manage_admin on public.tenant_department_members;
create policy tenant_department_members_manage_admin on public.tenant_department_members for all to authenticated
using (exists (select 1 from public.tenant_departments d where d.id = department_id and (public.is_tenant_admin(auth.uid(), d.tenant_key) or public.is_platform_admin(auth.uid()))))
with check (exists (select 1 from public.tenant_departments d where d.id = department_id and (public.is_tenant_admin(auth.uid(), d.tenant_key) or public.is_platform_admin(auth.uid()))));

create policy tenant_domain_departments_select_scoped on public.tenant_domain_departments for select to authenticated
using (public.can_access_tenant_hub(tenant_key) or public.is_platform_admin(auth.uid()));
create policy tenant_domain_departments_manage_scoped on public.tenant_domain_departments for all to authenticated
using (public.is_tenant_admin(auth.uid(), tenant_key) or public.is_platform_admin(auth.uid()))
with check (public.is_tenant_admin(auth.uid(), tenant_key) or public.is_platform_admin(auth.uid()));

grant select, insert, update, delete on public.tenant_domain_departments to authenticated;

commit;
