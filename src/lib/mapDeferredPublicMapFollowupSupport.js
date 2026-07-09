import {
  incidentLocationCacheKey as incidentLocationCacheKeyShared,
  mergeIncidentLocationCacheMaps as mergeIncidentLocationCacheMapsShared,
} from "./mapIncidentLocationCacheSupport.js";

export async function hydrateScopedReportsShared(state = {}, deps = {}) {
  try {
    let query = state.readClient
      .from("reports")
      .select(state.reportSelectFull)
      .eq("tenant_key", state.loadTenantKey);
    if (state.viewerUserId) {
      query = query.eq("reporter_user_id", state.viewerUserId);
    }
    const result = await query.order("created_at", { ascending: false });
    if (state.isCancelled?.()) return false;
    if (result?.error) {
      if (!deps.isExpectedPermissionError(result.error)) {
        console.warn(`[${state.logLabel}] warning:`, result.error?.message || result.error);
      }
      return false;
    }
    state.setHydrationKey?.(state.hydrationKey);
    deps.mergeResidentReportsIntoState(result?.data || []);
    return true;
  } catch (error) {
    if (!state.isCancelled?.()) {
      console.warn(`[${state.logLabel}] warning:`, error?.message || error);
    }
    return false;
  }
}

export async function hydrateRemoteIncidentLocationCacheShared(state = {}, deps = {}) {
  const incidentLocationCacheKey =
    typeof deps?.incidentLocationCacheKey === "function"
      ? deps.incidentLocationCacheKey
      : incidentLocationCacheKeyShared;
  const mergeIncidentLocationCacheMaps =
    typeof deps?.mergeIncidentLocationCacheMaps === "function"
      ? deps.mergeIncidentLocationCacheMaps
      : mergeIncidentLocationCacheMapsShared;
  try {
    const incidentLocationCacheRows = await state.fetchAllIncidentLocationCache(
      state.readClient,
      state.loadTenantKey,
    );
    if (state.isCancelled?.()) return false;
    const nextIncidentLocationCache = {};
    for (const row of incidentLocationCacheRows || []) {
      const key = incidentLocationCacheKey(row?.domain, row?.incident_id);
      if (!key) continue;
      nextIncidentLocationCache[key] = {
        locationLabel: String(row?.location_label || row?.nearest_address || "").trim(),
        nearestAddress: String(row?.nearest_address || "").trim(),
        nearestCrossStreet: String(row?.nearest_cross_street || "").trim(),
        nearestIntersection: String(row?.nearest_intersection || "").trim(),
        nearestLandmark: String(row?.nearest_landmark || "").trim(),
      };
    }
    state.setHydrationKey?.(state.loadTenantKey);
    deps.startTransition?.(() => {
      state.setIncidentLocationCacheByKey?.((prev) =>
        mergeIncidentLocationCacheMaps(nextIncidentLocationCache, prev),
      );
    });
    return true;
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    if (!(msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache"))) {
      console.warn("[incident_location_cache] load warning:", error?.message || error);
    }
    return false;
  }
}

export function scheduleScopedReportsHydrationRuntimeShared(state = {}, deps = {}) {
  let cancelled = false;
  let idleHandle = null;
  let timeoutHandle = null;

  const runLoad = async () => {
    await hydrateScopedReportsShared({
      ...state,
      isCancelled: () => cancelled,
    }, deps);
  };

  if (state.deferUntilIdle) {
    const idleTimeoutMs = state.idleTimeoutMs ?? 2200;
    const fallbackDelayMs = state.fallbackDelayMs ?? 180;
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => {
        idleHandle = null;
        if (!cancelled) void runLoad();
      }, { timeout: idleTimeoutMs });
    } else if (typeof window !== "undefined") {
      timeoutHandle = window.setTimeout(() => {
        timeoutHandle = null;
        if (!cancelled) void runLoad();
      }, fallbackDelayMs);
    } else {
      void runLoad();
    }
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

function scheduleDeferredRefreshShared(loadFn, {
  idleTimeoutMs = 1800,
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

export function scheduleRemoteIncidentLocationCacheHydrationRuntimeShared(state = {}, deps = {}) {
  return scheduleDeferredRefreshShared(async (isCancelled) => {
    await hydrateRemoteIncidentLocationCacheShared({
      ...state,
      isCancelled,
    }, deps);
  }, {
    idleTimeoutMs: state.idleTimeoutMs ?? 2200,
    fallbackDelayMs: state.fallbackDelayMs ?? 300,
  });
}

export async function refreshUtilityStatusRealtimeShared(state = {}, deps = {}) {
  if (!state.shouldLiveSubscribeStreetlightRuntimeState) return false;
  const {
    isMissingUtilityReportReferenceColumnError,
    normalizeUtilityReportReference,
  } = await deps.loadIncidentDeferredSupportModule();

  try {
    if (state.viewerUserId) {
      let { data, error } = await state.supabase
        .from("utility_report_status")
        .select("incident_id, report_reference, updated_at, reported_at")
        .eq("tenant_key", state.tenantKey)
        .eq("user_id", state.viewerUserId)
        .order("updated_at", { ascending: false });
      if (error && isMissingUtilityReportReferenceColumnError(error)) {
        const fallback = await state.supabase
          .from("utility_report_status")
          .select("incident_id, updated_at, reported_at")
          .eq("tenant_key", state.tenantKey)
          .eq("user_id", state.viewerUserId)
          .order("updated_at", { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
      if (!error) {
        const next = new Set();
        const nextRefs = {};
        const nextReportedAt = {};
        for (const row of data || []) {
          const incidentId = String(row?.incident_id || "").trim();
          if (!incidentId) continue;
          next.add(incidentId);
          nextRefs[incidentId] = normalizeUtilityReportReference(row?.report_reference);
          nextReportedAt[incidentId] = Math.max(
            Number(nextReportedAt[incidentId] || 0),
            Date.parse(String(row?.updated_at || row?.reported_at || "")) || 0,
          );
        }
        deps.setUtilityReportedLightIdSet(next);
        deps.setUtilityReportReferenceByLightId(nextRefs);
        deps.setUtilityReportedAtByLightId(nextReportedAt);
      }
    }

    const { data: utilityCountData, error: utilityCountErr } = await state.supabase.rpc("streetlight_utility_signal_counts");
    if (!utilityCountErr) {
      const nextCounts = {};
      for (const row of utilityCountData || []) {
        const incidentId = String(row?.incident_id || "").trim();
        if (!incidentId) continue;
        const reportedCount = Math.max(0, Number(row?.reported_count || 0));
        nextCounts[incidentId] = {
          reportedCount,
          referenceCount: Math.max(0, Number(row?.reference_count || 0)),
          latestReportedTs: Date.parse(String(row?.latest_reported_at || "")) || 0,
        };
      }
      deps.setUtilitySignalCountsByLightId(nextCounts);
    }
    return true;
  } catch (e) {
    console.warn("[utility_report_status realtime refresh] warning:", e?.message || e);
    return false;
  }
}

export async function hydratePassiveIncidentStateShared(state = {}, deps = {}) {
  try {
    const rows = await state.fetchAllIncidentStateCurrent(state.readClient, state.loadTenantKey);
    if (state.isCancelled?.()) return false;
    const nextIncidentStateByKey = {};
    for (const row of rows || []) {
      const key = deps.incidentSnapshotKey(row?.domain, row?.incident_id);
      if (!key) continue;
      nextIncidentStateByKey[key] = {
        state: String(row?.state || "").trim(),
        last_changed_at: row?.last_changed_at || null,
      };
    }
    deps.applyIncidentStateSnapshot(nextIncidentStateByKey);
    state.setHydrationKey?.(state.hydrationKey);
    return true;
  } catch (error) {
    if (!state.isCancelled?.() && !deps.isExpectedPermissionError(error)) {
      console.warn("[incident_state_current deferred] load warning:", error?.message || error);
    }
    return false;
  }
}

export async function refreshDeferredBoundaryGeojsonShared(state = {}, deps = {}) {
  try {
    const boundaryResult = await state.fetchTenantBoundaryGeojson(state.readClient, state.loadTenantKey);
    if (state.isCancelled?.()) return false;
    const nextBoundaryGeojson = boundaryResult?.geojson || null;
    state.setCityBoundaryGeojson?.(nextBoundaryGeojson);
    if (nextBoundaryGeojson) {
      deps.writeCachedTenantBoundaryGeojson(state.loadTenantKey, nextBoundaryGeojson);
    } else {
      deps.clearCachedTenantBoundaryGeojson(state.loadTenantKey);
    }
    state.setHydrationKey?.(state.hydrationKey);
    return true;
  } catch (error) {
    if (!state.isCancelled?.()) {
      console.warn("[city boundary deferred refresh] warning:", error?.message || error);
    }
    return false;
  }
}

export function schedulePassiveIncidentStateRuntimeShared(state = {}, deps = {}) {
  return scheduleDeferredRefreshShared(async (isCancelled) => {
    await hydratePassiveIncidentStateShared({
      ...state,
      isCancelled,
    }, deps);
  }, {
    idleTimeoutMs: state.idleTimeoutMs ?? 1800,
    fallbackDelayMs: state.fallbackDelayMs ?? 240,
  });
}

export function scheduleDeferredBoundaryGeojsonRuntimeShared(state = {}, deps = {}) {
  return scheduleDeferredRefreshShared(async (isCancelled) => {
    await refreshDeferredBoundaryGeojsonShared({
      ...state,
      isCancelled,
    }, deps);
  }, {
    idleTimeoutMs: state.idleTimeoutMs ?? 2200,
    fallbackDelayMs: state.fallbackDelayMs ?? 320,
  });
}
