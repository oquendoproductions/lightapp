const COMMUNITY_EVENT_RECENT_GRACE_MS = 60 * 60 * 1000;

function isResidentCommunityVisible(row) {
  const status = String(row?.status || "").trim().toLowerCase();
  if (status === "published") return true;
  if (status === "scheduled") {
    const publishAt = row?.published_at ? new Date(row.published_at).getTime() : 0;
    return Number.isFinite(publishAt) && publishAt > 0 && publishAt <= Date.now();
  }
  return false;
}

function residentAlertSeverityRank(severity) {
  switch (String(severity || "").trim().toLowerCase()) {
    case "emergency":
      return 4;
    case "urgent":
      return 3;
    case "advisory":
      return 2;
    default:
      return 1;
  }
}

function sortResidentAlerts(rows = []) {
  return [...rows].sort((a, b) => {
    const aPinned = a?.pinned ? 1 : 0;
    const bPinned = b?.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aSeverity = residentAlertSeverityRank(a?.severity);
    const bSeverity = residentAlertSeverityRank(b?.severity);
    if (aSeverity !== bSeverity) return bSeverity - aSeverity;
    return new Date(b?.starts_at || b?.published_at || b?.created_at || 0).getTime()
      - new Date(a?.starts_at || a?.published_at || a?.created_at || 0).getTime();
  });
}

function sortResidentEvents(rows = []) {
  return [...rows].sort((a, b) => {
    const aStart = new Date(a?.starts_at || a?.created_at || 0).getTime();
    const bStart = new Date(b?.starts_at || b?.created_at || 0).getTime();
    return aStart - bStart;
  });
}

function endOfResidentFeedLocalDay(value) {
  if (!value) return 0;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  const end = new Date(parsed);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

function isResidentAlertCurrentlyActive(row) {
  if (!isResidentCommunityVisible(row)) return false;
  const now = Date.now();
  const startsAt = row?.starts_at ? new Date(row.starts_at).getTime() : null;
  const endsAt = row?.ends_at ? new Date(row.ends_at).getTime() : null;
  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;
  return true;
}

function isResidentEventUpcomingOrActive(row) {
  if (!isResidentCommunityVisible(row)) return false;
  const startsAt = row?.starts_at ? new Date(row.starts_at).getTime() : null;
  const explicitEndAt = row?.ends_at ? new Date(row.ends_at).getTime() : null;
  const endsAt = explicitEndAt
    || (row?.all_day ? endOfResidentFeedLocalDay(row?.starts_at) : 0)
    || (startsAt ? (startsAt + COMMUNITY_EVENT_RECENT_GRACE_MS) : 0);
  if (endsAt && endsAt < Date.now()) return false;
  return true;
}

function filterActiveResidentAlerts(items = []) {
  return (items || []).filter((item) => isResidentAlertCurrentlyActive(item));
}

function filterActiveResidentEvents(items = []) {
  return (items || []).filter((item) => isResidentEventUpcomingOrActive(item));
}

function buildMapCommunityFeedStorageKey(storageKeyPrefix, tenantKey, viewerKey) {
  const tenant = String(tenantKey || "").trim().toLowerCase();
  const viewer = String(viewerKey || "anon").trim().toLowerCase();
  return `${storageKeyPrefix}:${tenant || "unknown"}:${viewer || "anon"}`;
}

function emptyMapCommunityFeedReadState() {
  return {
    alertsLastViewedAt: 0,
    eventsLastViewedAt: 0,
    alertsReadKeys: [],
    eventsReadKeys: [],
    alertsReadIds: [],
    eventsReadIds: [],
  };
}

function parseMapCommunityFeedViewedTs(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  const asNumber = Number(value);
  if (Number.isFinite(asNumber) && asNumber > 0) return Math.max(0, asNumber);
  const parsed = new Date(value);
  const ts = parsed.getTime();
  return Number.isFinite(ts) && ts > 0 ? ts : 0;
}

function normalizeMapCommunityFeedReadState(raw = {}) {
  const now = Date.now();
  const clampLastViewedAt = (value) => {
    const ts = Math.max(0, parseMapCommunityFeedViewedTs(value));
    return ts > now ? now : ts;
  };
  return {
    alertsLastViewedAt: clampLastViewedAt(raw?.alertsLastViewedAt ?? raw?.alerts_last_viewed_at),
    eventsLastViewedAt: clampLastViewedAt(raw?.eventsLastViewedAt ?? raw?.events_last_viewed_at),
    alertsReadKeys: Array.isArray(raw?.alertsReadKeys) ? raw.alertsReadKeys.map((value) => String(value || "").trim()).filter(Boolean) : [],
    eventsReadKeys: Array.isArray(raw?.eventsReadKeys) ? raw.eventsReadKeys.map((value) => String(value || "").trim()).filter(Boolean) : [],
    alertsReadIds: Array.isArray(raw?.alertsReadIds) ? raw.alertsReadIds.map((value) => String(value || "").trim()).filter(Boolean) : [],
    eventsReadIds: Array.isArray(raw?.eventsReadIds) ? raw.eventsReadIds.map((value) => String(value || "").trim()).filter(Boolean) : [],
  };
}

function mergeMapCommunityFeedReadState(primary = {}, secondary = {}) {
  const a = normalizeMapCommunityFeedReadState(primary);
  const b = normalizeMapCommunityFeedReadState(secondary);
  return {
    alertsLastViewedAt: Math.max(Number(a.alertsLastViewedAt || 0), Number(b.alertsLastViewedAt || 0)),
    eventsLastViewedAt: Math.max(Number(a.eventsLastViewedAt || 0), Number(b.eventsLastViewedAt || 0)),
    alertsReadKeys: Array.from(new Set([...(a.alertsReadKeys || []), ...(b.alertsReadKeys || [])])).slice(-300),
    eventsReadKeys: Array.from(new Set([...(a.eventsReadKeys || []), ...(b.eventsReadKeys || [])])).slice(-300),
    alertsReadIds: Array.from(new Set([...(a.alertsReadIds || []), ...(b.alertsReadIds || [])])).slice(-300),
    eventsReadIds: Array.from(new Set([...(a.eventsReadIds || []), ...(b.eventsReadIds || [])])).slice(-300),
  };
}

function mapCommunityFeedItemTs(item) {
  return Math.max(
    Number(new Date(item?.updated_at || 0).getTime() || 0),
    Number(new Date(item?.published_at || 0).getTime() || 0),
    Number(new Date(item?.created_at || 0).getTime() || 0),
  );
}

function maxMapCommunityFeedTs(items) {
  return (items || []).reduce((max, item) => Math.max(max, mapCommunityFeedItemTs(item)), 0);
}

function mapCommunityFeedItemReadKey(item) {
  const id = String(item?.id || "").trim();
  if (!id) return "";
  return `${id}:${mapCommunityFeedItemTs(item)}`;
}

function applyMapCommunityFeedItemsViewedToState(prevState = {}, kind = "alerts", items = []) {
  const safeKind = kind === "events" ? "events" : "alerts";
  const sourceItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!sourceItems.length) {
    return {
      changed: false,
      nextState: normalizeMapCommunityFeedReadState(prevState),
    };
  }

  const normalizedPrev = normalizeMapCommunityFeedReadState(prevState);
  const nextTs = maxMapCommunityFeedTs(sourceItems);
  const nextReadKeys = sourceItems
    .map((item) => mapCommunityFeedItemReadKey(item))
    .filter(Boolean);
  const nextReadIds = sourceItems
    .map((item) => String(item?.id || "").trim())
    .filter(Boolean);

  const mergedAlertKeys = new Set(Array.isArray(normalizedPrev?.alertsReadKeys) ? normalizedPrev.alertsReadKeys : []);
  const mergedEventKeys = new Set(Array.isArray(normalizedPrev?.eventsReadKeys) ? normalizedPrev.eventsReadKeys : []);
  const mergedAlertIds = new Set(Array.isArray(normalizedPrev?.alertsReadIds) ? normalizedPrev.alertsReadIds : []);
  const mergedEventIds = new Set(Array.isArray(normalizedPrev?.eventsReadIds) ? normalizedPrev.eventsReadIds : []);
  const prevAlertKeyCount = mergedAlertKeys.size;
  const prevEventKeyCount = mergedEventKeys.size;
  const prevAlertIdCount = mergedAlertIds.size;
  const prevEventIdCount = mergedEventIds.size;

  if (safeKind === "alerts") {
    nextReadKeys.forEach((key) => mergedAlertKeys.add(key));
    nextReadIds.forEach((id) => mergedAlertIds.add(id));
  } else {
    nextReadKeys.forEach((key) => mergedEventKeys.add(key));
    nextReadIds.forEach((id) => mergedEventIds.add(id));
  }

  const nextState = {
    alertsLastViewedAt: safeKind === "alerts"
      ? Math.max(Number(normalizedPrev?.alertsLastViewedAt || 0), Number(nextTs || 0))
      : Math.max(0, Number(normalizedPrev?.alertsLastViewedAt || 0)),
    eventsLastViewedAt: safeKind === "events"
      ? Math.max(Number(normalizedPrev?.eventsLastViewedAt || 0), Number(nextTs || 0))
      : Math.max(0, Number(normalizedPrev?.eventsLastViewedAt || 0)),
    alertsReadKeys: Array.from(mergedAlertKeys).slice(-300),
    eventsReadKeys: Array.from(mergedEventKeys).slice(-300),
    alertsReadIds: Array.from(mergedAlertIds).slice(-300),
    eventsReadIds: Array.from(mergedEventIds).slice(-300),
  };

  const changed = (
    nextState.alertsLastViewedAt !== normalizedPrev.alertsLastViewedAt
    || nextState.eventsLastViewedAt !== normalizedPrev.eventsLastViewedAt
    || mergedAlertKeys.size !== prevAlertKeyCount
    || mergedEventKeys.size !== prevEventKeyCount
    || mergedAlertIds.size !== prevAlertIdCount
    || mergedEventIds.size !== prevEventIdCount
  );

  return {
    changed,
    nextState,
  };
}

function countUnreadMapCommunityFeedItems(items, readState = {}, kind = "alerts") {
  const lastViewedAt = kind === "events"
    ? Number(readState?.eventsLastViewedAt || 0)
    : Number(readState?.alertsLastViewedAt || 0);
  const readKeys = new Set(
    kind === "events"
      ? (Array.isArray(readState?.eventsReadKeys) ? readState.eventsReadKeys : [])
      : (Array.isArray(readState?.alertsReadKeys) ? readState.alertsReadKeys : []),
  );
  const readIds = new Set(
    kind === "events"
      ? (Array.isArray(readState?.eventsReadIds) ? readState.eventsReadIds : [])
      : (Array.isArray(readState?.alertsReadIds) ? readState.alertsReadIds : []),
  );
  const threshold = Math.max(0, Number(lastViewedAt || 0));
  return (items || []).filter((item) => {
    const itemId = String(item?.id || "").trim();
    const itemKey = mapCommunityFeedItemReadKey(item);
    if (itemId && readIds.has(itemId)) return false;
    if (itemKey && readKeys.has(itemKey)) return false;
    return mapCommunityFeedItemTs(item) > threshold;
  }).length;
}

function isUnreadMapCommunityFeedItem(item, readState = {}, kind = "alerts") {
  const lastViewedAt = kind === "events"
    ? Number(readState?.eventsLastViewedAt || 0)
    : Number(readState?.alertsLastViewedAt || 0);
  const readKeys = new Set(
    kind === "events"
      ? (Array.isArray(readState?.eventsReadKeys) ? readState.eventsReadKeys : [])
      : (Array.isArray(readState?.alertsReadKeys) ? readState.alertsReadKeys : []),
  );
  const readIds = new Set(
    kind === "events"
      ? (Array.isArray(readState?.eventsReadIds) ? readState.eventsReadIds : [])
      : (Array.isArray(readState?.alertsReadIds) ? readState.alertsReadIds : []),
  );
  const itemId = String(item?.id || "").trim();
  const itemKey = mapCommunityFeedItemReadKey(item);
  if (itemId && readIds.has(itemId)) return false;
  if (itemKey && readKeys.has(itemKey)) return false;
  return mapCommunityFeedItemTs(item) > Math.max(0, Number(lastViewedAt || 0));
}

function isResidentFeedInAppTopicEnabled(topicKey, preferencesByTopic = {}, topics = []) {
  const key = String(topicKey || "").trim();
  if (!key) return false;
  const configured = preferencesByTopic?.[key];
  if (configured && Object.prototype.hasOwnProperty.call(configured, "in_app_enabled")) {
    return Boolean(configured.in_app_enabled);
  }
  const topic = (Array.isArray(topics) ? topics : []).find((row) => String(row?.topic_key || "").trim() === key);
  if (topic && Object.prototype.hasOwnProperty.call(topic, "default_enabled")) {
    return Boolean(topic.default_enabled);
  }
  return false;
}

function filterResidentFeedItemsForInAppPreferences(items = [], preferencesByTopic = {}, topics = []) {
  return (items || []).filter((item) => isResidentFeedInAppTopicEnabled(item?.topic_key, preferencesByTopic, topics));
}

function normalizeResidentNotificationKind(value) {
  return String(value || "").trim().toLowerCase() === "event" ? "event" : "alert";
}

export function createResidentFeedRuntimeSupport({
  supabase,
  mapCommunityFeedReadKey = "cityreport_map_community_feed_read_v2",
  mapCommunityFeedRemoteTable = "resident_community_feed_views",
  isMissingRelationError = () => false,
  isExpectedPermissionError = () => false,
} = {}) {
  const storageKeyPrefix = String(mapCommunityFeedReadKey || "").trim() || "cityreport_map_community_feed_read_v2";
  const remoteTable = String(mapCommunityFeedRemoteTable || "").trim() || "resident_community_feed_views";

  function loadMapCommunityFeedReadState(tenantKey, viewerKey) {
    if (typeof window === "undefined") {
      return emptyMapCommunityFeedReadState();
    }
    try {
      const raw = window.localStorage.getItem(buildMapCommunityFeedStorageKey(storageKeyPrefix, tenantKey, viewerKey));
      if (!raw) return emptyMapCommunityFeedReadState();
      return normalizeMapCommunityFeedReadState(JSON.parse(raw));
    } catch {
      return emptyMapCommunityFeedReadState();
    }
  }

  function saveMapCommunityFeedReadState(tenantKey, viewerKey, value) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        buildMapCommunityFeedStorageKey(storageKeyPrefix, tenantKey, viewerKey),
        JSON.stringify({
          alertsLastViewedAt: Math.max(0, Number(value?.alertsLastViewedAt || 0)),
          eventsLastViewedAt: Math.max(0, Number(value?.eventsLastViewedAt || 0)),
          alertsReadKeys: Array.isArray(value?.alertsReadKeys) ? value.alertsReadKeys.slice(-300) : [],
          eventsReadKeys: Array.isArray(value?.eventsReadKeys) ? value.eventsReadKeys.slice(-300) : [],
          alertsReadIds: Array.isArray(value?.alertsReadIds) ? value.alertsReadIds.slice(-300) : [],
          eventsReadIds: Array.isArray(value?.eventsReadIds) ? value.eventsReadIds.slice(-300) : [],
        }),
      );
    } catch {
      // ignore storage failures
    }
  }

  async function loadMapCommunityFeedReadStateRemote(tenantKey, userId) {
    const safeTenantKey = String(tenantKey || "").trim().toLowerCase();
    const safeUserId = String(userId || "").trim();
    if (!supabase?.from || !safeTenantKey || !safeUserId) return null;
    const { data, error } = await supabase
      .from(remoteTable)
      .select("alerts_last_viewed_at,events_last_viewed_at")
      .eq("tenant_key", safeTenantKey)
      .eq("user_id", safeUserId)
      .maybeSingle();
    if (error) {
      if (!isMissingRelationError(error) && !isExpectedPermissionError(error)) {
        console.warn("[map community feed read state]", error?.message || error);
      }
      return null;
    }
    return normalizeMapCommunityFeedReadState(data || {});
  }

  async function saveMapCommunityFeedReadStateRemote(tenantKey, userId, value = {}) {
    const safeTenantKey = String(tenantKey || "").trim().toLowerCase();
    const safeUserId = String(userId || "").trim();
    if (!supabase?.from || !safeTenantKey || !safeUserId) return;
    const normalized = normalizeMapCommunityFeedReadState(value);
    const payload = {
      tenant_key: safeTenantKey,
      user_id: safeUserId,
      alerts_last_viewed_at: normalized.alertsLastViewedAt ? new Date(normalized.alertsLastViewedAt).toISOString() : null,
      events_last_viewed_at: normalized.eventsLastViewedAt ? new Date(normalized.eventsLastViewedAt).toISOString() : null,
    };
    const { error } = await supabase
      .from(remoteTable)
      .upsert([payload], { onConflict: "tenant_key,user_id" });
    if (error && !isMissingRelationError(error) && !isExpectedPermissionError(error)) {
      console.warn("[map community feed read state save]", error?.message || error);
    }
  }

  return {
    isResidentCommunityVisible,
    sortResidentAlerts,
    sortResidentEvents,
    filterActiveResidentAlerts,
    filterActiveResidentEvents,
    emptyMapCommunityFeedReadState,
    loadMapCommunityFeedReadState,
    saveMapCommunityFeedReadState,
    loadMapCommunityFeedReadStateRemote,
    saveMapCommunityFeedReadStateRemote,
    mergeMapCommunityFeedReadState,
    applyMapCommunityFeedItemsViewedToState,
    mapCommunityFeedItemReadKey,
    countUnreadMapCommunityFeedItems,
    isUnreadMapCommunityFeedItem,
    filterResidentFeedItemsForInAppPreferences,
    normalizeResidentNotificationKind,
  };
}
