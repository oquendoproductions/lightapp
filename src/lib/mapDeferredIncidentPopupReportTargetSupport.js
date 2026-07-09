import { buildSharedIncidentReportTarget } from "./mapIncidentReportTargetSupport.js";

export function buildIncidentPopupReportTargetShared({
  domainKey = "",
  popupInfo = null,
  marker = null,
  typeValue = "",
  signType = "",
  extra = {},
  resolveReportDomainLabel = null,
} = {}) {
  const normalizedDomainKey = String(domainKey || popupInfo?.domainKey || "").trim();
  const lat = Number(marker?.lat);
  const lng = Number(marker?.lng);
  if (!normalizedDomainKey || !popupInfo) return null;
  return buildSharedIncidentReportTarget({
    domainKey: normalizedDomainKey,
    domainLabel: typeof resolveReportDomainLabel === "function"
      ? (String(resolveReportDomainLabel(normalizedDomainKey, "Incident")).trim() || "Incident")
      : "Incident",
    lat,
    lng,
    incidentId: String(popupInfo?.incidentId || marker?.incident_id || marker?.id || "").trim(),
    locationLabel:
      String(popupInfo?.locationLabel || "").trim()
      || String(popupInfo?.nearestAddress || "").trim()
      || String(popupInfo?.coordsText || "").trim(),
    nearestAddress: String(popupInfo?.nearestAddress || "").trim(),
    nearestLandmark: String(popupInfo?.nearestLandmark || "").trim(),
    nearestCrossStreet: String(popupInfo?.nearestCrossStreet || "").trim(),
    nearestIntersection: String(popupInfo?.nearestIntersection || "").trim(),
    typeValue,
    signType,
    extra,
  });
}
