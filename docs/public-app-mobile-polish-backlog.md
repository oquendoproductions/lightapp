# Public App Mobile Polish Backlog

Last updated: 2026-04-18

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

### 7. Native shell branding

Targets:

- App icon
- splash / launch screen polish
- app display name review

Likely files:

- [ios/App/App/Assets.xcassets](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios/App/App/Assets.xcassets)
- Android launcher assets under the generated native project

### 8. Native permission messaging polish

Targets:

- Friendlier location-permission explanation
- Better fallback messaging when location is denied

## Recommended Working Order

1. Build the native tenant switch / city picker.
2. Add a subtle internal-test environment guardrail.
3. Do a reporting success / follow-up confidence pass.
4. Do a My Reports readability pass.
5. Do a loading/transition polish pass.

## First Implementation Slice

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
