# CityReport.io Legal Capability Brief

Date: March 17, 2026  
Prepared for: Legal/Contracts drafting

## 1) Product Snapshot

CityReport.io currently includes:

- A public marketing homepage with lead capture.
- A map-based reporting/operations application (`/gmaps`) for municipal infrastructure workflows.
- A Supabase backend (Auth, Postgres, Storage, Edge Functions).

## 2) Core Functional Capabilities

- Accepts infrastructure reports with location, issue details, and optional media.
- Supports lifecycle tracking and updates (open, fixed, reopened).
- Supports recurring/chronic incident monitoring for accountability workflows.
- Provides administrative operations capabilities (open reports queue, filters, moderation visibility).
- Supports export and metrics model for pilot evaluation (public summary vs internal detailed).
- Captures and stores municipal lead requests from homepage demo form.

## 3) Current Domain Scope

- Pilot-facing municipal scope: `potholes`, `water_drain_issues` (per governance docs).
- Streetlights exist as an in-app domain and utility-information workflow in current implementation.
- Street-sign workflows are present in code paths/admin tooling.

## 4) Data Categories Processed

- Reporter/account data: name, email, phone (guest and/or authenticated contexts).
- Report data: issue type/domain, notes, status transitions, source labels, timestamps.
- Location data: coordinates, nearest address, cross street, landmark.
- Media data: uploaded report images.
- Lead data: full name, work email, city/agency, role, priority domain, notes.
- Anti-abuse metadata: hashed identity/IP values, user-agent, event-rate telemetry.

## 5) Data Sharing and External Services

- Reports may be forwarded to city departments, utilities, or responsible entities.
- Email delivery uses Resend in Edge Functions.
- Homepage lead notifications are sent by email and optionally webhook-integrated.
- Mapping/geospatial functionality uses Google Maps APIs.
- All core app data is stored in Supabase-managed services.

## 6) Access Controls and Safeguards

- Role/visibility split model for public vs internal metrics layers.
- RLS policies and service-role enforcement for sensitive writes (including lead capture table).
- Abuse/rate-limit controls via dedicated edge function and hashed identity/IP strategies.
- Municipal boundary gating for city-limits sensitive report forwarding paths.
- Terms/Privacy consent language appears in app flows and public legal pages.

## 7) Operational/Legal Positioning Constraints

- Platform is an intermediary intake/accountability system; it does not guarantee agency response times or resolution outcomes.
- Emergency-use exclusion language is currently present and should remain explicit in legal documents.
- Legal should define clear party roles for municipal data handling (controller/processor responsibility allocation).

## 8) Contract Drafting Focus Areas

- Consent and authorization scope for forwarding contact/report data.
- Data retention and deletion windows by data class (reports, leads, images, audit/lifecycle logs).
- Acceptable use and anti-abuse enforcement.
- Third-party subprocessors and transfer disclosures (Supabase, Resend, Google Maps).
- Security commitments, access controls, and incident response obligations.
- SLA and liability boundaries (especially around municipal/utility response dependencies).
- Public vs internal data visibility commitments.

## 9) Source References (Implementation)

- App routing/entry: `src/main.jsx`
- Map operations app: `src/MapGoogleFull.jsx`
- Lead capture function: `supabase/functions/lead-capture/index.ts`
- Abuse gate: `supabase/functions/rate-limit-gate/index.ts`
- Forwarding email functions:
  - `supabase/functions/email-pothole-report/index.ts`
  - `supabase/functions/email-water-drain-report/index.ts`
- Lead table migration: `supabase/migrations/20260315121500_create_client_leads.sql`
- Report images bucket migration: `supabase/migrations/20260307103000_week4_report_images_bucket.sql`
- Model C accountability migration: `supabase/migrations/20260302153000_week2_model_c_accountability.sql`
- Pilot docs:
  - `docs/governance/week4/pilot-overview-one-page.md`
  - `docs/governance/week4/pilot-success-metrics-sheet.md`

