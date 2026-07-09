import { makeCoordsHashedDisplayIdFromIncidentId } from "./mapIncidentDisplayIdHashSupport.js";
import { summarizeIssueTypes } from "./mapPopupTypeDetailSupport.jsx";

export function buildIncidentDrivenPopupVariantShared({
  domainKey = "",
  popupInfo = null,
  marker = null,
  mappingMode = false,
  isAdmin = false,
  prefersDarkMode = false,
  onDeleteOfficialSign = null,
  getIncidentDomainHelper = null,
  formatConfiguredPopupDetailValue = null,
  buildSharedConfiguredIncidentPopupVariantConfig = null,
  buildSharedIncidentDrivenPopupVariant = null,
} = {}) {
  if (
    typeof buildSharedConfiguredIncidentPopupVariantConfig !== "function"
    || typeof buildSharedIncidentDrivenPopupVariant !== "function"
  ) return null;
  const normalizedDomainKey = String(domainKey || popupInfo?.domainKey || "").trim();
  if (!normalizedDomainKey || !popupInfo || !marker) return null;

  const helper = typeof getIncidentDomainHelper === "function"
    ? (getIncidentDomainHelper(normalizedDomainKey) || {})
    : {};
  const popupContext = {
    popupInfo,
    marker,
    mappingMode,
    isAdmin,
    prefersDarkMode,
    onDeleteOfficialSign,
  };
  const popupVariantTitleMode = String(helper?.popupVariantTitleMode || "").trim();
  const popupVariantTitle = typeof helper?.popupVariantTitleBuilder === "function"
    ? String(helper.popupVariantTitleBuilder(popupContext) || "").trim()
    : popupVariantTitleMode === "popup_domain_label_or_fallback"
      ? String(popupInfo?.domainLabel || helper?.popupVariantTitle || "").trim()
      : String(helper?.popupVariantTitle || "").trim();
  if (!popupVariantTitle) return null;

  const fallbackDisplayIdMode = String(helper?.popupVariantFallbackDisplayIdMode || "").trim();
  let fallbackDisplayId = "";
  if (fallbackDisplayIdMode === "coords_hashed_from_incident") {
    fallbackDisplayId = makeCoordsHashedDisplayIdFromIncidentId(
      String(helper?.reportNumberPrefix || "").trim(),
      String(popupInfo?.incidentId || marker?.id || "").trim(),
      String(helper?.popupVariantDomainIdFallback || "").trim()
    );
  }
  const incidentId = String(
    popupInfo?.incidentId
    || marker?.incident_id
    || marker?.id
    || ""
  ).trim();
  const allowUpdateState = Number(popupInfo?.openCount || 0) > 0 || Boolean(popupInfo?.isFixedNow);
  const clusterReports = Array.isArray(marker?.rows) ? marker.rows : [];
  const popupVariantTypeOptionDetailsMode = String(helper?.popupVariantTypeOptionDetailsMode || "").trim();
  const typeOptionDetailsOverride = typeof helper?.popupVariantTypeOptionDetailsBuilder === "function"
    ? helper.popupVariantTypeOptionDetailsBuilder(popupContext)
    : popupVariantTypeOptionDetailsMode === "popup_details_or_marker_field"
      ? (() => {
          const typeDetails = Array.isArray(popupInfo?.typeOptionDetails) ? popupInfo.typeOptionDetails : [];
          const fallbackField = String(helper?.popupVariantTypeOptionFallbackField || "").trim();
          const fallbackLabel = String(helper?.popupVariantTypeOptionFallbackLabel || "").trim();
          const fallbackFormatMode = String(helper?.popupVariantTypeOptionFallbackFormatMode || "").trim();
          const skipValues = Array.isArray(helper?.popupVariantTypeOptionFallbackSkipValues)
            ? helper.popupVariantTypeOptionFallbackSkipValues.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
            : [];
          const rawFallbackValue = fallbackField ? String(marker?.[fallbackField] || "").trim() : "";
          const normalizedFallbackValue = rawFallbackValue.toLowerCase();
          if (typeDetails.length) return typeDetails;
          if (!rawFallbackValue || skipValues.includes(normalizedFallbackValue)) return [];
          return [{
            key: fallbackField || "type",
            label: fallbackLabel || "Type",
            valueLabel: typeof formatConfiguredPopupDetailValue === "function"
              ? formatConfiguredPopupDetailValue(rawFallbackValue, fallbackFormatMode, {
                  domainKey: normalizedDomainKey,
                  optionKey: String(helper?.popupVariantTypeOptionFallbackOptionKey || fallbackField || "").trim(),
                })
              : rawFallbackValue,
          }];
        })()
      : undefined;
  const popupVariantAdminActionExtraFieldNames = Array.isArray(helper?.popupVariantAdminActionExtraFieldNames)
    ? helper.popupVariantAdminActionExtraFieldNames.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
    : [];
  const adminActionExtra = typeof helper?.popupVariantAdminActionExtraBuilder === "function"
    ? helper.popupVariantAdminActionExtraBuilder(popupContext)
    : popupVariantAdminActionExtraFieldNames.length
      ? popupVariantAdminActionExtraFieldNames.reduce((acc, fieldName) => {
          acc[fieldName] = marker?.[fieldName];
          return acc;
        }, {})
      : undefined;
  const popupVariantRenderAdminExtrasMode = String(helper?.popupVariantRenderAdminExtrasMode || "").trim();
  const adminExtrasDescriptor = popupVariantRenderAdminExtrasMode === "mapped_asset_delete_button"
    ? (() => {
        const deleteTargetField = String(helper?.popupVariantRenderAdminExtrasTargetIdField || "id").trim();
        const visibleWhenField = String(helper?.popupVariantRenderAdminExtrasVisibleWhenField || "").trim();
        const actionLabel = String(helper?.popupVariantRenderAdminExtrasActionLabel || "Delete asset").trim();
        const targetId = String(marker?.[deleteTargetField] || "").trim();
        const isVisible = !visibleWhenField || Boolean(marker?.[visibleWhenField]);
        if (!(mappingMode && isAdmin && isVisible && targetId)) return undefined;
        return {
          mode: "mapped_asset_delete_button",
          targetId,
          actionLabel,
        };
      })()
    : undefined;
  const residentRepairIncidentId = incidentId || undefined;
  const popupVariantResidentReportIssueMode = String(helper?.popupVariantResidentReportIssueMode || "").trim();
  const residentReportIssue = typeof helper?.popupVariantResidentReportIssueBuilder === "function"
    ? helper.popupVariantResidentReportIssueBuilder(popupContext)
    : popupVariantResidentReportIssueMode === "marker_type_with_location_label"
      ? (() => {
          const typeField = String(helper?.popupVariantResidentReportIssueTypeField || "").trim();
          const rawTypeValue = typeField ? String(marker?.[typeField] || "").trim() : "";
          const typeValue = rawTypeValue.toLowerCase();
          const typeLabel = typeof formatConfiguredPopupDetailValue === "function"
            ? formatConfiguredPopupDetailValue(
                rawTypeValue,
                String(helper?.popupVariantResidentReportIssueTypeLabelMode || "").trim(),
                {
                  domainKey: normalizedDomainKey,
                  optionKey: String(
                    helper?.popupVariantResidentReportIssueTypeOptionKey
                    || helper?.popupVariantResidentReportIssueTypeField
                    || ""
                  ).trim(),
                }
              )
            : rawTypeValue;
          const fallbackLocationLabel = String(popupInfo?.locationLabel || "").trim()
            || String(popupInfo?.coordsText || "").trim()
            || `${typeLabel} • ${Number(marker?.lat).toFixed(5)}, ${Number(marker?.lng).toFixed(5)}`;
          return {
            typeValue,
            signType: typeLabel,
            extraTarget: {
              locationLabel: fallbackLocationLabel,
            },
          };
        })()
      : undefined;
  const resident = (
    helper?.popupVariantResidentShowActionSpacer
    || helper?.popupVariantResidentShowZoomHintWhenUnreported
    || residentRepairIncidentId
    || residentReportIssue
  )
    ? {
        ...(helper?.popupVariantResidentShowActionSpacer ? { showActionSpacer: true } : {}),
        ...(helper?.popupVariantResidentShowZoomHintWhenUnreported ? { showZoomHintWhenUnreported: true } : {}),
        ...(residentRepairIncidentId ? { repairIncidentId: residentRepairIncidentId } : {}),
        ...(residentReportIssue ? { reportIssue: residentReportIssue } : {}),
      }
    : undefined;

  const sharedVariantConfig = buildSharedConfiguredIncidentPopupVariantConfig({
    title: popupVariantTitle,
    domainIdFallback: String(helper?.popupVariantDomainIdFallback || "").trim() || "Incident",
    fallbackDisplayId,
    typeOptionDetailsOverride,
    issueLabelFallback: String(helper?.popupVariantIssueLabelFallback || "").trim(),
    incidentId,
    popupInfo,
    allowUpdateState,
    clusterReports,
    adminPopupInfoExtra: undefined,
    adminActionExtra,
    adminExtrasDescriptor,
    resident,
  });
  return buildSharedIncidentDrivenPopupVariant({
    domainKey: normalizedDomainKey,
    popupInfo,
    marker,
    sharedVariantConfig,
  });
}

export function buildIncidentPopupRenderModelShared({
  popupInfo = null,
  marker = null,
  domainIdFallback = "Incident",
  fallbackDisplayId = "",
  issueLabelFallback = "",
  typeOptionDetailsOverride,
  showIssueFallback = true,
  isPlatformAdmin = false,
} = {}) {
  const lat = Number(marker?.lat);
  const lng = Number(marker?.lng);
  const coordsText = String(popupInfo?.coordsText || "").trim()
    || (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Unavailable");
  const displayId = String(popupInfo?.displayId || "").trim()
    || String(fallbackDisplayId || "").trim()
    || domainIdFallback;
  const nearestAddress = String(popupInfo?.nearestAddress || "").trim()
    || String(popupInfo?.locationDisplay || "").trim()
    || "Unavailable";
  const locationDisplay = String(popupInfo?.locationDisplay || "").trim()
    || nearestAddress
    || "Unavailable";
  const locationCopyValue = popupInfo?.locationPending
    ? "Resolving nearest address..."
    : nearestAddress;
  const nearestLandmark = String(popupInfo?.nearestLandmark || "").trim() || "Unavailable";
  const issueLabel = String(popupInfo?.issueLabel || "").trim() || issueLabelFallback;
  const typeOptionDetails = Array.isArray(typeOptionDetailsOverride)
    ? typeOptionDetailsOverride
    : (Array.isArray(popupInfo?.typeOptionDetails) ? popupInfo.typeOptionDetails : []);
  const normalizedPopupInfo = {
    ...(popupInfo || {}),
    displayId,
    nearestAddress,
    locationDisplay,
    coordsText,
  };

  return {
    displayId,
    coordsText,
    nearestAddress,
    locationDisplay,
    locationCopyValue,
    nearestLandmark,
    issueLabel,
    typeOptionDetails,
    currentState: String(popupInfo?.currentState || "").trim() || "reported",
    adminDetailsProps: {
      domainIdFallback,
      popupInfo: normalizedPopupInfo,
      currentState: String(popupInfo?.currentState || "").trim() || "reported",
      issueTypes: summarizeIssueTypes(typeOptionDetails, issueLabel) || issueLabel || "Unavailable",
      location: nearestAddress,
      landmark: nearestLandmark,
      coordinates: coordsText,
    },
    residentDetailsProps: {
      domainIdFallback: displayId || domainIdFallback,
      popupInfo: normalizedPopupInfo,
      issueLabel,
      typeOptionDetails,
      showIssueFallback,
      coordinates: coordsText,
      currentState: String(popupInfo?.currentState || "").trim() || "reported",
      showCoordinates: isPlatformAdmin,
    },
  };
}
