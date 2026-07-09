import React, { Suspense, lazy, memo } from "react";
import { INCIDENT_REPORTING_LAYER_KEY } from "./lib/mapDomainSelectionConfig.js";
import { DomainAppIcon } from "./mapDomainIconComponentsSupport.jsx";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";

const LazyAccountMenuPanel = lazy(() => import("./mapLazyAccountPanels.jsx").then((module) => ({ default: module.AccountMenuPanel })));
const LazyMobileHeaderMenuPanel = lazy(() => import("./mapLazyAccountFlows.jsx").then((module) => ({ default: module.MobileHeaderMenuPanel })));
const LazyMobileBulkActionBar = lazy(() => import("./mapLazyMobileActionBars.jsx").then((module) => ({ default: module.MobileBulkActionBar })));
const LazyMobileMappingActionBar = lazy(() => import("./mapLazyMobileActionBars.jsx").then((module) => ({ default: module.MobileMappingActionBar })));

const MobileMapStatusChips = memo(function MobileMapStatusChips({
  isAggregatedReportingDomain,
  canOpenDomainReports,
  openReportsInViewLabel,
  openReportsInViewCount,
  inViewCounterColor,
  inViewCounterBorder,
  inViewCounterBg,
  isStreetlightsLayerActive,
  isSavedStreetlightFilterOn,
  isUtilityStreetlightFilterOn,
  streetlightPersonalInViewStats,
  isAdmin,
  openAbuseFlagSummary,
  onOpenInViewReports,
  onToggleSavedStreetlightFilter,
  onToggleUtilityStreetlightFilter,
  onOpenModerationFlags,
}) {
  return (
    <div
      style={{
        minWidth: 0,
        display: "grid",
        justifyItems: "end",
        gap: 6,
        paddingLeft: 58,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "flex-end",
          gap: 6,
          maxWidth: "100%",
          pointerEvents: "auto",
        }}
      >
        {isAggregatedReportingDomain ? (
          <div
            onClick={canOpenDomainReports ? onOpenInViewReports : undefined}
            role={canOpenDomainReports ? "button" : undefined}
            tabIndex={canOpenDomainReports ? 0 : -1}
            onKeyDown={(event) => {
              if (!canOpenDomainReports) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenInViewReports();
              }
            }}
            style={{
              width: "fit-content",
              maxWidth: "min(520px, calc(100vw - 100px))",
              marginTop: 1,
              fontSize: 11,
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
        ) : null}
        {isStreetlightsLayerActive ? (
          <>
            <div
              onClick={onToggleSavedStreetlightFilter}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggleSavedStreetlightFilter();
                }
              }}
              style={{
                width: "fit-content",
                maxWidth: "min(520px, calc(100vw - 100px))",
                marginTop: 1,
                fontSize: 11,
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
              onClick={onToggleUtilityStreetlightFilter}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onToggleUtilityStreetlightFilter();
                }
              }}
              style={{
                width: "fit-content",
                maxWidth: "min(520px, calc(100vw - 100px))",
                marginTop: 1,
                fontSize: 11,
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
            onClick={onOpenModerationFlags}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenModerationFlags();
              }
            }}
            style={{
              width: "fit-content",
              maxWidth: "min(720px, calc(100vw - 100px))",
              marginTop: 4,
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
    </div>
  );
});

const MobileMapHeaderShell = memo(function MobileMapHeaderShell({
  mapHeaderTheme,
  mobileHeaderMinHeight,
  mobileHeaderContentTopInset,
  mobileHeaderBottomInset,
  mobileTitleLogoSrc,
  titleLogoAlt,
  titleLogoError,
  mobileHeaderCopyMaxWidth,
  mobileHeaderCopyPadding,
  mobileHeaderCopyBottomPadding,
  mobileHeaderCopyTranslateY,
  mobileHeaderEyebrowSize,
  environmentGuardrailLabel,
  mobileHeaderGuardrailPadding,
  mobileHeaderGuardrailFontSize,
  mobileHeaderGuardrailMarginTop,
  mobileHeaderTitleSize,
  mobileHeaderTitleMarginTop,
  organizationDisplayName,
  contentOverflowVisible,
  onTitleLogoError,
  onMenuClick,
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr",
        justifyItems: "center",
        alignItems: "end",
        gap: 0,
        minHeight: mobileHeaderMinHeight,
        padding: `${mobileHeaderContentTopInset} 16px ${mobileHeaderBottomInset}px`,
        border: "none",
        borderBottom: mapHeaderTheme.mobileBorder,
        borderRadius: 0,
        background: mapHeaderTheme.mobileBackground,
        boxShadow: "var(--mobile-header-shadow)",
        color: mapHeaderTheme.textColor,
        overflow: contentOverflowVisible ? "visible" : "hidden",
        width: "100%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 16,
          bottom: mobileHeaderBottomInset,
          width: "var(--mobile-header-side-column)",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        {titleLogoError ? (
          <span
            style={{
              fontSize: 14,
              fontWeight: 950,
              lineHeight: 1.05,
              color: mapHeaderTheme.textColor,
            }}
          >
            CR
          </span>
        ) : (
          <img
            src={mobileTitleLogoSrc}
            alt={titleLogoAlt}
            onError={onTitleLogoError}
            style={{
              width: "var(--mobile-header-logo-size)",
              height: "var(--mobile-header-logo-size)",
              objectFit: "contain",
              objectPosition: "left center",
              display: "block",
            }}
          />
        )}
      </div>

      <div
        className="app-mobile-header-copy"
        style={{
          minWidth: 0,
          width: "100%",
          maxWidth: mobileHeaderCopyMaxWidth,
          padding: mobileHeaderCopyPadding,
          paddingBottom: mobileHeaderCopyBottomPadding,
          textAlign: "center",
          display: "grid",
          justifyItems: "center",
          alignSelf: "end",
          alignContent: "end",
          height: "auto",
          transform: mobileHeaderCopyTranslateY ? `translateY(${mobileHeaderCopyTranslateY}px)` : undefined,
        }}
      >
        <span className="app-header-eyebrow" style={{ color: mapHeaderTheme.eyebrowColor, fontSize: mobileHeaderEyebrowSize }}>Reporting Map</span>
        {!!environmentGuardrailLabel && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              alignSelf: "center",
              padding: mobileHeaderGuardrailPadding,
              borderRadius: 999,
              border: "1px solid rgba(210, 96, 25, 0.24)",
              background: "rgba(210, 96, 25, 0.12)",
              color: "#d26019",
              fontSize: mobileHeaderGuardrailFontSize,
              fontWeight: 900,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              lineHeight: 1,
              marginTop: mobileHeaderGuardrailMarginTop,
            }}
          >
            {environmentGuardrailLabel}
          </span>
        )}
        <h1 className="app-mobile-header-title" style={{ color: mapHeaderTheme.textColor, fontSize: mobileHeaderTitleSize, marginTop: mobileHeaderTitleMarginTop }}>
          {organizationDisplayName}
        </h1>
      </div>

      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        title="Menu"
        style={{
          position: "absolute",
          right: 16,
          bottom: mobileHeaderBottomInset,
          width: 42,
          height: 42,
          borderRadius: 14,
          border: mapHeaderTheme.mobileMenuBorder,
          background: mapHeaderTheme.mobileMenuBackground,
          boxShadow: "var(--sl-ui-header-menu-shadow)",
          color: mapHeaderTheme.textColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: 22,
          fontWeight: 900,
          lineHeight: 1,
        }}
      >
        ☰
      </button>
    </div>
  );
});

function MobileBottomRailButton({
  label,
  iconSrc,
  iconKey = "",
  active = false,
  darkMode = false,
  onClick,
  badgeCount = 0,
  disabled = false,
  children = null,
  showDivider = false,
  wide = false,
}) {
  const isLongLabel = label.length > 8;
  const showBadge = Number(badgeCount || 0) > 0;
  const isVeryLongLabel = label.length > 11;
  const labelFontSize = wide ? 10 : 9.1;
  const iconBoxSize = wide ? 28 : 24;
  const iconSize = wide ? 24 : 21;
  return (
    <div
      style={{
        position: "relative",
        minWidth: 0,
        borderRight: showDivider ? "1px solid var(--sl-ui-surface-border)" : "none",
      }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          width: "100%",
          minWidth: 0,
          border: "none",
          background: active ? "var(--sl-ui-tool-active-bg)" : "transparent",
          color: active ? "var(--sl-ui-tool-active-text)" : "var(--sl-ui-text)",
          borderRadius: 14,
          padding: "0 2px 5px",
          display: "grid",
          justifyItems: "center",
          gap: 2,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
          lineHeight: 1,
          position: "relative",
        }}
      >
        <span style={{ position: "relative", width: iconBoxSize, height: iconBoxSize, display: "grid", placeItems: "center" }}>
          <AppIcon src={iconSrc} iconKey={iconKey} darkMode={darkMode} active={active} size={iconSize} />
          {showBadge ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -7,
                minWidth: 15,
                height: 15,
                padding: "0 3px",
                borderRadius: 999,
                background: "#c62828",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.88)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8.5,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : null}
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            width: "100%",
            maxWidth: "100%",
            minHeight: 11,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: labelFontSize,
            fontWeight: 800,
            letterSpacing: isVeryLongLabel ? "-0.075em" : isLongLabel ? "-0.02em" : undefined,
            opacity: active ? 1 : 0.82,
            textAlign: "center",
            lineHeight: 1,
            transform: isVeryLongLabel ? "scaleX(0.87)" : undefined,
            transformOrigin: "center center",
          }}
        >
          {label}
        </span>
      </button>
      {children}
    </div>
  );
}

const MobileMapBottomRail = memo(function MobileMapBottomRail({
  mobileBottomRailHeight,
  mobileBottomRailSurfaceBg,
  mobileBottomRailColumnCount,
  useWideIosTabletShell,
  useAppShellLayout,
  useWideAppShellHeader,
  showMobileMapTabContent,
  myReportsOpen,
  notificationsWindowOpen,
  alertsWindowOpen,
  eventsWindowOpen,
  accountTabActive,
  showMapNotificationsIcon,
  showMapAlertIcon,
  showMapEventIcon,
  residentNotificationsUnreadCount,
  mapAlertsUnreadCount,
  mapEventsUnreadCount,
  prefersDarkMode,
  onMapClick,
  onReportsClick,
  onNotificationsClick,
  onAlertsClick,
  onEventsClick,
  onAccountClick,
}) {
  return (
    <div
      className="sl-overlay-pass"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1600,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "100%",
          height: mobileBottomRailHeight,
          boxSizing: "border-box",
          background: mobileBottomRailSurfaceBg,
          borderTop: "1px solid color-mix(in srgb, var(--sl-ui-surface-border) 60%, transparent)",
          boxShadow: useAppShellLayout ? "none" : "var(--sl-ui-surface-shadow-bottom)",
          color: "var(--sl-ui-text)",
          padding: useWideIosTabletShell
            ? "4px 8px calc(14px + env(safe-area-inset-bottom))"
            : "4px 6px calc(14px + env(safe-area-inset-bottom))",
          pointerEvents: "auto",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${mobileBottomRailColumnCount}, minmax(0, 1fr))`,
            gap: 2,
            alignItems: "start",
          }}
        >
          <MobileBottomRailButton
            label="Map"
            iconSrc={uiIconSrc.mapTab}
            iconKey="mapTab"
            active={showMobileMapTabContent}
            darkMode={prefersDarkMode}
            wide={useWideAppShellHeader}
            showDivider={true}
            onClick={onMapClick}
          />

          <MobileBottomRailButton
            label="Reports"
            iconSrc={uiIconSrc.openReports}
            iconKey="openReports"
            active={myReportsOpen}
            darkMode={prefersDarkMode}
            wide={useWideAppShellHeader}
            showDivider={showMapNotificationsIcon || showMapAlertIcon || showMapEventIcon || true}
            onClick={onReportsClick}
          />

          {showMapNotificationsIcon ? (
            <MobileBottomRailButton
              label="Notifications"
              iconSrc={uiIconSrc.notifications}
              iconKey="notifications"
              active={notificationsWindowOpen}
              darkMode={prefersDarkMode}
              wide={useWideAppShellHeader}
              badgeCount={residentNotificationsUnreadCount}
              showDivider={true}
              onClick={onNotificationsClick}
            />
          ) : null}

          {showMapAlertIcon ? (
            <MobileBottomRailButton
              label="Alerts"
              iconSrc={uiIconSrc.notification}
              iconKey="notification"
              active={alertsWindowOpen}
              darkMode={prefersDarkMode}
              wide={useWideAppShellHeader}
              badgeCount={mapAlertsUnreadCount}
              showDivider={true}
              onClick={onAlertsClick}
            />
          ) : null}

          {showMapEventIcon ? (
            <MobileBottomRailButton
              label="Events"
              iconSrc={uiIconSrc.calendar}
              iconKey="calendar"
              active={eventsWindowOpen}
              darkMode={prefersDarkMode}
              wide={useWideAppShellHeader}
              badgeCount={mapEventsUnreadCount}
              showDivider={true}
              onClick={onEventsClick}
            />
          ) : null}

          <MobileBottomRailButton
            label="Account"
            iconSrc={uiIconSrc.account}
            iconKey="account"
            active={accountTabActive}
            darkMode={prefersDarkMode}
            wide={useWideAppShellHeader}
            onClick={onAccountClick}
          />
        </div>
      </div>
    </div>
  );
});

const MobileMapToolChrome = memo(function MobileMapToolChrome({
  mapType,
  prefersDarkMode,
  locating,
  travelFollowMode,
  mobileMapToolButtonStyle,
  mobileMapLayerButtonStyle,
  mobilePrimaryLayerOptions,
  activeMapLayerKey,
  isStreetlightsLayerActive,
  canUseStreetlightBulk,
  showAdminTools,
  incidentLayerDomainOptions,
  mobileIncidentDomainMenuOpen,
  allIncidentReportsOptionEnabled,
  hasExplicitIncidentMapFilter,
  activeIncidentMapFilterKeys,
  resolvedIncidentLayerOption,
  bulkMode,
  mappingMode,
  onToggleSatellite,
  onResetHeading,
  onLocate,
  onToggleTravelFollow,
  onRecenterHome,
  onSelectLayer,
  onRunMobileIncidentMenuAction,
  shouldIgnoreMobileIncidentMenuClick,
  onResetIncidentFilter,
  onToggleIncidentDomainFilter,
  onToggleBulkMode,
  onToggleMappingMode,
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        width: 48,
        justifyItems: "center",
        position: "absolute",
        left: 10,
        top: 0,
        pointerEvents: "auto",
      }}
    >
      <div
        role="button"
        aria-label={mapType === "satellite" ? "Switch to street map" : "Switch to satellite map"}
        title={mapType === "satellite" ? "Street map" : "Satellite"}
        onClick={onToggleSatellite}
        style={mobileMapToolButtonStyle}
      >
        <AppIcon
          src={mapType === "satellite" ? uiIconSrc.streetMap : uiIconSrc.satellite}
          iconKey={mapType === "satellite" ? "streetMap" : "satellite"}
          darkMode={prefersDarkMode}
          size={32}
        />
      </div>
      <div
        role="button"
        aria-label="Reset heading"
        title="Reset heading"
        onClick={onResetHeading}
        style={mobileMapToolButtonStyle}
      >
        <AppIcon src={uiIconSrc.headingReset} iconKey="headingReset" darkMode={prefersDarkMode} size={32} />
      </div>
      <div
        role="button"
        aria-label="Find my location"
        title="Find my location"
        onClick={onLocate}
        style={{
          ...mobileMapToolButtonStyle,
          border: locating
            ? "1px solid var(--sl-ui-tool-active-border)"
            : mobileMapToolButtonStyle.border,
          background: locating
            ? "var(--sl-ui-tool-active-bg)"
            : mobileMapToolButtonStyle.background,
        }}
      >
        <AppIcon src={uiIconSrc.location} iconKey="location" darkMode={prefersDarkMode} active={locating} size={32} />
      </div>
      <div
        role="button"
        aria-label="Toggle travel follow"
        title="Travel follow"
        onClick={onToggleTravelFollow}
        style={{
          ...mobileMapToolButtonStyle,
          border: travelFollowMode
            ? "1px solid var(--sl-ui-tool-active-border)"
            : mobileMapToolButtonStyle.border,
          background: travelFollowMode
            ? "var(--sl-ui-tool-active-bg)"
            : mobileMapToolButtonStyle.background,
          color: travelFollowMode
            ? "var(--sl-ui-tool-active-text)"
            : mobileMapToolButtonStyle.color,
        }}
      >
        <AppIcon src={uiIconSrc.navigationArrow} iconKey="navigationArrow" darkMode={prefersDarkMode} active={travelFollowMode} size={28} />
      </div>
      <div
        role="button"
        aria-label="Recenter to city"
        title="City home"
        onClick={onRecenterHome}
        style={mobileMapToolButtonStyle}
      >
        <AppIcon src={uiIconSrc.homeRecenter} iconKey="homeRecenter" darkMode={prefersDarkMode} size={30} />
      </div>
      {mobilePrimaryLayerOptions.length ? (
        <>
          <div
            aria-hidden="true"
            style={{
              width: "100%",
              height: 1,
              background: prefersDarkMode
                ? "rgba(200, 220, 242, 0.22)"
                : "rgba(17, 39, 64, 0.22)",
              margin: "3px 0 1px",
              boxShadow: prefersDarkMode
                ? "0 1px 0 rgba(255,255,255,0.08), 0 4px 10px rgba(0,0,0,0.16)"
                : "0 1px 0 rgba(255,255,255,0.75), 0 4px 10px rgba(17,39,64,0.10)",
            }}
          />
          {mobilePrimaryLayerOptions.map((layer, index) => {
            const isStreetlightsButton = layer.key === "streetlights";
            const isIncidentButton = layer.key === INCIDENT_REPORTING_LAYER_KEY;
            const isActive = layer.key === activeMapLayerKey;
            const showStreetlightSubcontrols =
              isStreetlightsButton &&
              isStreetlightsLayerActive &&
              (canUseStreetlightBulk || showAdminTools);
            const showIncidentSubcontrols =
              isIncidentButton &&
              isActive &&
              incidentLayerDomainOptions.length > 1 &&
              mobileIncidentDomainMenuOpen;
            return (
              <div
                key={`mobile-map-layer-${layer.key}`}
                style={{
                  position: "relative",
                  display: "grid",
                  justifyItems: "center",
                  width: showStreetlightSubcontrols ? 40 : 48,
                }}
              >
                <div
                  role="button"
                  aria-label={layer.label}
                  title={
                    isIncidentButton && resolvedIncidentLayerOption?.label
                      ? `${layer.label} · ${resolvedIncidentLayerOption.label}`
                      : layer.label
                  }
                  onClick={() => {
                    if (!layer.enabled) return;
                    onSelectLayer(layer.key, layer.label);
                  }}
                  style={{
                    ...mobileMapLayerButtonStyle,
                    border: isActive
                      ? "1px solid var(--sl-ui-tool-active-border)"
                      : mobileMapLayerButtonStyle.border,
                    background: isActive
                      ? "var(--sl-ui-tool-active-bg)"
                      : mobileMapLayerButtonStyle.background,
                    color: isActive
                      ? "var(--sl-ui-tool-active-text)"
                      : mobileMapLayerButtonStyle.color,
                    opacity: layer.enabled === false ? 0.55 : 1,
                    position: "relative",
                    zIndex: showStreetlightSubcontrols ? 2 : "auto",
                  }}
                >
                  <AppIcon
                    src={layer.iconSrc}
                    iconKey={layer.key === INCIDENT_REPORTING_LAYER_KEY ? "incidentReportingLayer" : ""}
                    darkMode={prefersDarkMode}
                    active={isActive}
                    size={index === 0 ? 30 : 32}
                  />
                </div>
                {showIncidentSubcontrols ? (
                  <div
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      position: "absolute",
                      left: "calc(100% + 8px)",
                      top: "50%",
                      transform: "translateY(-50%)",
                      display: "grid",
                      gap: 6,
                      minWidth: 164,
                      padding: 8,
                      borderRadius: 16,
                      border: "1px solid var(--sl-ui-modal-border)",
                      background: "color-mix(in srgb, var(--sl-ui-surface-bg) 92%, rgba(255,255,255,0.06))",
                      boxShadow: "var(--sl-ui-modal-shadow)",
                      zIndex: 4,
                    }}
                  >
                    {allIncidentReportsOptionEnabled ? (
                      <button
                        type="button"
                        onTouchStart={(event) => {
                          onRunMobileIncidentMenuAction(event, onResetIncidentFilter);
                        }}
                        onClick={(event) => {
                          if (shouldIgnoreMobileIncidentMenuClick()) return;
                          event.preventDefault();
                          event.stopPropagation();
                          onResetIncidentFilter();
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 9px",
                          minHeight: 42,
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
                          touchAction: "manipulation",
                          WebkitTapHighlightColor: "transparent",
                          userSelect: "none",
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
                          key={`mobile-incident-domain-${option.key}`}
                          type="button"
                          onTouchStart={(event) => {
                            onRunMobileIncidentMenuAction(event, () => {
                              onToggleIncidentDomainFilter(option.key, option.label);
                            });
                          }}
                          onClick={(event) => {
                            if (shouldIgnoreMobileIncidentMenuClick()) return;
                            event.preventDefault();
                            event.stopPropagation();
                            onToggleIncidentDomainFilter(option.key, option.label);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "7px 9px",
                            minHeight: 42,
                            borderRadius: 10,
                            border: isSelected
                              ? "1px solid var(--sl-ui-tool-active-border)"
                              : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                            background: isSelected
                              ? "var(--sl-ui-tool-active-bg)"
                              : "var(--sl-ui-modal-btn-secondary-bg)",
                            color: isSelected
                              ? "var(--sl-ui-tool-active-text)"
                              : "var(--sl-ui-modal-btn-secondary-text)",
                            fontWeight: isSelected ? 900 : 700,
                            cursor: "pointer",
                            justifyContent: "flex-start",
                            textAlign: "left",
                            touchAction: "manipulation",
                            WebkitTapHighlightColor: "transparent",
                            userSelect: "none",
                          }}
                        >
                          <DomainAppIcon domainKey={option.key} src={option.iconSrc || uiIconSrc.incidentReportingLayer} size={18} />
                          <span style={{ fontSize: 12 }}>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {showStreetlightSubcontrols ? (
                  <div
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "calc(100% - 8px)",
                      transform: "translateX(-50%)",
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr)",
                      gap: 6,
                      width: 40,
                      padding: "15px 0 10px",
                      borderRadius: "0 0 16px 16px",
                      border: "1px solid var(--sl-ui-tool-btn-border)",
                      borderTop: 0,
                      background: "color-mix(in srgb, var(--sl-ui-tool-btn-bg) 94%, white 6%)",
                      boxShadow: "var(--sl-ui-tool-btn-shadow)",
                      justifyItems: "center",
                      zIndex: 1,
                    }}
                  >
                    {canUseStreetlightBulk ? (
                      <button
                        type="button"
                        onClick={onToggleBulkMode}
                        style={{
                          ...mobileMapLayerButtonStyle,
                          width: 30,
                          height: 30,
                          minWidth: 30,
                          minHeight: 30,
                          borderRadius: 10,
                          justifySelf: "center",
                          border: bulkMode
                            ? "1px solid var(--sl-ui-tool-active-border)"
                            : "1px solid var(--sl-ui-tool-btn-border)",
                          background: bulkMode
                            ? "var(--sl-ui-tool-active-bg)"
                            : "var(--sl-ui-tool-btn-bg)",
                          color: bulkMode
                            ? "var(--sl-ui-tool-active-text)"
                            : "var(--sl-ui-text)",
                          boxShadow: "var(--sl-ui-tool-btn-shadow)",
                        }}
                        aria-label={bulkMode ? "Turn off bulk reporting" : "Turn on bulk reporting"}
                        title={bulkMode ? "Bulk reporting on" : "Bulk reporting off"}
                      >
                        <AppIcon src={uiIconSrc.bulk} iconKey="bulk" darkMode={prefersDarkMode} active={bulkMode} size={17} />
                      </button>
                    ) : null}
                    {showAdminTools ? (
                      <button
                        type="button"
                        onClick={onToggleMappingMode}
                        style={{
                          ...mobileMapLayerButtonStyle,
                          width: 30,
                          height: 30,
                          minWidth: 30,
                          minHeight: 30,
                          borderRadius: 10,
                          justifySelf: "center",
                          border: mappingMode
                            ? "1px solid var(--sl-ui-tool-active-border)"
                            : "1px solid var(--sl-ui-tool-btn-border)",
                          background: mappingMode
                            ? "var(--sl-ui-tool-active-bg)"
                            : "var(--sl-ui-tool-btn-bg)",
                          color: mappingMode
                            ? "var(--sl-ui-tool-active-text)"
                            : "var(--sl-ui-text)",
                          boxShadow: "var(--sl-ui-tool-btn-shadow)",
                        }}
                        aria-label={mappingMode ? "Turn off light mapping" : "Turn on light mapping"}
                        title={mappingMode ? "Light mapping on" : "Light mapping off"}
                      >
                        <AppIcon src={uiIconSrc.mapping} iconKey="mapping" darkMode={prefersDarkMode} active={mappingMode} size={17} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
});

function MobileMapTopOverlay({
  overlayZIndex,
  mapHeaderTheme,
  mobileHeaderMinHeight,
  mobileHeaderContentTopInset,
  mobileHeaderBottomInset,
  mobileTitleLogoSrc,
  titleLogoAlt,
  titleLogoError,
  mobileHeaderCopyMaxWidth,
  mobileHeaderCopyPadding,
  mobileHeaderCopyBottomPadding,
  mobileHeaderCopyTranslateY,
  mobileHeaderEyebrowSize,
  environmentGuardrailLabel,
  mobileHeaderGuardrailPadding,
  mobileHeaderGuardrailFontSize,
  mobileHeaderGuardrailMarginTop,
  mobileHeaderTitleSize,
  mobileHeaderTitleMarginTop,
  organizationDisplayName,
  contentOverflowVisible,
  onTitleLogoError,
  onMenuClick,
  accountMenuOpen,
  session,
  profile,
  showNotificationPreferencesEntry,
  mobileTabPageTopInset,
  mobileReportsPageBottomInset,
  onCloseAccountMenu,
  onAccountManage,
  onAccountFollowedLocations,
  onAccountNotificationPreferences,
  onAccountMyReports,
  onAccountOpenCitySwitcher,
  prefersDarkMode,
  onAccountContactUs,
  onAccountOpenInfo,
  onAccountLogout,
  mobileHeaderMenuOpen,
  onCloseMobileHeaderMenu,
  showAdminTools,
  onMobileHeaderOpenCitySwitcher,
  onMobileHeaderOpenLocationDiagnostics,
  onMobileHeaderContactUs,
  onMobileHeaderOpenAbout,
  tenantKey,
  tenantScopedReadClient,
  showMobileMapTabContent,
  toolChromeProps,
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
        zIndex: overlayZIndex,
        display: "grid",
        placeItems: "start stretch",
        padding: 0,
        fontFamily: "var(--app-header-font-family)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          marginLeft: 0,
        }}
      >
        <MobileMapHeaderShell
          mapHeaderTheme={mapHeaderTheme}
          mobileHeaderMinHeight={mobileHeaderMinHeight}
          mobileHeaderContentTopInset={mobileHeaderContentTopInset}
          mobileHeaderBottomInset={mobileHeaderBottomInset}
          mobileTitleLogoSrc={mobileTitleLogoSrc}
          titleLogoAlt={titleLogoAlt}
          titleLogoError={titleLogoError}
          mobileHeaderCopyMaxWidth={mobileHeaderCopyMaxWidth}
          mobileHeaderCopyPadding={mobileHeaderCopyPadding}
          mobileHeaderCopyBottomPadding={mobileHeaderCopyBottomPadding}
          mobileHeaderCopyTranslateY={mobileHeaderCopyTranslateY}
          mobileHeaderEyebrowSize={mobileHeaderEyebrowSize}
          environmentGuardrailLabel={environmentGuardrailLabel}
          mobileHeaderGuardrailPadding={mobileHeaderGuardrailPadding}
          mobileHeaderGuardrailFontSize={mobileHeaderGuardrailFontSize}
          mobileHeaderGuardrailMarginTop={mobileHeaderGuardrailMarginTop}
          mobileHeaderTitleSize={mobileHeaderTitleSize}
          mobileHeaderTitleMarginTop={mobileHeaderTitleMarginTop}
          organizationDisplayName={organizationDisplayName}
          contentOverflowVisible={contentOverflowVisible}
          onTitleLogoError={onTitleLogoError}
          onMenuClick={onMenuClick}
        />

        {accountMenuOpen ? (
          <Suspense fallback={null}>
            <LazyAccountMenuPanel
              open={accountMenuOpen}
              session={session}
              profile={profile}
              showCitySwitcher={true}
              showNotificationPreferences={showNotificationPreferencesEntry}
              variant="mobile-page"
              pageTopInset={mobileTabPageTopInset}
              pageBottomInset={mobileReportsPageBottomInset}
              onClose={onCloseAccountMenu}
              onManage={onAccountManage}
              onFollowedLocations={onAccountFollowedLocations}
              onNotificationPreferences={onAccountNotificationPreferences}
              onMyReports={onAccountMyReports}
              onOpenCitySwitcher={onAccountOpenCitySwitcher}
              darkMode={prefersDarkMode}
              onContactUs={onAccountContactUs}
              onOpenInfo={onAccountOpenInfo}
              onLogout={onAccountLogout}
            />
          </Suspense>
        ) : null}

        {mobileHeaderMenuOpen ? (
          <Suspense fallback={null}>
            <LazyMobileHeaderMenuPanel
              open={mobileHeaderMenuOpen}
              pageTopInset={mobileTabPageTopInset}
              pageBottomInset={mobileReportsPageBottomInset}
              onClose={onCloseMobileHeaderMenu}
              showCitySwitcher={false}
              onOpenCitySwitcher={onMobileHeaderOpenCitySwitcher}
              showLocationDiagnostics={showAdminTools}
              onOpenLocationDiagnostics={onMobileHeaderOpenLocationDiagnostics}
              onContactUs={onMobileHeaderContactUs}
              onOpenAbout={onMobileHeaderOpenAbout}
              tenantKey={tenantKey}
              readClient={tenantScopedReadClient}
            />
          </Suspense>
        ) : null}

        {showMobileMapTabContent ? (
          <div
            style={{
              marginTop: 8,
              position: "relative",
              width: "100%",
              padding: "0 10px",
              pointerEvents: "none",
            }}
          >
            <MobileMapToolChrome {...toolChromeProps} />
            <MobileMapStatusChips {...statusChipProps} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function MapLazyMobileChrome({
  mobileChromeShared,
  topOverlayConfig,
  toolChromeConfig,
  statusChipConfig,
  bulkActionBarConfig,
  mappingActionBarProps,
  bottomRailProps,
}) {
  const {
    mapHeaderTheme,
    mobileHeaderMinHeight,
    mobileHeaderContentTopInset,
    mobileHeaderBottomInset,
    mobileTitleLogoSrc,
    titleLogoAlt,
    titleLogoError,
    mobileHeaderCopyMaxWidth,
    mobileHeaderCopyPadding,
    mobileHeaderCopyBottomPadding,
    mobileHeaderCopyTranslateY,
    mobileHeaderEyebrowSize,
    environmentGuardrailLabel,
    mobileHeaderGuardrailPadding,
    mobileHeaderGuardrailFontSize,
    mobileHeaderGuardrailMarginTop,
    mobileHeaderTitleSize,
    mobileHeaderTitleMarginTop,
    organizationDisplayName,
    session,
    profile,
    mobileTabPageTopInset,
    mobileReportsPageBottomInset,
    prefersDarkMode,
    tenant,
    openMyReports,
    setAccountMenuOpen,
    setAccountView,
    setNotificationPreferencesOpen,
    setFollowedLocationsOpen,
    setManageEditing,
    setManageOpen,
    setInfoMenuOpen,
    setCitySwitcherOpen,
    setContactUsOpen,
    signOut,
    setMobileHeaderMenuOpen,
    setLocationDiagnosticsOpen,
    tenantKey,
    tenantScopedReadClient,
    showAdminTools,
    showMobileMapTabContent,
  } = mobileChromeShared;
  const {
    accountMenuOpen,
    showNotificationPreferencesEntry,
    onTitleLogoError,
    onMenuClick,
    mobileHeaderMenuOpen,
  } = topOverlayConfig;
  const topOverlayProps = {
    overlayZIndex: mobileHeaderMenuOpen ? 10080 : accountMenuOpen ? 2602 : 1600,
    mapHeaderTheme,
    mobileHeaderMinHeight,
    mobileHeaderContentTopInset,
    mobileHeaderBottomInset,
    mobileTitleLogoSrc,
    titleLogoAlt,
    titleLogoError,
    mobileHeaderCopyMaxWidth,
    mobileHeaderCopyPadding,
    mobileHeaderCopyBottomPadding,
    mobileHeaderCopyTranslateY,
    mobileHeaderEyebrowSize,
    environmentGuardrailLabel,
    mobileHeaderGuardrailPadding,
    mobileHeaderGuardrailFontSize,
    mobileHeaderGuardrailMarginTop,
    mobileHeaderTitleSize,
    mobileHeaderTitleMarginTop,
    organizationDisplayName,
    contentOverflowVisible: accountMenuOpen || mobileHeaderMenuOpen,
    onTitleLogoError,
    onMenuClick,
    accountMenuOpen,
    session,
    profile,
    showNotificationPreferencesEntry,
    mobileTabPageTopInset,
    mobileReportsPageBottomInset,
    onCloseAccountMenu: () => {
      setAccountMenuOpen(false);
      setAccountView("menu");
    },
    onAccountManage: () => {
      setAccountMenuOpen(false);
      setNotificationPreferencesOpen(false);
      setFollowedLocationsOpen(false);
      setManageEditing(false);
      setManageOpen(true);
    },
    onAccountFollowedLocations: () => {
      setAccountMenuOpen(false);
      setManageOpen(false);
      setManageEditing(false);
      setNotificationPreferencesOpen(false);
      void tenant?.ensureAvailableTenantsLoaded?.();
      setFollowedLocationsOpen(true);
    },
    onAccountNotificationPreferences: () => {
      setAccountMenuOpen(false);
      setManageOpen(false);
      setManageEditing(false);
      setFollowedLocationsOpen(false);
      setNotificationPreferencesOpen(true);
    },
    onAccountMyReports: () => {
      setAccountMenuOpen(false);
      openMyReports();
    },
    onAccountOpenCitySwitcher: () => {
      setAccountMenuOpen(false);
      setInfoMenuOpen(false);
      void tenant?.ensureAvailableTenantsLoaded?.();
      setCitySwitcherOpen(true);
    },
    prefersDarkMode,
    onAccountContactUs: () => {
      setAccountMenuOpen(false);
      setContactUsOpen(true);
    },
    onAccountOpenInfo: () => {
      setAccountMenuOpen(false);
      setCitySwitcherOpen(false);
      setInfoMenuOpen(true);
    },
    onAccountLogout: () => {
      signOut();
      setAccountMenuOpen(false);
    },
    mobileHeaderMenuOpen,
    onCloseMobileHeaderMenu: () => setMobileHeaderMenuOpen(false),
    showAdminTools,
    onMobileHeaderOpenCitySwitcher: () => {
      setMobileHeaderMenuOpen(false);
      setInfoMenuOpen(false);
      void tenant?.ensureAvailableTenantsLoaded?.();
      setCitySwitcherOpen(true);
    },
    onMobileHeaderOpenLocationDiagnostics: () => {
      setMobileHeaderMenuOpen(false);
      setLocationDiagnosticsOpen(true);
    },
    onMobileHeaderContactUs: () => {
      setMobileHeaderMenuOpen(false);
      setContactUsOpen(true);
    },
    onMobileHeaderOpenAbout: () => {
      setMobileHeaderMenuOpen(false);
      setCitySwitcherOpen(false);
      setInfoMenuOpen(true);
    },
    tenantKey,
    tenantScopedReadClient,
    showMobileMapTabContent,
    toolChromeProps: toolChromeConfig,
    statusChipProps: statusChipConfig,
  };
  const bulkActionBarProps = {
    ...bulkActionBarConfig,
  };
  return (
    <>
      <MobileMapTopOverlay {...topOverlayProps} />
      {bulkActionBarProps.canUseStreetlightBulk && bulkActionBarProps.bulkMode ? (
        <Suspense fallback={null}>
          <LazyMobileBulkActionBar {...bulkActionBarProps} />
        </Suspense>
      ) : null}
      {mappingActionBarProps.mappingMode && mappingActionBarProps.mappingQueueLength > 0 ? (
        <Suspense fallback={null}>
          <LazyMobileMappingActionBar {...mappingActionBarProps} />
        </Suspense>
      ) : null}
      <MobileMapBottomRail {...bottomRailProps} />
    </>
  );
}
