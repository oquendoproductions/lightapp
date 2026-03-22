# CityReport Lifecycle Specification v1.0

## Purpose
Define one canonical incident lifecycle that all domains must conform to.

Companion contract:
- `12-aggregation-strategy-contract.md`

## Canonical States
1. `reported`
2. `aggregated`
3. `confirmed`
4. `in_progress` (optional per domain)
5. `fixed`
6. `reopened`
7. `archived`

## State Definitions
- `reported`: First valid report received for an incident candidate.
- `aggregated`: Additional reports merged into an existing incident cluster/asset.
- `confirmed`: Incident has crossed domain-specific confirmation threshold or admin confirmation.
- `in_progress`: City/utility work acknowledged or scheduled.
- `fixed`: Issue marked resolved (admin/system integration action).
- `reopened`: New valid evidence after `fixed` indicates issue persists/returned.
- `archived`: Incident closed from active operations view (retention preserved).

## Required Transition Rules
Allowed transitions:
- `reported -> aggregated`
- `reported -> confirmed`
- `aggregated -> confirmed`
- `confirmed -> in_progress`
- `confirmed -> fixed`
- `in_progress -> fixed`
- `fixed -> reopened`
- `reopened -> confirmed`
- `fixed -> archived`
- `reopened -> archived`

Disallowed:
- Any direct transition not listed above.

## Domain Conformance (Week 1)
### Streetlights
- Aggregation strategy: `asset-based`
- `reported`: first outage-type report since last fix
- `aggregated`: second+ report for same official light
- `confirmed`: threshold met (policy currently severity-based)
- `in_progress`: optional (not yet active)
- `fixed`: admin mark fixed / authorized operational action
- `reopened`: post-fix outage report(s)
- `archived`: optional retention state (not yet active in UI)

### Potholes
- Aggregation strategy: `proximity-based`
- `reported`: first report creating/attaching to pothole cluster
- `aggregated`: additional report in same cluster
- `confirmed`: threshold met or admin confirm
- `in_progress`: optional (not yet active)
- `fixed`: admin mark fixed
- `reopened`: post-fix report in same cluster
- `archived`: optional retention state

### Power Outage (spec only, not public)
- Aggregation strategy: `area-based`
- State contract: same canonical states

### Water Main (spec only, not public)
- Aggregation strategy: `severity-based` (or area-based fallback)
- State contract: same canonical states

## Policy Outputs Required by UI
Each incident must resolve to:
- `current_state`
- `last_state_change_at`
- `reopen_count`
- `time_to_close_seconds` (nullable until fixed)

## Acceptance Criteria
- Every active incident has one canonical state.
- State transitions validate against allowed transition list.
- No domain bypasses canonical states.
- Open Reports derives status from canonical state, not ad hoc rules.
