import { normalizeDomainKey } from "./mapReportParsingCoreSupport.js";

export function incidentSnapshotKey(domain, incidentId) {
  const normalizedDomain = normalizeDomainKey(domain) || String(domain || "").trim().toLowerCase();
  const normalizedIncidentId = String(incidentId || "").trim();
  if (!(normalizedDomain && normalizedIncidentId)) return "";
  return `${normalizedDomain}:${normalizedIncidentId}`;
}

export function resolveIncidentRepairSnapshotShared(
  domain,
  incidentId,
  {
    incidentRepairProgressByKey = {},
    persistedIncidentRepairConfirmedKeySet = new Set(),
  } = {}
) {
  const key = incidentSnapshotKey(domain, incidentId);
  if (!key) return null;

  const directHit = incidentRepairProgressByKey?.[key] || null;
  const persistedHit = persistedIncidentRepairConfirmedKeySet?.has?.(key);
  if (directHit && !persistedHit) return directHit;
  if (directHit && persistedHit) {
    return {
      ...directHit,
      viewerHasRepairSignal: true,
    };
  }
  if (persistedHit) {
    return {
      viewerHasRepairSignal: true,
      lastRepairAt: null,
      lastMovementAt: null,
    };
  }

  const fallbackStreetlightsKey = incidentSnapshotKey("streetlights", incidentId);
  if (fallbackStreetlightsKey && fallbackStreetlightsKey !== key) {
    const legacyHit = incidentRepairProgressByKey?.[fallbackStreetlightsKey] || null;
    if (legacyHit) return legacyHit;
    if (persistedIncidentRepairConfirmedKeySet?.has?.(fallbackStreetlightsKey)) {
      return {
        viewerHasRepairSignal: true,
        lastRepairAt: null,
        lastMovementAt: null,
      };
    }
  }

  const persistedIncidentSuffix = `:${String(incidentId || "").trim()}`;
  for (const candidateKey of persistedIncidentRepairConfirmedKeySet || []) {
    if (String(candidateKey || "").endsWith(persistedIncidentSuffix)) {
      return {
        viewerHasRepairSignal: true,
        lastRepairAt: null,
        lastMovementAt: null,
      };
    }
  }

  for (const [candidateKey, value] of Object.entries(incidentRepairProgressByKey || {})) {
    if (String(candidateKey || "").endsWith(`:${String(incidentId || "").trim()}`)) {
      return value || null;
    }
  }

  return null;
}
