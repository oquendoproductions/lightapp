import { fetchIncidentRepairProgressSnapshot } from "./mapIncidentRepairLoaderSupport.js";
import { normalizeDomainKey, normalizeDomainKeyOrSlug } from "./mapReportParsingSupport.js";

const INCIDENT_REPAIR_CONFIRMED_STORAGE_KEY = "cityreport_incident_repair_confirmed_v1";

function incidentRepairConfirmedStorageKeyShared(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  return normalizedTenantKey
    ? `${INCIDENT_REPAIR_CONFIRMED_STORAGE_KEY}:${normalizedTenantKey}`
    : INCIDENT_REPAIR_CONFIRMED_STORAGE_KEY;
}

function normalizePersistedIncidentRepairConfirmedKeyShared(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return "";
  const doubleSepIndex = raw.indexOf("::");
  if (doubleSepIndex > 0) {
    const domainKey = normalizeDomainKeyOrSlug(raw.slice(0, doubleSepIndex), { allowUnknown: true })
      || normalizeDomainKey(raw.slice(0, doubleSepIndex))
      || String(raw.slice(0, doubleSepIndex) || "").trim().toLowerCase();
    const incidentId = String(raw.slice(doubleSepIndex + 2) || "").trim();
    return domainKey && incidentId ? `${domainKey}:${incidentId}` : "";
  }
  const sepIndex = raw.indexOf(":");
  if (sepIndex > 0) {
    const domainKey = normalizeDomainKeyOrSlug(raw.slice(0, sepIndex), { allowUnknown: true })
      || normalizeDomainKey(raw.slice(0, sepIndex))
      || String(raw.slice(0, sepIndex) || "").trim().toLowerCase();
    const incidentId = String(raw.slice(sepIndex + 1) || "").trim();
    return domainKey && incidentId ? `${domainKey}:${incidentId}` : "";
  }
  return "";
}

export function loadPersistedIncidentRepairConfirmedKeysShared(tenantKey) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(incidentRepairConfirmedStorageKeyShared(tenantKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return Array.from(
        new Set(
          parsed
            .map((value) => normalizePersistedIncidentRepairConfirmedKeyShared(value))
            .filter(Boolean),
        ),
      );
    }
    return [];
  } catch {
    return [];
  }
}

export function savePersistedIncidentRepairConfirmedKeysShared(tenantKey, keys = []) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      incidentRepairConfirmedStorageKeyShared(tenantKey),
      JSON.stringify(
        Array.from(
          new Set(
            (Array.isArray(keys) ? keys : [])
              .map((value) => normalizePersistedIncidentRepairConfirmedKeyShared(value))
              .filter(Boolean),
          ),
        ),
      ),
    );
  } catch {
    // ignore cache write failures
  }
}

export async function refreshIncidentRepairProgressShared({
  readClient,
  tenantKey,
  viewerIdentityKey,
  setIncidentRepairProgressByKey,
  setPersistedIncidentRepairConfirmedKeySet,
  savePersistedIncidentRepairConfirmedKeys,
  activeTenantKey,
  setIncidentRepairProgressReadyContextKey,
}) {
  const {
    directConfirmedKeys,
    progressByKey: next,
    requestContextKey,
  } = await fetchIncidentRepairProgressSnapshot({
    readClient,
    tenantKey,
    viewerIdentityKey,
  });

  setIncidentRepairProgressByKey((prev) => {
    const merged = { ...next };
    for (const [key, snapshot] of Object.entries(prev || {})) {
      if (snapshot?.viewerHasRepairSignal !== true) continue;
      merged[key] = {
        ...(merged[key] || snapshot || {}),
        viewerHasRepairSignal: true,
        lastRepairAt: merged[key]?.lastRepairAt || snapshot?.lastRepairAt || null,
        lastMovementAt: merged[key]?.lastMovementAt || snapshot?.lastMovementAt || null,
      };
    }
    for (const key of directConfirmedKeys) {
      merged[key] = {
        ...(merged[key] || {}),
        viewerHasRepairSignal: true,
        lastRepairAt: merged[key]?.lastRepairAt || null,
        lastMovementAt: merged[key]?.lastMovementAt || null,
      };
    }
    return merged;
  });

  if (directConfirmedKeys.size > 0) {
    setPersistedIncidentRepairConfirmedKeySet((prev) => {
      const nextSet = new Set(prev || []);
      let changed = false;
      for (const key of directConfirmedKeys) {
        if (nextSet.has(key)) continue;
        nextSet.add(key);
        changed = true;
      }
      if (changed) {
        savePersistedIncidentRepairConfirmedKeys(activeTenantKey(), Array.from(nextSet));
      }
      return changed ? nextSet : prev;
    });
  }

  setIncidentRepairProgressReadyContextKey(requestContextKey);
}

export async function refreshIncidentRepairProgressRuntimeShared({
  tenantScopedReadClient,
  supabase,
  activeTenantKey,
  viewerIdentityKey,
  identityKey = viewerIdentityKey,
  setIncidentRepairProgressByKey,
  setPersistedIncidentRepairConfirmedKeySet,
  savePersistedIncidentRepairConfirmedKeys,
  setIncidentRepairProgressReadyContextKey,
}) {
  try {
    const readClient = tenantScopedReadClient || supabase;
    const tenantKey = String(activeTenantKey?.() || "").trim().toLowerCase();
    return refreshIncidentRepairProgressShared({
      readClient,
      tenantKey,
      viewerIdentityKey: identityKey,
      setIncidentRepairProgressByKey,
      setPersistedIncidentRepairConfirmedKeySet,
      savePersistedIncidentRepairConfirmedKeys,
      activeTenantKey,
      setIncidentRepairProgressReadyContextKey,
    });
  } catch (error) {
    const msg = String(error?.message || "").toLowerCase();
    if (!(msg.includes("does not exist") || msg.includes("function") || msg.includes("schema cache"))) {
      console.warn("[incident_repair_progress_public] load warning:", error?.message || error);
    }
    setIncidentRepairProgressReadyContextKey("");
    setIncidentRepairProgressByKey({});
  }
}
