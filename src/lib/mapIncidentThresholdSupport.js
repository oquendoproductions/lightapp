import { defaultDomainType } from "./domainCatalog";

export function sanitizeIncidentReportThreshold(value, fallback = 2, options = {}) {
  const min = Number.isFinite(Number(options?.min)) ? Number(options.min) : 1;
  const max = Number.isFinite(Number(options?.max)) ? Number(options.max) : 25;
  const resolvedFallback = Math.max(min, Math.min(max, Math.round(Number(fallback || min))));
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return resolvedFallback;
  return Math.max(min, Math.min(max, numeric));
}

export function defaultDomainPublicVisibilityMinReports(domainKey) {
  return defaultDomainType(domainKey) === "incident_driven" ? 2 : 1;
}

export function defaultDomainHighConfidenceMinReports(domainKey) {
  const publicMin = defaultDomainPublicVisibilityMinReports(domainKey);
  return Math.max(publicMin, 4);
}

export function statusFromCount(count) {
  if (count >= 4) return { label: "Confirmed Out", color: "#b71c1c" };
  if (count >= 2) return { label: "Likely Out", color: "#f57c00" };
  return { label: "Reported", color: "#616161" };
}

export function majorityReportType(reports) {
  const counts = new Map();
  for (const report of reports || []) counts.set(report.type, (counts.get(report.type) || 0) + 1);

  let best = null;
  let bestCount = -1;
  for (const [type, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      best = type;
    }
  }
  return best;
}
