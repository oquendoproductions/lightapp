import {
  BUILT_IN_DOMAIN_OPTIONS,
  DEFAULT_PUBLIC_DOMAIN_KEYS,
} from "./domainCatalog";

export const REPORT_DOMAIN_OPTIONS = BUILT_IN_DOMAIN_OPTIONS;
export const ALL_REPORT_DOMAINS_KEY = "__all__";
export const NO_REPORT_DOMAINS_KEY = "__none__";
export const INCIDENT_REPORTING_LAYER_KEY = "incident_reporting";
export const DEFAULT_PUBLIC_DOMAINS = new Set(DEFAULT_PUBLIC_DOMAIN_KEYS);

export function normalizeExplicitDomainSelection(keysRaw, allowedKeysRaw = []) {
  const includeNoneSelection = Array.isArray(keysRaw)
    && keysRaw.some((key) => String(key || "").trim() === NO_REPORT_DOMAINS_KEY);
  const allowedKeys = Array.isArray(allowedKeysRaw)
    ? allowedKeysRaw.map((key) => String(key || "").trim()).filter(Boolean)
    : [];
  const allowedSet = new Set(allowedKeys);
  const next = Array.isArray(keysRaw)
    ? keysRaw
        .map((key) => String(key || "").trim())
        .filter((key) => key && allowedSet.has(key))
    : [];
  const unique = Array.from(new Set(next));
  if (includeNoneSelection) return [NO_REPORT_DOMAINS_KEY];
  if (!allowedKeys.length || unique.length >= allowedKeys.length) return [];
  return unique;
}

export const STREET_SIGN_TYPE_OPTIONS = [
  { value: "stop", label: "Stop" },
  { value: "yield", label: "Yield" },
  { value: "speed_limit", label: "Speed limit" },
  { value: "warning", label: "Warning" },
  { value: "no_parking", label: "No parking" },
  { value: "one_way", label: "One way" },
  { value: "school_zone", label: "School zone" },
  { value: "crosswalk", label: "Crosswalk" },
  { value: "street_name", label: "Street name" },
  { value: "other", label: "Other" },
];

export const STREET_SIGN_TYPE_VALUES = new Set(
  STREET_SIGN_TYPE_OPTIONS.map((opt) => String(opt.value || "").trim().toLowerCase())
);

export const STREET_SIGN_TYPE_ICON_SRC = {
  stop: "/street_sign_icons/stop_sign_icon.png",
  yield: "/street_sign_icons/yield_sign_icon.png",
  speed_limit: "/street_sign_icons/speed_limit_sign.png",
  warning: "/street_sign_icons/warning_sign_icon.png",
  no_parking: "/street_sign_icons/no_parking_icon.png",
  one_way: "/street_sign_icons/one_way_icon.png",
  school_zone: "/street_sign_icons/school_zone_icon.png",
  crosswalk: "/street_sign_icons/crosswalk_icon.png",
  street_name: "/street_sign_icons/street_name_sign_icon.png",
  other: "/street_sign_icons/street_sign_domain_icon.png",
};

export const BUILT_IN_DOMAIN_ID_LABELS = Object.freeze({
  streetlights: "Streetlight ID",
  street_signs: "Street Sign ID",
  potholes: "Pothole ID",
  water_drain_issues: "Water / Drain ID",
  power_outage: "Power Outage ID",
  water_main: "Water Main ID",
});

export const BUILT_IN_DOMAIN_DISPLAY_PREFIXES = Object.freeze({
  streetlights: "SL",
  street_signs: "SS",
  potholes: "PH",
  water_drain_issues: "WD",
  power_outage: "PO",
  water_main: "WM",
});

export const BUILT_IN_INCIDENT_DISPLAY_ID_PATTERNS = Object.freeze({
  street_signs: /^SS[0-9A-Z]+$/i,
  potholes: /^PH\d{10}$/i,
  water_drain_issues: /^WD[0-9A-Z]+$/i,
});

export const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
