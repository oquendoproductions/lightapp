import React, { Suspense, lazy, memo } from "react";

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
  return (
    <>
      {secondaryVisible ? (
        <Suspense fallback={null}>
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
