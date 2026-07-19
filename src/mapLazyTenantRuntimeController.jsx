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
  createTenantScopedReadClient,
  defaultTenantMapFeatures,
  tenantMapFeaturesSourceRef,
  setTenantMapFeatures,
  setTenantMapFeaturesLoaded,
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
    const hasCachedTenantMapFeatures = tenantMapFeaturesSourceRef.current === "cache";
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
        tenantScopedReadClient,
        createTenantScopedReadClient,
        supabase,
        defaultTenantMapFeatures,
        tenantMapFeaturesSourceRef,
        setTenantMapFeatures,
        setTenantMapFeaturesLoaded,
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
    authReady,
    createTenantScopedReadClient,
    defaultTenantMapFeatures,
    loading,
    resolvedTenantMapFeaturesTenantKey,
    setTenantMapFeatures,
    setTenantMapFeaturesLoaded,
    startupWarmupReady,
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

  return null;
}
