# Week 3 Scope: Governance Hardening (Board Approved)

## Objective
Harden trust-critical operational behavior for pilot-readiness under the Accountability Engine model (Model C: Public Summary + Internal Detailed).

## In Scope
1. Eliminate non-actionable `403` console noise paths.
2. Reconcile stale Open Reports tied to deleted assets.
3. Freeze export schema (`v1`) and add CSV metadata version marker.
4. Lock deterministic metric rules in `/docs/governance/metrics-calculation-spec.md`.
5. Add abuse telemetry persistence (`abuse_events`) and wire logging on enforcement paths.
6. Enforce public/internal metrics separation (`public_metrics_view`, `internal_metrics_view`) with permission review.

## Constraints (Non-Negotiable)
1. No new domains.
2. No new report types.
3. No UX flourish or feature-surface expansion.

## Acceptance Criteria
1. Console is clean of known `tenant_visibility_config` 403 noise in expected admin/user flows.
2. Deleted assets do not leave ghost/stale records in Open Reports.
3. Export headers are stable and versioned with `export_schema_version: v1`.
4. Metric formulas, timezone policy, and boundary semantics are documented and implemented consistently.
5. Abuse attempts are logged in `abuse_events` with enough fields for audit/monitoring.
6. Public/internal data paths are physically and permission-separated with no internal-only leakage.
