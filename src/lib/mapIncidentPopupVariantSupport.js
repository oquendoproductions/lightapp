import {
  buildSharedIncidentPopupVariantConfig,
} from "./mapSharedIncidentSupport.js";

export function buildSharedConfiguredIncidentPopupVariantConfig({
  title = "",
  domainIdFallback = "Incident",
  fallbackDisplayId = "",
  issueLabelFallback = "",
  incidentId = "",
  popupInfo = null,
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
  return buildSharedIncidentPopupVariantConfig({
    title,
    domainIdFallback,
    fallbackDisplayId,
    issueLabelFallback,
    incidentId,
    currentState: String(popupInfo?.currentState || "").trim() || (popupInfo?.isFixedNow ? "fixed" : "reported"),
    allowUpdateState,
    clusterReports,
    adminPopupInfoExtra,
    typeOptionDetailsOverride,
    showIssueFallback,
    adminActionExtra,
    allReportsDomainOverride,
    renderAdminExtras,
    adminExtrasDescriptor,
    resident,
  });
}

export function buildSharedIncidentDrivenPopupVariant({
  domainKey = "",
  popupInfo = null,
  marker = null,
  sharedVariantConfig = null,
} = {}) {
  const normalizedDomainKey = String(domainKey || popupInfo?.domainKey || "").trim();
  if (!normalizedDomainKey || !popupInfo || !marker) return null;

  if (sharedVariantConfig) {
    return {
      title: sharedVariantConfig.title,
      domainKey: normalizedDomainKey,
      popupInfo,
      renderModelOptions: {
        domainIdFallback: sharedVariantConfig.domainIdFallback,
        fallbackDisplayId: sharedVariantConfig.fallbackDisplayId,
        typeOptionDetailsOverride: sharedVariantConfig.typeOptionDetailsOverride,
        showIssueFallback: sharedVariantConfig.showIssueFallback,
        issueLabelFallback: sharedVariantConfig.issueLabelFallback,
      },
      adminPopupInfoExtra: sharedVariantConfig.adminPopupInfoExtra,
      adminAction: {
        incidentId: sharedVariantConfig.incidentId,
        currentState: sharedVariantConfig.currentState,
        clusterReports: Array.isArray(sharedVariantConfig.clusterReports) ? sharedVariantConfig.clusterReports : [],
        showAllReports: sharedVariantConfig.showAllReports !== false,
        allReportsDomainOverride: String(
          sharedVariantConfig.allReportsDomainOverride || normalizedDomainKey
        ).trim() || normalizedDomainKey,
        allowUpdateState: sharedVariantConfig.allowUpdateState,
        ...(sharedVariantConfig.adminActionExtra || {}),
      },
      renderAdminExtras: typeof sharedVariantConfig.renderAdminExtras === "function"
        ? sharedVariantConfig.renderAdminExtras
        : undefined,
      adminExtrasDescriptor:
        sharedVariantConfig.adminExtrasDescriptor
        && typeof sharedVariantConfig.adminExtrasDescriptor === "object"
        && !Array.isArray(sharedVariantConfig.adminExtrasDescriptor)
          ? sharedVariantConfig.adminExtrasDescriptor
          : undefined,
      resident: sharedVariantConfig.resident || {
        repairIncidentId: sharedVariantConfig.incidentId,
      },
    };
  }

  const incidentId = String(popupInfo?.incidentId || "").trim();
  return {
    title: popupInfo?.domainLabel,
    domainKey: normalizedDomainKey,
    popupInfo,
    renderModelOptions: {
      domainIdFallback: "Incident",
    },
    adminAction: {
      incidentId,
      currentState: popupInfo?.currentState || (popupInfo?.isFixedNow ? "fixed" : "reported"),
      clusterReports: Array.isArray(popupInfo?.rows) ? popupInfo.rows : [],
      showAllReports: true,
      allowUpdateState: true,
    },
    resident: {
      showActionSpacer: true,
      reportIssue: {},
      repairIncidentId: incidentId,
    },
  };
}
