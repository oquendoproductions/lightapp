# App Review Functional QA Checklist

Use this as the go/no-go record for a tenant before external review. Mark each item `pass`, `fail`, `blocked`, or `not applicable`; attach a screenshot, report number, or issue link for every failure.

## Test setup and evidence

- [ ] Record the app build/version, production URL, tenant, tester, device/OS/browser, and time zone.
- [ ] Test at least: a new/private resident session, a signed-in resident, a tenant administrator, and a platform administrator.
- [ ] Test on current iPhone/iOS, an Android device, and desktop Chrome/Safari at a minimum.
- [ ] Create a named test report for every active domain. Do not use a real resident's data.
- [ ] Have one test point inside the tenant boundary, one outside it, and (where parks exist) one inside and one outside a park.
- [ ] Record the configuration for every active domain before testing: visibility, display label, marker/icon colors, photo policy, road/park rule, type options, disclosures, routing, and confidence thresholds.

## 1. Resident/public map — startup and navigation

- [ ] Fresh private-browser load shows the published icon set only; legacy icons never flash before the map settles.
- [ ] Tenant name, logo, boundary, base map, markers, header, menu, and bottom navigation load without a white screen or console error.
- [ ] Tenant/city routing works from the expected production hostname and from the city picker where applicable.
- [ ] Map starts at the intended tenant extent and does not expose another tenant's records.
- [ ] Street-map/satellite toggle works in both directions.
- [ ] Zoom, pan, rotation/reset-heading (where available), home/recenter, and full-screen controls work without moving UI out of place.
- [ ] My Location requests permission clearly; approved GPS recenters accurately; denied/unavailable GPS shows a useful non-blocking state.
- [ ] Navigation/Travel Follow is absent when its PCP **Show In Live UI** setting is off; it is present and works only when intentionally enabled.
- [ ] Light/dark appearance keeps map controls, labels, markers, and disclosures readable.
- [ ] Slow network, offline return, app background/foreground, and tenant switch recover without a crash, stale tenant data, or permanent loader.

## 2. Resident/public map — shared reporting flow

Run these once for each active domain using the domain matrix below.

- [ ] Domain appears only when active/public for this tenant; hidden or disabled domains cannot be reached through layer controls, deep links, or a stale session.
- [ ] Domain label, icon, marker color, high-confidence marker treatment, and icon tint match the tenant configuration and are legible on both map styles.
- [ ] Domain layer/filter shows the intended records and correct incident count; switching layers does not leak records from another domain.
- [ ] Map-tap reporting opens the correct domain picker/form and preserves the chosen location.
- [ ] Outside-tenant-boundary tap is blocked with the correct message; an inside-boundary tap can proceed.
- [ ] If **road required** is on, an off-road point is blocked and a road point can proceed. If off, neither point is incorrectly blocked.
- [ ] If **park required** is on, an out-of-park point is blocked and an in-park point can proceed. If off, neither point is incorrectly blocked.
- [ ] Every configured disclosure appears at its selected position, in the right order, with correct title/body.
- [ ] A required disclosure blocks continuation until acknowledged; informational disclosures do not incorrectly block submission.
- [ ] If photos are disabled, no photo picker is shown and a report can proceed without a photo field.
- [ ] If photos are optional, the picker accepts a valid photo, preview/remove works, and submission works both with and without a photo.
- [ ] If photos are required, Continue/Submit is blocked without a photo and succeeds with one.
- [ ] Required fields, type options, validation messages, accessibility labels, cancel/back behavior, and duplicate protection work as configured.
- [ ] Successful submit returns a visible confirmation and a report/incident identifier; retrying after a network interruption does not create an unintended duplicate.
- [ ] The submitted report shows correct tenant, domain, location, reporter-visible fields, notes, photo status/link, timestamp, and state in My Reports.
- [ ] Correct routing/notification is received by the configured tenant/domain destination; CC recipients and message templates are correct where configured.

## 3. Active-domain matrix

Complete one row for every domain activated for the review tenant. `N/A` is valid only if the capability is not configured for that domain.

| Domain | Public visibility | Marker / info marker | Road rule | Park rule | Photo policy | Disclosures | Form/type options | Submission + routing | My Reports / marker detail | Result / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Streetlights (Utility-owned) | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Street Signs | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Potholes | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Water / Drain Issues | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Power Outage | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Water Main | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Downed Tree | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Encampment | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Illegal Dumping | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Graffiti | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Park Equipment | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |
| Tenant-specific/custom domain: __________ | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | |

For every populated row, verify marker details separately:

- [ ] Marker/cluster appears in the correct geographic position and has a usable tap target.
- [ ] Detail view shows the correct domain label, public incident ID, status/state, report count, latest activity, and location/address/coordinates.
- [ ] Resident-only actions (report, fixed/repair confirmation, zoom, follow/save) appear only when applicable and persist correctly after refresh.
- [ ] Marker state, color, and high-confidence treatment change only at the configured thresholds.

## 4. Resident account, communications, and records

- [ ] Sign-up, sign-in, sign-out, password reset/change, and account deletion disclosure behave correctly.
- [ ] My Reports lists only the signed-in resident's eligible reports, supports search/filter/sort, and opens the right detail/location view.
- [ ] Resident repair/fixed acknowledgement works only where allowed and remains correct after reload.
- [ ] Alerts, events, and notifications obey tenant settings; unread badges, opening, links/CTAs, and read state work.
- [ ] Resident menu links show only to their configured audience, are ordered by section, and open the correct website/phone/email target.
- [ ] Legal, privacy, contact, accessibility, and support links are current and work from both web and native iOS.

## 5. Tenant hub / tenant administrator

Run as a tenant administrator and as a lower-permission employee to verify both positive and denied paths.

### Current hub functions

- [ ] Hub access is denied to residents and tenants other than the active tenant.
- [ ] Home/inbox/report queues show only active-tenant records and report counts match the public/admin data.
- [ ] Report filters, search, detail, export, and permitted state changes work; an unauthorized role cannot update state.
- [ ] Alerts and events: create/edit/publish/schedule/unpublish/delete, audience, dates, CTA, and public-map presentation work end to end.
- [ ] Organization profile/general settings save and render in the resident-facing header where applicable.
- [ ] Assets: permitted staff can add/edit/delete only their tenant's assets; public markers update correctly.
- [ ] Resident menu: section/link CRUD, sort order, audience restriction, and website/phone/email targets work in the public app.
- [ ] Report digests: recipient, frequency, status, test send, history, and pause behavior work as configured.
- [ ] Calendar, departments, employees, roles, permissions, and security PIN/challenge work; denied users cannot bypass controls via direct URL/API.
- [ ] Visual Appearance: boundary visibility, outside shade, opacity, border color, and width save, survive refresh, and match the resident map.

### Required tenant-customization decision before review

The hub currently provides **Visual Appearance** for boundary/shade presentation. It does **not** yet provide the tenant-domain controls below; they currently live in the Platform Control Panel.

Recommended ownership:

| Setting | Recommended owner | Rationale |
| --- | --- | --- |
| Global domain catalog, allowed domain type, platform-wide icon set, platform safety defaults | Platform admin | Avoids tenants redefining shared product behavior or assets. |
| Tenant domain activation/visibility, display label, marker and high-confidence colors, icon tint | Tenant admin with permission | Tenant-specific public presentation. |
| Tenant photo policy, road/park placement rule, type options, thresholds, department/email routing | Tenant admin with permission; platform can lock defaults | Operational policy varies by municipality. |
| Tenant-specific disclosures and required acknowledgement | Tenant admin with permission | Local legal/operational language must be editable and testable by the organization. |
| Global disclosures inherited by all tenants | Platform admin | Maintains required platform-wide policy. |

Before release, choose one path and test it end to end:

- [ ] **Path A — Hub ownership:** implement a Tenant Domains settings section in the hub for the tenant-owned settings above, enforce role/PIN protection and tenant-scoped RLS, and then run the propagation checks below.
- [ ] **Path B — Platform ownership for this release:** document that domain customization is platform-admin managed, remove/avoid tenant-facing promises that imply self-service, and test the PCP-to-public propagation checks below.

### Customization propagation checks (required for either path)

For one active non-default domain, change one setting at a time and verify all three surfaces: saved configuration, fresh private resident session, and hub/admin view.

- [ ] Activate/deactivate or change public visibility.
- [ ] Change display label, marker color, high-confidence color, icon mode/tint.
- [ ] Toggle photo allowed and photo required.
- [ ] Toggle road required and park required.
- [ ] Add/edit/remove an informational disclosure and a required acknowledgement at each supported position.
- [ ] Change type options, notification destination/CC/template, and reporting threshold.
- [ ] Verify save success, refresh persistence, permission denial, audit record where expected, and no cross-tenant effect.

## 6. Platform Control Panel

- [ ] Tenant lifecycle: create/edit/activate/deactivate tenant, hostname/subdomain, boundary, pilot status, and hub enablement behave correctly.
- [ ] Tenant assignments: each active domain has the intended visibility, public label, routing, operational ownership, and domain configuration.
- [ ] Domain registry: global defaults, type options, global disclosures, and icon metadata only affect the intended tenants.
- [ ] Map UI icons/theme: draft vs published states are clear; **Publish Live** changes a fresh resident session atomically without old/new icon flashing.
- [ ] The `Show In Live UI` control hides its related map option after publish; specifically confirm Navigation/Travel Follow stays absent when disabled.
- [ ] Map features and boundary presentation save and are isolated per tenant.
- [ ] Roles, permission catalog, platform security checkpoints, audit records, and platform-team assignment enforce least privilege.
- [ ] Platform admin cannot accidentally expose private tenant reports, user data, or one tenant's configuration to another.

## 7. Reliability, privacy, and review package

- [ ] Production web build passes; iOS map target is prepared, installed, and smoke-tested on a physical iPhone.
- [ ] Production database migrations and required Edge Functions are deployed; required secrets and notification destinations exist.
- [ ] Rate limits, duplicate prevention, file upload limits/type validation, and error handling are exercised with an expected failure and recovery path.
- [ ] Verify unauthorized API/RPC/storage attempts fail for resident, tenant employee, tenant admin, and cross-tenant sessions.
- [ ] Privacy policy, terms, disclosures, photo retention/visibility, and contact/support information match actual behavior.
- [ ] No console errors, failed network requests, sensitive logs, placeholder copy, broken links, or clipped UI remain in the review path.
- [ ] Capture final evidence: public URL, hub URL, PCP screenshots, one report per active domain, notification evidence, role-denial evidence, iOS screenshots, and known-issues list.

## 8. Go / no-go sign-off

- [ ] All applicable checks pass, or every exception has an owner, severity, mitigation, and reviewer approval.
- [ ] Tenant customization ownership path (Hub or PCP) is chosen and documented.
- [ ] Product owner approval: ____________________ Date: __________
- [ ] Tenant/operations approval: _______________ Date: __________
- [ ] Engineering approval: ______________________ Date: __________
- [ ] Legal/privacy approval (if required): _______ Date: __________
