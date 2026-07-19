function normalizedDomainKey(value) {
  return String(value || "").trim().toLowerCase();
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return Number.NaN;
}

function submittedReportRowKey(row = {}) {
  const id = String(row?.id || "").trim();
  if (id) return `id:${id}`;
  const reportNumber = String(row?.report_number || "").trim().toLowerCase();
  if (reportNumber) return `report:${reportNumber}`;
  const incidentId = String(row?.incident_id || row?.light_id || "").trim().toLowerCase();
  const ts = Number(row?.ts || 0);
  return incidentId && ts > 0 ? `incident:${incidentId}:${ts}` : "";
}

export function buildSubmittedIncidentMapRowShared(context = {}, deps = {}) {
  const submittedReport = context?.submittedReport && typeof context.submittedReport === "object"
    ? context.submittedReport
    : {};
  const target = context?.target && typeof context.target === "object" ? context.target : {};
  const normalizeDomainKey = typeof deps?.normalizeDomainKey === "function"
    ? deps.normalizeDomainKey
    : normalizedDomainKey;
  const domainKey = normalizeDomainKey(
    context?.domainKey
    || submittedReport?.domain
    || submittedReport?.report_domain
    || target?.domain
  );
  const lat = firstFiniteNumber(submittedReport?.lat, target?.sourceLat, target?.lat);
  const lng = firstFiniteNumber(submittedReport?.lng, target?.sourceLng, target?.lng);
  if (!domainKey || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const resolveIncidentId = typeof deps?.resolveIncidentId === "function"
    ? deps.resolveIncidentId
    : (_, row) => String(row?.incident_id || row?.light_id || "").trim();
  const incidentId = String(resolveIncidentId(domainKey, {
    ...target,
    ...submittedReport,
    lat,
    lng,
  }) || submittedReport?.incident_id || submittedReport?.light_id || target?.incident_id || target?.lightId || "").trim();
  if (!incidentId) return null;

  const submittedAt = Number(
    submittedReport?.ts
    || Date.parse(String(submittedReport?.created_at || ""))
    || context?.submittedAt
    || Date.now()
  ) || Date.now();
  const reportNumber = String(submittedReport?.report_number || "").trim() || null;
  const id = String(submittedReport?.id || "").trim()
    || [domainKey, incidentId, reportNumber || submittedAt].join(":");

  return {
    ...submittedReport,
    id,
    domain: domainKey,
    domainKey,
    report_domain: domainKey,
    incident_id: incidentId,
    light_id: String(submittedReport?.light_id || incidentId).trim() || incidentId,
    lat,
    lng,
    ts: submittedAt,
    report_number: reportNumber,
  };
}

export function mergeSubmittedIncidentReportRowShared(rows = [], submittedRow = null) {
  if (!submittedRow || typeof submittedRow !== "object") {
    return Array.isArray(rows) ? rows : [];
  }
  const source = Array.isArray(rows) ? rows : [];
  const incomingKey = submittedReportRowKey(submittedRow);
  let replaced = false;
  const next = source.map((row) => {
    if (!incomingKey || submittedReportRowKey(row) !== incomingKey) return row;
    replaced = true;
    return { ...row, ...submittedRow };
  });
  if (!replaced) next.unshift(submittedRow);
  return next.sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
}

export function upsertSubmittedIncidentBaseMarkerShared(markers = [], submittedRow = null) {
  if (!submittedRow || typeof submittedRow !== "object") {
    return Array.isArray(markers) ? markers : [];
  }
  const incidentId = String(submittedRow?.incident_id || submittedRow?.light_id || "").trim();
  const domainKey = normalizedDomainKey(submittedRow?.domain || submittedRow?.report_domain);
  const lat = Number(submittedRow?.lat);
  const lng = Number(submittedRow?.lng);
  if (!incidentId || !domainKey || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Array.isArray(markers) ? markers : [];
  }

  const source = Array.isArray(markers) ? markers : [];
  const markerIndex = source.findIndex((marker) => (
    String(marker?.incident_id || marker?.id || "").trim() === incidentId
  ));
  if (markerIndex < 0) {
    return [{
      id: incidentId,
      incident_id: incidentId,
      domain: domainKey,
      lat,
      lng,
      count: 1,
      lastTs: Number(submittedRow?.ts || 0) || 0,
      rows: [submittedRow],
    }, ...source];
  }

  const existing = source[markerIndex];
  const existingRows = Array.isArray(existing?.rows) ? existing.rows : [];
  const mergedRows = mergeSubmittedIncidentReportRowShared(existingRows, submittedRow);
  const existingKeys = new Set(existingRows.map(submittedReportRowKey).filter(Boolean));
  const incomingKey = submittedReportRowKey(submittedRow);
  const isNewReport = !incomingKey || !existingKeys.has(incomingKey);
  const submittedTs = Number(submittedRow?.ts || 0) || 0;
  const existingTs = Number(existing?.lastTs || 0) || 0;
  const nextMarker = {
    ...existing,
    ...(submittedTs >= existingTs ? { lat, lng } : {}),
    count: Math.max(
      mergedRows.length,
      Number(existing?.count || 0) + (isNewReport ? 1 : 0)
    ),
    lastTs: Math.max(existingTs, submittedTs),
    rows: mergedRows,
  };
  const next = [...source];
  next[markerIndex] = nextMarker;
  return next.sort((a, b) => (
    Number(b?.count || 0) - Number(a?.count || 0)
    || Number(b?.lastTs || 0) - Number(a?.lastTs || 0)
  ));
}
