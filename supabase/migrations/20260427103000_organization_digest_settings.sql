begin;

create table if not exists public.organization_digest_settings (
  tenant_key text primary key,
  config_status text not null default 'draft',
  digest_enabled boolean not null default false,
  primary_recipient_email text,
  cc_recipient_emails text,
  urgent_recipient_email text,
  digest_frequency text not null default 'daily_weekdays',
  digest_time_local text not null default '07:00',
  digest_timezone text not null default 'America/New_York',
  include_weekends boolean not null default false,
  include_closed_reports boolean not null default false,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_digest_settings_status_check
    check (config_status in ('draft', 'ready', 'paused')),
  constraint organization_digest_settings_frequency_check
    check (digest_frequency in ('daily_weekdays', 'daily_all_days'))
);

create or replace function public.set_organization_digest_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_digest_settings_set_updated_at on public.organization_digest_settings;
create trigger organization_digest_settings_set_updated_at
before update on public.organization_digest_settings
for each row
execute function public.set_organization_digest_settings_updated_at();

alter table public.organization_digest_settings enable row level security;

grant select, insert, update on public.organization_digest_settings to anon, authenticated;

drop policy if exists organization_digest_settings_select_scoped on public.organization_digest_settings;
create policy organization_digest_settings_select_scoped
on public.organization_digest_settings
for select
to anon, authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists organization_digest_settings_insert_scoped on public.organization_digest_settings;
create policy organization_digest_settings_insert_scoped
on public.organization_digest_settings
for insert
to authenticated
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists organization_digest_settings_update_scoped on public.organization_digest_settings;
create policy organization_digest_settings_update_scoped
on public.organization_digest_settings
for update
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
)
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

commit;
