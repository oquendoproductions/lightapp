# Public App Mobile Polish Backlog

Last updated: 2026-05-05

## Goal

Make the shared public mobile app feel intentional, trustworthy, and native enough for real resident use before shifting focus to organization-facing polish.

## Current Baseline

Validated on iOS Simulator against `testcity.cityreport.io`:

- Public map app launches successfully in native runtime.
- Google Maps loads in Capacitor.
- Marker taps and modal flows work.
- Geolocation works.
- Sign in, sign out, and password reset work.
- External links now hand off outside the app.
- Streetlight, pothole, and water/drain reporting work.
- My Reports and Submitted Reports flows work.
- Images render as `View image`.
- Streetlight saved-report mobile layout works.
- App is portrait-only on iPhone.

Known findings from this pass:

- There is no explicit tenant switch mechanism inside the shared native public app.
- A shared public app needs a city-selection or tenant-switch experience before it can scale beyond one pinned test tenant.

## Priority Model

- `P0`: Blocks shared-public-app viability or causes user trust issues.
- `P1`: High-value resident UX improvements that reduce friction.
- `P2`: Nice-to-have polish and native-feel refinement after the core flows are solid.

## P0: Shared-App Foundation

### 1. Native tenant switching / city selection

Why it matters:

- A shared public app cannot stay hard-pinned to one tenant.
- Residents need a clear way to enter the correct city experience.
- QA currently depends on env overrides, which is not a user-facing solution.

Target behavior:

- Public app opens to either:
  - a city picker, or
  - a remembered last-used city with an obvious `Switch city` action.
- Switching cities updates the active tenant cleanly without stale map/report state leaking across tenants.

Likely files:

- [src/main.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/main.jsx)
- [src/tenant/runtimeTenant.js](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/tenant/runtimeTenant.js)
- [src/tenant/TenantContext.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/tenant/TenantContext.jsx)
- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)

Acceptance:

- User can switch from `Test City` to another allowed tenant without reinstalling or rebuilding.
- Header, map data, report forms, My Reports, and alerts/events all refresh to the new tenant.
- Prior tenant’s open popups/modals are cleared on switch.

### 2. Native environment safety guardrail

Why it matters:

- Shared public mobile QA should never accidentally target a live city when the tester intends to use a test city.

Target behavior:

- Optional subtle environment indicator for internal/test builds.
- Easy confirmation of active city before reporting.

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)
- [src/tenant/TenantContext.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/tenant/TenantContext.jsx)

Acceptance:

- Internal/test builds clearly surface the active city context.
- No production-only users see debug/test-only markers.

## P1: Resident UX Polish

### 3. Reporting flow reassurance

Why it matters:

- Residents need confidence that a report was received, associated correctly, and visible in My Reports.

Targets:

- Stronger success state after submit.
- Clear return path into My Reports.
- Better inline status messaging for `Utility reported`, `Is fixed`, and archived/reopen behavior.

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)

Acceptance:

- Every submit/follow-up action ends with a clear outcome and next step.
- Residents never wonder whether the action succeeded.

### 4. My Reports clarity pass

Why it matters:

- This is the resident accountability view; it should feel cleaner than the raw reporting surface.

Targets:

- Reduce cramped/stacked mobile metadata.
- Improve title/subtitle hierarchy consistency across domains.
- Keep streetlights distinct from incident-driven domains.
- Tighten action placement and status readability.

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)

Acceptance:

- Streetlights, potholes, and water/drain each feel intentional but consistent.
- Submitted Reports and My Reports are immediately scannable on phone-sized screens.

### 5. Loading and transition polish

Why it matters:

- WebView apps feel cheap when loading states are abrupt or visually noisy.

Targets:

- Better loading feedback for map boot, reports, auth checks, and tenant changes.
- Cleaner transitions when opening/closing major modals and tool panels.

Likely files:

- [src/main.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/main.jsx)
- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)

Acceptance:

- Fewer abrupt blank or “jump” moments.
- Major flows feel stable on mobile.

## P2: Native Feel Refinement

### 6. Map control ergonomics

Targets:

- Recheck tap target sizes across tool buttons.
- Reduce overlap risk between controls and popups.
- Improve spacing near safe areas / notches where needed.

### 7. Mobile browser header alignment and spacing

Targets:

- Revisit the public map header specifically in mobile browser mode.
- Horizontally align the left logo, centered title stack, and right menu more intentionally.
- Reduce the excess top gap above the header content without introducing new cross-platform regressions.
- Verify the same header treatment on iPad browser, where the misalignment appears less prominently but still exists.

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)
- [src/headerStandards.css](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/headerStandards.css)

### 8. Mobile browser landscape layout pass

Targets:

- Review the public map experience in landscape on mobile browsers.
- Check header/footer balance, map viewport height, and control crowding when the browser chrome reduces usable height.
- Make sure the tab rail, floating controls, and report-count pill still feel intentional in landscape.

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)
- [src/headerStandards.css](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/headerStandards.css)
- [src/MunicipalityApp.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MunicipalityApp.jsx)

### 9. Native shell branding

Targets:

- App icon
- splash / launch screen polish
- app display name review

Likely files:

- [ios/App/App/Assets.xcassets](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios/App/App/Assets.xcassets)
- Android launcher assets under the generated native project

### 10. Native permission messaging polish

Targets:

- Friendlier location-permission explanation
- Better fallback messaging when location is denied

### 11. Icon-first action controls

Targets:

- Replace repeated, space-consuming text actions with recognizable icon buttons where the meaning is unambiguous.
- Prioritize reporter info, fly to location, view reports, view location info, and update status/state controls.
- Keep text for consequential or ambiguous actions such as submit, save, delete, and cancel.
- Every icon action must retain a tooltip and an accessible label; tap targets must meet mobile sizing requirements.
- Use one shared icon language across resident and admin surfaces so the same action always has the same symbol.

Acceptance:

- Repeated map, report, and admin actions are quicker to scan and use on small screens.
- No action becomes discoverable only by visual icon recognition: tooltip, accessible name, and clear feedback remain available.

### 12. Navigate to report / asset location

Targets:

- Add a `Navigate` action on marker and report detail surfaces that opens the device’s native mapping app with directions from the user’s current location to the selected marker.
- Prefer a platform-aware handoff: Apple Maps on iOS, Google Maps or the device default on Android, and a browser-compatible mapping fallback on web.
- Treat turn-by-turn navigation inside CityReport as a later, separately scoped option; it has substantially more map, routing, battery, and safety implications.
- Handle missing location permission and invalid marker coordinates with clear fallback messaging.

Acceptance:

- A resident or administrator can start directions to any report/asset with a single explicit action.
- The action never exposes the reporter’s private location; it routes only to the selected public marker/asset coordinates.

## Recommended Working Order

1. Build the native tenant switch / city picker.
2. Add a subtle internal-test environment guardrail.
3. Do a reporting success / follow-up confidence pass.
4. Do a My Reports readability pass.
5. Do a loading/transition polish pass.

## First Implementation Slice

## 2026-07-22 Addendum: Deferred Follow-Ups

### 11. Resident public report browsing with safe community moderation

Why it matters:

- Residents should be able to understand what others are reporting nearby without exposing reporter identity.
- Public images and notes need stronger trust-and-safety handling before this becomes a default resident surface.

Targets:

- Let residents browse other public reports and attached images.
- Redact reporter name, email, phone, and any other identifying metadata from resident-facing views.
- Add a resident-facing `Flag as` moderation entry point for inappropriate images/content.
- Route community flags into the existing moderation/admin review workflow instead of inventing a separate system.

Implementation note:

- Treat this as a next-version feature, not a same-pass polish tweak. It needs visibility rules, redaction guarantees, moderation UX, and policy review together.

Likely files:

- [src/mapLazyOpenReportsResidentListPanel.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/mapLazyOpenReportsResidentListPanel.jsx)
- [src/mapLazyOpenReportsModal.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/mapLazyOpenReportsModal.jsx)
- [src/mapLazyReportInspectors.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/mapLazyReportInspectors.jsx)
- [src/lib/mapDeferredAbuseSupport.js](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/lib/mapDeferredAbuseSupport.js)

Acceptance:

- Residents can browse community-visible reports without seeing reporter identity.
- Public images can be flagged by residents and reviewed by admins.
- Inappropriate content does not rely on manual DB cleanup as the primary control path.

### 12. Move navigation action into a drawer-style control

Why it matters:

- The navigation action competes with other floating controls.
- A drawer treatment could make it feel more intentional and consistent with the streetlight bulk-save drawer pattern.

Targets:

- Evaluate moving the navigation button into a drawer or grouped control pattern.
- Keep the primary map interaction area cleaner on phone-sized screens.

Implementation note:

- Treat as a later UX pass. This is a layout/control-model change, not a quick cleanup.

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)
- [src/mapLazyMobileActionBars.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/mapLazyMobileActionBars.jsx)

### 13. Split tenant menu and CityReport menu branding

Why it matters:

- Using the tenant logo as the tenant menu trigger and the CityReport logo as the platform menu trigger could make the navigation model clearer.
- This also affects branding hierarchy, not just button placement.

Targets:

- Explore replacing the current menu-button image with the tenant logo for tenant actions.
- Explore making the CityReport logo open a separate CityReport-level menu.

Implementation note:

- Keep this for a later branding/navigation pass after the core mobile IA is stable.

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)
- [src/headerStandards.css](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/headerStandards.css)

### 14. Report-history visual identification policy

Why it matters:

- People reviewing a report history need to distinguish an original issue, state update, fix, reopening, and other activity at a glance.
- The treatment must add clarity without relying on color alone or creating a visually noisy timeline.

Targets:

- Define one shared visual policy for report-history card types: issue report, state update, fix/repair confirmation, reopen, and working/action entries.
- Use a restrained combination of card tint or border treatment, icon, and explicit text label; preserve readable contrast and accessibility.
- Apply the same policy across mobile and desktop report-history surfaces.

Acceptance:

- Each history-card type is immediately recognizable while dates, titles, and details keep the same consistent hierarchy.
- Meaning remains clear for color-blind users and in low-quality screenshots.

### 15. Non-scrollable marker info-window layout

Why it matters:

- A tall marker info window can extend into the app header and hide map status counters or controls.
- Internal scrolling inside a small marker card makes the core information and actions harder to scan and conflicts with the map gesture area.

Targets:

- Establish one shared, non-scrollable layout policy for public and admin marker info windows.
- Keep every popup fully below the app header and clear of the bottom navigation rail; it must never render in front of, behind, or above the header.
- Preserve a consistent information hierarchy across domains while avoiding domain-specific copy/spacing hacks.
- Coordinate this with the icon-first action-controls pass: replace repeatable secondary text buttons with accessible icon actions where appropriate, keeping text for consequential actions.
- If a domain genuinely exceeds the shared card budget, move secondary details/actions into a dedicated sheet or detail view instead of making the info window scroll.

Acceptance:

- No marker info window scrolls internally on phone-sized screens.
- The header, in-view counters, and primary map controls remain visible and usable while an info window is open.
- Long streetlight and incident cards retain the same shared visual structure as shorter domain cards.

Recommended next slice:

- Add a public-app city switcher for native runtime.

Why this first:

- It is the biggest remaining structural gap for a shared public app.
- It removes the need to rebuild or edit env vars just to move between cities.
- It makes every subsequent public-app QA pass more realistic.

Definition of done for this slice:

- Native public app can switch tenants in-app.
- Last selected tenant persists.
- Switching tenants fully refreshes the public map experience.
- Testers can move between `testcity` and another tenant safely without touching live reporting unintentionally.
