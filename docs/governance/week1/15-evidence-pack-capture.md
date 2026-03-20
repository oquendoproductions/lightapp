# Week 1 Evidence Pack Capture

Use this after lifecycle migrations are applied.

## 1) Baseline evidence queries executed
- File: `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/docs/governance/week1/13-incident-evidence-queries.sql`
- Run timestamp (UTC): `2026-03-02`
- Connection user: `codex_worker`

## 2) Required captures for board packet

### A) Snapshot distribution by domain/state
- Query output pasted: `YES`
- Notes:
  - `streetlights / reported = 2`
  - `streetlights / fixed = 1`
  - `potholes / reported = 8`
  - `potholes / fixed = 4`

### B) Streetlight timeline sample #1
- Incident ID: `9be7321d-84ae-4d1e-bbc9-227fd95ff677`
- Timeline rows pasted: `YES`
- Includes from/to state + actor/source + timestamp: `YES`
- Notes: shows repeated `fixed -> reopened -> confirmed -> fixed` cycles with `source=user/admin/system` and `changed_by` populated.

### C) Streetlight timeline sample #2
- Incident ID: `10439a2e-a999-42d2-a06e-575750c94680`
- Timeline rows pasted: `YES`
- Includes from/to state + actor/source + timestamp: `YES`
- Notes: initial lifecycle row present (`NULL -> reported`, `source=user`).

### D) Pothole timeline sample #1
- Incident ID: `pothole:b336834b-4f3e-4f0b-89c8-3626f937af3b`
- Timeline rows pasted: `YES`
- Includes from/to state + actor/source + timestamp: `YES`
- Notes: initial lifecycle row present (`NULL -> reported`, `source=user`).

## 3) Integrity checks

### A) Current snapshot matches latest event
- Result: `PASS`
- `mismatch_count = 0`

### B) Invalid transitions (post-guard)
- Result: `PASS`
- `invalid_transition_count = 0`

## 4) Export readiness validation
- File: `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/docs/governance/week1/14-export-query-templates.sql`
- Summary query returns rows: `YES` (`summary_rows = 44` for last 30 days)
- Detail query returns rows: `YES` (`detail_rows = 46` for last 30 days)
- Fields match contract (report #, incident, fixed_at, time_to_close, contacts, notes): `YES`

## 5) Migration presence verification
- Method used: `supabase migration list --workdir /Users/oquendoproductions/Desktop/streetlight-app/streetlight-web`
- Verified on remote:
  - `20260301195000`
  - `20260302000500`

## 6) Known data note (non-blocking for Week 1)
- `pothole_reports` currently stores location enrichment in `note` for older rows.
- Dedicated columns for address/landmark/intersection are not yet present in `public.pothole_reports`.
- This does not block lifecycle/event integrity checks.
