export {
  activeTenantKey,
  boundaryViewportFromPolygons,
  fallbackGeneratedReportNumber,
  formatPersistedReportNumber,
  isKnownReportAssetLightId,
  knownReportAssetDomainForLightId,
  normalizeDomainKey,
  normalizeDomainKeyOrSlug,
  normalizeEmail,
  normalizePhone,
  normalizeReportTypeValue,
  reportDomainForRow,
  reportDomainFromLightId,
  shortIncidentKey,
  singularizeDomainLabel,
  tenantBoundaryConfigKey,
  viewportFromPoints,
} from "./mapReportParsingCoreSupport.js";

export function readLocationFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const match = raw.match(/(?:^|\s)Location:\s*([^|]+?)(?:\s*\||$)/i);
  if (!match) return "";
  return String(match[1] || "").trim();
}

export function stripLocationFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const withoutLocation = raw.replace(/(?:^|\s)Location:\s*([^|]+?)(?:\s*\||$)/i, "").trim();
  return withoutLocation.replace(/^\|\s*/, "").trim();
}

export function readImageUrlFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const structuredUrl = String(parsed.image_url || parsed.imageUrl || "").trim();
      if (structuredUrl) return structuredUrl;
    }
  } catch {
    // Fall through to legacy note parsing.
  }
  const match = raw.match(/(?:^|\s)Image:\s*(https?:\/\/[^\s|]+)(?:\s*\||$)/i);
  if (!match) return "";
  return String(match[1] || "").trim();
}

export function readAddressFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const match = raw.match(/(?:^|\s)Address:\s*([^|]+?)(?:\s*\||$)/i);
  if (!match) return "";
  return String(match[1] || "").trim();
}

export function readCrossStreetFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const match = raw.match(/(?:^|\s)Cross Street:\s*([^|]+?)(?:\s*\||$)/i);
  if (!match) return "";
  return String(match[1] || "").trim();
}

export function readLandmarkFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const match = raw.match(/(?:^|\s)Landmark:\s*([^|]+?)(?:\s*\||$)/i);
  if (!match) return "";
  const value = String(match[1] || "").trim();
  if (!value) return "";
  if (/^\d+\s*\/\s*\d+$/.test(value)) return "";
  return value;
}

export function readIntersectionFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const match = raw.match(/(?:^|\s)Intersection:\s*([^|]+?)(?:\s*\||$)/i);
  if (!match) return "";
  return String(match[1] || "").trim();
}
