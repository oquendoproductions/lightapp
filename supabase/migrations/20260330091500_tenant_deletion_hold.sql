begin;

alter table if exists public.tenants
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz,
  add column if not exists deletion_requested_by uuid,
  add column if not exists active_before_deletion boolean;

create index if not exists tenants_deletion_schedule_idx
  on public.tenants (deletion_scheduled_for)
  where deletion_scheduled_for is not null;

commit;
