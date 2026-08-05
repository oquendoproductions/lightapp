import { useEffect, useRef } from "react";

const loadDeferredConfiguredIncidentDataSupportModule = () => import("./lib/mapDeferredConfiguredIncidentDataSupport.js");
const loadDeferredPublicMapFollowupSupportModule = () => import("./lib/mapDeferredPublicMapFollowupSupport.js");
const loadDeferredIncidentSupportModule = () => import("./lib/mapDeferredIncidentSupport.js");
const loadIncidentDeferredSupportModule = () => import("./lib/mapIncidentDeferredSupport.js");
const HIGH_RISK_INCIDENT_REALTIME_DISABLED = true;

function sameConfiguredIncidentRealtimeEntries(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const topologyFor = (entries) => entries.map((entry) => [
    String(entry?.domainKey || "").trim(),
    typeof entry?.setSeededRows === "function",
    typeof entry?.setReportRows === "function",
  ]).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const leftTopology = topologyFor(left);
  const rightTopology = topologyFor(right);
  return leftTopology.every((entry, index) => (
    entry[0] === rightTopology[index][0]
    && entry[1] === rightTopology[index][1]
    && entry[2] === rightTopology[index][2]
  ));
}

function sameStringList(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const normalizedLeft = left.map((value) => String(value || "").trim()).sort();
  const normalizedRight = right.map((value) => String(value || "").trim()).sort();
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

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
  const notifyDbConnectionIssueRef = useRef(notifyDbConnectionIssue);
  const resetDbConnectionIssueStreakRef = useRef(resetDbConnectionIssueStreak);
  const officialIdSetRef = useRef(officialIdSet);
  const realtimeGenerationRef = useRef(0);
  notifyDbConnectionIssueRef.current = notifyDbConnectionIssue;
  resetDbConnectionIssueStreakRef.current = resetDbConnectionIssueStreak;
  officialIdSetRef.current = officialIdSet;

  const nextConfiguredIncidentRealtimeTargetEntries = configuredIncidentDemandDomainKeys
    .map((domainKey) => configuredIncidentRuntimeEntryByDomain.get(domainKey))
    .filter(Boolean);
  const configuredIncidentRealtimeTopologyRef = useRef({
    tenantKey: String(activeTenantKeyValue || "").trim().toLowerCase(),
    targetEntries: [],
    persistedStateDomainKeys: [],
  });
  const normalizedRealtimeTopologyTenantKey = String(activeTenantKeyValue || "").trim().toLowerCase();
  if (configuredIncidentRealtimeTopologyRef.current.tenantKey !== normalizedRealtimeTopologyTenantKey) {
    configuredIncidentRealtimeTopologyRef.current = {
      tenantKey: normalizedRealtimeTopologyTenantKey,
      targetEntries: [],
      persistedStateDomainKeys: [],
    };
  }
  const retainedTargetEntriesByDomain = new Map(
    configuredIncidentRealtimeTopologyRef.current.targetEntries.map((entry) => [entry.domainKey, entry])
  );
  for (const entry of nextConfiguredIncidentRealtimeTargetEntries) {
    const domainKey = String(entry?.domainKey || "").trim();
    if (!domainKey) continue;
    const retained = retainedTargetEntriesByDomain.get(domainKey);
    if (!retained) {
      retainedTargetEntriesByDomain.set(domainKey, entry);
      continue;
    }
    if (
      (typeof retained.setSeededRows !== "function" && typeof entry.setSeededRows === "function")
      || (typeof retained.setReportRows !== "function" && typeof entry.setReportRows === "function")
    ) {
      retainedTargetEntriesByDomain.set(domainKey, {
        ...retained,
        setSeededRows: typeof retained.setSeededRows === "function" ? retained.setSeededRows : entry.setSeededRows,
        setReportRows: typeof retained.setReportRows === "function" ? retained.setReportRows : entry.setReportRows,
      });
    }
  }
  const nextRetainedTargetEntries = Array.from(retainedTargetEntriesByDomain.values())
    .sort((left, right) => String(left?.domainKey || "").localeCompare(String(right?.domainKey || "")));
  if (!sameConfiguredIncidentRealtimeEntries(
    configuredIncidentRealtimeTopologyRef.current.targetEntries,
    nextRetainedTargetEntries
  )) {
    configuredIncidentRealtimeTopologyRef.current.targetEntries = nextRetainedTargetEntries;
  }
  const configuredIncidentRealtimeTargetEntries = configuredIncidentRealtimeTopologyRef.current.targetEntries;

  const targetDomainKeySet = new Set(configuredIncidentDemandDomainKeys);
  const nextConfiguredIncidentRealtimePersistedStateDomainKeys = configuredIncidentPersistedStateSupportedDomainKeys
    .filter((domainKey) => targetDomainKeySet.has(domainKey));
  const retainedPersistedStateDomainKeys = Array.from(new Set([
    ...configuredIncidentRealtimeTopologyRef.current.persistedStateDomainKeys,
    ...nextConfiguredIncidentRealtimePersistedStateDomainKeys,
  ])).sort();
  if (!sameStringList(
    configuredIncidentRealtimeTopologyRef.current.persistedStateDomainKeys,
    retainedPersistedStateDomainKeys
  )) {
    configuredIncidentRealtimeTopologyRef.current.persistedStateDomainKeys = retainedPersistedStateDomainKeys;
  }
  const configuredIncidentRealtimePersistedStateDomainKeys =
    configuredIncidentRealtimeTopologyRef.current.persistedStateDomainKeys;

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
  const rawShouldLiveSubscribeConfiguredIncidentRealtime = Boolean(
    !HIGH_RISK_INCIDENT_REALTIME_DISABLED
    &&
    shouldSubscribeConfiguredIncidentRealtime
    && (
      shouldPrioritizeConfiguredIncidentRealtime
      || deferredRealtimeReady
    )
  );
  const rawShouldLiveSubscribeIncidentStateRealtime = Boolean(
    !HIGH_RISK_INCIDENT_REALTIME_DISABLED
    && (
      deferredRealtimeReady
      || shouldPrioritizeStreetlightRuntimeStartup
      || shouldPrioritizeConfiguredIncidentRealtime
    )
  );
  const rawShouldSubscribeAdminReportRealtime = Boolean(
    reportsAdminView
    && (
      myReportsOpen
      || openReportsOpen
    )
  );
  const rawShouldLiveSubscribeStreetlightRuntimeState = Boolean(
    shouldComputeStreetlightRuntimeState
    && (
      shouldPrioritizeStreetlightRuntimeStartup
      || deferredRealtimeReady
    )
  );
  const viewerUserId = String(sessionUserId || "").trim();
  const realtimeChannelScopeKey = `${normalizedRealtimeTopologyTenantKey}:${viewerUserId}`;
  const realtimeChannelGroupTopologyRef = useRef({
    scopeKey: realtimeChannelScopeKey,
    configuredIncident: false,
    incidentState: false,
    adminReport: false,
    streetlightRuntime: false,
  });
  if (realtimeChannelGroupTopologyRef.current.scopeKey !== realtimeChannelScopeKey) {
    realtimeChannelGroupTopologyRef.current = {
      scopeKey: realtimeChannelScopeKey,
      configuredIncident: false,
      incidentState: false,
      adminReport: false,
      streetlightRuntime: false,
    };
  }
  if (rawShouldLiveSubscribeConfiguredIncidentRealtime) {
    realtimeChannelGroupTopologyRef.current.configuredIncident = true;
  }
  if (rawShouldLiveSubscribeIncidentStateRealtime) {
    realtimeChannelGroupTopologyRef.current.incidentState = true;
  }
  if (rawShouldSubscribeAdminReportRealtime) {
    realtimeChannelGroupTopologyRef.current.adminReport = true;
  }
  if (rawShouldLiveSubscribeStreetlightRuntimeState) {
    realtimeChannelGroupTopologyRef.current.streetlightRuntime = true;
  }
  const shouldLiveSubscribeConfiguredIncidentRealtime =
    realtimeChannelGroupTopologyRef.current.configuredIncident;
  const shouldLiveSubscribeIncidentStateRealtime = realtimeChannelGroupTopologyRef.current.incidentState;
  const shouldSubscribeAdminReportRealtime = realtimeChannelGroupTopologyRef.current.adminReport;
  const shouldLiveSubscribeStreetlightRuntimeState = realtimeChannelGroupTopologyRef.current.streetlightRuntime;

  useEffect(() => {
    const realtimeGeneration = realtimeGenerationRef.current + 1;
    realtimeGenerationRef.current = realtimeGeneration;
    const isCurrentRealtimeGeneration = () => realtimeGenerationRef.current === realtimeGeneration;
    let utilityRefreshTimer = null;
    let utilityRefreshInFlight = false;

    const refreshUtilityStatusSets = async () => {
      if (utilityRefreshInFlight) return;
      utilityRefreshInFlight = true;
      try {
        const { refreshUtilityStatusRealtimeShared } = await loadDeferredPublicMapFollowupSupportModule();
        await refreshUtilityStatusRealtimeShared({
          shouldLiveSubscribeStreetlightRuntimeState,
          supabase,
          tenantKey: normalizedRealtimeTopologyTenantKey,
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
            officialIdSet: officialIdSetRef.current,
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
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          notifyDbConnectionIssueRef.current?.(status);
        }
        if (status === "SUBSCRIBED") resetDbConnectionIssueStreakRef.current?.();
      }) : null;

    let configuredIncidentRealtimeChannels = [];
    let configuredPersistedRecordStateRealtimeChannels = [];
    let configuredIncidentRealtimeDisposed = false;
    if (shouldLiveSubscribeConfiguredIncidentRealtime) {
      void Promise.all([
        loadDeferredConfiguredIncidentDataSupportModule(),
        loadDeferredConfiguredIncidentStateRuntimeHelpers(),
      ]).then(([module, configuredIncidentStateRuntimeHelpers]) => {
        if (configuredIncidentRealtimeDisposed || !isCurrentRealtimeGeneration()) return;
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
      if (isCurrentRealtimeGeneration()) {
        realtimeGenerationRef.current = realtimeGeneration + 1;
      }
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
    // These handlers are module-level helpers, React setters, or values carried
    // through refs. Only the retained channel topology may restart subscriptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    normalizedRealtimeTopologyTenantKey,
    viewerUserId,
    configuredIncidentRealtimePersistedStateDomainKeys,
    configuredIncidentRealtimeTargetEntries,
    isAdmin,
    shouldLiveSubscribeConfiguredIncidentRealtime,
    shouldLiveSubscribeIncidentStateRealtime,
    shouldLiveSubscribeStreetlightRuntimeState,
    shouldSubscribeAdminReportRealtime,
    supabase,
  ]);

  return null;
}
