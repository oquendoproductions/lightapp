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
import { readDomainTypeOptionMetadataFromNote } from "./mapReportFlowSelectionSupport.js";
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
  ].filter(Boolean);
  // `Type` matches the tail of labels such as `Sign Type`.  It is only a
  // valid legacy fallback for the actual sign-type field; applying it to
  // every configured field was how values leaked into unrelated fields.
  const isSignType = normalizedOptionKey === "sign_type";
  return readTaggedValueFromNote(rawNotes, [
    ...aliases,
    ...(isSignType ? ["Sign Type", "Type"] : []),
  ]) || (isSignType ? readDomainTypeFromNote(rawNotes) : "");
}

function readLegacyTypeOptionTags(note) {
  const raw = String(note || "");
  const matches = [];
  const pattern = /(?:^|\s)Type Option(?:\s+([^:|]+?))?\s*:\s*([^|]+?)(?=\s*\||$)/gi;
  let match = pattern.exec(raw);
  while (match) {
    const label = String(match[1] || "").trim();
    const value = String(match[2] || "").trim();
    if (value) matches.push({ label, value });
    match = pattern.exec(raw);
  }
  return matches;
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

  const metadataByKey = new Map(
    readDomainTypeOptionMetadataFromNote(rawNotes)
      .map((detail) => [String(detail?.key || "").trim(), detail])
      .filter(([key]) => Boolean(key))
  );
  const legacyTags = readLegacyTypeOptionTags(rawNotes);
  // Earlier report rows stored the selected reporting-field value directly in
  // `report_type`, before the note carried stable field metadata.  When that
  // value maps to exactly one current field choice, it is authoritative enough
  // to recover the tenant's field label (for example, "Equipment Type:
  // Court") rather than displaying the generic "Issue Type".
  const storedReportTypeValue = String(row?.type || row?.report_type || "").trim();
  const matchingStoredReportTypeConfigKeys = storedReportTypeValue
    ? typeOptionConfigs
        .filter((cfg) => Boolean(resolveDomainTypeSelectionLabel(storedReportTypeValue, cfg)))
        .map((cfg) => String(cfg?.optionKey || "").trim())
        .filter(Boolean)
    : [];

  return typeOptionConfigs
    .map((cfg, index) => {
      const optionLabel = String(cfg?.optionLabel || "").trim();
      const optionKey = String(cfg?.optionKey || "").trim() || `type_option_${index + 1}`;
      if (!optionLabel) return null;
      const metadata = metadataByKey.get(optionKey) || null;
      const taggedValue = readTaggedValueFromNote(rawNotes, [`Type Option ${optionLabel}`]);
      const matchingLegacyTag = legacyTags.find((entry) => (
        String(entry?.label || "").trim().toLowerCase() === optionLabel.toLowerCase()
        || String(entry?.label || "").trim().toLowerCase() === optionKey.toLowerCase()
      ));
      // Old reports predate stable keys.  Their tags are still ordered exactly
      // like the report form, so position is a last-resort fallback only after
      // an exact old label lookup fails.
      const positionalLegacyTag = legacyTags[index] || null;
      const legacyFallbackValue = isIssueTypeOptionConfig(cfg)
        ? readIssueTypeFromNote(rawNotes)
        : readLegacyTypeOptionValueFromNote(rawNotes, optionLabel, optionKey);
      const issueFallbackValue = isIssueTypeOptionConfig(cfg)
        ? String(row?.type || row?.report_type || "").trim()
        : "";
      const storedReportTypeFallbackValue = matchingStoredReportTypeConfigKeys.length === 1
        && matchingStoredReportTypeConfigKeys[0] === optionKey
        ? storedReportTypeValue
        : "";
      const rawValue = String(
        metadata?.value
        || taggedValue
        || matchingLegacyTag?.value
        || legacyFallbackValue
        || positionalLegacyTag?.value
        || issueFallbackValue
        || storedReportTypeFallbackValue
        || ""
      ).trim();
      if (!rawValue) return null;
      const valueLabel = (
        resolveDomainTypeSelectionLabel(rawValue, cfg)
        || String(metadata?.valueLabel || "").trim()
        || rawValue
      );
      if (!String(valueLabel || "").trim()) return null;
      return {
        key: optionKey,
        label: optionLabel,
        valueLabel: String(valueLabel || "").trim(),
      };
    })
    .filter(Boolean);
}
