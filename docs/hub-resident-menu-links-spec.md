# Hub Resident Menu Links Spec

Last updated: 2026-04-23

## Goal

Allow each organization to manage public-facing menu links that appear in the resident map app menu without requiring a code deploy.

Examples:

- Trash pickup schedule
- Bulk trash pickup
- Snow parking rules
- Permits
- Contact department
- City website
- Emergency or non-emergency phone numbers

## Ownership

This is a Hub-managed organization feature.

- PCP may expose platform-level diagnostics or emergency override controls later.
- The Hub is where organization users create, edit, reorder, enable, and disable resident menu links.
- The public map app only renders enabled links for the active tenant.

## Data Model

Proposed table: `public.organization_menu_links`

Columns:

- `id uuid primary key default gen_random_uuid()`
- `tenant_key text not null`
- `label text not null`
- `description text`
- `icon_key text`
- `link_type text not null`
- `url text`
- `phone text`
- `email text`
- `internal_route text`
- `sort_order integer not null default 100`
- `enabled boolean not null default true`
- `audience text not null default 'public'`
- `created_by uuid`
- `updated_by uuid`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Recommended constraints:

- `link_type in ('external_url', 'phone', 'email', 'internal_route')`
- `audience in ('public', 'signed_in', 'admin')`
- `tenant_key` scoped to the active organization.
- At least one destination field must exist based on `link_type`.

Future destination types:

- `document`
- `pdf`
- `form`
- `alert_category`
- `event_category`

## Permissions

Recommended management permission:

- `manage_public_menu_links`

Policy direction:

- Public/anonymous users can select enabled `audience = 'public'` links for the active tenant.
- Signed-in residents can select enabled `public` and `signed_in` links for the active tenant.
- Org admins/editors with `manage_public_menu_links` can select, insert, update, delete, reorder, and disable links for their tenant.
- Platform/dev users can view all links from PCP for diagnostics if needed.

## Hub UI

Location:

- Hub settings area or communications/settings section.
- Name suggestion: `Resident Menu`

Core actions:

- Create link
- Edit link
- Disable/enable link
- Delete link
- Reorder links
- Preview public menu

Create/edit fields:

- Label
- Short description
- Icon
- Link type
- Destination value
- Audience
- Enabled
- Sort order

Validation:

- Label required.
- Destination required based on link type.
- External URLs must be `https://` unless intentionally allowed by platform policy.
- Phone numbers should normalize to `tel:`.
- Emails should normalize to `mailto:`.

## Public App Rendering

Surface:

- Public map hamburger menu.

Behavior:

- Render enabled links after core app links such as `Switch Location`, `About`, and `Contact Us`, unless later design chooses a dedicated `City Info` section.
- Use org-provided order.
- Use a safe default icon when no icon is selected.
- External URLs open outside the app.
- Phone links open the native dialer.
- Email links open the native mail composer.
- Internal routes open the appropriate app page when supported.

Empty state:

- If no enabled links exist, show nothing. Do not show an empty section.

Failure state:

- If links fail to load, keep the menu usable and omit the custom section.
- Do not block core app navigation.

## Open Questions

- Should orgs be able to group menu links under headings?
- Should links support seasonal scheduling, such as snow parking only during winter?
- Should links support per-domain visibility, such as sanitation links only when a sanitation domain exists?
- Should the public app cache menu links for offline-ish resilience?
- Should Hub include click analytics for public links?

## First Implementation Slice

Recommended first slice:

1. Add `organization_menu_links` table, RLS, and permissions.
2. Add Hub CRUD UI for text/link rows with enable/disable and sort order.
3. Render enabled public links in the public app menu.

Definition of done:

- An org admin can add a public `Trash pickup schedule` URL from Hub.
- The link appears in that tenant's public app menu.
- Tapping it opens outside the app.
- Disabling the link in Hub removes it from the public app menu after refresh/realtime update.
