import { getIncidentDomainStartupHelperShared } from "./mapIncidentDomainStartupConfig.js";
import { RUNTIME_DOMAIN_META } from "./mapRuntimeDomainMeta";
import { normalizeDomainKeyOrSlug } from "./mapReportParsingCoreSupport.js";

function normalizeRuntimeDomainKey(domainKeyRaw = "") {
  return normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
}

export function defaultRoadRequiredForDomainShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  if (!domainKey) return false;
  return Boolean(getIncidentDomainStartupHelperShared(domainKey).roadRequiredDefault);
}

export function resolveRuntimeDomainRoadRequiredShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  if (!domainKey) return false;
  if (RUNTIME_DOMAIN_META.roadRequiredByDomain.has(domainKey)) {
    return RUNTIME_DOMAIN_META.roadRequiredByDomain.get(domainKey) === true;
  }
  return defaultRoadRequiredForDomainShared(domainKey);
}

export function resolveRuntimeDomainParkRequiredShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  if (!domainKey) return false;
  if (RUNTIME_DOMAIN_META.parkRequiredByDomain.has(domainKey)) {
    return RUNTIME_DOMAIN_META.parkRequiredByDomain.get(domainKey) === true;
  }
  return false;
}
