begin;

create table if not exists public.utility_report_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  incident_id text not null,
  reported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, incident_id)
);

create index if not exists utility_report_status_user_updated_idx
  on public.utility_report_status (user_id, updated_at desc);

alter table public.utility_report_status enable row level security;
alter table public.utility_report_status force row level security;

revoke all on public.utility_report_status from public, anon;
grant select, insert, update, delete on public.utility_report_status to authenticated;

drop policy if exists utility_report_status_owner_select on public.utility_report_status;
create policy utility_report_status_owner_select
on public.utility_report_status
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists utility_report_status_owner_insert on public.utility_report_status;
create policy utility_report_status_owner_insert
on public.utility_report_status
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists utility_report_status_owner_update on public.utility_report_status;
create policy utility_report_status_owner_update
on public.utility_report_status
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists utility_report_status_owner_delete on public.utility_report_status;
create policy utility_report_status_owner_delete
on public.utility_report_status
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.touch_utility_report_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_utility_report_status_updated_at on public.utility_report_status;
create trigger trg_touch_utility_report_status_updated_at
before update on public.utility_report_status
for each row
execute function public.touch_utility_report_status_updated_at();

commit;
