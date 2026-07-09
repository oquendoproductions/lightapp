import React, { useEffect, useState } from "react";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";
import {
  fetchTenantPublicDisplayName,
  loadFollowedTenantKeys,
  persistFollowedTenantKey,
} from "./lib/followedCitySupport.js";

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

export function FollowedLocationsModal({
  open,
  onClose,
  onBack,
  cities = [],
  followedTenantKeys = [],
  loading = false,
  onSetFollowed,
  currentTenantKey = "",
  currentCityLabel = "",
  onSwitchTenant,
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  inputStyle = {},
}) {
  const [query, setQuery] = useState("");
  const [displayNameByTenant, setDisplayNameByTenant] = useState({});
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const currentTenantKeyNormalized = String(currentTenantKey || "").trim().toLowerCase();
    const seededNames = {};
    for (const city of Array.isArray(cities) ? cities : []) {
      const key = String(city?.tenantKey || "").trim().toLowerCase();
      const label = String(city?.displayName || city?.name || "").trim();
      if (key && label) seededNames[key] = label;
    }
    if (currentTenantKeyNormalized && String(currentCityLabel || "").trim()) {
      seededNames[currentTenantKeyNormalized] = String(currentCityLabel || "").trim();
    }
    setDisplayNameByTenant((prev) => ({ ...(prev || {}), ...seededNames }));

    const followedKeys = (Array.isArray(followedTenantKeys) ? followedTenantKeys : [])
      .map((key) => String(key || "").trim().toLowerCase())
      .filter(Boolean);
    const missingKeys = followedKeys.filter((key) => !String(seededNames[key] || "").trim());
    if (!missingKeys.length) return () => {
      cancelled = true;
    };

    (async () => {
      const results = await Promise.all(
        missingKeys.map(async (key) => [key, await fetchTenantPublicDisplayName(key)])
      );
      if (cancelled) return;
      setDisplayNameByTenant((prev) => {
        const next = { ...(prev || {}) };
        for (const [key, label] of results) {
          const safeKey = String(key || "").trim().toLowerCase();
          const safeLabel = String(label || "").trim();
          if (safeKey && safeLabel) next[safeKey] = safeLabel;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [cities, currentCityLabel, currentTenantKey, followedTenantKeys, open]);

  if (!open) return null;

  const normalizedQuery = String(query || "").trim().toLowerCase();
  const followedKeySet = new Set(
    (Array.isArray(followedTenantKeys) ? followedTenantKeys : [])
      .map((key) => String(key || "").trim().toLowerCase())
      .filter(Boolean)
  );
  const cityList = Array.isArray(cities) ? cities.filter(Boolean) : [];
  const cityByKey = new Map(
    cityList
      .map((city) => [String(city?.tenantKey || "").trim().toLowerCase(), city])
      .filter(([key]) => Boolean(key))
  );
  const searchedCities = normalizedQuery
    ? cityList.filter((city) => {
        const haystack = [
          city?.displayName,
          city?.name,
          city?.tenantKey,
          city?.primarySubdomain,
          city?.routeSlug,
        ]
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(Boolean)
          .join(" ");
        return haystack.includes(normalizedQuery);
      })
    : [];

  const isWidePageMode = pageMode && typeof window !== "undefined" && window.innerWidth >= 900;
  const tileBorder = darkMode ? "1px solid rgba(143, 170, 198, 0.18)" : "1px solid rgba(23, 49, 79, 0.10)";
  const tileBackground = darkMode
    ? "linear-gradient(180deg, rgba(23, 37, 53, 0.96) 0%, rgba(17, 28, 40, 0.96) 100%)"
    : "linear-gradient(180deg, rgba(251, 253, 255, 0.96) 0%, rgba(242, 247, 251, 0.96) 100%)";

  const currentTenantKeyNormalized = String(currentTenantKey || "").trim().toLowerCase();
  const currentCity = currentTenantKeyNormalized
    ? (
      cityByKey.get(currentTenantKeyNormalized)
      || {
        tenantKey: currentTenantKeyNormalized,
        name: String(displayNameByTenant?.[currentTenantKeyNormalized] || currentCityLabel || currentTenantKeyNormalized).trim() || currentTenantKeyNormalized,
        displayName: String(displayNameByTenant?.[currentTenantKeyNormalized] || currentCityLabel || currentTenantKeyNormalized).trim() || currentTenantKeyNormalized,
      }
    )
    : null;
  const followedCities = [
    ...(currentCity ? [currentCity] : []),
    ...[...followedKeySet]
      .filter((key) => key !== currentTenantKeyNormalized)
      .map((key) => {
        const fallbackDisplayName = String(displayNameByTenant?.[key] || "").trim();
        return cityByKey.get(key) || {
          tenantKey: key,
          name: fallbackDisplayName || key,
          displayName: fallbackDisplayName || key,
        };
      }),
  ].sort((a, b) => {
    const aKey = String(a?.tenantKey || "").trim().toLowerCase();
    const bKey = String(b?.tenantKey || "").trim().toLowerCase();
    if (aKey === currentTenantKeyNormalized && bKey !== currentTenantKeyNormalized) return -1;
    if (bKey === currentTenantKeyNormalized && aKey !== currentTenantKeyNormalized) return 1;
    return String(a?.displayName || a?.name || aKey).localeCompare(
      String(b?.displayName || b?.name || bKey),
      undefined,
      { sensitivity: "base" }
    );
  });
  const currentFollowedCity = followedCities.find((city) => String(city?.tenantKey || "").trim().toLowerCase() === currentTenantKeyNormalized) || null;
  const otherFollowedCities = followedCities.filter((city) => String(city?.tenantKey || "").trim().toLowerCase() !== currentTenantKeyNormalized);

  const cityRow = (city, { searching = false } = {}) => {
    const key = String(city?.tenantKey || city?.tenant_key || "").trim().toLowerCase();
    if (!key) return null;
    const isFollowed = followedKeySet.has(key);
    const isBusy = String(busyKey || "").trim().toLowerCase() === key;
    const isCurrent = key === currentTenantKeyNormalized;
    const resolvedCity = cityByKey.get(key) || city || null;
    const label = String(
      displayNameByTenant?.[key]
      || ""
    ).trim() || String(
      resolvedCity?.displayName
      || resolvedCity?.name
      || (isCurrent ? currentCityLabel : "")
      || key
    ).trim() || key;
    return (
      <div
        key={`${searching ? "search" : "followed"}-${key}`}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 10,
          alignItems: "center",
          padding: "13px 14px",
          borderRadius: 18,
          border: isCurrent
            ? "1px solid rgba(25,118,210,0.38)"
            : tileBorder,
          background: tileBackground,
        }}
      >
        <button
          type="button"
          disabled={searching || isBusy || !isFollowed || isCurrent || typeof onSwitchTenant !== "function"}
          onClick={() => {
            if (!searching && isFollowed && !isCurrent) {
              void onSwitchTenant?.(key);
            }
          }}
          style={{
            minWidth: 0,
            display: "grid",
            gap: 3,
            textAlign: "left",
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            color: "var(--sl-ui-text)",
            cursor: !searching && isFollowed && !isCurrent && typeof onSwitchTenant === "function"
              ? "pointer"
              : "default",
          }}
          title={!searching && isFollowed && !isCurrent ? `Switch to ${label}` : label}
        >
          <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.15, color: "var(--sl-ui-text)" }}>
            {label}
          </div>
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            if (isFollowed) {
              const ok = window.confirm(`Remove ${label} from My Locations?`);
              if (!ok) return;
            }
            if (typeof onSetFollowed !== "function") return;
            setBusyKey(key);
            Promise.resolve(onSetFollowed(key, !isFollowed, { label }))
              .finally(() => {
                setBusyKey((prev) => (prev === key ? "" : prev));
              });
          }}
          style={{
            padding: "9px 12px",
            borderRadius: 999,
            border: isFollowed ? "1px solid rgba(198, 40, 40, 0.32)" : "1px solid rgba(28, 128, 98, 0.36)",
            background: isFollowed ? "rgba(198, 40, 40, 0.10)" : "rgba(28, 128, 98, 0.16)",
            color: isFollowed ? "#c62828" : "var(--sl-ui-text)",
            fontSize: 12.5,
            fontWeight: 900,
            cursor: isBusy ? "wait" : "pointer",
            opacity: isBusy ? 0.68 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isBusy ? "Saving…" : isFollowed ? "Remove" : "Follow"}
        </button>
      </div>
    );
  };

  return (
    <ModalShell
      open={open}
      zIndex={10050}
      panelStyle={{
        width: pageMode ? "100vw" : "min(760px, 100%)",
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: pageMode ? (isWidePageMode ? "22px 22px 16px" : "14px 14px 12px") : "22px 22px 18px" }}>
          <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
            {pageMode ? (
              <button
                type="button"
                onClick={onBack || onClose}
                style={{
                  width: "fit-content",
                  padding: 0,
                  border: "none",
                  background: "transparent",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                ← Back
              </button>
            ) : null}
            <div style={{ fontSize: isWidePageMode ? 30 : 24, fontWeight: 900, lineHeight: 1.05, color: "var(--sl-ui-text)" }}>
              My Locations
            </div>
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
              aria-label="Close followed locations"
            >
              ✕
            </button>
          ) : null}
        </div>

        <div style={{ overflowY: "auto", padding: pageMode ? (isWidePageMode ? "16px 22px 24px" : "12px 14px 18px") : "0 22px 22px", display: "grid", alignContent: "start", gap: 14 }}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search city name"
            style={{ ...inputStyle, width: "100%", borderRadius: 16, minHeight: isWidePageMode ? 50 : undefined, fontSize: isWidePageMode ? 15 : undefined }}
            autoCapitalize="words"
            autoCorrect="off"
          />
          <div style={{ fontSize: isWidePageMode ? 14 : 12.5, lineHeight: 1.45, opacity: 0.8, marginTop: -4 }}>
            Tap a saved city to switch locations. Search to add another public map.
          </div>

          {normalizedQuery ? (
            <div style={{ display: "grid", gap: 9 }}>
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Search results
              </div>
              {searchedCities.length ? searchedCities.map((city) => cityRow(city, { searching: true })) : (
                <div style={{ padding: "14px 16px", borderRadius: 18, border: tileBorder, background: tileBackground, fontSize: 13.5, opacity: 0.82 }}>
                  No locations matched that search.
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 9 }}>
              {loading ? (
                <div style={{ padding: "14px 16px", borderRadius: 18, border: tileBorder, background: tileBackground, fontSize: 13.5, opacity: 0.82 }}>
                  Loading your locations…
                </div>
              ) : followedCities.length ? (
                <>
                  {currentFollowedCity ? (
                    <div style={{ display: "grid", gap: 9 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Current location
                      </div>
                      {cityRow(currentFollowedCity)}
                    </div>
                  ) : null}
                  {otherFollowedCities.length ? (
                    <div style={{ display: "grid", gap: 9 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        Following
                      </div>
                      {otherFollowedCities.map((city) => cityRow(city))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ padding: "14px 16px", borderRadius: 18, border: tileBorder, background: tileBackground, fontSize: 13.5, opacity: 0.82, lineHeight: 1.45 }}>
                  You do not have any saved locations yet. Search above to add your first city.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

export function FollowedLocationsController({
  open,
  sessionUserId = "",
  supabase = null,
  openNotice = null,
  ...props
}) {
  const [followedTenantKeys, setFollowedTenantKeys] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowedCitiesForUser() {
      if (!open) {
        setLoading(false);
        return;
      }

      const userId = String(sessionUserId || "").trim();
      if (!userId || !supabase) {
        setFollowedTenantKeys([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const nextKeys = await loadFollowedTenantKeys({ supabase, userId });
        if (cancelled) return;
        setFollowedTenantKeys(nextKeys);
      } catch (error) {
        if (cancelled) return;
        console.warn("[followed-locations]", error?.message || error);
        setFollowedTenantKeys([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFollowedCitiesForUser();
    return () => {
      cancelled = true;
    };
  }, [open, sessionUserId, supabase]);

  const handleSetFollowed = async (tenantKeyValue, shouldFollow, options = {}) => {
    const userId = String(sessionUserId || "").trim();
    const tenantKey = String(tenantKeyValue || "").trim().toLowerCase();
    if (!userId || !tenantKey || !supabase) return false;

    try {
      await persistFollowedTenantKey({
        supabase,
        userId,
        tenantKey,
        shouldFollow,
      });
      setFollowedTenantKeys((prev) => {
        const normalized = [...new Set(
          (Array.isArray(prev) ? prev : [])
            .map((key) => String(key || "").trim().toLowerCase())
            .filter(Boolean)
        )];
        if (!shouldFollow) return normalized.filter((key) => key !== tenantKey);
        return normalized.includes(tenantKey) ? normalized : [tenantKey, ...normalized];
      });
      if (typeof openNotice === "function") {
        const label = String(options?.label || "City").trim() || "City";
        openNotice(
          "✅",
          shouldFollow ? "City followed" : "City removed",
          shouldFollow
            ? `${label} will now appear in your switch-city list.`
            : `${label} was removed from your switch-city list.`,
          { autoCloseMs: 1400, compact: true }
        );
      }
      return true;
    } catch (error) {
      if (typeof openNotice === "function") {
        openNotice("⚠️", "Couldn’t save city", error?.message || "Please try again.");
      } else {
        console.warn("[followed-locations]", error?.message || error);
      }
      return false;
    }
  };

  return (
    <FollowedLocationsModal
      {...props}
      open={open}
      followedTenantKeys={followedTenantKeys}
      loading={loading}
      onSetFollowed={handleSetFollowed}
    />
  );
}

export function AccountMenuPanel({
  open,
  session,
  profile,
  onClose,
  showCitySwitcher = false,
  onOpenCitySwitcher,
  onManage,
  onMyReports,
  onFollowedLocations,
  onNotificationPreferences,
  onContactUs,
  onOpenInfo,
  onLogout,
  showNotificationPreferences = true,
  variant = "modal",
  containerRef = null,
  darkMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
}) {
  if (!open) return null;
  const isWidePage = variant === "mobile-page" && typeof window !== "undefined" && window.innerWidth >= 900;

  const sessionEmail = session?.user?.email || "";
  const meta = session?.user?.user_metadata || {};

  const displayName =
    (profile?.full_name || "").trim() ||
    (meta.full_name || meta.name || "").trim() ||
    (sessionEmail ? sessionEmail.split("@")[0] : "—");

  const displayEmail =
    (profile?.email || "").trim() ||
    sessionEmail ||
    "—";

  const panelStyle = {
    border: "1px solid var(--sl-ui-surface-border)",
    background: "color-mix(in srgb, var(--sl-ui-surface-bg) 96%, transparent)",
    boxShadow: "var(--sl-ui-surface-shadow)",
    color: "var(--sl-ui-text)",
  };

  const eyebrowStyle = { color: "color-mix(in srgb, var(--sl-ui-text) 72%, transparent)" };
  const titleStyle = { color: "var(--sl-ui-text)" };
  const subtitleStyle = { color: "color-mix(in srgb, var(--sl-ui-text) 78%, transparent)" };
  const wideButtonStyle = isWidePage ? { fontSize: 16, padding: "14px 16px", borderRadius: 16 } : null;
  const wideEyebrowStyle = isWidePage ? { fontSize: 13 } : null;
  const wideTitleStyle = isWidePage ? { fontSize: 26 } : null;
  const wideMetaStyle = isWidePage ? { fontSize: 15 } : null;
  const buttonStyle = {
    border: "1px solid var(--sl-ui-tool-btn-border)",
    background: "color-mix(in srgb, var(--sl-ui-tool-btn-bg) 82%, var(--sl-ui-surface-bg) 18%)",
    color: "var(--sl-ui-tool-btn-text)",
    boxShadow: "var(--sl-ui-tool-btn-shadow)",
  };

  const menuBody = session ? (
    <>
      <div className="workspace-menu-account">
        <div className="workspace-menu-eyebrow" style={{ ...(eyebrowStyle || {}), ...(wideEyebrowStyle || {}) }}>
          Signed In
        </div>
        <div className="workspace-menu-title" style={{ ...(titleStyle || {}), ...(wideTitleStyle || {}) }}>{displayName}</div>
        <div className="workspace-menu-meta" style={{ ...(subtitleStyle || {}), ...(wideMetaStyle || {}) }}>{displayEmail}</div>
      </div>

      <div className="workspace-menu-actions">
        <button onClick={onManage} className="workspace-menu-button" style={{ ...(buttonStyle || {}), ...(wideButtonStyle || {}) }}>
          Manage Account
        </button>
        <button onClick={onFollowedLocations} className="workspace-menu-button" style={{ ...(buttonStyle || {}), ...(wideButtonStyle || {}) }}>
          My Locations
        </button>
        {showNotificationPreferences ? (
          <button onClick={onNotificationPreferences} className="workspace-menu-button" style={{ ...(buttonStyle || {}), ...(wideButtonStyle || {}) }}>
            Notification Preferences
          </button>
        ) : null}
        {variant === "desktop-popout" || variant === "modal" ? (
          <button onClick={onMyReports} className="workspace-menu-button" style={{ ...(buttonStyle || {}), ...(wideButtonStyle || {}) }}>
            My Reports
          </button>
        ) : null}
        <button onClick={onLogout} className="workspace-menu-button" style={{ ...(buttonStyle || {}), ...(wideButtonStyle || {}) }}>
          Logout
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="workspace-menu-account">
        <div className="workspace-menu-eyebrow" style={{ ...(eyebrowStyle || {}), ...(wideEyebrowStyle || {}) }}>
          Account
        </div>
        <div className="workspace-menu-title" style={{ ...(titleStyle || {}), ...(wideTitleStyle || {}) }}>
          Log in or create an account
        </div>
        <div className="workspace-menu-subtitle" style={{ ...(subtitleStyle || {}), ...(wideMetaStyle || {}) }}>
          Sign in to view your report history and manage your account.
        </div>
      </div>

      <div className="workspace-menu-actions">
        <button
          onClick={() => {
            onClose();
            window.__openAuthGate?.("login");
          }}
          className="workspace-menu-button"
          style={{ ...(buttonStyle || {}), ...(wideButtonStyle || {}) }}
        >
          Log in
        </button>
        <button
          onClick={() => {
            onClose();
            window.__openAuthGate?.("signup");
          }}
          className="workspace-menu-button"
          style={{ ...(buttonStyle || {}), ...(wideButtonStyle || {}) }}
        >
          Create account
        </button>
        {variant === "modal" ? (
          <button onClick={onClose} className="workspace-menu-button" style={{ ...(buttonStyle || {}), ...(wideButtonStyle || {}) }}>
            Close
          </button>
        ) : null}
      </div>
    </>
  );

  if (variant === "desktop-popout") {
    return (
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          top: "calc(var(--desktop-header-height) + 8px)",
          right: "var(--desktop-header-horizontal-padding)",
          width: "min(320px, calc(100vw - 32px))",
          maxWidth: "calc(100vw - 32px)",
          zIndex: 2600,
          pointerEvents: "auto",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="workspace-menu-panel" style={panelStyle}>
          {menuBody}
        </div>
      </div>
    );
  }

  if (variant === "mobile-popout") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10010,
          display: "grid",
          alignItems: "end",
          justifyItems: "center",
          pointerEvents: "auto",
          padding: "16px 10px calc(env(safe-area-inset-bottom) + 116px)",
          background: "rgba(0,0,0,0.14)",
        }}
        onClick={onClose}
      >
        <div
          className="workspace-menu-panel"
          style={{
            width: "min(360px, calc(100vw - 20px))",
            maxWidth: "calc(100vw - 20px)",
            pointerEvents: "auto",
            ...(panelStyle || {}),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 950, color: "var(--sl-ui-text)" }}>Account</div>
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-tool-btn-border)",
                background: "color-mix(in srgb, var(--sl-ui-tool-btn-bg) 82%, var(--sl-ui-surface-bg) 18%)",
                color: "var(--sl-ui-tool-btn-text)",
                boxShadow: "var(--sl-ui-tool-btn-shadow)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Close account menu"
              title="Close"
            >
              ✕
            </button>
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {menuBody}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "mobile-page") {
    return (
      <div
        style={{
          position: "fixed",
          top: pageTopInset,
          left: 0,
          right: 0,
          bottom: pageBottomInset,
          zIndex: 1505,
          background: "var(--sl-ui-modal-bg)",
          color: "var(--sl-ui-text)",
          pointerEvents: "auto",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            overflowY: "auto",
            padding: isWidePage
              ? "24px 24px 28px"
              : "14px 14px 20px",
          }}
        >
          <div style={{ display: "grid", gap: isWidePage ? 18 : 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div
                style={{
                  width: isWidePage ? 54 : 46,
                  height: isWidePage ? 54 : 46,
                  borderRadius: isWidePage ? 18 : 16,
                  background: "var(--sl-ui-feed-card-bg)",
                  border: "1px solid var(--sl-ui-feed-card-border)",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                }}
              >
                <AppIcon src={uiIconSrc.account} iconKey="account" darkMode={darkMode} size={isWidePage ? 30 : 26} />
              </div>
              <div style={{ fontSize: isWidePage ? 32 : 24, fontWeight: 950, lineHeight: 1.05, color: "var(--sl-ui-text)", minWidth: 0 }}>
                Account
              </div>
            </div>

            <div
              className="workspace-menu-panel"
              style={{
                width: isWidePage ? "min(560px, 100%)" : undefined,
                maxWidth: isWidePage ? "100%" : undefined,
                borderRadius: isWidePage ? 22 : 18,
                padding: isWidePage ? "30px 34px 34px" : undefined,
                ...(panelStyle || {}),
              }}
            >
              {menuBody}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sl-overlay-pass"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10010,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        padding: "16px 56px 16px 16px",
      }}
    >
      <div
        className="workspace-menu-panel"
        style={{
          width: "min(320px, calc(100vw - 112px))",
          pointerEvents: "auto",
          ...(panelStyle || {}),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: "var(--sl-ui-text)" }}>Account</div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "1px solid var(--sl-ui-tool-btn-border)",
              background: "color-mix(in srgb, var(--sl-ui-tool-btn-bg) 82%, var(--sl-ui-surface-bg) 18%)",
              color: "var(--sl-ui-tool-btn-text)",
              boxShadow: "var(--sl-ui-tool-btn-shadow)",
              fontWeight: 900,
              cursor: "pointer",
            }}
            aria-label="Close account menu"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {menuBody}
        </div>
      </div>
    </div>
  );
}
