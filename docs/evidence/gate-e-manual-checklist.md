# Gate E Manual Validation Sheet

Date: 2026-03-22 (ET)  
Operator: Anthony Oquendo (chat attestation)  
Reviewer: Anthony Oquendo (interim support sign-off)

Purpose: close remaining Gate E manual checks with reproducible evidence.

## Device/Browser Matrix
- Device model: ____________________
- OS version: ____________________
- Browser + version: ____________________
- Network: Wi-Fi / Cellular / Other: ____________________

## 1) iOS Zoom Reliability (Drive Test)
- [x] Deferred out of web scope by product directive (2026-03-22).
- [x] Reserved for future native iOS integration only.

Evidence:
- Source: in-thread product directive from Anthony Oquendo.
- Notes: "I don't care to have [iOS feature] working right now... implement with native iOS integration, not mobile Safari."

## 2) Bulk Selection Persistence
- [x] Enable bulk mode and select 5+ streetlights.
- [x] Pan and zoom map; selected set remains intact.
- [x] Trigger data refresh/realtime update; selected set remains intact.
- [x] Reload app/session; expected persistence/recovery behavior is consistent.
- [x] Submit bulk report and verify selected IDs resolve correctly.

Evidence:
- Screenshots/recording: chat-attached screenshot showing `Reports saved` with `Saved 5 reports to My Reports.`
- Selected IDs sampled: 5+ streetlights selected (operator attested)
- Notes (pass/fail + repro): PASS for selection persistence during pan/zoom, realtime/refresh, reload/session behavior, and bulk submit (operator attested in-thread).

## 3) My Reports Completeness (Saved/Ring/Identity)
- [x] Create/confirm report rows for test identity (email/phone and auth user).
- [x] Verify each saved report appears in My Reports list.
- [x] Verify marker ring state aligns with report state (open/fixed/reopened).
- [x] Verify fixed-state behavior aligns with intended visibility rules.
- [x] Verify no missing rows when filtering/sorting/date range changes.

Evidence:
- Test identity used: operator test identity (chat attestation)
- Incident/report IDs sampled: not enumerated in chat; behavior-level attestation recorded
- Screenshots/recording: chat screenshot + operator confirmation in-thread
- Notes (pass/fail + repro): PASS across row presence, My Reports inclusion, ring/state alignment, fixed visibility behavior, and filter/sort/date checks.

## 4) Rate-Limit Patch Deploy Verification (Already Completed)
- [x] Deploy updated `rate-limit-gate` edge function.
- [x] Repeat duplicate-submit smoke with identical `idempotency_key`.
- [x] Confirm no degraded response containing `admin.rpc(...).catch is not a function`.
- [x] Confirm duplicate second-call behavior still returns `duplicate: true`.

Evidence:
- Deploy command output/log: `supabase functions deploy rate-limit-gate --project-ref madjklbsdwbtrqhpxmfs`
- Runtime artifact path/link: `docs/evidence/automation/gate-e-hardening-smoke-postdeploy-20260322T043549Z.md`
- Notes: Completed in this session; no further action required for this sub-check.

## Sign-Off
- Engineering Lead: Anthony Oquendo (operator attestation) Date/Time: 2026-03-22 00:57 ET
- Support Lead: Anthony Oquendo (interim sign-off) Date/Time: 2026-03-22 00:57 ET
