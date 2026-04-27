begin;

create table if not exists public.organization_digest_runs (
  id bigint generated always as identity primary key,
  tenant_key text not null references public.tenants(tenant_key) on delete cascade,
  digest_local_date date not null,
  digest_timezone text not null,
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  recipient_email text,
  cc_recipient_emails text,
  urgent_recipient_email text,
  status text not null default 'processing',
  item_count integer not null default 0,
  domain_counts jsonb not null default '{}'::jsonb,
  provider text not null default 'resend',
  provider_message_id text,
  error_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint organization_digest_runs_status_check
    check (status in ('processing', 'sent', 'failed', 'skipped')),
  constraint organization_digest_runs_unique_day
    unique (tenant_key, digest_local_date)
);

create index if not exists organization_digest_runs_tenant_created_idx
  on public.organization_digest_runs (tenant_key, created_at desc);

create index if not exists organization_digest_runs_status_created_idx
  on public.organization_digest_runs (status, created_at desc);

create or replace function public.set_organization_digest_runs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists organization_digest_runs_set_updated_at on public.organization_digest_runs;
create trigger organization_digest_runs_set_updated_at
before update on public.organization_digest_runs
for each row
execute function public.set_organization_digest_runs_updated_at();

alter table public.organization_digest_runs enable row level security;

grant select on public.organization_digest_runs to authenticated;
grant insert, update on public.organization_digest_runs to authenticated;

drop policy if exists organization_digest_runs_select_scoped on public.organization_digest_runs;
create policy organization_digest_runs_select_scoped
on public.organization_digest_runs
for select
to authenticated
using (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists organization_digest_runs_insert_scoped on public.organization_digest_runs;
create policy organization_digest_runs_insert_scoped
on public.organization_digest_runs
for insert
to authenticated
with check (
  tenant_key = public.request_tenant_key()
  and public.can_manage_tenant_communications(tenant_key)
);

drop policy if exists organization_digest_runs_update_scoped on public.organization_digest_runs;
create policy organization_digest_runs_update_scoped
on public.organization_digest_runs
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

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if not exists (
    select 1
    from cron.job
    where jobname = 'cityreport-send-report-digests'
  ) then
    perform cron.schedule(
      'cityreport-send-report-digests',
      '*/15 * * * *',
      $job$
        select net.http_post(
          url := 'https://gjainmoiudfjsmhhvtiz.supabase.co/functions/v1/send-report-digests',
          headers := '{"Content-Type":"application/json"}'::jsonb,
          body := '{"source":"pg_cron"}'::jsonb
        );
      $job$
    );
  end if;
end
$$;

commit;
