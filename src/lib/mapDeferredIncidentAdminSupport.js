import {
  buildNativeSafeImageUploadPayload,
  extFromFileName,
} from "./mapReportParsingDeferredSupport.js";
import { uploadIncidentActionImageIfAnyShared } from "./mapDeferredReportSubmitSupport.js";
import { uniqueLightIdsForClusterShared } from "./mapIncidentClusterSupport.js";
import {
  adminFacingIncidentStateLabel,
  adminIncidentStateOptionsForDomain,
} from "./incidentLifecycle.js";

export async function insertLightActionsWithFallbackShared(args = {}) {
  const {
    supabase,
    tenantKey = "",
    rows = [],
    selectCols = "",
    actorColsSupported = null,
  } = args;
  const payload = (Array.isArray(rows) ? rows : []).map((row) => {
    const next = { ...(row || {}) };
    if (!String(next?.tenant_key || "").trim() && tenantKey) next.tenant_key = tenantKey;
    return next;
  });
  const runInsert = async (insertRows) => {
    let q = supabase.from("light_actions").insert(insertRows);
    if (selectCols) q = q.select(selectCols);
    return await q;
  };

  const payloadNoActorCols = payload.map((r) => {
    const next = { ...(r || {}) };
    delete next.actor_name;
    delete next.actor_email;
    delete next.actor_phone;
    return next;
  });
  const initialPayload = actorColsSupported === false ? payloadNoActorCols : payload;
  let { data, error } = await runInsert(initialPayload);
  if (!error) {
    return {
      data,
      error: null,
      actorColsSupported: actorColsSupported === null && initialPayload === payload ? true : actorColsSupported,
    };
  }

  const msg = String(error?.message || "").toLowerCase();
  const details = String(error?.details || "").toLowerCase();
  const hint = String(error?.hint || "").toLowerCase();
  const text = `${msg} ${details} ${hint}`;
  const hasActorFieldsInPayload = payload.some((r) =>
    Object.prototype.hasOwnProperty.call(r || {}, "actor_name")
    || Object.prototype.hasOwnProperty.call(r || {}, "actor_email")
    || Object.prototype.hasOwnProperty.call(r || {}, "actor_phone")
  );
  const isActorColumnMissing =
    hasActorFieldsInPayload &&
    (
      text.includes("actor_name")
      || text.includes("actor_email")
      || text.includes("actor_phone")
      || text.includes("schema cache")
      || text.includes("column")
    );

  if (!isActorColumnMissing) {
    return { data, error, actorColsSupported };
  }

  const retry = await runInsert(payloadNoActorCols);
  return {
    data: retry.data,
    error: retry.error,
    actorColsSupported: false,
  };
}

export function buildCurrentIncidentActionActorShared(context = {}, deps = {}) {
  const { profile = {}, session = {} } = context;
  const { normalizeEmail, normalizePhone } = deps;
  const actorName =
    String(profile?.full_name || "").trim()
    || String(session?.user?.user_metadata?.full_name || "").trim()
    || String(session?.user?.email || "").split("@")[0]
    || "";
  return {
    userId: session?.user?.id || null,
    name: actorName || "",
    email: normalizeEmail(session?.user?.email || profile?.email || "") || "",
    phone: normalizePhone(profile?.phone || "") || "",
  };
}

export async function readReportStatePinSnapshotShared(args = {}) {
  const {
    supabase,
    sessionUserId = "",
    tenantKey = "",
    isMissingRelationError,
  } = args;
  if (!sessionUserId || !tenantKey) {
    return {
      pin_hash: "",
      pin_scope: "shared",
      error: new Error("Sign in again and retry."),
    };
  }

  const [sharedPinResult, legacyTenantPinResult] = await Promise.all([
    supabase
      .from("platform_user_security_profiles")
      .select("user_id,pin_enabled,pin_hash")
      .eq("user_id", sessionUserId)
      .maybeSingle(),
    supabase
      .from("tenant_user_security_profiles")
      .select("tenant_key,user_id,pin_enabled,pin_hash")
      .eq("tenant_key", tenantKey)
      .eq("user_id", sessionUserId)
      .maybeSingle(),
  ]);

  const legacyPinMissing = isMissingRelationError(legacyTenantPinResult.error);
  const firstError = sharedPinResult.error || (!legacyPinMissing ? legacyTenantPinResult.error : null);
  const sharedPinHash = String(sharedPinResult.data?.pin_hash || "").trim();
  const legacyPinHash = String(legacyTenantPinResult.data?.pin_hash || "").trim();
  return {
    pin_hash: sharedPinHash || legacyPinHash,
    pin_scope: sharedPinHash ? "shared" : (legacyPinHash ? "legacy_tenant" : "shared"),
    error: firstError || null,
  };
}

export async function markIncidentFixedShared(args = {}) {
  const {
    supabase,
    tenantKey = "",
    light,
    actor = {},
    actionNote = "",
    officialIdSet,
    actorColsSupported = null,
  } = args;
  const isOfficial = Boolean(light?.isOfficial);
  const ids = isOfficial
    ? [light.lightId]
    : uniqueLightIdsForClusterShared(light);

  const insertResult = await insertLightActionsWithFallbackShared({
    supabase,
    tenantKey,
    rows: ids.map((id) => ({
      tenant_key: tenantKey,
      light_id: id,
      action: "fix",
      note: actionNote,
      actor_user_id: actor.userId,
      actor_name: actor.name || null,
      actor_email: actor.email || null,
      actor_phone: actor.phone || null,
    })),
    selectCols: "light_id, created_at",
    actorColsSupported,
  });

  if (insertResult.error) {
    return {
      ok: false,
      error: insertResult.error,
      errorMessage: "Couldn’t record fix history.",
      actorColsSupported: insertResult.actorColsSupported,
    };
  }

  const newest = (insertResult.data || []).reduce((best, r) => {
    const t = new Date(r.created_at).getTime();
    return !best || t > best.t ? { t, iso: r.created_at } : best;
  }, null);

  const fixIso = newest?.iso || new Date().toISOString();
  const fixMs = new Date(fixIso).getTime();

  const allOfficialLights = ids.every((id) => officialIdSet.has(String(id || "").trim()));
  if (allOfficialLights) {
    const { error: fixErr } = await supabase
      .from("fixed_lights")
      .upsert(ids.map((id) => ({ tenant_key: tenantKey, light_id: id, fixed_at: fixIso })));

    if (fixErr) {
      return {
        ok: false,
        error: fixErr,
        errorMessage: "Couldn’t update fixed state.",
        actorColsSupported: insertResult.actorColsSupported,
      };
    }
  }

  return {
    ok: true,
    ids,
    fixIso,
    fixMs,
    actorColsSupported: insertResult.actorColsSupported,
  };
}

export async function reopenIncidentShared(args = {}) {
  const {
    supabase,
    tenantKey = "",
    light,
    actor = {},
    actionNote = "",
    actorColsSupported = null,
  } = args;
  const isOfficial = Boolean(light?.isOfficial);
  const ids = isOfficial
    ? [light.lightId]
    : uniqueLightIdsForClusterShared(light);

  const insertResult = await insertLightActionsWithFallbackShared({
    supabase,
    tenantKey,
    rows: ids.map((id) => ({
      tenant_key: tenantKey,
      light_id: id,
      action: "reopen",
      note: actionNote,
      actor_user_id: actor.userId,
      actor_name: actor.name || null,
      actor_email: actor.email || null,
      actor_phone: actor.phone || null,
    })),
    actorColsSupported,
  });

  const { error: reErr } = await supabase
    .from("fixed_lights")
    .delete()
    .eq("tenant_key", tenantKey)
    .in("light_id", ids);

  if (reErr) {
    return {
      ok: false,
      error: reErr,
      errorMessage: "Couldn’t re-open this light.",
      actorColsSupported: insertResult.actorColsSupported,
      logError: insertResult.error || null,
    };
  }

  return {
    ok: true,
    ids,
    ts: Date.now(),
    actorColsSupported: insertResult.actorColsSupported,
    logError: insertResult.error || null,
  };
}

export async function emitIncidentStateChangeShared(args = {}) {
  const {
    supabase,
    tenantKey = "",
    incidentId = "",
    domainKey = "",
    nextState = "",
    changedBy = null,
    noteText = "",
    incidentLabel = "",
    previousState = "",
  } = args;
  const changedAt = new Date().toISOString();
  const { error } = await supabase.rpc("emit_incident_state_change_tenant", {
    p_tenant_key: tenantKey,
    p_incident_id: incidentId,
    p_domain: domainKey,
    p_new_state: nextState,
    p_changed_by: changedBy,
    p_source: "admin",
    p_metadata: {
      note: noteText || null,
      incident_label: incidentLabel || null,
      previous_state: previousState || null,
      source: "map_admin_status_update",
    },
  });
  if (error) {
    return {
      ok: false,
      error,
      errorMessage: String(error?.message || "Could not update incident state."),
    };
  }
  return {
    ok: true,
    changedAt,
  };
}

export async function upsertUtilityReportStatusShared(args = {}) {
  const {
    supabase,
    tenantKey = "",
    userId = "",
    incidentId = "",
    reportReference = "",
    normalizeUtilityReportReference,
    isMissingUtilityReportReferenceColumnError,
  } = args;
  const normalizedReference = normalizeUtilityReportReference(reportReference);
  let { error } = await supabase
    .from("utility_report_status")
    .upsert(
      [{
        tenant_key: tenantKey,
        user_id: userId,
        incident_id: incidentId,
        reported_at: new Date().toISOString(),
        report_reference: normalizedReference || null,
      }],
      { onConflict: "tenant_key,user_id,incident_id" }
    );
  if (error && isMissingUtilityReportReferenceColumnError(error)) {
    const fallback = await supabase
      .from("utility_report_status")
      .upsert(
        [{
          tenant_key: tenantKey,
          user_id: userId,
          incident_id: incidentId,
          reported_at: new Date().toISOString(),
        }],
        { onConflict: "tenant_key,user_id,incident_id" }
      );
    error = fallback.error || null;
  }
  if (error) {
    return {
      ok: false,
      error,
      errorMessage: error?.message || String(error || ""),
      normalizedReference,
    };
  }
  return {
    ok: true,
    normalizedReference,
  };
}

export async function clearUtilityReportStatusShared(args = {}) {
  const {
    supabase,
    tenantKey = "",
    userId = "",
    incidentId = "",
  } = args;
  const { error } = await supabase
    .from("utility_report_status")
    .delete()
    .eq("tenant_key", tenantKey)
    .eq("user_id", userId)
    .eq("incident_id", incidentId);
  if (error) {
    return {
      ok: false,
      error,
      errorMessage: error?.message || String(error || ""),
    };
  }
  return { ok: true };
}

export async function markUtilityReportedForViewerShared(context = {}, deps = {}) {
  const {
    supabase,
    tenantKey = "",
    sessionUserId = "",
    lightId = "",
    reportReference = "",
    utilityReportedLightIdSet,
    utilityReportReferenceByLightId,
    utilityReportedAtByLightId,
    setUtilityReportedLightIdSet,
    setUtilityReportedAtByLightId,
    setUtilityReportReferenceByLightId,
  } = context;
  const {
    normalizeUtilityReportReference,
    isMissingUtilityReportReferenceColumnError,
  } = deps;

  const lid = String(lightId || "").trim();
  const uid = String(sessionUserId || "").trim();
  if (!lid || !uid) return false;

  const normalizedReference = normalizeUtilityReportReference(reportReference);
  const hadReported = utilityReportedLightIdSet instanceof Set && utilityReportedLightIdSet.has(lid);
  const previousReference = String(utilityReportReferenceByLightId?.[lid] || "").trim();
  const previousReportedAt = Number(utilityReportedAtByLightId?.[lid] || 0);
  const nextReportedAt = Date.now();

  setUtilityReportedLightIdSet((prev) => {
    const next = new Set(prev || []);
    next.add(lid);
    return next;
  });
  setUtilityReportedAtByLightId((prev) => ({
    ...(prev || {}),
    [lid]: nextReportedAt,
  }));
  setUtilityReportReferenceByLightId((prev) => ({
    ...(prev || {}),
    [lid]: normalizedReference,
  }));

  const result = await upsertUtilityReportStatusShared({
    supabase,
    tenantKey,
    userId: uid,
    incidentId: lid,
    reportReference,
    normalizeUtilityReportReference,
    isMissingUtilityReportReferenceColumnError,
  });

  if (!result?.ok) {
    console.warn("[utility_report_status] upsert warning:", result?.errorMessage || result?.error);
    setUtilityReportedLightIdSet((prev) => {
      const next = new Set(prev || []);
      if (hadReported) next.add(lid);
      else next.delete(lid);
      return next;
    });
    setUtilityReportedAtByLightId((prev) => {
      const next = { ...(prev || {}) };
      if (hadReported) next[lid] = previousReportedAt;
      else delete next[lid];
      return next;
    });
    setUtilityReportReferenceByLightId((prev) => {
      const next = { ...(prev || {}) };
      if (hadReported) next[lid] = previousReference;
      else delete next[lid];
      return next;
    });
    return false;
  }

  return true;
}

export async function clearUtilityReportedForViewerShared(context = {}) {
  const {
    supabase,
    tenantKey = "",
    sessionUserId = "",
    lightId = "",
    setUtilityReportedLightIdSet,
    setUtilityReportedAtByLightId,
    setUtilityReportReferenceByLightId,
  } = context;

  const lid = String(lightId || "").trim();
  const uid = String(sessionUserId || "").trim();
  if (!lid || !uid) return;

  setUtilityReportedLightIdSet((prev) => {
    const next = new Set(prev || []);
    next.delete(lid);
    return next;
  });
  setUtilityReportedAtByLightId((prev) => {
    const next = { ...(prev || {}) };
    delete next[lid];
    return next;
  });
  setUtilityReportReferenceByLightId((prev) => {
    const next = { ...(prev || {}) };
    delete next[lid];
    return next;
  });

  const result = await clearUtilityReportStatusShared({
    supabase,
    tenantKey,
    userId: uid,
    incidentId: lid,
  });
  if (!result?.ok) {
    console.warn("[utility_report_status] clear warning:", result?.errorMessage || result?.error);
  }
}

async function hashSharedSecurityPinShared(userId, pin) {
  const normalizedUserId = String(userId || "").trim().toLowerCase();
  const normalizedPin = String(pin || "").trim();
  if (!normalizedUserId || !normalizedPin) return "";
  const payload = `platform-pin:${normalizedUserId}:${normalizedPin}`;
  try {
    if (typeof crypto !== "undefined" && crypto?.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
      return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // fallback below
  }
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(index);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
}

async function hashLegacyTenantSecurityPinShared(userId, tenantKey, pin) {
  const normalizedUserId = String(userId || "").trim().toLowerCase();
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  const normalizedPin = String(pin || "").trim();
  if (!normalizedUserId || !normalizedTenantKey || !normalizedPin) return "";
  const payload = `tenant-pin:${normalizedTenantKey}:${normalizedUserId}:${normalizedPin}`;
  try {
    if (typeof crypto !== "undefined" && crypto?.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
      return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // fallback below
  }
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(index);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
}

export async function markFixedForMapShared(context = {}, deps = {}) {
  const {
    supabase,
    tenantKey = "",
    light,
    noteText = "",
    options = {},
    actor = {},
    officialIdSet,
    actorColsSupportedRef,
    domainForIncidentId,
    incidentSnapshotKey,
    prefixedIncidentDomainKey,
    getIncidentDomainHelper,
    setFixedLights,
    setLastFixByLightId,
    setIncidentStateByKey,
    setActionsByLightId,
    setSelectedDomainMarker,
    openNotice,
  } = context;
  const { composeIncidentActionAuditNote } = deps;

  if (!light) return;

  const noteClean = String(noteText || "").trim();
  const actionNote = composeIncidentActionAuditNote(noteClean, {
    actorName: actor.name,
    actorEmail: actor.email,
    actorPhone: actor.phone,
    imageUrl: options?.imageUrl || "",
    imagePath: options?.imagePath || "",
    imageMimeType: options?.imageMimeType || "",
    imageFileName: options?.imageFileName || "",
    capturedAt: options?.capturedAt || "",
  });
  const mutation = await markIncidentFixedShared({
    supabase,
    tenantKey,
    light,
    actor,
    actionNote,
    officialIdSet,
    actorColsSupported: actorColsSupportedRef?.current,
  });
  if (actorColsSupportedRef) {
    actorColsSupportedRef.current = mutation?.actorColsSupported ?? actorColsSupportedRef.current;
  }
  if (!mutation?.ok) {
    console.error(mutation?.error);
    openNotice("⚠️", "Action failed", mutation?.errorMessage || "Action failed.");
    return false;
  }

  const { ids = [], fixMs } = mutation;

  setFixedLights((prev) => {
    const next = { ...prev };
    for (const id of ids) next[id] = fixMs;
    return next;
  });

  setLastFixByLightId((prev) => {
    const next = { ...prev };
    for (const id of ids) next[id] = fixMs;
    return next;
  });
  setIncidentStateByKey((prev) => {
    const next = { ...(prev || {}) };
    const nextIso = new Date(fixMs).toISOString();
    for (const id of ids) {
      const domainKey = domainForIncidentId(id);
      const key = incidentSnapshotKey(domainKey, id);
      if (!key) continue;
      next[key] = { state: "fixed", last_changed_at: nextIso };
    }
    return next;
  });
  setActionsByLightId((prev) => {
    const next = { ...(prev || {}) };
    for (const id of ids) {
      const list = Array.isArray(next[id]) ? [...next[id]] : [];
      list.unshift({
        action: "fix",
        ts: fixMs,
        note: actionNote,
        actor_user_id: actor.userId,
        actor_name: actor.name || null,
        actor_email: actor.email || null,
        actor_phone: actor.phone || null,
      });
      next[id] = list;
    }
    return next;
  });

  const idForMessage = String(ids?.[0] || "").trim();
  const incidentDomainKey = prefixedIncidentDomainKey(idForMessage);
  const incidentDomainHelper = getIncidentDomainHelper(incidentDomainKey);
  if (incidentDomainHelper.clearSelectedDomainMarkerOnFix) {
    setSelectedDomainMarker(null);
  }
  if (incidentDomainHelper.fixedNoticeMessage) {
    openNotice("✅", "Marked fixed", incidentDomainHelper.fixedNoticeMessage);
  } else if (idForMessage) {
    openNotice("✅", "Marked fixed", "Incident marked fixed.");
  }
  return true;
}

export async function reopenLightForMapShared(context = {}, deps = {}) {
  const {
    supabase,
    tenantKey = "",
    light,
    noteText = "",
    actor = {},
    actorColsSupportedRef,
    domainForIncidentId,
    incidentSnapshotKey,
    setFixedLights,
    setLastFixByLightId,
    setActionsByLightId,
    setIncidentStateByKey,
    openNotice,
  } = context;
  const { composeIncidentActionAuditNote } = deps;

  if (!light) return;

  const noteClean = String(noteText || "").trim();
  const actionNote = composeIncidentActionAuditNote(noteClean, {
    actorName: actor.name,
    actorEmail: actor.email,
    actorPhone: actor.phone,
  });
  const mutation = await reopenIncidentShared({
    supabase,
    tenantKey,
    light,
    actor,
    actionNote,
    actorColsSupported: actorColsSupportedRef?.current,
  });
  if (actorColsSupportedRef) {
    actorColsSupportedRef.current = mutation?.actorColsSupported ?? actorColsSupportedRef.current;
  }
  if (mutation?.logError) console.error(mutation.logError);
  if (!mutation?.ok) {
    console.error(mutation?.error);
    openNotice("⚠️", "Action failed", mutation?.errorMessage || "Couldn’t re-open this light.");
    return false;
  }

  const { ids = [], ts } = mutation;

  setFixedLights((prev) => {
    const next = { ...prev };
    for (const id of ids) delete next[id];
    return next;
  });

  setLastFixByLightId((prev) => {
    const next = { ...prev };
    for (const id of ids) delete next[id];
    return next;
  });
  setActionsByLightId((prev) => {
    const next = { ...(prev || {}) };
    for (const id of ids) {
      const list = Array.isArray(next[id]) ? [...next[id]] : [];
      list.unshift({
        action: "reopen",
        ts,
        note: actionNote,
        actor_user_id: actor.userId,
        actor_name: actor.name || null,
        actor_email: actor.email || null,
        actor_phone: actor.phone || null,
      });
      next[id] = list;
    }
    return next;
  });
  setIncidentStateByKey((prev) => {
    const next = { ...(prev || {}) };
    const tsIso = new Date().toISOString();
    for (const id of ids) {
      const domainKey = domainForIncidentId(id);
      const key = incidentSnapshotKey(domainKey, id);
      if (!key) continue;
      next[key] = { state: "reported", last_changed_at: tsIso };
    }
    return next;
  });
  openNotice("✅", "Reported again", "Incident returned to reported.");
  return true;
}

export function resetMarkFixedDialogStateShared(setters = {}) {
  setters.setMarkFixedConfirmOpen(false);
  setters.setPendingMarkFixedLightId(null);
  setters.setPendingMarkFixedClusterReports([]);
  setters.setPendingIncidentCompatMarker(null);
  setters.setPendingIncidentActionType("fix");
  setters.setPendingIncidentDomainKey("");
  setters.setPendingIncidentCurrentState("");
  setters.setPendingIncidentNextState("");
  setters.setPendingIncidentLabel("");
  setters.setPendingIncidentIsOfficialTarget(false);
  setters.setPendingIncidentPin("");
  setters.setPendingIncidentStatusError("");
  setters.setMarkFixedNote("");
  setters.setMarkFixedImageFile(null);
  setters.setMarkFixedSubmitting(false);
}

export function openIncidentStatusDialogShared(context = {}, deps = {}) {
  const {
    incidentId,
    domainKey,
    currentState = "",
    clusterReports = null,
    compatMarker = null,
    incidentLabel = "",
    isOfficial = false,
    domainForIncidentId,
    openNotice,
  } = context;
  const {
    normalizeDomainKeyOrSlug,
    setters = {},
  } = deps;

  const normalizedDomainKey = normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true }) || domainForIncidentId(incidentId);
  const normalizedIncidentId = String(incidentId || "").trim();
  if (!normalizedDomainKey || !normalizedIncidentId) return;

  const stateOptions = adminIncidentStateOptionsForDomain(currentState, normalizedDomainKey);
  if (!stateOptions.length) {
    openNotice("ℹ️", "No state changes available", "This incident has no editable states.");
    return;
  }

  setters.setPendingIncidentCompatMarker(compatMarker || null);
  setters.setPendingMarkFixedLightId(normalizedIncidentId);
  setters.setPendingMarkFixedClusterReports(Array.isArray(clusterReports) ? clusterReports : []);
  setters.setPendingIncidentDomainKey(normalizedDomainKey);
  setters.setPendingIncidentCurrentState(String(currentState || "").trim().toLowerCase());
  setters.setPendingIncidentNextState(stateOptions[0]);
  setters.setPendingIncidentActionType(stateOptions[0] === "fixed" ? "fix" : "status");
  setters.setPendingIncidentLabel(String(incidentLabel || "").trim());
  setters.setPendingIncidentIsOfficialTarget(Boolean(isOfficial));
  setters.setPendingIncidentPin("");
  setters.setPendingIncidentStatusError("");
  setters.setMarkFixedNote("");
  setters.setMarkFixedImageFile(null);
  setters.setMarkFixedConfirmOpen(true);
}

export function buildIncidentStatusDialogCompatOptionsShared(domainKeyRaw, context = {}, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    getIncidentDomainHelper,
    lookupIncidentIdForDomain,
    incidentDomainBuildCoordsDisplayId,
  } = deps;

  const normalizedDomainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!normalizedDomainKey) return null;
  const helper = getIncidentDomainHelper(normalizedDomainKey);
  if (typeof helper?.buildStatusDialogCompatOptions === "function") {
    return helper.buildStatusDialogCompatOptions(context, { domainKey: normalizedDomainKey, helper }) ?? null;
  }
  if (String(helper?.buildStatusDialogCompatMode || "").trim() === "lookup_official_marker") {
    const lookupId = lookupIncidentIdForDomain(normalizedDomainKey, context?.incidentId);
    if (!lookupId) return false;
    const lat = Number(context?.marker?.lat ?? context?.domainRecord?.lat ?? 0);
    const lng = Number(context?.marker?.lng ?? context?.domainRecord?.lng ?? 0);
    const externalIdFields = Array.isArray(helper?.buildStatusDialogCompatExternalIdFields)
      ? helper.buildStatusDialogCompatExternalIdFields.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
      : [];
    const externalIdFallbackMode = String(helper?.buildStatusDialogCompatExternalIdFallbackMode || "").trim();
    const externalIdField = String(helper?.buildStatusDialogCompatCompatMarkerExternalIdField || "").trim();
    const incidentField = String(helper?.buildStatusDialogCompatCompatMarkerIncidentField || "").trim();
    const externalId = externalIdFields
      .map((fieldName) => String(context?.marker?.[fieldName] || context?.domainRecord?.[fieldName] || "").trim())
      .find(Boolean)
      || (externalIdFallbackMode === "coords_display_id"
        ? incidentDomainBuildCoordsDisplayId(normalizedDomainKey, { lat, lng })
        : "");
    return {
      compatMarker: {
        incident_id: lookupId,
        ...(externalId ? { external_id: externalId, display_id: externalId } : {}),
        ...(incidentField ? { [incidentField]: lookupId } : {}),
        ...(externalIdField ? { [externalIdField]: externalId } : {}),
        lat,
        lng,
      },
    };
  }
  return null;
}

export function resolveIncidentStatusDialogCompatTargetShared(domainKeyRaw, context = {}, deps = {}) {
  const {
    resolveIncidentDomainHelperEntry,
    lookupIncidentIdForDomain,
    incidentDomainCanonicalIncidentId,
  } = deps;

  const resolved = resolveIncidentDomainHelperEntry(domainKeyRaw);
  if (!resolved) return null;
  if (typeof resolved.helper?.resolveStatusDialogCompatTarget === "function") {
    return resolved.helper.resolveStatusDialogCompatTarget(context, resolved) ?? null;
  }
  if (String(resolved.helper?.resolveStatusDialogCompatTargetMode || "").trim() === "canonical_incident_official") {
    const incidentFields = Array.isArray(resolved.helper?.resolveStatusDialogCompatTargetIncidentFields)
      ? resolved.helper.resolveStatusDialogCompatTargetIncidentFields.map((fieldName) => String(fieldName || "").trim()).filter(Boolean)
      : [];
    const lookupId = incidentFields
      .map((fieldName) => String(context?.compatMarker?.[fieldName] || "").trim())
      .find(Boolean)
      || lookupIncidentIdForDomain(resolved.domainKey, context?.incidentId);
    if (!lookupId) return null;
    const canonicalId = incidentDomainCanonicalIncidentId(resolved.domainKey, { incident_id: lookupId });
    if (!canonicalId) return null;
    return {
      incident_id: canonicalId,
      lightId: canonicalId,
      isOfficial: true,
    };
  }
  return null;
}

export async function markIncidentsFixedByIdsShared(context = {}) {
  const {
    isAdmin = false,
    ids = [],
    noteText = "",
    closeAnyPopup,
    suppressPopupsSafe,
    setDeleteCircleConfirmOpen,
    setSaving,
    markIncidentFixedByCanonicalId,
    setDeleteCircleDraft,
    setDeleteCircleNote,
    openNotice,
  } = context;

  if (!isAdmin) return;
  const uniqueIds = Array.from(new Set((ids || []).map((x) => String(x || "").trim()).filter(Boolean)));
  if (!uniqueIds.length) {
    openNotice("⚠️", "No incidents selected", "No report incidents were found in the selected circle.");
    return;
  }

  const noteClean = String(noteText || "").trim();
  closeAnyPopup();
  suppressPopupsSafe(1200);
  setDeleteCircleConfirmOpen(false);
  setSaving(true);
  try {
    for (const id of uniqueIds) {
      await markIncidentFixedByCanonicalId(id, noteClean);
    }
    setDeleteCircleDraft(null);
    setDeleteCircleNote("");
    openNotice(
      "✅",
      "Incidents marked fixed",
      `${uniqueIds.length} incident${uniqueIds.length === 1 ? "" : "s"} marked fixed.`
    );
  } catch (err) {
    console.error(err);
    openNotice("⚠️", "Couldn’t mark incidents fixed", err?.message || "Action failed.");
  } finally {
    setSaving(false);
  }
}

export async function submitPendingIncidentActionShared(context = {}, deps = {}) {
  const {
    supabase,
    tenantKey = "",
    sessionUserId = "",
    lid = "",
    domainKey = "",
    clusterReports = [],
    compatTarget = null,
    pendingIncidentIsOfficialTarget = false,
    noteText = "",
    nextState = "",
    currentState = "reported",
    actionImageFile = null,
    pin = "",
    pendingIncidentLabel = "",
    isMissingRelationError,
    setPendingIncidentStatusError,
    setMarkFixedSubmitting,
    markFixed,
    reopenLight,
    uploadIncidentActionImageIfAny,
    activeTenantKey,
    normalizeDomainKeyOrSlug,
    domainForIncidentId,
    setIncidentStateByKey,
    incidentSnapshotKey,
    openConfiguredNotice,
    resetMarkFixedDialogState,
  } = context;
  const normalizedIncidentId = String(lid || "").trim();
  const normalizedDomainKey = String(domainKey || "").trim();
  const normalizedNextState = String(nextState || "").trim().toLowerCase();
  const normalizedCurrentState = String(currentState || "").trim().toLowerCase() || "reported";
  const normalizedPin = String(pin || "").trim();
  const actionType = normalizedNextState === "reported" && normalizedCurrentState === "fixed"
    ? "reopen"
    : (normalizedNextState === "fixed" ? "fix" : "status");

  if (!normalizedIncidentId || !normalizedDomainKey || !normalizedNextState) return false;
  if (normalizedNextState === normalizedCurrentState) return false;
  if (!/^\d{4}$/.test(normalizedPin)) {
    setPendingIncidentStatusError("Enter your 4-digit PIN to continue.");
    return false;
  }

  setMarkFixedSubmitting(true);
  setPendingIncidentStatusError("");
  try {
    const pinSnapshot = await readReportStatePinSnapshotShared({
      supabase,
      sessionUserId,
      tenantKey,
      isMissingRelationError,
    });
    if (pinSnapshot.error) {
      const message = isMissingRelationError(pinSnapshot.error)
        ? "Security PIN tables are not available in this environment yet. Apply the latest Supabase migrations first."
        : String(pinSnapshot.error?.message || "Could not verify your security PIN.");
      setPendingIncidentStatusError(message);
      return false;
    }
    if (!pinSnapshot.pin_hash) {
      setPendingIncidentStatusError("Set your 4-digit PIN under Account Info before updating incident state.");
      return false;
    }

    const providedHash = pinSnapshot.pin_scope === "legacy_tenant"
      ? await hashLegacyTenantSecurityPinShared(sessionUserId, tenantKey, normalizedPin)
      : await hashSharedSecurityPinShared(sessionUserId, normalizedPin);
    if (providedHash !== String(pinSnapshot.pin_hash || "").trim()) {
      setPendingIncidentStatusError("PIN is incorrect.");
      return false;
    }

    let saved = false;

    if (normalizedNextState === "fixed" || (normalizedNextState === "reported" && normalizedCurrentState === "fixed")) {
      let imageUpload = null;
      if (actionImageFile) {
        const incidentIdForUpload = compatTarget?.lightId || normalizedIncidentId;
        imageUpload = typeof uploadIncidentActionImageIfAny === "function"
          ? await uploadIncidentActionImageIfAny(actionImageFile, incidentIdForUpload, actionType)
          : await uploadIncidentActionImageIfAnyShared(actionImageFile, incidentIdForUpload, actionType, {
              buildNativeSafeImageUploadPayload,
              extFromFileName,
              activeTenantKey,
              normalizeDomainKeyOrSlug,
              domainForIncidentId,
              supabase,
            });
      }

      if (compatTarget) {
        if (normalizedNextState === "reported" && normalizedCurrentState === "fixed") {
          saved = await reopenLight(compatTarget, noteText);
        } else {
          saved = await markFixed(compatTarget, noteText, {
            imageUrl: imageUpload?.publicUrl || "",
            imagePath: imageUpload?.path || "",
            imageMimeType: imageUpload?.contentType || "",
            imageFileName: imageUpload?.fileName || "",
            capturedAt: imageUpload?.capturedAt || "",
          });
        }
      } else {
        const clusterLight = pendingIncidentIsOfficialTarget
          ? { lightId: normalizedIncidentId, isOfficial: true }
          : { lightId: normalizedIncidentId, isOfficial: false, reports: clusterReports };
        if (normalizedNextState === "reported" && normalizedCurrentState === "fixed") {
          saved = await reopenLight(clusterLight, noteText);
        } else {
          saved = await markFixed(clusterLight, noteText, {
            imageUrl: imageUpload?.publicUrl || "",
            imagePath: imageUpload?.path || "",
            imageMimeType: imageUpload?.contentType || "",
            imageFileName: imageUpload?.fileName || "",
            capturedAt: imageUpload?.capturedAt || "",
          });
        }
      }
    } else {
      const mutation = await emitIncidentStateChangeShared({
        supabase,
        tenantKey,
        incidentId: normalizedIncidentId,
        domainKey: normalizedDomainKey,
        nextState: normalizedNextState,
        changedBy: sessionUserId || null,
        noteText,
        incidentLabel: pendingIncidentLabel || null,
        previousState: normalizedCurrentState || null,
      });
      if (!mutation?.ok) {
        setPendingIncidentStatusError(String(mutation?.errorMessage || "Could not update incident state."));
        return false;
      }
      const { changedAt } = mutation;
      setIncidentStateByKey((prev) => {
        const key = incidentSnapshotKey(normalizedDomainKey, normalizedIncidentId);
        if (!key) return prev;
        return {
          ...(prev || {}),
          [key]: { state: normalizedNextState, last_changed_at: changedAt },
        };
      });
      openConfiguredNotice("incident_state_updated", {
        icon: "✅",
        title: "State updated",
        message: "Incident state updated successfully.",
      }, {
        message: `Incident state updated to ${adminFacingIncidentStateLabel(normalizedNextState)}.`,
      });
      saved = true;
    }

    if (!saved) return false;
    await resetMarkFixedDialogState?.();
    return true;
  } catch (error) {
    console.error("[incident state action] submit failed:", error);
    setPendingIncidentStatusError(String(error?.message || "Please try again."));
    return false;
  } finally {
    setMarkFixedSubmitting(false);
  }
}
