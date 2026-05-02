# Pilot CYA Implementation Checklist

## Purpose
Translate the pilot disclaimer, audit, digest, and report-number package into concrete implementation work.

Companion doc:
- `docs/governance/week5/13-pilot-disclaimers-audit-and-digest-package.md`

## Phase A — Public-Facing Disclaimer UX

### A1. Submit-form disclaimer
Status:
- not started

Required:
- add resident-facing disclaimer directly above `Submit` for all public reporting forms
- support a domain-specific override for urgent domains

Acceptance:
- disclaimer is visible before submit
- disclaimer is readable on mobile without scrolling awkwardly
- disclaimer copy can be changed centrally per domain

Implementation notes:
- default copy for all domains
- override copy for sewer/storm backup and any future urgent domains

### A2. Success-screen disclaimer
Status:
- not started

Required:
- show report number prominently on success
- show success disclaimer immediately below report number

Acceptance:
- report number is visible and copyable
- success disclaimer appears for all report types
- success modal does not imply guaranteed receipt, review, or legal notice

### A3. About / Help disclaimer
Status:
- not started

Required:
- add platform disclaimer to About page
- optionally surface same disclaimer in Help or resident-facing support flow

Acceptance:
- About page clearly states CityReport is not emergency service and not a substitute for direct contact or legally required notice procedures

## Phase B — Report Number Rollout

### B1. Report number generation
Status:
- partial / inconsistent

Required:
- guarantee unique human-readable report numbers across supported report flows
- ensure every report gets a report number at creation time

Acceptance:
- no report can be created without a report number
- format is consistent and searchable
- numbers are never reused

### B2. Report number display
Status:
- partial

Required:
- show report number in:
  - success modal
  - My Reports
  - Open Reports / admin reports
  - per-report history modal
  - email digest
  - exports

Acceptance:
- users and city staff can reference a single visible identifier everywhere

## Phase C — Audit Trail Foundation

### C1. Audit event schema
Status:
- not started

Required:
- define canonical event types for:
  - `report_submitted`
  - `report_number_assigned`
  - `report_saved_to_platform`
  - `report_delivery_enqueued`
  - `report_delivery_sent`
  - `report_delivery_failed`
  - `report_digest_included`
  - `report_digest_delivered`
  - `report_visible_in_city_queue`
  - `report_viewed_by_city_user`
  - `report_assigned`
  - `report_status_changed`
  - `report_comment_added`
  - `report_closed`
  - `report_reopened`

Acceptance:
- event names are stable
- event shape is documented
- all new audit producers use the same schema

### C2. Audit storage
Status:
- not started

Required:
- create or extend persistent audit-event storage
- capture:
  - event id
  - timestamp
  - tenant key
  - domain key
  - incident id
  - report id
  - report number
  - event type
  - actor type
  - actor id
  - actor display name
  - channel
  - delivery status
  - target inbox/recipient if applicable
  - location snapshot

Acceptance:
- audit events are queryable by tenant, domain, report number, and date range

### C3. City-side read/receipt events
Status:
- not started

Required:
- record when a city user:
  - first views a report
  - assigns a report
  - changes status
  - closes or reopens a report

Acceptance:
- Hub can show city-side awareness and handling events in a timeline

## Phase D — Daily Digest and Redundant Delivery

### D1. Digest recipient settings
Status:
- not started

Required:
- allow one or more city-owned digest inboxes per tenant
- store recipient config in Hub/admin settings

Acceptance:
- tenant can set primary and backup digest recipients
- no personal-device dependency is required for baseline pilot operation

### D2. Digest generation
Status:
- not started

Required:
- build a scheduled digest job
- include:
  - summary counts
  - new reports
  - status changes
  - digest metadata

Acceptance:
- digest is generated once daily by default
- digest content is deterministic for the selected window

### D3. Digest delivery logging
Status:
- not started

Required:
- log:
  - queued
  - sent
  - delivered
  - bounced
  - failed

Acceptance:
- every digest send attempt has a logged result
- digest id can be tied back to included report numbers

### D4. Digest history in Hub
Status:
- not started

Required:
- allow staff/admin to review prior digest runs
- surface delivery status and included report counts

Acceptance:
- city can confirm what was sent, when, and to whom

## Phase E — Urgent Domain Handling

### E1. Domain urgency configuration
Status:
- not started

Required:
- mark domains or issue types as:
  - standard digest only
  - immediate email + digest
  - optional SMS + email + digest

Acceptance:
- sewer/storm backup can be configured as immediate-notify
- other pilot domains can remain digest-only initially

### E2. Urgent submit warning copy
Status:
- not started

Required:
- add urgent warning copy to high-risk domain forms

Acceptance:
- residents see explicit direct-contact warning before submit on urgent domains

### E3. Immediate urgent delivery
Status:
- not started

Required:
- for urgent domains, send immediate email to city-owned inbox
- optionally support SMS later

Acceptance:
- urgent-domain reports do not wait for next daily digest to reach city inbox

## Phase F — Hub Visibility

### F1. Report delivery timeline
Status:
- not started

Required:
- show a report timeline in Hub with:
  - submission
  - digest inclusion
  - email delivery
  - city view
  - assignment
  - status changes
  - closure/reopen

Acceptance:
- staff can answer “Was this submitted?” and “Was it seen?” from one screen

### F2. Search by report number
Status:
- partial

Required:
- ensure Hub and app reports can search by report number reliably

Acceptance:
- city staff can retrieve a report directly from a resident’s reference number

## Phase G — Review and Governance

### G1. Legal review pass
Status:
- not started

Required:
- city law director reviews all disclaimer text
- city confirms whether CityReport is or is not treated as an official notice channel

Acceptance:
- approved pilot wording recorded in project docs

### G2. Records-retention review
Status:
- not started

Required:
- confirm digest storage, audit logs, and Hub actions meet city records expectations

Acceptance:
- city has an agreed retention posture for pilot records

### G3. Department workflow review
Status:
- not started

Required:
- decide whether departments process in field, in office, or both
- define whether city-owned devices are required

Acceptance:
- pilot SOP names the allowed workflow and device model

## Recommended Build Order
1. A1, A2, B1, B2
2. C1, C2
3. D1, D2, D3
4. C3, F1, F2
5. E1, E2, E3
6. G1, G2, G3

## Suggested First Engineering Slice
The safest first slice is:
1. add submit disclaimer
2. add success disclaimer
3. standardize report numbers everywhere

That gives immediate resident-facing CYA value before deeper backend work lands.
