# CityReport Metrics Calculation Spec (Week 3 Freeze)

## Status
Drafted for Week 3 governance hardening. Intended to be treated as pilot baseline `v1`.

## Purpose
Lock deterministic metric behavior across dashboard and export surfaces so identical filters return identical outcomes.

## Canonical Time Standard
1. Storage timezone: UTC (`timestamptz`).
2. Calculation timezone: UTC for all backend filtering and aggregation.
3. Display timezone: tenant-local conversion is presentation-only and must not alter query windows.

## Date Window Semantics
All range filters are normalized as half-open intervals:
- `from_date` is inclusive (`>= from_date 00:00:00 UTC`).
- `to_date` is exclusive (`< to_date + 1 day at 00:00:00 UTC`).

Example:
- Input `from_date=2026-03-01`, `to_date=2026-03-31`
- Effective window: `[2026-03-01T00:00:00Z, 2026-04-01T00:00:00Z)`

## Incident Lifecycle Timestamp Rules
1. `first_reported_at`: timestamp of first valid intake event for incident.
2. `confirmed_at`: first transition to `confirmed`.
3. `fixed_at`: first transition to `fixed` after latest open cycle.
4. `archived_at`: archival terminal marker, excluded from operational time-to-close unless explicitly selected in archival analytics.

## Metric Definitions (v1)

### 1) Incident State Counts
- Source: current-state snapshot table/view.
- Output: counts grouped by `domain` and `current_state` within selected window/domain filters.

### 2) Time-to-Close Seconds
- Population:
  - Include incidents with non-null `first_reported_at`.
  - Include incidents with non-null `fixed_at`.
  - Exclude synthetic/test incidents.
  - Exclude archived anomalies unless a dedicated archival report is requested.
- Formula per incident:
  - `time_to_close_seconds = extract(epoch from (fixed_at - first_reported_at))`
- Aggregate:
  - `avg_time_to_close_seconds = avg(time_to_close_seconds)`
  - `p50_time_to_close_seconds` and `p90_time_to_close_seconds` optional but computed from same population.

### 3) Reopen Count
- `reopen_count` is the number of transitions from a terminal fixed state back to an active open state.

### 4) Reopen Rate
- Numerator: incidents with `reopen_count > 0` in the selected window.
- Denominator: incidents that reached `fixed` at least once in the selected window.
- Formula:
  - `reopen_rate_pct = (numerator / nullif(denominator, 0)) * 100`

### 5) Chronic Incident Classification
- Week 3 numeric freeze:
  - `is_chronic = (reopen_count >= 2 within trailing 90 days)`

## Export Determinism Rules
1. Export queries must use the same SQL predicate logic as dashboard metrics for shared definitions.
2. All exports include UTC timestamps in raw columns.
3. CSV metadata must include:
   - `export_schema_version: v1`
   - `generated_at_utc: <ISO-8601 Z timestamp>`
   - `window_start_utc`
   - `window_end_utc`

## Versioning + Change Control
1. Any formula/window change requires a new schema/version label (`v2+`).
2. Backward compatibility must be preserved for municipal pilot datasets under `v1`.
