import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCommunityFeedAccessPermissions } from "./lib/mapCommunityFeedAccessSupport";
import { fetchResidentNotificationsSnapshot } from "./lib/mapResidentNotificationSupport";
import {
  buildResidentNotificationPreview,
  countCurrentOrUpcomingPublishedAlerts,
  countUpcomingPublishedEvents,
  filterArchivedResidentAlerts,
  filterArchivedResidentEvents,
  filterCurrentOrUpcomingResidentAlerts,
  formatResidentAlertWindow,
  formatResidentEventRange,
  prioritizeResidentFeedItems,
  residentCommunityStatusLabel,
  residentCommunityStatusTone,
  sortResidentArchivedAlerts,
  sortResidentArchivedEvents,
  sortResidentCurrentOrUpcomingAlerts,
} from "./lib/mapResidentFeedSupport";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
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

function residentFeedBadgeStyle({ bg = "rgba(22, 109, 120, 0.12)", border = "rgba(22, 109, 120, 0.18)", color = "#124c57" } = {}) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: 11.5,
    fontWeight: 800,
    lineHeight: 1.1,
    textTransform: "capitalize",
  };
}

function residentFeedCssTone(prefix) {
  return {
    bg: `var(--sl-ui-${prefix}-bg)`,
    border: `var(--sl-ui-${prefix}-border)`,
    color: `var(--sl-ui-${prefix}-text)`,
  };
}

function residentFeedAdminButtonStyle() {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid var(--sl-ui-tool-active-border)",
    background: "var(--sl-ui-tool-active-bg)",
    color: "var(--sl-ui-tool-active-text)",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.01em",
    boxShadow: "var(--sl-ui-tool-btn-shadow)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function ResidentFeedWindow({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  iconSrc,
  countLabel,
  loading,
  error,
  emptyText,
  items,
  renderItem,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  createLabel = "",
  onCreate = null,
  toolbarContent = null,
}) {
  const isWidePageMode = pageMode && typeof window !== "undefined" && window.innerWidth >= 900;
  const headerBorder = "1px solid var(--sl-ui-feed-card-border)";
  const eyebrowBadgeTone = residentFeedCssTone("feed-badge");
  const countBadgeTone = {
    bg: "var(--sl-ui-tool-active-bg)",
    border: "var(--sl-ui-tool-active-border)",
    color: "var(--sl-ui-tool-active-text)",
  };
  const iconShellStyle = {
    background: "var(--sl-ui-feed-card-bg)",
    border: "1px solid var(--sl-ui-feed-card-border)",
  };
  const subtitleColor = "var(--sl-ui-feed-muted-text)";
  const errorColor = "var(--sl-ui-alert-danger-text)";
  const hasEyebrow = Boolean(String(eyebrow || "").trim());
  const hasSubtitle = Boolean(String(subtitle || "").trim());

  return (
    <ModalShell
      open={open}
      zIndex={10055}
      panelStyle={{
        width: pageMode ? "100vw" : "min(860px, 100%)",
        maxHeight: pageMode ? undefined : "min(88vh, 900px)",
        height: pageMode ? "100%" : undefined,
        borderRadius: pageMode ? 0 : 24,
        padding: 0,
        overflow: "hidden",
      }}
      fullScreen={pageMode}
      overlayStyle={pageMode ? {
        top: pageTopInset,
        left: 0,
        right: 0,
        bottom: pageBottomInset,
        inset: "unset",
        background: "var(--sl-ui-modal-bg)",
        display: "block",
      } : null}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
          height: pageMode ? "100%" : undefined,
          maxHeight: pageMode ? undefined : "min(88vh, 900px)",
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 14,
            padding: pageMode ? (isWidePageMode ? "20px 22px 16px" : "14px 14px 12px") : "22px 22px 18px",
            borderBottom: headerBorder,
          }}
        >
          <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
            {hasEyebrow || countLabel ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {hasEyebrow ? (
                  <div style={residentFeedBadgeStyle(eyebrowBadgeTone)}>
                    {eyebrow}
                  </div>
                ) : null}
                {countLabel ? (
                  <div style={residentFeedBadgeStyle(countBadgeTone)}>
                    {countLabel}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div
                style={{
                  width: isWidePageMode ? 54 : 46,
                  height: isWidePageMode ? 54 : 46,
                  borderRadius: isWidePageMode ? 18 : 16,
                  ...iconShellStyle,
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                }}
              >
                <AppIcon src={iconSrc} size={isWidePageMode ? 30 : 26} />
              </div>
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <div style={{ fontSize: isWidePageMode ? 30 : 24, fontWeight: 900, lineHeight: 1.05, color: "var(--sl-ui-text)" }}>{title}</div>
                {hasSubtitle ? (
                  <div style={{ fontSize: isWidePageMode ? 15.5 : 13, lineHeight: 1.45, opacity: 0.82, color: subtitleColor, maxWidth: isWidePageMode ? "68ch" : undefined }}>{subtitle}</div>
                ) : null}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: "0 0 auto" }}>
            {typeof onCreate === "function" && createLabel ? (
              <button
                type="button"
                onClick={onCreate}
                style={residentFeedAdminButtonStyle()}
              >
                {createLabel}
              </button>
            ) : null}
            {!pageMode ? (
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                  flex: "0 0 auto",
                }}
                aria-label={`Close ${title}`}
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>

        <div
          style={{
            overflowY: "auto",
            padding: pageMode
              ? (isWidePageMode
                ? "18px 18px 28px 22px"
                : "14px 10px 18px 14px")
              : "18px 18px 20px 22px",
            marginRight: 4,
            minHeight: 0,
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          {toolbarContent ? (
            <div style={{ display: "grid", gap: 12, marginBottom: 14 }}>
              {toolbarContent}
            </div>
          ) : null}
          {loading && !items.length ? (
            <div style={{ fontSize: 13, opacity: 0.82, color: subtitleColor }}>Loading updates…</div>
          ) : error ? (
            <div style={{ fontSize: 13, color: errorColor, lineHeight: 1.45 }}>{error}</div>
          ) : !items.length ? (
            <div style={{ fontSize: 13, opacity: 0.82, color: subtitleColor }}>{emptyText}</div>
          ) : (
            <div style={{ display: "grid", gap: 14, paddingBottom: 2 }}>
              {items.map(renderItem)}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function VisibilityAcknowledge({
  active = true,
  observeKey = "",
  onVisible = null,
  children,
}) {
  const hostRef = useRef(null);
  const acknowledgedRef = useRef(false);

  useEffect(() => {
    acknowledgedRef.current = false;
  }, [observeKey]);

  useEffect(() => {
    if (!active || typeof onVisible !== "function") return undefined;
    const node = hostRef.current;
    if (!node) return undefined;

    const acknowledge = () => {
      if (acknowledgedRef.current) return;
      acknowledgedRef.current = true;
      onVisible();
    };

    if (typeof window === "undefined" || typeof window.IntersectionObserver !== "function") {
      if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        acknowledge();
        return undefined;
      }
      const frameId = window.requestAnimationFrame(acknowledge);
      return () => {
        if (typeof frameId === "number" && typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35);
        if (isVisible) {
          acknowledge();
          observer.disconnect();
        }
      },
      {
        threshold: [0.35, 0.6],
      }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [active, observeKey, onVisible]);

  return <div ref={hostRef}>{children}</div>;
}

function useCommunityFeedAccess({ open, supabase, tenantKey, userId }) {
  const [access, setAccess] = useState({ canManage: false, canDelete: false });

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (!open) {
        setAccess({ canManage: false, canDelete: false });
        return;
      }
      const next = await loadCommunityFeedAccessPermissions({
        supabase,
        tenantKey,
        userId,
        onWarn: (label, issue) => console.warn(label, issue?.message || issue),
      });
      if (cancelled) return;
      setAccess({
        canManage: next.canManage,
        canDelete: next.canDelete && next.canManage,
      });
    }

    void loadAccess();
    return () => {
      cancelled = true;
    };
  }, [open, supabase, tenantKey, userId]);

  return access;
}

export function AlertsWindow({
  open,
  onClose,
  alerts,
  loading,
  error,
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  canCreate = false,
  canEdit = false,
  newItemKeys = [],
  focusItemId = "",
  onCreate = null,
  onEdit = null,
  onItemVisible = null,
  mapCommunityFeedItemReadKey,
}) {
  const [showArchived, setShowArchived] = useState(false);
  const isWidePageMode = pageMode && typeof window !== "undefined" && window.innerWidth >= 900;
  const currentAlerts = useMemo(
    () => sortResidentCurrentOrUpcomingAlerts(filterCurrentOrUpcomingResidentAlerts(alerts)),
    [alerts, filterCurrentOrUpcomingResidentAlerts, sortResidentCurrentOrUpcomingAlerts]
  );
  const archivedAlerts = useMemo(
    () => sortResidentArchivedAlerts(filterArchivedResidentAlerts(alerts)),
    [alerts, filterArchivedResidentAlerts, sortResidentArchivedAlerts]
  );
  const currentCount = useMemo(
    () => countCurrentOrUpcomingPublishedAlerts(alerts),
    [alerts, countCurrentOrUpcomingPublishedAlerts]
  );
  const archivedCount = useMemo(() => archivedAlerts.length, [archivedAlerts]);
  const displayAlerts = useMemo(
    () => prioritizeResidentFeedItems(showArchived ? archivedAlerts : currentAlerts, focusItemId),
    [archivedAlerts, currentAlerts, focusItemId, prioritizeResidentFeedItems, showArchived]
  );
  const sessionNewKeySet = useMemo(() => new Set(Array.isArray(newItemKeys) ? newItemKeys : []), [newItemKeys]);
  const countLabel = showArchived
    ? (archivedCount === 1 ? "1 archived alert" : `${archivedCount} archived alerts`)
    : (currentCount === 1 ? "1 current alert" : `${currentCount} current alerts`);
  const cardBorder = "1px solid var(--sl-ui-feed-card-border)";
  const cardBackground = "var(--sl-ui-feed-card-bg)";
  const titleColor = "var(--sl-ui-text)";
  const summaryColor = "var(--sl-ui-feed-muted-text)";
  const bodyColor = "var(--sl-ui-feed-muted-text)";
  const metaColor = "var(--sl-ui-feed-muted-text)";
  const ctaStyle = {
    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: "var(--sl-ui-modal-btn-secondary-bg)",
    color: "var(--sl-ui-modal-btn-secondary-text)",
  };

  useEffect(() => {
    if (!open) setShowArchived(false);
  }, [open]);

  const feedToggleButtonStyle = (active) => ({
    minHeight: 38,
    padding: "8px 14px",
    borderRadius: 999,
    border: active
      ? "1px solid var(--sl-ui-tool-active-border)"
      : "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: active
      ? "var(--sl-ui-tool-active-bg)"
      : "var(--sl-ui-modal-btn-secondary-bg)",
    color: active
      ? "var(--sl-ui-tool-active-text)"
      : "var(--sl-ui-modal-btn-secondary-text)",
    fontSize: 12.5,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <ResidentFeedWindow
      open={open}
      onClose={onClose}
      eyebrow=""
      title="Location Alerts"
      subtitle=""
      iconSrc={uiIconSrc.notification}
      countLabel={countLabel}
      loading={loading}
      error={error}
      emptyText={showArchived ? "No archived alerts right now." : "No current alerts are published right now."}
      items={displayAlerts}
      pageMode={pageMode}
      pageTopInset={pageTopInset}
      pageBottomInset={pageBottomInset}
      createLabel={canCreate ? "Create" : ""}
      onCreate={canCreate ? onCreate : null}
      toolbarContent={(
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            style={feedToggleButtonStyle(!showArchived)}
          >
            Current
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            style={feedToggleButtonStyle(showArchived)}
          >
            Archived
          </button>
        </div>
      )}
      renderItem={(alert) => {
        const isNew = sessionNewKeySet.has(mapCommunityFeedItemReadKey(alert));
        const isFocused = String(focusItemId || "").trim() === String(alert?.id || "").trim();
        const severityKey = String(alert?.severity || "info").trim().toLowerCase();
        const severityTone =
          severityKey === "emergency"
            ? residentFeedCssTone("feed-alert-emergency")
            : severityKey === "urgent"
              ? residentFeedCssTone("feed-alert-urgent")
              : severityKey === "advisory"
                ? residentFeedCssTone("feed-alert-advisory")
                : residentFeedCssTone("feed-alert-info");
        const pinnedTone = {
          bg: "var(--sl-ui-tool-active-bg)",
          border: "var(--sl-ui-tool-active-border)",
          color: "var(--sl-ui-tool-active-text)",
        };
        const topicTone = residentFeedCssTone("feed-badge");
        const newTone = residentFeedCssTone("feed-new-badge");
        return (
          <VisibilityAcknowledge
            key={`map-alert-${alert.id}`}
            active={open}
            observeKey={`alert:${alert.id}:${mapCommunityFeedItemReadKey(alert)}`}
            onVisible={() => onItemVisible?.(alert)}
          >
            <article
              style={{
                padding: isWidePageMode ? 22 : 18,
                borderRadius: isWidePageMode ? 22 : 20,
                border: isFocused ? "1px solid var(--sl-ui-tool-active-border)" : cardBorder,
                background: cardBackground,
                display: "grid",
                gap: isWidePageMode ? 14 : 12,
                boxShadow: isFocused ? "0 0 0 2px color-mix(in srgb, var(--sl-ui-tool-active-border) 24%, transparent)" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                  <div style={residentFeedBadgeStyle(severityTone)}>{alert.severity || "info"}</div>
                  {alert?.pinned ? <div style={residentFeedBadgeStyle(pinnedTone)}>Pinned</div> : null}
                  {alert?.topic_label ? <div style={residentFeedBadgeStyle(topicTone)}>{alert.topic_label}</div> : null}
                  {isNew ? <div style={residentFeedBadgeStyle(newTone)}>New</div> : null}
                  {canEdit && alert?.status ? (
                    <div style={residentFeedBadgeStyle(residentCommunityStatusTone(alert.status, darkMode))}>
                      {residentCommunityStatusLabel(alert.status)}
                    </div>
                  ) : null}
                </div>
                {canEdit && typeof onEdit === "function" ? (
                  <button
                    type="button"
                    onClick={() => onEdit(alert)}
                    style={residentFeedAdminButtonStyle()}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <h3 style={{ margin: 0, fontSize: isWidePageMode ? 24 : 20, lineHeight: 1.15, color: titleColor }}>{alert.title || "Untitled alert"}</h3>
                {alert.summary ? <p style={{ margin: 0, fontSize: isWidePageMode ? 16 : 14, lineHeight: 1.5, color: summaryColor }}>{alert.summary}</p> : null}
                {alert.body ? <p style={{ margin: 0, fontSize: isWidePageMode ? 15 : 13.5, lineHeight: 1.55, color: bodyColor }}>{alert.body}</p> : null}
              </div>
              <div style={{ display: "grid", gap: 4, fontSize: isWidePageMode ? 14 : 12.5, color: metaColor, lineHeight: 1.45 }}>
                <div>{formatResidentAlertWindow(alert)}</div>
                {alert.location_name || alert.location_address ? (
                  <div>{[alert.location_name, alert.location_address].filter(Boolean).join(" • ")}</div>
                ) : null}
              </div>
              {alert.cta_url ? (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <a
                    href={alert.cta_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 14px",
                      borderRadius: 999,
                      ...ctaStyle,
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {alert.cta_label || "More details"}
                  </a>
                </div>
              ) : null}
            </article>
          </VisibilityAcknowledge>
        );
      }}
    />
  );
}

export function AlertsWindowController(props) {
  const {
    open,
    supabase,
    resolvedCommunityFeedTenantKey = "",
    sessionUserId = "",
  } = props;
  const { canManage } = useCommunityFeedAccess({
    open,
    supabase,
    tenantKey: resolvedCommunityFeedTenantKey,
    userId: sessionUserId,
  });
  return <AlertsWindow {...props} canCreate={canManage} canEdit={canManage} />;
}

export function EventsWindow({
  open,
  onClose,
  events,
  loading,
  error,
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  canCreate = false,
  canEdit = false,
  newItemKeys = [],
  focusItemId = "",
  onCreate = null,
  onEdit = null,
  onItemVisible = null,
  mapCommunityFeedItemReadKey,
  sortResidentEvents,
  filterActiveResidentEvents,
}) {
  const [showArchived, setShowArchived] = useState(false);
  const isWidePageMode = pageMode && typeof window !== "undefined" && window.innerWidth >= 900;
  const currentEvents = useMemo(
    () => sortResidentEvents(filterActiveResidentEvents(events)),
    [events, filterActiveResidentEvents, sortResidentEvents]
  );
  const archivedEvents = useMemo(
    () => sortResidentArchivedEvents(filterArchivedResidentEvents(events)),
    [events, filterArchivedResidentEvents, sortResidentArchivedEvents]
  );
  const upcomingCount = useMemo(
    () => countUpcomingPublishedEvents(events),
    [countUpcomingPublishedEvents, events]
  );
  const archivedCount = useMemo(() => archivedEvents.length, [archivedEvents]);
  const displayEvents = useMemo(
    () => prioritizeResidentFeedItems(showArchived ? archivedEvents : currentEvents, focusItemId),
    [archivedEvents, currentEvents, focusItemId, prioritizeResidentFeedItems, showArchived]
  );
  const sessionNewKeySet = useMemo(() => new Set(Array.isArray(newItemKeys) ? newItemKeys : []), [newItemKeys]);
  const countLabel = showArchived
    ? (archivedCount === 1 ? "1 archived event" : `${archivedCount} archived events`)
    : (upcomingCount === 1 ? "1 upcoming event" : `${upcomingCount} upcoming events`);
  const cardBorder = "1px solid var(--sl-ui-feed-card-border)";
  const cardBackground = "var(--sl-ui-feed-card-bg)";
  const titleColor = "var(--sl-ui-text)";
  const summaryColor = "var(--sl-ui-feed-muted-text)";
  const bodyColor = "var(--sl-ui-feed-muted-text)";
  const metaColor = "var(--sl-ui-feed-muted-text)";
  const topicTone = residentFeedCssTone("feed-badge");
  const allDayTone = {
    bg: "var(--sl-ui-tool-active-bg)",
    border: "var(--sl-ui-tool-active-border)",
    color: "var(--sl-ui-tool-active-text)",
  };
  const newTone = residentFeedCssTone("feed-new-badge");
  const ctaStyle = {
    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: "var(--sl-ui-modal-btn-secondary-bg)",
    color: "var(--sl-ui-modal-btn-secondary-text)",
  };

  useEffect(() => {
    if (!open) setShowArchived(false);
  }, [open]);

  const feedToggleButtonStyle = (active) => ({
    minHeight: 38,
    padding: "8px 14px",
    borderRadius: 999,
    border: active
      ? "1px solid var(--sl-ui-tool-active-border)"
      : "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: active
      ? "var(--sl-ui-tool-active-bg)"
      : "var(--sl-ui-modal-btn-secondary-bg)",
    color: active
      ? "var(--sl-ui-tool-active-text)"
      : "var(--sl-ui-modal-btn-secondary-text)",
    fontSize: 12.5,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <ResidentFeedWindow
      open={open}
      onClose={onClose}
      eyebrow=""
      title="Location Events"
      subtitle=""
      iconSrc={uiIconSrc.calendar}
      countLabel={countLabel}
      loading={loading}
      error={error}
      emptyText={showArchived ? "No archived events right now." : "No upcoming events are published yet."}
      items={displayEvents}
      pageMode={pageMode}
      pageTopInset={pageTopInset}
      pageBottomInset={pageBottomInset}
      createLabel={canCreate ? "Create" : ""}
      onCreate={canCreate ? onCreate : null}
      toolbarContent={(
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowArchived(false)}
            style={feedToggleButtonStyle(!showArchived)}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setShowArchived(true)}
            style={feedToggleButtonStyle(showArchived)}
          >
            Archived
          </button>
        </div>
      )}
      renderItem={(event) => {
        const isNew = sessionNewKeySet.has(mapCommunityFeedItemReadKey(event));
        const isFocused = String(focusItemId || "").trim() === String(event?.id || "").trim();
        return (
          <VisibilityAcknowledge
            key={`map-event-${event.id}`}
            active={open}
            observeKey={`event:${event.id}:${mapCommunityFeedItemReadKey(event)}`}
            onVisible={() => onItemVisible?.(event)}
          >
            <article
              style={{
                padding: isWidePageMode ? 22 : 18,
                borderRadius: isWidePageMode ? 22 : 20,
                border: isFocused ? "1px solid var(--sl-ui-tool-active-border)" : cardBorder,
                background: cardBackground,
                display: "grid",
                gap: isWidePageMode ? 14 : 12,
                boxShadow: isFocused ? "0 0 0 2px color-mix(in srgb, var(--sl-ui-tool-active-border) 24%, transparent)" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                  <div style={residentFeedBadgeStyle(topicTone)}>
                    {event.topic_label || event.topic_key || "Event"}
                  </div>
                  {isNew ? <div style={residentFeedBadgeStyle(newTone)}>New</div> : null}
                  {event.all_day ? <div style={residentFeedBadgeStyle(allDayTone)}>All day</div> : null}
                  {canEdit && event?.status ? (
                    <div style={residentFeedBadgeStyle(residentCommunityStatusTone(event.status, darkMode))}>
                      {residentCommunityStatusLabel(event.status)}
                    </div>
                  ) : null}
                </div>
                {canEdit && typeof onEdit === "function" ? (
                  <button
                    type="button"
                    onClick={() => onEdit(event)}
                    style={residentFeedAdminButtonStyle()}
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <h3 style={{ margin: 0, fontSize: isWidePageMode ? 24 : 20, lineHeight: 1.15, color: titleColor }}>{event.title || "Untitled event"}</h3>
                {event.summary ? <p style={{ margin: 0, fontSize: isWidePageMode ? 16 : 14, lineHeight: 1.5, color: summaryColor }}>{event.summary}</p> : null}
                {event.body ? <p style={{ margin: 0, fontSize: isWidePageMode ? 15 : 13.5, lineHeight: 1.55, color: bodyColor }}>{event.body}</p> : null}
              </div>
              <div style={{ display: "grid", gap: 4, fontSize: isWidePageMode ? 14 : 12.5, color: metaColor, lineHeight: 1.45 }}>
                <div>{formatResidentEventRange(event)}</div>
                {event.location_name || event.location_address ? (
                  <div>{[event.location_name, event.location_address].filter(Boolean).join(" • ")}</div>
                ) : null}
              </div>
              {event.cta_url ? (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <a
                    href={event.cta_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 14px",
                      borderRadius: 999,
                      ...ctaStyle,
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {event.cta_label || "Event details"}
                  </a>
                </div>
              ) : null}
            </article>
          </VisibilityAcknowledge>
        );
      }}
    />
  );
}

export function EventsWindowController(props) {
  const {
    open,
    supabase,
    resolvedCommunityFeedTenantKey = "",
    sessionUserId = "",
  } = props;
  const { canManage } = useCommunityFeedAccess({
    open,
    supabase,
    tenantKey: resolvedCommunityFeedTenantKey,
    userId: sessionUserId,
  });
  return <EventsWindow {...props} canCreate={canManage} canEdit={canManage} />;
}

export function NotificationsWindow({
  open,
  onClose,
  items,
  loading,
  error,
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  totalUnreadCount = 0,
  selectedTenantFilter = "all",
  tenantOptions = [],
  onSelectTenantFilter,
  onOpenNotification,
  normalizeResidentNotificationKind,
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const isWidePageMode = pageMode && typeof window !== "undefined" && window.innerWidth >= 900;

  useEffect(() => {
    if (!open) setFilterOpen(false);
  }, [open]);

  if (!open) return null;

  const selectedFilterKey = String(selectedTenantFilter || "all").trim().toLowerCase() || "all";
  const selectedFilterOption = (Array.isArray(tenantOptions) ? tenantOptions : []).find(
    (option) => String(option?.tenantKey || "").trim().toLowerCase() === selectedFilterKey
  );
  const filterButtonLabel = selectedFilterKey === "all"
    ? "All Locations"
    : String(selectedFilterOption?.label || "My Location").trim() || "My Location";
  const subtitleColor = "var(--sl-ui-feed-muted-text)";
  const unreadTone = residentFeedCssTone("feed-new-badge");
  const kindTone = residentFeedCssTone("feed-badge");
  const tenantTone = {
    bg: "var(--sl-ui-tool-btn-bg)",
    border: "var(--sl-ui-tool-btn-border)",
    color: "var(--sl-ui-tool-btn-text)",
  };

  return (
    <ModalShell
      open={open}
      zIndex={10052}
      fullScreen={pageMode}
      panelStyle={{
        width: pageMode ? "100vw" : "min(1120px, calc(100vw - 32px))",
        maxHeight: pageMode ? undefined : "min(92vh, 960px)",
        minHeight: pageMode ? undefined : "min(74vh, 760px)",
        height: pageMode ? "100%" : undefined,
        borderRadius: pageMode ? 0 : 24,
        padding: 0,
        overflow: "hidden",
      }}
      overlayStyle={pageMode ? {
        top: pageTopInset,
        left: 0,
        right: 0,
        bottom: pageBottomInset,
        inset: "unset",
        background: "var(--sl-ui-modal-bg)",
        display: "block",
      } : null}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto auto minmax(0, 1fr)",
          height: pageMode ? "100%" : undefined,
          maxHeight: pageMode ? undefined : "min(92vh, 960px)",
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: pageMode ? (isWidePageMode ? "22px 22px 12px" : "14px 14px 10px") : "22px 22px 14px" }}>
          <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flexWrap: "nowrap" }}>
              <div
                style={{
                  width: isWidePageMode ? 54 : 46,
                  height: isWidePageMode ? 54 : 46,
                  borderRadius: isWidePageMode ? 18 : 16,
                  background: "var(--sl-ui-feed-card-bg)",
                  border: "1px solid var(--sl-ui-feed-card-border)",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                }}
              >
                <AppIcon src={uiIconSrc.notifications} iconKey="notifications" darkMode={darkMode} size={isWidePageMode ? 30 : 26} />
              </div>
              <div style={{ fontSize: isWidePageMode ? 30 : 24, fontWeight: 900, lineHeight: 1.05, color: "var(--sl-ui-text)", minWidth: 0 }}>
                Notifications
              </div>
              {totalUnreadCount > 0 ? (
                <div style={residentFeedBadgeStyle(unreadTone)}>
                  {totalUnreadCount > 99 ? "99+ unread" : `${totalUnreadCount} unread`}
                </div>
              ) : null}
            </div>
            {!pageMode ? (
              <div style={{ fontSize: isWidePageMode ? 15.5 : 13, lineHeight: 1.45, opacity: 0.82, color: subtitleColor }}>
                Newest first across your saved locations. Tap one to open that city and jump to the alert or event.
              </div>
            ) : null}
          </div>
          {!pageMode ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                flex: "0 0 auto",
              }}
              aria-label="Close notifications"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div style={{ padding: pageMode ? (isWidePageMode ? "0 22px 10px" : "0 14px 10px") : "0 22px 10px", display: "grid", gap: 10 }}>
          <div style={{ position: "relative", width: "fit-content", maxWidth: "100%" }}>
            <button
              type="button"
              onClick={() => setFilterOpen((prev) => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                minHeight: 44,
                maxWidth: "100%",
                padding: "10px 14px",
                borderRadius: 16,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                boxShadow: "var(--sl-ui-surface-shadow)",
                cursor: "pointer",
                fontSize: 13.5,
                fontWeight: 900,
              }}
            >
              <AppIcon src={uiIconSrc.allLocations} iconKey="allLocations" darkMode={darkMode} size={20} />
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {filterButtonLabel}
              </span>
              <span aria-hidden="true">{filterOpen ? "▴" : "▾"}</span>
            </button>

            {filterOpen ? (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  zIndex: 6,
                  width: "min(360px, calc(100vw - 48px))",
                  maxHeight: "min(52vh, 420px)",
                  overflowY: "auto",
                  padding: 8,
                  borderRadius: 18,
                  border: "1px solid var(--sl-ui-modal-border)",
                  background: "var(--sl-ui-modal-bg)",
                  boxShadow: "var(--sl-ui-surface-shadow)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectTenantFilter?.("all");
                    setFilterOpen(false);
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 8,
                    alignItems: "center",
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: selectedFilterKey === "all"
                      ? "1px solid var(--sl-ui-tool-active-border)"
                      : "1px solid var(--sl-ui-modal-border)",
                    background: selectedFilterKey === "all"
                      ? "var(--sl-ui-tool-active-bg)"
                      : "var(--sl-ui-modal-subtle-bg)",
                    color: selectedFilterKey === "all"
                      ? "var(--sl-ui-tool-active-text)"
                      : "var(--sl-ui-text)",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: 900 }}>All Locations</span>
                  {totalUnreadCount > 0 ? (
                    <span style={residentFeedBadgeStyle(unreadTone)}>
                      {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                    </span>
                  ) : null}
                </button>

                {(Array.isArray(tenantOptions) ? tenantOptions : []).map((option) => {
                  const optionKey = String(option?.tenantKey || "").trim().toLowerCase();
                  const optionUnread = Math.max(0, Number(option?.unreadCount || 0));
                  const isSelected = optionKey === selectedFilterKey;
                  return (
                    <button
                      key={optionKey}
                      type="button"
                      onClick={() => {
                        onSelectTenantFilter?.(optionKey);
                        setFilterOpen(false);
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) auto",
                        gap: 8,
                        alignItems: "center",
                        textAlign: "left",
                        padding: "12px 14px",
                        borderRadius: 14,
                        border: isSelected
                          ? "1px solid var(--sl-ui-tool-active-border)"
                          : "1px solid var(--sl-ui-modal-border)",
                        background: isSelected
                          ? "var(--sl-ui-tool-active-bg)"
                          : "var(--sl-ui-modal-subtle-bg)",
                        color: isSelected
                          ? "var(--sl-ui-tool-active-text)"
                          : "var(--sl-ui-text)",
                        cursor: "pointer",
                      }}
                    >
                      <span style={{ display: "grid", gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {String(option?.label || optionKey).trim() || optionKey}
                        </span>
                        {String(option?.subLabel || "").trim() ? (
                          <span style={{ fontSize: 11.5, opacity: 0.72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {String(option.subLabel).trim()}
                          </span>
                        ) : null}
                      </span>
                      {optionUnread > 0 ? (
                        <span style={residentFeedBadgeStyle(unreadTone)}>
                          {optionUnread > 99 ? "99+" : optionUnread}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            overflowY: "auto",
            padding: pageMode
              ? (isWidePageMode
                ? "0 18px 28px 22px"
                : "0 10px 18px 14px")
              : "0 18px 20px 22px",
            marginRight: 4,
            minHeight: 0,
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          {loading && !items.length ? (
            <div style={{ fontSize: 13, opacity: 0.82, color: subtitleColor }}>Loading notifications…</div>
          ) : error ? (
            <div style={{ fontSize: 13, color: "var(--sl-ui-error-text)", lineHeight: 1.45 }}>{error}</div>
          ) : !items.length ? (
            <div style={{ fontSize: 13, opacity: 0.82, color: subtitleColor }}>
              No notifications matched this filter.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, paddingBottom: 2 }}>
              {items.map((item) => {
                const kind = normalizeResidentNotificationKind(item?.kind);
                const isUnread = Boolean(item?.unread);
                const preview = buildResidentNotificationPreview(item);
                const locationLabel = [item?.location_name, item?.location_address].filter(Boolean).join(" • ");
                return (
                  <button
                    key={`${kind}:${String(item?.tenant_key || "").trim()}:${String(item?.id || "").trim()}`}
                    type="button"
                    onClick={() => onOpenNotification?.(item)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: isWidePageMode ? 18 : 16,
                      borderRadius: isWidePageMode ? 22 : 18,
                      border: isUnread
                        ? "1px solid var(--sl-ui-tool-active-border)"
                        : "1px solid var(--sl-ui-feed-card-border)",
                      background: "var(--sl-ui-feed-card-bg)",
                      color: "var(--sl-ui-text)",
                      display: "grid",
                      gap: 10,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
                        <div style={residentFeedBadgeStyle(tenantTone)}>
                          {String(item?.tenant_label || item?.tenant_key || "Location").trim()}
                        </div>
                        <div style={residentFeedBadgeStyle(kindTone)}>
                          {kind === "event" ? "Event" : "Alert"}
                        </div>
                        {item?.topic_label ? (
                          <div style={residentFeedBadgeStyle(kindTone)}>
                            {String(item.topic_label).trim()}
                          </div>
                        ) : null}
                        {isUnread ? <div style={residentFeedBadgeStyle(unreadTone)}>Unread</div> : null}
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontSize: isWidePageMode ? 20 : 17, fontWeight: 900, lineHeight: 1.2 }}>
                        {String(item?.title || "Untitled notification").trim() || "Untitled notification"}
                      </div>
                      {preview ? (
                        <div style={{ fontSize: isWidePageMode ? 14.5 : 13, lineHeight: 1.45, opacity: 0.82 }}>
                          {preview}
                        </div>
                      ) : null}
                      {locationLabel ? (
                        <div style={{ fontSize: 12.5, lineHeight: 1.4, opacity: 0.72 }}>
                          {locationLabel}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 12.5, opacity: 0.72 }}>
                        Open in {String(item?.tenant_label || item?.tenant_key || "location").trim() || "location"}
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 900 }}>
                        View →
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

export function NotificationsController({
  enabled = false,
  open,
  onClose,
  onOpenNotification,
  onLocationSummaryChange,
  refreshToken = 0,
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  supabase,
  authReady = false,
  tenantReady = true,
  resolvedCommunityFeedTenantKey = "",
  communityFeedViewerKey = "",
  emptyMapCommunityFeedReadState,
  loadMapCommunityFeedReadState,
  isUnreadMapCommunityFeedItem,
  isMissingFunctionError,
  isMissingRelationError,
  isExpectedPermissionError,
  normalizeResidentNotificationKind,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTenantFilter, setSelectedTenantFilter] = useState("all");
  const [tenantOptions, setTenantOptions] = useState([]);

  const totalUnreadCount = useMemo(
    () => (tenantOptions || []).reduce(
      (sum, row) => sum + Math.max(0, Number(row?.unreadCount || 0)),
      0
    ),
    [tenantOptions]
  );

  useEffect(() => {
    if (enabled) return;
    setItems([]);
    setLoading(false);
    setError("");
    setSelectedTenantFilter("all");
    setTenantOptions([]);
    onLocationSummaryChange?.([]);
  }, [enabled, onLocationSummaryChange]);

  useEffect(() => {
    setItems([]);
    setLoading(false);
    setError("");
    setSelectedTenantFilter("all");
    setTenantOptions([]);
    onLocationSummaryChange?.([]);
  }, [onLocationSummaryChange, resolvedCommunityFeedTenantKey]);

  const loadResidentNotifications = useCallback(async () => {
    if (!enabled || !authReady || tenantReady === false) return;
    if (!resolvedCommunityFeedTenantKey) {
      setItems([]);
      setTenantOptions([]);
      setLoading(false);
      setError("");
      onLocationSummaryChange?.([]);
      return;
    }

    setLoading(true);
    setError("");

    const tenantFilter =
      String(selectedTenantFilter || "all").trim().toLowerCase() === "all"
        ? null
        : String(selectedTenantFilter || "").trim().toLowerCase();

    try {
      const snapshot = await fetchResidentNotificationsSnapshot({
        supabase,
        tenantFilter,
        communityFeedViewerKey,
        emptyMapCommunityFeedReadState,
        loadMapCommunityFeedReadState,
        isUnreadMapCommunityFeedItem,
        normalizeResidentNotificationKind,
      });
      setItems(snapshot.items);
      setTenantOptions(snapshot.locations);
      setLoading(false);
      onLocationSummaryChange?.(snapshot.locations);
    } catch (firstError) {
      if (!isMissingFunctionError(firstError) && !isMissingRelationError(firstError) && !isExpectedPermissionError(firstError)) {
        console.warn("[resident notifications]", firstError?.message || firstError);
        setError("Could not load notifications right now.");
      } else {
        setError("");
      }
      setItems([]);
      setTenantOptions([]);
      setLoading(false);
      onLocationSummaryChange?.([]);
      return;
    }
  }, [
    authReady,
    communityFeedViewerKey,
    emptyMapCommunityFeedReadState,
    enabled,
    isExpectedPermissionError,
    isMissingFunctionError,
    isMissingRelationError,
    isUnreadMapCommunityFeedItem,
    loadMapCommunityFeedReadState,
    normalizeResidentNotificationKind,
    onLocationSummaryChange,
    resolvedCommunityFeedTenantKey,
    selectedTenantFilter,
    supabase,
    tenantReady,
  ]);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    void loadResidentNotifications().catch((issue) => {
      if (cancelled) return;
      console.warn("[resident notifications]", issue?.message || issue);
      setError("Could not load notifications right now.");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, loadResidentNotifications, refreshToken]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!authReady || tenantReady === false || !resolvedCommunityFeedTenantKey) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void loadResidentNotifications();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [authReady, enabled, loadResidentNotifications, resolvedCommunityFeedTenantKey, tenantReady]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (!authReady || tenantReady === false || !resolvedCommunityFeedTenantKey) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadResidentNotifications();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authReady, enabled, loadResidentNotifications, resolvedCommunityFeedTenantKey, tenantReady]);

  useEffect(() => {
    const normalizedFilter = String(selectedTenantFilter || "all").trim().toLowerCase() || "all";
    if (normalizedFilter === "all") return;
    const stillExists = tenantOptions.some((row) => row.tenantKey === normalizedFilter);
    if (!stillExists) {
      setSelectedTenantFilter("all");
    }
  }, [selectedTenantFilter, tenantOptions]);

  return (
    <NotificationsWindow
      open={open}
      onClose={onClose}
      items={items}
      loading={loading}
      error={error}
      darkMode={darkMode}
      pageMode={pageMode}
      pageTopInset={pageTopInset}
      pageBottomInset={pageBottomInset}
      totalUnreadCount={totalUnreadCount}
      selectedTenantFilter={selectedTenantFilter}
      tenantOptions={tenantOptions}
      onSelectTenantFilter={setSelectedTenantFilter}
      onOpenNotification={onOpenNotification}
      normalizeResidentNotificationKind={normalizeResidentNotificationKind}
    />
  );
}
