import {
  BUILT_IN_DOMAIN_DISPLAY_PREFIXES,
  BUILT_IN_DOMAIN_ID_LABELS,
  BUILT_IN_INCIDENT_DISPLAY_ID_PATTERNS,
  REPORT_DOMAIN_OPTIONS,
  ALL_REPORT_DOMAINS_KEY,
  NO_REPORT_DOMAINS_KEY,
  INCIDENT_REPORTING_LAYER_KEY,
  DEFAULT_PUBLIC_DOMAINS,
  normalizeExplicitDomainSelection,
  STREET_SIGN_TYPE_OPTIONS,
  STREET_SIGN_TYPE_VALUES,
  STREET_SIGN_TYPE_ICON_SRC,
  UUID_LIKE_RE,
} from "./mapDomainSelectionConfig.js";

export {
  BUILT_IN_DOMAIN_DISPLAY_PREFIXES,
  BUILT_IN_DOMAIN_ID_LABELS,
  BUILT_IN_INCIDENT_DISPLAY_ID_PATTERNS,
  REPORT_DOMAIN_OPTIONS,
  ALL_REPORT_DOMAINS_KEY,
  NO_REPORT_DOMAINS_KEY,
  INCIDENT_REPORTING_LAYER_KEY,
  DEFAULT_PUBLIC_DOMAINS,
  normalizeExplicitDomainSelection,
  STREET_SIGN_TYPE_OPTIONS,
  STREET_SIGN_TYPE_VALUES,
  STREET_SIGN_TYPE_ICON_SRC,
  UUID_LIKE_RE,
};

export const STREETLIGHT_ISSUE_OPTIONS = [
  { value: "out", label: "Light is out" },
  { value: "flickering", label: "Dim / Flickering" },
  { value: "dayburner", label: "On during daytime" },
  { value: "downed_pole", label: "Pole down" },
  { value: "other", label: "Other" },
];

export const STREET_SIGN_ISSUE_OPTIONS = [
  { value: "damaged", label: "Damaged sign" },
  { value: "missing", label: "Missing sign" },
  { value: "blocked", label: "Obstructed / blocked visibility" },
  { value: "faded", label: "Faded / unreadable" },
  { value: "bent", label: "Bent / leaning" },
  { value: "graffiti", label: "Graffiti / vandalized" },
  { value: "wrong_sign", label: "Wrong sign posted" },
  { value: "other", label: "Other" },
];

export const WATER_DRAIN_ISSUE_OPTIONS = [
  { value: "sewer_backup", label: "Sewer Backup" },
  { value: "storm_drain_clog", label: "Storm Drain Blocked / Flooding" },
];

export const BUILT_IN_DOMAIN_ISSUE_OPTIONS = Object.freeze({
  streetlights: STREETLIGHT_ISSUE_OPTIONS,
  street_signs: STREET_SIGN_ISSUE_OPTIONS,
  water_drain_issues: WATER_DRAIN_ISSUE_OPTIONS,
});

export const BUILT_IN_DOMAIN_TYPE_OPTION_DEFS = Object.freeze({
  street_signs: {
    id: "street_signs_sign_type",
    optionKey: "sign_type",
    optionLabel: "Sign Type",
    choices: STREET_SIGN_TYPE_OPTIONS,
    legacyTaggedAliases: Object.freeze(["Sign Type", "Type"]),
    includeDomainTypeNoteFallback: true,
  },
});

export function defaultDomainIssueFor(domainKey) {
  return String(defaultDomainIssueOptions(domainKey)?.[0]?.value || "").trim().toLowerCase() || "other";
}

export function normalizeDomainTypeOptions(typeOptions) {
  const rows = Array.isArray(typeOptions) ? typeOptions : [];
  const seen = new Set();
  return rows
    .map((row, index) => {
      const value = String(row?.type_key || row?.value || "").trim().toLowerCase();
      const label = String(row?.type_label || row?.label || "").trim();
      if (!value || !label || seen.has(value)) return null;
      seen.add(value);
      return {
        value,
        label,
        sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : (index + 1) * 10,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (
      Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0)
      || String(a?.label || "").localeCompare(String(b?.label || ""))
      || String(a?.value || "").localeCompare(String(b?.value || ""))
    ));
}

export function defaultDomainTypeChoices(domainKey) {
  const definition = BUILT_IN_DOMAIN_TYPE_OPTION_DEFS[String(domainKey || "").trim().toLowerCase()];
  const choices = Array.isArray(definition?.choices) ? definition.choices : [];
  return choices.map((option, index) => ({
    value: String(option?.value || "").trim().toLowerCase(),
    label: String(option?.label || "").trim(),
    sortOrder: (index + 1) * 10,
  }));
}

export function defaultDomainTypeOptionLabel(domainKey = "", index = 0) {
  const definition = BUILT_IN_DOMAIN_TYPE_OPTION_DEFS[String(domainKey || "").trim().toLowerCase()];
  if (index === 0 && String(definition?.optionLabel || "").trim()) return String(definition.optionLabel).trim();
  return `Type Option ${index + 1}`;
}

function normalizeLooseIssueToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function normalizeDomainTypeOptionConfigs(typeOptions, domainKey = "") {
  const rows = Array.isArray(typeOptions) ? typeOptions : [];
  if (!rows.length) return [];
  const looksLegacyFlat = rows.every((row) => (
    row
    && typeof row === "object"
    && !Array.isArray(row?.choices)
    && !Array.isArray(row?.options)
    && !Array.isArray(row?.type_choices)
    && !row?.optionKey
    && !row?.optionLabel
    && (row?.type_key || row?.type_label || row?.label || row?.value)
  ));
  if (looksLegacyFlat) {
    const choices = normalizeDomainTypeOptions(rows);
    const definition = BUILT_IN_DOMAIN_TYPE_OPTION_DEFS[String(domainKey || "").trim().toLowerCase()];
    return choices.length ? [{
      id: `${String(domainKey || "domain").trim().toLowerCase() || "domain"}_type_option_1`,
      optionKey: String(definition?.optionKey || "").trim() || "type_option_1",
      optionLabel: defaultDomainTypeOptionLabel(domainKey, 0),
      choices,
    }] : [];
  }

  return rows.map((row, index) => {
    const optionLabel = String(row?.optionLabel || row?.option_label || row?.label || "").replace(/\s+/g, " ").trim() || defaultDomainTypeOptionLabel(domainKey, index);
    const optionKey = normalizeLooseIssueToken(row?.optionKey || row?.option_key || optionLabel || `type_option_${index + 1}`) || `type_option_${index + 1}`;
    const rawChoices = Array.isArray(row?.choices)
      ? row.choices
      : Array.isArray(row?.options)
        ? row.options
        : Array.isArray(row?.type_choices)
          ? row.type_choices
          : [];
    const choices = normalizeDomainTypeOptions(rawChoices);
    return {
      id: String(row?.id || "").trim() || `${String(domainKey || "domain").trim().toLowerCase() || "domain"}_${optionKey}`,
      optionKey,
      optionLabel,
      choices,
    };
  }).filter((row) => row.optionLabel || row.choices.length);
}

export function defaultDomainTypeOptionConfigs(domainKey) {
  const normalizedDomain = String(domainKey || "").trim().toLowerCase();
  const definition = BUILT_IN_DOMAIN_TYPE_OPTION_DEFS[normalizedDomain];
  if (!definition) return [];
  return [{
    id: String(definition?.id || "").trim() || `${normalizedDomain || "domain"}_type_option_1`,
    optionKey: String(definition?.optionKey || "").trim() || "type_option_1",
    optionLabel: String(definition?.optionLabel || "").trim() || defaultDomainTypeOptionLabel(normalizedDomain, 0),
    choices: defaultDomainTypeChoices(normalizedDomain),
  }];
}

export function isIssueTypeOptionConfig(option) {
  const optionKey = normalizeLooseIssueToken(option?.optionKey || option?.option_key || "");
  const optionLabel = normalizeLooseIssueToken(option?.optionLabel || option?.option_label || option?.label || "");
  return optionKey === "issue_type" || optionLabel === "issue_type";
}

export function buildIssueTypeOptionConfig(domainKey, issueOptions = []) {
  const normalizedIssueOptions = normalizeDomainIssueOptions(issueOptions);
  if (!normalizedIssueOptions.length) return null;
  return {
    id: `${String(domainKey || "domain").trim().toLowerCase() || "domain"}_issue_type`,
    optionKey: "issue_type",
    optionLabel: "Issue Type",
    choices: normalizedIssueOptions.map((option) => ({
      value: option.value,
      label: option.label,
      sortOrder: option.sortOrder,
    })),
  };
}

export function mergeDomainTypeOptionConfigsWithIssueOptions(domainKey, typeOptions = [], issueOptions = []) {
  const normalizedTypeOptions = normalizeDomainTypeOptionConfigs(typeOptions, domainKey);
  const normalizedIssueOptions = normalizeDomainIssueOptions(issueOptions);
  if (!normalizedIssueOptions.length) return normalizedTypeOptions;
  if (normalizedTypeOptions.some((option) => isIssueTypeOptionConfig(option))) return normalizedTypeOptions;
  const issueTypeOption = buildIssueTypeOptionConfig(domainKey, normalizedIssueOptions);
  return issueTypeOption ? [...normalizedTypeOptions, issueTypeOption] : normalizedTypeOptions;
}

export function issueOptionsFromTypeOptionConfig(typeOptionConfig) {
  return normalizeDomainTypeOptions(typeOptionConfig?.choices || []).map((choice, index) => ({
    value: String(choice?.value || "").trim().toLowerCase(),
    label: String(choice?.label || "").trim(),
    sortOrder: Number.isFinite(Number(choice?.sortOrder)) ? Number(choice.sortOrder) : (index + 1) * 10,
  })).filter((choice) => choice.value && choice.label);
}

export function normalizeDomainIssueOptions(issueTypes) {
  const rows = Array.isArray(issueTypes) ? issueTypes : [];
  const seen = new Set();
  return rows
    .map((row, index) => {
      const value = String(row?.issue_key || row?.value || "").trim().toLowerCase();
      const label = String(row?.issue_label || row?.label || "").trim();
      if (!value || !label || seen.has(value)) return null;
      seen.add(value);
      return {
        value,
        label,
        sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : (index + 1) * 10,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (
      Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0)
      || String(a?.label || "").localeCompare(String(b?.label || ""))
      || String(a?.value || "").localeCompare(String(b?.value || ""))
    ));
}

export function defaultDomainIssueOptions(domainKey) {
  const options = BUILT_IN_DOMAIN_ISSUE_OPTIONS[String(domainKey || "").trim().toLowerCase()] || [];
  return options.map((option, index) => ({
    value: String(option?.value || "").trim().toLowerCase(),
    label: String(option?.label || "").trim(),
    sortOrder: (index + 1) * 10,
  }));
}

export function builtInDomainKeysWithIssueOptions() {
  return Object.keys(BUILT_IN_DOMAIN_ISSUE_OPTIONS);
}

export function builtInDomainKeysWithTypeOptionDefaults() {
  return Object.keys(BUILT_IN_DOMAIN_TYPE_OPTION_DEFS || {});
}

export function defaultDomainIssueValue(domainKey, issueOptions = []) {
  const normalizedOptions = normalizeDomainIssueOptions(issueOptions);
  if (normalizedOptions.length) return String(normalizedOptions[0]?.value || "").trim().toLowerCase();
  return defaultDomainIssueFor(domainKey);
}

export function findNormalizedIssueOption(issueValue, issueOptions = []) {
  const normalizedValue = normalizeLooseIssueToken(issueValue);
  return normalizeDomainIssueOptions(issueOptions).find((option) => normalizeLooseIssueToken(option?.value) === normalizedValue) || null;
}
