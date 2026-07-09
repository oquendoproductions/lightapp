async function fetchAllConfiguredIncidentCollectionRowsShared(client, domainKeyRaw, kindRaw = "seeded", tenantKey = "", deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainConfiguredSourceTable,
    incidentDomainConfiguredSelectFields,
    incidentDomainConfiguredStaticFilters,
    isMissingTenantKeyColumnError,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const kind = String(kindRaw || "seeded").trim().toLowerCase();
  const tableName = incidentDomainConfiguredSourceTable(domainKey, kind);
  const selectFields = incidentDomainConfiguredSelectFields(domainKey, kind) || "*";
  const staticFilters = incidentDomainConfiguredStaticFilters(domainKey, kind);
  if (!domainKey || !tableName) return [];
  const ascending = kind !== "reports";
  const pageSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    let baseQuery = client
      .from(tableName)
      .select(selectFields);
    for (const filter of staticFilters) {
      baseQuery = baseQuery.eq(filter.field, filter.value);
    }
    baseQuery = baseQuery
      .order("created_at", { ascending })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    let data = null;
    let error = null;
    if (tenantKey) {
      const scoped = await baseQuery.eq("tenant_key", tenantKey);
      data = scoped.data || null;
      error = scoped.error || null;
      if (error && isMissingTenantKeyColumnError(error)) {
        let fallback = client
          .from(tableName)
          .select(selectFields);
        for (const filter of staticFilters) {
          fallback = fallback.eq(filter.field, filter.value);
        }
        const fallbackResult = await fallback
          .order("created_at", { ascending })
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        data = fallbackResult.data || null;
        error = fallbackResult.error || null;
      }
    } else {
      const result = await baseQuery;
      data = result.data || null;
      error = result.error || null;
    }
    if (error) throw error;
    const batch = data || [];
    all = all.concat(batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export async function loadConfiguredIncidentDomainDataShared(domainKeyRaw, publicReadClient, tenantKeyRaw, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainConfiguredSourceTable,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const tenantKey = String(tenantKeyRaw || "").trim().toLowerCase();
  if (!domainKey || !publicReadClient || !tenantKey) {
    return {
      seededRows: [],
      reportRows: [],
      seededError: null,
      reportError: null,
    };
  }

  const seededTable = incidentDomainConfiguredSourceTable(domainKey, "seeded");
  const reportsTable = incidentDomainConfiguredSourceTable(domainKey, "reports");

  if (!seededTable && !reportsTable) {
    return {
      seededRows: [],
      reportRows: [],
      seededError: null,
      reportError: null,
    };
  }

  let seededRows = [];
  let reportRows = [];
  let seededError = null;
  let reportError = null;

  try {
    const [seededResult, reportResult] = await Promise.all([
      seededTable
        ? fetchAllConfiguredIncidentCollectionRowsShared(publicReadClient, domainKey, "seeded", tenantKey, deps)
            .then((rows) => ({ data: rows, error: null }))
            .catch((error) => ({ data: [], error }))
        : Promise.resolve({ data: [], error: null }),
      reportsTable
        ? fetchAllConfiguredIncidentCollectionRowsShared(publicReadClient, domainKey, "reports", tenantKey, deps)
            .then((rows) => ({ data: rows, error: null }))
            .catch((error) => ({ data: [], error }))
        : Promise.resolve({ data: [], error: null }),
    ]);
    seededRows = Array.isArray(seededResult.data) ? seededResult.data : [];
    reportRows = Array.isArray(reportResult.data) ? reportResult.data : [];
    seededError = seededResult.error || null;
    reportError = reportResult.error || null;
  } catch (error) {
    seededError = error;
  }

  return {
    seededRows,
    reportRows,
    seededError,
    reportError,
  };
}

export async function loadConfiguredIncidentPersistedRecordStateShared(domainKeyRaw, publicReadClient, tenantKeyRaw, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    fetchAllConfiguredIncidentPersistedRecordState,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const tenantKey = String(tenantKeyRaw || "").trim().toLowerCase();
  if (!domainKey || !publicReadClient || !tenantKey) {
    return {
      stateRows: [],
      stateError: null,
    };
  }

  try {
    const stateRows = await fetchAllConfiguredIncidentPersistedRecordState(publicReadClient, domainKey, tenantKey);
    return {
      stateRows: Array.isArray(stateRows) ? stateRows : [],
      stateError: null,
    };
  } catch (error) {
    return {
      stateRows: [],
      stateError: error,
    };
  }
}

export function applyLoadedConfiguredIncidentPersistedRecordStateShared(domainKeyRaw, context = {}, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainConfiguredPersistedRecordStateTable,
    incidentDomainNormalizePersistedRecordStateRow,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey || typeof context?.setPersistedIncidentRecordStateByDomain !== "function") return;
  const stateRows = Array.isArray(context?.stateRows) ? context.stateRows : [];
  const stateError = context?.stateError || null;
  const sourceTable = incidentDomainConfiguredPersistedRecordStateTable(domainKey) || `${domainKey}_state`;
  if (stateError) {
    const msg = String(stateError?.message || "").toLowerCase();
    if (!(msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache"))) {
      console.warn(`[${sourceTable}] load warning:`, stateError?.message || stateError);
    }
    return;
  }
  const nextDomainState = {};
  for (const row of stateRows) {
    const normalized = incidentDomainNormalizePersistedRecordStateRow(domainKey, row);
    const incidentId = String(normalized?.incident_id || "").trim();
    if (!incidentId) continue;
    nextDomainState[incidentId] = normalized;
  }
  context.setPersistedIncidentRecordStateByDomain((prev) => ({
    ...(prev || {}),
    [domainKey]: nextDomainState,
  }));
}

export function applyLoadedConfiguredIncidentDomainStateShared(domainKeyRaw, context = {}, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainConfiguredSourceTable,
    incidentDomainNormalizeConfiguredSeededRecord,
    incidentDomainNormalizeConfiguredReportRecord,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return;
  const seededRows = Array.isArray(context?.seededRows) ? context.seededRows : [];
  const reportRows = Array.isArray(context?.reportRows) ? context.reportRows : [];
  const seededError = context?.seededError || null;
  const reportError = context?.reportError || null;

  if (seededError) {
    console.warn(`[${domainKey}] load warning:`, seededError?.message || seededError);
  } else if (typeof context?.setSeededRows === "function") {
    context.setSeededRows(
      seededRows
        .map((row) => incidentDomainNormalizeConfiguredSeededRecord(domainKey, row))
        .filter(Boolean)
    );
  }

  if (reportError) {
    const reportsTable = incidentDomainConfiguredSourceTable(domainKey, "reports") || `${domainKey}_reports`;
    console.warn(`[${reportsTable}] load warning:`, reportError?.message || reportError);
  } else if (typeof context?.setReportRows === "function") {
    context.setReportRows(
      reportRows
        .map((row) => incidentDomainNormalizeConfiguredReportRecord(domainKey, row))
        .filter(Boolean)
    );
  }
}

export function buildNormalizedConfiguredIncidentPersistedStateByDomainShared(results = [], deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainNormalizePersistedRecordStateRow,
  } = deps;
  const normalizedPersistedIncidentRecordStateByDomain = {};
  for (const entry of results || []) {
    if (entry?.stateError) continue;
    const domainKey = normalizeDomainKeyOrSlug(entry?.domainKey, { allowUnknown: true });
    if (!domainKey) continue;
    const nextDomainState = {};
    for (const row of entry?.stateRows || []) {
      const normalized = incidentDomainNormalizePersistedRecordStateRow(domainKey, row);
      const incidentId = String(normalized?.incident_id || "").trim();
      if (!incidentId) continue;
      nextDomainState[incidentId] = normalized;
    }
    if (Object.keys(nextDomainState).length) {
      normalizedPersistedIncidentRecordStateByDomain[domainKey] = nextDomainState;
    }
  }
  return normalizedPersistedIncidentRecordStateByDomain;
}

export function buildNormalizedConfiguredIncidentRuntimeStateByDomainShared(results = [], deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainNormalizeConfiguredSeededRecord,
    incidentDomainNormalizeConfiguredReportRecord,
  } = deps;
  const normalizedConfiguredIncidentSeededRowsStateByDomain = {};
  const normalizedConfiguredIncidentReportRowsStateByDomain = {};
  for (const entry of results || []) {
    const normalizedDomainKey = normalizeDomainKeyOrSlug(entry?.domainKey, { allowUnknown: true });
    if (!normalizedDomainKey) continue;
    if (!entry?.seededError) {
      const normalizedSeededRows = (entry?.seededRows || [])
        .map((row) => incidentDomainNormalizeConfiguredSeededRecord(normalizedDomainKey, row))
        .filter(Boolean);
      if (normalizedSeededRows.length) {
        normalizedConfiguredIncidentSeededRowsStateByDomain[normalizedDomainKey] = normalizedSeededRows;
      }
    }
    if (!entry?.reportError) {
      const normalizedReportRows = (entry?.reportRows || [])
        .map((row) => incidentDomainNormalizeConfiguredReportRecord(normalizedDomainKey, row))
        .filter(Boolean);
      if (normalizedReportRows.length) {
        normalizedConfiguredIncidentReportRowsStateByDomain[normalizedDomainKey] = normalizedReportRows;
      }
    }
  }
  return {
    normalizedConfiguredIncidentSeededRowsStateByDomain,
    normalizedConfiguredIncidentReportRowsStateByDomain,
  };
}

export function buildConfiguredIncidentInitialLoadSummaryShared(results = [], deps = {}) {
  const {
    incidentDomainNormalizeConfiguredSeededRecord,
  } = deps;
  return {
    configuredIncidentSeededCountByDomain: Object.fromEntries(
      (results || []).map((entry) => [
        entry?.domainKey,
        Array.isArray(entry?.seededRows) ? entry.seededRows.length : 0,
      ])
    ),
    configuredIncidentReportCountByDomain: Object.fromEntries(
      (results || []).map((entry) => [
        entry?.domainKey,
        Array.isArray(entry?.reportRows) ? entry.reportRows.length : 0,
      ])
    ),
    configuredIncidentLoadErrors: (results || []).flatMap((entry) => (
      [entry?.seededError, entry?.reportError].filter(Boolean)
    )),
    configuredIncidentNormalizedSeededRowsByDomain: new Map(
      (results || []).map((entry) => [
        entry?.domainKey,
        (entry?.seededRows || [])
          .map((row) => incidentDomainNormalizeConfiguredSeededRecord(entry?.domainKey, row))
          .filter(Boolean),
      ])
    ),
  };
}

export function buildConfiguredIncidentPersistedStateInitialLoadSummaryShared(results = []) {
  return {
    configuredPersistedRecordStateCountByDomain: Object.fromEntries(
      (results || []).map((entry) => [
        entry?.domainKey,
        Array.isArray(entry?.stateRows) ? entry.stateRows.length : 0,
      ])
    ),
    configuredPersistedRecordStateLoadErrors: (results || [])
      .map((entry) => entry?.stateError)
      .filter(Boolean),
  };
}

export function mergeLoadedConfiguredIncidentDomainKeysShared(prev = [], results = [], deps = {}) {
  const next = new Set(prev || []);
  for (const entry of results || []) {
    const seededConnectionError = entry?.seededError && deps.isConnectionLikeDbError(entry.seededError);
    const reportConnectionError = entry?.reportError && deps.isConnectionLikeDbError(entry.reportError);
    if (seededConnectionError || reportConnectionError) continue;
    next.add(String(entry?.domainKey || "").trim());
  }
  return Array.from(next);
}

export function mergeLoadedConfiguredIncidentPersistedStateDomainKeysShared(prev = [], results = [], deps = {}) {
  const next = new Set(prev || []);
  for (const entry of results || []) {
    const stateConnectionError = entry?.stateError && deps.isConnectionLikeDbError(entry.stateError);
    if (stateConnectionError) continue;
    next.add(String(entry?.domainKey || "").trim());
  }
  return Array.from(next);
}

export function incidentDomainBuildConfiguredRealtimeReportSnapshotShared(domainKeyRaw, row = null, normalizedReport = null, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainConfiguredLookupField,
    incidentDomainCanonicalIncidentId,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey || !row || typeof row !== "object") {
    return { incidentId: "", changedAtIso: "" };
  }
  const reportsLookupField = incidentDomainConfiguredLookupField(domainKey, "reports") || "incident_id";
  const lookupValue = String(
    row?.[reportsLookupField]
    || normalizedReport?.[reportsLookupField]
    || normalizedReport?.incident_id
    || ""
  ).trim();
  if (!lookupValue) {
    return { incidentId: "", changedAtIso: "" };
  }
  const incidentId = incidentDomainCanonicalIncidentId(domainKey, {
    [reportsLookupField]: lookupValue,
  });
  const changedAtIso = row?.created_at
    ? String(row.created_at)
    : new Date(Number(normalizedReport?.ts || 0) || Date.now()).toISOString();
  return {
    incidentId: String(incidentId || "").trim(),
    changedAtIso: String(changedAtIso || "").trim(),
  };
}

export function applyConfiguredIncidentDomainRealtimeReportedStateShared(setIncidentStateByKey, domainKeyRaw, row = null, normalizedReport = null, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentSnapshotKey,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey || typeof setIncidentStateByKey !== "function") return;
  const { incidentId, changedAtIso } = incidentDomainBuildConfiguredRealtimeReportSnapshotShared(domainKey, row, normalizedReport, deps);
  if (!incidentId) return;
  setIncidentStateByKey((prev) => {
    const key = incidentSnapshotKey(domainKey, incidentId);
    if (!key) return prev;
    const prevIso = String(prev?.[key]?.last_changed_at || "");
    const prevTs = Date.parse(prevIso) || 0;
    const nextTs = Date.parse(changedAtIso) || 0;
    if (prevTs > nextTs) return prev;
    return {
      ...(prev || {}),
      [key]: { state: "reported", last_changed_at: changedAtIso || null },
    };
  });
}

export async function loadConfiguredIncidentDomainsBatchShared(state = {}, deps = {}) {
  const [configuredResults, persistedResults] = await Promise.all([
    Promise.all(
      (state.missingConfiguredDomainKeys || []).map(async (domainKey) => {
        const entry = state.configuredIncidentRuntimeEntryByDomain?.get(domainKey);
        if (!entry) {
          return {
            domainKey,
            seededRows: [],
            reportRows: [],
            seededError: null,
            reportError: null,
            setSeededRows: null,
            setReportRows: null,
          };
        }
        const result = await loadConfiguredIncidentDomainDataShared(
          domainKey,
          state.publicReadClient,
          state.loadTenantKey,
          deps,
        );
        return {
          domainKey,
          setSeededRows: entry.setSeededRows,
          setReportRows: entry.setReportRows,
          ...result,
        };
      }),
    ),
    Promise.all(
      (state.missingPersistedStateDomainKeys || []).map(async (domainKey) => ({
        domainKey,
        ...(await loadConfiguredIncidentPersistedRecordStateShared(
          domainKey,
          state.publicReadClient,
          state.loadTenantKey,
          deps,
        )),
      })),
    ),
  ]);

  if (state.isCancelled?.()) return;

  for (const entry of configuredResults) {
    applyLoadedConfiguredIncidentDomainStateShared(entry.domainKey, {
      seededRows: entry.seededRows,
      reportRows: entry.reportRows,
      seededError: entry.seededError,
      reportError: entry.reportError,
      setSeededRows: entry.setSeededRows,
      setReportRows: entry.setReportRows,
    }, deps);
  }
  for (const entry of persistedResults) {
    applyLoadedConfiguredIncidentPersistedRecordStateShared(entry.domainKey, {
      stateRows: entry.stateRows,
      stateError: entry.stateError,
      setPersistedIncidentRecordStateByDomain: state.setPersistedIncidentRecordStateByDomain,
    }, deps);
  }

  state.setConfiguredIncidentLoadedDomainKeys?.((prev) =>
    mergeLoadedConfiguredIncidentDomainKeysShared(prev, configuredResults, deps)
  );
  state.setConfiguredIncidentPersistedStateLoadedDomainKeys?.((prev) =>
    mergeLoadedConfiguredIncidentPersistedStateDomainKeysShared(prev, persistedResults, deps)
  );
}

export function scheduleConfiguredIncidentDomainsHydrationShared(state = {}, deps = {}) {
  const missingConfiguredDomainKeys = (state.configuredIncidentDemandDomainKeys || []).filter((domainKey) => (
    state.configuredIncidentRuntimeEntryByDomain?.has(domainKey)
    && !state.configuredIncidentLoadedDomainKeySet?.has(domainKey)
    && !state.configuredIncidentLoadingDomainKeysRef?.current?.has(domainKey)
  ));
  const configuredDemandDomainKeySet = new Set(state.configuredIncidentDemandDomainKeys || []);
  const missingPersistedStateDomainKeys = (state.configuredIncidentPersistedStateSupportedDomainKeys || []).filter((domainKey) => (
    configuredDemandDomainKeySet.has(domainKey)
    && !state.configuredIncidentPersistedStateLoadedDomainKeySet?.has(domainKey)
    && !state.configuredIncidentPersistedStateLoadingDomainKeysRef?.current?.has(domainKey)
  ));

  if (!missingConfiguredDomainKeys.length && !missingPersistedStateDomainKeys.length) {
    return null;
  }

  const cachedSeededByDomain = state.cachedSeededByDomain || {};
  const cachedReportByDomain = state.cachedReportByDomain || {};
  const cachedPersistedByDomain = state.cachedPersistedByDomain || {};

  const canRefreshConfiguredDomainsFromCachedSnapshot = missingConfiguredDomainKeys.every((domainKey) => (
    Object.prototype.hasOwnProperty.call(cachedSeededByDomain, domainKey)
    || Object.prototype.hasOwnProperty.call(cachedReportByDomain, domainKey)
  ));
  const canRefreshPersistedStateFromCachedSnapshot = missingPersistedStateDomainKeys.every((domainKey) => (
    Object.prototype.hasOwnProperty.call(cachedPersistedByDomain, domainKey)
  ));
  const shouldDeferCachedConfiguredIncidentRefresh =
    !state.reportsAdminView
    && state.publicMapCoreCacheHydrated
    && canRefreshConfiguredDomainsFromCachedSnapshot
    && canRefreshPersistedStateFromCachedSnapshot
    && (state.loading || !state.nonCriticalStartupReady);
  const shouldIdleRefreshCachedConfiguredIncidentDomains =
    !state.reportsAdminView
    && state.publicMapCoreCacheHydrated
    && canRefreshConfiguredDomainsFromCachedSnapshot
    && canRefreshPersistedStateFromCachedSnapshot;

  if (shouldDeferCachedConfiguredIncidentRefresh) {
    return null;
  }

  for (const domainKey of missingConfiguredDomainKeys) {
    state.configuredIncidentLoadingDomainKeysRef?.current?.add(domainKey);
  }
  for (const domainKey of missingPersistedStateDomainKeys) {
    state.configuredIncidentPersistedStateLoadingDomainKeysRef?.current?.add(domainKey);
  }

  let cancelled = false;
  let idleHandle = null;
  let timeoutHandle = null;

  const runLoad = async () => {
    try {
      await loadConfiguredIncidentDomainsBatchShared({
        missingConfiguredDomainKeys,
        missingPersistedStateDomainKeys,
        configuredIncidentRuntimeEntryByDomain: state.configuredIncidentRuntimeEntryByDomain,
        publicReadClient: state.publicReadClient,
        loadTenantKey: state.loadTenantKey,
        isCancelled: () => cancelled,
        setPersistedIncidentRecordStateByDomain: state.setPersistedIncidentRecordStateByDomain,
        setConfiguredIncidentLoadedDomainKeys: state.setConfiguredIncidentLoadedDomainKeys,
        setConfiguredIncidentPersistedStateLoadedDomainKeys: state.setConfiguredIncidentPersistedStateLoadedDomainKeys,
      }, deps);
    } finally {
      for (const domainKey of missingConfiguredDomainKeys) {
        state.configuredIncidentLoadingDomainKeysRef?.current?.delete(domainKey);
      }
      for (const domainKey of missingPersistedStateDomainKeys) {
        state.configuredIncidentPersistedStateLoadingDomainKeysRef?.current?.delete(domainKey);
      }
    }
  };

  if (shouldIdleRefreshCachedConfiguredIncidentDomains) {
    const idleTimeoutMs = state.idleTimeoutMs ?? 4200;
    const fallbackDelayMs = state.fallbackDelayMs ?? 1200;
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

export function subscribeConfiguredIncidentDomainRealtimeShared(domainKeyRaw, context = {}, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainConfiguredSourceTable,
    incidentDomainConfiguredRealtimeChannel,
    incidentDomainRemoveConfiguredRecordById,
    incidentDomainUpsertConfiguredSeededState,
    incidentDomainNormalizeConfiguredReportRecord,
    incidentDomainPrependConfiguredReportState,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) {
    return { seededChannel: null, reportsChannel: null };
  }
  const seededTable = incidentDomainConfiguredSourceTable(domainKey, "seeded");
  const seededChannelName = incidentDomainConfiguredRealtimeChannel(domainKey, "seeded");
  const reportsTable = incidentDomainConfiguredSourceTable(domainKey, "reports");
  const reportsChannelName = incidentDomainConfiguredRealtimeChannel(domainKey, "reports");
  const realtimeClient = context?.realtimeClient;

  const seededChannel = realtimeClient && seededTable && seededChannelName && typeof context?.setSeededRows === "function"
    ? realtimeClient
        .channel(seededChannelName)
        .on("postgres_changes", { event: "*", schema: "public", table: seededTable }, (payload) => {
          if (payload.eventType === "DELETE") {
            const id = payload?.old?.id;
            if (!id) return;
            context.setSeededRows((prev) => incidentDomainRemoveConfiguredRecordById(prev, id));
            return;
          }
          context.setSeededRows((prev) => incidentDomainUpsertConfiguredSeededState(domainKey, prev, payload?.new));
        })
        .subscribe()
    : null;

  const reportsChannel = realtimeClient && reportsTable && reportsChannelName && typeof context?.setReportRows === "function"
    ? realtimeClient
        .channel(reportsChannelName)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: reportsTable }, (payload) => {
          const row = payload?.new;
          const normalizedReport = incidentDomainNormalizeConfiguredReportRecord(domainKey, row);
          if (!normalizedReport?.id) return;
          context.setReportRows((prev) => incidentDomainPrependConfiguredReportState(domainKey, prev, row));
          applyConfiguredIncidentDomainRealtimeReportedStateShared(
            context?.setIncidentStateByKey,
            domainKey,
            row,
            normalizedReport,
            deps
          );
        })
        .subscribe()
    : null;

  return {
    seededChannel,
    reportsChannel,
  };
}

export function subscribeConfiguredIncidentPersistedRecordStateRealtimeShared(domainKeyRaw, context = {}, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainConfiguredPersistedRecordStateTable,
    incidentDomainConfiguredPersistedRecordStateRealtimeChannel,
    getIncidentDomainHelper,
    incidentDomainNormalizePersistedRecordStateRow,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const realtimeClient = context?.realtimeClient;
  const sourceTable = incidentDomainConfiguredPersistedRecordStateTable(domainKey);
  const channelName = incidentDomainConfiguredPersistedRecordStateRealtimeChannel(domainKey);
  if (!domainKey || !realtimeClient || !sourceTable || !channelName || typeof context?.setPersistedIncidentRecordStateByDomain !== "function") {
    return { stateChannel: null };
  }

  const incidentIdField = String(getIncidentDomainHelper(domainKey)?.persistedRecordStateIncidentIdField || "incident_id").trim();
  const stateChannel = realtimeClient
    .channel(channelName)
    .on("postgres_changes", { event: "*", schema: "public", table: sourceTable }, (payload) => {
      const eventType = String(payload?.eventType || "").toUpperCase();
      if (eventType === "DELETE") {
        const incidentId = String(payload?.old?.[incidentIdField] || payload?.old?.incident_id || "").trim();
        if (!incidentId) return;
        context.setPersistedIncidentRecordStateByDomain((prev) => {
          const prevByDomain = prev && typeof prev === "object" ? prev : {};
          const prevDomainState = prevByDomain?.[domainKey] && typeof prevByDomain[domainKey] === "object"
            ? prevByDomain[domainKey]
            : {};
          if (!Object.prototype.hasOwnProperty.call(prevDomainState, incidentId)) return prev;
          const nextDomainState = { ...prevDomainState };
          delete nextDomainState[incidentId];
          return {
            ...prevByDomain,
            [domainKey]: nextDomainState,
          };
        });
        return;
      }

      const normalized = incidentDomainNormalizePersistedRecordStateRow(domainKey, payload?.new);
      const incidentId = String(normalized?.incident_id || "").trim();
      if (!incidentId) return;
      context.setPersistedIncidentRecordStateByDomain((prev) => {
        const prevByDomain = prev && typeof prev === "object" ? prev : {};
        const prevDomainState = prevByDomain?.[domainKey] && typeof prevByDomain[domainKey] === "object"
          ? prevByDomain[domainKey]
          : {};
        return {
          ...prevByDomain,
          [domainKey]: {
            ...prevDomainState,
            [incidentId]: normalized,
          },
        };
      });
    })
    .subscribe();

  return { stateChannel };
}
