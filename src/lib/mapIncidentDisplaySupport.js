import {
  BUILT_IN_DOMAIN_DISPLAY_PREFIXES,
  BUILT_IN_DOMAIN_ID_LABELS,
  BUILT_IN_INCIDENT_DISPLAY_ID_PATTERNS,
} from "./mapDomainSelectionConfig.js";
import { makeCoordsHashedDisplayIdFromIncidentId } from "./mapIncidentDisplayIdHashSupport.js";
import {
  normalizeDomainKey,
  normalizeDomainKeyOrSlug,
  shortIncidentKey,
  singularizeDomainLabel,
} from "./mapReportParsingSupport";
import { displayLightId } from "./mapStreetlightDisplayIdSupport.js";
import { humanizeLabel } from "./workspaceLabelSupport.js";

function displayIdDigitsFromCoords(lat, lng) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return "";
  const lat5 = String(Math.abs(nLat).toFixed(5).split(".")[1] || "00000").slice(0, 5).padEnd(5, "0");
  const lng5 = String(Math.abs(nLng).toFixed(5).split(".")[1] || "00000").slice(0, 5).padEnd(5, "0");
  if (!/^\d{5}$/.test(lat5) || !/^\d{5}$/.test(lng5)) return "";
  return `${lng5}${lat5}`;
}

function displayIdDigitsFromIncidentId(incidentId) {
  const s = String(incidentId || "").trim();
  if (!s) return "";
  const m = s.match(/^[^:]+:([-]?\d+(?:\.\d+)?):([-]?\d+(?:\.\d+)?)$/);
  if (!m) return "";
  return displayIdDigitsFromCoords(Number(m[1]), Number(m[2]));
}

function incidentDisplayPrefixForDomain(domainKey, runtimeDomainMeta = null) {
  const domain = normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true }) || String(domainKey || "").trim().toLowerCase();
  const runtimePrefix = String(runtimeDomainMeta?.reportPrefixByDomain?.get?.(domain) || "").trim().toUpperCase();
  if (runtimePrefix) return runtimePrefix.replace(/[^A-Z0-9]/g, "") || runtimePrefix;
  const builtInPrefix = String(BUILT_IN_DOMAIN_DISPLAY_PREFIXES[domain] || "").trim().toUpperCase();
  if (builtInPrefix) return builtInPrefix.replace(/[^A-Z0-9]/g, "") || builtInPrefix;
  const fallback = String(domain || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return fallback.slice(0, 3) || "INC";
}

function matchesDomainDisplayId(domainKeyRaw, valueRaw, runtimeDomainMeta = null) {
  const prefix = incidentDisplayPrefixForDomain(domainKeyRaw, runtimeDomainMeta);
  const value = String(valueRaw || "").trim().toUpperCase();
  if (!prefix || !value) return false;
  const normalizedPrefix = String(prefix || "").replace(/[^A-Z0-9]/g, "");
  if (!normalizedPrefix) return false;
  return new RegExp(`^${normalizedPrefix}[0-9A-Z]{6,}$`, "i").test(value);
}

function genericIncidentDisplayId(domainKey, lat, lng, incidentId = "", runtimeDomainMeta = null) {
  const prefix = incidentDisplayPrefixForDomain(domainKey, runtimeDomainMeta);
  const digits = displayIdDigitsFromCoords(lat, lng) || displayIdDigitsFromIncidentId(incidentId);
  if (digits) return `${prefix}${digits}`;
  return `${prefix}${shortIncidentKey(incidentId || `${domainKey || ""}|${lat || ""}|${lng || ""}`)}`;
}

function incidentDrivenBuiltInDisplayId(domainKeyRaw, context = {}, deps = {}) {
  const { getIncidentDomainHelper, runtimeDomainMeta } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return "";
  const helper = typeof getIncidentDomainHelper === "function" ? (getIncidentDomainHelper(domainKey) || {}) : {};
  const builtInDisplayIdMode = String(helper?.builtInDisplayIdMode || "").trim();
  if (builtInDisplayIdMode === "coords_hashed_from_incident") {
    return String(makeCoordsHashedDisplayIdFromIncidentId(
      String(helper?.reportNumberPrefix || "").trim(),
      context?.incidentId,
      genericIncidentDisplayId(
        domainKey,
        Number(context?.lat),
        Number(context?.lng),
        String(context?.incidentId || "").trim(),
        runtimeDomainMeta,
      )
    ) || "").trim();
  }
  return String(genericIncidentDisplayId(
    domainKey,
    Number(context?.lat),
    Number(context?.lng),
    String(context?.incidentId || "").trim(),
    runtimeDomainMeta,
  ) || "").trim();
}

function resolveBuiltInIncidentDisplayId(domainKeyRaw, context = {}, deps = {}) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const builtInPattern = BUILT_IN_INCIDENT_DISPLAY_ID_PATTERNS[domainKey];
  const provided = String(context?.provided || "").trim();
  if (builtInPattern && builtInPattern.test(provided)) return provided.toUpperCase();
  return incidentDrivenBuiltInDisplayId(domainKey, context, deps);
}

export function incidentIdLabelForDomainShared(domainKeyRaw, fallback = "Incident ID", deps = {}) {
  const { runtimeDomainMeta, reportDomainOptions = [] } = deps;
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || normalizeDomainKey(domainKeyRaw);
  if (!key) return fallback;
  const builtInLabel = String(BUILT_IN_DOMAIN_ID_LABELS[key] || "").trim();
  if (builtInLabel) return builtInLabel;

  const runtimeLabel = String(
    runtimeDomainMeta?.labelByDomain?.get?.(key)
      || reportDomainOptions.find((option) => option.key === key)?.label
      || humanizeLabel(key)
  ).trim();
  return `${singularizeDomainLabel(runtimeLabel, String(fallback || "Incident ID").replace(/\s+ID$/i, ""))} ID`;
}

export function formattedIncidentDisplayIdShared(
  domainKeyRaw,
  incidentIdRaw,
  coords = null,
  explicitDisplayId = "",
  slIdByUuid = null,
  deps = {},
) {
  const { runtimeDomainMeta } = deps;
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const incidentId = String(incidentIdRaw || "").trim();
  const domainIdLabel = incidentIdLabelForDomainShared(domainKey, "", deps).trim();
  let provided = String(explicitDisplayId || "").trim();
  if (domainIdLabel && provided.toLowerCase().startsWith(domainIdLabel.toLowerCase())) {
    provided = provided.slice(domainIdLabel.length).trim();
  }
  provided = provided.replace(/^incident\s+id\s+/i, "").trim();
  const lat = Number(coords?.lat);
  const lng = Number(coords?.lng);

  if (domainKey === "streetlights") {
    if (/^SL\d{10}$/i.test(provided)) return provided.toUpperCase();
    return displayLightId(incidentId, slIdByUuid);
  }
  const builtInIncidentDisplayId = resolveBuiltInIncidentDisplayId(domainKey, {
    provided,
    incidentId,
    lat,
    lng,
  }, deps);
  if (builtInIncidentDisplayId) return builtInIncidentDisplayId;
  if (provided && matchesDomainDisplayId(domainKey, provided, runtimeDomainMeta)) return provided.toUpperCase();
  if (incidentId && matchesDomainDisplayId(domainKey, incidentId, runtimeDomainMeta)) return incidentId.toUpperCase();
  if (provided) return provided;
  return genericIncidentDisplayId(domainKey, lat, lng, incidentId, runtimeDomainMeta);
}
