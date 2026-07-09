import { resolveIncidentMarkerLookupIdShared } from "./mapIncidentDomainHelperSupport.js";

export function incidentMarkerDedupKeyShared(marker, deps = {}) {
  if (!marker || typeof marker !== "object") return "";
  const domain = String(marker?.domain || "").trim().toLowerCase();
  const incidentId = resolveIncidentMarkerLookupIdShared(domain, marker, marker?.display_id || "", deps).toLowerCase();
  if (domain && incidentId) return `${domain}::${incidentId}`;
  const lat = Number(marker?.lat);
  const lng = Number(marker?.lng);
  if (!domain || !Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${domain}::${lat.toFixed(6)}:${lng.toFixed(6)}`;
}

export function mergeIncidentMarkerRowsShared(rows = []) {
  const next = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== "object") continue;
    const rowKey = String(
      row?.id
      || `${String(row?.light_id || row?.incident_id || "").trim()}::${Number(row?.ts || 0)}::${Number(row?.lat || 0)}::${Number(row?.lng || 0)}`
    ).trim().toLowerCase();
    if (!rowKey || seen.has(rowKey)) continue;
    seen.add(rowKey);
    next.push(row);
  }
  return next.sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
}

export function dedupeIncidentMarkerRenderSourceShared(markers = [], deps = {}) {
  const source = Array.isArray(markers) ? markers : [];
  const merged = new Map();
  const filtered = [];
  let hasDuplicate = false;
  for (const marker of source) {
    const key = incidentMarkerDedupKeyShared(marker, deps);
    if (!key) continue;
    filtered.push(marker);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, marker);
      continue;
    }
    hasDuplicate = true;

    const mergedRows = mergeIncidentMarkerRowsShared([
      ...(Array.isArray(existing?.rows) ? existing.rows : []),
      ...(Array.isArray(marker?.rows) ? marker.rows : []),
    ]);
    const mergedCount = mergedRows.length
      || Math.max(Number(existing?.count || 0), Number(marker?.count || 0));
    const existingLastTs = Number(existing?.lastTs || 0);
    const markerLastTs = Number(marker?.lastTs || 0);
    const preferred = markerLastTs > existingLastTs ? marker : existing;

    merged.set(key, {
      ...preferred,
      rows: mergedRows,
      count: mergedCount,
      lastTs: Math.max(existingLastTs, markerLastTs),
    });
  }
  if (!hasDuplicate) {
    return filtered.length === source.length ? source : filtered;
  }
  return Array.from(merged.values());
}

