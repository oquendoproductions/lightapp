# CityReport.io v1.2.0

## Highlights

- Streetlight confidence and utility-report tracking advanced beyond the original v1.1.0 legend assumptions.
- The Info modal legend was reviewed and updated so it matches current map behavior.
- The in-app version now comes from `package.json` instead of a hardcoded map-modal string.

## Included In This Release

- Streetlight legend cleanup for private tracked outages, public likely outages, utility-reported rings, and bulk-save selection.
- Version governance foundation for future map icon and Info modal changes.
- Utility report reference persistence support and related streetlight confidence plumbing.
- Streetlight QA display fixes so saved `Power on in area` and `Hazardous situation` answers can flow through My Reports.

## Release Discipline

- This release continues semantic versioning in-app (`v1.2.0`).
- Future map icon or legend behavior changes must update the Info modal and the app version in the same change set.
