import { isAssetBackedDomainType } from "./domainCatalog";
import { normalizeDomainKeyOrSlug } from "./mapReportParsingCoreSupport.js";

const DOMAIN_MARKER_COLORS = Object.freeze({
  potholes: "#8e24aa",
  street_signs: "#1e88e5",
  water_drain_issues: "#0288d1",
  power_outage: "#d32f2f",
  water_main: "#1e88e5",
  downed_tree: "#2e7d32",
  encampment: "#00897b",
  illegal_dumping: "#ef6c00",
});

function normalizeMarkerDomainKey(domainKeyRaw) {
  return normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    || String(domainKeyRaw || "").trim().toLowerCase();
}

function isHexColor(value) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value || "").trim());
}

export function defaultMarkerColorForDomainShared(domainKeyRaw, deps = {}) {
  const { runtimeDomainMeta, getIncidentDomainHelper } = deps;
  const key = normalizeMarkerDomainKey(domainKeyRaw);
  const runtimeColor = String(runtimeDomainMeta?.markerColorByDomain?.get?.(key) || "").trim();
  if (isHexColor(runtimeColor)) return runtimeColor;
  const helperColor = String(getIncidentDomainHelper?.(key)?.markerColor || "").trim();
  if (isHexColor(helperColor)) return helperColor;
  const builtInColor = String(DOMAIN_MARKER_COLORS[key] || "").trim();
  if (isHexColor(builtInColor)) return builtInColor;
  if (key === "graffiti") return "#8e24aa";
  return "#234a72";
}

export function defaultHighConfidenceMarkerColorForDomainShared(domainKeyRaw, deps = {}) {
  const key = normalizeMarkerDomainKey(domainKeyRaw);
  if (isAssetBackedDomainType(key)) return "#f57c00";
  return defaultMarkerColorForDomainShared(key, deps);
}

export function resolveHighConfidenceMarkerColorForDomainShared(domainKeyRaw, deps = {}) {
  const { runtimeDomainMeta } = deps;
  const key = normalizeMarkerDomainKey(domainKeyRaw);
  if (!key) return defaultHighConfidenceMarkerColorForDomainShared(domainKeyRaw, deps);
  const runtimeColor = String(runtimeDomainMeta?.highConfidenceMarkerColorByDomain?.get?.(key) || "").trim();
  if (isHexColor(runtimeColor)) return runtimeColor;
  return defaultHighConfidenceMarkerColorForDomainShared(key, deps);
}
