import React, { useEffect, useMemo, useState } from "react";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_UI_ICON_SRC as uiIconSrc } from "./mapUiIconRuntimeSupport.js";
import { STANDARD_LOGIN_EMAIL_INPUT_PROPS, getStandardLoginPasswordInputProps } from "./auth/loginFieldStandards";
import {
  fetchTenantPublicDisplayName,
  loadFollowedTenantKeys,
} from "./lib/followedCitySupport.js";
import { openExternalUrl } from "./platform/external.js";

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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function GuestInfoModal({ open, info, setInfo, onContinue, onCancel, inputStyle = {}, btnPrimary = {}, btnSecondary = {} }) {
  const nameOk = info.name.trim().length > 0;
  const emailOk = Boolean(normalizeEmail(info.email));
  const ok = nameOk && emailOk;

  return (
    <ModalShell open={open} zIndex={10029}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Guest info required</div>
      <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.35 }}>
        Please provide your name and email. Phone is optional.
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Name</div>
        <input
          value={info.name}
          onChange={(e) => setInfo((p) => ({ ...p, name: e.target.value }))}
          style={inputStyle}
          placeholder="Your name"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Phone</div>
        <input
          value={info.phone}
          onChange={(e) => setInfo((p) => ({ ...p, phone: e.target.value }))}
          style={inputStyle}
          placeholder="555-555-5555 (optional)"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Email</div>
        <input
          value={info.email}
          onChange={(e) => setInfo((p) => ({ ...p, email: e.target.value }))}
          style={inputStyle}
          placeholder="name@email.com"
        />
      </label>

      {!ok && (
        <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 900 }}>
          Name and email are required.
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
        <button onClick={onContinue} disabled={!ok} style={{ ...btnPrimary, opacity: ok ? 1 : 0.6 }}>
          Continue
        </button>
      </div>
    </ModalShell>
  );
}

export function LocationPromptModal({ open, onContinue, btnPrimary = {} }) {
  return (
    <ModalShell open={open} zIndex={10007}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Allow location access?</div>
      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        CityReport uses your location to center the map near you and help place reports more accurately.
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button onClick={onContinue} style={btnPrimary}>Continue</button>
      </div>
    </ModalShell>
  );
}

export function ContactRequiredModal({ open, onLogin, onSignup, onGuest, onClose, btnPrimary = {}, btnSecondary = {}, btnPrimaryDark = {} }) {
  return (
    <ModalShell open={open} zIndex={10028}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Contact required</div>

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        To submit a report, we need your name and either a phone number or email.
        <div style={{ marginTop: 8, fontWeight: 900 }}>
          Choose an option to continue:
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={onLogin} style={btnPrimaryDark}>Log in</button>
        <button onClick={onSignup} style={btnPrimary}>Create account</button>
        <button onClick={onGuest} style={btnSecondary}>Continue as guest</button>
      </div>

      <button onClick={onClose} style={{ ...btnSecondary, marginTop: 2 }}>
        Cancel
      </button>
    </ModalShell>
  );
}

export function NoticeModal({
  open,
  icon,
  iconKey = "",
  title,
  message,
  buttonText = "OK",
  onClose,
  compact = false,
}) {
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10020}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: compact ? "center" : "flex-start",
          padding: compact ? "6px 0" : 0,
        }}
      >
        <div style={{ fontSize: compact ? 26 : 22, lineHeight: 1, minWidth: compact ? 30 : 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {iconKey && uiIconSrc?.[iconKey] ? (
            <AppIcon src={uiIconSrc[iconKey]} iconKey={iconKey} size={compact ? 26 : 22} />
          ) : (
            icon
          )}
        </div>

        {!compact && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
            <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.35 }}>{message}</div>
          </div>
        )}
      </div>

      {!compact && (
        <button
          onClick={onClose}
          style={{
            marginTop: 6,
            padding: 10,
            borderRadius: 10,
            border: "none",
            background: "var(--sl-ui-brand-blue)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            width: "100%",
          }}
        >
          {buttonText}
        </button>
      )}
    </ModalShell>
  );
}

export function ForgotPasswordModal({
  open,
  email,
  setEmail,
  loading,
  errorText,
  onSend,
  onClose,
  inputStyle = {},
  btnSecondary = {},
  btnPrimaryDark = {},
}) {
  if (!open) return null;
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

  return (
    <ModalShell
      open={open}
      zIndex={10031}
      panelStyle={{
        width: "min(360px, 100%)",
        fontSize: 16,
        WebkitTextSizeAdjust: "100%",
        textSizeAdjust: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Reset password</div>
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

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        Enter your account email and we’ll send a password reset link.
      </div>

      <input
        placeholder="Email"
        type="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
        autoCapitalize="none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading && emailLooksValid) onSend();
        }}
      />

      {!!errorText && (
        <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 900 }}>
          {errorText}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        <button
          onClick={onSend}
          disabled={loading || !emailLooksValid}
          style={{
            ...btnPrimaryDark,
            background: emailLooksValid ? "#1976d2" : "#111",
            opacity: loading || !emailLooksValid ? 0.65 : 1,
            cursor: loading || !emailLooksValid ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending reset…" : "Send reset email"}
        </button>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
      </div>
    </ModalShell>
  );
}

export function CitySwitcherModal({
  open,
  onClose,
  cities = [],
  followedTenantKeys = [],
  followedCitiesLoading = false,
  signedIn = false,
  currentTenantKey = "",
  currentCityLabel = "",
  switchingTenant = "",
  onSwitchTenant,
  inputStyle = {},
  btnSecondary = {},
}) {
  const [query, setQuery] = useState("");
  const [displayNameByTenant, setDisplayNameByTenant] = useState({});

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

    const missingKeys = (Array.isArray(followedTenantKeys) ? followedTenantKeys : [])
      .map((key) => String(key || "").trim().toLowerCase())
      .filter(Boolean)
      .filter((key) => !String(seededNames[key] || "").trim());
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

  const normalizedQuery = String(query || "").trim().toLowerCase();
  const followedCities = useMemo(() => {
    const cityList = Array.isArray(cities) ? cities.filter(Boolean) : [];
    const cityByKey = new Map(
      cityList
        .map((city) => [String(city?.tenantKey || "").trim().toLowerCase(), city])
        .filter(([key]) => Boolean(key))
    );
    return (Array.isArray(followedTenantKeys) ? followedTenantKeys : [])
      .map((key) => String(key || "").trim().toLowerCase())
      .filter(Boolean)
      .filter((key, index, arr) => arr.indexOf(key) === index)
      .map((key) => {
        const city = cityByKey.get(key) || null;
        const label = String(
          displayNameByTenant?.[key]
          || city?.displayName
          || city?.name
          || key
        ).trim() || key;
        return city
          ? { ...city, displayName: label, name: label }
          : { tenantKey: key, displayName: label, name: label };
      });
  }, [cities, displayNameByTenant, followedTenantKeys]);

  const filteredCities = useMemo(() => {
    const sourceCities = normalizedQuery ? cities : followedCities;
    return sourceCities.filter((city) => {
      const haystack = [
        city?.displayName,
        city?.name,
        city?.tenantKey,
        city?.primarySubdomain,
        city?.routeSlug,
      ]
        .map((part) => String(part || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");
      return haystack.includes(normalizedQuery);
    });
  }, [cities, followedCities, normalizedQuery]);
  const emptyMessage = normalizedQuery
    ? "No matching cities found."
    : followedCitiesLoading
      ? "Loading your followed locations…"
      : signedIn
        ? "You are not following any locations yet. Search for a city to switch or add one later from Account."
        : "Search for a city to switch locations. Sign in later to keep followed locations here.";

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      zIndex={10061}
      panelStyle={{ width: "min(560px, calc(100vw - 24px))", maxHeight: "80vh", overflow: "auto" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}>
          <div style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.1 }}>Switch City</div>
          <div style={{ fontSize: 12, opacity: 0.78, lineHeight: 1.3 }}>
            Your followed locations appear here. Search to find any other public city map.
          </div>
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
        <div style={{ fontSize: 12.5, lineHeight: 1.35 }}>
          <b>Current city:</b> {String(currentCityLabel || "Unknown city").trim() || "Unknown city"}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city name"
          style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
          autoCapitalize="words"
        />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {!normalizedQuery && filteredCities.length ? (
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.3, opacity: 0.7, textTransform: "uppercase" }}>
            Followed locations
          </div>
        ) : null}
        {filteredCities.length ? (
          filteredCities.map((city) => {
            const tenantKey = String(city?.tenantKey || "").trim().toLowerCase();
            const isCurrent = tenantKey === String(currentTenantKey || "").trim().toLowerCase();
            const isSwitching = tenantKey === String(switchingTenant || "").trim().toLowerCase();
            const secondaryLabel =
              String(city?.primarySubdomain || city?.routeSlug || city?.tenantKey || "").trim() || tenantKey;
            return (
              <button
                key={tenantKey}
                type="button"
                disabled={Boolean(switchingTenant)}
                onClick={async () => {
                  if (isCurrent) {
                    onClose?.();
                    return;
                  }
                  if (typeof onSwitchTenant === "function") {
                    await onSwitchTenant(tenantKey);
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  borderRadius: 12,
                  border: isCurrent
                    ? "1px solid rgba(25,118,210,0.48)"
                    : "1px solid var(--sl-ui-modal-border)",
                  background: isCurrent ? "rgba(25,118,210,0.12)" : "var(--sl-ui-modal-subtle-bg)",
                  color: "var(--sl-ui-text)",
                  padding: 12,
                  display: "grid",
                  gap: 6,
                  cursor: Boolean(switchingTenant) ? "not-allowed" : "pointer",
                  opacity: Boolean(switchingTenant) && !isSwitching ? 0.7 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.2 }}>
                    {String(city?.displayName || city?.name || tenantKey).trim() || tenantKey}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      letterSpacing: 0.2,
                      padding: "4px 8px",
                      borderRadius: 999,
                      background: isCurrent ? "rgba(25,118,210,0.18)" : "rgba(17,17,17,0.08)",
                      color: isCurrent ? "#1976d2" : "inherit",
                    }}
                  >
                    {isSwitching ? "Switching…" : isCurrent ? "Current" : "Open"}
                  </div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.74, lineHeight: 1.3 }}>{secondaryLabel}</div>
              </button>
            );
          })
        ) : (
          <div
            style={{
              border: "1px solid var(--sl-ui-modal-border)",
              borderRadius: 12,
              padding: 12,
              background: "var(--sl-ui-modal-subtle-bg)",
              fontSize: 12.5,
              opacity: 0.82,
              lineHeight: 1.35,
            }}
          >
            {emptyMessage}
          </div>
        )}
      </div>

      <button onClick={onClose} style={btnSecondary}>Close</button>
    </ModalShell>
  );
}

export function CitySwitcherController({
  open,
  sessionUserId = "",
  supabase = null,
  ...props
}) {
  const [followedTenantKeys, setFollowedTenantKeys] = useState([]);
  const [followedCitiesLoading, setFollowedCitiesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFollowedCitiesForUser() {
      if (!open) {
        setFollowedCitiesLoading(false);
        return;
      }

      const userId = String(sessionUserId || "").trim();
      if (!userId || !supabase) {
        setFollowedTenantKeys([]);
        setFollowedCitiesLoading(false);
        return;
      }

      setFollowedCitiesLoading(true);
      try {
        const nextKeys = await loadFollowedTenantKeys({ supabase, userId });
        if (cancelled) return;
        setFollowedTenantKeys(nextKeys);
      } catch (error) {
        if (cancelled) return;
        console.warn("[city-switcher][followed-locations-failed]", error?.message || error);
        setFollowedTenantKeys([]);
      } finally {
        if (!cancelled) {
          setFollowedCitiesLoading(false);
        }
      }
    }

    void loadFollowedCitiesForUser();
    return () => {
      cancelled = true;
    };
  }, [open, sessionUserId, supabase]);

  return (
    <CitySwitcherModal
      {...props}
      open={open}
      followedTenantKeys={followedTenantKeys}
      followedCitiesLoading={followedCitiesLoading}
      signedIn={Boolean(String(sessionUserId || "").trim())}
    />
  );
}

export function AuthGateModal({
  open,
  step,
  setStep,
  onContinueGuest,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authLoading,
  loginError,
  clearLoginError,
  onOpenForgotPassword,
  onLogin,
  signupName,
  setSignupName,
  signupPhone,
  setSignupPhone,
  signupEmail,
  setSignupEmail,
  signupPassword,
  setSignupPassword,
  signupLoading,
  onCreateAccount,
  signupPassword2,
  setSignupPassword2,
  signupLegalAccepted,
  setSignupLegalAccepted,
  onOpenTerms,
  onOpenPrivacy,
  inputStyle = {},
}) {
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupPassword2, setShowSignupPassword2] = useState(false);
  const hasSignupLen = String(signupPassword || "").length >= 8;
  const hasSignupUpper = /[A-Z]/.test(String(signupPassword || ""));
  const hasSignupLower = /[a-z]/.test(String(signupPassword || ""));
  const hasSignupNumber = /[0-9]/.test(String(signupPassword || ""));
  const hasSignupSpecial = /[^A-Za-z0-9]/.test(String(signupPassword || ""));
  const signupMatches = !!signupPassword2 && signupPassword === signupPassword2;
  const reqColor = (ok) => (ok ? "#2ecc71" : "#ff5252");

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      zIndex={10030}
      panelStyle={{
        maxHeight: "min(92dvh, 760px)",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {step === "welcome" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Welcome</div>
            <button
              onClick={onContinueGuest}
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

          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Log in or create an account to view your past reports.
            <br />
            Guests can report, but must provide name + email. Phone is optional.
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <button
              onClick={() => setStep("login")}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "none",
                background: "var(--sl-ui-brand-green)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Log in
            </button>

            <button
              onClick={() => setStep("signup")}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "none",
                background: "var(--sl-ui-brand-blue)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Create account
            </button>

            <button
              onClick={onContinueGuest}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Continue as guest
            </button>
          </div>
        </>
      )}

      {step === "login" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Log in</div>
            <button
              onClick={() => setStep("welcome")}
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
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
          </div>

          <input
            {...STANDARD_LOGIN_EMAIL_INPUT_PROPS}
            value={authEmail}
            onChange={(e) => {
              clearLoginError?.();
              setAuthEmail(e.target.value);
            }}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
          />
          <div style={{ position: "relative" }}>
            <input
              {...getStandardLoginPasswordInputProps(showLoginPassword)}
              value={authPassword}
              onChange={(e) => {
                clearLoginError?.();
                setAuthPassword(e.target.value);
              }}
              style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !authLoading) onLogin();
              }}
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "#1976d2",
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
                fontSize: 12.5,
                lineHeight: 1,
              }}
            >
              {showLoginPassword ? "Hide" : "Show"}
            </button>
          </div>
          {!!String(loginError || "").trim() && (
            <div
              style={{
                marginTop: 2,
                fontSize: 12.5,
                lineHeight: 1.35,
                fontWeight: 800,
                borderRadius: 10,
                padding: "8px 10px",
                background: "var(--sl-ui-alert-danger-bg)",
                border: "1px solid var(--sl-ui-alert-danger-border)",
                color: "var(--sl-ui-alert-danger-text)",
              }}
            >
              Sign in failed: invalid email or password.
            </div>
          )}

          <button
            type="button"
            onClick={onOpenForgotPassword}
            disabled={authLoading}
            style={{
              padding: 0,
              width: "fit-content",
              borderRadius: 0,
              border: "none",
              background: "transparent",
              color: "#1976d2",
              fontWeight: 800,
              cursor: authLoading ? "not-allowed" : "pointer",
              opacity: authLoading ? 0.65 : 1,
              justifySelf: "start",
            }}
          >
            Forgot password?
          </button>

          <button
            onClick={onLogin}
            disabled={authLoading}
            style={{
              padding: 10,
              width: "100%",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 900,
              cursor: authLoading ? "not-allowed" : "pointer",
              opacity: authLoading ? 0.75 : 1,
            }}
          >
            {authLoading ? "Signing in…" : "Sign in"}
          </button>
        </>
      )}

      {step === "signup" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Create account</div>
            <button
              onClick={() => setStep("welcome")}
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
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
          </div>

          <input
            placeholder="Full name"
            value={signupName}
            onChange={(e) => setSignupName(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
          />

          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.78, letterSpacing: 0.2 }}>
              Phone (optional)
            </div>
            <input
              placeholder="Optional phone number"
              value={signupPhone}
              onChange={(e) => setSignupPhone(e.target.value)}
              style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
            />
          </div>

          <input
            placeholder="Email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
            autoCapitalize="none"
          />

          <div style={{ position: "relative" }}>
            <input
              placeholder="Password (8+ w/ upper, lower, special)"
              type={showSignupPassword ? "text" : "password"}
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !signupLoading) onCreateAccount();
              }}
            />
            <button
              type="button"
              onClick={() => setShowSignupPassword((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "#1976d2",
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
                fontSize: 12.5,
                lineHeight: 1,
              }}
            >
              {showSignupPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "var(--sl-ui-text)", opacity: 0.9 }}>
            Password Requirements
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.35, display: "grid", gap: 2 }}>
            <div style={{ color: reqColor(hasSignupLen), fontWeight: 800 }}>- 8 or more characters</div>
            <div style={{ color: reqColor(hasSignupUpper), fontWeight: 800 }}>- 1 uppercase</div>
            <div style={{ color: reqColor(hasSignupLower), fontWeight: 800 }}>- 1 lowercase</div>
            <div style={{ color: reqColor(hasSignupNumber), fontWeight: 800 }}>- 1 number</div>
            <div style={{ color: reqColor(hasSignupSpecial), fontWeight: 800 }}>- 1 special character</div>
            <div style={{ color: reqColor(signupMatches), fontWeight: 800 }}>- Passwords match</div>
          </div>

          <div style={{ position: "relative" }}>
            <input
              placeholder="Re-enter password"
              type={showSignupPassword2 ? "text" : "password"}
              value={signupPassword2}
              onChange={(e) => setSignupPassword2(e.target.value)}
              style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !signupLoading) onCreateAccount();
              }}
            />
            <button
              type="button"
              onClick={() => setShowSignupPassword2((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "#1976d2",
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
                fontSize: 12.5,
                lineHeight: 1,
              }}
            >
              {showSignupPassword2 ? "Hide" : "Show"}
            </button>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 12.5,
              lineHeight: 1.35,
              opacity: 0.95,
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(signupLegalAccepted)}
              onChange={(e) => setSignupLegalAccepted(Boolean(e.target.checked))}
              style={{ marginTop: 2 }}
            />
            <span>
              I agree to the{" "}
              <button
                type="button"
                onClick={onOpenTerms}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1976d2",
                  fontWeight: 900,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Terms of Use
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={onOpenPrivacy}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1976d2",
                  fontWeight: 900,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Privacy Policy
              </button>
              .
            </span>
          </label>

          <button
            onClick={onCreateAccount}
            disabled={signupLoading || !signupLegalAccepted}
            style={{
              padding: 10,
              width: "100%",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 900,
              cursor: signupLoading ? "not-allowed" : "pointer",
              opacity: signupLoading || !signupLegalAccepted ? 0.75 : 1,
            }}
          >
            {signupLoading ? "Creating…" : "Create account"}
          </button>
        </>
      )}
    </ModalShell>
  );
}

export function TermsOfUseModal({ open, onClose, btnPrimary = {} }) {
  const termsUrl = "https://cityreport.io/legal/terms.html";
  return (
    <ModalShell
      open={open}
      zIndex={10080}
      panelStyle={{ width: "min(860px, calc(100vw - 24px))", maxHeight: "85vh", overflow: "hidden", padding: 0 }}
    >
      <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", maxHeight: "85vh" }}>
        <div
          style={{
            width: "100%",
            padding: "12px 14px",
            borderBottom: "1px solid var(--sl-ui-modal-border)",
            fontSize: 16,
            fontWeight: 950,
            textAlign: "center",
          }}
        >
          Terms of Service
        </div>
        <div style={{ overflow: "hidden", padding: "0", background: "var(--sl-ui-modal-bg)" }}>
          <iframe
            title="CityReport Terms of Service"
            src="/legal/terms.html"
            style={{ width: "100%", height: "100%", minHeight: "58vh", border: "none", background: "white" }}
          />
        </div>
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--sl-ui-modal-border)", display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              void openExternalUrl(termsUrl);
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "#1976d2",
              fontWeight: 800,
              textAlign: "center",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Open Terms of Service in new tab
          </button>
          <button onClick={onClose} style={btnPrimary} aria-label="Close">Close</button>
        </div>
      </div>
    </ModalShell>
  );
}

export function PrivacyPolicyModal({ open, onClose, btnPrimary = {} }) {
  const privacyUrl = "https://cityreport.io/legal/privacy.html";
  return (
    <ModalShell
      open={open}
      zIndex={10080}
      panelStyle={{ width: "min(860px, calc(100vw - 24px))", maxHeight: "85vh", overflow: "hidden", padding: 0 }}
    >
      <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", maxHeight: "85vh" }}>
        <div
          style={{
            width: "100%",
            padding: "12px 14px",
            borderBottom: "1px solid var(--sl-ui-modal-border)",
            fontSize: 16,
            fontWeight: 950,
            textAlign: "center",
          }}
        >
          Privacy Notice
        </div>
        <div style={{ overflow: "hidden", padding: "0", background: "var(--sl-ui-modal-bg)" }}>
          <iframe
            title="CityReport Privacy Notice"
            src="/legal/privacy.html"
            style={{ width: "100%", height: "100%", minHeight: "58vh", border: "none", background: "white" }}
          />
        </div>
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--sl-ui-modal-border)", display: "grid", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              void openExternalUrl(privacyUrl);
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "#1976d2",
              fontWeight: 800,
              textAlign: "center",
              textDecoration: "underline",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Open Privacy Notice in new tab
          </button>
          <button onClick={onClose} style={btnPrimary} aria-label="Close">Close</button>
        </div>
      </div>
    </ModalShell>
  );
}
