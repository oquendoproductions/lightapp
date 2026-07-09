import React, { Suspense, lazy, memo } from "react";
import { INCIDENT_REPORTING_LAYER_KEY } from "./lib/mapDomainSelectionConfig.js";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
import { DomainAppIcon } from "./mapDomainIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";

const LazyDesktopIncidentFilterMenu = lazy(() => import("./mapLazyDesktopIncidentFilterMenu.jsx"));

export default memo(function MapLazyDesktopMapControls({
  mapType,
  setMapType,
  showToolHint,
  prefersDarkMode,
  setTravelFollowMode,
  followHeadingEnabledRef,
  mapRef,
  locating,
  geoDenied,
  setShowLocationPrompt,
  findMyLocation,
  travelFollowMode,
  toggleTravelFollowMode,
  setAutoFollow,
  setFollowCamera,
  recenterToTenantHome,
  incidentLayerButtonEnabled,
  incidentLayerDomainOptions,
  domainMenuAnchorRef,
  adminDomainMenuOpen,
  activeMapLayerKey,
  resolvedIncidentLayerOption,
  requestMapLayerSwitch,
  setAdminDomainMenuOpen,
  setAdminToolboxOpen,
  hasExplicitIncidentMapFilter,
  activeIncidentMapFilterKeys,
  domainMenuPanelRef,
  allIncidentReportsOptionEnabled,
  resetIncidentMapFilter,
  toggleIncidentMapDomainFilter,
  webStreetlightsPrimaryOption,
  canUseStreetlightBulk,
  bulkMode,
  setBulkConfirmOpen,
  setBulkMode,
  setDeleteCircleMode,
  setDeleteCircleDraft,
  setDeleteCircleConfirmOpen,
  setSelectedOfficialId,
  setMappingMode,
  setMappingQueue,
  closeAnyPopup,
  suppressPopupsSafe,
  clearBulkSelection,
  canOpenDomainReports,
  openReportsOpen,
  mappingMode,
  requestExitMappingMode,
  setNotificationsWindowOpen,
  setAlertsWindowOpen,
  setEventsWindowOpen,
  openOpenReports,
}) {
  return (
    <>
      <button
        type="button"
        className="sl-map-tool-mini"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setMapType((current) => {
            const next = current === "roadmap" ? "satellite" : "roadmap";
            showToolHint(next === "satellite" ? "Satellite view" : "Map view", 1100, 0);
            return next;
          });
        }}
        title={mapType === "satellite" ? "Satellite" : "Street map"}
        aria-label="Toggle satellite map"
      >
        <AppIcon
          src={mapType === "satellite" ? uiIconSrc.streetMap : uiIconSrc.satellite}
          iconKey={mapType === "satellite" ? "streetMap" : "satellite"}
          darkMode={prefersDarkMode}
          size={38}
        />
      </button>

      <button
        type="button"
        className="sl-map-tool-mini"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setTravelFollowMode(false);
          followHeadingEnabledRef.current = false;
          try {
            if (mapRef.current?.moveCamera) {
              mapRef.current.moveCamera({
                heading: 0,
                tilt: 0,
              });
            } else if (mapRef.current?.setHeading) {
              mapRef.current.setHeading(0);
              mapRef.current?.setTilt?.(0);
            }
          } catch {
            // ignore
          }
          showToolHint("Realigned to north", 1100, 1);
        }}
        title="Reset heading"
        aria-label="Reset heading"
      >
        <AppIcon src={uiIconSrc.headingReset} iconKey="headingReset" darkMode={prefersDarkMode} size={38} />
      </button>

      <button
        type="button"
        className={`sl-map-tool-mini ${locating ? "is-on" : ""}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (geoDenied) {
            setShowLocationPrompt(true);
            return;
          }
          showToolHint("Location", 1100, 2);
          followHeadingEnabledRef.current = true;
          findMyLocation(false);
        }}
        title="Find my location"
        aria-label="Find my location"
      >
        <AppIcon src={uiIconSrc.location} iconKey="location" darkMode={prefersDarkMode} active={locating} size={38} />
      </button>

      <button
        type="button"
        className={`sl-map-tool-mini ${travelFollowMode ? "is-on" : ""}`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          showToolHint(travelFollowMode ? "Travel follow off" : "Travel follow", 1100, 3);
          toggleTravelFollowMode();
        }}
        title="Travel follow"
        aria-label="Toggle travel follow"
      >
        <AppIcon src={uiIconSrc.navigationArrow} iconKey="navigationArrow" darkMode={prefersDarkMode} active={travelFollowMode} size={34} />
      </button>

      <button
        type="button"
        className="sl-map-tool-mini"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setAutoFollow(false);
          setFollowCamera(false);
          setTravelFollowMode(false);
          recenterToTenantHome("home-button");
          showToolHint("City home", 1100, 4);
        }}
        title="City home"
        aria-label="Recenter to city"
      >
        <AppIcon src={uiIconSrc.homeRecenter} iconKey="homeRecenter" darkMode={prefersDarkMode} size={36} />
      </button>

      {incidentLayerButtonEnabled && incidentLayerDomainOptions.length ? (
        <div ref={domainMenuAnchorRef} style={{ position: "relative" }}>
          <button
            type="button"
            className={`sl-map-tool-mini sl-mobile-hide-bottom-rail ${(adminDomainMenuOpen || activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY) ? "is-on" : ""}`}
            title={resolvedIncidentLayerOption?.label ? `Incident filter: ${resolvedIncidentLayerOption.label}` : "Incident filters"}
            aria-label="Incident filters"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY) {
                requestMapLayerSwitch(INCIDENT_REPORTING_LAYER_KEY, "Incident Reporting");
              }
              setAdminDomainMenuOpen((prev) => {
                const next = !prev;
                if (next) setAdminToolboxOpen(false);
                return next;
              });
              showToolHint(
                hasExplicitIncidentMapFilter
                  ? `Filter: ${activeIncidentMapFilterKeys.length === 1 ? (resolvedIncidentLayerOption?.label || activeIncidentMapFilterKeys[0]) : `${activeIncidentMapFilterKeys.length} domains`}`
                  : "Filter: Incident reports",
                1000,
                3
              );
            }}
          >
            <AppIcon
              src={uiIconSrc.incidentReportingLayer}
              iconKey="incidentReportingLayer"
              darkMode={prefersDarkMode}
              active={adminDomainMenuOpen || activeMapLayerKey === INCIDENT_REPORTING_LAYER_KEY}
              size={38}
            />
          </button>
          {adminDomainMenuOpen ? (
            <Suspense fallback={null}>
              <LazyDesktopIncidentFilterMenu
                domainMenuPanelRef={domainMenuPanelRef}
                prefersDarkMode={prefersDarkMode}
                allIncidentReportsOptionEnabled={allIncidentReportsOptionEnabled}
                hasExplicitIncidentMapFilter={hasExplicitIncidentMapFilter}
                resetIncidentMapFilter={resetIncidentMapFilter}
                incidentLayerDomainOptions={incidentLayerDomainOptions}
                activeIncidentMapFilterKeys={activeIncidentMapFilterKeys}
                toggleIncidentMapDomainFilter={toggleIncidentMapDomainFilter}
              />
            </Suspense>
          ) : null}
        </div>
      ) : null}

      {webStreetlightsPrimaryOption ? (
        <div className="sl-map-tool-drawer-stack sl-mobile-hide-bottom-rail">
          <button
            type="button"
            className={`sl-map-tool-mini ${activeMapLayerKey === "streetlights" ? "is-on" : ""}`}
            title={webStreetlightsPrimaryOption.label || "Streetlights"}
            aria-label={webStreetlightsPrimaryOption.label || "Streetlights"}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              requestMapLayerSwitch("streetlights", webStreetlightsPrimaryOption.label || "Streetlights");
            }}
          >
            <DomainAppIcon
              domainKey={webStreetlightsPrimaryOption.key}
              src={webStreetlightsPrimaryOption.iconSrc || uiIconSrc.streetlight}
              size={34}
            />
          </button>
          {canUseStreetlightBulk ? (
            <div className="sl-map-tool-drawer">
              <button
                type="button"
                className={`sl-map-tool-mini sl-bulk-tool-btn ${bulkMode ? "is-on" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  setBulkConfirmOpen(false);

                  setBulkMode((on) => {
                    const next = !on;
                    showToolHint(next ? "Save multiple light reports" : "Save one light report", 1100, 4);

                    if (next) {
                      setDeleteCircleMode(false);
                      setDeleteCircleDraft(null);
                      setDeleteCircleConfirmOpen(false);
                      setSelectedOfficialId(null);
                      setMappingMode(false);
                      setMappingQueue([]);

                      closeAnyPopup();
                      suppressPopupsSafe(1600);
                    } else {
                      clearBulkSelection();
                    }

                    return next;
                  });
                }}
                title={bulkMode ? "Bulk selection ON" : "Bulk selection OFF"}
                aria-label="Toggle bulk selection"
              >
                <AppIcon src={uiIconSrc.bulk} iconKey="bulk" darkMode={prefersDarkMode} active={bulkMode} size={30} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canOpenDomainReports ? (
        <button
          type="button"
          className={`sl-map-tool-mini sl-mobile-hide-bottom-rail ${openReportsOpen ? "is-on" : ""}`}
          title="Reports"
          aria-label="Open reports"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (mappingMode) requestExitMappingMode();
            if (bulkMode) setBulkMode(false);
            setAdminDomainMenuOpen(false);
            setAdminToolboxOpen(false);
            setNotificationsWindowOpen(false);
            setAlertsWindowOpen(false);
            setEventsWindowOpen(false);
            openOpenReports({ inViewOnly: false });
            showToolHint("Reports", 1000, 5);
          }}
        >
          <AppIcon src={uiIconSrc.openReports} iconKey="openReports" darkMode={prefersDarkMode} active={openReportsOpen} size={38} />
        </button>
      ) : null}
    </>
  );
});
