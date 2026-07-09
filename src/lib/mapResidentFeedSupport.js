import {
  COMMUNITY_FEED_STATUS_OPTIONS,
  EMPTY_COMMUNITY_ALERT_FORM,
  EMPTY_COMMUNITY_EVENT_FORM,
} from "./mapCommunityFeedSupport.js";

const COMMUNITY_EVENT_RECENT_GRACE_MS = 60 * 60 * 1000;

export function toResidentFeedDateInputValue(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function trimResidentFeedValue(value) {
  return String(value || "").trim();
}

export function coerceResidentFeedDateTime(value) {
  const raw = trimResidentFeedValue(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function defaultCommunityFeedTopicKey(kind, topics = []) {
  const list = Array.isArray(topics) ? topics : [];
  return String(list?.[0]?.topic_key || "").trim();
}

export function makeCommunityFeedForm(kind, topics = [], item = null) {
  const base = kind === "event"
    ? { ...EMPTY_COMMUNITY_EVENT_FORM, starts_at: toResidentFeedDateInputValue(new Date()) }
    : { ...EMPTY_COMMUNITY_ALERT_FORM };
  const topicKey = defaultCommunityFeedTopicKey(kind, topics);
  const next = { ...base, topic_key: topicKey };
  if (!item) return next;
  const itemStatus = trimResidentFeedValue(item.status).toLowerCase();
  const editableStatus = itemStatus || "published";
  return {
    ...next,
    topic_key: trimResidentFeedValue(item.topic_key) || topicKey,
    title: trimResidentFeedValue(item.title),
    summary: trimResidentFeedValue(item.summary),
    body: trimResidentFeedValue(item.body),
    severity: trimResidentFeedValue(item.severity) || "info",
    location_name: trimResidentFeedValue(item.location_name),
    location_address: trimResidentFeedValue(item.location_address),
    cta_label: trimResidentFeedValue(item.cta_label),
    cta_url: trimResidentFeedValue(item.cta_url),
    starts_at: item.starts_at ? toResidentFeedDateInputValue(item.starts_at) : "",
    ends_at: item.ends_at ? toResidentFeedDateInputValue(item.ends_at) : "",
    pinned: Boolean(item.pinned),
    all_day: Boolean(item.all_day),
    status: editableStatus,
    publish_at: itemStatus === "scheduled" && item.published_at
      ? toResidentFeedDateInputValue(item.published_at)
      : "",
  };
}

function isResidentCommunityVisible(row) {
  const status = String(row?.status || "").trim().toLowerCase();
  if (status === "published") return true;
  if (status === "scheduled") {
    const publishAt = row?.published_at ? new Date(row.published_at).getTime() : 0;
    return Number.isFinite(publishAt) && publishAt > 0 && publishAt <= Date.now();
  }
  return false;
}

export function residentCommunityStatusLabel(status) {
  const key = String(status || "").trim().toLowerCase();
  return COMMUNITY_FEED_STATUS_OPTIONS.find((option) => option.value === key)?.label || "Draft";
}

export function residentCommunityStatusDescription(status) {
  const key = String(status || "").trim().toLowerCase();
  return COMMUNITY_FEED_STATUS_OPTIONS.find((option) => option.value === key)?.description || COMMUNITY_FEED_STATUS_OPTIONS[0].description;
}

export function residentCommunityStatusTone(status, _darkMode = false) {
  const key = String(status || "").trim().toLowerCase();
  if (key === "published") {
    return {
      bg: "var(--sl-ui-feed-status-published-bg)",
      border: "var(--sl-ui-feed-status-published-border)",
      color: "var(--sl-ui-feed-status-published-text)",
    };
  }
  if (key === "scheduled") {
    return {
      bg: "var(--sl-ui-feed-status-scheduled-bg)",
      border: "var(--sl-ui-feed-status-scheduled-border)",
      color: "var(--sl-ui-feed-status-scheduled-text)",
    };
  }
  if (key === "archived") {
    return {
      bg: "var(--sl-ui-feed-status-archived-bg)",
      border: "var(--sl-ui-feed-status-archived-border)",
      color: "var(--sl-ui-feed-status-archived-text)",
    };
  }
  return {
    bg: "var(--sl-ui-feed-status-draft-bg)",
    border: "var(--sl-ui-feed-status-draft-border)",
    color: "var(--sl-ui-feed-status-draft-text)",
  };
}

function formatResidentFeedDateTime(value, opts = {}) {
  if (!value) return "TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: opts.dateStyle || "medium",
    timeStyle: opts.timeStyle || "short",
  }).format(parsed);
}

export function formatResidentEventRange(event) {
  if (!event?.starts_at) return "Date TBD";
  const start = new Date(event.starts_at);
  const end = event?.ends_at ? new Date(event.ends_at) : null;
  if (event?.all_day) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(start);
  }
  if (!end || Number.isNaN(end.getTime())) return formatResidentFeedDateTime(start.toISOString());
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(start)} • ${new Intl.DateTimeFormat("en-US", {
      timeStyle: "short",
    }).format(start)} - ${new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(end)}`;
  }
  return `${formatResidentFeedDateTime(start.toISOString())} - ${formatResidentFeedDateTime(end.toISOString())}`;
}

export function formatResidentAlertWindow(alert) {
  if (!alert?.starts_at && !alert?.ends_at) return "Effective immediately";
  if (alert?.starts_at && alert?.ends_at) {
    return `${formatResidentFeedDateTime(alert.starts_at)} - ${formatResidentFeedDateTime(alert.ends_at)}`;
  }
  if (alert?.starts_at) return `Starts ${formatResidentFeedDateTime(alert.starts_at)}`;
  return `Runs until ${formatResidentFeedDateTime(alert.ends_at)}`;
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

function residentAlertCurrentOrUpcomingSortTs(row) {
  const now = Date.now();
  const startsAt = row?.starts_at ? new Date(row.starts_at).getTime() : 0;
  const endsAt = row?.ends_at ? new Date(row.ends_at).getTime() : 0;
  if (startsAt && startsAt > now) return startsAt;
  if (endsAt && endsAt > now) return endsAt;
  return startsAt || endsAt || new Date(row?.published_at || row?.created_at || 0).getTime() || 0;
}

function residentAlertArchivedSortTs(row) {
  return (
    (row?.ends_at ? new Date(row.ends_at).getTime() : 0)
    || (row?.starts_at ? new Date(row.starts_at).getTime() : 0)
    || new Date(row?.published_at || row?.created_at || 0).getTime()
    || 0
  );
}

export function sortResidentCurrentOrUpcomingAlerts(rows = []) {
  return [...rows].sort((a, b) => {
    const aPinned = a?.pinned ? 1 : 0;
    const bPinned = b?.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aTs = residentAlertCurrentOrUpcomingSortTs(a);
    const bTs = residentAlertCurrentOrUpcomingSortTs(b);
    if (aTs !== bTs) return aTs - bTs;
    const aSeverity = residentAlertSeverityRank(a?.severity);
    const bSeverity = residentAlertSeverityRank(b?.severity);
    if (aSeverity !== bSeverity) return bSeverity - aSeverity;
    return new Date(b?.published_at || b?.created_at || 0).getTime()
      - new Date(a?.published_at || a?.created_at || 0).getTime();
  });
}

export function sortResidentArchivedAlerts(rows = []) {
  return [...rows].sort((a, b) => residentAlertArchivedSortTs(b) - residentAlertArchivedSortTs(a));
}

function residentEventArchivedSortTs(row) {
  return (
    (row?.ends_at ? new Date(row.ends_at).getTime() : 0)
    || (row?.starts_at ? new Date(row.starts_at).getTime() : 0)
    || new Date(row?.published_at || row?.created_at || 0).getTime()
    || 0
  );
}

export function sortResidentArchivedEvents(rows = []) {
  return [...rows].sort((a, b) => residentEventArchivedSortTs(b) - residentEventArchivedSortTs(a));
}

function endOfResidentFeedLocalDay(value) {
  if (!value) return 0;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  const end = new Date(parsed);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

function isResidentAlertCurrentOrUpcoming(row) {
  if (!isResidentCommunityVisible(row)) return false;
  const now = Date.now();
  const endsAt = row?.ends_at ? new Date(row.ends_at).getTime() : null;
  if (endsAt && endsAt < now) return false;
  return true;
}

function isResidentEventUpcomingOrActive(row) {
  if (!isResidentCommunityVisible(row)) return false;
  const now = Date.now();
  const startsAt = row?.starts_at ? new Date(row.starts_at).getTime() : null;
  const explicitEndAt = row?.ends_at ? new Date(row.ends_at).getTime() : null;
  const endsAt = explicitEndAt
    || (row?.all_day ? endOfResidentFeedLocalDay(row?.starts_at) : 0)
    || (startsAt ? (startsAt + COMMUNITY_EVENT_RECENT_GRACE_MS) : 0);
  if (endsAt && endsAt < now) return false;
  return true;
}

export function countCurrentOrUpcomingPublishedAlerts(alerts) {
  return (alerts || []).filter((alert) => isResidentAlertCurrentOrUpcoming(alert)).length;
}

export function countUpcomingPublishedEvents(events) {
  return (events || []).filter((event) => isResidentEventUpcomingOrActive(event)).length;
}

export function filterCurrentOrUpcomingResidentAlerts(items = []) {
  return (items || []).filter((item) => isResidentAlertCurrentOrUpcoming(item));
}

export function filterArchivedResidentAlerts(items = []) {
  return (items || []).filter((item) => isResidentCommunityVisible(item) && !isResidentAlertCurrentOrUpcoming(item));
}

export function filterArchivedResidentEvents(items = []) {
  return (items || []).filter((item) => isResidentCommunityVisible(item) && !isResidentEventUpcomingOrActive(item));
}

export function prioritizeResidentFeedItems(items = [], focusItemId = "") {
  const focusId = String(focusItemId || "").trim();
  if (!focusId) return Array.isArray(items) ? items : [];
  const list = Array.isArray(items) ? items : [];
  const focused = [];
  const rest = [];
  for (const item of list) {
    if (String(item?.id || "").trim() === focusId) focused.push(item);
    else rest.push(item);
  }
  return [...focused, ...rest];
}

export function buildResidentNotificationPreview(item) {
  const summary = String(item?.summary || "").trim();
  if (summary) return summary;
  const body = String(item?.body || "").trim().replace(/\s+/g, " ");
  if (!body) return "";
  return body.length > 180 ? `${body.slice(0, 177).trim()}...` : body;
}
