import {
  canonicalIncidentDrivenIncidentIdShared,
  incidentDomainResolveLookupValueByModeShared,
  normalizeIncidentDrivenLookupIdShared,
  readIncidentDomainConfiguredCollectionHelperStringShared,
  readIncidentDomainHelperBooleanShared,
  readIncidentDomainHelperStringShared,
  resolveIncidentDomainHelperEntryShared,
} from "./mapIncidentDomainHelperCoreSupport.js";

export function createMapIncidentDomainRuntimeHelpers(deps = {}) {
  const {
    INCIDENT_DOMAIN_HELPERS = {},
    genericIncidentDisplayId = null,
    getIncidentDomainHelper = null,
    isValidLatLng = null,
    lightIdFor = null,
    normalizeDomainKeyOrSlug = null,
  } = deps;

  function resolveIncidentDomainHelperEntry(domainKeyRaw) {
    return resolveIncidentDomainHelperEntryShared(domainKeyRaw, {
      normalizeDomainKeyOrSlug,
      getIncidentDomainHelper,
    });
  }

  function readIncidentDomainHelperString(domainKeyRaw, fieldName, fallback = "") {
    return readIncidentDomainHelperStringShared(domainKeyRaw, fieldName, fallback, {
      normalizeDomainKeyOrSlug,
      getIncidentDomainHelper,
    });
  }

  function readIncidentDomainHelperBoolean(domainKeyRaw, fieldName) {
    return readIncidentDomainHelperBooleanShared(domainKeyRaw, fieldName, {
      normalizeDomainKeyOrSlug,
      getIncidentDomainHelper,
    });
  }

  function readIncidentDomainConfiguredCollectionHelperString(domainKeyRaw, kindRaw, reportsField, seededField) {
    return readIncidentDomainConfiguredCollectionHelperStringShared(
      domainKeyRaw,
      kindRaw,
      reportsField,
      seededField,
      {
        normalizeDomainKeyOrSlug,
        getIncidentDomainHelper,
      }
    );
  }

  function incidentDomainResolveLookupValueByMode(modeRaw, row = null, domainKeyRaw = "") {
    return incidentDomainResolveLookupValueByModeShared(modeRaw, row, domainKeyRaw, {
      getIncidentDomainHelper,
    });
  }

  function lookupIncidentIdForDomain(domainKeyRaw, incidentIdRaw) {
    return normalizeIncidentDrivenLookupIdShared(domainKeyRaw, incidentIdRaw, {
      getIncidentDomainHelper,
      normalizeDomainKeyOrSlug,
    });
  }

  function normalizeIncidentDrivenLookupId(domainKeyRaw, incidentIdRaw) {
    return lookupIncidentIdForDomain(domainKeyRaw, incidentIdRaw);
  }

  function incidentDrivenViewerLookupId(domainKeyRaw, incidentIdRaw) {
    return normalizeIncidentDrivenLookupId(domainKeyRaw, incidentIdRaw);
  }

  function incidentDomainCanonicalIncidentId(domainKeyRaw, row = null, fallbackIncidentIdRaw = "") {
    const canonicalIncidentId = canonicalIncidentDrivenIncidentIdShared(domainKeyRaw, row, fallbackIncidentIdRaw, {
      getIncidentDomainHelper,
      normalizeDomainKeyOrSlug,
    });
    if (canonicalIncidentId) return canonicalIncidentId;
    const lat = Number(row?.lat);
    const lng = Number(row?.lng);
    return Number.isFinite(lat) && Number.isFinite(lng) && typeof lightIdFor === "function"
      ? lightIdFor(lat, lng)
      : "";
  }

  function incidentDomainBuildIncidentRows(domainKeyRaw, context = {}) {
    const resolved = resolveIncidentDomainHelperEntry(domainKeyRaw);
    if (!resolved) return [];
    const helper = resolved.helper || {};
    const reportRows = Array.isArray(context?.reportRows) ? context.reportRows : [];
    if (typeof helper?.buildIncidentRows === "function") {
      return helper.buildIncidentRows(context, resolved) || [];
    }
    const mode = String(helper?.buildIncidentRowsMode || "").trim();
    if (mode === "canonical_incident_rows_from_lookup") {
      const rows = [];
      for (const row of reportRows) {
        const lookupId = incidentDomainResolveLookupValueByMode(
          "incident_or_domain_report_id",
          row,
          resolved.domainKey
        );
        if (!lookupId) continue;
        const incidentId = incidentDomainCanonicalIncidentId(resolved.domainKey, { incident_id: lookupId });
        rows.push({
          ...row,
          domainKey: resolved.domainKey,
          domain: resolved.domainKey,
          incident_id: incidentId,
          light_id: incidentId,
        });
      }
      return rows;
    }
    return reportRows.map((row) => {
      const lat = Number(row?.lat);
      const lng = Number(row?.lng);
      const fallbackIncidentId =
        Number.isFinite(lat) && Number.isFinite(lng) && typeof lightIdFor === "function"
          ? String(lightIdFor(lat, lng) || "").trim()
          : "";
      const incidentId = String(
        row?.incident_id
        || row?.light_id
        || incidentDomainResolveLookupValueByMode(
          "incident_or_domain_report_id",
          row,
          resolved.domainKey
        )
        || fallbackIncidentId
        || ""
      ).trim();
      if (!incidentId) return null;
      return {
        ...row,
        domainKey: resolved.domainKey,
        domain: resolved.domainKey,
        incident_id: incidentId,
        light_id: String(row?.light_id || incidentId).trim() || incidentId,
        ts: Number(row?.ts || 0) || Date.parse(String(row?.created_at || "")) || 0,
      };
    }).filter(Boolean);
  }

  function incidentDomainBuildCoordsDisplayId(domainKeyRaw, { incidentId = "", lat = Number.NaN, lng = Number.NaN } = {}) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : "";
    if (!domainKey || typeof genericIncidentDisplayId !== "function") return "";
    return String(genericIncidentDisplayId(domainKey, Number(lat), Number(lng), String(incidentId || "").trim()) || "").trim();
  }

  return {
    incidentDomainBuildCoordsDisplayId,
    incidentDomainBuildIncidentRows,
    incidentDomainCanonicalIncidentId,
    incidentDomainResolveLookupValueByMode,
    incidentDrivenViewerLookupId,
    lookupIncidentIdForDomain,
    normalizeIncidentDrivenLookupId,
    readIncidentDomainConfiguredCollectionHelperString,
    readIncidentDomainHelperBoolean,
    readIncidentDomainHelperString,
    resolveIncidentDomainHelperEntry,
  };
}
