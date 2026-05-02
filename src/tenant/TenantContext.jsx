import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import AppLaunchScreen from "../AppLaunchScreen.jsx";
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

const PUBLIC_APP_ONBOARDING_SEEN_KEY = "cityreport.public_onboarding_seen_v1";
const PUBLIC_APP_ONBOARDING_OPEN_AUTH_EVENT = "cityreport:public-onboarding-open-auth";
const PUBLIC_APP_ONBOARDING_PENDING_AUTH_KEY = "cityreport.public_onboarding_pending_auth_v1";

function publicOnboardingStorageKey(tenantKey) {
  const key = String(tenantKey || "").trim().toLowerCase() || "unknown";
  return `${PUBLIC_APP_ONBOARDING_SEEN_KEY}:${key}`;
}

function hasSeenPublicOnboarding(tenantKey) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(publicOnboardingStorageKey(tenantKey)) === "1";
  } catch {
    return false;
  }
}

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

async function fetchTenantDisplayName(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!normalizedTenantKey || !supabaseUrl || !supabaseAnonKey) return "";

  const scopedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        "x-tenant-key": normalizedTenantKey,
      },
    },
  });

  const { data, error } = await scopedSupabase.rpc("tenant_header_profile_public");
  if (error) {
    if (isMissingFunctionError(error) || isMissingRelationError(error)) return "";
    return "";
  }
  const nextProfile = Array.isArray(data) ? (data[0] || null) : (data || null);
  return String(nextProfile?.display_name || "").trim();
}

function buildTenantOption(tenantConfig, routeRow = null) {
  const tenantKey = String(tenantConfig?.tenant_key || routeRow?.tenant_key || "")
    .trim()
    .toLowerCase();
  if (!tenantKey) return null;
  const displayName = String(tenantConfig?.display_name || "").trim();
  return {
    tenantKey,
    displayName,
    name:
      String(
        displayName ||
          tenantConfig?.name ||
          routeRow?.route_slug ||
          routeRow?.primary_subdomain ||
          tenantKey
      ).trim() || tenantKey,
    primarySubdomain:
      String(tenantConfig?.primary_subdomain || routeRow?.primary_subdomain || "").trim().toLowerCase() || "",
    routeSlug: String(routeRow?.route_slug || "").trim().toLowerCase() || "",
    residentPortalEnabled: tenantConfig?.resident_portal_enabled !== false,
    active: tenantConfig?.active !== false,
  };
}

async function listAvailablePublicTenants(currentTenantConfig, currentTenantKey) {
  const normalizedCurrentKey = String(currentTenantKey || currentTenantConfig?.tenant_key || "")
    .trim()
    .toLowerCase();
  const optionMap = new Map();

  const upsertOption = (option, { forceInclude = false } = {}) => {
    if (!option?.tenantKey) return;
    if (!forceInclude && (option.active === false || option.residentPortalEnabled === false)) return;
    const previous = optionMap.get(option.tenantKey) || {};
    optionMap.set(option.tenantKey, {
      ...previous,
      ...option,
      name: String(option.name || previous.name || option.tenantKey).trim() || option.tenantKey,
    });
  };

  upsertOption(buildTenantOption(currentTenantConfig), { forceInclude: true });

  try {
    const { data, error } = await supabase.rpc("list_active_tenant_routes");
    if (error) throw error;

    const routeRows = Array.isArray(data) ? data : [];
    await Promise.all(
      routeRows.map(async (row) => {
        const tenantKey = String(row?.tenant_key || "").trim().toLowerCase();
        if (!tenantKey) return;
        try {
          const tenantConfig = await loadTenantConfigCached(
            tenantKey,
            async () => {
              const fromDb = await fetchTenantConfigFromDb(tenantKey);
              if (fromDb && !String(fromDb?.display_name || "").trim()) {
                const headerDisplayName = await fetchTenantDisplayName(tenantKey);
                if (headerDisplayName) {
                  return { ...fromDb, display_name: headerDisplayName };
                }
              }
              return fromDb;
            },
            { ttlMs: 5 * 60 * 1000 }
          );
          upsertOption(buildTenantOption(tenantConfig, row), { forceInclude: tenantKey === normalizedCurrentKey });
        } catch (routeError) {
          if (tenantKey === normalizedCurrentKey) {
            upsertOption(buildTenantOption(currentTenantConfig, row), { forceInclude: true });
            return;
          }
          if (!isMissingFunctionError(routeError) && !isMissingRelationError(routeError)) {
            console.warn("[tenant-context][list-tenant-config-failed]", tenantKey, routeError);
          }
        }
      })
    );
  } catch (error) {
    if (!isMissingFunctionError(error) && !isMissingRelationError(error)) {
      console.warn("[tenant-context][list-active-routes-failed]", error);
    }
  }

  return Array.from(optionMap.values()).sort((a, b) => {
    const byName = String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return String(a.tenantKey || "").localeCompare(String(b.tenantKey || ""), undefined, { sensitivity: "base" });
  });
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
  const [switchingTenant, setSwitchingTenant] = useState("");
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

  useEffect(() => {
    let cancelled = false;

    if (!publicMapMode || !isNativeAppRuntime()) {
      return () => {
        cancelled = true;
      };
    }

    if (!initialTenantChoiceResolved) {
      listAvailablePublicTenants(null, "")
        .then((items) => {
          if (cancelled) return;
          setAvailableTenants(items);
        })
        .catch((error) => {
          if (cancelled) return;
          console.warn("[tenant-context][available-tenants-initial-failed]", error);
          setAvailableTenants([]);
        });
      return () => {
        cancelled = true;
      };
    }

    if (!state.ready || !state.tenantConfig) {
      return () => {
        cancelled = true;
      };
    }

    listAvailablePublicTenants(state.tenantConfig, tenantKey)
      .then((items) => {
        if (cancelled) return;
        setAvailableTenants(items);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("[tenant-context][available-tenants-failed]", error);
        setAvailableTenants([buildTenantOption(state.tenantConfig)].filter(Boolean));
      });

    return () => {
      cancelled = true;
    };
  }, [initialTenantChoiceResolved, publicMapMode, state.ready, state.tenantConfig, tenantKey]);

  const effectiveAvailableTenants = useMemo(() => {
    const currentTenantOption = [buildTenantOption(state.tenantConfig)].filter(Boolean);
    if (!publicMapMode || !isNativeAppRuntime()) {
      return currentTenantOption;
    }
    if (!initialTenantChoiceResolved) {
      return availableTenants;
    }
    if (!state.ready || !state.tenantConfig) {
      return currentTenantOption;
    }
    return availableTenants.length ? availableTenants : currentTenantOption;
  }, [availableTenants, initialTenantChoiceResolved, publicMapMode, state.ready, state.tenantConfig]);

  const initialTenantSelectionPending =
    publicMapMode &&
    isNativeAppRuntime() &&
    !nativePinnedTenantKey &&
    !initialTenantChoiceResolved;

  const switchTenant = useCallback(
    async (rawTenantKey) => {
      const nextTenantKey = String(rawTenantKey || "").trim().toLowerCase();
      if (!nextTenantKey) return false;
      if (!publicMapMode || !isNativeAppRuntime()) return false;
      if (nextTenantKey === tenantKey) {
        setRuntimeTenantKey(nextTenantKey);
        return true;
      }

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
    [publicMapMode, tenantKey]
  );

  const completeInitialTenantChoice = useCallback(
    async (rawTenantKey) => {
      const nextTenantKey = String(rawTenantKey || tenantKey).trim().toLowerCase();
      if (!nextTenantKey) return false;
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
    const options = searchedTenantOptions;
    const allOptions = Array.isArray(tenant.availableTenants) ? tenant.availableTenants.filter(Boolean) : [];
    const optionsReady = allOptions.length > 0;
    return (
      <AppLaunchScreen
        eyebrow="Welcome"
        title="Find your City"
        subtitle="Search for a city to explore before signing in. You can switch cities later from the app menu."
        status={optionsReady ? "" : "Loading available cities..."}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <input
            type="search"
            value={tenantSearch}
            onChange={(e) => setTenantSearch(e.target.value)}
            placeholder="Search by city name"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 18,
              border: "1px solid rgba(214, 231, 248, 0.18)",
              background: "rgba(17, 39, 64, 0.98)",
              color: "#eef6ff",
              fontSize: 15,
              fontWeight: 700,
              outline: "none",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          />
          {tenantSearchTerm ? (
            options.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {options.map((option) => (
                  <button
                    key={option.tenantKey}
                    type="button"
                    onClick={() => {
                      void tenant.completeInitialTenantChoice?.(option.tenantKey);
                    }}
                    style={{
                      width: "100%",
                      display: "grid",
                      gap: 4,
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 18,
                      border: "1px solid rgba(214, 231, 248, 0.16)",
                      background: "linear-gradient(180deg, rgba(29, 62, 103, 0.98) 0%, rgba(20, 46, 77, 0.98) 100%)",
                      color: "#eef6ff",
                      boxShadow: "0 10px 18px rgba(4, 10, 16, 0.18)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.15 }}>
                      {option.displayName || option.name}
                    </span>
                    <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "rgba(228, 239, 249, 0.76)" }}>
                      {option.primarySubdomain || `${option.tenantKey}.cityreport.io`}
                    </span>
                  </button>
                ))}
              </div>
            ) : optionsReady ? (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: 18,
                  border: "1px solid rgba(214, 231, 248, 0.12)",
                  background: "rgba(17, 39, 64, 0.82)",
                  color: "rgba(228, 239, 249, 0.82)",
                  fontSize: 14,
                  lineHeight: 1.5,
                  textAlign: "left",
                }}
              >
                No cities found for that search.
              </div>
            ) : null
          ) : (
            <div
              style={{
                padding: "10px 4px 2px",
                color: "rgba(228, 239, 249, 0.78)",
                fontSize: 13.5,
                lineHeight: 1.45,
                textAlign: "left",
              }}
            >
              Start typing to find your city.
            </div>
          )}
        </div>
      </AppLaunchScreen>
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
    const onboardingCards = [
      {
        key: "map",
        eyebrow: "Report",
        title: "Tap the map to report",
        body: "Choose incident reporting for potholes and water/drain issues, or switch to Streetlights for asset-based reporting.",
      },
      {
        key: "reports",
        eyebrow: "Follow",
        title: "Check Reports",
        body: "Reports shows your submitted issues and nearby activity so you can see what is already being tracked.",
      },
      {
        key: "alerts",
        eyebrow: "Stay Updated",
        title: "Use Alerts and Events",
        body: "Public notices are available right away. Sign in later if you want notification preferences and saved history.",
      },
    ];

    return (
      <AppLaunchScreen
        eyebrow={organizationName}
        title={`Welcome to ${organizationName}`}
        subtitle="Choose how you want to start. You can explore as a guest, or sign in to keep reports, followed cities, and notifications connected to you."
        status="Quick tour"
      >
        <div style={{ display: "grid", gap: 12 }}>
          {onboardingCards.map((card) => (
            <div
              key={card.key}
              style={{
                display: "grid",
                gap: 5,
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: 18,
                border: "1px solid rgba(214, 231, 248, 0.14)",
                background: "linear-gradient(180deg, rgba(29, 62, 103, 0.96) 0%, rgba(20, 46, 77, 0.96) 100%)",
                color: "#eef6ff",
                boxShadow: "0 10px 18px rgba(4, 10, 16, 0.14)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#6ce0d5",
                }}
              >
                {card.eyebrow}
              </span>
              <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.15 }}>
                {card.title}
              </span>
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "rgba(228, 239, 249, 0.82)" }}>
                {card.body}
              </span>
            </div>
          ))}

          <div
            style={{
              padding: "13px 15px",
              borderRadius: 18,
              border: "1px solid rgba(108, 224, 213, 0.16)",
              background: "rgba(108, 224, 213, 0.10)",
              color: "#d8fffb",
              fontSize: 13.5,
              lineHeight: 1.5,
              textAlign: "left",
            }}
          >
            Best first step: open <b>Map</b>, choose a layer, and explore what is already being reported in {organizationName}.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 9 }}>
            <button
              type="button"
              onClick={() => completePublicOnboardingAndOpenAuth("login")}
              style={{
                width: "100%",
                padding: "15px 16px",
                borderRadius: 18,
                border: "1px solid rgba(214, 231, 248, 0.16)",
                background: "linear-gradient(180deg, #2f9b84 0%, #2a7262 100%)",
                color: "#f7fffe",
                fontSize: 15.5,
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 14px 24px rgba(4, 10, 16, 0.18)",
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => completePublicOnboardingAndOpenAuth("signup")}
              style={{
                width: "100%",
                padding: "15px 16px",
                borderRadius: 18,
                border: "1px solid rgba(108, 224, 213, 0.24)",
                background: "linear-gradient(180deg, rgba(36, 123, 105, 0.88) 0%, rgba(31, 91, 80, 0.88) 100%)",
                color: "#f7fffe",
                fontSize: 15,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={completePublicOnboarding}
              style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: 18,
                border: "1px solid rgba(214, 231, 248, 0.18)",
                background: "rgba(17, 39, 64, 0.74)",
                color: "#eef6ff",
                fontSize: 14.5,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Explore as Guest
            </button>
          </div>
        </div>
      </AppLaunchScreen>
    );
  }

  return <React.Fragment key={`${tenant.appScope || "map"}:${tenant.tenantKey || "unknown"}`}>{children}</React.Fragment>;
}
