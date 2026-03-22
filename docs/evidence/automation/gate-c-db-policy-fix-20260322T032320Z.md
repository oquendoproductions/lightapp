# Gate C DB Policy Helper Fix (Production)

Generated: 2026-03-22 03:23:20 UTC
Project: `gjainmoiudfjsmhhvtiz` (production)

## Change Applied

- Applied migration SQL from:
  - `supabase/migrations/20260322001500_fix_admin_helper_security_definer.sql`
- Updated helper functions to run as `SECURITY DEFINER`:
  - `public.is_platform_admin(uuid)`
  - `public.is_tenant_admin(uuid, text)`

## Verification

- Function flags after apply:
  - `is_platform_admin` => `prosecdef = true`
  - `is_tenant_admin` => `prosecdef = true`

- Anonymous insert probes (transaction rolled back) now succeed for both paths:
  - `public.pothole_reports` => `INSERT 0 1`
  - `public.reports` => `INSERT 0 1`

- Follow-up production API smoke:
  - Artifact: `docs/evidence/automation/gate-c-api-smoke-20260322T032310Z.md`
  - Guest submit checks:
    - `pothole_insert` => HTTP 201
    - `water_drain_insert` => HTTP 201
