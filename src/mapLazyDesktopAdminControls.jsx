import React, { Suspense, lazy, memo } from "react";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";

const loadOpenReportsDialogsModule = () => import("./mapLazyOpenReportsDialogs.jsx");
const LazyMapAdminDeferredDialogs = lazy(() =>
  loadOpenReportsDialogsModule().then((module) => ({ default: module.MapAdminDeferredDialogs }))
);

const DesktopAdminToolbox = memo(function DesktopAdminToolbox({
  showAdminControls,
  adminToolboxOpen,
  setAdminToolboxOpen,
  setAdminDomainMenuOpen,
  showToolHint,
  prefersDarkMode,
  isAdmin,
  isStreetlightsLayerActive,
  deleteCircleMode,
  setDeleteCircleMode,
  setDeleteCircleDraft,
  setDeleteCircleConfirmOpen,
  setDeleteCircleNote,
  setMappingMode,
  setMappingQueue,
  setBulkMode,
  setBulkConfirmOpen,
  clearBulkSelection,
  closeAnyPopup,
  suppressPopupsSafe,
  openNotice,
  showAdminTools,
  locationDiagnosticsOpen,
  setLocationDiagnosticsOpen,
  isAssetReportingDomain,
  mappingQueueLength,
  setExitMappingConfirmOpen,
}) {
  if (!showAdminControls) return null;

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className={`sl-map-tool-mini sl-has-submenu sl-mobile-hide-bottom-rail ${adminToolboxOpen ? "is-on" : ""}`}
        title="Admin tools"
        aria-label="Admin tools"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setAdminToolboxOpen((prev) => {
            const next = !prev;
            if (next) setAdminDomainMenuOpen(false);
            return next;
          });
          showToolHint("Admin tools", 1000, 5);
        }}
      >
        <AppIcon src={uiIconSrc.toolbox} iconKey="toolbox" darkMode={prefersDarkMode} active={adminToolboxOpen} size={38} />
      </button>

      {adminToolboxOpen ? (
        <div
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          style={{
            position: "absolute",
            right: "calc(100% + 10px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--sl-ui-modal-bg)",
            border: "1px solid var(--sl-ui-modal-border)",
            borderRadius: 12,
            boxShadow: "var(--sl-ui-modal-shadow)",
            padding: 8,
            display: "grid",
            gap: 6,
            zIndex: 3,
            minWidth: 180,
          }}
        >
          {isAdmin && isStreetlightsLayerActive ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setDeleteCircleMode((on) => {
                  const next = !on;
                  if (next) {
                    setDeleteCircleDraft(null);
                    setDeleteCircleConfirmOpen(false);
                    setDeleteCircleNote("");
                    setMappingMode(false);
                    setMappingQueue([]);
                    setBulkMode(false);
                    setBulkConfirmOpen(false);
                    clearBulkSelection();
                    closeAnyPopup();
                    suppressPopupsSafe(1200);
                    openNotice("🟢", "Circle mark fixed on", "Tap map once for center, then again for radius.");
                  } else {
                    setDeleteCircleDraft(null);
                    setDeleteCircleConfirmOpen(false);
                    setDeleteCircleNote("");
                    openNotice("✅", "Circle mark fixed off", "", { autoCloseMs: 800, compact: true });
                  }
                  return next;
                });
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 9px",
                borderRadius: 9,
                border: deleteCircleMode
                  ? "1px solid #ff1744"
                  : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: deleteCircleMode
                  ? "rgba(255, 23, 68, 0.12)"
                  : "var(--sl-ui-modal-btn-secondary-bg)",
                color: deleteCircleMode
                  ? "#ff1744"
                  : "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                justifyContent: "flex-start",
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>◯</span>
              <span style={{ fontSize: 12.5 }}>
                {deleteCircleMode ? "Circle Mark Fixed On" : "Circle Mark Fixed"}
              </span>
            </button>
          ) : null}

          {showAdminTools ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setAdminToolboxOpen(false);
                setLocationDiagnosticsOpen(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 9px",
                borderRadius: 9,
                border: locationDiagnosticsOpen
                  ? "1px solid var(--sl-ui-tool-active-border)"
                  : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: locationDiagnosticsOpen
                  ? "var(--sl-ui-tool-active-bg)"
                  : "var(--sl-ui-modal-btn-secondary-bg)",
                color: locationDiagnosticsOpen
                  ? "var(--sl-ui-tool-active-text)"
                  : "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                justifyContent: "flex-start",
              }}
            >
              <AppIcon src={uiIconSrc.location} iconKey="location" darkMode={prefersDarkMode} size={30} />
              <span style={{ fontSize: 12.5 }}>Location Diagnostics</span>
            </button>
          ) : null}

          {showAdminTools && isAssetReportingDomain ? (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setMappingMode((on) => {
                  const next = !on;
                  showToolHint(next ? "Mapping mode on" : "Mapping mode off", 1100, 2);

                  if (next) {
                    setBulkMode(false);
                    setBulkConfirmOpen(false);
                    clearBulkSelection();
                    setDeleteCircleMode(false);
                    setDeleteCircleDraft(null);
                    setDeleteCircleConfirmOpen(false);
                    setDeleteCircleNote("");
                    suppressPopupsSafe(1600);
                    closeAnyPopup();
                  } else if (mappingQueueLength > 0) {
                    setExitMappingConfirmOpen(true);
                    return true;
                  } else {
                    setMappingQueue([]);
                  }
                  return next;
                });
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 9px",
                borderRadius: 9,
                border: mappingMode
                  ? "1px solid var(--sl-ui-tool-active-border)"
                  : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: mappingMode
                  ? "var(--sl-ui-tool-active-bg)"
                  : "var(--sl-ui-modal-btn-secondary-bg)",
                color: mappingMode
                  ? "var(--sl-ui-tool-active-text)"
                  : "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                justifyContent: "flex-start",
              }}
            >
              <AppIcon src={uiIconSrc.mapping} iconKey="mapping" darkMode={prefersDarkMode} active={mappingMode} size={30} />
              <span style={{ fontSize: 12.5 }}>{mappingMode ? "Mapping On" : "Mapping"}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

const DesktopBulkActionBar = memo(function DesktopBulkActionBar({
  visible,
  bulkMaxLightsPerSubmit,
  bulkSelectedCount,
  saving,
  clearBulkSelection,
  openNotice,
  mapZoomRef,
  mapZoom,
  reportingMinZoom,
  openConfiguredNotice,
  closeAnyPopup,
  suppressPopupsSafe,
  setNote,
  setReportType,
  setStreetlightAreaPowerOn,
  setStreetlightHazardYesNo,
  setBulkConfirmOpen,
}) {
  if (!visible) return null;

  return (
    <div
      className="sl-overlay-pass"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "14px",
        zIndex: 1601,
        padding: "0 16px",
      }}
    >
      <div
        style={{
          width: "min(720px, calc(100vw - 32px))",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            alignSelf: "center",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.2,
            color: "#fff",
            background: "rgba(0,0,0,0.68)",
            boxShadow: "0 8px 18px rgba(0,0,0,0.2)",
          }}
        >
          Max {bulkMaxLightsPerSubmit} lights per bulk report
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              clearBulkSelection();
            }}
            disabled={bulkSelectedCount === 0 || saving}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "rgba(255,255,255,0.96)",
              boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
              fontWeight: 900,
              cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
              opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
            }}
          >
            Clear Selection
          </button>

          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              if (bulkSelectedCount === 0) {
                openNotice("⚠️", "No lights selected", "Tap multiple official 💡 lights first.");
                return;
              }

              if (Number(mapZoomRef.current || mapZoom) < reportingMinZoom) {
                openConfiguredNotice("zoom_to_report", {
                  icon: "🔎",
                  title: "Zoom in to report",
                  message: "To improve accuracy of marker placement, zoom in further to report.",
                });
                return;
              }

              closeAnyPopup();
              suppressPopupsSafe(1600);

              setNote("");
              setReportType("");
              setStreetlightAreaPowerOn("");
              setStreetlightHazardYesNo("");
              setBulkConfirmOpen(true);
            }}
            disabled={bulkSelectedCount === 0 || saving}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 12,
              border: "none",
              background: "var(--sl-ui-brand-green)",
              color: "white",
              boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
              fontWeight: 900,
              cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
              opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
            }}
          >
            Save light{bulkSelectedCount === 1 ? "" : "s"} {bulkSelectedCount ? `(${bulkSelectedCount})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
});

const DesktopMappingActionBar = memo(function DesktopMappingActionBar({
  visible,
  requestClearQueuedLights,
  confirmMappingQueue,
  mappingQueueLength,
  mappingUnitLabel,
}) {
  if (!visible) return null;

  return (
    <div
      className="sl-overlay-pass"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "14px",
        zIndex: 1601,
        padding: "0 16px",
      }}
    >
      <div
        style={{
          width: "min(720px, calc(100vw - 32px))",
          margin: "0 auto",
          display: "flex",
          gap: 10,
        }}
      >
        <button
          onClick={requestClearQueuedLights}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 12,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
          }}
        >
          Clear
        </button>

        <button
          onClick={confirmMappingQueue}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 12,
            border: "none",
            background: "var(--sl-ui-brand-green)",
            color: "white",
            fontWeight: 900,
          }}
        >
          Place {mappingQueueLength} {mappingUnitLabel}{mappingQueueLength !== 1 && "s"}
        </button>
      </div>
    </div>
  );
});

export default memo(function MapLazyDesktopAdminControls({
  deferredDialogsVisible,
  deferredDialogsProps,
  adminControlsProps,
  bulkActionBarProps,
  mappingActionBarProps,
}) {
  return (
    <>
      {deferredDialogsVisible ? (
        <Suspense fallback={null}>
          <LazyMapAdminDeferredDialogs {...deferredDialogsProps} />
        </Suspense>
      ) : null}
      <DesktopAdminToolbox {...adminControlsProps} />
      <DesktopBulkActionBar {...bulkActionBarProps} />
      <DesktopMappingActionBar {...mappingActionBarProps} />
    </>
  );
});
