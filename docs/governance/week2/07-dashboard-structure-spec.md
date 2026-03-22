# CityReport Week 2 Dashboard Structure Spec (Model C)

## Purpose
Define the structural dashboard contract for:
1. Public Summary (aggregated, read-only, non-sensitive)
2. Internal Detailed (admin/municipal operations)

## Layer Separation (Hard Rule)
- Public layer reads **derived public views only**.
- Internal layer may read incident/event detail views.
- Public layer must not query `public.incident_events` directly.

## View Contracts

### Public Summary Views
- `public.public_metrics_summary_v1` (new/derived)
  - open_count
  - closed_count
  - avg_time_to_fix_seconds_30d
  - reopen_rate_pct_30d
  - domain_totals_json
  - last_updated_at
- `public.public_metrics_trend_v1` (new/derived)
  - day
  - domain
  - opened_count
  - closed_count

### Internal Metrics Views
- Existing:
  - `public.metrics_incident_state_counts_v1`
  - `public.metrics_time_to_close_v1`
  - `public.metrics_top_recurring_incidents_v1`
- Extended target:
  - `public.internal_metrics_accountability_v1`
    - time_to_confirm_seconds
    - time_to_fix_seconds
    - reopen_count
    - is_chronic
    - aggregation_id
    - domain
    - last_state_change_at

## UI Wireframe (Text)

### Public Summary Panel
1. Time window selector: 30d / 90d
2. Open vs Closed Trend chart
3. Avg Time to Fix (rolling)
4. Reopen Rate %
5. Domain Totals
6. Last Updated timestamp

### Internal Detailed Panel
1. Filters: domain, state, date range
2. KPI cards:
   - Avg time to confirm
   - Avg time to fix
   - Reopen rate
   - Chronic incident count
3. Top recurring aggregations table
4. Incident timeline drilldown (event sequence)

## Security/Permission Notes
- Public summary endpoints expose no reporter PII.
- Internal detail endpoints remain admin-gated by RLS/policy.

