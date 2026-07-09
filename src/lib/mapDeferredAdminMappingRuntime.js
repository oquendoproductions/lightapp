const loadDeferredMappingSupportModule = () => import("./mapDeferredMappingSupport.js");
const loadDeferredIncidentAdminSupportModule = () => import("./mapDeferredIncidentAdminSupport.js");

export async function confirmMappingQueueRuntimeShared(state = {}, deps = {}) {
  if (!state.sessionUserId) {
    deps.openNotice("⚠️", "Not signed in", "You must be logged in to place mapped assets.");
    return false;
  }
  if (!state.isAdmin) {
    deps.openNotice("⚠️", "Admin only", "Only admins can place mapped assets.");
    return false;
  }
  if (!Array.isArray(state.mappingQueue) || !state.mappingQueue.length) return true;

  deps.setSaving(true);

  try {
    const { confirmMappingQueueShared } = await loadDeferredMappingSupportModule();
    const result = await confirmMappingQueueShared({
      mappingQueue: state.mappingQueue,
      sessionUserId: state.sessionUserId,
      supabase: deps.supabase,
      makeLightIdFromCoords: deps.makeLightIdFromCoords,
      normalizeOfficialLightRow: deps.normalizeOfficialLightRow,
      normalizeOfficialSignRow: deps.normalizeOfficialSignRow,
      isValidLatLng: deps.isValidLatLng,
      incidentDomainQueueItemMatchesVariant: deps.incidentDomainQueueItemMatchesVariant,
    });
    if (!result?.ok) {
      if (result?.error) {
        console.error("[confirmMappingQueue] deferred error:", result.error);
      }
      deps.openNotice("⚠️", "Save failed", result?.errorMessage || "Could not save mapped assets.");
      deps.setSaving(false);
      return false;
    }

    const {
      cleanInsertedLights = [],
      cleanExistingLights = [],
      cleanInsertedSigns = [],
      duplicateLightCount = 0,
    } = result;

    deps.setOfficialLights((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      for (const row of [...cleanExistingLights, ...cleanInsertedLights]) {
        const idx = next.findIndex((item) => item.id === row.id);
        if (idx >= 0) next[idx] = { ...next[idx], ...row };
        else next.push(row);
      }
      return next;
    });
    deps.setConfiguredIncidentSeededRowsForDomain("street_signs", (prev) => {
      const next = Array.isArray(prev) ? [...prev] : [];
      for (const row of cleanInsertedSigns) {
        const idx = next.findIndex((item) => item.id === row.id);
        if (idx >= 0) next[idx] = { ...next[idx], ...row };
        else next.push(row);
      }
      return next;
    });

    deps.setMappingQueue([]);
    const lightCount = cleanInsertedLights.length;
    const signCount = cleanInsertedSigns.length;
    if (lightCount > 0 && signCount > 0) {
      deps.openConfiguredNotice("assets_added_successfully", {
        icon: "✅",
        title: "Assets added successfully.",
        message: "Mapped assets were added successfully.",
      }, {
        message: `${lightCount} light${lightCount === 1 ? "" : "s"}, ${signCount} sign${signCount === 1 ? "" : "s"}.`,
        autoCloseMs: 1400,
      });
    } else if (signCount > 0) {
      deps.openConfiguredNotice("signs_added_successfully", {
        icon: "✅",
        title: "Signs added successfully.",
        message: "Mapped signs were added successfully.",
      }, { autoCloseMs: 1200 });
    } else if (lightCount > 0) {
      deps.openConfiguredNotice("lights_added_successfully", {
        icon: "✅",
        title: "Lights added successfully.",
        message: "Mapped lights were added successfully.",
      }, { autoCloseMs: 1200 });
    } else {
      deps.openConfiguredNotice("nothing_saved", {
        icon: "⚠️",
        title: "Nothing saved",
        message: "Queued lights already existed or no valid mapped assets were queued.",
      });
    }
    if (duplicateLightCount > 0) {
      deps.openConfiguredNotice("existing_lights_skipped", {
        icon: "ℹ️",
        title: "Existing lights skipped",
        message: "Some queued lights already existed and were not added again.",
      }, {
        message: `${duplicateLightCount} queued light${duplicateLightCount === 1 ? "" : "s"} already existed and were not re-added.`,
        autoCloseMs: 1800,
      });
    }

    deps.setSaving(false);
    return true;
  } catch (error) {
    console.error("[confirmMappingQueue] exception:", error);
    deps.openNotice("⚠️", "Save failed", "Unexpected error saving mapped assets.");
    deps.setSaving(false);
    return false;
  }
}

export async function addOfficialLightRuntimeShared(state = {}, deps = {}) {
  const { addOfficialLightForMapShared } = await loadDeferredMappingSupportModule();
  return addOfficialLightForMapShared({
    isAdmin: state.isAdmin,
    supabase: deps.supabase,
    lat: state.lat,
    lng: state.lng,
    createdBy: state.createdBy,
    makeLightIdFromCoords: deps.makeLightIdFromCoords,
    normalizeOfficialLightRow: deps.normalizeOfficialLightRow,
    setOfficialLights: deps.setOfficialLights,
    openNotice: deps.openNotice,
  });
}

export async function deleteOfficialLightRuntimeShared(state = {}, deps = {}) {
  const { deleteOfficialLightForMapShared } = await loadDeferredMappingSupportModule();
  return deleteOfficialLightForMapShared({
    isAdmin: state.isAdmin,
    supabase: deps.supabase,
    id: state.id,
    officialLights: state.officialLights,
    closeAnyPopup: deps.closeAnyPopup,
    suppressPopupsSafe: deps.suppressPopupsSafe,
    setOfficialLights: deps.setOfficialLights,
    openNotice: deps.openNotice,
  });
}

export async function deleteOfficialLightsByIdsRuntimeShared(state = {}, deps = {}) {
  const { deleteOfficialLightsByIdsForMapShared } = await loadDeferredMappingSupportModule();
  return deleteOfficialLightsByIdsForMapShared({
    isAdmin: state.isAdmin,
    ids: state.ids,
    supabase: deps.supabase,
    closeAnyPopup: deps.closeAnyPopup,
    suppressPopupsSafe: deps.suppressPopupsSafe,
    setDeleteCircleConfirmOpen: deps.setDeleteCircleConfirmOpen,
    setSaving: deps.setSaving,
    officialLights: state.officialLights,
    setOfficialLights: deps.setOfficialLights,
    selectedOfficialId: state.selectedOfficialId,
    setSelectedOfficialId: deps.setSelectedOfficialId,
    setDeleteCircleDraft: deps.setDeleteCircleDraft,
    openNotice: deps.openNotice,
  });
}

export async function markIncidentsFixedByIdsRuntimeShared(state = {}, deps = {}) {
  const { markIncidentsFixedByIdsShared } = await loadDeferredIncidentAdminSupportModule();
  return markIncidentsFixedByIdsShared({
    isAdmin: state.isAdmin,
    ids: state.ids,
    noteText: state.noteText,
    closeAnyPopup: deps.closeAnyPopup,
    suppressPopupsSafe: deps.suppressPopupsSafe,
    setDeleteCircleConfirmOpen: deps.setDeleteCircleConfirmOpen,
    setSaving: deps.setSaving,
    markIncidentFixedByCanonicalId: deps.markIncidentFixedByCanonicalId,
    setDeleteCircleDraft: deps.setDeleteCircleDraft,
    setDeleteCircleNote: deps.setDeleteCircleNote,
    openNotice: deps.openNotice,
  });
}

export async function deleteOfficialSignRuntimeShared(state = {}, deps = {}) {
  const { deleteOfficialSignForMapShared } = await loadDeferredMappingSupportModule();
  return deleteOfficialSignForMapShared({
    isAdmin: state.isAdmin,
    supabase: deps.supabase,
    id: state.id,
    configuredIncidentSeededRowsStateByDomain: state.configuredIncidentSeededRowsStateByDomain,
    setConfiguredIncidentSeededRowsForDomain: deps.setConfiguredIncidentSeededRowsForDomain,
    closeAnyPopup: deps.closeAnyPopup,
    suppressPopupsSafe: deps.suppressPopupsSafe,
    openNotice: deps.openNotice,
  });
}
