# CityReport.io v1.1.0

Release date: 2026-02-27

## Highlights
- Added account security improvements:
  - Re-auth required for Manage Account edit/save.
  - Change Password flow in Manage Account.
  - Forgot Password completion flow now opens an in-app "Set New Password" modal via PASSWORD_RECOVERY.
- Added password policy and visibility controls:
  - Show/Hide password toggles.
  - Enforced stronger password requirements.
- Improved map/admin UX:
  - Info modal legend improvements.
  - Version moved into Info modal.
  - Admin Open Reports scaffold now includes domain selector UI (Streetlights active; other domains marked coming soon).
- Stability and resilience:
  - Connection issue notification with startup grace, filtering, and throttling.
  - Tracking/follow behavior refinements.

## Security and Auth
- Reset emails are domain-sent.
- Password reset now has a direct completion step in-app (no dead-end landing).
- Manage Account changes and password changes now have stronger verification paths.

## Notes
- This release uses semantic versioning in-app (`v1.1.0`).
- Date context is tracked in release notes and git history.
