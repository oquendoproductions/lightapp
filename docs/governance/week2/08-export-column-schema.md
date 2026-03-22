# CityReport Week 2 Export Column Schema (Final)

## Scope
Applies to admin/internal export flows.
Week 3 freeze applies this document as pilot schema baseline `v1`.

## CSV Metadata Header (Required)
Each CSV output must begin with metadata comment lines before column headers:
1. `# export_schema_version: v1`
2. `# generated_at_utc: <ISO-8601 Z>`
3. `# window_start_utc: <ISO-8601 Z>`
4. `# window_end_utc: <ISO-8601 Z>`
5. `# domain: <domain|all>`

## Summary Export (`export_incident_summary_v1`)
Required columns:
1. `domain`
2. `incident_id`
3. `current_state`
4. `aggregation_id`
5. `is_chronic`
6. `reopen_count`
7. `first_reported_at`
8. `last_state_change_at`
9. `time_to_confirm_seconds`
10. `time_to_fix_seconds`
11. `reopen_rate_basis_count` (optional helper)
12. `exported_at` (client-side metadata)

## Detail Export (`export_incident_detail_v1`)
Required columns:
1. `domain`
2. `incident_id`
3. `report_number`
4. `asset_or_cluster_id` (light id / pothole cluster)
5. `current_state`
6. `state_changed_at`
7. `first_reported_at`
8. `fixed_at` (nullable)
9. `time_to_confirm_seconds`
10. `time_to_fix_seconds`
11. `reopen_count`
12. `is_chronic`
13. `notes`
14. `reporter_name` (policy-gated)
15. `reporter_email` (policy-gated)
16. `reporter_phone` (policy-gated)

## Export Audit Log
Every export must record:
- `export_kind` (summary/detail)
- `domain`
- `state`
- `from_date`
- `to_date`
- `filters` JSON
- `row_count`
- `exported_by`
- `exported_at`

## Policy Note
PII fields are internal-only and must remain blocked from any public summary endpoints.
