# Commercialization Implementation Foundation

Date: March 23, 2026
Status: Internal planning only

## Purpose

This document outlines how pricing and pilot governance should eventually land in the product without changing live behavior today.

## Guiding principle

Do not turn pricing or pilot rules on in production until:
- finance approves the commercial model
- legal approves the governing language and process boundaries
- product and engineering agree on the user experience for confirmations and approvals

## Future data model direction

Recommended future records at the tenant layer:
- plan type
- pilot status
- billing status
- included domain count
- included user count
- annual base fee
- annual per-user rate
- effective date
- renewal date
- policy version or pricing version

Recommended supporting records:
- acknowledgement events for pricing confirmations
- approval records for exceptions
- audit events for scope changes

## Future audit events to support

- `pricing_acknowledged`
- `pilot_terms_acknowledged`
- `tenant_user_add_confirmed`
- `tenant_domain_add_confirmed`
- `tenant_scope_exception_approved`
- `pilot_expiration_extended`

## Future PCP checkpoints

### On tenant creation
- Show pilot or commercial profile summary
- Show included counts
- Record the selected initial package

### On adding a user
- Check included seat count versus current usage
- If expansion is billable, show a confirmation checkpoint before assignment
- Record acknowledgement and approver identity

### On adding or enabling a domain
- Check domain allowance
- If the change expands commercial scope, require confirmation before activation
- Record acknowledgement and approver identity

### On pilot expiry or threshold approach
- Show warning banners
- Surface current usage versus allowed counts
- Offer approval or conversion workflow instead of silent overrun

## Rollout phases

### Phase 1
- Data model and audit foundation only
- No user-facing pricing enforcement

### Phase 2
- Read-only pricing and pilot summary cards in the PCP
- No blocking or billing checkpoints yet

### Phase 3
- Soft warnings for approaching or exceeding included counts
- Confirmation dialogs before expansion actions

### Phase 4
- Approval workflow and quote/billing handoff support
- Clear audit trail for commercial acknowledgements

### Phase 5
- Optional hard enforcement if business policy requires it

## Implementation constraints

- Keep commercial data separate from core tenant identity/profile data where possible
- Avoid mixing contract policy with operational metadata unless there is a clear ownership model
- Preserve auditability for approvals, changes, and exception handling
- Ensure multi-tenant users remain tenant-scoped in what they can see, even if commercial accounting later becomes tenant-specific

## Recommended next step

Before implementation begins, align leadership on three definitions:
- billable domain
- billable user
- default pilot caps

Once those are stable, the PCP can gain read-only commercial summaries without turning on any live billing behavior.
