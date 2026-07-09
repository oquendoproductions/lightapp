import React from "react";

export default function IncidentStackPopup({
  open = false,
  popupPlacement = null,
  markerPopupCardStyle = null,
  selectedIncidentStackMarker = null,
  setSelectedIncidentStackMarker,
  resolveIncidentStackMarkerTitle,
  resolveIncidentIssueLabelForDomain,
  openIncidentDomainMarker,
}) {
  if (
    !open
    || !popupPlacement?.frameStyle
    || !popupPlacement?.arrowStyle
    || !markerPopupCardStyle
    || !selectedIncidentStackMarker
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
      <div style={{ ...markerPopupCardStyle, gap: 10 }}>
        <button
          type="button"
          onClick={() => setSelectedIncidentStackMarker(null)}
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
          Multiple incidents here
        </div>
        <div style={{ fontSize: 12, opacity: 0.88, lineHeight: 1.35 }}>
          {Number(selectedIncidentStackMarker?.incidentCount || selectedIncidentStackMarker?.markerCount || 0)} incident{Number(selectedIncidentStackMarker?.incidentCount || selectedIncidentStackMarker?.markerCount || 0) === 1 ? "" : "s"}
          {Number(selectedIncidentStackMarker?.reportCount || 0) > 0
            ? ` • ${Number(selectedIncidentStackMarker?.reportCount || 0)} open report${Number(selectedIncidentStackMarker?.reportCount || 0) === 1 ? "" : "s"}`
            : ""}
          .
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {(Array.isArray(selectedIncidentStackMarker?.markers) ? selectedIncidentStackMarker.markers : []).map((marker) => {
            const domainKey = String(marker?.domain || "").trim();
            const domainLabel = resolveIncidentStackMarkerTitle(marker);
            const issueLabel = resolveIncidentIssueLabelForDomain(marker?.rows?.[0], domainKey);
            return (
              <button
                key={`stack-item-${domainKey}-${String(marker?.id || "")}`}
                type="button"
                onClick={() => openIncidentDomainMarker(marker)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  borderRadius: 12,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  padding: "10px 12px",
                  display: "grid",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontWeight: 800 }}>{domainLabel}</span>
                <span style={{ fontSize: 12, opacity: 0.82 }}>
                  {Number(marker?.count || 0)} report{Number(marker?.count || 0) === 1 ? "" : "s"}
                  {issueLabel ? ` • ${issueLabel}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div style={popupPlacement.arrowStyle} />
    </div>
  );
}
