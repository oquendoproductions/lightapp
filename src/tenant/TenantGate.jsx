import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import AppLaunchScreen from "../AppLaunchScreen.jsx";
import { loadFollowedTenantKeys } from "../lib/followedCitySupport.js";
import { isNativeAppRuntime } from "../platform/runtime.js";
import { supabase } from "../supabaseClient";
import { TenantContext } from "./contextObject";
import {
  hasSeenPublicOnboarding,
  PUBLIC_APP_ONBOARDING_OPEN_AUTH_EVENT,
  PUBLIC_APP_ONBOARDING_PENDING_AUTH_KEY,
  publicOnboardingStorageKey,
} from "./publicOnboardingSupport.js";

const loadNativeTenantSupportModule = () => import("./nativeTenantSupport.jsx");

const LazyTenantInitialSelectionScreen = React.lazy(() =>
  loadNativeTenantSupportModule().then((module) => ({ default: module.TenantInitialSelectionScreen }))
);

const LazyTenantPublicOnboardingScreen = React.lazy(() =>
  loadNativeTenantSupportModule().then((module) => ({ default: module.TenantPublicOnboardingScreen }))
);

export function TenantGate({ children }) {
  const tenant = useContext(TenantContext);
  const [initialLaunchStep, setInitialLaunchStep] = useState("login");
  const [initialLoginEmail, setInitialLoginEmail] = useState("");
  const [initialLoginPassword, setInitialLoginPassword] = useState("");
  const [initialLoginBusy, setInitialLoginBusy] = useState(false);
  const [initialLoginError, setInitialLoginError] = useState("");
  const [followedTenantKeys, setFollowedTenantKeys] = useState([]);
  const [tenantSearch, setTenantSearch] = useState("");
  const [dismissedPublicOnboardingKeys, setDismissedPublicOnboardingKeys] = useState(() => new Set());
  const activeOnboardingKey = publicOnboardingStorageKey(tenant.tenantKey);
  const publicOnboardingSeen =
    dismissedPublicOnboardingKeys.has(activeOnboardingKey) ||
    hasSeenPublicOnboarding(tenant.tenantKey);
  const tenantSearchTerm = String(tenantSearch || "").trim().toLowerCase();
  const availableTenantOptions = useMemo(
    () => (Array.isArray(tenant.availableTenants) ? tenant.availableTenants.filter(Boolean) : []),
    [tenant.availableTenants]
  );
  const savedTenantOptions = useMemo(() => {
    const savedKeys = new Set(
      (Array.isArray(followedTenantKeys) ? followedTenantKeys : [])
        .map((key) => String(key || "").trim().toLowerCase())
        .filter(Boolean)
    );
    return availableTenantOptions.filter((option) => savedKeys.has(String(option?.tenantKey || "").trim().toLowerCase()));
  }, [availableTenantOptions, followedTenantKeys]);
  const searchedTenantOptions = useMemo(() => {
    if (!tenant.initialTenantSelectionPending) return [];
    if (!tenantSearchTerm) return [];
    return availableTenantOptions.filter((option) => {
      const haystack = [
        option?.displayName,
        option?.name,
        option?.tenantKey,
        option?.primarySubdomain,
        option?.routeSlug,
      ]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
        .join(" ");
      return haystack.includes(tenantSearchTerm);
    });
  }, [availableTenantOptions, tenant.initialTenantSelectionPending, tenantSearchTerm]);
  const showPublicOnboarding =
    tenant.isMunicipalityApp &&
    tenant.appScope === "map" &&
    isNativeAppRuntime() &&
    !tenant.initialTenantSelectionPending &&
    tenant.ready &&
    !!tenant.tenantConfig &&
    !publicOnboardingSeen;

  const completePublicOnboarding = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(activeOnboardingKey, "1");
    } catch {
      // ignore storage failures
    }
    setDismissedPublicOnboardingKeys((prev) => {
      const next = new Set(prev);
      next.add(activeOnboardingKey);
      return next;
    });
  }, [activeOnboardingKey]);

  const completePublicOnboardingAndOpenAuth = useCallback((stepValue = "login") => {
    completePublicOnboarding();
    if (typeof window === "undefined") return;
    const step = String(stepValue || "login").trim() || "login";
    try {
      window.sessionStorage.setItem(PUBLIC_APP_ONBOARDING_PENDING_AUTH_KEY, step);
    } catch {
      // ignore storage failures; the event bridge below is still attempted
    }
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(PUBLIC_APP_ONBOARDING_OPEN_AUTH_EVENT, {
        detail: { step },
      }));
    }, 80);
  }, [completePublicOnboarding]);

  const loadInitialSavedLocations = useCallback(async (userId) => {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) {
      setFollowedTenantKeys([]);
      return;
    }
    try {
      setFollowedTenantKeys(await loadFollowedTenantKeys({ supabase, userId: normalizedUserId }));
    } catch (error) {
      console.warn("[native launch][saved locations]", error?.message || error);
      setFollowedTenantKeys([]);
    }
  }, []);

  useEffect(() => {
    if (!tenant.initialTenantSelectionPending) return undefined;
    let cancelled = false;
    void supabase.auth.getSession().then(({ data }) => {
      const userId = String(data?.session?.user?.id || "").trim();
      if (cancelled || !userId) return;
      setInitialLaunchStep("tenant");
      void loadInitialSavedLocations(userId);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadInitialSavedLocations, tenant.initialTenantSelectionPending]);

  const signInForInitialLaunch = useCallback(async () => {
    const email = String(initialLoginEmail || "").trim();
    const password = String(initialLoginPassword || "");
    if (!email || !password) {
      setInitialLoginError("Enter your email and password.");
      return;
    }
    setInitialLoginBusy(true);
    setInitialLoginError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await loadInitialSavedLocations(data?.user?.id || data?.session?.user?.id || "");
      setInitialLaunchStep("tenant");
    } catch (error) {
      setInitialLoginError(String(error?.message || "Unable to sign in."));
    } finally {
      setInitialLoginBusy(false);
    }
  }, [initialLoginEmail, initialLoginPassword, loadInitialSavedLocations]);

  const continueInitialLaunchAsGuest = useCallback(() => {
    setInitialLoginError("");
    setFollowedTenantKeys([]);
    setInitialLaunchStep("tenant");
  }, []);

  if (!tenant.isMunicipalityApp) return children;

  if (tenant.loading) {
    return (
      <AppLaunchScreen
        eyebrow={tenant.appScope === "hub" ? "CityReport Hub" : "Reporting Map"}
        title="CityReport.io"
        subtitle={tenant.appScope === "hub" ? "Preparing your organization workspace..." : "Preparing your reporting map..."}
        status={tenant.switchingTenant ? `Switching to ${tenant.switchingTenant}...` : "Loading workspace..."}
      />
    );
  }

  if (tenant.initialTenantSelectionPending) {
    return (
      <React.Suspense
        fallback={(
          <AppLaunchScreen
            eyebrow="Welcome"
            title="Sign In"
            subtitle="Sign in to load your saved locations, or continue as a guest."
            status="Preparing CityReport.io..."
          />
        )}
      >
        <LazyTenantInitialSelectionScreen
          step={initialLaunchStep}
          loginEmail={initialLoginEmail}
          onLoginEmailChange={setInitialLoginEmail}
          loginPassword={initialLoginPassword}
          onLoginPasswordChange={setInitialLoginPassword}
          loginBusy={initialLoginBusy}
          loginError={initialLoginError}
          onSignIn={signInForInitialLaunch}
          onContinueGuest={continueInitialLaunchAsGuest}
          tenantSearch={tenantSearch}
          onTenantSearchChange={setTenantSearch}
          tenantSearchTerm={tenantSearchTerm}
          options={searchedTenantOptions}
          savedOptions={savedTenantOptions}
          optionsReady={availableTenantOptions.length > 0}
          onSelectTenant={tenant.completeInitialTenantChoice}
        />
      </React.Suspense>
    );
  }

  if (!tenant.ready || !tenant.tenantConfig) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Manrope, sans-serif" }}>
        <div style={{ maxWidth: 620, textAlign: "center" }}>
          <h1 style={{ marginBottom: 8 }}>Municipality unavailable</h1>
          <p style={{ margin: 0, opacity: 0.82 }}>
            {tenant.error || "Tenant configuration is unavailable for this host."}
          </p>
        </div>
      </div>
    );
  }

  if (showPublicOnboarding) {
    const organizationName =
      String(tenant.tenantConfig?.display_name || tenant.tenantConfig?.name || tenant.tenantKey || "your city").trim()
      || "your city";
    return (
      <React.Suspense
        fallback={(
          <AppLaunchScreen
            eyebrow={organizationName}
            title={`Welcome to ${organizationName}`}
            subtitle="Choose how you want to start. You can explore as a guest, or sign in to keep reports, followed cities, and notifications connected to you."
            status="Quick tour"
          />
        )}
      >
        <LazyTenantPublicOnboardingScreen
          organizationName={organizationName}
          onSignIn={() => completePublicOnboardingAndOpenAuth("login")}
          onSignUp={() => completePublicOnboardingAndOpenAuth("signup")}
          onExploreGuest={completePublicOnboarding}
        />
      </React.Suspense>
    );
  }

  return <React.Fragment key={`${tenant.appScope || "map"}:${tenant.tenantKey || "unknown"}`}>{children}</React.Fragment>;
}

export default TenantGate;
