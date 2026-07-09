import React, { useEffect } from "react";
import {
  defaultDomainIssueValue,
  defaultDomainIssueOptions,
  normalizeDomainIssueOptions,
} from "./lib/mapDomainConfigSupport";
import {
  isStreetlightDownedPoleIssue,
  isStreetlightOtherIssue,
} from "./lib/mapReportFlowSelectionSupport.js";
import { publicSubmitDisclosureTextShared, resolveRuntimeDomainIssueOptionsShared } from "./lib/mapRuntimeDomainReportConfigSupport.js";
import { ModalShell } from "./lib/mapReportModalShellSupport.jsx";

export default function ConfirmReportModal({
  open,
  onCancel,
  onConfirm,
  reportType,
  setReportType,
  note,
  setNote,
  areaPowerOn,
  setAreaPowerOn,
  hazardYesNo,
  setHazardYesNo,
  saving,
  titleLabel = "Save this report?",
  confirmLabel = "Save light",
}) {
  const normalizedIssueOptions = normalizeDomainIssueOptions(resolveRuntimeDomainIssueOptionsShared("streetlights"));
  const selectableIssueOptions = normalizedIssueOptions.length
    ? normalizedIssueOptions
    : defaultDomainIssueOptions("streetlights");
  const notesRequired = isStreetlightOtherIssue(reportType, selectableIssueOptions);
  const notesMissing = notesRequired && !note.trim();
  const showSafetyNote = isStreetlightDownedPoleIssue(reportType, selectableIssueOptions);
  const powerAnswered = areaPowerOn === "yes" || areaPowerOn === "no";
  const hazardRequired = areaPowerOn === "yes";
  const hazardAnswered = !hazardRequired || hazardYesNo === "yes" || hazardYesNo === "no";

  const canSubmit =
    !saving &&
    !notesMissing &&
    powerAnswered &&
    hazardAnswered &&
    hazardYesNo !== "yes";

  useEffect(() => {
    if (open) {
      setAreaPowerOn("");
      setHazardYesNo("");
    }
  }, [open, setAreaPowerOn, setHazardYesNo]);

  useEffect(() => {
    if (!open) return;
    const nextDefaultValue = defaultDomainIssueValue("streetlights", selectableIssueOptions);
    if (!nextDefaultValue) return;
    const currentValue = String(reportType || "").trim().toLowerCase();
    const validValues = new Set(
      selectableIssueOptions
        .map((option) => String(option?.value || "").trim().toLowerCase())
        .filter(Boolean)
    );
    if (currentValue && validValues.has(currentValue)) return;
    setReportType(nextDefaultValue);
  }, [open, reportType, selectableIssueOptions, setReportType]);

  return (
    <ModalShell open={open} zIndex={9999}>
      <div style={{ fontSize: 16, fontWeight: 900 }}>{titleLabel}</div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Power & Safety</div>

        <div style={{ fontSize: 13, lineHeight: 1.25 }}>
          Is power on in the immediate area of the affected light?{" "}
          <span style={{ color: "#b71c1c", fontWeight: 900 }}>*</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setAreaPowerOn("yes");
              setHazardYesNo("");
            }}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.15)",
              background: areaPowerOn === "yes" ? "#111" : "white",
              color: areaPowerOn === "yes" ? "white" : "#111",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            Yes
          </button>

          <button
            type="button"
            onClick={() => {
              setAreaPowerOn("no");
              setHazardYesNo("");
            }}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.15)",
              background: areaPowerOn === "no" ? "#111" : "white",
              color: areaPowerOn === "no" ? "white" : "#111",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            No
          </button>
        </div>

        {areaPowerOn === "no" && (
          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
            Note: If power is out in the area, this may be part of a larger outage. (Power outage
            reporting will be added later.)
          </div>
        )}

        {areaPowerOn === "yes" && (
          <>
            <div style={{ fontSize: 13, lineHeight: 1.25 }}>
              Does the light present a hazardous situation?{" "}
              <span style={{ color: "#b71c1c", fontWeight: 900 }}>*</span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setHazardYesNo("yes")}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: hazardYesNo === "yes" ? "#111" : "white",
                  color: hazardYesNo === "yes" ? "white" : "#111",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                Yes
              </button>

              <button
                type="button"
                onClick={() => setHazardYesNo("no")}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: hazardYesNo === "no" ? "#111" : "white",
                  color: hazardYesNo === "no" ? "white" : "#111",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                No
              </button>
            </div>

            {hazardYesNo === "yes" && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--sl-ui-alert-danger-border)",
                  background: "var(--sl-ui-alert-danger-bg)",
                  color: "var(--sl-ui-alert-danger-text)",
                  fontWeight: 900,
                  fontSize: 12.5,
                  lineHeight: 1.35,
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ fontSize: 16, lineHeight: 1 }}>⚠️</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 950 }}>Safety warning</div>
                  <div style={{ marginTop: 2 }}>
                    Please stay away from the area and call emergency services if this is an immediate
                    hazard.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!powerAnswered && (
          <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 800 }}>
            Please answer whether power is on in the area.
          </div>
        )}

        {hazardRequired && !hazardAnswered && (
          <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 800 }}>
            Please answer whether this is a hazardous situation.
          </div>
        )}
      </div>

      <label style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13.5, opacity: 0.9, fontWeight: 800, lineHeight: 1.2 }}>
          What are you seeing?
        </div>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          style={{
            padding: 10,
            height: 40,
            boxSizing: "border-box",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
            color: "#111",
            fontSize: 14,
            lineHeight: 1.2,
          }}
          disabled={saving}
        >
          {selectableIssueOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>
          Notes {notesRequired ? "(required)" : "(optional)"}
        </div>

        <input
          placeholder='Anything helpful? (e.g., "flickers at night")'
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          disabled={saving}
        />

        {notesMissing && (
          <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 800 }}>
            Please add a brief note for "Other".
          </div>
        )}
      </label>

      {showSafetyNote && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-alert-danger-border)",
            background: "var(--sl-ui-alert-danger-bg)",
            color: "var(--sl-ui-alert-danger-text)",
            fontWeight: 900,
            fontSize: 12.5,
            lineHeight: 1.35,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: 16, lineHeight: 1 }}>⚠️</div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 950 }}>Safety Notice!</div>
            <div style={{ marginTop: 2 }}>
              If there's immediate danger, contact emergency services.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            fontWeight: 700,
          }}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "none",
            background: "var(--sl-ui-brand-blue)",
            color: "white",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.6,
            fontWeight: 800,
          }}
          disabled={!canSubmit}
        >
          {saving ? "Submitting..." : confirmLabel}
        </button>
      </div>

      <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.4 }}>
        {publicSubmitDisclosureTextShared("streetlights")}
      </div>
    </ModalShell>
  );
}
