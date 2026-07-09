import {
  normalizeDomainKey,
  normalizeDomainKeyOrSlug,
} from "./mapReportParsingSupport";
import { isUsableAddressText } from "./mapPopupTextSupport.js";

const INCIDENT_LOCATION_CACHE_STORAGE_PREFIX = "cityreport_incident_location_cache_v1";

export function incidentLocationCacheKey(domainKeyRaw, incidentIdRaw) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
  const incidentId = String(incidentIdRaw || "").trim();
  if (!domainKey || !incidentId) return "";
  return `${domainKey}::${incidentId}`;
}

export function incidentLocationCacheStorageKey(tenantKeyRaw) {
  const tenantKey = String(tenantKeyRaw || "").trim().toLowerCase();
  return tenantKey ? `${INCIDENT_LOCATION_CACHE_STORAGE_PREFIX}:${tenantKey}` : "";
}

export function sanitizeIncidentLocationCacheMap(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw)) {
    const cacheKey = String(key || "").trim();
    if (!cacheKey || !value || typeof value !== "object") continue;
    const nearestAddress = String(value?.nearestAddress || value?.nearest_address || "").trim();
    const nearestCrossStreet = String(value?.nearestCrossStreet || value?.nearest_cross_street || "").trim();
    const nearestIntersection = String(value?.nearestIntersection || value?.nearest_intersection || "").trim();
    const nearestLandmark = String(value?.nearestLandmark || value?.nearest_landmark || "").trim();
    const locationLabel = String(value?.locationLabel || value?.location_label || "").trim();
    if (!(nearestAddress || nearestCrossStreet || nearestIntersection || nearestLandmark || locationLabel)) continue;
    out[cacheKey] = {
      nearestAddress,
      nearestCrossStreet,
      nearestIntersection,
      nearestLandmark,
      locationLabel,
    };
  }
  return out;
}

export function mergeIncidentLocationCacheMaps(...maps) {
  const out = {};
  for (const raw of maps) {
    const sanitized = sanitizeIncidentLocationCacheMap(raw);
    for (const [key, value] of Object.entries(sanitized)) {
      out[key] = {
        ...(out[key] || {}),
        ...value,
      };
    }
  }
  return sanitizeIncidentLocationCacheMap(out);
}

export function buildIncidentLocationCacheEntryPayload(nextValues = {}, fallbackLocationLabel = "") {
  const payload = {
    ...(nextValues && typeof nextValues === "object" ? nextValues : {}),
  };
  if (!String(payload?.locationLabel || payload?.location_label || "").trim()) {
    payload.locationLabel = String(fallbackLocationLabel || "").trim();
  }
  return sanitizeIncidentLocationCacheMap({ __entry__: payload }).__entry__ || null;
}

export function incidentLocationNeedsEnrichment(nextValues = {}, options = {}) {
  const entry = buildIncidentLocationCacheEntryPayload(nextValues);
  if (!entry) return false;
  const requireUsableAddress = Boolean(options?.requireUsableAddress);
  if (requireUsableAddress && !isUsableAddressText(entry.nearestAddress)) {
    return true;
  }
  return (
    !String(entry.nearestCrossStreet || "").trim()
    || !String(entry.nearestIntersection || "").trim()
    || !String(entry.nearestLandmark || "").trim()
  );
}

export function readPersistedIncidentLocationCache(tenantKeyRaw) {
  if (typeof window === "undefined") return {};
  const storageKey = incidentLocationCacheStorageKey(tenantKeyRaw);
  if (!storageKey) return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    return sanitizeIncidentLocationCacheMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writePersistedIncidentLocationCache(tenantKeyRaw, value) {
  if (typeof window === "undefined") return;
  const storageKey = incidentLocationCacheStorageKey(tenantKeyRaw);
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(sanitizeIncidentLocationCacheMap(value)));
  } catch {
    // non-fatal: runtime cache still works even if persistent storage is unavailable
  }
}
