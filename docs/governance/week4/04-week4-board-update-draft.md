# 🏛 CityReport.io — Week 4 Governance Update (Draft)

Advisory Board,

Week 4 pilot-scope implementation has been completed under the authorized posture:

- Active pilot domains: `potholes`, `street_signs`
- Streetlights retained but treated as utility-owned/internal-only for pilot accountability

---

## 1) Street Signs Implemented as Contract-Native Domain

### Data model + lifecycle alignment
- `official_signs` is active and used as the asset table for sign incidents.
- Sign incidents run through the same lifecycle/event contract:
  - event log
  - snapshot/current-state model
  - reopen/chronic tracking

### Aggregation strategy
- `street_signs` uses `asset_based` aggregation (1 sign = 1 incident target).
- No custom lifecycle branch or ad hoc state model introduced.

---

## 2) Operational Flows Added (Pilot-grade)

### Admin sign mapping
- Mapping mode supports sign asset creation with sign-type selection at queue/popup level.
- Save/load persistence confirmed for `official_signs`.
- Existing sign deletion is supported in mapping mode with confirmation.

### Sign reporting flow (modeled after streetlights)
- Marker info window includes sign details and report action.
- Reporting modal includes:
  - issue-type dropdown
  - note field
  - submit/cancel flow
- Submitted sign reports appear in Open Reports and lifecycle pipeline.

### Admin sign incident controls
- `All Reports` action added for sign incidents.
- `Mark fixed/Re-open` added with same lifecycle semantics.
- Action hidden when sign has zero open reports (to avoid false operator action affordance).

---

## 3) Metrics + Export Integrity (Street Signs)

### Metrics evidence
- `incident_timeline_metrics_v1` and `internal_metrics_accountability_v1` both include street-sign incidents with:
  - state
  - report_count
  - reopen_count
  - chronic flag
  - recurrence ranking

### Export evidence
- `export_incident_summary_v1` and `export_incident_detail_v1` both include `street_signs` rows.
- Street-sign records include lifecycle and accountability columns (`current_state`, `reopen_count`, `is_chronic`, timestamps).

---

## 4) Pilot Separation Confirmed

### Tenant/domain visibility
- `potholes`: `public`
- `street_signs`: `public`
- `streetlights`: `internal_only`
- `power_outage`: `internal_only`
- `water_main`: `internal_only`

### Public metrics surface
- `public_metrics_view` currently surfaces pilot domains only (`potholes`, `street_signs`).
- `streetlights` does not appear in public metrics output.

---

## 5) Week 4 Numbering Hardening

- DB trigger `set_reports_report_number()` updated:
  - `SSR` for `street_signs`
  - `SLR` for `streetlights`
  - `POR` for `power_outage`
  - `WMR` for `water_main`
- New sequence added: `report_num_ssr_seq`.

Note:
- A pre-migration street-sign report remains `SLR...` historically.
- New street-sign reports now generate/persist as `SSR...`.

---

## 6) Validation Status

### Completed
- Street-sign schema + mapping workflow
- Aggregation integration
- Sign dashboard metric path
- Sign export path
- Public/internal pilot separation behavior
- Streetlight exclusion from public pilot metrics
- DB-native SSR numbering validated with:
  - `SSR0000001`
  - `SSR0000002`
- Full sign lifecycle sequence proof completed:
  - `reported -> confirmed -> fixed -> reopened`
  - `reopen_count = 1` reflected in snapshot/metrics

---

## Founder Position

CityReport remains positioned as an Accountability Engine, now validated across:
- Proximity-based domain (`potholes`)
- Asset-based domain (`street_signs`)

No additional domain expansion performed.
