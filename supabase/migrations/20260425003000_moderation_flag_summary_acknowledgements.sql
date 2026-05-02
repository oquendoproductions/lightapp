begin;

create or replace function public.acknowledge_moderation_flag_summary(
  p_domain text,
  p_reason text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text := nullif(trim(coalesce(p_domain, '')), '');
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  ) then
    raise exception 'Admin access required';
  end if;

  if v_domain is null or v_reason is null then
    raise exception 'Missing moderation summary key';
  end if;

  if to_regclass('public.abuse_anomaly_flags') is null then
    raise exception 'abuse_anomaly_flags table is unavailable';
  end if;

  update public.abuse_anomaly_flags
     set status = 'reviewed',
         reviewed_at = coalesce(reviewed_at, now()),
         reviewed_by = coalesce(reviewed_by, auth.uid()),
         review_note = coalesce(v_note, review_note),
         updated_at = now()
   where domain = v_domain
     and reason = v_reason
     and status = 'open';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.acknowledge_moderation_flag_summary(text, text, text) from public;
grant execute on function public.acknowledge_moderation_flag_summary(text, text, text) to authenticated;

commit;
