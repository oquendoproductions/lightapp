export const INCIDENT_STATE_PUBLIC_LABELS = Object.freeze({
  reported: "Reported",
  aggregated: "Reported",
  confirmed: "Confirmed",
  unconfirmed: "Unconfirmed",
  likely_outage: "Likely outage",
  high_confidence_outage: "High-confidence outage",
  likely_resolved: "Resolved",
  in_progress: "Confirmed",
  fixed: "Resolved",
  reopened: "Reported",
  archived: "Archived",
  operational: "Operational",
});

export const INCIDENT_STATE_ADMIN_LABELS = Object.freeze({
  reported: "Reported",
  aggregated: "Aggregated",
  confirmed: "Confirmed",
  unconfirmed: "Unconfirmed",
  likely_outage: "Likely outage",
  high_confidence_outage: "High-confidence outage",
  likely_resolved: "Likely resolved",
  in_progress: "In Progress",
  fixed: "Fixed",
  reopened: "Reported",
  archived: "Archived",
  operational: "Operational",
});

export const DEFAULT_ADMIN_EDITABLE_INCIDENT_STATES = Object.freeze([
  "reported",
  "unconfirmed",
  "confirmed",
  "in_progress",
  "fixed",
  "archived",
]);

const CLOSED_INCIDENT_STATES = new Set([
  "fixed",
  "archived",
  "likely_resolved",
  "closed",
  "resolved",
  "completed",
  "done",
  "operational",
]);

function normalizeIncidentState(state) {
  return String(state || "").trim().toLowerCase();
}

export function incidentStateLabel(state) {
  const key = normalizeIncidentState(state);
  if (!key) return "";
  return INCIDENT_STATE_PUBLIC_LABELS[key] || key.replace(/_/g, " ");
}

export function adminFacingIncidentStateLabel(state) {
  const key = normalizeIncidentState(state);
  if (!key) return "Reported";
  return INCIDENT_STATE_ADMIN_LABELS[key] || key.replace(/_/g, " ");
}

export function isLifecycleStateOpen(state) {
  const key = normalizeIncidentState(state);
  if (!key) return true;
  return !CLOSED_INCIDENT_STATES.has(key);
}

export function adminIncidentStateOptionsForDomain(currentState, domainKeyRaw = "") {
  const current = normalizeIncidentState(currentState) || "reported";
  const normalizedDomainKey = String(domainKeyRaw || "").trim().toLowerCase();
  if (!normalizedDomainKey) return [];
  return Array.from(
    new Set([current, ...DEFAULT_ADMIN_EDITABLE_INCIDENT_STATES].filter(Boolean))
  );
}
