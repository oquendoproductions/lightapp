export async function loadDeferredStreetlightRuntimeStartupShared(state = {}, deps = {}) {
  let utilityStatusErr = null;
  let utilitySignalCountErr = null;
  let fixErr = null;
  let actErr = null;
  let fixedMap = {};
  let nextActionsByLightId = {};

  if (!state.shouldPrioritizeStreetlightRuntimeStartup) {
    return {
      utilityStatusErr,
      utilitySignalCountErr,
      fixErr,
      actErr,
      fixedMap,
      nextActionsByLightId,
    };
  }

  const utilityStatusPromise = state.isAuthed
    ? state.authedReadClient
        .from("utility_report_status")
        .select("incident_id, report_reference, updated_at, reported_at")
        .eq("tenant_key", state.loadTenantKey)
        .eq("user_id", state.sessionUserId)
        .order("updated_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });
  const utilitySignalCountsPromise = state.publicReadClient.rpc("streetlight_utility_signal_counts");
  let utilityStatusData = [];
  let utilitySignalCountData = [];

  try {
    const {
      isMissingUtilityReportReferenceColumnError,
      normalizeUtilityReportReference,
      parseWorkingContactFromNote,
    } = await deps.loadIncidentDeferredSupportModule();
    const [
      utilityStatusResult,
      utilitySignalCountsResult,
    ] = await Promise.all([
      utilityStatusPromise,
      utilitySignalCountsPromise,
    ]);
    utilityStatusData = utilityStatusResult?.data || [];
    utilityStatusErr = utilityStatusResult?.error || null;
    utilitySignalCountData = utilitySignalCountsResult?.data || [];
    utilitySignalCountErr = utilitySignalCountsResult?.error || null;
    if (utilityStatusErr && isMissingUtilityReportReferenceColumnError(utilityStatusErr) && state.isAuthed) {
      const fallback = await state.authedReadClient
        .from("utility_report_status")
        .select("incident_id, updated_at, reported_at")
        .eq("tenant_key", state.loadTenantKey)
        .eq("user_id", state.sessionUserId)
        .order("updated_at", { ascending: false });
      utilityStatusData = fallback.data || [];
      utilityStatusErr = fallback.error || null;
    }
    if (state.isCancelled()) {
      return {
        utilityStatusErr,
        utilitySignalCountErr,
        fixErr,
        actErr,
        fixedMap,
        nextActionsByLightId,
      };
    }

    const utilitySet = new Set();
    const utilityReportedAtMap = {};
    const utilityReferenceMap = {};
    for (const row of utilityStatusData || []) {
      const rawId = String(row?.incident_id || "").trim();
      if (!rawId) continue;
      const normalizedId = deps.canonicalOfficialLightId(
        rawId,
        null,
        null,
        state.deferredOfficialIdByAlias,
        state.deferredOfficialIdByCoordKey,
      );
      const id = String(normalizedId || "").trim();
      if (!id || !state.deferredOfficialIdByAlias.has(id)) continue;
      utilitySet.add(id);
      utilityReportedAtMap[id] = Math.max(
        Number(utilityReportedAtMap[id] || 0),
        Date.parse(String(row?.updated_at || row?.reported_at || "")) || 0,
      );
      utilityReferenceMap[id] = normalizeUtilityReportReference(row?.report_reference);
    }
    deps.setUtilityReportedLightIdSet(utilitySet);
    deps.setUtilityReportedAtByLightId(utilityReportedAtMap);
    deps.setUtilityReportReferenceByLightId(utilityReferenceMap);

    const utilityCountMap = {};
    for (const row of utilitySignalCountData || []) {
      const rawId = String(row?.incident_id || "").trim();
      if (!rawId) continue;
      const normalizedId = deps.canonicalOfficialLightId(
        rawId,
        null,
        null,
        state.deferredOfficialIdByAlias,
        state.deferredOfficialIdByCoordKey,
      );
      const id = String(normalizedId || "").trim();
      if (!id || !state.deferredOfficialIdByAlias.has(id)) continue;
      utilityCountMap[id] = {
        reportedCount: Math.max(0, Number(row?.reported_count || 0)),
        referenceCount: Math.max(0, Number(row?.reference_count || 0)),
        latestReportedTs: Date.parse(String(row?.latest_reported_at || "")) || 0,
      };
    }
    deps.setUtilitySignalCountsByLightId(utilityCountMap);

    const [
      { data: fixedData, error: nextFixErr },
      { data: actionData, error: nextActErr },
    ] = await Promise.all([
      state.fixedLightsPromise,
      state.actionsPromise,
    ]);
    if (state.isCancelled()) {
      return {
        utilityStatusErr,
        utilitySignalCountErr,
        fixErr,
        actErr,
        fixedMap,
        nextActionsByLightId,
      };
    }
    fixErr = nextFixErr;
    actErr = nextActErr;

    for (const row of fixedData || []) fixedMap[row.light_id] = new Date(row.fixed_at).getTime();
    deps.setFixedLights(fixedMap);

    let map = {};
    if (fixErr) {
      console.error(fixErr);
    }
    if (actErr) {
      if (!deps.isExpectedPermissionError(actErr)) {
        console.error(actErr);
      }
    } else {
      for (const a of actionData || []) {
        if (String(a.action || "").toLowerCase() !== "fix") continue;
        const ts = new Date(a.created_at).getTime();
        if (!map[a.light_id] || ts > map[a.light_id]) map[a.light_id] = ts;
      }
      const byId = {};
      for (const a of actionData || []) {
        const ts = new Date(a.created_at).getTime();
        if (!byId[a.light_id]) byId[a.light_id] = [];
        const noteContact = parseWorkingContactFromNote(a.note);
        const actorEmail = a.actor_email || a.reporter_email || noteContact.email || null;
        const actorPhone = a.actor_phone || a.reporter_phone || noteContact.phone || null;
        const actorUserId = a.actor_user_id || a.reporter_user_id || null;
        const actorNameRaw = (a.actor_name || a.reporter_name || noteContact.name || "").trim();
        const actorNameFallback = actorEmail ? String(actorEmail).split("@")[0] : "";
        byId[a.light_id].push({
          action: a.action,
          ts,
          note: a.note || null,
          actor_user_id: actorUserId,
          actor_email: actorEmail,
          actor_phone: actorPhone,
          actor_name: actorNameRaw || actorNameFallback || null,
          reporter_user_id: a.reporter_user_id || actorUserId,
          reporter_name: (a.reporter_name || "").trim() || actorNameRaw || actorNameFallback || null,
          reporter_email: a.reporter_email || actorEmail,
          reporter_phone: a.reporter_phone || actorPhone,
        });
      }
      nextActionsByLightId = byId;
      deps.setActionsByLightId(byId);
      deps.setLastFixByLightId(map);
    }
  } catch (error) {
    console.warn("[map startup deferred load] warning:", error?.message || error);
  }

  return {
    utilityStatusErr,
    utilitySignalCountErr,
    fixErr,
    actErr,
    fixedMap,
    nextActionsByLightId,
  };
}
