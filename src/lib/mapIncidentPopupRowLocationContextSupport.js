import { incidentLocationCacheKey } from "./mapIncidentLocationCacheSupport.js";
import { isUsableAddressText } from "./mapPopupTextSupport.js";
import {
  readAddressFromNote,
  readCrossStreetFromNote,
  readIntersectionFromNote,
  readLandmarkFromNote,
  readLocationFromNote,
} from "./mapReportParsingSupport.js";

export function resolveDomainKeyShared(domainKeyRaw, deps = {}) {
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

export function resolveIncidentDrivenLocationContextForRowShared(domainKeyRaw, row, deps = {}) {
  const domainKey = resolveDomainKeyShared(domainKeyRaw, deps);
  if (!domainKey || !row) return null;

  const incidentId = String(
    row?.incident_id
    || row?.light_id
    || row?.id
    || ""
  ).trim();
  if (!incidentId) return null;

  const latestDetail = row?.rows?.[0] || null;
  const latestRawNotes = String(latestDetail?.raw_notes || latestDetail?.notes || "").trim();
  const cachedLocation = deps?.incidentLocationCacheByKey?.[incidentLocationCacheKey(domainKey, incidentId)] || null;
  const domainMeta = typeof deps?.resolveIncidentDrivenDomainMeta === "function"
    ? deps.resolveIncidentDrivenDomainMeta(domainKey, incidentId)
    : null;
  const domainCenter = domainMeta?.center || null;
  const lat =
    Number.isFinite(Number(row?.coords?.lat)) ? Number(row.coords.lat)
      : Number.isFinite(Number(row?.lat)) ? Number(row.lat)
        : Number.isFinite(Number(domainCenter?.lat)) ? Number(domainCenter.lat)
          : Number.isFinite(Number(latestDetail?.lat)) ? Number(latestDetail.lat)
            : NaN;
  const lng =
    Number.isFinite(Number(row?.coords?.lng)) ? Number(row.coords.lng)
      : Number.isFinite(Number(row?.lng)) ? Number(row.lng)
        : Number.isFinite(Number(domainCenter?.lng)) ? Number(domainCenter.lng)
          : Number.isFinite(Number(latestDetail?.lng)) ? Number(latestDetail.lng)
            : NaN;
  const seededLocationLabel =
    String(row?.location_label || row?.locationLabel || "").trim()
    || String(latestDetail?.location_label || latestDetail?.locationLabel || "").trim()
    || String(latestDetail?.nearest_address || "").trim();
  const seededNearestAddress =
    String(row?.nearest_address || "").trim()
    || String(latestDetail?.nearest_address || "").trim();
  const seededNearestCrossStreet =
    String(row?.nearest_cross_street || "").trim()
    || String(latestDetail?.nearest_cross_street || "").trim();
  const seededNearestIntersection =
    String(row?.nearest_intersection || "").trim()
    || String(latestDetail?.nearest_intersection || "").trim();
  const seededNearestLandmark =
    String(row?.nearest_landmark || "").trim()
    || String(latestDetail?.nearest_landmark || "").trim();
  const noteLocation = readLocationFromNote(latestRawNotes);
  const noteAddress = readAddressFromNote(latestRawNotes);
  const noteCrossStreet = readCrossStreetFromNote(latestRawNotes);
  const noteIntersection = readIntersectionFromNote(latestRawNotes);
  const noteLandmark = readLandmarkFromNote(latestRawNotes);
  const nearestAddress =
    String(cachedLocation?.nearestAddress || "").trim()
    || String(cachedLocation?.locationLabel || "").trim()
    || seededNearestAddress
    || String(domainMeta?.nearestAddress || domainMeta?.locationLabel || "").trim()
    || noteAddress
    || seededLocationLabel
    || noteLocation;
  const nearestCrossStreet =
    String(cachedLocation?.nearestCrossStreet || "").trim()
    || String(cachedLocation?.nearestIntersection || "").trim()
    || seededNearestCrossStreet
    || seededNearestIntersection
    || String(domainMeta?.nearestCrossStreet || "").trim()
    || String(domainMeta?.nearestIntersection || "").trim()
    || noteCrossStreet
    || noteIntersection;
  const nearestIntersection =
    String(cachedLocation?.nearestIntersection || "").trim()
    || seededNearestIntersection
    || String(domainMeta?.nearestIntersection || "").trim()
    || noteIntersection
    || nearestCrossStreet;
  const nearestLandmark =
    String(cachedLocation?.nearestLandmark || "").trim()
    || seededNearestLandmark
    || String(domainMeta?.nearestLandmark || "").trim()
    || noteLandmark;
  const locationLabel =
    String(cachedLocation?.locationLabel || "").trim()
    || seededLocationLabel
    || String(domainMeta?.locationLabel || "").trim()
    || nearestAddress
    || noteLocation;
  const coords =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng }
      : null;
  const displayId = typeof deps?.resolveDisplayId === "function"
    ? String(
        deps.resolveDisplayId({
          domainKey,
          incidentId,
          coords,
          row,
          domainMeta,
        }) || ""
      ).trim() || incidentId
    : incidentId;

  return {
    incidentId,
    latestRawNotes,
    lat,
    lng,
    fallbackLat: lat,
    fallbackLng: lng,
    coordinatesText:
      Number.isFinite(lat) && Number.isFinite(lng)
        ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        : "Unavailable",
    locationLabel,
    nearestAddress: nearestAddress || "Unavailable",
    nearestCrossStreet: nearestCrossStreet || "Unavailable",
    nearestIntersection: nearestIntersection || "Unavailable",
    nearestLandmark: nearestLandmark || "Unavailable",
    displayId,
  };
}

export { isUsableAddressText };
