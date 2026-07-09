import React, { useEffect } from "react";
import { domainDisclosureAckKey } from "./lib/mapIncidentDisclosureSupport.js";
import {
  defaultDomainTypeOptionLabel,
  normalizeDomainIssueOptions,
  normalizeDomainTypeOptionConfigs,
} from "./lib/mapDomainConfigSupport";
import { getIssueTypeOptionConfig } from "./lib/mapDomainTypeOptionSupport.js";
import { getIncidentDomainHelperShared } from "./lib/mapIncidentDomainConfig.js";
import {
  resolveRuntimeDomainAllowReportImagesShared,
  resolveRuntimeDomainDisclosuresShared,
  resolveRuntimeDomainIssueOptionsShared,
  resolveRuntimeDomainTypeOptionConfigsShared,
} from "./lib/mapRuntimeDomainReportConfigSupport.js";
import { ModalShell } from "./lib/mapReportModalShellSupport.jsx";

export function DomainDisclosureGateModal({
  open,
  domain,
  domainLabel,
  acknowledgements = {},
  setAcknowledgements,
  onCancel,
  onContinue,
}) {
  if (!open) return null;

  const disclosures = resolveRuntimeDomainDisclosuresShared(domain, { position: "before_form" });
  const requiredDisclosures = disclosures.filter((row) => row?.required_acknowledgement === true);
  const canContinue = requiredDisclosures.every((row, index) => Boolean(acknowledgements?.[domainDisclosureAckKey(row, index)]));
  const disclosureCancelButtonStyle = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: "var(--sl-ui-modal-btn-secondary-bg)",
    color: "var(--sl-ui-modal-btn-secondary-text)",
    fontWeight: 900,
    cursor: "pointer",
    width: "100%",
  };
  const disclosureContinueButtonStyle = {
    padding: 10,
    borderRadius: 10,
    border: "none",
    background: "var(--sl-ui-brand-blue)",
    color: "white",
    fontWeight: 900,
    cursor: canContinue ? "pointer" : "not-allowed",
    width: "100%",
    opacity: canContinue ? 1 : 0.6,
  };

  return (
    <ModalShell open={open} zIndex={10011}>
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 900 }}>Before you report {domainLabel}</div>
          <div style={{ fontSize: 12.5, opacity: 0.84, lineHeight: 1.45 }}>
            Please review the following disclosure{disclosures.length === 1 ? "" : "s"} before continuing.
          </div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {disclosures.map((disclosure, index) => {
            const ackKey = domainDisclosureAckKey(disclosure, index);
            return (
              <div
                key={ackKey}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--sl-ui-modal-border)",
                  background: "var(--sl-ui-modal-input-bg)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 900 }}>{disclosure.title || "Disclosure"}</div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: disclosure.required_acknowledgement ? "rgba(209,67,67,0.12)" : "rgba(18,128,106,0.12)",
                      color: disclosure.required_acknowledgement ? "#b71c1c" : "#127f6a",
                    }}
                  >
                    {disclosure.required_acknowledgement ? "Required acknowledgement" : "Informational"}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.92 }}>
                  {disclosure.body}
                </div>
                {disclosure.required_acknowledgement ? (
                  <label
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                      cursor: "pointer",
                      fontSize: 12.5,
                      lineHeight: 1.45,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(acknowledgements?.[ackKey])}
                      onChange={(e) => setAcknowledgements((prev) => ({
                        ...(prev || {}),
                        [ackKey]: e.target.checked,
                      }))}
                      style={{ marginTop: 2 }}
                    />
                    <span>I have read and agree to this disclosure.</span>
                  </label>
                ) : null}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={disclosureCancelButtonStyle}>
            Cancel
          </button>
          <button
            onClick={onContinue}
            disabled={!canContinue}
            style={disclosureContinueButtonStyle}
          >
            Continue
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export function DomainReportModal({
  open,
  domain,
  domainLabel,
  locationLabel,
  note,
  setNote,
  issueValue,
  setIssueValue,
  typeSelections = {},
  setTypeSelections,
  acknowledgements = {},
  setAcknowledgements,
  imageFile,
  imagePreviewUrl,
  setImageFile,
  saving,
  onCancel,
  onSubmit,
  btnPrimary = {},
  btnSecondary = {},
}) {
  if (!open) return null;

  const issueOptions = resolveRuntimeDomainIssueOptionsShared(domain);
  const typeOptionConfigs = resolveRuntimeDomainTypeOptionConfigsShared(domain);
  const disclosures = resolveRuntimeDomainDisclosuresShared(domain);
  const imageUploadEnabled = resolveRuntimeDomainAllowReportImagesShared(domain);
  const insideFormDisclosures = disclosures.filter((row) => row?.display_position !== "before_form");
  const requiredInsideFormDisclosures = insideFormDisclosures.filter((row) => row?.required_acknowledgement === true);
  const resolvedIssueOptions = normalizeDomainIssueOptions(issueOptions);
  const resolvedTypeOptionConfigs = normalizeDomainTypeOptionConfigs(typeOptionConfigs, domain);
  const issueTypeOptionKey = String(getIssueTypeOptionConfig(domain, resolvedTypeOptionConfigs, resolvedIssueOptions)?.optionKey || "").trim();
  const visibleTypeOptionConfigs = resolvedTypeOptionConfigs.filter((cfg) => String(cfg?.optionKey || "").trim() !== issueTypeOptionKey);
  const requiresIssueSelection = resolvedIssueOptions.length > 0;
  const requiresTypeSelection = visibleTypeOptionConfigs.length > 0;
  const supportsImageAttachment = Boolean(imageUploadEnabled);
  const issueValid = !requiresIssueSelection
    ? true
    : Boolean(String(issueValue || "").trim());
  const typeValid = !requiresTypeSelection || visibleTypeOptionConfigs.every((cfg) => (
    Boolean(String(typeSelections?.[cfg.optionKey] || "").trim())
  ));
  const disclosuresValid = requiredInsideFormDisclosures.every((row, index) => (
    Boolean(acknowledgements?.[domainDisclosureAckKey(row, index)])
  ));
  const canSubmit = !saving && disclosuresValid;
  const canSubmitFinal = canSubmit && issueValid && typeValid;
  const notesPlaceholder = String(getIncidentDomainHelperShared(domain).notesPlaceholder || "").trim()
    || (
      requiredInsideFormDisclosures.length
        ? "Add details (size, lane, nearby landmark)"
        : "Add details (what you observed)"
    );

  return (
    <ModalShell
      open={open}
      zIndex={10012}
      panelStyle={{
        width: "min(420px, 100%)",
        maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)",
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div style={{ padding: "16px 16px 12px", display: "grid", gap: 6, borderBottom: "1px solid var(--sl-ui-modal-border)" }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Report {domainLabel}</div>
        <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.35 }}>
          <b>Location:</b> {locationLabel || "Map location"}
        </div>
      </div>

      <div style={{ padding: 16, overflow: "auto", display: "grid", gap: 12, minHeight: 0 }}>
        {requiresIssueSelection && (
          <label style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13.5, opacity: 0.9, fontWeight: 800, lineHeight: 1.2 }}>
              What issue are you seeing?
            </div>
            <select
              value={issueValue}
              onChange={(e) => setIssueValue(e.target.value)}
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
              {resolvedIssueOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {requiresTypeSelection ? visibleTypeOptionConfigs.map((cfg, index) => (
          <label key={cfg.id || cfg.optionKey || `type-option-${index}`} style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13.5, opacity: 0.9, fontWeight: 800, lineHeight: 1.2 }}>
              {String(cfg.optionLabel || defaultDomainTypeOptionLabel(domain, index)).trim()}
            </div>
            <select
              value={String(typeSelections?.[cfg.optionKey] || "").trim()}
              onChange={(e) => setTypeSelections((prev) => ({
                ...(prev || {}),
                [cfg.optionKey]: String(e.target.value || "").trim().toLowerCase(),
              }))}
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
              {cfg.choices.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )) : null}

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Notes (optional)</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={notesPlaceholder}
            style={{
              minHeight: 90,
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

        {supportsImageAttachment && (
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Photo (optional)</div>
            <input
              type="file"
              accept="image/*"
              disabled={saving}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setImageFile(f);
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
            {imageFile && (
              <div style={{ display: "grid", gap: 6 }}>
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="Report attachment preview"
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
                  onClick={() => setImageFile(null)}
                  disabled={saving}
                  style={btnSecondary}
                >
                  Remove image
                </button>
              </div>
            )}
          </label>
        )}

        {insideFormDisclosures.length ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-border)",
              background: "var(--sl-ui-modal-input-bg)",
              display: "grid",
              gap: 10,
              fontSize: 11.8,
              lineHeight: 1.45,
              opacity: 0.9,
            }}
          >
            {insideFormDisclosures.map((disclosure, index) => {
              const ackKey = domainDisclosureAckKey(disclosure, index);
              return (
                <div key={ackKey} style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 900 }}>{disclosure.title || "Disclosure"}</span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: disclosure.required_acknowledgement ? "rgba(209,67,67,0.12)" : "rgba(18,128,106,0.12)",
                        color: disclosure.required_acknowledgement ? "#b71c1c" : "#127f6a",
                      }}
                    >
                      {disclosure.required_acknowledgement ? "Required acknowledgement" : "Informational"}
                    </span>
                  </div>
                  <div>{disclosure.body}</div>
                  {disclosure.required_acknowledgement ? (
                    <label
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        cursor: saving ? "default" : "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(acknowledgements?.[ackKey])}
                        onChange={(e) => setAcknowledgements((prev) => ({
                          ...(prev || {}),
                          [ackKey]: e.target.checked,
                        }))}
                        disabled={saving}
                        style={{ marginTop: 2 }}
                      />
                      <span>I have read and agree to this disclosure.</span>
                    </label>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div style={{ padding: 16, borderTop: "1px solid var(--sl-ui-modal-border)", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} disabled={saving} style={btnSecondary}>Cancel</button>
          <button onClick={onSubmit} disabled={!canSubmitFinal} style={{ ...btnPrimary, opacity: canSubmitFinal ? 1 : 0.6 }}>
            {saving ? "Submitting..." : "Report"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
