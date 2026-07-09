# Pothole Canonical Migration Plan

## Goal

Move potholes onto the same incident-domain read/write model as the newer incident-driven domains without breaking:

- older App Store builds that still write `potholes` + `pothole_reports`
- current lifecycle/state history
- report counts, exports, and map rendering

## Current Reality

The app still has two active pothole paths:

- generic incident domains read/write through `reports`
- potholes still read/write through `potholes` + `pothole_reports`

The existing export views are only partially canonical. They still union raw `pothole_reports`, so they are not yet a true shared source of truth.

## Hard Rule

Do **not** backfill or mirror pothole rows into `public.reports` while the current build still reads both:

- `reports`
- `pothole_reports`

If we mirror too early, the current build will double-count pothole incidents/reports.

## Canonical Identifier Shape

Legacy pothole incidents should map into the shared incident model as:

- `report_domain = 'potholes'`
- `light_id = 'pothole:<legacy_pothole_id>'`

That shape already matches the existing lifecycle/domain helpers.

## Phase 1: Safe Foundation

This phase adds a unified read surface without changing live behavior yet:

- `public.canonical_report_rows_v1`
- `public.canonical_legacy_pothole_incident_id(text)`

`canonical_report_rows_v1` exposes:

- generic `reports` rows
- legacy `pothole_reports` rows normalized into shared columns

Important:

- current build is **not** switched to this view yet
- no legacy writes are mirrored yet
- no pothole rows are duplicated into `reports` yet

## Phase 2: Read Cutover

Switch current-build pothole report reads from direct table access to `canonical_report_rows_v1`.

Targets:

- map report/history loaders
- reports tab loaders
- hub report activity loaders
- export/report detail paths that still special-case potholes

Acceptance rule:

- current build must read potholes from one shared surface only
- no direct `pothole_reports` reads remain in the shipped app path

## Phase 3: Idempotent Mirror Into `reports`

After the read cutover, add backend mirroring for legacy pothole writes:

- old builds may keep inserting into `pothole_reports`
- backend mirrors each legacy pothole report into `reports`
- mirroring must be idempotent

Deduping rules:

- one canonical incident per `tenant_key + legacy_pothole_id`
- one canonical report per stable legacy pothole report source key
- never rely on fuzzy matching of note/lat/lng as the long-term dedupe rule

Recommended mirror metadata:

- `source_table = 'pothole_reports'`
- `source_row_id`
- `legacy_pothole_id`

## Phase 4: Backfill Existing Legacy Data

Backfill legacy pothole reports into `reports` only after phase 2 is live.

Requirements:

- preserve chronology
- preserve `report_number`
- preserve reporter metadata
- preserve lifecycle continuity
- avoid duplicate canonical reports

## Phase 5: Retire Legacy Special Cases

When older builds are no longer relevant:

- stop pothole-specific read paths in frontend
- stop legacy mirror trigger/function if direct writes move to `reports`
- eventually archive or retire the dedicated pothole persistence path

## What Was Added In This Pass

- migration: `supabase/migrations/20260702113000_pothole_canonical_read_surface.sql`
- new canonical read view: `public.canonical_report_rows_v1`

This is intentionally a safe first step. It creates the shared read surface we need for the next cutover without changing current live behavior.
