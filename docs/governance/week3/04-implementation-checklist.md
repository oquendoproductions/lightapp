# Week 3 Implementation Checklist

## Mandated Hardening
- [ ] Eliminate known console `403` noise paths
- [ ] Reconcile stale Open Reports for deleted assets
- [ ] Freeze export schema v1 and embed CSV metadata `export_schema_version: v1`
- [ ] Publish deterministic metric spec (`/docs/governance/metrics-calculation-spec.md`)
- [ ] Add abuse telemetry table `public.abuse_events` and log enforcement attempts
- [ ] Enforce `public_metrics_view` / `internal_metrics_view` separation + RLS review

## Existing Week 3 Abuse Foundation (Completed)
- [x] Create `public.abuse_anomaly_flags`
- [x] Add admin-only RLS policies (select/update)
- [x] Add `public.raise_abuse_flag(...)` definer function
- [x] Add `public.trg_abuse_rate_events_anomaly()` trigger function
- [x] Attach trigger to `public.abuse_rate_events`
- [x] Add `public.metrics_open_abuse_flags_v1` view
- [x] Run smoke test SQL and verify outputs

## Week 3 Review Packet Requirements
- [ ] Confirmation that `403` noise is eliminated
- [ ] Deleted-asset reconciliation logic explanation
- [ ] Metric formula documentation summary
- [ ] Abuse telemetry schema summary
- [ ] Public/internal data-path diagram
- [ ] Export schema v1 freeze confirmation
