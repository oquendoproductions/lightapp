# Week 2 Implementation Checklist

## Database
- [x] Apply migration: `02-export-metrics-migration.sql`
- [x] Run smoke test: `03-export-metrics-smoke-test.sql`
- [x] Capture evidence screenshots/outputs

## App Integration (Next)
- [x] Admin Open Reports:
  - [x] Add start/end date filters to query path
  - [x] Ensure search term is applied within selected date range
- [x] Admin Export UI:
  - [x] Add `Export Summary CSV`
  - [x] Add `Export Detail CSV`
  - [x] Call `public.log_export_action(...)` after each export
- [x] Admin Metrics UI:
  - [x] Incident counts by state/domain
  - [x] Avg/p50/p90 time-to-close
  - [x] Top recurring incidents data path (table visibility intentionally simplified in current modal)

## Validation
- [x] Export summary rows match Open Reports filter context
- [x] Export detail rows include report number + incident id + current state
- [x] Export audit log records user, filters, row count
- [x] No regression to report submission flows

## Board Week 2 Submission Artifacts
- [x] Dashboard structural wireframe/spec
  - `/Users/oquendoproductions/Documents/New project/docs/governance/week2/07-dashboard-structure-spec.md`
- [x] Export column schema (final)
  - `/Users/oquendoproductions/Documents/New project/docs/governance/week2/08-export-column-schema.md`
- [x] Abuse thresholds and control logic
  - `/Users/oquendoproductions/Documents/New project/docs/governance/week2/09-abuse-thresholds-and-controls.md`
- [x] Public metric formulas + timezone/window rules
  - `/Users/oquendoproductions/Documents/New project/docs/governance/week2/10-public-metric-calculation-rules.md`
- [x] Tenant-level visibility control spec
  - `/Users/oquendoproductions/Documents/New project/docs/governance/week2/11-tenant-visibility-control-spec.md`
