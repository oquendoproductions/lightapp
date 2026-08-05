begin;

-- The assignment belongs to the tenant user. This makes employee profile
-- management the source of truth while retaining a many-to-many relationship.
create table if not exists public.tenant_user_departments (
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  user_id uuid not null,
  department_id uuid not null references public.tenant_departments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_key, user_id, department_id)
);

create index if not exists tenant_user_departments_recipient_idx
  on public.tenant_user_departments (tenant_key, department_id, user_id);

-- Preserve any assignments made during the initial rollout.
insert into public.tenant_user_departments (tenant_key, user_id, department_id)
select d.tenant_key, member.user_id, member.department_id
from public.tenant_department_members member
join public.tenant_departments d on d.id = member.department_id
on conflict do nothing;

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
    lower(trim(p_tenant_key)), assignment.user_id, routing.department_id, lower(trim(p_domain_key)), p_source_table,
    p_source_report_id, nullif(trim(p_report_number), ''), p_title, nullif(trim(p_body), '')
  from public.tenant_domain_departments routing
  join public.tenant_departments department
    on department.id = routing.department_id
   and department.tenant_key = lower(trim(p_tenant_key))
   and department.active = true
  join public.tenant_user_departments assignment
    on assignment.tenant_key = department.tenant_key
   and assignment.department_id = department.id
  join public.tenant_user_roles role_row
    on role_row.tenant_key = assignment.tenant_key
   and role_row.user_id = assignment.user_id
   and role_row.status = 'active'
  where routing.tenant_key = lower(trim(p_tenant_key))
    and routing.domain_key = lower(trim(p_domain_key))
  on conflict (recipient_user_id, source_table, source_report_id) do nothing;
  get diagnostics v_recipient_count = row_count;

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

alter table public.tenant_user_departments enable row level security;
create policy tenant_user_departments_select_scoped on public.tenant_user_departments for select to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'users.access')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.access')
);
create policy tenant_user_departments_manage_scoped on public.tenant_user_departments for all to authenticated
using (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'users.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.edit')
)
with check (
  public.is_platform_admin(auth.uid())
  or public.has_platform_permission(auth.uid(), 'users.edit')
  or public.has_tenant_permission(auth.uid(), tenant_key, 'users.edit')
);
grant select, insert, update, delete on public.tenant_user_departments to authenticated;

commit;
