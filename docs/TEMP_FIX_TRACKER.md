# Temporary Fix Tracker

Purpose: capture reported fixes and polish items before making changes.

Rules:
- Do not delete this file until every listed item is fixed and verified.
- Use this file to track issues one by one.
- Remove items only after the fix is deployed and confirmed.

Status legend:
- `open`
- `in_progress`
- `verified`

## Items

1. [verified] Map domain selector should stay open after tapping `All Incidents Reports`
   - Notes: In the map domain selector, tapping `All Incidents Reports` currently closes the domain list immediately. This happens both when enabling all incident markers and when disabling them. The domain list should remain open until the user taps outside the list.
   - Reported: 2026-06-29
   - Fixed: 2026-06-29
   - Verified: 2026-06-29

2. [verified] Improve wording for Google geolocation/geocoding failure notice
   - Notes: Current notice wording for the Google location lookup/quota failure does not feel right. Reword it so it is clearer and better polished, while still accurately describing the problem if it ever appears again.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

3. [verified] Add location-unavailable type notices to PCP notice configurator
   - Notes: If the app shows location unavailable / lookup unavailable notices, those notices should be available in the PCP notice system configurator alongside the other configurable notices.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

4. [verified] `Is fixed` button still appears active for incidents already confirmed by the current user
   - Notes: For domains with the resident `Is fixed` flow, incidents previously marked fixed by the current user can still show the green active `Is fixed` button on load. The user can go through the flow again before receiving the `Already confirmed` notice. The button should load in a disabled/greyed-out state immediately for those incidents.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

5. [verified] Admin `Incidents` → `View` should route to `All Reports` in the Reports tab, not a separate admin reports page
   - Notes: From an admin login, clicking `Incidents` and `View` currently opens a separate Admin Reports page. That flow should now route into the Reports tab’s `All Reports` view instead of taking the admin to a separate page.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

6. [verified] Save location information when an incident marker is created so future lookups are unnecessary
   - Notes: When a marker/incident is placed, its location information should be collected and saved at creation time so future info windows and report views can use the stored location data instead of fetching it again later.
   - Implementation: Generic incident-driven domains and street signs now persist incident location metadata through a durable tenant/domain/incident cache path at creation time.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

7. [verified] Remove pothole ID sort options from `All Reports` sort menu
   - Notes: In the `All Reports` sort menu, pothole ID-specific sort options should be removed.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

8. [verified] Remove pothole ID sort options from `My Reports` sort menu
   - Notes: In the `My Reports` sort menu, pothole ID-specific sort options should also be removed.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

9. [verified] Make Park Equipment incident ID layout match other domains in native `My Reports`
   - Notes: In the native app under `My Reports`, Park Equipment shows its incident ID to the right of the domain name, while other domains place the incident ID underneath the domain title. Make Park Equipment match the standard layout and harden the rendering so future domains follow the same rule by default.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

10. [verified] Replace the location marker with the navigation marker when navigation mode is enabled
   - Notes: When navigation is turned on, the navigation icon should completely replace the location icon instead of behaving like a separate marker. This includes matching the location marker’s placement while using the navigation marker’s correct sizing and always-up heading behavior.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

11. [verified] Review and define appropriate alert and event categories/topics
   - Notes: Alert topics and event topics need to be split cleanly. Alerts should keep civic notice topics like emergency alerts, utilities, road closures, maintenance, trash/recycling, and general city updates. Events should use event-specific topics like community events, parades, festivals, meetings, and similar. Topic sets also need tenant-level management in the PCP so each tenant can add or remove topics without code changes.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

12. [verified] Streetlight location info in `My Reports` should support click-to-copy and include `Report to Utility`
   - Notes: In `My Reports`, when clicking a streetlight incident ID to open its location information, the location details should be click-to-copy. Also add a `Report to Utility` button in that streetlight location information modal above the bottom `Close` button.
   - Reported: 2026-06-29
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

13. [in_progress] Resume and harden incident location fetching/caching for incident IDs across domains
   - Notes: Location information for incident IDs is still unreliable in general. Review any paused/blocked fetch logic, ensure fresh lookups can run when cached data is missing or placeholder-only, and persist the resolved location data back to the incident cache so future incident ID opens do not need to refetch.
   - Implementation: Missing location info now triggers an on-demand fetch from info windows / incident ID views, and successful fetches are backfilled into the same durable incident cache for future use.
   - Reported: 2026-06-30
   - Fixed: 2026-06-30
   - Verified:

14. [verified] App feels slow/laggy on first interactions, especially tab switches and first clicks
   - Notes: On native, switching between tabs can take several seconds on first open, and initial taps/interactions feel delayed. After the first slow interaction, behavior sometimes becomes smoother. Need to inspect first-render / first-open performance regressions and reduce the lag enough that testing is reliable again.
   - Reported: 2026-06-30
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

15. [verified] Reports tab filter search field is slow to focus/respond
   - Notes: Selecting the search field inside the Reports tab filter is slow to respond, and the keyboard can take several seconds to appear before typing. Reduce first-focus and first-interaction lag so the search field becomes usable immediately.
   - Reported: 2026-06-30
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

16. [verified] Reports tab filter search should support incident ID searches
   - Notes: Searching by incident ID in the Reports tab filter should populate matching incidents reliably, including formatted public incident IDs.
   - Reported: 2026-06-30
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

17. [verified] Fresh native loads feel slow on first response before warming up
   - Notes: After deleting the app and doing a fresh native load, the app is slow to respond on first interaction from the `Find your City` screen and elsewhere. Once that first response happens, repeating the same steps becomes faster. Investigate cold-start / first-interaction work that is blocking input and harden startup responsiveness so a fresh install/load does not feel stalled.
   - Reported: 2026-06-30
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

18. [verified] `Find your City` card shifts above the top screen bound when keyboard opens
   - Notes: On the native `Find your City` startup screen, tapping into the city search field can push the card upward past the top of the screen when the keyboard opens. This regression has reappeared multiple times and needs to be hardened so the card always remains fully within the visible viewport during keyboard transitions.
   - Reported: 2026-06-30
   - Fixed: 2026-06-30
   - Verified: 2026-06-30

19. [verified] All report domains should block report submission outside tenant boundaries
   - Notes: Some domains correctly notify the user and block submission when the tapped report location is outside the tenant or organization boundary, but others do not. All current and future domains should enforce tenant-boundary validation consistently. The water/drain reporting flow is the reference behavior: detect out-of-bounds placement, show the boundary notice, and prevent the report from being created.
   - Reported: 2026-06-30
   - Fixed: 2026-07-01
   - Verified: 2026-07-01

20. [in_progress] Road-required domains sometimes reject taps that are visibly on the road surface
   - Notes: In some cases, tapping directly on a road for a road-required domain still triggers the `Road required` notice. The validation needs to be hardened so normal on-road taps are accepted reliably instead of failing due to an overly strict snap/offset check.
   - Reported: 2026-07-01
   - Fixed:
   - Verified:

21. [in_progress] Map-tap report picker must derive from the same tenant/runtime incident-domain rules as the map layer
   - Notes: A tenant can have a domain active, visible, and incident-driven in PCP, but the map-tap report picker may still omit it if the picker keeps its own hard-coded domain exclusions. Harden the picker so it derives directly from the shared tenant/runtime incident-driven selector with no per-domain deviations.
   - Implementation: The picker now derives directly from `incidentLayerDomainOptions`, and the shared built-in domain baseline has been centralized so the map and PCP do not keep separate default domain catalogs.
   - Reported: 2026-07-02
   - Fixed: 2026-07-02
   - Verified:

22. [open] Streetlights should remain on the asset-backed track and be normalized there later
   - Notes: `streetlights` should not be forced into the generic incident-driven contract during this pass. Keep them stable for now, then fold their special cases into a future asset-backed hardening pass so utility-owned/report-to-utility behavior is normalized without disturbing the live resident flow.
   - Reported: 2026-07-02
   - Fixed:
   - Verified:

<!--
Template:

1. [open] Short issue title
   - Notes:
   - Reported:
   - Fixed:
   - Verified:
-->
