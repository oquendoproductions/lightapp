-- Week 2 Smoke Test: Export + Metrics
-- Run after 02-export-metrics-migration.sql

begin;

-- 1) Object existence checks
select
  'export_audit_log_exists' as check_name,
  exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='export_audit_log'
  ) as ok;

select
  'summary_view_exists' as check_name,
  exists (
    select 1 from information_schema.views
    where table_schema='public' and table_name='export_incident_summary_v1'
  ) as ok;

select
  'detail_view_exists' as check_name,
  exists (
    select 1 from information_schema.views
    where table_schema='public' and table_name='export_incident_detail_v1'
  ) as ok;

-- 2) Sample summary rows
select *
from public.export_incident_summary_v1
order by last_changed_at desc
limit 20;

-- 3) Sample detail rows (current month)
select
  report_number,
  domain,
  incident_id,
  submission_timestamp,
  current_state,
  time_to_close_seconds
from public.export_incident_detail_v1
where submission_timestamp >= date_trunc('month', now())
order by submission_timestamp desc
limit 50;

-- 4) KPI views
select * from public.metrics_incident_state_counts_v1;

select * from public.metrics_time_to_close_v1;

select * from public.metrics_top_recurring_incidents_v1 limit 20;

-- 5) Export audit insert test (admin session only)
-- If this fails due to RLS, run as admin-authenticated context.
select public.log_export_action(
  p_export_kind := 'summary',
  p_domain := 'streetlights',
  p_state := null,
  p_from_date := current_date - 30,
  p_to_date := current_date,
  p_incident_id := null,
  p_filters := jsonb_build_object('test', true, 'source', 'week2_smoke'),
  p_row_count := 10
) as export_audit_id;

select *
from public.export_audit_log
order by exported_at desc, id desc
limit 10;

rollback;
