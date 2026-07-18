import { RUNTIME_UI_ICON_SRC as UI_ICON_SRC } from "../mapUiIconRuntimeCoreSupport.js";
import { normalizeDomainKeyOrSlug } from "./mapReportParsingCoreSupport.js";

export const POTHOLE_MERGE_RADIUS_METERS = 22;

export const EMPTY_INCIDENT_DOMAIN_HELPER = Object.freeze({});

export const DOMAIN_REPORT_NUMBER_PREFIXES = Object.freeze({
  potholes: "PH",
  street_signs: "SS",
  water_drain_issues: "WD",
  power_outage: "PO",
  water_main: "WM",
  streetlights: "SL",
});

export const DOMAIN_MARKER_ICON_SRCS = Object.freeze({
  potholes: UI_ICON_SRC.pothole,
  street_signs: UI_ICON_SRC.streetSign,
  water_drain_issues: UI_ICON_SRC.waterMain,
  streetlights: UI_ICON_SRC.streetlight,
});

export const DOMAIN_MARKER_GLYPHS = Object.freeze({
  potholes: "\u{1F573}\uFE0F",
  water_drain_issues: "\u{1F4A7}",
  streetlights: "\u{1F4A1}",
});

export const INCIDENT_DOMAIN_STARTUP_HELPERS = Object.freeze({
  potholes: Object.freeze({
    requiresConfiguredRuntime: true,
    roadRequiredDefault: true,
    suppressesGlyph: true,
    specializedMarkerCollectionCoversGenericRows: true,
    fixTsMode: "incident_map",
    markerIconTextY: 15.3,
    markerIconTextSize: 14.5,
    markerIconHideFallbackGlyphWhenSourcePresent: true,
    buildIncidentRowsMode: "canonical_incident_rows_from_lookup",
  }),
  water_drain_issues: Object.freeze({
    requiresConfiguredRuntime: true,
    suppressesGlyph: true,
    specializedMarkerCollectionCoversGenericRows: true,
    persistedRecordStateSourceTable: "water_drain_incidents",
  }),
  street_signs: Object.freeze({
    requiresConfiguredRuntime: true,
    markerGlyphMode: "option_type_glyph",
    usesMappedCenter: true,
    adminMappingQueueVariant: "official_sign",
    mappedAssetUnitLabel: "Sign",
  }),
  power_outage: EMPTY_INCIDENT_DOMAIN_HELPER,
  water_main: EMPTY_INCIDENT_DOMAIN_HELPER,
  streetlights: EMPTY_INCIDENT_DOMAIN_HELPER,
});

export function getIncidentDomainStartupHelperShared(domainKeyRaw) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return EMPTY_INCIDENT_DOMAIN_HELPER;
  return INCIDENT_DOMAIN_STARTUP_HELPERS[domainKey] || EMPTY_INCIDENT_DOMAIN_HELPER;
}

export function incidentDomainStartupHelperKeysForConfiguredFieldShared(fieldName) {
  const field = String(fieldName || "").trim();
  if (!field) return [];
  return Object.entries(INCIDENT_DOMAIN_STARTUP_HELPERS)
    .filter(([, helper]) => {
      const value = helper?.[field];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value) return Object.keys(value).length > 0;
      return Boolean(String(value || "").trim());
    })
    .map(([domainKey]) => domainKey);
}
