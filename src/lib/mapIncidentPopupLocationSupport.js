import { incidentLocationCacheKey } from "./mapIncidentLocationCacheSupport.js";
import { isUsableAddressText } from "./mapPopupTextSupport.js";
import {
  readAddressFromNote,
  readCrossStreetFromNote,
  readIntersectionFromNote,
  readLandmarkFromNote,
  readLocationFromNote,
} from "./mapReportParsingSupport.js";

function resolveDomainKeyShared(domainKeyRaw, deps = {}) {
  const { normalizeDomainKeyOrSlug, normalizeDomainKey } = deps;
  if (typeof normalizeDomainKeyOrSlug === "function") {
    const normalized = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
    if (normalized) return normalized;
  }
  if (typeof normalizeDomainKey === "function") {
    return normalizeDomainKey(domainKeyRaw);
  }
  return String(domainKeyRaw || "").trim().toLowerCase();
}

export function resolveIncidentDrivenDomainMetaShared(domainKeyRaw, incidentIdRaw, deps = {}) {
  const {
    getIncidentDomainHelper,
    resolveIncidentDrivenRecord,
  } = deps;
  const domainKey = resolveDomainKeyShared(domainKeyRaw, deps);
  const incidentId = String(incidentIdRaw || "").trim();
  if (
    !domainKey
    || !incidentId
    || typeof getIncidentDomainHelper !== "function"
    || typeof resolveIncidentDrivenRecord !== "function"
  ) {
    return null;
  }

  const helper = getIncidentDomainHelper(domainKey) || {};
  const record = resolveIncidentDrivenRecord(domainKey, incidentId);
  const lat = Number(record?.lat);
  const lng = Number(record?.lng);
  const nearestAddress = String(record?.nearest_address || "").trim();
  const nearestCrossStreet = String(record?.nearest_cross_street || "").trim();
  const nearestIntersection = String(record?.nearest_intersection || "").trim();
  const nearestLandmark = String(record?.nearest_landmark || "").trim();
  const displayIdHintField = String(helper?.displayIdHintField || "").trim();

  return {
    domainKey,
    kind: domainKey,
    record: record || null,
    center: Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, isOfficial: Boolean(helper?.usesMappedCenter) }
      : null,
    displayIdHint: displayIdHintField ? String(record?.[displayIdHintField] || "").trim() : "",
    locationLabel: String(record?.location_label || nearestAddress).trim(),
    nearestAddress,
    nearestCrossStreet,
    nearestIntersection,
    nearestLandmark,
  };
}

export function resolveIncidentDrivenGroupMetaShared(domainKeyRaw, incidentIdRaw, context = {}, deps = {}) {
  const {
    formattedIncidentDisplayId,
    resolveIncidentDrivenDomainMeta,
    slIdByUuid,
  } = deps;
  const domainKey = resolveDomainKeyShared(domainKeyRaw, deps);
  const incidentId = String(incidentIdRaw || "").trim();
  const orderedRows = Array.isArray(context?.rows) ? context.rows.filter(Boolean) : [];
  const firstRow = orderedRows[0] || null;
  if (
    !domainKey
    || !incidentId
    || typeof resolveIncidentDrivenDomainMeta !== "function"
    || typeof formattedIncidentDisplayId !== "function"
  ) {
    return null;
  }

  const avg = orderedRows.reduce(
    (acc, row) => ({ lat: acc.lat + Number(row?.lat || 0), lng: acc.lng + Number(row?.lng || 0), count: acc.count + 1 }),
    { lat: 0, lng: 0, count: 0 }
  );
  const avgCenter = avg.count
    ? { lat: avg.lat / avg.count, lng: avg.lng / avg.count, isOfficial: false }
    : null;
  const noteLocation = String(readLocationFromNote(firstRow?.note) || "").trim();
  const noteAddress = String(readAddressFromNote(firstRow?.note) || "").trim();
  const domainMeta = resolveIncidentDrivenDomainMeta(domainKey, incidentId);
  const resolvedCenter =
    domainMeta?.center
    || (
      Number.isFinite(Number(context?.center?.lat)) && Number.isFinite(Number(context?.center?.lng))
        ? {
            lat: Number(context.center.lat),
            lng: Number(context.center.lng),
            isOfficial: Boolean(context?.center?.isOfficial),
          }
        : avgCenter
    );
  const lat = Number(resolvedCenter?.lat);
  const lng = Number(resolvedCenter?.lng);
  const displayId = formattedIncidentDisplayId(
    domainKey,
    incidentId,
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    String(context?.explicitDisplayId || "").trim()
      || String(domainMeta?.displayIdHint || "").trim()
      || "",
    slIdByUuid,
  ) || incidentId;
  const locationLabel =
    String(context?.marker?.location_label || "").trim()
    || String(context?.marker?.nearest_address || "").trim()
    || String(domainMeta?.locationLabel || "").trim()
    || String(domainMeta?.nearestAddress || "").trim()
    || noteLocation
    || noteAddress
    || (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "");

  return {
    center: resolvedCenter,
    lat,
    lng,
    displayId,
    locationLabel,
  };
}

export function resolveIncidentDrivenPopupMetaContextShared(domainKeyRaw, incidentIdRaw, incidentIdsRaw = [], deps = {}) {
  const { resolveIncidentDrivenDomainMeta } = deps;
  const domainKey = resolveDomainKeyShared(domainKeyRaw, deps);
  const incidentId = String(incidentIdRaw || "").trim();
  if (!domainKey || !incidentId || typeof resolveIncidentDrivenDomainMeta !== "function") {
    return null;
  }

  const candidateIds = Array.from(new Set([
    incidentId,
    ...(Array.isArray(incidentIdsRaw) ? incidentIdsRaw : []),
  ].map((id) => String(id || "").trim()).filter(Boolean)));
  const candidates = candidateIds
    .map((id) => resolveIncidentDrivenDomainMeta(domainKey, id))
    .filter(Boolean);
  const best = candidates.find((entry) => entry?.record) || candidates[0] || null;
  const bestCenter = best?.center || null;

  return {
    domainKey,
    record: best?.record || null,
    lat: Number(bestCenter?.lat),
    lng: Number(bestCenter?.lng),
    displayIdHint: String(best?.displayIdHint || "").trim(),
    locationLabel: String(best?.locationLabel || "").trim(),
    nearestAddress: String(best?.nearestAddress || "").trim(),
    nearestCrossStreet: String(best?.nearestCrossStreet || "").trim(),
    nearestIntersection: String(best?.nearestIntersection || "").trim(),
    nearestLandmark: String(best?.nearestLandmark || "").trim(),
  };
}

export function resolveIncidentDrivenPopupLocationContextShared(context = {}, deps = {}) {
  const {
    incidentLocationCacheByKey,
    resolveIncidentDrivenGroupMeta,
    resolveIncidentDrivenPopupMetaContext,
  } = deps;
  const domainKey = resolveDomainKeyShared(context?.domainKey, deps);
  const incidentId = String(context?.incidentId || "").trim();
  if (
    !domainKey
    || !incidentId
    || typeof resolveIncidentDrivenGroupMeta !== "function"
    || typeof resolveIncidentDrivenPopupMetaContext !== "function"
  ) {
    return null;
  }

  const orderedIncidentIds = Array.isArray(context?.incidentIds)
    ? Array.from(new Set(context.incidentIds.map((id) => String(id || "").trim()).filter(Boolean)))
    : [];
  const popupMeta = resolveIncidentDrivenPopupMetaContext(domainKey, incidentId, orderedIncidentIds);
  const markerCenter = Number.isFinite(Number(context?.marker?.lat)) && Number.isFinite(Number(context?.marker?.lng))
    ? {
        lat: Number(context.marker.lat),
        lng: Number(context.marker.lng),
        isOfficial: Boolean(context?.marker?.isOfficial),
      }
    : null;
  const groupMeta = resolveIncidentDrivenGroupMeta(domainKey, incidentId, {
    rows: context?.allRows,
    center: markerCenter,
    marker: context?.marker,
    explicitDisplayId: context?.marker?.display_id,
  });
  const cachedLocation = [
    incidentId,
    String(context?.markerId || "").trim(),
    ...orderedIncidentIds,
  ]
    .map((id) => incidentLocationCacheByKey?.[incidentLocationCacheKey(domainKey, id)] || null)
    .find(Boolean) || null;

  const latest = context?.latest || null;
  const lat = Number.isFinite(Number(context?.marker?.lat))
    ? Number(context.marker.lat)
    : Number.isFinite(Number(groupMeta?.lat))
      ? Number(groupMeta.lat)
      : Number.isFinite(Number(popupMeta?.lat))
        ? Number(popupMeta.lat)
        : Number.isFinite(Number(latest?.lat))
          ? Number(latest.lat)
          : NaN;
  const lng = Number.isFinite(Number(context?.marker?.lng))
    ? Number(context.marker.lng)
    : Number.isFinite(Number(groupMeta?.lng))
      ? Number(groupMeta.lng)
      : Number.isFinite(Number(popupMeta?.lng))
        ? Number(popupMeta.lng)
        : Number.isFinite(Number(latest?.lng))
          ? Number(latest.lng)
          : NaN;
  const coordsText = Number.isFinite(lat) && Number.isFinite(lng)
    ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    : "Unavailable";

  const noteAddress = readAddressFromNote(latest?.note);
  const noteLocation = readLocationFromNote(latest?.note);
  const noteCrossStreet = readCrossStreetFromNote(latest?.note);
  const noteIntersection = readIntersectionFromNote(latest?.note);
  const noteLandmark = readLandmarkFromNote(latest?.note);
  const cachedLocationLabel = String(cachedLocation?.locationLabel || "").trim();
  const markerLocationLabel = String(context?.marker?.location_label || "").trim();
  const groupLocationLabel = String(groupMeta?.locationLabel || "").trim();
  const popupMetaNearestAddress = String(popupMeta?.nearestAddress || "").trim();
  const popupMetaLocationLabel = String(popupMeta?.locationLabel || "").trim();
  const rawLocationLabel =
    String(cachedLocation?.nearestAddress || "").trim()
    || cachedLocationLabel
    || String(context?.marker?._geoNearestAddress || "").trim()
    || String(context?.marker?.nearest_address || "").trim()
    || popupMetaNearestAddress
    || popupMetaLocationLabel
    || markerLocationLabel
    || groupLocationLabel
    || noteAddress
    || noteLocation
    || (Number.isFinite(lat) && Number.isFinite(lng) ? coordsText : "Location unavailable");
  const nearMatch = rawLocationLabel.match(/\s*\(Near:\s*(.*?)\)\s*$/i);
  const locationBase = nearMatch
    ? rawLocationLabel.replace(/\s*\(Near:\s*.*?\)\s*$/i, "").trim()
    : rawLocationLabel;
  const nearestAddress =
    String(cachedLocation?.nearestAddress || "").trim()
    || (isUsableAddressText(cachedLocationLabel) ? cachedLocationLabel : "")
    || String(context?.marker?._geoNearestAddress || "").trim()
    || String(context?.marker?.nearest_address || "").trim()
    || popupMetaNearestAddress
    || noteAddress
    || (isUsableAddressText(locationBase) ? locationBase : "")
    || "Location unavailable";
  const nearestCrossStreet =
    String(cachedLocation?.nearestCrossStreet || "").trim()
    || String(cachedLocation?.nearestIntersection || "").trim()
    || String(context?.marker?._geoNearestCrossStreet || "").trim()
    || String(context?.marker?._geoNearestIntersection || "").trim()
    || String(context?.marker?.nearest_cross_street || "").trim()
    || String(context?.marker?.nearest_intersection || "").trim()
    || String(popupMeta?.nearestCrossStreet || popupMeta?.nearestIntersection || "").trim()
    || noteCrossStreet
    || noteIntersection
    || "";
  const nearestIntersection =
    String(cachedLocation?.nearestIntersection || "").trim()
    || String(context?.marker?._geoNearestIntersection || "").trim()
    || String(context?.marker?.nearest_intersection || "").trim()
    || noteIntersection
    || nearestCrossStreet
    || "";
  const nearestLandmark =
    String(cachedLocation?.nearestLandmark || "").trim()
    || String(context?.marker?._geoNearestLandmark || "").trim()
    || String(context?.marker?.nearest_landmark || "").trim()
    || String(popupMeta?.nearestLandmark || "").trim()
    || String(nearMatch?.[1] || "").trim()
    || noteLandmark
    || "";
  const locationLabel = nearestLandmark
    ? `${nearestAddress} (Near: ${nearestLandmark})`
    : nearestAddress;
  const locationPending = Boolean(context?.marker?._geoLocationPending) && !isUsableAddressText(nearestAddress);
  const locationDisplay = locationPending ? "Resolving nearest address..." : nearestAddress;

  return {
    lat,
    lng,
    coordsText,
    displayId: String(groupMeta?.displayId || "").trim()
      || incidentId
      || String(context?.markerId || "").trim()
      || "Incident",
    locationLabel,
    locationDisplay,
    locationPending,
    nearestAddress,
    nearestCrossStreet,
    nearestIntersection,
    nearestLandmark,
  };
}
