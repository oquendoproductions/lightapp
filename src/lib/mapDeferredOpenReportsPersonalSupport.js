import { canonicalIncidentDrivenIncidentIdShared } from "./mapIncidentDomainHelperCoreSupport.js";

export function buildPersonalMyReportsGroupsForDomainShared(domainKeyRaw, context = {}, deps = {}) {
  const {
    formattedIncidentDisplayId,
    getIncidentDomainHelper,
    incidentDomainResolveLookupValueByMode,
    normalizeDomainKeyOrSlug,
    reportIdentityKey,
  } = deps;
  if (
    typeof formattedIncidentDisplayId !== "function"
    || typeof getIncidentDomainHelper !== "function"
    || typeof incidentDomainResolveLookupValueByMode !== "function"
    || typeof normalizeDomainKeyOrSlug !== "function"
    || typeof reportIdentityKey !== "function"
  ) {
    return [];
  }

  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return [];
  const helper = getIncidentDomainHelper(domainKey) || {};
  if (typeof helper?.buildMyReportsGroups === "function") {
    return helper.buildMyReportsGroups(context, { domainKey, helper }) || [];
  }

  const mode = String(helper?.buildMyReportsGroupsMode || "").trim();
  if (mode !== "grouped_lookup_reports") return [];

  const resolvedIdentityKey = String(context?.identityKey || "").trim();
  if (!resolvedIdentityKey) return [];
  const reportRows = Array.isArray(context?.reportRows) ? context.reportRows : [];
  const seededRows = Array.isArray(context?.seededRows) ? context.seededRows : [];
  const seededLookupField = String(helper?.buildMyReportsGroupsSeededLookupField || "id").trim();
  const explicitDisplayFields = Array.isArray(helper?.buildMyReportsGroupsExplicitDisplayFields)
    ? helper.buildMyReportsGroupsExplicitDisplayFields.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
    : [];
  const seededByLookupId = new Map(
    seededRows
      .map((row) => [String(row?.[seededLookupField] || "").trim(), row])
      .filter(([lookupId]) => Boolean(lookupId))
  );
  const groupedRows = new Map();
  for (const row of reportRows) {
    if (reportIdentityKey(row) !== resolvedIdentityKey) continue;
    const lookupId = incidentDomainResolveLookupValueByMode(
      "incident_or_domain_report_id",
      row,
      domainKey
    );
    if (!lookupId) continue;
    if (!groupedRows.has(lookupId)) groupedRows.set(lookupId, []);
    groupedRows.get(lookupId).push({ ...row, domainKey, domain: domainKey });
  }

  return Array.from(groupedRows.entries()).map(([lookupId, rows]) => {
    rows.sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
    const seeded = seededByLookupId.get(lookupId) || null;
    const avg = rows.reduce(
      (acc, row) => ({ lat: acc.lat + Number(row?.lat || 0), lng: acc.lng + Number(row?.lng || 0) }),
      { lat: 0, lng: 0 }
    );
    const rowCount = rows.length || 1;
    const center = (
      Number.isFinite(Number(seeded?.lat)) && Number.isFinite(Number(seeded?.lng))
        ? { lat: Number(seeded.lat), lng: Number(seeded.lng), isOfficial: false }
        : { lat: avg.lat / rowCount, lng: avg.lng / rowCount, isOfficial: false }
    );
    const incidentId = canonicalIncidentDrivenIncidentIdShared(domainKey, { incident_id: lookupId }, "", deps);
    const explicitDisplayId = explicitDisplayFields
      .map((fieldName) => String(seeded?.[fieldName] || "").trim())
      .find(Boolean) || "";
    return {
      domainKey,
      lightId: incidentId,
      incidentId,
      displayId: formattedIncidentDisplayId(
        domainKey,
        incidentId,
        center,
        explicitDisplayId,
        context?.slIdByUuid
      ),
      center,
      mineRows: rows,
      totalCount: Number(rows.length || 0),
      lastTs: Number(rows?.[0]?.ts || 0),
    };
  });
}
