# Gate E Evidence - Backlog-Linked Hardening Smoke

Last updated: 2026-03-22 01:00 ET
Owner: Engineering Lead
Reviewer: Support Lead

## Checklist Status
- [x] Code-level evidence of duplicate-submit hardening present.
- [x] Water/drain duplicate-submit hardening validated in staging runtime.
- [x] iOS tap/hold/drag zoom reliability removed from web scope (deferred to native integration).
- [x] Bulk selection persistence validated under movement/reload/realtime.
- [x] Streetlights My Reports completeness validated against saved/ring/identity logic.

## Evidence Collected
### Duplicate-submit hardening (code-level)
Client-side evidence in `src/MapGoogleFull.jsx`:
- Domain submit dedupe map (`domainSubmitDedupRef`) and dedupe window logic.
- Idempotency key passed in abuse gate payload.

Server-side evidence in `supabase/functions/rate-limit-gate/index.ts`:
- `idempotency_key` parsing/normalization.
- Duplicate idempotency detection.
- `duplicate_idempotency_key` event logging.
- Duplicate response path (`duplicate: true`).

### Duplicate-submit hardening (staging runtime)
- Artifact: `docs/evidence/automation/gate-e-hardening-smoke-20260322T042918Z.md`
- Verified on staging project `madjklbsdwbtrqhpxmfs`:
  - First `rate-limit-gate` call accepted request.
  - Second call with same `idempotency_key` returned `duplicate: true`.
  - First report insert path succeeded (`POST /rest/v1/reports` -> 201) using production-style `report_type='other'`.
  - Second report insert attempt is expected to be skipped by client when `duplicate: true`.

### Risk discovered during runtime probe
- `rate-limit-gate` returned a degraded response on first call in one probe run:
  - `reason: "exception"`
  - `error: "TypeError: admin.rpc(...).catch is not a function"`
- Current behavior in that run still allowed request (`allowed: true`), but it exposed an abuse telemetry reliability gap.
- Status: mitigated by patch + staging deploy verification (see sections below).

### Patch implemented for degraded path
- Artifact: `docs/evidence/automation/gate-e-rate-limit-patch-20260322T043402Z.md`
- Local code fix applied:
  - Replaced invalid `admin.rpc(...).catch(...)` chain with non-blocking `try/await` wrapper.
  - File: `supabase/functions/rate-limit-gate/index.ts`
- Build verification after patch: `npm run build` => PASS.

### Post-deploy runtime verification
- Deployed updated `rate-limit-gate` to staging project `madjklbsdwbtrqhpxmfs`.
- Artifact: `docs/evidence/automation/gate-e-hardening-smoke-postdeploy-20260322T043549Z.md`
- Verified:
  - Duplicate idempotency still works (`duplicate: true` on second call).
  - Post-deploy stress probe (`120` iterations) reported:
    - `degraded_count: 0`
    - `exception_reason_count: 0`
  - Assessment: PASS (no degraded/exception responses observed post-deploy).

### Operator attestation (manual checks)
- Source: user chat attestation + screenshot evidence (2026-03-22 00:57 ET).
- Bulk selection:
  - 5+ streetlights selected.
  - Selection remained intact during pan/zoom.
  - Bulk submit succeeded (`Reports saved`, `Saved 5 reports to My Reports.`).
  - Realtime refresh and full app/session reload behavior: PASS (operator follow-up attestation).
- My Reports completeness:
  - Report rows exist for test identity.
  - Saved reports appear in My Reports.
  - Marker ring aligns with report state.
  - Fixed visibility aligns with intended rules.
  - No missing rows observed under filter/sort/date changes.
- iOS scope:
  - Product directive: iOS touch/drag zoom behavior is deferred to native integration and removed from current web-gate requirements.
- Manual evidence sheet updated: `docs/evidence/gate-e-manual-checklist.md`.

## Reviewer Sign-Off
- Reviewer sign-off: Anthony Oquendo - APPROVED (interim support sign-off)
- Date/time (ET): 2026-03-22 00:57 ET

## Remaining Work
1. None for current web-scope Gate E definition.
