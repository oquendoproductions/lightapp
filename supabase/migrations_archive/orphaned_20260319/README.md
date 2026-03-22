# Orphaned Migrations (Archived on 2026-03-19)

These SQL files were present in `supabase/migrations/` but were **not** recorded in
production migration history (`supabase_migrations.schema_migrations`) and caused
non-deterministic `db push` behavior.

They were moved out of the active migration chain on purpose.

## Archived Files

- `20260303033500_week3_hardening_abuse_and_metrics_views.sql`
- `20260303043000_week4_street_signs_contract_native.sql`
- `20260303113000_week4_ssr_report_numbers.sql`
- `20260308121500_fix_incident_events_rls_writer.sql`
- `20260308153000_week4_water_drain_compliance.sql`
- `20260317_fix_reports_snapshot_self_heal_new_type.sql`

## Active Migration Baseline

Active migrations now align with production-recorded versions plus the new staging
hardening migration:

- up to `20260318102000`
- plus `20260319031500_realtime_tenant_sync.sql`

## Restore Policy

Do not move these files back into `supabase/migrations/` unless:

1. the team explicitly decides to replay them in all environments, and
2. migration history is updated consistently across staging and production.
