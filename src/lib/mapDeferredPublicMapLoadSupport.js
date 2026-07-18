const TENANT_BOUNDARY_GEOJSON_CACHE_KEY = "cityreport_tenant_boundary_geojson_v1";

export async function fetchAllOfficialLightsShared(client, tenantKey = "", { isMissingTenantKeyColumnError } = {}) {
  const pageSize = 1000;
  let from = 0;
  let all = [];

  while (true) {
    const baseQuery = client
      .from("official_lights")
      .select("id, sl_id, lat, lng, nearest_address, nearest_cross_street, nearest_landmark")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    let data = null;
    let error = null;
    if (tenantKey) {
      const scoped = await baseQuery.eq("tenant_key", tenantKey);
      data = scoped.data || null;
      error = scoped.error || null;
      if (error && typeof isMissingTenantKeyColumnError == "function" && isMissingTenantKeyColumnError(error)) {
        const fallback = await client
          .from("official_lights")
          .select("id, sl_id, lat, lng, nearest_address, nearest_cross_street, nearest_landmark")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, from + pageSize - 1);
        data = fallback.data || null;
        error = fallback.error || null;
      }
    } else {
      const result = await baseQuery;
      data = result.data || null;
      error = result.error || null;
    }

    if (error) throw error;

    all = all.concat(data || []);

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

function tenantBoundaryGeojsonCacheStorageKeyShared(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  if (!normalizedTenantKey) return "";
  return `${TENANT_BOUNDARY_GEOJSON_CACHE_KEY}:${normalizedTenantKey}`;
}

export function readCachedTenantBoundaryGeojsonShared(tenantKey, deps = {}) {
  if (typeof window === "undefined") return null;
  const storageKey = tenantBoundaryGeojsonCacheStorageKeyShared(tenantKey);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedBoundary = parsed && typeof parsed === "object" && parsed.boundary
      ? parsed.boundary
      : parsed;
    return typeof deps.parseGeoJsonValue === "function"
      ? deps.parseGeoJsonValue(cachedBoundary)
      : cachedBoundary;
  } catch {
    return null;
  }
}

export function writeCachedTenantBoundaryGeojsonShared(tenantKey, geojson, deps = {}) {
  if (typeof window === "undefined") return;
  const storageKey = tenantBoundaryGeojsonCacheStorageKeyShared(tenantKey);
  if (!storageKey) return;
  try {
    const normalizedBoundary = typeof deps.parseGeoJsonValue === "function"
      ? deps.parseGeoJsonValue(geojson)
      : geojson;
    if (!normalizedBoundary) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify({
      boundary: normalizedBoundary,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}

export function clearCachedTenantBoundaryGeojsonShared(tenantKey) {
  if (typeof window === "undefined") return;
  const storageKey = tenantBoundaryGeojsonCacheStorageKeyShared(tenantKey);
  if (!storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore cache clear failures
  }
}

export async function fetchAllIncidentStateCurrentShared(client, tenantKey = "", { isMissingTenantKeyColumnError } = {}) {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const baseQuery = client
      .from("incident_state_current")
      .select("domain, incident_id, state, last_changed_at")
      .order("last_changed_at", { ascending: false })
      .order("domain", { ascending: true })
      .order("incident_id", { ascending: true })
      .range(from, from + pageSize - 1);
    let data = null;
    let error = null;
    if (tenantKey) {
      const scoped = await baseQuery.eq("tenant_key", tenantKey);
      data = scoped.data || null;
      error = scoped.error || null;
      if (error && typeof isMissingTenantKeyColumnError == "function" && isMissingTenantKeyColumnError(error)) {
        const fallback = await client
          .from("incident_state_current")
          .select("domain, incident_id, state, last_changed_at")
          .order("last_changed_at", { ascending: false })
          .order("domain", { ascending: true })
          .order("incident_id", { ascending: true })
          .range(from, from + pageSize - 1);
        data = fallback.data || null;
        error = fallback.error || null;
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

export async function fetchAllConfiguredIncidentPersistedRecordStateShared(
  client,
  domainKeyRaw,
  tenantKey = "",
  {
    normalizeDomainKeyOrSlug,
    incidentDomainConfiguredPersistedRecordStateTable,
    incidentDomainConfiguredPersistedRecordStateSelectFields,
    incidentDomainConfiguredPersistedRecordStateOrderField,
    isMissingTenantKeyColumnError,
  } = {}
) {
  const domainKey = typeof normalizeDomainKeyOrSlug == "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : String(domainKeyRaw || "").trim().toLowerCase();
  const sourceTable = typeof incidentDomainConfiguredPersistedRecordStateTable == "function"
    ? incidentDomainConfiguredPersistedRecordStateTable(domainKey)
    : "";
  const selectFields = typeof incidentDomainConfiguredPersistedRecordStateSelectFields == "function"
    ? (incidentDomainConfiguredPersistedRecordStateSelectFields(domainKey) || "*")
    : "*";
  const orderField = typeof incidentDomainConfiguredPersistedRecordStateOrderField == "function"
    ? incidentDomainConfiguredPersistedRecordStateOrderField(domainKey)
    : "updated_at";
  if (!domainKey || !sourceTable) return [];
  const pageSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const baseQuery = client
      .from(sourceTable)
      .select(selectFields)
      .order(orderField, { ascending: false })
      .order("incident_id", { ascending: true })
      .range(from, from + pageSize - 1);
    let data = null;
    let error = null;
    if (tenantKey) {
      const scoped = await baseQuery.eq("tenant_key", tenantKey);
      data = scoped.data || null;
      error = scoped.error || null;
      if (error && typeof isMissingTenantKeyColumnError == "function" && isMissingTenantKeyColumnError(error)) {
        const fallback = await client
          .from(sourceTable)
          .select(selectFields)
          .order(orderField, { ascending: false })
          .order("incident_id", { ascending: true })
          .range(from, from + pageSize - 1);
        data = fallback.data || null;
        error = fallback.error || null;
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

export async function fetchAllIncidentLocationCacheShared(client, tenantKey = "") {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const baseQuery = client
      .from("incident_location_cache")
      .select("tenant_key, domain, incident_id, lat, lng, location_label, nearest_address, nearest_cross_street, nearest_intersection, nearest_landmark, geo_updated_at, updated_at")
      .order("updated_at", { ascending: false })
      .order("domain", { ascending: true })
      .order("incident_id", { ascending: true })
      .range(from, from + pageSize - 1);
    let data = null;
    let error = null;
    if (tenantKey) {
      const scoped = await baseQuery.eq("tenant_key", tenantKey);
      data = scoped.data || null;
      error = scoped.error || null;
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

export function buildOfficialLightRuntimeMapsShared(officialLightRows = []) {
  const normalizedOfficialLightIdSet = new Set(
    (officialLightRows || []).map((row) => String(row?.id || "").trim()).filter(Boolean)
  );
  const officialIdByAlias = new Map();
  const officialIdByCoordKey = new Map();
  for (const ol of officialLightRows || []) {
    const id = String(ol?.id || "").trim();
    if (!id) continue;
    officialIdByAlias.set(id, id);
    const sl = String(ol?.sl_id || "").trim();
    if (sl) officialIdByAlias.set(sl, id);
    const lat = Number(ol?.lat);
    const lng = Number(ol?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      officialIdByCoordKey.set(`${lat.toFixed(5)}:${lng.toFixed(5)}`, id);
      officialIdByCoordKey.set(`${lat.toFixed(4)}:${lng.toFixed(4)}`, id);
    }
  }
  return {
    normalizedOfficialLightIdSet,
    officialIdByAlias,
    officialIdByCoordKey,
  };
}

export function buildKnownAssetIdSetsByDomainShared(
  normalizedOfficialLightIdSet,
  configuredIncidentNormalizedSeededRowsByDomain,
  {
    isAssetBackedDomainType,
  } = {}
) {
  return new Map([
    ["streetlights", normalizedOfficialLightIdSet],
    ...Array.from(configuredIncidentNormalizedSeededRowsByDomain.entries())
      .filter(([domainKey]) => String(domainKey || "").trim() !== "streetlights" && isAssetBackedDomainType(domainKey))
      .map(([domainKey, rows]) => [
        domainKey,
        new Set((Array.isArray(rows) ? rows : []).map((row) => String(row?.id || "").trim()).filter(Boolean)),
      ]),
  ]);
}

export function normalizeResidentReportRowShared(row = null, state = {}, deps = {}) {
  if (!row || typeof row !== "object") return null;
  const normalizedLightId = deps.canonicalOfficialLightId(
    row.light_id,
    row.lat,
    row.lng,
    state.officialIdByAlias,
    state.officialIdByCoordKey,
    state.officialLightRows || null,
  );
  const normalizedDomain = deps.normalizeDomainKeyOrSlug(row.report_domain, { allowUnknown: true }) || null;
  const normalizedRow = {
    id: row.id,
    lat: row.lat,
    lng: row.lng,
    type: row.report_type,
    report_domain: normalizedDomain,
    domain: normalizedDomain,
    report_quality: deps.normalizeReportQuality(row.report_quality),
    note: row.note || "",
    ts: new Date(row.created_at).getTime(),
    light_id: normalizedLightId,
    report_number: row.report_number || null,
    reporter_user_id: row.reporter_user_id || null,
    reporter_name: row.reporter_name || null,
    reporter_phone: row.reporter_phone || null,
    reporter_email: row.reporter_email || null,
  };
  const inferredDomain = deps.reportDomainForRow(normalizedRow, state.knownAssetIdSetsByDomain);
  if (inferredDomain === "streetlights" && !state.officialLightIdSet?.has(String(normalizedLightId || "").trim())) {
    return null;
  }
  return normalizedRow;
}

export function shouldRetrySparseFirstLoadShared(state = {}) {
  const registryDomainCount = Number(state.registryDomainCount || 0);
  const visibleDomainCount = Number(state.visibleDomainCount || 0);
  const expectedConfiguredRuntimeDomainCount = Number(state.expectedConfiguredRuntimeDomainCount || 0);
  const configuredDomainsWithAnyData = new Set();
  for (const countsByDomain of [
    state.configuredIncidentSeededCountByDomain,
    state.configuredIncidentReportCountByDomain,
    state.configuredPersistedRecordStateCountByDomain,
  ]) {
    if (!countsByDomain || typeof countsByDomain !== "object") continue;
    for (const [domainKeyRaw, countRaw] of Object.entries(countsByDomain)) {
      const count = Number(countRaw || 0);
      if (count > 0) configuredDomainsWithAnyData.add(String(domainKeyRaw || "").trim());
    }
  }
  const shouldRetryPartialConfiguredRuntime = Boolean(
    expectedConfiguredRuntimeDomainCount > 1
    && configuredDomainsWithAnyData.size > 0
    && configuredDomainsWithAnyData.size < Math.min(expectedConfiguredRuntimeDomainCount, 2)
  );
  return Boolean(
    !state.cancelled
    && !state.reportsAdminView
    && Number(state.loadAttempt || 0) < 2
    && Boolean(state.loadTenantKey)
    && !state.repErr
    && !state.offErr
    && (
      (!state.genericIncidentDataLoaded && Math.max(registryDomainCount, visibleDomainCount) > 2)
      || shouldRetryPartialConfiguredRuntime
      || state.waitingForDomainConfigForRetry
    )
  );
}

export function buildIncidentStateSnapshotShared(rows = [], deps = {}) {
  const nextIncidentStateByKey = {};
  for (const row of rows || []) {
    const key = deps.incidentSnapshotKey(row?.domain, row?.incident_id);
    if (!key) continue;
    nextIncidentStateByKey[key] = {
      state: String(row?.state || "").trim(),
      last_changed_at: row?.last_changed_at || null,
    };
  }
  return nextIncidentStateByKey;
}

export function hasConnectionLikeFailureShared(errors = [], deps = {}) {
  return (errors || []).some((error) => deps.isConnectionLikeDbError(error));
}

function sanitizeCachedPublicMapReportsForWriteShared(rows = [], deps = {}) {
  const normalizedRows = typeof deps.normalizeCachedPublicMapReports == "function"
    ? deps.normalizeCachedPublicMapReports(rows)
    : [];
  return normalizedRows.map((row) => ({
    ...row,
    reporter_name: null,
  }));
}

function sanitizeCachedConfiguredIncidentReportRowsByDomainForWriteShared(rowsByDomain = {}, deps = {}) {
  if (!rowsByDomain || typeof rowsByDomain !== "object") return {};
  const next = {};
  for (const [domainKeyRaw, rows] of Object.entries(rowsByDomain)) {
    const domainKey = typeof deps.normalizeDomainKeyOrSlug == "function"
      ? deps.normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey || !Array.isArray(rows) || typeof deps.incidentDomainNormalizeConfiguredReportRecord != "function") {
      continue;
    }
    const sanitizedRows = rows
      .map((row) => deps.incidentDomainNormalizeConfiguredReportRecord(domainKey, row))
      .filter(Boolean)
      .map((row) => ({
        ...row,
        reporter_name: null,
      }));
    if (!sanitizedRows.length) continue;
    next[domainKey] = sanitizedRows;
  }
  return next;
}

function sanitizeCachedActionsByLightIdForWriteShared(value = {}) {
  if (!value || typeof value !== "object") return {};
  const next = {};
  for (const [lightIdRaw, rows] of Object.entries(value)) {
    const lightId = String(lightIdRaw || "").trim();
    if (!lightId || !Array.isArray(rows)) continue;
    const sanitizedRows = rows
      .map((row) => {
        const ts = Number(row?.ts || 0);
        if (!Number.isFinite(ts) || ts <= 0) return null;
        return {
          action: String(row?.action || "").trim(),
          ts,
          actor_user_id: row?.actor_user_id || null,
          reporter_user_id: row?.reporter_user_id || null,
        };
      })
      .filter(Boolean);
    if (!sanitizedRows.length) continue;
    next[lightId] = sanitizedRows;
  }
  return next;
}

export function writeCachedTenantPublicMapCoreSnapshotShared(tenantKey, snapshot, deps = {}) {
  if (typeof window === "undefined") return;
  const storageKey = typeof deps.tenantPublicMapCoreCacheStorageKey == "function"
    ? deps.tenantPublicMapCoreCacheStorageKey(tenantKey)
    : "";
  if (!storageKey) return;
  try {
    const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    const officialLights = Array.isArray(safeSnapshot.officialLights)
      ? safeSnapshot.officialLights.map((row) => deps.normalizeOfficialLightRow(row)).filter(Boolean)
      : [];
    const reports = sanitizeCachedPublicMapReportsForWriteShared(safeSnapshot.reports, deps);
    const normalizedSnapshot = {
      officialLights,
      reports,
      streetlightOutageTsByLightId: typeof deps.normalizeCachedStreetlightOutageTsByLightId == "function"
        ? deps.normalizeCachedStreetlightOutageTsByLightId(
            safeSnapshot.streetlightOutageTsByLightId
            || deps.derivePublicMapReportRuntimeState(
              reports,
              new Set(officialLights.map((row) => String(row?.id || "").trim()).filter(Boolean)),
              {
                assumeNormalized: true,
              }
            ).streetlightOutageTsByLightId
          )
        : {},
      incidentStateByKey: typeof deps.normalizeCachedIncidentStateByKey == "function"
        ? deps.normalizeCachedIncidentStateByKey(safeSnapshot.incidentStateByKey)
        : {},
      fixedLights: typeof deps.normalizeCachedFixedLights == "function"
        ? deps.normalizeCachedFixedLights(safeSnapshot.fixedLights)
        : {},
      actionsByLightId: sanitizeCachedActionsByLightIdForWriteShared(safeSnapshot.actionsByLightId),
      configuredIncidentSeededRowsStateByDomain: typeof deps.normalizeCachedConfiguredIncidentRowsByDomain == "function"
        ? deps.normalizeCachedConfiguredIncidentRowsByDomain(
            safeSnapshot.configuredIncidentSeededRowsStateByDomain,
            "seeded"
          )
        : {},
      configuredIncidentReportRowsStateByDomain: sanitizeCachedConfiguredIncidentReportRowsByDomainForWriteShared(
        safeSnapshot.configuredIncidentReportRowsStateByDomain,
        deps
      ),
      persistedIncidentRecordStateByDomain: typeof deps.normalizeCachedPersistedIncidentRecordStateByDomain == "function"
        ? deps.normalizeCachedPersistedIncidentRecordStateByDomain(
            safeSnapshot.persistedIncidentRecordStateByDomain
          )
        : {},
    };
    const hasAnyData =
      normalizedSnapshot.officialLights.length > 0 ||
      normalizedSnapshot.reports.length > 0 ||
      Object.keys(normalizedSnapshot.streetlightOutageTsByLightId).length > 0 ||
      Object.keys(normalizedSnapshot.incidentStateByKey).length > 0 ||
      Object.keys(normalizedSnapshot.fixedLights).length > 0 ||
      Object.keys(normalizedSnapshot.actionsByLightId).length > 0 ||
      Object.keys(normalizedSnapshot.configuredIncidentSeededRowsStateByDomain).length > 0 ||
      Object.keys(normalizedSnapshot.configuredIncidentReportRowsStateByDomain).length > 0 ||
      Object.keys(normalizedSnapshot.persistedIncidentRecordStateByDomain).length > 0;
    if (!hasAnyData) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify({
      ...normalizedSnapshot,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}

export async function fetchTenantDomainPublicConfigShared(client) {
  const { data, error } = await client.rpc("tenant_domain_public_config");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchTenantAssignedDomainsShared(client) {
  const { data, error } = await client.rpc("tenant_assigned_domains_public");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchTenantRegistryIncidentDomainsShared(client) {
  const { data, error } = await client.rpc("tenant_registry_incident_domains_public");
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchTenantBoundaryGeojsonShared(
  client,
  tenantKeyRaw = "",
  {
    tenantBoundaryConfigKey,
    parseGeoJsonValue,
  } = {}
) {
  const tenantKey = String(tenantKeyRaw || "").trim().toLowerCase();
  let boundaryKey = typeof tenantBoundaryConfigKey == "function"
    ? tenantBoundaryConfigKey()
    : "ashtabula_city_geojson";
  let cfg = null;
  let cfgErr = null;

  const tenantBoundary = await client
    .from("tenants")
    .select("boundary_config_key")
    .eq("tenant_key", tenantKey)
    .maybeSingle();
  if (!tenantBoundary.error && tenantBoundary.data?.boundary_config_key) {
    const configuredBoundaryKey = String(tenantBoundary.data.boundary_config_key || "").trim();
    if (configuredBoundaryKey) boundaryKey = configuredBoundaryKey;
  }

  const boundaryConfigResult = await client
    .from("app_config")
    .select("value")
    .eq("key", boundaryKey)
    .maybeSingle();
  cfg = boundaryConfigResult.data || null;
  cfgErr = boundaryConfigResult.error || null;

  if ((!cfg?.value || cfgErr) && tenantKey === "ashtabulacity" && boundaryKey !== "ashtabula_city_geojson") {
    const fallback = await client
      .from("app_config")
      .select("value")
      .eq("key", "ashtabula_city_geojson")
      .maybeSingle();
    if (!fallback.error && fallback.data?.value) {
      cfg = fallback.data;
      cfgErr = null;
    }
  }

  if (!cfg?.value || cfgErr) {
    const { data: boundaryFiles, error: boundaryFilesErr } = await client
      .from("tenant_files")
      .select("storage_bucket,storage_path")
      .eq("tenant_key", tenantKey)
      .eq("file_category", "boundary_geojson")
      .eq("active", true)
      .order("uploaded_at", { ascending: false })
      .limit(1);
    if (!boundaryFilesErr && Array.isArray(boundaryFiles) && boundaryFiles.length > 0) {
      const newest = boundaryFiles[0] || {};
      const bucket = String(newest?.storage_bucket || "tenant-files").trim() || "tenant-files";
      const path = String(newest?.storage_path || "").trim();
      if (path) {
        const signed = await client.storage.from(bucket).createSignedUrl(path, 90);
        const signedUrl = String(signed?.data?.signedUrl || "").trim();
        if (!signed?.error && signedUrl) {
          try {
            const resp = await fetch(signedUrl, { method: "GET" });
            if (resp.ok) {
              const rawText = await resp.text();
              const parsed = typeof parseGeoJsonValue == "function" ? parseGeoJsonValue(rawText) : null;
              if (parsed) {
                cfg = { value: parsed };
                cfgErr = null;
              }
            }
          } catch {
            // ignore boundary file fetch/parse fallback failure
          }
        }
      }
    }
  }

  return {
    geojson: typeof parseGeoJsonValue == "function" ? (parseGeoJsonValue(cfg?.value) || null) : null,
    error: cfgErr || null,
  };
}

export async function fetchTenantAssignedDomainsRobustShared(
  tenantKey,
  client,
  {
    fetchTenantAssignedDomains,
    createTenantScopedReadClient,
  } = {}
) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  const first = await fetchTenantAssignedDomains(client);
  if (first.length || !normalizedTenantKey) return first;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 150 * (attempt + 1)));
    const retryClient = typeof createTenantScopedReadClient == "function"
      ? (createTenantScopedReadClient(normalizedTenantKey) || client)
      : client;
    const retryRows = await fetchTenantAssignedDomains(retryClient);
    if (retryRows.length) return retryRows;
  }

  return first;
}

export async function selectTenantScopedPublicRowsShared(
  client,
  tableName,
  selectClause,
  tenantKey,
  orderColumn = "created_at",
  options = {},
  {
    isMissingTenantKeyColumnError,
  } = {}
) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  const preferScopedClient = Boolean(options?.preferScopedClient);
  selectTenantScopedPublicRowsShared._missingTenantKeyTables ||= new Set();
  const knownMissingTenantKey = selectTenantScopedPublicRowsShared._missingTenantKeyTables.has(tableName);
  const baseQuery = () =>
    client.from(tableName).select(selectClause).order(orderColumn, { ascending: false });

  if (!normalizedTenantKey || knownMissingTenantKey || preferScopedClient) {
    return baseQuery();
  }

  const first = await baseQuery().eq("tenant_key", normalizedTenantKey);
  if (!(first?.error && typeof isMissingTenantKeyColumnError == "function" && isMissingTenantKeyColumnError(first.error))) {
    return first;
  }
  selectTenantScopedPublicRowsShared._missingTenantKeyTables.add(tableName);
  return baseQuery();
}

export function scheduleDeferredStartupFollowupRuntimeShared(loadFn, {
  startupDelayMs = 4600,
  idleTimeoutMs = 1200,
  fallbackDelayMs = 0,
} = {}) {
  let cancelled = false;
  let startupTimeoutHandle = null;
  let idleHandle = null;
  let timeoutHandle = null;

  const runLoad = async () => {
    if (cancelled) return;
    await loadFn(() => cancelled);
  };

  const scheduleRun = () => {
    if (cancelled) return;
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => {
        idleHandle = null;
        if (!cancelled) void runLoad();
      }, { timeout: idleTimeoutMs });
      return;
    }
    if (typeof window !== "undefined") {
      timeoutHandle = window.setTimeout(() => {
        timeoutHandle = null;
        if (!cancelled) void runLoad();
      }, fallbackDelayMs);
      return;
    }
    void runLoad();
  };

  if (typeof window !== "undefined") {
    startupTimeoutHandle = window.setTimeout(() => {
      startupTimeoutHandle = null;
      scheduleRun();
    }, startupDelayMs);
  } else {
    scheduleRun();
  }

  return () => {
    cancelled = true;
    if (startupTimeoutHandle != null && typeof window !== "undefined") {
      window.clearTimeout(startupTimeoutHandle);
    }
    if (idleHandle != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle != null && typeof window !== "undefined") {
      window.clearTimeout(timeoutHandle);
    }
  };
}
