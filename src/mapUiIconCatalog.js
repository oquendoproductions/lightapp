export const MAP_UI_ICON_PUBLISHED_CONFIG_KEY = "public_map_ui_icons_published";
export const MAP_UI_ICON_DRAFT_CONFIG_KEY = "platform_map_ui_icons_draft";
export const MAP_UI_ICON_BUCKET = "domain-icons";
export const MAP_UI_ICON_ACCEPT = ".svg,.png,.webp,image/svg+xml,image/png,image/webp";
export const MAP_UI_ICON_MAX_BYTES = 2 * 1024 * 1024;

export const MAP_UI_ICON_RENDER_MODE = Object.freeze({
  TINTABLE_SVG: "tintable_svg",
  FULL_COLOR_SVG: "full_color_svg",
  RASTER: "raster",
});

export const MAP_UI_ICON_RENDER_MODE_OPTIONS = Object.freeze([
  {
    key: MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG,
    label: "Tintable SVG",
    description: "Best for monochrome SVG icons that should automatically adapt to light and dark mode.",
  },
  {
    key: MAP_UI_ICON_RENDER_MODE.FULL_COLOR_SVG,
    label: "Full-Color SVG",
    description: "Best for multi-color SVG icons that should render exactly as designed.",
  },
  {
    key: MAP_UI_ICON_RENDER_MODE.RASTER,
    label: "Raster / As-Is",
    description: "Best for PNG, WebP, or any icon that should render without tinting.",
  },
]);

export const MAP_UI_ICON_THEME_DEFAULTS = Object.freeze({
  light: Object.freeze({
    surface_bg: "rgba(255,255,255,0.96)",
    surface_border: "rgba(0,0,0,0.10)",
    surface_text: "#111111",
    header_bg_primary: "rgba(236,245,255,0.93)",
    header_bg_secondary: "rgba(221,239,233,0.90)",
    header_border: "rgba(23,49,79,0.08)",
    header_text: "#102b46",
    header_eyebrow: "#13856e",
    header_menu_bg: "rgba(255,255,255,0.92)",
    header_menu_border: "rgba(26,49,83,0.22)",
    modal_bg: "rgba(255,255,255,0.98)",
    modal_border: "rgba(0,0,0,0.12)",
    modal_input_bg: "#ffffff",
    modal_input_border: "#dddddd",
    modal_secondary_bg: "#ffffff",
    modal_secondary_border: "rgba(0,0,0,0.18)",
    modal_secondary_text: "#111111",
    modal_filled_bg: "#111111",
    modal_filled_text: "#ffffff",
    modal_subtle_bg: "rgba(0,0,0,0.02)",
    feed_card_bg: "rgba(251,253,255,0.98)",
    feed_card_border: "rgba(23,49,79,0.08)",
    feed_muted_text: "#58718a",
    feed_badge_bg: "rgba(17, 61, 95, 0.08)",
    feed_badge_border: "rgba(17, 61, 95, 0.12)",
    feed_badge_text: "#113d5f",
    feed_new_badge_bg: "rgba(28, 169, 118, 0.12)",
    feed_new_badge_border: "rgba(28, 169, 118, 0.18)",
    feed_new_badge_text: "#13684d",
    feed_alert_info_bg: "rgba(30, 136, 229, 0.10)",
    feed_alert_info_border: "rgba(30, 136, 229, 0.16)",
    feed_alert_info_text: "#1b6fb4",
    feed_alert_advisory_bg: "rgba(245, 190, 28, 0.12)",
    feed_alert_advisory_border: "rgba(245, 190, 28, 0.18)",
    feed_alert_advisory_text: "#8c6a00",
    feed_alert_urgent_bg: "rgba(239, 108, 0, 0.10)",
    feed_alert_urgent_border: "rgba(239, 108, 0, 0.16)",
    feed_alert_urgent_text: "#b25600",
    feed_alert_emergency_bg: "rgba(183, 28, 28, 0.10)",
    feed_alert_emergency_border: "rgba(183, 28, 28, 0.16)",
    feed_alert_emergency_text: "#8f1d1d",
    feed_status_published_bg: "rgba(22, 109, 120, 0.09)",
    feed_status_published_border: "rgba(22, 109, 120, 0.15)",
    feed_status_published_text: "#176d78",
    feed_status_scheduled_bg: "rgba(37, 99, 235, 0.10)",
    feed_status_scheduled_border: "rgba(37, 99, 235, 0.16)",
    feed_status_scheduled_text: "#1d4ed8",
    feed_status_archived_bg: "rgba(107, 114, 128, 0.10)",
    feed_status_archived_border: "rgba(107, 114, 128, 0.16)",
    feed_status_archived_text: "#4b5563",
    feed_status_draft_bg: "rgba(245, 190, 28, 0.13)",
    feed_status_draft_border: "rgba(245, 190, 28, 0.20)",
    feed_status_draft_text: "#7a5a00",
    contact_tile_bg: "rgba(247,251,255,0.98)",
    contact_tile_border: "rgba(23, 49, 79, 0.12)",
    tool_button_bg: "rgba(255,255,255,0.96)",
    tool_button_border: "rgba(0,0,0,0.34)",
    tool_button_text: "#111111",
    tool_active_bg: "#2a7262",
    tool_active_border: "#2a7262",
    tool_active_text: "#ffffff",
  }),
  dark: Object.freeze({
    surface_bg: "rgba(28,31,35,0.94)",
    surface_border: "rgba(255,255,255,0.12)",
    surface_text: "#f3f5f7",
    header_bg_primary: "rgba(17,27,40,0.94)",
    header_bg_secondary: "rgba(20,39,49,0.92)",
    header_border: "rgba(143,170,198,0.24)",
    header_text: "#edf6ff",
    header_eyebrow: "#5fd0b4",
    header_menu_bg: "rgba(18,29,43,0.92)",
    header_menu_border: "rgba(143,170,198,0.28)",
    modal_bg: "rgba(28,31,35,0.96)",
    modal_border: "rgba(255,255,255,0.14)",
    modal_input_bg: "rgba(44,49,55,0.98)",
    modal_input_border: "rgba(255,255,255,0.14)",
    modal_secondary_bg: "rgba(44,49,55,0.98)",
    modal_secondary_border: "rgba(255,255,255,0.16)",
    modal_secondary_text: "#f3f5f7",
    modal_filled_bg: "rgba(68,74,82,0.98)",
    modal_filled_text: "#f3f5f7",
    modal_subtle_bg: "rgba(255,255,255,0.03)",
    feed_card_bg: "rgba(23, 37, 53, 0.96)",
    feed_card_border: "rgba(143, 170, 198, 0.18)",
    feed_muted_text: "#c4d6e8",
    feed_badge_bg: "rgba(49, 78, 112, 0.42)",
    feed_badge_border: "rgba(143, 170, 198, 0.20)",
    feed_badge_text: "#d9e7f5",
    feed_new_badge_bg: "rgba(95, 208, 180, 0.22)",
    feed_new_badge_border: "rgba(126, 231, 195, 0.24)",
    feed_new_badge_text: "#c6f5e8",
    feed_alert_info_bg: "rgba(27, 111, 180, 0.24)",
    feed_alert_info_border: "rgba(143, 196, 242, 0.18)",
    feed_alert_info_text: "#c8e6ff",
    feed_alert_advisory_bg: "rgba(140, 106, 0, 0.24)",
    feed_alert_advisory_border: "rgba(255, 227, 132, 0.16)",
    feed_alert_advisory_text: "#ffe79a",
    feed_alert_urgent_bg: "rgba(178, 86, 0, 0.28)",
    feed_alert_urgent_border: "rgba(255, 193, 125, 0.18)",
    feed_alert_urgent_text: "#ffd6a6",
    feed_alert_emergency_bg: "rgba(143, 29, 29, 0.32)",
    feed_alert_emergency_border: "rgba(255, 132, 132, 0.20)",
    feed_alert_emergency_text: "#ffb4b4",
    feed_status_published_bg: "rgba(24, 108, 94, 0.34)",
    feed_status_published_border: "rgba(95, 208, 180, 0.20)",
    feed_status_published_text: "#b7efe1",
    feed_status_scheduled_bg: "rgba(37, 99, 235, 0.28)",
    feed_status_scheduled_border: "rgba(147, 197, 253, 0.20)",
    feed_status_scheduled_text: "#bfdbfe",
    feed_status_archived_bg: "rgba(75, 85, 99, 0.42)",
    feed_status_archived_border: "rgba(156, 163, 175, 0.22)",
    feed_status_archived_text: "#d1d5db",
    feed_status_draft_bg: "rgba(140, 106, 0, 0.24)",
    feed_status_draft_border: "rgba(255, 227, 132, 0.16)",
    feed_status_draft_text: "#ffe79a",
    contact_tile_bg: "rgba(23, 37, 53, 0.96)",
    contact_tile_border: "rgba(143, 170, 198, 0.18)",
    tool_button_bg: "rgba(28,31,35,0.94)",
    tool_button_border: "rgba(255,255,255,0.22)",
    tool_button_text: "#f3f5f7",
    tool_active_bg: "#2a7262",
    tool_active_border: "#2a7262",
    tool_active_text: "#ffffff",
  }),
});

export const MAP_UI_THEME_FIELDS = Object.freeze([
  { key: "surface_bg", label: "Surface Background" },
  { key: "surface_border", label: "Surface Border" },
  { key: "surface_text", label: "Surface Text" },
  { key: "header_bg_primary", label: "Header Background Primary" },
  { key: "header_bg_secondary", label: "Header Background Secondary" },
  { key: "header_border", label: "Header Border" },
  { key: "header_text", label: "Header Text" },
  { key: "header_eyebrow", label: "Header Eyebrow" },
  { key: "header_menu_bg", label: "Header Menu Background" },
  { key: "header_menu_border", label: "Header Menu Border" },
  { key: "modal_bg", label: "Modal Background" },
  { key: "modal_border", label: "Modal Border" },
  { key: "modal_input_bg", label: "Modal Input Background" },
  { key: "modal_input_border", label: "Modal Input Border" },
  { key: "modal_secondary_bg", label: "Modal Secondary Button Background" },
  { key: "modal_secondary_border", label: "Modal Secondary Button Border" },
  { key: "modal_secondary_text", label: "Modal Secondary Button Text" },
  { key: "modal_filled_bg", label: "Modal Filled Button Background" },
  { key: "modal_filled_text", label: "Modal Filled Button Text" },
  { key: "modal_subtle_bg", label: "Modal Subtle Surface" },
  { key: "feed_card_bg", label: "Resident Feed Card Background" },
  { key: "feed_card_border", label: "Resident Feed Card Border" },
  { key: "feed_muted_text", label: "Resident Feed Supporting Text" },
  { key: "feed_badge_bg", label: "Resident Feed Badge Background" },
  { key: "feed_badge_border", label: "Resident Feed Badge Border" },
  { key: "feed_badge_text", label: "Resident Feed Badge Text" },
  { key: "feed_new_badge_bg", label: "Resident Feed New Badge Background" },
  { key: "feed_new_badge_border", label: "Resident Feed New Badge Border" },
  { key: "feed_new_badge_text", label: "Resident Feed New Badge Text" },
  { key: "feed_alert_info_bg", label: "Alert Info Badge Background" },
  { key: "feed_alert_info_border", label: "Alert Info Badge Border" },
  { key: "feed_alert_info_text", label: "Alert Info Badge Text" },
  { key: "feed_alert_advisory_bg", label: "Alert Advisory Badge Background" },
  { key: "feed_alert_advisory_border", label: "Alert Advisory Badge Border" },
  { key: "feed_alert_advisory_text", label: "Alert Advisory Badge Text" },
  { key: "feed_alert_urgent_bg", label: "Alert Urgent Badge Background" },
  { key: "feed_alert_urgent_border", label: "Alert Urgent Badge Border" },
  { key: "feed_alert_urgent_text", label: "Alert Urgent Badge Text" },
  { key: "feed_alert_emergency_bg", label: "Alert Emergency Badge Background" },
  { key: "feed_alert_emergency_border", label: "Alert Emergency Badge Border" },
  { key: "feed_alert_emergency_text", label: "Alert Emergency Badge Text" },
  { key: "feed_status_published_bg", label: "Feed Published Status Background" },
  { key: "feed_status_published_border", label: "Feed Published Status Border" },
  { key: "feed_status_published_text", label: "Feed Published Status Text" },
  { key: "feed_status_scheduled_bg", label: "Feed Scheduled Status Background" },
  { key: "feed_status_scheduled_border", label: "Feed Scheduled Status Border" },
  { key: "feed_status_scheduled_text", label: "Feed Scheduled Status Text" },
  { key: "feed_status_archived_bg", label: "Feed Archived Status Background" },
  { key: "feed_status_archived_border", label: "Feed Archived Status Border" },
  { key: "feed_status_archived_text", label: "Feed Archived Status Text" },
  { key: "feed_status_draft_bg", label: "Feed Draft Status Background" },
  { key: "feed_status_draft_border", label: "Feed Draft Status Border" },
  { key: "feed_status_draft_text", label: "Feed Draft Status Text" },
  { key: "contact_tile_bg", label: "Contact Tile Background" },
  { key: "contact_tile_border", label: "Contact Tile Border" },
  { key: "tool_button_bg", label: "Tool Button Background" },
  { key: "tool_button_border", label: "Tool Button Border" },
  { key: "tool_button_text", label: "Tool Icon / Text" },
  { key: "tool_active_bg", label: "Active Tool Background" },
  { key: "tool_active_border", label: "Active Tool Border" },
  { key: "tool_active_text", label: "Active Tool Icon / Text" },
]);

export const DEFAULT_UI_ICON_SRC = Object.freeze({
  account: "/account_icon.png",
  streetlight: "/streetlight_icon.png",
  streetSign: "/street_sign_icons/street_sign_domain_icon.png",
  pothole: "/pothole_icon.png",
  powerOutage: "/power_outage_icon.png",
  waterMain: "/water_main_icon.png",
  filter: "/filter_icon.png",
  openReports: "/open_reports_icon.png",
  mapping: "/streetlight_mapping_icon.png",
  bulk: "/bulk_reporting_icon.png",
  toolbox: "/toolbox_icon.png",
  headingReset: "/heading_reset_icon.png",
  info: "/info_icon.png",
  location: "/location_icon.png",
  homeRecenter: "/Icons/Map Tools/home_recenter_button.png",
  navigationArrow: "/Icons/Map Tools/navigation_arrow_icon.png",
  domainSelector: "/Icons/Map Tools/incident_driven_map_layer_button.png",
  incidentReportingLayer: "/Icons/Map Tools/incident_driven_map_layer_button.png",
  allIncidentReports: "/Icons/Map Tools/incident_driven_map_layer_button.png",
  mapTab: "/Icons/Buttons/tab_buttons/map_tab_icon.png",
  calendar: "/calendar_icon.png",
  notification: "/notification_icon.png",
  satellite: "/satellite_icon.png",
  streetMap: "/street_map_icon.png",
});

function sanitizeHexColor(value, fallback = "#111111") {
  const candidate = String(value || "").trim();
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
  return "#111111";
}

function sanitizeMapUiIconTintColor(value, fallback = "") {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  return sanitizeHexColor(candidate, fallback || "#111111");
}

function sanitizeOptionalCssColor(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(candidate)) {
    return candidate.toLowerCase();
  }
  if (/^(?:rgb|hsl)a?\([^()]+\)$/i.test(candidate)) return candidate;
  if (/^[a-z][a-z0-9_-]{1,31}$/i.test(candidate)) return candidate.toLowerCase();
  if (/^transparent$/i.test(candidate)) return "transparent";
  return "";
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

export const MAP_UI_ICON_CATALOG = Object.freeze([
  {
    key: "mapTab",
    label: "Map Tab",
    description: "Bottom navigation icon for the primary map tab.",
    group: "Bottom Navigation",
  },
  {
    key: "openReports",
    label: "Reports",
    description: "Bottom navigation icon for report history and the report drawer button.",
    group: "Bottom Navigation",
  },
  {
    key: "notification",
    label: "Alerts",
    description: "Bottom navigation and map shortcut icon for alerts.",
    group: "Bottom Navigation",
  },
  {
    key: "calendar",
    label: "Events",
    description: "Bottom navigation and map shortcut icon for events.",
    group: "Bottom Navigation",
  },
  {
    key: "account",
    label: "Account",
    description: "Bottom navigation icon for account/profile access.",
    group: "Bottom Navigation",
  },
  {
    key: "satellite",
    label: "Satellite View",
    description: "Toolbar icon shown when the next tap will switch to satellite.",
    group: "Map Controls",
  },
  {
    key: "streetMap",
    label: "Street Map View",
    description: "Toolbar icon shown when the next tap will switch back to the street map.",
    group: "Map Controls",
  },
  {
    key: "headingReset",
    label: "Reset Heading",
    description: "Toolbar icon for resetting the map heading to north-up.",
    group: "Map Controls",
  },
  {
    key: "location",
    label: "My Location",
    description: "Toolbar icon for centering on the device location.",
    group: "Map Controls",
  },
  {
    key: "navigationArrow",
    label: "Navigation Arrow",
    description: "Toolbar icon for follow/travel direction mode.",
    group: "Map Controls",
  },
  {
    key: "homeRecenter",
    label: "Home Recenter",
    description: "Toolbar icon for jumping back to the tenant boundary/home extent.",
    group: "Map Controls",
  },
  {
    key: "domainSelector",
    label: "Domain Selector (Legacy)",
    description: "Legacy web-only selector button kept for backward compatibility with older published manifests.",
    group: "Map Controls",
  },
  {
    key: "incidentReportingLayer",
    label: "Layers",
    description: "Toolbar icon for the incident reporting filter button.",
    group: "Map Controls",
  },
  {
    key: "allIncidentReports",
    label: "All Incident Reports",
    description: "Icon shown for the all-incident-reports option inside the incident layer filter menu.",
    group: "Map Controls",
  },
  {
    key: "filter",
    label: "Filter",
    description: "Icon used in reports filtering controls.",
    group: "Map Controls",
  },
  {
    key: "bulk",
    label: "Bulk Reporting",
    description: "Toolbar icon for bulk streetlight reporting.",
    group: "Admin + Utility Tools",
  },
  {
    key: "mapping",
    label: "Mapping Mode",
    description: "Toolbar icon for administrative mapping mode.",
    group: "Admin + Utility Tools",
  },
  {
    key: "toolbox",
    label: "Admin Tools",
    description: "Toolbar icon for admin tools.",
    group: "Admin + Utility Tools",
  },
  {
    key: "info",
    label: "Info",
    description: "Help/about icon used inside map guidance surfaces.",
    group: "Admin + Utility Tools",
  },
]).map((entry) => ({
  ...entry,
  defaultSrc: DEFAULT_UI_ICON_META[entry.key]?.src || "",
  defaultRenderMode: DEFAULT_UI_ICON_META[entry.key]?.render_mode || MAP_UI_ICON_RENDER_MODE.RASTER,
}));

export const MAP_UI_ICON_KEYS = Object.freeze(MAP_UI_ICON_CATALOG.map((entry) => entry.key));

export function sanitizeMapUiIconManifest(raw) {
  const source = raw && typeof raw === "object" && raw.icons && typeof raw.icons === "object"
    ? raw.icons
    : raw;
  const next = {};
  for (const key of MAP_UI_ICON_KEYS) {
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

export function sanitizeMapUiTheme(raw) {
  const source = raw && typeof raw === "object" && raw.theme && typeof raw.theme === "object"
    ? raw.theme
    : raw;
  const next = {};
  for (const mode of ["light", "dark"]) {
    const modeSource = source?.[mode];
    if (!modeSource || typeof modeSource !== "object") continue;
    const modeNext = {};
    for (const field of MAP_UI_THEME_FIELDS) {
      const value = sanitizeOptionalCssColor(modeSource?.[field.key]);
      if (value) modeNext[field.key] = value;
    }
    if (Object.keys(modeNext).length) next[mode] = modeNext;
  }
  return next;
}

function sanitizeMapUiThemeTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function compareMapUiThemeSchedules(a, b) {
  const aStart = Date.parse(String(a?.start_at || ""));
  const bStart = Date.parse(String(b?.start_at || ""));
  if (Number.isFinite(bStart) && Number.isFinite(aStart) && bStart !== aStart) return bStart - aStart;

  const aUpdated = Date.parse(String(a?.updated_at || a?.created_at || ""));
  const bUpdated = Date.parse(String(b?.updated_at || b?.created_at || ""));
  if (Number.isFinite(bUpdated) && Number.isFinite(aUpdated) && bUpdated !== aUpdated) return bUpdated - aUpdated;

  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

export function isMapUiBaseThemeEnabled(raw) {
  if (raw && typeof raw === "object" && typeof raw.theme_enabled === "boolean") {
    return raw.theme_enabled;
  }
  return Object.keys(sanitizeMapUiTheme(raw)).length > 0;
}

export function sanitizeMapUiThemeSchedules(raw) {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.scheduled_themes)
      ? raw.scheduled_themes
      : [];
  const next = [];
  source.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const theme = sanitizeMapUiTheme(entry);
    const startAt = sanitizeMapUiThemeTimestamp(entry?.start_at);
    const endAt = sanitizeMapUiThemeTimestamp(entry?.end_at);
    if (!Object.keys(theme).length || !startAt || !endAt) return;
    const startsAtMs = Date.parse(startAt);
    const endsAtMs = Date.parse(endAt);
    if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs) || endsAtMs <= startsAtMs) return;
    next.push({
      id: String(entry?.id || `theme-schedule-${index + 1}`).trim() || `theme-schedule-${index + 1}`,
      label: String(entry?.label || "").trim(),
      enabled: entry?.enabled !== false,
      start_at: startAt,
      end_at: endAt,
      theme,
      created_at: sanitizeMapUiThemeTimestamp(entry?.created_at),
      updated_at: sanitizeMapUiThemeTimestamp(entry?.updated_at),
    });
  });
  next.sort(compareMapUiThemeSchedules);
  return next;
}

export function resolveActiveMapUiThemeSchedule(raw, at = Date.now()) {
  const targetTime = at instanceof Date
    ? at.getTime()
    : typeof at === "string"
      ? Date.parse(at)
      : Number(at);
  if (!Number.isFinite(targetTime)) return null;
  return sanitizeMapUiThemeSchedules(raw).find((entry) => {
    if (entry?.enabled === false) return false;
    const startAt = Date.parse(String(entry?.start_at || ""));
    const endAt = Date.parse(String(entry?.end_at || ""));
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) return false;
    return targetTime >= startAt && targetTime < endAt;
  }) || null;
}

export function resolveMapUiThemeOverride(raw, at = Date.now()) {
  const activeSchedule = resolveActiveMapUiThemeSchedule(raw, at);
  if (activeSchedule?.theme) return activeSchedule.theme;
  if (isMapUiBaseThemeEnabled(raw)) return sanitizeMapUiTheme(raw);
  return {};
}

export function mergeMapUiTheme(raw, at = Date.now()) {
  const overrides = resolveMapUiThemeOverride(raw, at);
  return {
    light: {
      ...MAP_UI_ICON_THEME_DEFAULTS.light,
      ...(overrides.light || {}),
    },
    dark: {
      ...MAP_UI_ICON_THEME_DEFAULTS.dark,
      ...(overrides.dark || {}),
    },
  };
}

export function mergeMapUiIconMeta(raw) {
  return {
    ...DEFAULT_UI_ICON_META,
    ...sanitizeMapUiIconManifest(raw),
  };
}

export function mergeMapUiIconSrc(raw) {
  const merged = mergeMapUiIconMeta(raw);
  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, String(value?.src || "").trim()])
  );
}

export function mergeMapUiIconRenderModes(raw) {
  const merged = mergeMapUiIconMeta(raw);
  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, normalizeMapUiIconRenderMode(value?.render_mode, value?.src)])
  );
}

export function buildMapUiIconConfigValue(rawIcons, extra = {}) {
  const maybeTheme = rawIcons && typeof rawIcons === "object" && rawIcons.theme && typeof rawIcons.theme === "object"
    ? sanitizeMapUiTheme(rawIcons.theme)
    : {};
  const scheduledThemes = sanitizeMapUiThemeSchedules(rawIcons);
  return {
    icons: sanitizeMapUiIconManifest(rawIcons),
    ...(Object.keys(maybeTheme).length ? { theme: maybeTheme } : {}),
    ...(rawIcons && typeof rawIcons === "object" && typeof rawIcons.theme_enabled === "boolean" ? { theme_enabled: rawIcons.theme_enabled } : {}),
    ...(scheduledThemes.length ? { scheduled_themes: scheduledThemes } : {}),
    ...extra,
  };
}
