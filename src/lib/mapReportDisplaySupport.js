import { BUILT_IN_DOMAIN_DISPLAY_PREFIXES } from "./mapDomainSelectionConfig.js";
import {
  fallbackGeneratedReportNumber,
  formatPersistedReportNumber,
  normalizeDomainKeyOrSlug,
  reportDomainFromLightId,
} from "./mapReportParsingSupport";
import { humanizeLabel } from "./workspaceLabelSupport.js";

export function resolveReportDomainLabelShared(domainKeyRaw, fallback = "Incident", deps = {}) {
  const { runtimeDomainMeta, reportDomainOptions = [] } = deps;
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!key) return fallback;
  return String(
    runtimeDomainMeta?.labelByDomain?.get?.(key)
      || reportDomainOptions.find((option) => option.key === key)?.label
      || humanizeLabel(key)
  ).trim() || fallback;
}

export function reportNumberForRowShared(row, domainHint = "", deps = {}) {
  const {
    runtimeDomainMeta,
    getIncidentDomainHelper,
    reportDomainFromLightId: reportDomainFromLightIdOverride = reportDomainFromLightId,
  } = deps;
  const domain = normalizeDomainKeyOrSlug(
    domainHint || row?.domain_key || row?.domain || reportDomainFromLightIdOverride?.(row?.light_id),
    { allowUnknown: true }
  ) || "streetlights";
  const persisted = String(row?.report_number || "").trim();
  const runtimePrefix = String(runtimeDomainMeta?.reportPrefixByDomain?.get?.(domain) || "").trim().toUpperCase();
  const helperPrefix = String(
    typeof getIncidentDomainHelper === "function"
      ? (getIncidentDomainHelper(domain)?.reportNumberPrefix || "")
      : ""
  ).trim().toUpperCase();
  const builtInPrefix = helperPrefix || String(BUILT_IN_DOMAIN_DISPLAY_PREFIXES[domain] || "").trim().toUpperCase() || "SL";
  if (persisted) {
    return formatPersistedReportNumber(persisted, runtimePrefix || builtInPrefix);
  }

  const prefix = builtInPrefix || runtimePrefix || "SL";
  return fallbackGeneratedReportNumber(
    prefix,
    row?.id,
    `${row?.light_id || row?.incident_id || ""}|${row?.ts || 0}`
  );
}
