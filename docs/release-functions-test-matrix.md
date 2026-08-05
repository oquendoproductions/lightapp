# CityReport Release Functions Test Matrix

**Status:** Release gate — complete every applicable row before store submission.  
**Rule:** A row only passes when it is verified on a fresh session and after normal tab/tenant navigation. Record the tenant, test identity, device/browser, and evidence link beside any failure.

## 1. The Access Model Under Test

These are independent axes. Do not collapse them into a generic “admin” test.

| Axis | Variants | Expected boundary |
| --- | --- | --- |
| Actor | Platform admin; tenant admin/employee; signed-in resident; signed-out public visitor | Permissions and data exposure must be role-appropriate. |
| Domain relationship | Tenant-managed; non-managed | A tenant employee gets managed-domain access only. Non-managed domains mirror the public view. |
| Record model | Incident-driven; asset-backed | Incident reports and utility/asset flows retain their own identifiers, actions, and visibility rules. |
| Visibility | Below public threshold; at/above public threshold; resolved/fixed | Public and non-managed views use public exposure rules. Managed-domain staff see authorized internal detail. |

### Current policy to verify

- **Tenant-managed domain:** authorized tenant staff can view its incidents and authorized report details.
- **Non-managed domain:** tenant staff see the same publicly exposed marker/card data as a resident, plus their own eligible reports; they do not gain private report details merely by being tenant staff.
- **Public visitor:** sees only records meeting the public confidence/visibility rule.
- **Asset-backed domain:** asset identifiers and asset actions are not substituted with an incident/report identifier.
- **Incident-driven domain:** incident ID is the consistent lookup key; the report number identifies an individual submitted report.

## 2. Required Test Fixtures

Prepare the following before testing. Use predictable labels/notes so each result is traceable.

- One **tenant-managed, incident-driven** domain with: one below-threshold incident, one publicly visible incident, one resolved incident, and a report containing every reporting field.
- One **non-managed, incident-driven** domain with the same visibility cases.
- One **tenant-managed, asset-backed** domain (for example Streetlights) with a saved asset, utility-reported asset, resident report, and location/utility action.
- One **non-managed, asset-backed** domain if the current tenant offers one; otherwise mark N/A and document why.
- A platform-admin account, a Test City tenant-admin/employee account, a resident account that has submitted reports, a different signed-in resident account, and a logged-out/private-browser session.
- At least two tenants, so cross-tenant notification and tenant switching can be verified.

## 3. Core Map and Visibility Matrix

Run every applicable cell for both a fresh load and after visiting Map → Reports → Notifications/Alerts/Events → Map.

| # | Actor / relationship / model | Verify | Pass condition |
| --- | --- | --- | --- |
| M1 | Platform / managed / incident | Marker and info window | All authorized incidents render; detail, report count, state actions, and report navigation are available. |
| M2 | Tenant staff / managed / incident | Marker and info window | Same authorized managed-domain result as intended for tenant staff. |
| M3 | Tenant staff / **non-managed** / incident | Marker and info window | Matches public visibility and public-safe information exactly; no internal report count/detail/action leaks. |
| M4 | Resident / own report below threshold | Marker and info window | Own eligible report remains discoverable according to the resident visibility rule; no other private reports appear. |
| M5 | Public / incident below threshold | Marker and info window | No marker or report detail is exposed. |
| M6 | Public / incident at threshold | Marker and info window | Marker appears with the intended public fields and public actions only. |
| M7 | Public + tenant staff / resolved incident | Marker refresh behavior | Visibility follows that domain’s configured likely-fixed/resolved threshold; clicking must never make a still-eligible marker disappear. |
| M8 | Any / asset-backed | Asset info window | Correct asset ID, owner/utility state, save/report/location actions, and no accidental incident-ID replacement. |
| M9 | Any | Cluster behavior | Tapping a cluster zooms enough for that cluster to break into smaller clusters and/or markers; no dead tap. |
| M10 | Any | Map controls | GPS, satellite/base-map, locate, boundaries, legend, and disabled PCP tools behave correctly. A disabled tool is absent from both controls and legend. |

## 4. Reporting-Flow and PCP Configuration Matrix

For each configured domain, verify all reporting fields in their saved PCP order.

| # | Verify | Pass condition |
| --- | --- | --- |
| R1 | Domain appears only when enabled for reporting | Disabled/non-reportable domain cannot enter resident reporting flow. |
| R2 | Boundary restriction | Reporting outside a required boundary is blocked with the correct message; valid in-bound report succeeds. |
| R3 | Photo configuration | Optional, allowed, and required photo policies are enforced exactly as configured. |
| R4 | Disclosures | Tenant and global disclosures appear in correct order; required acknowledgement blocks submission until accepted. |
| R5 | Reporting fields | Every PCP reporting field renders, in PCP order, using its **Field Label** as the dropdown title. |
| R6 | Choices | Each dropdown contains only that field’s configured choices; the user’s selected value is saved. |
| R7 | Empty configuration | A domain with no reporting fields does not show a generic “Issue Type: Unavailable” field. |
| R8 | Submission | Creates exactly one report and one incident association; double taps/retries do not duplicate either. |
| R9 | Result consistency | Info window, incident report view, Reports tab cards, exported data, and macros use the same field labels/values. |
| R10 | PCP edits | Add, remove, rename, and reorder reporting fields; after save and fresh load, the resident flow and views match the change. |

## 5. Reports Tab and Handoff Matrix

Repeat each test at least four times, including after switching Map, Account, Notifications, Alerts, and Events.

| # | Entry point | Pass condition |
| --- | --- | --- |
| T1 | Reports tab from every bottom-nav tab | Existing search and filters persist exactly until the user changes or resets them. Report results never silently become empty. |
| T2 | Reset button | Restores **All domains**, all statuses, all dates, and blank search in one action; it never leaves an empty domain selection. |
| T3 | Manual incident-ID search | Apply, clear, re-apply, and reset work repeatedly without refresh. Search returns exactly one incident group when its ID is valid. |
| T4 | Info-window View Report / All Reports | Opens Reports with the target incident ID, correct domain, status All, and all-date range; exactly the target incident group is visible. |
| T5 | Notification “View” for report update | Uses the same handoff contract as T4, including tenant switching when needed. |
| T6 | My Reports vs All Reports | Each intended scope is correct; no obsolete “Admin Reports” surface exists on web. |
| T7 | Incident grouping | One incident produces one card/group. One report number appears once in its report history—never doubled or tripled. |
| T8 | Report detail | Current field labels/values match the map info window; notes contain only resident-entered notes. Reporter identity is correct for authorized staff. |
| T9 | Dates/sort/filter | Date range, status, domain selector, sort, and clear/reset stay correct after navigation. |

## 6. Notifications Matrix

Check both the Notification tab and native device notification delivery where the user preference permits it.

| # | Scenario | Pass condition |
| --- | --- | --- |
| N1 | Resident report status/state update | In-app notification is created and native push is delivered when enabled. |
| N2 | Push wording | Title: `Report Status Update`; then domain; then `REPORT-NUMBER — STATUS`. |
| N3 | In-app wording | Clearly states `Your reported issue has been …`; shows domain and actual incident ID. |
| N4 | Cross-tenant report notification | Clicking changes to the notification’s tenant, opens Reports, applies the incident handoff, and opens the targeted report. |
| N5 | Event notification | In-app + push delivery; click switches tenant then opens the targeted Event without an intermediate map flash. |
| N6 | Alert notification | Same contract as N5 for Alerts. |
| N7 | Order and badges | Newest notifications are first. Alert and Event unread badges are present and clear once viewed. |
| N8 | Read/unread/delete | Card swipe visibly tracks the finger: right reveals Mark read/unread; left reveals Delete. Read state changes; delete requires confirmation. |
| N9 | Preferences | Every user-visible notification type has a categorized preference. Preferences persist and do not refresh/reset while viewing the page. |

## 7. Tenant and Platform Administration Matrix

| # | Actor | Verify | Pass condition |
| --- | --- | --- | --- |
| A1 | Platform admin | Tenant/domain configuration | Can manage platform-approved global settings and inspect tenant configuration without accidental tenant-data mutation. |
| A2 | Tenant admin | Tenant customizations | Can edit allowed branding, domain disclosures, field labels/choices/order, map tools, colors, alert/event categories, and notification settings. |
| A3 | Tenant admin | Authorization boundary | Cannot modify platform-only controls or another tenant’s configuration/data. |
| A4 | Tenant employee | Assigned access | Can do only assigned report/state work and sees managed vs non-managed domains by the policy above. |
| A5 | Tenant admin | PCP save/load | Every saved setting survives refresh, a private session, and an iOS/web reload; no stale fallback icon/config flashes. |
| A6 | Tenant admin | Alerts/events editor | Add/edit/remove category and publish workflow function; published content is delivered according to audience preferences. |
| A7 | Platform + tenant | Audit/error behavior | Expected permission denials are handled cleanly with no white screen, restart, or mixed-tenant state. |

## 8. Resilience and Release Regression Tests

| # | Test | Pass condition |
| --- | --- | --- |
| G1 | Cold iOS start and mobile Safari private start | Correct tenant/map shell loads; no old icons replaced by new icons, white screen, or generic fallback tenant after data loads. |
| G2 | Repeat navigation | Perform Map → marker → View Report → Reports → Notifications → Alerts → Events → Account → Map ten times. No empty reports, restart, lag buildup, or wrong tenant/tab. |
| G3 | Tenant switch stress | Switch tenants repeatedly, including via cross-tenant notification. No automatic unintended Reports opening, stale data, or load failure. |
| G4 | Slow network | Throttle/poor connection during map, reports, tenant switch, and notification handoff. Loading surface resolves or provides a recoverable error—never a blank/white screen. |
| G5 | Fresh/private session | No stored session/cache is required for correct domains, icons, configuration, or public visibility. |
| G6 | Native device | Build/install target is the intended production/TestFlight build, notifications have OS permission, and device receives expected pushes. |
| G7 | Data integrity | Create one report in each fixture domain; confirm no duplicate report, incident, notification, or marker records. |

## 9. Sign-off Sheet

| Area | Web | iOS | Platform | Tenant Admin | Resident | Evidence / notes | Sign-off |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Map & visibility | ☐ | ☐ | ☐ | ☐ | ☐ |  |  |
| Reporting flow & PCP | ☐ | ☐ | ☐ | ☐ | ☐ |  |  |
| Reports & handoffs | ☐ | ☐ | ☐ | ☐ | ☐ |  |  |
| Notifications | ☐ | ☐ | ☐ | ☐ | ☐ |  |  |
| Tenant/platform admin | ☐ | ☐ | ☐ | ☐ | ☐ |  |  |
| Resilience/regression | ☐ | ☐ | ☐ | ☐ | ☐ |  |  |

## Current Submission Blockers

- [ ] Marker persistence after “reported fixed” matches each domain’s configured likely-fixed threshold and never disappears only because it was tapped.
- [ ] Complete this matrix for at least one tenant-managed incident domain, one non-managed incident domain, and Streetlights/another asset-backed domain on both web and iOS.
- [ ] Capture the store-submission build/version, privacy declarations, reviewer credentials, and review notes separately.
