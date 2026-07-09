import React from "react";

import { normalizeDomainIconRenderMode } from "./domainIconRendering";
import { AppIcon } from "./mapUiIconComponentsSupport.jsx";
import { RUNTIME_DOMAIN_META } from "./lib/mapRuntimeDomainMeta";
import { normalizeDomainKeyOrSlug } from "./lib/mapReportParsingSupport.js";

export function resolveRuntimeDomainIconRenderMode(domainKeyRaw, iconSrc = "") {
  const key = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const explicit = key ? String(RUNTIME_DOMAIN_META.iconRenderModeByDomain.get(key) || "").trim() : "";
  return normalizeDomainIconRenderMode(explicit, iconSrc);
}

export function DomainAppIcon({
  domainKey = "",
  src,
  alt = "",
  size = 18,
  style = {},
}) {
  const iconSrc = String(src || "").trim();
  const renderMode = resolveRuntimeDomainIconRenderMode(domainKey, iconSrc);
  return (
    <AppIcon
      src={iconSrc}
      alt={alt}
      size={size}
      style={style}
      renderMode={renderMode}
    />
  );
}

export function DomainSelectorListIcon({
  domainKey = "",
  src = "",
  size = 18,
  containerSize = null,
}) {
  const resolvedContainerSize = Number.isFinite(Number(containerSize)) ? Number(containerSize) : size;
  return (
    <span
      style={{
        width: resolvedContainerSize,
        height: resolvedContainerSize,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "currentColor",
        flexShrink: 0,
      }}
    >
      <DomainAppIcon
        domainKey={domainKey}
        src={src}
        size={size}
        style={{ color: "currentColor" }}
      />
    </span>
  );
}
