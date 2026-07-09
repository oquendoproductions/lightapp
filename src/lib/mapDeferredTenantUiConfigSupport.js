const TENANT_VISIBILITY_CACHE_KEY = "cityreport_tenant_visibility_v1";
const TENANT_MAP_FEATURES_CACHE_KEY = "cityreport_tenant_map_features_v1";

function isPermissionDeniedError(error) {
  const errCode = String(error?.code || "").trim();
  const errMsg = String(error?.message || "").trim();
  return errCode === "42501" || /permission denied|forbidden/i.test(errMsg);
}

function isMissingConfigError(error) {
  const errCode = String(error?.code || "").trim();
  const errMsg = String(error?.message || "").trim();
  return errCode === "42P01" || /does not exist|relation|schema cache/i.test(errMsg);
}

function tenantVisibilityCacheStorageKeyShared(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  if (!normalizedTenantKey) return "";
  return `${TENANT_VISIBILITY_CACHE_KEY}:${normalizedTenantKey}`;
}

export function normalizeTenantVisibilityConfigShared(rowsOrObject) {
  const next = {};
  if (Array.isArray(rowsOrObject)) {
    for (const row of rowsOrObject) {
      const domainKey = String(row?.domain || "").trim().toLowerCase();
      const visibility = String(row?.visibility || "").trim().toLowerCase();
      if (!domainKey) continue;
      if (visibility === "public" || visibility === "internal_only") {
        next[domainKey] = visibility;
      }
    }
    return next;
  }
  if (!rowsOrObject || typeof rowsOrObject !== "object") return next;
  for (const [domainKeyRaw, visibilityRaw] of Object.entries(rowsOrObject)) {
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    const visibility = String(visibilityRaw || "").trim().toLowerCase();
    if (!domainKey) continue;
    if (visibility === "public" || visibility === "internal_only") {
      next[domainKey] = visibility;
    }
  }
  return next;
}

export function readCachedTenantVisibilityConfigShared(tenantKey) {
  if (typeof window === "undefined") return null;
  const storageKey = tenantVisibilityCacheStorageKeyShared(tenantKey);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedVisibility = parsed && typeof parsed === "object" && parsed.visibility
      ? parsed.visibility
      : parsed;
    return normalizeTenantVisibilityConfigShared(cachedVisibility);
  } catch {
    return null;
  }
}

export function writeCachedTenantVisibilityConfigShared(tenantKey, visibilityByDomain) {
  if (typeof window === "undefined") return;
  const storageKey = tenantVisibilityCacheStorageKeyShared(tenantKey);
  if (!storageKey) return;
  try {
    const normalizedVisibility = normalizeTenantVisibilityConfigShared(visibilityByDomain);
    window.localStorage.setItem(storageKey, JSON.stringify({
      visibility: normalizedVisibility,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}

export function clearCachedTenantVisibilityConfigShared(tenantKey) {
  if (typeof window === "undefined") return;
  const storageKey = tenantVisibilityCacheStorageKeyShared(tenantKey);
  if (!storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore cache clear failures
  }
}

export function normalizeTenantMapFeaturesConfigShared(row, defaultTenantMapFeatures = {}) {
  if (!row || typeof row !== "object") {
    return { ...defaultTenantMapFeatures };
  }
  const nextOpacityRaw = Number(row?.outside_shade_opacity);
  const nextOpacity = Number.isFinite(nextOpacityRaw)
    ? Math.max(0, Math.min(1, nextOpacityRaw))
    : defaultTenantMapFeatures.outside_shade_opacity;
  const nextBorderColorRaw = String(row?.boundary_border_color || "").trim();
  const nextBorderColor = /^#[0-9a-fA-F]{6}$/.test(nextBorderColorRaw)
    ? nextBorderColorRaw.toLowerCase()
    : defaultTenantMapFeatures.boundary_border_color;
  const nextBorderWidthRaw = Number(row?.boundary_border_width);
  const nextBorderWidth = Number.isFinite(nextBorderWidthRaw)
    ? Math.max(0.5, Math.min(8, nextBorderWidthRaw))
    : defaultTenantMapFeatures.boundary_border_width;
  return {
    show_boundary_border: row?.show_boundary_border !== false,
    shade_outside_boundary: row?.shade_outside_boundary !== false,
    show_alert_icon: row?.show_alert_icon !== false,
    show_event_icon: row?.show_event_icon !== false,
    outside_shade_opacity: nextOpacity,
    boundary_border_color: nextBorderColor,
    boundary_border_width: nextBorderWidth,
  };
}

function tenantMapFeaturesCacheStorageKeyShared(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  if (!normalizedTenantKey) return "";
  return `${TENANT_MAP_FEATURES_CACHE_KEY}:${normalizedTenantKey}`;
}

export function readCachedTenantMapFeaturesShared(tenantKey, defaultTenantMapFeatures = {}) {
  if (typeof window === "undefined") return null;
  const storageKey = tenantMapFeaturesCacheStorageKeyShared(tenantKey);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedFeatures = parsed && typeof parsed === "object" && parsed.features
      ? parsed.features
      : parsed;
    return normalizeTenantMapFeaturesConfigShared(cachedFeatures, defaultTenantMapFeatures);
  } catch {
    return null;
  }
}

export function writeCachedTenantMapFeaturesShared(
  tenantKey,
  features,
  defaultTenantMapFeatures = {},
) {
  if (typeof window === "undefined") return;
  const storageKey = tenantMapFeaturesCacheStorageKeyShared(tenantKey);
  if (!storageKey) return;
  try {
    const normalizedFeatures = normalizeTenantMapFeaturesConfigShared(features, defaultTenantMapFeatures);
    window.localStorage.setItem(storageKey, JSON.stringify({
      features: normalizedFeatures,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}

export async function loadTenantVisibilityConfigShared({
  tenantReady,
  enabled,
  tenantKey,
  readClient,
  normalizeTenantVisibilityConfig = normalizeTenantVisibilityConfigShared,
  setTenantVisibilityByDomain,
  setTenantVisibilityLoaded,
  writeCachedTenantVisibilityConfig = writeCachedTenantVisibilityConfigShared,
  clearCachedTenantVisibilityConfig = clearCachedTenantVisibilityConfigShared,
}) {
  if (tenantReady === false) return;
  if (!enabled) {
    setTenantVisibilityByDomain({});
    setTenantVisibilityLoaded(false);
    return;
  }
  if (!tenantKey) {
    setTenantVisibilityByDomain({});
    setTenantVisibilityLoaded(false);
    return;
  }

  const { data, error } = await readClient
    .from("tenant_visibility_config")
    .select("domain,visibility")
    .eq("tenant_key", tenantKey);

  if (error) {
    if (isPermissionDeniedError(error)) {
      setTenantVisibilityByDomain({});
      setTenantVisibilityLoaded(false);
      clearCachedTenantVisibilityConfig(tenantKey);
      return;
    }
    console.warn("[tenant_visibility_config]", String(error?.message || "").trim() || error);
    setTenantVisibilityByDomain({});
    setTenantVisibilityLoaded(false);
    clearCachedTenantVisibilityConfig(tenantKey);
    return;
  }

  const next = normalizeTenantVisibilityConfig(data);
  setTenantVisibilityByDomain(next);
  setTenantVisibilityLoaded(true);
  writeCachedTenantVisibilityConfig(tenantKey, next);
}

export async function loadTenantMapFeaturesShared({
  authReady,
  tenantKey,
  resolvedTenantMapFeaturesTenantKey,
  activeTenantKey,
  getSupabaseTenantKey,
  tenantScopedReadClient,
  createTenantScopedReadClient,
  supabase,
  defaultTenantMapFeatures,
  tenantMapFeaturesSourceRef,
  setTenantMapFeatures,
  setTenantMapFeaturesLoaded,
  pushTenantBoundaryDiagnostic,
  summarizeTenantMapFeaturesRow,
  normalizeTenantMapFeaturesConfig = normalizeTenantMapFeaturesConfigShared,
  writeCachedTenantMapFeatures = writeCachedTenantMapFeaturesShared,
}) {
  if (!authReady) return;
  if (!tenantKey) {
    tenantMapFeaturesSourceRef.current = "empty-tenant";
    setTenantMapFeatures({ ...defaultTenantMapFeatures });
    setTenantMapFeaturesLoaded(true);
    pushTenantBoundaryDiagnostic?.("tenant_map_features:empty-tenant", {
      resolvedTenantMapFeaturesTenantKey,
      runtimeTenantKey: String(activeTenantKey?.() || "").trim().toLowerCase(),
      globalSupabaseTenantKey: getSupabaseTenantKey?.(),
    }, { forceWarn: true });
    return;
  }

  if (
    tenantMapFeaturesSourceRef.current !== "cache"
    && tenantMapFeaturesSourceRef.current !== "default-pending"
  ) {
    setTenantMapFeaturesLoaded(false);
  }

  const selectColumns =
    "show_boundary_border,shade_outside_boundary,show_alert_icon,show_event_icon,outside_shade_opacity,boundary_border_color,boundary_border_width";
  const fetchTenantMapFeatures = async (client) =>
    client
      .from("tenant_map_features")
      .select(selectColumns)
      .eq("tenant_key", tenantKey)
      .maybeSingle();

  const scopedReadClient =
    tenantScopedReadClient || createTenantScopedReadClient?.(tenantKey) || supabase;
  pushTenantBoundaryDiagnostic?.("tenant_map_features:fetch-start", {
    tenantKey,
    resolvedTenantMapFeaturesTenantKey,
    runtimeTenantKey: String(activeTenantKey?.() || "").trim().toLowerCase(),
    globalSupabaseTenantKey: getSupabaseTenantKey?.(),
    usingMemoizedScopedClient: Boolean(tenantScopedReadClient),
    usingSharedSupabaseClient: scopedReadClient === supabase,
  });

  let { data, error } = await fetchTenantMapFeatures(scopedReadClient);

  if (!error && !data) {
    pushTenantBoundaryDiagnostic?.("tenant_map_features:no-row-initial", {
      tenantKey,
      resolvedTenantMapFeaturesTenantKey,
      runtimeTenantKey: String(activeTenantKey?.() || "").trim().toLowerCase(),
      globalSupabaseTenantKey: getSupabaseTenantKey?.(),
      usingMemoizedScopedClient: Boolean(tenantScopedReadClient),
      usingSharedSupabaseClient: scopedReadClient === supabase,
    }, { forceWarn: true });

    const retryClient = createTenantScopedReadClient?.(tenantKey);
    if (retryClient) {
      const retryResult = await fetchTenantMapFeatures(retryClient);
      data = retryResult.data;
      error = retryResult.error;
      pushTenantBoundaryDiagnostic?.("tenant_map_features:retry-result", {
        tenantKey,
        hasData: Boolean(retryResult.data),
        row: summarizeTenantMapFeaturesRow?.(retryResult.data),
        errorCode: String(retryResult.error?.code || "").trim(),
        errorMessage: String(retryResult.error?.message || "").trim(),
      }, { forceWarn: !retryResult.data || Boolean(retryResult.error) });
    } else {
      pushTenantBoundaryDiagnostic?.("tenant_map_features:retry-skipped", {
        tenantKey,
        reason: "fresh scoped client unavailable",
      }, { forceWarn: true });
    }
  }

  if (error) {
    const errCode = String(error?.code || "").trim();
    const errMsg = String(error?.message || "").trim();
    if (!isPermissionDeniedError(error) && !isMissingConfigError(error)) {
      console.warn("[tenant_map_features]", errMsg || error);
    }
    tenantMapFeaturesSourceRef.current = "fallback-error";
    setTenantMapFeatures({ ...defaultTenantMapFeatures });
    setTenantMapFeaturesLoaded(true);
    pushTenantBoundaryDiagnostic?.("tenant_map_features:fallback-error", {
      tenantKey,
      resolvedTenantMapFeaturesTenantKey,
      runtimeTenantKey: String(activeTenantKey?.() || "").trim().toLowerCase(),
      globalSupabaseTenantKey: getSupabaseTenantKey?.(),
      errorCode: errCode,
      errorMessage: errMsg,
    }, { forceWarn: true });
    return;
  }

  if (!data) {
    tenantMapFeaturesSourceRef.current = "fallback-no-row";
    setTenantMapFeatures({ ...defaultTenantMapFeatures });
    setTenantMapFeaturesLoaded(true);
    writeCachedTenantMapFeatures?.(tenantKey, defaultTenantMapFeatures);
    pushTenantBoundaryDiagnostic?.("tenant_map_features:fallback-no-row", {
      tenantKey,
      resolvedTenantMapFeaturesTenantKey,
      runtimeTenantKey: String(activeTenantKey?.() || "").trim().toLowerCase(),
      globalSupabaseTenantKey: getSupabaseTenantKey?.(),
    }, { forceWarn: true });
    return;
  }

  const normalizedFeatures = normalizeTenantMapFeaturesConfig(data);
  setTenantMapFeatures(normalizedFeatures);
  tenantMapFeaturesSourceRef.current = "db-row";
  setTenantMapFeaturesLoaded(true);
  writeCachedTenantMapFeatures?.(tenantKey, normalizedFeatures);
  pushTenantBoundaryDiagnostic?.("tenant_map_features:loaded", {
    tenantKey,
    resolvedTenantMapFeaturesTenantKey,
    runtimeTenantKey: String(activeTenantKey?.() || "").trim().toLowerCase(),
    globalSupabaseTenantKey: getSupabaseTenantKey?.(),
    row: summarizeTenantMapFeaturesRow?.(normalizedFeatures),
  });
}

function scheduleDeferredTenantUiRefreshShared(loadFn, {
  idleTimeoutMs = 1000,
  fallbackDelayMs = 240,
} = {}) {
  let cancelled = false;
  let idleHandle = null;
  let timeoutHandle = null;

  const runLoad = async () => {
    if (cancelled) return;
    await loadFn(() => cancelled);
  };

  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    idleHandle = window.requestIdleCallback(() => {
      idleHandle = null;
      void runLoad();
    }, { timeout: idleTimeoutMs });
  } else if (typeof window !== "undefined") {
    timeoutHandle = window.setTimeout(() => {
      timeoutHandle = null;
      void runLoad();
    }, fallbackDelayMs);
  } else {
    void runLoad();
  }

  return () => {
    cancelled = true;
    if (idleHandle != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle != null && typeof window !== "undefined") {
      window.clearTimeout(timeoutHandle);
    }
  };
}

export function scheduleTenantVisibilityConfigRuntimeShared(state = {}) {
  return scheduleDeferredTenantUiRefreshShared(async (isCancelled) => {
    await loadTenantVisibilityConfigShared({
      ...state,
      setTenantVisibilityByDomain: (...args) => {
        if (isCancelled()) return;
        state.setTenantVisibilityByDomain?.(...args);
      },
      setTenantVisibilityLoaded: (...args) => {
        if (isCancelled()) return;
        state.setTenantVisibilityLoaded?.(...args);
      },
    });
  }, {
    idleTimeoutMs: state.idleTimeoutMs ?? 1000,
    fallbackDelayMs: state.fallbackDelayMs ?? 240,
  });
}

export function scheduleTenantMapFeaturesRuntimeShared(state = {}) {
  return scheduleDeferredTenantUiRefreshShared(async (isCancelled) => {
    await loadTenantMapFeaturesShared({
      ...state,
      setTenantMapFeatures: (...args) => {
        if (isCancelled()) return;
        state.setTenantMapFeatures?.(...args);
      },
      setTenantMapFeaturesLoaded: (...args) => {
        if (isCancelled()) return;
        state.setTenantMapFeaturesLoaded?.(...args);
      },
    });
  }, {
    idleTimeoutMs: state.idleTimeoutMs ?? 1000,
    fallbackDelayMs: state.fallbackDelayMs ?? 240,
  });
}
