const loadDeferredIncidentAdminSupportModule = () => import("./mapDeferredIncidentAdminSupport.js");
const loadIncidentDeferredSupportModule = () => import("./mapIncidentDeferredSupport.js");
import { buildIncidentDrivenRecordMapByDomainShared } from "./mapDeferredIncidentWorkspaceStateSupport.js";

export async function openIncidentStatusDialogRuntimeShared(args = {}, deps = {}) {
  const { openIncidentStatusDialogShared } = await loadDeferredIncidentAdminSupportModule();
  return openIncidentStatusDialogShared({
    incidentId: args.incidentId,
    domainKey: args.domainKey,
    currentState: args.currentState,
    clusterReports: args.clusterReports,
    compatMarker: args.compatMarker,
    incidentLabel: args.incidentLabel,
    isOfficial: args.isOfficial,
    domainForIncidentId: deps.domainForIncidentId,
    openNotice: deps.openNotice,
  }, {
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    setters: deps.setters,
  });
}

export async function openIncidentStatusDialogForTargetRuntimeShared(state = {}, deps = {}) {
  const normalizedDomainKey =
    deps.normalizeDomainKeyOrSlug(state.domainKey, { allowUnknown: true })
    || deps.domainForIncidentId(state.incidentId);
  const normalizedIncidentId = String(state.incidentId || "").trim();
  if (!normalizedDomainKey || !normalizedIncidentId) return;

  const lookupId = deps.normalizeIncidentDrivenLookupId(normalizedDomainKey, normalizedIncidentId);
  const incidentDrivenRecordMapByDomain = buildIncidentDrivenRecordMapByDomainShared({
    configuredIncidentSeededByIdByDomain: deps.configuredIncidentSeededByIdByDomain,
    persistedIncidentRecordStateByDomain: deps.persistedIncidentRecordStateByDomain,
    shouldBuild: true,
  });
  const domainRecord = incidentDrivenRecordMapByDomain.get(normalizedDomainKey)?.get(lookupId) || null;
  const { buildIncidentStatusDialogCompatOptionsShared } = await loadDeferredIncidentAdminSupportModule();

  const dialogOptions = {
    incidentId: normalizedIncidentId,
    domainKey: normalizedDomainKey,
    currentState: state.currentState,
    clusterReports: state.clusterReports,
    incidentLabel: state.incidentLabel,
    isOfficial: state.isOfficial,
  };

  const compatOptions = buildIncidentStatusDialogCompatOptionsShared(normalizedDomainKey, {
    incidentId: normalizedIncidentId,
    marker: state.marker,
    domainRecord,
  }, {
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    getIncidentDomainHelper: deps.getIncidentDomainHelper,
    lookupIncidentIdForDomain: deps.lookupIncidentIdForDomain,
    incidentDomainBuildCoordsDisplayId: deps.incidentDomainBuildCoordsDisplayId,
  });
  if (compatOptions === false) return;
  if (compatOptions && typeof compatOptions === "object") {
    Object.assign(dialogOptions, compatOptions);
  }

  await deps.openIncidentStatusDialog(dialogOptions);
}

export async function markFixedRuntimeShared(state = {}, deps = {}) {
  if (!state.light) return;
  const [{ composeIncidentActionAuditNote }, { markFixedForMapShared }] = await Promise.all([
    loadIncidentDeferredSupportModule(),
    loadDeferredIncidentAdminSupportModule(),
  ]);
  return markFixedForMapShared({
    supabase: deps.supabase,
    tenantKey: deps.activeTenantKey(),
    light: state.light,
    noteText: state.noteText,
    options: state.options,
    actor: deps.actor,
    officialIdSet: deps.officialIdSet,
    actorColsSupportedRef: deps.lightActionsActorColumnsSupportedRef,
    domainForIncidentId: deps.domainForIncidentId,
    incidentSnapshotKey: deps.incidentSnapshotKey,
    prefixedIncidentDomainKey: deps.prefixedIncidentDomainKey,
    getIncidentDomainHelper: deps.getIncidentDomainHelper,
    setFixedLights: deps.setFixedLights,
    setLastFixByLightId: deps.setLastFixByLightId,
    setIncidentStateByKey: deps.setIncidentStateByKey,
    setActionsByLightId: deps.setActionsByLightId,
    setSelectedDomainMarker: deps.setSelectedDomainMarker,
    openNotice: deps.openNotice,
  }, {
    composeIncidentActionAuditNote,
  });
}

export async function reopenLightRuntimeShared(state = {}, deps = {}) {
  if (!state.light) return;
  const [{ composeIncidentActionAuditNote }, { reopenLightForMapShared }] = await Promise.all([
    loadIncidentDeferredSupportModule(),
    loadDeferredIncidentAdminSupportModule(),
  ]);
  return reopenLightForMapShared({
    supabase: deps.supabase,
    tenantKey: deps.activeTenantKey(),
    light: state.light,
    noteText: state.noteText,
    actor: deps.actor,
    actorColsSupportedRef: deps.lightActionsActorColumnsSupportedRef,
    domainForIncidentId: deps.domainForIncidentId,
    incidentSnapshotKey: deps.incidentSnapshotKey,
    setFixedLights: deps.setFixedLights,
    setLastFixByLightId: deps.setLastFixByLightId,
    setActionsByLightId: deps.setActionsByLightId,
    setIncidentStateByKey: deps.setIncidentStateByKey,
    openNotice: deps.openNotice,
  }, {
    composeIncidentActionAuditNote,
  });
}

export async function submitPendingIncidentActionRuntimeShared(state = {}, deps = {}) {
  if (state.markFixedSubmitting) return false;
  const lid = String(state.pendingMarkFixedLightId || "").trim();
  const domainKey = deps.normalizeDomainKeyOrSlug(state.pendingIncidentDomainKey, { allowUnknown: true }) || deps.domainForIncidentId(lid);
  const clusterReports = Array.isArray(state.pendingMarkFixedClusterReports) ? state.pendingMarkFixedClusterReports : [];
  const compatMarker = state.pendingIncidentCompatMarker;
  const noteText = String(state.markFixedNote || "").trim();
  const nextState = String(state.pendingIncidentNextState || "").trim().toLowerCase();
  const currentState = String(state.pendingIncidentCurrentState || "").trim().toLowerCase() || "reported";
  const {
    submitPendingIncidentActionShared,
    resolveIncidentStatusDialogCompatTargetShared,
  } = await loadDeferredIncidentAdminSupportModule();
  const compatTarget = compatMarker
    ? resolveIncidentStatusDialogCompatTargetShared(domainKey, {
        incidentId: lid,
        compatMarker,
      }, {
        resolveIncidentDomainHelperEntry: deps.resolveIncidentDomainHelperEntry,
        lookupIncidentIdForDomain: deps.lookupIncidentIdForDomain,
        incidentDomainCanonicalIncidentId: deps.incidentDomainCanonicalIncidentId,
      })
    : null;
  const actionImageFile = nextState === "fixed" && state.markFixedImageFile instanceof File ? state.markFixedImageFile : null;
  return submitPendingIncidentActionShared({
    supabase: deps.supabase,
    tenantKey: deps.activeTenantKey(),
    sessionUserId: String(state.sessionUserId || "").trim(),
    lid,
    domainKey,
    clusterReports,
    compatTarget,
    pendingIncidentIsOfficialTarget: state.pendingIncidentIsOfficialTarget,
    noteText,
    nextState,
    currentState,
    actionImageFile,
    pin: String(state.pendingIncidentPin || "").trim(),
    pendingIncidentLabel: state.pendingIncidentLabel,
    isMissingRelationError: deps.isMissingRelationError,
    setPendingIncidentStatusError: deps.setPendingIncidentStatusError,
    setMarkFixedSubmitting: deps.setMarkFixedSubmitting,
    markFixed: deps.markFixed,
    reopenLight: deps.reopenLight,
    activeTenantKey: deps.activeTenantKey,
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    domainForIncidentId: deps.domainForIncidentId,
    setIncidentStateByKey: deps.setIncidentStateByKey,
    incidentSnapshotKey: deps.incidentSnapshotKey,
    openConfiguredNotice: deps.openConfiguredNotice,
    resetMarkFixedDialogState: deps.resetMarkFixedDialogState,
  });
}

export async function markUtilityReportedForViewerRuntimeShared(state = {}, deps = {}) {
  const [
    {
      isMissingUtilityReportReferenceColumnError,
      normalizeUtilityReportReference,
    },
    { markUtilityReportedForViewerShared },
  ] = await Promise.all([
    loadIncidentDeferredSupportModule(),
    loadDeferredIncidentAdminSupportModule(),
  ]);
  return markUtilityReportedForViewerShared({
    supabase: deps.supabase,
    tenantKey: deps.activeTenantKey(),
    sessionUserId: state.sessionUserId,
    lightId: state.lightId,
    reportReference: state.reportReference,
    utilityReportedLightIdSet: state.utilityReportedLightIdSet,
    utilityReportReferenceByLightId: state.utilityReportReferenceByLightId,
    utilityReportedAtByLightId: state.utilityReportedAtByLightId,
    setUtilityReportedLightIdSet: deps.setUtilityReportedLightIdSet,
    setUtilityReportedAtByLightId: deps.setUtilityReportedAtByLightId,
    setUtilityReportReferenceByLightId: deps.setUtilityReportReferenceByLightId,
  }, {
    normalizeUtilityReportReference,
    isMissingUtilityReportReferenceColumnError,
  });
}

export async function clearUtilityReportedForViewerRuntimeShared(state = {}, deps = {}) {
  const { clearUtilityReportedForViewerShared } = await loadDeferredIncidentAdminSupportModule();
  return clearUtilityReportedForViewerShared({
    supabase: deps.supabase,
    tenantKey: deps.activeTenantKey(),
    sessionUserId: state.sessionUserId,
    lightId: state.lightId,
    setUtilityReportedLightIdSet: deps.setUtilityReportedLightIdSet,
    setUtilityReportedAtByLightId: deps.setUtilityReportedAtByLightId,
    setUtilityReportReferenceByLightId: deps.setUtilityReportReferenceByLightId,
  });
}
