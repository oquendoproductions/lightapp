# Week 5 — Quiet Pilot Launch Plan

## Objective
Run a controlled municipal pilot for `potholes` + `street_signs` with stable governance scope and no structural expansion.

## Scope Lock
- In scope: reliability fixes, UX clarity, admin reporting clarity, documentation.
- Out of scope: new domains, new state models, export schema changes, metric formula changes.

## Pilot Cohort
- Municipal sponsor: 1 lead contact + 1 backup contact.
- Internal users: 3-8 operations users.
- Optional resident cohort: 10-30 known testers (invite-only).

## Launch Sequence
1. Pre-flight check (day -3 to day -1)
- Verify auth/login + role access.
- Verify Open Reports, My Reports, export summary/detail CSV.
- Verify moderation flag telemetry + admin visibility.
- Verify zero blocking console errors in pilot path.

2. Pilot kickoff (day 0)
- 30-minute sponsor walkthrough.
- Share limited access instructions.
- Confirm reporting expectations and SLA ownership boundaries.

3. Observation window (day 1-30)
- Daily: quick health check + triage.
- Weekly: ops summary (report volume, open/closed, reopen/chronic trend).
- Log UX friction items without changing structure.

4. Midpoint review (day 14-21)
- Validate metric comprehension with municipal stakeholders.
- Capture required copy/label clarifications.
- Confirm procurement concerns.

5. Closeout review (day 30-60)
- Compare week 1 vs week 4 trendline.
- Review open backlog and production readiness deltas.
- Decide extension, conversion, or scope adjustment.

## Go/No-Go Gates
- Go if:
  - No structural regressions.
  - Export integrity remains deterministic (`v1`).
  - Municipal users can complete core workflows unassisted.
- No-Go if:
  - Lifecycle/accountability outputs are inconsistent.
  - Domain ownership narrative is unclear in stakeholder feedback.

## Deliverables During Pilot
- Weekly pilot summary note.
- Updated risk register.
- Decision memo at day 30 (extend/convert/adjust).
