import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, setSupabaseTenantKey } from "../supabaseClient";
import { isNativeAppRuntime } from "../platform/runtime.js";
import { clearTenantConfigCache, loadTenantConfigCached } from "./tenantConfigCache";
import {
  getConfiguredNativeTenantKey,
  getDefaultTenantKey,
  hasConfiguredNativeTenantKey,
  hasPersistedRuntimeTenantKey,
  setRuntimeTenantKey,
} from "./runtimeTenant";
import { TenantContext } from "./contextObject";
import { markPublicOnboardingSeen } from "./publicOnboardingSupport.js";

const loadNativeTenantSupportHelpersModule = () => import("./nativeTenantSupportHelpers.js");

function fallbackTenantConfig(tenantKey) {
  return {
    tenant_key: tenantKey,
    name: tenantKey === "ashtabulacity" ? "Ashtabula City" : tenantKey,
    display_name: tenantKey === "ashtabulacity" ? "Ashtabula City (Unofficial)" : "",
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

function isMissingFunctionError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42883" || code === "PGRST202" || (msg.includes("function") && msg.includes("exist"));
}

function normalizeTenantRouteInput(raw) {
  const stripped = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
  return stripped.replace(/[^a-z0-9.-]/g, "");
}

async function resolveTenantConfigByRoute(routeInput) {
  const normalized = normalizeTenantRouteInput(routeInput);
  if (!normalized) return null;
  const { data, error } = await supabase.rpc("resolve_tenant_route", {
    route_input: normalized,
  });
  if (error) throw error;
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function isAllowDefaultTenantFallback() {
  const raw = String(import.meta.env.VITE_ALLOW_DEFAULT_TENANT_FALLBACK ?? "true").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

async function fetchTenantConfigFromDb(tenantKey) {
  const selectBase =
    "tenant_key,name,display_name,primary_subdomain,boundary_config_key,notification_email_potholes,notification_email_water_drain,is_pilot,active";
  try {
    const resolved = await resolveTenantConfigByRoute(tenantKey);
    if (resolved) return resolved;
  } catch (error) {
    if (!isMissingFunctionError(error)) throw error;
  }

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
  const appScope = String(resolution?.appScope || "map").trim().toLowerCase() || "map";
  const resolvedTenant = String(resolution?.tenantKey || "").trim().toLowerCase();
  const municipalityMode = mode === "municipality_app";
  const publicMapMode = municipalityMode && appScope === "map";
  const nativePinnedTenantKey = getConfiguredNativeTenantKey();
  const initialNativeTenantSelectionPending =
    publicMapMode &&
    isNativeAppRuntime() &&
    !hasConfiguredNativeTenantKey() &&
    !hasPersistedRuntimeTenantKey();
  const [requestedTenantRoute, setRequestedTenantRoute] = useState(() =>
    initialNativeTenantSelectionPending ? "" : (resolvedTenant || getDefaultTenantKey())
  );
  const [availableTenants, setAvailableTenants] = useState([]);
  const [availableTenantsLoaded, setAvailableTenantsLoaded] = useState(false);
  const [switchingTenant, setSwitchingTenant] = useState("");
  const availableTenantsRequestSeqRef = useRef(0);
  const [initialTenantChoiceResolved, setInitialTenantChoiceResolved] = useState(
    () => !initialNativeTenantSelectionPending
  );
  const [state, setState] = useState({
    loading: municipalityMode && !initialNativeTenantSelectionPending,
    ready: !municipalityMode,
    tenantConfig: municipalityMode || !requestedTenantRoute ? null : fallbackTenantConfig(requestedTenantRoute),
    error: "",
  });
  const tenantKey = String(
    state.tenantConfig?.tenant_key ||
      requestedTenantRoute ||
      (initialNativeTenantSelectionPending ? "" : getDefaultTenantKey())
  )
    .trim()
    .toLowerCase();
  const currentTenantOption = useMemo(() => {
    if (!state.tenantConfig?.tenant_key) return null;
    const displayName = String(state.tenantConfig?.display_name || "").trim();
    return {
      tenantKey: String(state.tenantConfig?.tenant_key || "").trim().toLowerCase(),
      displayName,
      name:
        String(
          displayName ||
            state.tenantConfig?.name ||
            state.tenantConfig?.primary_subdomain ||
            state.tenantConfig?.tenant_key
        ).trim() || String(state.tenantConfig?.tenant_key || "").trim().toLowerCase(),
      primarySubdomain: String(state.tenantConfig?.primary_subdomain || "").trim().toLowerCase() || "",
      routeSlug: "",
      residentPortalEnabled: state.tenantConfig?.resident_portal_enabled !== false,
      active: state.tenantConfig?.active !== false,
    };
  }, [state.tenantConfig]);

  useEffect(() => {
    if (municipalityMode) {
      const requestKey = String(state.tenantConfig?.tenant_key || requestedTenantRoute || "").trim().toLowerCase();
      if (requestKey) {
        setSupabaseTenantKey(requestKey);
      } else {
        setSupabaseTenantKey("");
      }
      if (state.tenantConfig?.tenant_key && requestKey) {
        setRuntimeTenantKey(requestKey);
      }
      return;
    }

    const appliedKey = setRuntimeTenantKey(tenantKey);
    setSupabaseTenantKey(appliedKey);
  }, [municipalityMode, requestedTenantRoute, state.tenantConfig?.tenant_key, tenantKey]);

  useEffect(() => {
    let cancelled = false;

    if (!municipalityMode) {
      return () => {
        cancelled = true;
      };
    }

    if (initialNativeTenantSelectionPending || !requestedTenantRoute) {
      return () => {
        cancelled = true;
      };
    }

    loadTenantConfigCached(
      requestedTenantRoute,
      async () => {
        try {
          const fromDb = await fetchTenantConfigFromDb(requestedTenantRoute);
          return fromDb;
        } catch (error) {
          if (
            requestedTenantRoute === getDefaultTenantKey() &&
            isAllowDefaultTenantFallback() &&
            isMissingRelationError(error)
          ) {
            return fallbackTenantConfig(requestedTenantRoute);
          }
          throw error;
        }
      },
      { ttlMs: 5 * 60 * 1000 }
    )
      .then((tenantConfig) => {
        if (cancelled) return;
        if (!tenantConfig || tenantConfig.active === false) {
          setSwitchingTenant("");
          setState({
            loading: false,
            ready: false,
            tenantConfig: null,
            error: "Tenant is not configured or inactive.",
          });
          return;
        }
        setSwitchingTenant("");
        setState({
          loading: false,
          ready: true,
          tenantConfig,
          error: "",
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setSwitchingTenant("");
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
  }, [initialNativeTenantSelectionPending, municipalityMode, requestedTenantRoute]);

  const loadAvailablePublicTenantsNow = useCallback(
    async ({
      force = false,
      currentTenantConfigOverride,
      currentTenantKeyOverride,
    } = {}) => {
      if (!publicMapMode || !isNativeAppRuntime()) {
        return currentTenantOption ? [currentTenantOption] : [];
      }

      const currentTenantConfigForLoad =
        currentTenantConfigOverride === undefined ? state.tenantConfig : currentTenantConfigOverride;
      const currentTenantKeyForLoad =
        currentTenantKeyOverride === undefined ? tenantKey : currentTenantKeyOverride;

      if (!force && availableTenantsLoaded && availableTenants.length) {
        return availableTenants;
      }

      if (
        !force &&
        initialTenantChoiceResolved &&
        (!state.ready || !currentTenantConfigForLoad)
      ) {
        return currentTenantOption ? [currentTenantOption] : [];
      }

      const requestSeq = availableTenantsRequestSeqRef.current + 1;
      availableTenantsRequestSeqRef.current = requestSeq;

      try {
        const { listAvailablePublicTenants } = await loadNativeTenantSupportHelpersModule();
        const items = await listAvailablePublicTenants({
          currentTenantConfig: currentTenantConfigForLoad || null,
          currentTenantKey: currentTenantKeyForLoad || "",
          supabase,
          loadTenantConfigCached,
          fetchTenantConfigFromDb,
          isMissingFunctionError,
          isMissingRelationError,
        });
        if (availableTenantsRequestSeqRef.current !== requestSeq) return items;
        setAvailableTenants(items);
        setAvailableTenantsLoaded(true);
        return items;
      } catch (error) {
        if (availableTenantsRequestSeqRef.current !== requestSeq) {
          return currentTenantOption ? [currentTenantOption] : [];
        }
        console.warn(
          initialTenantChoiceResolved
            ? "[tenant-context][available-tenants-failed]"
            : "[tenant-context][available-tenants-initial-failed]",
          error
        );
        const fallbackItems = currentTenantOption ? [currentTenantOption] : [];
        setAvailableTenants((prev) => (prev.length ? prev : fallbackItems));
        setAvailableTenantsLoaded(true);
        return fallbackItems;
      }
    },
    [
      availableTenants,
      availableTenantsLoaded,
      currentTenantOption,
      initialTenantChoiceResolved,
      publicMapMode,
      state.ready,
      state.tenantConfig,
      tenantKey,
    ]
  );

  useEffect(() => {
    if (
      !publicMapMode ||
      !isNativeAppRuntime() ||
      initialTenantChoiceResolved ||
      availableTenantsLoaded
    ) {
      return undefined;
    }
    void loadAvailablePublicTenantsNow({
      force: true,
      currentTenantConfigOverride: null,
      currentTenantKeyOverride: "",
    });
    return undefined;
  }, [availableTenantsLoaded, initialTenantChoiceResolved, loadAvailablePublicTenantsNow, publicMapMode]);

  const effectiveAvailableTenants = useMemo(() => {
    const currentTenantOptionList = currentTenantOption ? [currentTenantOption] : [];
    if (!publicMapMode || !isNativeAppRuntime()) {
      return currentTenantOptionList;
    }
    if (!initialTenantChoiceResolved) {
      return availableTenants;
    }
    if (!state.ready || !state.tenantConfig) {
      return currentTenantOptionList;
    }
    return availableTenants.length ? availableTenants : currentTenantOptionList;
  }, [availableTenants, currentTenantOption, initialTenantChoiceResolved, publicMapMode, state.ready, state.tenantConfig]);

  const initialTenantSelectionPending =
    publicMapMode &&
    isNativeAppRuntime() &&
    !nativePinnedTenantKey &&
    !initialTenantChoiceResolved;

  const switchTenant = useCallback(
    async (rawTenantKey) => {
      const nextTenantKey = String(rawTenantKey || "").trim().toLowerCase();
      if (!nextTenantKey) return false;
      if (!publicMapMode) return false;
      if (nextTenantKey === tenantKey) {
        setRuntimeTenantKey(nextTenantKey);
        return true;
      }

      const nextOption = [...effectiveAvailableTenants]
        .find((option) => String(option?.tenantKey || "").trim().toLowerCase() === nextTenantKey) || null;

      if (!isNativeAppRuntime()) {
        const { buildWebTenantSwitchUrl } = await loadNativeTenantSupportHelpersModule();
        const nextUrl = buildWebTenantSwitchUrl(window.location, env, nextOption, nextTenantKey);
        if (!nextUrl) return false;
        markPublicOnboardingSeen(nextTenantKey);
        setSwitchingTenant(nextTenantKey);
        setRuntimeTenantKey(nextTenantKey);
        setSupabaseTenantKey(nextTenantKey);
        window.location.assign(nextUrl);
        return true;
      }

      markPublicOnboardingSeen(nextTenantKey);
      clearTenantConfigCache(tenantKey);
      clearTenantConfigCache(nextTenantKey);
      setRuntimeTenantKey(nextTenantKey);
      setSupabaseTenantKey(nextTenantKey);
      setSwitchingTenant(nextTenantKey);
      setState({
        loading: true,
        ready: false,
        tenantConfig: null,
        error: "",
      });
      setRequestedTenantRoute(nextTenantKey);
      return true;
    },
    [effectiveAvailableTenants, env, publicMapMode, tenantKey]
  );

  const completeInitialTenantChoice = useCallback(
    async (rawTenantKey) => {
      const nextTenantKey = String(rawTenantKey || tenantKey).trim().toLowerCase();
      if (!nextTenantKey) return false;
      markPublicOnboardingSeen(nextTenantKey);
      setRuntimeTenantKey(nextTenantKey);
      setInitialTenantChoiceResolved(true);
      if (nextTenantKey === tenantKey) return true;
      return switchTenant(nextTenantKey);
    },
    [switchTenant, tenantKey]
  );

  const value = useMemo(
    () => ({
      mode,
      env,
      appScope,
      tenantKey,
      tenantConfig: state.tenantConfig,
      loading: state.loading,
      ready: state.ready,
      error: state.error,
      isMunicipalityApp: municipalityMode,
      availableTenants: effectiveAvailableTenants,
      ensureAvailableTenantsLoaded: loadAvailablePublicTenantsNow,
      initialTenantSelectionPending,
      switchingTenant,
      completeInitialTenantChoice,
      switchTenant,
    }),
    [
      appScope,
      completeInitialTenantChoice,
      env,
      effectiveAvailableTenants,
      loadAvailablePublicTenantsNow,
      initialTenantSelectionPending,
      mode,
      municipalityMode,
      state.error,
      state.loading,
      state.ready,
      state.tenantConfig,
      switchTenant,
      switchingTenant,
      tenantKey,
    ]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
