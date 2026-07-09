export {
  DEFAULT_UI_ICON_META,
  DEFAULT_UI_ICON_SRC,
  MAP_UI_ICON_PUBLISHED_CONFIG_KEY,
  MAP_UI_ICON_RENDER_MODE,
  RUNTIME_UI_ICON_META,
  RUNTIME_UI_ICON_PRIMARY_KEY_BY_SRC,
  RUNTIME_UI_ICON_RENDER_MODE_BY_SRC,
  RUNTIME_UI_ICON_SRC,
  inferMapUiIconRenderMode,
  isRuntimeUiIconEnabled,
  normalizeMapUiIconRenderMode,
  resolveRuntimeUiIconRenderMode,
  resolveRuntimeUiIconThemeMeta,
  setResolvedRuntimeUiIconMetaState,
} from "./mapUiIconRuntimeCoreSupport.js";

import {
  DEFAULT_UI_ICON_META,
  inferMapUiIconRenderMode,
  normalizeMapUiIconRenderMode,
  setResolvedRuntimeUiIconMetaState,
} from "./mapUiIconRuntimeCoreSupport.js";

function sanitizeMapUiIconTintColor(value, fallback = "") {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(candidate)) {
    return candidate.length === 4
      ? `#${candidate[1]}${candidate[1]}${candidate[2]}${candidate[2]}${candidate[3]}${candidate[3]}`.toLowerCase()
      : candidate.toLowerCase();
  }
  const normalizedFallback = String(fallback || "").trim();
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedFallback)) {
    return normalizedFallback.length === 4
      ? `#${normalizedFallback[1]}${normalizedFallback[1]}${normalizedFallback[2]}${normalizedFallback[2]}${normalizedFallback[3]}${normalizedFallback[3]}`.toLowerCase()
      : normalizedFallback.toLowerCase();
  }
  return "";
}

export function sanitizeMapUiIconManifest(raw) {
  const source = raw && typeof raw === "object" && raw.icons && typeof raw.icons === "object"
    ? raw.icons
    : raw;
  const next = {};
  for (const key of Object.keys(DEFAULT_UI_ICON_META)) {
    const current = source?.[key];
    if (typeof current === "string") {
      const src = String(current || "").trim();
      if (!src) continue;
      next[key] = {
        src,
        render_mode: inferMapUiIconRenderMode(src),
        light_tint_color: "",
        dark_tint_color: "",
        enabled: true,
      };
      continue;
    }
    const src = String(current?.src || "").trim();
    if (!src) continue;
    next[key] = {
      src,
      render_mode: normalizeMapUiIconRenderMode(current?.render_mode, src),
      light_tint_color: sanitizeMapUiIconTintColor(current?.light_tint_color),
      dark_tint_color: sanitizeMapUiIconTintColor(current?.dark_tint_color),
      enabled: current?.enabled !== false,
    };
  }
  return next;
}

export function mergeMapUiIconMeta(raw) {
  return {
    ...DEFAULT_UI_ICON_META,
    ...sanitizeMapUiIconManifest(raw),
  };
}

export function setRuntimeUiIconManifestState(rawIcons) {
  setResolvedRuntimeUiIconMetaState(sanitizeMapUiIconManifest(rawIcons));
}
