begin;

update public.tenants
set resident_portal_enabled = true
where tenant_key = 'ashtabulacity';

do $$
declare
  v_alert_id bigint;
  v_event_id bigint;
begin
  if exists (
    select 1
    from public.tenants
    where tenant_key = 'ashtabulacity'
  ) then
    update public.notification_topics
    set
      active = true,
      updated_at = now()
    where tenant_key = 'ashtabulacity'
      and topic_key in ('general_updates', 'community_events');

    select id
    into v_alert_id
    from public.municipality_alerts
    where tenant_key = 'ashtabulacity'
      and title = 'Streetlight Reporting Helper Is Live'
    order by id desc
    limit 1;

    if v_alert_id is null then
      insert into public.municipality_alerts (
        tenant_key,
        topic_key,
        title,
        summary,
        body,
        severity,
        location_name,
        location_address,
        cta_label,
        cta_url,
        pinned,
        delivery_channels,
        status,
        starts_at,
        published_at
      )
      values (
        'ashtabulacity',
        'general_updates',
        'Streetlight Reporting Helper Is Live',
        'Residents can now view city notices and report streetlight issues from one place.',
        'The Ashtabula resident updates homepage is now live. Use this page to check city notices, review upcoming public items, and jump into the streetlight outage reporting map when you need to submit a report.',
        'info',
        'City of Ashtabula',
        '4250 Lake Ave, Ashtabula, OH 44004',
        'Report a streetlight issue',
        '/report',
        true,
        array['in_app']::text[],
        'published',
        timestamptz '2026-03-25 09:30:00-04',
        timestamptz '2026-03-25 09:30:00-04'
      )
      returning id into v_alert_id;
    else
      update public.municipality_alerts
      set
        topic_key = 'general_updates',
        summary = 'Residents can now view city notices and report streetlight issues from one place.',
        body = 'The Ashtabula resident updates homepage is now live. Use this page to check city notices, review upcoming public items, and jump into the streetlight outage reporting map when you need to submit a report.',
        severity = 'info',
        location_name = 'City of Ashtabula',
        location_address = '4250 Lake Ave, Ashtabula, OH 44004',
        cta_label = 'Report a streetlight issue',
        cta_url = '/report',
        pinned = true,
        delivery_channels = array['in_app']::text[],
        status = 'published',
        starts_at = timestamptz '2026-03-25 09:30:00-04',
        published_at = coalesce(published_at, timestamptz '2026-03-25 09:30:00-04'),
        updated_at = now()
      where id = v_alert_id;
    end if;

    select id
    into v_event_id
    from public.municipality_events
    where tenant_key = 'ashtabulacity'
      and title = 'Regular City Council Meeting'
      and starts_at = timestamptz '2026-04-06 19:00:00-04'
    order by id desc
    limit 1;

    if v_event_id is null then
      insert into public.municipality_events (
        tenant_key,
        topic_key,
        title,
        summary,
        body,
        location_name,
        location_address,
        cta_label,
        cta_url,
        all_day,
        delivery_channels,
        status,
        starts_at,
        ends_at,
        published_at
      )
      values (
        'ashtabulacity',
        'community_events',
        'Regular City Council Meeting',
        'Upcoming council meeting in Council Chambers.',
        'The next regular City Council meeting is scheduled for Monday, April 6, 2026, at 7:00 PM in Council Chambers next to the Municipal Building. Residents can attend in person or check the city council page for live stream details and related materials.',
        'Council Chambers',
        '4230 Lake Ave, Ashtabula, OH 44004',
        'View council information',
        'https://www.cityofashtabula.com/city-council',
        false,
        array['in_app']::text[],
        'published',
        timestamptz '2026-04-06 19:00:00-04',
        timestamptz '2026-04-06 21:00:00-04',
        timestamptz '2026-03-25 09:35:00-04'
      )
      returning id into v_event_id;
    else
      update public.municipality_events
      set
        topic_key = 'community_events',
        summary = 'Upcoming council meeting in Council Chambers.',
        body = 'The next regular City Council meeting is scheduled for Monday, April 6, 2026, at 7:00 PM in Council Chambers next to the Municipal Building. Residents can attend in person or check the city council page for live stream details and related materials.',
        location_name = 'Council Chambers',
        location_address = '4230 Lake Ave, Ashtabula, OH 44004',
        cta_label = 'View council information',
        cta_url = 'https://www.cityofashtabula.com/city-council',
        all_day = false,
        delivery_channels = array['in_app']::text[],
        status = 'published',
        starts_at = timestamptz '2026-04-06 19:00:00-04',
        ends_at = timestamptz '2026-04-06 21:00:00-04',
        published_at = coalesce(published_at, timestamptz '2026-03-25 09:35:00-04'),
        updated_at = now()
      where id = v_event_id;
    end if;
  end if;
end
$$;

commit;
