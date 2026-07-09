export {
  dedupeIncidentMarkerRenderSourceShared,
  incidentMarkerDedupKeyShared,
  mergeIncidentMarkerRowsShared,
} from "./mapIncidentMarkerSourceSupport.js";

const incidentMarkerRenderItemCacheShared = new WeakMap();

function readCachedIncidentMarkerRenderItemShared(marker, signature, buildItem) {
  if (!marker || typeof marker !== "object") return buildItem();
  const cached = incidentMarkerRenderItemCacheShared.get(marker);
  if (cached?.signature === signature && cached?.item) return cached.item;
  const item = buildItem();
  incidentMarkerRenderItemCacheShared.set(marker, { signature, item });
  return item;
}

export function buildIncidentMarkerRenderItemShared(marker, deps = {}) {
  if (!marker || typeof marker !== "object") return null;
  const {
    adminDomainMetaIcon = "",
    adminDomainMetaIconSrc = "",
    adminReportDomain = "",
    defaultMarkerColorForDomain = () => "",
    defaultMarkerGlyphForDomain = () => "",
    defaultMarkerGlyphSrcForDomain = () => "",
    domainMarkerColor = "",
    fallbackIconSrc = "",
    gmapsCountBadgeIcon = () => null,
    gmapsDotIcon = () => null,
    normalizeDomainKeyOrSlug = (value) => String(value || "").trim().toLowerCase(),
    resolveDomainMarkerIconPresentation = () => null,
    resolveVisibleDomainIconSrc = (_, value) => value,
  } = deps;

  if (marker?.kind === "incident_cluster") {
    const count = Number(marker?.count || 0);
    const signature = `cluster|${String(marker?.id || "")}|${count}|${Number(marker?.lat || 0)}|${Number(marker?.lng || 0)}`;
    return readCachedIncidentMarkerRenderItemShared(marker, signature, () => ({
      ...marker,
      markerIcon: gmapsCountBadgeIcon(count, { fill: "#17314f", ring: "#ffffff", size: 36 }),
    }));
  }

  if (marker?.kind === "incident_stack") {
    const count = Number(marker?.count || 0);
    const signature = `stack|${String(marker?.id || "")}|${count}|${Number(marker?.lat || 0)}|${Number(marker?.lng || 0)}`;
    return readCachedIncidentMarkerRenderItemShared(marker, signature, () => ({
      ...marker,
      markerIcon: gmapsCountBadgeIcon(count, { fill: "#2a7262", ring: "#ffffff", size: 34 }),
    }));
  }

  const markerDomainKey = normalizeDomainKeyOrSlug(
    String(marker?.domain || adminReportDomain),
    { allowUnknown: true }
  ) || String(marker?.domain || adminReportDomain);
  const resolvedMarkerColor =
    marker?.color || defaultMarkerColorForDomain(String(marker?.domain || adminReportDomain).trim().toLowerCase()) || domainMarkerColor;
  const resolvedGlyphSrc =
    marker?.glyphSrc || resolveVisibleDomainIconSrc(
      markerDomainKey,
      defaultMarkerGlyphSrcForDomain(markerDomainKey, adminDomainMetaIconSrc || fallbackIconSrc)
    );
  const glyph = marker?.glyph || defaultMarkerGlyphForDomain(markerDomainKey, {
    signType: marker?.sign_type,
    fallback: adminDomainMetaIcon || "💡",
  });
  const highConfidence = marker?.highConfidence === true;
  const ringColor = marker?.ringColor || "#fff";
  const markerIconPresentation = resolveDomainMarkerIconPresentation(
    markerDomainKey,
    resolvedMarkerColor,
    resolvedGlyphSrc,
    { highConfidence }
  );
  const signature = [
    "dot",
    String(marker?.id || ""),
    markerDomainKey,
    resolvedMarkerColor,
    ringColor,
    String(glyph || ""),
    String(resolvedGlyphSrc || ""),
    highConfidence ? "1" : "0",
    Number(marker?.count || 0),
    Number(marker?.lastTs || 0),
    Number(marker?.lat || 0),
    Number(marker?.lng || 0),
  ].join("|");

  return readCachedIncidentMarkerRenderItemShared(marker, signature, () => ({
    ...marker,
    markerIcon: gmapsDotIcon(
      resolvedMarkerColor,
      ringColor,
      glyph,
      resolvedGlyphSrc,
      markerIconPresentation
    ),
  }));
}

export function buildIncidentMarkerRenderItemsShared(markers = [], deps = {}) {
  const items = [];
  for (const marker of Array.isArray(markers) ? markers : []) {
    const item = buildIncidentMarkerRenderItemShared(marker, deps);
    if (item) items.push(item);
  }
  return items;
}
