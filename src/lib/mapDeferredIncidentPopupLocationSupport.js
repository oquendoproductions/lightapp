import { incidentLocationCacheKey } from "./mapIncidentLocationCacheSupport.js";
import { getIncidentDomainHelperShared } from "./mapIncidentDomainConfig.js";
import {
  readIncidentDomainHelperStringShared,
  resolveIncidentMarkerLookupIdShared,
} from "./mapIncidentDomainHelperSupport.js";
import {
  hasUsableLocationDetailText,
  isIncidentPopupLocationCompleteForMode,
  isUsableAddressText,
} from "./mapPopupTextSupport.js";
import { normalizeDomainKeyOrSlug } from "./mapReportParsingSupport.js";
import { resolveSharedIncidentPopupLocationEnsureMode } from "./mapSharedIncidentSupport.js";

function readIncidentDomainHelperString(domainKeyRaw, fieldName, fallback = "") {
  return readIncidentDomainHelperStringShared(domainKeyRaw, fieldName, fallback, {
    getIncidentDomainHelper: getIncidentDomainHelperShared,
    normalizeDomainKeyOrSlug,
  });
}

export async function ensureIncidentDomainLocationInfoForPopupShared(marker, options = {}, deps = {}) {
  const {
    adminReportDomain = "",
    incidentLocationCacheByKey = {},
    passivePopupLocationLookupAttemptedRef = null,
    persistIncidentLocationCacheEntry,
    reverseGeocodeRoadLabel,
    setSelectedDomainMarker,
  } = deps;
  const domainKey = normalizeDomainKeyOrSlug(
    options?.domainKey || marker?.domain || adminReportDomain,
    { allowUnknown: true }
  );
  if (!domainKey || domainKey === "streetlights") return null;

  const resolveMarkerId = typeof options?.resolveMarkerId === "function"
    ? options.resolveMarkerId
    : (item) => String(item?.incident_id || item?.id || "").trim();
  const markerId = String(resolveMarkerId(marker) || "").trim();
  const lat = Number(marker?.lat);
  const lng = Number(marker?.lng);
  if (!markerId || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Boolean(marker?._geoLocationPending)) return null;

  const cachedLocation = incidentLocationCacheByKey?.[incidentLocationCacheKey(domainKey, markerId)] || null;
  const existingAddress =
    String(cachedLocation?.nearestAddress || "").trim()
    || String(cachedLocation?.locationLabel || "").trim()
    || String(marker?._geoNearestAddress || "").trim()
    || String(marker?.nearest_address || "").trim()
    || "";
  const existingCrossStreet =
    String(cachedLocation?.nearestCrossStreet || "").trim()
    || String(marker?._geoNearestCrossStreet || "").trim()
    || String(marker?.nearest_cross_street || "").trim()
    || "";
  const existingIntersection =
    String(cachedLocation?.nearestIntersection || "").trim()
    || String(marker?._geoNearestIntersection || "").trim()
    || String(marker?.nearest_intersection || "").trim()
    || "";
  const existingLandmark =
    String(cachedLocation?.nearestLandmark || "").trim()
    || String(marker?._geoNearestLandmark || "").trim()
    || String(marker?.nearest_landmark || "").trim()
    || "";
  const buildResolvedLocation = (overrides = {}) => {
    const nearestAddress = String(overrides?.nearestAddress || existingAddress || "").trim();
    const nearestCrossStreet = String(overrides?.nearestCrossStreet || existingCrossStreet || "").trim();
    const nearestIntersection = String(overrides?.nearestIntersection || existingIntersection || "").trim();
    const nearestLandmark = String(overrides?.nearestLandmark || existingLandmark || "").trim();
    return {
      nearestAddress,
      nearestCrossStreet,
      nearestIntersection,
      nearestLandmark,
      locationLabel: String(
        overrides?.locationLabel
        || nearestAddress
        || marker?.location_label
        || ""
      ).trim(),
    };
  };
  const popupLocationCompletenessMode = String(
    options?.popupLocationCompletenessMode
    || readIncidentDomainHelperString(domainKey, "popupLocationCompletenessMode")
    || ""
  ).trim();
  const isLocationComplete = typeof options?.isLocationComplete === "function"
    ? options.isLocationComplete
    : ({ address, crossStreet, intersection, landmark }) => {
        if (popupLocationCompletenessMode) {
          return isIncidentPopupLocationCompleteForMode(popupLocationCompletenessMode, {
            address,
            crossStreet,
            intersection,
            landmark,
          });
        }
        return isUsableAddressText(address) && (
          hasUsableLocationDetailText(crossStreet)
          || hasUsableLocationDetailText(intersection)
          || hasUsableLocationDetailText(landmark)
        );
      };

  if (isLocationComplete({
    address: existingAddress,
    crossStreet: existingCrossStreet,
    intersection: existingIntersection,
    landmark: existingLandmark,
  })) {
    return buildResolvedLocation();
  }

  const passiveLookupKey = `${domainKey}:${markerId}`;
  if (passivePopupLocationLookupAttemptedRef?.current?.has?.(passiveLookupKey)) {
    return buildResolvedLocation();
  }
  passivePopupLocationLookupAttemptedRef?.current?.add?.(passiveLookupKey);

  const releasePassiveLookupAttempt = () => {
    passivePopupLocationLookupAttemptedRef?.current?.delete?.(passiveLookupKey);
  };
  const clearPendingState = () => {
    setSelectedDomainMarker?.((prev) => {
      const prevId = String(resolveMarkerId(prev) || "").trim();
      if (prevId !== markerId) return prev;
      return {
        ...prev,
        _geoLocationPending: false,
      };
    });
  };

  setSelectedDomainMarker?.((prev) => {
    const prevId = String(resolveMarkerId(prev) || "").trim();
    if (prevId !== markerId) return prev;
    return {
      ...prev,
      _geoLocationPending: true,
    };
  });

  try {
    const geo = await reverseGeocodeRoadLabel?.(lat, lng, {
      mode: "full",
      debugSource: String(options?.debugSource || `popup:${domainKey}`).trim(),
    });
    const nearestAddress = String(geo?.nearestAddress || "").trim();
    const nearestCrossStreet = String(geo?.nearestCrossStreet || "").trim();
    const nearestIntersection = String(geo?.nearestIntersection || "").trim();
    const nearestLandmark = String(geo?.nearestLandmark || "").trim();
    if (!(nearestAddress || nearestCrossStreet || nearestIntersection || nearestLandmark)) {
      releasePassiveLookupAttempt();
      return buildResolvedLocation();
    }

    await persistIncidentLocationCacheEntry?.(domainKey, markerId, {
      nearestAddress,
      nearestCrossStreet,
      nearestIntersection,
      nearestLandmark,
      locationLabel: nearestAddress,
    }, {
      lat,
      lng,
    });
    setSelectedDomainMarker?.((prev) => {
      const prevId = String(resolveMarkerId(prev) || "").trim();
      if (prevId !== markerId) return prev;
      return {
        ...prev,
        _geoNearestAddress: nearestAddress || prev?._geoNearestAddress || prev?.nearest_address || "",
        _geoNearestCrossStreet: nearestCrossStreet || prev?._geoNearestCrossStreet || prev?.nearest_cross_street || "",
        _geoNearestIntersection: nearestIntersection || prev?._geoNearestIntersection || prev?.nearest_intersection || "",
        _geoNearestLandmark: nearestLandmark || prev?._geoNearestLandmark || prev?.nearest_landmark || "",
      };
    });
    if (!isLocationComplete({
      address: nearestAddress,
      crossStreet: nearestCrossStreet,
      intersection: nearestIntersection,
      landmark: nearestLandmark,
    })) {
      releasePassiveLookupAttempt();
    }
    return buildResolvedLocation({
      nearestAddress,
      nearestCrossStreet,
      nearestIntersection,
      nearestLandmark,
      locationLabel: nearestAddress,
    });
  } catch {
    releasePassiveLookupAttempt();
    return buildResolvedLocation();
  } finally {
    clearPendingState();
  }
}

export async function ensureGenericIncidentLocationInfoForPopupShared(marker, deps = {}) {
  const { adminReportDomain = "" } = deps;
  const domainKey = normalizeDomainKeyOrSlug(marker?.domain || adminReportDomain, { allowUnknown: true });
  if (!domainKey || domainKey === "streetlights") return null;
  return ensureIncidentDomainLocationInfoForPopupShared(marker, {
    domainKey,
    resolveMarkerId: (item) => resolveIncidentMarkerLookupIdShared(domainKey, item, "", {
      getIncidentDomainHelper: getIncidentDomainHelperShared,
      normalizeDomainKeyOrSlug,
    }),
    popupLocationCompletenessMode: readIncidentDomainHelperString(domainKey, "popupLocationCompletenessMode"),
    debugSource: `popup:generic-incident:${domainKey}`,
  }, deps);
}

export function resolveIncidentPopupLocationEnsureModeForMarkerShared(domainKeyRaw, context = {}) {
  const normalizedContext = context && typeof context === "object" && !Array.isArray(context)
    ? context
    : {};
  const normalizedDomainKey = String(
    normalizeDomainKeyOrSlug(
      domainKeyRaw || normalizedContext?.domainKey || normalizedContext?.popupInfo?.domainKey,
      { allowUnknown: true }
    )
    || ""
  ).trim();
  const popupInfo = normalizedContext?.popupInfo || null;
  const marker = normalizedContext?.marker || null;
  if (!normalizedDomainKey || !popupInfo || !marker) return "";
  const helper = getIncidentDomainHelperShared(normalizedDomainKey) || {};
  const helperMode = (() => {
    if (
      typeof helper?.popupLocationShouldEnsure === "function"
      && !helper.popupLocationShouldEnsure({ popupInfo, marker, context: normalizedContext })
    ) return "";
    if (helper?.popupLocationRequireOfficialMarker && !Boolean(marker?.isOfficial)) return "";
    if (popupInfo?.locationPending || Boolean(marker?._geoLocationPending)) return "";
    const completenessMode = String(helper?.popupLocationCompletenessMode || "").trim();
    const isComplete = isIncidentPopupLocationCompleteForMode(completenessMode, {
      address: popupInfo?.nearestAddress,
      crossStreet: popupInfo?.nearestCrossStreet,
      intersection: popupInfo?.nearestIntersection,
      landmark: popupInfo?.nearestLandmark,
    });
    if (isComplete) return "";
    return "generic";
  })();
  return resolveSharedIncidentPopupLocationEnsureMode({
    helperMode,
    popupInfo,
    marker,
  });
}

export async function ensureIncidentPopupLocationInfoForDetailsShared({
  domainKey = "",
  popupInfo = null,
  marker = null,
} = {}, deps = {}) {
  const normalizedDomainKey = normalizeDomainKeyOrSlug(domainKey || popupInfo?.domainKey, { allowUnknown: true });
  if (!normalizedDomainKey || normalizedDomainKey === "streetlights" || !marker || !popupInfo) {
    return null;
  }
  const ensureMode = resolveIncidentPopupLocationEnsureModeForMarkerShared(normalizedDomainKey, {
    popupInfo,
    marker,
  });
  if (!ensureMode) {
    return {
      nearestAddress: String(popupInfo?.nearestAddress || "").trim(),
      nearestCrossStreet: String(popupInfo?.nearestCrossStreet || "").trim(),
      nearestIntersection: String(popupInfo?.nearestIntersection || "").trim(),
      nearestLandmark: String(popupInfo?.nearestLandmark || "").trim(),
      locationLabel: String(popupInfo?.locationLabel || popupInfo?.nearestAddress || "").trim(),
    };
  }
  const ensurePopupLocationInfoMode = String(
    readIncidentDomainHelperString(normalizedDomainKey, "ensurePopupLocationInfoMode", "")
    || ""
  ).trim();
  if (ensurePopupLocationInfoMode === "domain_popup_location") {
    const resolveMarkerIdMode = String(
      readIncidentDomainHelperString(normalizedDomainKey, "ensurePopupLocationInfoResolveMarkerIdMode", "")
      || ""
    ).trim();
    const resolveMarkerId = resolveMarkerIdMode === "id"
      ? (item) => String(item?.id || "").trim()
      : undefined;
    return ensureIncidentDomainLocationInfoForPopupShared(marker, {
      domainKey: normalizedDomainKey,
      resolveMarkerId,
      debugSource: String(
        readIncidentDomainHelperString(normalizedDomainKey, "ensurePopupLocationInfoDebugSource", "")
        || ""
      ).trim(),
      popupLocationCompletenessMode: String(
        readIncidentDomainHelperString(normalizedDomainKey, "popupLocationCompletenessMode", "")
        || ""
      ).trim(),
    }, deps);
  }
  return ensureGenericIncidentLocationInfoForPopupShared(marker, deps);
}
