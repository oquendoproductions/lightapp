import { incidentSnapshotKey } from "./mapIncidentRepairSupport.js";

const INCIDENT_REPAIR_TARGET = 5;

export async function fetchIncidentRepairProgressSnapshot({
  readClient,
  tenantKey = "",
  viewerIdentityKey = "",
  incidentRepairTarget = INCIDENT_REPAIR_TARGET,
} = {}) {
  const normalizedIdentityKey = String(viewerIdentityKey || "").trim() || null;
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  const requestContextKey = `${normalizedTenantKey}::${normalizedIdentityKey || "anon"}`;

  const [progressRes, directSignalsRes] = await Promise.all([
    readClient.rpc("incident_repair_progress_public", {
      p_viewer_identity_hash: normalizedIdentityKey,
    }),
    normalizedIdentityKey && normalizedTenantKey
      ? readClient
          .from("incident_repair_signals")
          .select("domain, incident_id")
          .eq("tenant_key", normalizedTenantKey)
          .eq("identity_hash", normalizedIdentityKey)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const { data, error } = progressRes;
  if (error) throw error;

  const progressByKey = {};
  for (const row of data || []) {
    const key = incidentSnapshotKey(row?.domain, row?.incident_id);
    if (!key) continue;
    progressByKey[key] = {
      issueScore: Number(row?.issue_score || 0),
      repairProgress: Math.max(0, Math.min(incidentRepairTarget, Number(row?.repair_progress || 0))),
      lastIssueAt: row?.last_issue_at || null,
      lastRepairAt: row?.last_repair_at || null,
      lastMovementAt: row?.last_movement_at || null,
      archived: row?.archived === true,
      likelyFixed: row?.likely_fixed === true,
      viewerIsOriginalReporter: row?.viewer_is_original_reporter === true,
      viewerHasIssueReport: row?.viewer_has_issue_report === true,
      viewerHasRepairSignal: row?.viewer_has_repair_signal === true,
    };
  }

  const directConfirmedKeys = new Set();
  if (!directSignalsRes?.error) {
    for (const row of directSignalsRes?.data || []) {
      const key = incidentSnapshotKey(row?.domain, row?.incident_id);
      if (!key) continue;
      directConfirmedKeys.add(key);
    }
  }

  return {
    directConfirmedKeys,
    progressByKey,
    requestContextKey,
  };
}
