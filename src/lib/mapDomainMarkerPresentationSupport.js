import { RUNTIME_DOMAIN_META } from "./mapRuntimeDomainMeta";
import { normalizeDomainKeyOrSlug } from "./mapReportParsingCoreSupport.js";
import {
  DOMAIN_ICON_TINT_MODE,
  normalizeDomainIconRenderMode,
  normalizeDomainIconTintColor,
  normalizeDomainIconTintMode,
  resolveDomainMarkerIconTintColor,
} from "../domainIconRendering";

function resolveRuntimeDomainIconRenderModeLocal(domainKeyRaw, iconSrc = "") {
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const explicit = key ? String(RUNTIME_DOMAIN_META.iconRenderModeByDomain.get(key) || "").trim() : "";
  return normalizeDomainIconRenderMode(explicit, iconSrc);
}

function resolveRuntimeDomainIconTintModeLocal(domainKeyRaw) {
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const explicit = key ? String(RUNTIME_DOMAIN_META.iconTintModeByDomain.get(key) || "").trim() : "";
  return normalizeDomainIconTintMode(explicit || DOMAIN_ICON_TINT_MODE.DEFAULT);
}

function resolveRuntimeDomainIconTintColorLocal(domainKeyRaw) {
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const explicit = key ? String(RUNTIME_DOMAIN_META.iconTintColorByDomain.get(key) || "").trim() : "";
  return normalizeDomainIconTintColor(explicit, "");
}

function resolveRuntimeHighConfidenceDomainIconTintModeLocal(domainKeyRaw) {
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const explicit = key ? String(RUNTIME_DOMAIN_META.highConfidenceIconTintModeByDomain.get(key) || "").trim() : "";
  if (!explicit) return resolveRuntimeDomainIconTintModeLocal(domainKeyRaw);
  return normalizeDomainIconTintMode(explicit);
}

function resolveRuntimeHighConfidenceDomainIconTintColorLocal(domainKeyRaw) {
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const explicit = key ? String(RUNTIME_DOMAIN_META.highConfidenceIconTintColorByDomain.get(key) || "").trim() : "";
  if (!explicit) return resolveRuntimeDomainIconTintColorLocal(domainKeyRaw);
  return normalizeDomainIconTintColor(explicit, "");
}

export function buildDomainMarkerIconPresentationShared(domainKeyRaw, markerColor = "", iconSrc = "", options = {}) {
  const highConfidence = options?.highConfidence === true;
  const renderMode = resolveRuntimeDomainIconRenderModeLocal(domainKeyRaw, iconSrc);
  const tintMode = highConfidence
    ? resolveRuntimeHighConfidenceDomainIconTintModeLocal(domainKeyRaw)
    : resolveRuntimeDomainIconTintModeLocal(domainKeyRaw);
  const tintColor = highConfidence
    ? resolveRuntimeHighConfidenceDomainIconTintColorLocal(domainKeyRaw)
    : resolveRuntimeDomainIconTintColorLocal(domainKeyRaw);

  return {
    renderMode,
    tintMode,
    tintColor,
    highConfidence,
    glyphColor: resolveDomainMarkerIconTintColor({
      renderMode,
      tintMode,
      tintColor,
      markerColor,
    }),
  };
}
