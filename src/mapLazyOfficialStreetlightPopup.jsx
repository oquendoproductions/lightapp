import React from "react";
import {
  ActionButtonIcon,
  AppIcon,
} from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as UI_ICON_SRC } from "./mapUiIconRuntimeSupport.js";

export default function OfficialStreetlightPopup({
  open = false,
  popupPlacement = null,
  markerPopupCardStyle = null,
  btnPopupPrimary = null,
  btnPopupSecondary = null,
  prefersDarkMode = false,
  displayId = "",
  onClose,
  onOpenLocationInfo,
  onReportOutage,
  showSaveLight = false,
  canSaveLight = false,
  onSaveLight,
  canTrackUtility = false,
  utilityReported = false,
  onToggleUtilityReported,
  onOpenUtilityReport,
  utilityReportReference = "",
  onViewMyReport,
  showWorkingButton = false,
  onMarkWorking,
  showDeleteButton = false,
  onDelete,
  showZoomHint = false,
}) {
  if (
    !open
    || !popupPlacement?.frameStyle
    || !popupPlacement?.arrowStyle
    || !markerPopupCardStyle
  ) {
    return null;
  }

  return (
    <div
      style={popupPlacement.frameStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div
        style={{
          ...markerPopupCardStyle,
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            marginLeft: "auto",
            right: 8,
            top: 8,
            width: 26,
            height: 26,
            borderRadius: 999,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            cursor: "pointer",
            fontWeight: 900,
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <div style={{ fontWeight: 900, paddingRight: 26 }}>
          Streetlight • {displayId}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.78, marginTop: -7, letterSpacing: 0.1 }}>
          Utility-owned
        </div>
        <button
          type="button"
          onClick={onOpenLocationInfo}
          style={btnPopupSecondary}
        >
          Location Info
        </button>
        <button
          type="button"
          onClick={onReportOutage}
          style={{ ...btnPopupPrimary, background: "var(--sl-ui-brand-blue)" }}
        >
          Report Outage to Utility
        </button>

        {showSaveLight ? (
          <button
            style={{
              ...btnPopupPrimary,
              background: "var(--sl-ui-brand-green)",
              opacity: canSaveLight ? 1 : 0.6,
              cursor: canSaveLight ? "pointer" : "not-allowed",
            }}
            disabled={!canSaveLight}
            onClick={onSaveLight}
            title={canSaveLight ? "Save light" : "Zoom in closer to save"}
          >
            Save light
          </button>
        ) : null}
        {canTrackUtility ? (
          <>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.95 }}>
              <input
                type="checkbox"
                checked={utilityReported}
                onChange={(e) => onToggleUtilityReported?.(e.target.checked)}
              />
              Utility reported
            </label>
            {utilityReported ? (
              <button
                type="button"
                onClick={onOpenUtilityReport}
                style={{ ...btnPopupSecondary, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                aria-label={utilityReportReference ? "Edit utility report number" : "Add utility report number"}
                title={utilityReportReference ? "Edit utility report number" : "Add utility report number"}
              >
                <AppIcon
                  src={UI_ICON_SRC.utilityReportReference}
                  iconKey="utilityReportReference"
                  darkMode={prefersDarkMode}
                  size={18}
                />
              </button>
            ) : null}
            <button
              type="button"
              onClick={onViewMyReport}
              style={btnPopupSecondary}
            >
              View My Report
            </button>
            {utilityReported ? (
              <div style={{ fontSize: 12, opacity: 0.84 }}>
                Utility report #: {utilityReportReference || "Not added yet"}
              </div>
            ) : null}
          </>
        ) : null}
        {showWorkingButton ? (
          <button
            type="button"
            onClick={onMarkWorking}
            style={{ ...btnPopupPrimary, background: "var(--sl-ui-brand-green)" }}
          >
            Is working
          </button>
        ) : null}
        <div style={{ fontSize: 12, fontWeight: 800, color: "#ffd27d", lineHeight: 1.35 }}>
          Immediate danger? Call 911.
        </div>

        {showZoomHint ? (
          <div style={{ fontSize: 11.5, opacity: 0.78, lineHeight: 1.25 }}>
            Zoom in closer to save this light.
          </div>
        ) : null}

        {showDeleteButton ? (
          <button
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 12,
              border: "none",
              background: "#d32f2f",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Delete light"
            title="Delete light"
            onClick={onDelete}
          >
            <ActionButtonIcon action="delete" darkMode={prefersDarkMode} emphasis="danger" />
          </button>
        ) : null}
      </div>

      <div style={popupPlacement.arrowStyle} />
    </div>
  );
}
