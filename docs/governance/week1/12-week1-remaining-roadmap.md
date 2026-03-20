# Week 1 Remaining Roadmap (Execution Order)

## Completed
- Canonical lifecycle enums + event tables deployed.
- Event snapshot model (`incident_state_current`) deployed.
- Trigger integrations wired (`reports`, `pothole_reports`, `light_actions`).
- Compatibility fixes for schema-variant trigger fields applied.
- Transition enforcement migration applied (`20260301195000_enforce_lifecycle_transitions.sql`).
- Aggregation strategy registry + normalized Open Reports source contract wired in app.
- Admin lifecycle visibility wiring added in Open Reports / All Reports.
- Export query templates added (`14-export-query-templates.sql`).
- Evidence capture worksheet added (`15-evidence-pack-capture.md`).
- Event evidence pack executed and captured (timelines + integrity checks + migration verification).

## Week 1 Status
- **Week 1 is complete.**

## Scope Guardrails (must remain true)
- No new public domain rollouts.
- No cosmetic-only merges.
- No non-blocking UX polish.
