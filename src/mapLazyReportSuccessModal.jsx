import React from "react";
import { formatTs } from "./lib/mapTimestampFormatSupport.js";
import { ModalShell, publicSuccessDisclaimerText } from "./lib/mapReportModalShellSupport.jsx";

export default function ReportSuccessModal({
  open,
  kind = "incident",
  title = "Report saved",
  message = "",
  reportNumbers = [],
  submittedAt = 0,
  onClose,
  onViewReports,
  onReportToUtility,
}) {
  const isStreetlight = kind === "streetlight";
  const numbers = Array.isArray(reportNumbers)
    ? reportNumbers.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const primaryNumber = numbers[0] || "";
  const submittedLabel = formatTs(submittedAt);
  const successDisclaimer = publicSuccessDisclaimerText(numbers.length || 1);

  return (
    <ModalShell open={open} zIndex={10043}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 24, lineHeight: 1 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 950, lineHeight: 1.1 }}>{title}</div>
          {message ? (
            <div style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.9 }}>
              {message}
            </div>
          ) : null}
          {!!primaryNumber && (
            <div style={{ marginTop: 4, display: "grid", gap: 2 }}>
              <div style={{ fontSize: 12, opacity: 0.78, fontWeight: 900 }}>
                {numbers.length > 1 ? "Report numbers" : "Report number"}
              </div>
              <div style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.25 }}>
                {numbers.length > 1 ? numbers.slice(0, 3).join(", ") : primaryNumber}
              </div>
              {numbers.length > 3 ? (
                <div style={{ fontSize: 11.5, opacity: 0.72 }}>
                  +{numbers.length - 3} more in Reports
                </div>
              ) : null}
            </div>
          )}
          {!!submittedLabel && (
            <div style={{ fontSize: 12, lineHeight: 1.35, opacity: 0.82 }}>
              <b>Submitted:</b> {submittedLabel}
            </div>
          )}
          <div
            style={{
              marginTop: 4,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-border)",
              background: "var(--sl-ui-modal-input-bg)",
              fontSize: 12,
              lineHeight: 1.4,
              opacity: 0.92,
            }}
          >
            {successDisclaimer}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {isStreetlight ? (
            <>
              <button
                type="button"
                onClick={onReportToUtility}
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
                Report to Utility
              </button>
              <button
                type="button"
                onClick={onClose}
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
                OK
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onViewReports}
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
                View Reports
              </button>
              <button
                type="button"
                onClick={onClose}
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
                OK
              </button>
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
