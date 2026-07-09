import { makeCoordsHashedDisplayIdFromIncidentId } from "./mapIncidentDisplayIdHashSupport.js";
import { resolveIncidentMarkerLookupIdShared } from "./mapIncidentDomainHelperSupport.js";
import { summarizeIncidentRowsAfterFixWindowShared } from "./mapIncidentPopupRowSupport.js";

export function createDeferredIncidentDomainMarkerHelpers(deps = {}) {
  const {
    firstConfiguredFieldValue = null,
    getIncidentDomainHelper = null,
    groupIntoLights = null,
    incidentDomainBuildCoordsDisplayId = null,
    incidentDomainCanonicalIncidentId = null,
    isUuidLike = null,
    isValidLatLng = null,
    lightIdFor = null,
    lookupIncidentIdForDomain = null,
    normalizeDomainKeyOrSlug = null,
    normalizeIncidentDrivenLookupId = null,
    resolveIncidentDomainHelperEntry = null,
  } = deps;

  function normalizeConfiguredSeedFieldValue(rawValue, modeRaw = "", defaultValue = "") {
    const mode = String(modeRaw || "").trim();
    const fallbackValue = defaultValue ?? "";
    if (mode === "trim_or_null") {
      const value = String(rawValue || "").trim();
      return value || null;
    }
    if (mode === "lowercase_or_default") {
      const value = String(rawValue || "").trim().toLowerCase();
      return value || fallbackValue;
    }
    if (mode === "number_or_default") {
      const value = Number(rawValue);
      return Number.isFinite(value) ? value : fallbackValue;
    }
    return rawValue ?? fallbackValue;
  }

  function collectIncidentIdsFromRows(rows, fallbackIncidentId = "") {
    const out = [];
    const seen = new Set();
    const push = (raw) => {
      const id = String(raw || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push(id);
    };
    for (const row of rows || []) push(row?.light_id);
    push(fallbackIncidentId);
    return out;
  }

  function canonicalIncidentIdFromClusterRows(rows, fallbackIncidentId = "") {
    const list = collectIncidentIdsFromRows(rows, fallbackIncidentId);
    if (!list.length) return String(fallbackIncidentId || "").trim();
    const counts = new Map();
    for (const incidentId of list) {
      counts.set(incidentId, (counts.get(incidentId) || 0) + 1);
    }
    let winner = String(fallbackIncidentId || list[0] || "").trim();
    let bestCount = -1;
    for (const [incidentId, count] of counts.entries()) {
      if (count > bestCount) {
        winner = incidentId;
        bestCount = count;
      }
    }
    return winner;
  }

  function incidentDomainBuildRuntimeAliasContext(domainKeyRaw, context = {}) {
    if (!(typeof normalizeDomainKeyOrSlug === "function" && normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }))) {
      return { ...(context || {}) };
    }
    const seededRows = Array.isArray(context?.seededRows) ? context.seededRows : [];
    const reportRows = Array.isArray(context?.reportRows) ? context.reportRows : [];
    const lastFixByIncidentMap = context?.lastFixByIncidentMap ?? {};
    const seededRecordsById = context?.seededRecordsById ?? null;
    return {
      ...(context || {}),
      seededRows,
      reportRows,
      lastFixByIncidentMap,
      seededRecordsById,
    };
  }

  function incidentDrivenSeededMarkerConfig(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    const helper = resolved.helper || {};
    const nextContext = incidentDomainBuildRuntimeAliasContext(resolved.domainKey, context);
    const seedIdMode = String(helper?.seededMarkerSeedIdMode || "").trim();
    const markerIdMode = String(helper?.seededMarkerIdMode || "").trim();
    const incidentIdMode = String(helper?.seededMarkerIncidentIdMode || "").trim();
    const lastFixMode = String(helper?.seededMarkerLastFixMode || "").trim();
    const seedFieldsBuilder = typeof helper?.seededMarkerSeedFieldsBuilder === "function"
      ? helper.seededMarkerSeedFieldsBuilder
      : null;
    const rowSeedIdFields = Array.isArray(helper?.seededMarkerRowSeedIdFields)
      ? helper.seededMarkerRowSeedIdFields.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
      : [];
    const rowSeedIdRequireUuid = Boolean(helper?.seededMarkerRowSeedIdRequireUuid);
    const rowSeedIdBuilder = typeof helper?.seededMarkerRowSeedIdBuilder === "function"
      ? helper.seededMarkerRowSeedIdBuilder
      : null;
    const seedIdTargetFields = Array.isArray(helper?.seededMarkerSeedIdTargetFields)
      ? helper.seededMarkerSeedIdTargetFields.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
      : [];
    const externalDisplaySourceFields = Array.isArray(helper?.seededMarkerExternalDisplaySourceFields)
      ? helper.seededMarkerExternalDisplaySourceFields.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
      : [];
    const externalDisplayTargetFields = Array.isArray(helper?.seededMarkerExternalDisplayTargetFields)
      ? helper.seededMarkerExternalDisplayTargetFields.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
      : [];
    const copiedFieldNames = Array.isArray(helper?.seededMarkerCopiedFieldNames)
      ? helper.seededMarkerCopiedFieldNames.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
      : [];
    const normalizedCopyFields = Array.isArray(helper?.seededMarkerNormalizedCopyFields)
      ? helper.seededMarkerNormalizedCopyFields
          .map((entry) => ({
            sourceField: String(entry?.sourceField || "").trim(),
            targetField: String(entry?.targetField || entry?.sourceField || "").trim(),
            mode: String(entry?.mode || "").trim(),
            defaultValue: entry?.defaultValue,
          }))
          .filter((entry) => entry.sourceField && entry.targetField)
      : [];
    const staticFields = helper?.seededMarkerStaticFields && typeof helper.seededMarkerStaticFields === "object"
      ? helper.seededMarkerStaticFields
      : null;
    if (!(seedIdMode || markerIdMode || incidentIdMode || lastFixMode || seedFieldsBuilder || rowSeedIdFields.length || rowSeedIdBuilder || seedIdTargetFields.length || externalDisplaySourceFields.length || externalDisplayTargetFields.length || copiedFieldNames.length || normalizedCopyFields.length || staticFields)) {
      return null;
    }

    return {
      resolveSeedId: (record) => {
        if (seedIdMode === "incident_or_id") {
          return String(record?.incident_id || record?.id || "").trim();
        }
        if (seedIdMode === "id") {
          return String(record?.id || "").trim();
        }
        return "";
      },
      resolveMarkerId: (record, seedId, lat, lng) => {
        if (markerIdMode === "external_display_or_coords") {
          return typeof firstConfiguredFieldValue === "function"
            ? firstConfiguredFieldValue(record, ["display_id", "external_id", "ph_id"])
              || incidentDomainBuildCoordsDisplayId?.(resolved.domainKey, { lat, lng })
            : (incidentDomainBuildCoordsDisplayId?.(resolved.domainKey, { lat, lng }) || "");
        }
        if (markerIdMode === "seed_id") {
          return seedId;
        }
        return seedId;
      },
      resolveIncidentId: (record, seedId) => {
        if (incidentIdMode === "canonical_from_seed_id") {
          return incidentDomainCanonicalIncidentId?.(resolved.domainKey, { incident_id: seedId }) || "";
        }
        if (incidentIdMode === "seed_id") {
          return seedId;
        }
        return String(record?.incident_id || seedId || "").trim();
      },
      resolveLastFixTs: (_record, seedId) => {
        if (lastFixMode === "incident_map") {
          const lastFixMap = nextContext?.lastFixByIncidentMap || {};
          return Number(lastFixMap?.[seedId] || 0);
        }
        if (lastFixMode === "max_light_or_fixed") {
          const lastFixByLightId = nextContext?.lastFixByLightId || {};
          const fixedLights = nextContext?.fixedLights || {};
          return Math.max(Number(lastFixByLightId?.[seedId] || 0), Number(fixedLights?.[seedId] || 0));
        }
        return 0;
      },
      resolveSeedFields: (record, seedId) => {
        if (!seedFieldsBuilder) {
          const seedFields = staticFields ? { ...staticFields } : {};
          for (const fieldName of seedIdTargetFields) {
            seedFields[fieldName] = seedId;
          }
          const externalDisplayValue = externalDisplaySourceFields
            .map((fieldName) => String(record?.[fieldName] || "").trim())
            .find(Boolean) || null;
          for (const fieldName of externalDisplayTargetFields) {
            seedFields[fieldName] = externalDisplayValue;
          }
          for (const fieldName of copiedFieldNames) {
            seedFields[fieldName] = String(record?.[fieldName] || "").trim();
          }
          for (const entry of normalizedCopyFields) {
            const rawValue = record?.[entry.sourceField];
            seedFields[entry.targetField] = normalizeConfiguredSeedFieldValue(rawValue, entry.mode, entry.defaultValue);
          }
          if (Object.keys(seedFields).length) {
            return seedFields;
          }
        }
        return seedFieldsBuilder ? (seedFieldsBuilder(record, seedId, nextContext) || {}) : {};
      },
      resolveRowSeedId: (row) => {
        if (!rowSeedIdBuilder && rowSeedIdFields.length) {
          const rawSeedId = rowSeedIdFields
            .map((fieldName) => String(row?.[fieldName] || "").trim())
            .find(Boolean) || "";
          const normalizedSeedId = lookupIncidentIdForDomain?.(resolved.domainKey, rawSeedId) || rawSeedId;
          return rowSeedIdRequireUuid
            ? (typeof isUuidLike === "function" && isUuidLike(normalizedSeedId) ? normalizedSeedId : "")
            : normalizedSeedId;
        }
        return rowSeedIdBuilder ? String(rowSeedIdBuilder(row, nextContext) || "").trim() : "";
      },
    };
  }

  function incidentDrivenBuildSeededMarkers(domainKeyRaw, seededRecordsRaw, {
    resolveSeedId,
    resolveMarkerId,
    resolveIncidentId,
    resolveLastFixTs,
    resolveSeedFields,
    resolveRowSeedId,
  } = {}, context = {}) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : "";
    if (!domainKey) return [];
    const isLatLngValid = typeof context?.isValidLatLng === "function" ? context.isValidLatLng : isValidLatLng;
    const hydrateLocationFields = typeof context?.hydrateIncidentLocationFields === "function"
      ? context.hydrateIncidentLocationFields
      : ((marker) => marker);
    const incidentRowsByDomain = context?.incidentDrivenRowsByDomain instanceof Map
      ? context.incidentDrivenRowsByDomain
      : new Map();
    const byId = new Map();
    for (const record of seededRecordsRaw || []) {
      const seedId = String(resolveSeedId?.(record) || "").trim();
      const lat = Number(record?.lat);
      const lng = Number(record?.lng);
      if (!seedId || !(typeof isLatLngValid === "function" ? isLatLngValid(lat, lng) : (Number.isFinite(lat) && Number.isFinite(lng)))) continue;
      byId.set(seedId, {
        id: String(resolveMarkerId?.(record, seedId, lat, lng) || seedId).trim() || seedId,
        incident_id: String(resolveIncidentId?.(record, seedId) || seedId).trim() || seedId,
        domain: domainKey,
        lat,
        lng,
        count: 0,
        lastTs: 0,
        lastFixTs: Number(resolveLastFixTs?.(record, seedId) || 0),
        rows: [],
        ...(resolveSeedFields?.(record, seedId, lat, lng) || {}),
      });
    }
    for (const row of incidentRowsByDomain.get(domainKey) || []) {
      const seedId = String(resolveRowSeedId?.(row) || "").trim();
      if (!seedId) continue;
      const marker = byId.get(seedId);
      if (!marker) continue;
      const ts = Number(row?.ts || 0);
      const lastFixTs = Number(marker.lastFixTs || 0);
      if (lastFixTs && ts <= lastFixTs) continue;
      marker.count += 1;
      marker.rows.push(row);
      if (ts > marker.lastTs) marker.lastTs = ts;
    }
    return Array.from(byId.values())
      .map((marker) => hydrateLocationFields(marker, domainKey))
      .sort((a, b) => (Number(b.count || 0) - Number(a.count || 0)) || (Number(b.lastTs || 0) - Number(a.lastTs || 0)));
  }

  function incidentDrivenSpecializedMarkerCollection(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (resolved.helper?.buildMarkerCollectionRowIncidentField) {
      const nextContext = incidentDomainBuildRuntimeAliasContext(resolved.domainKey, context);
      const hydrateMarker = typeof nextContext?.hydrateIncidentLocationFields === "function"
        ? nextContext.hydrateIncidentLocationFields
        : ((marker) => marker);
      const sourceRows = (nextContext?.incidentDrivenRowsByDomain instanceof Map
        ? (nextContext.incidentDrivenRowsByDomain.get(resolved.domainKey) || [])
        : []
      )
        .filter((row) => {
          const lat = Number(row?.lat);
          const lng = Number(row?.lng);
          return typeof isValidLatLng === "function"
            ? isValidLatLng(lat, lng)
            : (Number.isFinite(lat) && Number.isFinite(lng));
        })
        .map((row) => {
          const lat = Number(row?.lat);
          const lng = Number(row?.lng);
          const rowIncidentField = String(resolved.helper?.buildMarkerCollectionRowIncidentField || "").trim() || "light_id";
          const rowFallbackIdMode = String(resolved.helper?.buildMarkerCollectionRowFallbackIdMode || "").trim();
          const fallbackLightId = typeof resolved.helper?.buildMarkerCollectionRowFallbackId === "function"
            ? String(resolved.helper.buildMarkerCollectionRowFallbackId({ row, lat, lng, context: nextContext }) || "").trim()
            : rowFallbackIdMode === "coords_light_id"
              ? (typeof lightIdFor === "function" ? lightIdFor(lat, lng) : "")
              : "";
          return {
            ...row,
            lat,
            lng,
            [rowIncidentField]: String(row?.[rowIncidentField] || "").trim() || fallbackLightId,
          };
        });
      const clustered = typeof groupIntoLights === "function" ? groupIntoLights(sourceRows) : [];
      const canonicalIncidentIdMode = String(resolved.helper?.buildMarkerCollectionCanonicalIncidentIdMode || "").trim();
      const canonicalIncidentIdBuilder = typeof resolved.helper?.buildMarkerCollectionCanonicalIncidentId === "function"
        ? resolved.helper.buildMarkerCollectionCanonicalIncidentId
        : canonicalIncidentIdMode === "cluster_majority_lookup_id"
          ? ((rows, fallbackIncidentId) => canonicalIncidentIdFromClusterRows(rows, fallbackIncidentId))
          : ((rows, fallbackIncidentId) => String(fallbackIncidentId || "").trim());
      const displayIdMode = String(resolved.helper?.buildMarkerCollectionDisplayIdMode || "").trim();
      const displayIdBuilder = typeof resolved.helper?.buildMarkerCollectionDisplayId === "function"
        ? resolved.helper.buildMarkerCollectionDisplayId
        : displayIdMode === "coords_hashed_from_incident"
          ? ((incidentId) => makeCoordsHashedDisplayIdFromIncidentId(
              String(resolved.helper?.reportNumberPrefix || "").trim(),
              incidentId
            ))
          : ((incidentId) => String(incidentId || "").trim());
      const lastFixTsMode = String(resolved.helper?.buildMarkerCollectionLastFixTsMode || "").trim();
      const lastFixTsBuilder = typeof resolved.helper?.buildMarkerCollectionLastFixTs === "function"
        ? resolved.helper.buildMarkerCollectionLastFixTs
        : lastFixTsMode === "light_id_map"
          ? ({ incidentId, lastFixByLightId = {} }) => Number(lastFixByLightId?.[String(incidentId || "").trim()] || 0)
          : (() => 0);
      return clustered
        .map((cluster) => {
          const fallbackIncidentId = String(
            cluster?.lightId || (typeof lightIdFor === "function" ? lightIdFor(Number(cluster?.lat || 0), Number(cluster?.lng || 0)) : "")
          ).trim();
          const rawRows = Array.isArray(cluster?.reports) ? cluster.reports : [];
          const incidentIds = collectIncidentIdsFromRows(rawRows, fallbackIncidentId);
          const canonicalIncidentId = String(
            canonicalIncidentIdBuilder(rawRows, fallbackIncidentId, nextContext) || fallbackIncidentId
          ).trim();
          const { rows, maxLastFixTs } = summarizeIncidentRowsAfterFixWindowShared(rawRows, {
            incidentIds,
            getFixTsForIncidentId: (incidentId) => (
              Number(lastFixTsBuilder({
                incidentId,
                cluster,
                rows: rawRows,
                lastFixByLightId: nextContext?.lastFixByLightId || {},
                context: nextContext,
              }) || 0)
            ),
            resolveRowIncidentId: (row, fallbackId) => String(row?.light_id || fallbackId).trim(),
            fallbackIncidentId: canonicalIncidentId || fallbackIncidentId,
          });
          const resolvedIncidentId = String(canonicalIncidentId || fallbackIncidentId).trim();
          const displayId = String(displayIdBuilder(resolvedIncidentId, cluster, nextContext) || resolvedIncidentId).trim();
          return hydrateMarker({
            id: resolvedIncidentId,
            incident_id: resolvedIncidentId,
            domain: resolved.domainKey,
            incident_ids: incidentIds,
            display_id: displayId,
            lat: Number(cluster?.lat),
            lng: Number(cluster?.lng),
            count: rows.length,
            lastTs: Number(rows?.[0]?.ts || 0),
            rows,
            lastFixTs: maxLastFixTs,
          }, resolved.domainKey);
        })
        .filter((marker) => {
          const lat = Number(marker?.lat);
          const lng = Number(marker?.lng);
          const valid = typeof isValidLatLng === "function"
            ? isValidLatLng(lat, lng)
            : (Number.isFinite(lat) && Number.isFinite(lng));
          return valid && Number(marker?.count || 0) > 0;
        })
        .sort((a, b) => (Number(b.count || 0) - Number(a.count || 0)) || (Number(b.lastTs || 0) - Number(a.lastTs || 0)));
    }
    const seededConfig = incidentDrivenSeededMarkerConfig(resolved.domainKey, context);
    if (!seededConfig) return null;
    const seededRecordsContextKey = String(resolved.helper?.seededRecordsContextKey || "").trim();
    const seededRecordsRaw = Array.isArray(context?.seededRecordsRaw)
      ? context.seededRecordsRaw
      : seededRecordsContextKey
        ? context?.[seededRecordsContextKey]
        : context?.seededRecordsRaw;
    return incidentDrivenBuildSeededMarkers(resolved.domainKey, seededRecordsRaw, seededConfig, context);
  }

  function mergeIncidentDrivenMarkerCollections(domainKeyRaw, specializedMarkers = null, genericMarkers = []) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : "";
    const genericList = Array.isArray(genericMarkers) ? genericMarkers : [];
    if (!Array.isArray(specializedMarkers)) return genericList;
    if (!genericList.length) return specializedMarkers;
    if (!domainKey) return [...specializedMarkers, ...genericList];

    const seenLookupIds = new Set(
      specializedMarkers
        .map((marker) => normalizeIncidentDrivenLookupId?.(
          domainKey,
          resolveIncidentMarkerLookupIdShared(domainKey, marker, marker?.incident_id || marker?.id || marker?.display_id || "", {
            getIncidentDomainHelper,
            normalizeDomainKeyOrSlug,
          })
        ))
        .filter(Boolean)
    );

    const unmatchedGenericMarkers = genericList.filter((marker) => {
      const lookupId = normalizeIncidentDrivenLookupId?.(
        domainKey,
        resolveIncidentMarkerLookupIdShared(domainKey, marker, marker?.incident_id || marker?.id || marker?.display_id || "", {
          getIncidentDomainHelper,
          normalizeDomainKeyOrSlug,
        })
      );
      return !lookupId || !seenLookupIds.has(lookupId);
    });

    return unmatchedGenericMarkers.length
      ? [...specializedMarkers, ...unmatchedGenericMarkers]
      : specializedMarkers;
  }

  return {
    incidentDrivenSpecializedMarkerCollection,
    mergeIncidentDrivenMarkerCollections,
  };
}

export function createDeferredIncidentDomainSubmitHelpers(deps = {}) {
  const {
    firstConfiguredFieldValue = null,
    getIncidentDomainHelper = null,
    incidentDomainBuildCoordsDisplayId = null,
    incidentDomainResolveLookupValueByMode = null,
    isUuidLike = null,
    lookupIncidentIdForDomain = null,
    nearestDomainMarkerForPoint = null,
    normalizeDomainKeyOrSlug = null,
    readIncidentDomainHelperBoolean = null,
    readIncidentDomainHelperString = null,
    resolveIncidentDomainHelperEntry = null,
  } = deps;

  function incidentDomainApplyPersistedLocationCacheState(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (typeof resolved.helper?.applyPersistedLocationCacheState === "function") {
      return resolved.helper.applyPersistedLocationCacheState(context, resolved) || null;
    }
    const mode = String(resolved.helper?.applyPersistedLocationCacheStateMode || "").trim();
    if (mode === "patch_seeded_and_report_rows") {
      const lookupIncidentId = typeof lookupIncidentIdForDomain === "function"
        ? lookupIncidentIdForDomain(resolved.domainKey, context?.incidentId)
        : "";
      if (!lookupIncidentId) return null;
      const locationLabelField = String(resolved.helper?.applyPersistedLocationCacheStateLocationLabelField || "").trim();
      const addressField = String(resolved.helper?.applyPersistedLocationCacheStateAddressField || "").trim();
      const crossStreetField = String(resolved.helper?.applyPersistedLocationCacheStateCrossStreetField || "").trim();
      const intersectionField = String(resolved.helper?.applyPersistedLocationCacheStateIntersectionField || "").trim();
      const landmarkField = String(resolved.helper?.applyPersistedLocationCacheStateLandmarkField || "").trim();
      const applyPatch = (row) => ({
        ...row,
        ...(locationLabelField ? {
          [locationLabelField]: context?.sanitizedEntry?.locationLabel
            || context?.sanitizedEntry?.nearestAddress
            || row?.[locationLabelField]
            || "",
        } : {}),
        ...(addressField ? { [addressField]: context?.sanitizedEntry?.nearestAddress || row?.[addressField] || "" } : {}),
        ...(crossStreetField ? { [crossStreetField]: context?.sanitizedEntry?.nearestCrossStreet || row?.[crossStreetField] || "" } : {}),
        ...(intersectionField ? { [intersectionField]: context?.sanitizedEntry?.nearestIntersection || row?.[intersectionField] || "" } : {}),
        ...(landmarkField ? { [landmarkField]: context?.sanitizedEntry?.nearestLandmark || row?.[landmarkField] || "" } : {}),
      });
      if (typeof context?.setSeededRows === "function") {
        const seededLookupField = String(resolved.helper?.applyPersistedLocationCacheStateSeededLookupField || "id").trim();
        context.setSeededRows((prev) => (prev || []).map((row) => {
          if (String(row?.[seededLookupField] || "").trim() !== lookupIncidentId) return row;
          return applyPatch(row);
        }));
      }
      if (typeof context?.setReportRows === "function") {
        const reportLookupMode = String(resolved.helper?.applyPersistedLocationCacheStateReportLookupFieldMode || "").trim();
        context.setReportRows((prev) => (prev || []).map((row) => {
          const rowLookupId = typeof incidentDomainResolveLookupValueByMode === "function"
            ? incidentDomainResolveLookupValueByMode(reportLookupMode, row, resolved.domainKey)
            : "";
          if (String(rowLookupId || "").trim() !== lookupIncidentId) return row;
          return applyPatch(row);
        }));
      }
      return null;
    }
    if (mode === "patch_record_state_map") {
      const setRecordStateByDomain = context?.setPersistedIncidentRecordStateByDomain;
      const setRecordState = typeof setRecordStateByDomain === "function" ? setRecordStateByDomain : null;
      if (typeof setRecordState !== "function") return null;
      const resolvedIncidentId = String(context?.incidentId || "").trim();
      if (!resolvedIncidentId) return null;
      const fallbackTs = new Date().toISOString();
      const recordIdField = String(resolved.helper?.applyPersistedLocationCacheStateRecordIdField || "").trim();
      const issueTypeField = String(resolved.helper?.applyPersistedLocationCacheStateIssueTypeField || "").trim();
      const addressField = String(resolved.helper?.applyPersistedLocationCacheStateAddressField || "").trim();
      const crossStreetField = String(resolved.helper?.applyPersistedLocationCacheStateCrossStreetField || "").trim();
      const landmarkField = String(resolved.helper?.applyPersistedLocationCacheStateLandmarkField || "").trim();
      setRecordState((prev) => {
        const prevByDomain = prev && typeof prev === "object" ? prev : {};
        const prevDomainState = prevByDomain?.[resolved.domainKey] && typeof prevByDomain[resolved.domainKey] === "object"
          ? prevByDomain[resolved.domainKey]
          : {};
        return {
          ...prevByDomain,
          [resolved.domainKey]: {
            ...prevDomainState,
            [resolvedIncidentId]: {
              ...(prevDomainState?.[resolvedIncidentId] || {}),
              ...(recordIdField ? {
                [recordIdField]: String(
                  context?.cacheRow?.[recordIdField]
                  || prevDomainState?.[resolvedIncidentId]?.[recordIdField]
                  || ""
                ).trim(),
              } : {}),
              ...(issueTypeField ? {
                [issueTypeField]: String(
                  context?.extra?.issueType
                  || context?.cacheRow?.[issueTypeField]
                  || prevDomainState?.[resolvedIncidentId]?.[issueTypeField]
                  || ""
                ).trim().toLowerCase(),
              } : {}),
              lat: Number.isFinite(Number(context?.extra?.lat)) ? Number(context.extra.lat) : Number(prevDomainState?.[resolvedIncidentId]?.lat),
              lng: Number.isFinite(Number(context?.extra?.lng)) ? Number(context.extra.lng) : Number(prevDomainState?.[resolvedIncidentId]?.lng),
              ...(addressField ? { [addressField]: context?.sanitizedEntry?.nearestAddress || "" } : {}),
              ...(crossStreetField ? { [crossStreetField]: context?.sanitizedEntry?.nearestCrossStreet || "" } : {}),
              ...(landmarkField ? { [landmarkField]: context?.sanitizedEntry?.nearestLandmark || "" } : {}),
              geo_updated_at: context?.cacheRow?.geo_updated_at || fallbackTs,
              updated_at: context?.cacheRow?.updated_at || fallbackTs,
            },
          },
        };
      });
      return null;
    }
    return null;
  }

  function incidentDomainSubmitGeoModeWhenNotRoad(domainKeyRaw, fallback = "quick") {
    return typeof readIncidentDomainHelperString === "function"
      ? (readIncidentDomainHelperString(domainKeyRaw, "submitGeoModeWhenNotRoad", fallback || "quick") || "quick")
      : (fallback || "quick");
  }

  function incidentDomainSubmitDebugSource(domainKeyRaw, fallback = "") {
    return typeof readIncidentDomainHelperString === "function"
      ? readIncidentDomainHelperString(domainKeyRaw, "submitDebugSource", fallback)
      : String(fallback || "");
  }

  function incidentDomainResolveSubmitReportKeyHint(domainKeyRaw, context = {}) {
    const helper = typeof getIncidentDomainHelper === "function" ? getIncidentDomainHelper(domainKeyRaw) : null;
    const configuredFields = Array.isArray(helper?.submitReportKeyHintFields)
      ? helper.submitReportKeyHintFields
      : [];
    return typeof firstConfiguredFieldValue === "function"
      ? firstConfiguredFieldValue(
          context?.target,
          configuredFields.length ? configuredFields : ["incident_id", "lightId"]
        )
      : "";
  }

  function incidentDomainNormalizePersistenceIncidentId(domainKeyRaw, incidentIdRaw) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    const incidentId = String(incidentIdRaw || "").trim();
    if (!resolved || !incidentId) return incidentId;
    if (typeof resolved.helper?.normalizePersistenceIncidentId === "function") {
      return String(
        resolved.helper.normalizePersistenceIncidentId({
          incidentId,
          lookupIncidentId: typeof lookupIncidentIdForDomain === "function"
            ? lookupIncidentIdForDomain(resolved.domainKey, incidentId)
            : "",
        }, resolved) || ""
      ).trim();
    }
    const persistenceIncidentIdMode = String(resolved.helper?.persistenceIncidentIdMode || "").trim();
    if (persistenceIncidentIdMode === "normalized_persistence_id") {
      const lookupId = typeof lookupIncidentIdForDomain === "function"
        ? lookupIncidentIdForDomain(resolved.domainKey, incidentId)
        : "";
      if (Boolean(resolved.helper?.persistenceIncidentIdRequireUuid)) {
        const candidate = String(lookupId || incidentId || "").trim();
        return typeof isUuidLike === "function" && isUuidLike(candidate) ? candidate : "";
      }
      return lookupId || incidentId;
    }
    return typeof lookupIncidentIdForDomain === "function"
      ? (lookupIncidentIdForDomain(resolved.domainKey, incidentId) || incidentId)
      : incidentId;
  }

  function incidentDomainNormalizePayloadIncidentId(domainKeyRaw, incidentIdRaw, normalizeModeRaw = "") {
    const normalizeMode = String(normalizeModeRaw || "").trim();
    if (normalizeMode === "persistence_incident_id") {
      return incidentDomainNormalizePersistenceIncidentId(domainKeyRaw, incidentIdRaw) || null;
    }
    return String(incidentIdRaw || "").trim() || null;
  }

  function incidentDomainSeededInsertLookupFailureMessage(domainKeyRaw) {
    return typeof readIncidentDomainHelperString === "function"
      ? readIncidentDomainHelperString(domainKeyRaw, "seededInsertLookupFailureMessage")
      : "";
  }

  function incidentDomainBuildReportLookupFallbackData(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (typeof resolved.helper?.buildReportLookupFallbackData === "function") {
      return resolved.helper.buildReportLookupFallbackData(context, resolved) || null;
    }
    if (String(resolved.helper?.reportLookupFallbackDataMode || "").trim() === "local_payload_with_timestamp") {
      return {
        id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        created_at: new Date().toISOString(),
        ...(context?.payload || {}),
        report_number: null,
      };
    }
    return null;
  }

  function incidentDomainConfiguredLookupIdentityFields(domainKeyRaw, kindRaw = "reports") {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return [];
    const kind = String(kindRaw || "reports").trim().toLowerCase();
    const fields = kind === "reports"
      ? resolved.helper?.reportsLookupIdentityFields
      : resolved.helper?.seededLookupIdentityFields;
    return Array.isArray(fields) ? fields.map((field) => String(field || "").trim()).filter(Boolean) : [];
  }

  function incidentDomainUsesCustomSubmitFlow(domainKeyRaw) {
    return typeof readIncidentDomainHelperBoolean === "function"
      ? readIncidentDomainHelperBoolean(domainKeyRaw, "usesCustomSubmitFlow")
      : false;
  }

  function incidentDomainBuildRuntimeAliasContext(domainKeyRaw, context = {}) {
    if (!(typeof normalizeDomainKeyOrSlug === "function" && normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }))) {
      return { ...(context || {}) };
    }
    const seededRows = Array.isArray(context?.seededRows) ? context.seededRows : [];
    const reportRows = Array.isArray(context?.reportRows) ? context.reportRows : [];
    const lastFixByIncidentMap = context?.lastFixByIncidentMap ?? {};
    const seededRecordsById = context?.seededRecordsById ?? null;
    return {
      ...(context || {}),
      seededRows,
      reportRows,
      lastFixByIncidentMap,
      seededRecordsById,
    };
  }

  function incidentDomainBuildCustomSubmitFlowConfig(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (!resolved.helper?.usesCustomSubmitFlow) return null;

    const nextContext = incidentDomainBuildRuntimeAliasContext(resolved.domainKey, context);
    const serviceSubmitFirst = Boolean(resolved.helper?.customSubmitFlowServiceSubmitFirst);
    const reportPayloadIncidentIdField = String(
      resolved.helper?.customSubmitFlowReportPayloadIncidentIdField
      || resolved.helper?.submitReportPayloadIncidentIdField
      || ""
    ).trim();
    const reportPayloadIncidentIdMode = String(
      resolved.helper?.customSubmitFlowReportPayloadIncidentIdMode
      || resolved.helper?.submitReportPayloadIncidentIdNormalizeMode
      || ""
    ).trim();
    const submitEmailDomainLabel = String(resolved.helper?.submitEmailDomainLabel || "").trim();
    const submitEmailIssueTypeFallback = String(resolved.helper?.submitEmailIssueTypeFallback || "").trim();
    const serviceSubmitResultExternalIdField = String(resolved.helper?.serviceSubmitResultExternalIdField || "").trim();
    const initialIncidentIdFields = Array.isArray(resolved.helper?.customSubmitFlowInitialIncidentIdFields)
      ? resolved.helper.customSubmitFlowInitialIncidentIdFields
      : ["incident_id"];
    const initialExternalIdFields = Array.isArray(resolved.helper?.customSubmitFlowInitialExternalIdFields)
      ? resolved.helper.customSubmitFlowInitialExternalIdFields
      : ["lightId"];

    return {
      serviceSubmitFirst,
      target: nextContext?.target || null,
      roadRequired: Boolean(nextContext?.roadRequired),
      isAuthed: Boolean(nextContext?.isAuthed),
      session: nextContext?.session || null,
      name: String(nextContext?.name || "").trim(),
      phone: String(nextContext?.phone || "").trim(),
      email: String(nextContext?.email || "").trim(),
      identityGuestInfo: nextContext?.identityGuestInfo || null,
      viewerIdentityKey: String(nextContext?.viewerIdentityKey || "").trim(),
      seededRows: Array.isArray(nextContext?.seededRows) ? nextContext.seededRows : [],
      setSeededRows: nextContext?.setSeededRows || null,
      reportRows: Array.isArray(nextContext?.reportRows) ? nextContext.reportRows : [],
      setReportRows: nextContext?.setReportRows || null,
      lastFixByIncidentMap: nextContext?.lastFixByIncidentMap || {},
      getInitialIncidentId: (row) => {
        return incidentDomainNormalizePersistenceIncidentId(
          resolved.domainKey,
          typeof firstConfiguredFieldValue === "function"
            ? firstConfiguredFieldValue(row, initialIncidentIdFields)
            : ""
        ) || "";
      },
      getInitialExternalId: (row) => (
        typeof firstConfiguredFieldValue === "function"
          ? firstConfiguredFieldValue(row, initialExternalIdFields)
          : ""
      ),
      buildFallbackExternalId: ({ submitLat, submitLng, externalId }) => {
        return String(externalId || "").trim()
          || (
            typeof incidentDomainBuildCoordsDisplayId === "function"
              ? incidentDomainBuildCoordsDisplayId(resolved.domainKey, {
                lat: submitLat,
                lng: submitLng,
              })
              : ""
          );
      },
      assignReportPayloadIncidentId: (payload, incidentId) => {
        if (!payload || !reportPayloadIncidentIdField) return;
        const normalizedIncidentId = incidentDomainNormalizePayloadIncidentId(
          resolved.domainKey,
          incidentId,
          reportPayloadIncidentIdMode
        );
        payload[reportPayloadIncidentIdField] = normalizedIncidentId;
      },
      buildEmailDispatchContext: ({ target, saved, externalId, userNotesOnly }) => {
        if (submitEmailDomainLabel || submitEmailIssueTypeFallback) {
          return {
            domainLabel: submitEmailDomainLabel || String(resolved.domainKey || "").trim() || "Incident",
            issueTypeLabel:
              String(externalId || "").trim()
              || String(target?.lightId || "").trim()
              || String(saved?.[serviceSubmitResultExternalIdField] || "").trim()
              || submitEmailIssueTypeFallback
              || "Incident",
            typeOptions: [],
            notes: String(userNotesOnly || "").trim(),
          };
        }
        return {};
      },
    };
  }

  function incidentDomainServiceSubmitFunctionName(domainKeyRaw) {
    return typeof readIncidentDomainHelperString === "function"
      ? readIncidentDomainHelperString(domainKeyRaw, "serviceSubmitFunctionName")
      : "";
  }

  function incidentDomainShouldUseServiceSubmitFallback(domainKeyRaw, error) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return false;
    if (typeof resolved.helper?.shouldUseServiceSubmitFallback === "function") {
      return Boolean(resolved.helper.shouldUseServiceSubmitFallback({ error }, resolved));
    }
    if (String(resolved.helper?.shouldUseServiceSubmitFallbackMode || "").trim() === "message_or_code_match") {
      const message = String(error?.message || error || "").toLowerCase();
      const code = String(error?.code || "").trim().toLowerCase();
      const codes = Array.isArray(resolved.helper?.shouldUseServiceSubmitFallbackCodes)
        ? resolved.helper.shouldUseServiceSubmitFallbackCodes.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
        : [];
      const substrings = Array.isArray(resolved.helper?.shouldUseServiceSubmitFallbackSubstrings)
        ? resolved.helper.shouldUseServiceSubmitFallbackSubstrings.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
        : [];
      return codes.includes(code) || substrings.some((value) => message.includes(value));
    }
    return false;
  }

  function incidentDomainNormalizeSubmitTarget(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    const fallbackTarget = context?.target || null;
    if (!resolved || !fallbackTarget) return fallbackTarget;
    const locationLabelField = String(resolved.helper?.normalizeSubmitTargetLocationLabelField || "").trim();
    if (locationLabelField && typeof nearestDomainMarkerForPoint === "function") {
      const markerCandidates = Array.isArray(context?.submitTargetMarkerCandidates)
        ? context.submitTargetMarkerCandidates
        : [];
      const near = nearestDomainMarkerForPoint(fallbackTarget?.lat, fallbackTarget?.lng, markerCandidates);
      const resolvedIncidentId = String(near?.marker?.id || near?.marker?.incident_id || "").trim();
      if (!resolvedIncidentId || resolvedIncidentId === String(fallbackTarget?.lightId || "").trim()) {
        return fallbackTarget;
      }
      return {
        ...fallbackTarget,
        lightId: resolvedIncidentId,
        locationLabel:
          String(near?.marker?.[locationLabelField] || "").trim()
          || String(fallbackTarget?.locationLabel || "").trim(),
      };
    }
    return fallbackTarget;
  }

  function incidentDomainAllowsRepeatAfterArchive(domainKeyRaw) {
    return typeof readIncidentDomainHelperBoolean === "function"
      ? readIncidentDomainHelperBoolean(domainKeyRaw, "allowsRepeatAfterArchive")
      : false;
  }

  function incidentDomainAlreadyReportedMessage(domainKeyRaw) {
    return typeof readIncidentDomainHelperString === "function"
      ? readIncidentDomainHelperString(
        domainKeyRaw,
        "alreadyReportedMessage",
        "You already reported this incident. You can report again after it is marked fixed."
      )
      : "You already reported this incident. You can report again after it is marked fixed.";
  }

  function incidentDomainUsesSubmitIdentityGuard(domainKeyRaw) {
    return typeof readIncidentDomainHelperBoolean === "function"
      ? readIncidentDomainHelperBoolean(domainKeyRaw, "submitIdentityGuard")
      : false;
  }

  function incidentDomainUsesCanonicalSubmitIncidentId(domainKeyRaw) {
    return typeof readIncidentDomainHelperBoolean === "function"
      ? readIncidentDomainHelperBoolean(domainKeyRaw, "submitUsesCanonicalIncidentId")
      : false;
  }

  function incidentDomainSubmitFallbackIncidentPrefix(domainKeyRaw) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return "";
    return String(resolved.helper?.submitFallbackIncidentPrefix || resolved.domainKey).trim().toLowerCase();
  }

  function incidentDomainPersistsSubmitIssueType(domainKeyRaw) {
    return typeof readIncidentDomainHelperBoolean === "function"
      ? readIncidentDomainHelperBoolean(domainKeyRaw, "persistIssueTypeToLocationCache")
      : false;
  }

  function incidentDomainDefaultIssueLabel(domainKeyRaw) {
    return typeof readIncidentDomainHelperString === "function"
      ? readIncidentDomainHelperString(domainKeyRaw, "defaultIssueLabel")
      : "";
  }

  return {
    incidentDomainAllowsRepeatAfterArchive,
    incidentDomainAlreadyReportedMessage,
    incidentDomainApplyPersistedLocationCacheState,
    incidentDomainBuildCustomSubmitFlowConfig,
    incidentDomainBuildReportLookupFallbackData,
    incidentDomainConfiguredLookupIdentityFields,
    incidentDomainDefaultIssueLabel,
    incidentDomainNormalizePayloadIncidentId,
    incidentDomainNormalizePersistenceIncidentId,
    incidentDomainNormalizeSubmitTarget,
    incidentDomainPersistsSubmitIssueType,
    incidentDomainResolveSubmitReportKeyHint,
    incidentDomainSeededInsertLookupFailureMessage,
    incidentDomainServiceSubmitFunctionName,
    incidentDomainShouldUseServiceSubmitFallback,
    incidentDomainSubmitDebugSource,
    incidentDomainSubmitFallbackIncidentPrefix,
    incidentDomainSubmitGeoModeWhenNotRoad,
    incidentDomainUsesCanonicalSubmitIncidentId,
    incidentDomainUsesCustomSubmitFlow,
    incidentDomainUsesSubmitIdentityGuard,
  };
}
