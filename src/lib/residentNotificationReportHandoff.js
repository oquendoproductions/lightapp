import {
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from "../platform/storage.js";

const HANDOFF_FLAG = "resident_notification_report";
const NATIVE_HANDOFF_STORAGE_KEY = "cityreport.resident_notification_report_handoff.v1";
const NATIVE_HANDOFF_TTL_MS = 2 * 60 * 1000;
const FEED_HANDOFF_FLAG = "resident_notification_feed";
const NATIVE_FEED_HANDOFF_STORAGE_KEY = "cityreport.resident_notification_feed_handoff.v1";
const HANDOFF_KEYS = [
  HANDOFF_FLAG,
  "report_domain",
  "focus_incident_id",
  "incident_state",
  "incident_state_changed_at",
  "reported_by",
];

function safeUrl() {
  if (typeof window === "undefined") return null;
  try {
    return new URL(window.location.href);
  } catch {
    return null;
  }
}

function replaceCurrentUrl(url) {
  if (!url || typeof window === "undefined") return;
  try {
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // The native web view can still switch tenants even if it refuses a
    // history update; the in-memory same-tenant path remains available.
  }
}

export function writeResidentNotificationReportHandoff(target = {}) {
  const url = safeUrl();
  if (!url) return false;
  url.searchParams.set(HANDOFF_FLAG, "1");
  url.searchParams.set("report_domain", String(target?.domainKey || "").trim());
  url.searchParams.set("focus_incident_id", String(target?.focusIncidentId || "").trim());
  url.searchParams.set("incident_state", String(target?.incidentState || "").trim());
  url.searchParams.set("incident_state_changed_at", String(target?.incidentStateChangedAt || "").trim());
  url.searchParams.set("reported_by", "me");
  replaceCurrentUrl(url);
  return true;
}

// A native tenant switch temporarily unmounts the map workspace. Store a
// short-lived, destination-bound handoff so that one intended notification
// action survives that transition without polluting the app URL/history.
export function writeNativeResidentNotificationReportHandoff(target = {}) {
  const focusIncidentId = String(target?.focusIncidentId || "").trim();
  const tenantKey = String(target?.tenantKey || "").trim().toLowerCase();
  if (!focusIncidentId || !tenantKey) return false;
  try {
    writeSessionStorageItem(NATIVE_HANDOFF_STORAGE_KEY, JSON.stringify({
      tenantKey,
      domainKey: String(target?.domainKey || "").trim(),
      focusIncidentId,
      incidentState: String(target?.incidentState || "").trim(),
      incidentStateChangedAt: String(target?.incidentStateChangedAt || "").trim(),
      expiresAt: Date.now() + NATIVE_HANDOFF_TTL_MS,
    }));
    return true;
  } catch {
    return false;
  }
}

export function readResidentNotificationReportHandoff() {
  const url = safeUrl();
  if (url && url.searchParams.get(HANDOFF_FLAG) === "1") {
    const focusIncidentId = String(url.searchParams.get("focus_incident_id") || "").trim();
    if (focusIncidentId) {
      return {
        domainKey: String(url.searchParams.get("report_domain") || "").trim(),
        focusIncidentId,
        incidentState: String(url.searchParams.get("incident_state") || "").trim(),
        incidentStateChangedAt: String(url.searchParams.get("incident_state_changed_at") || "").trim(),
        reportedByMode: "me",
        inViewOnly: false,
        diagnosticSource: "resident-notification",
      };
    }
  }

  try {
    const raw = readSessionStorageItem(NATIVE_HANDOFF_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    if (!stored || Number(stored?.expiresAt || 0) <= Date.now()) {
      removeSessionStorageItem(NATIVE_HANDOFF_STORAGE_KEY);
      return null;
    }
    const focusIncidentId = String(stored?.focusIncidentId || "").trim();
    const tenantKey = String(stored?.tenantKey || "").trim().toLowerCase();
    if (!focusIncidentId || !tenantKey) {
      removeSessionStorageItem(NATIVE_HANDOFF_STORAGE_KEY);
      return null;
    }
    return {
      tenantKey,
      domainKey: String(stored?.domainKey || "").trim(),
      focusIncidentId,
      incidentState: String(stored?.incidentState || "").trim(),
      incidentStateChangedAt: String(stored?.incidentStateChangedAt || "").trim(),
      reportedByMode: "me",
      inViewOnly: false,
      diagnosticSource: "resident-notification",
    };
  } catch {
    removeSessionStorageItem(NATIVE_HANDOFF_STORAGE_KEY);
    return null;
  }
}

export function clearResidentNotificationReportHandoff() {
  const url = safeUrl();
  if (url) {
    for (const key of HANDOFF_KEYS) url.searchParams.delete(key);
    replaceCurrentUrl(url);
  }
  removeSessionStorageItem(NATIVE_HANDOFF_STORAGE_KEY);
}

export function writeResidentNotificationFeedHandoff(target = {}) {
  const url = safeUrl();
  const tenantKey = String(target?.tenantKey || "").trim().toLowerCase();
  const kind = String(target?.kind || "").trim().toLowerCase();
  const itemId = String(target?.itemId || "").trim();
  if (!url || !tenantKey || !itemId || (kind !== "alert" && kind !== "event")) return false;
  url.searchParams.set(FEED_HANDOFF_FLAG, "1");
  url.searchParams.set("notification_tenant", tenantKey);
  url.searchParams.set("notification_kind", kind);
  url.searchParams.set("notification_item_id", itemId);
  replaceCurrentUrl(url);
  return true;
}

export function writeNativeResidentNotificationFeedHandoff(target = {}) {
  const tenantKey = String(target?.tenantKey || "").trim().toLowerCase();
  const kind = String(target?.kind || "").trim().toLowerCase();
  const itemId = String(target?.itemId || "").trim();
  if (!tenantKey || !itemId || (kind !== "alert" && kind !== "event")) return false;
  try {
    writeSessionStorageItem(NATIVE_FEED_HANDOFF_STORAGE_KEY, JSON.stringify({
      tenantKey,
      kind,
      itemId,
      expiresAt: Date.now() + NATIVE_HANDOFF_TTL_MS,
    }));
    return true;
  } catch {
    return false;
  }
}

export function readResidentNotificationFeedHandoff() {
  const url = safeUrl();
  const fromUrl = url && url.searchParams.get(FEED_HANDOFF_FLAG) === "1"
    ? {
      tenantKey: String(url.searchParams.get("notification_tenant") || "").trim().toLowerCase(),
      kind: String(url.searchParams.get("notification_kind") || "").trim().toLowerCase(),
      itemId: String(url.searchParams.get("notification_item_id") || "").trim(),
    }
    : null;
  const validate = (value) => (
    value
    && value.tenantKey
    && value.itemId
    && (value.kind === "alert" || value.kind === "event")
  ) ? value : null;
  const validUrl = validate(fromUrl);
  if (validUrl) return validUrl;

  try {
    const raw = readSessionStorageItem(NATIVE_FEED_HANDOFF_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) : null;
    if (!stored || Number(stored?.expiresAt || 0) <= Date.now()) {
      removeSessionStorageItem(NATIVE_FEED_HANDOFF_STORAGE_KEY);
      return null;
    }
    const validStored = validate({
      tenantKey: String(stored?.tenantKey || "").trim().toLowerCase(),
      kind: String(stored?.kind || "").trim().toLowerCase(),
      itemId: String(stored?.itemId || "").trim(),
    });
    if (!validStored) removeSessionStorageItem(NATIVE_FEED_HANDOFF_STORAGE_KEY);
    return validStored;
  } catch {
    removeSessionStorageItem(NATIVE_FEED_HANDOFF_STORAGE_KEY);
    return null;
  }
}

export function clearResidentNotificationFeedHandoff() {
  const url = safeUrl();
  if (url) {
    for (const key of [FEED_HANDOFF_FLAG, "notification_tenant", "notification_kind", "notification_item_id"]) {
      url.searchParams.delete(key);
    }
    replaceCurrentUrl(url);
  }
  removeSessionStorageItem(NATIVE_FEED_HANDOFF_STORAGE_KEY);
}

export function clearResidentNotificationHandoffs() {
  clearResidentNotificationReportHandoff();
  clearResidentNotificationFeedHandoff();
}
