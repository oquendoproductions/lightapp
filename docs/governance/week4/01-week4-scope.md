# Week 4 Scope: Pilot Domain Lock (Potholes + Street Signs)

## Authorization Basis
- Active pilot domains:
  1. `potholes`
  2. `street_signs`
- `streetlights` remains in system as utility-owned signal layer.
- `streetlights` excluded from municipal pilot SLA/public accountability metrics.
- No additional domain expansion in Week 4.

## Objective
Add `street_signs` as a contract-native pilot domain without introducing a parallel lifecycle or export model.

## Contract Constraints
1. Lifecycle contract unchanged (`reported -> aggregated/confirmed -> fixed/reopened -> archived`).
2. Aggregation strategy for signs: `asset_based`.
3. Event logging via existing `incident_events` contract.
4. Export contract stays `v1`.
5. Metrics calculation spec unchanged.
6. Public/internal view separation preserved.

## Acceptance Criteria
1. `official_signs` schema available and policy-gated.
2. Sign reports generate `incident_events` in domain `street_signs`.
3. Sign incidents appear in export/metrics paths without schema drift.
4. Public metrics include `street_signs` and exclude `streetlights`.
