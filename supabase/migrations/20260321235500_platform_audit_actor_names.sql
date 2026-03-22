begin;

create or replace function public.platform_admin_audit_feed(
  p_tenant_key text,
  p_limit integer default 120
)
returns table (
  id bigint,
  tenant_key text,
  actor_user_id uuid,
  actor_name text,
  action text,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tenant_key text := nullif(trim(coalesce(p_tenant_key, '')), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 120), 500));
begin
  if not public.is_platform_admin(auth.uid()) then
    raise exception 'permission denied for platform_admin_audit_feed' using errcode = '42501';
  end if;

  return query
  select
    l.id,
    l.tenant_key,
    l.actor_user_id,
    coalesce(
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
      nullif(trim(coalesce(u.raw_user_meta_data ->> 'name', '')), ''),
      nullif(trim(coalesce(l.details ->> 'actor_name', '')), ''),
      nullif(trim(split_part(coalesce(u.email, ''), '@', 1)), ''),
      nullif(trim(split_part(coalesce(l.details ->> 'actor_email', ''), '@', 1)), '')
    ) as actor_name,
    l.action,
    l.entity_type,
    l.entity_id,
    l.details,
    l.created_at
  from public.tenant_audit_log l
  left join auth.users u
    on u.id = l.actor_user_id
  where (v_tenant_key is null or l.tenant_key = v_tenant_key)
  order by l.created_at desc
  limit v_limit;
end;
$$;

revoke all on function public.platform_admin_audit_feed(text, integer) from public;
grant execute on function public.platform_admin_audit_feed(text, integer) to authenticated;

commit;
