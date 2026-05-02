# Pilot Disclaimers, Audit Trail, and Daily Digest Package

## Purpose
Provide a pilot-ready risk-mitigation package for municipal review covering:
- resident-facing disclaimer language
- staff/admin disclaimer language
- report-number policy
- audit trail requirements
- daily digest and urgent alert delivery rules

This package is intended to support legal review, city-manager review, and pilot operations planning. It should not be treated as final legal advice.

## Operating Posture
CityReport should be presented as:
- an intake, communication, and workflow platform
- a support tool for municipal awareness and tracking

CityReport should not be presented as:
- a guaranteed delivery mechanism
- the city's sole official notice channel
- a substitute for emergency services
- a promise of response time, acceptance, or legal notice

## Core CYA Controls
The pilot should include all of the following:
1. Human-readable report numbers on every submitted report.
2. Clear resident disclaimer before submit.
3. Clear success-screen disclaimer after submit.
4. Domain-specific warnings for urgent/high-risk categories.
5. Delivery redundancy through a city-owned inbox digest.
6. Full report audit trail with timestamps and actors.
7. City-side view/assignment/closure events.
8. Legal review of wording before public launch.

## Recommended Resident-Facing Disclaimer Placement

### 1. Submit Form Disclaimer
Placement:
- directly above the `Submit` button for all public reporting forms

Recommended copy:

> Submitting a report through CityReport helps notify the city, but it does not guarantee receipt, review, response, or acceptance as legal notice. For emergencies, call 911. For urgent utility, sewer, storm, or safety issues, contact the city or utility directly.

Short variant if UI space is tight:

> CityReport is a reporting tool and does not guarantee receipt or legal notice. For emergencies, call 911.

### 2. Success Modal / Success Screen Disclaimer
Placement:
- directly below the report number and timestamp after a successful submission

Recommended copy:

> Your report has been recorded by CityReport and assigned Report #{{report_number}}. Keep this number for your records. Submission through CityReport does not guarantee city review or acceptance as legal notice.

### 3. About / Help / Resident Menu Disclaimer
Placement:
- About page
- Help page
- optional footer text on reporting pages

Recommended copy:

> CityReport is a communication and workflow platform. It is not an emergency service and is not a substitute for direct contact with public safety, utilities, or other legally required notice procedures.

### 4. Domain-Specific High-Risk Warning
Placement:
- inline on high-risk reporting forms before submit
- sewer/storm backup domain
- utility/emergency-adjacent domains

Recommended copy for sewer/storm backups:

> Sewer or storm backup issues may require immediate direct contact with the city or utility. Do not rely solely on app submission for urgent, hazardous, or actively worsening conditions.

Recommended copy for dangerous roadway hazards:

> If this issue presents an immediate traffic or safety hazard, contact the city or emergency services directly rather than relying solely on app submission.

## Recommended Staff / Admin Disclaimer Placement

### 1. Hub Admin Banner
Placement:
- Hub reports dashboard
- department inbox / workflow page

Recommended copy:

> Reports submitted through CityReport should be reviewed according to city policy. CityReport supports intake, routing, and tracking, but should not be treated as the sole official record without approved retention and routing procedures.

### 2. Department User Policy Language
Placement:
- internal SOP / pilot guide

Recommended copy:

> Department staff should process CityReport items using city-managed accounts and city-approved workflows. Status changes, assignments, and closures should be performed in CityReport or recorded in an approved connected system to preserve a complete audit trail.

## Report Number Policy
Every report should receive a unique human-readable report number.

Recommended characteristics:
- visible immediately on success
- searchable in Hub and app
- included in city digests and notification emails
- preserved in exports and audit logs
- never reused

Recommended display pattern:
- `Report #PHR0000110`
- prefix can be domain-specific if helpful

Minimum report-number touchpoints:
- success modal
- My Reports
- Open Reports / admin reports
- email digest
- exports
- audit log rows

## Audit Trail Requirements
The pilot should maintain a durable audit log for each report and incident lifecycle event.

### Minimum audit events per report
1. `report_submitted`
2. `report_number_assigned`
3. `report_saved_to_platform`
4. `report_delivery_enqueued`
5. `report_delivery_sent`
6. `report_delivery_failed`
7. `report_visible_in_city_queue`
8. `report_viewed_by_city_user`
9. `report_assigned`
10. `report_status_changed`
11. `report_comment_added`
12. `report_closed`
13. `report_reopened`
14. `report_digest_included`
15. `report_digest_delivered`

### Audit fields to capture
For each event:
- event id
- timestamp
- tenant key
- domain key
- incident id
- report id
- report number
- event type
- actor type
  - resident
  - guest
  - city user
  - system
- actor id or user id if known
- actor display name if available
- channel
  - app
  - hub
  - email
  - sms
  - system job
- delivery target if applicable
  - inbox address
  - SMS number label
  - queue name
- delivery status if applicable
  - queued
  - sent
  - delivered
  - bounced
  - failed
- read/view status if applicable
- note/comment payload if applicable
- point-in-time location snapshot
  - nearest address
  - closest cross street
  - closest landmark
  - coordinates

### Strongest evidence events
For CYA and operations, the most useful audit events are:
- report submitted
- report number assigned
- digest/email sent to city inbox
- city user viewed report
- city user assigned report
- city user closed report

Email opens should be treated as secondary evidence only.

## Delivery Redundancy Rules
The pilot should not rely exclusively on in-app visibility.

Recommended redundancy:
- in-app city queue
- daily digest to city-owned inbox
- immediate alerting for urgent domains
- exportable audit record

## Daily Digest Specification

### Purpose
Provide a city-owned external record of reports delivered during a fixed window.

### Digest cadence
Recommended default:
- once daily
- weekday mornings

Suggested window:
- prior 24 hours

### Digest recipients
Use city-owned inboxes only.

Recommended starting model:
- one primary pilot inbox
- one backup/admin inbox

Later options:
- domain-specific department inboxes
- supervisor copies

### Digest subject line

> CityReport Daily Digest — {{tenant_display_name}} — {{date}}

### Digest sections
1. Summary counts
   - total new reports
   - by domain
   - open vs closed
   - urgent items included

2. New reports table
   - report number
   - submitted at
   - domain
   - nearest address
   - closest cross street
   - status
   - reporter name if policy allows
   - link to open in Hub

3. Status changes table
   - report number
   - prior status
   - new status
   - changed at
   - changed by

4. Delivery/audit footer
   - digest generated at
   - tenant
   - digest id
   - record count

### Digest retention
Recommended:
- preserve sent digests in app/system history
- preserve mail provider delivery status
- allow export of digest history by date range

## Urgent Alert Rules
Some domains should generate faster or additional notice than the standard daily digest.

### Recommended pilot domains
Phase 1:
- potholes
- graffiti
- illegal dumping
- parks issues

Guarded or urgent-treatment pilot:
- sewer/storm backups

### Immediate-notify rule candidates
Use immediate email, and optionally SMS, for:
- sewer/storm backup reports
- hazardous roadway conditions
- reports tagged urgent by domain-specific rules

Suggested immediate-alert subject line:

> URGENT CityReport Item — {{tenant_display_name}} — {{domain}} — Report #{{report_number}}

Suggested immediate-alert content:
- report number
- submitted at
- nearest address
- closest cross street
- closest landmark
- coordinates
- reporter note
- direct Hub link
- disclaimer that staff should follow department policy

## Read Receipts and Evidence Posture

### Email read receipts
Email read receipts should be treated as optional and non-deterministic because many clients block them.

Usefulness:
- helpful if available
- not sufficient as the primary proof of municipal awareness

### Better operational evidence
Prefer:
- email delivery logged
- bounce/failure logged
- Hub view event
- assignment event
- closure event

### App read/view receipts
Recommended app-side read events:
- report first viewed by city user
- report viewed timestamp latest
- assigned by city user
- closed by city user

These are stronger than email-open signals for pilot reporting and legal defensibility.

## Pilot SOP Recommendation for City Staff
To reduce records and device concerns:
- use city-owned accounts
- prefer city-owned devices for field use if field workflow is required
- otherwise allow office-based processing after work is completed in the field
- preserve all status changes in Hub rather than private texts or private notes

## Implementation Recommendations

### Build now
1. Report numbers everywhere.
2. Submit disclaimer on public forms.
3. Success disclaimer on confirmation modal.
4. Daily digest to city-owned inbox.
5. Audit event logging for submission, delivery, and city view events.
6. Hub-visible report timeline with delivery and view receipts.

### Build soon after
1. Immediate urgent email for sewer/storm backup.
2. SMS option for urgent domains.
3. Digest history screen in Hub.
4. Exportable audit report by date range and domain.

## Review Required Before Pilot
1. City manager review.
2. Law director review of disclaimer language.
3. Public works / department workflow review.
4. Records-retention/public-records review.

## Open Decisions
1. Whether CityReport should ever be described as an official notice channel.
2. Which domains receive immediate alerts vs daily digest only.
3. Whether reporter identity is included in digests by default.
4. Whether city staff process reports from office only or also from city devices in the field.
