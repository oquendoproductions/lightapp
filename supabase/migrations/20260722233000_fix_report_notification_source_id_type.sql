begin;

alter table public.tenant_report_notifications
  alter column source_report_id type text
  using source_report_id::text;

drop function if exists public.create_tenant_report_notifications(text, text, text, uuid, text, text, text);

create or replace function public.create_tenant_report_notifications(
  p_tenant_key text,
  p_domain_key text,
  p_source_table text,
  p_source_report_id text,
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
    nullif(trim(p_source_report_id), ''), nullif(trim(p_report_number), ''), p_title, nullif(trim(p_body), '')
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
    and nullif(trim(p_source_report_id), '') is not null
  on conflict (recipient_user_id, source_table, source_report_id) do nothing;
  get diagnostics v_recipient_count = row_count;

  if v_recipient_count = 0 then
    insert into public.tenant_report_notifications (
      tenant_key, recipient_user_id, department_id, domain_key, source_table,
      source_report_id, report_number, title, body
    )
    select
      lower(trim(p_tenant_key)), role_row.user_id, null, lower(trim(p_domain_key)), p_source_table,
      nullif(trim(p_source_report_id), ''), nullif(trim(p_report_number), ''), p_title, nullif(trim(p_body), '')
    from public.tenant_user_roles role_row
    where role_row.tenant_key = lower(trim(p_tenant_key))
      and role_row.role = 'tenant_admin'
      and role_row.status = 'active'
      and nullif(trim(p_source_report_id), '') is not null
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
    v_row ->> 'tenant_key',
    v_domain_key,
    tg_table_name,
    v_row ->> 'id',
    v_row ->> 'report_number',
    v_title,
    v_body
  );
  return new;
end;
$$;

grant execute on function public.create_tenant_report_notifications(text, text, text, text, text, text, text) to service_role;

commit;
