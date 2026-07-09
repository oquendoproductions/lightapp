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
  return (Array.isArray(typeOptionConfigs) ? typeOptionConfigs : [])
    .map((cfg) => {
      const selectedValue = String(typeSelections?.[cfg.optionKey] || "").trim().toLowerCase();
      const selectedLabel = resolveDomainTypeSelectionLabel(selectedValue, cfg);
      if (!selectedLabel) return null;
      return `Type Option ${String(cfg.optionLabel || "Type").trim()}: ${selectedLabel}`;
    })
    .filter(Boolean);
}

export function buildDomainTypeOptionPayload(typeSelections = {}, typeOptionConfigs = []) {
  return (Array.isArray(typeOptionConfigs) ? typeOptionConfigs : [])
    .map((cfg) => {
      const selectedValue = String(typeSelections?.[cfg.optionKey] || "").trim().toLowerCase();
      const selectedLabel = resolveDomainTypeSelectionLabel(selectedValue, cfg);
      if (!selectedLabel) return null;
      return {
        key: String(cfg.optionKey || "").trim(),
        label: String(cfg.optionLabel || "").trim() || "Type",
        value: selectedValue,
        valueLabel: selectedLabel,
        macroKey: `type_option_${normalizeLooseIssueToken(cfg.optionKey || cfg.optionLabel || "type_option")}`,
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
