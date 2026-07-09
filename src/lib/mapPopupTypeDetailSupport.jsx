import React from "react";

export function ReportTypeOptionDetails({ details = [], textStyle = {} }) {
  if (!Array.isArray(details) || !details.length) return null;
  return (
    <div style={{ display: "grid", gap: 0, ...textStyle }}>
      {details.map((detail) => (
        <div key={detail.key || detail.label}>
          <b>{detail.label}:</b> {detail.valueLabel}
        </div>
      ))}
    </div>
  );
}

export function summarizeIssueTypes(details = [], fallbackLabel = "") {
  if (Array.isArray(details) && details.length) {
    const values = details
      .map((detail) => String(detail?.valueLabel || "").trim())
      .filter(Boolean);
    if (values.length) return values.join(" • ");
  }
  const fallback = String(fallbackLabel || "").trim();
  return fallback || "Unavailable";
}
