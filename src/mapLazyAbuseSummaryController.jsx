import { useCallback, useEffect, useLayoutEffect } from "react";

const loadDeferredAbuseSupportModule = () => import("./lib/mapDeferredAbuseSupport.js");

export default function MapLazyAbuseSummaryController({
  isAdmin,
  adminToolboxOpen,
  moderationFlagsOpen,
  startupWarmupReady,
  supabase,
  setOpenAbuseFlagSummary,
  abuseFlagBannerShownRef,
  isExpectedPermissionError,
}) {
  const loadOpenAbuseFlagSummary = useCallback(async ({ silent = true } = {}) => {
    const {
      refreshOpenAbuseFlagSummaryRuntimeShared,
      writeCachedOpenAbuseFlagSummaryShared,
    } = await loadDeferredAbuseSupportModule();
    await refreshOpenAbuseFlagSummaryRuntimeShared({
      isAdmin,
      supabase,
      setOpenAbuseFlagSummary,
      writeCachedOpenAbuseFlagSummary: writeCachedOpenAbuseFlagSummaryShared,
      abuseFlagBannerShownRef,
      silent,
      isExpectedPermissionError,
    });
  }, [abuseFlagBannerShownRef, isAdmin, isExpectedPermissionError, setOpenAbuseFlagSummary, supabase]);

  useLayoutEffect(() => {
    if (!isAdmin) {
      setOpenAbuseFlagSummary({ total: 0, maxSeverity: 0 });
      abuseFlagBannerShownRef.current = false;
      return;
    }
    let cancelled = false;
    void loadDeferredAbuseSupportModule()
      .then(({ readCachedOpenAbuseFlagSummaryShared }) => {
        if (cancelled) return;
        const cachedSummary = readCachedOpenAbuseFlagSummaryShared();
        if (cachedSummary) {
          setOpenAbuseFlagSummary(cachedSummary);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [abuseFlagBannerShownRef, isAdmin, setOpenAbuseFlagSummary]);

  useEffect(() => {
    if (!isAdmin) {
      setOpenAbuseFlagSummary({ total: 0, maxSeverity: 0 });
      abuseFlagBannerShownRef.current = false;
      return undefined;
    }

    let idleHandle = null;
    let timeoutHandle = null;
    const loadImmediately = adminToolboxOpen || moderationFlagsOpen;
    if (!loadImmediately && !startupWarmupReady) {
      return undefined;
    }

    const scheduleRefresh = () => {
      if (loadImmediately) {
        void loadOpenAbuseFlagSummary();
        return;
      }
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => {
          idleHandle = null;
          void loadOpenAbuseFlagSummary();
        }, { timeout: 5000 });
        return;
      }
      if (typeof window !== "undefined") {
        timeoutHandle = window.setTimeout(() => {
          timeoutHandle = null;
          void loadOpenAbuseFlagSummary();
        }, 2200);
        return;
      }
      void loadOpenAbuseFlagSummary();
    };

    scheduleRefresh();
    const timer = setInterval(() => {
      void loadOpenAbuseFlagSummary();
    }, 60000);

    return () => {
      if (idleHandle != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null && typeof window !== "undefined") {
        window.clearTimeout(timeoutHandle);
      }
      clearInterval(timer);
    };
  }, [
    abuseFlagBannerShownRef,
    adminToolboxOpen,
    isAdmin,
    loadOpenAbuseFlagSummary,
    moderationFlagsOpen,
    startupWarmupReady,
    setOpenAbuseFlagSummary,
  ]);

  return null;
}
