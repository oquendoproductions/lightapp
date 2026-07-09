import { getRuntimeTenantKey } from "../tenant/runtimeTenant";

const DOMAIN_KEY_ALIAS_ROWS = Object.freeze([
  ["streetlights", "streetlights", "streetlight"],
  ["street_signs", "street_signs", "street signs", "street_sign", "street sign", "signs"],
  ["potholes", "potholes", "pothole"],
  ["water_drain_issues", "water_drain_issues", "water drain issues", "drain_issues", "drain issues", "sewer", "storm_drain", "storm drain"],
  ["power_outage", "power_outage", "power outage", "outage", "power"],
  ["water_main", "water_main", "water main", "water_main_break", "water main break", "water_main_breaks", "water main breaks"],
  ["park_equipment", "park_equipment", "park equipment", "park_equipment_issue", "park equipment issue"],
  ["downed_tree", "downed_tree", "downed tree", "fallen tree", "tree down"],
  ["encampment", "encampment", "encampments"],
  ["illegal_dumping", "illegal_dumping", "illegal dumping", "dumping"],
  ["graffiti", "graffiti"],
]);

const DOMAIN_KEY_BY_ALIAS = new Map(
  DOMAIN_KEY_ALIAS_ROWS.flatMap(([domainKey, ...aliases]) =>
    aliases.map((alias) => [alias, domainKey])
  )
);

const REPORT_TYPE_DOMAIN_KEYWORDS = Object.freeze([
  ["street_signs", ["sign"]],
  ["potholes", ["pothole"]],
  ["graffiti", ["graffiti"]],
  ["illegal_dumping", ["illegal dumping", "illegal_dumping", "dumping"]],
  ["encampment", ["encamp"]],
  ["downed_tree", ["downed tree", "downed_tree", "fallen tree", "tree limb"]],
  ["water_drain_issues", ["sewer", "storm_drain", "drain"]],
  ["water_main", ["water"]],
  ["power_outage", ["power"]],
]);

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizePhone(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

export function normalizeReportTypeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function fnv1aHash32(value) {
  const source = String(value || "");
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function formatPersistedReportNumber(persistedValue, explicitPrefix = "") {
  const normalized = String(persistedValue || "").trim().toUpperCase();
  if (!normalized) return "";
  const prefix = String(explicitPrefix || "").trim().toUpperCase();
  const digits = normalized.match(/(\d+)$/)?.[1] || "";
  const prefixRMatch = normalized.match(/^([A-Z0-9]+)-R(\d+)$/);
  if (prefixRMatch) return `${prefixRMatch[1]}-R${prefixRMatch[2].padStart(8, "0")}`;
  const legacyPrefixedMatch = normalized.match(/^R-([A-Z0-9]+)(\d+)$/);
  if (legacyPrefixedMatch) return `${legacyPrefixedMatch[1]}-R${legacyPrefixedMatch[2].padStart(8, "0")}`;
  const legacyBareMatch = normalized.match(/^([A-Z0-9]+)(\d+)$/);
  if (legacyBareMatch) return `${legacyBareMatch[1]}-R${legacyBareMatch[2].padStart(8, "0")}`;
  if (digits && prefix) return `${prefix}-R${digits.padStart(8, "0")}`;
  return normalized;
}

export function fallbackGeneratedReportNumber(prefix, idValue, fallbackValue = "") {
  const normalizedPrefix = String(prefix || "").trim().toUpperCase() || "SL";
  const asNum = Number(idValue);
  if (Number.isFinite(asNum) && asNum > 0) {
    return `${normalizedPrefix}-R${String(Math.trunc(asNum)).padStart(8, "0")}`;
  }
  const hashed = fnv1aHash32(idValue ?? fallbackValue);
  return `${normalizedPrefix}-R${String(hashed % 100000000).padStart(8, "0")}`;
}

export function shortIncidentKey(incidentId) {
  const value = String(incidentId || "").trim();
  if (!value) return "000000";
  const key = fnv1aHash32(value).toString(36).toUpperCase();
  return key.padStart(6, "0").slice(-6);
}

export function singularizeDomainLabel(label, fallback = "Incident") {
  const raw = String(label || "").trim() || String(fallback || "Incident").trim() || "Incident";
  if (/issues$/i.test(raw)) return raw.replace(/issues$/i, "Issue");
  if (/ies$/i.test(raw) && !/series$/i.test(raw)) return raw.replace(/ies$/i, "y");
  if (/s$/i.test(raw) && !/ss$/i.test(raw)) return raw.slice(0, -1);
  return raw;
}

export function boundaryViewportFromPolygons(polygons) {
  if (!Array.isArray(polygons) || polygons.length <= 0) return null;
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  let pointCount = 0;

  for (const poly of polygons) {
    if (!Array.isArray(poly)) continue;
    for (const ring of poly) {
      if (!Array.isArray(ring)) continue;
      for (const pt of ring) {
        const lat = Number(pt?.lat);
        const lng = Number(pt?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        pointCount += 1;
        if (lat > north) north = lat;
        if (lat < south) south = lat;
        if (lng > east) east = lng;
        if (lng < west) west = lng;
      }
    }
  }

  if (!(pointCount > 0)) return null;
  if (![north, south, east, west].every(Number.isFinite)) return null;

  return {
    north,
    south,
    east,
    west,
    center: {
      lat: (north + south) / 2,
      lng: (east + west) / 2,
    },
  };
}

export function viewportFromPoints(points) {
  if (!Array.isArray(points) || points.length <= 0) return null;
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  let pointCount = 0;

  for (const pt of points) {
    const lat = Number(pt?.lat);
    const lng = Number(pt?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    pointCount += 1;
    if (lat > north) north = lat;
    if (lat < south) south = lat;
    if (lng > east) east = lng;
    if (lng < west) west = lng;
  }

  if (!(pointCount > 0)) return null;
  if (![north, south, east, west].every(Number.isFinite)) return null;

  return {
    north,
    south,
    east,
    west,
    center: {
      lat: (north + south) / 2,
      lng: (east + west) / 2,
    },
  };
}

export function normalizeDomainKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return DOMAIN_KEY_BY_ALIAS.get(raw) || "";
}

export function normalizeDomainKeyOrSlug(value, { allowUnknown = false } = {}) {
  const normalized = normalizeDomainKey(value);
  if (normalized) return normalized;
  if (!allowUnknown) return "";
  const raw = String(value || "").trim().toLowerCase();
  if (/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(raw)) return raw;
  return "";
}

export function activeTenantKey() {
  return getRuntimeTenantKey();
}

export function tenantBoundaryConfigKey() {
  return `${activeTenantKey()}_city_geojson`;
}

export function reportDomainFromLightId(lightId) {
  const value = String(lightId || "").trim().toLowerCase();
  const prefix = normalizeDomainKeyOrSlug(value.split(":")[0], { allowUnknown: true });
  if (prefix && value.startsWith(`${prefix}:`)) return prefix;
  return "streetlights";
}

export function knownReportAssetDomainForLightId(lightId, assetIdSetsByDomain = new Map()) {
  const normalizedLightId = String(lightId || "").trim();
  if (!normalizedLightId) return "";
  for (const [domainKeyRaw, idSet] of assetIdSetsByDomain.entries()) {
    const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || String(domainKeyRaw || "").trim();
    if (!domainKey || domainKey === "streetlights") continue;
    if (idSet?.has?.(normalizedLightId)) return domainKey;
  }
  if (assetIdSetsByDomain.get("streetlights")?.has?.(normalizedLightId)) return "streetlights";
  return "";
}

export function isKnownReportAssetLightId(lightId, assetIdSetsByDomain = new Map()) {
  return Boolean(knownReportAssetDomainForLightId(lightId, assetIdSetsByDomain));
}

export function reportDomainForRow(row, assetIdSetsByDomain = new Map()) {
  const explicit =
    normalizeDomainKeyOrSlug(row?.report_domain, { allowUnknown: true }) ||
    normalizeDomainKeyOrSlug(row?.domain, { allowUnknown: true }) ||
    normalizeDomainKeyOrSlug(row?.category, { allowUnknown: true });
  if (explicit) return explicit;

  const lightId = String(row?.light_id || "").trim();
  const parsedLightIdDomain = reportDomainFromLightId(lightId);
  if (parsedLightIdDomain !== "streetlights") return parsedLightIdDomain;
  const assetBackedDomain = knownReportAssetDomainForLightId(lightId, assetIdSetsByDomain);
  if (assetBackedDomain) return assetBackedDomain;

  const type = normalizeReportTypeValue(row?.type || row?.report_type);
  if (!type) return "streetlights";
  for (const [domainKey, keywords] of REPORT_TYPE_DOMAIN_KEYWORDS) {
    if (keywords.some((keyword) => type.includes(keyword))) {
      return domainKey;
    }
  }
  return "streetlights";
}
