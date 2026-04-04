# Week 5 UI Polish Compliance Pass

Date: April 4, 2026
Status: Internal validation note

## Purpose

Document the compliance/readiness pass for recent Hub, Reporting Map, and marketing-site polish changes against the Week 5 UI-only sprint guardrails and Advisory Board guidance.

## Scope Reviewed

- Marketing header and tab rail behavior
- Hub auth gate and workspace header behavior
- Shared workspace menu styling and support/contact flows
- Reporting Map header, menu, alerts/events windows, and notification preferences
- Dark mode treatment for public map modal surfaces

## Validation Run

Commands executed in `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web`:

- `npm run build`
- `npm run lint`
- `npm test`
- `npm run test:router`

## Outcome

### 1. Functional Readiness

- Build completed successfully.
- Lint completed successfully.
- Unit tests completed successfully.
- Router tests completed successfully.

### 2. UI / Consistency Checks

- Marketing section rail now sits flush under the header with no spacing gap.
- Marketing rail uses the same tab-family sizing language as Hub/PCP while remaining full-width.
- Hub auth gate no longer breaks hook order and loads correctly.
- Hub and Reporting Map mobile titles now share the same wrapping behavior standard.
- Shared hamburger menu treatment is aligned across PCP, Hub, and Map.
- Public map `Contact Us` only renders populated contact methods.
- Reporting Map `Alerts`, `Events`, `Notification Preferences`, and `Contact Us` surfaces account for dark mode.

### 3. Public Trust / Copy Safety

- Public-facing contact wording remains neutral and non-committal.
- Public map disclaimer remains visible.
- No empty public contact rows are exposed.
- No new internal-only terminology was introduced into public resident-facing map windows.

### 4. Guardrail Check

- No schema migrations were added as part of this pass.
- No export schema changes were added as part of this pass.
- No metrics formula changes were added as part of this pass.
- No lifecycle/state-model changes were added in this compliance cleanup pass.

## Exceptions / Notes

- The broader recent change stream included some non-visual routing/auth hardening before this note. Those should be treated as bug-fix exceptions, not pure UI polish.
- Reporting Map unread alert/event state remains device-local persistence, which is acceptable for pilot polish but is not a canonical cross-device read-state model.
- `src/MapGoogleFull.jsx` still exceeds the 500 kB minified chunk warning threshold and should remain on the technical-debt list, but it is not a pilot blocker for this pass.

## Recommendation

This pass is acceptable for pilot-readiness from a UI/compliance standpoint, provided future changes continue to distinguish:

- UI polish
- bug-fix exceptions
- structural/platform work

Next governance step:

- Capture representative before/after screenshots for municipal-facing polish proof if they are needed for deck or pilot evidence packaging.
