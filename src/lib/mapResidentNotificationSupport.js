import { formattedIncidentDisplayIdShared } from "./mapIncidentDisplaySupport.js";
import { getIncidentDomainHelperShared } from "./mapIncidentDomainConfig.js";
import {
  DOMAIN_MARKER_GLYPHS,
  DOMAIN_MARKER_ICON_SRCS,
} from "./mapIncidentDomainStartupConfig.js";
import { defaultMarkerColorForDomainShared } from "./mapDomainMarkerColorSupport.js";
import { buildDomainMarkerIconPresentationShared } from "./mapDomainMarkerPresentationSupport.js";
import { RUNTIME_DOMAIN_META } from "./mapRuntimeDomainMeta.js";

export function residentNotificationIncidentDisplayId(item = {}) {
  const domainKey = String(item?.domain || "").trim();
  const incidentId = String(item?.incident_id || "").trim();
  if (!(domainKey && incidentId)) return incidentId;
  return String(formattedIncidentDisplayIdShared(
    domainKey,
    incidentId,
    null,
    String(item?.incident_display_id || "").trim(),
    null,
    {
      getIncidentDomainHelper: getIncidentDomainHelperShared,
      runtimeDomainMeta: RUNTIME_DOMAIN_META,
    },
  ) || incidentId).trim();
}

export function residentNotificationDomainLabel(item = {}) {
  const domainKey = String(item?.domain || "").trim().toLowerCase();
  if (!domainKey) return "Unknown domain";
  return String(
    RUNTIME_DOMAIN_META.labelByDomain.get(domainKey)
    || domainKey.replaceAll("_", " ").replaceAll("-", " "),
  ).trim() || "Unknown domain";
}

export function residentNotificationDomainMapMarker(item = {}) {
  const domainKey = String(item?.domain || "").trim().toLowerCase();
  const iconSrc = String(
    RUNTIME_DOMAIN_META.iconSrcByDomain.get(domainKey)
    || DOMAIN_MARKER_ICON_SRCS[domainKey]
    || ""
  ).trim();
  const markerColor = defaultMarkerColorForDomainShared(domainKey, {
    runtimeDomainMeta: RUNTIME_DOMAIN_META,
    getIncidentDomainHelper: getIncidentDomainHelperShared,
  });
  const iconPresentation = buildDomainMarkerIconPresentationShared(domainKey, markerColor, iconSrc);
  return {
    domainKey,
    iconSrc,
    markerColor,
    glyph: String(DOMAIN_MARKER_GLYPHS[domainKey] || "").trim(),
    glyphColor: String(iconPresentation?.glyphColor || "#111").trim() || "#111",
  };
}

function residentNotificationSortTimestamp(item = {}) {
  for (const value of [
    item?.sort_at,
    item?.updated_at,
    item?.published_at,
    item?.created_at,
  ]) {
    const timestamp = Date.parse(String(value || ""));
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return 0;
}

export async function fetchResidentNotificationsSnapshot({
  supabase,
  tenantFilter = null,
  communityFeedViewerKey = "",
  emptyMapCommunityFeedReadState,
  loadMapCommunityFeedReadState,
  isUnreadMapCommunityFeedItem,
  normalizeResidentNotificationKind,
}) {
  const normalizedTenantFilter = String(tenantFilter || "").trim().toLowerCase() || null;

  const incidentNotificationQuery = supabase
    .from("resident_incident_notifications")
    .select("id,tenant_key,incident_id,domain,previous_state,new_state,title,summary,created_at,read_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(250);
  if (normalizedTenantFilter) {
    incidentNotificationQuery.eq("tenant_key", normalizedTenantFilter);
  }

  const [feedRes, locationRes, incidentRes] = await Promise.all([
    supabase.rpc("list_resident_notifications", {
      p_tenant_filter: normalizedTenantFilter,
      p_limit: 250,
      p_offset: 0,
    }),
    supabase.rpc("list_resident_notification_location_counts"),
    incidentNotificationQuery,
  ]);

  const firstError = feedRes?.error || locationRes?.error || incidentRes?.error || null;
  if (firstError) throw firstError;

  // Location counts are sourced from tenant_profiles.display_name (with the
  // tenant name as fallback), so use them as the single display-name authority
  // for every notification kind, including report updates.
  const publicDisplayNameByTenant = new Map(
    (Array.isArray(locationRes?.data) ? locationRes.data : []).map((row) => [
      String(row?.tenant_key || "").trim().toLowerCase(),
      String(row?.tenant_label || "").trim(),
    ])
  );
  const publicDisplayNameForTenant = (tenantKeyRaw, fallback = "") => {
    const tenantKey = String(tenantKeyRaw || "").trim().toLowerCase();
    return String(publicDisplayNameByTenant.get(tenantKey) || fallback || tenantKey || "Location").trim() || "Location";
  };

  const localReadStateByTenant = new Map();
  const feedItems = (Array.isArray(feedRes?.data) ? feedRes.data : []).map((row) => {
    const tenantKey = String(row?.tenant_key || "").trim().toLowerCase();
    const kind = normalizeResidentNotificationKind(row?.kind);
    if (!localReadStateByTenant.has(tenantKey)) {
      localReadStateByTenant.set(tenantKey, loadMapCommunityFeedReadState(tenantKey, communityFeedViewerKey));
    }
    const localReadState = localReadStateByTenant.get(tenantKey) || emptyMapCommunityFeedReadState();
    const locallyUnread = isUnreadMapCommunityFeedItem(
      row,
      localReadState,
      kind === "event" ? "events" : "alerts",
    );
    return {
      ...row,
      tenant_key: tenantKey,
      tenant_label: publicDisplayNameForTenant(tenantKey, String(row?.tenant_label || "").trim()),
      tenant_primary_subdomain: String(row?.tenant_primary_subdomain || "").trim(),
      kind,
      topic_key: String(row?.topic_key || "").trim(),
      topic_label: String(row?.topic_label || row?.topic_key || "").trim(),
      title: String(row?.title || "").trim(),
      summary: String(row?.summary || "").trim(),
      body: String(row?.body || "").trim(),
      location_name: String(row?.location_name || "").trim(),
      location_address: String(row?.location_address || "").trim(),
      cta_label: String(row?.cta_label || "").trim(),
      cta_url: String(row?.cta_url || "").trim(),
      severity: String(row?.severity || "").trim(),
      pinned: Boolean(row?.pinned),
      unread: Boolean(row?.unread) && locallyUnread,
    };
  });
  // Preferences control delivery of future status updates. Once an update has
  // been created for a resident, it remains part of their inbox history;
  // querying one arbitrary tenant preference previously hid every report card.
  const incidentItems = (Array.isArray(incidentRes?.data) ? incidentRes.data : []).map((row) => {
    const tenantKey = String(row?.tenant_key || "").trim().toLowerCase();
    const baseItem = {
      tenant_key: tenantKey,
      tenant_label: publicDisplayNameForTenant(tenantKey),
      tenant_primary_subdomain: "",
      kind: "report_update",
      id: String(row?.id || "").trim(),
      topic_key: "",
      topic_label: "",
      title: String(row?.title || "Report status updated").trim(),
      summary: String(row?.summary || "").trim(),
      body: "",
      location_name: "",
      location_address: "",
      cta_label: "View My Reports",
      cta_url: "",
      severity: "",
      pinned: false,
      created_at: String(row?.created_at || "").trim(),
      updated_at: String(row?.created_at || "").trim(),
      published_at: String(row?.created_at || "").trim(),
      sort_at: String(row?.created_at || "").trim(),
      unread: !row?.read_at,
      incident_id: String(row?.incident_id || "").trim(),
      domain: String(row?.domain || "").trim(),
    };
    return {
      ...baseItem,
      incident_display_id: residentNotificationIncidentDisplayId(baseItem),
      domain_label: residentNotificationDomainLabel(baseItem),
    };
  });
  const nextItems = [...feedItems, ...incidentItems]
    .sort((a, b) => {
      const timestampDifference = residentNotificationSortTimestamp(b) - residentNotificationSortTimestamp(a);
      if (timestampDifference) return timestampDifference;
      // Keep a deterministic newest-first order if two notifications share a
      // timestamp (common with imported/queued communication records).
      return String(b?.id || "").localeCompare(String(a?.id || ""), undefined, { numeric: true });
    });

  const locationMetaByTenant = new Map(
    (Array.isArray(locationRes?.data) ? locationRes.data : []).map((row) => {
      const tenantKey = String(row?.tenant_key || "").trim().toLowerCase();
      return [tenantKey, {
        tenantKey,
        label: String(row?.tenant_label || row?.tenant_key || "").trim(),
        subLabel: String(row?.tenant_primary_subdomain || "").trim(),
        unreadCount: 0,
        itemCount: 0,
        latestSortAt: String(row?.latest_sort_at || "").trim(),
      }];
    })
  );

  for (const item of nextItems) {
    const tenantKey = String(item?.tenant_key || "").trim().toLowerCase();
    if (!tenantKey) continue;
    const existing = locationMetaByTenant.get(tenantKey) || {
      tenantKey,
      label: String(item?.tenant_label || tenantKey).trim(),
      subLabel: String(item?.tenant_primary_subdomain || "").trim(),
      unreadCount: 0,
      itemCount: 0,
      latestSortAt: "",
    };
    existing.itemCount = Math.max(0, Number(existing.itemCount || 0), 0) + 1;
    if (item?.unread) {
      existing.unreadCount = Math.max(0, Number(existing.unreadCount || 0)) + 1;
    }
    const itemSortAt = String(item?.sort_at || item?.updated_at || item?.published_at || item?.created_at || "").trim();
    if (itemSortAt && (!existing.latestSortAt || new Date(itemSortAt).getTime() > new Date(existing.latestSortAt).getTime())) {
      existing.latestSortAt = itemSortAt;
    }
    locationMetaByTenant.set(tenantKey, existing);
  }

  const nextLocations = Array.from(locationMetaByTenant.values())
    .sort((a, b) => {
      const aTs = Number(new Date(a?.latestSortAt || 0).getTime() || 0);
      const bTs = Number(new Date(b?.latestSortAt || 0).getTime() || 0);
      return bTs - aTs;
    });

  return {
    items: nextItems,
    locations: nextLocations,
  };
}
