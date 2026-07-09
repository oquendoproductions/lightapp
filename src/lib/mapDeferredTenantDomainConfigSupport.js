import { defaultDomainType } from "./domainCatalog";
import { defaultHighConfidenceMarkerColorForDomainShared } from "./mapDomainMarkerColorSupport";
import {
  defaultDomainHighConfidenceMinReports,
  defaultDomainPublicVisibilityMinReports,
  sanitizeIncidentReportThreshold,
} from "./mapIncidentThresholdSupport";
import { normalizeDomainKeyOrSlug } from "./mapReportParsingSupport";
import {
  normalizeDomainIconRenderMode,
  normalizeDomainIconTintColor,
  normalizeDomainIconTintMode,
} from "../domainIconRendering";

const TENANT_DOMAIN_CONFIG_CACHE_KEY = "cityreport_tenant_domain_config_v1";

function isExpectedMissingFunctionError(error) {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("function") || msg.includes("schema cache");
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function tenantDomainConfigCacheStorageKeyShared(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  if (!normalizedTenantKey) return "";
  return `${TENANT_DOMAIN_CONFIG_CACHE_KEY}:${normalizedTenantKey}`;
}

export function readCachedTenantDomainConfigSnapshotShared(tenantKey) {
  if (typeof window === "undefined") return null;
  const storageKey = tenantDomainConfigCacheStorageKeyShared(tenantKey);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      domainConfigByDomain:
        parsed.domainConfigByDomain && typeof parsed.domainConfigByDomain === "object"
          ? parsed.domainConfigByDomain
          : {},
      registryIncidentDomains: Array.isArray(parsed.registryIncidentDomains)
        ? parsed.registryIncidentDomains
        : [],
    };
  } catch {
    return null;
  }
}

export function writeCachedTenantDomainConfigSnapshotShared(tenantKey, snapshot) {
  if (typeof window === "undefined") return;
  const storageKey = tenantDomainConfigCacheStorageKeyShared(tenantKey);
  if (!storageKey) return;
  try {
    const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
    window.localStorage.setItem(storageKey, JSON.stringify({
      domainConfigByDomain:
        safeSnapshot.domainConfigByDomain && typeof safeSnapshot.domainConfigByDomain === "object"
          ? safeSnapshot.domainConfigByDomain
          : {},
      registryIncidentDomains: Array.isArray(safeSnapshot.registryIncidentDomains)
        ? safeSnapshot.registryIncidentDomains
        : [],
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}

export function clearRuntimeDomainMetaShared(runtimeDomainMeta) {
  if (!runtimeDomainMeta) return;
  runtimeDomainMeta.domainTypeByDomain.clear();
  runtimeDomainMeta.reportPrefixByDomain.clear();
  runtimeDomainMeta.iconSrcByDomain.clear();
  runtimeDomainMeta.iconRenderModeByDomain.clear();
  runtimeDomainMeta.iconTintModeByDomain.clear();
  runtimeDomainMeta.iconTintColorByDomain.clear();
  runtimeDomainMeta.highConfidenceIconTintModeByDomain.clear();
  runtimeDomainMeta.highConfidenceIconTintColorByDomain.clear();
  runtimeDomainMeta.labelByDomain.clear();
  runtimeDomainMeta.markerColorByDomain.clear();
  runtimeDomainMeta.publicVisibilityMinReportsByDomain.clear();
  runtimeDomainMeta.highConfidenceMinReportsByDomain.clear();
  runtimeDomainMeta.highConfidenceMarkerColorByDomain.clear();
  runtimeDomainMeta.rawIssueTypesByDomain.clear();
  runtimeDomainMeta.rawTypeOptionsByDomain.clear();
  runtimeDomainMeta.issueTypesByDomain.clear();
  runtimeDomainMeta.typeOptionsByDomain.clear();
  runtimeDomainMeta.disclosuresByDomain.clear();
  runtimeDomainMeta.allowReportImagesByDomain.clear();
  runtimeDomainMeta.roadRequiredByDomain.clear();
  runtimeDomainMeta.parkRequiredByDomain.clear();
}

export function normalizeRegistryIncidentDomainRowsShared(rows = [], deps = {}) {
  const runtimeDomainMeta = deps.runtimeDomainMeta;
  clearRuntimeDomainMetaShared(runtimeDomainMeta);
  const normalizedRows = [];
  for (const row of rows || []) {
    const domainKey = deps.normalizeDomainKeyOrSlug(row?.domain_key || row?.key, { allowUnknown: true });
    if (!domainKey) continue;
    const reportPrefix = String(row?.report_prefix || "").trim().toUpperCase();
    const label = String(row?.label || domainKey).trim() || domainKey;
    const iconSrc = deps.resolveRuntimeDomainIconSrc(domainKey, row?.icon_src, row?.icon_key);
    const iconRenderMode = normalizeDomainIconRenderMode(row?.icon_render_mode, iconSrc);
    const iconTintMode = normalizeDomainIconTintMode(row?.icon_tint_mode);
    const iconTintColor = normalizeDomainIconTintColor(row?.icon_tint_color, "");
    const highConfidenceIconTintMode = normalizeDomainIconTintMode(
      row?.high_confidence_icon_tint_mode ?? row?.icon_tint_mode,
    );
    const highConfidenceIconTintColor = normalizeDomainIconTintColor(
      row?.high_confidence_icon_tint_color,
      row?.icon_tint_color || "",
    );
    const markerColor = String(row?.marker_color || "").trim();
    const highConfidenceMarkerColor = String(row?.high_confidence_marker_color || "").trim();
    const domainType = String(row?.domain_type || "").trim().toLowerCase() || defaultDomainType(domainKey);

    runtimeDomainMeta.domainTypeByDomain.set(domainKey, domainType);
    if (reportPrefix) runtimeDomainMeta.reportPrefixByDomain.set(domainKey, reportPrefix);
    if (iconSrc) runtimeDomainMeta.iconSrcByDomain.set(domainKey, iconSrc);
    if (iconRenderMode) runtimeDomainMeta.iconRenderModeByDomain.set(domainKey, iconRenderMode);
    if (iconTintMode) runtimeDomainMeta.iconTintModeByDomain.set(domainKey, iconTintMode);
    if (iconTintColor) runtimeDomainMeta.iconTintColorByDomain.set(domainKey, iconTintColor);
    if (highConfidenceIconTintMode) {
      runtimeDomainMeta.highConfidenceIconTintModeByDomain.set(domainKey, highConfidenceIconTintMode);
    }
    if (highConfidenceIconTintColor) {
      runtimeDomainMeta.highConfidenceIconTintColorByDomain.set(domainKey, highConfidenceIconTintColor);
    }
    runtimeDomainMeta.labelByDomain.set(domainKey, label);
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(markerColor)) {
      runtimeDomainMeta.markerColorByDomain.set(domainKey, markerColor);
    }
    if (Number.isFinite(Number(row?.public_visibility_min_reports))) {
      runtimeDomainMeta.publicVisibilityMinReportsByDomain.set(
        domainKey,
        Number(row.public_visibility_min_reports),
      );
    }
    if (Number.isFinite(Number(row?.high_confidence_min_reports))) {
      runtimeDomainMeta.highConfidenceMinReportsByDomain.set(
        domainKey,
        Number(row.high_confidence_min_reports),
      );
    }
    if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(highConfidenceMarkerColor)) {
      runtimeDomainMeta.highConfidenceMarkerColorByDomain.set(domainKey, highConfidenceMarkerColor);
    }
    runtimeDomainMeta.rawIssueTypesByDomain.set(domainKey, Array.isArray(row?.issue_types) ? row.issue_types : []);
    runtimeDomainMeta.rawTypeOptionsByDomain.set(domainKey, Array.isArray(row?.type_options) ? row.type_options : []);
    runtimeDomainMeta.disclosuresByDomain.set(domainKey, row?.report_disclosures ?? null);
    if (typeof row?.allow_report_images === "boolean") {
      runtimeDomainMeta.allowReportImagesByDomain.set(domainKey, row.allow_report_images === true);
    }
    if (typeof row?.road_required === "boolean") {
      runtimeDomainMeta.roadRequiredByDomain.set(domainKey, row.road_required === true);
    }
    if (typeof row?.park_required === "boolean") {
      runtimeDomainMeta.parkRequiredByDomain.set(domainKey, row.park_required === true);
    }

    normalizedRows.push({
      domain_key: domainKey,
      label,
      icon_key: String(row?.icon_key || "").trim(),
      icon_src: iconSrc,
      icon_render_mode: iconRenderMode,
      icon_tint_mode: iconTintMode,
      icon_tint_color: iconTintColor,
      high_confidence_icon_tint_mode: highConfidenceIconTintMode,
      high_confidence_icon_tint_color: highConfidenceIconTintColor,
      report_prefix: reportPrefix,
      marker_color: markerColor,
      allow_report_images: row?.allow_report_images === true,
      road_required: row?.road_required === true,
      park_required: row?.park_required === true,
    });
  }
  return normalizedRows;
}

export async function loadTenantDomainConfigSnapshotShared({
  tenantReady,
  tenantKey,
  readClient,
  fetchTenantDomainPublicConfig,
  fetchTenantAssignedDomainsRobust,
  fetchTenantRegistryIncidentDomains,
  defaultRoadRequiredForDomain,
}) {
  if (tenantReady === false) return null;

  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  let legacyRows = [];
  let assignedRows = [];

  for (let loadAttempt = 0; loadAttempt < 3; loadAttempt += 1) {
    const [legacyRowsRaw, assignedRowsRaw] = await Promise.all([
      fetchTenantDomainPublicConfig(readClient),
      fetchTenantAssignedDomainsRobust(normalizedTenantKey, readClient).catch(async (error) => {
        if (isExpectedMissingFunctionError(error)) {
          try {
            return await fetchTenantRegistryIncidentDomains(readClient);
          } catch (registryError) {
            if (!isExpectedMissingFunctionError(registryError)) {
              console.warn("[tenant_registry_incident_domains_public] load warning:", registryError?.message || registryError);
            }
            return [];
          }
        }
        if (!isExpectedMissingFunctionError(error)) {
          console.warn("[tenant_assigned_domains_public] load warning:", error?.message || error);
        }
        return [];
      }),
    ]);

    legacyRows = Array.isArray(legacyRowsRaw) ? legacyRowsRaw : [];
    assignedRows = Array.isArray(assignedRowsRaw) ? assignedRowsRaw : [];

    if (assignedRows.length || !normalizedTenantKey || loadAttempt >= 2) break;
    await delay(300 * (loadAttempt + 1));
  }

  const legacyNext = {};
  for (const row of legacyRows) {
    const domainKey = String(row?.domain || "").trim().toLowerCase();
    if (!domainKey) continue;
    const publicVisibilityMin = sanitizeIncidentReportThreshold(
      row?.public_visibility_min_reports,
      defaultDomainPublicVisibilityMinReports(domainKey)
    );
    legacyNext[domainKey] = {
      domain_type: String(row?.domain_type || "").trim().toLowerCase() || defaultDomainType(domainKey),
      organization_monitored_repairs: row?.organization_monitored_repairs === true,
      road_required: defaultRoadRequiredForDomain(domainKey),
      park_required: false,
      public_visibility_min_reports: publicVisibilityMin,
      high_confidence_min_reports: sanitizeIncidentReportThreshold(
        row?.high_confidence_min_reports,
        defaultDomainHighConfidenceMinReports(domainKey),
        { min: publicVisibilityMin }
      ),
      high_confidence_marker_color: String(row?.high_confidence_marker_color || "").trim(),
    };
  }

  const assignedNext = {};
  for (const row of assignedRows) {
    const domainKey = normalizeDomainKeyOrSlug(row?.domain_key || row?.key, { allowUnknown: true });
    if (!domainKey) continue;
    const legacyConfig = legacyNext[domainKey] || {};
    const assignedPublicVisibilityMin = sanitizeIncidentReportThreshold(
      row?.public_visibility_min_reports,
      legacyConfig?.public_visibility_min_reports ?? defaultDomainPublicVisibilityMinReports(domainKey)
    );
    assignedNext[domainKey] = {
      domain_type: String(row?.domain_type || "").trim().toLowerCase() || defaultDomainType(domainKey),
      organization_monitored_repairs: row?.organization_monitored_repairs === true,
      road_required: row?.road_required === true,
      park_required: row?.park_required === true,
      public_visibility_min_reports: assignedPublicVisibilityMin,
      high_confidence_min_reports: sanitizeIncidentReportThreshold(
        row?.high_confidence_min_reports ?? legacyConfig?.high_confidence_min_reports,
        defaultDomainHighConfidenceMinReports(domainKey),
        { min: assignedPublicVisibilityMin }
      ),
      high_confidence_marker_color:
        String(row?.high_confidence_marker_color || "").trim()
        || String(legacyConfig?.high_confidence_marker_color || "").trim()
        || defaultHighConfidenceMarkerColorForDomainShared(domainKey),
    };
  }

  const registryIncidentDomains = assignedRows
    .map((row) => {
      const domainKey = normalizeDomainKeyOrSlug(row?.domain_key || row?.key, { allowUnknown: true });
      if (!domainKey) return null;
      return {
        ...row,
        domain_key: domainKey,
        public_visibility_min_reports: assignedNext[domainKey]?.public_visibility_min_reports,
        high_confidence_min_reports: assignedNext[domainKey]?.high_confidence_min_reports,
        high_confidence_marker_color: assignedNext[domainKey]?.high_confidence_marker_color,
      };
    })
    .filter(Boolean);

  if (registryIncidentDomains.length) {
    return {
      domainConfigByDomain: assignedNext,
      registryIncidentDomains,
    };
  }

  return {
    domainConfigByDomain: legacyNext,
    registryIncidentDomains: [],
  };
}

export async function refreshTenantDomainPublicConfigShared({
  tenantReady,
  tenantKey,
  readClient,
  fetchTenantDomainPublicConfig,
  fetchTenantAssignedDomainsRobust,
  fetchTenantRegistryIncidentDomains,
  defaultRoadRequiredForDomain,
  applyTenantDomainConfigSnapshot,
  writeCachedTenantDomainConfigSnapshot,
  shouldCancel,
}) {
  if (tenantReady === false) return;
  try {
    const snapshot = await loadTenantDomainConfigSnapshotShared({
      tenantReady,
      tenantKey,
      readClient,
      fetchTenantDomainPublicConfig,
      fetchTenantAssignedDomainsRobust,
      fetchTenantRegistryIncidentDomains,
      defaultRoadRequiredForDomain,
    });
    if (typeof shouldCancel === "function" && shouldCancel()) return;
    if (!snapshot) return;
    applyTenantDomainConfigSnapshot(snapshot, { loaded: true });
    writeCachedTenantDomainConfigSnapshot(tenantKey, snapshot);
  } catch (error) {
    if (!isExpectedMissingFunctionError(error)) {
      console.warn("[tenant_domain_public_config] load warning:", error?.message || error);
    }
    if (typeof shouldCancel === "function" && shouldCancel()) return;
    const emptySnapshot = {
      domainConfigByDomain: {},
      registryIncidentDomains: [],
    };
    applyTenantDomainConfigSnapshot(emptySnapshot, { loaded: true });
    if (tenantKey) {
      writeCachedTenantDomainConfigSnapshot(tenantKey, emptySnapshot);
    }
  }
}
