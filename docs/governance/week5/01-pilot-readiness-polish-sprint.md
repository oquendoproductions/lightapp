# Week 5 — Pilot Readiness Polish Sprint (UI-Only)

## Objective
Execute a short polish sprint (1-2 weeks) that improves clarity and pilot confidence without changing platform structure.

## Hard Guardrails (Do Not Violate)
- No new domains.
- No new report types.
- No lifecycle/state-model changes.
- No export schema changes.
- No metrics formula changes.
- No RLS/visibility contract changes.
- No structural backend migrations unless a production bug fix is required.

## In-Scope Work (Approved)

### 1) Unified Info Window / Popup Design
- Standardize all domain marker info windows to a common visual/layout system.
- Standardize button ordering, spacing, font scale, and status presentation.
- Keep domain-specific actions intact (only visual/interaction consistency changes).

### 2) Street Sign Marker Icon Clarity
- Improve street-sign marker icon legibility and recognition speed at common zoom levels.
- Ensure sign markers are clearly distinguishable from potholes/streetlights.
- Preserve existing marker color meaning (likelihood/status).

### 3) Modal/UI Consistency Pass
- Normalize modal typography hierarchy.
- Normalize paddings, button sizes, and close controls.
- Ensure one-popup-at-a-time behavior remains consistent across all marker interactions.

### 4) Public Language Neutrality Pass
- Review public-facing labels/microcopy for neutral accountability language.
- Avoid wording that implies negligence in high-reopen scenarios.
- Keep internal operational detail out of public summaries.

### 5) Dashboard Readability Polish
- Improve readability/alignment/label clarity for existing pilot metrics only.
- Do not add new metrics.

## Implementation Order (Execution Sequence)
1. Popup/UI design token pass (shared styles/components first).
2. Apply unified popup template to streetlights and street_signs.
3. Marker icon update pass (street_signs first).
4. Public language copy pass.
5. Dashboard readability pass.
6. Regression check: open reports, all reports, mark fixed/reopen, exports, moderation badge.

## Acceptance Checklist

### A. Functional Non-Regression
- Reporting still works for `potholes` and `street_signs`.
- Open Reports and All Reports workflows unchanged functionally.
- Mark fixed/reopen behavior unchanged.
- CSV exports still generate with schema metadata and no column drift.

### B. UI Consistency
- Info windows share consistent layout and control order across pilot domains.
- Modal typography/spacing/button hierarchy is consistent.
- Only one marker popup can be open at a time across all domains.

### C. Marker Clarity
- Street sign markers are visually identifiable at normal pilot zoom levels.
- Status colors remain consistent with current likelihood logic.

### D. Public Narrative Safety
- Public copy is neutral.
- No staff attribution exposed in public-facing views.
- Reopen/chronic presentation is trend-oriented, not blame-oriented.

### E. Pilot Freeze Readiness
- No structural changes introduced during sprint.
- Commit/tag sprint completion and declare structural freeze before pilot launch.

## Validation Plan (End of Sprint)
- Run targeted function test script:
  - report -> fixed -> reopen (street_signs)
  - report + cluster behavior (potholes)
  - open reports filtering/search/export
- Capture screenshots for municipal pitch deck.
- Produce Week 5 evidence note with before/after UI references.

## Deliverables
- `week5/02-ui-polish-checklist.md`
- `week5/03-week5-evidence-YYYY-MM-DD.md`
- Municipal pilot demo script update (separate doc in pilot-prep set)
