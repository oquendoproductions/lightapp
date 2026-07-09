import { incidentLocationCacheKey } from "./mapIncidentLocationCacheSupport.js";
import {
  readAddressFromNote,
  readCrossStreetFromNote,
  readIntersectionFromNote,
  readLandmarkFromNote,
  readLocationFromNote,
} from "./mapReportParsingSupport.js";
import {
  isUsableAddressText,
  resolveDomainKeyShared,
  resolveIncidentDrivenLocationContextForRowShared,
} from "./mapIncidentPopupRowLocationContextSupport.js";

export { resolveIncidentDrivenLocationContextForRowShared };

export function resolveStreetlightUtilityForIncidentShared(incidentIdRaw, deps = {}) {
  const incidentId = String(incidentIdRaw || "").trim();
  if (!incidentId) return null;

  const streetlightReportInfoByIncident = deps?.streetlightReportInfoByIncident || null;
  const incidentLocationCacheByKey = deps?.incidentLocationCacheByKey || null;
  const officialLights = Array.isArray(deps?.officialLights) ? deps.officialLights : [];

  const fromState = streetlightReportInfoByIncident?.[incidentId] || null;
  if (fromState) return fromState;

  const fromCache = incidentLocationCacheByKey?.[incidentLocationCacheKey("streetlights", incidentId)] || null;
  if (fromCache) {
    return {
      nearestAddress: String(fromCache?.nearestAddress || fromCache?.locationLabel || "").trim(),
      nearestCrossStreet: String(fromCache?.nearestCrossStreet || "").trim(),
      nearestLandmark: String(fromCache?.nearestLandmark || "").trim(),
      nearestStreet: "",
      nearestIntersection: String(fromCache?.nearestIntersection || "").trim(),
    };
  }

  const byId = officialLights.find((light) => String(light?.id || "").trim() === incidentId);
  const bySlId = byId
    ? null
    : officialLights.find((light) => String(light?.sl_id || "").trim().toLowerCase() === incidentId.toLowerCase());
  const match = byId || bySlId;
  if (!match) return null;

  return {
    nearestAddress: String(match?.nearest_address || "").trim(),
    nearestCrossStreet: String(match?.nearest_cross_street || "").trim(),
    nearestLandmark: String(match?.nearest_landmark || "").trim(),
    nearestStreet: "",
    nearestIntersection: "",
  };
}

export function hydrateIncidentLocationFieldsShared(row, domainKeyRaw, deps = {}) {
  if (!row) return row;

  const domainKey = resolveDomainKeyShared(domainKeyRaw, deps);
  const incidentId = String(row?.incident_id || "").trim();
  const incidentLocationCacheByKey = deps?.incidentLocationCacheByKey || null;
  const getStreetlightUtilityForIncident = typeof deps?.getStreetlightUtilityForIncident === "function"
    ? deps.getStreetlightUtilityForIncident
    : (() => null);
  const resolveIncidentDrivenLocationContextForRow = typeof deps?.resolveIncidentDrivenLocationContextForRow === "function"
    ? deps.resolveIncidentDrivenLocationContextForRow
    : (() => null);
  const cachedLocation = incidentLocationCacheByKey?.[incidentLocationCacheKey(domainKey, incidentId)] || null;
  const latestDetail = row?.rows?.[0] || null;
  const latestRawNotes = String(latestDetail?.raw_notes || latestDetail?.notes || "").trim();
  const seededLocationLabel =
    String(row?.location_label || row?.locationLabel || "").trim()
    || String(latestDetail?.location_label || latestDetail?.nearest_address || "").trim();
  const seededNearestAddress =
    String(row?.nearest_address || "").trim()
    || String(latestDetail?.nearest_address || "").trim();
  const seededNearestCrossStreet =
    String(row?.nearest_cross_street || "").trim()
    || String(latestDetail?.nearest_cross_street || "").trim();
  const seededNearestLandmark =
    String(row?.nearest_landmark || "").trim()
    || String(latestDetail?.nearest_landmark || "").trim();

  if (domainKey === "streetlights") {
    const utility = getStreetlightUtilityForIncident(incidentId) || null;
    row.nearest_address =
      seededNearestAddress
      || String(utility?.nearestAddress || "").trim()
      || readAddressFromNote(latestRawNotes)
      || seededLocationLabel;
    row.nearest_cross_street =
      seededNearestCrossStreet
      || String(utility?.nearestCrossStreet || "").trim()
      || readCrossStreetFromNote(latestRawNotes);
    row.nearest_landmark =
      seededNearestLandmark
      || String(utility?.nearestLandmark || "").trim()
      || readLandmarkFromNote(latestRawNotes);
    row.location_label =
      seededLocationLabel
      || row.nearest_address
      || readLocationFromNote(latestRawNotes);
    return row;
  }

  if (domainKey && domainKey !== "streetlights") {
    const sharedLocationContext = resolveIncidentDrivenLocationContextForRow(domainKey, row);
    const sharedLocationLabel = String(sharedLocationContext?.locationLabel || "").trim();
    if (
      Number.isFinite(Number(sharedLocationContext?.lat))
      && Number.isFinite(Number(sharedLocationContext?.lng))
      && (!Number.isFinite(Number(row?.coords?.lat)) || !Number.isFinite(Number(row?.coords?.lng)))
    ) {
      row.coords = {
        lat: Number(sharedLocationContext.lat),
        lng: Number(sharedLocationContext.lng),
        isOfficial: false,
      };
    }
    row.location_label =
      String(sharedLocationContext?.locationLabel || "").trim()
      || seededLocationLabel
      || readLocationFromNote(latestRawNotes);
    row.nearest_address =
      String(sharedLocationContext?.nearestAddress || "").trim()
      || seededNearestAddress
      || readAddressFromNote(latestRawNotes)
      || (isUsableAddressText(sharedLocationLabel) ? sharedLocationLabel : "");
    row.nearest_cross_street =
      String(sharedLocationContext?.nearestCrossStreet || "").trim()
      || seededNearestCrossStreet
      || readCrossStreetFromNote(latestRawNotes);
    row.nearest_intersection =
      String(sharedLocationContext?.nearestIntersection || "").trim()
      || String(row?.nearest_intersection || "").trim()
      || readIntersectionFromNote(latestRawNotes)
      || row.nearest_cross_street;
    row.nearest_landmark =
      String(sharedLocationContext?.nearestLandmark || "").trim()
      || seededNearestLandmark
      || readLandmarkFromNote(latestRawNotes);
    return row;
  }

  row.nearest_address =
    String(cachedLocation?.nearestAddress || "").trim()
    || (isUsableAddressText(cachedLocation?.locationLabel) ? String(cachedLocation?.locationLabel || "").trim() : "")
    || seededNearestAddress
    || String(row?.nearest_address || "").trim()
    || readAddressFromNote(latestRawNotes)
    || (isUsableAddressText(seededLocationLabel) ? seededLocationLabel : "");
  row.nearest_cross_street =
    String(cachedLocation?.nearestCrossStreet || "").trim()
    || seededNearestCrossStreet
    || String(row?.nearest_cross_street || "").trim()
    || readCrossStreetFromNote(latestRawNotes);
  row.nearest_intersection =
    String(cachedLocation?.nearestIntersection || "").trim()
    || String(row?.nearest_intersection || "").trim()
    || readIntersectionFromNote(latestRawNotes);
  row.nearest_landmark =
    String(cachedLocation?.nearestLandmark || "").trim()
    || seededNearestLandmark
    || String(row?.nearest_landmark || "").trim()
    || readLandmarkFromNote(latestRawNotes);
  row.location_label =
    String(cachedLocation?.locationLabel || "").trim()
    || seededLocationLabel
    || row.nearest_address
    || readLocationFromNote(latestRawNotes);
  return row;
}
