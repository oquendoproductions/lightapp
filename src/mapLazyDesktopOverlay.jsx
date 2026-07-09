import React, { memo, useCallback } from "react";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";

const DesktopMapToolRail = memo(function DesktopMapToolRail({
  nudgeMapZoom,
  showMapNotificationsIcon,
  showMapAlertIcon,
  showMapEventIcon,
  viewerIdentityKey,
  hasMapSession,
  notificationsWindowOpen,
  alertsWindowOpen,
  eventsWindowOpen,
  residentNotificationsUnreadCount,
  mapAlertsUnreadCount,
  mapEventsUnreadCount,
  setAdminDomainMenuOpen,
  setAdminToolboxOpen,
  setNotificationsWindowOpen,
  setEventsWindowOpen,
  setAlertsWindowOpen,
  setAccountMenuOpen,
  prefersDarkMode,
}) {
  return (
    <div style={{ display: "grid", gap: 8, pointerEvents: "auto" }}>
      <button
        type="button"
        onClick={() => nudgeMapZoom(1)}
        aria-label="Zoom in"
        title="Zoom in"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--sl-ui-zoom-border)",
          background: "var(--sl-ui-zoom-bg)",
          boxShadow: "var(--sl-ui-zoom-shadow)",
          color: "var(--sl-ui-text)",
          fontSize: 22,
          fontWeight: 900,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        +
      </button>
      <button
        type="button"
        onClick={() => nudgeMapZoom(-1)}
        aria-label="Zoom out"
        title="Zoom out"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: "1px solid var(--sl-ui-zoom-border)",
          background: "var(--sl-ui-zoom-bg)",
          boxShadow: "var(--sl-ui-zoom-shadow)",
          color: "var(--sl-ui-text)",
          fontSize: 22,
          fontWeight: 900,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        –
      </button>
      {showMapNotificationsIcon ? (
        <button
          type="button"
          onClick={() => {
            setAdminDomainMenuOpen(false);
            setAdminToolboxOpen(false);
            if (!viewerIdentityKey && !hasMapSession) {
              setNotificationsWindowOpen(false);
              setAccountMenuOpen(true);
              return;
            }
            setNotificationsWindowOpen((prev) => !prev);
            setEventsWindowOpen(false);
            setAlertsWindowOpen(false);
          }}
          aria-label="Open notifications"
          title="Open notifications"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: notificationsWindowOpen
              ? "1px solid var(--sl-ui-tool-active-border)"
              : "1px solid var(--sl-ui-zoom-border)",
            background: notificationsWindowOpen
              ? "var(--sl-ui-tool-active-bg)"
              : "var(--sl-ui-zoom-bg)",
            boxShadow: "var(--sl-ui-zoom-shadow)",
            color: notificationsWindowOpen
              ? "var(--sl-ui-tool-active-text)"
              : "var(--sl-ui-text)",
            cursor: "pointer",
            lineHeight: 1,
            position: "relative",
            display: "grid",
            placeItems: "center",
          }}
        >
          <AppIcon src={uiIconSrc.notifications} iconKey="notifications" darkMode={prefersDarkMode} active={notificationsWindowOpen} size={22} />
          {residentNotificationsUnreadCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: "#c62828",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.88)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10.5,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {residentNotificationsUnreadCount > 99 ? "99+" : residentNotificationsUnreadCount}
            </span>
          ) : null}
        </button>
      ) : null}
      {showMapAlertIcon ? (
        <button
          type="button"
          onClick={() => {
            setAdminDomainMenuOpen(false);
            setAdminToolboxOpen(false);
            setNotificationsWindowOpen(false);
            setEventsWindowOpen(false);
            setAlertsWindowOpen((prev) => !prev);
          }}
          aria-label="Open alerts"
          title="Open alerts"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: alertsWindowOpen
              ? "1px solid var(--sl-ui-tool-active-border)"
              : "1px solid var(--sl-ui-zoom-border)",
            background: alertsWindowOpen
              ? "var(--sl-ui-tool-active-bg)"
              : "var(--sl-ui-zoom-bg)",
            boxShadow: "var(--sl-ui-zoom-shadow)",
            color: alertsWindowOpen
              ? "var(--sl-ui-tool-active-text)"
              : "var(--sl-ui-text)",
            cursor: "pointer",
            lineHeight: 1,
            position: "relative",
            display: "grid",
            placeItems: "center",
          }}
        >
          <AppIcon src={uiIconSrc.notification} iconKey="notification" darkMode={prefersDarkMode} active={alertsWindowOpen} size={22} />
          {mapAlertsUnreadCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: "#c62828",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.88)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10.5,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {mapAlertsUnreadCount > 99 ? "99+" : mapAlertsUnreadCount}
            </span>
          ) : null}
        </button>
      ) : null}
      {showMapEventIcon ? (
        <button
          type="button"
          onClick={() => {
            setAdminDomainMenuOpen(false);
            setAdminToolboxOpen(false);
            setNotificationsWindowOpen(false);
            setAlertsWindowOpen(false);
            setEventsWindowOpen((prev) => !prev);
          }}
          aria-label="Open events"
          title="Open events"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            border: eventsWindowOpen
              ? "1px solid var(--sl-ui-tool-active-border)"
              : "1px solid var(--sl-ui-zoom-border)",
            background: eventsWindowOpen
              ? "var(--sl-ui-tool-active-bg)"
              : "var(--sl-ui-zoom-bg)",
            boxShadow: "var(--sl-ui-zoom-shadow)",
            color: eventsWindowOpen
              ? "var(--sl-ui-tool-active-text)"
              : "var(--sl-ui-text)",
            cursor: "pointer",
            lineHeight: 1,
            position: "relative",
            display: "grid",
            placeItems: "center",
          }}
        >
          <AppIcon src={uiIconSrc.calendar} iconKey="calendar" darkMode={prefersDarkMode} active={eventsWindowOpen} size={22} />
          {mapEventsUnreadCount > 0 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: 999,
                background: "#176d78",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.88)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10.5,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {mapEventsUnreadCount > 99 ? "99+" : mapEventsUnreadCount}
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
});

const DesktopMapStatusChips = memo(function DesktopMapStatusChips({
  isAggregatedReportingDomain,
  canOpenDomainReports,
  canOpenAdminReports,
  openMyReports,
  openOpenReports,
  openReportsInViewLabel,
  openReportsInViewCount,
  inViewCounterColor,
  inViewCounterBorder,
  inViewCounterBg,
  isStreetlightsLayerActive,
  isSavedStreetlightFilterOn,
  isUtilityStreetlightFilterOn,
  streetlightPersonalInViewStats,
  toggleStreetlightInViewFilter,
  isAdmin,
  openAbuseFlagSummary,
  setModerationFlagsOpen,
}) {
  const openInViewReports = useCallback(() => {
    if (!canOpenDomainReports) return;
    if (canOpenAdminReports) {
      openMyReports({ reportedByMode: "all", inViewOnly: true });
      return;
    }
    openOpenReports({ inViewOnly: true });
  }, [canOpenAdminReports, canOpenDomainReports, openMyReports, openOpenReports]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        flexWrap: "wrap",
        gap: 8,
        minWidth: 0,
        pointerEvents: "auto",
      }}
    >
      {isAggregatedReportingDomain && (
        <div
          onClick={canOpenDomainReports ? openInViewReports : undefined}
          role={canOpenDomainReports ? "button" : undefined}
          tabIndex={canOpenDomainReports ? 0 : -1}
          onKeyDown={(event) => {
            if (!canOpenDomainReports) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openInViewReports();
            }
          }}
          style={{
            width: "fit-content",
            maxWidth: "min(720px, calc(100vw - 180px))",
            fontSize: 11.5,
            opacity: 1,
            textAlign: "left",
            color: inViewCounterColor,
            padding: "4px 8px",
            borderRadius: 999,
            border: `1px solid ${inViewCounterBorder}`,
            background: inViewCounterBg,
            boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            cursor: canOpenDomainReports ? "pointer" : "default",
          }}
        >
          {openReportsInViewLabel}: <b>{openReportsInViewCount}</b>
        </div>
      )}
      {isStreetlightsLayerActive ? (
        <>
          <div
            onClick={() => toggleStreetlightInViewFilter("saved")}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleStreetlightInViewFilter("saved");
              }
            }}
            style={{
              width: "fit-content",
              maxWidth: "min(720px, calc(100vw - 180px))",
              fontSize: 11.5,
              opacity: 1,
              textAlign: "left",
              color: inViewCounterColor,
              padding: "4px 8px",
              borderRadius: 999,
              border: isSavedStreetlightFilterOn
                ? "1px solid var(--sl-ui-tool-active-border)"
                : `1px solid ${inViewCounterBorder}`,
              background: isSavedStreetlightFilterOn
                ? "var(--sl-ui-tool-active-bg)"
                : inViewCounterBg,
              boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              cursor: "pointer",
            }}
          >
            Saved lights in view: <b>{Number(streetlightPersonalInViewStats.saved || 0)}</b>
          </div>
          <div
            onClick={() => toggleStreetlightInViewFilter("utility")}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleStreetlightInViewFilter("utility");
              }
            }}
            style={{
              width: "fit-content",
              maxWidth: "min(720px, calc(100vw - 180px))",
              fontSize: 11.5,
              opacity: 1,
              textAlign: "left",
              color: inViewCounterColor,
              padding: "4px 8px",
              borderRadius: 999,
              border: isUtilityStreetlightFilterOn
                ? "1px solid var(--sl-ui-tool-active-border)"
                : `1px solid ${inViewCounterBorder}`,
              background: isUtilityStreetlightFilterOn
                ? "var(--sl-ui-tool-active-bg)"
                : inViewCounterBg,
              boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
              cursor: "pointer",
            }}
          >
            Utility reported in view: <b>{Number(streetlightPersonalInViewStats.utility || 0)}</b>
          </div>
        </>
      ) : null}
      {isAdmin && openAbuseFlagSummary.total > 0 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setModerationFlagsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setModerationFlagsOpen(true);
            }
          }}
          style={{
            width: "fit-content",
            maxWidth: "min(720px, calc(100vw - 180px))",
            fontSize: 11.5,
            fontWeight: 850,
            textAlign: "left",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background:
              openAbuseFlagSummary.maxSeverity >= 3
                ? "rgba(183, 28, 28, 0.86)"
                : openAbuseFlagSummary.maxSeverity >= 2
                  ? "rgba(239, 108, 0, 0.84)"
                  : "rgba(33, 150, 83, 0.80)",
            boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
            cursor: "pointer",
          }}
          title="Open moderation flags"
        >
          Moderation flags open: <b>{openAbuseFlagSummary.total}</b>
        </div>
      ) : null}
    </div>
  );
});

export default function MapLazyDesktopOverlay({
  mapHeaderTheme,
  titleLogoError,
  titleLogoSrc,
  titleLogoAlt,
  onTitleLogoError,
  environmentGuardrailLabel,
  organizationDisplayName,
  desktopAccountMenuAnchorRef,
  session,
  onAccountMenuToggle,
  toolRailProps,
  statusChipProps,
}) {
  return (
    <div
      className="sl-overlay-pass"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1600,
        pointerEvents: "none",
        fontFamily: "var(--app-header-font-family)",
      }}
    >
      <div
        style={{
          padding: "0 var(--desktop-header-horizontal-padding)",
          borderBottom: mapHeaderTheme.desktopBorder,
          backdropFilter: "blur(14px)",
          background: mapHeaderTheme.desktopBackground,
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(var(--desktop-header-side-column), 1fr) minmax(0, 2fr) minmax(var(--desktop-header-side-column), 1fr)",
            alignItems: "center",
            gap: 16,
            height: "var(--desktop-header-height)",
            minHeight: "var(--desktop-header-height)",
            minWidth: 0,
            width: "100%",
          }}
        >
          <div
            style={{
              display: "grid",
              alignItems: "center",
              justifyItems: "start",
              minWidth: 0,
            }}
          >
            {titleLogoError ? (
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 950,
                  lineHeight: 1.05,
                  color: mapHeaderTheme.textColor,
                }}
              >
                CityReport.io
              </span>
            ) : (
              <img
                src={titleLogoSrc}
                alt={titleLogoAlt}
                onError={onTitleLogoError}
                style={{
                  width: "auto",
                  maxWidth: "min(300px, calc(100vw - 220px))",
                  height: "var(--desktop-header-logo-height)",
                  objectFit: "contain",
                  objectPosition: "left center",
                  display: "block",
                }}
              />
            )}
          </div>

          <div
            style={{
              display: "grid",
              gap: "var(--desktop-header-stack-gap)",
              minWidth: 0,
              textAlign: "center",
              justifyItems: "center",
              color: mapHeaderTheme.textColor,
            }}
          >
            <span className="app-header-eyebrow" style={{ color: mapHeaderTheme.eyebrowColor }}>Reporting Map</span>
            {!!environmentGuardrailLabel && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px 9px",
                  borderRadius: 999,
                  border: "1px solid rgba(210, 96, 25, 0.24)",
                  background: "rgba(210, 96, 25, 0.12)",
                  color: "#d26019",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  lineHeight: 1,
                }}
              >
                {environmentGuardrailLabel}
              </div>
            )}
            <h1
              style={{
                margin: 0,
                fontSize: "var(--desktop-header-title-size)",
                fontWeight: "var(--desktop-header-title-weight)",
                lineHeight: "var(--desktop-header-title-line-height)",
                color: mapHeaderTheme.textColor,
              }}
            >
              {organizationDisplayName}
            </h1>
          </div>

          <div
            ref={desktopAccountMenuAnchorRef}
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              minWidth: 0,
              position: "relative",
            }}
          >
            <button
              type="button"
              onClick={onAccountMenuToggle}
              aria-label={session?.user?.id ? "Open account menu" : "Log in"}
              title={session?.user?.id ? "Account" : "Log in"}
              style={{
                width: session?.user?.id ? "var(--desktop-header-menu-size)" : "auto",
                height: "var(--desktop-header-menu-size)",
                borderRadius: 999,
                border: mapHeaderTheme.desktopMenuBorder,
                background: mapHeaderTheme.desktopMenuBackground,
                color: mapHeaderTheme.textColor,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: session?.user?.id ? 0 : "0 14px",
                cursor: "pointer",
                lineHeight: 1,
                boxShadow: mapHeaderTheme.desktopMenuShadow,
                fontSize: session?.user?.id ? undefined : 13,
                fontWeight: session?.user?.id ? undefined : 900,
                letterSpacing: session?.user?.id ? undefined : "0.01em",
              }}
            >
              {session?.user?.id ? (
                <span style={{ display: "grid", gap: 4 }}>
                  <span style={{ width: 18, height: 2, borderRadius: 999, background: "currentColor", display: "block" }} />
                  <span style={{ width: 18, height: 2, borderRadius: 999, background: "currentColor", display: "block" }} />
                  <span style={{ width: 18, height: 2, borderRadius: 999, background: "currentColor", display: "block" }} />
                </span>
              ) : (
                "Log in"
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "10px var(--desktop-header-horizontal-padding) 0",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "100%",
            padding: 0,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "40px minmax(0, 1fr)",
              alignItems: "start",
              gap: 16,
              width: "100%",
            }}
          >
            <DesktopMapToolRail {...toolRailProps} />
            <DesktopMapStatusChips {...statusChipProps} />
          </div>
        </div>
      </div>
    </div>
  );
}
