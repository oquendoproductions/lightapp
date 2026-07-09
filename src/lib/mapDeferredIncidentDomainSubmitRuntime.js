const loadDeferredIncidentSupportModule = () => import("./mapDeferredIncidentSupport.js");
const loadDeferredReportSubmitSupportModule = () => import("./mapDeferredReportSubmitSupport.js");
const loadReportFlowSelectionSupportModule = () => import("./mapReportFlowSelectionSupport.js");

async function insertConfiguredIncidentDomainRecordWithFallbackRuntime(
  domainKeyRaw,
  kindRaw,
  payload,
  tenantKey,
  options = {},
  deps = {},
) {
  const {
    insertConfiguredIncidentDomainRecordWithFallbackShared,
    canRetryInsertWithoutSelectShared,
  } = await loadDeferredReportSubmitSupportModule();
  return insertConfiguredIncidentDomainRecordWithFallbackShared(domainKeyRaw, kindRaw, payload, tenantKey, options, {
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    incidentDomainConfiguredSourceTable: deps.incidentDomainConfiguredSourceTable,
    incidentDomainConfiguredSelectFields: deps.incidentDomainConfiguredSelectFields,
    incidentDomainConfiguredLookupField: deps.incidentDomainConfiguredLookupField,
    canRetryInsertWithoutSelect: canRetryInsertWithoutSelectShared,
    createTenantScopedReadClient: deps.createTenantScopedReadClient,
    supabase: deps.supabase,
    incidentDomainConfiguredLookupIdentityFields: deps.incidentDomainConfiguredLookupIdentityFields,
  });
}

async function insertConfiguredIncidentDomainSeededWithFallbackRuntime(domainKeyRaw, payload, tenantKey, deps = {}) {
  const { insertConfiguredIncidentDomainSeededWithFallbackShared } = await loadDeferredReportSubmitSupportModule();
  return insertConfiguredIncidentDomainSeededWithFallbackShared(domainKeyRaw, payload, tenantKey, {
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    insertConfiguredIncidentDomainRecordWithFallback: (nextDomainKeyRaw, nextKindRaw, nextPayload, nextTenantKey, options = {}) =>
      insertConfiguredIncidentDomainRecordWithFallbackRuntime(nextDomainKeyRaw, nextKindRaw, nextPayload, nextTenantKey, options, deps),
    incidentDomainSeededInsertLookupFailureMessage: deps.incidentDomainSeededInsertLookupFailureMessage,
  });
}

async function insertConfiguredIncidentDomainReportWithFallbackRuntime(domainKeyRaw, payload, tenantKey, deps = {}) {
  const { insertConfiguredIncidentDomainReportWithFallbackShared } = await loadDeferredReportSubmitSupportModule();
  return insertConfiguredIncidentDomainReportWithFallbackShared(domainKeyRaw, payload, tenantKey, {
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    insertConfiguredIncidentDomainRecordWithFallback: (nextDomainKeyRaw, nextKindRaw, nextPayload, nextTenantKey, options = {}) =>
      insertConfiguredIncidentDomainRecordWithFallbackRuntime(nextDomainKeyRaw, nextKindRaw, nextPayload, nextTenantKey, options, deps),
    incidentDomainBuildReportLookupFallbackData: deps.incidentDomainBuildReportLookupFallbackData,
  });
}

async function prepareDomainSubmitGeoAndImageRuntime(args = {}, state = {}, deps = {}) {
  const { prepareDomainSubmitGeoAndImageShared } = await loadDeferredReportSubmitSupportModule();
  return prepareDomainSubmitGeoAndImageShared(args, {
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    incidentDomainSubmitGeoModeWhenNotRoad: deps.incidentDomainSubmitGeoModeWhenNotRoad,
    incidentDomainSubmitDebugSource: deps.incidentDomainSubmitDebugSource,
    incidentDomainResolveSubmitReportKeyHint: deps.incidentDomainResolveSubmitReportKeyHint,
    reverseGeocodeRoadLabel: deps.reverseGeocodeRoadLabel,
    domainReportImageFile: state.domainReportImageFile,
    activeTenantKey: deps.activeTenantKey,
    supabase: deps.supabase,
    openNotice: deps.openNotice,
    openConfiguredNotice: deps.openConfiguredNotice,
  });
}

async function submitConfiguredCustomIncidentDomainReportFlowRuntime(domainKeyRaw, config = {}, state = {}, deps = {}) {
  const [
    incidentDeferredSupport,
    {
      createConfiguredIncidentDomainSubmitSupportShared,
      submitConfiguredCustomIncidentDomainReportFlowShared,
    },
  ] = await Promise.all([
    loadDeferredIncidentSupportModule(),
    loadDeferredReportSubmitSupportModule(),
  ]);
  const configuredSubmitSupport = createConfiguredIncidentDomainSubmitSupportShared({
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    resolveIncidentDomainHelperEntry: deps.resolveIncidentDomainHelperEntry,
    incidentDomainNormalizePayloadIncidentId: deps.incidentDomainNormalizePayloadIncidentId,
    incidentDomainNormalizePersistenceIncidentId: deps.incidentDomainNormalizePersistenceIncidentId,
    incidentDomainBuildCoordsDisplayId: deps.incidentDomainBuildCoordsDisplayId,
    nearestSeededIncidentForPoint: deps.nearestSeededIncidentForPoint,
    potholeMergeRadiusMeters: deps.potholeMergeRadiusMeters,
    runtimeDomainMeta: deps.runtimeDomainMeta,
    getIncidentDomainHelper: deps.getIncidentDomainHelper,
    reportDomainFromLightId: deps.reportDomainFromLightId,
    incidentDomainUpsertConfiguredSeededState: deps.incidentDomainUpsertConfiguredSeededState,
    incidentDomainPrependConfiguredReportState: deps.incidentDomainPrependConfiguredReportState,
    buildSharedIncidentSubmitGeoCachePayload: incidentDeferredSupport.buildSharedIncidentSubmitGeoCachePayload,
    buildSharedIncidentLocationCacheEntryPayload: incidentDeferredSupport.buildSharedIncidentLocationCacheEntryPayload,
    buildSharedIncidentSavedLocationContext: incidentDeferredSupport.buildSharedIncidentSavedLocationContext,
    incidentDomainApplyPersistedLocationCacheState: deps.incidentDomainApplyPersistedLocationCacheState,
    activeTenantKey: deps.activeTenantKey,
    supabase: deps.supabase,
    persistIncidentLocationCacheWithEnrichment: deps.persistIncidentLocationCacheWithEnrichment,
  });
  return submitConfiguredCustomIncidentDomainReportFlowShared(domainKeyRaw, {
    ...config,
    profile: state.profile,
    reports: state.reports,
    fixedLights: state.fixedLights,
    lastFixByLightId: state.lastFixByLightId,
    domainReportNote: state.domainReportNote,
  }, {
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    prepareDomainSubmitGeoAndImage: (nextArgs = {}) =>
      prepareDomainSubmitGeoAndImageRuntime(nextArgs, state, deps),
    incidentDomainBuildSubmitAliasContext: configuredSubmitSupport.incidentDomainBuildSubmitAliasContext,
    incidentDomainBuildSubmitReportPayload: configuredSubmitSupport.incidentDomainBuildSubmitReportPayload,
    incidentDomainBuildServiceSubmitPayload: configuredSubmitSupport.incidentDomainBuildServiceSubmitPayload,
    incidentDomainApplyServiceSubmitResult: configuredSubmitSupport.incidentDomainApplyServiceSubmitResult,
    incidentDomainNormalizeConfiguredServiceSubmitResult: configuredSubmitSupport.incidentDomainNormalizeConfiguredServiceSubmitResult,
    incidentDomainResolveNearbySubmitIncident: configuredSubmitSupport.incidentDomainResolveNearbySubmitIncident,
    incidentDomainNormalizeConfiguredNearbySubmitResult: configuredSubmitSupport.incidentDomainNormalizeConfiguredNearbySubmitResult,
    incidentDomainBuildRepeatGuardContext: configuredSubmitSupport.incidentDomainBuildRepeatGuardContext,
    incidentDomainAllowsRepeatAfterArchive: deps.incidentDomainAllowsRepeatAfterArchive,
    getIncidentRepairSnapshot: deps.getIncidentRepairSnapshot,
    canIdentityReportLight: deps.canIdentityReportLight,
    openNotice: deps.openNotice,
    incidentDomainAlreadyReportedMessage: deps.incidentDomainAlreadyReportedMessage,
    activeTenantKey: deps.activeTenantKey,
    incidentDomainServiceSubmitFunctionName: deps.incidentDomainServiceSubmitFunctionName,
    insertConfiguredIncidentDomainSeededWithFallback: (nextDomainKeyRaw, payload, tenantKey) =>
      insertConfiguredIncidentDomainSeededWithFallbackRuntime(nextDomainKeyRaw, payload, tenantKey, deps),
    incidentDomainBuildLocationInsertPayload: configuredSubmitSupport.incidentDomainBuildLocationInsertPayload,
    incidentDomainShouldUseServiceSubmitFallback: deps.incidentDomainShouldUseServiceSubmitFallback,
    incidentDomainCommitConfiguredInsertedLocation: configuredSubmitSupport.incidentDomainCommitConfiguredInsertedLocation,
    incidentDomainNormalizeConfiguredInsertedLocationCommit: configuredSubmitSupport.incidentDomainNormalizeConfiguredInsertedLocationCommit,
    incidentDomainBuildLocationCacheEntryPayload: configuredSubmitSupport.incidentDomainBuildLocationCacheEntryPayload,
    persistConfiguredIncidentDomainSubmitGeoCache: configuredSubmitSupport.persistConfiguredIncidentDomainSubmitGeoCache,
    insertConfiguredIncidentDomainReportWithFallback: (nextDomainKeyRaw, payload, tenantKey) =>
      insertConfiguredIncidentDomainReportWithFallbackRuntime(nextDomainKeyRaw, payload, tenantKey, deps),
    incidentDomainCommitConfiguredSavedReport: configuredSubmitSupport.incidentDomainCommitConfiguredSavedReport,
    incidentDomainQueueConfiguredSubmitLocationEnrichment: configuredSubmitSupport.incidentDomainQueueConfiguredSubmitLocationEnrichment,
    refreshIncidentRepairProgress: deps.refreshIncidentRepairProgress,
    dispatchDomainSubmitEmailNotice: deps.dispatchDomainSubmitEmailNotice,
    runtimeDomainMeta: deps.runtimeDomainMeta,
    visibleDomainOptions: state.visibleDomainOptions,
    notifyAsyncEmailDelivery: deps.notifyAsyncEmailDelivery,
    supabase: deps.supabase,
  });
}

async function submitCustomIncidentDomainReportFlowRuntime(domainKeyRaw, context = {}, state = {}, deps = {}) {
  const domainKey = deps.normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return null;
  const configuredRuntimeEntry = state.configuredIncidentRuntimeEntries.find((entry) => entry?.domainKey === domainKey) || null;
  const customSubmitConfig = deps.incidentDomainBuildCustomSubmitFlowConfig(domainKey, {
    ...(configuredRuntimeEntry || {}),
    ...context,
  });
  if (customSubmitConfig) {
    return submitConfiguredCustomIncidentDomainReportFlowRuntime(domainKey, customSubmitConfig, state, deps);
  }
  return null;
}

export async function submitIncidentDomainReportRuntimeShared(state = {}, deps = {}) {
  const [
    {
      buildDomainTypeOptionNoteTags,
      buildDomainTypeOptionPayload,
      buildInitialDomainTypeSelections,
    },
    { submitGenericIncidentDomainReportShared },
  ] = await Promise.all([
    loadReportFlowSelectionSupportModule(),
    loadDeferredReportSubmitSupportModule(),
  ]);
  const targetRaw = state.domainReportTarget;
  if (!targetRaw || state.saving || state.domainSubmitInFlightRef?.current) return;
  const targetDomain = deps.normalizeDomainKey(targetRaw?.domain);
  let target = deps.incidentDomainNormalizeSubmitTarget(targetDomain, {
    target: targetRaw,
    submitTargetMarkerCandidates: deps.incidentDrivenMarkersForDomain(targetDomain),
  });
  const submitKey = deps.domainSubmitIdempotencyKey({
    target,
    issue: state.domainReportIssue,
    note: state.domainReportNote,
  });
  const nowTs = Date.now();
  const dedupeMap = state.domainSubmitDedupRef?.current;
  for (const [key, ts] of dedupeMap.entries()) {
    if (!key || !Number.isFinite(Number(ts)) || (nowTs - Number(ts)) > deps.domainSubmitDedupeWindowMs) {
      dedupeMap.delete(key);
    }
  }
  if (submitKey) {
    const prevTs = Number(dedupeMap.get(submitKey) || 0);
    if (prevTs > 0 && (nowTs - prevTs) < deps.domainSubmitDedupeWindowMs) {
      deps.openNotice("ℹ️", "Already processing", "This report is already being submitted. Please wait a moment.");
      return;
    }
    dedupeMap.set(submitKey, nowTs);
  }
  state.domainSubmitInFlightRef.current = true;
  deps.setSaving(true);
  let persistedSubmission = false;
  let successReportNumbers = [];
  let successSubmittedAt = 0;
  try {
    const boundaryLat = Number.isFinite(Number(target?.sourceLat)) ? Number(target.sourceLat) : Number(target?.lat);
    const boundaryLng = Number.isFinite(Number(target?.sourceLng)) ? Number(target.sourceLng) : Number(target?.lng);
    if (!deps.municipalBoundaryGate(target.domain, boundaryLat, boundaryLng, { showNotice: true })) {
      return;
    }
    if (!(await deps.ensureParkPlacementForTarget(target))) {
      return;
    }
    const requiredInsideDisclosures = (Array.isArray(target?.insideFormDisclosures) ? target.insideFormDisclosures : [])
      .filter((row) => row?.required_acknowledgement === true);
    const missingRequiredDisclosure = requiredInsideDisclosures.find((row, index) => (
      !state.domainDisclosureAcknowledgements?.[deps.domainDisclosureAckKey(row, index)]
    ));
    if (missingRequiredDisclosure) {
      deps.openNotice(
        "⚠️",
        "Acknowledgement required",
        `Please confirm the required disclosure for this ${String(target?.domainLabel || "report").trim().toLowerCase() || "report"} before submitting.`,
      );
      return;
    }

    const isAuthed = Boolean(state.session?.user?.id);
    const usingGuestBypass = !isAuthed && state.guestSubmitBypassRef?.current;
    if (!isAuthed && !usingGuestBypass) {
      deps.requestGuestChallenge("domain");
      return;
    }
    const guestSource = usingGuestBypass ? state.guestInfoDraft : state.guestInfo;
    if (usingGuestBypass) {
      state.guestSubmitBypassRef.current = false;
    }

    const authedEmail = state.session?.user?.email || "";
    const authedName =
      String(state.profile?.full_name || "").trim()
      || String(state.session?.user?.user_metadata?.full_name || "").trim()
      || (authedEmail ? authedEmail.split("@")[0] : "User");
    const name = isAuthed ? authedName : (guestSource?.name || "");
    const phone = isAuthed ? (state.profile?.phone || "") : (guestSource?.phone || "");
    const email = isAuthed ? ((state.profile?.email || authedEmail) || "") : (guestSource?.email || "");
    const identityGuestInfo = isAuthed ? null : { name, phone, email };

    if (!isAuthed && (!name.trim() || !deps.normalizeEmail(email))) {
      deps.requestGuestChallenge("domain");
      deps.openNotice("⚠️", "Contact required", "Please add your name and email before submitting.");
      return;
    }

    const abuseGate = await deps.registerAbuseEventWithServer({
      session: state.session,
      profile: state.profile,
      guestInfo: identityGuestInfo,
      domain: target.domain || state.selectedDomain,
      idempotencyKey: submitKey,
      bypass: false,
    });
    if (!abuseGate.allowed) {
      deps.openRateLimitNotice(deps.openNotice, abuseGate);
      return;
    }
    if (abuseGate.duplicate) {
      deps.openNotice("ℹ️", "Already submitted", "Duplicate report blocked. If needed, edit your note and submit again.");
      return;
    }

    const roadRequired = deps.isRoadRequiredForDomain(target.domain);
    if (roadRequired && !target?.roadValidated) {
      const preparedTarget = await deps.validateAndPrepareRoadTarget(target);
      if (!preparedTarget) return;
      target = preparedTarget;
    }

    if (deps.incidentDomainUsesCustomSubmitFlow(target.domain)) {
      const customSubmitResult = await submitCustomIncidentDomainReportFlowRuntime(target.domain, {
        target,
        roadRequired,
        isAuthed,
        session: state.session,
        name,
        phone,
        email,
        identityGuestInfo,
        viewerIdentityKey: state.viewerIdentityKey,
      }, state, deps);
      if (!customSubmitResult) return;
      successReportNumbers = Array.isArray(customSubmitResult?.successReportNumbers)
        ? customSubmitResult.successReportNumbers
        : [];
      successSubmittedAt = Number(customSubmitResult?.successSubmittedAt || 0) || Date.now();
      persistedSubmission = Boolean(customSubmitResult?.persistedSubmission);
    } else {
      const genericSubmitResult = await submitGenericIncidentDomainReportShared({
        target,
        roadRequired,
        isAuthed,
        session: state.session,
        profile: state.profile,
        name,
        phone,
        email,
        identityGuestInfo,
        viewerIdentityKey: state.viewerIdentityKey,
        domainReportIssue: state.domainReportIssue,
        domainReportNote: state.domainReportNote,
        domainReportTypeSelections: state.domainReportTypeSelections,
        reports: state.reports,
        fixedLights: state.fixedLights,
        lastFixByLightId: state.lastFixByLightId,
      }, {
        incidentDomainUsesSubmitIdentityGuard: deps.incidentDomainUsesSubmitIdentityGuard,
        incidentDomainUsesCanonicalSubmitIncidentId: deps.incidentDomainUsesCanonicalSubmitIncidentId,
        incidentDomainCanonicalIncidentId: deps.incidentDomainCanonicalIncidentId,
        incidentDomainAllowsRepeatAfterArchive: deps.incidentDomainAllowsRepeatAfterArchive,
        getIncidentRepairSnapshot: deps.getIncidentRepairSnapshot,
        canIdentityReportLight: deps.canIdentityReportLight,
        openNotice: deps.openNotice,
        incidentDomainAlreadyReportedMessage: deps.incidentDomainAlreadyReportedMessage,
        prepareDomainSubmitGeoAndImage: (nextArgs = {}) =>
          prepareDomainSubmitGeoAndImageRuntime(nextArgs, state, deps),
        normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
        domainIssueNoteTag: deps.domainIssueNoteTag,
        buildInitialDomainTypeSelections,
        buildDomainTypeOptionNoteTags,
        buildDomainTypeOptionPayload,
        incidentDomainPersistsSubmitIssueType: deps.incidentDomainPersistsSubmitIssueType,
        incidentDomainSubmitFallbackIncidentPrefix: deps.incidentDomainSubmitFallbackIncidentPrefix,
        insertReportWithFallback: deps.insertReportWithFallback,
        normalizeReportQuality: deps.normalizeReportQuality,
        runtimeDomainMeta: deps.runtimeDomainMeta,
        getIncidentDomainHelper: deps.getIncidentDomainHelper,
        reportDomainFromLightId: deps.reportDomainFromLightId,
        setReports: deps.setReports,
        persistIncidentLocationCacheWithEnrichment: deps.persistIncidentLocationCacheWithEnrichment,
        refreshIncidentRepairProgress: deps.refreshIncidentRepairProgress,
        incidentDomainDefaultIssueLabel: deps.incidentDomainDefaultIssueLabel,
        visibleDomainOptions: state.visibleDomainOptions,
        dispatchDomainSubmitEmailNotice: deps.dispatchDomainSubmitEmailNotice,
        notifyAsyncEmailDelivery: deps.notifyAsyncEmailDelivery,
      });
      if (!genericSubmitResult) return;
      successReportNumbers = Array.isArray(genericSubmitResult?.successReportNumbers)
        ? genericSubmitResult.successReportNumbers
        : [];
      successSubmittedAt = Number(genericSubmitResult?.successSubmittedAt || 0) || Date.now();
      persistedSubmission = Boolean(genericSubmitResult?.persistedSubmission);
    }

    deps.finalizeIncidentDomainSubmitSuccess({
      isAuthed,
      domainKey: target.domain,
      title: `${target.domainLabel || "Issue"} reported`,
      message: "Your report is now visible on the map and in Reports. You can track it there anytime.",
      reportNumbers: successReportNumbers,
      submittedAt: successSubmittedAt,
    });
  } finally {
    if (!persistedSubmission && submitKey) {
      dedupeMap.delete(submitKey);
    }
    deps.setSaving(false);
    state.domainSubmitInFlightRef.current = false;
  }
}
