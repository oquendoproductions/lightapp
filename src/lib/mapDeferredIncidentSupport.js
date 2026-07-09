export { buildSharedIncidentReportTarget } from "./mapIncidentReportTargetSupport.js";
import {
  isPlaceholderLocationText,
  isUsableAddressText,
} from "./mapPopupTextSupport.js";

export function buildSharedIncidentSubmitLocationFields({
  submitGeo = null,
  target = null,
  addressFallback = "Address unavailable",
} = {}) {
  return {
    nearestAddress:
      String(submitGeo?.nearestAddress || target?.nearestAddress || "").trim()
      || String(addressFallback || "").trim()
      || "Address unavailable",
    nearestLandmark: String(submitGeo?.nearestLandmark || target?.nearestLandmark || "").trim(),
    nearestCrossStreet: String(submitGeo?.nearestCrossStreet || target?.nearestCrossStreet || "").trim(),
    nearestIntersection: String(submitGeo?.nearestIntersection || target?.nearestIntersection || "").trim(),
  };
}

export function buildSharedIncidentSubmitGeoCachePayload({
  tenantKey = "",
  domain = "",
  incidentId = "",
  locationFields = {},
} = {}) {
  return {
    tenant_key: String(tenantKey || "").trim(),
    domain: String(domain || "").trim(),
    incident_id: String(incidentId || "").trim(),
    nearest_address: String(locationFields?.nearestAddress || "").trim() || null,
    nearest_cross_street: String(locationFields?.nearestCrossStreet || "").trim() || null,
    nearest_intersection: String(locationFields?.nearestIntersection || "").trim() || null,
    nearest_landmark: String(locationFields?.nearestLandmark || "").trim() || null,
  };
}

export function buildSharedIncidentSubmitEmailNoticeArgs({
  domainKey = "",
  domainLabel = "",
  issueTypeLabel = "",
  issueTypeFallback = "",
  reportNumber = "",
  notes = "",
  lat = Number.NaN,
  lng = Number.NaN,
  closestAddress = "",
  closestLandmark = "",
  closestCrossStreet = "",
  closestIntersection = "",
  submittedAtIso = "",
  reporter = null,
} = {}) {
  return {
    domainKey: String(domainKey || "").trim(),
    domainLabel: String(domainLabel || "").trim(),
    issueTypeLabel: String(issueTypeLabel || "").trim() || String(issueTypeFallback || "").trim(),
    typeOptions: [],
    reportNumber,
    notes,
    lat,
    lng,
    closestAddress,
    closestLandmark,
    closestCrossStreet,
    closestIntersection,
    submittedAtIso,
    reporter,
  };
}

export function buildSharedIncidentLocationCacheEntryPayload({
  nearestAddress = "",
  nearestCrossStreet = "",
  nearestIntersection = "",
  nearestLandmark = "",
  locationLabel = "",
} = {}) {
  return {
    nearestAddress: String(nearestAddress || "").trim(),
    nearestCrossStreet: String(nearestCrossStreet || "").trim(),
    nearestIntersection: String(nearestIntersection || "").trim(),
    nearestLandmark: String(nearestLandmark || "").trim(),
    locationLabel: String(locationLabel || "").trim(),
  };
}

export function buildSharedIncidentSavedLocationContext({
  insertedReportData = null,
  submitLat,
  submitLng,
  nearestAddress = "",
  target = null,
  hasUsableAddress = false,
} = {}) {
  const lat = Number(insertedReportData?.lat ?? submitLat);
  const lng = Number(insertedReportData?.lng ?? submitLng);
  const resolvedAddress = String(nearestAddress || "").trim();
  const fallbackLabel = String(
    target?.locationLabel
    || (Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "")
  ).trim();
  return {
    lat,
    lng,
    locationLabel: hasUsableAddress ? resolvedAddress : fallbackLabel,
  };
}

export async function invokeDomainEmailFunctionShared(payload, {
  tenantKey = "",
  functionUrlBase = "",
  publishableKey = "",
  fetchImpl = null,
  logLabel = "domain email notice",
} = {}) {
  const resolvedFetch = typeof fetchImpl === "function" ? fetchImpl : globalThis.fetch;
  if (typeof resolvedFetch !== "function") {
    return { ok: false, reason: "missing_fetch_impl", skipped: false };
  }
  if (!tenantKey) {
    return { ok: false, reason: "missing_tenant_key", skipped: false };
  }
  if (!functionUrlBase || !publishableKey) {
    return { ok: false, reason: "missing_supabase_function_config", skipped: false };
  }

  try {
    const res = await resolvedFetch(`${functionUrlBase}/functions/v1/email-domain-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        "x-tenant-key": tenantKey,
      },
      body: JSON.stringify({
        tenant_key: tenantKey,
        ...(payload && typeof payload === "object" ? payload : {}),
      }),
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const reason =
        String(data?.error || data?.reason || data?.message || `http_${res.status}`).trim()
        || `http_${res.status}`;
      console.warn(`[${logLabel}] http error:`, res.status, data || null);
      return { ok: false, reason, skipped: false };
    }

    const skipped = Boolean(data?.skipped);
    const ok = data?.ok !== false && !skipped;
    const reason = String(data?.reason || "").trim();
    if (!ok) {
      console.warn(`[${logLabel}] not sent:`, data);
    }
    return {
      ok,
      skipped,
      reason: reason || (skipped ? "skipped" : ""),
    };
  } catch (e) {
    console.warn(`[${logLabel}] invoke failed:`, e?.message || e);
    return { ok: false, reason: String(e?.message || "invoke_failed"), skipped: false };
  }
}

export async function resolveBufferedEmailLocationFieldsShared({
  closestAddress = "",
  closestLandmark = "",
  closestCrossStreet = "",
  closestIntersection = "",
  enrichmentPromise = null,
  waitMs = 5000,
} = {}, {
  setTimeoutImpl = null,
} = {}) {
  const resolvedSetTimeout =
    typeof setTimeoutImpl === "function"
      ? setTimeoutImpl
      : globalThis?.setTimeout;
  const baseFields = {
    closestAddress: String(closestAddress || "").trim(),
    closestLandmark: String(closestLandmark || "").trim(),
    closestCrossStreet: String(closestCrossStreet || "").trim(),
    closestIntersection: String(closestIntersection || "").trim(),
  };

  const hasPendingLocationField =
    !(typeof isUsableAddressText === "function" ? isUsableAddressText(baseFields.closestAddress) : Boolean(baseFields.closestAddress))
    || !baseFields.closestLandmark
    || (typeof isPlaceholderLocationText === "function" && isPlaceholderLocationText(baseFields.closestLandmark))
    || !baseFields.closestCrossStreet
    || (typeof isPlaceholderLocationText === "function" && isPlaceholderLocationText(baseFields.closestCrossStreet))
    || !baseFields.closestIntersection
    || (typeof isPlaceholderLocationText === "function" && isPlaceholderLocationText(baseFields.closestIntersection));
  if (!hasPendingLocationField || typeof enrichmentPromise?.then !== "function") {
    return baseFields;
  }

  try {
    const enrichedPayload = await Promise.race([
      Promise.resolve(enrichmentPromise).catch(() => null),
      new Promise((resolve) => {
        if (typeof resolvedSetTimeout === "function") {
          resolvedSetTimeout(() => resolve(null), waitMs);
          return;
        }
        resolve(null);
      }),
    ]);
    if (!enrichedPayload || typeof enrichedPayload !== "object") {
      return baseFields;
    }
    return {
      closestAddress:
        String(enrichedPayload?.nearestAddress || "").trim()
        || baseFields.closestAddress,
      closestLandmark:
        String(enrichedPayload?.nearestLandmark || "").trim()
        || baseFields.closestLandmark,
      closestCrossStreet:
        String(enrichedPayload?.nearestCrossStreet || "").trim()
        || baseFields.closestCrossStreet,
      closestIntersection:
        String(enrichedPayload?.nearestIntersection || "").trim()
        || baseFields.closestIntersection,
    };
  } catch {
    return baseFields;
  }
}

export async function loadPassiveStreetlightRuntimeSnapshotShared({
  publicReadClient = null,
  authedReadClient = null,
  tenantKey = "",
  reportsAdminView = false,
  preferScopedPublicReads = false,
} = {}, {
  selectTenantScopedPublicRows = null,
  isExpectedPermissionError = null,
} = {}) {
  const resolvedTenantKey = String(tenantKey || "").trim().toLowerCase();
  if (!resolvedTenantKey) {
    return {
      fixedMap: {},
      actionsByLightId: {},
      lastFixByLightId: {},
    };
  }

  const actionsSelectPublic = "id, light_id, action, created_at";
  const actionsSelectFull = "id, light_id, action, note, created_at, actor_user_id, actor_name, actor_email, actor_phone, reporter_user_id, reporter_name, reporter_email, reporter_phone";
  const [fixedResult, actionsResult] = await Promise.all([
    publicReadClient
      .from("fixed_lights")
      .select("*")
      .eq("tenant_key", resolvedTenantKey),
    reportsAdminView
      ? authedReadClient
          .from("light_actions")
          .select(actionsSelectFull)
          .eq("tenant_key", resolvedTenantKey)
          .order("created_at", { ascending: false })
      : typeof selectTenantScopedPublicRows === "function"
        ? selectTenantScopedPublicRows(
            publicReadClient,
            "light_actions_public",
            actionsSelectPublic,
            resolvedTenantKey,
            "created_at",
            { preferScopedClient: preferScopedPublicReads }
          )
        : Promise.resolve({ data: [], error: null }),
  ]);

  const fixedErr = fixedResult?.error || null;
  const actErr = actionsResult?.error || null;
  if (fixedErr && !(typeof isExpectedPermissionError === "function" && isExpectedPermissionError(fixedErr))) {
    console.warn("[streetlight runtime hydrate fixed] warning:", fixedErr?.message || fixedErr);
  }
  if (actErr && !(typeof isExpectedPermissionError === "function" && isExpectedPermissionError(actErr))) {
    console.warn("[streetlight runtime hydrate actions] warning:", actErr?.message || actErr);
  }

  const fixedMap = {};
  for (const row of fixedResult?.data || []) {
    const lightId = String(row?.light_id || "").trim();
    if (!lightId) continue;
    fixedMap[lightId] = new Date(row.fixed_at).getTime();
  }

  const actionsByLightId = {};
  const lastFixByLightId = {};
  if (!actErr) {
    for (const row of actionsResult?.data || []) {
      const lightId = String(row?.light_id || "").trim();
      if (!lightId) continue;
      const ts = new Date(row.created_at).getTime();
      if (!actionsByLightId[lightId]) actionsByLightId[lightId] = [];
      const noteContact = parseWorkingContactFromNote(row.note);
      const actorEmail = row.actor_email || row.reporter_email || noteContact.email || null;
      const actorPhone = row.actor_phone || row.reporter_phone || noteContact.phone || null;
      const actorUserId = row.actor_user_id || row.reporter_user_id || null;
      const actorNameRaw = (row.actor_name || row.reporter_name || noteContact.name || "").trim();
      const actorNameFallback = actorEmail ? String(actorEmail).split("@")[0] : "";
      actionsByLightId[lightId].push({
        action_id: row.id || null,
        action: row.action,
        ts,
        note: row.note || null,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        actor_phone: actorPhone,
        actor_name: actorNameRaw || actorNameFallback || null,
        reporter_user_id: row.reporter_user_id || actorUserId,
        reporter_name: (row.reporter_name || "").trim() || actorNameRaw || actorNameFallback || null,
        reporter_email: row.reporter_email || actorEmail,
        reporter_phone: row.reporter_phone || actorPhone,
      });
      if (String(row.action || "").toLowerCase() !== "fix") continue;
      if (!lastFixByLightId[lightId] || ts > lastFixByLightId[lightId]) {
        lastFixByLightId[lightId] = ts;
      }
    }
  }

  return {
    fixedMap,
    actionsByLightId,
    lastFixByLightId,
  };
}

export function schedulePassiveStreetlightRuntimeShared(state = {}, deps = {}) {
  let cancelled = false;
  let idleHandle = null;
  let timeoutHandle = null;

  const runLoad = async () => {
    try {
      const {
        fixedMap,
        actionsByLightId: nextActionsByLightId,
        lastFixByLightId: nextLastFixByLightId,
      } = await loadPassiveStreetlightRuntimeSnapshotShared(state, deps);
      if (cancelled) return;
      state.setFixedLights?.(fixedMap);
      state.setActionsByLightId?.(nextActionsByLightId);
      state.setLastFixByLightId?.((prev) => ({ ...(prev || {}), ...nextLastFixByLightId }));
      state.onHydrated?.();
    } catch (error) {
      if (!cancelled) {
        console.warn("[streetlight runtime hydrate] warning:", error?.message || error);
      }
    }
  };

  const idleTimeoutMs = state.idleTimeoutMs ?? 1800;
  const fallbackDelayMs = state.fallbackDelayMs ?? 240;

  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    idleHandle = window.requestIdleCallback(() => {
      idleHandle = null;
      if (!cancelled) void runLoad();
    }, { timeout: idleTimeoutMs });
  } else if (typeof window !== "undefined") {
    timeoutHandle = window.setTimeout(() => {
      timeoutHandle = null;
      if (!cancelled) void runLoad();
    }, fallbackDelayMs);
  } else {
    void runLoad();
  }

  return () => {
    cancelled = true;
    if (idleHandle != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle != null && typeof window !== "undefined") {
      window.clearTimeout(timeoutHandle);
    }
  };
}

export async function sendIncidentDomainEmailNoticeShared({
  domainKey,
  domainLabel,
  issueTypeLabel,
  typeOptions = [],
  reportNumber,
  notes,
  lat,
  lng,
  closestAddress,
  closestLandmark,
  closestCrossStreet,
  closestIntersection,
  submittedAtIso,
  reporter,
} = {}, {
  invokeDomainEmailFunction = null,
  resolveReportDomainLabel = null,
  tenantKey = "",
  functionUrlBase = "",
  publishableKey = "",
  fetchImpl = null,
} = {}) {
  const resolvedInvokeDomainEmailFunction =
    typeof invokeDomainEmailFunction === "function"
      ? invokeDomainEmailFunction
      : (payload, logLabel = "domain email notice") => invokeDomainEmailFunctionShared(payload, {
          tenantKey,
          functionUrlBase,
          publishableKey,
          fetchImpl,
          logLabel,
        });
  if (typeof resolvedInvokeDomainEmailFunction !== "function") {
    return { ok: false, reason: "missing_invoke_email_function", skipped: false };
  }
  const normalizedLat = Number(lat);
  const normalizedLng = Number(lng);
  const resolvedClosestAddress = String(closestAddress || "").trim();
  const resolvedClosestLandmark = String(closestLandmark || "").trim();
  const resolvedClosestCrossStreet = String(closestCrossStreet || "").trim();
  const resolvedClosestIntersection = String(closestIntersection || "").trim();

  return resolvedInvokeDomainEmailFunction({
    domain_key: String(domainKey || "").trim(),
    domainLabel: String(domainLabel || "").trim() || (
      typeof resolveReportDomainLabel === "function"
        ? resolveReportDomainLabel(domainKey, "Incident")
        : "Incident"
    ),
    issueType: String(issueTypeLabel || "").trim() || "",
    typeOptions: Array.isArray(typeOptions) ? typeOptions : [],
    reportNumber: String(reportNumber || "").trim(),
    notes: String(notes || "").trim(),
    location: {
      lat: normalizedLat,
      lng: normalizedLng,
      text: `${normalizedLat.toFixed(5)}, ${normalizedLng.toFixed(5)}`,
    },
    closestAddress: resolvedClosestAddress || "Address unavailable",
    closestLandmark: resolvedClosestLandmark || "No nearby landmark",
    closestCrossStreet: resolvedClosestCrossStreet || "No nearby cross street",
    closestIntersection: resolvedClosestIntersection || "No nearby intersection",
    submittedAtIso: String(submittedAtIso || new Date().toISOString()),
    submittedAtLocal: new Date(submittedAtIso || Date.now()).toLocaleString(),
    reporter: {
      type: reporter?.type === "guest" ? "guest" : "user",
      userId: reporter?.userId || null,
      name: String(reporter?.name || "").trim() || "Unknown",
      email: String(reporter?.email || "").trim() || "Not provided",
      phone: String(reporter?.phone || "").trim() || "Not provided",
    },
  }, "incident domain email notice");
}

export async function dispatchDomainSubmitEmailNoticeShared({
  domainKey,
  domainLabel = "",
  issueTypeLabel = "",
  typeOptions = [],
  reportNumber = "",
  notes = "",
  lat = Number.NaN,
  lng = Number.NaN,
  closestAddress = "",
  closestLandmark = "",
  closestCrossStreet = "",
  closestIntersection = "",
  enrichmentPromise = null,
  submittedAtIso = "",
  reporter = null,
} = {}, {
  normalizeDomainKeyOrSlug = null,
  sendIncidentDomainEmailNotice = null,
  resolveReportDomainLabel = null,
  emailLocationEnrichmentWaitMs = 5000,
  setTimeoutImpl = null,
  tenantKey = "",
  functionUrlBase = "",
  publishableKey = "",
  fetchImpl = null,
} = {}) {
  if (typeof normalizeDomainKeyOrSlug !== "function") return null;
  const normalizedDomainKey = normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true });
  if (!normalizedDomainKey) return null;

  const bufferedLocation = await resolveBufferedEmailLocationFieldsShared({
    closestAddress,
    closestLandmark,
    closestCrossStreet,
    closestIntersection,
    enrichmentPromise,
    waitMs: emailLocationEnrichmentWaitMs,
  }, {
    setTimeoutImpl,
  });

  if (typeof sendIncidentDomainEmailNotice === "function") {
    return sendIncidentDomainEmailNotice({
      domainKey: normalizedDomainKey,
      domainLabel: String(
        domainLabel
        || (typeof resolveReportDomainLabel === "function"
          ? resolveReportDomainLabel(normalizedDomainKey, "Incident")
          : "Incident")
      ).trim() || "Incident",
      issueTypeLabel,
      typeOptions: Array.isArray(typeOptions) ? typeOptions : [],
      reportNumber,
      notes,
      lat,
      lng,
      closestAddress: bufferedLocation.closestAddress,
      closestLandmark: bufferedLocation.closestLandmark,
      closestCrossStreet: bufferedLocation.closestCrossStreet,
      closestIntersection: bufferedLocation.closestIntersection,
      submittedAtIso,
      reporter,
    });
  }

  return sendIncidentDomainEmailNoticeShared({
    domainKey: normalizedDomainKey,
    domainLabel: String(
      domainLabel
      || (typeof resolveReportDomainLabel === "function"
        ? resolveReportDomainLabel(normalizedDomainKey, "Incident")
        : "Incident")
    ).trim() || "Incident",
    issueTypeLabel,
    typeOptions: Array.isArray(typeOptions) ? typeOptions : [],
    reportNumber,
    notes,
    lat,
    lng,
    closestAddress: bufferedLocation.closestAddress,
    closestLandmark: bufferedLocation.closestLandmark,
    closestCrossStreet: bufferedLocation.closestCrossStreet,
    closestIntersection: bufferedLocation.closestIntersection,
    submittedAtIso,
    reporter,
  }, {
    resolveReportDomainLabel,
    tenantKey,
    functionUrlBase,
    publishableKey,
    fetchImpl,
  });
}

export function notifyAsyncEmailDeliveryShared(domainLabel, noticeRes) {
  const label = String(domainLabel || "Report").trim();
  if (noticeRes?.ok) return;
  const reason = String(noticeRes?.reason || "").trim();
  if (noticeRes?.skipped) {
    console.info(`[${label} email notice] skipped by tenant config`);
    return;
  }
  console.warn(`[${label} email notice] not confirmed${reason ? ` (${reason})` : ""}`);
}

export async function submitIsWorkingShared(context = {}, deps = {}) {
  const {
    lightId,
    saving,
    session,
    guestSubmitBypassRef,
    guestInfoDraft,
    guestInfo,
    profile,
    officialLights,
  } = context;
  const {
    requestGuestChallenge,
    openNotice,
    normalizeEmail,
    setSaving,
    registerAbuseEventWithServer,
    openRateLimitNotice,
    normalizePhone,
    supabase,
    insertReportWithFallback,
    normalizeReportQuality,
    setReports,
    clearGuestContact,
    openReportSuccess,
  } = deps;

  const lid = String(lightId || "").trim();
  if (!lid || saving) return;

  const isAuthed = Boolean(session?.user?.id);
  const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
  if (!isAuthed && !usingGuestBypass) {
    requestGuestChallenge("working", lid);
    return;
  }
  const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
  if (usingGuestBypass) guestSubmitBypassRef.current = false;

  const name = isAuthed
    ? ((profile?.full_name || session?.user?.user_metadata?.full_name || "").trim() || "User")
    : (guestSource?.name || "");
  const phone = isAuthed ? (profile?.phone || "") : (guestSource?.phone || "");
  const email = isAuthed
    ? ((profile?.email || session?.user?.email) || "")
    : (guestSource?.email || "");

  if (!isAuthed && (!name.trim() || !normalizeEmail(email))) {
    requestGuestChallenge("working", lid);
    openNotice("⚠️", "Contact required", "Please add your name and email before submitting.");
    return;
  }

  setSaving(true);
  const abuseGate = await registerAbuseEventWithServer({
    session,
    profile,
    guestInfo: isAuthed ? null : { name, phone, email },
    domain: "streetlights",
    bypass: false,
  });
  if (!abuseGate.allowed) {
    setSaving(false);
    openRateLimitNotice(openNotice, abuseGate);
    return;
  }

  const normName = (name || "").trim() || null;
  const normEmail = normalizeEmail(email) || null;
  const normPhone = normalizePhone(phone) || null;
  const light = (officialLights || []).find((x) => String(x?.id || "").trim() === lid);
  const lat = Number(light?.lat);
  const lng = Number(light?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    setSaving(false);
    openNotice("⚠️", "Couldn’t save", "Could not locate this light.");
    return;
  }

  const { data: savedWorking, error: workingErr } = await insertReportWithFallback({
    lat,
    lng,
    report_domain: "streetlights",
    report_type: "working",
    report_quality: "good",
    note: null,
    light_id: lid,
    reporter_user_id: isAuthed ? session.user.id : null,
    reporter_name: normName,
    reporter_phone: normPhone,
    reporter_email: normEmail,
    report_type_candidates: ["working", "is_working", "reported_working"],
  });

  setSaving(false);

  if (!savedWorking) {
    console.error(workingErr);
    openNotice("⚠️", "Couldn’t save", workingErr?.message || "Could not record working report.");
    return;
  }

  setReports((prev) => {
    const incoming = {
      id: savedWorking.id,
      lat: savedWorking.lat,
      lng: savedWorking.lng,
      type: savedWorking.report_type,
      report_domain: "streetlights",
      domain: "streetlights",
      report_quality: normalizeReportQuality(savedWorking.report_quality) || "good",
      note: savedWorking.note || "",
      ts: new Date(savedWorking.created_at).getTime(),
      light_id: savedWorking.light_id || lid,
      report_number: savedWorking.report_number || null,
      reporter_user_id: savedWorking.reporter_user_id || null,
      reporter_name: savedWorking.reporter_name || normName,
      reporter_phone: savedWorking.reporter_phone || normPhone,
      reporter_email: savedWorking.reporter_email || normEmail,
    };
    if (prev.some((x) => x.id === incoming.id)) return prev;
    return [incoming, ...prev];
  });

  if (!isAuthed) clearGuestContact();
  openReportSuccess({
    kind: "incident",
    domainKey: "streetlights",
    title: "Working report saved",
    message: "This report is now visible in Reports for your records.",
    reportNumber: String(savedWorking.report_number || "").trim(),
    submittedAt: Date.parse(String(savedWorking.created_at || Date.now())) || Date.now(),
  });
}

export async function submitIncidentRepairConfirmationShared(context = {}, deps = {}) {
  const {
    incidentIdRaw,
    domainKeyRaw,
    saving,
    session,
    guestSubmitBypassRef,
    guestInfoDraft,
    guestInfo,
    profile,
    viewerIdentityKey,
  } = context;
  const {
    normalizeDomainKeyOrSlug,
    domainForIncidentId,
    isPublicRepairEnabledForDomain,
    openNotice,
    getIncidentRepairSnapshot,
    markIncidentRepairSignalOptimistically,
    requestGuestChallenge,
    normalizeEmail,
    reporterIdentityKey,
    setSaving,
    registerAbuseEventWithServer,
    openRateLimitNotice,
    supabase,
    activeTenantKey,
    refreshIncidentRepairProgress,
    clearGuestContact,
    openConfiguredNotice,
  } = deps;

  const incidentId = String(incidentIdRaw || "").trim();
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true }) || domainForIncidentId(incidentId);
  if (!incidentId || !domainKey || saving) return;

  if (!isPublicRepairEnabledForDomain(domainKey)) {
    openNotice("⚠️", "Repair confirmations unavailable", "This organization is handling repairs directly for this domain.");
    return;
  }

  const currentSnapshot = getIncidentRepairSnapshot(domainKey, incidentId);
  if (currentSnapshot?.archived) {
    openNotice("ℹ️", "Incident archived", "This incident has already been archived due to inactivity.");
    return;
  }
  if (currentSnapshot?.likelyFixed) {
    openNotice("ℹ️", "Already likely fixed", "Community repair confirmations already reached the fixed threshold.");
    return;
  }
  if (currentSnapshot?.viewerHasRepairSignal) {
    markIncidentRepairSignalOptimistically(domainKey, incidentId);
    openNotice("ℹ️", "Already confirmed", "You already marked this incident fixed.");
    return;
  }

  const isAuthed = Boolean(session?.user?.id);
  const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
  if (!isAuthed && !usingGuestBypass) {
    requestGuestChallenge("repair", incidentId, domainKey);
    return;
  }
  const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
  if (usingGuestBypass) guestSubmitBypassRef.current = false;

  const name = isAuthed
    ? ((profile?.full_name || session?.user?.user_metadata?.full_name || "").trim() || "User")
    : (guestSource?.name || "");
  const phone = isAuthed ? (profile?.phone || "") : (guestSource?.phone || "");
  const email = isAuthed
    ? ((profile?.email || session?.user?.email) || "")
    : (guestSource?.email || "");
  const identityGuestInfo = isAuthed ? null : { name, phone, email };

  if (!isAuthed && (!name.trim() || !normalizeEmail(email))) {
    requestGuestChallenge("repair", incidentId, domainKey);
    openNotice("⚠️", "Contact required", "Please add your name and email before confirming a repair.");
    return;
  }

  const identityKey = reporterIdentityKey({ session, profile, guestInfo: identityGuestInfo });
  if (!identityKey) {
    openNotice("⚠️", "Identity required", "Please add contact details before confirming a repair.");
    return;
  }

  setSaving(true);
  const abuseGate = await registerAbuseEventWithServer({
    session,
    profile,
    guestInfo: identityGuestInfo,
    domain: domainKey,
    bypass: false,
  });
  if (!abuseGate.allowed) {
    setSaving(false);
    openRateLimitNotice(openNotice, abuseGate);
    return;
  }

  const { error } = await supabase
    .from("incident_repair_signals")
    .insert([{
      tenant_key: activeTenantKey(),
      domain: domainKey,
      incident_id: incidentId,
      identity_hash: identityKey,
      reporter_user_id: isAuthed ? session.user.id : null,
    }]);
  setSaving(false);

  if (error) {
    const code = String(error?.code || "").trim();
    const msg = String(error?.message || "").toLowerCase();
    if (code === "23505" || msg.includes("duplicate")) {
      markIncidentRepairSignalOptimistically(domainKey, incidentId);
      await refreshIncidentRepairProgress(identityKey || viewerIdentityKey);
      openNotice("ℹ️", "Already confirmed", "You already marked this incident fixed.");
      return;
    }
    console.error("[incident_repair_signals] insert error:", error);
    openNotice("⚠️", "Couldn’t save", error.message || "Could not record repair confirmation.");
    return;
  }

  markIncidentRepairSignalOptimistically(domainKey, incidentId);
  await refreshIncidentRepairProgress(identityKey || viewerIdentityKey);
  if (!isAuthed) clearGuestContact();
  openConfiguredNotice("repair_confirmation_saved", {
    icon: "✅",
    title: "Repair confirmation saved",
    message: "Thanks. Community repair progress has been updated.",
  });
}

export function requestGuestChallengeRuntimeShared(kind, lightId = "", domainKey = "", deps = {}) {
  const setPendingGuestAction =
    typeof deps?.setPendingGuestAction === "function"
      ? deps.setPendingGuestAction
      : () => {};
  const setContactChoiceOpen =
    typeof deps?.setContactChoiceOpen === "function"
      ? deps.setContactChoiceOpen
      : () => {};

  setPendingGuestAction(
    kind === "working"
      ? { kind, lightId: String(lightId || "").trim() }
      : kind === "repair"
        ? {
            kind,
            incidentId: String(lightId || "").trim(),
            domainKey: String(domainKey || "").trim(),
          }
        : { kind }
  );
  setContactChoiceOpen(true);
}

export function resumePendingGuestActionRuntimeShared(state = {}, deps = {}) {
  const action = state?.pendingGuestAction || null;
  if (!action) return;

  const setPendingGuestAction =
    typeof deps?.setPendingGuestAction === "function"
      ? deps.setPendingGuestAction
      : () => {};
  const submitIsWorking =
    typeof deps?.submitIsWorking === "function"
      ? deps.submitIsWorking
      : () => {};
  const submitIncidentRepairConfirmation =
    typeof deps?.submitIncidentRepairConfirmation === "function"
      ? deps.submitIncidentRepairConfirmation
      : () => {};
  const submitBulkReports =
    typeof deps?.submitBulkReports === "function"
      ? deps.submitBulkReports
      : () => {};
  const submitDomainReport =
    typeof deps?.submitDomainReport === "function"
      ? deps.submitDomainReport
      : () => {};
  const submitReport =
    typeof deps?.submitReport === "function"
      ? deps.submitReport
      : () => {};
  const setTimeoutImpl =
    typeof deps?.setTimeoutImpl === "function"
      ? deps.setTimeoutImpl
      : globalThis?.setTimeout;

  setPendingGuestAction(null);
  if (typeof setTimeoutImpl !== "function") return;

  setTimeoutImpl(() => {
    if (action.kind === "working") {
      submitIsWorking(action.lightId || "");
      return;
    }
    if (action.kind === "repair") {
      submitIncidentRepairConfirmation(action.incidentId || "", action.domainKey || "");
      return;
    }
    if (action.kind === "bulk") {
      submitBulkReports();
      return;
    }
    if (action.kind === "domain") {
      submitDomainReport();
      return;
    }
    submitReport();
  }, 0);
}

export async function dispatchDomainSubmitEmailNoticeRuntimeShared(args = {}, deps = {}) {
  return dispatchDomainSubmitEmailNoticeShared(args, {
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    resolveReportDomainLabel: deps.resolveReportDomainLabel,
    emailLocationEnrichmentWaitMs: deps.emailLocationEnrichmentWaitMs,
    setTimeoutImpl: deps.setTimeoutImpl,
    tenantKey: deps.tenantKey,
    functionUrlBase: deps.functionUrlBase,
    publishableKey: deps.publishableKey,
    fetchImpl: deps.fetchImpl,
  });
}

export function notifyAsyncEmailDeliveryRuntimeShared(domainLabel, noticeRes) {
  notifyAsyncEmailDeliveryShared(domainLabel, noticeRes);
}

export function municipalBoundaryGateRuntimeShared(domainKey, lat, lng, options = {}, deps = {}) {
  const normalizeDomainKeyOrSlug =
    typeof deps?.normalizeDomainKeyOrSlug === "function"
      ? deps.normalizeDomainKeyOrSlug
      : () => "";
  const isTenantAssetBackedDomain =
    typeof deps?.isTenantAssetBackedDomain === "function"
      ? deps.isTenantAssetBackedDomain
      : () => false;
  const openNotice =
    typeof deps?.openNotice === "function"
      ? deps.openNotice
      : () => {};
  const isWithinAshtabulaCityLimits =
    typeof deps?.isWithinAshtabulaCityLimits === "function"
      ? deps.isWithinAshtabulaCityLimits
      : () => true;
  const cityLimitPolygons = Array.isArray(deps?.cityLimitPolygons) ? deps.cityLimitPolygons : [];
  const showNotice = options?.showNotice !== false;

  const domain = normalizeDomainKeyOrSlug(domainKey, { allowUnknown: true });
  if (!domain || isTenantAssetBackedDomain(domain)) return true;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
    if (showNotice) {
      openNotice("⚠️", "Location unavailable", "Could not validate the reporting boundary for this report.");
    }
    return false;
  }
  if (cityLimitPolygons.length <= 0) {
    console.warn("[municipalBoundaryGate] boundary unavailable; allowing submit without boundary check");
    return true;
  }
  if (!isWithinAshtabulaCityLimits(nLat, nLng)) {
    if (showNotice) {
      openNotice(
        "⚠️",
        "Outside reporting boundary",
        "This report must be placed inside the tenant boundary. It will not be submitted from outside the boundary."
      );
    }
    return false;
  }
  return true;
}

export function resumeSubmitIfPendingRuntimeShared(state = {}, deps = {}) {
  if (!state?.pendingSubmit) return;

  const setPendingSubmit =
    typeof deps?.setPendingSubmit === "function"
      ? deps.setPendingSubmit
      : () => {};
  const submitReport =
    typeof deps?.submitReport === "function"
      ? deps.submitReport
      : () => {};
  const setTimeoutImpl =
    typeof deps?.setTimeoutImpl === "function"
      ? deps.setTimeoutImpl
      : globalThis?.setTimeout;

  setPendingSubmit(false);
  if (typeof setTimeoutImpl !== "function") return;
  setTimeoutImpl(() => {
    submitReport();
  }, 0);
}

export function openConfirmForLightRuntimeShared(context = {}, deps = {}) {
  const isOfficial = context?.isOfficial === true;
  const lat = Number(context?.lat);
  const lng = Number(context?.lng);
  const lightId = context?.lightId;
  const reports = Array.isArray(context?.reports) ? context.reports : [];
  const mapZoom = Number(context?.mapZoom);
  const reportingMinZoom = Number.isFinite(Number(deps?.reportingMinZoom))
    ? Number(deps.reportingMinZoom)
    : 17;

  const openConfiguredNotice =
    typeof deps?.openConfiguredNotice === "function"
      ? deps.openConfiguredNotice
      : () => {};
  const setPicked =
    typeof deps?.setPicked === "function"
      ? deps.setPicked
      : () => {};
  const setActiveLight =
    typeof deps?.setActiveLight === "function"
      ? deps.setActiveLight
      : () => {};
  const setNote =
    typeof deps?.setNote === "function"
      ? deps.setNote
      : () => {};
  const setReportType =
    typeof deps?.setReportType === "function"
      ? deps.setReportType
      : () => {};
  const setStreetlightAreaPowerOn =
    typeof deps?.setStreetlightAreaPowerOn === "function"
      ? deps.setStreetlightAreaPowerOn
      : () => {};
  const setStreetlightHazardYesNo =
    typeof deps?.setStreetlightHazardYesNo === "function"
      ? deps.setStreetlightHazardYesNo
      : () => {};

  if (isOfficial && mapZoom < reportingMinZoom) {
    openConfiguredNotice("zoom_to_report", {
      icon: "🔎",
      title: "Zoom in to report",
      message: "To improve accuracy of marker placement, zoom in further to report.",
    });
    return;
  }
  setPicked([lat, lng]);
  setActiveLight({ lat, lng, lightId, isOfficial, reports });
  setNote("");
  setReportType("");
  setStreetlightAreaPowerOn("");
  setStreetlightHazardYesNo("");
}

export function handleStreetlightReportRealtimeInsertShared(row = null, deps = {}) {
  const r = row && typeof row === "object" ? row : {};
  const incoming = {
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    type: r.report_type,
    report_domain: deps.normalizeDomainKeyOrSlug(r.report_domain, { allowUnknown: true }) || null,
    domain: deps.normalizeDomainKeyOrSlug(r.report_domain, { allowUnknown: true }) || null,
    report_quality: deps.normalizeReportQuality(r.report_quality),
    note: r.note || "",
    ts: new Date(r.created_at).getTime(),
    light_id: r.light_id || deps.lightIdFor(r.lat, r.lng),
    report_number: r.report_number || null,
    reporter_user_id: r.reporter_user_id || null,
    reporter_name: r.reporter_name || null,
    reporter_phone: r.reporter_phone || null,
    reporter_email: r.reporter_email || null,
  };

  let inserted = false;
  deps.setReports((prev) => {
    if (prev.some((x) => x.id === incoming.id)) return prev;
    inserted = true;
    return [incoming, ...prev];
  });

  if (inserted) {
    const incomingDomainKey = deps.reportDomainForRow(incoming);
    if (
      incomingDomainKey
      && incomingDomainKey !== "streetlights"
      && !deps.isAssetBackedDomainType(incomingDomainKey, deps.resolveRuntimeDomainTypeForMap(incomingDomainKey))
    ) {
      deps.setSharedIncidentReportRowsStateByDomain((prev) => {
        const existingRows = Array.isArray(prev?.[incomingDomainKey]) ? prev[incomingDomainKey] : [];
        if (existingRows.some((item) => item?.id === incoming.id)) return prev;
        return {
          ...(prev || {}),
          [incomingDomainKey]: [incoming, ...existingRows],
        };
      });
      deps.setSharedIncidentBaseMarkersStateByDomain((prev) => {
        const existingMarkers = Array.isArray(prev?.[incomingDomainKey]) ? prev[incomingDomainKey] : [];
        const incomingMarkers = deps.buildGenericIncidentBaseMarkersForDomain(incomingDomainKey, [incoming]);
        if (!incomingMarkers.length) return prev;
        return {
          ...(prev || {}),
          [incomingDomainKey]: deps.mergeGenericIncidentBaseMarkers(existingMarkers, incomingMarkers),
        };
      });
    }
  }

  if (inserted && deps.officialIdSet.has(String(incoming.light_id || "").trim()) && deps.isOutageReportType(incoming)) {
    deps.setStreetlightOutageTsByLightId((prev) => {
      const lightId = String(incoming.light_id || "").trim();
      const ts = Number(incoming.ts || 0);
      if (!lightId || !Number.isFinite(ts) || ts <= 0) return prev;
      const existing = Array.isArray(prev?.[lightId]) ? prev[lightId] : [];
      if (existing.includes(ts)) return prev;
      return {
        ...(prev || {}),
        [lightId]: [ts, ...existing].sort((a, b) => b - a),
      };
    });
  }

  const incidentId = String(r?.light_id || "").trim();
  if (incidentId) {
    const nextIso = r?.created_at ? String(r.created_at) : new Date(incoming.ts || Date.now()).toISOString();
    deps.setIncidentStateByKey((prev) => {
      const key = deps.incidentSnapshotKey("streetlights", incidentId);
      if (!key) return prev;
      const prevIso = String(prev?.[key]?.last_changed_at || "");
      const prevTs = Date.parse(prevIso) || 0;
      const nextTs = Date.parse(nextIso) || 0;
      if (prevTs > nextTs) return prev;
      return {
        ...(prev || {}),
        [key]: { state: "reported", last_changed_at: nextIso },
      };
    });
  }
}

export function handleStreetlightActionRealtimeInsertShared(row = null, deps = {}) {
  const a = row && typeof row === "object" ? row : {};
  const ts = new Date(a.created_at).getTime();

  deps.setActionsByLightId((prev) => {
    const list = prev[a.light_id] ? [...prev[a.light_id]] : [];
    const noteContact = deps.parseWorkingContactFromNote(a.note);
    const actorEmail = a.actor_email || a.reporter_email || noteContact.email || null;
    const actorPhone = a.actor_phone || a.reporter_phone || noteContact.phone || null;
    const actorUserId = a.actor_user_id || a.reporter_user_id || null;
    const actorNameRaw = (a.actor_name || a.reporter_name || noteContact.name || "").trim();
    const actorNameFallback = actorEmail ? String(actorEmail).split("@")[0] : "";
    const incoming = {
      action_id: a.id || null,
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
    };
    const alreadyExists = list.some((x) => {
      const sameId = incoming.action_id && x?.action_id && String(x.action_id) === String(incoming.action_id);
      if (sameId) return true;
      return (
        String(x?.action || "").toLowerCase() === String(incoming.action || "").toLowerCase()
        && Number(x?.ts || 0) === Number(incoming.ts || 0)
        && String(x?.note || "") === String(incoming.note || "")
        && String(x?.actor_user_id || "") === String(incoming.actor_user_id || "")
      );
    });
    if (alreadyExists) return prev;
    list.unshift(incoming);
    return { ...prev, [a.light_id]: list };
  });

  const incidentId = String(a?.light_id || "").trim();
  const actionType = String(a.action || "").toLowerCase();
  if (actionType === "fix") {
    deps.setLastFixByLightId((prev) => {
      const cur = prev[a.light_id] || 0;
      if (ts <= cur) return prev;
      return { ...prev, [a.light_id]: ts };
    });
  } else if (actionType === "reopen") {
    deps.setLastFixByLightId((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev || {}, a.light_id)) return prev;
      const next = { ...(prev || {}) };
      delete next[a.light_id];
      return next;
    });
  } else {
    return;
  }

  if (incidentId) {
    const incidentDomain = deps.domainForIncidentId(incidentId);
    const nextIso = a?.created_at ? String(a.created_at) : new Date(ts || Date.now()).toISOString();
    deps.setIncidentStateByKey((prev) => {
      const key = deps.incidentSnapshotKey(incidentDomain, incidentId);
      if (!key) return prev;
      const prevIso = String(prev?.[key]?.last_changed_at || "");
      const prevTs = Date.parse(prevIso) || 0;
      const nextTs = Date.parse(nextIso) || 0;
      if (prevTs > nextTs) return prev;
      return {
        ...(prev || {}),
        [key]: { state: actionType === "fix" ? "fixed" : "reported", last_changed_at: nextIso },
      };
    });
  }
}
