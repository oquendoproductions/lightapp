import {
  bearingBetween,
  canIdentityReportLight,
  predictedMovingDisplayPosition,
} from "./mapIncidentIdentitySupport.js";
import { prefixedIncidentDomainKeyShared } from "./mapIncidentPrefixSupport.js";

export const bearingBetweenShared = bearingBetween;
export const predictedMovingDisplayPositionShared = predictedMovingDisplayPosition;

export function buildCanIdentityReportLightRuntimeShared({
  normalizeIncidentDrivenLookupId,
  getIncidentDomainHelper,
} = {}) {
  return (lightId, options = {}) => canIdentityReportLight(lightId, {
    ...options,
    prefixedIncidentDomainKey: prefixedIncidentDomainKeyShared,
    normalizeIncidentDrivenLookupId,
    getIncidentDomainHelper,
  });
}
