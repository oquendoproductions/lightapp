export function summarizeIncidentRowsAfterFixWindowShared(rowsInput, {
  incidentIds = [],
  maxLastFixTs = 0,
  getFixTsForIncidentId = null,
  resolveRowIncidentId = null,
  fallbackIncidentId = "",
} = {}) {
  const allRows = Array.isArray(rowsInput)
    ? [...rowsInput].sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))
    : [];
  const normalizedIncidentIds = Array.from(new Set(
    (Array.isArray(incidentIds) ? incidentIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  ));
  const computedMaxLastFixTs = normalizedIncidentIds.length && typeof getFixTsForIncidentId === "function"
    ? normalizedIncidentIds.reduce(
        (max, id) => Math.max(max, Number(getFixTsForIncidentId(id) || 0)),
        Number(maxLastFixTs || 0)
      )
    : Number(maxLastFixTs || 0);
  const rows = allRows.filter((row) => {
    const rowTs = Number(row?.ts || 0);
    if (typeof getFixTsForIncidentId === "function" && typeof resolveRowIncidentId === "function") {
      const rowIncidentId = String(resolveRowIncidentId(row, fallbackIncidentId) || "").trim();
      const fixTs = Number(getFixTsForIncidentId(rowIncidentId) || 0);
      return rowTs > fixTs;
    }
    return rowTs > computedMaxLastFixTs;
  });
  const latest = rows[0] || allRows[0] || null;
  return {
    allRows,
    rows,
    latest,
    maxLastFixTs: computedMaxLastFixTs,
  };
}
