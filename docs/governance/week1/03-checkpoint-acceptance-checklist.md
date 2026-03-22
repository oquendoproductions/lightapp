# Week 1 Checkpoint Acceptance Checklist

## Checkpoint Goal
Approve architecture lock for lifecycle + event logging.

## A. Lifecycle Contract
- [ ] Canonical states documented and approved.
- [ ] Allowed transition matrix implemented.
- [ ] Domain mappings written for streetlights + potholes.
- [ ] Power and water lifecycle specs drafted (non-public).

## B. Aggregation Strategy Interface
- [x] Aggregation interface defined (`asset/proximity/area/severity`).
  - Spec: `12-aggregation-strategy-contract.md`
- [ ] Streetlights strategy plugged into interface.
- [ ] Potholes strategy plugged into interface.
- [ ] Open Reports reads normalized aggregation output.

## C. Event Logging
- [ ] `incident_events` table deployed.
- [ ] Every state change writes an event row.
- [ ] `source` captured (`system/admin/user`).
- [ ] `changed_by` captured when available.
- [ ] Snapshot/read model updated from events.

## D. Query Validation
- [ ] Can answer: who changed state, from what, to what, and when.
- [ ] Can compute reopen count per incident.
- [ ] Can compute time-to-close for fixed incidents.

## E. Guardrails (Discipline)
- [ ] No new public domains launched.
- [ ] No cosmetic-only feature work merged.
- [ ] No non-blocking UX polish merged.

## Evidence Package Required for Board Review
- [ ] Architecture doc link
- [ ] SQL migration link
- [ ] 3 sample incident timelines (streetlight + pothole)
- [ ] Open Reports before/after logic note
- [ ] Risk register updates

## Go/No-Go Decision
- Go to Phase 2 only if all A-E are complete.
