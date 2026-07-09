import React, { useMemo, useState } from "react";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";
import { buildDomainMarkerIconPresentationShared } from "./lib/mapDomainMarkerPresentationSupport";

function ModalShell({ open, children, zIndex = 9999, panelStyle }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: "center",
        zIndex,
        padding: 16,
        animation: "sl-modal-overlay-enter 140ms ease-out both",
      }}
    >
      <div
        style={{
          background: "var(--sl-ui-modal-bg)",
          border: "1px solid var(--sl-ui-modal-border)",
          color: "var(--sl-ui-text)",
          fontFamily: "var(--app-header-font-family)",
          padding: 18,
          borderRadius: 10,
          width: "min(360px, 100%)",
          display: "grid",
          gap: 12,
          boxShadow: "var(--sl-ui-modal-shadow)",
          pointerEvents: "auto",
          animation: "sl-modal-panel-enter 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
          ...(panelStyle || {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function AdminIncidentInfoWindowDetails({
  domainId = "",
  stateLabel = "",
  summaryLabel = "State",
  showReportCount = true,
  reportCount = 0,
  issueTypes = "",
  location = "",
  crossStreet = "",
  intersection = "",
  landmark = "",
  coordinates = "",
  onCopyDomainId = null,
  onCopyCoordinates = null,
}) {
  const safeId = String(domainId || "").trim() || "Unavailable";
  const safeState = String(stateLabel || "").trim() || "Reported";
  const safeSummaryLabel = String(summaryLabel || "").trim() || "State";
  const safeCount = Number.isFinite(Number(reportCount)) ? Number(reportCount) : 0;
  const safeIssueTypes = String(issueTypes || "").trim() || "Unavailable";
  const safeCoordinates = String(coordinates || "").trim() || "Unavailable";
  const safeCrossStreet =
    String(crossStreet || "").trim()
    || String(intersection || "").trim()
    || "Unavailable";
  const issueLabel = safeIssueTypes.includes(" • ") ? "Issue Types" : "Issue Type";
  const inlineRowStyle = { fontSize: 13, lineHeight: 1.3, textAlign: "left" };
  const inlineLabelStyle = { fontWeight: 900 };
  const sansSerifUiStack = 'Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        justifyItems: "start",
        textAlign: "left",
        width: "100%",
        fontFamily: sansSerifUiStack,
      }}
    >
      <div style={{ display: "grid", gap: 4, width: "100%" }}>
        {typeof onCopyDomainId === "function" ? (
          <button
            type="button"
            onClick={onCopyDomainId}
            title="Click to copy incident ID"
            style={{
              fontSize: 15,
              lineHeight: 1.2,
              fontWeight: 800,
              textAlign: "left",
              padding: 0,
              border: "none",
              background: "transparent",
              color: "var(--sl-ui-link-text)",
              textDecoration: "underline",
              textUnderlineOffset: 2,
              cursor: "copy",
            }}
          >
            {safeId}
          </button>
        ) : (
          <div style={{ fontSize: 15, lineHeight: 1.2, fontWeight: 800, textAlign: "left" }}>
            {safeId}
          </div>
        )}
        <div style={inlineRowStyle}>
          <span style={inlineLabelStyle}>{safeSummaryLabel}:</span> {safeState}
          {showReportCount ? (
            <>
              {" "}
              <span style={{ opacity: 0.7 }}>•</span> <span style={inlineLabelStyle}>Reports:</span> {safeCount}
            </>
          ) : null}
        </div>
      </div>
      <div style={inlineRowStyle}>
        <span style={inlineLabelStyle}>{issueLabel}:</span> {safeIssueTypes}
      </div>
      <div style={{ display: "grid", gap: 4, width: "100%" }}>
        <div style={inlineRowStyle}>
          <span style={inlineLabelStyle}>Location:</span> {String(location || "").trim() || "Unavailable"}
        </div>
        <div style={inlineRowStyle}>
          <span style={inlineLabelStyle}>Closest cross street:</span> {safeCrossStreet}
        </div>
        <div style={inlineRowStyle}>
          <span style={inlineLabelStyle}>Landmark:</span> {String(landmark || "").trim() || "Unavailable"}
        </div>
        {typeof onCopyCoordinates === "function" ? (
          <button
            type="button"
            onClick={onCopyCoordinates}
            title="Click to copy coordinates"
            style={{
              ...inlineRowStyle,
              width: "100%",
              padding: 0,
              border: "none",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={inlineLabelStyle}>Coordinates:</span>{" "}
            <span
              style={{
                color: "var(--sl-ui-link-text)",
                textDecoration: "underline",
                textUnderlineOffset: 2,
                fontWeight: 800,
              }}
            >
              {safeCoordinates}
            </span>
          </button>
        ) : (
          <div style={inlineRowStyle}>
            <span style={inlineLabelStyle}>Coordinates:</span> {safeCoordinates}
          </div>
        )}
      </div>
    </div>
  );
}

export function InfoMenuModal({
  open,
  onClose,
  isAdmin,
  onOpenTerms,
  onOpenPrivacy,
  showCitySwitcher = false,
  currentCityLabel = "",
  currentTenantKey = "",
  followedTenantKeys = [],
  onOpenCitySwitcher,
  signedIn = false,
  onToggleFollowCity,
  environmentGuardrailLabel = "",
  appVersion = "",
  streetlightIconSrc = "",
  streetlightMarkerColor = "#234a72",
  streetlightHighConfidenceColor = "#234a72",
  mapMarkerSize = 24,
  mapMarkerStroke = 2,
  mapMarkerGlyphSize = 15,
  incidentDomainIconSize = 28,
}) {
  if (!open) return null;
  const [followCitySaving, setFollowCitySaving] = useState(false);
  const currentCityFollowed = useMemo(() => {
    const activeTenantKey = String(currentTenantKey || "").trim().toLowerCase();
    if (!activeTenantKey) return false;
    return (Array.isArray(followedTenantKeys) ? followedTenantKeys : [])
      .some((key) => String(key || "").trim().toLowerCase() === activeTenantKey);
  }, [currentTenantKey, followedTenantKeys]);
  const legendMarkerSlotStyle = {
    width: mapMarkerSize + 10,
    minWidth: mapMarkerSize + 10,
    display: "grid",
    placeItems: "center",
  };
  const primaryButtonStyle = {
    padding: 10,
    width: "100%",
    borderRadius: 10,
    border: "none",
    background: "var(--sl-ui-brand-blue)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };

  const markerSwatch = (
    fill,
    {
      ring = "#fff",
      glyph = "💡",
      glyphSrc = "",
      glyphColor = "#111",
      showGlyph = true,
      domainKey = "",
      highConfidence = false,
    } = {}
  ) => (
    <span
      style={{
        width: mapMarkerSize,
        height: mapMarkerSize,
        borderRadius: 999,
        background: fill,
        border: `${mapMarkerStroke}px solid ${ring}`,
        display: "grid",
        placeItems: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        fontSize: showGlyph ? mapMarkerGlyphSize : 0,
        lineHeight: 1,
        color: glyphColor,
      }}
      aria-hidden="true"
    >
      {showGlyph ? (() => {
        if (!glyphSrc || !AppIcon) return glyph;
        const presentation = buildDomainMarkerIconPresentationShared(domainKey, fill, glyphSrc, { highConfidence });
        return (
          <span
            style={{
              width: mapMarkerGlyphSize,
              height: mapMarkerGlyphSize,
              display: "grid",
              placeItems: "center",
              lineHeight: 1,
            }}
          >
            <AppIcon
              src={glyphSrc}
              size={mapMarkerGlyphSize}
              renderMode={presentation?.renderMode}
              style={presentation?.glyphColor ? { color: presentation.glyphColor } : {}}
            />
          </span>
        );
      })() : ""}
    </span>
  );

  const currentLocationSwatch = (
    <span
      aria-hidden="true"
      style={{
        width: 34,
        height: 34,
        display: "grid",
        placeItems: "center",
        filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.24))",
      }}
    >
      {AppIcon ? (
        <AppIcon
          src={uiIconSrc.currentLocationMarker}
          iconKey="currentLocationMarker"
          size={24}
        />
      ) : null}
    </span>
  );

  const legendSections = [
    {
      title: "Streetlights (Utility-owned)",
      rows: [
        {
          swatch: markerSwatch(streetlightMarkerColor, {
            glyphSrc: streetlightIconSrc,
            domainKey: "streetlights",
          }),
          label: "Operational streetlight or issue below public threshold",
        },
        {
          swatch: markerSwatch(streetlightMarkerColor, {
            glyphSrc: streetlightIconSrc,
            domainKey: "streetlights",
            ring: "#2ecc71",
          }),
          label: "Green ring means saved in My Reports",
        },
        {
          swatch: markerSwatch(streetlightMarkerColor, {
            glyphSrc: streetlightIconSrc,
            domainKey: "streetlights",
            ring: "#1976d2",
          }),
          label: "Blue ring means you marked it reported to utility",
        },
        {
          swatch: markerSwatch(streetlightHighConfidenceColor, {
            glyphSrc: streetlightIconSrc,
            domainKey: "streetlights",
            highConfidence: true,
          }),
          label: "High-confidence outage",
        },
        {
          swatch: markerSwatch("#1976d2", {
            glyphSrc: streetlightIconSrc,
            domainKey: "streetlights",
          }),
          label: "Selected light in bulk save mode",
        },
      ],
    },
    {
      title: "Map Helpers",
      rows: [
        {
          swatch: markerSwatch("#fff", { showGlyph: false, ring: "#1e88e5" }),
          label: "Blue ring means you reported this incident",
        },
        { swatch: currentLocationSwatch, label: "Your current location" },
      ],
    },
  ];

  const adminLegendRows = [
    {
      swatch: markerSwatch("#2ecc71", { glyphSrc: uiIconSrc.streetlight }),
      label: "Queued mapped asset",
    },
  ];

  const primaryToolRows = [
    { iconSrc: uiIconSrc.account, iconKey: "account", label: "Account", desc: "Open login/account controls and sign-out actions." },
    { iconSrc: uiIconSrc.satellite, iconKey: "satellite", label: "Map View", desc: "Toggle street map and satellite imagery." },
    { iconSrc: uiIconSrc.headingReset, iconKey: "headingReset", label: "Reset Heading", desc: "Realign map orientation to north-up." },
    { iconSrc: uiIconSrc.location, iconKey: "location", label: "My Location", desc: "Center map on your current device location." },
    { iconSrc: uiIconSrc.homeRecenter, iconKey: "homeRecenter", label: "Home", desc: "Recenter the map over the active city boundary." },
    { iconSrc: uiIconSrc.notifications, iconKey: "notifications", label: "Notifications", desc: "Open the cross-tenant notifications inbox for followed locations." },
    { iconSrc: uiIconSrc.notification, iconKey: "notification", label: "Alerts", desc: "Open published location alerts from the hub." },
    { iconSrc: uiIconSrc.calendar, iconKey: "calendar", label: "Events", desc: "Open published location events from the hub." },
    { iconSrc: uiIconSrc.openReports, iconKey: "openReports", label: "My Reports", desc: "Open your saved report history and follow-up tools." },
    { iconSrc: uiIconSrc.incidentReportingLayer, iconKey: "incidentReportingLayer", label: "Layers", desc: "Choose which reportable domains are visible on the map." },
    { iconSrc: uiIconSrc.bulk, iconKey: "bulk", label: "Bulk Save (Streetlights)", desc: "Select and save multiple streetlights to My Reports." },
  ];

  const adminToolRows = [
    { iconSrc: uiIconSrc.toolbox, iconKey: "toolbox", label: "Admin Tools", desc: "Open admin action menu." },
    { iconSrc: uiIconSrc.openReports, iconKey: "openReports", label: "Reports", desc: "Open admin reports modal for triage and exports." },
    { iconSrc: uiIconSrc.mapping, iconKey: "mapping", label: "Mapping", desc: "Enable mapping mode for administrative asset placement." },
  ];

  return (
    <ModalShell
      open={open}
      zIndex={10060}
      panelStyle={{ width: "min(760px, calc(100vw - 24px))", maxHeight: "80vh", overflow: "auto" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.1 }}>Info</div>
          <div style={{ fontSize: 11.5, opacity: 0.72, lineHeight: 1.15 }}>Version {appVersion}</div>
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
          }}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35, marginTop: 4 }}>
        Learn what map icons and controls mean.
      </div>

      {!!environmentGuardrailLabel && (
        <div
          style={{
            border: "1px solid rgba(210, 96, 25, 0.24)",
            borderRadius: 10,
            padding: 10,
            display: "grid",
            gap: 6,
            background: "rgba(210, 96, 25, 0.08)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900 }}>Testing Context</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, opacity: 0.92 }}>
            Active build context: <b>{environmentGuardrailLabel}</b>
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.35, opacity: 0.86 }}>
            Confirm the active city before submitting reports or creating test data.
          </div>
        </div>
      )}

      {showCitySwitcher && typeof onOpenCitySwitcher === "function" && (
        <div
          style={{
            border: "1px solid var(--sl-ui-modal-border)",
            borderRadius: 10,
            padding: 10,
            display: "grid",
            gap: 10,
            background: "var(--sl-ui-modal-subtle-bg)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900 }}>City</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.4, opacity: 0.92 }}>
            Shared public app builds can follow cities without reinstalling or changing env settings.
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.35 }}>
            <b>Current city:</b> {String(currentCityLabel || "Unknown city").trim() || "Unknown city"}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <button
              onClick={async () => {
                if (typeof onToggleFollowCity !== "function" || followCitySaving) return;
                setFollowCitySaving(true);
                try {
                  await onToggleFollowCity();
                } finally {
                  setFollowCitySaving(false);
                }
              }}
              disabled={followCitySaving || typeof onToggleFollowCity !== "function"}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: currentCityFollowed
                  ? "1px solid rgba(28, 128, 98, 0.42)"
                  : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: currentCityFollowed ? "rgba(28, 128, 98, 0.16)" : "var(--sl-ui-modal-btn-secondary-bg)",
                color: currentCityFollowed ? "var(--sl-ui-text)" : "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: followCitySaving ? "wait" : "pointer",
                opacity: followCitySaving ? 0.74 : 1,
              }}
            >
              {followCitySaving ? "Saving…" : currentCityFollowed ? "Following" : "Follow this City"}
            </button>
            <div style={{ fontSize: 11.5, lineHeight: 1.3, opacity: 0.76 }}>
              {signedIn
                ? currentCityFollowed
                  ? "This city appears in your switch-city list. Tap Following to remove it."
                  : "Follow this city to keep it in your switch-city list."
                : "Sign in or create an account to save followed cities."}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900 }}>Map Legend</div>
        {legendSections.map((section) => (
          <div key={section.title} style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, opacity: 0.92 }}>{section.title}</div>
            {section.rows.map((row) => (
              <div key={`${section.title}-${row.label}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <span style={legendMarkerSlotStyle}>{row.swatch}</span>
                <span>{row.label}</span>
              </div>
            ))}
          </div>
        ))}

        {isAdmin && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ height: 1, background: "var(--sl-ui-modal-border)", opacity: 0.65, margin: "2px 0" }} />
            <div style={{ fontSize: 12.5, fontWeight: 900, opacity: 0.92 }}>Admin markers</div>
            {adminLegendRows.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <span style={legendMarkerSlotStyle}>{row.swatch}</span>
                <span>{row.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900 }}>Tool Buttons</div>
        <div style={{ display: "grid", gap: 6 }}>
          {primaryToolRows.map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ width: 34, height: 34, display: "grid", placeItems: "center" }}>
                {AppIcon ? <AppIcon src={row.iconSrc} iconKey={row.iconKey} size={28} /> : null}
              </span>
              <span><b>{row.label}:</b> {row.desc}</span>
            </div>
          ))}
        </div>
        {isAdmin && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ height: 1, background: "var(--sl-ui-modal-border)", opacity: 0.65, margin: "2px 0" }} />
            <div style={{ fontSize: 12.5, fontWeight: 900, opacity: 0.92 }}>Admin tools</div>
            {adminToolRows.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 34, height: 34, display: "grid", placeItems: "center" }}>
                  {AppIcon ? <AppIcon src={row.iconSrc} iconKey={row.iconKey} size={28} /> : null}
                </span>
                <span><b>{row.label}:</b> {row.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900 }}>Terms of Service</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.4, opacity: 0.92 }}>
          CityReport.io is an intermediary intake and accountability platform for non-emergency infrastructure reporting.
          Use of the platform is governed by the official Terms of Service document.
        </div>
        <button
          onClick={onOpenTerms}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          View Terms of Service
        </button>
      </div>

      <div
        style={{
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900 }}>Privacy Notice</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.4, opacity: 0.92 }}>
          CityReport.io collects, uses, shares, and retains report and contact data as described in the official
          Privacy Notice document.
        </div>
        <button
          onClick={onOpenPrivacy}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          View Privacy Notice
        </button>
      </div>

      <button onClick={onClose} style={primaryButtonStyle}>Close</button>
    </ModalShell>
  );
}
