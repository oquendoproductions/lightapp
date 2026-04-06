# CityReport.io Product Brief

## Purpose

CityReport.io is a municipal infrastructure accountability platform. It helps residents, municipal staff, and internal operators report, triage, track, and resolve infrastructure issues through a governed workflow that turns raw issue intake into auditable lifecycle accountability.

The product is designed to support civic operations, public trust, and measurable pilot outcomes. It is not positioned as an emergency service or a guarantee of agency response. Its role is to improve intake quality, operational visibility, and reporting clarity for infrastructure issues that cities and partner entities need to manage.

## Positioning

CityReport.io should generally be described as:

- A municipal infrastructure accountability platform
- A map-based reporting and operations workflow
- A civic operations tool for intake, triage, lifecycle tracking, and reporting

Avoid describing it as:

- A generic social app
- A public safety emergency system
- A promise that reported issues will be fixed by a specific deadline

## Who It Serves

Primary audiences:

- Residents reporting visible infrastructure issues
- Municipal staff reviewing and resolving reports
- City administrators evaluating operational performance and pilot outcomes

Secondary audiences:

- Utilities or responsible service entities receiving forwarded issue information
- Procurement, legal, and pilot stakeholders reviewing accountability metrics

## Current Product Scope

Current pilot-facing municipal domains:

- `potholes`
- `water_drain_issues`

Additional in-app or adjacent domains:

- `streetlights` as a utility-information/support layer
- Street-sign workflows exist in parts of the codebase/admin tooling

Future expansion may include additional municipal issue categories, but prompts should default to the currently active pilot scope unless the task clearly involves broader domain work.

## Core Product Functions

CityReport.io currently supports:

- Public-facing infrastructure issue intake
- Map-based issue reporting
- Location capture and issue categorization
- Optional media upload with reports
- Administrative review and triage workflows
- Lifecycle-based issue tracking from report to resolution
- Search, filtering, and operational queue management
- Marking incidents fixed with notes
- Reopen tracking when issues recur
- CSV export and metrics support for pilot evaluation
- Public/internal reporting separation for accountability use cases
- Lead capture from the marketing homepage

## Core Workflow

At a high level, CityReport.io works like this:

1. A resident or staff member submits an infrastructure report.
2. The system records location, issue details, source, and optional media.
3. Related reports may be aggregated into the same incident or cluster.
4. Municipal staff review and confirm the incident.
5. Staff track progress through the incident lifecycle.
6. The incident is marked fixed, or reopened if new evidence shows the issue persists.
7. The system supports exports, metrics, and pilot reporting for accountability review.

## Incident Lifecycle

CityReport.io uses a canonical lifecycle model for incident state tracking:

1. `reported`
2. `aggregated`
3. `confirmed`
4. `in_progress`
5. `fixed`
6. `reopened`
7. `archived`

Important product rule:

- Prompts that involve status, dashboards, filters, or metrics should align with this canonical lifecycle rather than inventing ad hoc status logic.

## Accountability Model

CityReport.io is not just a reporting form. Its core value is accountability.

That means the product should preserve:

- Clear lifecycle state transitions
- Auditability of issue progress
- Separation between public-safe summary data and internal operational detail
- Metrics that help municipalities evaluate performance
- Evidence that supports pilot review, procurement conversations, and operational trust

Common accountability outcomes include:

- Reduced time to confirm and fix issues
- Lower reopen rates
- Better identification of chronic locations
- Better triage efficiency through aggregation and workflow structure

## Product Characteristics To Preserve

When writing code, docs, copy, or prompts for this project, preserve these qualities:

- Trustworthy
- Civic-minded
- Operationally clear
- Mobile-friendly
- Map-centric where relevant
- Focused on speed and clarity over unnecessary complexity
- Serious in tone when discussing infrastructure issues

Preferred messaging style:

- Clear
- Direct
- Helpful
- Community-aware

Avoid:

- Overhyped startup language
- Vague civic-tech jargon
- Playful messaging that trivializes public infrastructure issues

## Technical Snapshot

Current high-level implementation includes:

- A public marketing homepage with lead capture
- A map-based reporting and operations app at `/gmaps`
- A Supabase backend for auth, database, storage, and edge functions
- Google Maps-based geospatial functionality

## Prompting Guidance For Future Work

If future prompts need product context, use the following assumptions unless the task says otherwise:

- The app is called `CityReport.io`.
- It is a municipal infrastructure accountability platform.
- The current pilot scope centers on potholes and water/drain issues.
- Streetlights exist, but should usually be treated as a utility-information/support workflow rather than the main municipal accountability domain.
- The product should respect lifecycle-based tracking and auditable state transitions.
- Public-facing outputs should avoid exposing internal-only operational detail or sensitive data.
- Marketing and product copy should sound trustworthy, modern, and civic-minded rather than flashy.

Useful prompt shorthand:

> Treat CityReport.io as a municipal infrastructure accountability platform focused on report intake, triage, lifecycle tracking, and accountability reporting for city operations.

## Source-Of-Truth References

Use these documents when deeper detail is needed:

- `docs/governance/week4/pilot-overview-one-page.md`
- `docs/governance/week1/01-lifecycle-spec.md`
- `docs/governance/week2/07-dashboard-structure-spec.md`
- `docs/LEGAL_CAPABILITY_BRIEF.md`
- `docs/agents/brand.md`

## Intended Use Of This Document

This file is meant to give future prompts a fast, stable description of what CityReport.io is and how it should be discussed. It is the lightweight orientation doc. More detailed governance, legal, analytics, and implementation rules should still come from the supporting docs listed above.
