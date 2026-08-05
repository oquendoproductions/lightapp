-- Push delivery is tenant-scoped by a resident's registered device token.
-- Include those same tenants in the owner's inbox scope so Push and in-app
-- notifications cannot disagree about whether a delivered communication exists.

begin;

create or replace function public.resident_notification_scope()
returns table (
  tenant_key text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select
      auth.uid() as user_id,
      lower(trim(coalesce(public.request_tenant_key(), ''))) as current_tenant
  )
  select distinct scoped.tenant_key
  from (
    select lower(trim(rti.tenant_key)) as tenant_key
    from public.resident_tenant_interests rti
    join viewer v
      on v.user_id is not null
     and rti.user_id = v.user_id

    union all

    select lower(trim(npt.tenant_key)) as tenant_key
    from public.native_push_tokens npt
    join viewer v
      on v.user_id is not null
     and npt.user_id = v.user_id
    where npt.enabled = true

    union all

    select v.current_tenant
    from viewer v
    where v.current_tenant <> ''
  ) scoped
  where scoped.tenant_key <> '';
$$;

grant execute on function public.resident_notification_scope() to anon, authenticated;

commit;
