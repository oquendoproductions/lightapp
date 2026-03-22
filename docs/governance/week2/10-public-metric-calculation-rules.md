# CityReport Week 2 Public Metric Calculation Rules

## Purpose
Prevent inconsistency in politically visible metrics by locking formulas, windows, and timezone.

## Timezone Standard
- Storage: UTC
- Public dashboard display: tenant-local timezone (configurable)
- Default tenant timezone: `America/New_York`

## Window Definitions
- Rolling 30 days: `now() - interval '30 days'` to `now()`
- Rolling 90 days: `now() - interval '90 days'` to `now()`
- Daily trend bins: tenant-local calendar day boundaries

## Metric Formulas

### 1) Open vs Closed Trend
- `opened_count(day)` = incidents whose first event timestamp falls on day
- `closed_count(day)` = incidents with transition to `fixed` (or `archived`) on day

### 2) Avg Time to Fix (Rolling)
- Population: incidents with valid `first_reported_at` and `fixed_at` in selected window
- Per incident value: `fixed_at - first_reported_at` (seconds)
- Metric: arithmetic mean of per-incident values

### 3) Reopen Rate %
- Numerator: incidents with `reopen_count > 0` in selected window
- Denominator: incidents that reached `fixed` at least once in selected window
- Formula: `(numerator / denominator) * 100`

### 4) Domain Totals
- Count grouped by domain from incident snapshot state within selected window context.

### 5) Last Updated
- Max timestamp from source metric view refresh inputs (typically latest relevant event timestamp).

## Inclusion/Exclusion Rules
- Include only canonical domains enabled for public summary.
- Exclude incidents flagged internal-only by tenant domain visibility config.
- Exclude test/smoke incidents where metadata marks synthetic input.

## Rounding and Display
- Durations displayed in:
  - hours (1 decimal) when >= 1 hour
  - minutes (integer) when < 1 hour
- Percentages displayed to 1 decimal place.

