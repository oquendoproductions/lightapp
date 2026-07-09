export {
  buildSharedIncidentAuthorizationDisclosures,
  buildSharedIncidentPopupVariantConfig,
  resolveSharedIncidentPopupLocationEnsureMode,
} from "./mapSharedIncidentSupport.js";
export {
  canIdentityReportLight,
  incidentDomainBuildLastFixByIncidentMap,
  incidentDomainIdentityLastFixTs,
  incidentDomainIdentityReportRows,
  incidentDomainMatchesIdentityReportRow,
  isOutageReportType,
  isWorkingReportType,
  normalizeReportQuality,
  normalizeUuidIncidentPersistenceId,
  reportIdentityKey,
  reporterIdentityKey,
  stripCanonicalIncidentPrefix,
} from "./mapIncidentIdentityCoreSupport.js";

export function incidentRepairDisplayState(snapshot) {
  if (snapshot?.archived) return "archived";
  if (snapshot?.likelyFixed) return "likely_resolved";
  return "";
}

export function incidentRepairSummaryText(snapshot, incidentRepairTarget = 5) {
  const repairProgress = Math.max(0, Number(snapshot?.repairProgress || 0));
  const issueScore = Number(snapshot?.issueScore || 0);
  if (snapshot?.archived) return "Archived after 2 weeks with no new activity.";
  if (snapshot?.likelyFixed) {
    return `Community repair confidence reached ${repairProgress}/${incidentRepairTarget}.`;
  }
  if (issueScore < 0) {
    return `Issue score ${issueScore} • repair progress ${repairProgress}/${incidentRepairTarget}.`;
  }
  return `Repair progress ${repairProgress}/${incidentRepairTarget}.`;
}

export function bearingBetween(a, b) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const toDeg = (radians) => (radians * 180) / Math.PI;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lng - a.lng);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function destinationPointMeters(start, distanceMeters, bearingDeg) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const toDeg = (radians) => (radians * 180) / Math.PI;
  const earthRadius = 6378137;

  const distance = Math.max(0, Number(distanceMeters) || 0);
  const bearing = toRad(Number(bearingDeg) || 0);
  const lat1 = toRad(start.lat);
  const lon1 = toRad(start.lng);
  const angDist = distance / earthRadius;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAng = Math.sin(angDist);
  const cosAng = Math.cos(angDist);

  const lat2 = Math.asin(sinLat1 * cosAng + cosLat1 * sinAng * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * sinAng * cosLat1,
    cosAng - sinLat1 * Math.sin(lat2)
  );

  return {
    lat: toDeg(lat2),
    lng: ((toDeg(lon2) + 540) % 360) - 180,
  };
}

export function predictedMovingDisplayPosition(
  position,
  speedMps,
  headingDeg,
  accuracyM,
  fixTimestamp,
  {
    minSpeedMps = 3.2,
    maxSeconds = 1.45,
    maxMeters = 30,
  } = {}
) {
  const lat = Number(position?.lat);
  const lng = Number(position?.lng);
  const speed = Number(speedMps);
  const heading = Number(headingDeg);
  const accuracy = Number(accuracyM);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return position;
  if (!Number.isFinite(speed) || speed < minSpeedMps) return { lat, lng };
  if (!Number.isFinite(heading)) return { lat, lng };
  if (Number.isFinite(accuracy) && accuracy > 35) return { lat, lng };

  const ageSeconds = Number.isFinite(Number(fixTimestamp))
    ? Math.max(0, Math.min(0.9, (Date.now() - Number(fixTimestamp)) / 1000))
    : 0;
  const baseSeconds =
    speed >= 13.4 ? 0.95 :
    speed >= 8.9 ? 0.82 :
    0.62;
  const horizonSeconds = Math.min(maxSeconds, baseSeconds + ageSeconds);
  const accuracyScale = Number.isFinite(accuracy)
    ? Math.max(0.45, Math.min(1, (35 - accuracy) / 22))
    : 0.8;
  const distanceMeters = Math.min(
    maxMeters,
    Math.max(0, speed * horizonSeconds * accuracyScale)
  );
  if (distanceMeters < 2) return { lat, lng };
  return destinationPointMeters({ lat, lng }, distanceMeters, heading);
}
