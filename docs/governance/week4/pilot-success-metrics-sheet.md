# Pilot Success Metrics Sheet

## Primary Metrics
- `avg_time_to_fix_hours`
  - Definition: average elapsed time from first report to first fixed state.
- `reopen_rate_percent`
  - Definition: percent of fixed incidents that transition to reopened.
- `chronic_incident_count`
  - Definition: incidents with `reopen_count >= 2`.
- `open_incident_count`
  - Definition: incidents currently in non-closed lifecycle states.

## Source Metrics (Internal)
- `citizen_report_count`
- `municipal_staff_report_count`
- `system_report_count`
- `source_mix_percent` by domain

## Aggregation Efficiency Metrics
- `reports_per_incident_ratio`
  - Higher ratio indicates stronger signal compression.
- `cluster_recurrence_count`
  - Repeat incidents at same proximity cluster.

## Operational Review Cadence
- Weekly:
  - Review top recurring incidents
  - Review chronic list
  - Review reopened incidents and notes
- End of pilot:
  - Compare baseline vs pilot period
  - Prepare recommendation for expansion or refinement

## Decision Thresholds (Initial)
- Avg time-to-fix improves by >= 15%
- Reopen rate is stable or declining
- Chronic list is actionable and used in weekly ops review
