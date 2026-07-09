import {
  buildIncidentLocationCacheEntryPayload as buildIncidentLocationCacheEntryPayloadShared,
  incidentLocationCacheKey as incidentLocationCacheKeyShared,
  incidentLocationNeedsEnrichment as incidentLocationNeedsEnrichmentShared,
  sanitizeIncidentLocationCacheMap as sanitizeIncidentLocationCacheMapShared,
} from "./mapIncidentLocationCacheSupport.js";

function buildConfiguredRuntimeEntry(domainKey, deps = {}) {
  const buildConfiguredIncidentDomainRuntimeEntry =
    typeof deps?.buildConfiguredIncidentDomainRuntimeEntry === "function"
      ? deps.buildConfiguredIncidentDomainRuntimeEntry
      : () => null;
  const incidentDomainHelperKeysForConfiguredField =
    typeof deps?.incidentDomainHelperKeysForConfiguredField === "function"
      ? deps.incidentDomainHelperKeysForConfiguredField
      : () => [];
  const setConfiguredIncidentSeededRowsForDomain =
    typeof deps?.setConfiguredIncidentSeededRowsForDomain === "function"
      ? deps.setConfiguredIncidentSeededRowsForDomain
      : () => {};
  const setConfiguredIncidentReportRowsForDomain =
    typeof deps?.setConfiguredIncidentReportRowsForDomain === "function"
      ? deps.setConfiguredIncidentReportRowsForDomain
      : () => {};

  return (
    buildConfiguredIncidentDomainRuntimeEntry(domainKey, {
      setSeededRowsByDomain: new Map(
        incidentDomainHelperKeysForConfiguredField("seededSourceTable").map((configuredDomainKey) => [
          configuredDomainKey,
          (nextRowsOrUpdater) =>
            setConfiguredIncidentSeededRowsForDomain(configuredDomainKey, nextRowsOrUpdater),
        ])
      ),
      setReportRowsByDomain: new Map(
        incidentDomainHelperKeysForConfiguredField("reportsSourceTable").map((configuredDomainKey) => [
          configuredDomainKey,
          (nextRowsOrUpdater) =>
            setConfiguredIncidentReportRowsForDomain(configuredDomainKey, nextRowsOrUpdater),
        ])
      ),
    }) || null
  );
}

function upsertIncidentLocationCacheEntryRuntimeShared(domainKeyRaw, incidentIdRaw, nextValues = {}, deps = {}) {
  const resolveIncidentLocationCacheKey =
    typeof deps?.incidentLocationCacheKey === "function"
      ? deps.incidentLocationCacheKey
      : incidentLocationCacheKeyShared;
  const sanitizeIncidentLocationCacheMap =
    typeof deps?.sanitizeIncidentLocationCacheMap === "function"
      ? deps.sanitizeIncidentLocationCacheMap
      : sanitizeIncidentLocationCacheMapShared;
  const setIncidentLocationCacheByKey =
    typeof deps?.setIncidentLocationCacheByKey === "function"
      ? deps.setIncidentLocationCacheByKey
      : () => {};

  const key = resolveIncidentLocationCacheKey(domainKeyRaw, incidentIdRaw);
  if (!key) return;
  setIncidentLocationCacheByKey((prev) => {
    const existing = prev?.[key] || {};
    const merged = sanitizeIncidentLocationCacheMap({
      [key]: {
        ...existing,
        ...nextValues,
      },
    });
    if (!merged[key]) return prev || {};
    return {
      ...(prev || {}),
      [key]: merged[key],
    };
  });
}

async function persistIncidentLocationCacheEntryRuntimeShared(
  domainKeyRaw,
  incidentIdRaw,
  nextValues = {},
  extra = {},
  deps = {}
) {
  const normalizeDomainKeyOrSlug =
    typeof deps?.normalizeDomainKeyOrSlug === "function"
      ? deps.normalizeDomainKeyOrSlug
      : () => "";
  const normalizeDomainKey =
    typeof deps?.normalizeDomainKey === "function"
      ? deps.normalizeDomainKey
      : () => "";
  const incidentDomainNormalizePersistenceIncidentId =
    typeof deps?.incidentDomainNormalizePersistenceIncidentId === "function"
      ? deps.incidentDomainNormalizePersistenceIncidentId
      : () => "";
  const resolveIncidentLocationCacheKey =
    typeof deps?.incidentLocationCacheKey === "function"
      ? deps.incidentLocationCacheKey
      : incidentLocationCacheKeyShared;
  const sanitizeIncidentLocationCacheMap =
    typeof deps?.sanitizeIncidentLocationCacheMap === "function"
      ? deps.sanitizeIncidentLocationCacheMap
      : sanitizeIncidentLocationCacheMapShared;
  const incidentDomainApplyPersistedLocationCacheState =
    typeof deps?.incidentDomainApplyPersistedLocationCacheState === "function"
      ? deps.incidentDomainApplyPersistedLocationCacheState
      : () => {};
  const setPersistedIncidentRecordStateByDomain =
    typeof deps?.setPersistedIncidentRecordStateByDomain === "function"
      ? deps.setPersistedIncidentRecordStateByDomain
      : () => {};
  const setOfficialLights =
    typeof deps?.setOfficialLights === "function"
      ? deps.setOfficialLights
      : () => {};
  const supabase = deps?.supabase;
  const activeTenantKey =
    typeof deps?.activeTenantKey === "function"
      ? deps.activeTenantKey
      : () => "";

  const domainKey =
    normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
  const incidentId = String(incidentIdRaw || "").trim();
  if (!domainKey || !incidentId) return null;

  const persistedIncidentId = incidentDomainNormalizePersistenceIncidentId(domainKey, incidentId);
  const configuredRuntimeEntry = buildConfiguredRuntimeEntry(domainKey, deps);
  const cacheKey = resolveIncidentLocationCacheKey(domainKey, incidentId);
  const sanitizedEntry = sanitizeIncidentLocationCacheMap({
    [cacheKey]: nextValues,
  })[cacheKey];
  if (!sanitizedEntry) return null;

  upsertIncidentLocationCacheEntryRuntimeShared(domainKey, incidentId, sanitizedEntry, deps);

  const applyLocalLocationPatch = () => {
    if (domainKey === "streetlights") {
      setOfficialLights((prev) =>
        (prev || []).map((row) => {
          if (String(row?.id || "").trim() !== incidentId) return row;
          return {
            ...row,
            nearest_address: sanitizedEntry.nearestAddress || row?.nearest_address || "",
            nearest_cross_street: sanitizedEntry.nearestCrossStreet || row?.nearest_cross_street || "",
            nearest_landmark: sanitizedEntry.nearestLandmark || row?.nearest_landmark || "",
          };
        })
      );
      return;
    }
    incidentDomainApplyPersistedLocationCacheState(domainKey, {
      ...(configuredRuntimeEntry || {}),
      incidentId,
      sanitizedEntry,
      cacheRow: null,
      extra,
      setPersistedIncidentRecordStateByDomain,
    });
  };

  applyLocalLocationPatch();

  if (!persistedIncidentId || !supabase?.functions?.invoke) {
    return null;
  }

  try {
    const { data: cacheData, error: cacheErr } = await supabase.functions.invoke(
      "cache-official-light-geo",
      {
        body: {
          tenant_key: activeTenantKey(),
          domain: domainKey,
          incident_id: persistedIncidentId,
          light_id: persistedIncidentId,
          lat: Number.isFinite(Number(extra?.lat)) ? Number(extra.lat) : null,
          lng: Number.isFinite(Number(extra?.lng)) ? Number(extra.lng) : null,
          issue_type: String(extra?.issueType || "").trim() || null,
          location_label: sanitizedEntry.locationLabel || null,
          nearest_address: sanitizedEntry.nearestAddress || null,
          nearest_cross_street: sanitizedEntry.nearestCrossStreet || null,
          nearest_intersection: sanitizedEntry.nearestIntersection || null,
          nearest_landmark: sanitizedEntry.nearestLandmark || null,
        },
      }
    );
    if (cacheErr) {
      console.warn(`[cache-official-light-geo] ${domainKey} cache warning:`, cacheErr);
      return null;
    }

    if (domainKey !== "streetlights") {
      incidentDomainApplyPersistedLocationCacheState(domainKey, {
        ...(configuredRuntimeEntry || {}),
        incidentId,
        sanitizedEntry,
        cacheRow: cacheData?.row || null,
        extra,
        setPersistedIncidentRecordStateByDomain,
      });
    }

    return cacheData?.row || null;
  } catch (error) {
    console.warn(`[cache-official-light-geo] ${domainKey} cache warning:`, error);
    return null;
  }
}

export async function persistIncidentLocationCacheWithEnrichmentRuntimeShared(
  domainKeyRaw,
  incidentIdRaw,
  options = {},
  deps = {}
) {
  const normalizeDomainKeyOrSlug =
    typeof deps?.normalizeDomainKeyOrSlug === "function"
      ? deps.normalizeDomainKeyOrSlug
      : () => "";
  const normalizeDomainKey =
    typeof deps?.normalizeDomainKey === "function"
      ? deps.normalizeDomainKey
      : () => "";
  const buildIncidentLocationCacheEntryPayload =
    typeof deps?.buildIncidentLocationCacheEntryPayload === "function"
      ? deps.buildIncidentLocationCacheEntryPayload
      : buildIncidentLocationCacheEntryPayloadShared;
  const incidentLocationNeedsEnrichment =
    typeof deps?.incidentLocationNeedsEnrichment === "function"
      ? deps.incidentLocationNeedsEnrichment
      : incidentLocationNeedsEnrichmentShared;
  const reverseGeocodeRoadLabel =
    typeof deps?.reverseGeocodeRoadLabel === "function"
      ? deps.reverseGeocodeRoadLabel
      : async () => null;

  const domainKey =
    normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
  const incidentId = String(incidentIdRaw || "").trim();
  if (!domainKey || !incidentId) return null;

  const extra = options?.extra && typeof options.extra === "object" ? options.extra : {};
  const basePayload = buildIncidentLocationCacheEntryPayload(
    options?.payload,
    options?.locationLabelFallback
  );
  if (!basePayload) return null;

  await persistIncidentLocationCacheEntryRuntimeShared(
    domainKey,
    incidentId,
    basePayload,
    extra,
    deps
  );

  if (
    !incidentLocationNeedsEnrichment(basePayload, {
      requireUsableAddress: options?.requireUsableAddressForEnrichment,
    })
  ) {
    return null;
  }

  const lat = Number(extra?.lat);
  const lng = Number(extra?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    const enrichedGeo = await reverseGeocodeRoadLabel(lat, lng, {
      mode: "full",
      debugSource:
        String(options?.debugSource || "").trim()
        || `submit:post-save-enrichment:${domainKey}`,
    });
    const enrichedPayload = buildIncidentLocationCacheEntryPayload({
      nearestAddress:
        String(enrichedGeo?.nearestAddress || "").trim()
        || basePayload.nearestAddress
        || basePayload.locationLabel,
      nearestCrossStreet:
        String(enrichedGeo?.nearestCrossStreet || "").trim()
        || basePayload.nearestCrossStreet,
      nearestIntersection:
        String(enrichedGeo?.nearestIntersection || "").trim()
        || basePayload.nearestIntersection,
      nearestLandmark:
        String(enrichedGeo?.nearestLandmark || "").trim()
        || basePayload.nearestLandmark,
      locationLabel:
        String(enrichedGeo?.nearestAddress || "").trim()
        || basePayload.locationLabel
        || basePayload.nearestAddress,
    });
    if (!enrichedPayload) return null;
    if (
      !(
        enrichedPayload.nearestAddress
        || enrichedPayload.nearestCrossStreet
        || enrichedPayload.nearestIntersection
        || enrichedPayload.nearestLandmark
      )
    ) {
      return null;
    }

    await persistIncidentLocationCacheEntryRuntimeShared(
      domainKey,
      incidentId,
      enrichedPayload,
      extra,
      deps
    );
    return enrichedPayload;
  } catch {
    return null;
  }
}
