import {
  defaultDomainTypeOptionConfigs,
  mergeDomainTypeOptionConfigsWithIssueOptions,
} from "./mapDomainConfigSupport";
import { resolveRuntimeDomainIssueOptionsShared, resolveRuntimeDomainTypeOptionConfigsShared } from "./mapRuntimeDomainReportConfigSupport.js";
import {
  isIssueTypeOptionConfig,
  readDomainTypeFromNote,
  readIssueTypeFromNote,
  readTaggedValueFromNote,
  resolveDomainTypeSelectionLabel,
} from "./mapDomainTypeOptionSupport.js";
import { normalizeDomainKeyOrSlug } from "./mapReportParsingSupport";
import { RUNTIME_DOMAIN_META } from "./mapRuntimeDomainMeta.js";
import { humanizeLabel } from "./workspaceLabelSupport.js";

function readLegacyTypeOptionValueFromNote(note, optionLabel = "", optionKey = "") {
  const rawNotes = String(note || "");
  const normalizedOptionLabel = String(optionLabel || "").trim();
  const normalizedOptionKey = String(optionKey || "").trim();
  if (!(rawNotes && (normalizedOptionLabel || normalizedOptionKey))) return "";
  const aliases = [
    normalizedOptionLabel,
    humanizeLabel(normalizedOptionKey),
    "Type",
  ].filter(Boolean);
  return readTaggedValueFromNote(rawNotes, aliases) || readDomainTypeFromNote(rawNotes);
}

export function resolveReportTypeOptionDetails(
  row,
  domainKeyRaw,
  runtimeDomainMeta = {},
) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return [];

  const rawNotes = String(row?.note || row?.raw_notes || row?.notes || "");
  const useSharedRuntimeResolvers =
    !runtimeDomainMeta
    || runtimeDomainMeta === RUNTIME_DOMAIN_META
    || runtimeDomainMeta?.issueTypesByDomain === RUNTIME_DOMAIN_META.issueTypesByDomain;
  const runtimeIssueOptions = useSharedRuntimeResolvers
    ? resolveRuntimeDomainIssueOptionsShared(domainKey)
    : (runtimeDomainMeta?.issueTypesByDomain?.get?.(domainKey) || []);
  const typeOptionConfigs = useSharedRuntimeResolvers
    ? resolveRuntimeDomainTypeOptionConfigsShared(domainKey)
    : mergeDomainTypeOptionConfigsWithIssueOptions(
        domainKey,
        runtimeDomainMeta?.typeOptionsByDomain?.get?.(domainKey) || defaultDomainTypeOptionConfigs(domainKey),
        runtimeIssueOptions
      );
  if (!typeOptionConfigs.length) return [];

  return typeOptionConfigs
    .map((cfg, index) => {
      const optionLabel = String(cfg?.optionLabel || "").trim();
      const optionKey = String(cfg?.optionKey || "").trim() || `type_option_${index + 1}`;
      if (!optionLabel) return null;
      const taggedValue = readTaggedValueFromNote(rawNotes, [`Type Option ${optionLabel}`]);
      const legacyFallbackValue = isIssueTypeOptionConfig(cfg)
        ? readIssueTypeFromNote(rawNotes)
        : readLegacyTypeOptionValueFromNote(rawNotes, optionLabel, optionKey);
      const issueFallbackValue = isIssueTypeOptionConfig(cfg)
        ? String(row?.type || row?.report_type || "").trim()
        : "";
      const rawValue = String(taggedValue || legacyFallbackValue || issueFallbackValue || "").trim();
      if (!rawValue) return null;
      const valueLabel = resolveDomainTypeSelectionLabel(rawValue, cfg) || rawValue;
      if (!String(valueLabel || "").trim()) return null;
      return {
        key: optionKey,
        label: optionLabel,
        valueLabel: String(valueLabel || "").trim(),
      };
    })
    .filter(Boolean);
}
