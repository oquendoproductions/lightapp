# Drive Test Checklist (v1.1.0)

Scope note (2026-03-22):
- iOS-specific tap/hold/drag zoom behavior is out of web scope and deferred to future native iOS integration.

## Tracking and Camera
- [ ] Drag pan disables follow.
- [ ] Pinch zoom does NOT disable follow.
- [ ] Heading does not snap north when stopped.
- [ ] Heading updates smoothly when moving/turning.
- [ ] Manual zoom level is preserved while tracking.

## Interaction Reliability
- [ ] Side buttons remain tappable while tracking.
- [ ] Marker taps still register when tracking.
- [ ] No accidental UI lockups during motion.

## Bulk Reporting
- [ ] Bulk-selected lights remain selected during panning/zooming.
- [ ] Bulk-selected lights do not disappear during refresh/realtime updates.

## Auth and Recovery
- [ ] Forgot password email opens reset flow correctly.
- [ ] PASSWORD_RECOVERY opens in-app Set New Password modal.
- [ ] Password update succeeds and session remains active (no forced re-login).

## Connection Handling
- [ ] No immediate false "Connection issue" notice on clean startup.
- [ ] Connection issue appears only under real outage/failure conditions.

## Logging Notes
Record:
- device/model
- browser/version
- network type
- timestamp
- repro steps
- screenshot/screen recording
