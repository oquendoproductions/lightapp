export const MAP_UI_ICON_PUBLISHED_CONFIG_KEY = "public_map_ui_icons_published";

export const MAP_UI_ICON_RENDER_MODE = Object.freeze({
  TINTABLE_SVG: "tintable_svg",
  FULL_COLOR_SVG: "full_color_svg",
  RASTER: "raster",
});

function svgDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(String(svg || "").trim())}`;
}

const DEFAULT_CURRENT_LOCATION_MARKER_SRC = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="rgba(5,16,30,0.28)"/></filter></defs><circle cx="18" cy="18" r="11" fill="#1976d2" stroke="#ffffff" stroke-width="4" filter="url(#shadow)"/></svg>
`);

const DEFAULT_NAVIGATION_LOCATION_MARKER_SRC = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 36 36"><path d="M18 1 L26 15.5 L18 11.2 L10 15.5 Z" fill="rgba(8,18,32,0.22)" stroke="rgba(255,255,255,0.96)" stroke-width="1.8"/><path d="M18 3.8 L22.7 12.4 L18 10.5 L13.3 12.4 Z" fill="#071a2f" stroke="rgba(255,255,255,0.98)" stroke-width="1.25"/><circle cx="18" cy="12.8" r="1.35" fill="#7fd7ff" stroke="#ffffff" stroke-width="0.7"/></svg>
`);

const MAP_TOOL_ICON_BASE = "/Icons/Map Tools";
const BUTTON_ICON_BASE = "/Icons/Buttons";
const INCIDENT_LAYER_ICON_SRC = `${MAP_TOOL_ICON_BASE}/incident_driven_map_layer_button.png`;
const INFO_ICON_SRC = "/info_icon.png";
const LOCATION_ICON_SRC = "/location_icon.png";
const WARNING_SIGN_ICON_SRC = "/street_sign_icons/warning_sign_icon.png";

const DEFAULT_UI_ICON_ROWS = Object.freeze([
  ["account", "/account_icon.png"],
  ["streetlight", "/streetlight_icon.png"],
  ["streetSign", "/street_sign_icons/street_sign_domain_icon.png"],
  ["pothole", "/pothole_icon.png"],
  ["powerOutage", "/power_outage_icon.png"],
  ["waterMain", "/water_main_icon.png"],
  ["filter", "/filter_icon.png"],
  ["utilityReportReference", `${BUTTON_ICON_BASE}/edit_button/edit_button_blue_icon.png`],
  ["allLocations", LOCATION_ICON_SRC],
  ["openReports", "/open_reports_icon.png"],
  ["mapping", "/streetlight_mapping_icon.png"],
  ["bulk", "/bulk_reporting_icon.png"],
  ["toolbox", "/toolbox_icon.png"],
  ["headingReset", "/heading_reset_icon.png"],
  ["info", INFO_ICON_SRC],
  ["location", LOCATION_ICON_SRC],
  ["homeRecenter", `${MAP_TOOL_ICON_BASE}/home_recenter_button.png`],
  ["navigationArrow", `${MAP_TOOL_ICON_BASE}/navigation_arrow_icon.png`],
  ["domainSelector", INCIDENT_LAYER_ICON_SRC],
  ["incidentReportingLayer", INCIDENT_LAYER_ICON_SRC],
  ["allIncidentReports", INCIDENT_LAYER_ICON_SRC],
  ["mapTab", `${BUTTON_ICON_BASE}/tab_buttons/map_tab_icon.png`],
  ["notifications", INCIDENT_LAYER_ICON_SRC],
  ["calendar", "/calendar_icon.png"],
  ["notification", "/notification_icon.png"],
  ["satellite", "/satellite_icon.png"],
  ["streetMap", "/street_map_icon.png"],
  ["noticeInfo", INFO_ICON_SRC],
  ["noticeWarning", WARNING_SIGN_ICON_SRC],
  ["noticeSuccess", INFO_ICON_SRC],
  ["noticeZoom", WARNING_SIGN_ICON_SRC],
  ["noticeLoading", INFO_ICON_SRC],
  ["currentLocationMarker", DEFAULT_CURRENT_LOCATION_MARKER_SRC],
  ["navigationLocationMarker", DEFAULT_NAVIGATION_LOCATION_MARKER_SRC],
]);

export const DEFAULT_UI_ICON_SRC = Object.freeze(Object.fromEntries(DEFAULT_UI_ICON_ROWS));

function buildRuntimeUiIconSrc(iconMeta = {}) {
  return Object.fromEntries(
    Object.entries(iconMeta).map(([key, value]) => [key, String(value?.src || "").trim()])
  );
}

function buildRuntimeUiIconRenderModeBySrc(iconMeta = {}) {
  return new Map(
    Object.values(iconMeta)
      .map((value) => [String(value?.src || "").trim(), String(value?.render_mode || "").trim()])
      .filter(([src, renderMode]) => src && renderMode)
  );
}

function buildRuntimeUiIconPrimaryKeyBySrc(iconMeta = {}) {
  return new Map(
    Object.entries(iconMeta)
      .map(([key, value]) => [String(value?.src || "").trim(), key])
      .filter(([src]) => src)
  );
}

export function inferMapUiIconRenderMode(src = "") {
  const value = String(src || "").trim();
  if (/\.svg(?:[?#].*)?$/i.test(value)) return MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG;
  return MAP_UI_ICON_RENDER_MODE.RASTER;
}

export function normalizeMapUiIconRenderMode(value, fallbackSrc = "") {
  const key = String(value || "").trim().toLowerCase();
  if (key === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG) return MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG;
  if (key === MAP_UI_ICON_RENDER_MODE.FULL_COLOR_SVG) return MAP_UI_ICON_RENDER_MODE.FULL_COLOR_SVG;
  if (key === MAP_UI_ICON_RENDER_MODE.RASTER) return MAP_UI_ICON_RENDER_MODE.RASTER;
  return inferMapUiIconRenderMode(fallbackSrc);
}

export const DEFAULT_UI_ICON_META = Object.freeze(
  Object.fromEntries(
    Object.entries(DEFAULT_UI_ICON_SRC).map(([key, src]) => [
      key,
      {
        src,
        render_mode: inferMapUiIconRenderMode(src),
        light_tint_color: "",
        dark_tint_color: "",
        enabled: true,
      },
    ])
  )
);

function mergeResolvedRuntimeUiIconMeta(overrides = {}) {
  return {
    ...DEFAULT_UI_ICON_META,
    ...(overrides && typeof overrides === "object" ? overrides : {}),
  };
}

export let RUNTIME_UI_ICON_META = mergeResolvedRuntimeUiIconMeta({});
export let RUNTIME_UI_ICON_SRC = buildRuntimeUiIconSrc(RUNTIME_UI_ICON_META);
export let RUNTIME_UI_ICON_RENDER_MODE_BY_SRC = buildRuntimeUiIconRenderModeBySrc(RUNTIME_UI_ICON_META);
export let RUNTIME_UI_ICON_PRIMARY_KEY_BY_SRC = buildRuntimeUiIconPrimaryKeyBySrc(RUNTIME_UI_ICON_META);

export function setResolvedRuntimeUiIconMetaState(rawMeta) {
  RUNTIME_UI_ICON_META = mergeResolvedRuntimeUiIconMeta(rawMeta);
  RUNTIME_UI_ICON_SRC = buildRuntimeUiIconSrc(RUNTIME_UI_ICON_META);
  RUNTIME_UI_ICON_RENDER_MODE_BY_SRC = buildRuntimeUiIconRenderModeBySrc(RUNTIME_UI_ICON_META);
  RUNTIME_UI_ICON_PRIMARY_KEY_BY_SRC = buildRuntimeUiIconPrimaryKeyBySrc(RUNTIME_UI_ICON_META);
}

function isTintableSvgIconSrc(src = "") {
  const value = String(src || "").trim();
  if (value.startsWith("data:image/svg+xml")) return true;
  return /\.svg(?:[?#].*)?$/i.test(value);
}

export function resolveRuntimeUiIconRenderMode(src = "", explicitRenderMode = "") {
  const iconSrc = String(src || "").trim();
  const requestedMode = String(explicitRenderMode || "").trim().toLowerCase();
  if (requestedMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG) return MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG;
  if (requestedMode === MAP_UI_ICON_RENDER_MODE.FULL_COLOR_SVG) return MAP_UI_ICON_RENDER_MODE.FULL_COLOR_SVG;
  if (requestedMode === MAP_UI_ICON_RENDER_MODE.RASTER) return MAP_UI_ICON_RENDER_MODE.RASTER;
  const runtimeMode = String(RUNTIME_UI_ICON_RENDER_MODE_BY_SRC.get(iconSrc) || "").trim().toLowerCase();
  if (runtimeMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG) return MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG;
  if (runtimeMode === MAP_UI_ICON_RENDER_MODE.FULL_COLOR_SVG) return MAP_UI_ICON_RENDER_MODE.FULL_COLOR_SVG;
  if (runtimeMode === MAP_UI_ICON_RENDER_MODE.RASTER) return MAP_UI_ICON_RENDER_MODE.RASTER;
  return isTintableSvgIconSrc(iconSrc) ? MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG : MAP_UI_ICON_RENDER_MODE.RASTER;
}

export function resolveRuntimeUiIconThemeMeta(iconKey = "", src = "") {
  const directKey = String(iconKey || "").trim();
  if (directKey && RUNTIME_UI_ICON_META?.[directKey]) return RUNTIME_UI_ICON_META[directKey];
  const iconSrc = String(src || "").trim();
  const fallbackKey = String(RUNTIME_UI_ICON_PRIMARY_KEY_BY_SRC.get(iconSrc) || "").trim();
  return fallbackKey ? RUNTIME_UI_ICON_META?.[fallbackKey] || null : null;
}

export function isRuntimeUiIconEnabled(iconKey = "", src = "") {
  const themedMeta = resolveRuntimeUiIconThemeMeta(iconKey, src);
  return themedMeta?.enabled !== false;
}
