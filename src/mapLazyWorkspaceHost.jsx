import React, { Suspense, lazy, memo } from "react";
import MapTabLoadingSurface from "./mapTabLoadingSurface.jsx";

const LazyMapSecondaryWorkspace = lazy(() => import("./mapLazySecondaryWorkspace.jsx"));
const LazyStreetlightPopupWorkspace = lazy(() => import("./mapLazyStreetlightPopupWorkspace.jsx"));
const LazyIncidentDomainPopupWorkspace = lazy(() => import("./mapLazyIncidentDomainPopupWorkspace.jsx"));
const LazyMapSelectionPopups = lazy(() => import("./mapLazyMapSelectionPopups.jsx"));

export default memo(function MapLazyWorkspaceHost({
  secondaryVisible,
  secondaryWorkspaceProps,
  streetlightPopupVisible,
  streetlightPopupProps,
  incidentDomainPopupVisible,
  incidentDomainPopupProps,
  selectionPopupsVisible,
  selectionPopupsProps,
}) {
  const secondaryFallback = secondaryVisible
    && secondaryWorkspaceProps?.residentFeedWorkspace?.useAppShellLayout ? (
    <MapTabLoadingSurface
      pageTopInset={secondaryWorkspaceProps?.moderationWorkspace?.mobileTabPageTopInset}
      pageBottomInset={secondaryWorkspaceProps?.moderationWorkspace?.mobileReportsPageBottomInset}
    />
  ) : null;

  return (
    <>
      {secondaryVisible ? (
        <Suspense fallback={secondaryFallback}>
          <LazyMapSecondaryWorkspace {...secondaryWorkspaceProps} />
        </Suspense>
      ) : null}

      {streetlightPopupVisible ? (
        <Suspense fallback={null}>
          <LazyStreetlightPopupWorkspace {...streetlightPopupProps} />
        </Suspense>
      ) : null}

      {incidentDomainPopupVisible ? (
        <Suspense fallback={null}>
          <LazyIncidentDomainPopupWorkspace {...incidentDomainPopupProps} />
        </Suspense>
      ) : null}

      {selectionPopupsVisible ? (
        <Suspense fallback={null}>
          <LazyMapSelectionPopups {...selectionPopupsProps} />
        </Suspense>
      ) : null}
    </>
  );
});
