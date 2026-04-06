# Pricing Strategy Draft

Date: March 23, 2026
Status: Internal planning only

## Purpose

This document starts the pricing strategy conversation without changing any live product behavior. It is a working draft for CityReport.io leadership, finance, legal, sales, and engineering.

## Recommended commercial model

Default recommendation:
- Annual base platform fee by tenant domain count
- Annual per-user seat charge layered on top

Why this model fits the product:
- Domain count tracks the operational footprint a tenant wants to run
- Named-user seats track internal adoption and support load
- The model is easy to explain in demos, pilots, contracts, and future in-product confirmation checkpoints

## Working packaging direction

### Pilot
- Short fixed term
- Explicit caps on domains and users
- Commercial expansion requires approval, not silent self-service

### Standard
- Base annual fee includes a starter domain allowance
- Includes a starter seat allowance
- Additional domains and named users priced separately

### Growth
- Higher included domain allowance
- Higher included seat allowance
- Better fit for multi-department or multi-workflow municipal operations

### Enterprise
- Custom commercial terms
- Procurement, legal, compliance, and support commitments handled case by case

## Initial pricing shape to evaluate

The current best-fit structure to test in finance modeling is:
- `annual_base_fee = price tier driven by number of active domains`
- `annual_user_fee = named seat price x number of billable users`

Possible presentation example:
- Platform fee: covers tenant environment plus the selected domain package
- User fee: applies to named internal users with tenant access

This matches the intended future UX:
- tenant created with a visible commercial package
- adding a domain can trigger a price checkpoint
- adding a user can trigger a price checkpoint

## Definitions to lock before pricing is finalized

### Billable domain
Need one clear definition:
- A domain enabled for tenant use in production

Questions still open:
- Does a domain count once per tenant or once per environment?
- Do disabled domains count if historical data remains attached?
- Are internal-only/admin-only domains billable the same way as public-facing domains?

### Billable user
Recommended starting point:
- A named account with active tenant access

Questions still open:
- Are suspended users still billable until removed?
- Do read-only users bill differently?
- If one account belongs to multiple tenants, is billing per tenant assignment or per unique human?

## Finance questions to answer next

- What annual revenue target should a standard municipality tenant reach?
- What gross margin should the base platform fee protect?
- What support burden should be assumed for each added domain?
- What support burden should be assumed for each added named seat?
- What minimum annual commitment should apply outside pilots?
- What renewal timing and mid-term expansion rules are acceptable?

## Sales and contract implications

- Quotes should show base platform fee separately from added user/domain expansion
- Pilot paperwork should disclose included counts and overage approval process
- Expansion should be deliberate, with approval checkpoints instead of hidden automatic charges

## Product guardrails for later implementation

These are future-facing only and should not affect live behavior yet:
- Tenant creation summary with selected package
- Confirmation checkpoint before adding a billable user
- Confirmation checkpoint before enabling an additional billable domain
- Audit trail for pricing acknowledgements and scope expansion
- Admin-facing visibility into included counts, current usage, and pending expansion

## Current recommendation

Move forward with pricing exploration using:
- base annual fee by active domain count
- annual per-user named-seat fee

Do not implement charges in-product yet. First lock:
- billable domain definition
- billable user definition
- pilot included counts
- approval path for expansion
