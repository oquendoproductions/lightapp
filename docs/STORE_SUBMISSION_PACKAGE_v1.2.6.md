# CityReport.io Store Submission Package — v1.2.6 (7)

Prepared: 2026-07-30  
Release status: **pre-submission; do not submit until every Release Blocker below is closed**

## 1. Release identity

| Store | App name | Identifier | Store version | Build / version code |
| --- | --- | --- | --- | --- |
| Apple App Store | CityReport.io | `cityreport.io.app` | `1.2.6` | `7` |
| Google Play | CityReport.io | `cityreport.io.map` | `1.2.6` | `7` |

The JavaScript package version and both native targets are aligned to this candidate. Increment the build/version code for every later upload, even if the marketing version remains `1.2.6`.

## 2. Store listing copy

Use this as the initial listing draft. Final wording should be checked against the exact functionality enabled for the submitted production build.

### Apple App Store

- App name: `CityReport.io`
- Subtitle: `Report Local Issues`
- Primary category: `Utilities`
- Secondary category: `Productivity`
- Keywords: `community,city,report,issues,streetlight,pothole,graffiti,water,alerts,events`
- Support URL: `https://cityreport.io/` until a dedicated public support page is published
- Marketing URL: `https://cityreport.io/`
- Privacy Policy URL: `https://cityreport.io/legal/privacy`

**Description**

CityReport.io helps residents report non-emergency community issues to participating cities, utilities, and local organizations.

Use the interactive map to identify and report issues such as potholes, streetlight outages, drainage concerns, damaged signs, illegal dumping, and other locally configured categories. Add helpful details and a photo when the participating organization allows it.

Follow the progress of your own reports, receive updates when their status changes, and stay informed with local alerts and events. Features, reporting categories, and response workflows vary by participating location.

CityReport.io is not an emergency service. For immediate danger or emergencies, call 911 or contact the responsible agency directly.

### Google Play

- App name: `CityReport.io`
- Suggested category: `Productivity`
- Contact email: `cityreport.io@gmail.com`
- Website: `https://cityreport.io/`
- Privacy Policy URL: `https://cityreport.io/legal/privacy`
- Account deletion URL: `https://cityreport.io/legal/account-deletion`

**Short description**

Report local issues, follow updates, and stay informed about your community.

**Full description**

CityReport.io helps residents report non-emergency community issues to participating cities, utilities, and local organizations.

Use the map to identify and report locally available issue categories, which may include potholes, streetlight outages, drainage concerns, damaged signs, illegal dumping, graffiti, and park equipment. Add details and a photo when the local reporting form supports them.

Track the progress of your own reports, receive status updates, and browse alerts and events published for your location. Available categories, workflows, and response responsibilities vary by participating city or organization.

CityReport.io is not an emergency service. For an emergency or immediate danger, call 911 or contact the responsible agency directly.

## 3. Release notes

### Apple “What’s New” — v1.2.6

This release improves the core CityReport.io experience:

- More consistent reporting fields and incident details across the map and Reports tab.
- Report-update notifications and clearer community alerts and events.
- More reliable map-to-report navigation, tenant switching, and report filters.
- Accessibility and mobile polish improvements throughout the app.

### Google Play “What’s new” — v1.2.6

Initial public release of CityReport.io. Report non-emergency local issues, follow report updates, and stay informed about alerts and events from participating communities. This release also improves reporting details, notifications, and mobile reliability.

## 4. App Review / Play App Access notes

Do **not** commit working reviewer credentials to this repository. Put a dedicated, non-expiring reviewer account in the store consoles at submission time.

**Reviewer instructions**

1. Open CityReport.io and select **Test City** from My Locations if it is not already active.
2. Sign in using the reviewer account provided in App Store Connect / Play Console.
3. Open the Map to view locally configured reporting categories and existing sample incidents.
4. Open Reports to view the reviewer account’s report history and report detail.
5. Open Notifications, Alerts, and Events to verify resident communications.
6. Notification permission is optional for basic review; do not treat a declined permission prompt as an app failure.

**Review account**

- Email: `[REVIEWER_EMAIL]`
- Password: `[REVIEWER_PASSWORD]`
- Test location: `Test City`
- If a specific sample report is needed: `[INCIDENT_ID / REPORT_NUMBER]`

**Important reviewer context**

- The app is for non-emergency reporting only.
- Report categories and available actions are tenant-configured, so different locations can intentionally display different tools.
- Any public map data in the reviewer environment is test/demo data and must not be presented as an emergency dispatch service.

## 5. Screenshots and assets to prepare

Capture screenshots from the release candidate on a clean signed-in and signed-out state. Do not show private resident names, email addresses, or production-only incident information.

1. Map overview with the reporting tools visible.
2. A reporting form with a locally configured reporting field.
3. An incident information window and its status.
4. Reports list and report detail.
5. Notifications with a report update.
6. Alerts or Events.
7. Account / Notification Preferences.

Prepare these separate deliverables:

- Apple 1024 × 1024 app icon with no transparency.
- Google Play 512 × 512 high-resolution icon.
- Google Play 1024 × 500 feature graphic.
- Required phone screenshot sets for the device families selected in each console.
- Optional app preview video only if it accurately reflects the submitted build.

## 6. Privacy and data-safety worksheet

This is an engineering inventory for the App Store privacy and Google Play Data Safety forms. The product owner/legal reviewer must confirm the final answers in the store consoles.

| Data category | App purpose | Linked to identity? | Shared outside CityReport? | Submission-form review note |
| --- | --- | --- | --- | --- |
| Name, email address, and optional phone | Account and report follow-up | Yes, when an account/report provides it | Potentially responsible city, utility, or organization | Declare personal/contact information as applicable to the enabled report flow. |
| Precise or approximate location | Map positioning and issue/report location | Can be, when attached to an account report | Potentially responsible organization with the report | App requests location only while in use; no background location permission is declared. |
| Report text and issue selections | Provide reporting service | Usually, when submitted while signed in | Potentially responsible organization | Treat as user content. |
| Photos / closure photos | Support issue or resolution documentation | Usually, when attached to a report | Potentially responsible organization | Treat as photos/user content. |
| Account ID and push token | Authentication and report/community notification delivery | Yes | Push delivery provider | Declare identifiers as needed for account management and notifications. |
| Operational records (status, report number, incident ID) | Reporting service and audit trail | May be linked through a report | Responsible organization | Verify retention and any jurisdiction-specific disclosure. |

Engineering review found no mobile advertising SDK or ad-targeting flow in the release source. Do not select "no data collection"—the report, account, location, photo, and notification flows do collect data. Confirm Google Maps, Supabase, email delivery, and push-delivery provider disclosures with legal before submitting, including whether each is treated as a service provider/processor in the relevant form.

## 7. Release blockers

### Product / QA

- [ ] **Resolve and regression-test non-tenant-managed marker persistence and visibility.** A marker must not disappear merely because a user opens it or has selected `Is fixed`; visibility must follow the configured likely-fixed threshold. This is already tracked as a release blocker in `docs/BACKLOG.md`.
- [ ] Complete the resident and tenant-admin functional pass in `docs/APP_REVIEW_FUNCTIONAL_QA_CHECKLIST.md` on the production configuration.
- [ ] Test no-network, slow-network, sign-in, sign-out, report submission, report update, image upload, location permission, push permission, notifications, alerts, events, and cross-tenant notification handoff on physical devices.
- [ ] Confirm all public disclosures and emergency wording match production tenant configuration.

### Apple

- [ ] Create/confirm the App Store Connect record for bundle ID `cityreport.io.app`—not `cityreport.io.map`.
- [ ] Enable Push Notifications for that App ID and create/install a distribution provisioning profile that carries the `aps-environment=production` entitlement.
- [ ] Archive and validate the **Release** configuration with the production entitlement file `ios/App/App/AppRelease.entitlements`.
- [ ] Complete App Store Connect App Privacy, age rating, content rights, pricing/availability, export-compliance, and App Review information.
- [ ] Provide a live privacy URL, support URL, review contact, and working review credentials if login is required.

### Google Play

- [ ] Create/confirm the Play Console app record for application ID `cityreport.io.map`.
- [ ] Install a compatible Java Development Kit on the release machine, then run the Android release-bundle preflight. Gradle could not start on 2026-07-30 because the machine has no Java runtime.
- [ ] Configure a protected release keystore and upload a signed Android App Bundle (`.aab`). The project intentionally refuses to configure release signing until keystore values are supplied.
- [ ] Add `google-services.json` and configure Firebase Cloud Messaging for the production Android app if native device-push notifications are to be advertised. The current Gradle configuration explicitly warns when it is absent.
- [ ] Complete Data Safety, App access, ads declaration, content rating, target audience, privacy policy, contact details, and store listing in Play Console.

## 8. Final preflight and upload sequence

1. Close every release blocker above and record the QA evidence.
2. Freeze the submitted source; change only the build number if an upload retry is needed.
3. Build/validate an iOS Release archive and a signed Android App Bundle.
4. Install each exact release artifact on a physical device and perform a smoke test.
5. Upload to TestFlight and Google Play internal testing first.
6. Verify the exact uploaded build has correct icon, app name, permissions, notification behavior, legal links, screenshots, and reviewer access.
7. Submit for review only after internal testing passes and the product/legal/privacy owners approve the forms.

## 9. Official console references

- Apple App information: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
- Apple App Review information: https://developer.apple.com/app-store/review/
- Apple App Privacy: https://developer.apple.com/app-store/app-privacy-details/
- Google Play review preparation: https://support.google.com/googleplay/android-developer/answer/9859455
- Google Play Data Safety: https://support.google.com/googleplay/android-developer/answer/10787469
