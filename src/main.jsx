import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./index.css";
import { supabase } from "./supabaseClient";
import { TenantGate, TenantProvider } from "./tenant/TenantContext";
import { buildUnknownTenantSlugEvent, logUnknownTenantSlug, resolveTenantRequest } from "./tenant/tenantResolver";

const App = lazy(() => import("./App.jsx"));
const MunicipalityApp = lazy(() => import("./MunicipalityApp.jsx"));
const PlatformAdminApp = lazy(() => import("./PlatformAdminApp.jsx"));
const TenantNotFoundApp = lazy(() => import("./TenantNotFoundApp.jsx"));
const RedirectingApp = lazy(() => import("./RedirectingApp.jsx"));

const resolution = resolveTenantRequest({
  hostname: window.location.hostname,
  pathname: window.location.pathname,
  search: window.location.search,
});

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

if (resolution.mode === "not_found") {
  const context = {
    hostname: window.location.hostname,
    pathname: window.location.pathname,
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
  const current = `${window.location.origin}${window.location.pathname}${window.location.search}`;
  if (current !== resolution.redirectTo) {
    window.location.replace(resolution.redirectTo);
  }
}

const Root =
  resolution.mode === "municipality_app"
    ? MunicipalityApp
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
            <div
              style={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                fontFamily: "Manrope, sans-serif",
                color: "#1a3153",
                background: "#f4f8fd",
              }}
            >
              Loading CityReport...
            </div>
          }
        >
          <Root />
        </Suspense>
      </TenantGate>
    </TenantProvider>
  </React.StrictMode>
);
