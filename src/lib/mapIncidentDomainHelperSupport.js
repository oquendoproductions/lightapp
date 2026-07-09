export {
  canonicalIncidentDrivenIncidentIdShared,
  hasIncidentIdPrefixShared,
  incidentDomainResolveLookupValueByModeShared,
  incidentSnapshotCandidateDomainsShared,
  normalizeIncidentDrivenLookupIdShared,
  readIncidentDomainConfiguredCollectionHelperStringShared,
  readIncidentDomainHelperBooleanShared,
  readIncidentDomainHelperStringShared,
  resolveIncidentDomainHelperEntryShared,
  stripConfiguredIncidentLookupPrefixShared,
} from "./mapIncidentDomainHelperCoreSupport.js";

import {
  normalizeIncidentDrivenLookupIdShared,
  readIncidentDomainConfiguredCollectionHelperStringShared,
  resolveIncidentDomainHelperEntryShared,
} from "./mapIncidentDomainHelperCoreSupport.js";

export function searchableIncidentLookupIdsForDomainShared(domainKeyRaw, incidentIdRaw, deps = {}) {
  const incidentId = String(incidentIdRaw || "").trim().toLowerCase();
  const lookupId = normalizeIncidentDrivenLookupIdShared(domainKeyRaw, incidentId, deps).toLowerCase();
  return Array.from(new Set([incidentId, lookupId].filter(Boolean)));
}

export function resolveIncidentMarkerLookupIdShared(domainKeyRaw, marker = null, fallback = "", deps = {}) {
  const resolved = resolveIncidentDomainHelperEntryShared(domainKeyRaw, deps);
  if (!resolved) {
    return String(fallback || marker?.incident_id || marker?.id || marker?.display_id || "").trim();
  }
  const candidateFields = [
    resolved.helper?.customSubmitFlowReportPayloadIncidentIdField,
    resolved.helper?.submitReportPayloadIncidentIdField,
    resolved.helper?.serviceSubmitPayloadIncidentIdField,
    resolved.helper?.normalizeReportRecordIncidentIdField,
    resolved.helper?.reportsLookupField,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  const rawIncidentId = String(marker?.incident_id || marker?.id || "").trim();
  const directFieldMatch = candidateFields
    .map((fieldName) => String(marker?.[fieldName] || "").trim())
    .find(Boolean);
  return String(
    directFieldMatch
    || normalizeIncidentDrivenLookupIdShared(resolved.domainKey, rawIncidentId, deps)
    || marker?.display_id
    || fallback
    || ""
  ).trim();
}
