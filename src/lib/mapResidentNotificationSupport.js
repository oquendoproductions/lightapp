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

  const [feedRes, locationRes] = await Promise.all([
    supabase.rpc("list_resident_notifications", {
      p_tenant_filter: normalizedTenantFilter,
      p_limit: 250,
      p_offset: 0,
    }),
    supabase.rpc("list_resident_notification_location_counts"),
  ]);

  const firstError = feedRes?.error || locationRes?.error || null;
  if (firstError) throw firstError;

  const localReadStateByTenant = new Map();
  const nextItems = (Array.isArray(feedRes?.data) ? feedRes.data : []).map((row) => {
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
      tenant_label: String(row?.tenant_label || row?.tenant_key || "").trim(),
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
