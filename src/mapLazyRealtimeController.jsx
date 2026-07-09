import { useEffect, useMemo } from "react";

const loadDeferredConfiguredIncidentDataSupportModule = () => import("./lib/mapDeferredConfiguredIncidentDataSupport.js");
const loadDeferredPublicMapFollowupSupportModule = () => import("./lib/mapDeferredPublicMapFollowupSupport.js");
const loadDeferredIncidentSupportModule = () => import("./lib/mapDeferredIncidentSupport.js");
const loadIncidentDeferredSupportModule = () => import("./lib/mapIncidentDeferredSupport.js");

export default function MapLazyRealtimeController({
  reportsAdminView,
  isAdmin,
  sessionUserId,
  activeTenantKeyValue,
  configuredIncidentDemandDomainKeys,
  configuredIncidentRuntimeEntryByDomain,
  configuredIncidentPersistedStateSupportedDomainKeys,
  myReportsOpen,
  openReportsOpen,
  domainReportTarget,
  domainDisclosureGateTarget,
  confirmReportTarget,
  selectedDomainMarker,
  selectedIncidentStackMarker,
  shouldForceAdminConfiguredIncidentDomain,
  deferredRealtimeReady,
  shouldPrioritizeStreetlightRuntimeStartup,
  shouldComputeStreetlightRuntimeState,
  activeMapLayerKey,
  supabase,
  loadDeferredConfiguredIncidentStateRuntimeHelpers,
  normalizeDomainKeyOrSlug,
  normalizeReportQuality,
  lightIdFor,
  reportDomainForRow,
  isAssetBackedDomainType,
  resolveRuntimeDomainTypeForMap,
  buildGenericIncidentBaseMarkersForDomain,
  mergeGenericIncidentBaseMarkers,
  officialIdSet,
  isOutageReportType,
  incidentSnapshotKey,
  normalizeOfficialLightRow,
  notifyDbConnectionIssue,
  resetDbConnectionIssueStreak,
  domainForIncidentId,
  setReports,
  setSharedIncidentReportRowsStateByDomain,
  setSharedIncidentBaseMarkersStateByDomain,
  setStreetlightOutageTsByLightId,
  setIncidentStateByKey,
  setOfficialLights,
  setFixedLights,
  setActionsByLightId,
  setLastFixByLightId,
  setPersistedIncidentRecordStateByDomain,
  setUtilityReportedLightIdSet,
  setUtilityReportReferenceByLightId,
  setUtilityReportedAtByLightId,
  setUtilitySignalCountsByLightId,
  getIncidentDomainHelper,
  incidentDomainCanonicalIncidentId,
}) {
  const configuredIncidentRealtimeTargetEntries = useMemo(() => {
    return configuredIncidentDemandDomainKeys
      .map((domainKey) => configuredIncidentRuntimeEntryByDomain.get(domainKey))
      .filter(Boolean);
  }, [
    configuredIncidentDemandDomainKeys,
    configuredIncidentRuntimeEntryByDomain,
  ]);

  const configuredIncidentRealtimePersistedStateDomainKeys = useMemo(() => {
    const targetDomainKeySet = new Set(configuredIncidentDemandDomainKeys);
    return configuredIncidentPersistedStateSupportedDomainKeys.filter((domainKey) => targetDomainKeySet.has(domainKey));
  }, [
    configuredIncidentDemandDomainKeys,
    configuredIncidentPersistedStateSupportedDomainKeys,
  ]);

  const shouldSubscribeConfiguredIncidentRealtime = Boolean(
    configuredIncidentRealtimeTargetEntries.length
    || configuredIncidentRealtimePersistedStateDomainKeys.length
  );
  const shouldPrioritizeConfiguredIncidentRealtime = Boolean(
    myReportsOpen
    || openReportsOpen
    || domainReportTarget
    || domainDisclosureGateTarget
    || confirmReportTarget
    || selectedDomainMarker
    || selectedIncidentStackMarker
    || shouldForceAdminConfiguredIncidentDomain
  );
  const shouldLiveSubscribeConfiguredIncidentRealtime = Boolean(
    shouldSubscribeConfiguredIncidentRealtime
    && (
      shouldPrioritizeConfiguredIncidentRealtime
      || deferredRealtimeReady
    )
  );
  const shouldLiveSubscribeIncidentStateRealtime = Boolean(
    deferredRealtimeReady
    || shouldPrioritizeStreetlightRuntimeStartup
    || shouldPrioritizeConfiguredIncidentRealtime
  );
  const shouldSubscribeAdminReportRealtime = Boolean(
    reportsAdminView
    && (
      myReportsOpen
      || openReportsOpen
    )
  );

  useEffect(() => {
    const viewerUserId = String(sessionUserId || "").trim();
    let utilityRefreshTimer = null;
    let utilityRefreshInFlight = false;
    const shouldLiveSubscribeStreetlightRuntimeState = Boolean(
      shouldComputeStreetlightRuntimeState
      && (
        shouldPrioritizeStreetlightRuntimeStartup
        || deferredRealtimeReady
      )
    );

    const refreshUtilityStatusSets = async () => {
      if (utilityRefreshInFlight) return;
      utilityRefreshInFlight = true;
      try {
        const { refreshUtilityStatusRealtimeShared } = await loadDeferredPublicMapFollowupSupportModule();
        await refreshUtilityStatusRealtimeShared({
          shouldLiveSubscribeStreetlightRuntimeState,
          supabase,
          tenantKey: activeTenantKeyValue,
          viewerUserId,
        }, {
          loadIncidentDeferredSupportModule,
          setUtilityReportedLightIdSet,
          setUtilityReportReferenceByLightId,
          setUtilityReportedAtByLightId,
          setUtilitySignalCountsByLightId,
        });
      } finally {
        utilityRefreshInFlight = false;
      }
    };

    const scheduleUtilityStatusRefresh = () => {
      if (!shouldLiveSubscribeStreetlightRuntimeState) return;
      if (utilityRefreshTimer) clearTimeout(utilityRefreshTimer);
      utilityRefreshTimer = setTimeout(() => {
        utilityRefreshTimer = null;
        refreshUtilityStatusSets();
      }, 180);
    };

    if (shouldLiveSubscribeStreetlightRuntimeState) {
      scheduleUtilityStatusRefresh();
    }

    const reportsChannel = shouldSubscribeAdminReportRealtime ? supabase
      .channel("realtime-reports")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        void loadDeferredIncidentSupportModule().then(({ handleStreetlightReportRealtimeInsertShared }) => {
          handleStreetlightReportRealtimeInsertShared(payload.new, {
            normalizeDomainKeyOrSlug,
            normalizeReportQuality,
            lightIdFor,
            setReports,
            reportDomainForRow,
            isAssetBackedDomainType,
            resolveRuntimeDomainTypeForMap,
            setSharedIncidentReportRowsStateByDomain,
            setSharedIncidentBaseMarkersStateByDomain,
            buildGenericIncidentBaseMarkersForDomain,
            mergeGenericIncidentBaseMarkers,
            officialIdSet,
            isOutageReportType,
            setStreetlightOutageTsByLightId,
            setIncidentStateByKey,
            incidentSnapshotKey,
          });
        }).catch(() => {});
      })
      .subscribe() : null;

    const fixedChannel = shouldLiveSubscribeStreetlightRuntimeState ? supabase
      .channel("realtime-fixed")
      .on("postgres_changes", { event: "*", schema: "public", table: "fixed_lights" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const lightId = payload?.old?.light_id;
          if (!lightId) {
            console.warn("[fixed_lights DELETE] missing payload.old.light_id", payload);
            return;
          }

          setFixedLights((prev) => {
            const next = { ...prev };
            delete next[lightId];
            return next;
          });
          return;
        }

        const row = payload.new;
        setFixedLights((prev) => ({
          ...prev,
          [row.light_id]: new Date(row.fixed_at).getTime(),
        }));
      })
      .subscribe() : null;

    const actionsChannel = shouldSubscribeAdminReportRealtime ? supabase
      .channel("realtime-actions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "light_actions" }, (payload) => {
        void (async () => {
          const {
            parseWorkingContactFromNote,
            handleStreetlightActionRealtimeInsertShared,
          } = await loadDeferredIncidentSupportModule();
          handleStreetlightActionRealtimeInsertShared(payload.new, {
            parseWorkingContactFromNote,
            setActionsByLightId,
            setLastFixByLightId,
            domainForIncidentId,
            setIncidentStateByKey,
            incidentSnapshotKey,
          });
        })();
      })
      .subscribe() : null;

    const officialChannel = shouldLiveSubscribeStreetlightRuntimeState ? supabase
      .channel("realtime-official-lights")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "official_lights" },
        (payload) => {
          const row = payload.new;
          if (!row) return;

          const clean = normalizeOfficialLightRow(row);
          if (!clean) {
            console.warn("[official_lights realtime] invalid row, ignoring:", row);
            return;
          }

          setOfficialLights((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            const idx = next.findIndex((x) => x.id === clean.id);

            if (idx >= 0) next[idx] = { ...next[idx], ...clean };
            else next.push(clean);

            const dedup = new Map();
            for (const item of next) dedup.set(item.id, item);
            return Array.from(dedup.values());
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "official_lights" },
        (payload) => {
          const id = payload?.old?.id;
          if (!id) {
            console.warn("[official_lights DELETE] missing payload.old.id", payload);
            return;
          }
          setOfficialLights((prev) => prev.filter((x) => x.id !== id));
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") notifyDbConnectionIssue(status);
        if (status === "SUBSCRIBED") resetDbConnectionIssueStreak();
      }) : null;

    let configuredIncidentRealtimeChannels = [];
    let configuredPersistedRecordStateRealtimeChannels = [];
    let configuredIncidentRealtimeDisposed = false;
    if (shouldLiveSubscribeConfiguredIncidentRealtime) {
      void Promise.all([
        loadDeferredConfiguredIncidentDataSupportModule(),
        loadDeferredConfiguredIncidentStateRuntimeHelpers(),
      ]).then(([module, configuredIncidentStateRuntimeHelpers]) => {
        if (configuredIncidentRealtimeDisposed) return;
        const {
          subscribeConfiguredIncidentDomainRealtimeShared,
          subscribeConfiguredIncidentPersistedRecordStateRealtimeShared,
        } = module;
        const configuredIncidentRealtimeSupportDeps = {
          normalizeDomainKeyOrSlug,
          incidentDomainConfiguredSourceTable: configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredSourceTable,
          incidentDomainConfiguredRealtimeChannel: configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredRealtimeChannel,
          incidentDomainRemoveConfiguredRecordById: configuredIncidentStateRuntimeHelpers?.incidentDomainRemoveConfiguredRecordById,
          incidentDomainUpsertConfiguredSeededState: configuredIncidentStateRuntimeHelpers?.incidentDomainUpsertConfiguredSeededState,
          incidentDomainNormalizeConfiguredReportRecord:
            configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizeConfiguredReportRecord,
          incidentDomainPrependConfiguredReportState: configuredIncidentStateRuntimeHelpers?.incidentDomainPrependConfiguredReportState,
          incidentDomainConfiguredLookupField: configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredLookupField,
          incidentDomainCanonicalIncidentId,
          incidentSnapshotKey,
          incidentDomainConfiguredPersistedRecordStateTable:
            configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredPersistedRecordStateTable,
          incidentDomainConfiguredPersistedRecordStateRealtimeChannel:
            configuredIncidentStateRuntimeHelpers?.incidentDomainConfiguredPersistedRecordStateRealtimeChannel,
          getIncidentDomainHelper,
          incidentDomainNormalizePersistedRecordStateRow:
            configuredIncidentStateRuntimeHelpers?.incidentDomainNormalizePersistedRecordStateRow,
        };
        configuredIncidentRealtimeChannels = configuredIncidentRealtimeTargetEntries.map((entry) => ({
          domainKey: entry.domainKey,
          ...subscribeConfiguredIncidentDomainRealtimeShared(entry.domainKey, {
            realtimeClient: supabase,
            setSeededRows: entry.setSeededRows,
            setReportRows: entry.setReportRows,
            setIncidentStateByKey,
          }, configuredIncidentRealtimeSupportDeps),
        }));
        configuredPersistedRecordStateRealtimeChannels = configuredIncidentRealtimePersistedStateDomainKeys.map((domainKey) => ({
          domainKey,
          ...subscribeConfiguredIncidentPersistedRecordStateRealtimeShared(domainKey, {
            realtimeClient: supabase,
            setPersistedIncidentRecordStateByDomain,
          }, configuredIncidentRealtimeSupportDeps),
        }));
      });
    }

    const utilityStatusChannel = (shouldLiveSubscribeStreetlightRuntimeState && (isAdmin || viewerUserId)) ? supabase
      .channel("realtime-utility-report-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "utility_report_status" }, () => {
        scheduleUtilityStatusRefresh();
      })
      .subscribe() : null;

    const incidentStateChannel = shouldLiveSubscribeIncidentStateRealtime ? supabase
      .channel("realtime-incident-state-current")
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_state_current" }, (payload) => {
        const row = payload?.new;
        const oldRow = payload?.old;
        const eventType = String(payload?.eventType || "").toUpperCase();
        const incidentId = String((eventType === "DELETE" ? oldRow?.incident_id : row?.incident_id) || "").trim();
        const stateLower = String(row?.state || "").trim().toLowerCase();
        const changedAtIso = String(row?.last_changed_at || "").trim();
        const changedAtTs = Date.parse(changedAtIso) || 0;

        setIncidentStateByKey((prev) => {
          const next = { ...(prev || {}) };
          const newKey = incidentSnapshotKey(row?.domain, row?.incident_id);
          const oldKey = incidentSnapshotKey(oldRow?.domain, oldRow?.incident_id);
          if (eventType === "DELETE") {
            if (oldKey) delete next[oldKey];
            return next;
          }
          if (oldKey && oldKey !== newKey) delete next[oldKey];
          if (newKey) {
            next[newKey] = {
              state: String(row?.state || "").trim(),
              last_changed_at: row?.last_changed_at || null,
            };
          }
          return next;
        });

        if (incidentId) {
          setLastFixByLightId((prev) => {
            const next = { ...(prev || {}) };
            const prevTs = Number(next[incidentId] || 0);
            if (eventType === "DELETE") return next;
            if (stateLower === "fixed") {
              if (!changedAtTs || changedAtTs >= prevTs) {
                next[incidentId] = changedAtTs || Date.now();
              }
              return next;
            }
            if (
              stateLower === "reported"
              || stateLower === "reopened"
              || stateLower === "confirmed"
            ) {
              if (Object.prototype.hasOwnProperty.call(next, incidentId)) {
                delete next[incidentId];
              }
              return next;
            }
            return next;
          });
        }
      })
      .subscribe() : null;

    return () => {
      configuredIncidentRealtimeDisposed = true;
      if (utilityRefreshTimer) clearTimeout(utilityRefreshTimer);
      if (reportsChannel) supabase.removeChannel(reportsChannel);
      if (fixedChannel) supabase.removeChannel(fixedChannel);
      if (actionsChannel) supabase.removeChannel(actionsChannel);
      if (officialChannel) supabase.removeChannel(officialChannel);
      for (const entry of configuredIncidentRealtimeChannels) {
        if (entry?.seededChannel) supabase.removeChannel(entry.seededChannel);
        if (entry?.reportsChannel) supabase.removeChannel(entry.reportsChannel);
      }
      for (const entry of configuredPersistedRecordStateRealtimeChannels) {
        if (entry?.stateChannel) supabase.removeChannel(entry.stateChannel);
      }
      if (utilityStatusChannel) supabase.removeChannel(utilityStatusChannel);
      if (incidentStateChannel) supabase.removeChannel(incidentStateChannel);
    };
  }, [
    activeMapLayerKey,
    activeTenantKeyValue,
    buildGenericIncidentBaseMarkersForDomain,
    configuredIncidentRealtimePersistedStateDomainKeys,
    configuredIncidentRealtimeTargetEntries,
    deferredRealtimeReady,
    domainForIncidentId,
    getIncidentDomainHelper,
    incidentDomainCanonicalIncidentId,
    incidentSnapshotKey,
    isAdmin,
    isAssetBackedDomainType,
    isOutageReportType,
    lightIdFor,
    loadDeferredConfiguredIncidentStateRuntimeHelpers,
    myReportsOpen,
    normalizeDomainKeyOrSlug,
    normalizeOfficialLightRow,
    normalizeReportQuality,
    officialIdSet,
    openReportsOpen,
    reportDomainForRow,
    reportsAdminView,
    resetDbConnectionIssueStreak,
    resolveRuntimeDomainTypeForMap,
    sessionUserId,
    setActionsByLightId,
    setFixedLights,
    setIncidentStateByKey,
    setOfficialLights,
    setLastFixByLightId,
    setPersistedIncidentRecordStateByDomain,
    setReports,
    setSharedIncidentBaseMarkersStateByDomain,
    setSharedIncidentReportRowsStateByDomain,
    setStreetlightOutageTsByLightId,
    setUtilityReportedAtByLightId,
    setUtilityReportedLightIdSet,
    setUtilityReportReferenceByLightId,
    setUtilitySignalCountsByLightId,
    shouldComputeStreetlightRuntimeState,
    shouldLiveSubscribeConfiguredIncidentRealtime,
    shouldLiveSubscribeIncidentStateRealtime,
    shouldPrioritizeStreetlightRuntimeStartup,
    shouldSubscribeAdminReportRealtime,
    supabase,
    mergeGenericIncidentBaseMarkers,
    notifyDbConnectionIssue,
  ]);

  return null;
}
