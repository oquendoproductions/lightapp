import { normalizeDomainKeyOrSlug } from "./mapReportParsingSupport.js";
import {
  DOMAIN_MARKER_GLYPHS,
  DOMAIN_MARKER_ICON_SRCS,
  DOMAIN_REPORT_NUMBER_PREFIXES,
  EMPTY_INCIDENT_DOMAIN_HELPER,
  INCIDENT_DOMAIN_CORE_HELPERS,
  POTHOLE_MERGE_RADIUS_METERS,
} from "./mapIncidentDomainCoreConfig.js";

const INCIDENT_DOMAIN_LAZY_HELPERS = Object.freeze({
  potholes: Object.freeze({
    popupVariantTitle: "Pothole",
    popupVariantDomainIdFallback: "PH0000000000",
    popupVariantIssueLabelFallback: "Pothole",
    popupLocationCompletenessMode: "address_any_detail",
    notesPlaceholder: "Add details (size, lane, nearby landmark)",
    buildMyReportsGroupsMode: "grouped_lookup_reports",
    buildMyReportsGroupsSeededLookupField: "id",
    buildMyReportsGroupsExplicitDisplayFields: Object.freeze(["display_id", "external_id", "ph_id"]),
  }),
  water_drain_issues: Object.freeze({
    popupVariantTitle: "Water / Drain",
    popupVariantDomainIdFallback: "WD0000000000",
    popupVariantIssueLabelFallback: "Water / Drain Issue",
    popupVariantFallbackDisplayIdMode: "coords_hashed_from_incident",
    popupLocationCompletenessMode: "address_any_detail",
    notesPlaceholder: "Add details (depth, lane affected, nearest drain/intersection)",
  }),
  street_signs: Object.freeze({
    notesPlaceholder: "Add details (visibility issue, lane, landmark)",
    popupVariantTitle: "Street Sign",
    popupVariantTitleMode: "popup_domain_label_or_fallback",
    popupVariantDomainIdFallback: "SS0000000000",
    popupVariantTypeOptionDetailsMode: "popup_details_or_marker_field",
    popupVariantTypeOptionFallbackField: "sign_type",
    popupVariantTypeOptionFallbackLabel: "Sign Type",
    popupVariantTypeOptionFallbackFormatMode: "domain_type_option_label",
    popupVariantTypeOptionFallbackOptionKey: "sign_type",
    popupVariantTypeOptionFallbackSkipValues: Object.freeze(["other"]),
    popupVariantResidentShowActionSpacer: true,
    popupVariantResidentShowZoomHintWhenUnreported: true,
    popupVariantResidentReportIssueMode: "marker_type_with_location_label",
    popupVariantResidentReportIssueTypeField: "sign_type",
    popupVariantResidentReportIssueTypeLabelMode: "domain_type_option_label",
    popupVariantResidentReportIssueTypeOptionKey: "sign_type",
    popupLocationCompletenessMode: "address_any_detail",
  }),
});

export const INCIDENT_DOMAIN_HELPERS = Object.freeze(
  Object.fromEntries(
    Object.entries(INCIDENT_DOMAIN_CORE_HELPERS).map(([domainKey, helper]) => [
      domainKey,
      Object.freeze({
        ...helper,
        ...(INCIDENT_DOMAIN_LAZY_HELPERS[domainKey] || {}),
      }),
    ])
  )
);

export function getIncidentDomainHelperShared(domainKeyRaw) {
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return EMPTY_INCIDENT_DOMAIN_HELPER;
  return INCIDENT_DOMAIN_HELPERS[domainKey] || EMPTY_INCIDENT_DOMAIN_HELPER;
}

export function incidentDomainHelperKeysForCapabilityShared(capabilityName) {
  const capability = String(capabilityName || "").trim();
  if (!capability) return [];
  return Object.entries(INCIDENT_DOMAIN_HELPERS)
    .filter(([, helper]) => {
      if (typeof helper?.[capability] === "function") return true;
      if (capability === "buildIncidentRows") {
        return Boolean(String(helper?.buildIncidentRowsMode || "").trim());
      }
      return false;
    })
    .map(([domainKey]) => domainKey);
}

export function incidentDomainHelperKeysForConfiguredFieldShared(fieldName) {
  const field = String(fieldName || "").trim();
  if (!field) return [];
  return Object.entries(INCIDENT_DOMAIN_HELPERS)
    .filter(([, helper]) => {
      const value = helper?.[field];
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object" && value) return Object.keys(value).length > 0;
      return Boolean(String(value || "").trim());
    })
    .map(([domainKey]) => domainKey);
}
