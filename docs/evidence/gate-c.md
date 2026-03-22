# Gate C Evidence - Production Functional Smoke

Last updated: 2026-03-22 00:03 ET
Owner: Engineering Lead
Reviewer: Support Lead

## Checklist Status
- [x] `https://cityreport.io` is reachable and serves marketing mode.
- [x] `https://ashtabulacity.cityreport.io` is reachable and serves municipality mode.
- [x] `https://cityreport.io/gmaps` redirects to `https://ashtabulacity.cityreport.io/`.
- [x] Legal links from the public site resolve successfully.
- [x] Guest pothole submit flow verified live.
- [x] Guest water/drain submit flow verified live.
- [x] Admin open reports + lifecycle actions verified live.
- [x] Export summary/detail verified live through admin UI.

## Evidence Collected
### Production endpoint + legal checks
- `cityreport.io` => HTTP 200.
- `ashtabulacity.cityreport.io` => HTTP 200.
- `/gmaps` => HTTP 301 to tenant root.
- `cityreport.io/legal/{terms,privacy,governance}.html` resolves (308 -> 200).
- Artifact: `docs/evidence/automation/gate-c-api-smoke-20260322T032310Z.md`

### Guest submit probes (production API path)
Using production app bundle Supabase URL/key + tenant header (`ashtabulacity`), guest-style insert probes now return success:
- Pothole insert (`public.pothole_reports`) => HTTP 201.
- Water/drain insert (`public.reports`) => HTTP 201.
- Artifact: `docs/evidence/automation/gate-c-api-smoke-20260322T032310Z.md`

### Production DB helper-function remediation
- Root cause confirmed from live DB probes: anon report insert trigger path evaluated policies that depended on `is_platform_admin()` with invoker permissions, causing `permission denied for table admins`.
- Applied helper hardening migration (`SECURITY DEFINER`) and verified both anon insert probes pass in rollback transaction.
- Artifact: `docs/evidence/automation/gate-c-db-policy-fix-20260322T032320Z.md`

### Export data-path probe
- `export_incident_detail_v1` query returns HTTP 200 with current rows in production.
- Export dataset path is live and corroborates successful UI export checks.
- Artifact: `docs/evidence/automation/gate-c-api-smoke-20260322T032310Z.md`

### Admin backend lifecycle smoke
- Authenticated admin context validated through rollback probe:
  - `light_actions` `fix` insert succeeds and incident state transitions to `fixed`.
  - `light_actions` `reopen` insert succeeds and incident state transitions to `reopened`.
  - `export_incident_detail_v1` and `export_incident_summary_v1` both return rows.
- Artifact: `docs/evidence/automation/gate-c-admin-backend-smoke-20260322T033434Z.md`

### Production UI confirmation (operator attestation)
- Operator confirmed in-thread on 2026-03-22:
  - Open Reports => PASS
  - Fix/Reopen actions => PASS
  - Export summary/detail => PASS
- Artifact: `docs/evidence/automation/gate-c-manual-ui-attestation-20260322T034839Z.md`

### Router safety regression + fix (same session)
- Unknown-slug hardening initially caused `/legal/*` to 404.
- Router patched to pass through apex legal paths and redeployed.
- Unknown-slug 404 behavior retained after fix.

## Remaining Work
1. None for Gate C technical scope.

## Reviewer Sign-Off Entry
- Reviewer sign-off: Anthony Oquendo - APPROVED
- Date/time (ET): 2026-03-22 00:03 ET
