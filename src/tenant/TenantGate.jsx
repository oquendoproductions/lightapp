import React, { useCallback, useContext, useMemo, useState } from "react";
import AppLaunchScreen from "../AppLaunchScreen.jsx";
import { isNativeAppRuntime } from "../platform/runtime.js";
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
  const [tenantSearch, setTenantSearch] = useState("");
  const [dismissedPublicOnboardingKeys, setDismissedPublicOnboardingKeys] = useState(() => new Set());
  const activeOnboardingKey = publicOnboardingStorageKey(tenant.tenantKey);
  const publicOnboardingSeen =
    dismissedPublicOnboardingKeys.has(activeOnboardingKey) ||
    hasSeenPublicOnboarding(tenant.tenantKey);
  const tenantSearchTerm = String(tenantSearch || "").trim().toLowerCase();
  const searchedTenantOptions = useMemo(() => {
    if (!tenant.initialTenantSelectionPending) return [];
    if (!tenantSearchTerm) return [];
    const options = Array.isArray(tenant.availableTenants) ? tenant.availableTenants.filter(Boolean) : [];
    return options.filter((option) => {
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
  }, [tenant.availableTenants, tenant.initialTenantSelectionPending, tenantSearchTerm]);
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
            title="Find your City"
            subtitle="Search for a city to explore before signing in. You can switch cities later from the app menu."
            status="Preparing city search..."
          />
        )}
      >
        <LazyTenantInitialSelectionScreen
          tenantSearch={tenantSearch}
          onTenantSearchChange={setTenantSearch}
          tenantSearchTerm={tenantSearchTerm}
          options={searchedTenantOptions}
          optionsReady={(Array.isArray(tenant.availableTenants) ? tenant.availableTenants.filter(Boolean) : []).length > 0}
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
