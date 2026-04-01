begin;

alter table public.client_leads
  add column if not exists internal_notes text,
  add column if not exists follow_up_on date,
  add column if not exists last_follow_up_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_client_leads_status_created_at
  on public.client_leads (status, created_at desc);

drop trigger if exists trg_client_leads_updated_at on public.client_leads;
create trigger trg_client_leads_updated_at
before update on public.client_leads
for each row
execute function public.touch_platform_control_plane_updated_at();

grant select, update on table public.client_leads to authenticated;

drop policy if exists client_leads_platform_select on public.client_leads;
create policy client_leads_platform_select
  on public.client_leads
  for select
  to authenticated
  using (
    public.has_any_platform_role(auth.uid(), array['platform_owner', 'platform_staff'])
    or exists (
      select 1
      from public.admins a
      where a.user_id = auth.uid()
    )
  );

drop policy if exists client_leads_platform_update on public.client_leads;
create policy client_leads_platform_update
  on public.client_leads
  for update
  to authenticated
  using (
    public.has_any_platform_role(auth.uid(), array['platform_owner', 'platform_staff'])
    or exists (
      select 1
      from public.admins a
      where a.user_id = auth.uid()
    )
  )
  with check (
    public.has_any_platform_role(auth.uid(), array['platform_owner', 'platform_staff'])
    or exists (
      select 1
      from public.admins a
      where a.user_id = auth.uid()
    )
  );

commit;
