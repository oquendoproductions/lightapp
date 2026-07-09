import React from "react";
import { hasIssueTypeOptionDetail } from "./lib/mapDomainDetailSupport.js";
import {
  ActionButtonIcon,
  AppIcon,
} from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";
import {
  parseStreetlightQaFromNote,
  ReportTypeOptionDetails,
  displayLightId,
  noteDisplayText,
} from "./lib/mapPopupDetailSupport.jsx";
import { readImageUrlFromNote } from "./lib/mapReportParsingSupport.js";
import { formatTs } from "./lib/mapTimestampFormatSupport.js";

const btnPrimaryDark = {
  padding: 10,
  borderRadius: 10,
  border: "none",
  background: "var(--sl-ui-modal-btn-dark-bg)",
  color: "var(--sl-ui-modal-btn-dark-text)",
  fontWeight: 900,
  cursor: "pointer",
  width: "100%",
};

function ModalShell({ open, children, zIndex = 9999, panelStyle, fullScreen = false, overlayStyle = null }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: fullScreen ? "var(--sl-ui-modal-bg)" : "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: fullScreen ? "stretch" : "center",
        zIndex,
        padding: fullScreen ? 0 : 16,
        animation: fullScreen ? "none" : "sl-modal-overlay-enter 140ms ease-out both",
        ...(overlayStyle || {}),
      }}
    >
      <div
        style={{
          background: "var(--sl-ui-modal-bg)",
          border: fullScreen ? "none" : "1px solid var(--sl-ui-modal-border)",
          color: "var(--sl-ui-text)",
          fontFamily: "var(--app-header-font-family)",
          padding: fullScreen
            ? "calc(env(safe-area-inset-top) + 12px) 14px calc(env(safe-area-inset-bottom) + 12px)"
            : 18,
          borderRadius: fullScreen ? 0 : 10,
          width: fullScreen ? "100vw" : "min(360px, 100%)",
          maxWidth: fullScreen ? "100vw" : undefined,
          minWidth: fullScreen ? "100vw" : undefined,
          height: fullScreen ? "100dvh" : undefined,
          maxHeight: fullScreen ? "100dvh" : undefined,
          display: "grid",
          gap: 12,
          boxShadow: fullScreen ? "none" : "var(--sl-ui-modal-shadow)",
          pointerEvents: "auto",
          animation: fullScreen
            ? "sl-mobile-page-enter 155ms cubic-bezier(0.2, 0.8, 0.2, 1) both"
            : "sl-modal-panel-enter 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
          ...(panelStyle || {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function OpenReportsDatePickerModal({
  open,
  onClose,
  compactDomainPicker = false,
  presetOptions = [],
  onApplyPreset,
  onShiftMonths,
  rangeLabel = "",
  monthDate,
  cells = [],
  formatMonthLabel,
  isDateInRange,
  draftRangeFrom = "",
  draftRangeTo = "",
  onPickDate,
  onApply,
}) {
  return open ? (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10055,
        background: "rgba(8, 12, 18, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, calc(100vw - 24px))",
          maxHeight: "calc(100dvh - 40px)",
          borderRadius: 12,
          border: "1px solid var(--sl-ui-modal-border)",
          background: "var(--sl-ui-modal-bg)",
          boxShadow: "var(--sl-ui-modal-shadow)",
          display: "grid",
          gridTemplateRows: "1fr auto",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: compactDomainPicker ? "92px minmax(0, 1fr)" : "170px minmax(0, 1fr)",
            minHeight: 0,
          }}
        >
          <div
            style={{
              borderRight: "1px solid var(--sl-ui-modal-border)",
              borderBottom: "none",
              padding: 10,
              display: "grid",
              gap: 8,
              alignContent: "start",
            }}
          >
            {presetOptions.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => onApplyPreset?.(preset.key)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 9,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: "grid", minHeight: 0, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "10px 16px 10px 12px",
                borderBottom: "1px solid var(--sl-ui-modal-border)",
              }}
            >
              <button
                type="button"
                onClick={() => onShiftMonths?.(-1)}
                style={{
                  width: 30,
                  minWidth: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                aria-label="Previous month"
                title="Previous month"
              >
                ‹
              </button>
              <div
                style={{
                  fontSize: compactDomainPicker ? 11.5 : 12.5,
                  fontWeight: 900,
                  opacity: 0.9,
                  minWidth: 0,
                  flex: 1,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {rangeLabel}
              </div>
              <button
                type="button"
                onClick={() => onShiftMonths?.(1)}
                style={{
                  width: 30,
                  minWidth: 30,
                  height: 30,
                  borderRadius: 8,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                aria-label="Next month"
                title="Next month"
              >
                ›
              </button>
            </div>
            <div
              style={{
                padding: "12px 16px 12px 12px",
                overflowY: "auto",
                overflowX: "hidden",
                display: "grid",
                gap: 12,
                gridTemplateColumns: "1fr",
                minWidth: 0,
              }}
            >
              <div
                key={`${monthDate?.getFullYear?.() || 0}-${monthDate?.getMonth?.() || 0}`}
                style={{
                  border: "1px solid var(--sl-ui-modal-border)",
                  borderRadius: 10,
                  padding: 8,
                  display: "grid",
                  gap: 6,
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ textAlign: "center", fontWeight: 900 }}>
                  {formatMonthLabel?.(monthDate)}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, fontSize: 11.5, opacity: 0.85 }}>
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <div key={`${monthDate?.getMonth?.() || 0}-${d}`} style={{ textAlign: "center", fontWeight: 800 }}>
                      {d}
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
                  {cells.map((iso, idx) => {
                    if (!iso) return <div key={`blank-${idx}`} style={{ height: 30, minWidth: 0 }} />;
                    const inRange = Boolean(isDateInRange?.(iso));
                    const isStart = iso === draftRangeFrom;
                    const isEnd = iso === draftRangeTo;
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => onPickDate?.(iso)}
                        style={{
                          minWidth: 0,
                          height: 30,
                          borderRadius: isStart || isEnd ? 8 : inRange ? 6 : 8,
                          border: isStart || isEnd
                            ? "1px solid var(--sl-ui-brand-green-border)"
                            : "1px solid transparent",
                          background: isStart || isEnd
                            ? "var(--sl-ui-brand-green)"
                            : inRange
                              ? "rgba(22, 152, 133, 0.24)"
                              : "var(--sl-ui-modal-btn-secondary-bg)",
                          color: isStart || isEnd ? "white" : "var(--sl-ui-text)",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                        title={iso}
                      >
                        {Number(String(iso || "").slice(8, 10))}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            borderTop: "1px solid var(--sl-ui-modal-border)",
            padding: 10,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12.5, opacity: 0.85 }}>
            {rangeLabel}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 12px",
                borderRadius: 9,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              style={{
                padding: "8px 12px",
                borderRadius: 9,
                border: "1px solid var(--sl-ui-brand-green-border)",
                background: "var(--sl-ui-brand-green)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;
}

export function OpenReportsSubmittedReportsModal({
  open,
  row,
  rowDomainKey = "",
  modalTitleLabel = "",
  modalTitleValue = "",
  showCommunityRepairDiagnostics = false,
  repairSnapshot = null,
  onClose,
  onReporterDetails,
  incidentRepairSummaryText,
  resolveItemDomainKey,
  resolveIssueLabel,
  resolveReportTypeOptionDetails,
  reportNumberForRow,
  canViewReporterDetails = false,
  reportTypes = {},
  streetlightUtilityExpandedSet,
  streetlightUtilityLoadingByIncident = {},
  getStreetlightUtilityForIncident,
  getStreetlightUtilityRows,
  toggleStreetlightUtilityExpanded,
  copyStreetlightField,
}) {
  return (
    <ModalShell open={Boolean(open && row)} zIndex={10013}>
      {!row ? null : (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>{`${modalTitleLabel} ${modalTitleValue} Reports`.trim()}</div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                flex: "0 0 auto",
              }}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gap: 6, maxHeight: "min(70vh, 680px)", overflowY: "auto", paddingRight: 2 }}>
            {showCommunityRepairDiagnostics && repairSnapshot ? (
              <div
                style={{
                  border: "1px solid var(--sl-ui-open-reports-item-border)",
                  borderRadius: 8,
                  padding: "7px 8px",
                  display: "grid",
                  gap: 4,
                  background: "rgba(46,125,50,0.10)",
                }}
              >
                <div style={{ fontWeight: 900 }}>Community Repair Status</div>
                <div style={{ opacity: 0.9, lineHeight: 1.35 }}>{incidentRepairSummaryText?.(repairSnapshot)}</div>
              </div>
            ) : null}

            {Array.isArray(row.reopen_events) && row.reopen_events.map((ev) => (
              <div
                key={`modal-reopen-${row.incident_id}-${ev.ts || 0}`}
                style={{
                  border: "1px solid var(--sl-ui-open-reports-item-border)",
                  borderRadius: 8,
                  padding: "7px 8px",
                  display: "grid",
                  gap: 4,
                  background: "rgba(31,93,162,0.16)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>Reported again</div>
                  <div style={{ opacity: 0.8 }}>{formatTs?.(ev.ts)}</div>
                </div>
                <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                  <b>Reported again by:</b>{" "}
                  <button
                    type="button"
                    onClick={() =>
                      onReporterDetails?.({
                        id: `reopen:${row.incident_id}:${ev.ts || 0}`,
                        reporter_user_id: ev.reporter_user_id || null,
                        reporter_name: ev.reporter_name || null,
                        reporter_email: ev.reporter_email || null,
                        reporter_phone: ev.reporter_phone || null,
                        note: ev.note || "",
                        ts: Number(ev.ts || 0),
                        report_number: null,
                      })
                    }
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                      color: "var(--sl-ui-brand-green)",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {String(ev.reporter_name || "").trim() || String(ev.reporter_email || "").trim() || "Unknown"}
                  </button>
                </div>
                {!!String(noteDisplayText?.(ev.note || "") || "").trim() && (
                  <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
                    <b>Note:</b> {noteDisplayText?.(ev.note || "")}
                  </div>
                )}
              </div>
            ))}

            {!!row.fixed_event && (
              <div
                style={{
                  border: "1px solid var(--sl-ui-open-reports-item-border)",
                  borderRadius: 8,
                  padding: "7px 8px",
                  display: "grid",
                  gap: 4,
                  background: "rgba(46,125,50,0.14)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900 }}>Fixed report</div>
                  <div style={{ opacity: 0.8 }}>{formatTs?.(row.fixed_event.ts)}</div>
                </div>
                <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                  <b>Fixed by:</b>{" "}
                  <button
                    type="button"
                    onClick={() =>
                      onReporterDetails?.({
                        id: `fixed:${row.incident_id}:${row.fixed_event.ts || 0}`,
                        reporter_user_id: row.fixed_event.reporter_user_id || null,
                        reporter_name: row.fixed_event.reporter_name || null,
                        reporter_email: row.fixed_event.reporter_email || null,
                        reporter_phone: row.fixed_event.reporter_phone || null,
                        note: row.fixed_event.note || "",
                        ts: Number(row.fixed_event.ts || 0),
                        report_number: null,
                      })
                    }
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                      color: "var(--sl-ui-brand-green)",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    {String(row.fixed_event.reporter_name || "").trim() || String(row.fixed_event.reporter_email || "").trim() || "Unknown"}
                  </button>
                </div>
                {!!String(noteDisplayText?.(row.fixed_event.note || "") || "").trim() && (
                  <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
                    <b>Note:</b> {noteDisplayText?.(row.fixed_event.note || "")}
                  </div>
                )}
                {!!readImageUrlFromNote?.(row.fixed_event.note || "") && (
                  <a
                    href={readImageUrlFromNote?.(row.fixed_event.note || "")}
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
                    title="View closure photo"
                  >
                    📷 View closure photo
                  </a>
                )}
              </div>
            )}

            <div
              style={{
                color: "var(--sl-ui-text)",
                fontSize: 12,
                fontWeight: 900,
                lineHeight: 1.3,
              }}
            >
              Submitted Reports
            </div>

            {(row.rows || []).map((detail) => {
              const rawNotes = String(detail.raw_notes || detail.notes || "");
              const imageUrl = readImageUrlFromNote?.(rawNotes);
              const noteText = noteDisplayText?.(rawNotes);
              const qa = parseStreetlightQaFromNote?.(rawNotes);
              const detailDomainKey = resolveItemDomainKey?.(null, detail, rowDomainKey);
              const detailIsStreetlight = detailDomainKey === "streetlights";
              const issueLabel = resolveIssueLabel?.(detail, detailDomainKey);
              const typeOptionDetails = resolveReportTypeOptionDetails?.(detail, detailDomainKey);
              return (
                <div
                  key={`modal-detail-${row.incident_id}-${detail.report_id}`}
                  style={{
                    border: "1px solid var(--sl-ui-open-reports-item-border)",
                    borderRadius: 8,
                    padding: "9px 10px",
                    display: "grid",
                    gap: 6,
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.15 }}>
                    {detail.report_number || reportNumberForRow?.(detail, rowDomainKey)}
                  </div>
                  {canViewReporterDetails ? (
                    <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                      <b>Submitted By:</b>{" "}
                      <button
                        type="button"
                        onClick={() =>
                          onReporterDetails?.({
                            id: detail.report_id,
                            reporter_user_id: detail.reporter_user_id || null,
                            reporter_name: detail.reporter_name || null,
                            reporter_email: detail.reporter_email || null,
                            reporter_phone: detail.reporter_phone || null,
                            note: rawNotes,
                            ts: Date.parse(String(detail.submitted_at || "")) || 0,
                            report_number: detail.report_number,
                          })
                        }
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          margin: 0,
                          color: "var(--sl-ui-text)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                          cursor: "pointer",
                          fontWeight: 500,
                          fontSize: "inherit",
                          lineHeight: "inherit",
                        }}
                      >
                        {String(detail.reporter_name || "").trim() || String(detail.reporter_email || "").trim() || "Unknown"}
                      </button>
                    </div>
                  ) : null}
                  <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                    <b>Date/Time:</b> {formatTs?.(detail.submitted_at)}
                  </div>
                  {detailIsStreetlight ? (
                    <>
                      <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                        <b>What are you seeing:</b> {issueLabel || reportTypes?.[String(detail.report_type || "").trim()] || "Streetlight issue"}
                      </div>
                      <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                        <b>Power on in area:</b> {qa?.powerOn ? (qa.powerOn === "yes" ? "Yes" : qa.powerOn === "no" ? "No" : "Unknown") : "Unknown"}
                      </div>
                      <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                        <b>Hazardous situation:</b> {qa?.hazardous ? (qa.hazardous === "yes" ? "Yes" : qa.hazardous === "no" ? "No" : "Unknown") : "Unknown"}
                      </div>
                    </>
                  ) : null}
                  {!!String(issueLabel || "").trim() && !detailIsStreetlight && !hasIssueTypeOptionDetail?.(typeOptionDetails) ? (
                    <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                      <b>Issue Type:</b> {issueLabel}
                    </div>
                  ) : null}
                  <ReportTypeOptionDetails
                    details={typeOptionDetails}
                    textStyle={{ opacity: 0.95, lineHeight: 1.35 }}
                  />
                  <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                    <b>Notes:</b> {String(noteText || "").trim() || "—"}
                  </div>
                  <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                    <b>Image:</b>{" "}
                    {imageUrl ? (
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "var(--sl-ui-text)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                          fontWeight: 500,
                        }}
                        title="View attached image"
                      >
                        View Image
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              );
            })}

            {rowDomainKey === "streetlights" ? (() => {
              const utilityOpen = streetlightUtilityExpandedSet?.has?.(row.incident_id);
              const utilityLoading = Boolean(streetlightUtilityLoadingByIncident?.[row.incident_id]);
              const util = getStreetlightUtilityForIncident?.(row.incident_id);
              const items = getStreetlightUtilityRows?.(util, row?.coords || null) || [];
              return (
                <div
                  style={{
                    border: "1px solid var(--sl-ui-open-reports-item-border)",
                    borderRadius: 8,
                    padding: "7px 8px",
                    display: "grid",
                    gap: 6,
                    background: "rgba(255,255,255,0.04)",
                    fontSize: 12,
                    lineHeight: 1.3,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleStreetlightUtilityExpanded?.(row.incident_id, row?.coords || null)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                      textAlign: "left",
                      color: "var(--sl-ui-text)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {utilityOpen ? "▾ " : "▸ "}Streetlight Utility Information
                  </button>
                  {utilityOpen ? (
                    utilityLoading ? (
                      <div style={{ opacity: 0.82 }}>Loading location info...</div>
                    ) : (
                      items.map((item) => (
                        <button
                          key={`modal-streetlight-${row.incident_id}-${item.label}`}
                          type="button"
                          onClick={(e) => copyStreetlightField?.(item.label, item.value, e.currentTarget)}
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            margin: 0,
                            textAlign: "left",
                            color: "var(--sl-ui-text)",
                            cursor: "copy",
                            fontSize: 12,
                            lineHeight: 1.3,
                          }}
                        >
                          <b>{item.label}:</b>{" "}
                          <span
                            style={{
                              textDecoration: "underline",
                              textUnderlineOffset: "2px",
                              color: "#7fd7ff",
                              fontWeight: 700,
                            }}
                          >
                            {item.value}
                          </span>
                        </button>
                      ))
                    )
                  ) : null}
                </div>
              );
            })() : null}
          </div>

          <button onClick={onClose} style={{ ...btnPrimaryDark, width: "100%" }}>
            Close
          </button>
        </div>
      )}
    </ModalShell>
  );
}

export function OpenReportsSavedStreetlightReportModal({
  open,
  row,
  onClose,
  darkMode = false,
  getStreetlightUtilityForIncident,
  getStreetlightUtilityRows,
  utilityReportedByIncident = {},
  utilityReportReferenceByIncident = {},
  openUtilityReportDialog,
  clearUtilityReported,
  slIdByUuid,
  resolveIssueLabel,
  activeDomain = "streetlights",
  reportTypes = {},
  copyStreetlightField,
  openExternalUrl,
  streetlightUtilityReportUrl = "",
}) {
  const latestDetail = row?.rows?.[0] || null;
  const rawNotes = String(latestDetail?.raw_notes || latestDetail?.notes || "");
  const noteText = noteDisplayText?.(rawNotes);
  const imageUrl = readImageUrlFromNote?.(rawNotes);
  const qa = parseStreetlightQaFromNote?.(rawNotes);
  const utilityItems = getStreetlightUtilityRows?.(getStreetlightUtilityForIncident?.(row?.incident_id), row?.coords || null) || [];
  const utilityReported = Boolean(utilityReportedByIncident?.[row?.incident_id]);
  const utilityReference = String(utilityReportReferenceByIncident?.[row?.incident_id] || "").trim();

  return (
    <ModalShell open={Boolean(open && row)} zIndex={10041}>
      {!row ? null : (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1.05 }}>Saved Report</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.15, opacity: 0.78, fontWeight: 500 }}>
                Streetlight ID
              </div>
              <div style={{ fontSize: 18, lineHeight: 1.2, fontWeight: 900, wordBreak: "break-word" }}>
                {displayLightId?.(row.incident_id, slIdByUuid)}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                flex: "0 0 auto",
              }}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, opacity: 0.96 }}>
              <input
                type="checkbox"
                checked={utilityReported}
                onChange={(e) => {
                  if (e.target.checked) openUtilityReportDialog?.(row.incident_id);
                  else void clearUtilityReported?.(row.incident_id);
                }}
                aria-label={`Utility reported for ${displayLightId?.(row.incident_id, slIdByUuid)}`}
              />
              Utility reported
            </label>
            {utilityReported ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  border: "1px solid var(--sl-ui-open-reports-item-border)",
                  borderRadius: 10,
                  padding: "9px 10px",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: 12, lineHeight: 1.2, opacity: 0.78 }}>Utility report #</div>
                  <div style={{ fontSize: 16, lineHeight: 1.2, fontWeight: 900, wordBreak: "break-word" }}>
                    {utilityReference || "Not added yet"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openUtilityReportDialog?.(row.incident_id)}
                  aria-label={utilityReference ? "Edit utility report number" : "Add utility report number"}
                  title={utilityReference ? "Edit utility report number" : "Add utility report number"}
                  style={{
                    width: 36,
                    minWidth: 36,
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    padding: 0,
                    flex: "0 0 auto",
                  }}
                >
                  <AppIcon
                    src={uiIconSrc.utilityReportReference}
                    iconKey="utilityReportReference"
                    darkMode={darkMode}
                    size={18}
                  />
                </button>
              </div>
            ) : null}
          </div>

          {latestDetail ? (
            <div
              style={{
                border: "1px solid var(--sl-ui-open-reports-item-border)",
                borderRadius: 10,
                padding: "10px 12px",
                display: "grid",
                gap: 6,
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 950, lineHeight: 1.1 }}>Submitted report</div>
              {!!latestDetail?.report_number && (
                <div style={{ fontSize: 11.5, opacity: 0.82, fontWeight: 900 }}>
                  Report #: {latestDetail.report_number}
                </div>
              )}
              <div style={{ fontSize: 12, opacity: 0.82 }}>{formatTs?.(latestDetail.submitted_at)}</div>
              <div style={{ opacity: 0.96, lineHeight: 1.3 }}>
                <b>What are you seeing:</b> {resolveIssueLabel?.(latestDetail, activeDomain) || reportTypes?.[String(latestDetail.report_type || "").trim()] || "Streetlight issue"}
              </div>
              <div style={{ opacity: 0.96, lineHeight: 1.3 }}>
                <b>Power on in area:</b> {qa?.powerOn ? (qa.powerOn === "yes" ? "Yes" : qa.powerOn === "no" ? "No" : "Unknown") : "Unknown"}
              </div>
              <div style={{ opacity: 0.96, lineHeight: 1.3 }}>
                <b>Hazardous situation:</b> {qa?.hazardous ? (qa.hazardous === "yes" ? "Yes" : qa.hazardous === "no" ? "No" : "Unknown") : "Unknown"}
              </div>
              {!!String(noteText || "").trim() && (
                <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                  <b>Note:</b> {noteText}
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
            </div>
          ) : null}

          <div
            style={{
              border: "1px solid var(--sl-ui-open-reports-item-border)",
              borderRadius: 10,
              padding: "10px 12px",
              display: "grid",
              gap: 6,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.1 }}>Streetlight Utility Information</div>
            {utilityItems.length ? (
              utilityItems.map((item) => (
                <button
                  key={`saved-streetlight-${row.incident_id}-${item.label}`}
                  type="button"
                  onClick={(e) => copyStreetlightField?.(item.label, item.value, e.currentTarget)}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    margin: 0,
                    textAlign: "left",
                    color: "var(--sl-ui-text)",
                    cursor: "copy",
                    fontSize: 12.5,
                    lineHeight: 1.3,
                  }}
                >
                  <b>{item.label}:</b>{" "}
                  <span
                    style={{
                      textDecoration: "underline",
                      textUnderlineOffset: "2px",
                      color: "#7fd7ff",
                      fontWeight: 700,
                    }}
                  >
                    {item.value}
                  </span>
                </button>
              ))
            ) : (
              <div style={{ fontSize: 12.5, opacity: 0.8 }}>Location information unavailable.</div>
            )}
          </div>

          <div
            style={{
              marginTop: 2,
              display: "grid",
              gap: 8,
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <button
              type="button"
              onClick={() => {
                void openExternalUrl?.(streetlightUtilityReportUrl);
              }}
              style={{
                padding: 10,
                width: "100%",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-brand-blue-border)",
                background: "var(--sl-ui-brand-blue)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Report Outage to Utility
            </button>
            <button
              onClick={onClose}
              style={{
                padding: 10,
                width: "100%",
                borderRadius: 10,
                border: "none",
                background: "#111",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

export function OpenReportsUtilityReportDialogModal({
  open,
  reference = "",
  setReference,
  onSave,
  onCancel,
}) {
  return (
    <ModalShell open={open} zIndex={10042}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Utility Report</div>
        <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
          Confirm that you reported this light to the utility. Add the utility report number or reference if you have it.
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Utility report number or reference</div>
          <input
            value={reference}
            onChange={(e) => setReference?.(e.target.value)}
            placeholder="Optional reference number"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-input-border)",
              background: "var(--sl-ui-modal-input-bg)",
              color: "var(--sl-ui-text)",
              fontWeight: 700,
            }}
          />
        </label>
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              void onSave?.();
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "none",
              background: "var(--sl-ui-brand-blue)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Save Utility Report
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function OpenReportsConfirmWorkingModal({
  open,
  onConfirm,
  onCancel,
}) {
  return (
    <ModalShell open={open} zIndex={10012}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Is Working</div>
        <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
          Submit this light as working?
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              void onConfirm?.();
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "none",
              background: "var(--sl-ui-brand-blue)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function OpenReportsIncidentRepairConfirmModal({
  open,
  onConfirm,
  onCancel,
}) {
  return (
    <ModalShell open={open} zIndex={10012}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Is Fixed</div>
        <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
          Confirm that this incident has been fixed?
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              void onConfirm?.();
            }}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "none",
              background: "var(--sl-ui-brand-blue)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function OpenReportsIncidentStateUpdateModal({
  open,
  incidentLabel = "",
  currentStateLabel = "",
  stateOptions = [],
  nextState = "",
  onNextStateChange,
  note = "",
  onNoteChange,
  notePlaceholder = "",
  showClosurePhoto = false,
  submitting = false,
  imageFile = null,
  imagePreviewUrl = "",
  onImageFileChange,
  onRemoveImage,
  pin = "",
  onPinChange,
  errorText = "",
  stateUnchanged = false,
  onSave,
  onCancel,
}) {
  return (
    <ModalShell open={open} zIndex={10012}>
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Update Incident State</div>
        <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
          Choose a state, then enter your 4-digit PIN to save.
        </div>
        {incidentLabel ? (
          <div style={{ fontSize: 12, opacity: 0.82, lineHeight: 1.35 }}>
            <b>Incident:</b> {incidentLabel}
          </div>
        ) : null}
        <div style={{ fontSize: 12, opacity: 0.82, lineHeight: 1.35 }}>
          <b>Current state:</b> {currentStateLabel}
        </div>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>New state</div>
          <select
            value={nextState}
            onChange={(e) => onNextStateChange?.(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-input-border)",
              background: "var(--sl-ui-modal-input-bg)",
              color: "var(--sl-ui-text)",
              fontWeight: 700,
            }}
          >
            {stateOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Notes (optional)</div>
          <textarea
            value={note}
            onChange={(e) => onNoteChange?.(e.target.value)}
            placeholder={notePlaceholder}
            style={{
              minHeight: 88,
              resize: "vertical",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-input-border)",
              background: "var(--sl-ui-modal-input-bg)",
              color: "var(--sl-ui-text)",
              padding: 10,
              fontSize: 14,
              lineHeight: 1.35,
            }}
          />
        </label>
        {showClosurePhoto ? (
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Closure photo (optional)</div>
            <input
              type="file"
              accept="image/*"
              disabled={submitting}
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                onImageFileChange?.(file);
              }}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
              }}
            />
            {imageFile ? (
              <div style={{ display: "grid", gap: 6 }}>
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="Closure photo preview"
                    style={{
                      width: "100%",
                      maxHeight: 112,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-border)",
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => onRemoveImage?.()}
                  disabled={submitting}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 900,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.7 : 1,
                  }}
                >
                  Remove photo
                </button>
              </div>
            ) : null}
          </label>
        ) : null}
        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>PIN</div>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => onPinChange?.(e.target.value)}
            placeholder="4-digit PIN"
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-input-border)",
              background: "var(--sl-ui-modal-input-bg)",
              color: "var(--sl-ui-text)",
              fontWeight: 700,
              letterSpacing: "0.18em",
            }}
          />
        </label>
        {errorText ? (
          <div style={{ fontSize: 12, color: "#ffb3b3", lineHeight: 1.35 }}>
            {errorText}
          </div>
        ) : null}
        {stateUnchanged ? (
          <div style={{ fontSize: 12, opacity: 0.76, lineHeight: 1.35 }}>
            Select a different state to save a change.
          </div>
        ) : null}
        <div style={{ display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              void onSave?.();
            }}
            disabled={submitting || stateUnchanged}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "none",
              background: "var(--sl-ui-brand-blue)",
              color: "white",
              fontWeight: 900,
              cursor: submitting ? "progress" : stateUnchanged ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : stateUnchanged ? 0.5 : 1,
            }}
          >
            {submitting ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function MapAdminDeferredDialogs({
  exitMappingConfirmOpen = false,
  mappingQueueCount = 0,
  saving = false,
  onConfirmExitMapping,
  onDiscardExitMapping,
  onCancelExitMapping,
  clearQueuedConfirmOpen = false,
  onConfirmClearQueued,
  onCancelClearQueued,
  domainSwitchConfirmOpen = false,
  pendingDomainSwitchTargetLabel = "",
  onPlaceAndSwitch,
  onClearAndSwitch,
  onCancelDomainSwitch,
  queueSignTypeOpen = false,
  pendingQueuedSignType = "",
  onPendingQueuedSignTypeChange,
  signTypeOptions = [],
  canConfirmQueueSign = false,
  onConfirmQueueSign,
  onCancelQueueSign,
  darkMode = false,
  deleteCircleConfirmOpen = false,
  deleteCircleCandidateCount = 0,
  deleteCircleNote = "",
  onDeleteCircleNoteChange,
  onConfirmDeleteCircle,
  onCancelDeleteCircle,
  onClearDeleteCircle,
  deleteOfficialConfirmOpen = false,
  onConfirmDeleteOfficial,
  onCancelDeleteOfficial,
  deleteOfficialSignConfirmOpen = false,
  onConfirmDeleteOfficialSign,
  onCancelDeleteOfficialSign,
}) {
  return (
    <>
      <ModalShell open={exitMappingConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Save queued assets?</div>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            You have <b>{mappingQueueCount}</b> queued asset{mappingQueueCount === 1 ? "" : "s"}.
            Save them before turning mapping off?
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                void onConfirmExitMapping?.();
              }}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-green)",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Placing…" : "Place & Turn Off"}
            </button>
            <button
              type="button"
              onClick={onDiscardExitMapping}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "#d32f2f",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Discard & Turn Off
            </button>
            <button
              type="button"
              onClick={onCancelExitMapping}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={clearQueuedConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Clear queued assets?</div>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Remove <b>{mappingQueueCount}</b> queued asset{mappingQueueCount === 1 ? "" : "s"} that have not been saved yet?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={onConfirmClearQueued}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "#d32f2f",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Clear Queued Assets
            </button>
            <button
              type="button"
              onClick={onCancelClearQueued}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={domainSwitchConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Switch report domain?</div>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            You have <b>{mappingQueueCount}</b> queued asset{mappingQueueCount === 1 ? "" : "s"} in mapping mode.
            Place or clear queued assets before switching to <b>{String(pendingDomainSwitchTargetLabel || "the selected domain")}</b>.
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={onPlaceAndSwitch}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-green)",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Placing..." : "Place & Switch"}
            </button>
            <button
              type="button"
              onClick={onClearAndSwitch}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "#d32f2f",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Clear & Switch
            </button>
            <button
              type="button"
              onClick={onCancelDomainSwitch}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={queueSignTypeOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Select sign type</div>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Choose the sign type before adding this mapped sign to the queue.
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, opacity: 0.9 }}>Sign type</span>
            <select
              value={String(pendingQueuedSignType || "")}
              onChange={(e) => onPendingQueuedSignTypeChange?.(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
                fontWeight: 700,
              }}
            >
              <option value="" disabled>
                Select sign type...
              </option>
              {signTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: "grid", gap: 8, marginTop: 2 }}>
            <button
              type="button"
              onClick={onConfirmQueueSign}
              disabled={!canConfirmQueueSign}
              aria-label="Add sign to queue"
              title="Add sign to queue"
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-green)",
                color: "white",
                fontWeight: 900,
                cursor: canConfirmQueueSign ? "pointer" : "not-allowed",
                opacity: canConfirmQueueSign ? 1 : 0.6,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {ActionButtonIcon ? <ActionButtonIcon action="add" darkMode={darkMode} emphasis="filled" /> : "Add"}
            </button>
            <button
              type="button"
              onClick={onCancelQueueSign}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={deleteCircleConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Circle Mark Fixed</div>
          <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.4 }}>
            Mark fixed <b>{deleteCircleCandidateCount}</b> incident{deleteCircleCandidateCount === 1 ? "" : "s"} inside this circle?
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Notes (optional)</div>
            <textarea
              value={deleteCircleNote}
              onChange={(e) => onDeleteCircleNoteChange?.(e.target.value)}
              placeholder="Resolution notes for this batch mark-fixed action"
              style={{
                minHeight: 72,
                resize: "vertical",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
                padding: 10,
                fontSize: 14,
                lineHeight: 1.35,
              }}
            />
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                void onConfirmDeleteCircle?.();
              }}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-blue)",
                color: "white",
                fontWeight: 900,
                cursor: saving || deleteCircleCandidateCount === 0 ? "not-allowed" : "pointer",
                opacity: saving || deleteCircleCandidateCount === 0 ? 0.7 : 1,
              }}
              disabled={saving || deleteCircleCandidateCount === 0}
            >
              {saving ? "Applying..." : `Mark fixed ${deleteCircleCandidateCount}`}
            </button>
            <button
              type="button"
              onClick={onCancelDeleteCircle}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onClearDeleteCircle}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
              disabled={saving}
            >
              Clear Circle
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={deleteOfficialConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Delete Light</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Delete this saved light?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                void onConfirmDeleteOfficial?.();
              }}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-blue)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancelDeleteOfficial}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={deleteOfficialSignConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Delete Sign</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Delete this saved sign?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                void onConfirmDeleteOfficialSign?.();
              }}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-blue)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={onCancelDeleteOfficialSign}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>
    </>
  );
}
