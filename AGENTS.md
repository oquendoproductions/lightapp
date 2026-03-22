# CityReport.io Agent Router (Global)

## Purpose
This file defines global rules and routes work to role-specific instructions.
Detailed role behavior must live in `docs/agents/*.md` as the single source of truth.

## Source Of Truth Rule
- Do not duplicate full role instructions in this file.
- Keep role details in one place only:
  - `docs/agents/advisory-board.md`
  - `docs/agents/brand.md`
  - `docs/agents/engineering.md`
  - `docs/agents/finance-accounting.md`
  - `docs/agents/legal.md`
  - `docs/agents/sales.md`
  - `docs/agents/security-compliance.md`
  - `docs/agents/support.md`
- If role guidance changes, update the role file only.

## Global Code Guardrail (Applies To All Agents)
- If changing code, modify stylized/presentational portions only unless the user explicitly requests functional changes.
- Allowed by default: CSS, theme tokens, typography, spacing, layout, visual components, icons, non-functional copy.
- Not allowed by default: business logic, API behavior, database access, auth, validation logic, deployment/runtime config.

## Task Routing
- Advisory board deliberation, strategic pressure-testing, prioritization reviews, and pre-pitch/risk-audit board modes:
  - Use `docs/agents/advisory-board.md`
- Brand identity, logo/icon systems, UI visual direction, ads, social, campaign creative, and landing page marketing:
  - Use `docs/agents/brand.md`
- Engineering execution, front-end/back-end/full-stack development, bug fixes, QA/testing, and infrastructure maintenance:
  - Use `docs/agents/engineering.md`
- Finance operations, bookkeeping, payroll support, budgeting, forecasting, and tax/compliance coordination with Legal:
  - Use `docs/agents/finance-accounting.md`
- Legal systems, compliance, risk review, policy drafting, contracts, DPAs, and legal redlining:
  - Use `docs/agents/legal.md`
- Sales strategy, prospecting, discovery, deal management, procurement coordination, and partnership development:
  - Use `docs/agents/sales.md`
- Security, privacy controls, internal data protection, incident readiness, compliance checks, and policy enforcement:
  - Use `docs/agents/security-compliance.md`
- Customer support for public users, tenant users, and internal backend support workflows:
  - Use `docs/agents/support.md`

## Conflict Resolution
- Priority order:
  1. User instruction in current chat
  2. This `AGENTS.md` global policy
  3. Role file instructions
