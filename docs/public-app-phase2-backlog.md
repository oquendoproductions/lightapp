# Public App Phase 2 Backlog

Last updated: 2026-04-23

## Goal

Move from "native shell that works well" to "resident product that feels intentional, trustworthy, and ready for broader rollout."

## Phase 1 Complete

The shared public app now has the core Phase 1 foundation in place:

- Native iOS public app shell is running cleanly.
- Google Maps loads in native runtime.
- Reporting works across streetlights, potholes, and water/drain.
- Reports, Account, Alerts, Events, and Notification Preferences now behave like app pages instead of old-style popups.
- External links hand off outside the app.
- Tenant switching works in-app without stale map/report data.
- First-run city selection exists for unpinned native public builds.
- Startup, menu, and tab navigation now read like a real mobile app.

## Phase 2 Themes

### 1. Onboarding and First-Use Experience

Focus:

- Make the post-city-selection journey feel guided instead of self-directed.
- Help new residents understand what to do first.
- Clarify when guest use is fine and when account creation is valuable.

Questions to answer:

- What should a resident see immediately after choosing a city?
- Should the app coach users toward reporting, exploring, or creating an account first?
- When should we prompt sign-in without creating friction?

Potential work:

- First-use welcome sheet after city selection
- guided in-app highlight tour for tabs and map tools, with skip/dismiss behavior
- clearer explanation of `Reports`, `Alerts`, and `Events`
- account creation prompt at the right moment instead of too early
- optional `Sign in` entry point on the city-selection screen before guest exploration
- future onboarding action set should include `Sign In`, `Create Account`, and `Explore as Guest`
- polish the current lightweight onboarding into a guided app tour when the flow is ready for a fuller design pass

Likely files:

- [src/AppLaunchScreen.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/AppLaunchScreen.jsx)
- [src/tenant/TenantContext.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/tenant/TenantContext.jsx)
- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)

### 2. Resident Confidence and Follow-Through

Focus:

- Make the app feel more accountable after a resident takes action.
- Improve the "what happens next?" feeling after report submission and follow-up.

Potential work:

- richer success states after reporting
- clearer status explanations in Reports
- stronger differentiation between active, archived, and fixed states
- better explanation of saved streetlights vs incident reports
- bulk save flow that can support different streetlight issue types in one session, without slowing the user down
- admin `Create` / `Edit` buttons and authoring flows for `Alerts` and `Events` when the user has the right permission
- hub alert/event authoring should return to the alert/event view after save:
  - when creating an alert or event from the hub, successful save should close the create flow
  - user should land back on the relevant Alerts or Events view instead of remaining in an editor/saved state
- proper moderation actions for open abuse/anomaly flags:
  - first acknowledgement slice implemented: admins can acknowledge open flags with an optional note, removing them from the active count while preserving history
  - local moderation UI should treat acknowledgement as an explicit close/review action so admins understand the outcome
  - improve mobile-friendly flag formatting beyond the current card/table baseline
  - future reviewed/history view for acknowledged flags
  - future temporary allow / override flow for legitimate actors or sessions
  - add a PCP/dev-side per-tenant moderation report view so platform staff can review open/closed flag activity across municipalities
  - continue preserving audit trail for who acknowledged, cleared, or overrode a flag and why
- review current abuse thresholds for legitimate bulk-save behavior:
  - confirm whether `unit_limit_pressure` and `single_bulk_spike` are too aggressive for real field use
  - consider raising unit thresholds or separating admin/tester behavior from public abuse signals
  - make sure quality high-volume reporting is not treated like suspicious use by default

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)
- abuse / moderation SQL views, policies, and helper functions under [supabase](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/supabase)

### 3. Notification and Identity Strategy

Focus:

- Decide how residents should think about account value over time.
- Make notification settings feel like part of a bigger resident relationship, not just toggles.

Potential work:

- profile/account expansion beyond basic settings
- clearer notification topic language
- future path for text/email strategy
- potential "follow city" or "follow asset" concepts
- location switcher should default to followed cities only; guests and users with no followed cities should search instead of seeing every tenant
- true user-level `home org` / home city preference in Supabase, with Account settings to edit it
- signed-in bootstrap behavior that can prefer the user’s home org when appropriate

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)

### 4. Native Feel and Presentation Polish

Focus:

- Reduce remaining "web app in a wrapper" feel.
- Improve visual consistency and delight.

Potential work:

- app icon refinement
- splash/launch polish
- better loading transitions between major app states
- motion and transition cleanup
- typography/spacing pass for small-screen readability

Likely files:

- [src/AppLaunchScreen.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/AppLaunchScreen.jsx)
- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)
- [ios/App/App/Assets.xcassets](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios/App/App/Assets.xcassets)

### 5. Platform Readiness and Rollout Prep

Focus:

- Prepare for broader testing and future release workflows.
- Plan the configurable platform surface that lets CityReport support new organizations without hard-coded one-off work.

Potential work:

- Android parity pass
- performance cleanup in large map bundles
- analytics/crash reporting plan
- store asset and metadata planning
- broader QA checklist for multi-city public use
- PCP developer workflow for adding new report domains to an organization:
  - domain creation/configuration should live in PCP, not the public app or Hub
  - choose whether the domain is incident-driven, asset-backed, area-based, or another supported aggregation model
  - choose resident-facing label, icon, map marker treatment, report form fields, and visibility settings
  - for asset-backed domains, support adding/importing asset coordinates and metadata
  - explicitly classify asset ownership/management, such as `org-managed`, `utility-managed`, or third-party managed
  - make the ownership model drive resident language, utility/report handoff behavior, and admin accountability expectations
- Hub-managed resident menu links:
  - organization users should manage these from the Hub, not PCP
  - let orgs add menu rows such as trash pickup schedule, bulk trash pickup, snow parking rules, permit links, contact pages, or other public information
  - support label, icon, URL/action type, sort order, enabled/disabled state, and optional audience/visibility controls
  - render these links in the public app menu without requiring a code deploy for each org
  - implementation spec: [docs/hub-resident-menu-links-spec.md](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/docs/hub-resident-menu-links-spec.md)
- street-closure map overlays connected to Alerts:
  - when creating an alert, allow authorized org users to mark affected road segment(s) or route shapes on the map
  - show closures on the public map with clear closed/affected-road styling
  - include closure metadata such as start/end dates, affected lanes, detour notes, reason, and related alert details
  - support multiple affected segments per alert
  - ensure expired closures leave the public map automatically when the alert expires or is archived
  - keep this compatible with future notifications so residents can be alerted when a closure is published or updated

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)
- [src/MunicipalityApp.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MunicipalityApp.jsx)
- [src/PlatformAdminApp.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/PlatformAdminApp.jsx)
- [package.json](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/package.json)
- generated native projects under [ios](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios) and [android](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/android)
- future Supabase tables/functions for PCP-managed configurable domains, domain assets, Hub-managed organization menu links, and alert-linked map overlays

### 6. Resident Incentives and Progression

Focus:

- Encourage residents to keep reporting and following through.
- Reward quality, consistency, and confirmed impact instead of pure quantity.

Potential work:

- achievement goals
- points structure
- badges
- levels or progression milestones
- quality-weighted scoring so useful reporting matters more than spam
- future tie-ins to follow-through actions like repair confirmations or verified updates

Likely files:

- [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx)
- future profile/account surfaces
- future Supabase tables/functions for points, badges, and progression state

## Priority Model

- `P0`: Needed to make the app understandable and adoptable for first-time residents.
- `P1`: High-value improvements that deepen trust and retention.
- `P2`: Native-feel and release-readiness polish.

## Recommended Order

1. Onboarding and first-use flow
2. Resident confidence after reporting
3. Notification/identity strategy
4. Native presentation polish
5. Platform and rollout prep

## First Phase 2 Slice

Recommended first slice:

- Define and implement the post-city-selection onboarding flow.

Why this first:

- It is the first true resident-product layer after Phase 1.
- It improves adoption without requiring deep backend or org-facing work.
- It sets the tone for reporting, saving, and account creation.

Definition of done for this slice:

- After choosing a city, a new resident gets a clear first-use experience.
- The app explains what the core tabs are for in plain language.
- The app nudges residents toward the best next action without forcing account creation too early.

## Follow-on Notes

- Keep the current lightweight onboarding for now, but plan a later upgrade into a guided highlight tour inside the live app chrome.
- Treat `home org` as part of the broader identity/preferences model, not as a small onboarding tweak.
