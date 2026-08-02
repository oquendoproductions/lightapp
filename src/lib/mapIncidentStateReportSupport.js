function parseMetadata(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function resolveIncidentStateForReportsShared({
  snapshot = null,
  streetlightConfidence = null,
  timelineState = null,
} = {}) {
  if (snapshot?.state) {
    const state = String(snapshot.state || "").trim();
    const lastChangedAtIso = String(snapshot.last_changed_at || "").trim();
    return {
      state,
      fixedAtIso: state === "fixed" ? lastChangedAtIso : "",
      lastChangedAtIso,
    };
  }

  if (streetlightConfidence) {
    const closedAtMs = Number(
      streetlightConfidence?.latestWorkingTs
      || streetlightConfidence?.lastSignalTs
      || 0
    );
    const lastChangedMs = Number(streetlightConfidence?.lastSignalTs || 0);
    return {
      state: String(streetlightConfidence?.state || "").trim(),
      fixedAtIso:
        streetlightConfidence?.closed && closedAtMs
          ? new Date(closedAtMs).toISOString()
          : "",
      lastChangedAtIso: lastChangedMs ? new Date(lastChangedMs).toISOString() : "",
    };
  }

  return timelineState || { state: "", fixedAtIso: "", lastChangedAtIso: "" };
}

export function normalizeIncidentStateHistoryRowsShared(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const metadata = parseMetadata(row?.metadata);
      const historyKind = String(row?.history_kind || "").trim().toLowerCase();
      const metadataSource = String(metadata?.source || "").trim();
      const kind = historyKind === "repair_confirmation" || metadataSource === "resident_repair_confirmation"
        ? "repair_confirmation"
        : "state_update";
      return {
        kind,
        eventId: String(row?.event_id ?? row?.id ?? ""),
        previousState: String(row?.previous_state || metadata?.previous_state || "").trim(),
        newState: String(row?.new_state || "").trim(),
        changedBy: String(row?.changed_by || "").trim(),
        changedByName: String(row?.changed_by_name || "").trim(),
        changedByEmail: String(row?.changed_by_email || "").trim(),
        changedByPhone: String(row?.changed_by_phone || "").trim(),
        source: String(row?.source || "").trim(),
        changedAt: String(row?.changed_at || "").trim(),
        note: String(metadata?.note || "").trim(),
        imageUrl: String(metadata?.image_url || "").trim(),
        imageFileName: String(metadata?.image_file_name || "").trim(),
        metadataSource,
      };
    })
    .filter((event) => (
      event.kind === "repair_confirmation"
      || (
        event.newState
        && (
          event.source.toLowerCase() === "admin"
          || event.metadataSource === "map_admin_status_update"
        )
      )
    ));
}

export async function loadIncidentStateHistoryShared({
  supabase,
  tenantKey = "",
  domainKey = "",
  incidentId = "",
} = {}) {
  const normalizedTenantKey = String(tenantKey || "").trim();
  const normalizedDomainKey = String(domainKey || "").trim();
  const normalizedIncidentId = String(incidentId || "").trim();
  if (!supabase?.rpc || !normalizedTenantKey || !normalizedDomainKey || !normalizedIncidentId) {
    return { events: [], error: null };
  }

  try {
    const { data, error } = await supabase.rpc("incident_state_history_tenant", {
      p_tenant_key: normalizedTenantKey,
      p_domain: normalizedDomainKey,
      p_incident_id: normalizedIncidentId,
    });
    return {
      events: error ? [] : normalizeIncidentStateHistoryRowsShared(data),
      error: error || null,
    };
  } catch (error) {
    return { events: [], error };
  }
}
