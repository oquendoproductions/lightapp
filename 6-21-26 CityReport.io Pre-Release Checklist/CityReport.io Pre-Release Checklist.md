# [CityReport.io](http://CityReport.io) Pre-Release Checklist  
  
  
**Map Load**  
- [x] Android app map loads on cold start  
- [x] Android app map loads correctly after fully closing and reopening the app  
- [x] Web map loads on cold start without hanging on Loading map data...  
- [x] Web map loads correctly after a hard refresh  
- [x] Reports in view count appears and updates  
- [x] iPhone app map loads correctly after fully closing and reopening the app  
- [x] Tenant boundary renders correctly  
- [x] Map centers on the tenant area correctly  
- [x] iPhone app map loads on cold start  
**Toolbar Layout**  
- [x] Web toolbar matches native layout  
- [x] Incident filter appears as its own main tool button  
- [x] Filter tool no longer shows the 3-dot submenu marker  
- [x] Tool buttons open the expected menus or actions  
- [x] No missing or duplicated tool buttons appear  
- [x] Streetlights appears as its own main tool button  
**Map UI Icons**  
- [x] Custom published map UI icons render correctly on Android  
- [x] Custom published map UI icons render correctly on web  
- [x] Custom published map UI icons render correctly on iPhone  
- [x] Custom filter icon loads quickly enough after refresh/reopen  
- [x] No broken image placeholders appear  
- [x] Tintable SVG icons tint correctly in light mode  
- [x] Tintable SVG icons tint correctly in dark mode  
- [x] Full-color SVG or raster icons render without distortion  
- [x] Icon changes published from PCP appear live after publish  
- [x] Default bundled icons still render correctly  
**Map UI Icon Visibility Toggles**  
- [x] Disabling All Incident Reports hides it from the filter menu  
- [ ] Disabling any other map UI icon hides the related control cleanly  
- ==Does not happen on Bottom Navigation (except for Alerts and Events through PCP>tenant>domain + assets) which is fine. Should only work on Map Controls domain selector, domain map filter, and All Incident Reports. Currently does not work on Map Controls.==  
- [x] Re-enabling a hidden icon restores it cleanly  
- [x] Publish applies the full icon set at once  
- [x] Draft changes do not affect live until publish  
- [x] Re-enabling All Incident Reports brings it back  
**Map UI Theme**  
- [x] Menu colors update from the PCP theme settings  
- [x] Header colors update from the PCP theme settings  
- [x] Modal colors update from the PCP theme settings  
- [x] Bottom tab colors update from the PCP theme settings  
- [x] Tool button colors update from the PCP theme settings  
- [x] Active tool colors update correctly  
- [x] Light mode theme looks correct  
- [x] Dark mode theme looks correct  
- [x] Theme changes publish live correctly  
- [x] Theme remains readable with custom colors  
- ==Yes to all of these, but there are some things that do not have custom color options. See photos. ==  
**Layer and Domain Filtering**  
- [x] Streetlights layer and incident layer do not conflict visually  
- [x] Report markers shown match the active filter selection  
- [x] Hidden All Incident Reports does not break filtering behavior  
- [x] Clearing filters returns to all incident reports  
- [x] Multiple incident domain filters can be combined if intended  
- [x] Each incident domain filter can be turned on  
- [x] Tapping the incident filter button opens incident domain filters  
- [x] Tapping the streetlights button switches to streetlights layer  
**Domain Icons and Markers**  
- [ ] Confidence affects visibility only, not marker color  
- [x] Domain icons remain legible in dark mode  
- [x] Legacy domains behave the same as new global domains for visibility  
- [x] Marker colors stay consistent with PCP settings  
- [x] Marker icon tinting behaves correctly for domains where enabled  
- [x] Marker icons match the correct domains  
- [x] Domain filter icons match the correct domains  
**Map Interaction**  
- [ ] Navigation/follow button works  
- ==Yes, but navigation is still terrible when driving and probably the weakest part of the app. Location arrow stays set to  “up” on the screen, despite driving down the road and the map is catching up after a turn. Arrow should point down the road being traveled on and map should eventually (sooner rather than later) catch up where the road traveled on and the location arrow is at the top of the screen in the direction of travel.==  
- [x] Heading reset works  
- [x] Satellite toggle works  
- [x] Recenter/home button works  
- [x] My location works  
- [x] Zoom speed still feels correct  
- [x] Double tap and hold drag zoom still works naturally  
- [x] Pan works naturally after pinch zoom  
- [x] Pinch zoom works naturally  
**Report Creation**  
- [ ] Street sign report flow works if enabled  
- [ ] Water/drain report flow works  
- ==Issue type incorrect on email notification and info. Make sure rule is consistent for legacy domains. ==  
- ==Issue type not present in My Reports. Should be enabled for all domains if issue types are present.==  
- [x] Required disclosures appear when enabled  
- [x] Informational disclosures appear when enabled  
- [x] Required disclosure acknowledgement blocks submit until accepted  
- [x] Success state looks correct after submit  
- [x] Reports submit successfully  
- [x] Pothole report flow works  
- [x] Streetlight report flow works  
- ==Yes, but the Issue types are wrong and do not change with platform>tenant>domain customization. ==  
- [x] Report modal icons match the domain selector/filter icons  
- [x] Report modal opens with correct domain icon  
**Report Details and Map Data**  
- [ ] Road placement validation behaves correctly  
- ==Yes, but prompt should come after domain selection and before report flow, not after. ==  
- [ ] Reports placed on roads are accepted  
- ==Not always. Sometimes on road placement still forbids report completion.==  
- ==Also, received “Couldn’t submit: new row violates row-level security policy for table "potholes"” notification. ==  
- [x] No distorted marker icons appear  
- [x] Report icons on the map look centered and clean  
- [x] Address replaces coordinates after lookup  
- [x] Info window or report preview loads the address  
**PCP Admin Flow**  
- [x] Theme color pickers behave correctly  
- [x] No broken preview states appear in PCP after changing render mode  
- [x] Choosing render mode before file and after file both behave correctly  
- [x] Render mode changes preview correctly  
- [x] Uploading full-color SVG icons works  
- [x] Uploading tintable SVG icons works  
- [x] Publish live updates the app correctly  
- [x] Uploading raster icons works  
- [x] Reset draft restores published version correctly  
- [x] Map UI icon draft saves successfully  
**Notifications and Counts**  
- [ ] Alerts tab icon and count display correctly  
- ==Yes, but expired alerts should be removed from alerts lists.==  
- ==Already viewed alerts should not continue populate notification badges.==   
- [ ] Events tab icon and count display correctly  
- ==Yes, but expired events should be removed from events lists.==  
- ==Already viewed events should not continue populate notification badges.==   
- [ ] Reports in view count remains accurate while moving around the map  
- ==Report in view number not accurate. Counted 28 reports. RIV says 31. Even with report marker bundling being inaccurate at 30, still not correct.==  
- [x] No badge/icon regressions appear after theme or icon changes  
**Daily Use Stability**  
- [x] No white screen appears on web  
- [x] No white screen appears on Android  
- [x] No map tool becomes unresponsive after switching layers repeatedly  
- [x] No major delay happens when opening the map  
- [x] No repeated loading/fetch loops appear in console/logcat/Xcode logs  
- [x] No white screen appears on iPhone  
**Final Pass**  
- [ ] Test one full session in light mode  
- [ ] Test one full session in dark mode  
- [ ] Test one full session on web  
- [ ] Test one full session on iPhone  
- [ ] Test one full session on Android  
- [ ] Confirm there are no blockers before submission  
  
### Hub Notes  
- Users should not be able to login to any tenant hub that they are not an employee of or authorized to be in.  
- The hub reports should reflect all domains that are active or have been active and enabled for a tenant, past or present. Reports filter should reflect such domains. Also, the domain icons need to match the appropriate active icons. The filter should be a dropdown, with the option to select one or more domains, with an All Domains option.   
- Hub>Organization Info>Report Digests>Recent delivery history should be a section that encompasses the recently delivered digest. The list of recently sent digests should default as collapsed within the Recent delivery history section.  
- Hub needs general polish that can be done once everything is structured and working as it should.  
  
### PCP Notes  
- Needs general polish and organizing.  
    - Part of that polish should be filtering active/inactive domains for tenants. Maybe consider a way that inactive domains do not show on the domains list. But, I do not want historical record deleted and if the domain goes active again, I want the records to pick up where they left off.   
- Need to add/edit security checkpoints and permissions for things like UI theme and UI icon changes, and UI map tool visibility  
