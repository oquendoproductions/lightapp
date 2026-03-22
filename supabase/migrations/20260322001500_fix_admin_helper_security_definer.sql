begin;

create or replace function public.is_platform_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admins a
    where a.user_id = uid
  );
$$;

create or replace function public.is_tenant_admin(uid uuid, tenant text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_platform_admin(uid)
    or exists (
      select 1
      from public.tenant_admins ta
      where ta.user_id = uid
        and ta.tenant_key = coalesce(nullif(trim(tenant), ''), public.request_tenant_key())
    );
$$;

commit;
