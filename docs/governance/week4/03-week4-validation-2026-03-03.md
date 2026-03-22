# Week 4 Validation Evidence (2026-03-03)

## Scope
- Pilot domains: `potholes`, `street_signs`
- Utility-owned domain retained but excluded from pilot accountability: `streetlights`

## 1) Metrics Validation (Street Signs)

### Data source checks
- `incident_timeline_metrics_v1` (domain = `street_signs`)
  - `total_incidents`: 1
  - `fixed_incidents`: 0
  - `non_fixed_incidents`: 1
  - `reopened_incidents`: 1
  - `chronic_incidents`: 0
- `internal_metrics_accountability_v1` (domain = `street_signs`)
  - Incident present with:
    - `report_count = 2`
    - `reopen_count = 1`
    - `is_chronic = false`
    - `recurrence_rank = 1`

### Note on `internal_metrics_view`
- `internal_metrics_view` returned 0 rows in direct SQL context.
- View definition is auth-scoped:
  - `where exists (select 1 from admins where user_id = auth.uid())`
- This is expected in direct DB sessions without Supabase Auth JWT context.

## 2) Export Validation (Street Signs)

### `export_incident_detail_v1`
- Confirmed street-sign detail rows are present.
- Sample row:
  - `domain = street_signs`
  - `incident_id = 39441ee6-9c34-45d4-9efd-5f68fb3b3d2c`
  - `current_state = reported`
  - `reopen_count = 0`
  - `is_chronic = false`

### `export_incident_summary_v1`
- Confirmed street-sign summary rows are present with expected lifecycle fields:
  - `current_state`
  - `reopen_count`
  - `is_chronic`
  - `first_reported_at`
  - `first_fixed_at`

## 3) Pilot Separation Validation

### `tenant_visibility_config`
- `potholes = public`
- `street_signs = public`
- `streetlights = internal_only`
- `power_outage = internal_only`
- `water_main = internal_only`

### `public_metrics_view`
- Only public pilot domains currently appear:
  - `potholes`
  - `street_signs`
- `streetlights` does not appear in public metrics output.

## 4) Report Numbering Check

### DB rule update applied
- Migration applied: `20260303113000_week4_ssr_report_numbers.sql`
- `set_reports_report_number()` now assigns:
  - `SSR` for `street_signs`
  - `SLR` for `streetlights`
  - `POR` for `power_outage`
  - `WMR` for `water_main`

### Current data note
- Existing pre-fix row from earlier remains historical.
- New street-sign reports are now persisted as `SSR...`:
  - `SSR0000001`
  - `SSR0000002`

## 5) UI/Workflow State (local app)
- Street-sign mapping:
  - queue -> type select -> save -> persist confirmed
- Street-sign reporting:
  - marker info window -> issue dropdown + note -> submit confirmed
- Street-sign admin actions:
  - `All Reports` confirmed
  - `Mark fixed/Re-open` present only when open count > 0
  - `Delete Sign` in mapping mode with confirmation confirmed
- Single-popup rule enforced across marker types/domains.

## 6) Lifecycle Validation Complete
- Sign incident (uuid `61f9adea-181e-41bd-95df-0de8d3a8676f`) verified end-to-end:
  - `reported` -> `confirmed` -> `fixed` -> `reopened`
- Event log confirms transitions and `changed_by` actor UUID present.
- Snapshot now shows:
  - `state = reopened`
  - `reopen_count = 1`
