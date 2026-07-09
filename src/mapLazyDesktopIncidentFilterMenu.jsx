import React, { memo } from "react";
import { DomainSelectorListIcon } from "./mapDomainIconComponentsSupport.jsx";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";

export default memo(function MapLazyDesktopIncidentFilterMenu({
  domainMenuPanelRef,
  prefersDarkMode,
  allIncidentReportsOptionEnabled,
  hasExplicitIncidentMapFilter,
  resetIncidentMapFilter,
  incidentLayerDomainOptions,
  activeIncidentMapFilterKeys,
  toggleIncidentMapDomainFilter,
}) {
  return (
    <div
      ref={domainMenuPanelRef}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        right: "calc(100% + 10px)",
        top: "50%",
        transform: "translateY(-50%)",
        background: "var(--sl-ui-modal-bg)",
        border: "1px solid var(--sl-ui-modal-border)",
        borderRadius: 12,
        boxShadow: "var(--sl-ui-modal-shadow)",
        padding: 8,
        display: "grid",
        gap: 6,
        zIndex: 3,
        minWidth: 170,
      }}
    >
      {allIncidentReportsOptionEnabled ? (
        <button
          type="button"
          onClick={() => {
            resetIncidentMapFilter();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 9px",
            borderRadius: 8,
            border: !hasExplicitIncidentMapFilter
              ? "1px solid var(--sl-ui-tool-active-border)"
              : "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: !hasExplicitIncidentMapFilter
              ? "var(--sl-ui-tool-active-bg)"
              : "var(--sl-ui-surface-bg)",
            color: !hasExplicitIncidentMapFilter
              ? "var(--sl-ui-tool-active-text)"
              : "var(--sl-ui-text)",
            fontWeight: !hasExplicitIncidentMapFilter ? 900 : 700,
            cursor: "pointer",
            justifyContent: "flex-start",
          }}
        >
          <AppIcon src={uiIconSrc.allIncidentReports} iconKey="allIncidentReports" darkMode={prefersDarkMode} active={!hasExplicitIncidentMapFilter} size={18} />
          <span style={{ fontSize: 11.5 }}>All incident reports</span>
        </button>
      ) : null}
      {incidentLayerDomainOptions.map((option) => {
        const isSelected = !hasExplicitIncidentMapFilter || activeIncidentMapFilterKeys.includes(option.key);
        return (
          <button
            key={`web-incident-domain-${option.key}`}
            type="button"
            onClick={() => {
              toggleIncidentMapDomainFilter(option.key, option.label);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 9px",
              borderRadius: 8,
              border: isSelected
                ? "1px solid var(--sl-ui-tool-active-border)"
                : "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: isSelected
                ? "var(--sl-ui-tool-active-bg)"
                : "var(--sl-ui-surface-bg)",
              color: isSelected
                ? "var(--sl-ui-tool-active-text)"
                : "var(--sl-ui-text)",
              fontWeight: isSelected ? 900 : 700,
              cursor: "pointer",
              justifyContent: "flex-start",
            }}
          >
            <DomainSelectorListIcon
              domainKey={option.key}
              src={option.iconSrc || uiIconSrc.incidentReportingLayer}
              size={18}
            />
            <span style={{ fontSize: 11.5 }}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
});
