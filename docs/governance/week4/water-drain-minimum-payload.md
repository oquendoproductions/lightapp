# Water/Drain Minimum Payload (Pilot)

Domain: `water_drain_issues`  
Subtypes: `sewer_backup`, `storm_drain_clog`

## Required
- `incident_type` (`sewer_backup` or `storm_drain_clog`)
- `lat`
- `lng`
- `timestamp`

## Optional
- `notes`
- `reporter_contact`:
  - `name`
  - `phone`
  - `email`
- `nearest_address`
- `nearest_cross_street`
- `nearest_landmark`
- `image_url`

## Contract Notes
- Aggregation strategy: `proximity_based`
- Lifecycle contract: `reported -> confirmed -> in_progress -> fixed -> reopened -> archived`
- Report numbering prefix: `WDR`
