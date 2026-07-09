import { fetchResidentNotificationsSnapshot } from "./mapResidentNotificationSupport";

export async function loadMapCommunityFeedShared({
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
}) {
  if (!authReady || tenantReady === false || !residentFeedRuntimeReady) return;
  const tenantKey = resolvedCommunityFeedTenantKey;
  if (!tenantKey) {
    mapCommunityFeedRequestSeqRef.current += 1;
    setMapCommunityAlerts([]);
    setMapCommunityEvents([]);
    setMapCommunityTopics([]);
    setMapCommunityFeedLoading(false);
    setMapCommunityFeedError("");
    return;
  }

  const requestSeq = mapCommunityFeedRequestSeqRef.current + 1;
  mapCommunityFeedRequestSeqRef.current = requestSeq;
  const isLatestRequest = () => mapCommunityFeedRequestSeqRef.current === requestSeq;

  setMapCommunityFeedLoading(true);
  setMapCommunityFeedError("");

  const feedReadClient = sessionAccessToken
    ? (
        createTenantScopedAuthedClient(tenantKey, sessionAccessToken)
        || tenantScopedReadClient
        || createTenantScopedReadClient(tenantKey)
        || supabase
      )
    : (tenantScopedReadClient || createTenantScopedReadClient(tenantKey) || supabase);

  const topicQuery = feedReadClient
    .from("notification_topics")
    .select("topic_key,label,default_enabled,topic_kind")
    .eq("tenant_key", tenantKey)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const alertQuery = feedReadClient
    .from("municipality_alerts")
    .select("id,tenant_key,topic_key,title,summary,body,severity,location_name,location_address,cta_label,cta_url,pinned,status,starts_at,ends_at,published_at,created_at,updated_at")
    .eq("tenant_key", tenantKey)
    .order("pinned", { ascending: false })
    .order("starts_at", { ascending: false })
    .order("created_at", { ascending: false });

  const eventQuery = feedReadClient
    .from("municipality_events")
    .select("id,tenant_key,topic_key,title,summary,body,location_name,location_address,cta_label,cta_url,all_day,status,starts_at,ends_at,published_at,created_at,updated_at")
    .eq("tenant_key", tenantKey)
    .order("starts_at", { ascending: true })
    .order("created_at", { ascending: false });

  const [topicRes, alertRes, eventRes] = await Promise.all([topicQuery, alertQuery, eventQuery]);
  if (!isLatestRequest()) return;

  const firstError = alertRes.error || eventRes.error;
  if (firstError) {
    if (!isMissingRelationError(firstError)) {
      console.warn("[map community feed]", firstError?.message || firstError);
      setMapCommunityFeedError("Could not load alerts and events right now.");
    } else {
      setMapCommunityFeedError("");
    }
    setMapCommunityAlerts([]);
    setMapCommunityEvents([]);
    setMapCommunityTopics([]);
    setMapCommunityFeedLoading(false);
    return;
  }

  if (topicRes.error && !isMissingRelationError(topicRes.error)) {
    console.warn("[map community topics]", topicRes.error?.message || topicRes.error);
  }

  const topicLabelsByKey = Object.fromEntries(
    (topicRes.data || []).map((topic) => [topic.topic_key, String(topic?.label || "").trim() || topic?.topic_key])
  );
  const nextTopics = (topicRes.data || [])
    .map((topic) => ({
      topic_key: String(topic?.topic_key || "").trim(),
      label: String(topic?.label || "").trim() || String(topic?.topic_key || "").trim(),
      default_enabled: Boolean(topic?.default_enabled),
      topic_kind: String(topic?.topic_kind || "").trim().toLowerCase() === "event" ? "event" : "alert",
    }))
    .filter((topic) => topic.topic_key);
  setMapCommunityTopics(nextTopics);

  setMapCommunityAlerts(
    residentFeedRuntimeSupport.sortResidentAlerts(
      (alertRes.data || [])
        .filter((alert) => residentFeedRuntimeSupport.isResidentCommunityVisible(alert))
        .map((alert) => ({
          ...alert,
          topic_label: topicLabelsByKey[alert.topic_key] || alert.topic_key,
          topic_kind: "alert",
        }))
    )
  );
  setMapCommunityEvents(
    residentFeedRuntimeSupport.sortResidentEvents(
      (eventRes.data || [])
        .filter((event) => residentFeedRuntimeSupport.isResidentCommunityVisible(event))
        .map((event) => ({
          ...event,
          topic_label: topicLabelsByKey[event.topic_key] || event.topic_key,
          topic_kind: "event",
        }))
    )
  );
  setMapCommunityFeedLoading(false);
}

export async function loadResidentNotificationSummaryShared({
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
}) {
  if (!showMapNotificationsIcon || !authReady || tenantReady === false || !residentFeedRuntimeReady) return;
  if (!resolvedCommunityFeedTenantKey) {
    setResidentNotificationLocations([]);
    return;
  }

  try {
    const snapshot = await fetchResidentNotificationsSnapshot({
      supabase,
      tenantFilter: null,
      communityFeedViewerKey,
      emptyMapCommunityFeedReadState: residentFeedRuntimeSupport.emptyMapCommunityFeedReadState,
      loadMapCommunityFeedReadState: residentFeedRuntimeSupport.loadMapCommunityFeedReadState,
      isUnreadMapCommunityFeedItem: residentFeedRuntimeSupport.isUnreadMapCommunityFeedItem,
      normalizeResidentNotificationKind: residentFeedRuntimeSupport.normalizeResidentNotificationKind,
    });
    setResidentNotificationLocations(snapshot.locations);
  } catch (error) {
    if (!isMissingFunctionError(error) && !isMissingRelationError(error) && !isExpectedPermissionError(error)) {
      console.warn("[resident notifications]", error?.message || error);
    }
    setResidentNotificationLocations([]);
  }
}

export async function openResidentNotificationTargetShared(item, state = {}, deps = {}) {
  if (!state.residentFeedRuntimeReady) return;
  const tenantKey = String(item?.tenant_key || "").trim().toLowerCase();
  const kind = state.residentFeedRuntimeSupport.normalizeResidentNotificationKind(item?.kind);
  const itemId = String(item?.id || "").trim();
  if (!tenantKey || !itemId) return;

  deps.markMapCommunityFeedItemsViewed(kind === "event" ? "events" : "alerts", [item], {
    tenantKey,
    persistRemote: false,
  });
  deps.refreshResidentNotifications();

  deps.setNotificationsWindowOpen(false);
  deps.setAccountMenuOpen(false);
  deps.setMobileHeaderMenuOpen(false);
  deps.setAdminDomainMenuOpen(false);
  deps.setAdminToolboxOpen(false);
  deps.setMyReportsOpen(false);
  deps.setOpenReportsOpen(false);
  deps.setPendingResidentNotificationTarget({
    tenantKey,
    kind,
    itemId,
  });

  const currentTenantKey = String(state.currentTenantKey || "").trim().toLowerCase();
  if (currentTenantKey === tenantKey) return;
  await deps.switchTenant?.(tenantKey);
}

export function handleResidentFeedItemVisibleShared(kind, item, deps = {}) {
  const changed = deps.markMapCommunityFeedItemsViewed(kind, [item], { persistRemote: true });
  if (changed) {
    deps.refreshResidentNotifications();
  }
}

export function resolvePendingResidentNotificationTargetShared(target, state = {}, deps = {}) {
  if (!target) return false;
  const currentTenantKey = String(state.currentTenantKey || "").trim().toLowerCase();
  if (!currentTenantKey || currentTenantKey !== String(target?.tenantKey || "").trim().toLowerCase()) return false;
  if (state.mapCommunityFeedLoading) return false;

  const safeItemId = String(target?.itemId || "").trim();
  if (!safeItemId) {
    deps.setPendingResidentNotificationTarget(null);
    return true;
  }

  if (target.kind === "event") {
    deps.setFocusedResidentAlertId("");
    deps.setFocusedResidentEventId(safeItemId);
    deps.setAlertsWindowOpen(false);
    deps.setEventsWindowOpen(true);
  } else {
    deps.setFocusedResidentEventId("");
    deps.setFocusedResidentAlertId(safeItemId);
    deps.setEventsWindowOpen(false);
    deps.setAlertsWindowOpen(true);
  }
  deps.setPendingResidentNotificationTarget(null);
  return true;
}

export function buildResidentFeedSessionNewKeysShared({
  kind = "alerts",
  items = [],
  savedNotificationPreferencesByTopic = {},
  notificationTopics = [],
  mapCommunityFeedReadState = {},
  residentFeedRuntimeSupport,
}) {
  if (!residentFeedRuntimeSupport) return [];
  const normalizedKind = kind === "events" ? "events" : "alerts";
  const enabledItems = residentFeedRuntimeSupport.filterResidentFeedItemsForInAppPreferences(
    items,
    savedNotificationPreferencesByTopic,
    notificationTopics,
  );
  return enabledItems
    .filter((item) => residentFeedRuntimeSupport.isUnreadMapCommunityFeedItem(item, mapCommunityFeedReadState, normalizedKind))
    .map((item) => residentFeedRuntimeSupport.mapCommunityFeedItemReadKey(item))
    .filter(Boolean);
}
