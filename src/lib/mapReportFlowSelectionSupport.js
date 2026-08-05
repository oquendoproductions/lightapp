import {
  findNormalizedIssueOption,
} from "./mapDomainConfigSupport.js";
import {
  findNormalizedTypeOption,
  isIssueTypeOptionConfig,
  normalizeLooseIssueToken,
  readDomainTypeFromNote,
  readIssueTypeFromNote,
  readTaggedValueFromNote,
  resolveDomainTypeSelectionLabel,
} from "./mapDomainTypeOptionSupport.js";

export function buildInitialDomainTypeSelections(target, typeOptionConfigs = []) {
  const configs = Array.isArray(typeOptionConfigs) ? typeOptionConfigs : [];
  const next = {};
  const rawSelections = target && typeof target?.typeSelections === "object" && !Array.isArray(target.typeSelections)
    ? target.typeSelections
    : {};
  for (const [index, cfg] of configs.entries()) {
    const optionKey = normalizeLooseIssueToken(cfg?.optionKey || cfg?.option_key || cfg?.optionLabel || cfg?.option_label || `type_option_${index + 1}`);
    const existingValue = String(rawSelections?.[cfg.optionKey] || "").trim();
    const existingMatch = findNormalizedTypeOption(existingValue, cfg.choices);
    const taggedTypeValue = readTaggedValueFromNote(target?.note || "", [`Type Option ${cfg.optionLabel}`]);
    const legacyTaggedAliases = Array.isArray(cfg?.legacyTaggedAliases)
      ? cfg.legacyTaggedAliases.map((value) => String(value || "").trim()).filter(Boolean)
      : [];
    const legacyTaggedValue = isIssueTypeOptionConfig(cfg)
      ? readIssueTypeFromNote(target?.note || "")
      : (
          readTaggedValueFromNote(target?.note || "", legacyTaggedAliases)
          || (cfg?.includeDomainTypeNoteFallback ? readDomainTypeFromNote(target?.note || "") : "")
        );
    const fallbackCandidates = isIssueTypeOptionConfig(cfg)
      ? [target?.issueValue, target?.issueType, target?.type, taggedTypeValue, legacyTaggedValue]
      : [target?.typeValue, target?.signType, taggedTypeValue, legacyTaggedValue];
    const fallbackMatch = fallbackCandidates
      .map((candidate) => findNormalizedTypeOption(candidate, cfg.choices))
      .find(Boolean);
    const defaultValue = String(cfg?.choices?.[0]?.value || "").trim().toLowerCase();
    next[cfg.optionKey] = String(existingMatch?.value || fallbackMatch?.value || defaultValue).trim().toLowerCase();
  }
  return next;
}

export function buildDomainTypeOptionNoteTags(typeSelections = {}, typeOptionConfigs = []) {
  const details = (Array.isArray(typeOptionConfigs) ? typeOptionConfigs : [])
    .map((cfg) => {
      const selectedValue = String(typeSelections?.[cfg.optionKey] || "").trim().toLowerCase();
      const selectedLabel = resolveDomainTypeSelectionLabel(selectedValue, cfg);
      if (!selectedLabel) return null;
      return {
        key: String(cfg?.optionKey || "").trim(),
        label: String(cfg?.optionLabel || "Type").trim(),
        value: selectedValue,
        valueLabel: selectedLabel,
      };
    })
    .filter(Boolean);

  // Keep a machine-readable, stable field identity with each report.  The
  // display label is tenant-editable, so parsing labels alone can otherwise
  // shift values into the wrong reporting field after a PCP edit.
  const metadata = details
    .filter((detail) => detail.key && detail.value && detail.valueLabel)
    .map((detail, index) => ({ ...detail, position: index + 1 }));
  const metadataTag = metadata.length
    ? `[CR_TYPE_OPTIONS:${encodeURIComponent(JSON.stringify(metadata))}]`
    : "";

  return [
    ...details.map((detail) => `Type Option ${detail.label}: ${detail.valueLabel}`),
    metadataTag,
  ].filter(Boolean);
}

export function readDomainTypeOptionMetadataFromNote(note) {
  const raw = String(note || "");
  const match = raw.match(/\[CR_TYPE_OPTIONS:([^\]]+)\]/i);
  if (!match?.[1]) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(String(match[1] || "")));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry, index) => ({
        key: normalizeLooseIssueToken(entry?.key || ""),
        label: String(entry?.label || "").trim(),
        value: String(entry?.value || "").trim(),
        valueLabel: String(entry?.valueLabel || "").trim(),
        position: Number.isFinite(Number(entry?.position)) ? Number(entry.position) : index + 1,
      }))
      .filter((entry) => entry.key && (entry.value || entry.valueLabel));
  } catch {
    return [];
  }
}

export function buildDomainTypeOptionPayload(typeSelections = {}, typeOptionConfigs = []) {
  return (Array.isArray(typeOptionConfigs) ? typeOptionConfigs : [])
    .map((cfg, index) => {
      const selectedValue = String(typeSelections?.[cfg.optionKey] || "").trim().toLowerCase();
      const selectedLabel = resolveDomainTypeSelectionLabel(selectedValue, cfg);
      if (!selectedLabel) return null;
      return {
        key: String(cfg.optionKey || "").trim(),
        label: String(cfg.optionLabel || "").trim() || "Type",
        value: selectedValue,
        valueLabel: selectedLabel,
        // The public label is tenant-controlled. A positional macro remains
        // stable when that label changes and is intentionally short.
        macroKey: `issue_type_${index + 1}`,
      };
    })
    .filter(Boolean);
}

export function streetlightIssueLabelMatches(issueValue, issueOptions = [], { values = [], labelPatterns = [] } = {}) {
  const normalizedValue = normalizeLooseIssueToken(issueValue);
  const matchedOption = findNormalizedIssueOption(issueValue, issueOptions);
  const normalizedLabel = normalizeLooseIssueToken(matchedOption?.label || "");
  if ((Array.isArray(values) ? values : []).some((value) => normalizeLooseIssueToken(value) === normalizedValue)) {
    return true;
  }
  return (Array.isArray(labelPatterns) ? labelPatterns : []).some((pattern) => {
    const matcher = normalizeLooseIssueToken(pattern);
    return Boolean(matcher) && (normalizedLabel === matcher || normalizedLabel.includes(matcher));
  });
}

export function isStreetlightOtherIssue(issueValue, issueOptions = []) {
  return streetlightIssueLabelMatches(issueValue, issueOptions, {
    values: ["other"],
    labelPatterns: ["other"],
  });
}

export function isStreetlightDownedPoleIssue(issueValue, issueOptions = []) {
  return streetlightIssueLabelMatches(issueValue, issueOptions, {
    values: ["downed_pole", "pole_down", "downed-pole", "pole-down"],
    labelPatterns: ["pole_down", "downed_pole"],
  });
}

export function resolveStoredStreetlightReportType(issueValue, issueOptions = []) {
  if (streetlightIssueLabelMatches(issueValue, issueOptions, {
    values: ["out", "light_out", "light_is_out"],
    labelPatterns: ["light_is_out", "light_out"],
  })) {
    return "out";
  }
  if (streetlightIssueLabelMatches(issueValue, issueOptions, {
    values: ["flickering", "dim_flickering", "dim", "flicker"],
    labelPatterns: ["flickering", "dim_flickering"],
  })) {
    return "flickering";
  }
  if (streetlightIssueLabelMatches(issueValue, issueOptions, {
    values: ["dayburner", "day_burner", "on_during_daytime", "on_during_day"],
    labelPatterns: ["during_daytime", "day_burner", "daytime"],
  })) {
    return "dayburner";
  }
  if (isStreetlightDownedPoleIssue(issueValue, issueOptions)) {
    return "downed_pole";
  }
  if (isStreetlightOtherIssue(issueValue, issueOptions)) {
    return "other";
  }
  return "other";
}
