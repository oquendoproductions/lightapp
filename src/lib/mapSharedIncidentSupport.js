export function resolveSharedIncidentPopupLocationEnsureMode({
  helperMode = "",
  popupInfo = null,
  marker = null,
} = {}) {
  const normalizedHelperMode = String(helperMode || "").trim();
  if (normalizedHelperMode) return normalizedHelperMode;
  if (!popupInfo || !marker) return "";
  if (popupInfo?.locationPending || Boolean(marker?._geoLocationPending)) return "";
  return "generic";
}

export function buildSharedIncidentPopupVariantConfig({
  title = "",
  domainIdFallback = "Incident",
  fallbackDisplayId = "",
  issueLabelFallback = "",
  incidentId = "",
  currentState = "",
  isFixedNow = false,
  allowUpdateState = false,
  clusterReports = [],
  adminPopupInfoExtra = undefined,
  typeOptionDetailsOverride = undefined,
  showIssueFallback = true,
  adminActionExtra = undefined,
  allReportsDomainOverride = "",
  renderAdminExtras = undefined,
  adminExtrasDescriptor = undefined,
  resident = undefined,
} = {}) {
  const config = {
    title: String(title || "").trim() || "Incident",
    domainIdFallback: String(domainIdFallback || "").trim() || "Incident",
    fallbackDisplayId: String(fallbackDisplayId || "").trim(),
    typeOptionDetailsOverride: Array.isArray(typeOptionDetailsOverride) ? typeOptionDetailsOverride : undefined,
    showIssueFallback: showIssueFallback !== false,
    issueLabelFallback: String(issueLabelFallback || "").trim(),
    incidentId: String(incidentId || "").trim(),
    currentState: String(currentState || "").trim() || (isFixedNow ? "fixed" : "reported"),
    allowUpdateState: Boolean(allowUpdateState),
    clusterReports: Array.isArray(clusterReports) ? clusterReports : [],
    adminPopupInfoExtra,
  };
  if (adminActionExtra && typeof adminActionExtra === "object") {
    config.adminActionExtra = adminActionExtra;
  }
  const normalizedAllReportsDomainOverride = String(allReportsDomainOverride || "").trim();
  if (normalizedAllReportsDomainOverride) {
    config.allReportsDomainOverride = normalizedAllReportsDomainOverride;
  }
  if (typeof renderAdminExtras === "function") {
    config.renderAdminExtras = renderAdminExtras;
  }
  if (adminExtrasDescriptor && typeof adminExtrasDescriptor === "object" && !Array.isArray(adminExtrasDescriptor)) {
    config.adminExtrasDescriptor = adminExtrasDescriptor;
  }
  if (resident && typeof resident === "object") {
    config.resident = resident;
  }
  return config;
}

export function buildSharedIncidentAuthorizationDisclosures({
  authorizationId = "",
  authorizationTitle = "Authorization to submit",
  authorizationBody = "",
  baseDisclosures = [],
  extraBefore = [],
} = {}) {
  return [
    ...(Array.isArray(extraBefore) ? extraBefore : []),
    {
      id: String(authorizationId || "").trim(),
      title: String(authorizationTitle || "").trim() || "Authorization to submit",
      body: String(authorizationBody || "").trim(),
      required_acknowledgement: true,
      display_position: "inside_form",
    },
    ...(Array.isArray(baseDisclosures) ? baseDisclosures : []),
  ];
}
