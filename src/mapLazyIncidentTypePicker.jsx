import React from "react";
import { DomainSelectorListIcon } from "./mapDomainIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";

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

export function IncidentTypePickerModal({
  open,
  onClose,
  options = [],
  onSelectOption,
  btnSecondary,
}) {
  if (!open) return null;

  const incidentOptions = Array.isArray(options)
    ? options
        .map((option) => {
          const key = String(option?.key || "").trim();
          if (!key) return null;
          return {
            key,
            label: String(option?.label || key).trim() || key,
            iconSrc: String(option?.iconSrc || "").trim(),
          };
        })
        .filter(Boolean)
    : [];

  return (
    <ModalShell
      open={open}
      zIndex={10011}
      panelStyle={{
        width: "min(420px, 100%)",
        maxWidth: "100%",
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.1 }}>What would you like to report?</div>
          <div style={{ fontSize: 13, opacity: 0.82, lineHeight: 1.4 }}>
            Choose the type of issue for this location.
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {incidentOptions.map((option) => (
            <button
              key={`incident-type-option-${option.key}`}
              type="button"
              onClick={() => onSelectOption?.(option.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "14px 16px",
                borderRadius: 16,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-surface-bg)",
                color: "var(--sl-ui-text)",
                fontWeight: 900,
                cursor: "pointer",
                justifyContent: "flex-start",
              }}
            >
              <DomainSelectorListIcon
                domainKey={option.key}
                src={option.iconSrc || uiIconSrc.incidentReportingLayer}
                size={24}
                containerSize={28}
              />
              <span style={{ fontSize: 16 }}>{option.label}</span>
            </button>
          ))}
        </div>

        <button type="button" onClick={onClose} style={btnSecondary}>
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
