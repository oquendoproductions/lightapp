import React, { memo } from "react";
import MapLazyDesktopAdminControls from "./mapLazyDesktopAdminControls.jsx";
import { STREET_SIGN_TYPE_OPTIONS, STREET_SIGN_TYPE_VALUES } from "./lib/mapDomainSelectionConfig.js";
import { REPORTING_MIN_ZOOM } from "./lib/mapPopupSharedConfig.js";

export default memo(function MapLazyDesktopAdminControlsBridge({
  deferredDialogsVisible,
  exitMappingConfirmOpen,
  mappingQueueLength,
  saving,
  confirmMappingQueue,
  setExitMappingConfirmOpen,
  exitMappingMode,
  clearQueuedConfirmOpen,
  confirmClearQueuedLights,
  setClearQueuedConfirmOpen,
  domainSwitchConfirmOpen,
  pendingDomainSwitchTarget,
  placeQueuedAndSwitchDomain,
  clearQueuedAndSwitchDomain,
  cancelAdminDomainSwitch,
  queueSignTypeOpen,
  pendingQueuedSign,
  setPendingQueuedSign,
  confirmQueueOfficialSign,
  cancelQueueOfficialSign,
  prefersDarkMode,
  deleteCircleConfirmOpen,
  deleteCircleCandidateIds,
  deleteCircleNote,
  setDeleteCircleNote,
  markIncidentsFixedByIds,
  setDeleteCircleConfirmOpen,
  setDeleteCircleDraft,
  deleteOfficialConfirmOpen,
  pendingDeleteOfficialLightId,
  setDeleteOfficialConfirmOpen,
  setPendingDeleteOfficialLightId,
  deleteOfficialLight,
  closeAnyPopup,
  deleteOfficialSignConfirmOpen,
  pendingDeleteOfficialSignId,
  setDeleteOfficialSignConfirmOpen,
  setPendingDeleteOfficialSignId,
  deleteOfficialSign,
  useAppShellLayout,
  isAdmin,
  showAdminTools,
  adminToolboxOpen,
  setAdminToolboxOpen,
  setAdminDomainMenuOpen,
  showToolHint,
  isStreetlightsLayerActive,
  deleteCircleMode,
  setDeleteCircleMode,
  setMappingMode,
  setMappingQueue,
  setBulkMode,
  setBulkConfirmOpen,
  clearBulkSelection,
  suppressPopupsSafe,
  openNotice,
  locationDiagnosticsOpen,
  setLocationDiagnosticsOpen,
  isAssetReportingDomain,
  mappingMode,
  showMobileMapTabContent,
  canUseStreetlightBulk,
  bulkMode,
  bulkMaxLightsPerSubmit,
  bulkSelectedCount,
  mapZoomRef,
  mapZoom,
  openConfiguredNotice,
  setNote,
  setReportType,
  setStreetlightAreaPowerOn,
  setStreetlightHazardYesNo,
  requestClearQueuedLights,
  mappingUnitLabel,
}) {
  return (
    <MapLazyDesktopAdminControls
      deferredDialogsVisible={deferredDialogsVisible}
      deferredDialogsProps={{
        exitMappingConfirmOpen,
        mappingQueueCount: mappingQueueLength,
        saving,
        onConfirmExitMapping: async () => {
          const ok = await confirmMappingQueue();
          if (!ok) return;
          setExitMappingConfirmOpen(false);
          exitMappingMode();
        },
        onDiscardExitMapping: () => {
          setExitMappingConfirmOpen(false);
          exitMappingMode();
        },
        onCancelExitMapping: () => setExitMappingConfirmOpen(false),
        clearQueuedConfirmOpen,
        onConfirmClearQueued: confirmClearQueuedLights,
        onCancelClearQueued: () => setClearQueuedConfirmOpen(false),
        domainSwitchConfirmOpen,
        pendingDomainSwitchTargetLabel: String(pendingDomainSwitchTarget?.label || "the selected domain"),
        onPlaceAndSwitch: placeQueuedAndSwitchDomain,
        onClearAndSwitch: clearQueuedAndSwitchDomain,
        onCancelDomainSwitch: cancelAdminDomainSwitch,
        queueSignTypeOpen,
        pendingQueuedSignType: String(pendingQueuedSign?.sign_type || ""),
        onPendingQueuedSignTypeChange: (valueRaw) =>
          setPendingQueuedSign((prev) =>
            prev
              ? { ...prev, sign_type: String(valueRaw || "").trim().toLowerCase() }
              : prev
          ),
        signTypeOptions: STREET_SIGN_TYPE_OPTIONS,
        canConfirmQueueSign: STREET_SIGN_TYPE_VALUES.has(String(pendingQueuedSign?.sign_type || "").trim().toLowerCase()),
        onConfirmQueueSign: confirmQueueOfficialSign,
        onCancelQueueSign: cancelQueueOfficialSign,
        darkMode: prefersDarkMode,
        deleteCircleConfirmOpen,
        deleteCircleCandidateCount: deleteCircleCandidateIds.length,
        deleteCircleNote,
        onDeleteCircleNoteChange: setDeleteCircleNote,
        onConfirmDeleteCircle: async () => {
          if (saving) return;
          await markIncidentsFixedByIds(deleteCircleCandidateIds, String(deleteCircleNote || "").trim());
        },
        onCancelDeleteCircle: () => {
          if (saving) return;
          setDeleteCircleConfirmOpen(false);
        },
        onClearDeleteCircle: () => {
          if (saving) return;
          setDeleteCircleConfirmOpen(false);
          setDeleteCircleDraft(null);
          setDeleteCircleNote("");
        },
        deleteOfficialConfirmOpen,
        onConfirmDeleteOfficial: async () => {
          const lid = String(pendingDeleteOfficialLightId || "").trim();
          setDeleteOfficialConfirmOpen(false);
          setPendingDeleteOfficialLightId(null);
          if (!lid) return;
          await deleteOfficialLight(lid);
          closeAnyPopup();
        },
        onCancelDeleteOfficial: () => {
          setDeleteOfficialConfirmOpen(false);
          setPendingDeleteOfficialLightId(null);
        },
        deleteOfficialSignConfirmOpen,
        onConfirmDeleteOfficialSign: async () => {
          const sid = String(pendingDeleteOfficialSignId || "").trim();
          setDeleteOfficialSignConfirmOpen(false);
          setPendingDeleteOfficialSignId(null);
          if (!sid) return;
          await deleteOfficialSign(sid);
          closeAnyPopup();
        },
        onCancelDeleteOfficialSign: () => {
          setDeleteOfficialSignConfirmOpen(false);
          setPendingDeleteOfficialSignId(null);
        },
      }}
      adminControlsProps={{
        showAdminControls: !useAppShellLayout && (isAdmin || showAdminTools),
        adminToolboxOpen,
        setAdminToolboxOpen,
        setAdminDomainMenuOpen,
        showToolHint,
        prefersDarkMode,
        isAdmin,
        isStreetlightsLayerActive,
        deleteCircleMode,
        setDeleteCircleMode,
        setDeleteCircleDraft,
        setDeleteCircleConfirmOpen,
        setDeleteCircleNote,
        setMappingMode,
        setMappingQueue,
        setBulkMode,
        setBulkConfirmOpen,
        clearBulkSelection,
        closeAnyPopup,
        suppressPopupsSafe,
        openNotice,
        showAdminTools,
        locationDiagnosticsOpen,
        setLocationDiagnosticsOpen,
        isAssetReportingDomain,
        mappingQueueLength,
        mappingMode,
        setExitMappingConfirmOpen,
      }}
      bulkActionBarProps={{
        visible: showMobileMapTabContent && canUseStreetlightBulk && bulkMode,
        bulkMaxLightsPerSubmit,
        bulkSelectedCount,
        saving,
        clearBulkSelection,
        openNotice,
        mapZoomRef,
        mapZoom,
        reportingMinZoom: REPORTING_MIN_ZOOM,
        openConfiguredNotice,
        closeAnyPopup,
        suppressPopupsSafe,
        setNote,
        setReportType,
        setStreetlightAreaPowerOn,
        setStreetlightHazardYesNo,
        setBulkConfirmOpen,
      }}
      mappingActionBarProps={{
        visible: showMobileMapTabContent && mappingMode && mappingQueueLength > 0,
        requestClearQueuedLights,
        confirmMappingQueue,
        mappingQueueLength,
        mappingUnitLabel,
      }}
    />
  );
});
