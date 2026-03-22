# Week 1 Apply Order + Runbook

## Apply Order (Supabase SQL Editor)
1. `04-incident-events-migration.sql`
2. `06-incident-event-integrations.sql`
3. `07-incident-events-smoke-test.sql` (read-only/rollback test)

## What to capture for board evidence
- Screenshot of successful execution for #1 and #2
- Output rows from #3 timeline + snapshot queries
- One real incident sample (streetlight + pothole) showing state evolution

## Post-apply verification (production-safe)

### A) Objects exist
```sql
select tablename from pg_tables
where schemaname='public'
  and tablename in ('incident_events','incident_state_current');
```

### B) Trigger coverage
```sql
select event_object_table as table_name, trigger_name
from information_schema.triggers
where trigger_schema='public'
  and trigger_name in (
    'trg_incident_events_apply_snapshot',
    'trg_reports_incident_events',
    'trg_pothole_reports_incident_events',
    'trg_light_actions_incident_events'
  )
order by table_name, trigger_name;
```

### C) Recent events rolling in
```sql
select domain, incident_id, previous_state, new_state, source, changed_at
from public.incident_events
order by changed_at desc
limit 50;
```

### D) Snapshot health
```sql
select domain, state, count(*)
from public.incident_state_current
group by domain, state
order by domain, state;
```

## Rollback (only if required)
- Run `05-incident-events-rollback.sql`

## Deployment discipline
- Do not merge new domain UI/features during Week 1.
- Only merge lifecycle/event logging items.
