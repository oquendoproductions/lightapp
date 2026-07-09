const loadDeferredIncidentSupportModule = () => import("./mapDeferredIncidentSupport.js");
const loadDeferredReportSubmitSupportModule = () => import("./mapDeferredReportSubmitSupport.js");
const loadReportFlowSelectionSupportModule = () => import("./mapReportFlowSelectionSupport.js");
const loadRuntimeDomainReportConfigSupportModule = () => import("./mapRuntimeDomainReportConfigSupport.js");

export async function submitIsWorkingRuntimeShared(state = {}, deps = {}) {
  const { submitIsWorkingShared } = await loadDeferredIncidentSupportModule();
  return submitIsWorkingShared({
    lightId: state.lightId,
    saving: state.saving,
    session: state.session,
    guestSubmitBypassRef: state.guestSubmitBypassRef,
    guestInfoDraft: state.guestInfoDraft,
    guestInfo: state.guestInfo,
    profile: state.profile,
    officialLights: state.officialLights,
  }, {
    requestGuestChallenge: deps.requestGuestChallenge,
    openNotice: deps.openNotice,
    normalizeEmail: deps.normalizeEmail,
    setSaving: deps.setSaving,
    registerAbuseEventWithServer: deps.registerAbuseEventWithServer,
    openRateLimitNotice: deps.openRateLimitNotice,
    normalizePhone: deps.normalizePhone,
    supabase: deps.supabase,
    insertReportWithFallback: deps.insertReportWithFallback,
    normalizeReportQuality: deps.normalizeReportQuality,
    setReports: deps.setReports,
    clearGuestContact: deps.clearGuestContact,
    openReportSuccess: deps.openReportSuccess,
  });
}

export async function submitIncidentRepairConfirmationRuntimeShared(state = {}, deps = {}) {
  const { submitIncidentRepairConfirmationShared } = await loadDeferredIncidentSupportModule();
  return submitIncidentRepairConfirmationShared({
    incidentIdRaw: state.incidentIdRaw,
    domainKeyRaw: state.domainKeyRaw,
    saving: state.saving,
    session: state.session,
    guestSubmitBypassRef: state.guestSubmitBypassRef,
    guestInfoDraft: state.guestInfoDraft,
    guestInfo: state.guestInfo,
    profile: state.profile,
    viewerIdentityKey: state.viewerIdentityKey,
  }, {
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    domainForIncidentId: deps.domainForIncidentId,
    isPublicRepairEnabledForDomain: deps.isPublicRepairEnabledForDomain,
    openNotice: deps.openNotice,
    getIncidentRepairSnapshot: deps.getIncidentRepairSnapshot,
    markIncidentRepairSignalOptimistically: deps.markIncidentRepairSignalOptimistically,
    requestGuestChallenge: deps.requestGuestChallenge,
    normalizeEmail: deps.normalizeEmail,
    reporterIdentityKey: deps.reporterIdentityKey,
    setSaving: deps.setSaving,
    registerAbuseEventWithServer: deps.registerAbuseEventWithServer,
    openRateLimitNotice: deps.openRateLimitNotice,
    supabase: deps.supabase,
    activeTenantKey: deps.activeTenantKey,
    refreshIncidentRepairProgress: deps.refreshIncidentRepairProgress,
    clearGuestContact: deps.clearGuestContact,
    openConfiguredNotice: deps.openConfiguredNotice,
  });
}

export async function submitStreetlightReportRuntimeShared(state = {}, deps = {}) {
  const [
    { resolveRuntimeDomainIssueOptionsShared },
    {
      isStreetlightOtherIssue,
      resolveStoredStreetlightReportType,
    },
    { submitStreetlightReportShared },
  ] = await Promise.all([
    loadRuntimeDomainReportConfigSupportModule(),
    loadReportFlowSelectionSupportModule(),
    loadDeferredReportSubmitSupportModule(),
  ]);
  const streetlightIssueOptions = resolveRuntimeDomainIssueOptionsShared("streetlights");
  return submitStreetlightReportShared({
    picked: state.picked,
    saving: state.saving,
    activeLight: state.activeLight,
    session: state.session,
    guestSubmitBypassRef: state.guestSubmitBypassRef,
    guestInfoDraft: state.guestInfoDraft,
    guestInfo: state.guestInfo,
    reportType: state.reportType,
    streetlightIssueOptions,
    note: state.note,
    profile: state.profile,
    officialIdSet: state.officialIdSet,
    officialLights: state.officialLights,
    streetlightConfidenceByLightId: state.streetlightConfidenceByLightId,
    reports: state.reports,
    fixedLights: state.fixedLights,
    lastFixByLightId: state.lastFixByLightId,
    streetlightAreaPowerOn: state.streetlightAreaPowerOn,
    streetlightHazardYesNo: state.streetlightHazardYesNo,
  }, {
    isStreetlightOtherIssue,
    requestGuestChallenge: deps.requestGuestChallenge,
    openNotice: deps.openNotice,
    normalizeEmail: deps.normalizeEmail,
    canIdentityReportLight: deps.canIdentityReportLight,
    setActiveLight: deps.setActiveLight,
    setPicked: deps.setPicked,
    setSaving: deps.setSaving,
    registerAbuseEventWithServer: deps.registerAbuseEventWithServer,
    openRateLimitNotice: deps.openRateLimitNotice,
    reverseGeocodeRoadLabel: deps.reverseGeocodeRoadLabel,
    supabase: deps.supabase,
    activeTenantKey: deps.activeTenantKey,
    setOfficialLights: deps.setOfficialLights,
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    runtimeDomainMeta: deps.runtimeDomainMeta,
    resolveStoredStreetlightReportType,
    insertReportWithFallback: deps.insertReportWithFallback,
    normalizeReportQuality: deps.normalizeReportQuality,
    setReports: deps.setReports,
    clearGuestContact: deps.clearGuestContact,
    closeAnyPopup: deps.closeAnyPopup,
    suppressMapClickRef: deps.suppressMapClickRef,
    openReportSuccess: deps.openReportSuccess,
    setNote: deps.setNote,
    setStreetlightAreaPowerOn: deps.setStreetlightAreaPowerOn,
    setStreetlightHazardYesNo: deps.setStreetlightHazardYesNo,
    lightIdFor: deps.lightIdFor,
  });
}

export async function submitBulkStreetlightReportsRuntimeShared(state = {}, deps = {}) {
  const [
    { resolveRuntimeDomainIssueOptionsShared },
    {
      isStreetlightOtherIssue,
      resolveStoredStreetlightReportType,
    },
    { submitBulkStreetlightReportsShared },
  ] = await Promise.all([
    loadRuntimeDomainReportConfigSupportModule(),
    loadReportFlowSelectionSupportModule(),
    loadDeferredReportSubmitSupportModule(),
  ]);
  const streetlightIssueOptions = resolveRuntimeDomainIssueOptionsShared("streetlights");
  return submitBulkStreetlightReportsShared({
    saving: state.saving,
    mapZoomRef: state.mapZoomRef,
    mapZoom: state.mapZoom,
    bulkSelectedIds: state.bulkSelectedIds,
    session: state.session,
    guestSubmitBypassRef: state.guestSubmitBypassRef,
    guestInfoDraft: state.guestInfoDraft,
    guestInfo: state.guestInfo,
    profile: state.profile,
    reportType: state.reportType,
    streetlightIssueOptions,
    note: state.note,
    streetlightAreaPowerOn: state.streetlightAreaPowerOn,
    streetlightHazardYesNo: state.streetlightHazardYesNo,
    streetlightConfidenceByLightId: state.streetlightConfidenceByLightId,
    reports: state.reports,
    fixedLights: state.fixedLights,
    lastFixByLightId: state.lastFixByLightId,
    officialLights: state.officialLights,
  }, {
    isStreetlightOtherIssue,
    resolveStoredStreetlightReportType,
    reportMinZoom: deps.reportMinZoom,
    openConfiguredNotice: deps.openConfiguredNotice,
    openNotice: deps.openNotice,
    bulkMaxLightsPerSubmit: deps.bulkMaxLightsPerSubmit,
    requestGuestChallenge: deps.requestGuestChallenge,
    normalizeEmail: deps.normalizeEmail,
    normalizeDomainKeyOrSlug: deps.normalizeDomainKeyOrSlug,
    runtimeDomainMeta: deps.runtimeDomainMeta,
    setSaving: deps.setSaving,
    registerAbuseEventWithServer: deps.registerAbuseEventWithServer,
    openRateLimitNotice: deps.openRateLimitNotice,
    closeAnyPopup: deps.closeAnyPopup,
    suppressPopupsSafe: deps.suppressPopupsSafe,
    canIdentityReportLight: deps.canIdentityReportLight,
    insertReportWithFallback: deps.insertReportWithFallback,
    normalizeReportQuality: deps.normalizeReportQuality,
    setReports: deps.setReports,
    setBulkConfirmOpen: deps.setBulkConfirmOpen,
    clearBulkSelection: deps.clearBulkSelection,
    setNote: deps.setNote,
    setStreetlightAreaPowerOn: deps.setStreetlightAreaPowerOn,
    setStreetlightHazardYesNo: deps.setStreetlightHazardYesNo,
    clearGuestContact: deps.clearGuestContact,
    openReportSuccess: deps.openReportSuccess,
  });
}
