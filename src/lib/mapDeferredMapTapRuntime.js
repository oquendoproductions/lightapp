export async function startIncidentReportAtPointRuntimeShared(domainKey, lat, lng, options = {}, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    isTenantAssetBackedDomain,
    municipalBoundaryGate,
    primePrimaryReportFlowWorkspace,
    visibleDomainOptionsByKey,
    loadIncidentReportTargetSupportModule,
    incidentDomainNormalizeSubmitTarget,
    incidentDrivenMarkersForDomain,
    openDomainReportFlow,
  } = deps;

  const normalizedDomain = normalizeDomainKeyOrSlug?.(domainKey, { allowUnknown: true });
  if (!normalizedDomain || isTenantAssetBackedDomain?.(normalizedDomain)) return;

  const targetLat = Number(lat);
  const targetLng = Number(lng);
  if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) return;
  if (!municipalBoundaryGate?.(normalizedDomain, targetLat, targetLng, { showNotice: true })) return;
  primePrimaryReportFlowWorkspace?.();
  const domainLabel =
    visibleDomainOptionsByKey?.get?.(normalizedDomain)?.label || "Incident";
  const { buildSharedIncidentReportTarget } = await loadIncidentReportTargetSupportModule();
  const nextTargetRaw = buildSharedIncidentReportTarget({
    domainKey: normalizedDomain,
    domainLabel,
    lat: targetLat,
    lng: targetLng,
    fromMapTap: options?.fromMapTap !== false,
    domainExplicitlySelected: options?.domainExplicitlySelected === true,
  });
  if (!nextTargetRaw) return;
  const nextTarget = incidentDomainNormalizeSubmitTarget?.(normalizedDomain, {
    target: nextTargetRaw,
    submitTargetMarkerCandidates: incidentDrivenMarkersForDomain?.(normalizedDomain),
  });
  await openDomainReportFlow?.(nextTarget);
}

export function processGoogleMapTapRuntimeShared(lat, lng, state = {}, deps = {}) {
  const {
    deleteCircleMode,
    isAdmin,
    deleteCircleDraft,
    showOfficialLights,
    selectedOfficialId,
    selectedQueuedTempId,
    selectedDomainMarker,
    selectedIncidentStackMarker,
    activeMapLayerKey,
    visibleDomainOptions = [],
    adminReportDomain,
    mappingMode,
    mapZoom,
    residentIncidentPickerOptions = [],
  } = state;
  const {
    setDeleteCircleDraft,
    openNotice,
    metersBetween,
    setDeleteCircleConfirmOpen,
    officialCanvasOverlayRef,
    handleOfficialMarkerClick,
    setSelectedOfficialId,
    setSelectedQueuedTempId,
    setSelectedDomainMarker,
    setSelectedIncidentStackMarker,
    INCIDENT_REPORTING_LAYER_KEY,
    incidentDomainAdminMappingQueueVariant,
    requestQueueOfficialSign,
    REPORTING_MIN_ZOOM,
    openConfiguredNotice,
    setIncidentTypePickerOpenedAt,
    setPendingIncidentTypeTarget,
    setIncidentTypePickerOpen,
    queueOfficialLight,
  } = deps;

  if (deleteCircleMode && isAdmin) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (!deleteCircleDraft?.center) {
      setDeleteCircleDraft?.({ center: { lat, lng }, radiusMeters: 0 });
      openNotice?.("🟢", "Circle center set", "Tap a second point to set the radius.", { autoCloseMs: 1200, compact: true });
      return;
    }
    const center = deleteCircleDraft.center;
    const radiusMeters = metersBetween?.(
      { lat: Number(center.lat), lng: Number(center.lng) },
      { lat, lng }
    );
    if (!Number.isFinite(radiusMeters) || radiusMeters < 2) {
      openNotice?.("⚠️", "Radius too small", "Tap farther from the center to define a larger circle.");
      return;
    }
    setDeleteCircleDraft?.({ center, radiusMeters });
    setDeleteCircleConfirmOpen?.(true);
    return;
  }

  if (showOfficialLights && Number.isFinite(lat) && Number.isFinite(lng)) {
    const hitOfficialId = officialCanvasOverlayRef?.current?.hitTestByLatLng?.(lat, lng);
    if (hitOfficialId) {
      handleOfficialMarkerClick?.(hitOfficialId);
      return;
    }
  }

  if (selectedOfficialId || selectedQueuedTempId || selectedDomainMarker || selectedIncidentStackMarker) {
    setSelectedOfficialId?.(null);
    setSelectedQueuedTempId?.(null);
    setSelectedDomainMarker?.(null);
    setSelectedIncidentStackMarker?.(null);
  }

  if (
    activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY
    && !isAdmin
    && !visibleDomainOptions.some((d) => d.key === adminReportDomain)
  ) {
    openNotice?.("⚠️", "Domain unavailable", "This report domain is not enabled for public reporting.");
    return;
  }

  if (mappingMode && isAdmin && incidentDomainAdminMappingQueueVariant?.(adminReportDomain) === "official_sign") {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    requestQueueOfficialSign?.(lat, lng);
    return;
  }

  if (activeMapLayerKey !== "streetlights") {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (Number(mapZoom) < REPORTING_MIN_ZOOM) {
      openConfiguredNotice?.("zoom_to_report", {
        icon: "🔎",
        title: "Zoom in to report",
        message: "To improve accuracy of marker placement, zoom in further to report.",
      });
      return;
    }
    if (!residentIncidentPickerOptions.length) {
      openNotice?.("⌛", "Loading report domains", "Report domain choices are still loading. Try again in a moment.");
      return;
    }
    setIncidentTypePickerOpenedAt?.(Date.now());
    setPendingIncidentTypeTarget?.({ lat, lng });
    setIncidentTypePickerOpen?.(true);
    return;
  }

  if (!mappingMode) return;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  queueOfficialLight?.(lat, lng);
}

export function handleGoogleMapClickRuntimeShared(event, state = {}, deps = {}) {
  const {
    isTouchDevice,
    clickDelayRef,
    suppressMapClickRef,
  } = state;
  const {
    setAdminDomainMenuOpen,
    setMobileIncidentDomainMenuOpen,
    setAdminToolboxOpen,
    processGoogleMapTap,
  } = deps;

  setAdminDomainMenuOpen?.(false);
  setMobileIncidentDomainMenuOpen?.(false);
  setAdminToolboxOpen?.(false);

  if (Date.now() < (suppressMapClickRef?.current?.until || 0)) return;

  const lat = Number(event?.latLng?.lat?.());
  const lng = Number(event?.latLng?.lng?.());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  if (!isTouchDevice) {
    processGoogleMapTap?.(lat, lng);
    return;
  }

  const ref = clickDelayRef?.current;
  if (!ref) {
    processGoogleMapTap?.(lat, lng);
    return;
  }

  const now = Date.now();
  const dt = now - (ref.lastTs || 0);
  ref.lastTs = now;

  if (dt < 350) {
    if (ref.timer) clearTimeout(ref.timer);
    ref.timer = null;
    ref.lastLatLng = null;
    if (suppressMapClickRef?.current) {
      suppressMapClickRef.current.until = Date.now() + 900;
    }
    return;
  }

  if (ref.timer) clearTimeout(ref.timer);
  ref.lastLatLng = { lat, lng };
  ref.timer = setTimeout(() => {
    const pending = clickDelayRef?.current;
    if (pending?.timer) pending.timer = null;
    const point = pending?.lastLatLng || { lat, lng };
    if (pending) pending.lastLatLng = null;
    processGoogleMapTap?.(Number(point?.lat), Number(point?.lng));
  }, 360);
}

export function handleGoogleMapDoubleClickRuntimeShared(state = {}) {
  const {
    clickDelayRef,
    suppressMapClickRef,
  } = state;

  const ref = clickDelayRef?.current;
  if (ref?.timer) {
    clearTimeout(ref.timer);
    ref.timer = null;
  }
  if (ref) ref.lastLatLng = null;
  if (suppressMapClickRef?.current) {
    suppressMapClickRef.current.until = Date.now() + 900;
  }
}
