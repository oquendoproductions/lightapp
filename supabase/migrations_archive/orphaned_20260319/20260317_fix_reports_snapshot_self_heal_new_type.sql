-- Fix reports trigger compatibility: reports table no longer has NEW.type
-- Use NEW.report_type only.
create or replace function public.trg_reports_snapshot_self_heal()
returns trigger
language plpgsql
as $function$
declare
  v_type text := lower(trim(coalesce(new.report_type, '')));
  v_quality text := lower(trim(coalesce(new.report_quality, '')));
  v_light_id text := trim(coalesce(new.light_id::text, ''));
  v_domain public.incident_domain;
  v_exists boolean := false;
begin
  if v_quality='good' or v_type in ('working','reported_working','is_working') then
    return new;
  end if;

  if v_light_id='' then
    return new;
  end if;

  v_domain := public.map_incident_domain_from_report(v_light_id, null, v_type);

  select exists(
    select 1
    from public.incident_state_current s
    where s.domain = v_domain
      and s.incident_id = v_light_id
  ) into v_exists;

  if not v_exists then
    perform public.emit_incident_state_change(
      v_light_id,
      v_domain,
      'reported'::public.incident_state,
      new.reporter_user_id,
      'system'::public.incident_event_source,
      jsonb_build_object('source_table','reports','report_id',new.id,'self_heal',true),
      coalesce(new.created_at, now()),
      false
    );
  end if;

  return new;
end;
$function$;
