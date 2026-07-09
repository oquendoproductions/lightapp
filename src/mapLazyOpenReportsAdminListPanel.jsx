import React, { Fragment } from "react";

import {
  adminFacingIncidentStateLabel,
} from "./lib/incidentLifecycle.js";
import {
  incidentRepairSummaryText,
} from "./lib/mapIncidentIdentitySupport.js";
import { repairActionButtonStyle } from "./lib/mapRepairActionStyleSupport.js";
import { ActionButtonIcon } from "./mapUiIconComponentsSupport.jsx";

function UtilityReportedInlineControl({
  row,
  isStreetlightRow,
  isOpenLifecycleState,
  utilityReportedByIncident,
  utilityReportReferenceByIncident,
  openUtilityReportDialog,
  clearUtilityReported,
  darkMode,
  inline = false,
}) {
  if (!(isStreetlightRow && isOpenLifecycleState(row.current_state || ""))) {
    return inline
      ? <span style={{ fontSize: 12, opacity: 0.45 }}>-</span>
      : null;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.95 }}>
        <input
          type="checkbox"
          checked={Boolean(utilityReportedByIncident[row.incident_id])}
          onChange={(event) => {
            if (event.target.checked) openUtilityReportDialog(row.incident_id);
            else void clearUtilityReported(row.incident_id);
          }}
          aria-label={`Utility reported for ${row.incident_label || row.incident_id}`}
        />
        Utility reported
      </label>
      {Boolean(utilityReportedByIncident[row.incident_id]) && (
        <button
          type="button"
          onClick={() => openUtilityReportDialog(row.incident_id)}
          aria-label={utilityReportReferenceByIncident?.[row.incident_id] ? "Edit utility report number" : "Add utility report number"}
          title={utilityReportReferenceByIncident?.[row.incident_id] ? "Edit utility report number" : "Add utility report number"}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
          }}
        >
          <ActionButtonIcon
            action={utilityReportReferenceByIncident?.[row.incident_id] ? "edit" : "add"}
            darkMode={darkMode}
            emphasis="secondary"
          />
        </button>
      )}
      {inline && Boolean(utilityReportedByIncident[row.incident_id]) && (
        <span style={{ fontSize: 12, opacity: 0.82 }}>
          #{utilityReportReferenceByIncident?.[row.incident_id] || "Pending"}
        </span>
      )}
    </div>
  );
}

function IncidentActionButtons({
  row,
  rowDomainKey,
  isStreetlightRow,
  canMutateRow,
  showOrganizationRepairAction,
  showPublicRepairAction,
  repairSnapshot,
  onFlyTo,
  onUpdateIncidentStatus,
  onConfirmRepairIncident,
  onMarkWorkingIncident,
  openExternalUrl,
  streetlightUtilityReportUrl,
  repairActionButtonStyle,
  isOpenLifecycleState,
  getWorkingActionStateForIncident,
  compact = false,
}) {
  const buttonBaseStyle = {
    padding: "6px 8px",
    borderRadius: 8,
    fontWeight: 900,
  };

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => {
          if (!Number.isFinite(row.coords?.lat) || !Number.isFinite(row.coords?.lng)) return;
          onFlyTo?.([row.coords.lat, row.coords.lng], 18, row.incident_id);
        }}
        style={{
          ...buttonBaseStyle,
          border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
          background: "var(--sl-ui-modal-btn-secondary-bg)",
          color: "var(--sl-ui-modal-btn-secondary-text)",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Fly to
      </button>
      {rowDomainKey === "streetlights" && canMutateRow && (
        <button
          type="button"
          onClick={() => {
            void openExternalUrl(streetlightUtilityReportUrl);
          }}
          style={{
            ...buttonBaseStyle,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            cursor: "pointer",
          }}
        >
          Report Outage to Utility
        </button>
      )}
      {showOrganizationRepairAction && (
        <button
          type="button"
          onClick={() => onUpdateIncidentStatus?.(row, rowDomainKey)}
          style={{
            ...buttonBaseStyle,
            border: "none",
            background: "var(--sl-ui-brand-green)",
            color: "white",
            cursor: "pointer",
          }}
        >
          Update State
        </button>
      )}
      {(showPublicRepairAction || repairSnapshot?.viewerHasRepairSignal) && (
        <button
          type="button"
          onClick={() => onConfirmRepairIncident?.(row.incident_id, rowDomainKey)}
          disabled={Boolean(repairSnapshot?.viewerHasRepairSignal)}
          style={repairActionButtonStyle(
            {
              ...buttonBaseStyle,
              whiteSpace: compact ? "nowrap" : undefined,
            },
            Boolean(repairSnapshot?.viewerHasRepairSignal),
            {
              border: "none",
              background: "var(--sl-ui-brand-green)",
              color: "white",
            }
          )}
          title={repairSnapshot?.viewerHasRepairSignal ? "You already marked this incident fixed." : "Mark incident fixed"}
        >
          Is fixed
        </button>
      )}
      {isStreetlightRow && isOpenLifecycleState(row.current_state || "") && getWorkingActionStateForIncident(row.incident_id, rowDomainKey) === "available" && (
        <button
          type="button"
          onClick={() => onMarkWorkingIncident?.(row.incident_id)}
          style={{
            ...buttonBaseStyle,
            border: "none",
            background: "var(--sl-ui-brand-green)",
            color: "white",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Is working
        </button>
      )}
      {isStreetlightRow && isOpenLifecycleState(row.current_state || "") && getWorkingActionStateForIncident(row.incident_id, rowDomainKey) === "confirmed" && (
        <button
          type="button"
          disabled
          aria-pressed="true"
          title="You already marked this light as working."
          style={{
            ...buttonBaseStyle,
            border: "1px solid rgba(22, 116, 89, 0.82)",
            background: "rgba(24, 138, 95, 0.26)",
            color: "white",
            cursor: "default",
            opacity: 0.92,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
            whiteSpace: "nowrap",
          }}
        >
          Is working
        </button>
      )}
    </div>
  );
}

export default function OpenReportsAdminListPanel(props) {
  const {
    activeDomain = "streetlights",
    adminIncidentDotForRow,
    canManageIncidentMutations,
    canMutateIncidents,
    canShowPublicRepairAction,
    clearUtilityReported,
    compactDomainPicker = false,
    darkMode = false,
    displayedAdminRows = [],
    enabledDomainOptions = [],
    formatTs,
    getRepairSnapshotForIncident,
    getWorkingActionStateForIncident,
    hasStreetlightsInMyReportsSelection = false,
    humanizeLabel,
    incidentDisplayValueForDomain,
    incidentHeaderTitleForDomain,
    incidentStateLabel,
    isOpenLifecycleState,
    onConfirmRepairIncident,
    onFlyTo,
    onMarkWorkingIncident,
    onUpdateIncidentStatus,
    openAdminSubmittedReportsModal,
    openExternalUrl,
    openIncidentLocationDetails,
    openSubmittedReportsForRow,
    openUtilityReportDialog,
    resolveDisplayedRowDomainKey,
    singularizeDomainLabel,
    slIdByUuid = null,
    displayLightId,
    showCommunityRepairDiagnostics = false,
    streetlightUtilityReportUrl = "",
    tableSort = { key: "count", dir: "desc" },
    toggleTableSort,
    utilityReportedByIncident = {},
    utilityReportReferenceByIncident = {},
    usesPersonalMyReportsLayout = false,
  } = props;

  if (!displayedAdminRows.length) {
    return (
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        No reports in selected filters.
      </div>
    );
  }

  if (compactDomainPicker) {
    return (
      <div style={{ display: "grid", gap: 8, width: "100%", alignContent: "start", gridAutoRows: "max-content" }}>
        {displayedAdminRows.map((row) => {
          const rowDomainKey = resolveDisplayedRowDomainKey(row, activeDomain);
          const canMutateRow = typeof canManageIncidentMutations === "function"
            ? canManageIncidentMutations(rowDomainKey)
            : canMutateIncidents;
          const repairSnapshot = getRepairSnapshotForIncident(row.incident_id, rowDomainKey);
          const showPublicRepairAction = typeof canShowPublicRepairAction === "function"
            ? canShowPublicRepairAction(row.incident_id, rowDomainKey)
            : false;
          const showOrganizationRepairAction = canMutateRow && !showPublicRepairAction;
          const isStreetlightRow = rowDomainKey === "streetlights";
          const mobileMyReportsCard = usesPersonalMyReportsLayout && !isStreetlightRow;
          const streetlightMobileSummaryCard = isStreetlightRow && usesPersonalMyReportsLayout;
          const compactAdminAllReportsCard = !mobileMyReportsCard && !streetlightMobileSummaryCard;
          const incidentHeaderValue = incidentDisplayValueForDomain(
            rowDomainKey,
            row.incident_id,
            row.coords,
            row.incident_label,
            "",
            slIdByUuid
          );
          const compactIncidentDomainLabel = singularizeDomainLabel(
            enabledDomainOptions.find((option) => option.key === rowDomainKey)?.label || humanizeLabel(rowDomainKey),
            "Incident"
          );

          return (
            <div
              key={`mobile-${row.incident_key || row.incident_id}`}
              style={{
                border: "1px solid var(--sl-ui-open-reports-item-border)",
                borderRadius: 10,
                padding: 10,
                display: "grid",
                gap: 6,
                background: "var(--sl-ui-modal-subtle-bg)",
                alignContent: "start",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                  {usesPersonalMyReportsLayout ? (
                    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                      <span style={{ fontSize: 15, lineHeight: 1.2, fontWeight: 900 }}>
                        {compactIncidentDomainLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => openIncidentLocationDetails(row, rowDomainKey)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--sl-ui-text)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                          fontSize: 15,
                          lineHeight: 1.2,
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: 0,
                          textAlign: "left",
                          minWidth: 0,
                          overflowWrap: "anywhere",
                        }}
                        title="Open incident location information"
                      >
                        {incidentHeaderValue || displayLightId(row.incident_id, slIdByUuid) || row.incident_id}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                      <span style={{ fontSize: 15, lineHeight: 1.2, fontWeight: 900 }}>
                        {compactIncidentDomainLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => openIncidentLocationDetails(row, rowDomainKey)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--sl-ui-text)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                          fontSize: 15,
                          lineHeight: 1.2,
                          fontWeight: 500,
                          cursor: "pointer",
                          padding: 0,
                          textAlign: "left",
                          minWidth: 0,
                          overflowWrap: "anywhere",
                        }}
                        title="Open incident location information"
                      >
                        {incidentHeaderValue || row.incident_id}
                      </button>
                    </div>
                  )}
                </div>
                {(streetlightMobileSummaryCard || mobileMyReportsCard) ? (
                  <IncidentActionButtons
                    row={row}
                    rowDomainKey={rowDomainKey}
                    isStreetlightRow={isStreetlightRow}
                    canMutateRow={canMutateRow}
                    showOrganizationRepairAction={showOrganizationRepairAction}
                    showPublicRepairAction={showPublicRepairAction}
                    repairSnapshot={repairSnapshot}
                    onFlyTo={onFlyTo}
                    onUpdateIncidentStatus={onUpdateIncidentStatus}
                    onConfirmRepairIncident={onConfirmRepairIncident}
                    onMarkWorkingIncident={onMarkWorkingIncident}
                    openExternalUrl={openExternalUrl}
                    streetlightUtilityReportUrl={streetlightUtilityReportUrl}
                    repairActionButtonStyle={repairActionButtonStyle}
                    isOpenLifecycleState={isOpenLifecycleState}
                    getWorkingActionStateForIncident={getWorkingActionStateForIncident}
                    compact
                  />
                ) : null}
              </div>

              <div style={{ fontSize: 12.5, opacity: 0.92 }}>
                <b>{usesPersonalMyReportsLayout ? "Status:" : "State:"}</b>{" "}
                {usesPersonalMyReportsLayout
                  ? incidentStateLabel(row.current_state || "")
                  : adminFacingIncidentStateLabel(row.current_state || "")}
              </div>

              {!usesPersonalMyReportsLayout && (
                <button
                  type="button"
                  onClick={() => openAdminSubmittedReportsModal(row, rowDomainKey)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "var(--sl-ui-text)",
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                    fontSize: 12.5,
                    opacity: 0.92,
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: "2px 4px 2px 0",
                    margin: 0,
                    justifySelf: "start",
                    textAlign: "left",
                  }}
                  title="Open submitted reports"
                >
                  <b>Reports:</b> {Number(row.report_count || 0)}
                </button>
              )}

              <div style={{ fontSize: 12.5, opacity: 0.92 }}>
                <b>Latest Report:</b>{" "}
                {usesPersonalMyReportsLayout ? (
                  <button
                    type="button"
                    onClick={() => openSubmittedReportsForRow(row)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--sl-ui-text)",
                      textDecoration: "underline",
                      textUnderlineOffset: "2px",
                      fontWeight: 500,
                      cursor: "pointer",
                      padding: 0,
                    }}
                    title="Open submitted reports"
                  >
                    {formatTs(row.latest_submitted_at || row.latest_activity_at)}
                  </button>
                ) : (
                  formatTs(isStreetlightRow ? row.latest_submitted_at : (row.latest_activity_at || row.latest_submitted_at))
                )}
              </div>

              {streetlightMobileSummaryCard && UtilityReportedInlineControl({
                row,
                isStreetlightRow,
                isOpenLifecycleState,
                utilityReportedByIncident,
                utilityReportReferenceByIncident,
                openUtilityReportDialog,
                clearUtilityReported,
                darkMode,
              })}

              {showCommunityRepairDiagnostics && repairSnapshot && (
                <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                  <b>Community repair:</b> {incidentRepairSummaryText(repairSnapshot)}
                </div>
              )}

              {compactAdminAllReportsCard && IncidentActionButtons({
                row,
                rowDomainKey,
                isStreetlightRow,
                canMutateRow,
                showOrganizationRepairAction,
                showPublicRepairAction,
                repairSnapshot,
                onFlyTo,
                onUpdateIncidentStatus,
                onConfirmRepairIncident,
                onMarkWorkingIncident,
                openExternalUrl,
                streetlightUtilityReportUrl,
                repairActionButtonStyle,
                isOpenLifecycleState,
                getWorkingActionStateForIncident,
                compact: true,
              })}

              {compactAdminAllReportsCard && isStreetlightRow && isOpenLifecycleState(row.current_state || "") && UtilityReportedInlineControl({
                row,
                isStreetlightRow,
                isOpenLifecycleState,
                utilityReportedByIncident,
                utilityReportReferenceByIncident,
                openUtilityReportDialog,
                clearUtilityReported,
                darkMode,
              })}

              {isStreetlightRow && Boolean(utilityReportedByIncident[row.incident_id]) && (
                <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>
                  <b>Utility report #:</b> {utilityReportReferenceByIncident?.[row.incident_id] || "Not added yet"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        overflow: "auto",
        border: "1px solid var(--sl-ui-open-reports-item-border)",
        borderRadius: 10,
        background: "var(--sl-ui-modal-subtle-bg)",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr style={{ position: "sticky", top: 0, background: "var(--sl-ui-modal-bg)", zIndex: 1 }}>
            {[
              { key: "incident_id", label: usesPersonalMyReportsLayout ? "Incident" : (activeDomain === "streetlights" ? "Light ID" : "Incident") },
              { key: "current_state", label: usesPersonalMyReportsLayout ? "Status" : "State" },
              ...(usesPersonalMyReportsLayout ? [] : [{ key: "report_count", label: "Reports" }]),
              { key: "submitted_at", label: "Latest report" },
              { key: "actions", label: "Actions" },
              ...(hasStreetlightsInMyReportsSelection ? [{ key: "utility_reported", label: "Utility reported" }] : []),
            ].map((header) => (
              <th
                key={header.key}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--sl-ui-open-reports-item-border)",
                  whiteSpace: "nowrap",
                }}
              >
                {header.key === "actions" ? (
                  header.label
                ) : (
                  <button
                    type="button"
                    onClick={() => toggleTableSort(header.key)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--sl-ui-text)",
                      fontWeight: 900,
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    {header.label}
                    {tableSort.key === header.key ? (tableSort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {displayedAdminRows.map((row) => {
            const rowDomainKey = resolveDisplayedRowDomainKey(row, activeDomain);
            const canMutateRow = typeof canManageIncidentMutations === "function"
              ? canManageIncidentMutations(rowDomainKey)
              : canMutateIncidents;
            const isStreetlightRow = rowDomainKey === "streetlights";
            const tableIncidentDomainLabel = singularizeDomainLabel(
              enabledDomainOptions.find((option) => option.key === rowDomainKey)?.label || humanizeLabel(rowDomainKey),
              "Incident"
            );
            const incidentRowLabel = incidentHeaderTitleForDomain(
              rowDomainKey,
              row.incident_id,
              row.coords,
              row.incident_label,
              "",
              slIdByUuid
            );
            const repairSnapshot = getRepairSnapshotForIncident(row.incident_id, rowDomainKey);
            const showPublicRepairAction = typeof canShowPublicRepairAction === "function"
              ? canShowPublicRepairAction(row.incident_id, rowDomainKey)
              : false;
            const showOrganizationRepairAction = canMutateRow && !showPublicRepairAction;

            return (
              <Fragment key={row.incident_key || row.incident_id}>
                <tr>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                    <button
                      type="button"
                      onClick={() => openIncidentLocationDetails(row, rowDomainKey)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "var(--sl-ui-text)",
                        cursor: "pointer",
                        padding: 0,
                        textAlign: "left",
                      }}
                      title="Open incident location information"
                    >
                      <span style={{ fontWeight: 900 }}>{tableIncidentDomainLabel}</span>{" "}
                      <span style={{ textDecoration: "underline", textUnderlineOffset: "2px", fontWeight: 500 }}>
                        {incidentDisplayValueForDomain(
                          rowDomainKey,
                          row.incident_id,
                          row.coords,
                          row.incident_label,
                          "",
                          slIdByUuid
                        ) || incidentRowLabel || row.incident_id}
                      </span>
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: 999,
                          background: adminIncidentDotForRow(row).color,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                          marginLeft: 7,
                          verticalAlign: "middle",
                        }}
                        title={adminIncidentDotForRow(row).label}
                      />
                    </button>
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                    {usesPersonalMyReportsLayout
                      ? incidentStateLabel(row.current_state || "")
                      : adminFacingIncidentStateLabel(row.current_state || "")}
                  </td>
                  {!usesPersonalMyReportsLayout && (
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)", fontWeight: 900 }}>
                      <button
                        type="button"
                        onClick={() => openAdminSubmittedReportsModal(row, rowDomainKey)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--sl-ui-text)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                          fontWeight: 500,
                          cursor: "pointer",
                          padding: "2px 4px",
                          margin: "-2px -4px",
                        }}
                        title="Open submitted reports"
                      >
                        Reports: {Number(row.report_count || 0)}
                      </button>
                    </td>
                  )}
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                    {usesPersonalMyReportsLayout ? (
                      <button
                        type="button"
                        onClick={() => openSubmittedReportsForRow(row)}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--sl-ui-text)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                          fontWeight: 500,
                          cursor: "pointer",
                          padding: 0,
                          textAlign: "left",
                        }}
                        title="Open submitted reports"
                      >
                        {formatTs(row.latest_submitted_at || row.latest_activity_at)}
                      </button>
                    ) : (
                      formatTs(isStreetlightRow ? row.latest_submitted_at : (row.latest_activity_at || row.latest_submitted_at))
                    )}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                    <incidentActionButtons
                      row={row}
                      rowDomainKey={rowDomainKey}
                      isStreetlightRow={isStreetlightRow}
                      canMutateRow={canMutateRow}
                      showOrganizationRepairAction={showOrganizationRepairAction}
                      showPublicRepairAction={showPublicRepairAction}
                      repairSnapshot={repairSnapshot}
                      onFlyTo={onFlyTo}
                      onUpdateIncidentStatus={onUpdateIncidentStatus}
                      onConfirmRepairIncident={onConfirmRepairIncident}
                      onMarkWorkingIncident={onMarkWorkingIncident}
                      openExternalUrl={openExternalUrl}
                      streetlightUtilityReportUrl={streetlightUtilityReportUrl}
                      repairActionButtonStyle={repairActionButtonStyle}
                      isOpenLifecycleState={isOpenLifecycleState}
                      getWorkingActionStateForIncident={getWorkingActionStateForIncident}
                    />
                  </td>
                  {hasStreetlightsInMyReportsSelection && (
                    <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                      {UtilityReportedInlineControl({
                        row,
                        isStreetlightRow,
                        isOpenLifecycleState,
                        utilityReportedByIncident,
                        utilityReportReferenceByIncident,
                        openUtilityReportDialog,
                        clearUtilityReported,
                        darkMode,
                        inline: true,
                      })}
                    </td>
                  )}
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
