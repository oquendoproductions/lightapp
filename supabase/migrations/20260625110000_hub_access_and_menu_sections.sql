begin;

alter table public.organization_menu_links
  add column if not exists section_label text;

update public.organization_menu_links
set section_label = 'General'
where coalesce(btrim(section_label), '') = '';

alter table public.organization_menu_links
  alter column section_label set default 'General';

create index if not exists organization_menu_links_tenant_section_sort_idx
  on public.organization_menu_links (tenant_key, section_label, sort_order, created_at);

create or replace function public.can_access_tenant_hub(p_tenant text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    auth.uid() is not null
    and (
      public.is_platform_admin(auth.uid())
      or exists (
        select 1
        from public.tenant_user_roles tur
        where tur.user_id = auth.uid()
          and tur.tenant_key = coalesce(nullif(btrim(p_tenant), ''), public.request_tenant_key())
          and tur.status = 'active'
      )
    ),
    false
  );
$$;

grant execute on function public.can_access_tenant_hub(text) to anon, authenticated;

commit;
