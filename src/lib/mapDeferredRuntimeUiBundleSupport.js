import { MAP_UI_ICON_RENDER_MODE } from "../mapUiIconRuntimeSupport.js";

const MAP_UI_ICON_MANIFEST_CACHE_KEY = "cityreport.public_map_ui_bundle.v2";

export function readCachedRuntimeUiIconManifestShared() {
  if (typeof window === "undefined") return null;
  try {
    const raw = String(window.localStorage.getItem(MAP_UI_ICON_MANIFEST_CACHE_KEY) || "").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCachedRuntimeUiIconManifestShared(raw) {
  if (typeof window === "undefined") return;
  try {
    if (!raw || typeof raw !== "object") {
      window.localStorage.removeItem(MAP_UI_ICON_MANIFEST_CACHE_KEY);
      return;
    }
    window.localStorage.setItem(MAP_UI_ICON_MANIFEST_CACHE_KEY, JSON.stringify(raw));
  } catch {
    // Ignore cache write failures.
  }
}

export function clearCachedRuntimeUiIconManifestShared() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(MAP_UI_ICON_MANIFEST_CACHE_KEY);
  } catch {
    // Ignore cache clear failures.
  }
}

function isTintableSvgIconSrc(src) {
  const value = String(src || "").trim();
  if (value.startsWith("data:image/svg+xml")) return true;
  return /\.svg(?:[?#].*)?$/i.test(value);
}

function sanitizeInlineSvgMarkup(markup = "") {
  const raw = String(markup || "");
  if (!raw) return "";
  const stripped = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!doctype[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  const match = stripped.match(/<svg[\s\S]*<\/svg>/i);
  return String(match?.[0] || "").trim();
}

function svgMarkupToDataUrl(markup = "") {
  const svg = sanitizeInlineSvgMarkup(markup);
  if (!svg) return "";
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

async function normalizePublishedMapUiIconManifest(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const cloned = JSON.parse(JSON.stringify(raw));
  const icons = cloned?.icons && typeof cloned.icons === "object" ? cloned.icons : {};
  const entries = Object.entries(icons);
  if (!entries.length || typeof fetch !== "function") return cloned;

  await Promise.all(entries.map(async ([, meta]) => {
    if (!meta || typeof meta !== "object") return;
    const src = String(meta?.src || "").trim();
    const renderMode = String(meta?.render_mode || "").trim().toLowerCase();
    const shouldInline =
      renderMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG
      || (renderMode === "" && isTintableSvgIconSrc(src));
    if (!shouldInline || !src || src.startsWith("data:image/svg+xml")) return;
    try {
      const response = await fetch(src, { method: "GET", mode: "cors", credentials: "omit" });
      if (!response.ok) return;
      const markup = await response.text();
      const dataUrl = svgMarkupToDataUrl(markup);
      if (!dataUrl) return;
      meta.src = dataUrl;
    } catch {
      // Keep the original source if the inline normalization request fails.
    }
  }));

  return cloned;
}

export async function loadPublishedMapUiBundleShared({
  supabase,
  iconConfigKey,
  themeConfigKey,
  preferCacheOnError = true,
  readCachedRuntimeUiIconManifest,
  writeCachedRuntimeUiIconManifest,
  clearCachedRuntimeUiIconManifest,
  setRuntimeUiIconManifest,
  setDomainIconRenderTick,
  setMapUiThemeRenderTick,
}) {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("key,value")
      .in("key", [iconConfigKey, themeConfigKey]);
    if (error) {
      clearCachedRuntimeUiIconManifest();
      setRuntimeUiIconManifest({}, {});
      setDomainIconRenderTick((tick) => tick + 1);
      return;
    }
    const rows = Array.isArray(data) ? data : [];
    const iconRow = rows.find((row) => String(row?.key || "").trim() === iconConfigKey) || null;
    const themeRow = rows.find((row) => String(row?.key || "").trim() === themeConfigKey) || null;
    const iconValue = iconRow?.value && typeof iconRow.value === "object" ? iconRow.value : {};
    const themeValue = themeRow?.value && typeof themeRow.value === "object" ? themeRow.value : iconValue;
    if (!Object.keys(iconValue || {}).length && !Object.keys(themeValue || {}).length) {
      clearCachedRuntimeUiIconManifest();
      setRuntimeUiIconManifest({}, {});
      setDomainIconRenderTick((tick) => tick + 1);
      return;
    }
    const normalizedValue = await normalizePublishedMapUiIconManifest(iconValue);
    const runtimeBundle = {
      icon_bundle: iconValue,
      icons: normalizedValue,
      theme_bundle: themeValue,
    };
    writeCachedRuntimeUiIconManifest(runtimeBundle);
    setRuntimeUiIconManifest(runtimeBundle.icon_bundle, runtimeBundle.theme_bundle);
    setDomainIconRenderTick((tick) => tick + 1);
    setMapUiThemeRenderTick((tick) => tick + 1);
  } catch {
    if (!preferCacheOnError) {
      setRuntimeUiIconManifest({}, {});
      setDomainIconRenderTick((tick) => tick + 1);
      setMapUiThemeRenderTick((tick) => tick + 1);
      return;
    }
    const cachedValue = readCachedRuntimeUiIconManifest();
    if (cachedValue) {
      setRuntimeUiIconManifest(
        cachedValue?.icon_bundle || cachedValue?.icons || cachedValue,
        cachedValue?.theme_bundle || cachedValue
      );
      setDomainIconRenderTick((tick) => tick + 1);
      setMapUiThemeRenderTick((tick) => tick + 1);
      return;
    }
    setRuntimeUiIconManifest({}, {});
    setDomainIconRenderTick((tick) => tick + 1);
    setMapUiThemeRenderTick((tick) => tick + 1);
  }
}

export async function loadPublishedMapUiBundleRuntimeShared({
  supabase,
  preferCacheOnError = true,
  iconConfigKey,
  themeConfigKey,
  readCachedRuntimeUiIconManifest,
  writeCachedRuntimeUiIconManifest,
  clearCachedRuntimeUiIconManifest,
  setRuntimeUiIconManifest,
  setDomainIconRenderTick,
  setMapUiThemeRenderTick,
}) {
  return loadPublishedMapUiBundleShared({
    supabase,
    iconConfigKey,
    themeConfigKey,
    preferCacheOnError,
    readCachedRuntimeUiIconManifest,
    writeCachedRuntimeUiIconManifest,
    clearCachedRuntimeUiIconManifest,
    setRuntimeUiIconManifest,
    setDomainIconRenderTick,
    setMapUiThemeRenderTick,
  });
}
