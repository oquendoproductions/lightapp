# Multi-Tenant Smoke Checklist

## Guardrails
- No functional regressions in pilot flows.
- No feature expansion during tenant migration.
- Pause migration work immediately if a core pilot flow fails.

## Resolver Matrix
- `cityreport.io/` renders marketing homepage mode.
- `cityreport.io/ashtabulacity` redirects to `https://ashtabulacity.cityreport.io/`.
- `ashtabulacity.cityreport.io/` renders municipality app mode.
- `dev.cityreport.io/ashtabulacity` renders municipality app mode against staging.
- Unknown slug returns controlled not-found page and logs unknown-slug warning.
- `/gmaps` legacy URL redirects to municipality root.

## Tenant Data Isolation
- Requests include `x-tenant-key`.
- Tables with `tenant_key` reject null writes.
- Write payloads for edge functions include `tenant_key`.
- Storage upload path starts with `{tenant_key}/`.

## Pilot Regression
- Pothole report submission works.
- Water/drain report submission works.
- Streetlight report submission works.
- Admin open reports still load.
- Lifecycle actions (confirm/fix/reopen) still apply.
- Export summary/detail still run.

## Edge Function Verification
- `rate-limit-gate` rejects missing `tenant_key`.
- `email-pothole-report` rejects missing `tenant_key`.
- `email-water-drain-report` rejects missing `tenant_key`.
- `cache-official-light-geo` rejects missing `tenant_key`.

## Staging Gate Before DNS Cutover
- Migrations apply cleanly.
- RLS tenant scope verifies for anon/authenticated.
- Ashtabula smoke suite passes end-to-end.
