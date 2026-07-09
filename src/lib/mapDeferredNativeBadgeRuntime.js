export async function syncNativeBadgeCountRuntimeShared(
  unreadCount,
  {
    loadCapacitorBadgeModule,
    shouldCancel = () => false,
    logger = console,
  } = {},
) {
  if (typeof loadCapacitorBadgeModule !== "function") return;
  try {
    const { Badge } = await loadCapacitorBadgeModule();
    const supported = await Badge.isSupported();
    if (shouldCancel() || !supported?.isSupported) return;
    const nextCount = Math.max(0, Number(unreadCount || 0));
    if (nextCount > 0) {
      await Badge.set({ count: nextCount });
    } else {
      await Badge.clear();
    }
  } catch (error) {
    if (!shouldCancel()) {
      logger?.warn?.("[native badge]", error?.message || error);
    }
  }
}
