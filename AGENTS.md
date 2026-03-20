# CityReport.io Agent Router (Global)

## Purpose
This file defines global rules and routes work to role-specific instructions.
Detailed role behavior must live in `docs/agents/*.md` as the single source of truth.

## Source Of Truth Rule
- Do not duplicate full role instructions in this file.
- Keep role details in one place only:
  - `docs/agents/brand.md`
  - `docs/agents/legal.md`
- If role guidance changes, update the role file only.

## Global Code Guardrail (Applies To All Agents)
- If changing code, modify stylized/presentational portions only unless the user explicitly requests functional changes.
- Allowed by default: CSS, theme tokens, typography, spacing, layout, visual components, icons, non-functional copy.
- Not allowed by default: business logic, API behavior, database access, auth, validation logic, deployment/runtime config.

## Task Routing
- Brand identity, logo/icon systems, UI visual direction, ads, social, campaign creative, and landing page marketing:
  - Use `docs/agents/brand.md`
- Legal systems, compliance, risk review, policy drafting, contracts, DPAs, and legal redlining:
  - Use `docs/agents/legal.md`

## Conflict Resolution
- Priority order:
  1. User instruction in current chat
  2. This `AGENTS.md` global policy
  3. Role file instructions
