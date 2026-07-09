export function toCsvShared(rows, columns, metadata = null) {
  const esc = (value) => {
    const text = String(value ?? "");
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
    return text;
  };

  const metaLines = [];
  if (metadata && typeof metadata === "object") {
    for (const [key, value] of Object.entries(metadata)) {
      if (!key) continue;
      metaLines.push(`# ${String(key)}: ${String(value ?? "")}`);
    }
  }

  const head = columns.join(",");
  const body = rows.map((row) => columns.map((column) => esc(row?.[column])).join(",")).join("\n");
  const metaPrefix = metaLines.length ? `${metaLines.join("\n")}\n` : "";
  return `${metaPrefix}${head}\n${body}\n`;
}

export function buildExportMetadataShared(context = {}) {
  const {
    exportSchemaVersion = "v1",
    parseLocalDateStart,
    parseLocalDateEndExclusive,
    exportFromDate = "",
    exportToDate = "",
    activeDomain = "",
    adminMetrics = {},
  } = context;

  const from = typeof parseLocalDateStart === "function" ? parseLocalDateStart(exportFromDate) : null;
  const toExclusive = typeof parseLocalDateEndExclusive === "function" ? parseLocalDateEndExclusive(exportToDate) : null;

  return {
    export_schema_version: exportSchemaVersion,
    generated_at_utc: new Date().toISOString(),
    window_start_utc: from ? from.toISOString() : "",
    window_end_utc: toExclusive ? toExclusive.toISOString() : "",
    domain: activeDomain || "all",
    metrics_incidents: Number(adminMetrics?.totalIncidents || 0),
    metrics_open: Number(adminMetrics?.openIncidents || 0),
    metrics_fixed: Number(adminMetrics?.fixedIncidents || 0),
    metrics_reports: Number(adminMetrics?.totalReports || 0),
    metrics_avg_time_to_fix_seconds: Number(adminMetrics?.avgTimeToFixSeconds || 0),
  };
}

export function downloadCsvShared(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function logExportAuditShared(context = {}) {
  const {
    supabase,
    isAdmin = false,
    exportKind = "",
    activeDomain = "",
    exportFromDate = "",
    exportToDate = "",
    searchQuery = "",
    sortMode = "",
    statusFilter = "",
    rowCount = 0,
  } = context;

  if (!isAdmin || !supabase?.rpc) return;

  try {
    const normalizedStatus = String(statusFilter || "").toLowerCase();
    const validLifecycleStates = new Set([
      "reported",
      "confirmed",
      "in_progress",
      "fixed",
      "archived",
    ]);
    const auditState = validLifecycleStates.has(normalizedStatus) ? normalizedStatus : null;
    const payload = {
      p_export_kind: exportKind,
      p_domain: activeDomain,
      p_state: auditState,
      p_from_date: exportFromDate || null,
      p_to_date: exportToDate || null,
      p_incident_id: null,
      p_filters: {
        search: String(searchQuery || "").trim(),
        sort: sortMode,
        domain: activeDomain,
        status_filter: normalizedStatus || null,
        source: "reports_modal",
      },
      p_row_count: Number(rowCount || 0),
    };
    const { error } = await supabase.rpc("log_export_action", payload);
    if (error) {
      console.warn("[log_export_action]", error);
    }
  } catch (error) {
    console.warn("[log_export_action] unexpected", error);
  }
}
