import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPlatformName, isNativeAppRuntime } from "./platform/runtime.js";
import { residentNotificationIncidentDisplayId } from "./lib/mapResidentNotificationSupport.js";
import {
  writeNativeResidentNotificationFeedHandoff,
  writeNativeResidentNotificationReportHandoff,
  writeResidentNotificationFeedHandoff,
  writeResidentNotificationReportHandoff,
} from "./lib/residentNotificationReportHandoff.js";

const loadDeferredResidentFeedActionSupportModule = () => import("./lib/mapDeferredResidentFeedActionSupport.js");
const loadDeferredNativeBadgeRuntimeModule = () => import("./lib/mapDeferredNativeBadgeRuntime.js");
const loadDeferredAccountRuntimeModule = () => import("./lib/mapDeferredAccountRuntime.js");
const loadResidentFeedRuntimeSupportModule = () => import("./lib/mapResidentFeedRuntimeSupport.js");
const loadCapacitorBadgeModule = () => import("@capawesome/capacitor-badge");

export default function MapLazyResidentFeedBadgeController({
  authReady,
  tenantReady,
  loading,
  startupWarmupReady,
  showMapNotificationsIcon,
  showMapAlertIcon,
  showMapEventIcon,
  resolvedCommunityFeedTenantKey,
  currentTenantKey,
  supabase,
  communityFeedViewerUserId,
  communityFeedViewerKey,
  sessionAccessToken,
  mapCommunityFeedReadKey,
  mapCommunityFeedRemoteTable,
  tenantScopedReadClient,
  createTenantScopedAuthedClient,
  createTenantScopedReadClient,
  mapCommunityFeedRequestSeqRef,
  residentFeedRuntimeSupport,
  setResidentFeedRuntimeSupport,
  mapCommunityAlerts,
  setMapCommunityAlerts,
  mapCommunityEvents,
  setMapCommunityEvents,
  notificationTopics,
  mapCommunityFeedReadState,
  setMapCommunityFeedReadState,
  residentNotificationLocations,
  residentNotificationsRefreshToken,
  communityFeedEditorOpen,
  notificationsWindowOpen,
  notificationPreferencesOpen,
  alertsWindowOpen,
  eventsWindowOpen,
  mapCommunityFeedLoading,
  pendingResidentNotificationTarget,
  savedNotificationPreferencesByTopic,
  setResidentNotificationLocations,
  setResidentNotificationsRefreshToken,
  setFocusedResidentAlertId,
  setFocusedResidentEventId,
  setPendingResidentNotificationTarget,
  setAlertsWindowOpen,
  setEventsWindowOpen,
  setNotificationsWindowOpen,
  setAccountMenuOpen,
  setMobileHeaderMenuOpen,
  setAdminDomainMenuOpen,
  setAdminToolboxOpen,
  openMyReports,
  setMyReportsOpen,
  setOpenReportsOpen,
  setAlertsSessionNewKeys,
  setEventsSessionNewKeys,
  setMapCommunityTopics,
  setMapCommunityFeedLoading,
  setMapCommunityFeedError,
  alertsFeedMarkedForOpenRef,
  eventsFeedMarkedForOpenRef,
  nativePushEnabled,
  nativePushShouldRegister,
  nativePushRegisteringRef,
  nativePushRegisteredKey,
  openNotice,
  openNotificationsInbox,
  tenantSwitch,
  isMissingFunctionError,
  isMissingRelationError,
  isExpectedPermissionError,
  scheduleDeferredWarmup,
  onBadgeCountsChange,
  onResidentFeedApiChange,
}) {
  const residentFeedRuntimeReady = Boolean(residentFeedRuntimeSupport);
  const [residentNotificationSummaryWarmReady, setResidentNotificationSummaryWarmReady] = useState(false);
  const [communityFeedTimeKey, setCommunityFeedTimeKey] = useState(() => Date.now());
  const nativePushCallbacksRef = useRef({});

  const shouldPrepareCommunityFeedReadState =
    alertsWindowOpen ||
    eventsWindowOpen ||
    // Badges are calculated from this state. Hydrate it as soon as either
    // feed entry point is available, rather than waiting until its panel is
    // opened; otherwise a cold app launch treats already-read items as new.
    (Boolean(communityFeedViewerUserId) && (
      notificationsWindowOpen
      || notificationPreferencesOpen
      || showMapAlertIcon
      || showMapEventIcon
    ));

  const shouldLoadResidentFeedRuntimeSupport = Boolean(
    shouldPrepareCommunityFeedReadState ||
    communityFeedEditorOpen ||
    (
      authReady &&
      tenantReady !== false &&
      resolvedCommunityFeedTenantKey &&
      communityFeedViewerUserId &&
      startupWarmupReady
    )
  );

  useEffect(() => {
    if (!shouldLoadResidentFeedRuntimeSupport) return undefined;
    if (residentFeedRuntimeReady) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { createResidentFeedRuntimeSupport } = await loadResidentFeedRuntimeSupportModule();
        if (cancelled) return;
        setResidentFeedRuntimeSupport(createResidentFeedRuntimeSupport({
          supabase,
          mapCommunityFeedReadKey,
          mapCommunityFeedRemoteTable,
          isMissingRelationError,
          isExpectedPermissionError,
        }));
      } catch (error) {
        if (!cancelled) {
          console.warn("[resident feed runtime]", error?.message || error);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isExpectedPermissionError,
    isMissingRelationError,
    residentFeedRuntimeReady,
    mapCommunityFeedReadKey,
    mapCommunityFeedRemoteTable,
    setResidentFeedRuntimeSupport,
    shouldLoadResidentFeedRuntimeSupport,
    supabase,
  ]);

  const refreshResidentNotifications = useCallback(() => {
    setResidentNotificationsRefreshToken((value) => value + 1);
  }, [setResidentNotificationsRefreshToken]);

  useEffect(() => {
    if (!shouldPrepareCommunityFeedReadState || !residentFeedRuntimeReady) return undefined;
    const tenantKey = resolvedCommunityFeedTenantKey;
    const localState = residentFeedRuntimeSupport.loadMapCommunityFeedReadState(tenantKey, communityFeedViewerKey);
    setMapCommunityFeedReadState(localState);
    if (!tenantKey || !communityFeedViewerUserId) return undefined;
    let cancelled = false;
    void (async () => {
      const remoteState = await residentFeedRuntimeSupport.loadMapCommunityFeedReadStateRemote(tenantKey, communityFeedViewerUserId);
      if (cancelled || !remoteState) return;
      const mergedState = residentFeedRuntimeSupport.mergeMapCommunityFeedReadState(localState, remoteState);
      if (cancelled) return;
      setMapCommunityFeedReadState(mergedState);
      residentFeedRuntimeSupport.saveMapCommunityFeedReadState(tenantKey, communityFeedViewerKey, mergedState);
      await residentFeedRuntimeSupport.saveMapCommunityFeedReadStateRemote(tenantKey, communityFeedViewerUserId, mergedState);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    communityFeedViewerKey,
    communityFeedViewerUserId,
    residentFeedRuntimeReady,
    residentFeedRuntimeSupport,
    resolvedCommunityFeedTenantKey,
    setMapCommunityFeedReadState,
    shouldPrepareCommunityFeedReadState,
  ]);

  const markMapCommunityFeedItemsViewed = useCallback((kind, items, options = {}) => {
    if (!residentFeedRuntimeReady) return false;
    const safeKind = kind === "events" ? "events" : "alerts";
    const sourceItems = Array.isArray(items) ? items.filter(Boolean) : [];
    const tenantKey = String(options?.tenantKey || resolvedCommunityFeedTenantKey || "").trim().toLowerCase();
    const shouldPersistRemote = options?.persistRemote !== false;
    if (!tenantKey || !sourceItems.length) return false;

    const persistState = (nextState) => {
      residentFeedRuntimeSupport.saveMapCommunityFeedReadState(tenantKey, communityFeedViewerKey, nextState);
      if (shouldPersistRemote && communityFeedViewerUserId) {
        void residentFeedRuntimeSupport.saveMapCommunityFeedReadStateRemote(tenantKey, communityFeedViewerUserId, nextState);
      }
      return nextState;
    };

    if (tenantKey !== resolvedCommunityFeedTenantKey) {
      const baseState = residentFeedRuntimeSupport.loadMapCommunityFeedReadState(tenantKey, communityFeedViewerKey);
      const { changed, nextState } = residentFeedRuntimeSupport.applyMapCommunityFeedItemsViewedToState(baseState, safeKind, sourceItems);
      if (!changed) return false;
      persistState(nextState);
      return true;
    }

    let changed = false;
    let persistedNext = null;
    setMapCommunityFeedReadState((prev) => {
      const result = residentFeedRuntimeSupport.applyMapCommunityFeedItemsViewedToState(prev, safeKind, sourceItems);
      if (!result.changed) return prev;
      changed = true;
      persistedNext = persistState(result.nextState);
      return result.nextState;
    });
    return changed || Boolean(persistedNext);
  }, [
    communityFeedViewerKey,
    communityFeedViewerUserId,
    residentFeedRuntimeReady,
    residentFeedRuntimeSupport,
    resolvedCommunityFeedTenantKey,
    setMapCommunityFeedReadState,
  ]);

  const loadMapCommunityFeed = useCallback(async () => {
    if (!residentFeedRuntimeReady) return;
    const { loadMapCommunityFeedShared } = await loadDeferredResidentFeedActionSupportModule();
    return loadMapCommunityFeedShared({
      authReady,
      tenantReady,
      residentFeedRuntimeReady,
      resolvedCommunityFeedTenantKey,
      mapCommunityFeedRequestSeqRef,
      sessionAccessToken,
      tenantScopedReadClient,
      supabase,
      createTenantScopedAuthedClient,
      createTenantScopedReadClient,
      isMissingRelationError,
      residentFeedRuntimeSupport,
      setMapCommunityAlerts,
      setMapCommunityEvents,
      setMapCommunityTopics,
      setMapCommunityFeedLoading,
      setMapCommunityFeedError,
    });
  }, [
    authReady,
    createTenantScopedAuthedClient,
    createTenantScopedReadClient,
    isMissingRelationError,
    mapCommunityFeedRequestSeqRef,
    residentFeedRuntimeReady,
    residentFeedRuntimeSupport,
    resolvedCommunityFeedTenantKey,
    sessionAccessToken,
    setMapCommunityAlerts,
    setMapCommunityEvents,
    setMapCommunityFeedError,
    setMapCommunityFeedLoading,
    setMapCommunityTopics,
    supabase,
    tenantReady,
    tenantScopedReadClient,
  ]);

  useEffect(() => {
    mapCommunityFeedRequestSeqRef.current += 1;
    setMapCommunityAlerts([]);
    setMapCommunityEvents([]);
    setMapCommunityTopics([]);
    setMapCommunityFeedLoading(false);
    setMapCommunityFeedError("");
  }, [
    mapCommunityFeedRequestSeqRef,
    resolvedCommunityFeedTenantKey,
    setMapCommunityAlerts,
    setMapCommunityEvents,
    setMapCommunityFeedError,
    setMapCommunityFeedLoading,
    setMapCommunityTopics,
  ]);

  // Notification Preferences renders the tenant's notification topics.  Load the
  // same feed metadata when that screen opens; otherwise its topic list remains
  // empty until the resident happens to visit Alerts or Events first.
  // Alert/Event badges are live entry points, not merely counters within
  // their respective workspaces. Keep their shared feed current whenever
  // either tool is enabled so a newly published Alert cannot lag behind an
  // Event until somebody happens to open the tab.
  const shouldLoadMapCommunityFeed =
    alertsWindowOpen
    || eventsWindowOpen
    || notificationPreferencesOpen
    || showMapAlertIcon
    || showMapEventIcon;

  useEffect(() => {
    if (!shouldLoadMapCommunityFeed || !residentFeedRuntimeReady) return undefined;
    let cancelled = false;
    void loadMapCommunityFeed().catch((error) => {
      if (cancelled) return;
      console.warn("[map community feed]", error?.message || error);
      setMapCommunityFeedError("Could not load alerts and events right now.");
      setMapCommunityFeedLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadMapCommunityFeed, residentFeedRuntimeReady, setMapCommunityFeedError, setMapCommunityFeedLoading, shouldLoadMapCommunityFeed]);

  useEffect(() => {
    if ((!alertsWindowOpen && !eventsWindowOpen) || !residentFeedRuntimeReady) return;
    void loadMapCommunityFeed();
  }, [alertsWindowOpen, eventsWindowOpen, loadMapCommunityFeed, residentFeedRuntimeReady]);

  useEffect(() => {
    if (!shouldLoadMapCommunityFeed || !residentFeedRuntimeReady) return undefined;
    if (!authReady || tenantReady === false || !resolvedCommunityFeedTenantKey) return undefined;
    let refreshTimer = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void loadMapCommunityFeed();
      }, 250);
    };
    const channel = supabase
      .channel(`realtime-community-feed-${resolvedCommunityFeedTenantKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "municipality_alerts",
          filter: `tenant_key=eq.${resolvedCommunityFeedTenantKey}`,
        },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "municipality_events",
          filter: `tenant_key=eq.${resolvedCommunityFeedTenantKey}`,
        },
        scheduleRefresh
      )
      .subscribe();
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [authReady, loadMapCommunityFeed, residentFeedRuntimeReady, resolvedCommunityFeedTenantKey, shouldLoadMapCommunityFeed, supabase, tenantReady]);

  useEffect(() => {
    if (!shouldLoadMapCommunityFeed || !residentFeedRuntimeReady) return undefined;
    if (!authReady || tenantReady === false || !resolvedCommunityFeedTenantKey) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void loadMapCommunityFeed();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [authReady, loadMapCommunityFeed, residentFeedRuntimeReady, resolvedCommunityFeedTenantKey, shouldLoadMapCommunityFeed, tenantReady]);

  useEffect(() => {
    if (!shouldLoadMapCommunityFeed || !residentFeedRuntimeReady) return undefined;
    if (!authReady || tenantReady === false || !resolvedCommunityFeedTenantKey) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadMapCommunityFeed();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [authReady, loadMapCommunityFeed, residentFeedRuntimeReady, resolvedCommunityFeedTenantKey, shouldLoadMapCommunityFeed, tenantReady]);

  useEffect(() => {
    let dispose = () => {};
    let cancelled = false;

    void loadDeferredAccountRuntimeModule()
      .then(({ attachNativePushListenersRuntimeShared }) => {
        if (cancelled) return;
        dispose = attachNativePushListenersRuntimeShared({
          nativePushEnabled,
          sessionUserId: communityFeedViewerUserId,
          nativePushShouldRegister,
          nativePushRegisteringRef,
          resolvedCommunityFeedTenantKey,
          nativePushRegisteredKey,
        }, {
          isNativeAppRuntime,
          getPlatformName,
          supabase,
          isMissingRelationError,
          isExpectedPermissionError,
          loadMapCommunityFeed: (...args) => nativePushCallbacksRef.current.loadMapCommunityFeed?.(...args),
          refreshResidentNotifications: (...args) => nativePushCallbacksRef.current.refreshResidentNotifications?.(...args),
          openNotice: (...args) => nativePushCallbacksRef.current.openNotice?.(...args),
          openNotificationsInbox: (...args) => nativePushCallbacksRef.current.openNotificationsInbox?.(...args),
          openResidentNotificationTarget: (...args) => nativePushCallbacksRef.current.openResidentNotificationTarget?.(...args),
        }) || (() => {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    communityFeedViewerUserId,
    isExpectedPermissionError,
    isMissingRelationError,
    nativePushEnabled,
    nativePushRegisteringRef,
    nativePushShouldRegister,
    resolvedCommunityFeedTenantKey,
    supabase,
  ]);

  const openResidentNotificationTarget = useCallback(async (item) => {
    if (!residentFeedRuntimeReady) return;
    const tenantKey = String(item?.tenant_key || "").trim().toLowerCase();
    const kind = residentFeedRuntimeSupport.normalizeResidentNotificationKind(item?.kind);
    const itemId = String(item?.id || "").trim();
    if (!tenantKey || !itemId) return;

    if (kind === "report_update") {
      await supabase
        .from("resident_incident_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", Number(itemId));
      refreshResidentNotifications();
      setNotificationsWindowOpen(false);
      setAccountMenuOpen(false);
      setMobileHeaderMenuOpen(false);
      setAdminDomainMenuOpen(false);
      setAdminToolboxOpen(false);
      setOpenReportsOpen(false);
      const normalizedCurrentTenantKey = String(currentTenantKey || resolvedCommunityFeedTenantKey || "").trim().toLowerCase();
      // Tenant switching is asynchronous.  Queue the report handoff and let
      // the tenant-ready effect below open it only after the destination
      // tenant has become active; opening it immediately races the old
      // tenant's report runtime.
      setPendingResidentNotificationTarget({
        tenantKey,
        kind,
        itemId,
        reportTarget: {
          domainKey: String(item?.domain || "").trim(),
          focusIncidentId: String(item?.incident_id || "").trim(),
          focusQuery: residentNotificationIncidentDisplayId(item),
          incidentState: String(item?.new_state || "").trim(),
          incidentStateChangedAt: String(item?.created_at || "").trim(),
          reportedByMode: "me",
          inViewOnly: false,
          diagnosticSource: "resident-notification",
        },
      });
      if (normalizedCurrentTenantKey !== tenantKey) {
        // Only a browser tenant switch navigates away and therefore needs a
        // URL handoff. Native remains in this React runtime; putting the
        // handoff in its URL let a completed (or failed) switch leak into a
        // later, unrelated location change.
        if (isNativeAppRuntime()) {
          writeNativeResidentNotificationReportHandoff({
            tenantKey,
            domainKey: String(item?.domain || "").trim(),
            focusIncidentId: String(item?.incident_id || "").trim(),
            incidentState: String(item?.new_state || "").trim(),
            incidentStateChangedAt: String(item?.created_at || "").trim(),
          });
        } else {
          writeResidentNotificationReportHandoff({
            domainKey: String(item?.domain || "").trim(),
            focusIncidentId: String(item?.incident_id || "").trim(),
            incidentState: String(item?.new_state || "").trim(),
            incidentStateChangedAt: String(item?.created_at || "").trim(),
          });
        }
        const switched = await tenantSwitch?.(tenantKey);
        if (switched === false) setPendingResidentNotificationTarget(null);
      }
      return;
    }

    markMapCommunityFeedItemsViewed(kind === "event" ? "events" : "alerts", [item], {
      tenantKey,
      persistRemote: false,
    });
    refreshResidentNotifications();

    setNotificationsWindowOpen(false);
    setAccountMenuOpen(false);
    setMobileHeaderMenuOpen(false);
    setAdminDomainMenuOpen(false);
    setAdminToolboxOpen(false);
    setMyReportsOpen(false);
    setOpenReportsOpen(false);
    setPendingResidentNotificationTarget({
      tenantKey,
      kind,
      itemId,
    });

    const normalizedCurrentTenantKey = String(currentTenantKey || resolvedCommunityFeedTenantKey || "").trim().toLowerCase();
    if (normalizedCurrentTenantKey === tenantKey) return;
    if (isNativeAppRuntime()) {
      writeNativeResidentNotificationFeedHandoff({ tenantKey, kind, itemId });
    } else {
      writeResidentNotificationFeedHandoff({ tenantKey, kind, itemId });
    }
    await tenantSwitch?.(tenantKey);
  }, [
    currentTenantKey,
    markMapCommunityFeedItemsViewed,
    refreshResidentNotifications,
    residentFeedRuntimeReady,
    residentFeedRuntimeSupport,
    resolvedCommunityFeedTenantKey,
    setAccountMenuOpen,
    setAdminDomainMenuOpen,
    setAdminToolboxOpen,
    setMobileHeaderMenuOpen,
    openMyReports,
    setMyReportsOpen,
    setNotificationsWindowOpen,
    setOpenReportsOpen,
    setPendingResidentNotificationTarget,
    tenantSwitch,
  ]);

  // Native listeners must outlive ordinary React renders. Several of the
  // callbacks above intentionally change as map/feed state changes, so keep
  // their latest versions in a ref instead of tearing down and recreating the
  // iOS listeners on every render.
  useEffect(() => {
    nativePushCallbacksRef.current = {
      loadMapCommunityFeed,
      refreshResidentNotifications,
      openNotice,
      openNotificationsInbox,
      openResidentNotificationTarget,
    };
  });

  const handleResidentAlertVisible = useCallback((item) => {
    const changed = markMapCommunityFeedItemsViewed("alerts", [item], { persistRemote: true });
    if (changed) {
      refreshResidentNotifications();
    }
  }, [markMapCommunityFeedItemsViewed, refreshResidentNotifications]);

  const handleResidentEventVisible = useCallback((item) => {
    const changed = markMapCommunityFeedItemsViewed("events", [item], { persistRemote: true });
    if (changed) {
      refreshResidentNotifications();
    }
  }, [markMapCommunityFeedItemsViewed, refreshResidentNotifications]);

  const updateResidentNotificationInboxState = useCallback(async (item, action = "read") => {
    const kind = residentFeedRuntimeSupport?.normalizeResidentNotificationKind(item?.kind);
    const itemId = String(item?.id || "").trim();
    const tenantKey = String(item?.tenant_key || resolvedCommunityFeedTenantKey || "").trim().toLowerCase();
    if (!kind || !itemId || !tenantKey) return false;

    if (kind === "report_update") {
      const payload = action === "delete"
        ? { deleted_at: new Date().toISOString() }
        : { read_at: action === "unread" ? null : new Date().toISOString() };
      const { error } = await supabase
        .from("resident_incident_notifications")
        .update(payload)
        .eq("id", Number(itemId));
      if (error) throw error;
      refreshResidentNotifications();
      return true;
    }

    const feedKind = kind === "event" ? "events" : "alerts";
    const persist = async (nextState) => {
      residentFeedRuntimeSupport.saveMapCommunityFeedReadState(tenantKey, communityFeedViewerKey, nextState);
      if (communityFeedViewerUserId) {
        await residentFeedRuntimeSupport.saveMapCommunityFeedReadStateRemote(tenantKey, communityFeedViewerUserId, nextState);
      }
      return nextState;
    };
    if (tenantKey !== resolvedCommunityFeedTenantKey) {
      const previous = residentFeedRuntimeSupport.loadMapCommunityFeedReadState(tenantKey, communityFeedViewerKey);
      const result = residentFeedRuntimeSupport.applyMapCommunityFeedItemInboxActionToState(previous, feedKind, item, action);
      if (!result.changed) return false;
      await persist(result.nextState);
      refreshResidentNotifications();
      return true;
    }

    // Calculate from the committed state in this render rather than trying to
    // read a value out of React's queued state updater. The latter can run
    // after this async handler returns, which made a fast swipe look saved
    // locally while its durable update was skipped.
    const result = residentFeedRuntimeSupport.applyMapCommunityFeedItemInboxActionToState(
      mapCommunityFeedReadState,
      feedKind,
      item,
      action,
    );
    if (!result.changed) return false;
    setMapCommunityFeedReadState(result.nextState);
    await persist(result.nextState);
    refreshResidentNotifications();
    return true;
  }, [
    communityFeedViewerKey,
    communityFeedViewerUserId,
    mapCommunityFeedReadState,
    refreshResidentNotifications,
    residentFeedRuntimeSupport,
    resolvedCommunityFeedTenantKey,
    setMapCommunityFeedReadState,
    supabase,
  ]);

  useEffect(() => {
    onResidentFeedApiChange?.({
      loadMapCommunityFeed,
      openResidentNotificationTarget,
      handleResidentAlertVisible,
      handleResidentEventVisible,
      updateResidentNotificationInboxState,
      refreshResidentNotifications,
    });
  }, [
    handleResidentAlertVisible,
    handleResidentEventVisible,
    updateResidentNotificationInboxState,
    loadMapCommunityFeed,
    onResidentFeedApiChange,
    openResidentNotificationTarget,
    refreshResidentNotifications,
  ]);

  const activeMapCommunityAlerts = useMemo(
    () => residentFeedRuntimeReady
      ? residentFeedRuntimeSupport.sortResidentAlerts(
        residentFeedRuntimeSupport.filterActiveResidentAlerts(mapCommunityAlerts)
      )
      : [],
    [communityFeedTimeKey, mapCommunityAlerts, residentFeedRuntimeReady, residentFeedRuntimeSupport]
  );
  const activeMapCommunityEvents = useMemo(
    () => residentFeedRuntimeReady
      ? residentFeedRuntimeSupport.sortResidentEvents(
        residentFeedRuntimeSupport.filterActiveResidentEvents(mapCommunityEvents)
      )
      : [],
    [communityFeedTimeKey, mapCommunityEvents, residentFeedRuntimeReady, residentFeedRuntimeSupport]
  );

  const badgeCounts = useMemo(() => {
    if (!communityFeedViewerUserId || !residentFeedRuntimeReady) {
      return {
        notifications: 0,
        alerts: 0,
        events: 0,
      };
    }

    const enabledAlerts = residentFeedRuntimeSupport.filterResidentFeedItemsForInAppPreferences(
      activeMapCommunityAlerts,
      savedNotificationPreferencesByTopic,
      notificationTopics,
    );
    const enabledEvents = residentFeedRuntimeSupport.filterResidentFeedItemsForInAppPreferences(
      activeMapCommunityEvents,
      savedNotificationPreferencesByTopic,
      notificationTopics,
    );

    return {
      notifications: (residentNotificationLocations || []).reduce(
        (sum, row) => sum + Math.max(0, Number(row?.unreadCount || 0)),
        0,
      ),
      alerts: residentFeedRuntimeSupport.countUnreadMapCommunityFeedItems(
        enabledAlerts,
        mapCommunityFeedReadState,
        "alerts",
      ),
      events: residentFeedRuntimeSupport.countUnreadMapCommunityFeedItems(
        enabledEvents,
        mapCommunityFeedReadState,
        "events",
      ),
    };
  }, [
    activeMapCommunityAlerts,
    activeMapCommunityEvents,
    communityFeedViewerUserId,
    mapCommunityFeedReadState,
    notificationTopics,
    residentFeedRuntimeReady,
    residentFeedRuntimeSupport,
    residentNotificationLocations,
    savedNotificationPreferencesByTopic,
  ]);

  useEffect(() => {
    onBadgeCountsChange?.(badgeCounts);
  }, [badgeCounts, onBadgeCountsChange]);

  useEffect(() => {
    if (!isNativeAppRuntime()) return undefined;
    let cancelled = false;
    void loadDeferredNativeBadgeRuntimeModule()
      .then(({ syncNativeBadgeCountRuntimeShared }) => syncNativeBadgeCountRuntimeShared(
        badgeCounts.notifications,
        {
          loadCapacitorBadgeModule,
          shouldCancel: () => cancelled,
          logger: console,
        },
      ))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [badgeCounts.notifications]);

  const shouldWarmResidentNotificationSummary = Boolean(
    authReady &&
    tenantReady !== false &&
    resolvedCommunityFeedTenantKey &&
    communityFeedViewerUserId
  );

  useEffect(() => {
    if (!shouldWarmResidentNotificationSummary || !showMapNotificationsIcon) {
      setResidentNotificationSummaryWarmReady(false);
      return undefined;
    }
    if (residentNotificationSummaryWarmReady) return undefined;
    if (notificationsWindowOpen || notificationPreferencesOpen) {
      setResidentNotificationSummaryWarmReady(true);
      return undefined;
    }
    if (loading || !startupWarmupReady) return undefined;
    return scheduleDeferredWarmup(() => {
      setResidentNotificationSummaryWarmReady(true);
    }, {
      startDelayMs: 5200,
      idleTimeoutMs: 3600,
      fallbackDelayMs: 1800,
    });
  }, [
    loading,
    notificationPreferencesOpen,
    notificationsWindowOpen,
    residentNotificationSummaryWarmReady,
    scheduleDeferredWarmup,
    shouldWarmResidentNotificationSummary,
    showMapNotificationsIcon,
    startupWarmupReady,
  ]);

  const shouldLoadResidentNotificationSummary = Boolean(
    shouldWarmResidentNotificationSummary &&
    residentNotificationSummaryWarmReady
  );

  const loadResidentNotificationSummary = useCallback(async () => {
    const { loadResidentNotificationSummaryShared } = await loadDeferredResidentFeedActionSupportModule();
    return loadResidentNotificationSummaryShared({
      showMapNotificationsIcon,
      authReady,
      tenantReady,
      residentFeedRuntimeReady,
      resolvedCommunityFeedTenantKey,
      supabase,
      communityFeedViewerKey,
      residentFeedRuntimeSupport,
      isMissingFunctionError,
      isMissingRelationError,
      isExpectedPermissionError,
      setResidentNotificationLocations,
    });
  }, [
    authReady,
    communityFeedViewerKey,
    isExpectedPermissionError,
    isMissingFunctionError,
    isMissingRelationError,
    residentFeedRuntimeReady,
    residentFeedRuntimeSupport,
    resolvedCommunityFeedTenantKey,
    setResidentNotificationLocations,
    showMapNotificationsIcon,
    supabase,
    tenantReady,
  ]);

  useEffect(() => {
    if (communityFeedViewerUserId) return;
    setResidentNotificationLocations([]);
  }, [communityFeedViewerUserId, resolvedCommunityFeedTenantKey, setResidentNotificationLocations]);

  useEffect(() => {
    if (!showMapNotificationsIcon) return undefined;
    if (!notificationsWindowOpen && (loading || !startupWarmupReady)) return undefined;
    if (!shouldLoadResidentNotificationSummary || !residentFeedRuntimeReady) return undefined;
    let cancelled = false;
    let idleHandle = null;
    let timeoutHandle = null;
    const runLoad = () => {
      void loadResidentNotificationSummary().catch((error) => {
        if (cancelled) return;
        if (!isMissingFunctionError(error) && !isMissingRelationError(error) && !isExpectedPermissionError(error)) {
          console.warn("[resident notifications]", error?.message || error);
        }
        setResidentNotificationLocations([]);
      });
    };

    if (notificationsWindowOpen) {
      runLoad();
    } else if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(() => {
        idleHandle = null;
        if (!cancelled) runLoad();
      }, { timeout: 2400 });
    } else if (typeof window !== "undefined") {
      timeoutHandle = window.setTimeout(() => {
        timeoutHandle = null;
        if (!cancelled) runLoad();
      }, 900);
    } else {
      runLoad();
    }

    return () => {
      cancelled = true;
      if (idleHandle != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null && typeof window !== "undefined") {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [
    isExpectedPermissionError,
    isMissingFunctionError,
    isMissingRelationError,
    loadResidentNotificationSummary,
    loading,
    notificationsWindowOpen,
    residentNotificationsRefreshToken,
    residentFeedRuntimeReady,
    setResidentNotificationLocations,
    shouldLoadResidentNotificationSummary,
    showMapNotificationsIcon,
    startupWarmupReady,
  ]);

  useEffect(() => {
    if (!showMapNotificationsIcon) return undefined;
    if (!shouldLoadResidentNotificationSummary || !residentFeedRuntimeReady) return undefined;
    if (!startupWarmupReady) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void loadResidentNotificationSummary();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [
    loadResidentNotificationSummary,
    residentFeedRuntimeReady,
    shouldLoadResidentNotificationSummary,
    showMapNotificationsIcon,
    startupWarmupReady,
  ]);

  useEffect(() => {
    if (!showMapNotificationsIcon) return undefined;
    if (!shouldLoadResidentNotificationSummary || !residentFeedRuntimeReady) return undefined;
    if (!startupWarmupReady) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadResidentNotificationSummary();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    loadResidentNotificationSummary,
    residentFeedRuntimeReady,
    shouldLoadResidentNotificationSummary,
    showMapNotificationsIcon,
    startupWarmupReady,
  ]);

  useEffect(() => {
    if (!shouldPrepareCommunityFeedReadState || !residentFeedRuntimeReady) return undefined;
    const timer = window.setInterval(() => {
      setCommunityFeedTimeKey(Date.now());
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [residentFeedRuntimeReady, shouldPrepareCommunityFeedReadState]);

  useEffect(() => {
    const target = pendingResidentNotificationTarget;
    if (!target) return;
    const normalizedCurrentTenantKey = String(currentTenantKey || "").trim().toLowerCase();
    if (!normalizedCurrentTenantKey || normalizedCurrentTenantKey !== String(target?.tenantKey || "").trim().toLowerCase()) return;

    if (target.kind === "report_update") {
      // `currentTenantKey` changes as soon as the switch is requested, before
      // the destination tenant's domains and report runtime are available.
      // Opening Reports at that point binds it to half-torn-down state and
      // makes subsequent navigation unpredictable. Wait for the destination
      // load to have fully committed.
      if (tenantReady === false || loading) return;
      setPendingResidentNotificationTarget(null);
      openMyReports?.(target.reportTarget || {});
      return;
    }

    // A tenant key updates before the destination feed runtime has committed.
    // Defer the tab transition until that commit, just as report updates do.
    if (tenantReady === false || loading) return;
    const safeItemId = String(target?.itemId || "").trim();
    if (!safeItemId) {
      setPendingResidentNotificationTarget(null);
      return;
    }

    if (target.kind === "event") {
      setFocusedResidentAlertId("");
      setFocusedResidentEventId(safeItemId);
      setAlertsWindowOpen(false);
      setEventsWindowOpen(true);
    } else {
      setFocusedResidentEventId("");
      setFocusedResidentAlertId(safeItemId);
      setEventsWindowOpen(false);
      setAlertsWindowOpen(true);
    }
    setPendingResidentNotificationTarget(null);
  }, [
    currentTenantKey,
    loading,
    mapCommunityFeedLoading,
    openMyReports,
    pendingResidentNotificationTarget,
    setAlertsWindowOpen,
    setEventsWindowOpen,
    setFocusedResidentAlertId,
    setFocusedResidentEventId,
    setPendingResidentNotificationTarget,
    tenantReady,
  ]);

  useEffect(() => {
    if (!alertsWindowOpen) {
      alertsFeedMarkedForOpenRef.current = false;
      setAlertsSessionNewKeys([]);
      setFocusedResidentAlertId("");
      return;
    }
    if (!residentFeedRuntimeReady || mapCommunityFeedLoading || alertsFeedMarkedForOpenRef.current) return;
    const enabledAlerts = residentFeedRuntimeSupport.filterResidentFeedItemsForInAppPreferences(
      activeMapCommunityAlerts,
      savedNotificationPreferencesByTopic,
      notificationTopics,
    );
    const nextKeys = enabledAlerts
      .filter((item) => residentFeedRuntimeSupport.isUnreadMapCommunityFeedItem(item, mapCommunityFeedReadState, "alerts"))
      .map((item) => residentFeedRuntimeSupport.mapCommunityFeedItemReadKey(item))
      .filter(Boolean);
    setAlertsSessionNewKeys(nextKeys);
    alertsFeedMarkedForOpenRef.current = true;
  }, [
    activeMapCommunityAlerts,
    alertsFeedMarkedForOpenRef,
    alertsWindowOpen,
    mapCommunityFeedLoading,
    mapCommunityFeedReadState,
    notificationTopics,
    residentFeedRuntimeReady,
    residentFeedRuntimeSupport,
    savedNotificationPreferencesByTopic,
    setAlertsSessionNewKeys,
    setFocusedResidentAlertId,
  ]);

  useEffect(() => {
    if (!eventsWindowOpen) {
      eventsFeedMarkedForOpenRef.current = false;
      setEventsSessionNewKeys([]);
      setFocusedResidentEventId("");
      return;
    }
    if (!residentFeedRuntimeReady || mapCommunityFeedLoading || eventsFeedMarkedForOpenRef.current) return;
    const enabledEvents = residentFeedRuntimeSupport.filterResidentFeedItemsForInAppPreferences(
      activeMapCommunityEvents,
      savedNotificationPreferencesByTopic,
      notificationTopics,
    );
    const nextKeys = enabledEvents
      .filter((item) => residentFeedRuntimeSupport.isUnreadMapCommunityFeedItem(item, mapCommunityFeedReadState, "events"))
      .map((item) => residentFeedRuntimeSupport.mapCommunityFeedItemReadKey(item))
      .filter(Boolean);
    setEventsSessionNewKeys(nextKeys);
    eventsFeedMarkedForOpenRef.current = true;
  }, [
    activeMapCommunityEvents,
    eventsFeedMarkedForOpenRef,
    eventsWindowOpen,
    mapCommunityFeedLoading,
    mapCommunityFeedReadState,
    notificationTopics,
    residentFeedRuntimeReady,
    residentFeedRuntimeSupport,
    savedNotificationPreferencesByTopic,
    setEventsSessionNewKeys,
    setFocusedResidentEventId,
  ]);

  return null;
}
