import { formattedIncidentDisplayIdShared } from "./mapIncidentDisplaySupport.js";
import { uniqueLightIdsForClusterShared } from "./mapIncidentClusterSupport.js";

export function buildIncidentAllReportsModalPayloadShared({
  popupInfo = null,
  marker = null,
  domainKey = "",
  selectedDomainMarker = null,
  adminReportDomain = "",
  actionsByLightId = {},
  incidentIssueStateByDomain = null,
  slIdByUuid = {},
}, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    getIncidentDisplaySupportDeps,
  } = deps;
  const m = marker || selectedDomainMarker;
  const normalizedDomainKey = String(
    normalizeDomainKeyOrSlug?.(
      domainKey || popupInfo?.domainKey || m?.domain || adminReportDomain,
      { allowUnknown: true }
    )
    || popupInfo?.domainKey
    || domainKey
    || m?.domain
    || adminReportDomain
    || ""
  ).trim();
  const incidentId = String(popupInfo?.incidentId || m?.incident_id || m?.id || "").trim();
  if (!normalizedDomainKey || !incidentId || !popupInfo) return null;

  const reportRows = Array.isArray(popupInfo?.rows)
    ? [...popupInfo.rows].sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))
    : [];
  const fixActionIds = Array.from(new Set([
    incidentId,
    ...(Array.isArray(popupInfo?.incidentIds) ? popupInfo.incidentIds : []),
    ...uniqueLightIdsForClusterShared({ lightId: incidentId, reports: reportRows }),
  ].map((id) => String(id || "").trim()).filter(Boolean)));
  const fixActionRows = fixActionIds
    .flatMap((id) => (actionsByLightId?.[id] || []))
    .filter((action) => {
      const kind = String(action?.action || "").trim().toLowerCase();
      return kind === "fix" || kind === "reopen";
    })
    .map((action) => ({
      action: action.action,
      ts: Number(action.ts || 0),
      note: action.note || null,
      actor_user_id: action.actor_user_id || null,
      actor_name: action.actor_name || null,
      actor_email: action.actor_email || null,
      actor_phone: action.actor_phone || null,
    }))
    .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
  const issueStateByIncident = incidentIssueStateByDomain?.get?.(normalizedDomainKey) || {};
  const displayId = String(popupInfo?.displayId || m?.display_id || incidentId).trim() || incidentId;
  const fallbackLat = Number.isFinite(Number(m?.lat))
    ? Number(m.lat)
    : Number(reportRows?.[0]?.lat);
  const fallbackLng = Number.isFinite(Number(m?.lng))
    ? Number(m.lng)
    : Number(reportRows?.[0]?.lng);

  const incidentDisplaySupportDeps = typeof getIncidentDisplaySupportDeps === "function"
    ? getIncidentDisplaySupportDeps()
    : {};

  return {
    title: `${formattedIncidentDisplayIdShared(
      normalizedDomainKey,
      incidentId,
      Number.isFinite(fallbackLat) && Number.isFinite(fallbackLng)
        ? { lat: fallbackLat, lng: fallbackLng }
        : null,
      displayId,
      slIdByUuid,
      incidentDisplaySupportDeps
    ) || String(incidentId || "").trim() || "Incident"} Reports`,
    items: [],
    options: {
      incidentKey: `${normalizedDomainKey}:${incidentId}`,
      domainKey: normalizedDomainKey,
      reportRows,
      fixActionRows,
      issueStateByIncident,
      sharedLocation: String(popupInfo?.locationLabel || "").trim(),
      sharedAddress: String(popupInfo?.nearestAddress || "").trim(),
      sharedCrossStreet: String(popupInfo?.nearestCrossStreet || "").trim(),
      sharedLandmark: String(popupInfo?.nearestLandmark || "").trim(),
      sharedCoordinates: String(popupInfo?.coordsText || "").trim(),
      currentState: String(popupInfo?.currentState || "").trim(),
      lastChangedAt: String(popupInfo?.lastChangedAt || "").trim(),
    },
  };
}
