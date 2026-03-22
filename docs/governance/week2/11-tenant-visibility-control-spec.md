# CityReport Week 2 Tenant Visibility Control Spec

## Purpose
Allow municipalities to configure which domains are public summary visible vs internal-only.

## Configuration Shape
```json
{
  "streetlights": "public",
  "potholes": "public",
  "power_outage": "internal_only",
  "water_main": "internal_only"
}
```

Allowed values:
- `public`
- `internal_only`

## Storage
- Table: `public.tenant_visibility_config`
- Key fields:
  - `tenant_id`
  - `domain`
  - `visibility_mode`
  - `updated_by`
  - `updated_at`

## Runtime Behavior
1. Public summary views include only domains with `visibility_mode = 'public'`.
2. Internal admin dashboards include all domains.
3. Exports:
   - internal exports: all allowed domains for admin
   - public export endpoint (if added): public domains only

## Permission Rules
- Read public visibility: open to public view layer.
- Update visibility: admin-only.
- Every config change must be audit-logged.

## UI Behavior
- Admin settings panel includes per-domain toggle:
  - Public Summary ON/OFF
- Default for new tenants:
  - streetlights = public
  - potholes = public
  - power_outage = internal_only
  - water_main = internal_only

## Governance Rule
- Domain public visibility must be explicitly set before any public summary metric can include that domain.

