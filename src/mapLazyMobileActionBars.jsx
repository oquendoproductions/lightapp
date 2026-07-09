import React, { memo } from "react";

export const MobileBulkActionBar = memo(function MobileBulkActionBar({
  canUseStreetlightBulk,
  bulkMode,
  mobileBottomRailOffset,
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
  defaultStreetlightIssueValue,
  setStreetlightAreaPowerOn,
  setStreetlightHazardYesNo,
  setBulkConfirmOpen,
  bulkMaxLightsPerSubmit,
}) {
  if (!(canUseStreetlightBulk && bulkMode)) return null;
  return (
    <div
      className="sl-overlay-pass"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: mobileBottomRailOffset,
        zIndex: 1601,
        padding: "0 10px",
      }}
    >
      <div
        style={{
          width: "min(520px, calc(100vw - 20px))",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            alignSelf: "center",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 850,
            letterSpacing: 0.2,
            color: "#fff",
            background: "rgba(0,0,0,0.68)",
            boxShadow: "0 8px 18px rgba(0,0,0,0.2)",
          }}
        >
          Max {bulkMaxLightsPerSubmit}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
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
              fontWeight: 950,
              cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
              opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
            }}
          >
            Clear
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

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
              setReportType(
                typeof defaultStreetlightIssueValue === "string" && defaultStreetlightIssueValue.length
                  ? defaultStreetlightIssueValue
                  : "out"
              );
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
              fontWeight: 950,
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

export const MobileMappingActionBar = memo(function MobileMappingActionBar({
  mappingMode,
  mappingQueueLength,
  mobileBottomRailOffset,
  requestClearQueuedLights,
  confirmMappingQueue,
  mappingUnitLabel,
}) {
  if (!(mappingMode && mappingQueueLength > 0)) return null;
  return (
    <div
      className="sl-overlay-pass"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: mobileBottomRailOffset,
        zIndex: 1601,
        padding: "0 10px",
      }}
    >
      <div
        style={{
          width: "min(520px, calc(100vw - 20px))",
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
