# Public Trust Indicator Specification

## Requirement
Each visible incident should display:
- Current state label
- Last updated timestamp

## Optional (later)
- Under Review
- Scheduled

## UI Placement
- Marker info window
- All Reports detail rows
- Open Reports card metadata line

## Data Source
- `incident_state_current.state`
- `incident_state_current.last_changed_at`

## Messaging Rules
- Keep labels simple and non-technical.
- Avoid implying guaranteed SLA.
- Preserve disclaimer language for emergency/non-emergency boundary.
