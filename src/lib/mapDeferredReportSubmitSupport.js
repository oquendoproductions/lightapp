import { buildSharedIncidentSubmitLocationFields } from "./mapDeferredIncidentSupport.js";
import {
  buildNativeSafeImageUploadPayload,
  extFromFileName,
} from "./mapReportParsingDeferredSupport.js";
import { defaultDomainIssueValue } from "./mapDomainConfigSupport.js";
import { getIssueTypeOptionConfig } from "./mapDomainTypeOptionSupport.js";
import { normalizeDomainKeyOrSlug } from "./mapReportParsingSupport.js";
import {
  resolveRuntimeDomainAllowReportImagesShared,
  resolveRuntimeDomainIssueOptionsShared,
  resolveRuntimeDomainTypeOptionConfigsShared,
} from "./mapRuntimeDomainReportConfigSupport.js";
import {
  reportNumberForRowShared,
  resolveReportDomainLabelShared,
} from "./mapReportDisplaySupport.js";
import { resolveConfiguredDomainIssueLabelShared } from "./mapReportIssueLabelSupport.js";
import {
  composeStreetlightQaNote,
  isUsableAddressText,
} from "./mapPopupTextSupport.js";

const REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const COOLDOWNS_KEY = "streetlight_cooldowns_v1";

function pruneCooldownsShared(cooldowns) {
  const now = Date.now();
  const next = {};
  for (const [lightId, ts] of Object.entries(cooldowns || {})) {
    const t = Number(ts);
    if (!Number.isFinite(t)) continue;
    if (now - t <= REPORT_COOLDOWN_MS) next[lightId] = t;
  }
  return next;
}

function loadCooldownsFromStorageShared() {
  try {
    const raw = localStorage.getItem(COOLDOWNS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return pruneCooldownsShared(parsed);
  } catch {
    return {};
  }
}

function saveCooldownsToStorageShared(cooldowns) {
  try {
    localStorage.setItem(COOLDOWNS_KEY, JSON.stringify(pruneCooldownsShared(cooldowns)));
  } catch {
    // ignore
  }
}

function recordGuestCooldownShared(lightId) {
  const normalizedLightId = String(lightId || "").trim();
  if (!normalizedLightId) return;
  saveCooldownsToStorageShared({
    ...loadCooldownsFromStorageShared(),
    [normalizedLightId]: Date.now(),
  });
}

export function buildRoadValidatedSubmitGeoShared(target) {
  return {
    isRoad: true,
    label: String(target?.locationLabel || "").trim(),
    nearestAddress: String(target?.nearestAddress || "").trim(),
    nearestStreet: "",
    nearestCrossStreet: String(target?.nearestCrossStreet || "").trim(),
    nearestLandmark: String(target?.nearestLandmark || "").trim(),
    nearestIntersection: String(target?.nearestIntersection || "").trim(),
    snappedLat: Number(target?.lat),
    snappedLng: Number(target?.lng),
    distance: 0,
    validationUnavailable: false,
  };
}

export function buildRoadValidatedDomainTargetShared(target, roadCheck, options = {}) {
  const now = typeof options?.now === "function" ? options.now : Date.now;
  const sourceLat = Number.isFinite(Number(target?.sourceLat)) ? Number(target.sourceLat) : Number(target?.lat);
  const sourceLng = Number.isFinite(Number(target?.sourceLng)) ? Number(target.sourceLng) : Number(target?.lng);
  const submitLat = Number.isFinite(Number(roadCheck?.snappedLat)) ? Number(roadCheck.snappedLat) : Number(target?.lat);
  const submitLng = Number.isFinite(Number(roadCheck?.snappedLng)) ? Number(roadCheck.snappedLng) : Number(target?.lng);
  const nearestAddress = String(roadCheck?.nearestAddress || target?.nearestAddress || "").trim();
  const nearestLandmark = String(roadCheck?.nearestLandmark || target?.nearestLandmark || "").trim();
  const nearestCrossStreet = String(roadCheck?.nearestCrossStreet || target?.nearestCrossStreet || "").trim();
  const nearestIntersection = String(roadCheck?.nearestIntersection || target?.nearestIntersection || "").trim();
  const locationBase = nearestAddress || String(target?.locationLabel || "").trim() || `${submitLat.toFixed(5)}, ${submitLng.toFixed(5)}`;
  const locationLabel = nearestLandmark ? `${locationBase} (Near: ${nearestLandmark})` : locationBase;
  return {
    ...(target || {}),
    lat: submitLat,
    lng: submitLng,
    sourceLat,
    sourceLng,
    locationLabel,
    nearestAddress,
    nearestLandmark,
    nearestCrossStreet,
    nearestIntersection,
    roadValidated: true,
    roadValidatedAt: now(),
    roadValidationUnavailable: false,
  };
}

export async function validateAndPrepareRoadTargetShared(target, deps = {}) {
  const {
    reverseGeocodeRoadLabel,
    openConfiguredNotice,
  } = deps;
  const sourceLat = Number.isFinite(Number(target?.sourceLat)) ? Number(target.sourceLat) : Number(target?.lat);
  const sourceLng = Number.isFinite(Number(target?.sourceLng)) ? Number(target.sourceLng) : Number(target?.lng);
  if (!Number.isFinite(sourceLat) || !Number.isFinite(sourceLng)) return null;
  const roadCheck = await reverseGeocodeRoadLabel(sourceLat, sourceLng, {
    mode: "full",
    useRoadsApi: true,
    validationOnly: true,
    debugSource: "road-validation:map-tap",
  });
  if (roadCheck?.validationUnavailable) {
    if (typeof openConfiguredNotice === "function") {
      openConfiguredNotice("road_validation_unavailable", {
        icon: "⚠️",
        title: "Road validation unavailable",
        message: "Road validation is temporarily unavailable. Please try again.",
      });
    }
    return null;
  }
  if (!roadCheck?.isRoad) {
    if (typeof openConfiguredNotice === "function") {
      openConfiguredNotice("road_required", {
        icon: "⚠️",
        title: "Road required",
        message: "This report must be placed on a road. Tap directly on the road surface and try again.",
      });
    }
    return null;
  }
  return buildRoadValidatedDomainTargetShared(target, roadCheck);
}

export async function prepareDomainSubmitGeoAndImageShared(args = {}, deps = {}) {
  const {
    domainKeyRaw,
    target,
    roadRequired = false,
    modeWhenNotRoad = "quick",
    debugSource = "",
    reportKeyHint = "",
  } = args || {};
  const {
    incidentDomainSubmitGeoModeWhenNotRoad,
    incidentDomainSubmitDebugSource,
    incidentDomainResolveSubmitReportKeyHint,
    reverseGeocodeRoadLabel,
    domainReportImageFile,
    uploadDomainReportImageIfAny,
    activeTenantKey,
    supabase,
    openNotice,
    openConfiguredNotice,
  } = deps;

  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw || target?.domain, { allowUnknown: true })
    || String(domainKeyRaw || target?.domain || "").trim().toLowerCase();
  if (!domainKey || !target) return null;

  const resolvedModeWhenNotRoad = typeof incidentDomainSubmitGeoModeWhenNotRoad === "function"
    ? incidentDomainSubmitGeoModeWhenNotRoad(domainKey, modeWhenNotRoad || "quick")
    : (modeWhenNotRoad || "quick");
  const resolvedDebugSource = typeof incidentDomainSubmitDebugSource === "function"
    ? incidentDomainSubmitDebugSource(
        domainKey,
        String(debugSource || `submit:${domainKey}`).trim() || `submit:${domainKey}`
      )
    : (String(debugSource || `submit:${domainKey}`).trim() || `submit:${domainKey}`);
  const resolvedReportKeyHint = String(
    reportKeyHint
    || (
      typeof incidentDomainResolveSubmitReportKeyHint === "function"
        ? incidentDomainResolveSubmitReportKeyHint(domainKey, { target })
        : ""
    )
    || target?.incident_id
    || target?.lightId
    || ""
  ).trim();

  const submitGeoPromise = roadRequired
    ? Promise.resolve(
        buildRoadValidatedSubmitGeoShared(target)
      )
    : Promise.resolve(
        typeof reverseGeocodeRoadLabel === "function"
          ? reverseGeocodeRoadLabel(Number(target.lat), Number(target.lng), {
              mode: resolvedModeWhenNotRoad,
              useRoadsApi: false,
              debugSource: resolvedDebugSource,
            })
          : null
      );

  const domainImageUploadPromise = (
    resolveRuntimeDomainAllowReportImagesShared(domainKey)
    && domainReportImageFile
  )
    ? (
        typeof uploadDomainReportImageIfAny === "function"
          ? uploadDomainReportImageIfAny(
              domainReportImageFile,
              domainKey,
              resolvedReportKeyHint
            )
          : uploadDomainReportImageIfAnyShared(
              domainReportImageFile,
              domainKey,
              resolvedReportKeyHint,
              {
                buildNativeSafeImageUploadPayload,
                extFromFileName,
                activeTenantKey,
                supabase,
              }
            )
      ).catch((error) => {
        console.warn("[domain image upload] failed:", error?.message || error);
        if (typeof openNotice === "function") {
          openNotice("⚠️", "Image upload failed", "Your report will still submit, but the image could not be uploaded.");
        }
        return "";
      })
    : Promise.resolve("");

  const [submitGeo, imageUrl] = await Promise.all([submitGeoPromise, domainImageUploadPromise]);

  if (roadRequired && !submitGeo?.isRoad) {
    if (typeof openConfiguredNotice === "function") {
      openConfiguredNotice("road_required", {
        icon: "⚠️",
        title: "Road required",
        message: "This report must be placed on a road. Tap directly on the road surface and try again.",
      });
    }
    return null;
  }
  if (roadRequired && submitGeo?.validationUnavailable) {
    if (typeof openConfiguredNotice === "function") {
      openConfiguredNotice("road_validation_unavailable", {
        icon: "⚠️",
        title: "Road validation unavailable",
        message: "Road validation is temporarily unavailable. Please try again.",
      });
    }
    return null;
  }

  const submitLat = roadRequired && Number.isFinite(Number(submitGeo?.snappedLat))
    ? Number(submitGeo.snappedLat)
    : Number(target.lat);
  const submitLng = roadRequired && Number.isFinite(Number(submitGeo?.snappedLng))
    ? Number(submitGeo.snappedLng)
    : Number(target.lng);

  return {
    submitGeo,
    imageUrl,
    submitLat,
    submitLng,
  };
}

export function canRetryInsertWithoutSelectShared(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("select") ||
    msg.includes("violates row-level security policy")
  );
}

export function isMissingTenantKeyColumnErrorShared(err) {
  const msg = String(err?.message || "").toLowerCase();
  return msg.includes("tenant_key") && (msg.includes("does not exist") || msg.includes("schema cache"));
}

export function isMissingPublicSelectColumnErrorShared(err, columnName) {
  const normalizedColumnName = String(columnName || "").trim().toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  if (!normalizedColumnName || !msg) return false;
  return msg.includes(normalizedColumnName) && (msg.includes("does not exist") || msg.includes("schema cache"));
}

export async function submitConfiguredIncidentDomainViaFunctionShared(domainKeyRaw, payload, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    activeTenantKey,
    incidentDomainServiceSubmitFunctionName,
    supabase,
  } = deps;
  const domainKey = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : String(domainKeyRaw || "").trim().toLowerCase();
  const tenantKey = String(
    typeof activeTenantKey === "function" ? activeTenantKey() : ""
  ).trim().toLowerCase();
  const functionName = typeof incidentDomainServiceSubmitFunctionName === "function"
    ? incidentDomainServiceSubmitFunctionName(domainKey)
    : "";
  if (!tenantKey) {
    return { data: null, error: new Error("Missing tenant key for service submission.") };
  }
  if (!domainKey || !functionName) {
    return { data: null, error: new Error("Service submission is not configured for this domain.") };
  }
  try {
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: {
        tenant_key: tenantKey,
        domain_key: domainKey,
        ...(payload && typeof payload === "object" ? payload : {}),
      },
    });
    if (error) {
      return { data: null, error };
    }
    if (data?.ok === false) {
      return { data: null, error: new Error(String(data?.error || "Failed to submit service report.")) };
    }
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error(String(error || "Failed to submit service report.")),
    };
  }
}

export async function uploadDomainReportImageIfAnyShared(file, domainKey, reportKeyHint = "", deps = {}) {
  const {
    buildNativeSafeImageUploadPayload,
    extFromFileName,
    activeTenantKey,
    normalizeDomainKeyOrSlug,
    supabase,
    fileCtor = globalThis?.File,
  } = deps;
  const f = fileCtor && file instanceof fileCtor ? file : null;
  if (!f) return "";
  const uploadPayload = await buildNativeSafeImageUploadPayload(f);
  if (!uploadPayload?.body) return "";
  const tenantKey = typeof activeTenantKey === "function" ? activeTenantKey() : "";
  const domain = typeof normalizeDomainKeyOrSlug === "function"
    ? (normalizeDomainKeyOrSlug(domainKey || "general", { allowUnknown: true }) || "general")
    : (String(domainKey || "general").trim().toLowerCase() || "general");
  const ext = String(uploadPayload.ext || "").trim().toLowerCase() || extFromFileName(f.name, "jpg");
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 9);
  const keyHint = String(reportKeyHint || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  const path = `${tenantKey}/${domain}/${new Date().toISOString().slice(0, 10)}/${ts}_${keyHint || "report"}_${rand}.${ext}`;
  const { error: upErr } = await supabase.storage.from("report-images").upload(path, uploadPayload.body, {
    cacheControl: "3600",
    upsert: false,
    contentType: uploadPayload.contentType,
  });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("report-images").getPublicUrl(path);
  return String(data?.publicUrl || "").trim();
}

export async function uploadIncidentActionImageIfAnyShared(file, incidentIdRaw, actionType = "fix", deps = {}) {
  const {
    buildNativeSafeImageUploadPayload,
    extFromFileName,
    activeTenantKey,
    normalizeDomainKeyOrSlug,
    domainForIncidentId,
    supabase,
    fileCtor = globalThis?.File,
  } = deps;
  const f = fileCtor && file instanceof fileCtor ? file : null;
  if (!f) return null;
  const uploadPayload = await buildNativeSafeImageUploadPayload(f);
  if (!uploadPayload?.body) return null;
  const tenantKey = typeof activeTenantKey === "function" ? activeTenantKey() : "";
  const incidentId = String(incidentIdRaw || "").trim();
  const domain = typeof normalizeDomainKeyOrSlug === "function"
    ? (normalizeDomainKeyOrSlug(
        (typeof domainForIncidentId === "function" ? domainForIncidentId(incidentId) : "") || "streetlights",
        { allowUnknown: true }
      ) || "streetlights")
    : "streetlights";
  const ext = String(uploadPayload.ext || "").trim().toLowerCase() || extFromFileName(f.name, "jpg");
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 9);
  const incidentHint = incidentId.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 48) || "incident";
  const actionHint = String(actionType || "fix").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "fix";
  const path = `${tenantKey}/${domain}/incident-actions/${new Date().toISOString().slice(0, 10)}/${ts}_${actionHint}_${incidentHint}_${rand}.${ext}`;
  const contentType = uploadPayload.contentType;
  const { error: uploadError } = await supabase.storage.from("report-images").upload(path, uploadPayload.body, {
    cacheControl: "3600",
    upsert: false,
    contentType,
  });
  if (uploadError) throw uploadError;
  const { data } = supabase.storage.from("report-images").getPublicUrl(path);
  return {
    publicUrl: String(data?.publicUrl || "").trim(),
    path,
    contentType: contentType || "",
    fileName: String(f.name || "").trim(),
    capturedAt: new Date().toISOString(),
  };
}

export async function insertConfiguredIncidentDomainRecordWithFallbackShared(domainKeyRaw, kindRaw, payload, tenantKey, options = {}, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    incidentDomainConfiguredSourceTable,
    incidentDomainConfiguredSelectFields,
    incidentDomainConfiguredLookupField,
    canRetryInsertWithoutSelect,
    createTenantScopedReadClient,
    supabase,
    incidentDomainConfiguredLookupIdentityFields,
  } = deps;
  const domainKey = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : String(domainKeyRaw || "").trim().toLowerCase();
  const kind = String(kindRaw || "seeded").trim().toLowerCase();
  if (!domainKey) {
    return { data: null, error: new Error("Incident domain key is required.") };
  }
  const tableName = incidentDomainConfiguredSourceTable(domainKey, kind);
  const selectFields = incidentDomainConfiguredSelectFields(domainKey, kind);
  const lookupField = incidentDomainConfiguredLookupField(domainKey, kind);
  if (!tableName || !selectFields || !lookupField) {
    return { data: null, error: new Error(`${kind} source is not configured for ${domainKey}.`) };
  }

  const first = await supabase
    .from(tableName)
    .insert([payload])
    .select(selectFields)
    .single();

  if (!first.error) return { data: first.data, error: null };

  if (!canRetryInsertWithoutSelect(first.error)) {
    return { data: null, error: first.error };
  }

  const plain = await supabase.from(tableName).insert([payload]);
  if (plain.error) return { data: null, error: plain.error };

  const readClient = createTenantScopedReadClient(tenantKey) || supabase;
  let lookupQuery = readClient
    .from(tableName)
    .select(selectFields)
    .eq("tenant_key", tenantKey)
    .eq(lookupField, payload?.[lookupField])
    .order("created_at", { ascending: false })
    .limit(1);

  for (const field of incidentDomainConfiguredLookupIdentityFields(domainKey, kind)) {
    if (payload?.[field]) {
      lookupQuery = lookupQuery.eq(field, payload[field]);
      break;
    }
  }

  const lookup = await lookupQuery.maybeSingle();
  if (lookup.error || !lookup.data) {
    if (typeof options?.buildLookupFallbackData === "function") {
      return { data: options.buildLookupFallbackData(), error: null };
    }
    return {
      data: null,
      error: lookup.error || new Error(String(options?.lookupFailureMessage || "The newly created record could not be loaded.")),
    };
  }

  return { data: lookup.data, error: null };
}

export async function insertConfiguredIncidentDomainSeededWithFallbackShared(domainKeyRaw, payload, tenantKey, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    insertConfiguredIncidentDomainRecordWithFallback,
    incidentDomainSeededInsertLookupFailureMessage,
  } = deps;
  const domainKey = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : String(domainKeyRaw || "").trim().toLowerCase();
  return insertConfiguredIncidentDomainRecordWithFallback(domainKey, "seeded", payload, tenantKey, {
    lookupFailureMessage:
      incidentDomainSeededInsertLookupFailureMessage(domainKey)
      || `The new ${String(domainKey || "incident").replace(/_/g, " ")} location could not be loaded.`,
  });
}

export async function insertConfiguredIncidentDomainReportWithFallbackShared(domainKeyRaw, payload, tenantKey, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    insertConfiguredIncidentDomainRecordWithFallback,
    incidentDomainBuildReportLookupFallbackData,
  } = deps;
  const domainKey = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : String(domainKeyRaw || "").trim().toLowerCase();
  return insertConfiguredIncidentDomainRecordWithFallback(domainKey, "reports", payload, tenantKey, {
    buildLookupFallbackData: () => (
      incidentDomainBuildReportLookupFallbackData(domainKey, { payload })
      || {
        id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        created_at: new Date().toISOString(),
        ...payload,
      }
    ),
  });
}

export async function insertReportWithFallbackShared(payload, deps = {}) {
  const {
    supabase,
    canRetryInsertWithoutSelect,
  } = deps;
  const extraTypeCandidates = Array.isArray(payload?.report_type_candidates)
    ? payload.report_type_candidates
    : [];
  const tryValues = [payload.report_type, ...extraTypeCandidates]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  if (payload.report_type === "downed_pole") {
    tryValues.push("pole_down");
    tryValues.push("downed-pole");
  }

  let lastErr = null;

  for (const rt of tryValues) {
    const { report_type_candidates, ...payloadBase } = payload || {};
    const attempt = { ...payloadBase, report_type: rt };
    const canReadInsertedRow = Boolean(attempt.reporter_user_id);
    let data = null;
    let insErr = null;

    if (canReadInsertedRow) {
      const first = await supabase
        .from("reports")
        .insert([attempt])
        .select("*")
        .single();
      data = first.data;
      insErr = first.error;

      if (insErr && String(insErr.message || "").toLowerCase().includes("report_quality")) {
        const { report_quality, ...withoutQuality } = attempt;
        const second = await supabase
          .from("reports")
          .insert([withoutQuality])
          .select("*")
          .single();
        data = second.data;
        insErr = second.error;
      }
    } else {
      let plain = await supabase.from("reports").insert([attempt]);
      if (plain.error && String(plain.error.message || "").toLowerCase().includes("report_quality")) {
        const { report_quality, ...withoutQuality } = attempt;
        plain = await supabase.from("reports").insert([withoutQuality]);
      }
      if (!plain.error) {
        return {
          data: {
            id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            created_at: new Date().toISOString(),
            ...attempt,
          },
          usedReportType: rt,
        };
      }
      insErr = plain.error;
    }

    if (!insErr) return { data, usedReportType: rt };

    if (canRetryInsertWithoutSelect(insErr)) {
      let plain = await supabase.from("reports").insert([attempt]);
      if (plain.error && String(plain.error.message || "").toLowerCase().includes("report_quality")) {
        const { report_quality, ...withoutQuality } = attempt;
        plain = await supabase.from("reports").insert([withoutQuality]);
      }
      if (!plain.error) {
        return {
          data: {
            id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            created_at: new Date().toISOString(),
            ...attempt,
          },
          usedReportType: rt,
        };
      }
    }

    lastErr = insErr;
  }

  return { data: null, error: lastErr };
}

export async function submitStreetlightReportShared(context = {}, deps = {}) {
  const {
    picked,
    saving,
    activeLight,
    session,
    guestSubmitBypassRef,
    guestInfoDraft,
    guestInfo,
    reportType,
    streetlightIssueOptions,
    note,
    profile,
    officialIdSet,
    officialLights,
    streetlightConfidenceByLightId,
    reports,
    fixedLights,
    lastFixByLightId,
    streetlightAreaPowerOn,
    streetlightHazardYesNo,
  } = context;
  const {
    isStreetlightOtherIssue,
    requestGuestChallenge,
    openNotice,
    normalizeEmail,
    canIdentityReportLight,
    setActiveLight,
    setPicked,
    setSaving,
    registerAbuseEventWithServer,
    openRateLimitNotice,
    reverseGeocodeRoadLabel,
    supabase,
    activeTenantKey,
    setOfficialLights,
    normalizeDomainKeyOrSlug,
    runtimeDomainMeta,
    resolveStoredStreetlightReportType,
    insertReportWithFallback,
    normalizeReportQuality,
    setReports,
    clearGuestContact,
    closeAnyPopup,
    suppressMapClickRef,
    openReportSuccess,
    setNote,
    setStreetlightAreaPowerOn,
    setStreetlightHazardYesNo,
    lightIdFor,
  } = deps;

  if (!picked || saving || !activeLight) return;

  const lightId = activeLight.lightId || lightIdFor(picked[0], picked[1]);
  const isAuthed = Boolean(session?.user?.id);
  const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
  if (!isAuthed && !usingGuestBypass) {
    requestGuestChallenge("report");
    return;
  }
  const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
  if (usingGuestBypass) guestSubmitBypassRef.current = false;

  const selectedStreetlightIssueValue = String(
    reportType || defaultDomainIssueValue("streetlights", streetlightIssueOptions)
  ).trim().toLowerCase();
  if (isStreetlightOtherIssue(selectedStreetlightIssueValue, streetlightIssueOptions) && !String(note || "").trim()) {
    openNotice("⚠️", "Notes required", "Please add a brief note for “Other”.");
    return;
  }

  const authedEmail = session?.user?.email || "";
  const authedName =
    (profile?.full_name || "").trim() ||
    (session?.user?.user_metadata?.full_name || "").trim() ||
    (authedEmail ? authedEmail.split("@")[0] : "User");

  const name = isAuthed ? authedName : (guestSource.name || "");
  const phone = isAuthed ? (profile?.phone || "") : (guestSource.phone || "");
  const email = isAuthed
    ? ((profile?.email || authedEmail) || "")
    : (guestSource.email || "");

  if (!isAuthed) {
    if (!name.trim() || !normalizeEmail(email)) {
      requestGuestChallenge("report");
      setSaving(false);
      return;
    }
  }

  const identityGuestInfo = isAuthed ? null : { name, phone, email };
  const normalizedLightId = String(lightId || "").trim();
  const hasTenantOfficialLight = Boolean(
    normalizedLightId && (officialIdSet?.has?.(normalizedLightId) || officialLights.some((row) => String(row?.id || "").trim() === normalizedLightId))
  );
  if (!hasTenantOfficialLight) {
    openNotice(
      "⚠️",
      "Streetlight unavailable",
      "This streetlight does not belong to the current tenant. Please refresh the map and try again."
    );
    setActiveLight(null);
    setPicked(null);
    return;
  }

  const allowRepeatAfterArchive =
    String(streetlightConfidenceByLightId?.[lightId]?.state || "").trim().toLowerCase() === "archived";
  if (!canIdentityReportLight(lightId, {
    session,
    profile,
    guestInfo: identityGuestInfo,
    reports,
    fixedLights,
    lastFixByLightId,
    allowRepeatAfterArchive,
  })) {
    openNotice("⏳", "Already reported", "You already reported this light. You can report again after it is marked fixed.");
    setActiveLight(null);
    setPicked(null);
    return;
  }

  setSaving(true);
  const abuseGate = await registerAbuseEventWithServer({
    session,
    profile,
    guestInfo: identityGuestInfo,
    domain: "streetlights",
    bypass: false,
  });
  if (!abuseGate.allowed) {
    setSaving(false);
    openRateLimitNotice(openNotice, abuseGate);
    return;
  }

  if (activeLight?.isOfficial && lightId) {
    const existing = (officialLights || []).find((x) => String(x?.id || "").trim() === String(lightId || "").trim());
    const hasCachedGeo =
      Boolean(String(existing?.nearest_address || "").trim()) ||
      Boolean(String(existing?.nearest_cross_street || "").trim()) ||
      Boolean(String(existing?.nearest_landmark || "").trim());
    if (!hasCachedGeo && Number.isFinite(Number(picked?.[0])) && Number.isFinite(Number(picked?.[1]))) {
      try {
        const geo = await reverseGeocodeRoadLabel(Number(picked[0]), Number(picked[1]), {
          mode: "full",
          debugSource: "submit:streetlight-official-cache",
        });
        const nearestAddress = String(geo?.nearestAddress || "").trim();
        const nearestCrossStreet = String(geo?.nearestCrossStreet || "").trim();
        const nearestLandmark = String(geo?.nearestLandmark || "").trim();
        if (nearestAddress || nearestCrossStreet || nearestLandmark) {
          const { error: cacheErr } = await supabase.functions.invoke("cache-official-light-geo", {
            body: {
              tenant_key: activeTenantKey(),
              domain: "streetlights",
              incident_id: lightId,
              light_id: lightId,
              nearest_address: nearestAddress || null,
              nearest_cross_street: nearestCrossStreet || null,
              nearest_landmark: nearestLandmark || null,
            },
          });
          if (cacheErr) {
            console.warn("[cache-official-light-geo] non-fatal error:", cacheErr);
          }
          setOfficialLights((prev) => (prev || []).map((row) => {
            if (String(row?.id || "").trim() !== String(lightId || "").trim()) return row;
            return {
              ...row,
              nearest_address: nearestAddress || row?.nearest_address || "",
              nearest_cross_street: nearestCrossStreet || row?.nearest_cross_street || "",
              nearest_landmark: nearestLandmark || row?.nearest_landmark || "",
            };
          }));
        }
      } catch {
        // non-fatal
      }
    }
  }

  const selectedStreetlightIssueLabel = resolveConfiguredDomainIssueLabelShared(
    "streetlights",
    selectedStreetlightIssueValue,
    streetlightIssueOptions,
    {
      normalizeDomainKeyOrSlug,
      runtimeDomainMeta,
    }
  );
  const storedStreetlightReportType = resolveStoredStreetlightReportType(selectedStreetlightIssueValue, streetlightIssueOptions);
  const payload = {
    lat: picked[0],
    lng: picked[1],
    report_domain: "streetlights",
    report_type: storedStreetlightReportType,
    report_quality: "bad",
    note: composeStreetlightQaNote(note, streetlightAreaPowerOn, streetlightHazardYesNo, selectedStreetlightIssueLabel) || null,
    light_id: lightId,
    reporter_user_id: isAuthed ? session.user.id : null,
    reporter_name: name.trim(),
    reporter_phone: phone.trim() || null,
    reporter_email: email.trim() || null,
  };

  const { data, error: insErr } = await insertReportWithFallback(payload);

  if (insErr) {
    console.error(insErr);
    setActiveLight(null);
    setPicked(null);
    openNotice("⚠️", "Couldn’t submit", "Something went wrong while submitting your report. Please try again.");
    setSaving(false);
    return;
  }

  const saved = {
    id: data.id,
    lat: data.lat,
    lng: data.lng,
    type: data.report_type,
    report_domain: "streetlights",
    domain: "streetlights",
    report_quality: normalizeReportQuality(data.report_quality) || "bad",
    note: data.note || "",
    ts: new Date(data.created_at).getTime(),
    light_id: data.light_id || lightId,
    report_number: data.report_number || null,
    reporter_user_id: data.reporter_user_id || null,
    reporter_name: data.reporter_name || null,
    reporter_phone: data.reporter_phone || null,
    reporter_email: data.reporter_email || null,
  };

  setReports((prev) => [saved, ...prev]);

  if (!session?.user?.id) {
    recordGuestCooldownShared(lightId);
  }

  setActiveLight(null);
  setPicked(null);
  setNote("");
  setStreetlightAreaPowerOn("");
  setStreetlightHazardYesNo("");
  setSaving(false);
  if (!isAuthed) clearGuestContact();

  closeAnyPopup();
  setTimeout(() => closeAnyPopup(), 0);
  suppressMapClickRef.current.until = Date.now() + 900;

  openReportSuccess({
    kind: "streetlight",
    domainKey: "streetlights",
    title: "Light saved",
    message: "This light is now in Reports so you can follow it and report it to the utility.",
    reportNumber: saved.report_number || "",
    submittedAt: saved.ts || Date.now(),
  });
}

export async function submitBulkStreetlightReportsShared(context = {}, deps = {}) {
  const {
    saving,
    mapZoomRef,
    mapZoom,
    bulkSelectedIds,
    session,
    guestSubmitBypassRef,
    guestInfoDraft,
    guestInfo,
    profile,
    reportType,
    streetlightIssueOptions,
    note,
    streetlightAreaPowerOn,
    streetlightHazardYesNo,
    streetlightConfidenceByLightId,
    reports,
    fixedLights,
    lastFixByLightId,
    officialLights,
  } = context;
  const {
    isStreetlightOtherIssue,
    resolveStoredStreetlightReportType,
    reportMinZoom,
    openConfiguredNotice,
    openNotice,
    bulkMaxLightsPerSubmit,
    requestGuestChallenge,
    normalizeEmail,
    normalizeDomainKeyOrSlug,
    runtimeDomainMeta,
    setSaving,
    registerAbuseEventWithServer,
    openRateLimitNotice,
    closeAnyPopup,
    suppressPopupsSafe,
    canIdentityReportLight,
    insertReportWithFallback,
    normalizeReportQuality,
    setReports,
    setBulkConfirmOpen,
    clearBulkSelection,
    setNote,
    setStreetlightAreaPowerOn,
    setStreetlightHazardYesNo,
    clearGuestContact,
    openReportSuccess,
  } = deps;

  if (saving) return;

  if (Number(mapZoomRef.current || mapZoom) < reportMinZoom) {
    openConfiguredNotice("zoom_to_report", {
      icon: "🔎",
      title: "Zoom in to report",
      message: "To improve accuracy of marker placement, zoom in further to report.",
    });
    return;
  }

  const ids = bulkSelectedIds;
  if (!ids.length) return;
  if (ids.length > bulkMaxLightsPerSubmit) {
    openNotice("⚠️", "Selection limit", `You can submit up to ${bulkMaxLightsPerSubmit} lights in one bulk report.`);
    return;
  }

  const isAuthed = Boolean(session?.user?.id);
  const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
  if (!isAuthed && !usingGuestBypass) {
    requestGuestChallenge("bulk");
    return;
  }
  const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
  if (usingGuestBypass) guestSubmitBypassRef.current = false;

  const authedEmail = session?.user?.email || "";
  const authedName =
    (profile?.full_name || "").trim() ||
    (session?.user?.user_metadata?.full_name || "").trim() ||
    (authedEmail ? authedEmail.split("@")[0] : "User");

  const name = isAuthed ? authedName : (guestSource.name || "");
  const phone = isAuthed ? (profile?.phone || "") : (guestSource.phone || "");
  const email = isAuthed ? ((profile?.email || authedEmail) || "") : (guestSource.email || "");

  if (!isAuthed) {
    if (!name.trim() || !normalizeEmail(email)) {
      requestGuestChallenge("bulk");
      return;
    }
  }

  const selectedStreetlightIssueValue = String(
    reportType || defaultDomainIssueValue("streetlights", streetlightIssueOptions)
  ).trim().toLowerCase();
  if (isStreetlightOtherIssue(selectedStreetlightIssueValue, streetlightIssueOptions) && !String(note || "").trim()) {
    openNotice("⚠️", "Notes required", "Please add a brief note for “Other”.");
    return;
  }

  const selectedStreetlightIssueLabel = resolveConfiguredDomainIssueLabelShared(
    "streetlights",
    selectedStreetlightIssueValue,
    streetlightIssueOptions,
    {
      normalizeDomainKeyOrSlug,
      runtimeDomainMeta,
    }
  );
  const storedStreetlightReportType = resolveStoredStreetlightReportType(selectedStreetlightIssueValue, streetlightIssueOptions);

  setSaving(true);
  const abuseGate = await registerAbuseEventWithServer({
    session,
    profile,
    guestInfo: isAuthed ? null : { name, phone, email },
    domain: "streetlights",
    count: 1,
    unitCount: ids.length,
    bypass: false,
  });
  if (!abuseGate.allowed) {
    setSaving(false);
    openRateLimitNotice(openNotice, abuseGate);
    return;
  }

  closeAnyPopup();
  suppressPopupsSafe(1600);

  let okCount = 0;
  let skipAlreadyReported = 0;
  const bulkReportNumbers = [];
  let lastBulkSubmitTs = 0;

  for (const lightId of ids) {
    const identityGuestInfo = isAuthed ? null : { name, phone, email };
    const allowRepeatAfterArchive =
      String(streetlightConfidenceByLightId?.[lightId]?.state || "").trim().toLowerCase() === "archived";
    if (!canIdentityReportLight(lightId, {
      session,
      profile,
      guestInfo: identityGuestInfo,
      reports,
      fixedLights,
      lastFixByLightId,
      allowRepeatAfterArchive,
    })) {
      skipAlreadyReported += 1;
      continue;
    }

    const ol = officialLights.find((x) => x.id === lightId);
    if (!ol) continue;

    const payload = {
      lat: ol.lat,
      lng: ol.lng,
      report_domain: "streetlights",
      report_type: storedStreetlightReportType,
      report_quality: "bad",
      note: composeStreetlightQaNote(note, streetlightAreaPowerOn, streetlightHazardYesNo, selectedStreetlightIssueLabel) || null,
      light_id: lightId,
      reporter_user_id: isAuthed ? session.user.id : null,
      reporter_name: name.trim(),
      reporter_phone: phone.trim() || null,
      reporter_email: email.trim() || null,
    };

    const { data, error: insErr } = await insertReportWithFallback(payload);
    if (insErr) {
      console.error(insErr);
      continue;
    }

    okCount += 1;
    const saved = {
      id: data.id,
      lat: data.lat,
      lng: data.lng,
      type: data.report_type,
      report_domain: "streetlights",
      domain: "streetlights",
      report_quality: normalizeReportQuality(data.report_quality) || "bad",
      note: data.note || "",
      ts: new Date(data.created_at).getTime(),
      light_id: data.light_id || lightId,
      report_number: data.report_number || null,
      reporter_user_id: data.reporter_user_id || null,
      reporter_name: data.reporter_name || null,
      reporter_phone: data.reporter_phone || null,
      reporter_email: data.reporter_email || null,
    };
    if (String(saved.report_number || "").trim()) {
      bulkReportNumbers.push(String(saved.report_number || "").trim());
    }
    lastBulkSubmitTs = Math.max(lastBulkSubmitTs, Number(saved.ts || 0));

    setReports((prev) => [saved, ...prev]);

    if (!session?.user?.id) {
      recordGuestCooldownShared(lightId);
    }
  }

  setSaving(false);
  setBulkConfirmOpen(false);
  clearBulkSelection();
  setNote("");
  setStreetlightAreaPowerOn("");
  setStreetlightHazardYesNo("");
  if (!isAuthed) clearGuestContact();

  if (okCount > 0) {
    openReportSuccess({
      kind: "incident",
      domainKey: "streetlights",
      title: "Reports saved",
      message: `Saved ${okCount} report${okCount === 1 ? "" : "s"} to My Reports.`,
      reportNumbers: bulkReportNumbers,
      submittedAt: lastBulkSubmitTs || Date.now(),
    });
  } else if (skipAlreadyReported > 0) {
    openNotice("⏳", "Already reported", "Some selected lights were already reported by you and are waiting to be marked fixed.");
  } else {
    openNotice("⚠️", "No reports submitted", "Nothing was submitted. Try again.");
  }
}

export function createConfiguredIncidentDomainSubmitSupportShared(deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    resolveIncidentDomainHelperEntry,
    incidentDomainNormalizePayloadIncidentId,
    incidentDomainNormalizePersistenceIncidentId,
    incidentDomainBuildCoordsDisplayId,
    nearestSeededIncidentForPoint,
    potholeMergeRadiusMeters = 5,
    runtimeDomainMeta,
    getIncidentDomainHelper,
    reportDomainFromLightId,
    incidentDomainUpsertConfiguredSeededState,
    incidentDomainPrependConfiguredReportState,
    buildSharedIncidentSubmitGeoCachePayload,
    buildSharedIncidentLocationCacheEntryPayload,
    buildSharedIncidentSavedLocationContext,
    incidentDomainApplyPersistedLocationCacheState,
    activeTenantKey,
    supabase,
    persistIncidentLocationCacheWithEnrichment,
  } = deps;

  function buildSubmitAliasContext(domainKeyRaw, context = {}) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    const incidentId = String(context?.incidentId || "").trim();
    const externalId = String(context?.externalId || "").trim();
    const seededRows = Array.isArray(context?.seededRows) ? context.seededRows : [];
    const serviceSeededData = context?.serviceSeededData ?? null;
    const insertedSeededData = context?.insertedSeededData ?? null;
    if (!domainKey) return { ...(context || {}) };
    return {
      ...(context || {}),
      incidentId,
      externalId,
      seededRows,
      serviceSeededData,
      insertedSeededData,
      fallbackIncidentId: incidentId,
      fallbackExternalId: externalId,
      existingExternalId: externalId,
    };
  }

  function normalizeConfiguredNearbySubmitResult(domainKeyRaw, result = null) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey || !result || typeof result !== "object") {
      return { incidentId: "", externalId: "" };
    }
    return {
      incidentId: String(result?.incidentId || "").trim(),
      externalId: String(result?.externalId || "").trim(),
    };
  }

  function normalizeConfiguredServiceSubmitResult(domainKeyRaw, result = null) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey || !result || typeof result !== "object") {
      return { seeded: null, report: null, incidentId: "", externalId: "" };
    }
    return {
      seeded: result?.seeded || null,
      report: result?.report || null,
      incidentId: String(result?.incidentId || "").trim(),
      externalId: String(result?.externalId || "").trim(),
    };
  }

  function normalizeConfiguredInsertedLocationCommit(domainKeyRaw, locationCommit = null) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey || !locationCommit || typeof locationCommit !== "object") {
      return { incidentId: "", externalId: "" };
    }
    return {
      incidentId: String(locationCommit?.resolvedIds?.incidentId || "").trim(),
      externalId: String(locationCommit?.resolvedIds?.externalId || "").trim(),
    };
  }

  function buildSubmitReportPayload(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    const incidentIdField = String(resolved.helper?.submitReportPayloadIncidentIdField || "").trim();
    if (!incidentIdField) return null;
    const incidentIdNormalizeMode = String(resolved.helper?.submitReportPayloadIncidentIdNormalizeMode || "").trim();
    const normalizedIncidentId = typeof incidentDomainNormalizePayloadIncidentId === "function"
      ? incidentDomainNormalizePayloadIncidentId(
          resolved.domainKey,
          context?.incidentId,
          incidentIdNormalizeMode
        )
      : String(context?.incidentId || "").trim();
    return {
      ...(incidentIdField ? { [incidentIdField]: normalizedIncidentId } : {}),
      lat: Number(context?.submitLat),
      lng: Number(context?.submitLng),
      note: String(context?.note || "").trim() || null,
      reporter_user_id: context?.reporterUserId || null,
      reporter_name: String(context?.reporterName || "").trim(),
      reporter_phone: String(context?.reporterPhone || "").trim() || null,
      reporter_email: String(context?.reporterEmail || "").trim() || null,
    };
  }

  async function buildSubmitGeoCachePayload(domainKeyRaw, context = {}) {
    const normalizedDomainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    if (!normalizedDomainKey || typeof buildSharedIncidentSubmitGeoCachePayload !== "function") return null;
    const helper = typeof getIncidentDomainHelper === "function"
      ? getIncidentDomainHelper(normalizedDomainKey)
      : null;
    const normalizeMode = String(helper?.normalizeSubmitGeoCacheIncidentIdMode || "").trim();
    const normalizedIncidentId = typeof helper?.normalizeSubmitGeoCacheIncidentId === "function"
      ? String(helper.normalizeSubmitGeoCacheIncidentId(context) || "").trim()
      : normalizeMode === "normalized_persistence_id"
        ? (typeof incidentDomainNormalizePersistenceIncidentId === "function"
          ? incidentDomainNormalizePersistenceIncidentId(normalizedDomainKey, context?.incidentId)
          : String(context?.incidentId || "").trim())
        : String(context?.incidentId || "").trim();
    return buildSharedIncidentSubmitGeoCachePayload({
      tenantKey: context?.tenantKey,
      domain: normalizedDomainKey,
      incidentId: normalizedIncidentId,
      locationFields: context?.locationFields,
    });
  }

  function buildServiceSubmitPayload(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    const incidentIdField = String(resolved.helper?.serviceSubmitPayloadIncidentIdField || "").trim();
    const incidentIdNormalizeMode = String(resolved.helper?.serviceSubmitPayloadIncidentIdNormalizeMode || "").trim();
    const externalIdField = String(resolved.helper?.serviceSubmitPayloadExternalIdField || "").trim();
    const locationLabelField = String(resolved.helper?.serviceSubmitPayloadLocationLabelField || "").trim();
    const addressField = String(resolved.helper?.serviceSubmitPayloadAddressField || "").trim();
    const crossStreetField = String(resolved.helper?.serviceSubmitPayloadCrossStreetField || "").trim();
    const landmarkField = String(resolved.helper?.serviceSubmitPayloadLandmarkField || "").trim();
    const createdByField = String(resolved.helper?.serviceSubmitPayloadCreatedByField || "").trim();
    if (!(incidentIdField || externalIdField || locationLabelField || addressField || crossStreetField || landmarkField || createdByField)) {
      return null;
    }
    const normalizedIncidentId = typeof incidentDomainNormalizePayloadIncidentId === "function"
      ? incidentDomainNormalizePayloadIncidentId(
          resolved.domainKey,
          context?.fallbackIncidentId,
          incidentIdNormalizeMode
        )
      : String(context?.fallbackIncidentId || "").trim();
    const fallbackExternalId = String(context?.fallbackExternalId || "").trim()
      || (typeof incidentDomainBuildCoordsDisplayId === "function"
        ? incidentDomainBuildCoordsDisplayId(resolved.domainKey, {
            incidentId: context?.fallbackIncidentId,
            lat: Number(context?.submitLat),
            lng: Number(context?.submitLng),
          })
        : "");
    return {
      ...(incidentIdField ? { [incidentIdField]: normalizedIncidentId } : {}),
      ...(externalIdField ? { [externalIdField]: fallbackExternalId || null } : {}),
      lat: Number(context?.submitLat),
      lng: Number(context?.submitLng),
      ...(locationLabelField ? {
        [locationLabelField]: String(context?.locationFields?.nearestAddress || "").trim() || "Address unavailable",
      } : {}),
      ...(addressField ? {
        [addressField]: String(context?.locationFields?.nearestAddress || "").trim() || "Address unavailable",
      } : {}),
      ...(crossStreetField ? {
        [crossStreetField]: String(context?.locationFields?.nearestCrossStreet || "").trim() || null,
      } : {}),
      ...(landmarkField ? {
        [landmarkField]: String(context?.locationFields?.nearestLandmark || "").trim() || null,
      } : {}),
      note: context?.reportPayload?.note || null,
      reporter_user_id: context?.reportPayload?.reporter_user_id || null,
      reporter_name: context?.reportPayload?.reporter_name || null,
      reporter_phone: context?.reportPayload?.reporter_phone || null,
      reporter_email: context?.reportPayload?.reporter_email || null,
      ...(createdByField ? { [createdByField]: context?.createdBy || null } : {}),
    };
  }

  function applyServiceSubmitResult(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (typeof resolved.helper?.applyServiceSubmitResult === "function") {
      return resolved.helper.applyServiceSubmitResult(context, resolved) || null;
    }
    const seededField = String(resolved.helper?.serviceSubmitResultSeededField || "").trim();
    const reportField = String(resolved.helper?.serviceSubmitResultReportField || "").trim();
    const incidentIdField = String(resolved.helper?.serviceSubmitResultIncidentIdField || "").trim();
    const externalIdField = String(resolved.helper?.serviceSubmitResultExternalIdField || "").trim();
    if (!(seededField || reportField || incidentIdField || externalIdField)) return null;
    if (context?.result?.error) return null;
    const report = reportField ? (context?.result?.data?.[reportField] || null) : null;
    if (!report) return null;
    const seeded = seededField ? (context?.result?.data?.[seededField] || null) : null;
    return {
      seeded,
      report,
      incidentId: String(seeded?.[incidentIdField] || context?.fallbackIncidentId || "").trim(),
      externalId: String(
        seeded?.[externalIdField]
        || context?.fallbackExternalId
        || context?.existingExternalId
        || ""
      ).trim(),
    };
  }

  function buildLocationInsertPayload(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    const externalIdField = String(resolved.helper?.locationInsertPayloadExternalIdField || "").trim();
    const locationLabelField = String(resolved.helper?.locationInsertPayloadLocationLabelField || "").trim();
    const createdByField = String(resolved.helper?.locationInsertPayloadCreatedByField || "").trim();
    if (!(externalIdField || locationLabelField || createdByField)) return null;
    const externalId = String(context?.externalId || "").trim()
      || (typeof incidentDomainBuildCoordsDisplayId === "function"
        ? incidentDomainBuildCoordsDisplayId(resolved.domainKey, {
            incidentId: context?.incidentId,
            lat: Number(context?.submitLat),
            lng: Number(context?.submitLng),
          })
        : "");
    return {
      ...(externalIdField ? { [externalIdField]: externalId || null } : {}),
      lat: Number(context?.submitLat),
      lng: Number(context?.submitLng),
      ...(locationLabelField ? {
        [locationLabelField]: String(context?.locationFields?.nearestAddress || "").trim() || null,
      } : {}),
      ...(createdByField ? { [createdByField]: context?.createdBy || null } : {}),
    };
  }

  async function buildLocationCacheEntryPayload(domainKeyRaw, context = {}) {
    if (typeof buildSharedIncidentLocationCacheEntryPayload !== "function") return null;
    return buildSharedIncidentLocationCacheEntryPayload(context);
  }

  async function buildSavedLocationContext(domainKeyRaw, context = {}) {
    if (typeof buildSharedIncidentSavedLocationContext !== "function") return null;
    return buildSharedIncidentSavedLocationContext({
      insertedReportData: context?.insertedReportData,
      submitLat: context?.submitLat,
      submitLng: context?.submitLng,
      nearestAddress: context?.nearestAddress,
      target: context?.target,
      hasUsableAddress: typeof isUsableAddressText === "function"
        ? isUsableAddressText(context?.nearestAddress)
        : Boolean(String(context?.nearestAddress || "").trim()),
    });
  }

  function buildInsertedLocationRecord(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (typeof resolved.helper?.buildInsertedLocationRecord === "function") {
      return resolved.helper.buildInsertedLocationRecord(context, resolved) || null;
    }
    const incidentId = String(context?.incidentId || "").trim();
    if (!incidentId) return null;
    const externalIdField = String(resolved.helper?.insertedLocationRecordExternalIdField || "").trim();
    const serviceSeededData = context?.serviceSeededData || null;
    const insertedSeededData = context?.insertedSeededData || null;
    const externalId = String(
      context?.externalId
      || serviceSeededData?.[externalIdField]
      || insertedSeededData?.[externalIdField]
      || ""
    ).trim();
    return {
      id: incidentId,
      incident_id: incidentId || null,
      ...(externalIdField ? { [externalIdField]: externalId || null } : {}),
      ...(externalId ? { external_id: externalId, display_id: externalId } : {}),
      domain: resolved.domainKey,
      domain_key: resolved.domainKey,
      lat: Number(serviceSeededData?.lat ?? insertedSeededData?.lat ?? context?.submitLat),
      lng: Number(serviceSeededData?.lng ?? insertedSeededData?.lng ?? context?.submitLng),
      location_label: String(
        serviceSeededData?.location_label
        || insertedSeededData?.location_label
        || ""
      ).trim() || null,
    };
  }

  function buildPersistedLocationIds(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (typeof resolved.helper?.buildPersistedLocationIds === "function") {
      return resolved.helper.buildPersistedLocationIds(context, resolved) || null;
    }
    const incidentIdField = String(resolved.helper?.insertedLocationIdsIncidentIdField || "").trim();
    const externalIdField = String(resolved.helper?.insertedLocationIdsExternalIdField || "").trim();
    if (!(incidentIdField || externalIdField)) return null;
    return {
      incidentId: String(
        context?.serviceSeededData?.[incidentIdField]
        || context?.insertedSeededData?.[incidentIdField]
        || context?.incidentId
        || ""
      ).trim(),
      externalId: String(
        context?.serviceSeededData?.[externalIdField]
        || context?.insertedSeededData?.[externalIdField]
        || context?.externalId
        || ""
      ).trim(),
    };
  }

  function buildSavedReportRecord(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (typeof resolved.helper?.buildSavedReportRecord === "function") {
      return resolved.helper.buildSavedReportRecord(context, resolved) || null;
    }
    const incidentIdField = String(resolved.helper?.savedReportRecordIncidentIdField || "").trim();
    const insertedReportData = context?.insertedReportData || null;
    if (!insertedReportData?.id || !incidentIdField) return null;
    const resolvedIncidentId = String(insertedReportData?.[incidentIdField] || context?.incidentId || "").trim();
    return {
      id: insertedReportData?.id,
      incident_id: resolvedIncidentId,
      [incidentIdField]: resolvedIncidentId,
      domain: resolved.domainKey,
      domain_key: resolved.domainKey,
      lat: Number(insertedReportData?.lat),
      lng: Number(insertedReportData?.lng),
      note: insertedReportData?.note || String(context?.fallbackNote || "").trim() || "",
      report_number: insertedReportData?.report_number || null,
      ts: new Date(insertedReportData?.created_at).getTime(),
      reporter_user_id: insertedReportData?.reporter_user_id || null,
      reporter_name: insertedReportData?.reporter_name || null,
      reporter_phone: insertedReportData?.reporter_phone || null,
      reporter_email: insertedReportData?.reporter_email || null,
    };
  }

  function resolveNearbySubmitIncident(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (typeof resolved.helper?.resolveNearbySubmitIncident === "function") {
      return resolved.helper.resolveNearbySubmitIncident(context, resolved) || null;
    }
    const mode = String(resolved.helper?.resolveNearbySubmitIncidentMode || "").trim();
    if (mode === "nearest_seeded_row_if_missing_incident") {
      const resolvedIncidentId = String(context?.incidentId || "").trim();
      const resolvedExternalId = String(context?.externalId || "").trim();
      if (resolvedIncidentId) {
        return {
          incidentId: resolvedIncidentId,
          externalId: resolvedExternalId,
        };
      }
      const radiusMeters = Number(resolved.helper?.resolveNearbySubmitIncidentRadiusMeters || potholeMergeRadiusMeters);
      const nearest = typeof nearestSeededIncidentForPoint === "function"
        ? nearestSeededIncidentForPoint(
            Number(context?.submitLat),
            Number(context?.submitLng),
            context?.seededRows,
            radiusMeters
          )
        : null;
      const externalIdField = String(resolved.helper?.resolveNearbySubmitIncidentExternalIdField || "").trim();
      const incidentIdField = String(resolved.helper?.resolveNearbySubmitIncidentIdField || "id").trim();
      return {
        incidentId: String(nearest?.[incidentIdField] || "").trim(),
        externalId: String(nearest?.[externalIdField] || resolvedExternalId || "").trim(),
      };
    }
    return null;
  }

  function buildRepeatGuardContext(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (typeof resolved.helper?.buildRepeatGuardContext === "function") {
      return resolved.helper.buildRepeatGuardContext(context, resolved) || null;
    }
    const incidentId = String(context?.incidentId || "").trim();
    if (!incidentId || !resolved.helper?.allowsRepeatAfterArchive) return null;
    return {
      incidentId,
      allowRepeatAfterArchive: Boolean(context?.getIncidentRepairSnapshot?.(resolved.domainKey, incidentId)?.archived),
    };
  }

  function buildSubmitSuccessMeta(domainKeyRaw, context = {}) {
    const resolved = typeof resolveIncidentDomainHelperEntry === "function"
      ? resolveIncidentDomainHelperEntry(domainKeyRaw)
      : null;
    if (!resolved) return null;
    if (typeof resolved.helper?.buildSubmitSuccessMeta === "function") {
      return resolved.helper.buildSubmitSuccessMeta(context, resolved) || null;
    }
    const saved = context?.saved || null;
    if (!saved) return null;
    return {
      successReportNumbers: [
        reportNumberForRowShared({ ...(saved || {}), domain: resolved.domainKey }, resolved.domainKey, {
          runtimeDomainMeta,
          getIncidentDomainHelper,
          reportDomainFromLightId,
        }),
      ].filter(Boolean),
      successSubmittedAt: Number(saved?.ts || 0) || Date.now(),
    };
  }

  async function persistConfiguredIncidentDomainSubmitGeoCache(domainKeyRaw, context = {}) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    const incidentId = String(context?.incidentId || "").trim();
    if (!domainKey || !incidentId || !supabase) return;
    const body = await buildSubmitGeoCachePayload(domainKey, {
      ...(context || {}),
      incidentId,
    }) || null;
    if (!body) return;
    const { error: cacheErr } = await supabase.functions.invoke("cache-official-light-geo", { body });
    if (cacheErr) {
      console.warn(`[cache-domain-geo ${domainKey}] non-fatal error:`, cacheErr);
      return;
    }
    if (typeof incidentDomainApplyPersistedLocationCacheState === "function") {
      incidentDomainApplyPersistedLocationCacheState(domainKey, {
        ...(context || {}),
        incidentId,
      });
    }
  }

  async function queueConfiguredSubmitLocationEnrichment(domainKeyRaw, incidentIdRaw, context = {}) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    const incidentId = String(incidentIdRaw || "").trim();
    if (!domainKey || !incidentId || typeof persistIncidentLocationCacheWithEnrichment !== "function") return null;
    const nearestAddress = String(context?.nearestAddress || "").trim();
    const nearestCrossStreet = String(context?.nearestCrossStreet || "").trim();
    const nearestIntersection = String(context?.nearestIntersection || "").trim();
    const nearestLandmark = String(context?.nearestLandmark || "").trim();
    if (!(typeof isUsableAddressText === "function" ? isUsableAddressText(nearestAddress) : nearestAddress) && !nearestCrossStreet && !nearestIntersection && !nearestLandmark) {
      return null;
    }
    const savedLocationContext = await buildSavedLocationContext(domainKey, context) || null;
    const savedLat = Number(savedLocationContext?.lat);
    const savedLng = Number(savedLocationContext?.lng);
    const savedLocationLabel = String(savedLocationContext?.locationLabel || "").trim();
    const payload = await buildLocationCacheEntryPayload(domainKey, {
      nearestAddress: (typeof isUsableAddressText === "function" ? isUsableAddressText(nearestAddress) : Boolean(nearestAddress)) ? nearestAddress : "",
      nearestCrossStreet,
      nearestIntersection,
      nearestLandmark,
      locationLabel: savedLocationLabel,
    });
    return persistIncidentLocationCacheWithEnrichment(
      domainKey,
      incidentId,
      {
        payload: payload || {},
        extra: {
          lat: savedLat,
          lng: savedLng,
        },
        debugSource: String(context?.debugSource || `submit:post-save-enrichment:${domainKey}`).trim() || `submit:post-save-enrichment:${domainKey}`,
        requireUsableAddressForEnrichment: context?.requireUsableAddressForEnrichment !== false,
        locationLabelFallback: savedLocationLabel,
      }
    );
  }

  function commitConfiguredInsertedLocation(domainKeyRaw, context = {}) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey) return null;
    const resolvedIds = buildPersistedLocationIds(domainKey, context) || null;
    const incidentId = String(
      resolvedIds?.incidentId
      || resolvedIds?.assetId
      || resolvedIds?.lightId
      || ""
    ).trim();
    const incoming = buildInsertedLocationRecord(domainKey, {
      ...context,
      incidentId,
    }) || null;
    if (
      incidentId
      && typeof context?.setSeededRows === "function"
      && typeof incidentDomainUpsertConfiguredSeededState === "function"
    ) {
      context.setSeededRows((prev) => incidentDomainUpsertConfiguredSeededState(domainKey, prev, incoming));
    }
    return {
      incidentId,
      resolvedIds,
      incoming,
    };
  }

  function commitConfiguredSavedReport(domainKeyRaw, context = {}) {
    const domainKey = typeof normalizeDomainKeyOrSlug === "function"
      ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
      : String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey) return null;
    const saved = buildSavedReportRecord(domainKey, context) || {};
    const submitSuccessMeta = buildSubmitSuccessMeta(domainKey, {
      ...context,
      saved,
    }) || null;
    const successReportNumbers = Array.isArray(submitSuccessMeta?.successReportNumbers)
      ? submitSuccessMeta.successReportNumbers
      : [];
    const successSubmittedAt = Number(submitSuccessMeta?.successSubmittedAt || 0) || Date.now();
    if (
      saved.id
      && typeof context?.setReportRows === "function"
      && typeof incidentDomainPrependConfiguredReportState === "function"
    ) {
      context.setReportRows((prev) => incidentDomainPrependConfiguredReportState(domainKey, prev, saved));
    }
    return {
      saved,
      successReportNumbers,
      successSubmittedAt,
    };
  }

  return {
    incidentDomainBuildSubmitAliasContext: buildSubmitAliasContext,
    incidentDomainNormalizeConfiguredNearbySubmitResult: normalizeConfiguredNearbySubmitResult,
    incidentDomainNormalizeConfiguredServiceSubmitResult: normalizeConfiguredServiceSubmitResult,
    incidentDomainNormalizeConfiguredInsertedLocationCommit: normalizeConfiguredInsertedLocationCommit,
    incidentDomainBuildSubmitReportPayload: buildSubmitReportPayload,
    incidentDomainBuildServiceSubmitPayload: buildServiceSubmitPayload,
    incidentDomainApplyServiceSubmitResult: applyServiceSubmitResult,
    incidentDomainBuildSubmitGeoCachePayload: buildSubmitGeoCachePayload,
    incidentDomainBuildLocationInsertPayload: buildLocationInsertPayload,
    incidentDomainBuildLocationCacheEntryPayload: buildLocationCacheEntryPayload,
    incidentDomainBuildSavedLocationContext: buildSavedLocationContext,
    incidentDomainBuildInsertedLocationRecord: buildInsertedLocationRecord,
    incidentDomainBuildPersistedLocationIds: buildPersistedLocationIds,
    incidentDomainBuildSavedReportRecord: buildSavedReportRecord,
    incidentDomainResolveNearbySubmitIncident: resolveNearbySubmitIncident,
    incidentDomainBuildRepeatGuardContext: buildRepeatGuardContext,
    incidentDomainBuildSubmitSuccessMeta: buildSubmitSuccessMeta,
    persistConfiguredIncidentDomainSubmitGeoCache,
    incidentDomainCommitConfiguredInsertedLocation: commitConfiguredInsertedLocation,
    incidentDomainCommitConfiguredSavedReport: commitConfiguredSavedReport,
    incidentDomainQueueConfiguredSubmitLocationEnrichment: queueConfiguredSubmitLocationEnrichment,
  };
}

export async function submitGenericIncidentDomainReportShared(config = {}, deps = {}) {
  const {
    target,
    roadRequired = false,
    isAuthed = false,
    session = null,
    profile = null,
    name = "",
    phone = "",
    email = "",
    identityGuestInfo = null,
    viewerIdentityKey = "",
    domainReportIssue = "",
    domainReportNote = "",
    domainReportTypeSelections = {},
    reports = [],
    fixedLights = [],
    lastFixByLightId = {},
  } = config;
  const {
    incidentDomainUsesSubmitIdentityGuard,
    incidentDomainUsesCanonicalSubmitIncidentId,
    incidentDomainCanonicalIncidentId,
    incidentDomainAllowsRepeatAfterArchive,
    getIncidentRepairSnapshot,
    canIdentityReportLight,
    openNotice,
    incidentDomainAlreadyReportedMessage,
    prepareDomainSubmitGeoAndImage,
    domainIssueNoteTag,
    buildInitialDomainTypeSelections,
    buildDomainTypeOptionNoteTags,
    buildDomainTypeOptionPayload,
    incidentDomainPersistsSubmitIssueType,
    incidentDomainSubmitFallbackIncidentPrefix,
    insertReportWithFallback,
    normalizeReportQuality,
    runtimeDomainMeta,
    getIncidentDomainHelper,
    reportDomainFromLightId,
    setReports,
    persistIncidentLocationCacheWithEnrichment,
    refreshIncidentRepairProgress,
    incidentDomainDefaultIssueLabel,
    visibleDomainOptions,
    dispatchDomainSubmitEmailNotice,
    notifyAsyncEmailDelivery,
  } = deps;

  if (!target) return null;

  const submitIdentityGuardEnabled = incidentDomainUsesSubmitIdentityGuard(target.domain);
  const canonicalSubmitIncidentId = incidentDomainUsesCanonicalSubmitIncidentId(target.domain)
    ? incidentDomainCanonicalIncidentId(target.domain, {
        light_id: target?.lightId,
        lat: target?.lat,
        lng: target?.lng,
      })
    : "";
  if (submitIdentityGuardEnabled && canonicalSubmitIncidentId) {
    const allowRepeatAfterArchive =
      incidentDomainAllowsRepeatAfterArchive(target.domain)
      && Boolean(getIncidentRepairSnapshot(target.domain, canonicalSubmitIncidentId)?.archived);
    if (!canIdentityReportLight(canonicalSubmitIncidentId, {
      session,
      profile,
      guestInfo: identityGuestInfo,
      reports,
      fixedLights,
      lastFixByLightId,
      allowRepeatAfterArchive,
    })) {
      openNotice("⏳", "Already reported", incidentDomainAlreadyReportedMessage(target.domain));
      return null;
    }
  }

  const preparedSubmit = await prepareDomainSubmitGeoAndImage({
    domainKeyRaw: target.domain,
    target,
    roadRequired,
    modeWhenNotRoad: "quick",
    debugSource: `submit:incident-domain:${String(target.domain || "").trim().toLowerCase() || "unknown"}`,
    reportKeyHint: target.lightId || "",
  });
  if (!preparedSubmit) return null;

  const {
    submitGeo: incidentSubmitGeo,
    imageUrl,
    submitLat: incidentSubmitLat,
    submitLng: incidentSubmitLng,
  } = preparedSubmit;
  const incidentNearestAddress = String(incidentSubmitGeo?.nearestAddress || target.nearestAddress || "").trim();
  const incidentNearestLandmark = String(incidentSubmitGeo?.nearestLandmark || target.nearestLandmark || "").trim();
  const incidentNearestCrossStreet = String(incidentSubmitGeo?.nearestCrossStreet || target.nearestCrossStreet || "").trim();
  const incidentNearestIntersection = String(incidentSubmitGeo?.nearestIntersection || target.nearestIntersection || "").trim();
  const incidentLocationLabel = String(
    incidentNearestAddress
    || target.locationLabel
    || `${incidentSubmitLat.toFixed(5)}, ${incidentSubmitLng.toFixed(5)}`
  ).trim();

  const domainIssueOptions = resolveRuntimeDomainIssueOptionsShared(target.domain);
  const selectedIssueValue =
    String(domainReportIssue || defaultDomainIssueValue(target.domain, domainIssueOptions)).trim().toLowerCase();
  const selectedIssueLabel = resolveConfiguredDomainIssueLabelShared(
    target.domain,
    selectedIssueValue,
    domainIssueOptions,
    {
      normalizeDomainKeyOrSlug,
      runtimeDomainMeta,
    }
  );
  const issueNote = selectedIssueLabel
    ? `${domainIssueNoteTag(target.domain)}: ${selectedIssueLabel}`
    : null;
  const domainTypeOptions = resolveRuntimeDomainTypeOptionConfigsShared(target.domain);
  const resolvedTypeSelections = buildInitialDomainTypeSelections(
    {
      ...target,
      typeSelections: domainReportTypeSelections,
    },
    domainTypeOptions
  );
  const issueTypeOptionConfig = getIssueTypeOptionConfig(target.domain, domainTypeOptions, domainIssueOptions);
  if (issueTypeOptionConfig?.optionKey && selectedIssueValue) {
    resolvedTypeSelections[issueTypeOptionConfig.optionKey] = selectedIssueValue;
  }
  const typeNotes = buildDomainTypeOptionNoteTags(resolvedTypeSelections, domainTypeOptions);
  const typeOptionPayload = buildDomainTypeOptionPayload(resolvedTypeSelections, domainTypeOptions);
  const storedIssueType = incidentDomainPersistsSubmitIssueType(target.domain)
    ? selectedIssueValue
    : "";
  const submitIncidentFallbackPrefix = incidentDomainSubmitFallbackIncidentPrefix(target.domain);

  const payload = {
    lat: incidentSubmitLat,
    lng: incidentSubmitLng,
    report_domain: String(target.domain || "").trim().toLowerCase() || null,
    report_type: "other",
    report_quality: "bad",
    note: [
      `Location: ${incidentLocationLabel}`,
      incidentNearestAddress ? `Address: ${incidentNearestAddress}` : null,
      incidentNearestCrossStreet ? `Cross Street: ${incidentNearestCrossStreet}` : null,
      incidentNearestIntersection ? `Intersection: ${incidentNearestIntersection}` : null,
      incidentNearestLandmark ? `Landmark: ${incidentNearestLandmark}` : null,
      ...typeNotes,
      issueNote,
      domainReportNote.trim() || null,
      imageUrl ? `Image: ${imageUrl}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    light_id: canonicalSubmitIncidentId
      || String(target.lightId || "").trim()
      || `${submitIncidentFallbackPrefix}:${incidentSubmitLat.toFixed(5)}:${incidentSubmitLng.toFixed(5)}`,
    reporter_user_id: isAuthed ? session.user.id : null,
    reporter_name: name.trim(),
    reporter_phone: phone.trim() || null,
    reporter_email: email.trim() || null,
  };

  const { data, error: insErr } = await insertReportWithFallback(payload);
  if (insErr) {
    console.error(insErr);
    openNotice("⚠️", "Couldn’t submit", insErr?.message || "Failed to submit report.");
    return null;
  }

  const saved = {
    id: data.id,
    lat: data.lat,
    lng: data.lng,
    type: data.report_type,
    report_domain: String(target.domain || "").trim().toLowerCase() || null,
    domain: String(target.domain || "").trim().toLowerCase() || null,
    report_quality: normalizeReportQuality(data.report_quality) || "bad",
    note: data.note || "",
    ts: new Date(data.created_at).getTime(),
    light_id: data.light_id || target.lightId,
    report_number: data.report_number || null,
    reporter_user_id: data.reporter_user_id || null,
    reporter_name: data.reporter_name || null,
    reporter_phone: data.reporter_phone || null,
    reporter_email: data.reporter_email || null,
  };
  const successReportNumbers = [reportNumberForRowShared({ ...saved, domain: target.domain }, target.domain, {
    runtimeDomainMeta,
    getIncidentDomainHelper,
    reportDomainFromLightId,
  })].filter(Boolean);
  const successSubmittedAt = saved.ts || Date.now();

  setReports((prev) => [saved, ...prev]);

  const genericLocationEnrichmentPromise = saved?.light_id
    ? persistIncidentLocationCacheWithEnrichment(
        target.domain,
        String(saved.light_id || "").trim(),
        {
          payload: {
            nearestAddress: incidentNearestAddress,
            nearestCrossStreet: incidentNearestCrossStreet,
            nearestIntersection: incidentNearestIntersection,
            nearestLandmark: incidentNearestLandmark,
            locationLabel: incidentNearestAddress || incidentLocationLabel,
          },
          extra: {
            lat: Number(data?.lat ?? incidentSubmitLat),
            lng: Number(data?.lng ?? incidentSubmitLng),
            issueType: storedIssueType || null,
          },
          debugSource: `submit:post-save-enrichment:${String(target.domain || "").trim().toLowerCase() || "unknown"}`,
          locationLabelFallback: incidentLocationLabel,
        }
      )
    : null;

  await refreshIncidentRepairProgress(viewerIdentityKey);

  const issueLabel =
    selectedIssueLabel
    || resolveConfiguredDomainIssueLabelShared(
      target.domain,
      String(data?.report_type || "").trim(),
      domainIssueOptions,
      {
        normalizeDomainKeyOrSlug,
        runtimeDomainMeta,
      }
    )
    || incidentDomainDefaultIssueLabel(target.domain);
  const submittedAtIso = data?.created_at || new Date().toISOString();
  const nearestAddress = String(incidentNearestAddress || target.locationLabel || "").trim() || "Address unavailable";
  const nearestLandmark = String(incidentNearestLandmark || target.nearestLandmark || "").trim() || "No nearby landmark";
  const nearestCrossStreet = String(incidentNearestCrossStreet || target.nearestCrossStreet || "").trim() || "No nearby cross street";
  const nearestIntersection = String(incidentNearestIntersection || target.nearestIntersection || "").trim() || "No nearby intersection";
  const userNotesOnly = [domainReportNote.trim() || "", imageUrl ? `Image: ${imageUrl}` : ""].filter(Boolean).join(" | ");
  const emailDomainLabel = String(target.domainLabel || resolveReportDomainLabelShared(target.domain, "Incident", {
    runtimeDomainMeta,
    reportDomainOptions: visibleDomainOptions,
  })).trim() || "Incident";
  const reporterPayload = {
    type: isAuthed ? "user" : "guest",
    userId: isAuthed ? (session?.user?.id || null) : null,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
  };
  const emailNoticePromise = dispatchDomainSubmitEmailNotice({
    domainKey: target.domain,
    domainLabel: emailDomainLabel,
    issueTypeLabel: issueLabel,
    typeOptions: typeOptionPayload,
    reportNumber: data?.report_number || saved.report_number || "",
    notes: userNotesOnly,
    lat: Number(data?.lat ?? incidentSubmitLat),
    lng: Number(data?.lng ?? incidentSubmitLng),
    closestAddress: nearestAddress,
    closestLandmark: nearestLandmark,
    closestCrossStreet: nearestCrossStreet,
    closestIntersection: nearestIntersection,
    enrichmentPromise: genericLocationEnrichmentPromise,
    submittedAtIso,
    reporter: reporterPayload,
  });
  void emailNoticePromise.then((noticeRes) => {
    notifyAsyncEmailDelivery(emailDomainLabel, noticeRes);
  });

  return {
    successReportNumbers,
    successSubmittedAt,
    persistedSubmission: true,
  };
}

export async function submitConfiguredCustomIncidentDomainReportFlowShared(domainKeyRaw, config = {}, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    prepareDomainSubmitGeoAndImage,
    incidentDomainBuildSubmitAliasContext,
    incidentDomainBuildSubmitReportPayload,
    incidentDomainBuildServiceSubmitPayload,
    incidentDomainApplyServiceSubmitResult,
    incidentDomainNormalizeConfiguredServiceSubmitResult,
    incidentDomainResolveNearbySubmitIncident,
    incidentDomainNormalizeConfiguredNearbySubmitResult,
    incidentDomainBuildRepeatGuardContext,
    incidentDomainAllowsRepeatAfterArchive,
    getIncidentRepairSnapshot,
    canIdentityReportLight,
    openNotice,
    incidentDomainAlreadyReportedMessage,
    activeTenantKey,
    incidentDomainServiceSubmitFunctionName,
    insertConfiguredIncidentDomainSeededWithFallback,
    incidentDomainBuildLocationInsertPayload,
    incidentDomainShouldUseServiceSubmitFallback,
    incidentDomainCommitConfiguredInsertedLocation,
    incidentDomainNormalizeConfiguredInsertedLocationCommit,
    incidentDomainBuildLocationCacheEntryPayload,
    persistConfiguredIncidentDomainSubmitGeoCache,
    insertConfiguredIncidentDomainReportWithFallback,
    incidentDomainCommitConfiguredSavedReport,
    incidentDomainQueueConfiguredSubmitLocationEnrichment,
    refreshIncidentRepairProgress,
    dispatchDomainSubmitEmailNotice,
    runtimeDomainMeta,
    visibleDomainOptions,
    notifyAsyncEmailDelivery,
    supabase,
  } = deps;

  const domainKey = typeof normalizeDomainKeyOrSlug === "function"
    ? normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true })
    : String(domainKeyRaw || "").trim().toLowerCase();
  if (!domainKey) return null;

  const {
    target,
    roadRequired = false,
    isAuthed = false,
    session = null,
    profile = null,
    reports = [],
    fixedLights = [],
    lastFixByLightId = {},
    viewerIdentityKey = "",
    name = "",
    phone = "",
    email = "",
    identityGuestInfo = null,
    seededRows = [],
    setSeededRows = null,
    reportRows = [],
    setReportRows = null,
    lastFixByIncidentMap = {},
    getInitialIncidentId = () => "",
    getInitialExternalId = () => "",
    buildFallbackExternalId = ({ submitLat, submitLng, externalId }) => (
      String(externalId || "").trim()
        || `${Number(submitLat).toFixed(5)}:${Number(submitLng).toFixed(5)}`
    ),
    assignReportPayloadIncidentId = () => {},
    buildEmailDispatchContext = () => ({}),
    applySeededCacheStateContext = {},
    preparedSubmitOptions = {},
    serviceSubmitFirst = false,
    domainReportNote = "",
  } = config || {};
  if (!target) return null;

  const preparedSubmit = await prepareDomainSubmitGeoAndImage({
    domainKeyRaw: domainKey,
    target,
    roadRequired,
    ...preparedSubmitOptions,
  });
  if (!preparedSubmit) return null;
  const { submitGeo, imageUrl, submitLat, submitLng } = preparedSubmit;

  let incidentId = String(getInitialIncidentId(target) || "").trim();
  let externalId = String(getInitialExternalId(target) || "").trim();
  let serviceReportData = null;
  let serviceSeededData = null;
  let lastServiceSubmitError = null;

  const locationFields = buildSharedIncidentSubmitLocationFields(
    incidentDomainBuildSubmitAliasContext(domainKey, {
      submitGeo,
      target,
      incidentId,
      externalId,
    })
  ) || {};
  const nearestAddress = String(locationFields?.nearestAddress || "").trim() || "Address unavailable";
  const nearestLandmark = String(locationFields?.nearestLandmark || "").trim();
  const nearestCrossStreet = String(locationFields?.nearestCrossStreet || "").trim();
  const nearestIntersection = String(locationFields?.nearestIntersection || "").trim();
  const reportLocationLabel = String(
    nearestAddress
    || target?.locationLabel
    || `${Number(submitLat).toFixed(5)}, ${Number(submitLng).toFixed(5)}`
  ).trim();
  const userNotesOnly = [String(domainReportNote || "").trim() || "", imageUrl ? `Image: ${imageUrl}` : ""]
    .filter(Boolean)
    .join(" | ");
  const legacySubmitNote = [
    `Location: ${reportLocationLabel}`,
    nearestAddress ? `Address: ${nearestAddress}` : null,
    nearestCrossStreet ? `Cross Street: ${nearestCrossStreet}` : null,
    nearestIntersection ? `Intersection: ${nearestIntersection}` : null,
    nearestLandmark ? `Landmark: ${nearestLandmark}` : null,
    String(domainReportNote || "").trim() || null,
    imageUrl ? `Image: ${imageUrl}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
  const reportPayload = incidentDomainBuildSubmitReportPayload(
    domainKey,
    incidentDomainBuildSubmitAliasContext(domainKey, {
      incidentId,
      externalId,
      submitLat,
      submitLng,
      note: legacySubmitNote,
      reporterUserId: isAuthed ? session?.user?.id || null : null,
      reporterName: String(name || "").trim(),
      reporterPhone: String(phone || "").trim(),
      reporterEmail: String(email || "").trim(),
    })
  ) || {};

  const tryServiceFallback = async (fallbackIncidentId = incidentId, fallbackExternalId = externalId) => {
    const servicePayload = incidentDomainBuildServiceSubmitPayload(
      domainKey,
      incidentDomainBuildSubmitAliasContext(domainKey, {
        incidentId: fallbackIncidentId,
        externalId: fallbackExternalId,
        submitLat,
        submitLng,
        locationFields,
        reportPayload,
        createdBy: session?.user?.id || null,
      })
    ) || {};
    const result = await submitConfiguredIncidentDomainViaFunctionShared(domainKey, servicePayload, {
      normalizeDomainKeyOrSlug,
      activeTenantKey,
      incidentDomainServiceSubmitFunctionName,
      supabase,
    });
    if (result?.error) {
      lastServiceSubmitError = result.error;
      return null;
    }
    const appliedResult = incidentDomainApplyServiceSubmitResult(
      domainKey,
      incidentDomainBuildSubmitAliasContext(domainKey, {
        incidentId: fallbackIncidentId,
        externalId: fallbackExternalId,
        result,
      })
    ) || null;
    if (!appliedResult) {
      lastServiceSubmitError = new Error("Failed to apply service submission result.");
      return null;
    }
    const normalizedAppliedResult = incidentDomainNormalizeConfiguredServiceSubmitResult(domainKey, appliedResult);
    serviceSeededData = normalizedAppliedResult.seeded;
    serviceReportData = normalizedAppliedResult.report;
    incidentId = String(normalizedAppliedResult.incidentId || incidentId || "").trim();
    externalId = String(normalizedAppliedResult.externalId || externalId || "").trim();
    lastServiceSubmitError = null;
    return appliedResult;
  };

  if (!incidentId) {
    const nearbyIncident = incidentDomainResolveNearbySubmitIncident(
      domainKey,
      incidentDomainBuildSubmitAliasContext(domainKey, {
        incidentId,
        externalId,
        submitLat,
        submitLng,
        seededRows,
      })
    ) || null;
    const normalizedNearbyIncident = incidentDomainNormalizeConfiguredNearbySubmitResult(domainKey, nearbyIncident);
    incidentId = String(normalizedNearbyIncident.incidentId || incidentId || "").trim();
    externalId = String(normalizedNearbyIncident.externalId || externalId || "").trim();
  }

  if (incidentId) {
    const repeatGuard = incidentDomainBuildRepeatGuardContext(
      domainKey,
      incidentDomainBuildSubmitAliasContext(domainKey, {
        incidentId,
        externalId,
        getIncidentRepairSnapshot,
      })
    ) || null;
    const allowRepeatAfterArchive =
      incidentDomainAllowsRepeatAfterArchive(domainKey)
      && Boolean(repeatGuard?.allowRepeatAfterArchive);
    if (!canIdentityReportLight(repeatGuard?.incidentId || "", {
      session,
      profile,
      guestInfo: identityGuestInfo,
      reports,
      reportRows,
      fixedLights,
      lastFixByLightId,
      lastFixByIncidentMap,
      allowRepeatAfterArchive,
    })) {
      openNotice("⏳", "Already reported", incidentDomainAlreadyReportedMessage(domainKey));
      return null;
    }
  }

  if (serviceSubmitFirst) {
    const fallback = await tryServiceFallback(
      incidentId,
      buildFallbackExternalId({ submitLat, submitLng, externalId })
    );
    if (!fallback) {
      console.error(lastServiceSubmitError);
      openNotice(
        "⚠️",
        "Couldn’t submit",
        lastServiceSubmitError?.message || "Failed to submit report."
      );
      return null;
    }
    const locationCommit = incidentDomainCommitConfiguredInsertedLocation(
      domainKey,
      incidentDomainBuildSubmitAliasContext(domainKey, {
        incidentId,
        externalId,
        serviceSeededData,
        insertedSeededData: null,
        submitLat,
        submitLng,
        setSeededRows,
      })
    ) || null;
    const normalizedLocationCommit = incidentDomainNormalizeConfiguredInsertedLocationCommit(domainKey, locationCommit);
    incidentId = String(normalizedLocationCommit.incidentId || incidentId || "").trim();
    externalId = String(normalizedLocationCommit.externalId || externalId || "").trim();
  } else if (!incidentId) {
    const tenantKey = String(activeTenantKey() || "").trim().toLowerCase();
    const insSeeded = await insertConfiguredIncidentDomainSeededWithFallback(
      domainKey,
      incidentDomainBuildLocationInsertPayload(
        domainKey,
        incidentDomainBuildSubmitAliasContext(domainKey, {
          incidentId,
          externalId,
          submitLat,
          submitLng,
          locationFields,
          createdBy: session?.user?.id || null,
        })
      ) || {},
      tenantKey
    );
    if (insSeeded.error) {
      const fallback = incidentDomainShouldUseServiceSubmitFallback(domainKey, insSeeded.error)
        ? await tryServiceFallback("", buildFallbackExternalId({ submitLat, submitLng, externalId }))
        : null;
      if (!fallback) {
        console.error(insSeeded.error);
        openNotice("⚠️", "Couldn’t submit", insSeeded.error?.message || "Failed to create incident location.");
        return null;
      }
    }
    const locationCommit = incidentDomainCommitConfiguredInsertedLocation(
      domainKey,
      incidentDomainBuildSubmitAliasContext(domainKey, {
        incidentId,
        externalId,
        serviceSeededData,
        insertedSeededData: insSeeded.data,
        submitLat,
        submitLng,
        setSeededRows,
      })
    ) || null;
    const normalizedLocationCommit = incidentDomainNormalizeConfiguredInsertedLocationCommit(domainKey, locationCommit);
    incidentId = String(normalizedLocationCommit.incidentId || incidentId || "").trim();
    externalId = String(normalizedLocationCommit.externalId || externalId || "").trim();
  }

  const legacyGeoCacheSanitizedEntry = incidentId && (nearestAddress || nearestCrossStreet || nearestLandmark)
    ? await incidentDomainBuildLocationCacheEntryPayload(domainKey, {
        nearestAddress,
        nearestCrossStreet,
        nearestIntersection,
        nearestLandmark,
        locationLabel: nearestAddress,
      })
    : null;

  const legacySubmitGeoCachePromise = incidentId && (nearestAddress || nearestCrossStreet || nearestLandmark)
    ? persistConfiguredIncidentDomainSubmitGeoCache(domainKey, {
        tenantKey: activeTenantKey(),
        incidentId,
        locationFields,
        sanitizedEntry: legacyGeoCacheSanitizedEntry || {},
        setSeededRows,
        setReportRows,
        ...applySeededCacheStateContext,
      })
    : null;

  assignReportPayloadIncidentId(reportPayload, incidentId);

  let insReport = { data: serviceReportData, error: null };
  if (!serviceReportData) {
    const tenantKey = String(activeTenantKey() || "").trim().toLowerCase();
    insReport = await insertConfiguredIncidentDomainReportWithFallback(domainKey, reportPayload, tenantKey);
    if (insReport.error) {
      const fallback = incidentDomainShouldUseServiceSubmitFallback(domainKey, insReport.error)
        ? await tryServiceFallback(incidentId, externalId)
        : null;
      if (!fallback) {
        console.error(insReport.error);
        openNotice("⚠️", "Couldn’t submit", insReport.error?.message || "Failed to submit report.");
        return null;
      }
      insReport = { data: fallback.report, error: null };
    }
  }

  const reportCommit = incidentDomainCommitConfiguredSavedReport(domainKey, {
    insertedReportData: insReport.data,
    incidentId,
    fallbackNote: reportPayload.note,
    setReportRows,
  }) || null;
  const saved = reportCommit?.saved || {};
  const successReportNumbers = Array.isArray(reportCommit?.successReportNumbers)
    ? reportCommit.successReportNumbers
    : [];
  const successSubmittedAt = Number(reportCommit?.successSubmittedAt || 0) || Date.now();

  if (typeof legacySubmitGeoCachePromise?.then === "function") {
    await legacySubmitGeoCachePromise;
  }

  const legacyLocationEnrichmentPromise = incidentId
    ? incidentDomainQueueConfiguredSubmitLocationEnrichment(domainKey, incidentId, {
        insertedReportData: insReport.data,
        submitLat,
        submitLng,
        nearestAddress,
        nearestCrossStreet,
        nearestIntersection,
        nearestLandmark,
        target,
        debugSource: `submit:post-save-enrichment:${domainKey}`,
        requireUsableAddressForEnrichment: true,
      })
    : null;

  await refreshIncidentRepairProgress(viewerIdentityKey);

  const submittedAtIso = insReport.data?.created_at || new Date().toISOString();
  const reporterPayload = {
    type: isAuthed ? "user" : "guest",
    userId: isAuthed ? (session?.user?.id || null) : null,
    name: String(name || "").trim(),
    email: String(email || "").trim(),
    phone: String(phone || "").trim(),
  };
  void dispatchDomainSubmitEmailNotice({
    domainKey,
    domainLabel: String(
      target?.domainLabel
      || resolveReportDomainLabelShared(domainKey, "Incident", {
        runtimeDomainMeta,
        reportDomainOptions: visibleDomainOptions,
      })
    ).trim() || "Incident",
    reportNumber: insReport.data?.report_number || saved.report_number || "",
    notes: insReport.data?.note || reportPayload.note || "",
    lat: Number(insReport.data?.lat ?? submitLat),
    lng: Number(insReport.data?.lng ?? submitLng),
    closestAddress: nearestAddress,
    closestLandmark: nearestLandmark || "No nearby landmark",
    closestCrossStreet: nearestCrossStreet || "No nearby cross street",
    closestIntersection: nearestIntersection || "No nearby intersection",
    enrichmentPromise: legacyLocationEnrichmentPromise,
    submittedAtIso,
    reporter: reporterPayload,
    ...(buildEmailDispatchContext({
      target,
      saved,
      incidentId,
      externalId,
      userNotesOnly,
      reportPayload,
      insertedReportData: insReport.data,
      submitLat,
      submitLng,
      nearestAddress,
      nearestLandmark,
      nearestCrossStreet,
      nearestIntersection,
    }) || {}),
  }).then((noticeRes) => {
    notifyAsyncEmailDelivery(
      String(
        target?.domainLabel
        || resolveReportDomainLabelShared(domainKey, "Incident", {
          runtimeDomainMeta,
          reportDomainOptions: visibleDomainOptions,
        })
        || "Incident"
      ),
      noticeRes
    );
  });

  return {
    persistedSubmission: true,
    successReportNumbers,
    successSubmittedAt,
  };
}
