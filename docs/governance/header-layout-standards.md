# Header Layout Standards

This document captures the shared header rules already implemented in the municipality shell so page-level work can match the same structure.

## Source Of Truth

- Shared header tokens: `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/headerStandards.css`
- Municipality reference implementation: `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/municipality-app.css`
- Municipality header markup reference: `/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MunicipalityApp.jsx`

## Desktop Requirements

- Header height is `var(--desktop-header-height)` and uses the shared horizontal padding token.
- The main title bar uses a 3-column grid:
  `minmax(var(--desktop-header-side-column), 1fr) minmax(0, 2fr) minmax(var(--desktop-header-side-column), 1fr)`
- Left column is reserved for the brand/logo.
- Center column is reserved for the page eyebrow and title.
- Right column is reserved for the account/menu control.
- Desktop title typography must use the shared title tokens:
  `--desktop-header-title-size`, `--desktop-header-title-line-height`, `--desktop-header-title-weight`
- Eyebrow text must use the shared `.app-header-eyebrow` style.
- The desktop header uses the standard blurred surface treatment:
  `background: rgba(248, 251, 255, 0.88)`, `backdrop-filter: blur(14px)`, and the shared 1px divider.

## Secondary Rail Requirements

- Any tab rail or page-specific controls should visually connect to the bottom of the header.
- Use the shared tab rail spacing tokens:
  `--app-tab-rail-offset`, `--app-tab-rail-shell-padding`, `--app-tab-rail-gap`
- The secondary rail should sit directly under the header with no detached floating gap.
- Page-specific controls should stay organized by function:
  left for utility controls like zoom/navigation, right for page stats, pills, and filters.

## Mobile Requirements

- Mobile header height, radius, padding, and shadow must follow the mobile header tokens in `headerStandards.css`.
- Mobile title bars use the same three-slot structure: left action, centered title, right action.
- Mobile layouts can stack controls beneath the title bar when horizontal space is limited.

## Notes

- If a page cannot reuse the exact municipality header component, it should still match the same spacing, typography, blur treatment, and rail attachment rules.
- New page headers should prefer shared tokens over one-off pixel values unless there is a deliberate exception.
