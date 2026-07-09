import {
  defaultDomainIssueOptions,
  defaultDomainTypeOptionConfigs,
  findNormalizedIssueOption,
  normalizeDomainIssueOptions,
} from "./mapDomainConfigSupport.js";
import {
  REPORT_TYPES,
  findNormalizedTypeOption,
  getIssueTypeOptionConfig,
  normalizeLooseIssueToken,
  readIssueTypeFromNote,
  readTaggedValueFromNote,
} from "./mapDomainTypeOptionSupport.js";
import { resolveRuntimeDomainIssueOptionsShared, resolveRuntimeDomainTypeOptionConfigsShared } from "./mapRuntimeDomainReportConfigSupport.js";
import { RUNTIME_DOMAIN_META } from "./mapRuntimeDomainMeta.js";
import { normalizeReportTypeValue } from "./mapReportParsingSupport.js";

function resolveIncidentDomainHelperLocal(domainKeyRaw, deps = {}) {
  const { getIncidentDomainHelper, normalizeDomainKeyOrSlug } = deps;
  if (typeof getIncidentDomainHelper !== "function" || typeof normalizeDomainKeyOrSlug !== "function") {
    return null;
  }
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return null;
  return {
    domainKey,
    helper: getIncidentDomainHelper(domainKey) || {},
  };
}

function formatGenericDomainIssueLabelLocal(issueKey) {
  const key = String(issueKey || "").trim().toLowerCase();
  if (!key || key === "other") return "";
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveRuntimeDomainIssueLabelLocal(domainKeyRaw, issueValueRaw, deps = {}) {
  const { normalizeDomainKeyOrSlug, runtimeDomainMeta } = deps;
  const key = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : "";
  const issueValue = String(issueValueRaw || "").trim().toLowerCase();
  if (!key || !issueValue) return "";

  const useSharedRuntimeResolvers =
    !runtimeDomainMeta
    || runtimeDomainMeta === RUNTIME_DOMAIN_META
    || runtimeDomainMeta?.issueTypesByDomain === RUNTIME_DOMAIN_META.issueTypesByDomain;
  const runtimeIssueOptions = useSharedRuntimeResolvers
    ? resolveRuntimeDomainIssueOptionsShared(key)
    : (runtimeDomainMeta?.issueTypesByDomain?.get?.(key) || []);
  const configuredOption = runtimeIssueOptions.find((row) => row?.value === issueValue);
  if (configuredOption?.label) return String(configuredOption.label || "").trim();

  const issueTypeOption = getIssueTypeOptionConfig(
    key,
    useSharedRuntimeResolvers
      ? resolveRuntimeDomainTypeOptionConfigsShared(key)
      : (runtimeDomainMeta?.typeOptionsByDomain?.get?.(key) || defaultDomainTypeOptionConfigs(key)),
    runtimeIssueOptions
  );
  const matchedChoice = findNormalizedTypeOption(issueValue, issueTypeOption?.choices || []);
  return String(matchedChoice?.label || "").trim();
}

export function resolveConfiguredDomainIssueLabelShared(
  domainKeyRaw,
  issueValueRaw,
  issueOptions = [],
  deps = {},
) {
  const { normalizeDomainKeyOrSlug } = deps;
  const domainKey = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : "";
  const issueValue = String(issueValueRaw || "").trim().toLowerCase();
  if (!domainKey || !issueValue) return "";

  const configuredOptions = normalizeDomainIssueOptions(issueOptions);
  const configuredLabel = String(
    configuredOptions.find((option) => option?.value === issueValue)?.label || ""
  ).trim();
  if (configuredLabel) return configuredLabel;

  const runtimeLabel = resolveRuntimeDomainIssueLabelLocal(domainKey, issueValue, deps);
  if (runtimeLabel) return runtimeLabel;

  const builtInLabel = String(
    findNormalizedIssueOption(issueValue, defaultDomainIssueOptions(domainKey))?.label || ""
  ).trim();
  if (builtInLabel) return builtInLabel;
  if (domainKey === "streetlights") {
    return String(REPORT_TYPES?.[issueValue] || "").trim() || formatGenericDomainIssueLabelLocal(issueValue);
  }
  return formatGenericDomainIssueLabelLocal(issueValue);
}

export function parseConfiguredIssueValueFromNoteShared(note, {
  aliases = [],
  keywordValueMap = [],
} = {}) {
  const text = String(note || "");
  if (!text) return "";
  const normalizedAliases = Array.isArray(aliases)
    ? aliases.map((value) => String(value || "").trim()).filter(Boolean)
    : [];
  const taggedValue = normalizedAliases.length
    ? readTaggedValueFromNote(text, normalizedAliases)
    : "";
  const normalizedTaggedValue = normalizeLooseIssueToken(taggedValue);
  if (normalizedTaggedValue) return normalizedTaggedValue;
  const rawTaggedValue = String(taggedValue || "").trim().toLowerCase();
  if (!rawTaggedValue) return "";
  const entries = Array.isArray(keywordValueMap) ? keywordValueMap : [];
  for (const entry of entries) {
    const value = String(entry?.value || "").trim();
    const matchAny = Array.isArray(entry?.matchAny)
      ? entry.matchAny.map((token) => String(token || "").trim().toLowerCase()).filter(Boolean)
      : [];
    if (value && matchAny.some((token) => rawTaggedValue.includes(token))) {
      return value;
    }
  }
  return "";
}

export function resolveStoredDomainIssueValueShared(
  domainKeyRaw,
  row,
  rawNotes = "",
  rawType = "",
  issueStateByIncident = {},
  deps = {},
) {
  const resolved = resolveIncidentDomainHelperLocal(domainKeyRaw, deps);
  if (!resolved || !row) return "";
  const incidentId = String(row?.light_id || row?.incident_id || "").trim();
  const stateField = String(resolved.helper?.storedIssueValueStateField || "").trim();
  const noteParserMode = String(resolved.helper?.storedIssueValueNoteParserMode || "").trim();
  const rawTypeNormalizerMode = String(resolved.helper?.storedIssueValueRawTypeNormalizerMode || "").trim();
  const storedStateValue = (
    stateField && incidentId
      ? String(issueStateByIncident?.[incidentId]?.[stateField] || "").trim()
      : ""
  );
  const parsedNoteValue = noteParserMode === "tag_alias_with_keyword_map"
    ? parseConfiguredIssueValueFromNoteShared(rawNotes, {
        aliases: resolved.helper?.storedIssueValueNoteParserAliases,
        keywordValueMap: resolved.helper?.storedIssueValueNoteParserKeywordValueMap,
      })
    : "";
  const normalizedTypeValue = rawTypeNormalizerMode === "report_type"
    ? normalizeReportTypeValue(rawType)
    : String(rawType || "").trim();
  return String(storedStateValue || parsedNoteValue || normalizedTypeValue || "").trim();
}

export function prefersConfiguredDomainIssueLabelShared(domainKeyRaw, deps = {}) {
  const resolved = resolveIncidentDomainHelperLocal(domainKeyRaw, deps);
  return Boolean(resolved ? resolved.helper?.prefersConfiguredIssueLabel : false);
}

export function domainSupportsReportIssueMetadataShared(domainKeyRaw, deps = {}) {
  const resolved = resolveIncidentDomainHelperLocal(domainKeyRaw, deps);
  return resolved ? resolved.helper?.supportsIssueMetadata !== false : false;
}

export function resolveReportIssueValueShared(row, domainKeyRaw, issueStateByIncident = {}, deps = {}) {
  const { normalizeDomainKeyOrSlug } = deps;
  const domainKey = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : "";
  if (!domainSupportsReportIssueMetadataShared(domainKey, deps) || !row) return "";

  const rawNotes = String(row?.note || row?.raw_notes || row?.notes || "");
  const rawType = String(row?.type || row?.report_type || "").trim();
  return resolveStoredDomainIssueValueShared(domainKey, row, rawNotes, rawType, issueStateByIncident, deps) || rawType;
}

export function resolveReportIssueLabelShared(row, domainKeyRaw, issueStateByIncident = {}, deps = {}) {
  const { normalizeDomainKeyOrSlug, resolveConfiguredDomainIssueLabel } = deps;
  const domainKey = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : "";
  if (
    !domainKey
    || typeof resolveConfiguredDomainIssueLabel !== "function"
    || !domainSupportsReportIssueMetadataShared(domainKey, deps)
  ) {
    return "";
  }

  const rawNotes = String(row?.note || row?.raw_notes || row?.notes || "");
  const noteIssueLabel = readIssueTypeFromNote(rawNotes);
  const issueValue = resolveReportIssueValueShared(row, domainKey, issueStateByIncident, deps);
  const resolvedIssueLabel = resolveConfiguredDomainIssueLabel(domainKey, issueValue);
  return prefersConfiguredDomainIssueLabelShared(domainKey, deps)
    ? (resolvedIssueLabel || noteIssueLabel || "")
    : (noteIssueLabel || resolvedIssueLabel);
}
