export const MAP_UI_THEME_PUBLISHED_CONFIG_KEY = "public_map_ui_theme_published";

const MAP_UI_THEME_FIELD_KEYS = Object.freeze([
  "surface_bg",
  "surface_border",
  "surface_text",
  "header_bg_primary",
  "header_bg_secondary",
  "header_border",
  "header_text",
  "header_eyebrow",
  "header_menu_bg",
  "header_menu_border",
  "modal_bg",
  "modal_border",
  "modal_input_bg",
  "modal_input_border",
  "modal_secondary_bg",
  "modal_secondary_border",
  "modal_secondary_text",
  "modal_filled_bg",
  "modal_filled_text",
  "modal_subtle_bg",
  "feed_card_bg",
  "feed_card_border",
  "feed_muted_text",
  "feed_badge_bg",
  "feed_badge_border",
  "feed_badge_text",
  "feed_new_badge_bg",
  "feed_new_badge_border",
  "feed_new_badge_text",
  "feed_alert_info_bg",
  "feed_alert_info_border",
  "feed_alert_info_text",
  "feed_alert_advisory_bg",
  "feed_alert_advisory_border",
  "feed_alert_advisory_text",
  "feed_alert_urgent_bg",
  "feed_alert_urgent_border",
  "feed_alert_urgent_text",
  "feed_alert_emergency_bg",
  "feed_alert_emergency_border",
  "feed_alert_emergency_text",
  "feed_status_published_bg",
  "feed_status_published_border",
  "feed_status_published_text",
  "feed_status_scheduled_bg",
  "feed_status_scheduled_border",
  "feed_status_scheduled_text",
  "feed_status_archived_bg",
  "feed_status_archived_border",
  "feed_status_archived_text",
  "feed_status_draft_bg",
  "feed_status_draft_border",
  "feed_status_draft_text",
  "contact_tile_bg",
  "contact_tile_border",
  "tool_button_bg",
  "tool_button_border",
  "tool_button_text",
  "tool_active_bg",
  "tool_active_border",
  "tool_active_text",
]);

const MAP_UI_THEME_LIGHT_DEFAULTS = Object.freeze([
  "rgba(255,255,255,0.96)",
  "rgba(0,0,0,0.10)",
  "#111111",
  "rgba(236,245,255,0.93)",
  "rgba(221,239,233,0.90)",
  "rgba(23,49,79,0.08)",
  "#102b46",
  "#13856e",
  "rgba(255,255,255,0.92)",
  "rgba(26,49,83,0.22)",
  "rgba(255,255,255,0.98)",
  "rgba(0,0,0,0.12)",
  "#ffffff",
  "#dddddd",
  "#ffffff",
  "rgba(0,0,0,0.18)",
  "#111111",
  "#111111",
  "#ffffff",
  "rgba(0,0,0,0.02)",
  "rgba(251,253,255,0.98)",
  "rgba(23,49,79,0.08)",
  "#58718a",
  "rgba(17, 61, 95, 0.08)",
  "rgba(17, 61, 95, 0.12)",
  "#113d5f",
  "rgba(28, 169, 118, 0.12)",
  "rgba(28, 169, 118, 0.18)",
  "#13684d",
  "rgba(30, 136, 229, 0.10)",
  "rgba(30, 136, 229, 0.16)",
  "#1b6fb4",
  "rgba(245, 190, 28, 0.12)",
  "rgba(245, 190, 28, 0.18)",
  "#8c6a00",
  "rgba(239, 108, 0, 0.10)",
  "rgba(239, 108, 0, 0.16)",
  "#b25600",
  "rgba(183, 28, 28, 0.10)",
  "rgba(183, 28, 28, 0.16)",
  "#8f1d1d",
  "rgba(22, 109, 120, 0.09)",
  "rgba(22, 109, 120, 0.15)",
  "#176d78",
  "rgba(37, 99, 235, 0.10)",
  "rgba(37, 99, 235, 0.16)",
  "#1d4ed8",
  "rgba(107, 114, 128, 0.10)",
  "rgba(107, 114, 128, 0.16)",
  "#4b5563",
  "rgba(245, 190, 28, 0.13)",
  "rgba(245, 190, 28, 0.20)",
  "#7a5a00",
  "rgba(247,251,255,0.98)",
  "rgba(23, 49, 79, 0.12)",
  "rgba(255,255,255,0.96)",
  "rgba(0,0,0,0.34)",
  "#111111",
  "#2a7262",
  "#2a7262",
  "#ffffff",
]);

const MAP_UI_THEME_DARK_DEFAULTS = Object.freeze([
  "rgba(28,31,35,0.94)",
  "rgba(255,255,255,0.12)",
  "#f3f5f7",
  "rgba(17,27,40,0.94)",
  "rgba(20,39,49,0.92)",
  "rgba(143,170,198,0.24)",
  "#edf6ff",
  "#5fd0b4",
  "rgba(18,29,43,0.92)",
  "rgba(143,170,198,0.28)",
  "rgba(28,31,35,0.96)",
  "rgba(255,255,255,0.14)",
  "rgba(44,49,55,0.98)",
  "rgba(255,255,255,0.14)",
  "rgba(44,49,55,0.98)",
  "rgba(255,255,255,0.16)",
  "#f3f5f7",
  "rgba(68,74,82,0.98)",
  "#f3f5f7",
  "rgba(255,255,255,0.03)",
  "rgba(23, 37, 53, 0.96)",
  "rgba(143, 170, 198, 0.18)",
  "#c4d6e8",
  "rgba(49, 78, 112, 0.42)",
  "rgba(143, 170, 198, 0.20)",
  "#d9e7f5",
  "rgba(95, 208, 180, 0.22)",
  "rgba(126, 231, 195, 0.24)",
  "#c6f5e8",
  "rgba(27, 111, 180, 0.24)",
  "rgba(143, 196, 242, 0.18)",
  "#c8e6ff",
  "rgba(140, 106, 0, 0.24)",
  "rgba(255, 227, 132, 0.16)",
  "#ffe79a",
  "rgba(178, 86, 0, 0.28)",
  "rgba(255, 193, 125, 0.18)",
  "#ffd6a6",
  "rgba(143, 29, 29, 0.32)",
  "rgba(255, 132, 132, 0.20)",
  "#ffb4b4",
  "rgba(24, 108, 94, 0.34)",
  "rgba(95, 208, 180, 0.20)",
  "#b7efe1",
  "rgba(37, 99, 235, 0.28)",
  "rgba(147, 197, 253, 0.20)",
  "#bfdbfe",
  "rgba(75, 85, 99, 0.42)",
  "rgba(156, 163, 175, 0.22)",
  "#d1d5db",
  "rgba(140, 106, 0, 0.24)",
  "rgba(255, 227, 132, 0.16)",
  "#ffe79a",
  "rgba(23, 37, 53, 0.96)",
  "rgba(143, 170, 198, 0.18)",
  "rgba(28,31,35,0.94)",
  "rgba(255,255,255,0.22)",
  "#f3f5f7",
  "#2a7262",
  "#2a7262",
  "#ffffff",
]);

function buildMapUiThemeModeDefaults(values = []) {
  const next = {};
  for (let index = 0; index < MAP_UI_THEME_FIELD_KEYS.length; index += 1) {
    const fieldKey = MAP_UI_THEME_FIELD_KEYS[index];
    const value = values[index];
    if (fieldKey && value) next[fieldKey] = value;
  }
  return Object.freeze(next);
}

export const MAP_UI_ICON_THEME_DEFAULTS = Object.freeze({
  light: buildMapUiThemeModeDefaults(MAP_UI_THEME_LIGHT_DEFAULTS),
  dark: buildMapUiThemeModeDefaults(MAP_UI_THEME_DARK_DEFAULTS),
});

const MAP_UI_NOTICE_ICON_KEYS = Object.freeze([
  "noticeInfo",
  "noticeWarning",
  "noticeSuccess",
  "noticeZoom",
  "noticeLoading",
]);

const MAP_UI_NOTICE_DEFAULT_ROWS = Object.freeze([
  ["zoom_to_report", "noticeZoom", "Zoom in to report", "To improve accuracy of marker placement, zoom in further to report."],
  ["zoom_to_select", "noticeZoom", "Zoom in to select", "To improve accuracy of bulk selection, zoom in further before selecting lights."],
  ["road_required", "noticeWarning", "Road required", "This report must be placed on a road. Tap directly on the road surface and try again."],
  ["road_validation_unavailable", "noticeWarning", "Road validation unavailable", "Road validation is temporarily unavailable. Please try again."],
  ["park_required", "noticeWarning", "Park required", "This report must be placed inside a park boundary."],
  ["connection_issue", "noticeWarning", "Connection issue", "Some map/report data may be unavailable temporarily."],
  ["location_details_unavailable", "noticeInfo", "Location details temporarily unavailable", "Street addresses and nearby place names are temporarily unavailable right now. Reporting still works normally, and any saved location details will still appear."],
  ["landmark_details_unavailable", "noticeInfo", "Landmark details temporarily unavailable", "Closest landmark details are temporarily unavailable right now. Reporting still works normally."],
  ["map_refreshing", "noticeLoading", "Refreshing map", "Loading the latest map data…"],
  ["assets_added_successfully", "noticeSuccess", "Assets added successfully.", "Mapped assets were added successfully."],
  ["signs_added_successfully", "noticeSuccess", "Signs added successfully.", "Mapped signs were added successfully."],
  ["lights_added_successfully", "noticeSuccess", "Lights added successfully.", "Mapped lights were added successfully."],
  ["existing_lights_skipped", "noticeInfo", "Existing lights skipped", "Some queued lights already existed and were not added again."],
  ["nothing_saved", "noticeWarning", "Nothing saved", "Queued lights already existed or no valid mapped assets were queued."],
  ["repair_confirmation_saved", "noticeSuccess", "Repair confirmation saved", "Thanks. Community repair progress has been updated."],
  ["incident_state_updated", "noticeSuccess", "State updated", "Incident state updated successfully."],
  ["utility_report_saved", "noticeSuccess", "Utility report saved", "Utility reporting status was updated."],
  ["clipboard_copy_success", "noticeSuccess", "Copied", "Copied to clipboard."],
]);

const MAP_UI_NOTICE_DEFAULTS = Object.freeze(
  Object.fromEntries(
    MAP_UI_NOTICE_DEFAULT_ROWS.map(([key, icon_key, title, message]) => [
      key,
      { icon_key, title, message },
    ])
  )
);

function sanitizeOptionalCssColor(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(candidate)) return candidate.toLowerCase();
  if (/^(?:rgb|hsl)a?\([^()]+\)$/i.test(candidate)) return candidate;
  if (/^[a-z][a-z0-9_-]{1,31}$/i.test(candidate)) return candidate.toLowerCase();
  if (/^transparent$/i.test(candidate)) return "transparent";
  return "";
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
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

function sanitizeMapUiTheme(raw) {
  const source = raw && typeof raw === "object" && raw.theme && typeof raw.theme === "object"
    ? raw.theme
    : raw;
  const next = {};
  for (const mode of ["light", "dark"]) {
    const modeSource = source?.[mode];
    if (!modeSource || typeof modeSource !== "object") continue;
    const modeNext = {};
    for (const fieldKey of MAP_UI_THEME_FIELD_KEYS) {
      const value = sanitizeOptionalCssColor(modeSource?.[fieldKey]);
      if (value) modeNext[fieldKey] = value;
    }
    if (Object.keys(modeNext).length) next[mode] = modeNext;
  }
  return next;
}

function sanitizeMapUiNoticeConfig(raw) {
  const source = raw && typeof raw === "object" && raw.notices && typeof raw.notices === "object"
    ? raw.notices
    : raw;
  const next = {};
  for (const [key, defaultConfig] of Object.entries(MAP_UI_NOTICE_DEFAULTS)) {
    const current = source?.[key];
    const iconKeyCandidate = String(current?.icon_key || defaultConfig.icon_key || "").trim();
    const iconKey = MAP_UI_NOTICE_ICON_KEYS.includes(iconKeyCandidate)
      ? iconKeyCandidate
      : String(defaultConfig.icon_key || "").trim();
    next[key] = {
      icon_key: iconKey,
      title: String(current?.title ?? defaultConfig.title ?? "").trim(),
      message: String(current?.message ?? defaultConfig.message ?? "").trim(),
    };
  }
  return next;
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
      start_at: startAt,
      end_at: endAt,
      enabled: entry?.enabled !== false,
      theme,
    });
  });
  next.sort(compareMapUiThemeSchedules);
  return next;
}

function sanitizeMapUiThemes(raw) {
  if (!(raw && typeof raw === "object" && Array.isArray(raw.themes))) return null;
  let defaultTheme = null;
  const scheduledThemes = [];
  raw.themes.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const isDefault = entry?.is_default === true || String(entry?.id || "").trim() === "default-theme";
    const theme = sanitizeMapUiTheme(entry);
    if (isDefault) {
      if (!defaultTheme) defaultTheme = theme;
      return;
    }
    const deploymentState = String(entry?.deployment_state || "").trim().toLowerCase();
    if (deploymentState && deploymentState !== "published") return;
    const startAt = sanitizeMapUiThemeTimestamp(entry?.start_at);
    const endAt = sanitizeMapUiThemeTimestamp(entry?.end_at);
    if (!Object.keys(theme).length || !startAt || !endAt) return;
    const startsAtMs = Date.parse(startAt);
    const endsAtMs = Date.parse(endAt);
    if (!Number.isFinite(startsAtMs) || !Number.isFinite(endsAtMs) || endsAtMs <= startsAtMs) return;
    scheduledThemes.push({
      id: String(entry?.id || `map-ui-theme-${index + 1}`).trim() || `map-ui-theme-${index + 1}`,
      start_at: startAt,
      end_at: endAt,
      enabled: true,
      theme,
    });
  });
  scheduledThemes.sort(compareMapUiThemeSchedules);
  return {
    defaultTheme: defaultTheme || {},
    scheduledThemes,
  };
}

export function sanitizeMapUiThemeSchedules(raw) {
  const normalizedThemes = sanitizeMapUiThemes(raw);
  return normalizedThemes ? normalizedThemes.scheduledThemes : sanitizeLegacyMapUiThemeSchedules(raw);
}

function resolveMapUiThemeOverride(raw, at = Date.now()) {
  const normalizedThemes = sanitizeMapUiThemes(raw);
  const baseTheme = normalizedThemes
    ? normalizedThemes.defaultTheme
    : (Object.keys(sanitizeMapUiTheme(raw)).length > 0 ? sanitizeMapUiTheme(raw) : {});
  const targetTime = at instanceof Date
    ? at.getTime()
    : typeof at === "string"
      ? Date.parse(at)
      : Number(at);
  const activeSchedule = Number.isFinite(targetTime)
    ? sanitizeMapUiThemeSchedules(raw).find((entry) => {
        if (entry?.enabled === false) return false;
        const startAt = Date.parse(String(entry?.start_at || ""));
        const endAt = Date.parse(String(entry?.end_at || ""));
        if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) return false;
        return targetTime >= startAt && targetTime < endAt;
      }) || null
    : null;
  if (!activeSchedule?.theme) return baseTheme;
  const next = {};
  for (const mode of ["light", "dark"]) {
    const mergedMode = {
      ...((baseTheme && typeof baseTheme === "object" && baseTheme[mode] && typeof baseTheme[mode] === "object") ? baseTheme[mode] : {}),
      ...((activeSchedule.theme && typeof activeSchedule.theme === "object" && activeSchedule.theme[mode] && typeof activeSchedule.theme[mode] === "object") ? activeSchedule.theme[mode] : {}),
    };
    if (Object.keys(mergedMode).length) next[mode] = mergedMode;
  }
  return next;
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

export function mergeMapUiNoticeConfig(raw) {
  return {
    ...MAP_UI_NOTICE_DEFAULTS,
    ...sanitizeMapUiNoticeConfig(raw),
  };
}

export function listMapUiThemeBoundaryTimestamps(raw) {
  const values = sanitizeMapUiThemeSchedules(raw)
    .flatMap((entry) => [Date.parse(String(entry?.start_at || "")), Date.parse(String(entry?.end_at || ""))])
    .filter((value) => Number.isFinite(value));
  return Array.from(new Set(values)).sort((a, b) => a - b);
}
