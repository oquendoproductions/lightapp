# CityReport Week 2 Abuse Thresholds and Controls

## Current Enforced Limits

### Event-Level Rate Limits (Client + Server Gate)
- Window: 60 seconds
- Max events per window: 7
- Max lights per window (streetlight equivalent units): 20
- Bulk submit max size: 10 lights per event

### Interpretation
- Single-light report = 1 event, 1 unit
- Bulk report of N lights = 1 event, N units

## Triggered Abuse Signals
- `single_bulk_spike`: unusually large single event unit volume
- `rapid_repeat_events`: repeated events inside short window
- `excess_units_window`: total units in window exceeds threshold

## CAPTCHA Trigger Logic (Week 2 Rule)
- If user/session exceeds soft threshold:
  - require CAPTCHA challenge before next submission
- Soft threshold recommendation:
  - >= 5 events in current 60s OR
  - >= 15 units in current 60s
- Hard block remains at:
  - > 7 events OR > 20 units per 60s

## Contact Rate Limiting
- Per normalized contact identity (email + phone hash):
  - max 7 events / 60s
  - max 20 units / 60s
- Shared with IP limiter; stricter result applies.

## IP Rate Limiting
- Per IP (or edge-derived client fingerprint fallback):
  - max 7 events / 60s
  - max 20 units / 60s

## Admin Override Capability
- Admin-only moderation tool can:
  - clear/resolve false-positive anomaly flags
  - temporarily allow a blocked actor/session for operational reasons
- Overrides must be logged with actor + reason.

## Governance Notes
- Abuse controls apply to intake, not to read-only browsing.
- Threshold values are governance-tunable and must be versioned when changed.

