import React from "react";

import {
  ReportTypeOptionDetails,
  displayLightId,
  noteDisplayText,
} from "./lib/mapPopupDetailSupport.jsx";
import { REPORT_TYPES } from "./lib/mapDomainTypeOptionSupport.js";
import { hasIssueTypeOptionDetail } from "./lib/mapDomainDetailSupport.js";
import { getCoordsForLightId } from "./lib/mapLightCoordinateSupport.js";
import {
  defaultMarkerColorForDomainShared,
  resolveHighConfidenceMarkerColorForDomainShared,
} from "./lib/mapDomainMarkerColorSupport.js";
import { RUNTIME_DOMAIN_META } from "./lib/mapRuntimeDomainMeta.js";
import {
  readImageUrlFromNote,
  readLocationFromNote,
} from "./lib/mapReportParsingSupport.js";

export default function OpenReportsResidentListPanel(props) {
  const {
    activeDomain = "streetlights",
    adminIncidentLabelForDomain,
    canViewReporterDetails = false,
    displayLightId: displayLightIdOverride = displayLightId,
    domainOptions = [],
    expandedSet = new Set(),
    formatTs,
    getIncidentDomainHelper,
    getIncidentStateForDisplay,
    getStreetlightConfidence,
    handleOpenReporterDetails,
    incidentStateLabel,
    isOpenLifecycleState,
    matchedSearchRows = [],
    officialLights = [],
    onFlyTo,
    onToggleExpand,
    openExternalUrl,
    personalReportsSupportPending = false,
    reportNumberForRow,
    reporterSummaryForReportDetail,
    reports = [],
    resolveItemDomainKey,
    resolveIssueLabel,
    resolveReportTypeOptionDetails,
    searchQuery = "",
    setRowRefForLightId,
    slIdByUuid = null,
    streetlightUtilityReportUrl = "",
    visibleGroups = [],
  } = props;

  const normalizedSearchQuery = String(searchQuery || "").trim();

  if (normalizedSearchQuery) {
    if (!matchedSearchRows.length) {
      return <div style={{ fontSize: 13, opacity: 0.8 }}>No matching reports found.</div>;
    }

    return matchedSearchRows.map((item) => {
      const imageUrl = readImageUrlFromNote(item.row?.note || "");
      const displayNote = noteDisplayText(item.row?.note || "");
      return (
        <div
          key={item.id}
          style={{
            border: "1px solid var(--sl-ui-open-reports-item-border)",
            borderRadius: 10,
            padding: 10,
            display: "grid",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => onFlyTo?.([item.coords?.lat, item.coords?.lng], 18, item.lightId)}
              style={{
                flex: 1,
                textAlign: "left",
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                fontWeight: 950,
                fontSize: 12.5,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                color: "var(--sl-ui-text)",
              }}
              title="Fly to report location"
            >
              {item.incidentLabel || displayLightIdOverride(item.lightId, slIdByUuid)}
            </button>
            <button
              onClick={() => onFlyTo?.([item.coords?.lat, item.coords?.lng], 18, item.lightId)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Fly to
            </button>
            {item.isStreetlights && (
              <button
                type="button"
                onClick={() => {
                  void openExternalUrl(streetlightUtilityReportUrl);
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 10,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Report Outage to Utility
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 900 }}>
            Report #: {reportNumberForRow(item.row, item.domainKey || activeDomain)}
          </div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {formatTs(item.row?.ts)}
          </div>
          {!!String(item.issueLabel || "").trim() && !item.isStreetlights && !hasIssueTypeOptionDetail(resolveReportTypeOptionDetails(item.row, item.domainKey || activeDomain)) && (
            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
              <b>Issue type:</b> {item.issueLabel}
            </div>
          )}
          <ReportTypeOptionDetails
            details={resolveReportTypeOptionDetails(item.row, item.domainKey || activeDomain)}
            textStyle={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}
          />
          {!item.isStreetlights && (
            <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>
              <b>Location:</b> {item.locationLabel}
            </div>
          )}
          {!!String(displayNote || "").trim() && (
            <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>
              <b>Note:</b> {displayNote}
            </div>
          )}
          {!!imageUrl && (
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 8px",
                borderRadius: 8,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                textDecoration: "none",
                width: "fit-content",
              }}
              title="View attached image"
            >
              📷 View image
            </a>
          )}
          {canViewReporterDetails && (
            <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3, display: "grid", gap: 2 }}>
              <b>Submitted by:</b>{" "}
              <button
                type="button"
                onClick={() => handleOpenReporterDetails(item.row)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  margin: 0,
                  color: "var(--sl-ui-brand-green)",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {String(item?.row?.reporter_name || "").trim() || String(item?.row?.reporter_email || "").trim() || "Unknown"}
              </button>
              {reporterSummaryForReportDetail(item.row).secondary ? (
                <div style={{ opacity: 0.78 }}>
                  {reporterSummaryForReportDetail(item.row).secondary}
                </div>
              ) : null}
            </div>
          )}
        </div>
      );
    });
  }

  if (!visibleGroups?.length) {
    return (
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        {personalReportsSupportPending ? "Loading reports..." : "No reports in selected filters."}
      </div>
    );
  }

  return visibleGroups.map((g) => {
    const groupDomainKey = resolveItemDomainKey(g, g?.rows?.[0] || null, activeDomain);
    const groupIncidentId = String(
      g.incidentId || (groupDomainKey === "streetlights" ? g.lightId : "")
    ).trim();
    const isStreetlights = groupDomainKey === "streetlights";
    const coords = isStreetlights
      ? getCoordsForLightId(groupIncidentId || g.lightId, reports, officialLights)
      : {
          lat: Number(g.lat ?? g.rows?.[0]?.lat),
          lng: Number(g.lng ?? g.rows?.[0]?.lng),
          isOfficial: false,
        };
    const confidence = isStreetlights ? getStreetlightConfidence(groupIncidentId || g.lightId) : null;
    const info = isStreetlights
      ? {
          majorityLabel: incidentStateLabel(confidence?.state || "operational") || "Operational",
          isFixed: Boolean(confidence?.closed),
        }
      : { majorityLabel: (domainOptions || []).find((d) => d.key === groupDomainKey)?.label || "Report" };
    const nonStreetlightDotColor = defaultMarkerColorForDomainShared(groupDomainKey, {
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
      getIncidentDomainHelper,
    });
    const dot = isStreetlights
      ? (() => {
          if (confidence?.state === "high_confidence_outage") {
            return {
              color: resolveHighConfidenceMarkerColorForDomainShared("streetlights", {
                runtimeDomainMeta: RUNTIME_DOMAIN_META,
                getIncidentDomainHelper,
              }),
              label: "High-confidence outage",
            };
          }
          if (confidence?.closed) return { color: "var(--sl-ui-brand-green)", label: "Closed report" };
          return {
            color: defaultMarkerColorForDomainShared("streetlights", {
              runtimeDomainMeta: RUNTIME_DOMAIN_META,
              getIncidentDomainHelper,
            }),
            label: "Operational",
          };
        })()
      : { color: nonStreetlightDotColor, label: info.majorityLabel };
    const isOpen = expandedSet?.has(g.lightId);
    const groupDisplayId = String(g?.displayId || "").trim();
    const groupTitle = groupDisplayId
      ? adminIncidentLabelForDomain(groupDomainKey, groupIncidentId || g.lightId, "", slIdByUuid, groupDisplayId)
      : displayLightIdOverride(g.lightId, slIdByUuid);
    const locationLabel =
      String(g.location_label || "").trim() ||
      readLocationFromNote(g.rows?.[0]?.note) ||
      (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)
        ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
        : "Location unavailable");
    const lifecycleInfo = groupIncidentId
      ? getIncidentStateForDisplay(groupIncidentId, g.rows || [], groupDomainKey)
      : null;
    const lifecycleState = String(
      lifecycleInfo?.state || ""
    ).trim().toLowerCase();
    const isFixedLifecycle = Boolean(lifecycleState && !isOpenLifecycleState(lifecycleState));
    const effectiveNonStreetlightDotColor = isFixedLifecycle
      ? "var(--sl-ui-brand-green)"
      : nonStreetlightDotColor;
    const effectiveNonStreetlightDotLabel = isFixedLifecycle
      ? "Fixed incident"
      : info.majorityLabel;
    const effectiveDot = isStreetlights
      ? ((Boolean(info?.isFixed) || isFixedLifecycle)
          ? { color: "var(--sl-ui-brand-green)", label: "Fixed incident" }
          : dot)
      : { color: effectiveNonStreetlightDotColor, label: effectiveNonStreetlightDotLabel };

    return (
      <div
        key={g.lightId}
        ref={(el) => {
          setRowRefForLightId?.(g.lightId, el);
        }}
        style={{
          border: "1px solid var(--sl-ui-open-reports-item-border)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: effectiveDot.color,
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
              flex: "0 0 auto",
            }}
            title={effectiveDot.label}
          />

          <button
            onClick={() => onToggleExpand(g.lightId)}
            style={{
              flex: 1,
              textAlign: "left",
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              fontWeight: 950,
              fontSize: 12.5,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              color: "var(--sl-ui-text)",
            }}
            title="Toggle details"
          >
            {groupTitle}
          </button>

          <button
            onClick={() => {
              onToggleExpand(g.lightId);
            }}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
            title="View reports"
          >
            View
          </button>

          <button
            onClick={() => {
              if (!coords) return;
              onFlyTo?.([coords.lat, coords.lng], 18, g.lightId);
            }}
            disabled={!coords}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: coords ? "pointer" : "not-allowed",
              opacity: coords ? 1 : 0.6,
              whiteSpace: "nowrap",
            }}
          >
            Fly to
          </button>
        </div>

        <div style={{ fontSize: 12, opacity: 0.9 }}>
          <b>{g.count}</b> report{g.count === 1 ? "" : "s"}
          {isStreetlights ? <> • Status: <b>{info.majorityLabel}</b></> : <> • <b>{info.majorityLabel}</b></>}
        </div>
        {!!lifecycleInfo?.state && (
          <div style={{ fontSize: 12, opacity: 0.82 }}>
            Lifecycle: <b>{incidentStateLabel(lifecycleInfo.state)}</b>
            {!!lifecycleInfo?.lastChangedAtIso && (
              <> • Updated {formatTs(lifecycleInfo.lastChangedAtIso)}</>
            )}
          </div>
        )}

        {!isStreetlights && (
          <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>
            <b>Location:</b> {locationLabel}
          </div>
        )}

        {isOpen && (
          <div
            style={{
              borderTop: "1px dashed var(--sl-ui-open-reports-item-border)",
              paddingTop: 8,
              display: "grid",
              gap: 6,
            }}
          >
            {(g.rows || []).slice(0, 5).map((r) => {
              const issueLabel = resolveIssueLabel(r, groupDomainKey);
              const displayNote = noteDisplayText(r?.note || "");
              return (
                <div
                  key={r.id}
                  style={{
                    fontSize: 12,
                    padding: 8,
                    borderRadius: 10,
                    border: "1px solid var(--sl-ui-open-reports-item-border)",
                    background: "var(--sl-ui-modal-subtle-bg)",
                    lineHeight: 1.3,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>
                    {issueLabel || REPORT_TYPES?.[r.type] || r.type || "Report"}
                  </div>
                  <div style={{ opacity: 0.8 }}>
                    {formatTs(r.ts)}
                  </div>
                  {!!String(issueLabel || "").trim() && !isStreetlights && !hasIssueTypeOptionDetail(resolveReportTypeOptionDetails(r, groupDomainKey)) && (
                    <div style={{ opacity: 0.9 }}>
                      <b>Issue type:</b> {issueLabel}
                    </div>
                  )}
                  <ReportTypeOptionDetails
                    details={resolveReportTypeOptionDetails(r, groupDomainKey)}
                    textStyle={{ opacity: 0.9 }}
                  />
                  <div style={{ opacity: 0.9, fontWeight: 900 }}>
                    Report #: {reportNumberForRow(r, groupDomainKey)}
                  </div>
                  {!!String(displayNote || "").trim() && (
                    <div style={{ opacity: 0.85 }}>
                      <b>Note:</b> {displayNote}
                    </div>
                  )}
                  {canViewReporterDetails && (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
                      <b>Submitted by:</b>{" "}
                      <button
                        type="button"
                        onClick={() => handleOpenReporterDetails(r)}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          margin: 0,
                          color: "var(--sl-ui-brand-green)",
                          textDecoration: "underline",
                          cursor: "pointer",
                          fontWeight: 900,
                          fontSize: "inherit",
                          lineHeight: "inherit",
                        }}
                      >
                        {String(r?.reporter_name || "").trim() || String(r?.reporter_email || "").trim() || "Unknown"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {(g.rows || []).length > 5 && (
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Showing latest 5 of {g.rows.length}.
              </div>
            )}
          </div>
        )}
      </div>
    );
  });
}
