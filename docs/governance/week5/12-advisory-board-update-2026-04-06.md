# CityReport Advisory Board Update (2026-04-06)

Advisory Board,

This update covers the work completed after the Week 5 pilot-readiness polish sprint, including the final live QA pass and one structural production follow-up for public repair confirmations.

## Executive Snapshot

- Current posture: `GREEN for live pilot-facing UX readiness`
- Validation posture: local build/lint/tests passed and the manual live QA checklist is fully green
- Scope note: most recent work stayed in UI/pilot-readiness territory, with one approved structural production bug-fix path to support public repair confirmations and PCP control persistence

## 1) Pilot-Facing Workspace Polish Closed

The following surfaces were standardized and brought into the same component family:

- PCP header, tab rail, account/menu treatment, and edit-state flows
- Hub header, auth gate, workspace menu styling, and support/feedback entry points
- Reporting Map desktop/mobile header, hamburger behavior, menu layering, alerts/events windows, notification preferences, and public contact flow
- Marketing header and tab-rail/mobile-nav behavior

Key results:

- Hub, PCP, and Map now share a more consistent header and menu language
- logged-out Hub access is now gated behind sign-in before workspace entry
- logged-out public Map behavior is cleaner and uses display-name resolution more consistently
- map alerts/events/contact/preferences surfaces now honor dark mode
- marketing mobile navigation now behaves like the workspace bottom-tab family

## 2) Manual Live QA Status

The live QA checklist is now fully passing.

Confirmed green:

- landing page header and navigation behavior
- Hub logged-out gate and signed-in workspace shell
- Map desktop and mobile header/menu alignment
- Map alerts/events/contact/preferences flows
- Hub-to-map fly-to behavior
- unread notification persistence and menu layering regressions

This closes the outstanding UI/compliance follow-up noted in:

- [11-ui-polish-compliance-pass-2026-04-04.md](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/docs/governance/week5/11-ui-polish-compliance-pass-2026-04-04.md)

## 3) New Public Repair Confirmation Model Added

One new post-polish operational feature was implemented for incident-driven domains:

- public repair confirmations can now be enabled per domain from PCP
- public users can mark an incident `Is fixed` when the organization chooses not to manage repair closure directly

Model summary:

- original issue report contributes `-2`
- each additional unique issue reporter contributes `-1`
- issue confidence is capped at `-5`
- original reporter confirming fixed contributes `+2` repair progress
- each additional unique repair confirmer contributes `+1`
- repair progress must reach `5`
- any new issue report resets repair progress back to `0`
- incidents archive after 14 days with no movement

Guardrails:

- each unique user can only report the issue once per incident
- each unique user can only confirm repair once per incident
- organizations can disable public repair confirmations per domain

## 4) PCP Control Plane Update

The PCP now includes a per-domain `Repair Verification` toggle for all domains, including asset-backed domains.

Behavior:

- `On`: organization monitored repairs
- `Off`: public repair confirmations enabled

Production note:

- the initial live persistence issue was not app-state logic; it was an unapplied Supabase migration
- that migration has now been pushed successfully to the remote project and the PCP setting should persist correctly after save/reload

## 5) Validation Snapshot

Local validation completed successfully in `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web`:

- `npm run build`
- `npm run lint`
- `npm test`
- `npm run test:router`

Production follow-up:

- remote Supabase migration `20260406093000_incident_public_repair_progress.sql` is now applied

## 6) Governance Posture

### Items that remained within Week 5 polish intent

- UI consistency
- mobile/desktop header alignment
- menu/contact/support flow clarity
- dark-mode coverage
- auth-gate bug fixes
- navigation/readability cleanup

### Items that should be treated as structural exceptions

- the public repair-confirmation system
- the new `organization_monitored_repairs` domain control
- the new public repair signal table/RPC path

These were not pure polish changes and should be tracked as approved bug-fix / pilot-operations exceptions rather than folded silently into the UI sprint.

## 7) Current Risks

1. `MapGoogleFull.jsx` still exceeds the 500 kB chunk-size warning threshold.
2. Public unread-state persistence for alerts/events is device-local, not canonical cross-device state.
3. Public repair confirmations are intentionally probabilistic and should not be framed as municipal work-order truth without explicit organizational confirmation.

## 8) Recommended Board Posture

- Keep current pilot-facing UX in `stability-first` mode
- Allow bug fixes and copy/layout clarification only unless a production blocker appears
- Treat the public repair-confirmation model as a monitored pilot mechanism, not a generalized platform-wide closure system yet
- Require stakeholder feedback from real municipal use before expanding this model beyond the current incident domains

## 9) Immediate Next Actions

1. Observe live use of the new repair-confirmation model and verify it does not create public confusion.
2. Capture screenshots/evidence for board packet or municipal deck updates if needed.
3. Decide whether public repair confirmations remain pilot-only or become part of the standard accountability model.
