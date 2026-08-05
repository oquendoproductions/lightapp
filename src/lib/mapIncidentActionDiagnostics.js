const STORAGE_KEY = "cityreport.map_incident_action_failures.v1";
const MAX_ENTRIES = 12;

function safeText(value) {
  return String(value || "").trim();
}

function shortHash(value) {
  let hash = 5381;
  for (const char of safeText(value)) hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  return hash.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}

export function recordIncidentActionFailureShared({
  stage = "action",
  tenantKey = "",
  incidentId = "",
  action = "",
  error = null,
} = {}) {
  const errorCode = safeText(error?.code) || "NO_CODE";
  const errorMessage = safeText(error?.message) || "Unknown error";
  const reference = `IA-${shortHash([stage, tenantKey, incidentId, action, errorCode, errorMessage].join("|"))}`;
  const entry = {
    reference,
    at: new Date().toISOString(),
    stage: safeText(stage),
    tenantKey: safeText(tenantKey).toLowerCase(),
    incidentId: safeText(incidentId),
    action: safeText(action),
    errorCode,
    errorMessage,
    errorDetails: safeText(error?.details),
    errorHint: safeText(error?.hint),
  };

  console.error("[incident-action-failure]", entry);
  try {
    const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    const next = [entry, ...(Array.isArray(existing) ? existing : [])].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Diagnostics must never interfere with the action error path.
  }
  return entry;
}

export function incidentActionFailureDisplayTextShared(entry = {}) {
  const code = safeText(entry?.errorCode);
  const message = safeText(entry?.errorMessage).replace(/\s+/g, " ").slice(0, 150);
  return [code, message].filter(Boolean).join(": ");
}
