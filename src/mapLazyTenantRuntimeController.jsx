import { useEffect } from "react";

const loadDeferredTenantUiConfigSupportModule = () => import("./lib/mapDeferredTenantUiConfigSupport.js");
const loadDeferredTenantParkSupportModule = () => import("./lib/mapDeferredTenantParkSupport.js");

export default function MapLazyTenantRuntimeController({
  loading,
  nonCriticalStartupReady,
  startupWarmupReady,
  mapInteracting,
  tenantScopedReadClient,
  supabase,
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
    const hasCachedTenantMapFeatures = tenantMapFeaturesSourceRef.current === "cache";
    if (!startupWarmupReady) {
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
