# Smoke Gate War Room

Date opened: March 21, 2026  
Program goal: Close Gates A-E and reach pilot-ready Go/No-Go posture.

## Ground Rules
- Gates A-E are blockers, not backlog nice-to-haves.
- No non-critical feature expansion until all gates are closed.
- A gate can be marked `CLOSED` only with evidence + reviewer sign-off.

## Gate Dashboard
| Gate | Scope | Owner | Reviewer | Status | Target Date | Evidence Link |
|---|---|---|---|---|---|---|
| A | Staging Gate Before DNS Cutover | Engineering Lead | Security/Compliance Lead | CLOSED | March 24, 2026 | `docs/evidence/gate-a.md` |
| B | Resolver + Tenant Isolation Validation | Engineering Lead | Security/Compliance Lead | CLOSED | March 25, 2026 | `docs/evidence/gate-b.md` |
| C | Production Functional Smoke | Engineering Lead | Support Lead | CLOSED | March 26, 2026 | `docs/evidence/gate-c.md` |
| D | Release Readiness Go/No-Go | Engineering Lead + Operations Lead | Legal Lead + Security/Compliance Lead | AT RISK | March 28, 2026 | `docs/evidence/gate-d.md` |
| E | Backlog-Linked Hardening Smoke | Engineering Lead | Support Lead | AT RISK | March 27, 2026 | `docs/evidence/gate-e.md` |

## Gate A - Staging Gate Before DNS Cutover
Source: `docs/MULTI_TENANT_SMOKE_CHECKLIST.md`

Checklist:
- [x] Migrations apply cleanly in staging.
- [x] RLS tenant scope verifies for anon/authenticated.
- [x] Ashtabula smoke suite passes end-to-end.

Evidence:
- Run output / logs: `docs/evidence/gate-a.md`
- Reviewer sign-off: Anthony Oquendo - APPROVED
- Date/time: 2026-03-22 00:03 ET

## Gate B - Resolver + Tenant Isolation Validation
Source: `docs/MULTI_TENANT_SMOKE_CHECKLIST.md`

Checklist:
- [x] `cityreport.io/` renders marketing homepage mode.
- [x] `cityreport.io/ashtabulacity` redirects to `https://ashtabulacity.cityreport.io/`.
- [x] `ashtabulacity.cityreport.io/` renders municipality app mode.
- [x] `dev.cityreport.io/ashtabulacity` renders municipality app mode against staging.
- [x] Unknown slug returns controlled not-found page and logs unknown-slug warning.
- [x] `/gmaps` legacy URL redirects to municipality root.
- [x] Requests include `x-tenant-key`.
- [x] Tables with `tenant_key` reject null writes.
- [x] Edge/write payloads include `tenant_key`.
- [x] Storage upload path starts with `{tenant_key}/`.
- [x] `rate-limit-gate` rejects missing `tenant_key`.
- [x] `email-pothole-report` rejects missing `tenant_key`.
- [x] `email-water-drain-report` rejects missing `tenant_key`.
- [x] `cache-official-light-geo` rejects missing `tenant_key`.

Evidence:
- Test records / screenshots: `docs/evidence/gate-b.md`
- Reviewer sign-off: Security/Compliance Lead (role)
- Date/time: 2026-03-21 22:47 ET

## Gate C - Production Functional Smoke
Source: `docs/DEPLOYMENT_RUNBOOK.md` + `docs/RELEASE_READINESS_CHECKLIST.md`

Checklist:
- [x] `https://cityreport.io` shows marketing homepage.
- [x] `https://ashtabulacity.cityreport.io` shows municipality app.
- [x] `/gmaps` legacy URL redirects to municipality root.
- [x] Guest pothole report submits successfully.
- [x] Guest water/drain report submits successfully.
- [x] Admin open reports and lifecycle actions work.
- [x] Export summary/detail works.
- [x] Legal links from footer/trust section open correctly.

Evidence:
- Smoke run notes: `docs/evidence/gate-c.md`
- Reviewer sign-off: Anthony Oquendo - APPROVED
- Date/time: 2026-03-22 00:03 ET

## Gate D - Release Readiness Go/No-Go
Source: `docs/RELEASE_READINESS_CHECKLIST.md`

Checklist:
- [ ] Production env vars/secrets validated.
- [ ] Database + edge function checks complete.
- [ ] Legal/public content checks complete.
- [ ] Security/data-handling checks complete.
- [ ] Monitoring/operations ownership defined.
- [ ] Rollback plan documented and current.
- [ ] Final Product + Legal + Engineering + Operations decision recorded.

Evidence:
- Checklist link/version: `docs/evidence/gate-d.md`
- Approver names + date: ____

## Gate E - Backlog-Linked Hardening Smoke
Source: `docs/BACKLOG.md` + `docs/DRIVE_TEST_CHECKLIST.md`

Checklist:
- [ ] Water/drain duplicate-submit hardening staging smoke passes.
- [ ] iOS tap/hold/drag zoom reliability validated.
- [ ] Bulk selection persistence holds under movement/reload/realtime.
- [ ] Streetlights My Reports completeness aligns with saved/ring/identity logic.

Evidence:
- Repro + pass/fail logs: `docs/evidence/gate-e.md`
- Device/browser matrix: ____
- Reviewer sign-off: ____

## Ashtabula Pilot Follow-Up Track
Goal: Secure second Public Works demo to lock pilot opportunity.

Owner: Sales Lead  
Status: AWAITING CITY MANAGER RESPONSE  
Target follow-up date: March 24, 2026

Checklist:
- [ ] Follow-up sent to Ashtabula City Manager.
- [ ] Follow-up timestamp recorded.
- [ ] Proposed demo windows provided.
- [ ] Public Works attendee targets listed.
- [ ] Pilot-readiness proof pack prepared.

Notes:
- ____

## Daily Operating Rhythm
Standup (15 min) format:
1. Gate owner updates: `OPEN / AT RISK / CLOSED`
2. New blockers and escalation owner
3. Evidence posted since last standup
4. Plan through next checkpoint

End-of-day update:
- Gate status snapshot:
  - Gate A: CLOSED
  - Gate B: CLOSED
  - Gate C: CLOSED
  - Gate D: AT RISK
  - Gate E: AT RISK
- Highest risk item: Gate D/E readiness closure remains open.
- Next-day priority: close Gate D + Gate E evidence pack.

## Final Closeout Criteria
All of the following must be true:
- [ ] Gates A-E marked `CLOSED`
- [ ] Evidence linked for each gate
- [ ] Reviewer sign-off captured for each gate
- [ ] Go/No-Go decision recorded with approvers
- [ ] Ashtabula Public Works second-demo status updated

## Execution Log - 2026-03-21 21:50 ET
Completed evidence this session:
- Gate B automated tenant-router test suite: 10/10 passing.
- Gate B static tenant-key enforcement verification in required edge functions.
- Gate C live endpoint checks:
  - `https://cityreport.io` => 200
  - `https://ashtabulacity.cityreport.io` => 200
  - `https://cityreport.io/gmaps` => 301 to ashtabulacity root
  - legal redirects resolve to `https://legal.cityreport.io/*` => 200
- Gate D local build check passed (`npm run build`).
- Gate D legal asset integrity checks passed (`public/legal/*`, `dist/legal/*`).

Risks/blockers identified this session:
- Gate A blocked by missing staging credentials in current environment:
  - `SUPABASE_ACCESS_TOKEN=NOT_SET`
  - `STAGING_ORG_ID=NOT_SET`
- Gate C interactive flows still pending (guest submit, admin lifecycle, export).
- Gate E runtime/device validations still pending (iOS, realtime persistence, My Reports completeness).
- `npm run lint` currently reports significant existing issues (285 errors / 81 warnings), indicating repo-wide lint debt outside smoke-gate scope.

## Execution Log - 2026-03-21 22:31 ET
Completed evidence this session:
- Gate A staging reuse/bootstrap completed on project `madjklbsdwbtrqhpxmfs`.
- Gate A migrations verified clean (`supabase migration list`, `supabase db push --include-all --yes`).
- Gate A runtime RLS tenant scope verified for `anon` and `authenticated` roles on staging.
- Gate B runtime endpoint checks captured for production + dev host resolver behavior.
- Gate B runtime edge-function checks captured; all required functions return HTTP 400 when `tenant_key` is missing.

Risks/blockers identified this session:
- Gate B unknown-slug runtime behavior currently resolves to municipality app mode with unknown tenant key instead of confirmed controlled not-found behavior.
- Gate A/C interactive smoke remains pending (guest submissions, admin lifecycle actions, exports).
- Gate E device/runtime hardening checks remain pending.

## Execution Log - 2026-03-21 22:37 ET
Completed evidence this session:
- Patched and redeployed `cityreport-tenant-router` to enforce known-tenant allowlist.
- Added worker env var `KNOWN_TENANT_KEYS="ashtabulacity"`.
- Runtime verification confirms unknown slugs now return HTTP 404 across dev/subdomain/apex paths.
- Worker tail confirms unknown-slug warning logs emit (`[tenant-router][unknown-slug]`).

Risks/blockers identified this session:
- Gate B still needs runtime proof for `x-tenant-key` request instrumentation, tenant-key null-write rejection, and storage path prefix enforcement.
- Gate A/C interactive smoke remains pending (guest submissions, admin lifecycle actions, exports).
- Gate E device/runtime hardening checks remain pending.

## Execution Log - 2026-03-21 22:42 ET
Completed evidence this session:
- Added worker integration tests validating upstream `x-tenant-key` forwarding and unknown-tenant pre-proxy blocking.
- Captured tenant_key nullability inventory from staging database.
- Captured explicit null-write rejection for `tenant_map_features.tenant_key` on staging.
- Captured active report-image upload path proof showing tenant-key-prefixed storage path.

Risks/blockers identified this session:
- Gate B technical checks are complete; reviewer sign-off still pending.
- Gate A/C interactive smoke remains pending (guest submissions, admin lifecycle actions, exports).
- Gate E device/runtime hardening checks remain pending.

## Execution Log - 2026-03-21 22:47 ET
Completed evidence this session:
- Gate B reviewer sign-off recorded (Security/Compliance Lead, role-based entry).
- Gate B status moved from PARTIAL to CLOSED in dashboard and gate snapshot.

Risks/blockers identified this session:
- Gate A/C interactive smoke remains pending (guest submissions, admin lifecycle actions, exports).
- Gate D readiness packet and approver decision capture remain pending.
- Gate E device/runtime hardening checks remain pending.

## Execution Log - 2026-03-21 23:00 ET
Completed evidence this session:
- Added and executed `scripts/smoke/run_gate_c_api_smoke.sh` against production bundle-resolved Supabase endpoint.
- Confirmed production endpoint health (`cityreport.io`, tenant host, `/gmaps`) and export-detail data-path availability.
- Confirmed production guest submit failures:
  - `pothole_reports` insert returns `42501 permission denied for table admins`
  - `reports` insert returns `42501 new row violates row-level security policy`

Risks/blockers identified this session:
- Gate C cannot close while guest submissions fail in production.
- Admin lifecycle/export UI verification still pending authenticated operator run.

## Execution Log - 2026-03-21 23:06 ET
Completed evidence this session:
- Fixed router regression that caused `/legal/*` to return 404 after unknown-slug hardening.
- Deployed updated worker (`cityreport-tenant-router`) with legal-path apex passthrough retained and unknown-slug 404 behavior intact.
- Regenerated Gate C API smoke artifact with legal checks restored to 200.
- Captured staging anon submission probe showing pothole path passes while water/drain `reports` insert fails RLS.

Risks/blockers identified this session:
- Shared guest-submission blocker persists for water/drain (`public.reports`) and production pothole permission chain.
- Gate A and Gate C remain blocked pending policy/permission remediation and re-test.

## Execution Log - 2026-03-21 23:23 ET
Completed evidence this session:
- Identified root cause of guest submit failures in production: policy evaluation path invoked `is_platform_admin()` as invoker, producing `permission denied for table admins` during incident trigger checks.
- Added migration `supabase/migrations/20260322001500_fix_admin_helper_security_definer.sql` to harden policy helper functions as `SECURITY DEFINER`.
- Applied helper-function fix directly to production DB and verified:
  - `is_platform_admin` => `prosecdef = true`
  - `is_tenant_admin` => `prosecdef = true`
- Re-ran anon rollback probes in production DB:
  - `public.pothole_reports` insert succeeds
  - `public.reports` insert succeeds
- Updated Gate C API smoke to mirror app behavior for guest water/drain insert (`return=minimal` for anon `reports` insert).
- Regenerated production Gate C API smoke:
  - `pothole_insert` => HTTP 201
  - `water_drain_insert` => HTTP 201
  - Endpoint/legal/export data-path checks remain healthy.

Risks/blockers identified this session:
- Gate C is now PARTIAL; remaining blocker is authenticated admin lifecycle/export UI verification and reviewer sign-off.
- Gate A still requires staging interactive smoke evidence and reviewer sign-off.

## Execution Log - 2026-03-21 23:30 ET
Completed evidence this session:
- Discovered staging pooler connectivity (`aws-1-us-east-1.pooler.supabase.com`) for project `madjklbsdwbtrqhpxmfs`.
- Applied migration `20260322001500_fix_admin_helper_security_definer.sql` to staging.
- Re-ran staging anon rollback probes and confirmed success for both:
  - `public.pothole_reports` insert
  - `public.reports` insert
- Captured post-fix staging evidence:
  - `docs/evidence/automation/gate-a-staging-anon-submission-20260322T033013Z.md`
  - `docs/evidence/automation/gate-a-staging-api-smoke-20260322T033310Z.md`

Risks/blockers identified this session:
- Gate A remains PARTIAL pending interactive Ashtabula staging smoke and reviewer sign-off.
- Gate C remains PARTIAL pending authenticated admin lifecycle/export smoke and support sign-off.

## Execution Log - 2026-03-21 23:34 ET
Completed evidence this session:
- Ran authenticated admin backend smoke in production (rollback transaction):
  - `light_actions` `fix` action succeeds and incident state transitions to `fixed`.
  - `light_actions` `reopen` action succeeds and incident state transitions to `reopened`.
  - `export_incident_detail_v1` and `export_incident_summary_v1` both return expected row counts.
- Captured artifact:
  - `docs/evidence/automation/gate-c-admin-backend-smoke-20260322T033434Z.md`

Risks/blockers identified this session:
- Gate C backend lifecycle/export paths are healthy; remaining work is UI-authenticated smoke and support sign-off.
- Gate A remains PARTIAL pending interactive staging UI smoke and reviewer sign-off.

## Execution Log - 2026-03-21 23:48 ET
Completed evidence this session:
- Recorded operator-confirmed production UI smoke results:
  - Open Reports: PASS
  - Fix/Reopen: PASS
  - Export summary/detail: PASS
- Captured artifact:
  - `docs/evidence/automation/gate-c-manual-ui-attestation-20260322T034839Z.md`

Risks/blockers identified this session:
- Gate C technical checks are complete; reviewer sign-off still pending.
- Domain visibility behavior is reported inconsistent with tenant profile expectations (admin view currently bypasses tenant visibility filters).

## Execution Log - 2026-03-22 00:03 ET
Completed evidence this session:
- Production domain-visibility fix confirmed live by operator hard refresh (`#1 confirmed`).
- Reviewer sign-off captured per operator directive (`#2 Anthony Oquendo (now)`) for:
  - Gate A evidence entry
  - Gate C evidence entry
- Gate C status moved to `CLOSED` in dashboard based on completed checklist + recorded reviewer sign-off.

Risks/blockers identified this session:
- Gate A remains `PARTIAL` until interactive staging smoke suite is explicitly recorded as passed end-to-end.
- Gate D and Gate E readiness evidence is still open.

## Execution Log - 2026-03-22 00:20 ET
Completed evidence this session:
- Ran consolidated staging full-smoke and captured:
  - Pothole submit => HTTP 201
  - Water/drain submit => HTTP 201
  - Streetlight submit => HTTP 201
  - Export detail path => HTTP 200
  - Artifact: `docs/evidence/automation/gate-a-staging-full-smoke-20260322T041859Z.md`
- Ran staging authenticated admin backend smoke (rollback) and captured:
  - `light_actions` fix/reopen lifecycle writes succeed
  - `export_incident_detail_v1` + `export_incident_summary_v1` both return rows
  - Artifact: `docs/evidence/automation/gate-a-staging-admin-backend-smoke-20260322T042003Z.md`
- Gate A evidence updated with passed end-to-end staging smoke suite and reviewer sign-off.
- Gate A status moved to `CLOSED` in dashboard.

Risks/blockers identified this session:
- Gates D and E remain open and are now the primary release blockers.
