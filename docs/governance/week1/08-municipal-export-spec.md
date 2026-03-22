# Municipal Export Specification (Board Amendment)

## Summary Export (Operational Snapshot)
Filters:
- Domain
- Status
- Date range

Columns:
- Incident ID
- Domain
- Current State
- Last Updated
- Reopen Count
- Open/Closed flag

## Report Detail Export (Required)
Filters:
- Domain
- Date range
- Status
- Incident ID (optional)

Columns:
- Report ID
- Report Number
- Domain
- Incident ID (asset/cluster ID)
- Submission Timestamp
- Fix Timestamp (nullable)
- Time-to-close (computed, nullable)
- Current State
- Reporter Name (policy-gated)
- Reporter Email (policy-gated)
- Reporter Phone (policy-gated)
- Notes
- Source (user/admin/system)

## Policy Controls
- Contact fields must be permission-gated by role/policy.
- Exports should log audit metadata:
  - exported_by
  - exported_at
  - filters used

## Delivery
- CSV download from admin UI
- Optional API endpoint for scheduled municipal ingestion
