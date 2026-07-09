# Full App QA Tracker

Purpose:
- Use this file for whole-app verification after the fix list is nearly complete.
- Mark each item as `pending`, `pass`, or `fail`.
- Add short notes under any failed item so we can convert it into a focused fix entry if needed.

Status legend:
- `pending`
- `pass`
- `fail`

## Startup / Tenant Entry

1. [pass] Fresh load opens without white screen or fatal console/runtime break
   - Notes:

2. [pass] `Find your City` search field opens keyboard without pushing card off-screen
   - Notes:

3. [pass] City search returns selectable tenant results
   - Notes:

4. [pass] Selecting tenant enters map cleanly
   - Notes:

5. [pass] Closing and reopening app re-enters tenant flow cleanly
   - Notes:

## Map Basics

6. [pass] Map header, tabs, markers, and overlays render in correct positions
   - Notes:

7. [pass] Dark mode keeps map overlays and controls readable
   - Notes:

8. [pass] `My Location` recenters correctly
   - Notes:

9. [pass] Enabling navigation replaces the location marker with navigation marker
   - Notes:

10. [pass] Disabling navigation removes navigation marker and restores normal location behavior
   - Notes:

11. [pass] Panning and zooming do not break map interaction
   - Notes:

12. [pass] Marker taps open info windows without white screen
   - Notes:

## Map Domain Selector

13. [pass] Domain selector opens with `All Incidents` enabled by default
   - Notes:

14. [pass] Tapping `All Incidents` deselects all domains without closing selector unexpectedly
   - Notes:

15. [pass] Tapping `All Incidents` again re-enables all domains
   - Notes:

16. [pass] Starting from `All Incidents`, tapping one domain removes only that domain and leaves others active
   - Notes:

17. [pass] Rapidly toggling domains hits the intended domain accurately
   - Notes:

18. [pass] Tapping outside the selector closes it normally
   - Notes:

## Map Reporting Flow

19. [pass] Tapping map opens domain picker before any domain-specific reporting flow
   - Notes:

20. [pending] Road-required domains validate road placement only after domain selection
   - Notes:

21. [pending] Non-road-required domains do not incorrectly enter pothole flow
   - Notes:

22. [pending] All incident-driven domains block out-of-boundary reports with boundary notice
   - Notes:

23. [pending] All incident-driven domains can proceed inside tenant boundary
   - Notes:

24. [pending] Park-required domains block out-of-park reports with park notice
   - Notes:

25. [pending] Park-required domains can proceed inside park boundary
   - Notes:

26. [pending] Domain disclosures and acknowledgements gate submission correctly
   - Notes:

## Resident Report Submission

27. [pending] Test report submission succeeds for each major public domain in scope
   - Notes:

28. [pending] Duplicate-protection behavior still works where expected
   - Notes:

29. [pending] Image-upload domains still allow attaching image
   - Notes:

30. [pending] Non-image domains do not incorrectly show image upload controls
   - Notes:

31. [pending] Success notices appear with correct wording and no layout break
   - Notes:

## Marker Info Windows

32. [pending] Non-org-managed admin info windows show `Status`, not `State`
   - Notes:

33. [pending] Non-org-managed admin info windows do not show `All Reports`
   - Notes:

34. [pending] Org-managed admin info windows show `State` and `Update State`
   - Notes:

35. [pending] Coordinates look clickable and copy correctly
   - Notes:

36. [pending] Copy success notice/toast placement is correct
   - Notes:

37. [pending] Resident `Is fixed` button is active only when appropriate
   - Notes:

38. [pending] Previously fixed-by-user incidents load with greyed out, non-runnable `Is fixed`
   - Notes:

## Reports Tab: My Reports

39. [pending] `My Reports` opens without regressions
   - Notes:

40. [pending] Listing format is consistent across domains
   - Notes:

41. [pending] Park Equipment layout matches standard domain layout
   - Notes:

42. [pending] Incident IDs are tappable where intended
   - Notes:

43. [pending] `Latest Report` opens submitted reports modal
   - Notes:

44. [pending] Streetlight location modal opens from `My Reports`
   - Notes:

45. [pending] Streetlight location rows in `My Reports` are click-to-copy
   - Notes:

46. [pending] `Report to Utility` appears in streetlight location modal
   - Notes:

47. [pending] Utility reported checkbox and utility report number persist on streetlight cards
   - Notes:

48. [pending] Reports search field focuses/responds quickly
   - Notes:

49. [pending] Searching by public incident ID returns matching rows
   - Notes:

50. [pending] Sort options reorder results correctly
   - Notes:

51. [pending] Pothole-ID-specific sort options are gone
   - Notes:

## Reports Tab: All Reports

52. [pending] Switching from `My Reports` to `All Reports` works correctly
   - Notes:

53. [pending] Only org-managed domains appear in `All Reports`
   - Notes:

54. [pending] Multiple selected domains all populate in the list
   - Notes:

55. [pending] Deselecting domains removes them from the list
   - Notes:

56. [pending] Selecting all domains shows all eligible org-managed domains
   - Notes:

57. [pending] Metrics match active filters
   - Notes:

58. [pending] `Open` filter does not miscount fixed/closed incidents in visible totals
   - Notes:

59. [pending] Incident listing format matches updated design
   - Notes:

60. [pending] `Reports` interaction opens submitted reports
   - Notes:

61. [pending] Incident ID interaction opens location info modal without white screen
   - Notes:

62. [pending] `Update State` appears only for org-managed domains
   - Notes:

63. [pending] Non-org-managed domains do not show `Update State`
   - Notes:

## Submitted Reports / Detail Modals

64. [pending] Submitted reports modals open correctly from `My Reports` and `All Reports`
   - Notes:

65. [pending] Submitted report rows render correctly with report number, date/time, issue type, notes, and image link
   - Notes:

66. [pending] Reporter name links work where expected in `All Reports`
   - Notes:

67. [pending] Submitted reports do not show unintended extra location section
   - Notes:

68. [pending] Closing submitted reports modals returns cleanly to previous list
   - Notes:

## Admin State Update Flow

69. [pending] `Update State` opens correctly for org-managed incidents
   - Notes:

70. [pending] Current state appears in dropdown
   - Notes:

71. [pending] `Save` is disabled when selected state matches current state
   - Notes:

72. [pending] Allowed states match simplified lifecycle in use
   - Notes:

73. [pending] `Aggregated` is not offered as admin-selectable state
   - Notes:

74. [pending] PIN challenge is required before state save
   - Notes:

75. [pending] Saving to `Confirmed` succeeds
   - Notes:

76. [pending] Saving to `Resolved` succeeds
   - Notes:

77. [pending] Reopening incident reflects updated current state correctly
   - Notes:

## Alerts / Events / PCP

78. [pending] Alerts composer shows only alert topics
   - Notes:

79. [pending] Events composer shows only event topics
   - Notes:

80. [pending] Creating a test alert succeeds
   - Notes:

81. [pending] Creating a test event succeeds
   - Notes:

82. [pending] PCP topic management changes appear only in the correct public composer
   - Notes:

83. [pending] Removing a topic in PCP removes it from public composer
   - Notes:

## Account / Auth / Tenant Switching

84. [pending] Account tab and subpages load correctly
   - Notes:

85. [pending] Sign-in flow works when already authenticated
   - Notes:

86. [pending] Guest flow still works where public reporting allows it
   - Notes:

87. [pending] Switching tenants does not corrupt logged-in session state
   - Notes:

88. [pending] Tenant switching returns to correct tenant map
   - Notes:

## Routing / Regression Sweep

89. [pending] Repeated marker taps do not produce white screens
   - Notes:

90. [pending] Repeated modal open/close actions do not produce white screens
   - Notes:

91. [pending] Switching among Map / Reports / Notifications / Alerts / Events / Account stays stable
   - Notes:

92. [pending] Admin `Incidents in view` routes into Reports tab `All Reports` with expected filters
   - Notes:

93. [pending] No stray separate `Admin Reports` behavior remains
   - Notes:

94. [pending] No duplicate dropdowns, misplaced buttons, or bottom rail regressions remain
   - Notes:

95. [pending] Notices/toasts use PCP-configured content where expected
   - Notes:

96. [pending] No obvious console spam/regressions appear during normal use
   - Notes:

## Location Checks

97. [pending] Info-window location details load correctly for incident-driven domains
   - Notes:

98. [pending] Reports-tab incident ID location modals load correctly for incident-driven domains
   - Notes:

99. [pending] Saved location data reappears without needing repeated re-fetch on reopen
   - Notes:

100. [pending] Closest cross street / intersection labeling is consistent between info windows and location modals
   - Notes:

101. [pending] Closest landmark persists after successful lookup
   - Notes:

102. [pending] Road-required validation works again after quota reset
   - Notes:

103. [pending] `road_validation_unavailable` no longer appears once Google quota is healthy
   - Notes:

104. [pending] Out-of-boundary location checks and in-boundary location checks both still behave correctly after location services recover
   - Notes:
