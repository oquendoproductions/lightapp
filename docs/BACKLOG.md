# Product Backlog

## Now (highest priority)
1. Drive-test tracking behavior on live roads.
3. Confirm bulk selection persistence under movement/reload pressure.
4. Monitor email deliverability trend (suspicious/spam drift).
   - Instrumentation status:
     - `email_delivery_events` logging added to pothole + water/drain email edge functions.
     - Daily metrics view: `email_delivery_daily_metrics`.
     - Runbook: `docs/EMAIL_DELIVERABILITY_MONITORING.md`.
5. Water/Drain submit race condition (duplicate click):
   - Repro: On water/drain marker info window, `Report` can be clicked again before it flips to `Reporting…`.
   - Hardening status:
     - Client submit lock + local dedupe window added.
     - `rate-limit-gate` idempotency-key duplicate guard added (staging deployed).
   - Remaining:
     - Verify staging smoke: repeated click + rapid re-submit should create one report only and keep marker/reports consistent.
6. Guest save-light flow prompt:
   - In logged-out save flow, selecting `Continue as Guest` should explicitly prompt the guest login/info flow.
7. Streetlights (My Reports): hide utility checkbox for fixed state.
   - If a streetlight incident is fixed, do not show utility-reported checkbox for that row.
8. Streetlights marker ring resolution on fixed:
   - If streetlight state is fixed, marker ring should clear (no ring).
9. Streetlight action window: hide `Save Light` for already-saved lights.
   - Enforce against same saved-state logic used by My Reports + ring status.
10. Streetlights My Reports completeness:
   - Some/a lot of saved lights are not appearing in My Reports.
   - Must align My Reports identity and incident grouping with saved/ring logic.

## Deferred (native scope)
1. iOS tap/hold/drag zoom reliability:
   - Removed from web smoke-gate scope.
   - Revisit only under native iOS integration.

## Next
1. Report domains implementation (admin first):
   - Potholes
   - Power outage
   - Water main breaks
2. Pothole pre-report notice responsiveness:
   - Reduce delay between pothole map tap and showing the police-report notice modal.
   - Target near-immediate feedback after valid placement tap.
3. Layer filter architecture for domain switching.
4. Power outage privacy model:
   - radius-based clustering
   - public obfuscation of precise reporter location
5. Address/intersection/landmark capture fields.
6. Open Reports table-mode refactor (admin):
   - Replace card list with sortable columns.
   - Columns: incident/report #, domain, submitted_at, state, report_count, reporter fields (admin), notes preview.
   - Date range + search are unified (search runs inside selected date window).
   - Sortable by submitted_at, report_count, state.
   - Preserve actions: view details, fly to, reporter details.
7. My Reports table-mode alignment (user):
   - Match Open Reports layout style with table columns.
   - Add search + date filter controls scoped to the current user only.
   - Add user-scoped metrics row (for selected domain/date):
     - reports submitted
     - incidents reported
     - open incidents
     - fixed incidents
   - Preserve user actions: expand row details, fly to, and current domain switch behavior.
8. Include an image option within Reports:
   - Support adding an image from the report flow.
   - Show attached image in Reports details views.
9. Ashtabula boundary mask inversion (deferred until sync stability is complete):
   - Keep boundary border visible.
   - Make boundary interior clear/transparent.
   - Shade outside the boundary only.
   - Status: implemented in current branch; pending visual QA in staging.
10. Streetlights "in view" counters as toggle filters:
   - Convert `Open reports in view`, `Saved lights in view`, and `Utility reported lights in view` into clickable toggles.
   - Click once: show only that marker set and hide other marker sets.
   - Click again: clear that filter and restore default marker visibility.
11. Developer municipality settings panel (dev-side control surface):
   - Add a developer-facing menu for municipality-level settings and testing controls.
   - Allow toggling domains/features on and off per municipality in development/staging.
   - Include configurable municipality metadata/testing flags for rapid QA without production exposure.
12. Pilot legal/ops CYA implementation:
   - Add public-form disclaimer before submit.
   - Add success-screen disclaimer under report number.
   - Add domain-specific urgent warning copy for sewer/storm backup and other high-risk domains.
   - Generate human-readable report numbers everywhere.
   - Add daily city-owned inbox digest and digest history.
   - Add audit events for submit, delivery, city-view, assignment, and closure.
   - Add Hub-visible delivery/view timeline per report.
   - Checklist: `docs/governance/week5/14-pilot-cya-implementation-checklist.md`

## Later
1. Two-factor authentication.
2. Branding/logo pass.
3. Additional analytics and incident ops tooling.
4. CityReport entity structure decision:
   - Review with finance advisor and board before formation.
   - Compare Delaware C-corp operating in Ohio vs Ohio for-profit corporation.
   - Evaluate investor readiness, tax/compliance overhead, governance, and near-term operating cost.
   - Decide formation path before finalizing incorporation filings.
5. Open Reports search-result card sizing:
   - Keep row/card height consistent.
   - Do not stretch cards vertically when result count is small.
6. Go-live webhook activation for lead notifications:
   - Set `LEAD_NOTIFY_WEBHOOK_URL` in Supabase secrets to stable production endpoint.
   - Set `LEAD_NOTIFY_WEBHOOK_BEARER` in Supabase secrets (if endpoint requires bearer auth).
   - Redeploy `lead-capture` function after secrets update.
   - Verify webhook receives lead payload in production while lead DB insert + email notifications still succeed.
