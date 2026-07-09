import { DEFAULT_UI_ICON_SRC } from "../mapUiIconRuntimeCoreSupport.js";

export const BUILT_IN_DOMAIN_OPTIONS = Object.freeze([
  { key: "streetlights", label: "Streetlights (Utility-owned)", adminLabel: "Streetlights", icon: "💡", iconSrc: DEFAULT_UI_ICON_SRC.streetlight, enabled: true, domainType: "asset_backed", aggregationStrategy: "asset_based" },
  { key: "street_signs", label: "Street Signs", icon: "🪧", iconSrc: DEFAULT_UI_ICON_SRC.streetSign, enabled: true, aggregationStrategy: "generic_incident" },
  { key: "potholes", label: "Potholes", icon: "🕳️", iconSrc: "/icon-concepts-v4/domain/potholes_domain_icon_v4.svg", enabled: true, aggregationStrategy: "proximity_based" },
  { key: "water_drain_issues", label: "Water / Drain Issues", adminLabel: "Water / Drain", icon: "💧", iconSrc: "/icon-concepts-v4/domain/storm_drain_domain_icon_v4.svg", enabled: true, aggregationStrategy: "generic_incident" },
  { key: "power_outage", label: "Power Outage", icon: "⚡", iconSrc: DEFAULT_UI_ICON_SRC.powerOutage, enabled: true, aggregationStrategy: "area_based" },
  { key: "water_main", label: "Water Main", icon: "🚰", iconSrc: DEFAULT_UI_ICON_SRC.waterMain, enabled: true, aggregationStrategy: "severity_based" },
  { key: "downed_tree", label: "Downed Tree", icon: "🌳", iconSrc: "/icon-concepts-v4/domain/downed_tree_domain_icon_v4.svg", enabled: true, aggregationStrategy: "generic_incident" },
  { key: "encampment", label: "Encampment", icon: "⛺", iconSrc: "/icon-concepts-v4/domain/encampment_domain_icon_v4.svg", enabled: true, aggregationStrategy: "generic_incident" },
  { key: "illegal_dumping", label: "Illegal Dumping", icon: "🗑️", iconSrc: "/icon-concepts-v4/domain/dumping_domain_icon_v4.svg", enabled: true, aggregationStrategy: "generic_incident" },
  { key: "graffiti", label: "Graffiti", icon: "🎨", iconSrc: "/icon-concepts-v4/domain/graffiti_domain_icon_v4.svg", enabled: true, aggregationStrategy: "generic_incident" },
  { key: "park_equipment", label: "Park Equipment", icon: "🪑", iconSrc: DEFAULT_UI_ICON_SRC.incidentReportingLayer, enabled: true, aggregationStrategy: "generic_incident" },
]);

export const DEFAULT_PUBLIC_DOMAIN_KEYS = Object.freeze([
  "potholes",
  "water_drain_issues",
  "streetlights",
  "street_signs",
]);

export function defaultDomainType(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  return BUILT_IN_DOMAIN_OPTIONS.find((option) => option.key === key)?.domainType || "incident_driven";
}

export function resolveDomainType(domainKey, domainTypeRaw) {
  const configuredType = String(domainTypeRaw || "").trim().toLowerCase();
  if (configuredType) return configuredType;
  return defaultDomainType(domainKey);
}

export function isIncidentDrivenDomainType(domainKey, domainTypeRaw) {
  return resolveDomainType(domainKey, domainTypeRaw) !== "asset_backed";
}

export function isAssetBackedDomainType(domainKey, domainTypeRaw) {
  return resolveDomainType(domainKey, domainTypeRaw) === "asset_backed";
}

export function defaultDomainAggregationStrategy(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  return BUILT_IN_DOMAIN_OPTIONS.find((option) => option.key === key)?.aggregationStrategy || "generic_incident";
}

export function resolveDomainAggregationStrategy(domainKey, domainTypeRaw) {
  const domainType = resolveDomainType(domainKey, domainTypeRaw);
  if (domainType === "asset_backed") return "asset_based";
  return defaultDomainAggregationStrategy(domainKey);
}
