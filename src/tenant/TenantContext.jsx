import React, { useContext, useEffect, useMemo, useState } from "react";
import { supabase, setSupabaseTenantKey } from "../supabaseClient";
import { loadTenantConfigCached } from "./tenantConfigCache";
import { getDefaultTenantKey, setRuntimeTenantKey } from "./runtimeTenant";
import { TenantContext } from "./contextObject";

function fallbackTenantConfig(tenantKey) {
  return {
    tenant_key: tenantKey,
    name: tenantKey === "ashtabulacity" ? "Ashtabula City" : tenantKey,
    primary_subdomain: `${tenantKey}.cityreport.io`,
    boundary_config_key: "ashtabula_city_geojson",
    notification_email_potholes: "",
    notification_email_water_drain: "",
    resident_portal_enabled: false,
    is_pilot: tenantKey === "ashtabulacity",
    active: true,
  };
}

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

function isMissingColumnError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function isAllowDefaultTenantFallback() {
  const raw = String(import.meta.env.VITE_ALLOW_DEFAULT_TENANT_FALLBACK ?? "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

async function fetchTenantConfigFromDb(tenantKey) {
  const selectBase =
    "tenant_key,name,primary_subdomain,boundary_config_key,notification_email_potholes,notification_email_water_drain,is_pilot,active";
  const preferred = await supabase
    .from("tenants")
    .select(`${selectBase},resident_portal_enabled`)
    .eq("tenant_key", tenantKey)
    .maybeSingle();

  if (!preferred.error) return preferred.data || null;
  if (!isMissingColumnError(preferred.error)) throw preferred.error;

  const fallback = await supabase
    .from("tenants")
    .select(selectBase)
    .eq("tenant_key", tenantKey)
    .maybeSingle();
  if (fallback.error) throw fallback.error;
  return fallback.data ? { ...fallback.data, resident_portal_enabled: false } : null;
}

export function TenantProvider({ resolution, children }) {
  const mode = String(resolution?.mode || "marketing_home");
  const env = String(resolution?.env || "prod");
  const resolvedTenant = String(resolution?.tenantKey || "").trim().toLowerCase();
  const tenantKey = resolvedTenant || getDefaultTenantKey();
  const municipalityMode = mode === "municipality_app";
  const [state, setState] = useState({
    loading: municipalityMode,
    ready: !municipalityMode,
    tenantConfig: municipalityMode ? null : fallbackTenantConfig(tenantKey),
    error: "",
  });

  useEffect(() => {
    const appliedKey = setRuntimeTenantKey(tenantKey);
    setSupabaseTenantKey(appliedKey);
  }, [tenantKey]);

  useEffect(() => {
    let cancelled = false;

    if (!municipalityMode) {
      return () => {
        cancelled = true;
      };
    }

    loadTenantConfigCached(
      tenantKey,
      async () => {
        try {
          const fromDb = await fetchTenantConfigFromDb(tenantKey);
          return fromDb;
        } catch (error) {
          if (
            tenantKey === getDefaultTenantKey() &&
            isAllowDefaultTenantFallback() &&
            isMissingRelationError(error)
          ) {
            return fallbackTenantConfig(tenantKey);
          }
          throw error;
        }
      },
      { ttlMs: 5 * 60 * 1000 }
    )
      .then((tenantConfig) => {
        if (cancelled) return;
        if (!tenantConfig || tenantConfig.active === false) {
          setState({
            loading: false,
            ready: false,
            tenantConfig: null,
            error: "Tenant is not configured or inactive.",
          });
          return;
        }
        setState({
          loading: false,
          ready: true,
          tenantConfig,
          error: "",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          loading: false,
          ready: false,
          tenantConfig: null,
          error: String(error?.message || "Unable to load tenant configuration."),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [municipalityMode, tenantKey]);

  const value = useMemo(
    () => ({
      mode,
      env,
      tenantKey,
      tenantConfig: state.tenantConfig,
      loading: state.loading,
      ready: state.ready,
      error: state.error,
      isMunicipalityApp: municipalityMode,
    }),
    [env, mode, municipalityMode, state.error, state.loading, state.ready, state.tenantConfig, tenantKey]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function TenantGate({ children }) {
  const tenant = useContext(TenantContext);
  if (!tenant.isMunicipalityApp) return children;

  if (tenant.loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Manrope, sans-serif" }}>
        Loading municipality workspace...
      </div>
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

  return children;
}
