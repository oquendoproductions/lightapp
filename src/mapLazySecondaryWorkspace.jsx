import React, { Fragment, Suspense, lazy, useMemo } from "react";
import {
  adminFacingIncidentStateLabel,
  adminIncidentStateOptionsForDomain,
} from "./lib/incidentLifecycle.js";
import { normalizeDomainKeyOrSlug } from "./lib/mapReportParsingSupport.js";
import {
  buildIncidentDrivenRecordMapByDomainShared,
  buildIncidentIssueStateByDomainShared,
} from "./lib/mapDeferredIncidentWorkspaceStateSupport.js";

const loadResidentFeedsModule = () => import("./mapLazyResidentFeeds.jsx");
const loadOpenReportsModalModule = () => import("./mapLazyOpenReportsModal.jsx");
const loadOpenReportsDialogsModule = () => import("./mapLazyOpenReportsDialogs.jsx");

const LazyNotificationsWindow = lazy(() => loadResidentFeedsModule().then((module) => ({ default: module.NotificationsController })));
const LazyAlertsWindow = lazy(() => loadResidentFeedsModule().then((module) => ({ default: module.AlertsWindowController })));
const LazyEventsWindow = lazy(() => loadResidentFeedsModule().then((module) => ({ default: module.EventsWindowController })));
const LazyOpenReportsModalImpl = lazy(() =>
  loadOpenReportsModalModule().then((module) => ({ default: module.OpenReportsModalController }))
);
const LazyOpenReportsUtilityReportDialogModal = lazy(() => loadOpenReportsDialogsModule().then((module) => ({ default: module.OpenReportsUtilityReportDialogModal })));
const LazyOpenReportsConfirmWorkingModal = lazy(() => loadOpenReportsDialogsModule().then((module) => ({ default: module.OpenReportsConfirmWorkingModal })));
const LazyOpenReportsIncidentRepairConfirmModal = lazy(() => loadOpenReportsDialogsModule().then((module) => ({ default: module.OpenReportsIncidentRepairConfirmModal })));
const LazyOpenReportsIncidentStateUpdateModal = lazy(() => loadOpenReportsDialogsModule().then((module) => ({ default: module.OpenReportsIncidentStateUpdateModal })));
const LazyModerationFlagsModal = lazy(() => import("./mapLazyReportInspectors.jsx").then((module) => ({ default: module.ModerationFlagsModal })));
const LazyCommunityFeedEditorModal = lazy(() => import("./mapLazyCommunityFeedEditor.jsx").then((module) => ({ default: module.CommunityFeedEditorController })));

function OpenReportsModal(props) {
  const { open } = props;
  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <LazyOpenReportsModalImpl {...props} />
    </Suspense>
  );
}

export default function MapLazySecondaryWorkspace({
  reportDialogs,
  moderationWorkspace,
  residentFeedWorkspace,
  communityFeedEditorWorkspace,
  reportsWorkspaceShared,
  myReportsWorkspaceConfig,
  openReportsWorkspaceConfig,
}) {
  const {
    markWorkingConfirmOpen,
    pendingWorkingLightId,
    setPendingWorkingLightId,
    setIsWorkingConfirmOpen,
    submitMarkWorkingForViewer,
    incidentRepairConfirmOpen,
    pendingIncidentRepairId,
    pendingIncidentRepairDomainKey,
    closeIncidentRepairConfirmDialog,
    submitIncidentRepairConfirmation,
    utilityReportDialogOpen,
    pendingUtilityReportReference,
    setPendingUtilityReportReference,
    pendingUtilityReportLightId,
    closeUtilityReportDialog,
    markUtilityReportedForViewer,
    openConfiguredNotice,
    markFixedConfirmOpen,
    pendingIncidentLabel,
    pendingIncidentCurrentState,
    pendingIncidentDomainKey,
    pendingIncidentNextState,
    setPendingIncidentNextState,
    setPendingIncidentActionType,
    markFixedNote,
    setMarkFixedNote,
    markFixedSubmitting,
    markFixedImageFile,
    markFixedImagePreviewUrl,
    setMarkFixedImageFile,
    pendingIncidentPin,
    setPendingIncidentPin,
    pendingIncidentStatusError,
    submitPendingIncidentAction,
    resetMarkFixedDialogState,
  } = reportDialogs;
  const {
    moderationFlagsOpen,
    setModerationFlagsOpen,
    isAdmin,
    loadOpenAbuseFlagSummary,
    isMobile,
    mobileTabPageTopInset,
    mobileReportsPageBottomInset,
  } = moderationWorkspace;
  const {
    notificationsWindowOpen,
    setNotificationsWindowOpen,
    residentFeedRuntimeReady,
    showMapNotificationsIcon,
    setResidentNotificationLocations,
    residentNotificationsRefreshToken,
    prefersDarkMode,
    useAppShellLayout,
    openResidentNotificationTarget,
    supabase,
    authReady,
    tenantReady,
    resolvedCommunityFeedTenantKey,
    communityFeedViewerKey,
    residentFeedRuntimeSupport,
    isMissingFunctionError,
    isMissingRelationError,
    isExpectedPermissionError,
    alertsWindowOpen,
    setAlertsWindowOpen,
    mapCommunityAlerts,
    mapCommunityFeedLoading,
    mapCommunityFeedError,
    alertsSessionNewKeys,
    focusedResidentAlertId,
    openCommunityFeedEditor,
    handleResidentAlertVisible,
    eventsWindowOpen,
    setEventsWindowOpen,
    mapCommunityEvents,
    eventsSessionNewKeys,
    focusedResidentEventId,
    handleResidentEventVisible,
    sessionUserId,
  } = residentFeedWorkspace;
  const {
    communityFeedEditor,
    mapCommunityTopics,
    closeCommunityFeedEditor,
    loadMapCommunityFeed,
    openNotice,
  } = communityFeedEditorWorkspace;
  const buildReportsWorkspaceOnUpdateIncidentStatus = ({
    onClose,
    openIncidentStatusDialogForTarget,
    isTenantAssetBackedDomain,
  }) => (row, rowDomainKey = "") => {
    const incidentKey = String(row?.incident_id || "").trim();
    const domainKey = normalizeDomainKeyOrSlug(rowDomainKey || row?.domainKey || row?.domain, { allowUnknown: true });
    if (!incidentKey || !domainKey) return;
    onClose?.();
    const clusterRows = Array.isArray(row?.rows) ? row.rows : [];
    openIncidentStatusDialogForTarget({
      incidentId: incidentKey,
      domainKey,
      currentState: row?.current_state || "",
      clusterReports: clusterRows,
      incidentLabel: row?.incident_label || "",
      isOfficial: isTenantAssetBackedDomain(domainKey),
    });
  };
  const buildReportsWorkspaceOnFlyTo = ({
    onClose,
    flyToLightAndOpen,
  }) => (pos, zoom, lightId) => {
    onClose?.();
    flyToLightAndOpen(pos, zoom, lightId);
  };
  const buildMyReportsWorkspaceOnMarkWorkingIncident = ({
    onClose,
    setPendingWorkingLightId,
    setIsWorkingConfirmOpen,
  }) => (incidentId) => {
    const lid = String(incidentId || "").trim();
    if (!lid) return;
    onClose?.();
    setPendingWorkingLightId(lid);
    setIsWorkingConfirmOpen(true);
  };
  const {
    reports,
    officialLights,
    slIdByUuid,
    fixedLights,
    lastFixByLightId,
    actionsByLightId,
    session,
    profile,
    incidentStateByKey,
    reportKnownAssetIdSetsByDomainForExport,
    cityBoundaryLoaded,
    isWithinCityLimits,
    getStreetlightUtilityDetails,
    onUtilityReportedChange,
    streetlightConfidenceByLightId,
    incidentRepairProgressByKey,
    persistedIncidentRepairConfirmedKeySet,
    canShowPublicRepairAction,
    onConfirmRepairIncident,
    pageTopInset,
    pageBottomInset,
    preferAppShellBehavior,
    incidentLocationCacheSeed,
    persistIncidentLocationCacheEntry,
    isSharedIncidentDomain,
    persistedIncidentRecordStateByDomain,
    configuredIncidentSeededByIdByDomain,
    configuredIncidentReportRowsByDomain,
    configuredIncidentSeededRowsByDomain,
    viewerIdentityKey,
    openIncidentStatusDialogForTarget,
    isTenantAssetBackedDomain,
    flyToLightAndOpen,
    setPendingWorkingLightId: setPendingWorkingLightIdForReportsWorkspace,
    setIsWorkingConfirmOpen: setIsWorkingConfirmOpenForReportsWorkspace,
  } = reportsWorkspaceShared;
  const incidentIssueStateByDomain = useMemo(
    () => buildIncidentIssueStateByDomainShared(persistedIncidentRecordStateByDomain),
    [persistedIncidentRecordStateByDomain]
  );
  const incidentDrivenRecordMapByDomain = useMemo(
    () => buildIncidentDrivenRecordMapByDomainShared({
      configuredIncidentSeededByIdByDomain,
      persistedIncidentRecordStateByDomain,
      shouldBuild: true,
    }),
    [configuredIncidentSeededByIdByDomain, persistedIncidentRecordStateByDomain]
  );
  const myReportsWorkspace = {
    ...myReportsWorkspaceConfig,
    groups: null,
    reports,
    allDomainReports: null,
    officialLights,
    slIdByUuid,
    fixedLights,
    lastFixByLightId,
    onFlyTo: buildReportsWorkspaceOnFlyTo({
      onClose: myReportsWorkspaceConfig.onClose,
      flyToLightAndOpen,
    }),
    onUpdateIncidentStatus: myReportsWorkspaceConfig.showUpdateIncidentStatus
      ? buildReportsWorkspaceOnUpdateIncidentStatus({
        onClose: myReportsWorkspaceConfig.onClose,
        openIncidentStatusDialogForTarget,
        isTenantAssetBackedDomain,
      })
      : null,
    actionsByLightId,
    session,
    profile,
    incidentStateByKey,
    reportKnownAssetIdSetsByDomainForExport,
    cityBoundaryLoaded,
    isWithinCityLimits,
    getStreetlightUtilityDetails,
    onUtilityReportedChange,
    onMarkWorkingIncident: buildMyReportsWorkspaceOnMarkWorkingIncident({
      onClose: myReportsWorkspaceConfig.onClose,
      setPendingWorkingLightId: setPendingWorkingLightIdForReportsWorkspace,
      setIsWorkingConfirmOpen: setIsWorkingConfirmOpenForReportsWorkspace,
    }),
    streetlightConfidenceByLightId,
    incidentRepairProgressByKey,
    persistedIncidentRepairConfirmedKeySet,
    canShowPublicRepairAction,
    onConfirmRepairIncident,
    pageTopInset,
    pageBottomInset,
    preferAppShellBehavior,
    incidentLocationCacheSeed,
    persistIncidentLocationCacheEntry,
    isSharedIncidentDomain,
    incidentDrivenRecordMapByDomain,
    incidentIssueStateByDomain,
    configuredIncidentReportRowsByDomain,
    configuredIncidentSeededRowsByDomain,
    viewerIdentityKey,
  };
  const openReportsWorkspace = {
    ...openReportsWorkspaceConfig,
    groups: null,
    reports,
    allDomainReports: null,
    officialLights,
    slIdByUuid,
    fixedLights,
    lastFixByLightId,
    onFlyTo: buildReportsWorkspaceOnFlyTo({
      onClose: openReportsWorkspaceConfig.onClose,
      flyToLightAndOpen,
    }),
    onUpdateIncidentStatus: buildReportsWorkspaceOnUpdateIncidentStatus({
      onClose: openReportsWorkspaceConfig.onClose,
      openIncidentStatusDialogForTarget,
      isTenantAssetBackedDomain,
    }),
    actionsByLightId,
    session,
    profile,
    incidentStateByKey,
    reportKnownAssetIdSetsByDomainForExport,
    cityBoundaryLoaded,
    isWithinCityLimits,
    getStreetlightUtilityDetails,
    onUtilityReportedChange,
    streetlightConfidenceByLightId,
    incidentRepairProgressByKey,
    persistedIncidentRepairConfirmedKeySet,
    canShowPublicRepairAction,
    onConfirmRepairIncident,
    pageTopInset,
    pageBottomInset,
    preferAppShellBehavior,
    incidentLocationCacheSeed,
    persistIncidentLocationCacheEntry,
    isSharedIncidentDomain,
    incidentDrivenRecordMapByDomain,
    incidentIssueStateByDomain,
    configuredIncidentReportRowsByDomain,
  };

  return (
    <Fragment>
      {markWorkingConfirmOpen ? (
        <Suspense fallback={null}>
          <LazyOpenReportsConfirmWorkingModal
            open={markWorkingConfirmOpen}
            onConfirm={async () => {
              const lid = String(pendingWorkingLightId || "").trim();
              setPendingWorkingLightId("");
              setIsWorkingConfirmOpen(false);
              if (!lid) return;
              await submitMarkWorkingForViewer(lid);
            }}
            onCancel={() => {
              setPendingWorkingLightId("");
              setIsWorkingConfirmOpen(false);
            }}
          />
        </Suspense>
      ) : null}

      {incidentRepairConfirmOpen ? (
        <Suspense fallback={null}>
          <LazyOpenReportsIncidentRepairConfirmModal
            open={incidentRepairConfirmOpen}
            onConfirm={async () => {
              const incidentId = String(pendingIncidentRepairId || "").trim();
              const domainKey = String(pendingIncidentRepairDomainKey || "").trim();
              closeIncidentRepairConfirmDialog();
              if (!incidentId || !domainKey) return;
              await submitIncidentRepairConfirmation(incidentId, domainKey);
            }}
            onCancel={closeIncidentRepairConfirmDialog}
          />
        </Suspense>
      ) : null}

      {utilityReportDialogOpen ? (
        <Suspense fallback={null}>
          <LazyOpenReportsUtilityReportDialogModal
            open={utilityReportDialogOpen}
            reference={pendingUtilityReportReference}
            setReference={setPendingUtilityReportReference}
            onSave={async () => {
              const lid = String(pendingUtilityReportLightId || "").trim();
              const reference = pendingUtilityReportReference;
              closeUtilityReportDialog();
              if (!lid) return;
              const saved = await markUtilityReportedForViewer(lid, reference);
              if (saved) {
                openConfiguredNotice("utility_report_saved", {
                  icon: "✅",
                  title: "Utility report saved",
                  message: "Utility reporting status was updated.",
                });
              }
            }}
            onCancel={closeUtilityReportDialog}
          />
        </Suspense>
      ) : null}

      {markFixedConfirmOpen ? (
        <Suspense fallback={null}>
          <LazyOpenReportsIncidentStateUpdateModal
            open={markFixedConfirmOpen}
            incidentLabel={pendingIncidentLabel}
            currentStateLabel={adminFacingIncidentStateLabel(pendingIncidentCurrentState)}
            stateOptions={adminIncidentStateOptionsForDomain(pendingIncidentCurrentState, pendingIncidentDomainKey).map((stateKey) => ({
              value: stateKey,
              label: adminFacingIncidentStateLabel(stateKey),
            }))}
            nextState={pendingIncidentNextState}
            onNextStateChange={(nextValueRaw) => {
              const nextValue = String(nextValueRaw || "").trim().toLowerCase();
              setPendingIncidentNextState(nextValue);
              setPendingIncidentActionType(nextValue === "fixed" ? "fix" : "status");
            }}
            note={markFixedNote}
            onNoteChange={setMarkFixedNote}
            notePlaceholder={pendingIncidentNextState === "reported" && pendingIncidentCurrentState === "fixed"
              ? "What puts this incident back into a reported state?"
              : pendingIncidentNextState === "fixed"
                ? "What was fixed? (crew notes, observed condition, etc.)"
                : pendingIncidentNextState === "confirmed"
                  ? "What confirms this incident?"
                  : "Optional notes for this state change"}
            showClosurePhoto={pendingIncidentNextState === "fixed"}
            submitting={markFixedSubmitting}
            imageFile={markFixedImageFile}
            imagePreviewUrl={markFixedImagePreviewUrl}
            onImageFileChange={setMarkFixedImageFile}
            onRemoveImage={() => setMarkFixedImageFile(null)}
            pin={pendingIncidentPin}
            onPinChange={(valueRaw) => {
              const nextValue = String(valueRaw || "").replace(/\D/g, "").slice(0, 4);
              setPendingIncidentPin(nextValue);
            }}
            errorText={pendingIncidentStatusError}
            stateUnchanged={String(pendingIncidentNextState || "").trim().toLowerCase() === (String(pendingIncidentCurrentState || "").trim().toLowerCase() || "reported")}
            onSave={submitPendingIncidentAction}
            onCancel={resetMarkFixedDialogState}
          />
        </Suspense>
      ) : null}

      {moderationFlagsOpen ? (
        <Suspense fallback={null}>
          <LazyModerationFlagsModal
            open={moderationFlagsOpen}
            onClose={() => setModerationFlagsOpen(false)}
            isAdmin={isAdmin}
            onSummaryRefresh={() => loadOpenAbuseFlagSummary({ silent: true })}
            isMobile={isMobile}
            pageTopInset={mobileTabPageTopInset}
            pageBottomInset={mobileReportsPageBottomInset}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={null}>
        {notificationsWindowOpen && residentFeedRuntimeReady ? (
          <LazyNotificationsWindow
            enabled={showMapNotificationsIcon}
            open={notificationsWindowOpen}
            onClose={() => setNotificationsWindowOpen(false)}
            onLocationSummaryChange={setResidentNotificationLocations}
            refreshToken={residentNotificationsRefreshToken}
            darkMode={prefersDarkMode}
            pageMode={useAppShellLayout}
            pageTopInset={mobileTabPageTopInset}
            pageBottomInset={mobileReportsPageBottomInset}
            onOpenNotification={(item) => {
              void openResidentNotificationTarget(item);
            }}
            supabase={supabase}
            authReady={authReady}
            tenantReady={tenantReady}
            resolvedCommunityFeedTenantKey={resolvedCommunityFeedTenantKey}
            communityFeedViewerKey={communityFeedViewerKey}
            emptyMapCommunityFeedReadState={residentFeedRuntimeSupport.emptyMapCommunityFeedReadState}
            loadMapCommunityFeedReadState={residentFeedRuntimeSupport.loadMapCommunityFeedReadState}
            isUnreadMapCommunityFeedItem={residentFeedRuntimeSupport.isUnreadMapCommunityFeedItem}
            isMissingFunctionError={isMissingFunctionError}
            isMissingRelationError={isMissingRelationError}
            isExpectedPermissionError={isExpectedPermissionError}
            normalizeResidentNotificationKind={residentFeedRuntimeSupport.normalizeResidentNotificationKind}
          />
        ) : null}

        {alertsWindowOpen && residentFeedRuntimeReady ? (
          <LazyAlertsWindow
            open={alertsWindowOpen}
            onClose={() => setAlertsWindowOpen(false)}
            alerts={mapCommunityAlerts}
            loading={mapCommunityFeedLoading}
            error={mapCommunityFeedError}
            darkMode={prefersDarkMode}
            pageMode={useAppShellLayout}
            pageTopInset={mobileTabPageTopInset}
            pageBottomInset={mobileReportsPageBottomInset}
            newItemKeys={alertsSessionNewKeys}
            focusItemId={focusedResidentAlertId}
            onCreate={() => openCommunityFeedEditor("alert")}
            onEdit={(alert) => openCommunityFeedEditor("alert", alert)}
            onItemVisible={handleResidentAlertVisible}
            mapCommunityFeedItemReadKey={residentFeedRuntimeSupport.mapCommunityFeedItemReadKey}
            supabase={supabase}
            resolvedCommunityFeedTenantKey={resolvedCommunityFeedTenantKey}
            sessionUserId={sessionUserId}
          />
        ) : null}

        {eventsWindowOpen && residentFeedRuntimeReady ? (
          <LazyEventsWindow
            open={eventsWindowOpen}
            onClose={() => setEventsWindowOpen(false)}
            events={mapCommunityEvents}
            loading={mapCommunityFeedLoading}
            error={mapCommunityFeedError}
            darkMode={prefersDarkMode}
            pageMode={useAppShellLayout}
            pageTopInset={mobileTabPageTopInset}
            pageBottomInset={mobileReportsPageBottomInset}
            newItemKeys={eventsSessionNewKeys}
            focusItemId={focusedResidentEventId}
            onCreate={() => openCommunityFeedEditor("event")}
            onEdit={(eventRow) => openCommunityFeedEditor("event", eventRow)}
            onItemVisible={handleResidentEventVisible}
            mapCommunityFeedItemReadKey={residentFeedRuntimeSupport.mapCommunityFeedItemReadKey}
            sortResidentEvents={residentFeedRuntimeSupport.sortResidentEvents}
            filterActiveResidentEvents={residentFeedRuntimeSupport.filterActiveResidentEvents}
            supabase={supabase}
            resolvedCommunityFeedTenantKey={resolvedCommunityFeedTenantKey}
            sessionUserId={sessionUserId}
          />
        ) : null}
      </Suspense>

      {communityFeedEditor.open ? (
        <Suspense fallback={null}>
          <LazyCommunityFeedEditorModal
            open={communityFeedEditor.open}
            kind={communityFeedEditor.kind}
            mode={communityFeedEditor.mode}
            item={communityFeedEditor.item}
            allTopics={mapCommunityTopics}
            darkMode={prefersDarkMode}
            pageMode={useAppShellLayout}
            pageTopInset={mobileTabPageTopInset}
            pageBottomInset={mobileReportsPageBottomInset}
            onClose={closeCommunityFeedEditor}
            supabase={supabase}
            resolvedCommunityFeedTenantKey={resolvedCommunityFeedTenantKey}
            sessionUserId={sessionUserId}
            loadMapCommunityFeed={loadMapCommunityFeed}
            openNotice={openNotice}
          />
        </Suspense>
      ) : null}

      <OpenReportsModal {...myReportsWorkspace} />
      <OpenReportsModal {...openReportsWorkspace} />
    </Fragment>
  );
}
