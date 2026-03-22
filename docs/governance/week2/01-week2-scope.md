# Week 2 Scope: Export + Metrics Foundation

## Objective
Deliver municipal-ready data export and core admin metrics on top of the Week 1 lifecycle/event model.

## In Scope
1. Export audit logging (`who exported what, when`).
2. Standardized export views:
   - Operational summary.
   - Report detail (streetlights + potholes).
3. Core metrics views:
   - Incident counts by state/domain.
   - Time-to-close.
   - Reopen behavior.
   - Top recurring incidents.
4. SQL smoke tests + validation queries.

## Out of Scope
1. New public domain UI changes.
2. New marker/animation/cosmetic work.
3. Third-party integrations (Cityworks/Lucity/Cartegraph direct APIs).

## Dependencies
1. Week 1 migration applied:
   - `public.incident_events`
   - `public.incident_state_current`
2. Existing report tables:
   - `public.reports`
   - `public.pothole_reports`

## Acceptance Criteria
1. Admin can query summary and detail exports by domain/date/state.
2. Export actions can be logged with user + filter payload.
3. KPI queries return stable results from canonical lifecycle data.
4. No app write path is broken by these additions.
