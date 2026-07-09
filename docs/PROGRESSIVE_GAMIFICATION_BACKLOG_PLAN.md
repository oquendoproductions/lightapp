# Progressive Gamification Backlog Plan

## Goal

Keep the app extremely simple for casual residents while allowing interested users to progressively discover deeper gamification features.

Core rule:

- reporting should feel simple
- gamification should feel optional
- engagement should deepen only when the user shows interest

## Product Principle

The app must support two experiences at the same time:

### 1. Casual Civic Utility

For most users:

- open app
- tap map or report button
- choose issue type
- submit
- leave

Requirements:

- no leaderboard required
- no badge required
- no profile required
- no game mechanic should block reporting

### 2. Optional Civic Game

For more engaged users:

- track impact
- earn badges
- verify reports
- complete missions
- climb rankings
- build a civic identity

## Progressive Disclosure Model

### Level 0: Anonymous / Casual Reporter

Default experience.

Visible:

- map
- report issue
- nearby issues
- simple status markers
- basic confirmation message

Hidden or minimized:

- XP
- badges
- leaderboards
- missions
- profile customization

Default post-submit copy:

- `Thanks — your report was submitted.`

### Level 1: Light Impact Awareness

Trigger examples:

- user submits 2 to 3 reports
- one report is verified or resolved

Introduce:

- personal contribution count
- subtle impact messaging

Example:

- `You've helped report 3 city issues.`
- CTA: `Track your impact`

### Level 2: Personal Impact Profile

Trigger examples:

- user taps `Track your impact`
- user signs in or creates an account

Introduce:

- basic profile
- reports submitted
- reports verified
- issues resolved
- impact score

### Level 3: Badge Discovery

Trigger examples:

- first resolved issue
- 5 validated reports
- 3 verified reports
- first category milestone

Introduce:

- small badge unlock treatment
- badge collection screen

Rule:

- never interrupt the reporting flow

### Level 4: Civic Identity

Trigger examples:

- repeated reporting in one category
- recurring verification activity
- impact milestone reached

Introduce category identity concepts such as:

- `Utility Scout`
- `Graffiti Spotter`
- `Dumping Detective`
- `Infrastructure Inspector`
- `Neighborhood Advocate`

### Level 5: Leaderboards

Trigger examples:

- 10 verified actions
- 5 resolved issues

Introduce:

- monthly leaderboard
- category leaderboard
- neighborhood leaderboard

Rule:

- rank by impact, not raw report count

### Level 6: Verification Missions

Trigger examples:

- positive reputation
- user opts into deeper participation

Introduce:

- nearby issues needing verification
- mission cards
- verification rewards

Example mission outcomes:

- `Still there`
- `Resolved`
- `Could not locate`
- `Wrong category`
- `Duplicate`

### Level 7: Power User / Civic Game Layer

Trigger:

- regular use of missions, badges, and rankings

Introduce:

- weekly challenges
- seasonal challenges
- advanced stats
- personal impact map
- category mastery
- neighborhood coverage
- hall of fame

## UI Requirements

### Main App Must Stay Simple

Primary screen should remain:

- map
- report button
- locate me
- filters/settings/menu
- optional `My Reports`

Do not place these directly on the main map for casual users:

- leaderboards
- badges
- missions
- XP

### Community Impact Area

Add a menu entry:

- `Community Impact`

This is the main home for optional gamification:

- profile
- impact score
- badges
- leaderboards
- missions
- stats

## Engagement Model

Use one shared gamification system for all signed-in users.

Rules:

- users do not choose between separate gameplay modes
- users choose how deeply they engage
- the app should keep default reporting simple
- deeper engagement happens by opening `Community Impact`, notifications, missions, badges, and leaderboards

Practical meaning:

- casual users can report issues, view their reports, and occasionally verify nearby issues
- engaged users can go deeper into stats, rankings, badges, and missions
- the app should invite deeper participation contextually, but not force it

## Animation Rules

Animations should scale by context and importance, not by a separate gameplay mode setting.

### Report Submitted

Purpose:

- confirm success without feeling childish

Treatment:

- marker pulse
- checkmark
- short confirmation

Text:

- `Report submitted.`

### Report Verified

Treatment:

- small checkmark
- impact count-up

Text:

- `Your report was verified. +5 Impact`

### Issue Resolved

Most important animation event.

Treatment:

- resolved marker glow
- impact count-up
- optional stronger celebration only for major milestones

Text:

- `Your report helped resolve an issue. +25 Impact`

### Badge Unlock

Treatment:

- badge card slides in
- small sparkle or glow

Text:

- `Badge Unlocked: Community Helper`

### Level / Rank Up

Treatment:

- progress bar fills
- rank emblem appears

Text:

- `You reached Neighborhood Advocate.`

## Design Asset Backlog

### Category Icons

Need consistent icons for:

- streetlight
- graffiti
- illegal dumping
- encampment
- street sign
- pothole
- sidewalk
- drainage
- traffic signal
- tree / vegetation
- general hazard
- other

### Status Icons

Need visual states for:

- submitted
- needs verification
- verified
- acknowledged
- in progress
- resolved
- rejected
- duplicate

### Badge Artwork

Initial groups:

- founder
- reporting
- category
- verification
- impact

### Rank / Identity Artwork

Suggested rank ladder:

- `Observer`
- `Reporter`
- `Helper`
- `Advocate`
- `Champion`
- `Steward`
- `Guardian`

Each rank should eventually have:

- name
- icon/emblem
- color style
- short description

## UX Rules

### Do Not Block Reporting

Gamification should never:

- require account creation before reporting
- add extra submit steps
- force profile setup
- force tutorial completion
- force leaderboard participation
- force notifications

### Reward Outcomes More Than Activity

Avoid:

- large rewards for raw submissions

Prefer:

- meaningful rewards for verified and resolved outcomes

### Discoverable, Not Mandatory

Good prompts:

- `Track your impact`
- `View badges`
- `See nearby missions`
- `Join monthly challenge`

Avoid:

- full-screen leaderboard after first report
- forced profile creation
- excessive popups
- loud visual effects by default

## Suggested Implementation Order

1. Keep post-report confirmation simple.
2. Add `Community Impact` entry point.
3. Add impact profile screen.
4. Add badge system quietly in backend first.
5. Add leaderboards later, only after scoring quality and anti-abuse controls exist.
6. Add verification missions after categories, reputation, duplicate detection, and abuse controls are stable.

## Engineering Structure Notes

Build gamification as optional and modular.

Suggested component boundaries:

- `ReportFlow`
- `ImpactProfile`
- `GamificationSettings`
- `BadgeUnlockToast`
- `LeaderboardScreen`
- `VerificationMissions`
- `ImpactEventLedger`

Core reporting must continue to work even if all gamification components are disabled.

## Final Product Rule

The app should feel like:

- a serious civic reporting tool for everyone

Only after the user chooses to go deeper should it feel like:

- a city improvement game

Gamification should be a rabbit hole, not a front door.
