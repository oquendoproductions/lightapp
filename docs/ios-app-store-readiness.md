# iOS App Store Readiness

Last updated: 2026-04-24

## Goal

Move the CityReport public iOS app from "good local/native testing build" to "submission-ready for TestFlight and App Store review."

## Current Status

### Already in place

- Native iOS shell exists under [ios/App](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios/App).
- App icon asset exists in [AppIcon.appiconset](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios/App/App/Assets.xcassets/AppIcon.appiconset).
- Launch splash assets exist in [Splash.imageset](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios/App/App/Assets.xcassets/Splash.imageset).
- Display name is set to `CityReport.io`.
- Bundle identifier is set to `cityreport.io.map`.
- Location usage description is present in [Info.plist](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios/App/App/Info.plist).
- Privacy manifest exists in [PrivacyInfo.xcprivacy](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios/App/App/PrivacyInfo.xcprivacy).
- Portrait-only iPhone orientation is configured.
- Terms of Use and Privacy Policy are exposed inside the app.
- Native push registration hooks exist in the app shell, pending Apple Developer capability enablement.

### Safe config update completed

- Updated `UIRequiredDeviceCapabilities` from `armv7` to `arm64` in [Info.plist](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/ios/App/App/Info.plist), which better matches a modern iOS 15+ app target.

## Current Blockers

### P0: Apple account / signing / toolchain

1. Apple Developer Program enrollment
   - Personal team signing is not sufficient for production push notifications or App Store distribution.
   - Required for:
     - Push Notifications capability
     - TestFlight distribution
     - App Store release

2. Xcode command-line selection
   - `xcodebuild` currently resolves to Command Line Tools instead of full Xcode.
   - Needed so local archive/validation commands can run cleanly.
   - Expected fix on the machine:
     - `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

3. App Store Connect app record
   - Create the iOS app record for `cityreport.io.map` if not already created.
   - Confirm bundle identifier, app name, primary language, and SKU.

### P0: Native capability validation

4. Push notifications end-to-end
   - Enable Push Notifications capability in Xcode after Apple Developer enrollment.
   - Confirm APNs entitlement/profile generation.
   - Validate:
     - permission prompt
     - token registration
     - foreground notification behavior
     - badge/banner/sound behavior
     - alert/event topic preference behavior

5. Real-device media upload validation
   - The app currently uses web file inputs for image upload.
   - Must test on a physical iPhone:
     - photo library picker
     - camera capture flow if offered
     - successful upload and report rendering
   - If iOS prompts indicate additional usage strings are required, add them before submission.

### P0: Store submission materials

6. App Store metadata package
   - App subtitle
   - App description
   - Keywords
   - Support URL
   - Marketing URL if desired
   - Privacy Policy URL
   - App category

7. Screenshots and preview assets
   - Capture store screenshots for required iPhone sizes from the real app.
   - Recommended minimum set:
     - city selection
     - map view
     - reporting flow
     - reports page
     - alerts/events
     - account/preferences

8. App Privacy questionnaire
   - Complete App Store Connect privacy disclosures based on actual data use:
     - location
     - contact/account info
     - user content such as report text and uploaded images
     - identifiers / diagnostics if added later

## P1: Submission-hardening QA

9. Regression pass on real device
   - Guest flow
   - Sign in / sign out
   - Password reset
   - Tenant selection
   - Reporting across streetlights, potholes, water/drain
   - My Reports
   - Alerts / Events
   - Resident menu links
   - External link handoff out of app

10. Failure-state UX audit
   - Offline / weak network handling
   - Duplicate submit prevention
   - Loaders and success feedback
   - Map info-window clipping near screen edges

11. Location disclaimer/product acceptance
   - Current location tracking is usable but still rough in travel-follow scenarios.
   - Accept for v1 unless field testing reveals a safety/usability blocker.
   - Backlog deeper smoothing and navigation-style interpolation for a later update.

## P1: Release process setup

12. Versioning strategy
   - Current version is `1.0` build `1`.
   - Decide release numbering convention before first TestFlight upload.

13. Archive / validation workflow
   - Confirm release archive succeeds from Xcode.
   - Confirm App Store validation passes before first TestFlight upload.

14. Crash / analytics posture
   - Decide whether to ship v1 without crash reporting or add it before beta rollout.

## Time-sensitive Apple note

- Apple periodically raises the minimum SDK/Xcode requirement for submissions.
- Before first submission, confirm the current App Store requirement in official Apple docs and make sure the machine is on the required Xcode release.

## Recommended Order

1. Fix `xcode-select` to point at full Xcode.
2. Enroll in Apple Developer Program and enable proper signing.
3. Turn on Push Notifications capability and validate on device.
4. Complete real-device QA for image upload and core reporting.
5. Prepare App Store Connect metadata and screenshots.
6. Archive, validate, upload to TestFlight.
7. Run beta feedback round before public release.
