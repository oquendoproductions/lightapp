import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import AppLaunchScreen from "./AppLaunchScreen.jsx";
import { supabase } from "./supabaseClient";
import { getCurrentLocationSnapshot, getNativeAppScope, getPlatformName, isNativeAppRuntime } from "./platform/runtime.js";
import { TenantGate, TenantProvider } from "./tenant/TenantContext";
import { getRuntimeTenantKey } from "./tenant/runtimeTenant";
import { buildUnknownTenantSlugEvent, logUnknownTenantSlug, resolveTenantRequest } from "./tenant/tenantResolver";

const App = lazy(() => import("./App.jsx"));
const MapGoogleFull = lazy(() => import("./MapGoogleFull.jsx"));
const MunicipalityApp = lazy(() => import("./MunicipalityApp.jsx"));
const PlatformAdminApp = lazy(() => import("./PlatformAdminApp.jsx"));
const TenantNotFoundApp = lazy(() => import("./TenantNotFoundApp.jsx"));
const RedirectingApp = lazy(() => import("./RedirectingApp.jsx"));

const location = getCurrentLocationSnapshot();
const nativeAppScope = getNativeAppScope();
const runtimePlatform = getPlatformName();
const resolution = isNativeAppRuntime()
  ? {
      mode: "municipality_app",
      tenantKey: getRuntimeTenantKey(),
      redirectTo: null,
      env: "native",
      reason: "native_shell_bootstrap",
      unknownSlug: "",
      appScope: nativeAppScope,
    }
  : resolveTenantRequest({
      hostname: location.hostname,
      pathname: location.pathname,
      search: location.search,
    });

if (typeof document !== "undefined") {
  document.documentElement.dataset.platform = runtimePlatform;
}

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

if (resolution.mode === "not_found") {
  const context = {
    hostname: location.hostname,
    pathname: location.pathname,
  };
  logUnknownTenantSlug(resolution, context);
  const eventPayload = buildUnknownTenantSlugEvent(resolution, context);
  if (eventPayload) {
    void supabase
      .from("tenant_unknown_slug_events")
      .insert([eventPayload])
      .then(({ error }) => {
        if (error && !isMissingRelationError(error)) {
          console.warn("[tenant-resolver][unknown-slug-insert-failed]", error);
        }
      });
  }
}

if (resolution.mode === "redirect" && resolution.redirectTo) {
  const current = `${location.origin}${location.pathname}${location.search}`;
  if (current !== resolution.redirectTo) {
    window.location.replace(resolution.redirectTo);
  }
}

const Root =
  resolution.mode === "municipality_app"
    ? resolution.appScope === "hub"
      ? MunicipalityApp
      : MapGoogleFull
    : resolution.mode === "platform_admin"
      ? PlatformAdminApp
      : resolution.mode === "not_found"
        ? TenantNotFoundApp
        : resolution.mode === "redirect"
          ? RedirectingApp
          : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TenantProvider resolution={resolution}>
      <TenantGate>
        <Suspense
          fallback={
            <AppLaunchScreen
              eyebrow={resolution.appScope === "hub" ? "CityReport Hub" : "Reporting Map"}
              title="CityReport.io"
              subtitle={resolution.appScope === "hub" ? "Opening your organization workspace..." : "Opening your reporting map..."}
              status="Loading app..."
            />
          }
        >
          <Root />
        </Suspense>
      </TenantGate>
    </TenantProvider>
  </React.StrictMode>
);
