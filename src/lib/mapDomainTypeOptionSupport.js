import {
  mergeDomainTypeOptionConfigsWithIssueOptions,
  normalizeDomainTypeOptions,
} from "./mapDomainConfigSupport.js";

export const REPORT_TYPES = {
  out: "Light is out",
  flickering: "Dim / Flickering",
  dayburner: "On during daytime",
  downed_pole: "Pole down",
  sewer_backup: "Sewer Backup",
  storm_drain_clog: "Storm Drain Blocked / Flooding",
  other: "Other",
};

export function normalizeLooseIssueToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function isIssueTypeOptionConfig(option) {
  const optionKey = normalizeLooseIssueToken(option?.optionKey || option?.option_key || "");
  const optionLabel = normalizeLooseIssueToken(option?.optionLabel || option?.option_label || option?.label || "");
  return optionKey === "issue_type" || optionLabel === "issue_type";
}

export function getIssueTypeOptionConfig(domainKey, typeOptions = [], issueOptions = []) {
  const mergedOptions = mergeDomainTypeOptionConfigsWithIssueOptions(domainKey, typeOptions, issueOptions);
  return mergedOptions.find((option) => isIssueTypeOptionConfig(option)) || null;
}

export function readTaggedValueFromNote(note, labels = []) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  for (const label of Array.isArray(labels) ? labels : []) {
    const escaped = String(label || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!escaped) continue;
    const match = raw.match(new RegExp(`(?:^|\\s)${escaped}:\\s*([^|]+?)(?:\\s*\\||$)`, "i"));
    if (match) return String(match[1] || "").trim();
  }
  return "";
}

export function readIssueTypeFromNote(note) {
  return readTaggedValueFromNote(note, ["Issue Type", "Water issue", "Sign issue"]);
}

export function readDomainTypeFromNote(note) {
  return readTaggedValueFromNote(note, ["Type", "Sign type"]);
}

export function findNormalizedTypeOption(typeValue, typeOptions = []) {
  const normalizedValue = normalizeLooseIssueToken(typeValue);
  return normalizeDomainTypeOptions(typeOptions).find((option) => (
    normalizeLooseIssueToken(option?.value) === normalizedValue
    || normalizeLooseIssueToken(option?.label) === normalizedValue
  )) || null;
}

export function resolveDomainTypeSelectionLabel(selectionValue, typeOptionConfig) {
  const matched = findNormalizedTypeOption(selectionValue, typeOptionConfig?.choices || []);
  return String(matched?.label || "").trim();
}
