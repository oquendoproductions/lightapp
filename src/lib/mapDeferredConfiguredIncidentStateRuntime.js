export function createDeferredConfiguredIncidentStateRuntimeHelpers(deps = {}) {
  const {
    INCIDENT_DOMAIN_HELPERS = {},
    getIncidentDomainHelper = null,
    isValidLatLng = null,
    normalizeDomainKeyOrSlug = null,
    readIncidentDomainConfiguredCollectionHelperString = null,
    readIncidentDomainHelperString = null,
    resolveIncidentDomainHelperEntry = null,
  } = deps;

  function incidentDomainConfiguredSourceTable(domainKeyRaw, kindRaw = "seeded") {
    return readIncidentDomainConfiguredCollectionHelperString?.(
      domainKeyRaw,
      kindRaw,
      "reportsSourceTable",
      "seededSourceTable"
    ) || "";
  }

  function incidentDomainConfiguredRealtimeChannel(domainKeyRaw, kindRaw = "seeded") {
    return readIncidentDomainConfiguredCollectionHelperString?.(
      domainKeyRaw,
      kindRaw,
      "reportsRealtimeChannel",
      "seededRealtimeChannel"
    ) || "";
  }

  function incidentDomainConfiguredSelectFields(domainKeyRaw, kindRaw = "seeded") {
    return readIncidentDomainConfiguredCollectionHelperString?.(
      domainKeyRaw,
      kindRaw,
      "reportsSelectFields",
      "seededSelectFields"
    ) || "";
  }

  function incidentDomainConfiguredStaticFilters(domainKeyRaw, kindRaw = "seeded") {
    const resolved = resolveIncidentDomainHelperEntry?.(domainKeyRaw);
    if (!resolved) return [];
    const kind = String(kindRaw || "seeded").trim().toLowerCase();
    const filters = kind === "reports"
      ? resolved.helper?.reportsStaticFilters
      : resolved.helper?.seededStaticFilters;
    if (!Array.isArray(filters)) return [];
    return filters
      .map((filter) => {
        const field = String(filter?.field || "").trim();
        if (!field) return null;
        return { field, value: filter?.value };
      })
      .filter(Boolean);
  }

  function incidentDomainConfiguredLookupField(domainKeyRaw, kindRaw = "seeded") {
    return readIncidentDomainConfiguredCollectionHelperString?.(
      domainKeyRaw,
      kindRaw,
      "reportsLookupField",
      "seededLookupField"
    ) || "";
  }

  function incidentDomainConfiguredPersistedRecordStateTable(domainKeyRaw) {
    return readIncidentDomainHelperString?.(domainKeyRaw, "persistedRecordStateSourceTable") || "";
  }

  function incidentDomainConfiguredPersistedRecordStateSelectFields(domainKeyRaw) {
    return readIncidentDomainHelperString?.(domainKeyRaw, "persistedRecordStateSelectFields") || "";
  }

  function incidentDomainConfiguredPersistedRecordStateRealtimeChannel(domainKeyRaw) {
    return readIncidentDomainHelperString?.(domainKeyRaw, "persistedRecordStateRealtimeChannel") || "";
  }

  function incidentDomainConfiguredPersistedRecordStateOrderField(domainKeyRaw) {
    return readIncidentDomainHelperString?.(domainKeyRaw, "persistedRecordStateOrderField", "updated_at") || "updated_at";
  }

  function incidentDomainConfiguredPersistedRecordStateDomains() {
    return Object.keys(INCIDENT_DOMAIN_HELPERS).filter((domainKey) => (
      Boolean(incidentDomainConfiguredPersistedRecordStateTable(domainKey))
    ));
  }

  function incidentDomainNormalizePersistedRecordStateRow(domainKeyRaw, row = null) {
    const resolved = resolveIncidentDomainHelperEntry?.(domainKeyRaw);
    if (!resolved || !row || typeof row !== "object") return null;
    const incidentIdField = String(resolved.helper?.persistedRecordStateIncidentIdField || "incident_id").trim();
    const incidentId = String(row?.[incidentIdField] || row?.incident_id || "").trim();
    if (!incidentId) return null;
    const recordIdField = String(resolved.helper?.applyPersistedLocationCacheStateRecordIdField || "").trim();
    const issueTypeField = String(resolved.helper?.applyPersistedLocationCacheStateIssueTypeField || "").trim();
    const addressField = String(resolved.helper?.applyPersistedLocationCacheStateAddressField || "").trim();
    const crossStreetField = String(resolved.helper?.applyPersistedLocationCacheStateCrossStreetField || "").trim();
    const intersectionField = String(resolved.helper?.applyPersistedLocationCacheStateIntersectionField || "").trim();
    const landmarkField = String(resolved.helper?.applyPersistedLocationCacheStateLandmarkField || "").trim();
    return {
      incident_id: incidentId,
      ...(recordIdField ? { [recordIdField]: String(row?.[recordIdField] || "").trim() } : {}),
      ...(issueTypeField ? { [issueTypeField]: String(row?.[issueTypeField] || "").trim().toLowerCase() } : {}),
      lat: Number(row?.lat),
      lng: Number(row?.lng),
      ...(addressField ? { [addressField]: String(row?.[addressField] || "").trim() } : {}),
      ...(crossStreetField ? { [crossStreetField]: String(row?.[crossStreetField] || "").trim() } : {}),
      ...(intersectionField ? { [intersectionField]: String(row?.[intersectionField] || "").trim() } : {}),
      ...(landmarkField ? { [landmarkField]: String(row?.[landmarkField] || "").trim() } : {}),
      geo_updated_at: row?.geo_updated_at || null,
      updated_at: row?.updated_at || null,
    };
  }

  function incidentDomainNormalizeConfiguredSeededRecord(domainKeyRaw, row = null) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : "";
    if (!domainKey) return null;
    const helper = typeof getIncidentDomainHelper === "function" ? getIncidentDomainHelper(domainKey) : {};
    if (typeof helper?.normalizeSeededRecord === "function") {
      return helper.normalizeSeededRecord(row, { domainKey, helper }) ?? null;
    }
    if (String(helper?.normalizeSeededRecordMode || "").trim() === "seeded_record_with_external_display") {
      const incidentId = String(row?.id || "").trim();
      const externalIdField = String(helper?.normalizeSeededRecordExternalIdField || "").trim();
      const externalDisplayFields = Array.isArray(helper?.normalizeSeededRecordExternalDisplayFields)
        ? helper.normalizeSeededRecordExternalDisplayFields.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
        : [];
      const externalId = String(row?.[externalIdField] || "").trim() || null;
      const normalized = {
        id: row?.id,
        incident_id: incidentId || null,
        ...(externalIdField ? { [externalIdField]: externalId } : {}),
        external_id: externalId,
        display_id: externalDisplayFields.length
          ? (externalDisplayFields.map((fieldName) => String(row?.[fieldName] || "").trim()).find(Boolean) || externalId)
          : externalId,
        domain: domainKey,
        domain_key: domainKey,
        lat: Number(row?.lat),
        lng: Number(row?.lng),
        location_label: String(row?.location_label || "").trim() || null,
        nearest_address: String(row?.nearest_address || "").trim() || "",
        nearest_cross_street: String(row?.nearest_cross_street || "").trim() || "",
        nearest_landmark: String(row?.nearest_landmark || "").trim() || "",
      };
      return normalized.id && (
        typeof isValidLatLng === "function"
          ? isValidLatLng(normalized.lat, normalized.lng)
          : (Number.isFinite(normalized.lat) && Number.isFinite(normalized.lng))
      ) ? normalized : null;
    }
    return row;
  }

  function incidentDomainNormalizeConfiguredReportRecord(domainKeyRaw, row = null) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : "";
    if (!domainKey) return null;
    const helper = typeof getIncidentDomainHelper === "function" ? getIncidentDomainHelper(domainKey) : {};
    if (typeof helper?.normalizeReportRecord === "function") {
      return helper.normalizeReportRecord(row, { domainKey, helper }) ?? null;
    }
    if (String(helper?.normalizeReportRecordMode || "").trim() === "report_record_with_lookup_ts") {
      const incidentIdField = String(helper?.normalizeReportRecordIncidentIdField || "").trim();
      const incidentId = String(row?.[incidentIdField] || "").trim() || null;
      return {
        id: row?.id,
        incident_id: incidentId,
        ...(incidentIdField ? { [incidentIdField]: incidentId } : {}),
        domain: domainKey,
        domain_key: domainKey,
        lat: Number(row?.lat),
        lng: Number(row?.lng),
        note: row?.note || "",
        report_number: row?.report_number || null,
        ts: Date.parse(String(row?.created_at || "")) || 0,
        reporter_user_id: row?.reporter_user_id || null,
        reporter_name: row?.reporter_name || null,
        reporter_phone: row?.reporter_phone || null,
        reporter_email: row?.reporter_email || null,
      };
    }
    return row;
  }

  function incidentDomainRemoveConfiguredRecordById(prevRows = [], recordIdRaw = "") {
    const recordId = String(recordIdRaw || "").trim();
    if (!recordId) return Array.isArray(prevRows) ? prevRows : [];
    return (Array.isArray(prevRows) ? prevRows : []).filter((row) => String(row?.id || "").trim() !== recordId);
  }

  function incidentDomainUpsertConfiguredSeededState(domainKeyRaw, prevRows = [], row = null) {
    const incoming = incidentDomainNormalizeConfiguredSeededRecord(domainKeyRaw, row);
    if (!incoming?.id) return Array.isArray(prevRows) ? prevRows : [];
    const next = Array.isArray(prevRows) ? [...prevRows] : [];
    const idx = next.findIndex((item) => String(item?.id || "").trim() === String(incoming.id || "").trim());
    if (idx >= 0) next[idx] = { ...next[idx], ...incoming };
    else next.push(incoming);
    return next;
  }

  function incidentDomainPrependConfiguredReportState(domainKeyRaw, prevRows = [], row = null) {
    const incoming = incidentDomainNormalizeConfiguredReportRecord(domainKeyRaw, row);
    if (!incoming?.id) return Array.isArray(prevRows) ? prevRows : [];
    const current = Array.isArray(prevRows) ? prevRows : [];
    if (current.some((item) => String(item?.id || "").trim() === String(incoming.id || "").trim())) return current;
    return [incoming, ...current];
  }

  function normalizeCachedConfiguredIncidentRowsByDomainShared(rowsByDomain, kind = "seeded") {
    if (!rowsByDomain || typeof rowsByDomain !== "object") return {};
    const next = {};
    for (const [domainKeyRaw, rows] of Object.entries(rowsByDomain)) {
      const domainKey = typeof normalizeDomainKeyOrSlug === "function"
        ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
        : "";
      if (!domainKey || !Array.isArray(rows)) continue;
      const normalizedRows = rows
        .map((row) => (
          kind === "reports"
            ? incidentDomainNormalizeConfiguredReportRecord(domainKey, row)
            : incidentDomainNormalizeConfiguredSeededRecord(domainKey, row)
        ))
        .filter(Boolean);
      if (!normalizedRows.length) continue;
      next[domainKey] = normalizedRows;
    }
    return next;
  }

  function normalizeCachedPersistedIncidentRecordStateByDomainShared(value) {
    if (!value || typeof value !== "object") return {};
    const next = {};
    for (const [domainKeyRaw, records] of Object.entries(value)) {
      const domainKey = typeof normalizeDomainKeyOrSlug === "function"
        ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
        : "";
      if (!domainKey || !records || typeof records !== "object") continue;
      const nextDomainRecords = {};
      for (const [incidentIdRaw, row] of Object.entries(records)) {
        const normalizedRow = incidentDomainNormalizePersistedRecordStateRow(domainKey, row);
        const incidentId = String(normalizedRow?.incident_id || incidentIdRaw || "").trim();
        if (!incidentId || !normalizedRow) continue;
        nextDomainRecords[incidentId] = normalizedRow;
      }
      if (Object.keys(nextDomainRecords).length) {
        next[domainKey] = nextDomainRecords;
      }
    }
    return next;
  }

  return {
    incidentDomainConfiguredLookupField,
    incidentDomainConfiguredPersistedRecordStateDomains,
    incidentDomainConfiguredPersistedRecordStateOrderField,
    incidentDomainConfiguredPersistedRecordStateRealtimeChannel,
    incidentDomainConfiguredPersistedRecordStateSelectFields,
    incidentDomainConfiguredPersistedRecordStateTable,
    incidentDomainConfiguredRealtimeChannel,
    incidentDomainConfiguredSelectFields,
    incidentDomainConfiguredSourceTable,
    incidentDomainConfiguredStaticFilters,
    incidentDomainNormalizeConfiguredReportRecord,
    incidentDomainNormalizeConfiguredSeededRecord,
    incidentDomainNormalizePersistedRecordStateRow,
    incidentDomainPrependConfiguredReportState,
    incidentDomainRemoveConfiguredRecordById,
    incidentDomainUpsertConfiguredSeededState,
    normalizeCachedConfiguredIncidentRowsByDomainShared,
    normalizeCachedPersistedIncidentRecordStateByDomainShared,
  };
}
