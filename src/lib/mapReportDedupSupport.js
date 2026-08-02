function normalizedDomainKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizedIncidentId(value, domainKey = "") {
  const raw = String(value || "").trim();
  const prefix = normalizedDomainKey(domainKey);
  if (prefix && raw.toLowerCase().startsWith(`${prefix}:`)) {
    return raw.slice(prefix.length + 1).trim();
  }
  return raw;
}

export function reportDeduplicationKeyShared(row = {}, domainKeyRaw = "") {
  const domainKey = normalizedDomainKey(domainKeyRaw || row?.domainKey || row?.domain || row?.report_domain);
  const reportNumber = String(row?.report_number || "").trim().toLowerCase();
  if (reportNumber) return `${domainKey}::report-number::${reportNumber}`;

  const reportId = String(row?.report_id || row?.id || "").trim();
  if (reportId) return `${domainKey}::report-id::${reportId}`;

  const incidentId = normalizedIncidentId(row?.incident_id || row?.light_id, domainKey);
  return `${domainKey}::fallback::${incidentId}::${String(row?.submitted_at || row?.created_at || row?.ts || "")}::${String(row?.note || row?.raw_notes || "").trim()}`;
}

export function dedupeReportRowsShared(rows = [], domainKeyRaw = "") {
  const unique = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const key = reportDeduplicationKeyShared(row, domainKeyRaw);
    if (!unique.has(key)) unique.set(key, row);
  }
  return Array.from(unique.values());
}

export function mergeReportGroupsByIncidentShared(groups = []) {
  const byIncident = new Map();
  for (const group of Array.isArray(groups) ? groups : []) {
    if (!group || typeof group !== "object") continue;
    const sourceRows = Array.isArray(group?.rows)
      ? group.rows
      : (Array.isArray(group?.mineRows) ? group.mineRows : []);
    const domainKey = normalizedDomainKey(group?.domainKey || group?.domain || sourceRows?.[0]?.domainKey || sourceRows?.[0]?.domain);
    const incidentId = normalizedIncidentId(group?.incidentId || group?.incident_id || group?.lightId, domainKey);
    if (!domainKey || !incidentId) continue;
    const groupKey = `${domainKey}::${incidentId}`;
    const existing = byIncident.get(groupKey);
    if (!existing) {
      const rows = dedupeReportRowsShared(sourceRows, domainKey);
      byIncident.set(groupKey, {
        ...group,
        domainKey,
        domain: domainKey,
        incidentId,
        rows,
        ...(Array.isArray(group?.mineRows) ? { mineRows: rows } : {}),
        count: rows.length,
        totalCount: rows.length,
        lastTs: Math.max(Number(group?.lastTs || 0), ...rows.map((row) => Number(row?.ts || 0))),
      });
      continue;
    }
    const rows = dedupeReportRowsShared([
      ...(Array.isArray(existing?.rows) ? existing.rows : []),
      ...sourceRows,
    ], domainKey);
    const hasMineRows = Array.isArray(existing?.mineRows) || Array.isArray(group?.mineRows);
    byIncident.set(groupKey, {
      ...existing,
      rows,
      ...(hasMineRows ? { mineRows: rows } : {}),
      count: rows.length,
      totalCount: rows.length,
      lastTs: Math.max(Number(existing?.lastTs || 0), Number(group?.lastTs || 0), ...rows.map((row) => Number(row?.ts || 0))),
    });
  }
  return Array.from(byIncident.values());
}
