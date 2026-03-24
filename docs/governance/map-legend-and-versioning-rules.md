# Map Legend And Versioning Rules

## Purpose

Keep the Info modal, legend swatches, tool icons, and visible app version aligned with the real map behavior.

## Source Of Truth

- The app version shown in the Info modal must come from [package.json](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/package.json).
- Do not hardcode the release version inside map components.

## Required Update Rule

Any change to map-visible icon behavior must update the Info modal in the same change set.

This includes:

- marker fill color changes
- marker ring color changes
- marker glyph or icon changes
- new marker states
- removed marker states
- visibility rule changes for who sees a marker/state
- tool icon swaps or renamed button behavior shown in the Info modal

## Version Bump Rule

Bump the app version whenever the map legend or icon behavior changes.

Suggested semantic versioning guidance:

- Patch: copy-only legend cleanup with no behavior change
- Minor: new icon state, new marker behavior, new visible workflow, or changed visibility rules
- Major: breaking workflow changes that require user retraining or release coordination

## Release Checklist

For any map icon or legend behavior change:

1. Update the Info modal legend rows in [src/MapGoogleFull.jsx](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/src/MapGoogleFull.jsx).
2. Bump the version in [package.json](/Users/oquendoproductions/Desktop/streetlight-app/streetlight-web/package.json).
3. Add or update release notes for that version.
4. Run `npm run test`.
5. Run `npm run build`.
6. Verify the Info modal legend against the live marker states on the map before push.
