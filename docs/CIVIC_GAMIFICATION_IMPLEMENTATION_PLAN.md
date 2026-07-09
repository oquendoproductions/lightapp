# Civic Gamification Implementation Plan

## Goal

Turn CityReport from a reporting tool into a civic action system that rewards verified impact:

- not raw report volume
- yes to verification, resolution, reliability, diversity, and real-world follow-through

The right product posture is:

- residents compete to improve the city
- reports are cheap
- verified impact is valuable

## Fit With Current Architecture

This app already has the core primitives needed for a strong first version:

- incident lifecycle event log: `public.incident_events`
- current incident snapshot: `public.incident_state_current`
- public repair confirmations: `public.incident_repair_signals`
- user-owned report tracking: `public.utility_report_status`
- resident account profile surface: `profiles` used by `src/MapGoogleFull.jsx`
- tenant/domain configuration: `public.tenant_domain_configs` and domain registry migrations
- existing abuse and rate-limit foundation: `abuse_rate_events`, `rate-limit-gate`, duplicate/report quality logic

That means gamification should extend the current incident model, not replace it with a second parallel report system.

## Key Product Decisions

### 1. Do not create a second category model

Your proposed `category` field maps cleanly to the existing incident domain model.

Use the domain registry as the canonical category system:

- `streetlights`
- `potholes`
- `street_signs`
- `water_drain_issues`
- `graffiti`
- `illegal_dumping`
- `encampment`
- future domains added through the registry

Recommendation:

- keep `incident_domain` / domain registry as source of truth
- treat “category” as UI language layered on top of domain keys

### 2. Do not replace the current status flow

Current lifecycle state is already event-driven and operationally meaningful:

- `reported`
- `aggregated`
- `confirmed`
- `in_progress`
- `fixed`
- `reopened`
- `archived`

Your proposed status list mixes:

- operational workflow
- moderation outcomes
- verification state

Recommendation:

- keep `incident_state` for operational lifecycle
- add separate gamification and moderation tables for:
  - verification results
  - duplicate decisions
  - abuse decisions
  - contributor scoring events

This avoids breaking exports, metrics, and existing pilot logic.

### 3. Reuse `profiles` for identity, add contributor tables for scoring

The app already has a resident profile concept. Avoid a second user identity table unless separation becomes necessary later.

Recommendation:

- keep `profiles` as resident identity/account profile
- add `contributor_profiles` for public-game settings and cached totals
- link by `user_id`

## Recommended Data Model

### A. `contributor_profiles`

Purpose:

- public-facing civic identity
- cached score totals
- visibility / moderation controls

Suggested columns:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `display_name text`
- `avatar_url text`
- `public_profile_enabled boolean not null default true`
- `xp_total integer not null default 0`
- `impact_score integer not null default 0`
- `reputation_score integer not null default 0`
- `reports_submitted integer not null default 0`
- `reports_verified integer not null default 0`
- `issues_resolved integer not null default 0`
- `reliability_score numeric(5,2)`
- `leaderboard_visible boolean not null default true`
- `trust_tier text not null default 'standard'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notes:

- `xp_total` and `impact_score` can be public
- `reputation_score` should remain internal
- `trust_tier` can drive privileges such as verification eligibility and throttling

### B. `contributor_impact_events`

This is the most important new table. Do not store only totals.

Purpose:

- append-only scoring ledger
- audit trail for leaderboards, appeals, fraud review, and recalculation

Suggested columns:

- `id bigserial primary key`
- `tenant_key text not null references public.tenants(tenant_key) on delete cascade default public.request_tenant_key()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `incident_domain public.incident_domain not null`
- `incident_id text not null`
- `source_report_id text`
- `source_verification_id bigint`
- `event_type text not null`
- `xp_amount integer not null default 0`
- `impact_amount integer not null default 0`
- `reputation_delta integer not null default 0`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Recommended `event_type` values:

- `report_submitted`
- `report_verified`
- `report_confirmed`
- `issue_resolved`
- `resolution_verified`
- `duplicate_report`
- `invalid_report`
- `abuse_confirmed`
- `photo_bonus`
- `category_diversity_bonus`
- `geographic_coverage_bonus`

### C. `incident_verifications`

Purpose:

- support nearby missions
- record community verification outcomes separately from lifecycle state

Suggested columns:

- `id bigserial primary key`
- `tenant_key text not null references public.tenants(tenant_key) on delete cascade default public.request_tenant_key()`
- `incident_domain public.incident_domain not null`
- `incident_id text not null`
- `user_id uuid references auth.users(id) on delete set null`
- `verification_type text not null`
- `result text not null`
- `photo_url text`
- `lat double precision`
- `lng double precision`
- `distance_meters integer`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Recommended `result` values:

- `still_present`
- `resolved`
- `could_not_locate`
- `wrong_category`
- `duplicate`

Rules:

- unique cooldown per `(tenant_key, incident_domain, incident_id, user_id, verification_type, window)`
- no XP for verifying your own issue
- location proximity required for rewarded verification

### D. `contributor_badges`

Purpose:

- badge unlock ledger

Suggested columns:

- `id bigserial primary key`
- `tenant_key text not null references public.tenants(tenant_key) on delete cascade default public.request_tenant_key()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `badge_key text not null`
- `awarded_at timestamptz not null default now()`
- `metadata jsonb not null default '{}'::jsonb`
- `unique (tenant_key, user_id, badge_key)`

### E. `leaderboard_period_stats`

This can start as a view, then move to a materialized view if needed.

Purpose:

- fast weekly/monthly/all-time rankings

Suggested dimensions:

- `period_type`: `week | month | all_time`
- `period_start`
- `tenant_key`
- `incident_domain nullable`
- `neighborhood nullable`
- `user_id`

Suggested measures:

- `impact_score`
- `xp_total`
- `reports_verified`
- `issues_resolved`
- `reliability_score`

## Scoring Rules

### Locked scoring baseline

Use one public score:

- `Impact`

Track these separately for stats, badges, and rank context:

- reports submitted
- validated reports submitted
- issues resolved
- verifications completed

### Report submission

- `Report submitted`: `0 Impact`
- `Photo attached to original report`: `+5 Impact`

Submitting alone should not be rewarded. Photo evidence can earn a small bonus.

### Verification scoring

Original reporter:

- first unique verification: `+10 Impact`
- second unique verification: `+5 Impact`
- third and later verifications: `0`

Verifier:

- verification without photo: `0 Impact`
- verification with photo: `+5 Impact`

Rules:

- original reporter cannot verify their own report
- only unique users count
- repeat verification attempts by the same user do not count again
- verifications contribute to verification stats and badge thresholds even when they do not award direct points

### Negative verification and dispute flow

- `1` negative verification: no penalty
- `2` independent negative verifications: mark `Needs another check`
- `3` independent negative verifications: mark `Disputed` and apply penalty

Current penalty direction:

- `Disputed report`: `-10 Impact`
- `Admin-confirmed invalid report`: `-25 Impact`

### Resolution scoring

Original reporter:

- resolved issue: `+25 Impact`

Resolution confirmers:

- first unique confirmer: `+10 Impact`
- second unique confirmer: `+10 Impact`
- third unique confirmer: `+5 Impact`
- fourth and later confirmers: `0`

Rules:

- only unique users count
- original reporter does not confirm their own resolution for reward
- resolution rewards should be capped to prevent pile-on farming

### Tenant-managed vs community-managed resolution

Resolution authority depends on tenant configuration:

- if a tenant manages reports in the backend, tenant/admin resolution is authoritative
- if a tenant does not manage reports in the backend, community resolution can be authoritative

Community confirmations may still contribute signal in both models, but final authority changes by tenant setup.

### Important scoring gate

A report should count as meaningful civic impact only when it reaches at least one of these outcomes:

- verified by another unique user
- resolved by city/admin workflow
- resolved by community workflow where that tenant allows community-managed resolution

This should be enforced in the ledger writer, not just in the UI.

## Reliability and Reputation

Hidden reputation should decide who gets trust, not just who gets points.

Recommended derived metrics:

- `report_validation_rate`
- `duplicate_rate`
- `resolution_followthrough_rate`
- `verification_accuracy_rate`
- `abuse_strike_count`

Recommended trust tiers:

- `probation`
- `standard`
- `trusted`
- `steward`

Suggested effects:

- `probation`
  - reduced XP multipliers
  - no leaderboard visibility
  - verification disabled
  - tighter cooldowns
- `trusted`
  - verification enabled
  - normal leaderboard visibility
  - faster public visibility for reports
- `steward`
  - can confirm more mission types
  - higher moderation weight

## Nearby Missions

This is the strongest feature in the plan because it changes behavior from “submit complaints” to “help validate city conditions.”

### Mission types

- verify open issue
- confirm issue still exists
- confirm likely repair
- flag wrong category
- flag likely duplicate

### How it should map to current system

- use `incident_state_current` to find active incidents
- use `incident_repair_signals` for repair-confirmation progress
- use `incident_verifications` for mission completions
- derive “mission candidates” by proximity to user location plus freshness rules

### Core guardrails

- cannot verify your own report for reward
- must be near the issue
- must respect cooldowns
- repeat identical verifications should not pay twice
- low-reputation users should not be able to swing outcomes alone

## Leaderboards

Do not launch with one all-time list only.

Recommended v1:

1. Overall
2. This Week
3. This Month

Leaderboard categories:

- `Impact Score`
- `Verification Leaders`
- `Issues Resolved`

Rules:

- `Impact Score` is the primary leaderboard
- do not create a public leaderboard for raw reports submitted
- reports submitted can remain visible in personal stats only
- public verification ranking should be weighted for usefulness and accuracy, not raw volume
- if the current user is outside the visible top ranks, still show their own position separately

Recommended secondary metrics displayed in the profile:

- reports submitted
- validated reports submitted
- issues resolved
- verification count
- reliability percentage
- top categories helped

Neighborhood and category leaderboards can follow once geocoding and district mapping are stable.

## Public Profile

The public profile should feel like a civic record, not gamer vanity.

Recommended profile stats:

- `Community Impact`
- `Issues Reported`
- `Issues Verified`
- `Issues Resolved`
- `Reliability`
- `Top Categories`
- `Neighborhoods Helped`

Recommended language:

- `Impact`
- `Verified Contributor`
- `Community Reliability`
- `Neighborhood Champion`

Avoid:

- “complaint count”
- “top complainer”
- any copy that rewards noise

## Badges

Badges fit well, but should unlock from verified actions only.

Locked badge families:

- `Impact Badges`
- `Trusted Reporter Badges`
- `Resolution Badges`
- `Field Checker Badges`
- `Regional Impact Badges`

### Impact Badges

Purpose:

- platform-wide progression milestones based on cumulative `Impact`

Locked ladder:

| Threshold | Badge Name |
|---|---|
| 25 | `First Spark` |
| 100 | `Making a Difference` |
| 250 | `Impact Builder` |
| 500 | `Civic Contributor` |
| 1000 | `Trusted Presence` |
| 1750 | `Community Force` |
| 2750 | `Lasting Impact` |
| 4000 | `Citywide Influence` |
| 5000 | `Legacy Builder` |

### Trusted Reporter Badges

Purpose:

- reward original reporters whose reports proved real

A report counts toward this family only if it becomes a qualifying report:

- validated by `2` independent corroborations, or
- resolved by city/admin workflow, or
- resolved by community workflow where that tenant allows community-managed resolution

A report counts once maximum.

A report does not count if it is:

- only submitted
- `Needs another check`
- `Disputed`
- admin-confirmed invalid

Locked thresholds and names:

| Threshold | Badge Name |
|---|---|
| 1 | `First Confirmed` |
| 5 | `Proven Reporter` |
| 10 | `Verified Source` |
| 25 | `Trusted Source` |
| 50 | `Reliable Signal` |
| 100 | `Citywide Signal` |

### Resolution Badges

Purpose:

- reward original reporters whose issues ended in actual fixes

Any qualifying resolved issue counts as `1` resolution badge credit for the original reporter, whether the tenant is city-managed or community-managed.

Locked thresholds and names:

| Threshold | Badge Name |
|---|---|
| 1 | `First Fix` |
| 5 | `Problem Solver` |
| 10 | `Neighborhood Helper` |
| 25 | `Community Advocate` |
| 50 | `City Improver` |
| 100 | `Civic Resolver` |

### Field Checker Badges

Purpose:

- reward users who verify other people’s issues in the field

A qualifying field check must:

- be performed by a signed-in user
- be on a report the user did not create
- occur within the verification radius
- respect the cooldown rules
- not come from the same app install / device ID as the original reporter
- include the required photo proof
- not be later invalidated as abuse

Locked thresholds and names:

| Threshold | Badge Name |
|---|---|
| 1 | `First Check` |
| 5 | `Field Spotter` |
| 10 | `Issue Checker` |
| 25 | `Trusted Checker` |
| 50 | `Ground Truth` |
| 100 | `Field Expert` |

### Regional Impact Badges

Purpose:

- reward meaningful contribution across distinct tenants

A tenant counts toward this family only if the user has a meaningful qualifying contribution there, such as:

- at least one validated report
- at least one resolved report
- at least one successful verification mission

Locked thresholds and names:

| Distinct Tenants Helped | Badge Name |
|---|---|
| 2 | `Crossing Boundaries` |
| 3 | `Regional Reach` |
| 5 | `Regional Presence` |
| 10 | `Civic Connector` |

Store badge rules in code first. Move to a database rule catalog only if the badge matrix grows large.

## Abuse Prevention

This plan only works if anti-abuse is part of the scoring system, not an afterthought.

Recommended v1 controls:

- per-user submit rate limits
- per-location/category cooldowns
- duplicate detection by domain + proximity + time window
- no self-verification rewards
- verification proximity requirement of roughly `50 feet`
- no repeated reward from the same verification loop
- hidden reputation penalties
- leaderboard suppression for low-trust accounts
- photo requirement for selected domains
- admin override path for fraud decisions

This app already has enough groundwork to implement most of this without inventing a second abuse system.

## Recommended Implementation Order

The current product already has lifecycle and repair-confirmation behavior. The best rollout is:

### Phase 1: scoring foundation

1. Add `contributor_profiles`
2. Add `contributor_impact_events`
3. Add DB functions/triggers to update cached totals
4. Backfill contributor totals from existing report and repair data where possible

### Phase 2: public profile

1. Extend resident account/profile UI
2. Show `Impact`, `Reliability`, `Issues Resolved`, `Issues Verified`
3. Keep hidden reputation internal only

### Phase 3: leaderboard foundation

1. Create leaderboard view/materialized view
2. Add `Overall`, `This Week`, and `This Month` leaderboard UI
3. Hide users who disable public profiles or fall below trust threshold

### Phase 4: mission system

1. Add `incident_verifications`
2. Build Nearby Missions query
3. Add mission completion flow with location gate
4. Award verification and resolution-confirmation events through the ledger

### Phase 5: badges

1. Add `contributor_badges`
2. Add badge evaluation on event insert
3. Add profile badge display

### Phase 6: hardening

1. Add reputation-derived trust tiers
2. Add shadow cooldowns and reduced payout for suspicious users
3. Add moderation/admin tooling for appeals and fraud review

## What Not To Do

Avoid these mistakes:

1. Do not pay large points at report submission time.
2. Do not let users verify their own reports for value.
3. Do not overload `incident_state` with moderation and scoring concepts.
4. Do not make leaderboard rank depend on raw report count.
5. Do not build badges before the event ledger exists.
6. Do not expose hidden reputation directly to users.

## Recommended MVP Definition

If the goal is a fast but defensible first release, the MVP should be:

- contributor profile totals
- append-only impact ledger
- monthly leaderboard
- basic public profile
- one mission type: verify an open issue nearby
- one resolution mission type: confirm fixed nearby
- hidden reputation with simple trust gating

That is enough to prove the behavior change without turning the app into a noisy points farm.

## Product Positioning

Best framing:

- `Waze for civic issues`
- `Pokemon GO for fixing your city`
- `Compete to improve your neighborhood`

The app should feel like a resident participation system, not a gamified complaint inbox.

## Final Rule

The scoring system should answer one question:

Did this user increase confidence that a real civic issue was identified, validated, or resolved?

If yes, reward it.
If not, do not.
