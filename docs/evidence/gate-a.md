# Gate A Evidence - Staging Gate Before DNS Cutover

Last updated: 2026-03-22 00:03 ET
Owner: Engineering Lead
Reviewer: Security/Compliance Lead

## Checklist Status
- [x] Migrations apply cleanly in staging.
- [x] RLS tenant scope verifies for anon/authenticated.
- [ ] Ashtabula smoke suite passes end-to-end.

## Evidence Collected
- Staging reuse/bootstrap automation completed against `madjklbsdwbtrqhpxmfs`:
  - `supabase migration list` confirms local/remote alignment.
  - `supabase db push --include-all --yes` reports remote database up to date.
  - Required edge functions redeployed and secrets refreshed.
  - Artifact: `docs/evidence/automation/gate-a-reuse-staging-20260322T022032Z.md`
- Runtime RLS validation executed directly on staging via pooler endpoint:
  - `anon` with `tenant_key=ashtabulacity` resolves tenant correctly and returns only Ashtabula rows (`other_rows=0`).
  - `authenticated` with `tenant_key=default` resolves tenant correctly and returns only default rows (`other_rows=0`).
  - Artifact: `docs/evidence/automation/gate-a-rls-runtime-20260322T022804Z.md`
- Staging guest-submission probe under anon role (latest post-fix run):
  - `pothole_reports` anon insert succeeds.
  - `reports` anon insert for water/drain path succeeds.
  - Artifact: `docs/evidence/automation/gate-a-staging-anon-submission-20260322T033013Z.md`
- Staging API smoke (post-fix) confirms guest insert behavior through REST path:
  - `pothole_reports` => HTTP 201 (`return=representation`)
  - `reports` => HTTP 201 (`return=minimal`)
  - Artifact: `docs/evidence/automation/gate-a-staging-api-smoke-20260322T033310Z.md`
- Prior failed probe retained for audit trail:
  - Artifact: `docs/evidence/automation/gate-a-staging-anon-submission-20260322T030511Z.md`
- Production root-cause confirmation + remediation completed:
  - `is_platform_admin` / `is_tenant_admin` policy helpers hardened as `SECURITY DEFINER`.
  - Production anon insert probes now pass for both `pothole_reports` and `reports`.
  - Artifacts:
    - `docs/evidence/automation/gate-c-db-policy-fix-20260322T032320Z.md`
    - `docs/evidence/automation/gate-c-api-smoke-20260322T032310Z.md`

## Remaining Work / Blockers
- Operator-driven UI evidence for submit/lifecycle/export is still pending.

## Next Actions
1. Execute interactive staging smoke and capture screenshots/timestamps.
2. Obtain Security/Compliance reviewer sign-off.

## Reviewer Sign-Off Entry
- Reviewer sign-off: Anthony Oquendo - APPROVED
- Date/time (ET): 2026-03-22 00:03 ET
