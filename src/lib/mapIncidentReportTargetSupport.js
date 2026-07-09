export function buildSharedIncidentReportTarget({
  domainKey = "",
  domainLabel = "",
  lat = Number.NaN,
  lng = Number.NaN,
  incidentId = "",
  locationLabel = "",
  nearestAddress = "",
  nearestLandmark = "",
  nearestCrossStreet = "",
  nearestIntersection = "",
  typeValue = "",
  signType = "",
  fromMapTap = undefined,
  domainExplicitlySelected = undefined,
  extra = {},
} = {}) {
  const normalizedDomainKey = String(domainKey || "").trim();
  const resolvedLat = Number(lat);
  const resolvedLng = Number(lng);
  if (!normalizedDomainKey || !Number.isFinite(resolvedLat) || !Number.isFinite(resolvedLng)) {
    return null;
  }
  const fallbackIncidentId = `${normalizedDomainKey}:${resolvedLat.toFixed(5)}:${resolvedLng.toFixed(5)}`;
  const resolvedIncidentId = String(incidentId || "").trim() || fallbackIncidentId;
  return {
    domain: normalizedDomainKey,
    domainLabel: String(domainLabel || "").trim() || "Incident",
    lat: resolvedLat,
    lng: resolvedLng,
    sourceLat: resolvedLat,
    sourceLng: resolvedLng,
    incident_id: resolvedIncidentId,
    lightId: resolvedIncidentId,
    locationLabel: String(locationLabel || "").trim() || `${resolvedLat.toFixed(5)}, ${resolvedLng.toFixed(5)}`,
    nearestAddress: String(nearestAddress || "").trim(),
    nearestLandmark: String(nearestLandmark || "").trim(),
    nearestCrossStreet: String(nearestCrossStreet || "").trim(),
    nearestIntersection: String(nearestIntersection || "").trim(),
    ...(String(typeValue || "").trim() ? { typeValue: String(typeValue || "").trim() } : {}),
    ...(String(signType || "").trim() ? { signType: String(signType || "").trim() } : {}),
    ...(typeof fromMapTap === "boolean" ? { fromMapTap } : {}),
    ...(typeof domainExplicitlySelected === "boolean" ? { domainExplicitlySelected } : {}),
    ...(extra || {}),
  };
}
