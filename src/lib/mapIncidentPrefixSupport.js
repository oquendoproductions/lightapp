const INCIDENT_PREFIX_TO_DOMAIN_KEY = Object.freeze({
  pothole: "potholes",
  water_drain_issues: "water_drain_issues",
  street_signs: "street_signs",
  power_outage: "power_outage",
  water_main: "water_main",
});

export function prefixedIncidentDomainKeyShared(incidentIdRaw) {
  const incidentId = String(incidentIdRaw || "").trim();
  if (!incidentId) return "";
  const prefix = String(incidentId.split(":")[0] || "").trim().toLowerCase();
  return INCIDENT_PREFIX_TO_DOMAIN_KEY[prefix] || "";
}
