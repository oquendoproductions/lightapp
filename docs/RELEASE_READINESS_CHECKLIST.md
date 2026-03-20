# Release Readiness Checklist

Date: ____________________  
Owner: ____________________

## 1) Environment and Hosting

- [ ] Production host is configured (no ngrok dependency for live release).
- [ ] `VITE_SUPABASE_URL` is set in production environment variables.
- [ ] `VITE_LEAD_CAPTURE_URL` is set in production environment variables.
- [ ] `VITE_SUPABASE_ANON_KEY` is set in production environment variables.
- [ ] (If used) analytics env vars are set (`VITE_ANALYTICS_PROVIDER`, related keys).

## 2) Database and Edge Functions

- [ ] Migration `20260315121500_create_client_leads.sql` is applied on production database.
- [ ] `public.client_leads` table exists and is writable by `lead-capture` function path.
- [ ] `lead-capture` function is deployed and `ACTIVE`.
- [ ] `LEAD_CAPTURE_HASH_SALT` secret exists in production.
- [ ] `RESEND_API_KEY` secret exists in production.
- [ ] Lead notification destination secret is set (`LEAD_NOTIFY_TO` or fallback `PW_REPORT_TO`).
- [ ] (If enabled) webhook secrets are set (`LEAD_NOTIFY_WEBHOOK_URL`, optional bearer token).

## 3) Legal and Public Content

- [ ] Terms page finalized and published (`/public/legal/terms.html`).
- [ ] Privacy page finalized and published (`/public/legal/privacy.html`).
- [ ] Governance page finalized and published (`/public/legal/governance.html`).
- [ ] Public pilot overview page published (`/public/legal/pilot-overview.html`).
- [ ] Legal text aligns with current app capabilities in `docs/LEGAL_CAPABILITY_BRIEF.md`.
- [ ] Legal pages include current effective date and contact method.

## 4) Functional Smoke Tests (Production URL)

- [ ] Homepage loads without console errors.
- [ ] Primary CTA scrolls to lead form correctly.
- [ ] Lead form validation behaves correctly for missing/invalid inputs.
- [ ] Valid lead submit returns success state in UI.
- [ ] Submitted lead appears in `public.client_leads` with `source='homepage'` and `status='new'`.
- [ ] Notification email is received at configured admin destination.
- [ ] Legal links from footer/trust section open correctly.
- [ ] Favicon displays as expected (`/CityReport-pin-logo.png`).

## 5) Security and Data Handling

- [ ] No sensitive secrets are hardcoded in frontend files.
- [ ] Lead capture enforces honeypot behavior.
- [ ] Lead capture rate-limiting is active and returns expected response on abuse.
- [ ] Lead table RLS and service-role insert policy are intact.
- [ ] PII handling statements in legal pages match actual data flows.

## 6) Monitoring and Operations

- [ ] A responsible inbox/team is assigned for lead response SLA.
- [ ] Lead follow-up ownership is defined (person/role).
- [ ] A rollback plan is documented (last known good deploy reference).
- [ ] Backlog item for webhook go-live is tracked if not enabled yet.

## 7) Final Go / No-Go

- [ ] Go-live decision approved by product + legal + operations.
- [ ] Release timestamp and approvers recorded.

Approvers:
- Product: ____________________
- Legal: ____________________
- Engineering: ____________________
- Operations: ____________________

