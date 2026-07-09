export const MAP_UI_ICON_PUBLISHED_CONFIG_KEY = "public_map_ui_icons_published";
export const MAP_UI_ICON_DRAFT_CONFIG_KEY = "platform_map_ui_icons_draft";
export const MAP_UI_THEME_PUBLISHED_CONFIG_KEY = "public_map_ui_theme_published";
export const MAP_UI_THEME_DRAFT_CONFIG_KEY = "platform_map_ui_theme_draft";
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

export const MAP_UI_THEME_DEFAULT_THEME_ID = "default-theme";

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

function svgDataUri(svg) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(String(svg || "").trim())}`;
}

const DEFAULT_CURRENT_LOCATION_MARKER_SRC = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36" role="img" aria-label="Current location marker">
    <defs>
      <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="rgba(5,16,30,0.28)"/>
      </filter>
    </defs>
    <circle cx="18" cy="18" r="11" fill="#1976d2" stroke="#ffffff" stroke-width="4" filter="url(#shadow)"/>
  </svg>
`);

const DEFAULT_NAVIGATION_LOCATION_MARKER_SRC = svgDataUri(`
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 36 36" role="img" aria-label="Navigation heading marker">
    <path d="M18 1 L26 15.5 L18 11.2 L10 15.5 Z" fill="rgba(8,18,32,0.22)" stroke="rgba(255,255,255,0.96)" stroke-width="1.8"/>
    <path d="M18 3.8 L22.7 12.4 L18 10.5 L13.3 12.4 Z" fill="#071a2f" stroke="rgba(255,255,255,0.98)" stroke-width="1.25"/>
    <circle cx="18" cy="12.8" r="1.35" fill="#7fd7ff" stroke="#ffffff" stroke-width="0.7"/>
  </svg>
`);

export const DEFAULT_UI_ICON_SRC = Object.freeze({
  account: "/account_icon.png",
  streetlight: "/streetlight_icon.png",
  streetSign: "/street_sign_icons/street_sign_domain_icon.png",
  pothole: "/pothole_icon.png",
  powerOutage: "/power_outage_icon.png",
  waterMain: "/water_main_icon.png",
  filter: "/filter_icon.png",
  utilityReportReference: "/Icons/Buttons/edit_button/edit_button_blue_icon.png",
  allLocations: "/location_icon.png",
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
  notifications: "/Icons/Map Tools/incident_driven_map_layer_button.png",
  calendar: "/calendar_icon.png",
  notification: "/notification_icon.png",
  satellite: "/satellite_icon.png",
  streetMap: "/street_map_icon.png",
  noticeInfo: "/info_icon.png",
  noticeWarning: "/street_sign_icons/warning_sign_icon.png",
  noticeSuccess: "/info_icon.png",
  noticeZoom: "/street_sign_icons/warning_sign_icon.png",
  noticeLoading: "/info_icon.png",
  currentLocationMarker: DEFAULT_CURRENT_LOCATION_MARKER_SRC,
  navigationLocationMarker: DEFAULT_NAVIGATION_LOCATION_MARKER_SRC,
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
    key: "filter",
    label: "Reports Filter",
    description: "Icon used for the Reports page filter/search button.",
    group: "Reports",
  },
  {
    key: "utilityReportReference",
    label: "Utility Report Reference",
    description: "Icon used for the streetlight saved-report utility reference add/edit action.",
    group: "Reports",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Bottom navigation and map shortcut icon for the cross-tenant notifications inbox.",
    group: "Bottom Navigation",
  },
  {
    key: "allLocations",
    label: "All Locations",
    description: "Filter icon for the Notifications inbox location selector.",
    group: "Notifications",
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
    key: "currentLocationMarker",
    label: "Current Location Marker",
    description: "Live on-map marker for the device's current position. This is the marker on the map itself, not the My Location toolbar button.",
    group: "Map Controls",
  },
  {
    key: "navigationLocationMarker",
    label: "Navigation / Heading Marker",
    description: "Directional overlay shown on the live location marker when heading or travel follow is active. This is the live heading marker on the map itself, not the navigation toolbar button.",
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
    label: "Layers + Domain Selector",
    description: "Shared icon for the map Layers button and the Reports domain selector button.",
    group: "Map Controls",
  },
  {
    key: "allIncidentReports",
    label: "All",
    description: "Shared icon for the All option inside the map Layers and Reports domain selector menus.",
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
  {
    key: "noticeInfo",
    label: "Notice Info",
    description: "Default info icon used by map/system notices.",
    group: "Notice System",
  },
  {
    key: "noticeWarning",
    label: "Notice Warning",
    description: "Default warning icon used by map/system notices.",
    group: "Notice System",
  },
  {
    key: "noticeSuccess",
    label: "Notice Success",
    description: "Default success icon used by map/system notices.",
    group: "Notice System",
  },
  {
    key: "noticeZoom",
    label: "Notice Zoom",
    description: "Default icon used for zoom-in guidance notices.",
    group: "Notice System",
  },
  {
    key: "noticeLoading",
    label: "Notice Loading",
    description: "Default icon used for loading/refreshing notices.",
    group: "Notice System",
  },
]).map((entry) => ({
  ...entry,
  defaultSrc: DEFAULT_UI_ICON_META[entry.key]?.src || "",
  defaultRenderMode: DEFAULT_UI_ICON_META[entry.key]?.render_mode || MAP_UI_ICON_RENDER_MODE.RASTER,
}));

export const MAP_UI_ICON_KEYS = Object.freeze(MAP_UI_ICON_CATALOG.map((entry) => entry.key));

export const MAP_UI_ICON_SURFACE_REQUIREMENTS = Object.freeze({
  bottomNavigation: Object.freeze([
    "mapTab",
    "openReports",
    "notifications",
    "notification",
    "calendar",
    "account",
  ]),
  notifications: Object.freeze([
    "allLocations",
  ]),
  reports: Object.freeze([
    "filter",
    "utilityReportReference",
  ]),
  mapControls: Object.freeze([
    "satellite",
    "streetMap",
    "headingReset",
    "location",
    "navigationArrow",
    "currentLocationMarker",
    "navigationLocationMarker",
    "homeRecenter",
    "incidentReportingLayer",
    "allIncidentReports",
  ]),
  adminUtilityTools: Object.freeze([
    "bulk",
    "mapping",
    "toolbox",
    "info",
  ]),
  noticeSystem: Object.freeze([
    "noticeWarning",
    "noticeZoom",
    "noticeLoading",
  ]),
});

const MAP_UI_ICON_GROUP_LABELS = Object.freeze({
  bottomNavigation: "Bottom Navigation",
  notifications: "Notifications",
  reports: "Reports",
  mapControls: "Map Controls",
  adminUtilityTools: "Admin + Utility Tools",
  noticeSystem: "Notice System",
});

export const MAP_UI_NOTICE_CATALOG = Object.freeze([
  {
    key: "zoom_to_report",
    label: "Zoom In To Report",
    description: "Shown when a user must zoom in further before placing a report.",
    icon_key: "noticeZoom",
    title: "Zoom in to report",
    message: "To improve accuracy of marker placement, zoom in further to report.",
  },
  {
    key: "zoom_to_select",
    label: "Zoom In To Select",
    description: "Shown when a user must zoom in further before selecting lights for bulk reporting.",
    icon_key: "noticeZoom",
    title: "Zoom in to select",
    message: "To improve accuracy of bulk selection, zoom in further before selecting lights.",
  },
  {
    key: "road_required",
    label: "Road Required",
    description: "Shown when a report must be placed on a road.",
    icon_key: "noticeWarning",
    title: "Road required",
    message: "This report must be placed on a road. Tap directly on the road surface and try again.",
  },
  {
    key: "road_validation_unavailable",
    label: "Road Validation Unavailable",
    description: "Shown when road validation is temporarily unavailable.",
    icon_key: "noticeWarning",
    title: "Road validation unavailable",
    message: "Road validation is temporarily unavailable. Please try again.",
  },
  {
    key: "park_required",
    label: "Park Required",
    description: "Shown when a report must be placed inside a park boundary.",
    icon_key: "noticeWarning",
    title: "Park required",
    message: "This report must be placed inside a park boundary.",
  },
  {
    key: "connection_issue",
    label: "Connection Issue",
    description: "Shown when live map/report data appears temporarily unavailable.",
    icon_key: "noticeWarning",
    title: "Connection issue",
    message: "Some map/report data may be unavailable temporarily.",
  },
  {
    key: "location_details_unavailable",
    label: "Location Details Unavailable",
    description: "Shown when address and nearby place-name lookups are temporarily unavailable.",
    icon_key: "noticeInfo",
    title: "Location details temporarily unavailable",
    message: "Street addresses and nearby place names are temporarily unavailable right now. Reporting still works normally, and any saved location details will still appear.",
  },
  {
    key: "landmark_details_unavailable",
    label: "Landmark Details Unavailable",
    description: "Shown when closest-landmark lookups are temporarily unavailable.",
    icon_key: "noticeInfo",
    title: "Landmark details temporarily unavailable",
    message: "Closest landmark details are temporarily unavailable right now. Reporting still works normally.",
  },
  {
    key: "map_refreshing",
    label: "Map Refreshing",
    description: "Shown when the app refreshes stale map data after returning from the background.",
    icon_key: "noticeLoading",
    title: "Refreshing map",
    message: "Loading the latest map data…",
  },
  {
    key: "assets_added_successfully",
    label: "Assets Added Successfully",
    description: "Shown after bulk mapping saves both lights and signs successfully.",
    icon_key: "noticeSuccess",
    title: "Assets added successfully.",
    message: "Mapped assets were added successfully.",
  },
  {
    key: "signs_added_successfully",
    label: "Signs Added Successfully",
    description: "Shown after bulk mapping saves signs successfully.",
    icon_key: "noticeSuccess",
    title: "Signs added successfully.",
    message: "Mapped signs were added successfully.",
  },
  {
    key: "lights_added_successfully",
    label: "Lights Added Successfully",
    description: "Shown after bulk mapping saves lights successfully.",
    icon_key: "noticeSuccess",
    title: "Lights added successfully.",
    message: "Mapped lights were added successfully.",
  },
  {
    key: "existing_lights_skipped",
    label: "Existing Lights Skipped",
    description: "Shown when queued lights already exist and are skipped during bulk mapping.",
    icon_key: "noticeInfo",
    title: "Existing lights skipped",
    message: "Some queued lights already existed and were not added again.",
  },
  {
    key: "nothing_saved",
    label: "Nothing Saved",
    description: "Shown when bulk mapping finishes without adding any valid assets.",
    icon_key: "noticeWarning",
    title: "Nothing saved",
    message: "Queued lights already existed or no valid mapped assets were queued.",
  },
  {
    key: "repair_confirmation_saved",
    label: "Repair Confirmation Saved",
    description: "Shown after a resident successfully confirms that a repair is complete.",
    icon_key: "noticeSuccess",
    title: "Repair confirmation saved",
    message: "Thanks. Community repair progress has been updated.",
  },
  {
    key: "incident_state_updated",
    label: "Incident State Updated",
    description: "Shown after an admin successfully updates an incident state.",
    icon_key: "noticeSuccess",
    title: "State updated",
    message: "Incident state updated successfully.",
  },
  {
    key: "utility_report_saved",
    label: "Utility Report Saved",
    description: "Shown after the utility-report status is updated successfully.",
    icon_key: "noticeSuccess",
    title: "Utility report saved",
    message: "Utility reporting status was updated.",
  },
  {
    key: "clipboard_copy_success",
    label: "Clipboard Copy Success",
    description: "Shown after text is copied to the clipboard from the map UI.",
    icon_key: "noticeSuccess",
    title: "Copied",
    message: "Copied to clipboard.",
  },
]);

export const MAP_UI_NOTICE_ICON_KEYS = Object.freeze(
  Array.from(new Set(MAP_UI_NOTICE_CATALOG.map((entry) => String(entry?.icon_key || "").trim()).filter(Boolean)))
);

export const MAP_UI_NOTICE_DEFAULTS = Object.freeze(
  Object.fromEntries(
    MAP_UI_NOTICE_CATALOG.map((entry) => [
      entry.key,
      {
        icon_key: String(entry?.icon_key || "").trim(),
        title: String(entry?.title || "").trim(),
        message: String(entry?.message || "").trim(),
      },
    ])
  )
);

export const MAP_UI_REQUIRED_ICON_KEYS = Object.freeze(
  Array.from(
    new Set(
      Object.values(MAP_UI_ICON_SURFACE_REQUIREMENTS).flat()
    )
  )
);

export function validateMapUiIconCatalog() {
  const issues = [];
  const catalogByKey = new Map(MAP_UI_ICON_CATALOG.map((entry) => [entry.key, entry]));
  const defaultKeys = new Set(Object.keys(DEFAULT_UI_ICON_SRC));
  const seenCatalogKeys = new Set();

  MAP_UI_ICON_CATALOG.forEach((entry) => {
    if (seenCatalogKeys.has(entry.key)) {
      issues.push(`Duplicate MAP_UI_ICON_CATALOG key "${entry.key}".`);
      return;
    }
    seenCatalogKeys.add(entry.key);
  });

  for (const [groupName, requiredKeys] of Object.entries(MAP_UI_ICON_SURFACE_REQUIREMENTS)) {
    const expectedGroupLabel = MAP_UI_ICON_GROUP_LABELS[groupName] || "Map UI";

    for (const key of requiredKeys) {
      if (!catalogByKey.has(key)) {
        issues.push(`Missing MAP_UI_ICON_CATALOG entry for required key "${key}" (${expectedGroupLabel}).`);
        continue;
      }
      if (!defaultKeys.has(key)) {
        issues.push(`Missing DEFAULT_UI_ICON_SRC entry for required key "${key}".`);
      }
      const entry = catalogByKey.get(key);
      if (entry?.group !== expectedGroupLabel) {
        issues.push(`Key "${key}" should belong to "${expectedGroupLabel}" but is grouped under "${entry?.group || "unknown"}".`);
      }
    }
  }

  return issues;
}

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

export function sanitizeMapUiNoticeConfig(raw) {
  const source = raw && typeof raw === "object" && raw.notices && typeof raw.notices === "object"
    ? raw.notices
    : raw;
  const next = {};
  for (const entry of MAP_UI_NOTICE_CATALOG) {
    const current = source?.[entry.key];
    const defaultConfig = MAP_UI_NOTICE_DEFAULTS?.[entry.key] || {};
    const iconKeyCandidate = String(current?.icon_key || defaultConfig.icon_key || "").trim();
    const iconKey = MAP_UI_NOTICE_ICON_KEYS.includes(iconKeyCandidate)
      ? iconKeyCandidate
      : String(defaultConfig.icon_key || "").trim();
    next[entry.key] = {
      icon_key: iconKey,
      title: String(current?.title ?? defaultConfig.title ?? "").trim(),
      message: String(current?.message ?? defaultConfig.message ?? "").trim(),
    };
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

function sanitizeMapUiThemeName(value, fallback = "Untitled Theme") {
  const name = String(value || "").trim();
  return name || fallback;
}

function sanitizeMapUiThemeDeploymentState(value, fallback = "draft") {
  return String(value || "").trim().toLowerCase() === "published" ? "published" : fallback;
}

function sanitizeMapUiThemeDateWindow(entry) {
  const startAt = sanitizeMapUiThemeTimestamp(entry?.start_at);
  const endAt = sanitizeMapUiThemeTimestamp(entry?.end_at);
  const startsAtMs = Date.parse(startAt);
  const endsAtMs = Date.parse(endAt);
  const hasValidWindow = Number.isFinite(startsAtMs) && Number.isFinite(endsAtMs) && endsAtMs > startsAtMs;
  return {
    start_at: hasValidWindow ? startAt : "",
    end_at: hasValidWindow ? endAt : "",
    has_valid_window: hasValidWindow,
  };
}

function normalizePublishedMapUiThemeEntry(entry, index = 0) {
  if (!entry || typeof entry !== "object") return null;
  const isDefault = entry?.is_default === true || String(entry?.id || "").trim() === MAP_UI_THEME_DEFAULT_THEME_ID;
  const theme = sanitizeMapUiTheme(entry);
  const { start_at, end_at, has_valid_window } = sanitizeMapUiThemeDateWindow(entry);
  const deploymentState = sanitizeMapUiThemeDeploymentState(entry?.deployment_state, isDefault ? "published" : "draft");
  if (!Object.keys(theme).length && !isDefault) return null;
  if (!isDefault && (!has_valid_window || deploymentState !== "published")) return null;
  return {
    id: String(entry?.id || (isDefault ? MAP_UI_THEME_DEFAULT_THEME_ID : `map-ui-theme-${index + 1}`)).trim() || (isDefault ? MAP_UI_THEME_DEFAULT_THEME_ID : `map-ui-theme-${index + 1}`),
    name: sanitizeMapUiThemeName(entry?.name || entry?.label, isDefault ? "Default Theme" : "Untitled Theme"),
    is_default: isDefault,
    deployment_state: isDefault ? "published" : "published",
    start_at: isDefault ? "" : start_at,
    end_at: isDefault ? "" : end_at,
    theme,
    created_at: sanitizeMapUiThemeTimestamp(entry?.created_at),
    updated_at: sanitizeMapUiThemeTimestamp(entry?.updated_at),
  };
}

function buildLegacyPublishedMapUiThemes(raw) {
  const next = [];
  const defaultTheme = sanitizeMapUiTheme(raw);
  next.push({
    id: MAP_UI_THEME_DEFAULT_THEME_ID,
    name: "Default Theme",
    is_default: true,
    deployment_state: "published",
    start_at: "",
    end_at: "",
    theme: defaultTheme,
    created_at: sanitizeMapUiThemeTimestamp(raw?.created_at || raw?.published_at || raw?.saved_at),
    updated_at: sanitizeMapUiThemeTimestamp(raw?.updated_at || raw?.published_at || raw?.saved_at),
  });
  sanitizeLegacyMapUiThemeSchedules(raw).forEach((entry, index) => {
    next.push({
      id: String(entry?.id || `map-ui-theme-${index + 1}`).trim() || `map-ui-theme-${index + 1}`,
      name: sanitizeMapUiThemeName(entry?.label, "Untitled Theme"),
      is_default: false,
      deployment_state: "published",
      start_at: String(entry?.start_at || "").trim(),
      end_at: String(entry?.end_at || "").trim(),
      theme: sanitizeMapUiTheme(entry),
      created_at: sanitizeMapUiThemeTimestamp(entry?.created_at),
      updated_at: sanitizeMapUiThemeTimestamp(entry?.updated_at),
    });
  });
  return next;
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

function sanitizeLegacyMapUiThemeSchedules(raw) {
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

export function isMapUiBaseThemeEnabled(raw) {
  if (raw && typeof raw === "object" && Array.isArray(raw.themes)) {
    const defaultTheme = sanitizeMapUiThemes(raw).find((entry) => entry?.is_default);
    return Boolean(defaultTheme && Object.keys(defaultTheme.theme || {}).length > 0);
  }
  if (raw && typeof raw === "object" && typeof raw.theme_enabled === "boolean") {
    return raw.theme_enabled;
  }
  return Object.keys(sanitizeMapUiTheme(raw)).length > 0;
}

export function sanitizeMapUiThemes(raw) {
  if (raw && typeof raw === "object" && Array.isArray(raw.themes)) {
    const themes = [];
    let defaultTheme = null;
    raw.themes.forEach((entry, index) => {
      const normalized = normalizePublishedMapUiThemeEntry(entry, index);
      if (!normalized) return;
      if (normalized.is_default) {
        if (!defaultTheme) defaultTheme = normalized;
        return;
      }
      themes.push(normalized);
    });
    const resolvedDefaultTheme = defaultTheme || {
      id: MAP_UI_THEME_DEFAULT_THEME_ID,
      name: "Default Theme",
      is_default: true,
      deployment_state: "published",
      start_at: "",
      end_at: "",
      theme: {},
      created_at: "",
      updated_at: "",
    };
    themes.sort(compareMapUiThemeSchedules);
    return [resolvedDefaultTheme, ...themes];
  }
  return buildLegacyPublishedMapUiThemes(raw);
}

export function sanitizeMapUiThemeSchedules(raw) {
  if (raw && typeof raw === "object" && Array.isArray(raw.themes)) {
    return sanitizeMapUiThemes(raw)
      .filter((entry) => !entry?.is_default)
      .map((entry) => ({
        id: entry.id,
        label: entry.name,
        enabled: true,
        start_at: entry.start_at,
        end_at: entry.end_at,
        theme: entry.theme,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      }));
  }
  return sanitizeLegacyMapUiThemeSchedules(raw);
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

function mergeMapUiThemeOverrideValues(baseTheme = {}, overrideTheme = {}) {
  const next = {};
  for (const mode of ["light", "dark"]) {
    const mergedMode = {
      ...((baseTheme && typeof baseTheme === "object" && baseTheme[mode] && typeof baseTheme[mode] === "object") ? baseTheme[mode] : {}),
      ...((overrideTheme && typeof overrideTheme === "object" && overrideTheme[mode] && typeof overrideTheme[mode] === "object") ? overrideTheme[mode] : {}),
    };
    if (Object.keys(mergedMode).length) next[mode] = mergedMode;
  }
  return next;
}

export function resolveMapUiThemeOverride(raw, at = Date.now()) {
  const baseTheme = (() => {
    if (raw && typeof raw === "object" && Array.isArray(raw.themes)) {
      const defaultTheme = sanitizeMapUiThemes(raw).find((entry) => entry?.is_default);
      return defaultTheme?.theme || {};
    }
    if (isMapUiBaseThemeEnabled(raw)) return sanitizeMapUiTheme(raw);
    return {};
  })();
  const activeSchedule = resolveActiveMapUiThemeSchedule(raw, at);
  if (activeSchedule?.theme) return mergeMapUiThemeOverrideValues(baseTheme, activeSchedule.theme);
  return baseTheme;
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

export function mergeMapUiNoticeConfig(raw) {
  return {
    ...MAP_UI_NOTICE_DEFAULTS,
    ...sanitizeMapUiNoticeConfig(raw),
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
  const { notices: extraNotices, ...restExtra } = extra || {};
  const notices = sanitizeMapUiNoticeConfig(extraNotices);
  return {
    icons: sanitizeMapUiIconManifest(rawIcons),
    notices,
    ...restExtra,
  };
}

export function buildMapUiThemeConfigValue(rawTheme, extra = {}) {
  if (rawTheme && typeof rawTheme === "object" && Array.isArray(rawTheme.themes)) {
    return {
      themes: rawTheme.themes,
      ...extra,
    };
  }
  const theme = sanitizeMapUiTheme(rawTheme);
  const scheduledThemes = sanitizeMapUiThemeSchedules(rawTheme);
  return {
    ...(Object.keys(theme).length ? { theme } : {}),
    ...(rawTheme && typeof rawTheme === "object" && typeof rawTheme.theme_enabled === "boolean" ? { theme_enabled: rawTheme.theme_enabled } : {}),
    ...(scheduledThemes.length ? { scheduled_themes: scheduledThemes } : {}),
    ...extra,
  };
}
