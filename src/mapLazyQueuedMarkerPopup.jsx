import React, { useMemo } from "react";
import {
  STREET_SIGN_TYPE_OPTIONS,
} from "./lib/mapDomainSelectionConfig.js";
import { getIncidentDomainHelperShared } from "./lib/mapIncidentDomainConfig.js";
import { normalizeDomainKeyOrSlug } from "./lib/mapReportParsingSupport.js";
import { ActionButtonIcon } from "./mapUiIconComponentsSupport.jsx";

export default function QueuedMarkerPopup({
  open = false,
  popupPlacement = null,
  markerPopupCardStyle = null,
  selectedQueuedLight = null,
  btnPopupSecondary = null,
  prefersDarkMode = false,
  setSelectedQueuedTempId,
  updateQueuedSignType,
  removeFromMappingQueue,
  openNotice,
}) {
  const selectedQueuedDomainMeta = useMemo(() => {
    const domainKey = normalizeDomainKeyOrSlug(selectedQueuedLight?.domain, { allowUnknown: true }) || "streetlights";
    const helper = getIncidentDomainHelperShared(domainKey) || {};
    const queueVariant = String(helper?.adminMappingQueueVariant || "").trim();
    const queuedLabels = helper?.queuedAssetLabels && typeof helper.queuedAssetLabels === "object"
      ? helper.queuedAssetLabels
      : null;
    return {
      queueVariant,
      isStreetSign: queueVariant === "official_sign",
      queuedLabel: queueVariant ? queuedLabels?.queuedLabel || "Queued light" : "Queued light",
      deleteLabel: queueVariant ? queuedLabels?.deleteLabel || "Delete light" : "Delete light",
    };
  }, [selectedQueuedLight?.domain]);

  if (
    !open
    || !popupPlacement?.frameStyle
    || !popupPlacement?.arrowStyle
    || !markerPopupCardStyle
    || !selectedQueuedLight
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
          onClick={() => setSelectedQueuedTempId(null)}
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
          {selectedQueuedDomainMeta.queuedLabel}
        </div>
        <div style={{ fontSize: 12.5, opacity: 0.8 }}>Not saved yet</div>
        {selectedQueuedDomainMeta.isStreetSign ? (
          <label style={{ display: "grid", gap: 6, fontSize: 12.5, opacity: 0.95 }}>
            <span style={{ fontWeight: 800 }}>Sign type</span>
            <select
              value={String(selectedQueuedLight.sign_type || "other")}
              onChange={(e) => updateQueuedSignType(selectedQueuedLight.tempId, e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 700,
              }}
            >
              {STREET_SIGN_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
          aria-label={selectedQueuedDomainMeta.deleteLabel}
          title={selectedQueuedDomainMeta.deleteLabel}
          onClick={() => {
            removeFromMappingQueue(selectedQueuedLight.tempId);
            setSelectedQueuedTempId(null);
            openNotice("✅", "", "", { autoCloseMs: 500, compact: true });
          }}
        >
          <ActionButtonIcon action="delete" darkMode={prefersDarkMode} emphasis="danger" />
        </button>

        <button style={btnPopupSecondary} onClick={() => setSelectedQueuedTempId(null)}>
          Close
        </button>
      </div>

      <div style={popupPlacement.arrowStyle} />
    </div>
  );
}
