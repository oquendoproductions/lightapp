import { useEffect } from "react";

const loadDeferredTenantUiConfigSupportModule = () => import("./lib/mapDeferredTenantUiConfigSupport.js");
const loadDeferredTenantParkSupportModule = () => import("./lib/mapDeferredTenantParkSupport.js");

export default function MapLazyTenantRuntimeController({
  loading,
  nonCriticalStartupReady,
  startupWarmupReady,
  mapInteracting,
  tenantReady,
  sessionUserId,
  resolvedTenantDomainConfigTenantKey,
  tenantScopedReadClient,
  supabase,
  enableTenantVisibilityConfig,
  setTenantVisibilityByDomain,
  setTenantVisibilityLoaded,
  resolvedTenantMapFeaturesTenantKey,
  authReady,
  activeTenantKey,
  getSupabaseTenantKey,
  createTenantScopedReadClient,
  defaultTenantMapFeatures,
  tenantMapFeaturesSourceRef,
  setTenantMapFeatures,
  setTenantMapFeaturesLoaded,
  pushTenantBoundaryDiagnostic,
  summarizeTenantMapFeaturesRow,
  sessionAccessToken,
  tenantTenantKey,
  tenantConfigTenantKey,
  shouldPrioritizeTenantParksLoad,
  tenantParksLoaded,
  loadTenantParksNow,
}) {
  useEffect(() => {
    let cancelled = false;
    let dispose = () => {};
    if (loading || !startupWarmupReady) {
      return () => {
        cancelled = true;
      };
    }
    void loadDeferredTenantUiConfigSupportModule().then(({
      scheduleTenantVisibilityConfigRuntimeShared,
      readCachedTenantVisibilityConfigShared,
      normalizeTenantVisibilityConfigShared,
      writeCachedTenantVisibilityConfigShared,
      clearCachedTenantVisibilityConfigShared,
    }) => {
      if (cancelled) return;
      const hasCachedVisibility = Boolean(
        readCachedTenantVisibilityConfigShared(resolvedTenantDomainConfigTenantKey),
      );
      if (hasCachedVisibility && mapInteracting) return;
      const cachedRefreshIdleTimeoutMs = hasCachedVisibility ? 4000 : 1000;
      const cachedRefreshDelayMs = hasCachedVisibility ? 1200 : 240;
      dispose = scheduleTenantVisibilityConfigRuntimeShared({
        tenantReady,
        enabled: enableTenantVisibilityConfig,
        tenantKey: resolvedTenantDomainConfigTenantKey,
        readClient: tenantScopedReadClient || supabase,
        normalizeTenantVisibilityConfig: normalizeTenantVisibilityConfigShared,
        setTenantVisibilityByDomain,
        setTenantVisibilityLoaded,
        writeCachedTenantVisibilityConfig: writeCachedTenantVisibilityConfigShared,
        clearCachedTenantVisibilityConfig: clearCachedTenantVisibilityConfigShared,
        idleTimeoutMs: cachedRefreshIdleTimeoutMs,
        fallbackDelayMs: cachedRefreshDelayMs,
      });
    });

    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    enableTenantVisibilityConfig,
    loading,
    mapInteracting,
    resolvedTenantDomainConfigTenantKey,
    sessionUserId,
    setTenantVisibilityByDomain,
    setTenantVisibilityLoaded,
    startupWarmupReady,
    supabase,
    tenantReady,
    tenantScopedReadClient,
  ]);

  useEffect(() => {
    let cancelled = false;
    let dispose = () => {};
    const hasCachedTenantMapFeatures =
      tenantMapFeaturesSourceRef.current === "cache"
      || tenantMapFeaturesSourceRef.current === "default-pending";
    if (hasCachedTenantMapFeatures && mapInteracting) {
      return () => {
        cancelled = true;
      };
    }
    if (loading || !startupWarmupReady) {
      return () => {
        cancelled = true;
      };
    }
    const cachedRefreshIdleTimeoutMs = hasCachedTenantMapFeatures ? 4000 : 1000;
    const cachedRefreshDelayMs = hasCachedTenantMapFeatures ? 1200 : 240;
    void loadDeferredTenantUiConfigSupportModule().then(({
      scheduleTenantMapFeaturesRuntimeShared,
      normalizeTenantMapFeaturesConfigShared,
      writeCachedTenantMapFeaturesShared,
    }) => {
      if (cancelled) return;
      dispose = scheduleTenantMapFeaturesRuntimeShared({
        authReady,
        tenantKey: resolvedTenantMapFeaturesTenantKey,
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
        normalizeTenantMapFeaturesConfig: normalizeTenantMapFeaturesConfigShared,
        writeCachedTenantMapFeatures: (tenantKey, features) => (
          writeCachedTenantMapFeaturesShared(tenantKey, features, defaultTenantMapFeatures)
        ),
        idleTimeoutMs: cachedRefreshIdleTimeoutMs,
        fallbackDelayMs: cachedRefreshDelayMs,
      });
    });

    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    activeTenantKey,
    authReady,
    createTenantScopedReadClient,
    defaultTenantMapFeatures,
    getSupabaseTenantKey,
    loading,
    mapInteracting,
    pushTenantBoundaryDiagnostic,
    resolvedTenantMapFeaturesTenantKey,
    sessionAccessToken,
    setTenantMapFeatures,
    setTenantMapFeaturesLoaded,
    startupWarmupReady,
    summarizeTenantMapFeaturesRow,
    supabase,
    tenantMapFeaturesSourceRef,
    tenantScopedReadClient,
  ]);

  useEffect(() => {
    let cancelled = false;
    let dispose = () => {};
    if (!shouldPrioritizeTenantParksLoad) {
      return () => {
        cancelled = true;
      };
    }
    if (tenantParksLoaded && mapInteracting) {
      return () => {
        cancelled = true;
      };
    }
    if (loading || !nonCriticalStartupReady) {
      return () => {
        cancelled = true;
      };
    }
    const idleTimeoutMs = shouldPrioritizeTenantParksLoad ? 1200 : 6000;
    const fallbackDelayMs = shouldPrioritizeTenantParksLoad ? 280 : 1800;
    void loadDeferredTenantParkSupportModule().then(({ scheduleTenantParksLoadRuntimeShared }) => {
      if (cancelled) return;
      dispose = scheduleTenantParksLoadRuntimeShared({
        loadTenantParksNow,
        idleTimeoutMs,
        fallbackDelayMs,
      });
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    loadTenantParksNow,
    loading,
    mapInteracting,
    nonCriticalStartupReady,
    shouldPrioritizeTenantParksLoad,
    tenantParksLoaded,
  ]);

  useEffect(() => {
    pushTenantBoundaryDiagnostic("tenant-switch", {
      tenantTenantKey: String(tenantTenantKey || "").trim().toLowerCase(),
      tenantConfigKey: String(tenantConfigTenantKey || "").trim().toLowerCase(),
      resolvedTenantMapFeaturesTenantKey,
      runtimeTenantKey: String(activeTenantKey() || "").trim().toLowerCase(),
      globalSupabaseTenantKey: getSupabaseTenantKey(),
      hasSessionAccessToken: Boolean(String(sessionAccessToken || "").trim()),
      tenantReady: tenantReady !== false,
    });
  }, [
    activeTenantKey,
    getSupabaseTenantKey,
    pushTenantBoundaryDiagnostic,
    resolvedTenantMapFeaturesTenantKey,
    sessionAccessToken,
    tenantConfigTenantKey,
    tenantReady,
    tenantTenantKey,
  ]);

  return null;
}
