# Week 2 Apply Order + Runbook

## Apply Order (SQL Editor or CLI)
1. `/Users/oquendoproductions/Documents/New project/docs/governance/week2/02-export-metrics-migration.sql`
2. `/Users/oquendoproductions/Documents/New project/docs/governance/week2/03-export-metrics-smoke-test.sql`

## Evidence to Capture
1. Successful migration execution output.
2. Rows from:
   - `public.export_incident_summary_v1`
   - `public.export_incident_detail_v1`
   - `public.metrics_incident_state_counts_v1`
   - `public.metrics_time_to_close_v1`
3. One `public.export_audit_log` row inserted via `public.log_export_action(...)`.

## Production-safe verification queries

### A) Views present
```sql
select table_name
from information_schema.views
where table_schema='public'
  and table_name in (
    'incident_status_flags',
    'incident_first_last_timestamps',
    'export_incident_summary_v1',
    'export_streetlight_detail_v1',
    'export_pothole_detail_v1',
    'export_incident_detail_v1',
    'metrics_incident_state_counts_v1',
    'metrics_time_to_close_v1',
    'metrics_top_recurring_incidents_v1'
  )
order by table_name;
```

### B) Export audit table + policies
```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname='public'
  and tablename='export_audit_log';

select policyname, roles, cmd
from pg_policies
where schemaname='public'
  and tablename='export_audit_log'
order by cmd, policyname;
```

### C) Function present
```sql
select p.proname, n.nspname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public'
  and p.proname='log_export_action';
```

## Notes
1. This step is backend foundation only (no UI delivery yet).
2. Contact fields in detail export are still policy-governed; do not expose to non-admin roles.
