# Gate B Evidence - Resolver + Tenant Isolation Validation

Last updated: 2026-03-21 22:47 ET
Owner: Engineering Lead
Reviewer: Security/Compliance Lead

## Checklist Status
- [x] Resolver behavior unit-tested against required routing paths.
- [x] `/gmaps` redirect behavior covered by automated tests and runtime checks.
- [x] Unknown slug now returns controlled not-found response and logs unknown-slug warning.
- [x] Request header forwarding includes `x-tenant-key` for tenant-routed proxy requests (worker integration test evidence).
- [x] Tenant-scoped table writes reject `null` tenant keys (staging DB constraint proof).
- [x] Storage upload path is tenant-prefixed (`{tenant_key}/...`) in active report image upload path.
- [x] Edge function tenant_key enforcement logic present in all required functions.
- [x] Runtime verification confirms required functions reject missing `tenant_key` with HTTP 400 in staging.
- [x] Reviewer sign-off captured: Security/Compliance Lead (role), 2026-03-21 22:47 ET.

## Evidence Collected
### Tenant router tests
Command:
- `node --test cloudflare/tenant-router/src/router.test.mjs cloudflare/tenant-router/src/index.test.mjs`

Result:
- 14 tests passed, 0 failed.
- Covers:
  - known tenant redirects/subdomain resolution
  - unknown slug controlled not-found outcomes
  - worker proxy header forwarding (`x-tenant-key`, `x-tenant-mode`, `x-tenant-env`)
  - unknown tenant requests blocked before upstream proxy

### Runtime resolver checks (HTTP)
Observed:
- `https://cityreport.io/` returns `x-cityreport-resolver-mode: marketing_home`.
- `https://cityreport.io/ashtabulacity` redirects to `https://ashtabulacity.cityreport.io/`.
- `https://dev.cityreport.io/ashtabulacity` returns `x-cityreport-resolver-mode: municipality_app` and `x-cityreport-tenant-key: ashtabulacity`.
- `https://dev.cityreport.io/gmaps` redirects to `https://dev.cityreport.io/ashtabulacity/`.
- Unknown slug now returns controlled 404:
  - `https://dev.cityreport.io/unknown-slug-does-not-exist` -> HTTP 404
  - `https://unknown-slug-does-not-exist.cityreport.io/` -> HTTP 404
  - `https://cityreport.io/unknown-slug-does-not-exist` -> HTTP 404

### Unknown slug warning log proof
Captured worker warning event after deploy and curl trigger:
- Log tag: `[tenant-router][unknown-slug]`
- Event includes host, path, slug, and timestamp
- Artifact: `docs/evidence/automation/gate-b-unknown-slug-runtime-20260322T023644Z.md`

### Tenant-key constraint and storage-path proof
- Staging schema inventory confirms tenant_key columns are non-null on tenant-scoped operational tables.
- Controlled insert with `tenant_key = null` fails on `public.tenant_map_features` with not-null constraint violation.
- Active upload path in `src/MapGoogleFull.jsx` is tenant-prefixed:
  - `` `${tenantKey}/${domain}/${date}/${...}` ``
- Artifact: `docs/evidence/automation/gate-b-deep-checks-20260322T024205Z.md`

### Edge function tenant_key enforcement (runtime)
For each function below, staging runtime request with missing `tenant_key` returns HTTP 400:
- `rate-limit-gate`
- `email-pothole-report`
- `email-water-drain-report`
- `cache-official-light-geo`

## Deployment Notes
- Cloudflare worker `cityreport-tenant-router` deployed with allowlist variable:
  - `KNOWN_TENANT_KEYS="ashtabulacity"`
- Deployment version id: `070e1dce-8154-448d-a37d-33d0dcd0d9ea`

## Automation Artifacts
- `docs/evidence/automation/gate-bc-checks-20260322T014845Z.md`
- `docs/evidence/automation/gate-a-rls-runtime-20260322T022804Z.md`
- `docs/evidence/automation/gate-b-unknown-slug-runtime-20260322T023644Z.md`
- `docs/evidence/automation/gate-b-deep-checks-20260322T024205Z.md`

## Remaining Work
- None. Gate B is ready/recorded as CLOSED in the war-room tracker.
