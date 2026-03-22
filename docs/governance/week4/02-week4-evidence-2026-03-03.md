# Week 4 Evidence (2026-03-03)

## 1) Street Sign Schema + Migration
Applied migration:
- `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/supabase/migrations/20260303043000_week4_street_signs_contract_native.sql`

Delivered objects:
- `incident_domain` enum now includes `street_signs`
- `public.official_signs` table
- RLS + policies for public read (active signs) and admin management

## 2) Aggregation Integration Proof
Updated domain mapping functions:
- `public.map_incident_domain_from_light_id(...)`
- `public.map_incident_domain_from_report(...)`

Smoke check (transactional):
- Inserted temporary `official_signs` row
- Inserted temporary `reports` row pointing to sign `id`
- Observed `incident_events.domain = street_signs`
- Rolled back test transaction

## 3) Dashboard Metrics for Signs
Smoke check (transactional):
- Inserted temporary sign report
- Queried `public.public_metrics_summary_v1`
- Observed `street_signs` domain row present
- Rolled back test transaction

## 4) Export Sample for Sign Domain
Smoke check (transactional):
- Temporary sign report surfaced in `public.export_incident_detail_v1`
- `domain = street_signs`, `incident_id = official_signs.id`
- Rolled back test transaction

## 5) Public Summary Behavior for Signs
`tenant_visibility_config` now enforces:
- `potholes = public`
- `street_signs = public`
- `streetlights = internal_only`

## 6) Streetlights Excluded from Pilot Metrics
Validation query on current persisted data:
- `public.public_metrics_summary_v1` returns no `streetlights` row.
- Streetlights remain accessible in system workflows but excluded from public pilot SLA summary.
