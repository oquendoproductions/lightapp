// ==================================================
// App.jsx — Full file
// ==================================================
import React, { Fragment, forwardRef, memo, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { CircleF, GoogleMap, MarkerF, PolygonF, useJsApiLoader } from "@react-google-maps/api";
import "./headerStandards.css";
import { supabase } from "./supabaseClient";
import { getRuntimeTenantKey } from "./tenant/runtimeTenant";
import { TenantContext } from "./tenant/contextObject";
import { hydrateCrossTenantSession, markCrossTenantLogout, syncCrossTenantAuthState } from "./auth/crossTenantAuth";
import { STANDARD_LOGIN_EMAIL_INPUT_PROPS, getStandardLoginPasswordInputProps } from "./auth/loginFieldStandards";
import { computeStreetlightConfidenceSnapshot } from "./streetlightConfidence";
import { APP_VERSION } from "./appMeta";
import { resolveHeaderDisplayName, resolvePublicHeaderDisplayName } from "./lib/headerDisplayName";
import { useHeaderOrganizationProfile } from "./lib/useHeaderOrganizationProfile";
import { buildMailtoHref, hasNonEmptyValue, normalizePhoneHref, normalizeWebsiteHref } from "./lib/workspaceSupport";

// ✅ Google Maps API key
const GMAPS_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  import.meta.env.VITE_GOOGLE_MAPS_KEY ||
  "";
const GMAPS_KEY_DEV = import.meta.env.VITE_GOOGLE_MAPS_API_KEY_DEV || "";
const GMAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || "";
const GMAPS_LIBRARIES = ["places"];

const DEV_MAPS_HOST_SUFFIXES = [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.io", ".ngrok.app"];

function defaultDomainType(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  if (key === "streetlights" || key === "street_signs") return "asset_backed";
  return "incident_driven";
}

function isDevMapsHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return true;
  return DEV_MAPS_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function currentRuntimeHost() {
  if (typeof window === "undefined") return "";
  return String(window.location.hostname || "").trim().toLowerCase();
}

const GMAPS_RUNTIME_HOST = currentRuntimeHost();
const GMAPS_ACTIVE_KEY =
  GMAPS_KEY_DEV && isDevMapsHost(GMAPS_RUNTIME_HOST)
    ? GMAPS_KEY_DEV
    : GMAPS_KEY;



// ==================================================
// SECTION 2 — App Settings
// ==================================================
const containerStyle = { height: "100%", width: "100%" };
const USA_OVERVIEW = [39.5, -98.35];
const INITIAL_OVERVIEW_ZOOM = 5;
const GROUP_RADIUS_METERS = 25;
const POTHOLE_MERGE_RADIUS_METERS = 22;
const POTHOLE_ROAD_HIT_METERS = 12;
const INCIDENT_REPAIR_TARGET = 5;
const INCIDENT_REPAIR_ARCHIVE_MS = 14 * 24 * 60 * 60 * 1000;

// 💡 OFFICIAL LIGHTS (admin-only mapping layer)
const OFFICIAL_LIGHTS_MIN_ZOOM = 13;
const LOCATE_ZOOM = 17;
const MAPPING_MIN_ZOOM = 17;
const REPORTING_MIN_ZOOM = 17;
const STREETLIGHT_STALENESS_ROLLOUT_START = new Date(2026, 2, 24, 0, 0, 0, 0).getTime();
const TITLE_LOGO_SRC = import.meta.env.VITE_TITLE_LOGO_SRC || "/CityReport-logo.png";
const TITLE_LOGO_DARK_SRC =
  import.meta.env.VITE_TITLE_LOGO_DARK_SRC || "/CityReport-logo-dark-mode.png";
const MOBILE_TITLE_LOGO_SRC = import.meta.env.VITE_MOBILE_TITLE_LOGO_SRC || "/CityReport-pin-logo.png";
const MOBILE_TITLE_LOGO_DARK_SRC =
  import.meta.env.VITE_MOBILE_TITLE_LOGO_DARK_SRC || "/CityReport-pin-logo-dark-mode.png";
const ENABLE_TENANT_VISIBILITY_CONFIG = true;
const ENABLE_LEGACY_PLACES_SERVICE =
  String(import.meta.env.VITE_ENABLE_LEGACY_PLACES_SERVICE || "").trim().toLowerCase() === "true";
const STREETLIGHT_UTILITY_REPORT_URL =
  String(import.meta.env.VITE_STREETLIGHT_UTILITY_REPORT_URL || "").trim() ||
  "https://www.firstenergycorp.com/outages_help/Report_Power_Outages.html?_gl=1*te1hi8*_up*MQ..*_ga*MTEyODI2NTQ5OS4xNzcyMjU3MDQ4*_ga_TVQJK7Z44E*czE3NzI0Mzc3NzEkbzIkZzEkdDE3NzI0Mzc3ODQkajQ3JGwwJGgw";
const TITLE_LOGO_ALT = "CityReport.io";
const UI_ICON_SRC = {
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
  calendar: "/calendar_icon.png",
  notification: "/notification_icon.png",
  satellite: "/satellite_icon.png",
  streetMap: "/street_map_icon.png",
};


// Per-light cooldown (client-side guardrail; reversible)
const REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cooldown persistence key
const COOLDOWNS_KEY = "streetlight_cooldowns_v1";
const ABUSE_RATE_KEY = "cityreport_abuse_rate_v1";
const ABUSE_GATE_FUNCTION = "rate-limit-gate";
const ABUSE_WINDOW_MS = 60 * 1000; // 1 minute
const ABUSE_MAX_EVENTS_PER_WINDOW = 7;
const ABUSE_MAX_LIGHTS_PER_WINDOW = 20;
const DOMAIN_SUBMIT_DEDUPE_WINDOW_MS = 60 * 1000;
const BULK_MAX_LIGHTS_PER_SUBMIT = 10;
const EXPORT_SCHEMA_VERSION = "v1";
const ABUSE_BACKOFF_KEY = "cityreport_abuse_backoff_v1";
const ABUSE_BACKOFF_MAX_MS = 15 * 60 * 1000;
const MAP_COMMUNITY_FEED_READ_KEY = "cityreport_map_community_feed_read_v2";

// Location request prompt upon opening page
const LOC_PROMPTED_SESSION_KEY = "streetlight_loc_prompted_session_v1";


// ==================================================
// SECTION 3 — Report Metadata + Status Logic
// ==================================================
const REPORT_TYPES = {
  out: "Light is out",
  flickering: "Dim / Flickering",
  dayburner: "On during daytime",
  downed_pole: "Pole down",
  sewer_backup: "Sewer Backup",
  storm_drain_clog: "Storm Drain Blocked / Flooding",
  other: "Other",
};
const STREET_SIGN_ISSUE_OPTIONS = [
  { value: "damaged", label: "Damaged sign" },
  { value: "missing", label: "Missing sign" },
  { value: "blocked", label: "Obstructed / blocked visibility" },
  { value: "faded", label: "Faded / unreadable" },
  { value: "bent", label: "Bent / leaning" },
  { value: "graffiti", label: "Graffiti / vandalized" },
  { value: "wrong_sign", label: "Wrong sign posted" },
  { value: "other", label: "Other" },
];
const WATER_DRAIN_ISSUE_OPTIONS = [
  { value: "sewer_backup", label: "Sewer Backup" },
  { value: "storm_drain_clog", label: "Storm Drain Blocked / Flooding" },
];

const REPORT_DOMAIN_OPTIONS = [
  { key: "potholes", label: "Potholes", icon: "🕳️", iconSrc: UI_ICON_SRC.pothole, enabled: true },
  { key: "water_drain_issues", label: "Water / Drain Issues", icon: "💧", iconSrc: UI_ICON_SRC.waterMain, enabled: true },
  { key: "streetlights", label: "Streetlights (Utility-owned)", icon: "💡", iconSrc: UI_ICON_SRC.streetlight, enabled: true },
  { key: "street_signs", label: "Street Signs", icon: "🪧", iconSrc: UI_ICON_SRC.streetSign, enabled: true },
  { key: "power_outage", label: "Power Outage", icon: "⚡", iconSrc: UI_ICON_SRC.powerOutage, enabled: true },
  { key: "water_main", label: "Water Main", icon: "🚰", iconSrc: UI_ICON_SRC.waterMain, enabled: true },
];
const DEFAULT_PUBLIC_DOMAINS = new Set(["potholes", "water_drain_issues", "streetlights"]);
const STREET_SIGN_TYPE_OPTIONS = [
  { value: "stop", label: "Stop" },
  { value: "yield", label: "Yield" },
  { value: "speed_limit", label: "Speed limit" },
  { value: "warning", label: "Warning" },
  { value: "no_parking", label: "No parking" },
  { value: "one_way", label: "One way" },
  { value: "school_zone", label: "School zone" },
  { value: "crosswalk", label: "Crosswalk" },
  { value: "street_name", label: "Street name" },
  { value: "other", label: "Other" },
];
const STREET_SIGN_TYPE_VALUES = new Set(STREET_SIGN_TYPE_OPTIONS.map((opt) => String(opt.value || "").trim().toLowerCase()));
const STREET_SIGN_TYPE_ICON_SRC = {
  stop: "/street_sign_icons/stop_sign_icon.png",
  yield: "/street_sign_icons/yield_sign_icon.png",
  speed_limit: "/street_sign_icons/speed_limit_sign.png",
  warning: "/street_sign_icons/warning_sign_icon.png",
  no_parking: "/street_sign_icons/no_parking_icon.png",
  one_way: "/street_sign_icons/one_way_icon.png",
  school_zone: "/street_sign_icons/school_zone_icon.png",
  crosswalk: "/street_sign_icons/crosswalk_icon.png",
  street_name: "/street_sign_icons/street_name_sign_icon.png",
  other: "/street_sign_icons/street_sign_domain_icon.png",
};
const RESIDENT_NOTIFICATION_TOPIC_DETAILS = {
  emergency_alerts: { label: "Emergency Alerts", description: "Urgent citywide issues that need immediate attention.", default_enabled: false },
  water_utility: { label: "Water + Utility", description: "Water breaks, utility outages, and infrastructure service notices.", default_enabled: false },
  road_closures: { label: "Road Closures", description: "Closures, detours, and traffic-impacting maintenance work.", default_enabled: false },
  street_maintenance: { label: "Street Maintenance", description: "Planned street, sidewalk, sign, and streetlight work.", default_enabled: false },
  trash_recycling: { label: "Trash + Recycling", description: "Pickup changes, holiday schedules, and sanitation reminders.", default_enabled: false },
  community_events: { label: "Community Events", description: "Parades, public meetings, and city-run civic events.", default_enabled: false },
  general_updates: { label: "General City Updates", description: "General municipality notices that do not fit another topic.", default_enabled: false },
};

function defaultDomainIssueFor(domainKey) {
  const d = String(domainKey || "").trim().toLowerCase();
  if (d === "street_signs") return STREET_SIGN_ISSUE_OPTIONS[0].value;
  if (d === "water_drain_issues") return WATER_DRAIN_ISSUE_OPTIONS[0].value;
  return "other";
}

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("relation") || msg.includes("does not exist");
}

function formatResidentFeedDateTime(value, opts = {}) {
  if (!value) return "TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: opts.dateStyle || "medium",
    timeStyle: opts.timeStyle || "short",
  }).format(parsed);
}

function formatResidentEventRange(event) {
  if (!event?.starts_at) return "Date TBD";
  const start = new Date(event.starts_at);
  const end = event?.ends_at ? new Date(event.ends_at) : null;
  if (event?.all_day) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(start);
  }
  if (!end || Number.isNaN(end.getTime())) return formatResidentFeedDateTime(start.toISOString());
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(start)} • ${new Intl.DateTimeFormat("en-US", {
      timeStyle: "short",
    }).format(start)} - ${new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(end)}`;
  }
  return `${formatResidentFeedDateTime(start.toISOString())} - ${formatResidentFeedDateTime(end.toISOString())}`;
}

function formatResidentAlertWindow(alert) {
  if (!alert?.starts_at && !alert?.ends_at) return "Effective immediately";
  if (alert?.starts_at && alert?.ends_at) {
    return `${formatResidentFeedDateTime(alert.starts_at)} - ${formatResidentFeedDateTime(alert.ends_at)}`;
  }
  if (alert?.starts_at) return `Starts ${formatResidentFeedDateTime(alert.starts_at)}`;
  return `Runs until ${formatResidentFeedDateTime(alert.ends_at)}`;
}

function residentAlertSeverityRank(severity) {
  switch (String(severity || "").trim().toLowerCase()) {
    case "emergency":
      return 4;
    case "urgent":
      return 3;
    case "advisory":
      return 2;
    default:
      return 1;
  }
}

function splitStreetlightAddressParts(rawAddress) {
  const raw = String(rawAddress || "").trim();
  if (!raw) {
    return { houseNumber: "", street: "", city: "", state: "", zip: "" };
  }
  const parts = raw
    .split(",")
    .map((s) => String(s || "").trim())
    .filter(Boolean)
    .filter((s) => s.toLowerCase() !== "usa");
  if (!parts.length) {
    return { houseNumber: "", street: "", city: "", state: "", zip: "" };
  }
  const line1 = parts[0] || "";
  const line2 = parts[1] || "";
  const line3 = parts[2] || "";
  const line1Match = line1.match(/^\s*(\d+[A-Za-z0-9\-]*)\s+(.+)\s*$/);
  const houseNumber = String(line1Match?.[1] || "").trim();
  const street = String(line1Match?.[2] || line1 || "").trim();
  const city = line2 || line3 || "";
  const stateZipSource = parts.find((part) => /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(part)) || "";
  const stateZipMatch = stateZipSource.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
  return {
    houseNumber,
    street: street || "Address unavailable",
    city,
    state: stateZipMatch?.[1] || "",
    zip: stateZipMatch?.[2] || "",
  };
}

function deriveStreetlightCrossStreet(onStreetRaw, intersectionRaw, nearestCrossStreetRaw) {
  if (String(nearestCrossStreetRaw || "").trim()) return String(nearestCrossStreetRaw || "").trim();
  if (!String(intersectionRaw || "").trim()) return "";
  const normalizeRoad = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const onStreetKey = normalizeRoad(onStreetRaw);
  const cleaned = String(intersectionRaw || "")
    .replace(/\b(at|on|between|near|of|north|south|east|west|n|s|e|w)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleaned
    .split(/&|\/|,|\band\b|\bnear\b|\bbetween\b|\bof\b/i)
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  for (const token of tokens) {
    const tokenKey = normalizeRoad(token);
    if (!tokenKey) continue;
    if (!onStreetKey) return token;
    if (tokenKey === onStreetKey) continue;
    if (tokenKey.includes(onStreetKey) || onStreetKey.includes(tokenKey)) continue;
    return token;
  }
  return "";
}

function buildStreetlightUtilityRows(util, coords) {
  const latVal = Number(coords?.lat);
  const lngVal = Number(coords?.lng);
  const coordsText =
    Number.isFinite(latVal) && Number.isFinite(lngVal)
      ? `${latVal.toFixed(6)}, ${lngVal.toFixed(6)}`
      : "Unavailable";
  const parts = splitStreetlightAddressParts(String(util?.nearestAddress || util?.nearest_address || "").trim());
  const onStreet = String(util?.nearestStreet || util?.nearest_street || "").trim();
  const intersectionRaw = String(util?.nearestIntersection || util?.nearest_intersection || "").trim();
  const nearestCrossStreetRaw = String(util?.nearestCrossStreet || util?.nearest_cross_street || "").trim();
  const nearestLandmark = String(util?.nearestLandmark || util?.nearest_landmark || "").trim();
  return [
    { label: "City", value: parts.city || "Unavailable" },
    { label: "State", value: parts.state || "Unavailable" },
    { label: "Zip", value: parts.zip || "Unavailable" },
    { label: "House Number", value: parts.houseNumber || "Unavailable" },
    { label: "Street", value: parts.street || "Unavailable" },
    {
      label: "Cross Street",
      value: deriveStreetlightCrossStreet(onStreet, intersectionRaw, nearestCrossStreetRaw) || "Unavailable",
    },
    { label: "Landmark", value: nearestLandmark || "Unavailable" },
    { label: "Coordinates", value: coordsText },
  ];
}

function sortResidentAlerts(rows = []) {
  return [...rows].sort((a, b) => {
    const aPinned = a?.pinned ? 1 : 0;
    const bPinned = b?.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aSeverity = residentAlertSeverityRank(a?.severity);
    const bSeverity = residentAlertSeverityRank(b?.severity);
    if (aSeverity !== bSeverity) return bSeverity - aSeverity;
    return new Date(b?.starts_at || b?.published_at || b?.created_at || 0).getTime()
      - new Date(a?.starts_at || a?.published_at || a?.created_at || 0).getTime();
  });
}

function sortResidentEvents(rows = []) {
  return [...rows].sort((a, b) => {
    const aStart = new Date(a?.starts_at || a?.created_at || 0).getTime();
    const bStart = new Date(b?.starts_at || b?.created_at || 0).getTime();
    return aStart - bStart;
  });
}

function hasResidentCommunityEndPassed(value) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
}

function shouldAutoArchiveResidentCommunityItem(row) {
  return String(row?.status || "").trim().toLowerCase() === "published" && hasResidentCommunityEndPassed(row?.ends_at);
}

function countActivePublishedAlerts(alerts) {
  const now = Date.now();
  return (alerts || []).filter((alert) => {
    if (String(alert?.status || "").trim().toLowerCase() !== "published") return false;
    const startsAt = alert?.starts_at ? new Date(alert.starts_at).getTime() : null;
    const endsAt = alert?.ends_at ? new Date(alert.ends_at).getTime() : null;
    if (startsAt && startsAt > now) return false;
    if (endsAt && endsAt < now) return false;
    return true;
  }).length;
}

function countUpcomingPublishedEvents(events) {
  const now = Date.now();
  return (events || []).filter((event) => {
    if (String(event?.status || "").trim().toLowerCase() !== "published") return false;
    const startsAt = event?.starts_at ? new Date(event.starts_at).getTime() : null;
    return !startsAt || startsAt >= now - (60 * 60 * 1000);
  }).length;
}

function mapCommunityFeedStorageKey(tenantKey, viewerKey) {
  const tenant = String(tenantKey || "").trim().toLowerCase();
  const viewer = String(viewerKey || "anon").trim().toLowerCase();
  return `${MAP_COMMUNITY_FEED_READ_KEY}:${tenant || "unknown"}:${viewer || "anon"}`;
}

function loadMapCommunityFeedReadState(tenantKey, viewerKey) {
  if (typeof window === "undefined") {
    return {
      alertsLastViewedAt: 0,
      eventsLastViewedAt: 0,
      alertsReadKeys: [],
      eventsReadKeys: [],
      alertsReadIds: [],
      eventsReadIds: [],
    };
  }
  try {
    const raw = window.localStorage.getItem(mapCommunityFeedStorageKey(tenantKey, viewerKey));
    if (!raw) {
      return {
        alertsLastViewedAt: 0,
        eventsLastViewedAt: 0,
        alertsReadKeys: [],
        eventsReadKeys: [],
        alertsReadIds: [],
        eventsReadIds: [],
      };
    }
    const parsed = JSON.parse(raw);
    return {
      alertsLastViewedAt: Math.max(0, Number(parsed?.alertsLastViewedAt || 0)),
      eventsLastViewedAt: Math.max(0, Number(parsed?.eventsLastViewedAt || 0)),
      alertsReadKeys: Array.isArray(parsed?.alertsReadKeys) ? parsed.alertsReadKeys.map((value) => String(value || "").trim()).filter(Boolean) : [],
      eventsReadKeys: Array.isArray(parsed?.eventsReadKeys) ? parsed.eventsReadKeys.map((value) => String(value || "").trim()).filter(Boolean) : [],
      alertsReadIds: Array.isArray(parsed?.alertsReadIds) ? parsed.alertsReadIds.map((value) => String(value || "").trim()).filter(Boolean) : [],
      eventsReadIds: Array.isArray(parsed?.eventsReadIds) ? parsed.eventsReadIds.map((value) => String(value || "").trim()).filter(Boolean) : [],
    };
  } catch {
    return {
      alertsLastViewedAt: 0,
      eventsLastViewedAt: 0,
      alertsReadKeys: [],
      eventsReadKeys: [],
      alertsReadIds: [],
      eventsReadIds: [],
    };
  }
}

function saveMapCommunityFeedReadState(tenantKey, viewerKey, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      mapCommunityFeedStorageKey(tenantKey, viewerKey),
      JSON.stringify({
        alertsLastViewedAt: Math.max(0, Number(value?.alertsLastViewedAt || 0)),
        eventsLastViewedAt: Math.max(0, Number(value?.eventsLastViewedAt || 0)),
        alertsReadKeys: Array.isArray(value?.alertsReadKeys) ? value.alertsReadKeys.slice(-300) : [],
        eventsReadKeys: Array.isArray(value?.eventsReadKeys) ? value.eventsReadKeys.slice(-300) : [],
        alertsReadIds: Array.isArray(value?.alertsReadIds) ? value.alertsReadIds.slice(-300) : [],
        eventsReadIds: Array.isArray(value?.eventsReadIds) ? value.eventsReadIds.slice(-300) : [],
      })
    );
  } catch {
    // ignore storage failures
  }
}

function mapCommunityFeedItemTs(item) {
  return Math.max(
    Number(new Date(item?.updated_at || 0).getTime() || 0),
    Number(new Date(item?.published_at || 0).getTime() || 0),
    Number(new Date(item?.created_at || 0).getTime() || 0),
    Number(new Date(item?.starts_at || 0).getTime() || 0)
  );
}

function maxMapCommunityFeedTs(items) {
  return (items || []).reduce((max, item) => Math.max(max, mapCommunityFeedItemTs(item)), 0);
}

function mapCommunityFeedItemReadKey(item) {
  const id = String(item?.id || "").trim();
  if (!id) return "";
  return `${id}:${mapCommunityFeedItemTs(item)}`;
}

function countUnreadMapCommunityFeedItems(items, readState = {}, kind = "alerts") {
  const lastViewedAt = kind === "events"
    ? Number(readState?.eventsLastViewedAt || 0)
    : Number(readState?.alertsLastViewedAt || 0);
  const readKeys = new Set(
    kind === "events"
      ? (Array.isArray(readState?.eventsReadKeys) ? readState.eventsReadKeys : [])
      : (Array.isArray(readState?.alertsReadKeys) ? readState.alertsReadKeys : [])
  );
  const readIds = new Set(
    kind === "events"
      ? (Array.isArray(readState?.eventsReadIds) ? readState.eventsReadIds : [])
      : (Array.isArray(readState?.alertsReadIds) ? readState.alertsReadIds : [])
  );
  const threshold = Math.max(0, Number(lastViewedAt || 0));
  return (items || []).filter((item) => {
    const itemId = String(item?.id || "").trim();
    const itemKey = mapCommunityFeedItemReadKey(item);
    if (itemId && readIds.has(itemId)) return false;
    if (itemKey && readKeys.has(itemKey)) return false;
    return mapCommunityFeedItemTs(item) > threshold;
  }).length;
}

function AppIcon({ src, alt = "", size = 18, style = {} }) {
  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        objectPosition: "center center",
        display: "block",
        verticalAlign: "middle",
        ...style,
      }}
    />
  );
}

function formatStreetSignTypeLabel(raw) {
  const key = String(raw || "").trim().toLowerCase();
  const found = STREET_SIGN_TYPE_OPTIONS.find((x) => x.value === key);
  if (found) return found.label;
  if (!key) return "Other";
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function signMarkerGlyphForType(raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (key === "stop") return "🛑";
  if (key === "yield") return "Y";
  if (key === "speed_limit") return "SL";
  if (key === "warning") return "⚠️";
  if (key === "no_parking") return "NP";
  if (key === "one_way") return "→";
  if (key === "school_zone") return "SZ";
  if (key === "crosswalk") return "🚸";
  if (key === "street_name") return "St";
  return "🪧";
}

function signMarkerIconSrcForType(raw) {
  const key = String(raw || "").trim().toLowerCase();
  return STREET_SIGN_TYPE_ICON_SRC[key] || STREET_SIGN_TYPE_ICON_SRC.other;
}

function formatWaterDrainIssueLabel(raw) {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return "Water / Drain Issue";
  const fromOptions = WATER_DRAIN_ISSUE_OPTIONS.find((x) => x.value === key)?.label;
  if (fromOptions) return fromOptions;
  const fromTypes = REPORT_TYPES?.[key];
  if (fromTypes) return fromTypes;
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function waterDrainIssueKeyFromNote(note) {
  const text = String(note || "");
  if (!text) return "";
  const m = text.match(/water issue:\s*([^|]+)/i);
  const raw = String(m?.[1] || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("sewer")) return "sewer_backup";
  if (raw.includes("storm drain") || raw.includes("drain blocked") || raw.includes("flood")) {
    return "storm_drain_clog";
  }
  return "";
}

function statusFromCount(count) {
  if (count >= 4) return { label: "Confirmed Out", color: "#b71c1c" };
  if (count >= 2) return { label: "Likely Out", color: "#f57c00" };
  return { label: "Reported", color: "#616161" };
}

// Official-light severity based on reports since last fix
function officialStatusFromSinceFixCount(count) {
  if (count >= 7) return { label: "Confirmed Out", color: "#b71c1c" }; // red
  if (count >= 5) return { label: "Likely Out", color: "#f57c00" };    // orange
  if (count >= 1) return { label: "Reported", color: "#fbc02d" };      // yellow
  return { label: "Operational", color: "#111" };                      // black
}

function potholeColorFromCount(count) {
  const n = Number(count || 0);
  const yellow = officialStatusFromSinceFixCount(1).color; // keep exact streetlight yellow
  if (n >= 7) return "#b71c1c"; // red
  if (n >= 4) return "#f57c00"; // orange
  if (n >= 2) return yellow;      // yellow
  if (n >= 1) return yellow;      // private single-report view
  return "#111";
}

function waterDrainColorFromCount(count) {
  const n = Number(count || 0);
  const yellow = officialStatusFromSinceFixCount(1).color; // keep same yellow tone
  // Requested thresholds:
  // 2-3 = yellow, 4-5 = orange, >5 = red.
  if (n > 5) return "#b71c1c";  // red
  if (n >= 4) return "#f57c00"; // orange
  if (n >= 2) return yellow;    // yellow
  return "#111";
}

function majorityReportType(reports) {
  const counts = new Map();
  for (const r of reports || []) counts.set(r.type, (counts.get(r.type) || 0) + 1);

  let best = null;
  let bestN = -1;
  for (const [t, n] of counts.entries()) {
    if (n > bestN) {
      bestN = n;
      best = t;
    }
  }
  return best;
}

// ==================================================
// SECTION 4 — Geometry Helpers
// ==================================================
function metersBetween(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s));
}

function isPointInBounds(lat, lng, bounds) {
  if (!bounds) return false;
  const north = Number(bounds.north);
  const south = Number(bounds.south);
  const east = Number(bounds.east);
  const west = Number(bounds.west);
  if (![lat, lng, north, south, east, west].every(Number.isFinite)) return false;
  const latOk = lat <= north && lat >= south;
  const lngOk = west <= east ? (lng >= west && lng <= east) : (lng >= west || lng <= east);
  return latOk && lngOk;
}

function parseGeoJsonValue(raw) {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parseGeoJsonValue(parsed);
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") {
    const type = String(raw?.type || "");
    if (type === "FeatureCollection" || type === "Feature" || type === "Polygon" || type === "MultiPolygon") {
      return raw;
    }
    // Allow app_config payload wrappers, e.g. { geojson: {...} } / { value: {...} } / { boundary: {...} }.
    if (raw?.geojson) return parseGeoJsonValue(raw.geojson);
    if (raw?.value) return parseGeoJsonValue(raw.value);
    if (raw?.boundary) return parseGeoJsonValue(raw.boundary);
    if (raw?.geometry) return parseGeoJsonValue(raw.geometry);
  }
  return null;
}

function normalizePolygonRings(coords) {
  if (!Array.isArray(coords)) return [];
  return coords
    .map((ring) => {
      if (!Array.isArray(ring)) return [];
      return ring
        .map((pt) => {
          const lng = Number(pt?.[0]);
          const lat = Number(pt?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng };
        })
        .filter(Boolean);
    })
    .filter((ring) => ring.length >= 3);
}

function extractPolygonsFromGeoJson(raw) {
  const geo = parseGeoJsonValue(raw);
  if (!geo || typeof geo !== "object") return [];
  const out = [];

  const addGeometry = (geometry) => {
    const g = parseGeoJsonValue(geometry);
    if (!g || typeof g !== "object") return;
    const type = String(g.type || "");
    if (type === "Polygon") {
      const rings = normalizePolygonRings(g.coordinates);
      if (rings.length) out.push(rings);
      return;
    }
    if (type === "MultiPolygon") {
      for (const poly of g.coordinates || []) {
        const rings = normalizePolygonRings(poly);
        if (rings.length) out.push(rings);
      }
    }
  };

  const type = String(geo.type || "");
  if (type === "FeatureCollection") {
    for (const f of geo.features || []) addGeometry(f?.geometry);
  } else if (type === "Feature") {
    addGeometry(geo.geometry);
  } else {
    addGeometry(geo);
  }

  return out;
}

function boundaryViewportFromPolygons(polygons) {
  if (!Array.isArray(polygons) || polygons.length <= 0) return null;
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  let pointCount = 0;

  for (const poly of polygons) {
    if (!Array.isArray(poly)) continue;
    for (const ring of poly) {
      if (!Array.isArray(ring)) continue;
      for (const pt of ring) {
        const lat = Number(pt?.lat);
        const lng = Number(pt?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        pointCount += 1;
        if (lat > north) north = lat;
        if (lat < south) south = lat;
        if (lng > east) east = lng;
        if (lng < west) west = lng;
      }
    }
  }

  if (!(pointCount > 0)) return null;
  if (![north, south, east, west].every(Number.isFinite)) return null;

  return {
    north,
    south,
    east,
    west,
    center: {
      lat: (north + south) / 2,
      lng: (east + west) / 2,
    },
  };
}

function isPointInRing(lat, lng, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = Number(ring[i]?.lng);
    const yi = Number(ring[i]?.lat);
    const xj = Number(ring[j]?.lng);
    const yj = Number(ring[j]?.lat);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects =
      (yi > lat) !== (yj > lat) &&
      lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointInPolygons(lat, lng, polygons) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  for (const poly of polygons || []) {
    const outer = poly?.[0];
    if (!outer || !isPointInRing(lat, lng, outer)) continue;
    const holes = poly.slice(1);
    const inHole = holes.some((h) => isPointInRing(lat, lng, h));
    if (!inHole) return true;
  }
  return false;
}

function ringSignedArea(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const ax = Number(a?.lng);
    const ay = Number(a?.lat);
    const bx = Number(b?.lng);
    const by = Number(b?.lat);
    if (![ax, ay, bx, by].every(Number.isFinite)) continue;
    sum += ax * by - bx * ay;
  }
  return sum / 2;
}

function orientRing(ring, direction = "clockwise") {
  if (!Array.isArray(ring)) return [];
  const copy = ring
    .map((pt) => ({
      lat: Number(pt?.lat),
      lng: Number(pt?.lng),
    }))
    .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lng));
  if (copy.length < 3) return copy;
  const area = ringSignedArea(copy);
  const shouldClockwise = direction === "clockwise";
  const isClockwise = area < 0;
  if (shouldClockwise === isClockwise) return copy;
  return [...copy].reverse();
}

function buildWorldMaskRing() {
  const topLat = 85;
  const bottomLat = -85;
  const westLng = -179.999;
  const eastLng = 179.999;
  const lngStep = 20;
  const latStep = 20;
  const pts = [];

  for (let lng = westLng; lng <= eastLng; lng += lngStep) {
    pts.push({ lat: topLat, lng: Math.min(eastLng, lng) });
  }
  for (let lat = topLat; lat >= bottomLat; lat -= latStep) {
    pts.push({ lat: Math.max(bottomLat, lat), lng: eastLng });
  }
  for (let lng = eastLng; lng >= westLng; lng -= lngStep) {
    pts.push({ lat: bottomLat, lng: Math.max(westLng, lng) });
  }
  for (let lat = bottomLat; lat <= topLat; lat += latStep) {
    pts.push({ lat: Math.min(topLat, lat), lng: westLng });
  }
  return orientRing(pts, "clockwise");
}

function lightIdFor(lat, lng) {
  return `${lat.toFixed(5)}:${lng.toFixed(5)}`;
}

function canReport(lightId, cooldowns) {
  const last = cooldowns[lightId];
  if (!last) return true;
  return Date.now() - last > REPORT_COOLDOWN_MS;
}

function normalizeEmail(e) {
  return String(e || "").trim().toLowerCase();
}

function normalizePhone(p) {
  return String(p || "").replace(/[^\d]/g, ""); // digits only
}

function normalizeSubmitTextForKey(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 160);
}

function domainSubmitIdempotencyKey({ target, issue, note }) {
  const domain = normalizeDomainKey(target?.domain || "streetlights") || "streetlights";
  const incidentId = String(target?.lightId || target?.pothole_id || "").trim().toLowerCase();
  const srcLat = Number.isFinite(Number(target?.sourceLat)) ? Number(target?.sourceLat) : Number(target?.lat);
  const srcLng = Number.isFinite(Number(target?.sourceLng)) ? Number(target?.sourceLng) : Number(target?.lng);
  const coordKey = Number.isFinite(srcLat) && Number.isFinite(srcLng)
    ? `${srcLat.toFixed(5)},${srcLng.toFixed(5)}`
    : "";
  const issueKey = normalizeSubmitTextForKey(issue || "");
  const noteKey = normalizeSubmitTextForKey(note || "");
  return [domain, incidentId || coordKey, issueKey, noteKey].filter(Boolean).join("|").slice(0, 220);
}

function reportDomainFromLightId(lightId) {
  const v = String(lightId || "").trim().toLowerCase();
  if (v.startsWith("water_drain_issues:")) return "water_drain_issues";
  if (v.startsWith("street_signs:")) return "street_signs";
  if (v.startsWith("power_outage:")) return "power_outage";
  if (v.startsWith("water_main:")) return "water_main";
  if (v.startsWith("potholes:")) return "potholes";
  return "streetlights";
}

function incidentSnapshotKey(domain, incidentId) {
  const d = normalizeDomainKey(domain) || String(domain || "").trim().toLowerCase();
  const id = String(incidentId || "").trim();
  if (!d || !id) return "";
  return `${d}:${id}`;
}

function readReportDeepLinkRequest(search = "") {
  const params = new URLSearchParams(String(search || ""));
  const requestedDomain = normalizeDomainKey(params.get("report_domain"));
  const focusIncidentId = String(params.get("focus_incident_id") || "").trim();
  const flyLatRaw = String(params.get("fly_lat") || "").trim();
  const flyLngRaw = String(params.get("fly_lng") || "").trim();
  const flyZoomParam = String(params.get("fly_zoom") || "").trim();
  const flyLat = flyLatRaw ? Number(flyLatRaw) : Number.NaN;
  const flyLng = flyLngRaw ? Number(flyLngRaw) : Number.NaN;
  const flyZoomRaw = flyZoomParam ? Number(flyZoomParam) : Number.NaN;

  return {
    requestedDomain,
    focusIncidentId,
    flyLat,
    flyLng,
    flyZoom: Number.isFinite(flyZoomRaw) ? flyZoomRaw : 18,
    hasFlyTarget: Number.isFinite(flyLat) && Number.isFinite(flyLng),
  };
}

function incidentStateLabel(state) {
  const v = String(state || "").trim().toLowerCase();
  if (!v) return "";
  const map = {
    reported: "Reported",
    aggregated: "Aggregated",
    confirmed: "Confirmed",
    unconfirmed: "Unconfirmed",
    likely_outage: "Likely outage",
    high_confidence_outage: "High-confidence outage",
    likely_resolved: "Likely resolved",
    in_progress: "In progress",
    fixed: "Fixed",
    reopened: "Reopened",
    archived: "Archived",
    operational: "Operational",
  };
  return map[v] || v.replace(/_/g, " ");
}

function canonicalOfficialLightId(rawLightId, lat, lng, officialIdByAlias, officialIdByCoordKey) {
  const raw = String(rawLightId || "").trim();
  if (raw && officialIdByAlias?.has(raw)) return officialIdByAlias.get(raw);

  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isFinite(nLat) && Number.isFinite(nLng)) {
    const k5 = `${nLat.toFixed(5)}:${nLng.toFixed(5)}`;
    if (officialIdByCoordKey?.has(k5)) return officialIdByCoordKey.get(k5);
    const k4 = `${nLat.toFixed(4)}:${nLng.toFixed(4)}`;
    if (officialIdByCoordKey?.has(k4)) return officialIdByCoordKey.get(k4);
  }

  return raw || lightIdFor(nLat, nLng);
}

function reportNumberForRow(row, domainHint = "") {
  const domain = (domainHint || row?.domain || (row?.pothole_id ? "potholes" : reportDomainFromLightId(row?.light_id))).toLowerCase();
  const persisted = String(row?.report_number || "").trim();
  if (persisted) {
    if (domain === "street_signs") {
      const m = persisted.match(/^slr(\d+)$/i);
      if (m) return `SSR${m[1]}`;
    }
    if (domain === "water_drain_issues") {
      const m = persisted.match(/^slr(\d+)$/i);
      if (m) return `WDR${m[1]}`;
    }
    return persisted;
  }

  const prefix =
    domain === "potholes"
      ? "PHR"
      : domain === "street_signs"
        ? "SSR"
      : domain === "water_drain_issues"
        ? "WDR"
      : domain === "power_outage"
        ? "POR"
        : domain === "water_main"
          ? "WMR"
          : "SLR";

  const idRaw = row?.id;
  const asNum = Number(idRaw);
  if (Number.isFinite(asNum) && asNum > 0) return `${prefix}${String(Math.trunc(asNum)).padStart(7, "0")}`;

  const s = String(idRaw ?? `${row?.light_id || ""}|${row?.pothole_id || ""}|${row?.ts || 0}`);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `${prefix}${String(h % 10000000).padStart(7, "0")}`;
}

function shortIncidentKey(incidentId) {
  const s = String(incidentId || "").trim();
  if (!s) return "000000";
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const key = (h >>> 0).toString(36).toUpperCase();
  return key.padStart(6, "0").slice(-6);
}

function adminIncidentLabelForDomain(domain, incidentId, reportNumber, slIdByUuid, displayId = "") {
  const d = normalizeDomainKey(domain);
  const id = String(incidentId || "").trim();
  const shown = String(displayId || "").trim();
  if (!id) return "Unknown incident";
  if (d === "streetlights") return displayLightId(id, slIdByUuid);
  if (d === "street_signs") return displayLightId(id, slIdByUuid);
  if (d === "potholes") return `Pothole ID ${shown || `PH${shortIncidentKey(id)}`}`;
  if (d === "water_drain_issues") return `Water/Drain ID ${shown || `WD${shortIncidentKey(id)}`}`;
  const stableKey = shortIncidentKey(id);
  const report = String(reportNumber || "").trim();
  const domainTag =
    d === "water_drain_issues"
      ? "Water/Drain Incident"
      : d === "power_outage"
        ? "Power Outage Incident"
        : d === "water_main"
          ? "Water Main Incident"
          : "Incident";
  return report ? `${report} • ${domainTag} ${stableKey}` : `${domainTag} ${stableKey}`;
}

function extFromFileName(name, fallback = "jpg") {
  const m = String(name || "").trim().match(/\.([a-zA-Z0-9]{2,8})$/);
  return m?.[1] ? m[1].toLowerCase() : fallback;
}

function validateStrongPassword(password) {
  const v = String(password || "");
  if (v.length < 8) return false;
  if (!/[A-Z]/.test(v)) return false;
  if (!/[a-z]/.test(v)) return false;
  if (!/[0-9]/.test(v)) return false;
  if (!/[^A-Za-z0-9]/.test(v)) return false;
  return true;
}

function normalizeReportTypeValue(t) {
  return String(t || "").trim().toLowerCase();
}

function normalizeDomainKey(v) {
  const raw = String(v || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "streetlights" || raw === "streetlight") return "streetlights";
  if (raw === "street_signs" || raw === "street signs" || raw === "street_sign" || raw === "street sign" || raw === "signs") return "street_signs";
  if (raw === "potholes" || raw === "pothole") return "potholes";
  if (raw === "water_drain_issues" || raw === "water drain issues" || raw === "drain_issues" || raw === "drain issues" || raw === "sewer" || raw === "storm_drain" || raw === "storm drain") return "water_drain_issues";
  if (raw === "power_outage" || raw === "power outage" || raw === "outage" || raw === "power") return "power_outage";
  if (raw === "water_main" || raw === "water main" || raw === "water_main_break" || raw === "water main break" || raw === "water_main_breaks" || raw === "water main breaks") return "water_main";
  return "";
}

function activeTenantKey() {
  return getRuntimeTenantKey();
}

function tenantBoundaryConfigKey() {
  return `${activeTenantKey()}_city_geojson`;
}

function reportDomainForRow(row, officialIdSet, officialSignIdSet) {
  const lid = String(row?.light_id || "").trim();
  if (lid.startsWith("potholes:")) return "potholes";
  if (lid.startsWith("water_drain_issues:")) return "water_drain_issues";
  if (lid.startsWith("street_signs:")) return "street_signs";
  if (lid.startsWith("power_outage:")) return "power_outage";
  if (lid.startsWith("water_main:")) return "water_main";
  if (lid && officialSignIdSet?.has?.(lid)) return "street_signs";
  if (lid && officialIdSet?.has?.(lid)) return "streetlights";

  const explicit =
    normalizeDomainKey(row?.report_domain) ||
    normalizeDomainKey(row?.domain) ||
    normalizeDomainKey(row?.category);
  if (explicit) return explicit;

  const type = normalizeReportTypeValue(row?.type || row?.report_type);
  if (!type) return "streetlights";
  if (type.includes("sign")) return "street_signs";
  if (type.includes("pothole")) return "potholes";
  if (type.includes("sewer") || type.includes("storm_drain") || type.includes("drain")) return "water_drain_issues";
  if (type.includes("water")) return "water_main";
  if (type.includes("power")) return "power_outage";
  return "streetlights";
}

function readLocationFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const m = raw.match(/(?:^|\s)Location:\s*([^|]+?)(?:\s*\||$)/i);
  if (!m) return "";
  return String(m[1] || "").trim();
}

function stripLocationFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const withoutLocation = raw.replace(/(?:^|\s)Location:\s*([^|]+?)(?:\s*\||$)/i, "").trim();
  return withoutLocation.replace(/^\|\s*/, "").trim();
}

function readImageUrlFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const m = raw.match(/(?:^|\s)Image:\s*(https?:\/\/[^\s|]+)(?:\s*\||$)/i);
  if (!m) return "";
  return String(m[1] || "").trim();
}

function readAddressFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const m = raw.match(/(?:^|\s)Address:\s*([^|]+?)(?:\s*\||$)/i);
  if (!m) return "";
  return String(m[1] || "").trim();
}

function readLandmarkFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  const m = raw.match(/(?:^|\s)Landmark:\s*([^|]+?)(?:\s*\||$)/i);
  if (!m) return "";
  const v = String(m[1] || "").trim();
  if (!v) return "";
  if (/^\d+\s*\/\s*\d+$/.test(v)) return "";
  return v;
}

function stripSystemMetadataFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  return raw
    .replace(/(?:^|\s)Location:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Address:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Landmark:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Water issue:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Sign issue:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Sign type:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/\[SL_QA\s+power_on=(yes|no|unknown)\s+hazardous=(yes|no|unknown)\]/gi, "")
    .replace(/(?:^|\s)Image:\s*(https?:\/\/[^\s|]+)(?:\s*\||$)/gi, "")
    .replace(/^\|\s*/, "")
    .replace(/\s*\|\s*$/, "")
    .replace(/\s*\|\s*\|\s*/g, " | ")
    .replace(/^\s*Note:\s*/i, "")
    .trim();
}

function composeStreetlightQaNote(userNote, areaPowerOn, hazardYesNo) {
  const power = ["yes", "no"].includes(String(areaPowerOn || "").toLowerCase())
    ? String(areaPowerOn || "").toLowerCase()
    : "unknown";
  const hazard = ["yes", "no"].includes(String(hazardYesNo || "").toLowerCase())
    ? String(hazardYesNo || "").toLowerCase()
    : "unknown";
  const qaTag = `[SL_QA power_on=${power} hazardous=${hazard}]`;
  const noteText = String(userNote || "").trim();
  return [noteText, qaTag].filter(Boolean).join(" | ");
}

function parseStreetlightQaFromNote(note) {
  const raw = String(note || "");
  const m = raw.match(/\[SL_QA\s+power_on=(yes|no|unknown)\s+hazardous=(yes|no|unknown)\]/i);
  if (!m) return null;
  return {
    powerOn: String(m[1] || "").toLowerCase(),
    hazardous: String(m[2] || "").toLowerCase(),
  };
}

function normalizeReportQuality(q) {
  const v = String(q || "").trim().toLowerCase();
  if (v === "good" || v === "bad") return v;
  return "";
}

function isWorkingReportType(tOrRow) {
  if (tOrRow && typeof tOrRow === "object") {
    const quality = normalizeReportQuality(tOrRow.report_quality || tOrRow.quality);
    if (quality === "good") return true;
    if (quality === "bad") return false;
  }
  const raw = typeof tOrRow === "object"
    ? (tOrRow?.type || tOrRow?.report_type)
    : tOrRow;
  const t = normalizeReportTypeValue(raw);
  return t === "working" || t === "reported_working" || t === "is_working";
}

function isOutageReportType(tOrRow) {
  return !isWorkingReportType(tOrRow);
}

function parseWorkingContactFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return { name: null, email: null, phone: null };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { name: null, email: null, phone: null };

    const name = String(parsed.reporter_name || parsed.actor_name || "").trim() || null;
    const email = normalizeEmail(parsed.reporter_email || parsed.actor_email || "") || null;
    const phone = normalizePhone(parsed.reporter_phone || parsed.actor_phone || "") || null;
    return { name, email, phone };
  } catch {
    return { name: null, email: null, phone: null };
  }
}

function normalizeUtilityReportReference(value) {
  const raw = String(value || "").trim();
  return raw ? raw.slice(0, 120) : "";
}

function isMissingUtilityReportReferenceColumnError(error) {
  const text = `${String(error?.message || "")} ${String(error?.details || "")} ${String(error?.hint || "")}`.toLowerCase();
  return text.includes("report_reference") && text.includes("does not exist");
}

function reporterIdentityKey({ session, profile, guestInfo }) {
  const uid = session?.user?.id;
  if (uid) return `uid:${uid}`;

  const email = normalizeEmail(guestInfo?.email);
  if (email) return `email:${email}`;

  // fallback so guests can’t bypass cooldown by omitting email
  const phone = normalizePhone(guestInfo?.phone);
  if (phone) return `phone:${phone}`;

  // last-resort fallback (should be rare because you require name + phone/email for guests)
  const name = String(guestInfo?.name || "").trim().toLowerCase();
  if (name) return `name:${name}`;

  return null;
}

function canIdentityReportLight(
  lightId,
  {
    session,
    profile,
    guestInfo,
    reports,
    fixedLights,
    lastFixByLightId,
    potholeReports = [],
    potholeLastFixById = {},
  }
) {
  const key = reporterIdentityKey({ session, profile, guestInfo });

  // ✅ If we have an identity key, enforce via DB-backed history (works for authed + guests)
  // Rule: one report per light per identity since the light was last fixed.
  if (key) {
    const lid = String(lightId || "").trim();
    if (lid.startsWith("pothole:")) {
      const pid = lid.slice("pothole:".length).trim();
      if (!pid) return true;
      const lastFixTs = Number(potholeLastFixById?.[pid] || 0);
      for (const r of potholeReports || []) {
        if (String(r?.pothole_id || "").trim() !== pid) continue;
        const rKey = reportIdentityKey(r);
        if (!(rKey && rKey === key)) continue;
        const ts = Number(r?.ts || 0);
        if (!Number.isFinite(ts)) continue;
        if (!lastFixTs || ts > lastFixTs) return false;
      }
      return true;
    }

    const lastFixTs = Math.max(
      Number(lastFixByLightId?.[lightId] || 0),
      Number(fixedLights?.[lightId] || 0)
    );

    for (const r of reports || []) {
      if (r.light_id !== lightId) continue;

      const rKey =
        r.reporter_user_id ? `uid:${r.reporter_user_id}` :
        (normalizeEmail(r.reporter_email) ? `email:${normalizeEmail(r.reporter_email)}` :
         (normalizePhone(r.reporter_phone) ? `phone:${normalizePhone(r.reporter_phone)}` : null));

      if (!(rKey && rKey === key)) continue;

      const ts = Number(r.ts || 0);
      if (!Number.isFinite(ts)) continue;

      // If never fixed, any prior report by this identity blocks another report.
      // If fixed, only reports after the last fix block another report.
      if (!lastFixTs || ts > lastFixTs) return false;
    }

    return true;
  }

  // ✅ No identity yet → do NOT enforce device cooldown here.
  // The submit flow forces guest contact before cooldown is checked.
  return true;
}

function reportIdentityKey(r) {
  if (r?.reporter_user_id) return `uid:${r.reporter_user_id}`;
  const email = normalizeEmail(r?.reporter_email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(r?.reporter_phone);
  if (phone) return `phone:${phone}`;
  return null;
}

function incidentRepairDisplayState(snapshot) {
  if (snapshot?.archived) return "archived";
  if (snapshot?.likelyFixed) return "likely_resolved";
  return "";
}

function incidentRepairSummaryText(snapshot) {
  const repairProgress = Math.max(0, Number(snapshot?.repairProgress || 0));
  const issueScore = Number(snapshot?.issueScore || 0);
  if (snapshot?.archived) return "Archived after 2 weeks with no new activity.";
  if (snapshot?.likelyFixed) {
    return `Community repair confidence reached ${repairProgress}/${INCIDENT_REPAIR_TARGET}.`;
  }
  if (issueScore < 0) {
    return `Issue score ${issueScore} • repair progress ${repairProgress}/${INCIDENT_REPAIR_TARGET}.`;
  }
  return `Repair progress ${repairProgress}/${INCIDENT_REPAIR_TARGET}.`;
}

// Bearing (direction of travel) from 2 coords, degrees 0-360
function bearingBetween(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lng - a.lng);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const brng = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return brng;
}

function destinationPointMeters(start, distanceMeters, bearingDeg) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const R = 6378137;

  const dist = Math.max(0, Number(distanceMeters) || 0);
  const bearing = toRad(Number(bearingDeg) || 0);
  const lat1 = toRad(start.lat);
  const lon1 = toRad(start.lng);
  const angDist = dist / R;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAng = Math.sin(angDist);
  const cosAng = Math.cos(angDist);

  const lat2 = Math.asin(sinLat1 * cosAng + cosLat1 * sinAng * Math.cos(bearing));
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * sinAng * cosLat1,
    cosAng - sinLat1 * Math.sin(lat2)
  );

  return {
    lat: toDeg(lat2),
    lng: ((toDeg(lon2) + 540) % 360) - 180,
  };
}

// ==================================================
// SECTION 4A — Cooldown persistence helpers
// ==================================================
function loadCooldownsFromStorage() {
  try {
    const raw = localStorage.getItem(COOLDOWNS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function pruneCooldowns(cooldowns) {
  const now = Date.now();
  const next = {};
  for (const [lightId, ts] of Object.entries(cooldowns || {})) {
    const t = Number(ts);
    if (!Number.isFinite(t)) continue;
    if (now - t <= REPORT_COOLDOWN_MS) next[lightId] = t;
  }
  return next;
}

function saveCooldownsToStorage(cooldowns) {
  try {
    localStorage.setItem(COOLDOWNS_KEY, JSON.stringify(cooldowns));
  } catch {
    // ignore
  }
}

function loadAbuseRateFromStorage() {
  try {
    const raw = localStorage.getItem(ABUSE_RATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveAbuseRateToStorage(value) {
  try {
    localStorage.setItem(ABUSE_RATE_KEY, JSON.stringify(value || {}));
  } catch {
    // ignore
  }
}

function loadAbuseBackoffFromStorage() {
  try {
    const raw = localStorage.getItem(ABUSE_BACKOFF_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveAbuseBackoffToStorage(value) {
  try {
    localStorage.setItem(ABUSE_BACKOFF_KEY, JSON.stringify(value || {}));
  } catch {
    // ignore
  }
}

function nextAbuseBackoffMs(identityKey, retryAfterMs = ABUSE_WINDOW_MS) {
  const now = Date.now();
  const key = String(identityKey || "").trim();
  if (!key) return Math.max(1000, Number(retryAfterMs) || ABUSE_WINDOW_MS);
  const base = Math.max(1000, Number(retryAfterMs) || ABUSE_WINDOW_MS);
  const map = loadAbuseBackoffFromStorage();
  const prev = Number(map[key] || 0);
  const next = Math.min(ABUSE_BACKOFF_MAX_MS, prev > 0 ? prev * 2 : base);
  map[key] = next;
  map[`${key}:updated_at`] = now;
  saveAbuseBackoffToStorage(map);
  return next;
}

function clearAbuseBackoff(identityKey) {
  const key = String(identityKey || "").trim();
  if (!key) return;
  const map = loadAbuseBackoffFromStorage();
  delete map[key];
  delete map[`${key}:updated_at`];
  saveAbuseBackoffToStorage(map);
}

async function logAbuseEventAttempt(payload) {
  try {
    const tenantKey = activeTenantKey();
    await supabase.from("abuse_events").insert([{
      tenant_key: tenantKey,
      domain: String(payload?.domain || "streetlights"),
      identity_hash: payload?.identity_hash || null,
      ip_hash: payload?.ip_hash || null,
      event_kind: String(payload?.event_kind || "submission_attempt"),
      allowed: Boolean(payload?.allowed),
      event_count: Math.max(1, Number(payload?.event_count || 1)),
      unit_count: Math.max(1, Number(payload?.unit_count || 1)),
      reason: payload?.reason ? String(payload.reason) : null,
      metadata: payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
      created_at: new Date().toISOString(),
    }]);
  } catch {
    // non-blocking telemetry
  }
}

function registerAbuseEvent({
  session,
  profile,
  guestInfo,
  domain = "streetlights",
  count = 1,
  bypass = false,
}) {
  if (bypass) return { allowed: true, remaining: ABUSE_MAX_EVENTS_PER_WINDOW };
  const identity = reporterIdentityKey({ session, profile, guestInfo });
  if (!identity) return { allowed: true, remaining: ABUSE_MAX_EVENTS_PER_WINDOW };

  const now = Date.now();
  const safeCount = Math.max(1, Math.trunc(Number(count) || 1));
  const key = `${identity}::${normalizeDomainKey(domain) || "streetlights"}`;
  const buckets = loadAbuseRateFromStorage();
  const windowStart = now - ABUSE_WINDOW_MS;
  const prev = Array.isArray(buckets[key]) ? buckets[key] : [];
  const active = prev.filter((x) => Number.isFinite(Number(x?.ts)) && Number(x.ts) >= windowStart);
  const used = active.reduce((acc, x) => acc + Math.max(1, Math.trunc(Number(x?.count) || 1)), 0);

  if (used + safeCount > ABUSE_MAX_EVENTS_PER_WINDOW) {
    const backoffMs = nextAbuseBackoffMs(key, ABUSE_WINDOW_MS - (now - Number(active[0]?.ts || now)));
    void logAbuseEventAttempt({
      domain: normalizeDomainKey(domain) || "streetlights",
      identity_hash: identity,
      event_kind: "rate_limit_block_local",
      allowed: false,
      event_count: safeCount,
      unit_count: safeCount,
      reason: "local_event_cap",
      metadata: { used, cap: ABUSE_MAX_EVENTS_PER_WINDOW, retry_after_ms: backoffMs },
    });
    return {
      allowed: false,
      remaining: Math.max(0, ABUSE_MAX_EVENTS_PER_WINDOW - used),
      retryAfterMs: backoffMs,
    };
  }

  const nextActive = [...active, { ts: now, count: safeCount }];
  buckets[key] = nextActive;
  saveAbuseRateToStorage(buckets);
  clearAbuseBackoff(key);
  return {
    allowed: true,
    remaining: Math.max(0, ABUSE_MAX_EVENTS_PER_WINDOW - (used + safeCount)),
  };
}

function openRateLimitNotice(openNoticeFn, abuseGate) {
  const waitMins = Math.max(1, Math.ceil((abuseGate?.retryAfterMs || ABUSE_WINDOW_MS) / 60000));
  const hitLightCap = Number(abuseGate?.remainingUnits) <= 0;
  const body = hitLightCap
    ? `Too many reported lights in a short window. Please wait about ${waitMins} minute${waitMins === 1 ? "" : "s"} and try again.`
    : `Too many submissions. Please wait about ${waitMins} minute${waitMins === 1 ? "" : "s"} and try again.`;
  if (typeof openNoticeFn === "function") {
    openNoticeFn("⏳", "Rate limited", body);
  }
}

async function registerAbuseEventWithServer({
  session,
  profile,
  guestInfo,
  domain = "streetlights",
  count = 1,
  unitCount = 1,
  idempotencyKey = "",
  bypass = false,
}) {
  // Never bypass abuse/rate controls for real submits.
  const effectiveBypass = false;
  const identity = {
    user_id: session?.user?.id || null,
    email: normalizeEmail(guestInfo?.email || profile?.email || session?.user?.email || "") || null,
    phone: normalizePhone(guestInfo?.phone || profile?.phone || "") || null,
    name: String(guestInfo?.name || profile?.full_name || session?.user?.user_metadata?.full_name || "").trim() || null,
  };
  const identityKey = reporterIdentityKey({ session, profile, guestInfo });
  const normalizedDomain = normalizeDomainKey(domain) || "streetlights";
  const tenantKey = activeTenantKey();

  try {
    const { data, error } = await supabase.functions.invoke(ABUSE_GATE_FUNCTION, {
      body: {
        tenant_key: tenantKey,
        domain: normalizeDomainKey(domain) || "streetlights",
        count: Math.max(1, Math.trunc(Number(count) || 1)),
        unitCount: Math.max(1, Math.trunc(Number(unitCount) || 1)),
        idempotency_key: String(idempotencyKey || "").trim() || null,
        windowMs: ABUSE_WINDOW_MS,
        maxEvents: ABUSE_MAX_EVENTS_PER_WINDOW,
        maxUnits: ABUSE_MAX_LIGHTS_PER_WINDOW,
        identity,
      },
    });

    if (!error && data && typeof data === "object") {
      if (data.allowed === false) {
        const retryAfterMsRaw = Number.isFinite(Number(data.retryAfterMs))
          ? Number(data.retryAfterMs)
          : ABUSE_WINDOW_MS;
        const retryAfterMs = nextAbuseBackoffMs(identityKey, retryAfterMsRaw);
        void logAbuseEventAttempt({
          domain: normalizedDomain,
          identity_hash: identityKey || null,
          event_kind: "rate_limit_block_server",
          allowed: false,
          event_count: Math.max(1, Math.trunc(Number(count) || 1)),
          unit_count: Math.max(1, Math.trunc(Number(unitCount) || 1)),
          reason: "server_gate_denied",
          metadata: {
            remaining: Number(data.remaining || 0),
            remaining_units: Number(data.remainingUnits || 0),
            retry_after_ms: retryAfterMs,
          },
        });
        return {
          allowed: false,
          remaining: Number.isFinite(Number(data.remaining)) ? Number(data.remaining) : 0,
          remainingUnits: Number.isFinite(Number(data.remainingUnits))
            ? Number(data.remainingUnits)
            : 0,
          retryAfterMs,
        };
      }
      if (data.allowed === true) {
        clearAbuseBackoff(identityKey);
        return {
          allowed: true,
          duplicate: Boolean(data.duplicate),
          remaining: Number.isFinite(Number(data.remaining))
            ? Number(data.remaining)
            : ABUSE_MAX_EVENTS_PER_WINDOW,
          remainingUnits: Number.isFinite(Number(data.remainingUnits))
            ? Number(data.remainingUnits)
            : ABUSE_MAX_LIGHTS_PER_WINDOW,
        };
      }
    } else if (error) {
      console.warn("[abuse gate] server function error, using local fallback:", error?.message || error);
    }
  } catch (e) {
    console.warn("[abuse gate] server function exception, using local fallback:", e?.message || e);
  }

  return registerAbuseEvent({
    session,
    profile,
    guestInfo,
    domain,
    count,
    bypass: effectiveBypass || bypass,
  });
}

// ==================================================
// SECTION 5 — Group reports into streetlights
// ==================================================
function groupIntoLights(reports) {
  const lights = [];

  for (const r of reports) {
    let placed = false;

    for (const light of lights) {
      const dist = metersBetween(
        { lat: r.lat, lng: r.lng },
        { lat: light.lat, lng: light.lng }
      );

      if (dist <= GROUP_RADIUS_METERS) {
        light.reports.push(r);

        const n = light.reports.length;
        light.lat = (light.lat * (n - 1) + r.lat) / n;
        light.lng = (light.lng * (n - 1) + r.lng) / n;

        placed = true;
        break;
      }
    }

    if (!placed) {
      lights.push({
        lat: r.lat,
        lng: r.lng,
        reports: [r],
      });
    }
  }

  return lights.map((l) => {
    const counts = new Map();
    for (const r of l.reports) {
      const id = r.light_id || lightIdFor(r.lat, r.lng);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    let primary = null;
    let best = -1;
    for (const [id, n] of counts.entries()) {
      if (n > best) {
        best = n;
        primary = id;
      }
    }
    return { ...l, lightId: primary };
  });
}

function findNearestLightWithinRadius(lights, lat, lng) {
  let best = null;
  let bestDist = Infinity;

  for (const l of lights) {
    const dist = metersBetween({ lat, lng }, { lat: l.lat, lng: l.lng });
    if (dist <= GROUP_RADIUS_METERS && dist < bestDist) {
      bestDist = dist;
      best = l;
    }
  }
  return best;
}

function findNearestOfficialWithinRadius(officialLights, lat, lng) {
  let best = null;
  let bestDist = Infinity;

  for (const ol of officialLights || []) {
    const dist = metersBetween({ lat, lng }, { lat: ol.lat, lng: ol.lng });
    if (dist <= GROUP_RADIUS_METERS && dist < bestDist) {
      bestDist = dist;
      best = ol;
    }
  }
  return best;
}


// ==================================================
// SECTION 6 — Marker helpers
// ==================================================
function svgDotDataUrl(fill = "#111", r = 7) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
      <circle cx="10" cy="10" r="${r}" fill="${fill}" stroke="${r}" stroke-width="2"/>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const MAP_MARKER_SIZE = 26;
const MAP_MARKER_CENTER = MAP_MARKER_SIZE / 2;
const MAP_MARKER_RADIUS = 9.2;
const MAP_MARKER_STROKE = 2.2;
const MAP_MARKER_GLYPH_SIZE = 15;
const STREET_SIGN_MARKER_SIZE = MAP_MARKER_SIZE * 1.10;

// CMD+F: function gmapsDotIcon
function gmapsDotIcon(color = "#1976d2", ringColor = "white", glyph = "💡", glyphSrc = "") {
  const c = color || "#1976d2";
  const r = ringColor || "white";
  const gph = String(glyph || "💡");
  const gsrc = String(glyphSrc || "").trim();
  const gsrcResolved = (() => {
    if (!gsrc) return "";
    if (/^(https?:|data:)/i.test(gsrc)) return gsrc;
    if (gsrc.startsWith("/") && typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${gsrc}`;
    }
    return gsrc;
  })();
  const isPotholeGlyph = gph.includes("🕳");
  const isPotholeImage = /(^|\/)pothole_icon\.png(\?|$)/i.test(gsrcResolved);
  const MARKER_SIZE = MAP_MARKER_SIZE;
  const MARKER_CENTER = MAP_MARKER_CENTER;
  const MARKER_RADIUS = MAP_MARKER_RADIUS;
  const textY = isPotholeGlyph ? 13.8 : 14.5;
  const textSize = isPotholeGlyph ? 13.5 : 14;
  const g = window.google?.maps;

  // Prefer canvas composition for image glyphs (more reliable than <image href> in SVG data URLs across environments).
  let glyphImg = null;
  if (gsrcResolved && typeof window !== "undefined") {
    gmapsDotIcon._imgCache ||= new Map();
    let img = gmapsDotIcon._imgCache.get(gsrcResolved);
    if (!img) {
      img = new Image();
      img.decoding = "async";
      img.src = gsrcResolved;
      gmapsDotIcon._imgCache.set(gsrcResolved, img);
    }
    if (img.complete && img.naturalWidth > 0) glyphImg = img;
  }

  const usingImageGlyph = Boolean(glyphImg);
  const cacheKey = `${c}|${r}|${gph}|${gsrcResolved}|${MARKER_SIZE}|${MARKER_RADIUS}|${MAP_MARKER_STROKE}|${MAP_MARKER_GLYPH_SIZE}|${textY}|${textSize}|${usingImageGlyph ? "img" : "txt"}|${g ? "g" : "nog"}`;
  gmapsDotIcon._cache ||= new Map();
  if (gmapsDotIcon._cache.has(cacheKey)) return gmapsDotIcon._cache.get(cacheKey);

  let url = "";
  if (usingImageGlyph && typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = MARKER_SIZE;
    canvas.height = MARKER_SIZE;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.arc(MARKER_CENTER, MARKER_CENTER, MARKER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.lineWidth = MAP_MARKER_STROKE;
      ctx.strokeStyle = r;
      ctx.stroke();
      const imgSize = MAP_MARKER_GLYPH_SIZE;
      const imgX = (MARKER_SIZE - imgSize) / 2;
      const imgY = (MARKER_SIZE - imgSize) / 2;
      ctx.drawImage(glyphImg, imgX, imgY, imgSize, imgSize);
      url = canvas.toDataURL("image/png");
    }
  }

  const fallbackGlyph = isPotholeImage ? "" : gph;
  if (!url) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_SIZE}" height="${MARKER_SIZE}" viewBox="0 0 ${MARKER_SIZE} ${MARKER_SIZE}">
        <circle cx="${MARKER_CENTER}" cy="${MARKER_CENTER}" r="${MARKER_RADIUS}" fill="${c}" stroke="${r}" stroke-width="${MAP_MARKER_STROKE}" />
        ${fallbackGlyph ? `<text x="${MARKER_CENTER}" y="${textY}" text-anchor="middle" dominant-baseline="central" font-size="${textSize}">${fallbackGlyph}</text>` : ""}
      </svg>
    `.trim();
    url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  // If google maps isn't ready yet, returning {url} is fine
  if (!g) return { url };

  const icon = {
    url,
    scaledSize: new g.Size(MARKER_SIZE, MARKER_SIZE),
    anchor: new g.Point(MARKER_CENTER, MARKER_CENTER),
  };
  gmapsDotIcon._cache.set(cacheKey, icon);
  return icon;
}

function gmapsImageIcon(src = "", size = STREET_SIGN_MARKER_SIZE, opts = {}) {
  const raw = String(src || "").trim();
  if (!raw) return gmapsDotIcon();
  const border = Boolean(opts?.border);
  const borderColor = String(opts?.borderColor || "#39ff14");
  const borderWidth = Number(opts?.borderWidth || 3);
  const resolved = (() => {
    if (/^(https?:|data:)/i.test(raw)) return raw;
    if (raw.startsWith("/") && typeof window !== "undefined" && window.location?.origin) {
      return `${window.location.origin}${raw}`;
    }
    return raw;
  })();
  const g = window.google?.maps;
  const px = Number(size) > 0 ? Number(size) : STREET_SIGN_MARKER_SIZE;
  if (!border) {
    if (!g) return { url: resolved };
    return {
      url: resolved,
      scaledSize: new g.Size(px, px),
      anchor: new g.Point(px / 2, px / 2),
    };
  }

  // Bordered icon variant (used for queued sign mapping markers).
  let borderedUrl = "";
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    gmapsImageIcon._imgCache ||= new Map();
    let img = gmapsImageIcon._imgCache.get(resolved);
    if (!img) {
      img = new Image();
      img.decoding = "async";
      img.src = resolved;
      gmapsImageIcon._imgCache.set(resolved, img);
    }
    if (img.complete && img.naturalWidth > 0) {
      const cacheKey = `${resolved}|${px}|border|${borderColor}|${borderWidth}`;
      gmapsImageIcon._borderCache ||= new Map();
      if (gmapsImageIcon._borderCache.has(cacheKey)) {
        borderedUrl = gmapsImageIcon._borderCache.get(cacheKey);
      } else {
        const pad = Math.max(4, Math.ceil(borderWidth) + 3);
        const canvasSize = px + pad * 2;
        const canvas = document.createElement("canvas");
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const x = pad;
          const y = pad;
          ctx.drawImage(img, x, y, px, px);
          const cx = canvasSize / 2;
          const cy = canvasSize / 2;
          const radius = (px / 2) + 1;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = Math.max(2, borderWidth);
          ctx.stroke();
          borderedUrl = canvas.toDataURL("image/png");
          gmapsImageIcon._borderCache.set(cacheKey, borderedUrl);
        }
      }
    }
  }

  const finalUrl = borderedUrl || resolved;
  const finalSize = borderedUrl ? px + Math.max(4, Math.ceil(borderWidth) + 3) * 2 : px;
  const anchor = finalSize / 2;
  if (!g) return { url: finalUrl };
  return {
    url: finalUrl,
    scaledSize: new g.Size(finalSize, finalSize),
    anchor: new g.Point(anchor, anchor),
  };
}

function gmapsUserLocIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="5" fill="#1976d2" stroke="white" stroke-width="2" />
    </svg>
  `.trim();

  const url = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);

  const g = window.google?.maps;
  if (!g) return { url };

  return {
    url,
    scaledSize: new g.Size(18, 18),
    anchor: new g.Point(9, 9),
  };
}

const OFFICIAL_MARKER_SHAPE = {
  type: "circle",
  // Smaller hit area than the full 24x24 icon so pan/zoom gestures are easier to start.
  coords: [MAP_MARKER_CENTER, MAP_MARKER_CENTER, Math.round(MAP_MARKER_RADIUS)],
};

function displayLightId(lightUuid, slIdByUuid) {
  const key = (lightUuid || "").trim();
  return (slIdByUuid?.get?.(key) || "").trim() || key || "—";
}



// ==================================================
// SECTION 7 — Map helpers
// ==================================================
function MapClickHandler({ onPick, suppressClickRef, clickDelayRef, enableTwoTapZoom = true }) {
  useMapEvents({
    click(e) {
      // block clicks triggered by zoom gesture / suppress window
      const until = suppressClickRef?.current?.until || 0;
      if (Date.now() < until) return;

      const t = e?.originalEvent?.target;

      // Ignore clicks inside popup / controls
      if (t && (t.closest?.(".leaflet-popup") || t.closest?.(".leaflet-control"))) return;

      // If we’re not using the two-tap zoom behavior, act immediately
      if (!enableTwoTapZoom) {
        onPick([e.latlng.lat, e.latlng.lng]);
        return;
      }

      // ✅ Delay the "report" action so a second tap can cancel it
      const ref = clickDelayRef?.current;
      if (!ref) {
        onPick([e.latlng.lat, e.latlng.lng]);
        return;
      }

      const now = Date.now();
      const dt = now - (ref.lastTs || 0);
      ref.lastTs = now;

      // If this is a second tap quickly after the first, cancel pending report
      if (dt < 350) {
        if (ref.timer) clearTimeout(ref.timer);
        ref.timer = null;

        // also suppress the synthetic click that might follow
        if (suppressClickRef?.current) suppressClickRef.current.until = Date.now() + 800;
        return;
      }

      // Start / restart the delayed report timer
      if (ref.timer) clearTimeout(ref.timer);
      ref.lastLatLng = e.latlng;

      ref.timer = setTimeout(() => {
        ref.timer = null;
        const p = ref.lastLatLng || e.latlng;
        onPick([p.lat, p.lng]);
      }, 360);
    },
  });

  // cleanup if component unmounts
  useEffect(() => {
    return () => {
      const ref = clickDelayRef?.current;
      if (ref?.timer) clearTimeout(ref.timer);
    };
  }, [clickDelayRef]);

  return null;
}


function MapUserInteractionWatcher({ onUserInteract }) {
  useMapEvents({
    dragstart: onUserInteract,
    zoomstart: onUserInteract,
  });
  return null;
}

function MapZoomWatcher({ onZoom }) {
  const map = useMap();

  useEffect(() => {
    const emit = () => onZoom(map.getZoom());
    emit();
    map.on("zoomend", emit);
    return () => map.off("zoomend", emit);
  }, [map, onZoom]);

  return null;
}

function MapInteractionLock({ locked }) {
  const map = useMap();

  useEffect(() => {
    if (!locked) return;

    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();

    return () => {
      map.dragging.enable();
      map.touchZoom.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    };
  }, [locked, map]);

  return null;
}

function MapTwoTapHoldDragZoom({ enabled = true, suppressClickRef, clickDelayRef }) {
  const map = useMap();

  const stateRef = useRef({
    lastTapTs: 0,
    tapCount: 0,
    resetTimer: null,

    longPressTimer: null,
    active: false,

    startY: 0,
    startZoom: 0,
    anchorLatLng: null,
    pointerId: null,
  });

  useEffect(() => {
    if (!enabled) return;

    const container = map.getContainer();

    const isUI = (target) => {
      if (!target?.closest) return false;
      return Boolean(
        target.closest(".leaflet-control") ||
          target.closest(".leaflet-popup") ||
          target.closest(".leaflet-marker-icon") ||
          target.closest(".leaflet-interactive")
      );
    };

    const clearTimers = () => {
      const s = stateRef.current;
      if (s.resetTimer) clearTimeout(s.resetTimer);
      if (s.longPressTimer) clearTimeout(s.longPressTimer);
      s.resetTimer = null;
      s.longPressTimer = null;
    };

    const onPointerDown = (ev) => {
      if (!enabled) return;
      if (ev.pointerType !== "touch") return; // only touch gesture
      if (isUI(ev.target)) return;

      const s = stateRef.current;
      const now = Date.now();
      const dt = now - (s.lastTapTs || 0);
      s.lastTapTs = now;

      if (dt < 350) s.tapCount += 1;
      else s.tapCount = 1;

      clearTimers();

      s.resetTimer = setTimeout(() => {
        s.tapCount = 0;
      }, 500);

      // only arm on 2nd tap
      if (s.tapCount !== 2) return;

      // ✅ cancel any pending "report" timer from MapClickHandler
      const cref = clickDelayRef?.current;
      if (cref?.timer) {
        clearTimeout(cref.timer);
        cref.timer = null;
      }

      // ✅ tap #2 begins zoom gesture → suppress upcoming synthetic click
      if (suppressClickRef?.current) suppressClickRef.current.until = Date.now() + 900;

      // capture this pointer so we only track this finger
      s.pointerId = ev.pointerId;
      try {
        container.setPointerCapture?.(ev.pointerId);
      } catch {}

      const p = map.mouseEventToLatLng(ev);
      s.anchorLatLng = p;
      s.startY = ev.clientY;
      s.startZoom = map.getZoom();

      // long-press threshold to enter zoom mode
      s.longPressTimer = setTimeout(() => {
        s.active = true;

        // disable default interactions while zoom-dragging
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
      }, 140);
    };

    const onPointerMove = (ev) => {
      const s = stateRef.current;
      if (!enabled) return;
      if (!s.active) return;
      if (ev.pointerId !== s.pointerId) return;

      ev.preventDefault?.();

      const dy = ev.clientY - s.startY;
      const deltaZoom = -(dy / 120); // 120px ~= 1 zoom
      let nextZoom = s.startZoom + deltaZoom;

      const minZ = map.getMinZoom?.() ?? 0;
      const maxZ = map.getMaxZoom?.() ?? 22;
      nextZoom = Math.max(minZ, Math.min(maxZ, nextZoom));

      const anchor = s.anchorLatLng || map.getCenter();
      map.setZoomAround(anchor, nextZoom, { animate: false });

      // keep clicks suppressed while actively zooming
      if (suppressClickRef?.current) suppressClickRef.current.until = Date.now() + 800;
    };

    const endZoom = () => {
      const s = stateRef.current;

      if (s.longPressTimer) {
        clearTimeout(s.longPressTimer);
        s.longPressTimer = null;
      }

      if (s.active) {
        s.active = false;

        // ✅ small extra suppression window for the release click
        if (suppressClickRef?.current) suppressClickRef.current.until = Date.now() + 500;

        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
      }

      s.pointerId = null;
    };

    const onPointerUp = (ev) => {
      const s = stateRef.current;
      if (ev.pointerId !== s.pointerId) {
        // even if not captured, still end timers
        endZoom();
        return;
      }
      endZoom();
    };

    container.addEventListener("pointerdown", onPointerDown, { passive: true });
    container.addEventListener("pointermove", onPointerMove, { passive: false });
    container.addEventListener("pointerup", onPointerUp, { passive: true });
    container.addEventListener("pointercancel", onPointerUp, { passive: true });

    return () => {
      clearTimers();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
    };
  }, [enabled, map, suppressClickRef]);

  return null;
}

function MapFlyTo({ target }) {
  const map = useMap();

  useEffect(() => {
    if (!target?.pos) return;
    const z = Number.isFinite(target.zoom) ? target.zoom : map.getZoom();
    map.flyTo(target.pos, z, { duration: 0.8 });
  }, [map, target?.nonce]);

  return null;
}

// Smooth marker movement (removes stutter)
function SmoothUserMarker({ position }) {
  const markerRef = useRef(null);
  const lastRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!position) return;

    const next = { lat: Number(position.lat), lng: Number(position.lng) };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

    const marker = markerRef.current;
    if (!marker) {
      lastRef.current = next;
      return;
    }

    const prev = lastRef.current || next;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const start = performance.now();
    const duration = 520;

    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);

      const lat = prev.lat + (next.lat - prev.lat) * eased;
      const lng = prev.lng + (next.lng - prev.lng) * eased;
      marker.setPosition({ lat, lng });

      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
        lastRef.current = next;
      }
    };

    rafRef.current = requestAnimationFrame(step);
  }, [position?.lat, position?.lng]);

  if (!position) return null;

  return (
    <MarkerF
      position={position}
      icon={gmapsUserLocIcon()}
      title="You are here"
      clickable={false}
      zIndex={1}
      onLoad={(marker) => {
        markerRef.current = marker;
        lastRef.current = { lat: Number(position.lat), lng: Number(position.lng) };
      }}
    />
  );
}

const OfficialLightsLayer = memo(function OfficialLightsLayer({
  show,
  lights,
  bulkMode,
  bulkSelectedSet,
  getMarkerColor,
  getMarkerRingColor,
  onMarkerClick,
}) {
  if (!show) return null;
  return (lights || []).map((ol) => {
    const isSelected = bulkMode && bulkSelectedSet.has(ol.id);
    const baseColor = getMarkerColor(ol.id);
    const iconColor = isSelected ? "#1976d2" : baseColor;

    return (
      <MarkerF
        key={ol.id}
        position={{ lat: ol.lat, lng: ol.lng }}
        icon={gmapsDotIcon(iconColor, getMarkerRingColor?.(ol.id) || "#fff", "💡", UI_ICON_SRC.streetlight)}
        shape={OFFICIAL_MARKER_SHAPE}
        optimized
        onClick={() => onMarkerClick(ol.id)}
      />
    );
  });
});

const OfficialLightsCanvasOverlay = memo(forwardRef(function OfficialLightsCanvasOverlay({
  map,
  show,
  lights,
  bulkMode,
  bulkSelectedSet,
  getMarkerColor,
  getMarkerRingColor,
}, ref) {
  const overlayObjRef = useRef(null);
  const canvasRef = useRef(null);
  const hitPointsRef = useRef([]);
  const glyphImgRef = useRef(null);
  const latestRef = useRef({
    show,
    lights,
    bulkMode,
    bulkSelectedSet,
    getMarkerColor,
    getMarkerRingColor,
  });

  latestRef.current = { show, lights, bulkMode, bulkSelectedSet, getMarkerColor, getMarkerRingColor };

  useEffect(() => {
    const img = new Image();
    img.src = UI_ICON_SRC.streetlight;
    glyphImgRef.current = img;
    const onLoad = () => drawOverlayCanvas();
    if (img.complete && img.naturalWidth > 0) {
      onLoad();
    } else {
      img.onload = onLoad;
    }
    return () => {
      if (glyphImgRef.current === img) glyphImgRef.current = null;
      img.onload = null;
    };
  }, []);

  const drawOverlayCanvas = useCallback(() => {
    const overlay = overlayObjRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas || !map) return;

    const projection = overlay.getProjection?.();
    if (!projection) return;

    const div = map.getDiv?.();
    const width = Number(div?.clientWidth || 0);
    const height = Number(div?.clientHeight || 0);
    if (width <= 0 || height <= 0) return;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const state = latestRef.current;
    if (!state.show) {
      hitPointsRef.current = [];
      return;
    }

    const hit = [];
    const margin = 24;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "10px system-ui, -apple-system, sans-serif";

    for (const ol of state.lights || []) {
      const ll = new window.google.maps.LatLng(ol.lat, ol.lng);
      const pt = projection.fromLatLngToContainerPixel
        ? projection.fromLatLngToContainerPixel(ll)
        : projection.fromLatLngToDivPixel(ll);
      const x = Number(pt?.x);
      const y = Number(pt?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < -margin || x > width + margin || y < -margin || y > height + margin) continue;

      const isSelected = state.bulkMode && state.bulkSelectedSet?.has?.(ol.id);
      const baseColor = state.getMarkerColor(ol.id);
      const color = isSelected ? "#1976d2" : baseColor;

      ctx.beginPath();
      ctx.arc(x, y, MAP_MARKER_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color || "#1976d2";
      ctx.fill();
      ctx.lineWidth = MAP_MARKER_STROKE;
      ctx.strokeStyle = state.getMarkerRingColor?.(ol.id) || "#fff";
      ctx.stroke();

      // Draw streetlight icon glyph (fallback to emoji if image is not ready yet).
      const glyphImg = glyphImgRef.current;
      if (glyphImg && glyphImg.complete && glyphImg.naturalWidth > 0) {
        const glyphSize = MAP_MARKER_GLYPH_SIZE;
        const glyphHalf = glyphSize / 2;
        ctx.drawImage(glyphImg, x - glyphHalf, y - glyphHalf, glyphSize, glyphSize);
      } else {
        ctx.fillStyle = "#111";
        ctx.font = "12px system-ui, -apple-system, sans-serif";
        ctx.fillText("💡", x, y + 0.5);
      }

      hit.push({ id: ol.id, x, y });
    }

    hitPointsRef.current = hit;
  }, [map]);

  useImperativeHandle(ref, () => ({
    redraw() {
      drawOverlayCanvas();
    },
    hitTestByLatLng(lat, lng, radiusPx = 17) {
      const overlay = overlayObjRef.current;
      if (!overlay || !latestRef.current?.show) return null;
      const projection = overlay.getProjection?.();
      if (!projection) return null;
      const ll = new window.google.maps.LatLng(Number(lat), Number(lng));
      const pt = projection.fromLatLngToContainerPixel
        ? projection.fromLatLngToContainerPixel(ll)
        : projection.fromLatLngToDivPixel(ll);
      const x = Number(pt?.x);
      const y = Number(pt?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

      let best = null;
      let bestD2 = radiusPx * radiusPx;
      for (const h of hitPointsRef.current || []) {
        const dx = h.x - x;
        const dy = h.y - y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
          best = h.id;
          bestD2 = d2;
        }
      }
      return best;
    },
    projectLatLngToContainerPixel(lat, lng) {
      const overlay = overlayObjRef.current;
      if (!overlay) return null;
      const projection = overlay.getProjection?.();
      if (!projection) return null;
      const ll = new window.google.maps.LatLng(Number(lat), Number(lng));
      const pt = projection.fromLatLngToContainerPixel
        ? projection.fromLatLngToContainerPixel(ll)
        : projection.fromLatLngToDivPixel(ll);
      const x = Number(pt?.x);
      const y = Number(pt?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return { x, y };
    },
  }), [drawOverlayCanvas]);

  useEffect(() => {
    if (!map || !window.google?.maps) return;

    const overlay = new window.google.maps.OverlayView();
    overlay.onAdd = () => {
      const canvas = document.createElement("canvas");
      canvas.style.position = "absolute";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "1";
      canvasRef.current = canvas;
      const mapDiv = map.getDiv?.();
      if (mapDiv) {
        const pos = window.getComputedStyle(mapDiv).position;
        if (!pos || pos === "static") mapDiv.style.position = "relative";
        mapDiv.insertBefore(canvas, mapDiv.firstChild || null);
      }
    };
    overlay.draw = () => {
      drawOverlayCanvas();
    };
    overlay.onRemove = () => {
      try { canvasRef.current?.remove(); } catch {}
      canvasRef.current = null;
      hitPointsRef.current = [];
    };

    overlay.setMap(map);
    overlayObjRef.current = overlay;

    return () => {
      try { overlay.setMap(null); } catch {}
      overlayObjRef.current = null;
      canvasRef.current = null;
      hitPointsRef.current = [];
    };
  }, [map, drawOverlayCanvas]);

  useEffect(() => {
    drawOverlayCanvas();
  }, [drawOverlayCanvas, show, lights, bulkMode, bulkSelectedSet, getMarkerColor, getMarkerRingColor]);

  return null;
}));

function ModalShell({ open, children, zIndex = 9999, panelStyle }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: "center",
        zIndex,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--sl-ui-modal-bg)",
          border: "1px solid var(--sl-ui-modal-border)",
          color: "var(--sl-ui-text)",
          fontFamily: "var(--app-header-font-family)",
          padding: 18,
          borderRadius: 10,
          width: "min(360px, 100%)",
          display: "grid",
          gap: 12,
          boxShadow: "var(--sl-ui-modal-shadow)",
          ...(panelStyle || {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ConfirmReportModal({
  open,
  onCancel,
  onConfirm,
  reportType,
  setReportType,
  note,
  setNote,
  areaPowerOn,
  setAreaPowerOn,
  hazardYesNo,
  setHazardYesNo,
  saving,
  titleLabel = "Save this report?",
  confirmLabel = "Save light",
}) {
  const notesRequired = reportType === "other";
  const notesMissing = notesRequired && !note.trim();
  const showSafetyNote = reportType === "downed_pole";
  const powerAnswered = areaPowerOn === "yes" || areaPowerOn === "no";
  const hazardRequired = areaPowerOn === "yes";
  const hazardAnswered = !hazardRequired || hazardYesNo === "yes" || hazardYesNo === "no";

  const canSubmit =
    !saving &&
    !notesMissing &&
    powerAnswered &&
    hazardAnswered &&
    hazardYesNo !== "yes";



  useEffect(() => {
    if (open) {
      setAreaPowerOn("");
      setHazardYesNo("");
    }
  }, [open]);

  return (
    <ModalShell open={open} zIndex={9999}>
      <div style={{ fontSize: 16, fontWeight: 900 }}>{titleLabel}</div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 900 }}>Power & Safety</div>

        <div style={{ fontSize: 13, lineHeight: 1.25 }}>
          Is power on in the immediate area of the affected light?{" "}
          <span style={{ color: "#b71c1c", fontWeight: 900 }}>*</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setAreaPowerOn("yes");
              setHazardYesNo("");
            }}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.15)",
              background: areaPowerOn === "yes" ? "#111" : "white",
              color: areaPowerOn === "yes" ? "white" : "#111",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            Yes
          </button>

          <button
            type="button"
            onClick={() => {
              setAreaPowerOn("no");
              setHazardYesNo("");
            }}
            disabled={saving}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.15)",
              background: areaPowerOn === "no" ? "#111" : "white",
              color: areaPowerOn === "no" ? "white" : "#111",
              fontWeight: 900,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            No
          </button>
        </div>

        {areaPowerOn === "no" && (
          <div style={{ fontSize: 12, opacity: 0.75, lineHeight: 1.35 }}>
            Note: If power is out in the area, this may be part of a larger outage. (Power outage
            reporting will be added later.)
          </div>
        )}

        {areaPowerOn === "yes" && (
          <>
            <div style={{ fontSize: 13, lineHeight: 1.25 }}>
              Does the light present a hazardous situation?{" "}
              <span style={{ color: "#b71c1c", fontWeight: 900 }}>*</span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setHazardYesNo("yes")}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: hazardYesNo === "yes" ? "#111" : "white",
                  color: hazardYesNo === "yes" ? "white" : "#111",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                Yes
              </button>

              <button
                type="button"
                onClick={() => setHazardYesNo("no")}
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: hazardYesNo === "no" ? "#111" : "white",
                  color: hazardYesNo === "no" ? "white" : "#111",
                  fontWeight: 900,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                No
              </button>
            </div>

            {hazardYesNo === "yes" && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--sl-ui-alert-danger-border)",
                  background: "var(--sl-ui-alert-danger-bg)",
                  color: "var(--sl-ui-alert-danger-text)",
                  fontWeight: 900,
                  fontSize: 12.5,
                  lineHeight: 1.35,
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <div style={{ fontSize: 16, lineHeight: 1 }}>⚠️</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 950 }}>Safety warning</div>
                  <div style={{ marginTop: 2 }}>
                    Please stay away from the area and call emergency services if this is an immediate
                    hazard.
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!powerAnswered && (
          <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 800 }}>
            Please answer whether power is on in the area.
          </div>
        )}

        {hazardRequired && !hazardAnswered && (
          <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 800 }}>
            Please answer whether this is a hazardous situation.
          </div>
        )}
      </div>

      <label style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 13.5, opacity: 0.9, fontWeight: 800, lineHeight: 1.2 }}>
          What are you seeing?
        </div>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          style={{
            padding: 10,
            height: 40,
            boxSizing: "border-box",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "#fff",
            color: "#111",
            fontSize: 14,
            lineHeight: 1.2,
          }}
          disabled={saving}
        >
          {Object.entries(REPORT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 700 }}>
          Notes {notesRequired ? "(required)" : "(optional)"}
        </div>

        <input
          placeholder='Anything helpful? (e.g., "flickers at night")'
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd" }}
          disabled={saving}
        />

        {notesMissing && (
          <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 800 }}>
            Please add a brief note for “Other”.
          </div>
        )}
      </label>

      {showSafetyNote && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-alert-danger-border)",
            background: "var(--sl-ui-alert-danger-bg)",
            color: "var(--sl-ui-alert-danger-text)",
            fontWeight: 900,
            fontSize: 12.5,
            lineHeight: 1.35,
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <div style={{ fontSize: 16, lineHeight: 1 }}>⚠️</div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 950 }}>Safety Notice!</div>
            <div style={{ marginTop: 2 }}>
              If there’s immediate danger, contact emergency services.
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
            fontWeight: 700,
          }}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 8,
            border: "none",
            background: "var(--sl-ui-brand-blue)",
            color: "white",
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.6,
            fontWeight: 800,
          }}
          disabled={!canSubmit}
        >
          {saving ? "Submitting…" : confirmLabel}
        </button>
      </div>

      <div style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.35 }}>
        Reports help track infrastructure issues and do not replace emergency services.
      </div>
    </ModalShell>
  );
}

function DomainReportModal({
  open,
  domain,
  domainLabel,
  locationLabel,
  note,
  setNote,
  streetSignIssue,
  setStreetSignIssue,
  consentChecked,
  setConsentChecked,
  imageFile,
  imagePreviewUrl,
  setImageFile,
  saving,
  onCancel,
  onSubmit,
}) {
  if (!open) return null;
  const requiresConsent = domain === "potholes" || domain === "water_drain_issues";
  const requiresStreetSignIssue = domain === "street_signs";
  const requiresWaterDrainIssue = domain === "water_drain_issues";
  const issueValid = !requiresStreetSignIssue && !requiresWaterDrainIssue
    ? true
    : Boolean(String(streetSignIssue || "").trim());
  const canSubmit = !saving && (!requiresConsent || consentChecked);
  const canSubmitFinal = canSubmit && issueValid;
  const notesPlaceholder = requiresStreetSignIssue
    ? "Add details (visibility issue, lane, landmark)"
    : requiresWaterDrainIssue
      ? "Add details (depth, lane affected, nearest drain/intersection)"
    : requiresConsent
      ? "Add details (size, lane, nearby landmark)"
      : "Add details (what you observed)";
  return (
    <ModalShell
      open={open}
      zIndex={10012}
      panelStyle={{
        width: "min(420px, 100%)",
        maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)",
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      <div style={{ padding: "16px 16px 12px", display: "grid", gap: 6, borderBottom: "1px solid var(--sl-ui-modal-border)" }}>
        <div style={{ fontSize: 16, fontWeight: 900 }}>Report {domainLabel}</div>
        <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.35 }}>
          <b>Location:</b> {locationLabel || "Map location"}
        </div>
      </div>

      <div style={{ padding: 16, overflow: "auto", display: "grid", gap: 12, minHeight: 0 }}>
        {requiresStreetSignIssue && (
          <label style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13.5, opacity: 0.9, fontWeight: 800, lineHeight: 1.2 }}>
              What issue are you seeing?
            </div>
            <select
              value={streetSignIssue}
              onChange={(e) => setStreetSignIssue(e.target.value)}
              style={{
                padding: 10,
                height: 40,
                boxSizing: "border-box",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                color: "#111",
                fontSize: 14,
                lineHeight: 1.2,
              }}
              disabled={saving}
            >
              {STREET_SIGN_ISSUE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {requiresWaterDrainIssue && (
          <label style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13.5, opacity: 0.9, fontWeight: 800, lineHeight: 1.2 }}>
              What issue are you seeing?
            </div>
            <select
              value={streetSignIssue}
              onChange={(e) => setStreetSignIssue(e.target.value)}
              style={{
                padding: 10,
                height: 40,
                boxSizing: "border-box",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#fff",
                color: "#111",
                fontSize: 14,
                lineHeight: 1.2,
              }}
              disabled={saving}
            >
              {WATER_DRAIN_ISSUE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Notes (optional)</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={notesPlaceholder}
            style={{
              minHeight: 90,
              resize: "vertical",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-input-border)",
              background: "var(--sl-ui-modal-input-bg)",
              color: "var(--sl-ui-text)",
              padding: 10,
              fontSize: 14,
              lineHeight: 1.35,
            }}
          />
        </label>

        {(domain === "potholes" || domain === "water_drain_issues") && (
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Image (optional)</div>
            <input
              type="file"
              accept="image/*"
              disabled={saving}
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setImageFile(f);
              }}
              style={{
                width: "100%",
                padding: 8,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
              }}
            />
            {imageFile && (
              <div style={{ display: "grid", gap: 6 }}>
                {imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt="Report attachment preview"
                    style={{
                      width: "100%",
                      maxHeight: 112,
                      objectFit: "cover",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-border)",
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  disabled={saving}
                  style={btnSecondary}
                >
                  Remove image
                </button>
              </div>
            )}
          </label>
        )}

        {requiresConsent && (
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-border)",
              background: "var(--sl-ui-modal-input-bg)",
              cursor: saving ? "default" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(consentChecked)}
              onChange={(e) => setConsentChecked(Boolean(e.target.checked))}
              disabled={saving}
              style={{ marginTop: 2 }}
            />
            <span style={{ fontSize: 12.5, lineHeight: 1.4 }}>
              I agree to allow CityReport.io to submit this {domain === "water_drain_issues" ? "water/drain issue" : "pothole"} report and my provided contact
              information to the city, utility, or other responsible agency on my behalf, and I confirm the submitted information is accurate to the best of my knowledge.
            </span>
          </label>
        )}
      </div>

      <div style={{ padding: 16, borderTop: "1px solid var(--sl-ui-modal-border)", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} disabled={saving} style={btnSecondary}>Cancel</button>
          <button onClick={onSubmit} disabled={!canSubmitFinal} style={{ ...btnPrimary, opacity: canSubmitFinal ? 1 : 0.6 }}>
            {saving ? "Submitting..." : "Report"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function WelcomeModal({ open, onLogin, onCreate, onGuest }) {
  return (
    <ModalShell open={open} zIndex={10005}>
      <div style={{ fontSize: 18, fontWeight: 950 }}>Welcome</div>
      <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.35 }}>
        You can sign in to track your reports, or continue as a guest.
        <div style={{ marginTop: 8, fontWeight: 900 }}>
          Guests must provide a name and either a phone number or email to submit reports.
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={onLogin} style={{ ...btnPrimary, background: "var(--sl-ui-brand-green)" }}>Log in</button>
        <button onClick={onCreate} style={{ ...btnPrimary, background: "var(--sl-ui-brand-blue)" }}>Create account</button>
        <button onClick={onGuest} style={btnSecondary}>Continue as guest</button>
      </div>
    </ModalShell>
  );
}

function GuestInfoModal({ open, info, setInfo, onContinue, onCancel }) {
  const nameOk = info.name.trim().length > 0;
  const phoneOk = info.phone.trim().length > 0;
  const emailOk = info.email.trim().length > 0;
  const ok = nameOk && phoneOk && emailOk;

  return (
    <ModalShell open={open} zIndex={10029}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Guest info required</div>
      <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.35 }}>
        Please provide your name, phone number, and email.
      </div>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Name</div>
        <input
          value={info.name}
          onChange={(e) => setInfo((p) => ({ ...p, name: e.target.value }))}
          style={inputStyle}
          placeholder="Your name"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Phone</div>
        <input
          value={info.phone}
          onChange={(e) => setInfo((p) => ({ ...p, phone: e.target.value }))}
          style={inputStyle}
          placeholder="555-555-5555"
        />
      </label>

      <label style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>Email</div>
        <input
          value={info.email}
          onChange={(e) => setInfo((p) => ({ ...p, email: e.target.value }))}
          style={inputStyle}
          placeholder="name@email.com"
        />
      </label>

      {!ok && (
        <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 900 }}>
          Name, phone, and email are required.
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={btnSecondary}>Cancel</button>
        <button onClick={onContinue} disabled={!ok} style={{ ...btnPrimary, opacity: ok ? 1 : 0.6 }}>
          Continue
        </button>
      </div>
    </ModalShell>
  );
}

function LocationPromptModal({ open, onEnable, onSkip }) {
  return (
    <ModalShell open={open} zIndex={10007}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Enable location?</div>
      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        Location helps center the map near you. You can skip this and still use the app.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onSkip} style={btnSecondary}>Not now</button>
        <button onClick={onEnable} style={btnPrimary}>Enable location</button>
      </div>
    </ModalShell>
  );
}

function ContactRequiredModal({ open, onLogin, onSignup, onGuest, onClose }) {
  return (
    <ModalShell open={open} zIndex={10028}>
      <div style={{ fontSize: 16, fontWeight: 950 }}>Contact required</div>

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        To submit a report, we need your name and either a phone number or email.
        <div style={{ marginTop: 8, fontWeight: 900 }}>
          Choose an option to continue:
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <button onClick={onLogin} style={btnPrimaryDark}>Log in</button>
        <button onClick={onSignup} style={btnPrimary}>Create account</button>
        <button onClick={onGuest} style={btnSecondary}>Continue as guest</button>
      </div>

      <button onClick={onClose} style={{ ...btnSecondary, marginTop: 2 }}>
        Cancel
      </button>
    </ModalShell>
  );
}

// shared styles for the modals above
const inputStyle = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--sl-ui-modal-input-border)",
  background: "var(--sl-ui-modal-input-bg)",
  color: "var(--sl-ui-text)",
};
const btnPrimary = { padding: 10, borderRadius: 10, border: "none", background: "var(--sl-ui-brand-blue)", color: "white", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnPrimaryDark = { padding: 10, borderRadius: 10, border: "none", background: "var(--sl-ui-modal-btn-dark-bg)", color: "var(--sl-ui-modal-btn-dark-text)", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnSecondary = { padding: 10, borderRadius: 10, border: "1px solid var(--sl-ui-modal-btn-secondary-border)", background: "var(--sl-ui-modal-btn-secondary-bg)", color: "var(--sl-ui-modal-btn-secondary-text)", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnPopupPrimary = {
  padding: 10,
  width: "100%",
  borderRadius: 10,
  border: "none",
  background: "var(--sl-ui-brand-blue)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

function IntroModal({ open, onClose }) {
  return (
    <ModalShell open={open} zIndex={10009}>
      <div style={{ fontSize: 18, fontWeight: 950 }}>Welcome</div>
      <div style={{ fontSize: 13.5, opacity: 0.9, lineHeight: 1.35 }}>
        Tap a streetlight to report an issue. Zoom in to see official lights.
      </div>

      <button onClick={onClose} style={btnPrimary}>
        Got it
      </button>
    </ModalShell>
  );
}

function NoticeModal({ open, icon, title, message, buttonText = "OK", onClose, compact = false }) {
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10020}>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: compact ? "center" : "flex-start",
          padding: compact ? "6px 0" : 0,
        }}
      >
        <div style={{ fontSize: compact ? 26 : 22, lineHeight: 1 }}>{icon}</div>

        {!compact && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 16, fontWeight: 900 }}>{title}</div>
            <div style={{ fontSize: 14, opacity: 0.9, lineHeight: 1.35 }}>{message}</div>
          </div>
        )}
      </div>

      {!compact && (
        <button
          onClick={onClose}
          style={{
            marginTop: 6,
            padding: 10,
            borderRadius: 10,
            border: "none",
            background: "var(--sl-ui-brand-blue)",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
            width: "100%",
          }}
        >
          {buttonText}
        </button>
      )}
    </ModalShell>
  );
}

function ForgotPasswordModal({ open, email, setEmail, loading, errorText, onSend, onClose }) {
  if (!open) return null;
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());

  return (
    <ModalShell open={open} zIndex={10031}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Reset password</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        Enter your account email and we’ll send a password reset link.
      </div>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
        autoCapitalize="none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading && emailLooksValid) onSend();
        }}
      />

      {!!errorText && (
        <div style={{ fontSize: 12, color: "#b71c1c", fontWeight: 900 }}>
          {errorText}
        </div>
      )}

      <div style={{ display: "grid", gap: 8 }}>
        <button
          onClick={onSend}
          disabled={loading || !emailLooksValid}
          style={{
            ...btnPrimaryDark,
            background: emailLooksValid ? "#1976d2" : "#111",
            opacity: loading || !emailLooksValid ? 0.65 : 1,
            cursor: loading || !emailLooksValid ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Sending reset…" : "Send reset email"}
        </button>
        <button onClick={onClose} style={btnSecondary}>Cancel</button>
      </div>
    </ModalShell>
  );
}

function InfoMenuModal({ open, onClose, isAdmin, onOpenTerms, onOpenPrivacy }) {
  if (!open) return null;

  const markerSwatch = (
    fill,
    { ring = "#fff", glyph = "💡", glyphSrc = "", glyphColor = "#111", showGlyph = true } = {}
  ) => (
    <span
      style={{
        width: MAP_MARKER_SIZE,
        height: MAP_MARKER_SIZE,
        borderRadius: 999,
        background: fill,
        border: `${MAP_MARKER_STROKE}px solid ${ring}`,
        display: "grid",
        placeItems: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        fontSize: showGlyph ? MAP_MARKER_GLYPH_SIZE : 0,
        lineHeight: 1,
        color: glyphColor,
      }}
      aria-hidden="true"
    >
      {showGlyph ? (glyphSrc ? <AppIcon src={glyphSrc} size={MAP_MARKER_GLYPH_SIZE} /> : glyph) : ""}
    </span>
  );

  // Legend maintenance rule (internal): whenever marker colors, rings, glyphs, helper icons,
  // or visibility rules change on the map, update this Info modal legend in the same pass and
  // bump the app version for the release. See docs/governance/map-legend-and-versioning-rules.md.
  const legendSections = [
    {
      title: "Streetlights (Utility-owned)",
      rows: [
        { swatch: markerSwatch("#111", { glyphSrc: UI_ICON_SRC.streetlight }), label: "Operational streetlight or issue below public threshold" },
        { swatch: markerSwatch("#fbc02d", { ring: "#2ecc71", showGlyph: false }), label: "Your saved light with a private outage signal" },
        { swatch: markerSwatch("#fbc02d", { ring: "#1976d2", showGlyph: false }), label: "Your utility-reported light with a private outage signal" },
        { swatch: markerSwatch("#fbc02d", { showGlyph: false }), label: "Public likely outage" },
        { swatch: markerSwatch("#f57c00", { showGlyph: false }), label: "Public high-confidence outage" },
        { swatch: markerSwatch("#111", { ring: "#2ecc71", showGlyph: false }), label: "Green ring means saved in My Reports" },
        { swatch: markerSwatch("#111", { ring: "#1976d2", showGlyph: false }), label: "Blue ring means you marked it reported to utility" },
        { swatch: markerSwatch("#1976d2", { glyphSrc: UI_ICON_SRC.streetlight }), label: "Selected light in bulk save mode" },
      ],
    },
    {
      title: "Potholes",
      rows: [
        { swatch: markerSwatch("#111", { glyphSrc: UI_ICON_SRC.pothole }), label: "Pothole marker" },
        { swatch: markerSwatch("#fbc02d", { glyphSrc: UI_ICON_SRC.pothole }), label: "Open pothole (yellow indicator)" },
        { swatch: markerSwatch("#f57c00", { glyphSrc: UI_ICON_SRC.pothole }), label: "Escalated pothole (orange indicator)" },
        { swatch: markerSwatch("#2ecc71", { glyphSrc: UI_ICON_SRC.pothole }), label: "Fixed pothole (green indicator)" },
      ],
    },
    {
      title: "Water / Drain Issues",
      rows: [
        { swatch: markerSwatch("#111", { glyphSrc: UI_ICON_SRC.waterMain }), label: "Water / Drain marker" },
        { swatch: markerSwatch("#fbc02d", { glyphSrc: UI_ICON_SRC.waterMain }), label: "Open water/drain issue (yellow indicator)" },
        { swatch: markerSwatch("#f57c00", { glyphSrc: UI_ICON_SRC.waterMain }), label: "Escalated water/drain issue (orange indicator)" },
        { swatch: markerSwatch("#2ecc71", { glyphSrc: UI_ICON_SRC.waterMain }), label: "Fixed water/drain issue (green indicator)" },
      ],
    },
    {
      title: "Map Helpers",
      rows: [
        { swatch: markerSwatch("#1976d2", { showGlyph: false }), label: "Your current location" },
      ],
    },
  ];

  const adminLegendRows = [
    { swatch: markerSwatch("#2ecc71", { glyphSrc: UI_ICON_SRC.streetlight }), label: "Queued mapped asset" },
  ];

  const primaryToolRows = [
    { iconSrc: UI_ICON_SRC.account, label: "Account", desc: "Open login/account menu and My Reports access." },
    { iconSrc: UI_ICON_SRC.satellite, label: "Map View", desc: "Toggle street map and satellite imagery." },
    { iconSrc: UI_ICON_SRC.headingReset, label: "Reset Heading", desc: "Realign map orientation to north-up." },
    { iconSrc: UI_ICON_SRC.location, label: "My Location", desc: "Center map on your current device location." },
    { iconSrc: UI_ICON_SRC.notification, label: "Alerts", desc: "Open published location alerts from the hub." },
    { iconSrc: UI_ICON_SRC.calendar, label: "Events", desc: "Open published location events from the hub." },
    { iconSrc: UI_ICON_SRC.streetlight, label: "Domain Selector", desc: "Switch active reporting domain on the map." },
    { iconSrc: UI_ICON_SRC.bulk, label: "Bulk Save (Streetlights)", desc: "Select and save multiple streetlights to My Reports." },
    { iconSrc: UI_ICON_SRC.info, label: "Info", desc: "Open this help modal with legend and policy links." },
  ];

  const adminToolRows = [
    { iconSrc: UI_ICON_SRC.toolbox, label: "Admin Tools", desc: "Open admin action menu." },
    { iconSrc: UI_ICON_SRC.openReports, label: "Reports", desc: "Open admin reports modal for triage and exports." },
    { iconSrc: UI_ICON_SRC.mapping, label: "Mapping", desc: "Enable mapping mode for administrative asset placement." },
  ];

  return (
    <ModalShell
      open={open}
      zIndex={10013}
      panelStyle={{ width: "min(760px, calc(100vw - 24px))", maxHeight: "80vh", overflow: "auto" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "grid", gap: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.1 }}>Info</div>
          <div style={{ fontSize: 11.5, opacity: 0.72, lineHeight: 1.15 }}>Version {APP_VERSION}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35, marginTop: 4 }}>
        Learn what map icons and controls mean.
      </div>

      <div
        style={{
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900 }}>Map Legend</div>
        {legendSections.map((section) => (
          <div key={section.title} style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12.5, fontWeight: 900, opacity: 0.92 }}>{section.title}</div>
            {section.rows.map((row) => (
              <div key={`${section.title}-${row.label}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <span style={{ width: MAP_MARKER_SIZE + 10, display: "grid", placeItems: "center" }}>{row.swatch}</span>
                <span>{row.label}</span>
              </div>
            ))}
          </div>
        ))}
        <div style={{ fontSize: 12, opacity: 0.82, lineHeight: 1.35 }}>
          Streetlight note: yellow can appear either as a private tracked outage on your map or as a public likely outage once the shared confidence threshold is met.
        </div>

        {isAdmin && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ height: 1, background: "var(--sl-ui-modal-border)", opacity: 0.65, margin: "2px 0" }} />
            <div style={{ fontSize: 12.5, fontWeight: 900, opacity: 0.92 }}>Admin markers</div>
            {adminLegendRows.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <span style={{ width: MAP_MARKER_SIZE + 10, display: "grid", placeItems: "center" }}>{row.swatch}</span>
                <span>{row.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900 }}>Tool Buttons</div>
        <div style={{ display: "grid", gap: 6 }}>
          {primaryToolRows.map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ width: 34, height: 34, display: "grid", placeItems: "center" }}>
                <AppIcon src={row.iconSrc} size={28} />
              </span>
              <span><b>{row.label}:</b> {row.desc}</span>
            </div>
          ))}
        </div>
        {isAdmin && (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ height: 1, background: "var(--sl-ui-modal-border)", opacity: 0.65, margin: "2px 0" }} />
            <div style={{ fontSize: 12.5, fontWeight: 900, opacity: 0.92 }}>Admin tools</div>
            {adminToolRows.map((row) => (
              <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 34, height: 34, display: "grid", placeItems: "center" }}>
                  <AppIcon src={row.iconSrc} size={28} />
                </span>
                <span><b>{row.label}:</b> {row.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900 }}>Terms of Service</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.4, opacity: 0.92 }}>
          CityReport.io is an intermediary intake and accountability platform for non-emergency infrastructure reporting.
          Use of the platform is governed by the official Terms of Service document.
        </div>
        <button
          onClick={onOpenTerms}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          View Terms of Service
        </button>
      </div>

      <div
        style={{
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900 }}>Privacy Notice</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.4, opacity: 0.92 }}>
          CityReport.io collects, uses, shares, and retains report and contact data as described in the official
          Privacy Notice document.
        </div>
        <button
          onClick={onOpenPrivacy}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          View Privacy Notice
        </button>
      </div>

      <button onClick={onClose} style={btnPrimary}>Close</button>
    </ModalShell>
  );
}

function AuthGateModal({
  open,
  step,
  setStep,
  onContinueGuest,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authLoading,
  loginError,
  clearLoginError,
  onOpenForgotPassword,
  onLogin,

  signupName,
  setSignupName,
  signupPhone,
  setSignupPhone,
  signupEmail,
  setSignupEmail,
  signupPassword,
  setSignupPassword,
  signupLoading,
  onCreateAccount,
  signupPassword2,
  setSignupPassword2,
  signupLegalAccepted,
  setSignupLegalAccepted,
  onOpenTerms,
  onOpenPrivacy,
}) {
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupPassword2, setShowSignupPassword2] = useState(false);
  const hasSignupLen = String(signupPassword || "").length >= 8;
  const hasSignupUpper = /[A-Z]/.test(String(signupPassword || ""));
  const hasSignupLower = /[a-z]/.test(String(signupPassword || ""));
  const hasSignupNumber = /[0-9]/.test(String(signupPassword || ""));
  const hasSignupSpecial = /[^A-Za-z0-9]/.test(String(signupPassword || ""));
  const signupMatches = !!signupPassword2 && signupPassword === signupPassword2;
  const reqColor = (ok) => (ok ? "#2ecc71" : "#ff5252");

  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10030}>
      {step === "welcome" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Welcome</div>
            <button
              onClick={onContinueGuest}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>

          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Log in or create an account to view your past reports.
            <br />
            Guests can report, but must provide name + phone or email.
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <button
              onClick={() => setStep("login")}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "none",
                background: "var(--sl-ui-brand-green)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Log in
            </button>

            <button
              onClick={() => setStep("signup")}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "none",
                background: "var(--sl-ui-brand-blue)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Create account
            </button>

            <button
              onClick={onContinueGuest}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Continue as guest
            </button>
          </div>
        </>
      )}

      {step === "login" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Log in</div>
            <button
              onClick={() => setStep("welcome")}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
          </div>

          <input
            {...STANDARD_LOGIN_EMAIL_INPUT_PROPS}
            value={authEmail}
            onChange={(e) => {
              clearLoginError?.();
              setAuthEmail(e.target.value);
            }}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
          />
          <div style={{ position: "relative" }}>
            <input
              {...getStandardLoginPasswordInputProps(showLoginPassword)}
              value={authPassword}
              onChange={(e) => {
                clearLoginError?.();
                setAuthPassword(e.target.value);
              }}
              style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !authLoading) onLogin();
              }}
            />
            <button
              type="button"
              onClick={() => setShowLoginPassword((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "#1976d2",
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
                fontSize: 12.5,
                lineHeight: 1,
              }}
            >
              {showLoginPassword ? "Hide" : "Show"}
            </button>
          </div>
          {!!String(loginError || "").trim() && (
            <div
              style={{
                marginTop: 2,
                fontSize: 12.5,
                lineHeight: 1.35,
                fontWeight: 800,
                borderRadius: 10,
                padding: "8px 10px",
                background: "var(--sl-ui-alert-danger-bg)",
                border: "1px solid var(--sl-ui-alert-danger-border)",
                color: "var(--sl-ui-alert-danger-text)",
              }}
            >
              Sign in failed: invalid email or password.
            </div>
          )}

          <button
            type="button"
            onClick={onOpenForgotPassword}
            disabled={authLoading}
            style={{
              padding: 0,
              width: "fit-content",
              borderRadius: 0,
              border: "none",
              background: "transparent",
              color: "#1976d2",
              fontWeight: 800,
              cursor: authLoading ? "not-allowed" : "pointer",
              opacity: authLoading ? 0.65 : 1,
              justifySelf: "start",
            }}
          >
            Forgot password?
          </button>

          <button
            onClick={onLogin}
            disabled={authLoading}
            style={{
              padding: 10,
              width: "100%",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 900,
              cursor: authLoading ? "not-allowed" : "pointer",
              opacity: authLoading ? 0.75 : 1,
            }}
          >
            {authLoading ? "Signing in…" : "Sign in"}
          </button>
        </>
      )}

      {step === "signup" && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>Create account</div>
            <button
              onClick={() => setStep("welcome")}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Back"
              title="Back"
            >
              ←
            </button>
          </div>

          <input
            placeholder="Full name"
            value={signupName}
            onChange={(e) => setSignupName(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
          />

          <input
            placeholder="Phone"
            value={signupPhone}
            onChange={(e) => setSignupPhone(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
          />

          <input
            placeholder="Email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10 }}
            autoCapitalize="none"
          />

          <div style={{ position: "relative" }}>
            <input
              placeholder="Password (8+ w/ upper, lower, special)"
              type={showSignupPassword ? "text" : "password"}
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !signupLoading) onCreateAccount();
              }}
            />
            <button
              type="button"
              onClick={() => setShowSignupPassword((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "#1976d2",
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
                fontSize: 12.5,
                lineHeight: 1,
              }}
            >
              {showSignupPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "var(--sl-ui-text)", opacity: 0.9 }}>
            Password Requirements
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.35, display: "grid", gap: 2 }}>
            <div style={{ color: reqColor(hasSignupLen), fontWeight: 800 }}>- 8 or more characters</div>
            <div style={{ color: reqColor(hasSignupUpper), fontWeight: 800 }}>- 1 uppercase</div>
            <div style={{ color: reqColor(hasSignupLower), fontWeight: 800 }}>- 1 lowercase</div>
            <div style={{ color: reqColor(hasSignupNumber), fontWeight: 800 }}>- 1 number</div>
            <div style={{ color: reqColor(hasSignupSpecial), fontWeight: 800 }}>- 1 special character</div>
            <div style={{ color: reqColor(signupMatches), fontWeight: 800 }}>- Passwords match</div>
          </div>

          <div style={{ position: "relative" }}>
            <input
              placeholder="Re-enter password"
              type={showSignupPassword2 ? "text" : "password"}
              value={signupPassword2}
              onChange={(e) => setSignupPassword2(e.target.value)}
              style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !signupLoading) onCreateAccount();
              }}
            />
            <button
              type="button"
              onClick={() => setShowSignupPassword2((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                border: "none",
                background: "transparent",
                color: "#1976d2",
                fontWeight: 800,
                cursor: "pointer",
                padding: 0,
                fontSize: 12.5,
                lineHeight: 1,
              }}
            >
              {showSignupPassword2 ? "Hide" : "Show"}
            </button>
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 12.5,
              lineHeight: 1.35,
              opacity: 0.95,
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(signupLegalAccepted)}
              onChange={(e) => setSignupLegalAccepted(Boolean(e.target.checked))}
              style={{ marginTop: 2 }}
            />
            <span>
              I agree to the{" "}
              <button
                type="button"
                onClick={onOpenTerms}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1976d2",
                  fontWeight: 900,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Terms of Use
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={onOpenPrivacy}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#1976d2",
                  fontWeight: 900,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Privacy Policy
              </button>
              , including permission for CityReport.io to submit my provided name, phone number,
              and email on my behalf to city departments, utility providers, or other responsible
              maintenance entities for issue resolution. I understand these entities may contact me
              directly using that shared information for follow-up, validation, scheduling, or status updates.
            </span>
          </label>


          <button
            onClick={onCreateAccount}
            disabled={signupLoading || !signupLegalAccepted}
            style={{
              padding: 10,
              width: "100%",
              borderRadius: 10,
              border: "none",
              background: "#111",
              color: "white",
              fontWeight: 900,
              cursor: signupLoading ? "not-allowed" : "pointer",
              opacity: signupLoading || !signupLegalAccepted ? 0.75 : 1,
            }}
          >
            {signupLoading ? "Creating…" : "Create account"}
          </button>
        </>
      )}
    </ModalShell>
  );
}

function TermsOfUseModal({ open, onClose }) {
  return (
    <ModalShell
      open={open}
      zIndex={10040}
      panelStyle={{ width: "min(860px, calc(100vw - 24px))", maxHeight: "85vh", overflow: "hidden", padding: 0 }}
    >
      <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", maxHeight: "85vh" }}>
        <div
          style={{
            width: "100%",
            padding: "12px 14px",
            borderBottom: "1px solid var(--sl-ui-modal-border)",
            fontSize: 16,
            fontWeight: 950,
            textAlign: "center",
          }}
        >
          Terms of Service
        </div>
        <div style={{ overflow: "hidden", padding: "0", background: "var(--sl-ui-modal-bg)" }}>
          <iframe
            title="CityReport Terms of Service"
            src="/legal/terms.html"
            style={{ width: "100%", height: "100%", minHeight: "58vh", border: "none", background: "white" }}
          />
        </div>
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--sl-ui-modal-border)", display: "grid", gap: 8 }}>
          <a
            href="/legal/terms.html"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#1976d2", fontWeight: 800, textAlign: "center", textDecoration: "underline" }}
          >
            Open Terms of Service in new tab
          </a>
          <button onClick={onClose} style={btnPrimary} aria-label="Close">Close</button>
        </div>
      </div>
    </ModalShell>
  );
}

function PrivacyPolicyModal({ open, onClose }) {
  return (
    <ModalShell
      open={open}
      zIndex={10040}
      panelStyle={{ width: "min(860px, calc(100vw - 24px))", maxHeight: "85vh", overflow: "hidden", padding: 0 }}
    >
      <div style={{ display: "grid", gridTemplateRows: "auto minmax(0,1fr) auto", maxHeight: "85vh" }}>
        <div
          style={{
            width: "100%",
            padding: "12px 14px",
            borderBottom: "1px solid var(--sl-ui-modal-border)",
            fontSize: 16,
            fontWeight: 950,
            textAlign: "center",
          }}
        >
          Privacy Notice
        </div>
        <div style={{ overflow: "hidden", padding: "0", background: "var(--sl-ui-modal-bg)" }}>
          <iframe
            title="CityReport Privacy Notice"
            src="/legal/privacy.html"
            style={{ width: "100%", height: "100%", minHeight: "58vh", border: "none", background: "white" }}
          />
        </div>
        <div style={{ padding: "12px 14px", borderTop: "1px solid var(--sl-ui-modal-border)", display: "grid", gap: 8 }}>
          <a
            href="/legal/privacy.html"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#1976d2", fontWeight: 800, textAlign: "center", textDecoration: "underline" }}
          >
            Open Privacy Notice in new tab
          </a>
          <button onClick={onClose} style={btnPrimary} aria-label="Close">Close</button>
        </div>
      </div>
    </ModalShell>
  );
}

function ReporterDetailsModal({ open, onClose, reportItem }) {
  const [resolvedProfile, setResolvedProfile] = useState({
    name: null,
    phone: null,
    email: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function resolveProfile() {
      setResolvedProfile({ name: null, phone: null, email: null });
      if (!open) return;

      const uid = (reportItem?.reporter_user_id || "").trim();
      if (!uid) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("user_id", uid)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[profiles] reporter name lookup error:", error);
        return;
      }

      const full = (data?.full_name || "").trim();
      const phone = (data?.phone || "").trim();
      const email = (data?.email || "").trim();
      setResolvedProfile({
        name: full || null,
        phone: phone || null,
        email: email || null,
      });
    }

    resolveProfile();

    return () => {
      cancelled = true;
    };
  }, [open, reportItem?.reporter_user_id]);

  if (!open) return null;

  const profileEmailFallback = (resolvedProfile.email || "").trim();
  const profileNameFallback = profileEmailFallback ? profileEmailFallback.split("@")[0] : "";
  const name =
    (reportItem?.reporter_name || "").trim() ||
    (resolvedProfile.name || "").trim() ||
    profileNameFallback ||
    "—";
  const phone =
    (reportItem?.reporter_phone || "").trim() ||
    (resolvedProfile.phone || "").trim() ||
    "—";
  const email =
    (reportItem?.reporter_email || "").trim() ||
    (resolvedProfile.email || "").trim() ||
    "—";

  return (
    <ModalShell open={open} zIndex={10011}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Reporter Details</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
        <div style={{ marginBottom: 8 }}><b>Name:</b> {name}</div>
        <div style={{ marginBottom: 8 }}><b>Phone:</b> {phone}</div>
        <div style={{ marginBottom: 8 }}><b>Email:</b> {email}</div>
      </div>

      <button onClick={onClose} style={{ ...btnPrimaryDark, width: "100%" }}>
        Close
      </button>
    </ModalShell>
  );
}

function AllReportsModal({
  open,
  title,
  items,
  onClose,
  onReporterDetails,
  domainKey = "streetlights",
  sharedLocation = "",
  sharedAddress = "",
  sharedLandmark = "",
  currentState = "",
  lastChangedAt = "",
  onCopyField = null,
}) {
  const [actionProfileByUserId, setActionProfileByUserId] = useState({});

  useEffect(() => {
    let cancelled = false;
    if (!open) return;

    const wanted = Array.from(new Set(
      (items || [])
        .filter((it) => it?.kind === "fix" || it?.kind === "reopen")
        .map((it) => String(it?.actor_user_id || "").trim())
        .filter((uid) => uid && !actionProfileByUserId[uid])
    ));
    if (!wanted.length) return;

    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", wanted);
      if (cancelled) return;
      if (error) {
        console.error("[profiles] action actor lookup error:", error);
        return;
      }
      const next = {};
      for (const row of data || []) {
        const uid = String(row?.user_id || "").trim();
        if (!uid) continue;
        next[uid] = {
          name: String(row?.full_name || "").trim() || null,
          phone: String(row?.phone || "").trim() || null,
          email: String(row?.email || "").trim() || null,
        };
      }
      if (!Object.keys(next).length) return;
      setActionProfileByUserId((prev) => ({ ...prev, ...next }));
    })();

    return () => {
      cancelled = true;
    };
  }, [open, items, actionProfileByUserId]);

  return (
    <ModalShell open={open} zIndex={10010}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>{title || "All Reports"}</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      {!!String(sharedLocation || sharedAddress || sharedLandmark).trim() && (
        <div style={{ marginTop: 6, display: "grid", gap: 3, fontSize: 12, lineHeight: 1.35, opacity: 0.92 }}>
          {!!String(sharedLocation || "").trim() && (
            <div>
              <b>Location:</b>{" "}
              {onCopyField ? (
                <button
                  type="button"
                  onClick={() => onCopyField("Location", sharedLocation)}
                  style={{
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    cursor: "copy",
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    padding: 0,
                    font: "inherit",
                  }}
                >
                  {sharedLocation}
                </button>
              ) : (
                <span>{sharedLocation}</span>
              )}
            </div>
          )}
          {!!String(sharedAddress || "").trim() && (
            <div>
              <b>Closest address:</b>{" "}
              {onCopyField ? (
                <button
                  type="button"
                  onClick={() => onCopyField("Closest address", sharedAddress)}
                  style={{
                    textDecoration: "underline",
                    textUnderlineOffset: 2,
                    cursor: "copy",
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    padding: 0,
                    font: "inherit",
                  }}
                >
                  {sharedAddress}
                </button>
              ) : (
                <span>{sharedAddress}</span>
              )}
            </div>
          )}
          {!!String(sharedLandmark || "").trim() && (
            <div><b>Closest landmark:</b> {sharedLandmark}</div>
          )}
        </div>
      )}

      {!!String(currentState || "").trim() && (
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.35, opacity: 0.92 }}>
          <b>Current state:</b> {incidentStateLabel(currentState)}
          {!!String(lastChangedAt || "").trim() && (
            <> • <b>Last updated:</b> {formatTs(lastChangedAt)}</>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 6,
          maxHeight: "55vh",
          overflow: "auto",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
        }}
      >
        {!items?.length ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>No history for this light yet.</div>
        ) : (
          items.map((it, idx) => {
            const isFix = it.kind === "fix";
            const isReopen = it.kind === "reopen";
            const isWorking = it.kind === "working";
            const isWorkingReport = it.kind === "report" && isWorkingReportType(it.type);
            const actorUserId = String(it?.actor_user_id || "").trim();
            const actorProfile = actorUserId ? actionProfileByUserId[actorUserId] : null;
            const actorName =
              String(it?.actor_name || "").trim()
              || String(actorProfile?.name || "").trim()
              || String(it?.actor_email || "").trim()
              || String(actorProfile?.email || "").trim()
              || String(it?.actor_phone || "").trim()
              || String(actorProfile?.phone || "").trim()
              || (actorUserId ? `User ${actorUserId.slice(0, 8)}` : "Unknown");
            const actorEmail =
              String(it?.actor_email || "").trim()
              || String(actorProfile?.email || "").trim()
              || "";
            const actorPhone =
              String(it?.actor_phone || "").trim()
              || String(actorProfile?.phone || "").trim()
              || "";

              // Treat all "pole down" variants as red
              const isPoleDown =
                !isFix &&
                ["downed_pole", "pole_down", "downed-pole"].includes(String(it.type || "").toLowerCase());

              // ✅ Color rules:
              // - Fix: black
              // - Working: green
              // - Pole down: red
              // - All other reports: yellow
              const dot = isFix ? "#111" : (isWorking || isWorkingReport) ? "#2e7d32" : isPoleDown ? "#b71c1c" : "#fbc02d";


            return (
              <div
                key={`${it.kind}-${it.ts}-${idx}`}
                style={{
                  display: "grid",
                  gap: 4,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.08)",
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: dot,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      flex: "0 0 auto",
                    }}
                  />
                  <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.1 }}>
                    {it.label}
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {formatDateTime(it.ts)}
                </div>
                {!!it.report_number && (
                  <div style={{ fontSize: 11.5, opacity: 0.9, fontWeight: 900 }}>
                    Report #: {it.report_number}
                  </div>
                )}

                {!!it.note?.trim() && (
                  <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
                    <b>Note:</b> {stripSystemMetadataFromNote(it.note) || it.note}
                  </div>
                )}

                {(it.kind === "report" || it.kind === "working") && (
                  <div style={{ fontSize: 11.5, opacity: 0.9, lineHeight: 1.3 }}>
                    <b>Submitted by:</b>{" "}
                    <button
                      type="button"
                      onClick={() => onReporterDetails?.(it)}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        margin: 0,
                        color: "var(--sl-ui-brand-green)",
                        textDecoration: "underline",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {String(it?.reporter_name || "").trim() || String(it?.reporter_email || "").trim() || "Unknown"}
                    </button>
                  </div>
                )}

                {(isFix || isReopen) && (
                  <div style={{ fontSize: 11.5, opacity: 0.9, lineHeight: 1.3 }}>
                    <b>{isFix ? "Fixed by:" : "Action by:"}</b>{" "}
                    <button
                      type="button"
                      onClick={() =>
                        onReporterDetails?.({
                          id: `${it.kind}-${it.ts || idx}`,
                          reporter_user_id: actorUserId || null,
                          reporter_name: actorName,
                          reporter_email: actorEmail || null,
                          reporter_phone: actorPhone || null,
                          note: it.note || "",
                          ts: Number(it.ts || 0),
                          report_number: null,
                        })
                      }
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        margin: 0,
                        color: "var(--sl-ui-brand-green)",
                        textDecoration: "underline",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      {actorName}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          marginTop: 6,
          padding: 10,
          width: "100%",
          borderRadius: 10,
          border: "none",
          background: "#111",
          color: "white",
          fontWeight: 900,
          cursor: "pointer",
        }}
      >
        Close
      </button>
    </ModalShell>
  );
}

function MyReportsModal({
  open,
  onClose,
  activeDomain = "streetlights",
  onSelectDomain,
  domainOptions = REPORT_DOMAIN_OPTIONS,
  domainCounts,
  groups, // [{ lightId, mineRows, lastTs }]
  expandedSet,
  onToggleExpand,
  reports,
  officialLights,
  slIdByUuid,
  fixedLights,
  lastFixByLightId,
  onFlyTo, // (lat,lng,zoom,lightId)
}) {
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const defaultFromDate = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalIsoDate(d);
  }, []);
  const defaultToDate = useCallback(() => toLocalIsoDate(new Date()), []);
  const [fromDate, setFromDate] = useState(() => defaultFromDate());
  const [toDate, setToDate] = useState(() => defaultToDate());

  const parseLocalDateStart = useCallback((v) => {
    return parseLocalIsoDate(v);
  }, []);
  const parseLocalDateEndExclusive = useCallback((v) => {
    const d = parseLocalIsoDate(v);
    if (!d) return null;
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return next;
  }, []);

  const domainButtons = (domainOptions || []).filter((d) => d.enabled);
  const selectedDomainMeta = useMemo(() => {
    const opts = domainButtons.length ? domainButtons : REPORT_DOMAIN_OPTIONS;
    return opts.find((d) => d.key === activeDomain) || opts[0] || REPORT_DOMAIN_OPTIONS[0];
  }, [domainButtons, activeDomain]);

  const inDateRange = useCallback((ts) => {
    const n = Number(ts || 0);
    if (!n) return false;
    const d = new Date(n);
    const from = parseLocalDateStart(fromDate);
    const toEx = parseLocalDateEndExclusive(toDate);
    if (from && d < from) return false;
    if (toEx && d >= toEx) return false;
    return true;
  }, [parseLocalDateStart, parseLocalDateEndExclusive, fromDate, toDate]);

  const normalizedQuery = String(searchQuery || "").trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    const digitsQ = normalizePhone(normalizedQuery);
    const out = [];
    for (const g of groups || []) {
      const displayId = String(g?.displayId || displayLightId(g?.lightId, slIdByUuid) || "").toLowerCase();
      const filteredRows = (g?.mineRows || [])
        .filter((r) => inDateRange(r?.ts))
        .filter((r) => {
          if (!normalizedQuery) return true;
          const no = reportNumberForRow(r, g?.domainKey || activeDomain).toLowerCase();
          const type = String(REPORT_TYPES?.[r?.type] || r?.type || "").toLowerCase();
          const note = String(stripSystemMetadataFromNote(r?.note || "") || r?.note || "").toLowerCase();
          const email = String(r?.reporter_email || "").toLowerCase();
          const name = String(r?.reporter_name || "").toLowerCase();
          const phoneNorm = normalizePhone(r?.reporter_phone || "");
          return (
            no.includes(normalizedQuery) ||
            type.includes(normalizedQuery) ||
            note.includes(normalizedQuery) ||
            displayId.includes(normalizedQuery) ||
            email.includes(normalizedQuery) ||
            name.includes(normalizedQuery) ||
            (digitsQ && phoneNorm.includes(digitsQ))
          );
        })
        .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
      if (!filteredRows.length) continue;
      out.push({
        ...g,
        filteredRows,
        filteredCount: filteredRows.length,
        filteredLastTs: Number(filteredRows?.[0]?.ts || 0),
      });
    }
    return out.sort((a, b) => Number(b?.filteredLastTs || 0) - Number(a?.filteredLastTs || 0));
  }, [groups, slIdByUuid, normalizedQuery, inDateRange, activeDomain]);

  const myMetrics = useMemo(() => {
    const allGroups = Array.isArray(groups) ? groups : [];
    const listed = Array.isArray(filteredGroups) ? filteredGroups : [];
    const domainReports = allGroups.reduce((acc, g) => acc + Number(g?.mineRows?.length || 0), 0);
    const listedReports = listed.reduce((acc, g) => acc + Number(g?.filteredCount || 0), 0);
    const latestTs = listed.reduce((mx, g) => Math.max(mx, Number(g?.filteredLastTs || 0)), 0);
    return {
      domainReports,
      domainIncidents: allGroups.length,
      listedReports,
      listedIncidents: listed.length,
      latestTs,
    };
  }, [groups, filteredGroups]);

  if (!open) return null;

  return (
    <ModalShell
      open={open}
      zIndex={10004}
      panelStyle={{
        width: "min(980px, calc(100vw - 32px))",
        maxWidth: "980px",
        minWidth: "min(680px, calc(100vw - 32px))",
        height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)",
        maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>My Reports</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {domainButtons.map((d) => {
          const selected = activeDomain === d.key;
          const count = Number(domainCounts?.[d.key] || 0);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onSelectDomain?.(d.key)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: selected
                  ? "1px solid var(--sl-ui-brand-green-border)"
                  : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: selected
                  ? "var(--sl-ui-brand-green)"
                  : "var(--sl-ui-modal-btn-secondary-bg)",
                color: selected ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <AppIcon src={d.iconSrc} size={32} />
                  <span>{d.label} ({count})</span>
                </span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 6, minHeight: 42, display: "flex", gap: 8 }}>
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setSearchQuery(String(searchDraft || "").trim());
          }}
          placeholder="Search by report #, type, note, or contact"
          style={{
            width: "100%",
            padding: "9px 10px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-input-border)",
            background: "var(--sl-ui-modal-input-bg)",
            color: "var(--sl-ui-text)",
            fontSize: 12.5,
          }}
        />
        <button
          type="button"
          onClick={() => setSearchQuery(String(searchDraft || "").trim())}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Apply
        </button>
      </div>

      <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
          From{" "}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              marginLeft: 6,
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid var(--sl-ui-modal-input-border)",
              background: "var(--sl-ui-modal-input-bg)",
              color: "var(--sl-ui-text)",
            }}
          />
        </label>
        <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
          To{" "}
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              marginLeft: 6,
              padding: "6px 8px",
              borderRadius: 8,
              border: "1px solid var(--sl-ui-modal-input-border)",
              background: "var(--sl-ui-modal-input-bg)",
              color: "var(--sl-ui-text)",
            }}
          />
        </label>
        <button
          onClick={() => {
            setSearchDraft("");
            setSearchQuery("");
            setFromDate(defaultFromDate());
            setToDate(defaultToDate());
          }}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Clear search
        </button>
      </div>

      <div
        style={{
          marginTop: 6,
          display: "grid",
          gap: 8,
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 10,
          padding: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.9 }}>My metrics (domain + date range)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {[
            { label: "Reports (domain)", value: myMetrics.domainReports },
            { label: "Incidents (domain)", value: myMetrics.domainIncidents },
            { label: "Reports (listed)", value: myMetrics.listedReports },
            { label: "Incidents (listed)", value: myMetrics.listedIncidents },
            { label: "Latest listed", value: myMetrics.latestTs ? formatTs(myMetrics.latestTs) : "N/A" },
            { label: "Domain", value: selectedDomainMeta?.label || activeDomain },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 8,
                padding: "7px 8px",
                display: "grid",
                gap: 2,
              }}
            >
              <div style={{ fontSize: 11.5, opacity: 0.8, fontWeight: 800 }}>{m.label}</div>
              <div style={{ fontSize: 14, fontWeight: 950 }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          marginTop: 6,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 10,
          padding: 10,
        }}
      >
        {!filteredGroups?.length ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            No reports in selected filters.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "var(--sl-ui-modal-bg)", zIndex: 1 }}>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                  {activeDomain === "potholes" ? "Pothole ID" : activeDomain === "street_signs" ? "Sign ID" : "Light ID"}
                </th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                  Reports
                </th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                  Latest report
                </th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.map((g) => {
                const coords = g.center || getCoordsForLightId(g.lightId, reports, officialLights);
                const isOpen = expandedSet?.has(g.lightId);
                const latestTs = Number(g?.filteredLastTs || 0);
                return (
                  <Fragment key={g.lightId}>
                    <tr>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                        <button
                          type="button"
                          onClick={() => onToggleExpand(g.lightId)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "var(--sl-ui-text)",
                            fontWeight: 900,
                            cursor: "pointer",
                            padding: 0,
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          }}
                          title="Toggle report rows"
                        >
                          {isOpen ? "▾ " : "▸ "}
                          {g.displayId || displayLightId(g.lightId, slIdByUuid)}
                        </button>
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)", fontWeight: 900 }}>
                        {Number(g?.filteredCount || 0)}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                        {latestTs ? formatTs(latestTs) : "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!coords) return;
                            onFlyTo([coords.lat, coords.lng], 18, g.lightId);
                          }}
                          disabled={!coords}
                          style={{
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                            background: "var(--sl-ui-modal-btn-secondary-bg)",
                            color: "var(--sl-ui-modal-btn-secondary-text)",
                            fontWeight: 900,
                            cursor: coords ? "pointer" : "not-allowed",
                            opacity: coords ? 1 : 0.6,
                          }}
                        >
                          Fly to
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={4} style={{ padding: 0, borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                          <div style={{ padding: 8, display: "grid", gap: 6, background: "var(--sl-ui-modal-subtle-bg)" }}>
                            {(g.filteredRows || []).map((r) => (
                              <div
                                key={`${g.lightId}:${r.id}`}
                                style={{
                                  border: "1px solid var(--sl-ui-open-reports-item-border)",
                                  borderRadius: 8,
                                  padding: "7px 8px",
                                  display: "grid",
                                  gap: 4,
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                  <div style={{ fontWeight: 900 }}>
                                    {REPORT_TYPES?.[r.type] || r.type || "Report"}
                                  </div>
                                  <div style={{ opacity: 0.8 }}>{formatTs(r.ts)}</div>
                                </div>
                                <div style={{ fontWeight: 900, opacity: 0.9 }}>
                                  Report #: {reportNumberForRow(r, g.domainKey || activeDomain)}
                                </div>
                                {!!String(stripSystemMetadataFromNote(r.note || "") || "").trim() && (
                                  <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
                                    <b>Note:</b> {stripSystemMetadataFromNote(r.note) || r.note}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </ModalShell>
  );
}

function ModerationFlagsModal({
  open,
  onClose,
  rows = [],
  loading = false,
  error = "",
  onRefresh,
}) {
  if (!open) return null;

  const toTsLabel = (row) => {
    const candidates = [
      row?.created_at,
      row?.occurred_at,
      row?.event_ts,
      row?.ts,
      row?.inserted_at,
      row?.updated_at,
    ];
    for (const v of candidates) {
      const n = Date.parse(String(v || ""));
      if (Number.isFinite(n) && n > 0) return formatTs(n);
    }
    return "—";
  };

  const isStillOpen = (row) => {
    const closed = String(row?.resolved_at || row?.closed_at || row?.cleared_at || "").trim();
    if (closed) return false;
    const explicit = row?.is_open;
    if (explicit === true) return true;
    if (explicit === false) return false;
    return true;
  };

  const domainForRow = (row) => {
    return String(row?.domain || row?.report_domain || row?.incident_domain || "unknown").trim() || "unknown";
  };

  const reasonForRow = (row) => {
    return String(
      row?.reason ||
      row?.event_type ||
      row?.flag_type ||
      row?.kind ||
      row?.rule_name ||
      "flag"
    ).trim() || "flag";
  };

  const detailForRow = (row) => {
    return String(
      row?.message ||
      row?.details ||
      row?.note ||
      row?.context ||
      row?.source ||
      ""
    ).trim();
  };

  return (
    <ModalShell
      open={open}
      zIndex={10011}
      panelStyle={{
        width: "min(980px, calc(100vw - 32px))",
        maxWidth: "980px",
        minWidth: "min(680px, calc(100vw - 32px))",
        height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)",
        maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Moderation Flags</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 12.5, opacity: 0.85 }}>
          Admin-only telemetry view of active/recorded moderation events.
        </div>
        <button
          type="button"
          onClick={onRefresh}
          style={{
            padding: "7px 10px",
            borderRadius: 9,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          marginTop: 8,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          border: "1px solid var(--sl-ui-open-reports-item-border)",
          borderRadius: 10,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        {error ? (
          <div style={{ padding: 12, fontSize: 13, color: "#d32f2f", fontWeight: 800 }}>{error}</div>
        ) : loading ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.85 }}>Loading moderation flags…</div>
        ) : !rows.length ? (
          <div style={{ padding: 12, fontSize: 13, opacity: 0.85 }}>No moderation flags found.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ position: "sticky", top: 0, background: "var(--sl-ui-modal-bg)", zIndex: 1 }}>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>Open</th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>Severity</th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>Domain</th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>Type</th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>When</th>
                <th style={{ textAlign: "left", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={`${String(row?.id || "flag")}-${idx}`}>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                    {isStillOpen(row) ? "Open" : "Closed"}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)", fontWeight: 900 }}>
                    {Math.max(0, Number(row?.severity || 0))}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                    {domainForRow(row)}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                    {reasonForRow(row)}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                    {toTsLabel(row)}
                  </td>
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)", lineHeight: 1.35 }}>
                    {detailForRow(row) || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </ModalShell>
  );
}

// CMD+F: function formatTs
function formatTs(ms) {
  try {
    const d = new Date(ms || 0);
    if (!ms || Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function toLocalIsoDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalIsoDate(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const d = new Date(y, month - 1, day, 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}


function OpenReportsModal({
  open,
  onClose,
  isAdmin = false,
  activeDomain = "streetlights",
  onSelectDomain,
  domainOptions = REPORT_DOMAIN_OPTIONS,
  groups, // [{ lightId, rows, count, lastTs }]
  expandedSet,
  onToggleExpand,
  reports,
  potholes = [],
  allDomainReports = [],
  officialLights,
  slIdByUuid,
  fixedLights,
  lastFixByLightId,
  onFlyTo, // (posArray, zoom, lightId)
  onMarkFixedIncident, // (incidentId, actionType: "fix" | "reopen")
  onOpenAllReports, // (title, items)
  onReporterDetails,
  actionsByLightId = {},
  session = null,
  profile = null,
  incidentStateByKey = {},
  officialSignIdSetForExport = new Set(),
  cityBoundaryLoaded = false,
  isWithinCityLimits = null,
  modalTitle = "Reports",
  getStreetlightUtilityDetails = null,
  onUtilityReportedChange = null,
  onMarkWorkingIncident = null,
  streetlightConfidenceByLightId = {},
  incidentRepairProgressByKey = {},
  canShowPublicRepairAction = null,
  onConfirmRepairIncident = null,
  focusIncidentId = "",
  initialSearchQuery = "",
  onInitialFocusApplied = null,
  mapBounds = null,
  inViewOnly = false,
}) {
  const canMutateIncidents = isAdmin && typeof onMarkFixedIncident === "function";
  const canMarkWorkingIncidents = typeof onMarkWorkingIncident === "function";
  const [sortMode, setSortMode] = useState("count"); // count | recent
  const [statusFilter, setStatusFilter] = useState("open"); // open | closed | all
  const [searchDraft, setSearchDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const DATE_PRESET_OPTIONS = useMemo(() => ([
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "thisMonth", label: "This Month" },
    { key: "lastMonth", label: "Last Month" },
    { key: "last90", label: "Last 90 days" },
    { key: "last180", label: "Last 180 days" },
    { key: "ytd", label: "YTD" },
  ]), []);
  const defaultFromDate = useCallback(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalIsoDate(d);
  }, []);
  const defaultToDate = useCallback(() => {
    return toLocalIsoDate(new Date());
  }, []);
  const [exportFromDate, setExportFromDate] = useState(() => defaultFromDate());
  const [exportToDate, setExportToDate] = useState(() => defaultToDate());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [draftFromDate, setDraftFromDate] = useState("");
  const [draftToDate, setDraftToDate] = useState("");
  const [calendarLeftMonth, setCalendarLeftMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const toIsoDate = useCallback((value) => {
    return toLocalIsoDate(value);
  }, []);
  const parseIsoDate = useCallback((value) => {
    return parseLocalIsoDate(value);
  }, []);
  const getPresetRange = useCallback((presetKey) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let from = new Date(today);
    let to = new Date(today);
    if (presetKey === "all") {
      return { from: "", to: "" };
    }
    if (presetKey === "today") {
      from = new Date(today);
      to = new Date(today);
    } else if (presetKey === "thisMonth") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (presetKey === "lastMonth") {
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (presetKey === "last90") {
      from = new Date(today);
      from.setDate(from.getDate() - 89);
    } else if (presetKey === "last180") {
      from = new Date(today);
      from.setDate(from.getDate() - 179);
    } else if (presetKey === "ytd") {
      from = new Date(today.getFullYear(), 0, 1);
    }
    return {
      from: toIsoDate(from),
      to: toIsoDate(to),
    };
  }, [toIsoDate]);
  const dateRangeLabel = useCallback((from, to) => {
    if (!String(from || "").trim() && !String(to || "").trim()) return "All";
    const fromD = parseIsoDate(from);
    const toD = parseIsoDate(to);
    if (!fromD || !toD) return "Select range";
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${fmt.format(fromD)} - ${fmt.format(toD)}`;
  }, [parseIsoDate]);
  const openDatePicker = useCallback(() => {
    const from = String(exportFromDate || "").trim();
    const to = String(exportToDate || "").trim();
    setDraftFromDate(from);
    setDraftToDate(to);
    const toDate = parseIsoDate(to) || parseIsoDate(from) || new Date();
    setCalendarLeftMonth(new Date(toDate.getFullYear(), toDate.getMonth() - 1, 1));
    setDatePickerOpen(true);
  }, [exportFromDate, exportToDate, parseIsoDate]);
  const cancelDatePicker = useCallback(() => {
    setDatePickerOpen(false);
    setDraftFromDate("");
    setDraftToDate("");
  }, []);
  const applyDatePicker = useCallback(() => {
    const rawFrom = String(draftFromDate || "").trim();
    const rawTo = String(draftToDate || "").trim();
    if (!rawFrom && !rawTo) {
      setExportFromDate("");
      setExportToDate("");
      setDatePickerOpen(false);
      return;
    }
    const from = rawFrom || rawTo;
    const to = rawTo || rawFrom;
    if (!from || !to) {
      setDatePickerOpen(false);
      return;
    }
    if (from <= to) {
      setExportFromDate(from);
      setExportToDate(to);
    } else {
      setExportFromDate(to);
      setExportToDate(from);
    }
    setDatePickerOpen(false);
  }, [draftFromDate, draftToDate]);
  const applyPresetToDraft = useCallback((presetKey) => {
    const range = getPresetRange(presetKey);
    setDraftFromDate(range.from);
    setDraftToDate(range.to);
    const toDate = parseIsoDate(range.to);
    if (toDate) {
      setCalendarLeftMonth(new Date(toDate.getFullYear(), toDate.getMonth() - 1, 1));
    }
  }, [getPresetRange, parseIsoDate]);
  const shiftCalendarMonths = useCallback((delta) => {
    setCalendarLeftMonth((prev) => {
      const base = prev instanceof Date ? prev : new Date();
      return new Date(base.getFullYear(), base.getMonth() + Number(delta || 0), 1);
    });
  }, []);
  const formatMonthLabel = useCallback((value) => {
    const d = value instanceof Date ? value : new Date();
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }, []);
  const buildMonthCells = useCallback((value) => {
    const d = value instanceof Date ? value : new Date();
    const y = d.getFullYear();
    const m = d.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDow; i += 1) cells.push(null);
    for (let day = 1; day <= dim; day += 1) {
      cells.push(toIsoDate(new Date(y, m, day)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [toIsoDate]);
  const pickCalendarDate = useCallback((iso) => {
    const day = String(iso || "").trim();
    if (!day) return;
    const from = String(draftFromDate || "").trim();
    const to = String(draftToDate || "").trim();
    if (!from || (from && to)) {
      setDraftFromDate(day);
      setDraftToDate("");
      return;
    }
    if (day < from) {
      setDraftFromDate(day);
      setDraftToDate(from);
      return;
    }
    setDraftToDate(day);
  }, [draftFromDate, draftToDate]);
  const draftRangeFrom = String(draftFromDate || "").trim();
  const draftRangeTo = String(draftToDate || draftFromDate || "").trim();
  const isDateInDraftRange = useCallback((iso) => {
    const day = String(iso || "").trim();
    if (!day || !draftRangeFrom || !draftRangeTo) return false;
    return day >= draftRangeFrom && day <= draftRangeTo;
  }, [draftRangeFrom, draftRangeTo]);
  const leftMonthCells = useMemo(() => buildMonthCells(calendarLeftMonth), [buildMonthCells, calendarLeftMonth]);
  const rightMonthDate = useMemo(
    () => new Date(calendarLeftMonth.getFullYear(), calendarLeftMonth.getMonth() + 1, 1),
    [calendarLeftMonth]
  );
  const rightMonthCells = useMemo(() => buildMonthCells(rightMonthDate), [buildMonthCells, rightMonthDate]);
  const [compactDomainPicker, setCompactDomainPicker] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 760;
  });
  const [compactDomainMenuOpen, setCompactDomainMenuOpen] = useState(false);
  const [compactFiltersOpen, setCompactFiltersOpen] = useState(false);
  const [metricsCollapsed, setMetricsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 760;
  });
  const listScrollRef = useRef(null);
  const rowRefMap = useRef(new Map());
  const [serverDetailRows, setServerDetailRows] = useState(null);
  const [serverDetailLoading, setServerDetailLoading] = useState(false);
  const [serverDetailError, setServerDetailError] = useState("");
  const [serverViewsDisabled, setServerViewsDisabled] = useState(false);
  const useServerViews = false; // local deterministic mode to avoid server-view 400 noise across domains
  const [metricsViewRows, setMetricsViewRows] = useState({
    stateCounts: [],
    closeStats: null,
    topRecurring: [],
  });
  const [tableSort, setTableSort] = useState({ key: "submitted_at", dir: "desc" });
  const [adminExpandedSet, setAdminExpandedSet] = useState(() => new Set());
  const [streetlightReportInfoByIncident, setStreetlightReportInfoByIncident] = useState({});
  const [streetlightUtilityExpandedSet, setStreetlightUtilityExpandedSet] = useState(() => new Set());
  const [streetlightUtilityLoadingByIncident, setStreetlightUtilityLoadingByIncident] = useState({});
  const [copyToast, setCopyToast] = useState(null);
  const copyToastTimerRef = useRef(null);
  const isLikelyPermanentViewError = useCallback((err) => {
    const status = Number(err?.status || 0);
    if (status === 400 || status === 404) return true;
    const text = `${String(err?.message || "")} ${String(err?.details || "")} ${String(err?.hint || "")}`.toLowerCase();
    if (text.includes("schema cache")) return true;
    if (text.includes("does not exist")) return true;
    if (text.includes("could not find")) return true;
    if (text.includes("column")) return true;
    if (text.includes("relation")) return true;
    return false;
  }, []);
  const officialIdSetForExport = useMemo(
    () => new Set((officialLights || []).map((l) => String(l?.id || "").trim()).filter(Boolean)),
    [officialLights]
  );
  const getStreetlightConfidence = useCallback((incidentId) => {
    const id = String(incidentId || "").trim();
    if (!id) return null;
    return streetlightConfidenceByLightId?.[id] || null;
  }, [streetlightConfidenceByLightId]);
  const canShowWorkingActionForIncident = useCallback((incidentId) => {
    if (activeDomain !== "streetlights") return false;
    if (!canMarkWorkingIncidents) return false;
    const confidence = getStreetlightConfidence(incidentId);
    return Boolean(confidence?.canViewerMarkWorking);
  }, [activeDomain, canMarkWorkingIncidents, getStreetlightConfidence]);
  const getRepairSnapshotForIncident = useCallback((incidentId) => {
    const key = incidentSnapshotKey(activeDomain, incidentId);
    if (!key) return null;
    return incidentRepairProgressByKey?.[key] || null;
  }, [activeDomain, incidentRepairProgressByKey]);

  const isMyReportsModal = String(modalTitle || "").trim().toLowerCase() === "my reports";
  const isStreetlightMyReports = activeDomain === "streetlights" && !canMutateIncidents;
  const utilityReportUserId = String(session?.user?.id || "").trim();
  const [utilityReportedByIncident, setUtilityReportedByIncident] = useState({});
  const [utilityReportReferenceByIncident, setUtilityReportReferenceByIncident] = useState({});
  const [utilityReportDialogOpen, setUtilityReportDialogOpen] = useState(false);
  const [utilityReportDialogIncidentId, setUtilityReportDialogIncidentId] = useState("");
  const [utilityReportDialogReference, setUtilityReportDialogReference] = useState("");
  const [inViewOnlyActive, setInViewOnlyActive] = useState(Boolean(inViewOnly));
  useEffect(() => {
    if (!open) return;
    setInViewOnlyActive(Boolean(inViewOnly));
  }, [open, inViewOnly]);
  const hasSearchText = Boolean(String(searchDraft || "").trim() || String(searchQuery || "").trim());
  const showSearchClearButton = hasSearchText || inViewOnlyActive;
  const reportSearchPlaceholder = inViewOnlyActive
    ? "Reports in view"
    : "Search by report #, name, phone, or email";
  const clearSearchField = useCallback(() => {
    setSearchDraft("");
    setSearchQuery("");
    setInViewOnlyActive(false);
  }, []);
  const copyStreetlightField = useCallback(async (label, value, anchorEl = null) => {
    const text = String(value || "").trim();
    if (!text || text.toLowerCase() === "unavailable") return;
    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        const rect = anchorEl?.getBoundingClientRect?.();
        const x = rect ? Math.max(10, Math.min(window.innerWidth - 180, rect.right + 8)) : null;
        const y = rect ? Math.max(10, rect.top - 2) : null;
        setCopyToast({ text: "Copied to clipboard", x, y });
        if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = setTimeout(() => {
          setCopyToast(null);
          copyToastTimerRef.current = null;
        }, 900);
      }
    } catch {
      // clipboard failures are non-fatal in modal context
    }
  }, []);
  const showInlineToast = useCallback((text) => {
    setCopyToast({ text: String(text || "Saved"), x: 18, y: 48 });
    if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToast(null);
      copyToastTimerRef.current = null;
    }, 1200);
  }, []);
  const getStreetlightUtilityRows = useCallback((util, coords) => buildStreetlightUtilityRows(util, coords), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setCompactDomainPicker(window.innerWidth <= 760);
    sync();
    window.addEventListener("resize", sync, { passive: true });
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    if (!open || !compactDomainPicker) {
      setCompactDomainMenuOpen(false);
      setCompactFiltersOpen(false);
    }
  }, [open, compactDomainPicker]);
  useEffect(() => {
    if (!open) setCopyToast(null);
  }, [open]);
  useEffect(() => {
    if (open) return;
    setDatePickerOpen(false);
    setDraftFromDate("");
    setDraftToDate("");
  }, [open]);
  useEffect(() => {
    if (!datePickerOpen) return;
    const onKey = (ev) => {
      if (ev.key === "Escape") cancelDatePicker();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [datePickerOpen, cancelDatePicker]);
  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    };
  }, []);
  useEffect(() => {
    if (!compactDomainPicker) setMetricsCollapsed(false);
  }, [compactDomainPicker]);
  useEffect(() => {
    if (!open) return;
    const targetIncidentId = String(focusIncidentId || "").trim();
    if (!targetIncidentId) return;
    setStatusFilter("all");
    setAdminExpandedSet(new Set([targetIncidentId]));
  }, [open, focusIncidentId]);
  useEffect(() => {
    if (!open) return;
    const q = String(initialSearchQuery || "").trim();
    if (!q) return;
    setStatusFilter("all");
    setSearchDraft(q);
    setSearchQuery(q);
    if (typeof onInitialFocusApplied === "function") onInitialFocusApplied();
  }, [open, initialSearchQuery]);
  useEffect(() => {
    let cancelled = false;
    async function loadUtilityReportedState() {
      if (!open || !utilityReportUserId) {
        if (!cancelled) {
          setUtilityReportedByIncident({});
          setUtilityReportReferenceByIncident({});
        }
        return;
      }
      let { data, error } = await supabase
        .from("utility_report_status")
        .select("incident_id, report_reference")
        .eq("user_id", utilityReportUserId)
        .eq("tenant_key", activeTenantKey())
        .order("updated_at", { ascending: false });
      if (error && isMissingUtilityReportReferenceColumnError(error)) {
        const fallback = await supabase
          .from("utility_report_status")
          .select("incident_id")
          .eq("user_id", utilityReportUserId)
          .eq("tenant_key", activeTenantKey())
          .order("updated_at", { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
      if (cancelled) return;
      if (error) {
        console.warn("[utility_report_status] load warning:", error?.message || error);
        setUtilityReportedByIncident({});
        setUtilityReportReferenceByIncident({});
        return;
      }
      const next = {};
      const nextRefs = {};
      for (const row of data || []) {
        const id = String(row?.incident_id || "").trim();
        if (!id) continue;
        next[id] = true;
        nextRefs[id] = normalizeUtilityReportReference(row?.report_reference);
      }
      setUtilityReportedByIncident(next);
      setUtilityReportReferenceByIncident(nextRefs);
    }
    loadUtilityReportedState();
    return () => {
      cancelled = true;
    };
  }, [open, utilityReportUserId]);
  const openUtilityReportDialog = useCallback((incidentId) => {
    const id = String(incidentId || "").trim();
    if (!id || !utilityReportUserId) return;
    setUtilityReportDialogIncidentId(id);
    setUtilityReportDialogReference(String(utilityReportReferenceByIncident?.[id] || "").trim());
    setUtilityReportDialogOpen(true);
  }, [utilityReportUserId, utilityReportReferenceByIncident]);
  const clearUtilityReported = useCallback(async (incidentId) => {
    const id = String(incidentId || "").trim();
    if (!id || !utilityReportUserId) return;
    setUtilityReportedByIncident((prev) => ({
      ...(prev || {}),
      [id]: false,
    }));
    setUtilityReportReferenceByIncident((prev) => {
      const next = { ...(prev || {}) };
      delete next[id];
      return next;
    });
    onUtilityReportedChange?.(id, false, { reportReference: "" });
    const { error } = await supabase
      .from("utility_report_status")
      .delete()
      .eq("tenant_key", activeTenantKey())
      .eq("user_id", utilityReportUserId)
      .eq("incident_id", id);
    if (error) {
      console.warn("[utility_report_status] delete warning:", error?.message || error);
      setUtilityReportedByIncident((prev) => ({
        ...(prev || {}),
        [id]: true,
      }));
      onUtilityReportedChange?.(id, true, {
        reportReference: utilityReportReferenceByIncident?.[id] || "",
      });
    }
  }, [utilityReportUserId, onUtilityReportedChange, utilityReportReferenceByIncident]);
  const saveUtilityReported = useCallback(async () => {
    const id = String(utilityReportDialogIncidentId || "").trim();
    if (!id || !utilityReportUserId) return;
    const normalizedReference = normalizeUtilityReportReference(utilityReportDialogReference);
    const hadReported = Boolean(utilityReportedByIncident?.[id]);
    const previousReference = String(utilityReportReferenceByIncident?.[id] || "").trim();
    setUtilityReportedByIncident((prev) => ({
      ...(prev || {}),
      [id]: true,
    }));
    setUtilityReportReferenceByIncident((prev) => ({
      ...(prev || {}),
      [id]: normalizedReference,
    }));
    onUtilityReportedChange?.(id, true, { reportReference: normalizedReference });
    setUtilityReportDialogOpen(false);
    setUtilityReportDialogIncidentId("");
    setUtilityReportDialogReference("");
    let { error } = await supabase
      .from("utility_report_status")
      .upsert(
        [{
          tenant_key: activeTenantKey(),
          user_id: utilityReportUserId,
          incident_id: id,
          reported_at: new Date().toISOString(),
          report_reference: normalizedReference || null,
        }],
        { onConflict: "tenant_key,user_id,incident_id" }
      );
    if (error && isMissingUtilityReportReferenceColumnError(error)) {
      const fallback = await supabase
        .from("utility_report_status")
        .upsert(
          [{
            tenant_key: activeTenantKey(),
            user_id: utilityReportUserId,
            incident_id: id,
            reported_at: new Date().toISOString(),
          }],
          { onConflict: "tenant_key,user_id,incident_id" }
        );
      error = fallback.error || null;
    }
    if (error) {
      console.warn("[utility_report_status] upsert warning:", error?.message || error);
      setUtilityReportedByIncident((prev) => ({
        ...(prev || {}),
        [id]: hadReported,
      }));
      setUtilityReportReferenceByIncident((prev) => {
        const next = { ...(prev || {}) };
        if (hadReported) next[id] = previousReference;
        else delete next[id];
        return next;
      });
      onUtilityReportedChange?.(id, hadReported, { reportReference: previousReference });
      return;
    }
    showInlineToast("Utility report saved");
  }, [
    utilityReportDialogIncidentId,
    utilityReportDialogReference,
    utilityReportUserId,
    onUtilityReportedChange,
    utilityReportedByIncident,
    utilityReportReferenceByIncident,
    showInlineToast,
  ]);

  const getStreetlightUtilityForIncident = useCallback((incidentId) => {
    const key = String(incidentId || "").trim();
    if (!key) return null;

    const fromState = streetlightReportInfoByIncident?.[key] || null;
    if (fromState) return fromState;

    const byId = (officialLights || []).find((l) => String(l?.id || "").trim() === key);
    const bySlId = byId
      ? null
      : (officialLights || []).find((l) => String(l?.sl_id || "").trim().toLowerCase() === key.toLowerCase());
    const match = byId || bySlId;
    if (!match) return null;

    return {
      nearestAddress: String(match?.nearest_address || "").trim(),
      nearestCrossStreet: String(match?.nearest_cross_street || "").trim(),
      nearestLandmark: String(match?.nearest_landmark || "").trim(),
      nearestStreet: "",
      nearestIntersection: "",
    };
  }, [streetlightReportInfoByIncident, officialLights]);

  const ensureStreetlightUtilityForIncident = useCallback(async (incidentId, coords) => {
    const key = String(incidentId || "").trim();
    const lat = Number(coords?.lat);
    const lng = Number(coords?.lng);
    if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const existing = getStreetlightUtilityForIncident(key);
    const hasSavedLocation = Boolean(
      String(existing?.nearestAddress || "").trim() ||
      String(existing?.nearestCrossStreet || "").trim() ||
      String(existing?.nearestLandmark || "").trim()
    );
    if (hasSavedLocation || typeof getStreetlightUtilityDetails !== "function") return;

    setStreetlightUtilityLoadingByIncident((prev) => ({ ...(prev || {}), [key]: true }));
    try {
      const geo = await getStreetlightUtilityDetails(lat, lng, { mode: "full" });
      setStreetlightReportInfoByIncident((prev) => ({
        ...(prev || {}),
        [key]: {
          ...(prev?.[key] || {}),
          nearestAddress: String(geo?.nearestAddress || "").trim(),
          nearestStreet: String(geo?.nearestStreet || "").trim(),
          nearestCrossStreet: String(geo?.nearestCrossStreet || "").trim(),
          nearestIntersection: String(geo?.nearestIntersection || "").trim(),
          nearestLandmark: String(geo?.nearestLandmark || "").trim(),
        },
      }));
    } catch {
      // best-effort detail lookup for utility info
    } finally {
      setStreetlightUtilityLoadingByIncident((prev) => ({ ...(prev || {}), [key]: false }));
    }
  }, [getStreetlightUtilityDetails, getStreetlightUtilityForIncident]);

  const toggleStreetlightUtilityExpanded = useCallback((incidentId, coords) => {
    const key = String(incidentId || "").trim();
    if (!key) return;
    setStreetlightUtilityExpandedSet((prev) => {
      const next = new Set(prev || []);
      const opening = !next.has(key);
      if (opening) next.add(key);
      else next.delete(key);
      return next;
    });
    void ensureStreetlightUtilityForIncident(key, coords);
  }, [ensureStreetlightUtilityForIncident]);

  useEffect(() => {
    if (!open) {
      setStreetlightUtilityExpandedSet(new Set());
      setStreetlightUtilityLoadingByIncident({});
    }
  }, [open]);

  const selectedDomainMeta = useMemo(() => {
    const opts = Array.isArray(domainOptions) && domainOptions.length
      ? domainOptions
      : REPORT_DOMAIN_OPTIONS;
    return opts.find((d) => d.key === activeDomain) || opts[0] || REPORT_DOMAIN_OPTIONS[0];
  }, [activeDomain, domainOptions]);

  const scrollGroupToTop = useCallback((lightId) => {
    const lid = (lightId || "").trim();
    if (!lid) return;
    const scroller = listScrollRef.current;
    const row = rowRefMap.current.get(lid);
    if (!scroller || !row) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const top = Math.max(0, scroller.scrollTop + (rowRect.top - scrollerRect.top) - 2);
    scroller.scrollTo({ top, behavior: "smooth" });
  }, []);

  const handleToggleExpand = useCallback((lightId) => {
    const lid = (lightId || "").trim();
    if (!lid) return;
    const wasOpen = expandedSet?.has?.(lid);
    if (wasOpen) {
      onToggleExpand?.(lid);
      return;
    }
    const openIds = Array.from(expandedSet || [])
      .map((id) => String(id || "").trim())
      .filter((id) => id && id !== lid);
    for (const id of openIds) onToggleExpand?.(id);
    onToggleExpand?.(lid);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollGroupToTop(lid));
    });
  }, [expandedSet, onToggleExpand, scrollGroupToTop]);

  const deriveIncidentStateFromTimeline = useCallback((incidentId, rows = []) => {
    const id = String(incidentId || "").trim();
    const timeline = Array.isArray(actionsByLightId?.[id]) ? actionsByLightId[id] : [];
    let lastFixTs = Number(lastFixByLightId?.[id] || 0);
    let lastReopenTs = 0;
    for (const a of timeline) {
      const t = Number(a?.ts || 0);
      if (!Number.isFinite(t) || t <= 0) continue;
      const kind = String(a?.action || "").toLowerCase();
      if (kind === "fix") lastFixTs = Math.max(lastFixTs, t);
      if (kind === "reopen") lastReopenTs = Math.max(lastReopenTs, t);
    }
    let lastReportTs = 0;
    for (const r of rows || []) {
      const t = Number(r?.ts || 0);
      if (!Number.isFinite(t) || t <= 0) continue;
      if (t > lastReportTs) lastReportTs = t;
    }

    // Canonical cross-domain rule:
    // report newer than last fix => reported/open
    // reopen newer than last fix => reopened/open
    // otherwise if last fix exists => fixed/closed
    if (lastReportTs > lastFixTs) {
      return { state: "reported", fixedAtIso: "", lastChangedAtIso: new Date(lastReportTs).toISOString() };
    }
    if (lastReopenTs > lastFixTs) {
      return { state: "reopened", fixedAtIso: "", lastChangedAtIso: new Date(lastReopenTs).toISOString() };
    }
    if (lastFixTs > 0) {
      return { state: "fixed", fixedAtIso: new Date(lastFixTs).toISOString(), lastChangedAtIso: new Date(lastFixTs).toISOString() };
    }
    if (lastReportTs > 0) {
      return { state: "reported", fixedAtIso: "", lastChangedAtIso: new Date(lastReportTs).toISOString() };
    }
    return { state: "", fixedAtIso: "", lastChangedAtIso: "" };
  }, [actionsByLightId, lastFixByLightId]);

  const sortedGroups = useMemo(() => {
    const arr = Array.isArray(groups) ? [...groups] : [];
    if (sortMode === "recent") {
      arr.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      return arr;
    }
    arr.sort((a, b) => (b.count - a.count) || ((b.lastTs || 0) - (a.lastTs || 0)));
    return arr;
  }, [groups, sortMode]);
  const groupCoordsForViewFilter = useCallback((g) => {
    if (!g) return null;
    if (activeDomain === "streetlights") {
      return getCoordsForLightId(g.lightId, reports, officialLights);
    }
    const centerLat = Number(g?.center?.lat);
    const centerLng = Number(g?.center?.lng);
    if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
      return { lat: centerLat, lng: centerLng, isOfficial: false };
    }
    const lat = Number(g?.lat ?? g?.rows?.[0]?.lat);
    const lng = Number(g?.lng ?? g?.rows?.[0]?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng, isOfficial: false };
    }
    return null;
  }, [activeDomain, reports, officialLights]);
  const visibleGroups = useMemo(() => {
    const base = Array.isArray(sortedGroups) ? sortedGroups : [];
    if (!(inViewOnlyActive && mapBounds)) return base;
    return base.filter((g) => {
      const coords = groupCoordsForViewFilter(g);
      const lat = Number(coords?.lat);
      const lng = Number(coords?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return isPointInBounds(lat, lng, mapBounds);
    });
  }, [sortedGroups, inViewOnlyActive, mapBounds, groupCoordsForViewFilter]);
  const inViewIncidentIdSet = useMemo(() => {
    if (!(inViewOnlyActive && mapBounds)) return null;
    const ids = new Set();
    for (const g of visibleGroups || []) {
      const incidentId = String(g?.incidentId || g?.lightId || "").trim();
      if (incidentId) ids.add(incidentId);
    }
    return ids;
  }, [inViewOnlyActive, mapBounds, visibleGroups]);
  const exactIncidentSearch = useMemo(() => {
    const raw = String(searchQuery || "").trim();
    if (!raw) return "";
    const upper = raw.toUpperCase();
    if (/^(SL|PH|WD)\d{10}$/.test(upper)) return upper;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
      return raw.toLowerCase();
    }
    return "";
  }, [searchQuery]);
  const bypassDateRangeForExactIncidentSearch = Boolean(exactIncidentSearch);

  const matchedSearchRows = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return [];
    const from = (() => {
      const s = String(exportFromDate || "").trim();
      if (!s) return null;
      return parseIsoDate(s);
    })();
    const toExclusive = (() => {
      const s = String(exportToDate || "").trim();
      if (!s) return null;
      const d = parseIsoDate(s);
      if (!d) return null;
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return next;
    })();
    const inRange = (ts) => {
      if (bypassDateRangeForExactIncidentSearch) return true;
      const n = Number(ts || 0);
      if (!n) return false;
      const d = new Date(n);
      if (from && d < from) return false;
      if (toExclusive && d >= toExclusive) return false;
      return true;
    };
    const digitsQ = normalizePhone(q);
    const out = [];
    for (const g of visibleGroups || []) {
      const isStreetlights = activeDomain === "streetlights";
      const coords = isStreetlights
        ? getCoordsForLightId(g.lightId, reports, officialLights)
        : groupCoordsForViewFilter(g);
      const locationLabel =
        String(g.location_label || "").trim() ||
        readLocationFromNote(g.rows?.[0]?.note) ||
        (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)
          ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
          : "Location unavailable");
      for (const r of g?.rows || []) {
        const ts = Number(r?.ts || 0);
        if (!inRange(ts)) continue;
        const reportNo = reportNumberForRow(r, activeDomain).toLowerCase();
        const name = String(r?.reporter_name || "").toLowerCase();
        const email = String(r?.reporter_email || "").toLowerCase();
        const phoneNorm = normalizePhone(r?.reporter_phone || "");
        const lightId = String(g?.lightId || "").toLowerCase();
        const incidentIdRaw = String(r?.incident_id || g?.incidentId || g?.lightId || "").trim();
        const groupDisplayIdRaw = String(g?.displayId || "").trim();
        const displayId =
          activeDomain === "potholes"
            ? (
              /^PH\d{10}$/i.test(groupDisplayIdRaw)
                ? groupDisplayIdRaw.toUpperCase()
                : (
                  Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)
                    ? makePotholeIdFromCoords(Number(coords.lat), Number(coords.lng))
                    : ""
                )
            )
            : activeDomain === "water_drain_issues"
              ? (
                /^WD\d{10}$/i.test(groupDisplayIdRaw)
                  ? groupDisplayIdRaw.toUpperCase()
                  : makeWaterDrainIdFromIncidentId(incidentIdRaw)
              )
              : (/^SL\d{10}$/i.test(groupDisplayIdRaw) ? groupDisplayIdRaw.toUpperCase() : displayLightId(incidentIdRaw || g?.lightId, slIdByUuid));
        const incidentLabel =
          activeDomain === "potholes"
            ? `Pothole ID ${displayId || `PH${shortIncidentKey(incidentIdRaw || g?.lightId)}`}`
            : activeDomain === "water_drain_issues"
              ? `Water/Drain ID ${displayId || `WD${shortIncidentKey(incidentIdRaw || g?.lightId)}`}`
              : displayLightId(incidentIdRaw || g?.lightId, slIdByUuid);
        const displayIdNorm = String(displayId || "").toLowerCase();
        const matches =
          reportNo.includes(q) ||
          name.includes(q) ||
          email.includes(q) ||
          lightId.includes(q) ||
          incidentLabel.toLowerCase().includes(q) ||
          displayIdNorm.includes(q) ||
          (digitsQ && phoneNorm.includes(digitsQ));
        if (!matches) continue;
        out.push({
          id: `${g.lightId}:${r.id}`,
          lightId: g.lightId,
          row: r,
          coords,
          locationLabel,
          count: Number(g?.count || 0),
          isStreetlights,
          incidentLabel,
        });
      }
    }
    return out.sort((a, b) => Number(b?.row?.ts || 0) - Number(a?.row?.ts || 0));
  }, [
    searchQuery,
    sortedGroups,
    visibleGroups,
    activeDomain,
    reports,
    officialLights,
    slIdByUuid,
    exportFromDate,
    exportToDate,
    parseIsoDate,
    bypassDateRangeForExactIncidentSearch,
    groupCoordsForViewFilter,
  ]);

  const parseLocalDateStart = useCallback((v) => {
    return parseIsoDate(v);
  }, [parseIsoDate]);

  const parseLocalDateEndExclusive = useCallback((v) => {
    const d = parseIsoDate(v);
    if (!d) return null;
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return next;
  }, [parseIsoDate]);

  const escapeIlikeTerm = useCallback((v) => {
    return String(v || "")
      .replace(/[%]/g, "\\%")
      .replace(/[_]/g, "\\_")
      .replace(/[,]/g, " ")
      .trim();
  }, []);

  const isOpenLifecycleState = useCallback((state) => {
    const s = String(state || "").trim().toLowerCase();
    if (!s) return true;
    if (s === "fixed") return false;
    if (s === "archived") return false;
    if (s === "likely_resolved") return false;
    if (s === "closed") return false;
    if (s === "resolved") return false;
    if (s === "completed") return false;
    if (s === "done") return false;
    if (s === "operational") return false;
    return true;
  }, []);

  const getIncidentStateForDisplay = useCallback((incidentId, rows = []) => {
    const id = String(incidentId || "").trim();
    if (!id) return { state: "", fixedAtIso: "", lastChangedAtIso: "" };

    if (activeDomain === "streetlights") {
      const confidence = getStreetlightConfidence(id);
      if (confidence) {
        const closedAtMs = Number(confidence?.latestWorkingTs || confidence?.lastSignalTs || 0);
        const lastChangedMs = Number(confidence?.lastSignalTs || 0);
        return {
          state: String(confidence?.state || "").trim(),
          fixedAtIso: confidence?.closed && closedAtMs ? new Date(closedAtMs).toISOString() : "",
          lastChangedAtIso: lastChangedMs ? new Date(lastChangedMs).toISOString() : "",
        };
      }
    }

    return deriveIncidentStateFromTimeline(id, rows);
  }, [activeDomain, deriveIncidentStateFromTimeline, getStreetlightConfidence]);

  const matchesStatusFilter = useCallback((state) => {
    if (statusFilter === "all") return true;
    const isOpen = isOpenLifecycleState(state);
    return statusFilter === "open" ? isOpen : !isOpen;
  }, [statusFilter, isOpenLifecycleState]);

  useEffect(() => {
    setServerViewsDisabled(false);
  }, [activeDomain]);

  useEffect(() => {
    let cancelled = false;
    async function loadServerDetailRows() {
      if (!open || !useServerViews) {
        if (!cancelled) {
          setServerDetailRows(null);
          setServerDetailError("");
          setServerDetailLoading(false);
        }
        return;
      }
      setServerDetailLoading(true);
      setServerDetailError("");
      try {
        let q = supabase
          .from("export_incident_detail_v1")
          .select(
            "report_id,report_number,domain,incident_id,submitted_at,fixed_at,time_to_close_seconds,current_state,reporter_name,reporter_email,reporter_phone,notes,source"
          )
          .eq("domain", activeDomain)
          .order("submitted_at", { ascending: false })
          .limit(5000);

        const from = parseLocalDateStart(exportFromDate);
        const toExclusive = parseLocalDateEndExclusive(exportToDate);
        if (from) q = q.gte("submitted_at", from.toISOString());
        if (toExclusive) q = q.lt("submitted_at", toExclusive.toISOString());

        const sq = String(searchQuery || "").trim();
        if (sq) {
          const like = `%${escapeIlikeTerm(sq)}%`;
          q = q.or(
            [
              `report_number.ilike.${like}`,
              `incident_id.ilike.${like}`,
              `reporter_name.ilike.${like}`,
              `reporter_email.ilike.${like}`,
              `reporter_phone.ilike.${like}`,
            ].join(",")
          );
        }

        const { data, error } = await q;
        if (error) throw error;
        if (!cancelled) setServerDetailRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) {
          if (isLikelyPermanentViewError(e)) setServerViewsDisabled(true);
          setServerDetailRows(null);
          setServerDetailError(String(e?.message || e || "Failed to load export dataset"));
        }
      } finally {
        if (!cancelled) setServerDetailLoading(false);
      }
    }
    loadServerDetailRows();
    return () => {
      cancelled = true;
    };
  }, [
    open,
    useServerViews,
    activeDomain,
    exportFromDate,
    exportToDate,
    searchQuery,
    parseLocalDateStart,
    parseLocalDateEndExclusive,
    escapeIlikeTerm,
    serverViewsDisabled,
    isLikelyPermanentViewError,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadMetricsViews() {
      if (!open || !useServerViews) {
        if (!cancelled) {
          setMetricsViewRows({
            stateCounts: [],
            closeStats: null,
            topRecurring: [],
          });
        }
        return;
      }
      try {
        const [stateCountsRes, closeStatsRes, topRecurringRes] = await Promise.all([
          supabase
            .from("metrics_incident_state_counts_v1")
            .select("domain,current_state,incident_count")
            .eq("domain", activeDomain),
          supabase
            .from("metrics_time_to_close_v1")
            .select("domain,closed_incident_count,avg_time_to_close_seconds,p50_time_to_close_seconds,p90_time_to_close_seconds")
            .eq("domain", activeDomain)
            .maybeSingle(),
          supabase
            .from("metrics_top_recurring_incidents_v1")
            .select("domain,incident_id,reopen_count,last_changed_at")
            .eq("domain", activeDomain)
            .order("reopen_count", { ascending: false })
            .order("last_changed_at", { ascending: false })
            .limit(5),
        ]);

        if (stateCountsRes.error) throw stateCountsRes.error;
        if (closeStatsRes.error && closeStatsRes.status !== 406) throw closeStatsRes.error;
        if (topRecurringRes.error) throw topRecurringRes.error;

        if (!cancelled) {
          setMetricsViewRows({
            stateCounts: Array.isArray(stateCountsRes.data) ? stateCountsRes.data : [],
            closeStats: closeStatsRes.data || null,
            topRecurring: Array.isArray(topRecurringRes.data) ? topRecurringRes.data : [],
          });
        }
      } catch {
        if (!cancelled) {
          setMetricsViewRows({
            stateCounts: [],
            closeStats: null,
            topRecurring: [],
          });
        }
      }
    }
    loadMetricsViews();
    return () => {
      cancelled = true;
    };
  }, [open, useServerViews, activeDomain, serverViewsDisabled]);

  const localExportDetailRows = useMemo(() => {
    const from = parseLocalDateStart(exportFromDate);
    const toExclusive = parseLocalDateEndExclusive(exportToDate);
    const inRange = (ts) => {
      if (bypassDateRangeForExactIncidentSearch) return true;
      const n = Number(ts || 0);
      if (!n) return false;
      const d = new Date(n);
      if (from && d < from) return false;
      if (toExclusive && d >= toExclusive) return false;
      return true;
    };

    const detail = [];
    if (String(searchQuery || "").trim()) {
      for (const item of matchedSearchRows) {
        const ts = Number(item?.row?.ts || 0);
        if (!inRange(ts)) continue;
        const reportNumber = reportNumberForRow(item.row, activeDomain);
        const rawIncidentId = item?.isStreetlights
          ? String(item.lightId || "")
          : String(item.row?.incident_id || item.lightId || "");
        const incidentId = (() => {
          if (activeDomain === "potholes") {
            const fromRowPid = String(item?.row?.pothole_id || "").trim();
            if (fromRowPid) return `pothole:${fromRowPid}`;
            return rawIncidentId.replace(/^potholes:/i, "pothole:");
          }
          return rawIncidentId;
        })();
        const snapshot = incidentStateByKey?.[incidentSnapshotKey(activeDomain, incidentId)] || null;
        detail.push({
          report_id: String(item?.row?.id || ""),
          report_number: reportNumber,
          report_type: String(item?.row?.type || item?.row?.report_type || ""),
          domain: activeDomain,
          incident_id: incidentId,
          submitted_at: ts ? new Date(ts).toISOString() : "",
          fixed_at: snapshot?.state === "fixed" ? String(snapshot?.last_changed_at || "") : "",
          time_to_close_seconds: "",
          current_state: String(snapshot?.state || ""),
          reporter_name: String(item?.row?.reporter_name || ""),
          reporter_email: String(item?.row?.reporter_email || ""),
          reporter_phone: String(item?.row?.reporter_phone || ""),
          raw_notes: String(item?.row?.note || ""),
          notes: String(stripSystemMetadataFromNote(item?.row?.note || "") || ""),
        });
      }
      return detail;
    }

    if (isAdmin && (activeDomain === "potholes" || activeDomain === "water_drain_issues")) {
      const byIncident = new Map();
      for (const r of allDomainReports || []) {
        let incidentId = "";
        if (activeDomain === "potholes") {
          const pid = String(r?.pothole_id || "").trim();
          if (!pid) continue;
          incidentId = `pothole:${pid}`;
        } else {
          incidentId = String(r?.light_id || "").trim();
          if (!incidentId) {
            const lat = Number(r?.lat);
            const lng = Number(r?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            incidentId = lightIdFor(lat, lng);
          }
        }
        if (!byIncident.has(incidentId)) byIncident.set(incidentId, []);
        byIncident.get(incidentId).push(r);
      }

      for (const [incidentId, rows] of byIncident.entries()) {
        if (inViewIncidentIdSet && !inViewIncidentIdSet.has(String(incidentId || "").trim())) continue;
        const sortedRows = [...rows].sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
        const timelineState = getIncidentStateForDisplay(incidentId, sortedRows);
        for (const r of sortedRows) {
          const ts = Number(r?.ts || 0);
          if (!inRange(ts)) continue;
          detail.push({
            report_id: String(r?.id || ""),
            report_number: reportNumberForRow(r, activeDomain),
            report_type: String(r?.type || r?.report_type || ""),
            domain: activeDomain,
            incident_id: incidentId,
            submitted_at: ts ? new Date(ts).toISOString() : "",
            fixed_at: timelineState.fixedAtIso,
            time_to_close_seconds: "",
            current_state: timelineState.state,
            reporter_name: String(r?.reporter_name || ""),
            reporter_email: String(r?.reporter_email || ""),
            reporter_phone: String(r?.reporter_phone || ""),
            raw_notes: String(r?.note || ""),
            notes: String(stripSystemMetadataFromNote(r?.note || "") || ""),
          });
        }
      }
    } else {
      for (const g of visibleGroups || []) {
        const incidentId = String(g?.incidentId || g?.lightId || "");
        const snapshot = incidentStateByKey?.[incidentSnapshotKey(activeDomain, incidentId)] || null;
        const timelineState = getIncidentStateForDisplay(incidentId, g?.rows || []);
        for (const r of g?.rows || []) {
          const ts = Number(r?.ts || 0);
          if (!inRange(ts)) continue;
          detail.push({
            report_id: String(r?.id || ""),
            report_number: reportNumberForRow(r, activeDomain),
            report_type: String(r?.type || r?.report_type || ""),
            domain: activeDomain,
            incident_id: incidentId,
            submitted_at: ts ? new Date(ts).toISOString() : "",
            fixed_at: timelineState.fixedAtIso || (snapshot?.state === "fixed" ? String(snapshot?.last_changed_at || "") : ""),
            time_to_close_seconds: "",
            current_state: String(timelineState.state || snapshot?.state || ""),
            reporter_name: String(r?.reporter_name || ""),
            reporter_email: String(r?.reporter_email || ""),
            reporter_phone: String(r?.reporter_phone || ""),
            raw_notes: String(r?.note || ""),
            notes: String(stripSystemMetadataFromNote(r?.note || "") || ""),
          });
        }
      }
    }
    return detail.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
  }, [
    isAdmin,
    allDomainReports,
    deriveIncidentStateFromTimeline,
    getIncidentStateForDisplay,
    parseLocalDateStart,
    parseLocalDateEndExclusive,
    exportFromDate,
    exportToDate,
    searchQuery,
    matchedSearchRows,
    visibleGroups,
    inViewIncidentIdSet,
    activeDomain,
    incidentStateByKey,
    bypassDateRangeForExactIncidentSearch,
  ]);

  const exportDetailRows = useMemo(() => {
    const potholeById = new Map(
      (potholes || []).map((p) => [String(p?.id || "").trim(), p]).filter(([id]) => !!id)
    );
    const resolveIncidentPublicId = (domain, incidentId) => {
      const d = String(domain || "").trim().toLowerCase();
      const id = String(incidentId || "").trim();
      if (!id) return "";
      if (d === "potholes") {
        const pid = id.replace(/^pothole:/i, "").trim();
        const p = potholeById.get(pid);
        if (p && Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng))) {
          return makePotholeIdFromCoords(Number(p.lat), Number(p.lng));
        }
        return `PH${shortIncidentKey(id)}`;
      }
      if (d === "water_drain_issues") {
        return makeWaterDrainIdFromIncidentId(id);
      }
      return shortIncidentKey(id);
    };

    let baseRows = useServerViews && Array.isArray(serverDetailRows)
      ? serverDetailRows.map((r) => {
        const domain = String(r?.domain ?? activeDomain);
        const incidentId = String(r?.incident_id ?? "");
        const snapshot = incidentStateByKey?.[incidentSnapshotKey(domain, incidentId)] || null;
        const actionRows = Array.isArray(actionsByLightId?.[incidentId]) ? actionsByLightId[incidentId] : [];
        const latestFixAction = actionRows
          .filter((a) => String(a?.action || "").toLowerCase() === "fix")
          .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))[0] || null;
        const submittedAt = String(r?.submitted_at ?? "");
        const submittedMs = Date.parse(submittedAt) || 0;
        const inferredFixedAtFromAction =
          latestFixAction && Number(latestFixAction?.ts || 0) >= submittedMs
            ? new Date(Number(latestFixAction.ts)).toISOString()
            : "";
        const fixedAt = String(
          r?.fixed_at ||
          snapshot?.last_changed_at ||
          inferredFixedAtFromAction ||
          ""
        );
        const inferredState = String(
          r?.current_state ||
          snapshot?.state ||
          (fixedAt ? "fixed" : "") ||
          ""
        );
        return {
          report_id: String(r?.report_id ?? ""),
          report_number: String(r?.report_number ?? ""),
          report_type: String(r?.report_type ?? ""),
          domain,
          incident_id: incidentId,
          incident_public_id: resolveIncidentPublicId(domain, incidentId),
          submitted_at: submittedAt,
          fixed_at: fixedAt,
          time_to_close_seconds:
            r?.time_to_close_seconds === null || r?.time_to_close_seconds === undefined
              ? ""
              : Number(r.time_to_close_seconds),
          current_state: inferredState,
          reporter_name: String(r?.reporter_name ?? ""),
          reporter_email: String(r?.reporter_email ?? ""),
          reporter_phone: String(r?.reporter_phone ?? ""),
          raw_notes: String(r?.raw_notes ?? r?.notes ?? ""),
          notes: String(r?.notes ?? ""),
        };
      })
      : (localExportDetailRows || []).map((r) => {
        const domain = String(r?.domain ?? activeDomain);
        const incidentId = String(r?.incident_id ?? "");
        return {
          ...r,
          incident_public_id: resolveIncidentPublicId(domain, incidentId),
        };
      });

    // Hygiene: drop stale incidents tied to deleted/missing official assets for asset-based domains.
    if (activeDomain === "streetlights") {
      return baseRows.filter((r) => officialIdSetForExport.has(String(r?.incident_id || "").trim()));
    }
    if (activeDomain === "street_signs") {
      return baseRows.filter((r) => officialSignIdSetForExport.has(String(r?.incident_id || "").trim()));
    }
    return baseRows;
  }, [
    useServerViews,
    serverDetailRows,
    incidentStateByKey,
    actionsByLightId,
    localExportDetailRows,
    potholes,
    activeDomain,
    officialIdSetForExport,
    officialSignIdSetForExport,
  ]);

  const filteredExportDetailRows = useMemo(
    () => (exportDetailRows || []).filter((r) => matchesStatusFilter(r?.current_state)),
    [exportDetailRows, matchesStatusFilter]
  );

  const exportSummaryRows = useMemo(() => {
    const byIncident = new Map();
    for (const r of filteredExportDetailRows) {
      const key = `${r.domain}::${r.incident_id}`;
      const prev = byIncident.get(key);
      if (!prev) {
        byIncident.set(key, {
          domain: r.domain,
          incident_id: r.incident_id,
          incident_public_id: r.incident_public_id,
          first_reported_at: r.submitted_at,
          latest_reported_at: r.submitted_at,
          fixed_at: r.fixed_at,
          time_to_close_seconds: r.time_to_close_seconds,
          current_state: r.current_state,
          report_count: 1,
        });
        continue;
      }
      prev.report_count += 1;
      if (String(r.submitted_at) < String(prev.first_reported_at)) prev.first_reported_at = r.submitted_at;
      if (String(r.submitted_at) > String(prev.latest_reported_at)) prev.latest_reported_at = r.submitted_at;
      if (!prev.fixed_at && r.fixed_at) prev.fixed_at = r.fixed_at;
      if (!prev.current_state && r.current_state) prev.current_state = r.current_state;
    }
    const rows = Array.from(byIncident.values()).map((r) => {
      const firstMs = Date.parse(String(r.first_reported_at || ""));
      const fixedMs = Date.parse(String(r.fixed_at || ""));
      const ttc =
        Number.isFinite(firstMs) && Number.isFinite(fixedMs) && fixedMs >= firstMs
          ? Math.round((fixedMs - firstMs) / 1000)
          : "";
      return { ...r, time_to_close_seconds: ttc };
    });
    return rows.sort((a, b) =>
      String(b.latest_reported_at).localeCompare(String(a.latest_reported_at))
    );
  }, [filteredExportDetailRows]);

  const groupByIncidentId = useMemo(() => {
    const m = new Map();
    for (const g of groups || []) {
      const key = String(g?.incidentId || g?.lightId || "").trim();
      if (!key) continue;
      m.set(key, g);
    }
    return m;
  }, [groups]);

  const adminTableRows = useMemo(() => {
    const grouped = new Map();
    const potholeById = new Map(
      (potholes || []).map((p) => [String(p?.id || "").trim(), p]).filter(([id]) => !!id)
    );
    for (const r of filteredExportDetailRows || []) {
      const incidentId = String(r?.incident_id || "").trim();
      if (!incidentId) continue;
      if (!grouped.has(incidentId)) {
        const g = groupByIncidentId.get(incidentId);
        const isStreetlights = activeDomain === "streetlights";
        let coords = isStreetlights
          ? getCoordsForLightId(incidentId, reports, officialLights)
          : {
              lat: Number(g?.lat ?? g?.rows?.[0]?.lat),
              lng: Number(g?.lng ?? g?.rows?.[0]?.lng),
              isOfficial: false,
            };
        grouped.set(incidentId, {
          incident_id: incidentId,
          incident_display_id: String(g?.lightId || "").trim(),
          incident_public_id: String(r?.incident_public_id || "").trim(),
          incident_label: "",
          primary_report_number: "",
          current_state: String(r?.current_state || ""),
          fixed_at: String(r?.fixed_at || ""),
          report_count: 0,
          latest_submitted_at: "",
          coords,
          rows: [],
        });
      }
      const item = grouped.get(incidentId);
      item.report_count += 1;
      item.rows.push({
        report_id: String(r?.report_id || ""),
        report_number: String(r?.report_number || ""),
        report_type: String(r?.report_type || ""),
        submitted_at: String(r?.submitted_at || ""),
        reporter_name: String(r?.reporter_name || ""),
        reporter_email: String(r?.reporter_email || ""),
        reporter_phone: String(r?.reporter_phone || ""),
        raw_notes: String(r?.raw_notes || ""),
        notes: String(r?.notes || ""),
      });
      if (!item.latest_submitted_at || String(r?.submitted_at || "") > String(item.latest_submitted_at)) {
        item.latest_submitted_at = String(r?.submitted_at || "");
      }
      if (!item.incident_public_id && String(r?.incident_public_id || "").trim()) {
        item.incident_public_id = String(r.incident_public_id || "").trim();
      }
      if (!item.fixed_at || String(r?.fixed_at || "") > String(item.fixed_at)) {
        item.fixed_at = String(r?.fixed_at || "");
      }
    }

    const rows = Array.from(grouped.values());
    for (const row of rows) {
      if (activeDomain === "potholes" && (!Number.isFinite(Number(row?.coords?.lat)) || !Number.isFinite(Number(row?.coords?.lng)))) {
        const pid = String(row?.incident_id || "").replace(/^pothole:/i, "").trim();
        const p = potholeById.get(pid);
        if (p && Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng))) {
          row.coords = { lat: Number(p.lat), lng: Number(p.lng), isOfficial: false };
        }
      }
      row.rows.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
      row.primary_report_number = String(row.rows?.[0]?.report_number || "").trim();
      const shownDisplay = String(row.incident_display_id || "").trim();
      if (activeDomain === "potholes") {
        const ph = /^PH\d{10}$/i.test(shownDisplay)
          ? shownDisplay.toUpperCase()
          : (
            Number.isFinite(Number(row?.coords?.lat)) && Number.isFinite(Number(row?.coords?.lng))
              ? makePotholeIdFromCoords(Number(row.coords.lat), Number(row.coords.lng))
              : ""
          );
        row.incident_label = `Pothole ID ${ph || `PH${shortIncidentKey(row.incident_id)}`}`;
      } else if (activeDomain === "water_drain_issues") {
        const exportedWd = String(row?.incident_public_id || "").trim();
        const wd = /^WD\d{10}$/i.test(shownDisplay)
          ? shownDisplay.toUpperCase()
          : (/^WD\d{10}$/i.test(exportedWd) ? exportedWd.toUpperCase() : makeWaterDrainIdFromIncidentId(row.incident_id));
        row.incident_label = `Water/Drain ID ${wd}`;
      } else {
        row.incident_label = adminIncidentLabelForDomain(
          activeDomain,
          row.incident_id,
          row.primary_report_number,
          slIdByUuid,
          row.incident_display_id
        );
      }
      const fixAction = (actionsByLightId?.[row.incident_id] || [])
        .filter((a) => String(a?.action || "").toLowerCase() === "fix")
        .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))[0] || null;
      const reopenActionsRaw = (actionsByLightId?.[row.incident_id] || [])
        .filter((a) => String(a?.action || "").toLowerCase() === "reopen")
        .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))
        .map((a) => ({
          ts: Number(a?.ts || 0),
          note: String(a?.note || "").trim(),
          reporter_user_id: a?.actor_user_id || a?.reporter_user_id || null,
          reporter_name: String(a?.actor_name || a?.reporter_name || "").trim() || null,
          reporter_email: String(a?.actor_email || a?.reporter_email || "").trim() || null,
          reporter_phone: String(a?.actor_phone || a?.reporter_phone || "").trim() || null,
        }));
      const seenReopen = new Set();
      row.reopen_events = reopenActionsRaw.filter((ev) => {
        const key = [
          String(Math.floor(Number(ev.ts || 0) / 1000)),
          String(ev.note || ""),
          String(ev.reporter_user_id || ""),
          String(ev.reporter_name || ""),
        ].join("|");
        if (seenReopen.has(key)) return false;
        seenReopen.add(key);
        return true;
      });
      if (fixAction || row.fixed_at) {
        const fixedByUserId = fixAction?.actor_user_id || fixAction?.reporter_user_id || null;
        const isCurrentUserFixer = Boolean(
          fixedByUserId &&
          session?.user?.id &&
          String(fixedByUserId) === String(session.user.id)
        );
        const fallbackName =
          (isCurrentUserFixer
            ? (
              String(profile?.full_name || "").trim() ||
              String(session?.user?.user_metadata?.full_name || "").trim() ||
              String(session?.user?.email || "").split("@")[0]
            )
            : "") ||
          "";
        const fallbackEmail =
          (isCurrentUserFixer
            ? (normalizeEmail(profile?.email || session?.user?.email || "") || "")
            : "") ||
          "";
        const fallbackPhone =
          (isCurrentUserFixer
            ? (normalizePhone(profile?.phone || "") || "")
            : "") ||
          "";
        const fixTs = Number(fixAction?.ts || Date.parse(String(row.fixed_at || "")) || 0);
        row.fixed_event = {
          ts: fixTs,
          note: String(fixAction?.note || "").trim(),
          reporter_user_id: fixedByUserId,
          reporter_name: String(fixAction?.actor_name || fixAction?.reporter_name || "").trim() || fallbackName || null,
          reporter_email: String(fixAction?.actor_email || fixAction?.reporter_email || "").trim() || fallbackEmail || null,
          reporter_phone: String(fixAction?.actor_phone || fixAction?.reporter_phone || "").trim() || fallbackPhone || null,
        };
      } else {
        row.fixed_event = null;
      }
      row.latest_activity_at = String(
        row.fixed_event?.ts && Number(row.fixed_event.ts) > 0
          ? new Date(Number(row.fixed_event.ts)).toISOString()
          : row.latest_submitted_at || ""
      );
      if (row.latest_submitted_at && row.fixed_event?.ts) {
        const reportTs = Date.parse(String(row.latest_submitted_at || "")) || 0;
        const fixedTs = Number(row.fixed_event.ts || 0);
        if (fixedTs <= reportTs) {
          row.latest_activity_at = String(row.latest_submitted_at || "");
        }
      }
    }

    const cityFilteredRows = rows.filter((row) => {
      if (!cityBoundaryLoaded) return true;
      if (typeof isWithinCityLimits !== "function") return true;
      if (activeDomain !== "potholes" && activeDomain !== "water_drain_issues") return true;
      const lat = Number(row?.coords?.lat);
      const lng = Number(row?.coords?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return Boolean(isWithinCityLimits(lat, lng));
    });
    const inViewRows = inViewIncidentIdSet
      ? cityFilteredRows.filter((row) => inViewIncidentIdSet.has(String(row?.incident_id || "").trim()))
      : cityFilteredRows;

    const dir = tableSort?.dir === "asc" ? 1 : -1;
    const key = String(tableSort?.key || "submitted_at");
    inViewRows.sort((a, b) => {
      if (key === "report_count") return (Number(a.report_count || 0) - Number(b.report_count || 0)) * dir;
      if (key === "utility_reported") {
        const aa = Boolean(utilityReportedByIncident?.[a?.incident_id]) ? 1 : 0;
        const bb = Boolean(utilityReportedByIncident?.[b?.incident_id]) ? 1 : 0;
        return (aa - bb) * dir;
      }
      if (key === "submitted_at") {
        const ta = Date.parse(String(a.latest_activity_at || a.latest_submitted_at || "")) || 0;
        const tb = Date.parse(String(b.latest_activity_at || b.latest_submitted_at || "")) || 0;
        return (ta - tb) * dir;
      }
      if (key === "incident_id") {
        const la = String(a?.incident_label || a?.incident_id || "").toLowerCase();
        const lb = String(b?.incident_label || b?.incident_id || "").toLowerCase();
        if (la < lb) return -1 * dir;
        if (la > lb) return 1 * dir;
        return 0;
      }
      const sa = String(a?.[key] || "").toLowerCase();
      const sb = String(b?.[key] || "").toLowerCase();
      if (sa < sb) return -1 * dir;
      if (sa > sb) return 1 * dir;
      return 0;
    });
    return inViewRows;
  }, [
    filteredExportDetailRows,
    groupByIncidentId,
    inViewIncidentIdSet,
    activeDomain,
    reports,
    potholes,
    officialLights,
    slIdByUuid,
    actionsByLightId,
    tableSort,
    utilityReportedByIncident,
    cityBoundaryLoaded,
    isWithinCityLimits,
  ]);

  const displayedAdminRows = adminTableRows;

  useEffect(() => {
    // Cost guardrail: disable passive streetlight hydration in reports views.
    // Streetlight utility details should come from persisted DB fields.
  }, [open, activeDomain, adminTableRows, getStreetlightUtilityDetails, streetlightReportInfoByIncident]);

  const toggleTableSort = useCallback((key) => {
    setTableSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: key === "submitted_at" || key === "report_count" || key === "utility_reported" ? "desc" : "asc" };
    });
  }, []);

  const sortPresetValue = useMemo(() => {
    const key = String(tableSort?.key || "");
    const dir = String(tableSort?.dir || "desc");
    if (key === "submitted_at") return dir === "asc" ? "recent_asc" : "recent_desc";
    if (key === "report_count") return dir === "asc" ? "reports_asc" : "reports_desc";
    if (key === "incident_id") return dir === "asc" ? "id_asc" : "id_desc";
    if (key === "utility_reported") return dir === "asc" ? "utility_asc" : "utility_desc";
    return "recent_desc";
  }, [tableSort]);

  const applySortPreset = useCallback((preset) => {
    const p = String(preset || "").trim().toLowerCase();
    if (p === "recent_asc") return setTableSort({ key: "submitted_at", dir: "asc" });
    if (p === "recent_desc") return setTableSort({ key: "submitted_at", dir: "desc" });
    if (p === "reports_asc") return setTableSort({ key: "report_count", dir: "asc" });
    if (p === "reports_desc") return setTableSort({ key: "report_count", dir: "desc" });
    if (p === "id_asc") return setTableSort({ key: "incident_id", dir: "asc" });
    if (p === "id_desc") return setTableSort({ key: "incident_id", dir: "desc" });
    if (p === "utility_asc") return setTableSort({ key: "utility_reported", dir: "asc" });
    if (p === "utility_desc") return setTableSort({ key: "utility_reported", dir: "desc" });
    setTableSort({ key: "submitted_at", dir: "desc" });
  }, []);

  const toggleAdminExpanded = useCallback((incidentId) => {
    const id = String(incidentId || "").trim();
    if (!id) return;
    setAdminExpandedSet((prev) => {
      if (prev.has(id)) return new Set();
      return new Set([id]);
    });
  }, []);

  const adminIncidentDotForRow = useCallback((row) => {
    const incidentId = String(row?.incident_id || "").trim();
    if (!incidentId) return { color: "#9e9e9e", label: "Unknown incident" };
    const repairSnapshot = getRepairSnapshotForIncident(incidentId);

    if (activeDomain === "streetlights") {
      const confidence = getStreetlightConfidence(incidentId);
      const stateText = String(confidence?.state || row?.current_state || "").trim().toLowerCase();
      if (stateText === "likely_resolved" || stateText === "archived") {
        return { color: "var(--sl-ui-brand-green)", label: "Fixed incident" };
      }
      if (stateText === "high_confidence_outage") {
        return { color: "#f57c00", label: "High-confidence outage" };
      }
      if (stateText === "likely_outage") {
        return { color: "#f1c40f", label: "Likely outage" };
      }
      if (stateText === "unconfirmed") {
        return { color: "#f1c40f", label: "Unconfirmed outage" };
      }
      return { color: "#111", label: "Operational" };
    }

    if (activeDomain === "potholes") {
      if (repairSnapshot?.archived || repairSnapshot?.likelyFixed) {
        return { color: "var(--sl-ui-brand-green)", label: "Community likely fixed" };
      }
      if (!isOpenLifecycleState(row?.current_state || "")) {
        return { color: "var(--sl-ui-brand-green)", label: "Fixed incident" };
      }
      const openCount = Number(row?.report_count || 0);
      return {
        color: potholeColorFromCount(openCount > 0 ? openCount : 1),
        label: "Pothole incident",
      };
    }
    if (activeDomain === "water_drain_issues") {
      if (repairSnapshot?.archived || repairSnapshot?.likelyFixed) {
        return { color: "var(--sl-ui-brand-green)", label: "Community likely fixed" };
      }
      if (!isOpenLifecycleState(row?.current_state || "")) {
        return { color: "var(--sl-ui-brand-green)", label: "Fixed incident" };
      }
      const openCount = Number(row?.report_count || 0);
      return {
        color: openCount <= 1 ? officialStatusFromSinceFixCount(1).color : waterDrainColorFromCount(openCount),
        label: "Water / Drain incident",
      };
    }
    if (activeDomain === "street_signs") return { color: "#1e88e5", label: "Street sign incident" };
    if (activeDomain === "power_outage") return { color: "#f39c12", label: "Power outage incident" };
    if (activeDomain === "water_main") return { color: "#3498db", label: "Water main incident" };
    return { color: "#616161", label: "Incident" };
  }, [activeDomain, getStreetlightConfidence, getRepairSnapshotForIncident, isOpenLifecycleState]);

  const adminMetrics = useMemo(() => {
    const summary = exportSummaryRows || [];
    const filteredDetails = filteredExportDetailRows || [];
    const allDetails = exportDetailRows || [];
    const totalReports = filteredDetails.length; // search/filter results

    // Domain totals: derive from full domain/date dataset, not status-filtered slice.
    const incidentLatestState = new Map();
    for (const r of allDetails) {
      const incidentId = String(r?.incident_id || "").trim();
      if (!incidentId) continue;
      const ts = Date.parse(String(r?.submitted_at || "")) || 0;
      const prev = incidentLatestState.get(incidentId);
      if (!prev || ts >= prev.ts) {
        incidentLatestState.set(incidentId, {
          ts,
          state: String(r?.current_state || "").trim().toLowerCase(),
        });
      }
    }
    const totalIncidents = incidentLatestState.size;
    let fixedIncidents = 0;
    for (const x of incidentLatestState.values()) {
      if (!isOpenLifecycleState(x?.state || "")) fixedIncidents += 1;
    }
    const openIncidents = Math.max(0, totalIncidents - fixedIncidents);

    // Search/filter average time-to-fix based on filtered rows grouped by incident.
    const byIncident = new Map();
    for (const r of filteredDetails) {
      const incidentId = String(r?.incident_id || "").trim();
      if (!incidentId) continue;
      const submittedMs = Date.parse(String(r?.submitted_at || "")) || 0;
      const fixedMs = Date.parse(String(r?.fixed_at || "")) || 0;
      const prev = byIncident.get(incidentId) || { firstSubmittedMs: 0, fixedMs: 0 };
      if (!prev.firstSubmittedMs || (submittedMs && submittedMs < prev.firstSubmittedMs)) prev.firstSubmittedMs = submittedMs;
      if (!prev.fixedMs || (fixedMs && fixedMs > prev.fixedMs)) prev.fixedMs = fixedMs;
      byIncident.set(incidentId, prev);
    }
    let avgTimeToFixSeconds = 0;
    let closeCount = 0;
    for (const x of byIncident.values()) {
      if (!x.firstSubmittedMs || !x.fixedMs || x.fixedMs < x.firstSubmittedMs) continue;
      avgTimeToFixSeconds += Math.round((x.fixedMs - x.firstSubmittedMs) / 1000);
      closeCount += 1;
    }
    avgTimeToFixSeconds = closeCount > 0 ? Math.round(avgTimeToFixSeconds / closeCount) : 0;

    const topRecurring = Array.isArray(metricsViewRows.topRecurring) && metricsViewRows.topRecurring.length
      ? metricsViewRows.topRecurring.map((r) => ({
          domain: r.domain,
          incident_id: r.incident_id,
          report_count: Number(r.reopen_count || 0),
        }))
      : [...summary]
          .sort((a, b) => Number(b?.report_count || 0) - Number(a?.report_count || 0))
          .slice(0, 5);
    return {
      totalReports,
      totalIncidents,
      openIncidents,
      fixedIncidents,
      avgTimeToFixSeconds,
      topRecurring,
    };
  }, [exportSummaryRows, filteredExportDetailRows, exportDetailRows, metricsViewRows, isOpenLifecycleState]);

  const toCsv = useCallback((rows, columns, metadata = null) => {
    const esc = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, "\"\"")}"`;
      return s;
    };
    const metaLines = [];
    if (metadata && typeof metadata === "object") {
      for (const [k, v] of Object.entries(metadata)) {
        if (!k) continue;
        metaLines.push(`# ${String(k)}: ${String(v ?? "")}`);
      }
    }
    const head = columns.join(",");
    const body = rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\n");
    const metaPrefix = metaLines.length ? `${metaLines.join("\n")}\n` : "";
    return `${metaPrefix}${head}\n${body}\n`;
  }, []);

  const buildExportMetadata = useCallback(() => {
    const from = parseLocalDateStart(exportFromDate);
    const toExclusive = parseLocalDateEndExclusive(exportToDate);
    return {
      export_schema_version: EXPORT_SCHEMA_VERSION,
      generated_at_utc: new Date().toISOString(),
      window_start_utc: from ? from.toISOString() : "",
      window_end_utc: toExclusive ? toExclusive.toISOString() : "",
      domain: activeDomain || "all",
      metrics_incidents: Number(adminMetrics.totalIncidents || 0),
      metrics_open: Number(adminMetrics.openIncidents || 0),
      metrics_fixed: Number(adminMetrics.fixedIncidents || 0),
      metrics_reports: Number(adminMetrics.totalReports || 0),
      metrics_avg_time_to_fix_seconds: Number(adminMetrics.avgTimeToFixSeconds || 0),
    };
  }, [
    parseLocalDateStart,
    parseLocalDateEndExclusive,
    exportFromDate,
    exportToDate,
    activeDomain,
    adminMetrics.totalIncidents,
    adminMetrics.openIncidents,
    adminMetrics.fixedIncidents,
    adminMetrics.totalReports,
    adminMetrics.avgTimeToFixSeconds,
  ]);

  const downloadCsv = useCallback((filename, csvText) => {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const logExportAudit = useCallback(
    async (exportKind, rowCount) => {
      if (!isAdmin) return;
      try {
        const normalizedStatus = String(statusFilter || "").toLowerCase();
        const validLifecycleStates = new Set([
          "reported",
          "confirmed",
          "in_progress",
          "fixed",
          "reopened",
          "archived",
        ]);
        const auditState = validLifecycleStates.has(normalizedStatus) ? normalizedStatus : null;
        const payload = {
          p_export_kind: exportKind,
          p_domain: activeDomain,
          p_state: auditState,
          p_from_date: exportFromDate || null,
          p_to_date: exportToDate || null,
          p_incident_id: null,
          p_filters: {
            search: String(searchQuery || "").trim(),
            sort: sortMode,
            domain: activeDomain,
            status_filter: normalizedStatus || null,
            source: "reports_modal",
          },
          p_row_count: Number(rowCount || 0),
        };
        const { error } = await supabase.rpc("log_export_action", payload);
        if (error) {
          console.warn("[log_export_action]", error);
        }
      } catch (e) {
        console.warn("[log_export_action] unexpected", e);
      }
    },
    [isAdmin, sortMode, activeDomain, exportFromDate, exportToDate, searchQuery, statusFilter]
  );

  const exportDetailCsv = useCallback(() => {
    const cols = [
      "report_id",
      "report_number",
      "domain",
      "incident_id",
      "incident_public_id",
      "submitted_at",
      "fixed_at",
      "time_to_close_seconds",
      "current_state",
      "reporter_name",
      "reporter_email",
      "reporter_phone",
      "notes",
    ];
    const csv = toCsv(filteredExportDetailRows, cols, buildExportMetadata());
    downloadCsv(`reports_detail_${activeDomain}_${Date.now()}.csv`, csv);
    void logExportAudit("detail", filteredExportDetailRows.length);
  }, [toCsv, filteredExportDetailRows, activeDomain, downloadCsv, logExportAudit, buildExportMetadata]);

  const exportSummaryCsv = useCallback(() => {
    const cols = [
      "domain",
      "incident_id",
      "incident_public_id",
      "first_reported_at",
      "latest_reported_at",
      "fixed_at",
      "time_to_close_seconds",
      "current_state",
      "report_count",
    ];
    const csv = toCsv(exportSummaryRows, cols, buildExportMetadata());
    downloadCsv(`reports_summary_${activeDomain}_${Date.now()}.csv`, csv);
    void logExportAudit("summary", exportSummaryRows.length);
  }, [toCsv, exportSummaryRows, activeDomain, downloadCsv, logExportAudit, buildExportMetadata]);

  if (!open) return null;
  const openReportsModalMaxHeight =
    "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)";

  return (
    <ModalShell
      open={open}
      zIndex={10004}
      panelStyle={{
        width: "min(980px, calc(100vw - 32px))",
        maxWidth: "980px",
        minWidth: "min(680px, calc(100vw - 32px))",
        height: openReportsModalMaxHeight,
        maxHeight: openReportsModalMaxHeight,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>{modalTitle || "Reports"}</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      {isAdmin && (
        <div
          style={{
            display: "grid",
            gap: 6,
            marginTop: 2,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {compactDomainPicker ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                position: "relative",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setCompactDomainMenuOpen((p) => {
                    const next = !p;
                    if (next) setCompactFiltersOpen(false);
                    return next;
                  });
                }}
                style={{
                  width: "100%",
                  minHeight: 40,
                  borderRadius: 10,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  padding: "7px 10px",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  cursor: "pointer",
                }}
                aria-label="Report domain"
                title={`Report domain: ${selectedDomainMeta?.label || activeDomain}`}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <AppIcon src={selectedDomainMeta?.iconSrc} size={28} />
                  <span>{selectedDomainMeta?.label || activeDomain}</span>
                </span>
                  <span style={{ opacity: 0.85 }}>▾</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCompactFiltersOpen((p) => !p);
                  setCompactDomainMenuOpen(false);
                }}
                style={{
                  width: 54,
                  minWidth: 54,
                  height: 40,
                  borderRadius: 10,
                  border: compactFiltersOpen
                    ? "1px solid var(--sl-ui-brand-green-border)"
                    : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: compactFiltersOpen
                    ? "var(--sl-ui-brand-green)"
                    : "var(--sl-ui-modal-btn-secondary-bg)",
                  color: compactFiltersOpen ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Search and filters"
                title="Search and filters"
              >
                <AppIcon src={UI_ICON_SRC.filter} size={24} />
              </button>
              {compactDomainMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    background: "var(--sl-ui-modal-bg)",
                    border: "1px solid var(--sl-ui-modal-border)",
                    borderRadius: 10,
                    boxShadow: "var(--sl-ui-modal-shadow)",
                    padding: 6,
                    display: "grid",
                    gap: 6,
                    zIndex: 4,
                  }}
                >
                  {(domainOptions || []).filter((d) => d.enabled).map((d) => {
                    const selected = activeDomain === d.key;
                    return (
                      <button
                        key={d.key}
                        type="button"
                        onClick={() => {
                          onSelectDomain?.(d.key);
                          setCompactDomainMenuOpen(false);
                        }}
                        style={{
                          borderRadius: 9,
                          border: selected
                            ? "1px solid var(--sl-ui-brand-green-border)"
                            : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                          background: selected
                            ? "var(--sl-ui-brand-green)"
                            : "var(--sl-ui-modal-btn-secondary-bg)",
                          color: selected ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                          fontWeight: 900,
                          cursor: "pointer",
                          padding: "7px 9px",
                          whiteSpace: "nowrap",
                          display: "flex",
                          alignItems: "center",
                          gap: 7,
                          justifyContent: "flex-start",
                        }}
                        aria-label={d.label}
                        title={d.label}
                      >
                        <AppIcon src={d.iconSrc} size={26} />
                        <span style={{ fontSize: 12.5 }}>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(domainOptions || []).map((d) => {
                const selected = activeDomain === d.key;
                return (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => {
                      if (!d.enabled) return;
                      onSelectDomain?.(d.key);
                    }}
                    disabled={!d.enabled}
                    style={{
                      borderRadius: 10,
                      border: selected
                        ? "1px solid var(--sl-ui-brand-green-border)"
                        : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: selected
                        ? "var(--sl-ui-brand-green)"
                        : "var(--sl-ui-modal-btn-secondary-bg)",
                      color: selected ? "white" : "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: d.enabled ? "pointer" : "not-allowed",
                      opacity: d.enabled ? 1 : 0.55,
                      padding: "8px 10px",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    aria-label={d.label}
                    title={d.enabled ? d.label : `${d.label} (Soon)`}
                  >
                    <AppIcon src={d.iconSrc} size={32} />
                    <span style={{ fontSize: 12.5 }}>{d.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {compactDomainPicker && !isAdmin ? (
        <div style={{ marginTop: 6, position: "relative" }}>
          <button
            type="button"
            onClick={() => setCompactFiltersOpen((p) => !p)}
            style={{
              width: "100%",
              minHeight: 40,
              borderRadius: 10,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              padding: "8px 10px",
              fontSize: 12.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <span>Search & Filters</span>
            <span style={{ opacity: 0.85 }}>{compactFiltersOpen ? "▴" : "▾"}</span>
          </button>
          {compactFiltersOpen && (
            <div
              style={{
                marginTop: 6,
                border: "1px solid var(--sl-ui-modal-border)",
                borderRadius: 10,
                padding: 8,
                display: "grid",
                gap: 8,
                background: "var(--sl-ui-modal-subtle-bg)",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <input
                    value={searchDraft}
                    onChange={(e) => setSearchDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setSearchQuery(String(searchDraft || "").trim());
                    }}
                    placeholder={reportSearchPlaceholder}
                    style={{
                      width: "100%",
                      padding: "9px 30px 9px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-input-border)",
                      background: "var(--sl-ui-modal-input-bg)",
                      color: "var(--sl-ui-text)",
                      fontSize: 12.5,
                    }}
                  />
                  {showSearchClearButton ? (
                    <button
                      type="button"
                      onClick={clearSearchField}
                      style={{
                        position: "absolute",
                        right: 7,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        border: "none",
                        background: "transparent",
                        color: "var(--sl-ui-text)",
                        opacity: 0.55,
                        fontSize: 15,
                        lineHeight: 1,
                        cursor: "pointer",
                        padding: 0,
                      }}
                      aria-label={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                      title={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setSearchQuery(String(searchDraft || "").trim())}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 900,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Apply
                </button>
              </div>
              {isAdmin && (
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                    Status
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(String(e.target.value || "open"))}
                      style={{
                        marginTop: 4,
                        width: "100%",
                        minHeight: 36,
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid var(--sl-ui-modal-input-border)",
                        background: "var(--sl-ui-modal-input-bg)",
                        color: "var(--sl-ui-text)",
                        fontWeight: 800,
                      }}
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                      <option value="all">All</option>
                    </select>
                  </label>
                  <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                    Date range
                    <button
                      type="button"
                      onClick={openDatePicker}
                      style={{
                        marginTop: 4,
                        width: "100%",
                        minHeight: 40,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "1px solid var(--sl-ui-modal-input-border)",
                        background: "var(--sl-ui-modal-input-bg)",
                        color: "var(--sl-ui-text)",
                        fontWeight: 800,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      {dateRangeLabel(exportFromDate, exportToDate)} <span style={{ opacity: 0.75 }}>▾</span>
                    </button>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      ) : compactDomainPicker ? (
        compactFiltersOpen ? (
          <div
            style={{
              marginTop: 6,
              border: "1px solid var(--sl-ui-modal-border)",
              borderRadius: 10,
              padding: 8,
              display: "grid",
              gap: 8,
              background: "var(--sl-ui-modal-subtle-bg)",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(String(e.target.value || "open"))}
                style={{
                  marginTop: 4,
                  width: "100%",
                  minHeight: 40,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--sl-ui-modal-input-border)",
                  background: "var(--sl-ui-modal-input-bg)",
                  color: "var(--sl-ui-text)",
                  fontWeight: 800,
                }}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="all">All</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setSearchQuery(String(searchDraft || "").trim());
                  }}
                  placeholder={reportSearchPlaceholder}
                  style={{
                    width: "100%",
                    padding: "9px 30px 9px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--sl-ui-modal-input-border)",
                    background: "var(--sl-ui-modal-input-bg)",
                    color: "var(--sl-ui-text)",
                    fontSize: 12.5,
                  }}
                />
                {showSearchClearButton ? (
                  <button
                    type="button"
                    onClick={clearSearchField}
                    style={{
                      position: "absolute",
                      right: 7,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      border: "none",
                      background: "transparent",
                      color: "var(--sl-ui-text)",
                      opacity: 0.55,
                      fontSize: 15,
                      lineHeight: 1,
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                    title={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setSearchQuery(String(searchDraft || "").trim())}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Apply
              </button>
            </div>
            <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
              Date range
              <button
                type="button"
                onClick={openDatePicker}
                style={{
                  marginTop: 4,
                  width: "100%",
                  minHeight: 40,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid var(--sl-ui-modal-input-border)",
                  background: "var(--sl-ui-modal-input-bg)",
                  color: "var(--sl-ui-text)",
                  fontWeight: 800,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                {dateRangeLabel(exportFromDate, exportToDate)} <span style={{ opacity: 0.75 }}>▾</span>
              </button>
            </label>
            <div style={{ height: 6 }} />
            <button
              type="button"
              onClick={exportSummaryCsv}
              style={{
                padding: "7px 10px",
                borderRadius: 9,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Export summary CSV
            </button>
            <button
              type="button"
              onClick={exportDetailCsv}
              style={{
                padding: "7px 10px",
                borderRadius: 9,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Export detail CSV
            </button>
          </div>
        ) : null
      ) : (
        <>
          <div style={{ marginTop: 6, minHeight: 42, display: "flex", gap: 8 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSearchQuery(String(searchDraft || "").trim());
                }}
                placeholder={reportSearchPlaceholder}
                style={{
                  width: "100%",
                  padding: "9px 30px 9px 10px",
                  borderRadius: 10,
                  border: "1px solid var(--sl-ui-modal-input-border)",
                  background: "var(--sl-ui-modal-input-bg)",
                  color: "var(--sl-ui-text)",
                  fontSize: 12.5,
                }}
              />
              {showSearchClearButton ? (
                <button
                  type="button"
                  onClick={clearSearchField}
                  style={{
                    position: "absolute",
                    right: 7,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: "none",
                    background: "transparent",
                    color: "var(--sl-ui-text)",
                    opacity: 0.55,
                    fontSize: 15,
                    lineHeight: 1,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                  title={inViewOnlyActive ? "Clear search and in-view filter" : "Clear search"}
                >
                  ×
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSearchQuery(String(searchDraft || "").trim())}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Apply
            </button>
          </div>

          {isAdmin && (
            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                Status{" "}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(String(e.target.value || "open"))}
                  style={{
                    marginLeft: 6,
                    minHeight: 34,
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid var(--sl-ui-modal-input-border)",
                    background: "var(--sl-ui-modal-input-bg)",
                    color: "var(--sl-ui-text)",
                    fontWeight: 800,
                  }}
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="all">All</option>
                </select>
              </label>
              <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.85 }}>
                Date range{" "}
                <button
                  type="button"
                  onClick={openDatePicker}
                  style={{
                    marginLeft: 6,
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--sl-ui-modal-input-border)",
                    background: "var(--sl-ui-modal-input-bg)",
                    color: "var(--sl-ui-text)",
                    fontWeight: 800,
                    cursor: "pointer",
                    minWidth: 250,
                    textAlign: "left",
                  }}
                >
                  {dateRangeLabel(exportFromDate, exportToDate)} <span style={{ opacity: 0.75 }}>▾</span>
                </button>
              </label>
              <button
                type="button"
                onClick={exportSummaryCsv}
                style={{
                  padding: "7px 10px",
                  borderRadius: 9,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Export summary CSV
              </button>
              <button
                type="button"
                onClick={exportDetailCsv}
                style={{
                  padding: "7px 10px",
                  borderRadius: 9,
                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                  color: "var(--sl-ui-modal-btn-secondary-text)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Export detail CSV
              </button>
            </div>
          )}
        </>
      )}

      {datePickerOpen && (
        <div
          onClick={cancelDatePicker}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10055,
            background: "rgba(8, 12, 18, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(960px, calc(100vw - 24px))",
              maxHeight: "calc(100dvh - 40px)",
              borderRadius: 12,
              border: "1px solid var(--sl-ui-modal-border)",
              background: "var(--sl-ui-modal-bg)",
              boxShadow: "var(--sl-ui-modal-shadow)",
              display: "grid",
              gridTemplateRows: "1fr auto",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: compactDomainPicker ? "1fr" : "190px 1fr",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  borderRight: compactDomainPicker ? "none" : "1px solid var(--sl-ui-modal-border)",
                  borderBottom: compactDomainPicker ? "1px solid var(--sl-ui-modal-border)" : "none",
                  padding: 10,
                  display: "grid",
                  gap: 8,
                  alignContent: "start",
                }}
              >
                {DATE_PRESET_OPTIONS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPresetToDraft(preset.key)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 9,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", minHeight: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "10px 12px",
                    borderBottom: "1px solid var(--sl-ui-modal-border)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => shiftCalendarMonths(-1)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                    aria-label="Previous month"
                    title="Previous month"
                  >
                    ‹
                  </button>
                  <div style={{ fontSize: 12.5, fontWeight: 900, opacity: 0.9 }}>
                    {dateRangeLabel(draftRangeFrom || exportFromDate, draftRangeTo || exportToDate)}
                  </div>
                  <button
                    type="button"
                    onClick={() => shiftCalendarMonths(1)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                    aria-label="Next month"
                    title="Next month"
                  >
                    ›
                  </button>
                </div>
                <div
                  style={{
                    padding: 12,
                    overflow: "auto",
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: compactDomainPicker ? "1fr" : "1fr 1fr",
                  }}
                >
                  {[calendarLeftMonth, rightMonthDate].map((monthDate) => {
                    const cells = monthDate === calendarLeftMonth ? leftMonthCells : rightMonthCells;
                    return (
                      <div
                        key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                        style={{
                          border: "1px solid var(--sl-ui-modal-border)",
                          borderRadius: 10,
                          padding: 8,
                          display: "grid",
                          gap: 6,
                        }}
                      >
                        <div style={{ textAlign: "center", fontWeight: 900 }}>
                          {formatMonthLabel(monthDate)}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 11.5, opacity: 0.85 }}>
                          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                            <div key={`${monthDate.getMonth()}-${d}`} style={{ textAlign: "center", fontWeight: 800 }}>
                              {d}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                          {cells.map((iso, idx) => {
                            if (!iso) {
                              return <div key={`blank-${idx}`} style={{ height: 30 }} />;
                            }
                            const inRange = isDateInDraftRange(iso);
                            const isStart = iso === draftRangeFrom;
                            const isEnd = iso === draftRangeTo;
                            return (
                              <button
                                key={iso}
                                type="button"
                                onClick={() => pickCalendarDate(iso)}
                                style={{
                                  height: 30,
                                  borderRadius: isStart || isEnd ? 8 : inRange ? 6 : 8,
                                  border: isStart || isEnd
                                    ? "1px solid var(--sl-ui-brand-green-border)"
                                    : "1px solid transparent",
                                  background: isStart || isEnd
                                    ? "var(--sl-ui-brand-green)"
                                    : inRange
                                      ? "rgba(22, 152, 133, 0.24)"
                                      : "var(--sl-ui-modal-btn-secondary-bg)",
                                  color: isStart || isEnd ? "white" : "var(--sl-ui-text)",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                                title={iso}
                              >
                                {Number(iso.slice(8, 10))}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div
              style={{
                borderTop: "1px solid var(--sl-ui-modal-border)",
                padding: 10,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 12.5, opacity: 0.85 }}>
                {dateRangeLabel(draftRangeFrom || exportFromDate, draftRangeTo || exportToDate)}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={cancelDatePicker}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 9,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyDatePicker}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 9,
                    border: "1px solid var(--sl-ui-brand-green-border)",
                    background: "var(--sl-ui-brand-green)",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && (
        <div
          style={{
            marginTop: 6,
            display: "grid",
            gap: 8,
            border: "1px solid var(--sl-ui-metrics-panel-border)",
            borderRadius: 10,
            padding: 8,
            boxShadow: "inset 0 0 0 1px var(--sl-ui-metrics-panel-border)",
          }}
        >
          <button
            type="button"
            onClick={() => setMetricsCollapsed((v) => !v)}
            style={{
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              borderRadius: 10,
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
              padding: "7px 9px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 12 }}>Metrics (domain + date range)</span>
            <span style={{ opacity: 0.85 }}>{metricsCollapsed ? "▾" : "▴"}</span>
          </button>
          {!metricsCollapsed && (compactDomainPicker ? (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
                {[
                  { key: "incidents", label: "Incidents", value: adminMetrics.totalIncidents, gridColumn: "1" },
                  { key: "open", label: "Open", value: adminMetrics.openIncidents, gridColumn: "2" },
                  { key: "fixed", label: "Fixed", value: adminMetrics.fixedIncidents, gridColumn: "3" },
                  { key: "reports", label: "Reports", value: adminMetrics.totalReports, gridColumn: "2" },
                  {
                    key: "avg",
                    label: "Avg time to fix",
                    value: adminMetrics.avgTimeToFixSeconds
                      ? `${Math.round(adminMetrics.avgTimeToFixSeconds / 3600)}h`
                      : "N/A",
                    gridColumn: "3",
                  },
                ].map((m) => (
                  <div
                    key={`metric-${m.key}`}
                    style={{
                      gridColumn: m.gridColumn,
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 10,
                      padding: "6px 8px",
                      fontSize: 11.5,
                      fontWeight: 900,
                      display: "grid",
                      gap: 2,
                      background: "var(--sl-ui-modal-subtle-bg)",
                    }}
                  >
                    <span style={{ opacity: 0.8 }}>{m.label}</span>
                    <span>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(130px, 1fr))", gap: 8 }}>
                {[
                  { key: "incidents", label: "Incidents", value: adminMetrics.totalIncidents, gridColumn: "1" },
                  { key: "open", label: "Open", value: adminMetrics.openIncidents, gridColumn: "2" },
                  { key: "fixed", label: "Fixed", value: adminMetrics.fixedIncidents, gridColumn: "3" },
                  { key: "reports", label: "Reports", value: adminMetrics.totalReports, gridColumn: "2" },
                  {
                    key: "avg",
                    label: "Avg time to fix",
                    value: adminMetrics.avgTimeToFixSeconds
                      ? `${Math.round(adminMetrics.avgTimeToFixSeconds / 3600)}h`
                      : "N/A",
                    gridColumn: "3",
                  },
                ].map((m) => (
                  <div
                    key={`metric-${m.key}`}
                    style={{
                      gridColumn: m.gridColumn,
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 8,
                      padding: "7px 8px",
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    <div style={{ fontSize: 11.5, opacity: 0.8, fontWeight: 800 }}>{m.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 950 }}>{m.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "none" }} />
        </div>
      )}

      {isAdmin && compactDomainPicker && (
        <div style={{ marginTop: 6, width: "100%", boxSizing: "border-box" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 800, opacity: 0.9 }}>
            <span>Sort reports</span>
            <select
              value={sortPresetValue}
              onChange={(e) => applySortPreset(e.target.value)}
              style={{
                width: "100%",
                minHeight: 40,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
                fontWeight: 800,
              }}
            >
              <option value="recent_desc">Most recently reported (desc)</option>
              <option value="recent_asc">Most recently reported (asc)</option>
              <option value="reports_desc">Most reports (desc)</option>
              <option value="reports_asc">Most reports (asc)</option>
              <option value="id_asc">{activeDomain === "potholes" ? "Pothole ID" : "Incident ID"} (asc)</option>
              <option value="id_desc">{activeDomain === "potholes" ? "Pothole ID" : "Incident ID"} (desc)</option>
              {isStreetlightMyReports && (
                <>
                  <option value="utility_desc">Utility reported: true first</option>
                  <option value="utility_asc">Utility reported: false first</option>
                </>
              )}
            </select>
          </label>
        </div>
      )}

      <div
        ref={listScrollRef}
        style={{
          width: "100%",
          boxSizing: "border-box",
          marginTop: 6,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          border: "1px solid rgba(0,0,0,0.10)",
          borderRadius: 10,
          padding: 10,
          display: "grid",
          gap: 10,
        }}
      >
        {isAdmin ? (
          !displayedAdminRows.length ? (
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {serverDetailLoading ? "Loading rows…" : "No reports in selected filters."}
            </div>
          ) : compactDomainPicker ? (
            <div style={{ display: "grid", gap: 8, width: "100%" }}>
              {displayedAdminRows.map((r) => {
                const repairSnapshot = getRepairSnapshotForIncident(r.incident_id);
                const showPublicRepairAction = typeof canShowPublicRepairAction === "function"
                  ? canShowPublicRepairAction(r.incident_id, activeDomain)
                  : false;
                return (
                <div
                  key={`mobile-${r.incident_id}`}
                  style={{
                    border: "1px solid var(--sl-ui-open-reports-item-border)",
                    borderRadius: 10,
                    padding: 10,
                    display: "grid",
                    gap: 6,
                    background: "var(--sl-ui-modal-subtle-bg)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleAdminExpanded(r.incident_id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--sl-ui-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                      padding: 0,
                      textAlign: "left",
                    }}
                  >
                    {adminExpandedSet.has(r.incident_id) ? "▾ " : "▸ "}
                    {r.incident_label || r.incident_id}
                  </button>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    <b>State:</b> {incidentStateLabel(r.current_state || "")}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    <b>Reports:</b> {Number(r.report_count || 0)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    <b>Latest report:</b> {formatTs(isStreetlightMyReports ? r.latest_submitted_at : (r.latest_activity_at || r.latest_submitted_at))}
                  </div>
                  {repairSnapshot && activeDomain !== "streetlights" && activeDomain !== "street_signs" && (
                    <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                      <b>Community repair:</b> {incidentRepairSummaryText(repairSnapshot)}
                    </div>
                  )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                      type="button"
                      onClick={() => {
                        if (!Number.isFinite(r.coords?.lat) || !Number.isFinite(r.coords?.lng)) return;
                        onFlyTo?.([r.coords.lat, r.coords.lng], 18, r.incident_id);
                      }}
                      style={{
                        padding: "6px 8px",
                        borderRadius: 8,
                        border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                        background: "var(--sl-ui-modal-btn-secondary-bg)",
                        color: "var(--sl-ui-modal-btn-secondary-text)",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Fly to
                    </button>
                    {activeDomain === "streetlights" && canMutateIncidents && (
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.open(STREETLIGHT_UTILITY_REPORT_URL, "_blank", "noopener,noreferrer");
                          }
                        }}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                          background: "var(--sl-ui-modal-btn-secondary-bg)",
                          color: "var(--sl-ui-modal-btn-secondary-text)",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        Report Outage to Utility
                      </button>
                    )}
                    {canMutateIncidents && (
                      <button
                        type="button"
                        onClick={() => onMarkFixedIncident?.(r.incident_id, isOpenLifecycleState(r.current_state || "") ? "fix" : "reopen")}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: "none",
                          background: "var(--sl-ui-brand-green)",
                          color: "white",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        {isOpenLifecycleState(r.current_state || "") ? "Mark fixed" : "Re-open"}
                      </button>
                    )}
                    {!canMutateIncidents && showPublicRepairAction && (
                      <button
                        type="button"
                        onClick={() => onConfirmRepairIncident?.(r.incident_id, activeDomain)}
                        style={{
                          padding: "6px 8px",
                          borderRadius: 8,
                          border: "none",
                          background: "var(--sl-ui-brand-green)",
                          color: "white",
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                      >
                        Is fixed
                      </button>
                    )}
                    {isStreetlightMyReports && isOpenLifecycleState(r.current_state || "") && (
                      <>
                        {canShowWorkingActionForIncident(r.incident_id) && (
                          <button
                            type="button"
                            onClick={() => onMarkWorkingIncident?.(r.incident_id)}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 8,
                              border: "none",
                              background: "var(--sl-ui-brand-green)",
                              color: "white",
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            Is working
                          </button>
                        )}
                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.95 }}>
                          <input
                            type="checkbox"
                            checked={Boolean(utilityReportedByIncident[r.incident_id])}
                            onChange={(e) => {
                              if (e.target.checked) openUtilityReportDialog(r.incident_id);
                              else void clearUtilityReported(r.incident_id);
                            }}
                          />
                          Utility reported
                        </label>
                        {Boolean(utilityReportedByIncident[r.incident_id]) && (
                          <button
                            type="button"
                            onClick={() => openUtilityReportDialog(r.incident_id)}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 8,
                              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                              background: "var(--sl-ui-modal-btn-secondary-bg)",
                              color: "var(--sl-ui-modal-btn-secondary-text)",
                              fontWeight: 900,
                              cursor: "pointer",
                            }}
                          >
                            {utilityReportReferenceByIncident?.[r.incident_id] ? "Edit report #" : "Add report #"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {isStreetlightMyReports && Boolean(utilityReportedByIncident[r.incident_id]) && (
                    <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>
                      <b>Utility report #:</b> {utilityReportReferenceByIncident?.[r.incident_id] || "Not added yet"}
                    </div>
                  )}
                  {repairSnapshot?.viewerHasRepairSignal && activeDomain !== "streetlights" && activeDomain !== "street_signs" && (
                    <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.3 }}>
                      You already confirmed this repair.
                    </div>
                  )}
                  {adminExpandedSet.has(r.incident_id) && (
                    <div style={{ display: "grid", gap: 6 }}>
                      {Array.isArray(r.reopen_events) && r.reopen_events.map((ev) => (
                        <div
                          key={`reopen-${r.incident_id}-${ev.ts || 0}`}
                          style={{
                            border: "1px solid var(--sl-ui-open-reports-item-border)",
                            borderRadius: 8,
                            padding: "7px 8px",
                            display: "grid",
                            gap: 4,
                            background: "rgba(31,93,162,0.16)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900 }}>Re-open report</div>
                            <div style={{ opacity: 0.8 }}>{formatTs(ev.ts)}</div>
                          </div>
                          <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                            <b>Re-opened by:</b>{" "}
                            <button
                              type="button"
                              onClick={() =>
                                onReporterDetails?.({
                                  id: `reopen:${r.incident_id}:${ev.ts || 0}`,
                                  reporter_user_id: ev.reporter_user_id || null,
                                  reporter_name: ev.reporter_name || null,
                                  reporter_email: ev.reporter_email || null,
                                  reporter_phone: ev.reporter_phone || null,
                                  note: ev.note || "",
                                  ts: Number(ev.ts || 0),
                                  report_number: null,
                                })
                              }
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                margin: 0,
                                color: "var(--sl-ui-brand-green)",
                                textDecoration: "underline",
                                cursor: "pointer",
                                fontWeight: 900,
                              }}
                            >
                              {String(ev.reporter_name || "").trim() || String(ev.reporter_email || "").trim() || "Unknown"}
                            </button>
                          </div>
                          {!!String(ev.note || "").trim() && (
                            <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
                              <b>Note:</b> {ev.note}
                            </div>
                          )}
                        </div>
                      ))}
                      {!!r.fixed_event && (
                        <div
                          style={{
                            border: "1px solid var(--sl-ui-open-reports-item-border)",
                            borderRadius: 8,
                            padding: "7px 8px",
                            display: "grid",
                            gap: 4,
                            background: "rgba(46,125,50,0.14)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900 }}>Fixed report</div>
                            <div style={{ opacity: 0.8 }}>{formatTs(r.fixed_event.ts)}</div>
                          </div>
                          <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                            <b>Fixed by:</b>{" "}
                            <button
                              type="button"
                              onClick={() =>
                                onReporterDetails?.({
                                  id: `fixed:${r.incident_id}:${r.fixed_event.ts || 0}`,
                                  reporter_user_id: r.fixed_event.reporter_user_id || null,
                                  reporter_name: r.fixed_event.reporter_name || null,
                                  reporter_email: r.fixed_event.reporter_email || null,
                                  reporter_phone: r.fixed_event.reporter_phone || null,
                                  note: r.fixed_event.note || "",
                                  ts: Number(r.fixed_event.ts || 0),
                                  report_number: null,
                                })
                              }
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                margin: 0,
                                color: "var(--sl-ui-brand-green)",
                                textDecoration: "underline",
                                cursor: "pointer",
                                fontWeight: 900,
                              }}
                            >
                              {String(r.fixed_event.reporter_name || "").trim() || String(r.fixed_event.reporter_email || "").trim() || "Unknown"}
                            </button>
                          </div>
                          {!!String(r.fixed_event.note || "").trim() && (
                            <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
                              <b>Note:</b> {r.fixed_event.note}
                            </div>
                          )}
                        </div>
                      )}
                      {r.rows.map((detail) => {
                        const rawNotes = String(detail.raw_notes || detail.notes || "");
                        const imageUrl = readImageUrlFromNote(rawNotes);
                        const noteText = stripSystemMetadataFromNote(rawNotes) || detail.notes;
                        const qa = parseStreetlightQaFromNote(rawNotes);
                        return (
                          <div
                            key={`mobile-detail-${r.incident_id}-${detail.report_id}`}
                            style={{
                              border: "1px solid var(--sl-ui-open-reports-item-border)",
                              borderRadius: 8,
                              padding: "7px 8px",
                              display: "grid",
                              gap: 4,
                              background: "rgba(255,255,255,0.04)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 900 }}>Submitted report</div>
                              <div style={{ opacity: 0.8 }}>{formatTs(detail.submitted_at)}</div>
                            </div>
                            {isStreetlightMyReports && (
                              <>
                                <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                  <b>What are you seeing:</b> {REPORT_TYPES?.[String(detail.report_type || "").trim()] || "Streetlight issue"}
                                </div>
                                <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                  <b>Power on in area:</b> {qa?.powerOn ? (qa.powerOn === "yes" ? "Yes" : qa.powerOn === "no" ? "No" : "Unknown") : "Unknown"}
                                </div>
                                <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                  <b>Hazardous situation:</b> {qa?.hazardous ? (qa.hazardous === "yes" ? "Yes" : qa.hazardous === "no" ? "No" : "Unknown") : "Unknown"}
                                </div>
                              </>
                            )}
                            {canMutateIncidents && (
                              <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                <b>Submitted by:</b>{" "}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onReporterDetails?.({
                                      id: detail.report_id,
                                      reporter_user_id: detail.reporter_user_id || null,
                                      reporter_name: detail.reporter_name || null,
                                      reporter_email: detail.reporter_email || null,
                                      reporter_phone: detail.reporter_phone || null,
                                      note: rawNotes,
                                      ts: Date.parse(String(detail.submitted_at || "")) || 0,
                                      report_number: detail.report_number,
                                    })
                                  }
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    padding: 0,
                                    margin: 0,
                                    color: "var(--sl-ui-brand-green)",
                                    textDecoration: "underline",
                                    cursor: "pointer",
                                    fontWeight: 900,
                                  }}
                                >
                                  {String(detail.reporter_name || "").trim() || String(detail.reporter_email || "").trim() || "Unknown"}
                                </button>
                              </div>
                            )}
                            {!!String(noteText || "").trim() && (
                              <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
                                <b>Note:</b> {noteText}
                              </div>
                            )}
                            {!!imageUrl && (
                              <a
                                href={imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  padding: "5px 8px",
                                  borderRadius: 8,
                                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                                  color: "var(--sl-ui-modal-btn-secondary-text)",
                                  fontWeight: 900,
                                  textDecoration: "none",
                                  width: "fit-content",
                                }}
                                title="View attached image"
                              >
                                📷 View image
                              </a>
                            )}
                          </div>
                        );
                      })}
                      {activeDomain === "streetlights" && (() => {
                        const utilityOpen = streetlightUtilityExpandedSet.has(r.incident_id);
                        const utilityLoading = Boolean(streetlightUtilityLoadingByIncident?.[r.incident_id]);
                        const util = getStreetlightUtilityForIncident(r.incident_id);
                        const items = getStreetlightUtilityRows(util, r?.coords || null);
                        return (
                          <div
                            style={{
                              border: "1px solid var(--sl-ui-open-reports-item-border)",
                              borderRadius: 8,
                              padding: "7px 8px",
                              display: "grid",
                              gap: 6,
                              background: "rgba(255,255,255,0.04)",
                              fontSize: 12,
                              lineHeight: 1.3,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => toggleStreetlightUtilityExpanded(r.incident_id, r?.coords || null)}
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                margin: 0,
                                textAlign: "left",
                                color: "var(--sl-ui-text)",
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 900,
                              }}
                            >
                              {utilityOpen ? "▾ " : "▸ "}Streetlight Utility Information
                            </button>
                            {utilityOpen ? (
                              utilityLoading ? (
                                <div style={{ opacity: 0.82 }}>Loading location info...</div>
                              ) : (
                                items.map((item) => (
                                  <button
                                    key={`mobile-streetlight-${r.incident_id}-${item.label}`}
                                    type="button"
                                    onClick={(e) => copyStreetlightField(item.label, item.value, e.currentTarget)}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      padding: 0,
                                      margin: 0,
                                      textAlign: "left",
                                      color: "var(--sl-ui-text)",
                                      cursor: "copy",
                                      fontSize: 12,
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    <b>{item.label}:</b>{" "}
                                    <span
                                      style={{
                                        textDecoration: "underline",
                                        textUnderlineOffset: "2px",
                                        color: "#7fd7ff",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {item.value}
                                    </span>
                                  </button>
                                ))
                              )
                            ) : null}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                overflow: "auto",
                border: "1px solid var(--sl-ui-open-reports-item-border)",
                borderRadius: 10,
                background: "var(--sl-ui-modal-subtle-bg)",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ position: "sticky", top: 0, background: "var(--sl-ui-modal-bg)", zIndex: 1 }}>
                    {[
                      { key: "incident_id", label: activeDomain === "streetlights" ? "Light ID" : "Incident" },
                      { key: "current_state", label: "State" },
                      { key: "report_count", label: "Reports" },
                      { key: "submitted_at", label: "Latest report" },
                      { key: "actions", label: "Actions" },
                      ...(isStreetlightMyReports ? [{ key: "utility_reported", label: "Utility reported" }] : []),
                    ].map((h) => (
                      <th
                        key={h.key}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          borderBottom: "1px solid var(--sl-ui-open-reports-item-border)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h.key === "actions" ? (
                          h.label
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleTableSort(h.key)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "var(--sl-ui-text)",
                              fontWeight: 900,
                              padding: 0,
                              cursor: "pointer",
                            }}
                          >
                            {h.label}
                            {tableSort.key === h.key ? (tableSort.dir === "asc" ? " ▲" : " ▼") : ""}
                          </button>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedAdminRows.map((r) => {
                    const repairSnapshot = getRepairSnapshotForIncident(r.incident_id);
                    const showPublicRepairAction = typeof canShowPublicRepairAction === "function"
                      ? canShowPublicRepairAction(r.incident_id, activeDomain)
                      : false;
                    return (
                    <Fragment key={r.incident_id}>
                      <tr>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                          <button
                            type="button"
                            onClick={() => toggleAdminExpanded(r.incident_id)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "var(--sl-ui-text)",
                              fontWeight: 900,
                              cursor: "pointer",
                              padding: 0,
                            }}
                            title="Toggle incident reports"
                          >
                            {adminExpandedSet.has(r.incident_id) ? "▾ " : "▸ "}
                            {r.incident_label || r.incident_id}
                            <span
                              style={{
                                display: "inline-block",
                                width: 10,
                                height: 10,
                                borderRadius: 999,
                                background: adminIncidentDotForRow(r).color,
                                boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                                marginLeft: 7,
                                verticalAlign: "middle",
                              }}
                              title={adminIncidentDotForRow(r).label}
                            />
                          </button>
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                          {incidentStateLabel(r.current_state || "")}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)", fontWeight: 900 }}>
                          {Number(r.report_count || 0)}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                          {formatTs(isStreetlightMyReports ? r.latest_submitted_at : (r.latest_activity_at || r.latest_submitted_at))}
                        </td>
                        <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (!Number.isFinite(r.coords?.lat) || !Number.isFinite(r.coords?.lng)) return;
                                onFlyTo?.([r.coords.lat, r.coords.lng], 18, r.incident_id);
                              }}
                              style={{
                                padding: "6px 8px",
                                borderRadius: 8,
                                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                                background: "var(--sl-ui-modal-btn-secondary-bg)",
                                color: "var(--sl-ui-modal-btn-secondary-text)",
                                fontWeight: 900,
                                cursor: "pointer",
                              }}
                            >
                              Fly to
                            </button>
                            {activeDomain === "streetlights" && canMutateIncidents && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (typeof window !== "undefined") {
                                    window.open(STREETLIGHT_UTILITY_REPORT_URL, "_blank", "noopener,noreferrer");
                                  }
                                }}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                                  background: "var(--sl-ui-modal-btn-secondary-bg)",
                                  color: "var(--sl-ui-modal-btn-secondary-text)",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                }}
                              >
                                Report Outage to Utility
                              </button>
                            )}
                            {canMutateIncidents && (
                              <button
                                type="button"
                                onClick={() => onMarkFixedIncident?.(r.incident_id, isOpenLifecycleState(r.current_state || "") ? "fix" : "reopen")}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: "var(--sl-ui-brand-green)",
                                  color: "white",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                }}
                              >
                                {isOpenLifecycleState(r.current_state || "") ? "Mark fixed" : "Re-open"}
                              </button>
                            )}
                            {!canMutateIncidents && showPublicRepairAction && (
                              <button
                                type="button"
                                onClick={() => onConfirmRepairIncident?.(r.incident_id, activeDomain)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: "var(--sl-ui-brand-green)",
                                  color: "white",
                                  fontWeight: 900,
                                  cursor: "pointer",
                                }}
                              >
                                Is fixed
                              </button>
                            )}
                          </div>
                        </td>
                        {isStreetlightMyReports && (
                          <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                        {isOpenLifecycleState(r.current_state || "") ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                {canShowWorkingActionForIncident(r.incident_id) && (
                                  <button
                                    type="button"
                                    onClick={() => onMarkWorkingIncident?.(r.incident_id)}
                                    style={{
                                      padding: "6px 8px",
                                      borderRadius: 8,
                                      border: "none",
                                      background: "var(--sl-ui-brand-green)",
                                      color: "white",
                                      fontWeight: 900,
                                      cursor: "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    Is working
                                  </button>
                                )}
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.95 }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(utilityReportedByIncident[r.incident_id])}
                                    onChange={(e) => {
                                      if (e.target.checked) openUtilityReportDialog(r.incident_id);
                                      else void clearUtilityReported(r.incident_id);
                                    }}
                                    aria-label={`Utility reported for ${r.incident_label || r.incident_id}`}
                                  />
                                  Utility reported
                                </label>
                                {Boolean(utilityReportedByIncident[r.incident_id]) && (
                                  <button
                                    type="button"
                                    onClick={() => openUtilityReportDialog(r.incident_id)}
                                    style={{
                                      padding: "6px 8px",
                                      borderRadius: 8,
                                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                                      color: "var(--sl-ui-modal-btn-secondary-text)",
                                      fontWeight: 900,
                                      cursor: "pointer",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {utilityReportReferenceByIncident?.[r.incident_id] ? "Edit report #" : "Add report #"}
                                  </button>
                                )}
                                {Boolean(utilityReportedByIncident[r.incident_id]) && (
                                  <span style={{ fontSize: 12, opacity: 0.82 }}>
                                    #{utilityReportReferenceByIncident?.[r.incident_id] || "Pending"}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </td>
                        )}
                      </tr>
                      {adminExpandedSet.has(r.incident_id) && (
                        <tr>
                          <td colSpan={isStreetlightMyReports ? 6 : 5} style={{ padding: 0, borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>
                            <div style={{ padding: 8, display: "grid", gap: 6, background: "var(--sl-ui-modal-subtle-bg)" }}>
                              {repairSnapshot && activeDomain !== "streetlights" && activeDomain !== "street_signs" && (
                                <div
                                  style={{
                                    border: "1px solid var(--sl-ui-open-reports-item-border)",
                                    borderRadius: 8,
                                    padding: "7px 8px",
                                    display: "grid",
                                    gap: 4,
                                    background: "rgba(46,125,50,0.10)",
                                  }}
                                >
                                  <div style={{ fontWeight: 900 }}>Community Repair Status</div>
                                  <div style={{ opacity: 0.9, lineHeight: 1.35 }}>{incidentRepairSummaryText(repairSnapshot)}</div>
                                  {repairSnapshot?.viewerHasRepairSignal && (
                                    <div style={{ opacity: 0.8, lineHeight: 1.3 }}>You already confirmed this repair.</div>
                                  )}
                                </div>
                              )}
                              {Array.isArray(r.reopen_events) && r.reopen_events.map((ev) => (
                                <div
                                  key={`reopen-${r.incident_id}-${ev.ts || 0}`}
                                  style={{
                                    border: "1px solid var(--sl-ui-open-reports-item-border)",
                                    borderRadius: 8,
                                    padding: "7px 8px",
                                    display: "grid",
                                    gap: 4,
                                    background: "rgba(31,93,162,0.16)",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                    <div style={{ fontWeight: 900 }}>Re-open report</div>
                                    <div style={{ opacity: 0.8 }}>{formatTs(ev.ts)}</div>
                                  </div>
                                  <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                    <b>Re-opened by:</b>{" "}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onReporterDetails?.({
                                          id: `reopen:${r.incident_id}:${ev.ts || 0}`,
                                          reporter_user_id: ev.reporter_user_id || null,
                                          reporter_name: ev.reporter_name || null,
                                          reporter_email: ev.reporter_email || null,
                                          reporter_phone: ev.reporter_phone || null,
                                          note: ev.note || "",
                                          ts: Number(ev.ts || 0),
                                          report_number: null,
                                        })
                                      }
                                      style={{
                                        border: "none",
                                        background: "transparent",
                                        padding: 0,
                                        margin: 0,
                                        color: "var(--sl-ui-brand-green)",
                                        textDecoration: "underline",
                                        cursor: "pointer",
                                        fontWeight: 900,
                                      }}
                                    >
                                      {String(ev.reporter_name || "").trim() || String(ev.reporter_email || "").trim() || "Unknown"}
                                    </button>
                                  </div>
                                  {!!String(ev.note || "").trim() && (
                                    <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
                                      <b>Note:</b> {ev.note}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {!!r.fixed_event && (
                                <div
                                  style={{
                                    border: "1px solid var(--sl-ui-open-reports-item-border)",
                                    borderRadius: 8,
                                    padding: "7px 8px",
                                    display: "grid",
                                    gap: 4,
                                    background: "rgba(46,125,50,0.14)",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                    <div style={{ fontWeight: 900 }}>Fixed report</div>
                                    <div style={{ opacity: 0.8 }}>{formatTs(r.fixed_event.ts)}</div>
                                  </div>
                                  <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                    <b>Fixed by:</b>{" "}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onReporterDetails?.({
                                          id: `fixed:${r.incident_id}:${r.fixed_event.ts || 0}`,
                                          reporter_user_id: r.fixed_event.reporter_user_id || null,
                                          reporter_name: r.fixed_event.reporter_name || null,
                                          reporter_email: r.fixed_event.reporter_email || null,
                                          reporter_phone: r.fixed_event.reporter_phone || null,
                                          note: r.fixed_event.note || "",
                                          ts: Number(r.fixed_event.ts || 0),
                                          report_number: null,
                                        })
                                      }
                                      style={{
                                        border: "none",
                                        background: "transparent",
                                        padding: 0,
                                        margin: 0,
                                        color: "var(--sl-ui-brand-green)",
                                        textDecoration: "underline",
                                        cursor: "pointer",
                                        fontWeight: 900,
                                      }}
                                    >
                                      {String(r.fixed_event.reporter_name || "").trim() || String(r.fixed_event.reporter_email || "").trim() || "Unknown"}
                                    </button>
                                  </div>
                                  {!!String(r.fixed_event.note || "").trim() && (
                                    <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
                                      <b>Note:</b> {r.fixed_event.note}
                                    </div>
                                  )}
                                </div>
                              )}
                              {r.rows.map((detail) => (
                                <div
                                  key={`${r.incident_id}:${detail.report_id}`}
                                  style={{
                                    border: "1px solid var(--sl-ui-open-reports-item-border)",
                                    borderRadius: 8,
                                    padding: "7px 8px",
                                    display: "grid",
                                    gap: 4,
                                    background: "rgba(255,255,255,0.04)",
                                  }}
                                >
                                  {(() => {
                                    const rawNotes = String(detail.raw_notes || detail.notes || "");
                                    const imageUrl = readImageUrlFromNote(rawNotes);
                                    const noteText = stripSystemMetadataFromNote(rawNotes) || detail.notes;
                                    const qa = parseStreetlightQaFromNote(rawNotes);
                                    return (
                                      <>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                    <div style={{ fontWeight: 900 }}>Submitted report</div>
                                    <div style={{ opacity: 0.8 }}>{formatTs(detail.submitted_at)}</div>
                                  </div>
                                  {isStreetlightMyReports && (
                                    <>
                                      <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                        <b>What are you seeing:</b> {REPORT_TYPES?.[String(detail.report_type || "").trim()] || "Streetlight issue"}
                                      </div>
                                      <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                        <b>Power on in area:</b> {qa?.powerOn ? (qa.powerOn === "yes" ? "Yes" : qa.powerOn === "no" ? "No" : "Unknown") : "Unknown"}
                                      </div>
                                      <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                        <b>Hazardous situation:</b> {qa?.hazardous ? (qa.hazardous === "yes" ? "Yes" : qa.hazardous === "no" ? "No" : "Unknown") : "Unknown"}
                                      </div>
                                    </>
                                  )}
                                  {canMutateIncidents && (
                                    <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                                      <b>Submitted by:</b>{" "}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onReporterDetails?.({
                                            id: detail.report_id,
                                            reporter_user_id: detail.reporter_user_id || null,
                                            reporter_name: detail.reporter_name || null,
                                            reporter_email: detail.reporter_email || null,
                                            reporter_phone: detail.reporter_phone || null,
                                            note: rawNotes,
                                            ts: Date.parse(String(detail.submitted_at || "")) || 0,
                                            report_number: detail.report_number,
                                          })
                                        }
                                        style={{
                                          border: "none",
                                          background: "transparent",
                                          padding: 0,
                                          margin: 0,
                                          color: "var(--sl-ui-brand-green)",
                                          textDecoration: "underline",
                                          cursor: "pointer",
                                          fontWeight: 900,
                                        }}
                                      >
                                        {String(detail.reporter_name || "").trim() || String(detail.reporter_email || "").trim() || "Unknown"}
                                      </button>
                                    </div>
                                  )}
                                  {!!String(noteText || "").trim() && (
                                    <div style={{ opacity: 0.85, lineHeight: 1.3 }}>
                                      <b>Note:</b> {noteText}
                                    </div>
                                  )}
                                  {!!imageUrl && (
                                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                                      <a
                                        href={imageUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 6,
                                          padding: "5px 8px",
                                          borderRadius: 8,
                                          border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                                          background: "var(--sl-ui-modal-btn-secondary-bg)",
                                          color: "var(--sl-ui-modal-btn-secondary-text)",
                                          fontWeight: 900,
                                          textDecoration: "none",
                                        }}
                                        title="View attached image"
                                      >
                                        📷 View image
                                      </a>
                                    </div>
                                  )}
                                      </>
                                    );
                                  })()}
                                </div>
                              ))}
                              {activeDomain === "streetlights" && (() => {
                                const utilityOpen = streetlightUtilityExpandedSet.has(r.incident_id);
                                const utilityLoading = Boolean(streetlightUtilityLoadingByIncident?.[r.incident_id]);
                                const util = getStreetlightUtilityForIncident(r.incident_id);
                                const items = getStreetlightUtilityRows(util, r?.coords || null);
                                return (
                                  <div
                                    style={{
                                      border: "1px solid var(--sl-ui-open-reports-item-border)",
                                      borderRadius: 8,
                                      padding: "7px 8px",
                                      display: "grid",
                                      gap: 6,
                                      background: "rgba(255,255,255,0.04)",
                                      fontSize: 12,
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleStreetlightUtilityExpanded(r.incident_id, r?.coords || null)}
                                      style={{
                                        border: "none",
                                        background: "transparent",
                                        padding: 0,
                                        margin: 0,
                                        textAlign: "left",
                                        color: "var(--sl-ui-text)",
                                        cursor: "pointer",
                                        fontSize: 12,
                                        fontWeight: 900,
                                      }}
                                    >
                                      {utilityOpen ? "▾ " : "▸ "}Streetlight Utility Information
                                    </button>
                                    {utilityOpen ? (
                                      utilityLoading ? (
                                        <div style={{ opacity: 0.82 }}>Loading location info...</div>
                                      ) : (
                                        items.map((item) => (
                                          <button
                                            key={`desktop-streetlight-${r.incident_id}-${item.label}`}
                                            type="button"
                                            onClick={(e) => copyStreetlightField(item.label, item.value, e.currentTarget)}
                                            style={{
                                              border: "none",
                                              background: "transparent",
                                              padding: 0,
                                              margin: 0,
                                              textAlign: "left",
                                              color: "var(--sl-ui-text)",
                                              cursor: "copy",
                                              fontSize: 12,
                                              lineHeight: 1.3,
                                            }}
                                          >
                                            <b>{item.label}:</b>{" "}
                                            <span
                                              style={{
                                                textDecoration: "underline",
                                                textUnderlineOffset: "2px",
                                                color: "#7fd7ff",
                                                fontWeight: 700,
                                              }}
                                            >
                                              {item.value}
                                            </span>
                                          </button>
                                        ))
                                      )
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (String(searchQuery || "").trim() ? (
          !matchedSearchRows.length ? (
            <div style={{ fontSize: 13, opacity: 0.8 }}>No matching reports found.</div>
          ) : (
            matchedSearchRows.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1px solid var(--sl-ui-open-reports-item-border)",
                  borderRadius: 10,
                  padding: 10,
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => onFlyTo?.([item.coords?.lat, item.coords?.lng], 18, item.lightId)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      fontWeight: 950,
                      fontSize: 12.5,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      color: "var(--sl-ui-text)",
                    }}
                    title="Fly to report location"
                  >
                    {item.incidentLabel || displayLightId(item.lightId, slIdByUuid)}
                  </button>
                  <button
                    onClick={() => onFlyTo?.([item.coords?.lat, item.coords?.lng], 18, item.lightId)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Fly to
                  </button>
                  {item.isStreetlights && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.open(STREETLIGHT_UTILITY_REPORT_URL, "_blank", "noopener,noreferrer");
                        }
                      }}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 10,
                        border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                        background: "var(--sl-ui-modal-btn-secondary-bg)",
                        color: "var(--sl-ui-modal-btn-secondary-text)",
                        fontWeight: 900,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Report Outage to Utility
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 900 }}>
                  Report #: {reportNumberForRow(item.row, activeDomain)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.85 }}>
                  {formatTs(item.row?.ts)}
                </div>
                {!item.isStreetlights && (
                  <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>
                    <b>Location:</b> {item.locationLabel}
                  </div>
                )}
                {!!String(item.row?.note || "").trim() && (
                  <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>
                    <b>Note:</b> {stripSystemMetadataFromNote(item.row.note) || item.row.note}
                  </div>
                )}
                {canMutateIncidents && (
                  <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
                    <b>Submitted by:</b>{" "}
                    <button
                      type="button"
                      onClick={() => onReporterDetails?.(item.row)}
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        margin: 0,
                        color: "var(--sl-ui-brand-green)",
                        textDecoration: "underline",
                        cursor: "pointer",
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      {String(item?.row?.reporter_name || "").trim() || String(item?.row?.reporter_email || "").trim() || "Unknown"}
                    </button>
                  </div>
                )}
              </div>
            ))
          )
        ) : !visibleGroups?.length ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>No reports in selected filters.</div>
        ) : (
          visibleGroups.map((g) => {
            const isStreetlights = activeDomain === "streetlights";
            const coords = isStreetlights
              ? getCoordsForLightId(g.lightId, reports, officialLights)
              : {
                  lat: Number(g.lat ?? g.rows?.[0]?.lat),
                  lng: Number(g.lng ?? g.rows?.[0]?.lng),
                  isOfficial: false,
                };
            const confidence = isStreetlights ? getStreetlightConfidence(g.lightId) : null;
            const info = isStreetlights
              ? {
                  majorityLabel: incidentStateLabel(confidence?.state || "operational") || "Operational",
                  isFixed: Boolean(confidence?.closed),
                }
              : { majorityLabel: (domainOptions || []).find((d) => d.key === activeDomain)?.label || "Report" };
            const nonStreetlightDotColor =
              activeDomain === "potholes"
                ? potholeColorFromCount(Number(g?.count || 0))
                : activeDomain === "water_drain_issues"
                  ? ((!isAdmin && Number(g?.count || 0) === 1)
                      ? officialStatusFromSinceFixCount(1).color
                      : waterDrainColorFromCount(Number(g?.count || 0)))
                : activeDomain === "street_signs"
                  ? "#1e88e5"
                : activeDomain === "power_outage"
                  ? "#f39c12"
                  : activeDomain === "water_main"
                    ? "#3498db"
                    : "#616161";
            const dot = isStreetlights
              ? (() => {
                  if (confidence?.state === "high_confidence_outage") return { color: "#f57c00", label: "High-confidence outage" };
                  if (confidence?.state === "likely_outage") return { color: "#f1c40f", label: "Likely outage" };
                  if (confidence?.state === "unconfirmed") return { color: "#f1c40f", label: "Unconfirmed outage" };
                  if (confidence?.closed) return { color: "var(--sl-ui-brand-green)", label: "Closed report" };
                  return { color: "#111", label: "Operational" };
                })()
              : { color: nonStreetlightDotColor, label: info.majorityLabel };
            const isOpen = expandedSet?.has(g.lightId);
            const locationLabel =
              String(g.location_label || "").trim() ||
              readLocationFromNote(g.rows?.[0]?.note) ||
              (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)
                ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                : "Location unavailable");
            const groupIncidentId = String(
              g.incidentId || (isStreetlights ? g.lightId : "")
            ).trim();
            const lifecycleInfo = groupIncidentId
              ? getIncidentStateForDisplay(groupIncidentId, g.rows || [])
              : null;
            const lifecycleState = String(
              lifecycleInfo?.state || ""
            ).trim().toLowerCase();
            const isFixedLifecycle = Boolean(lifecycleState && !isOpenLifecycleState(lifecycleState));
            const effectiveNonStreetlightDotColor = isFixedLifecycle
              ? "var(--sl-ui-brand-green)"
              : nonStreetlightDotColor;
            const effectiveNonStreetlightDotLabel = isFixedLifecycle
              ? "Fixed incident"
              : info.majorityLabel;
            const effectiveDot = isStreetlights
              ? ((Boolean(info?.isFixed) || isFixedLifecycle)
                  ? { color: "var(--sl-ui-brand-green)", label: "Fixed incident" }
                  : dot)
              : { color: effectiveNonStreetlightDotColor, label: effectiveNonStreetlightDotLabel };

            return (
              <div
                key={g.lightId}
                ref={(el) => {
                  if (el) rowRefMap.current.set(g.lightId, el);
                  else rowRefMap.current.delete(g.lightId);
                }}
                style={{
                  border: "1px solid var(--sl-ui-open-reports-item-border)",
                  borderRadius: 10,
                  padding: 10,
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: effectiveDot.color,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                      flex: "0 0 auto",
                    }}
                    title={effectiveDot.label}
                  />

                  <button
                    onClick={() => handleToggleExpand(g.lightId)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      cursor: "pointer",
                      fontWeight: 950,
                      fontSize: 12.5,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      color: "var(--sl-ui-text)",
                    }}
                    title="Toggle details"
                  >
                    {displayLightId(g.lightId, slIdByUuid)}
                  </button>

                  <button
                    onClick={() => {
                      handleToggleExpand(g.lightId);
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                    title="View reports"
                  >
                    View
                  </button>

                  <button
                    onClick={() => {
                      if (!coords) return;
                      onFlyTo?.([coords.lat, coords.lng], 18, g.lightId);
                    }}
                    disabled={!coords}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: coords ? "pointer" : "not-allowed",
                      opacity: coords ? 1 : 0.6,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Fly to
                  </button>
                </div>

                <div style={{ fontSize: 12, opacity: 0.9 }}>
                  <b>{g.count}</b> report{g.count === 1 ? "" : "s"}
                  {isStreetlights ? <> • Status: <b>{info.majorityLabel}</b></> : <> • <b>{info.majorityLabel}</b></>}
                </div>
                {!!lifecycleInfo?.state && (
                  <div style={{ fontSize: 12, opacity: 0.82 }}>
                    Lifecycle: <b>{incidentStateLabel(lifecycleInfo.state)}</b>
                    {!!lifecycleInfo?.lastChangedAtIso && (
                      <> • Updated {formatTs(lifecycleInfo.lastChangedAtIso)}</>
                    )}
                  </div>
                )}

                {!isStreetlights && (
                  <div style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.3 }}>
                    <b>Location:</b> {locationLabel}
                  </div>
                )}

                {isOpen && (
                  <div
                    style={{
                      borderTop: "1px dashed var(--sl-ui-open-reports-item-border)",
                      paddingTop: 8,
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    {(g.rows || []).slice(0, 5).map((r) => (
                      <div
                        key={r.id}
                        style={{
                          fontSize: 12,
                          padding: 8,
                          borderRadius: 10,
                          border: "1px solid var(--sl-ui-open-reports-item-border)",
                          background: "var(--sl-ui-modal-subtle-bg)",
                          lineHeight: 1.3,
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>
                          {REPORT_TYPES?.[r.type] || r.type || "Report"}
                        </div>
                        <div style={{ opacity: 0.8 }}>
                          {formatTs(r.ts)}
                          {r.note ? ` • ${r.note}` : ""}
                        </div>
                        <div style={{ opacity: 0.9, fontWeight: 900 }}>
                          Report #: {reportNumberForRow(r, activeDomain)}
                        </div>
                        {canMutateIncidents && (
                          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
                            <b>Submitted by:</b>{" "}
                            <button
                              type="button"
                              onClick={() => onReporterDetails?.(r)}
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: 0,
                                margin: 0,
                                color: "var(--sl-ui-brand-green)",
                                textDecoration: "underline",
                                cursor: "pointer",
                                fontWeight: 900,
                                fontSize: 12,
                              }}
                            >
                              {String(r?.reporter_name || "").trim() || String(r?.reporter_email || "").trim() || "Unknown"}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {(g.rows || []).length > 5 && (
                      <div style={{ fontSize: 12, opacity: 0.75 }}>
                        Showing latest 5 of {g.rows.length}.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ))}
      </div>
      {!!copyToast && (
        <div
          style={{
            position: "fixed",
            top: copyToast?.y ?? 48,
            left: copyToast?.x ?? 18,
            zIndex: 10050,
            padding: "7px 11px",
            borderRadius: 8,
            border: "1px solid var(--sl-ui-brand-blue-border)",
            background: "var(--sl-ui-brand-blue)",
            color: "white",
            fontSize: 12,
            fontWeight: 900,
            boxShadow: "0 8px 20px rgba(0,0,0,0.24)",
            pointerEvents: "none",
          }}
        >
          {copyToast?.text || "Copied to clipboard"}
        </div>
      )}
      <ModalShell open={utilityReportDialogOpen} zIndex={10040}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Utility Report</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Confirm that you reported this light to the utility. Add the utility report number or reference if you have it.
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Utility report number or reference</div>
            <input
              value={utilityReportDialogReference}
              onChange={(e) => setUtilityReportDialogReference(e.target.value)}
              placeholder="Optional reference number"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
                fontWeight: 700,
              }}
            />
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                void saveUtilityReported();
              }}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-blue)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Save Utility Report
            </button>
            <button
              type="button"
              onClick={() => {
                setUtilityReportDialogOpen(false);
                setUtilityReportDialogIncidentId("");
                setUtilityReportDialogReference("");
              }}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <div
        style={{
          marginTop: 6,
          display: "grid",
          gap: 8,
          gridTemplateColumns: isStreetlightMyReports ? "1fr 1fr" : "1fr",
        }}
      >
        {isStreetlightMyReports && (
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.open(STREETLIGHT_UTILITY_REPORT_URL, "_blank", "noopener,noreferrer");
              }
            }}
            style={{
              padding: 10,
              width: "100%",
              borderRadius: 10,
              border: "1px solid var(--sl-ui-brand-blue-border)",
              background: "var(--sl-ui-brand-blue)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Report Outage to Utility
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            padding: 10,
            width: "100%",
            borderRadius: 10,
            border: "none",
            background: "#111",
            color: "white",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
    </ModalShell>
  );
}

function ManageAccountModal({
  open,
  onClose,
  profile,
  session,
  saving,
  editing,
  setEditing,
  form,
  setForm,
  onSave,
  onOpenChangePassword,
  onRequestEdit,
}) {
  if (!open) return null;

  const email = (profile?.email || session?.user?.email || "").trim() || "—";

  return (
    <ModalShell open={open} zIndex={10010}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Manage Account</div>
        <button
          onClick={() => {
            setEditing(false);
            onClose();
          }}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
        <div style={{ marginBottom: 8 }}>
          <b>Email:</b> {email}
        </div>

        <label style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Full name</div>
          <input
            value={form.full_name}
            onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
            style={inputStyle}
            disabled={!editing || saving}
            placeholder="Your full name"
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>Phone</div>
          <input
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            style={inputStyle}
            disabled={!editing || saving}
            placeholder="555-555-5555"
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        {!editing ? (
          <button
            onClick={onRequestEdit}
            style={{ ...btnPrimaryDark, width: "100%" }}
            disabled={saving}
          >
            Edit
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                setEditing(false);
                // revert changes on cancel edit
                setForm({
                  full_name: (profile?.full_name || "").trim(),
                  phone: (profile?.phone || "").trim(),
                });
              }}
              style={btnSecondary}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              onClick={onSave}
              style={{ ...btnPrimary, opacity: saving ? 0.7 : 1 }}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>

      <button
        onClick={onOpenChangePassword}
        style={{ ...btnPrimary, width: "100%", marginTop: 10 }}
        disabled={saving}
      >
        Change Password
      </button>

    </ModalShell>
  );
}

function ReauthModal({
  open,
  onClose,
  password,
  setPassword,
  saving,
  onConfirm,
}) {
  const [show, setShow] = useState(false);
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10014}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Password</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.35 }}>
        Enter your current password to continue.
      </div>

      <div style={{ position: "relative" }}>
        <input
          placeholder="Current password"
          type={show ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !saving && String(password || "").trim()) onConfirm();
          }}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          style={{
            position: "absolute",
            right: 8,
            top: "50%",
            transform: "translateY(-50%)",
            border: "none",
            background: "transparent",
            color: "#1976d2",
            fontWeight: 800,
            cursor: "pointer",
            padding: 0,
            fontSize: 12.5,
            lineHeight: 1,
          }}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={btnSecondary} disabled={saving}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{ ...btnPrimary, opacity: saving ? 0.75 : 1, cursor: saving ? "not-allowed" : "pointer" }}
          disabled={saving || !String(password || "").trim()}
        >
          {saving ? "Verifying…" : "Continue"}
        </button>
      </div>
    </ModalShell>
  );
}

function ChangePasswordModal({
  open,
  onClose,
  password,
  setPassword,
  password2,
  setPassword2,
  currentPassword,
  setCurrentPassword,
  saving,
  onSubmit,
}) {
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  if (!open) return null;

  const hasLen = String(password || "").length >= 8;
  const hasUpper = /[A-Z]/.test(String(password || ""));
  const hasLower = /[a-z]/.test(String(password || ""));
  const hasNumber = /[0-9]/.test(String(password || ""));
  const hasSpecial = /[^A-Za-z0-9]/.test(String(password || ""));
  const strongEnough = hasLen && hasUpper && hasLower && hasNumber && hasSpecial;
  const matches = !!password2 && password === password2;
  const hasCurrentPassword = String(currentPassword || "").trim().length > 0;
  const canSubmit = !saving && strongEnough && matches && hasCurrentPassword;
  const reqColor = (ok) => (ok ? "#2ecc71" : "#ff5252");
  const fieldWrapStyle = { position: "relative" };
  const fieldInputStyle = {
    ...inputStyle,
    width: "100%",
    minHeight: 72,
    borderRadius: 22,
    paddingLeft: 20,
    paddingRight: 92,
    fontSize: 24,
    border: "1px solid #d7d7d7",
    background: "#ffffff",
    color: "#111111",
  };
  const fieldShowButtonStyle = {
    position: "absolute",
    right: 18,
    top: "50%",
    transform: "translateY(-50%)",
    border: "none",
    background: "transparent",
    color: "#1f6fd6",
    fontWeight: 800,
    cursor: "pointer",
    padding: 0,
    fontSize: 24,
    lineHeight: 1,
  };

  return (
    <ModalShell
      open={open}
      zIndex={10012}
      panelStyle={{
        width: "min(720px, 100%)",
        padding: 32,
        borderRadius: 24,
        gap: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ fontSize: 32, lineHeight: 1.05, fontWeight: 950, color: "#111111" }}>Change Password</div>
        <button
          onClick={onClose}
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            border: "1px solid #d8d8d8",
            background: "#ffffff",
            color: "#111111",
            fontWeight: 900,
            fontSize: 30,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={fieldWrapStyle}>
          <input
            aria-label="New Password"
            placeholder="New password"
            type={show1 ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={fieldInputStyle}
          />
          <button
            type="button"
            onClick={() => setShow1((v) => !v)}
            style={fieldShowButtonStyle}
          >
            {show1 ? "Hide" : "Show"}
          </button>
        </div>

        <div style={fieldWrapStyle}>
          <input
            aria-label="Confirm New Password"
            placeholder="Re-enter new password"
            type={show2 ? "text" : "password"}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            style={fieldInputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) onSubmit();
            }}
          />
          <button
            type="button"
            onClick={() => setShow2((v) => !v)}
            style={fieldShowButtonStyle}
          >
            {show2 ? "Hide" : "Show"}
          </button>
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#252525" }}>
          Password Requirements
        </div>
        <div style={{ fontSize: 18, lineHeight: 1.35, display: "grid", gap: 4 }}>
          <div style={{ color: reqColor(hasLen), fontWeight: 800 }}>- 8 or more characters</div>
          <div style={{ color: reqColor(hasUpper), fontWeight: 800 }}>- 1 uppercase</div>
          <div style={{ color: reqColor(hasLower), fontWeight: 800 }}>- 1 lowercase</div>
          <div style={{ color: reqColor(hasNumber), fontWeight: 800 }}>- 1 number</div>
          <div style={{ color: reqColor(hasSpecial), fontWeight: 800 }}>- 1 special character</div>
          <div style={{ color: reqColor(matches), fontWeight: 800 }}>- Passwords match</div>
        </div>

        <div style={fieldWrapStyle}>
          <input
            aria-label="Current Password"
            placeholder="Current password"
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={fieldInputStyle}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) onSubmit();
            }}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            style={fieldShowButtonStyle}
          >
            {showCurrent ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <button
          onClick={onClose}
          style={{
            ...btnSecondary,
            minHeight: 74,
            borderRadius: 22,
            fontSize: 18,
            border: "1px solid #d7d7d7",
            background: "#ffffff",
            color: "#111111",
          }}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          onClick={onSubmit}
          style={{
            ...btnPrimary,
            minHeight: 74,
            borderRadius: 22,
            fontSize: 18,
            background: "#8c98ae",
            opacity: canSubmit ? 1 : 0.75,
            cursor: canSubmit ? "pointer" : "not-allowed",
          }}
          disabled={!canSubmit}
        >
          {saving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </ModalShell>
  );
}

function RecoveryPasswordModal({
  open,
  onClose,
  password,
  setPassword,
  password2,
  setPassword2,
  saving,
  onSubmit,
}) {
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  if (!open) return null;

  const hasLen = String(password || "").length >= 8;
  const hasUpper = /[A-Z]/.test(String(password || ""));
  const hasLower = /[a-z]/.test(String(password || ""));
  const hasNumber = /[0-9]/.test(String(password || ""));
  const hasSpecial = /[^A-Za-z0-9]/.test(String(password || ""));
  const strongEnough = hasLen && hasUpper && hasLower && hasNumber && hasSpecial;
  const matches = !!password2 && password === password2;
  const canSubmit = !saving && strongEnough && matches;
  const reqColor = (ok) => (ok ? "#2ecc71" : "#ff5252");

  return (
    <ModalShell open={open} zIndex={10015}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Set New Password</div>
        <button
          onClick={onClose}
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
            background: "var(--sl-ui-modal-btn-secondary-bg)",
            color: "var(--sl-ui-modal-btn-secondary-text)",
            fontWeight: 900,
            cursor: "pointer",
          }}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ position: "relative" }}>
          <input
            placeholder="New password"
            type={show1 ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
          />
          <button
            type="button"
            onClick={() => setShow1((v) => !v)}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              color: "#1976d2",
              fontWeight: 800,
              cursor: "pointer",
              padding: 0,
              fontSize: 12.5,
              lineHeight: 1,
            }}
          >
            {show1 ? "Hide" : "Show"}
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <input
            placeholder="Re-enter new password"
            type={show2 ? "text" : "password"}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            style={{ ...inputStyle, width: "100%", borderRadius: 10, paddingRight: 76 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSubmit) onSubmit();
            }}
          />
          <button
            type="button"
            onClick={() => setShow2((v) => !v)}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              color: "#1976d2",
              fontWeight: 800,
              cursor: "pointer",
              padding: 0,
              fontSize: 12.5,
              lineHeight: 1,
            }}
          >
            {show2 ? "Hide" : "Show"}
          </button>
        </div>

        <div style={{ fontSize: 12, fontWeight: 900, color: "var(--sl-ui-text)", opacity: 0.9 }}>
          Password Requirements
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.35, display: "grid", gap: 2 }}>
          <div style={{ color: reqColor(hasLen), fontWeight: 800 }}>- 8 or more characters</div>
          <div style={{ color: reqColor(hasUpper), fontWeight: 800 }}>- 1 uppercase</div>
          <div style={{ color: reqColor(hasLower), fontWeight: 800 }}>- 1 lowercase</div>
          <div style={{ color: reqColor(hasNumber), fontWeight: 800 }}>- 1 number</div>
          <div style={{ color: reqColor(hasSpecial), fontWeight: 800 }}>- 1 special character</div>
          <div style={{ color: reqColor(matches), fontWeight: 800 }}>- Passwords match</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onClose} style={btnSecondary} disabled={saving}>
          Cancel
        </button>
        <button
          onClick={onSubmit}
          style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.6, cursor: canSubmit ? "pointer" : "not-allowed" }}
          disabled={!canSubmit}
        >
          {saving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </ModalShell>
  );
}

function AccountMenuPanel({
  open,
  session,
  profile,
  onClose,
  onManage,
  onMyReports,
  onNotificationPreferences,
  onContactUs,
  onLogout,
  variant = "modal",
  containerRef = null,
  darkMode = false,
}) {
  if (!open) return null;

  const sessionEmail = session?.user?.email || "";
  const meta = session?.user?.user_metadata || {};

  const displayName =
    (profile?.full_name || "").trim() ||
    (meta.full_name || meta.name || "").trim() ||
    (sessionEmail ? sessionEmail.split("@")[0] : "—");

  const displayEmail =
    (profile?.email || "").trim() ||
    sessionEmail ||
    "—";

  const panelStyle = darkMode
    ? {
        border: "1px solid rgba(143, 170, 198, 0.22)",
        background: "linear-gradient(180deg, rgba(16, 25, 37, 0.98) 0%, rgba(20, 33, 47, 0.98) 100%)",
        boxShadow: "0 22px 42px rgba(0, 0, 0, 0.32)",
        color: "#edf6ff",
      }
    : null;

  const eyebrowStyle = darkMode ? { color: "#9cb6cf" } : null;
  const titleStyle = darkMode ? { color: "#edf6ff" } : null;
  const subtitleStyle = darkMode ? { color: "#c4d6e8" } : null;
  const buttonStyle = darkMode
    ? {
        border: "1px solid rgba(143, 170, 198, 0.24)",
        background: "rgba(28, 43, 60, 0.92)",
        color: "#edf6ff",
      }
    : null;

  const menuBody = session ? (
    <>
      <div className="workspace-menu-account">
        <div className="workspace-menu-eyebrow" style={eyebrowStyle}>
          Signed In
        </div>
        <div className="workspace-menu-title" style={titleStyle}>{displayName}</div>
        <div className="workspace-menu-meta" style={subtitleStyle}>{displayEmail}</div>
      </div>

      <div className="workspace-menu-actions">
        <button onClick={onManage} className="workspace-menu-button" style={buttonStyle}>
          Manage Account
        </button>
        <button onClick={onNotificationPreferences} className="workspace-menu-button" style={buttonStyle}>
          Notification Preferences
        </button>
        <button onClick={onMyReports} className="workspace-menu-button" style={buttonStyle}>
          My Reports
        </button>
        <button onClick={onContactUs} className="workspace-menu-button" style={buttonStyle}>
          Contact Us
        </button>
        <button onClick={onLogout} className="workspace-menu-button" style={buttonStyle}>
          Logout
        </button>
      </div>
    </>
  ) : (
    <>
      <div className="workspace-menu-account">
        <div className="workspace-menu-eyebrow" style={eyebrowStyle}>
          Account
        </div>
        <div className="workspace-menu-title" style={titleStyle}>
          Log in or create an account
        </div>
        <div className="workspace-menu-subtitle" style={subtitleStyle}>
          Sign in to view your report history and manage your account.
        </div>
      </div>

      <div className="workspace-menu-actions">
        <button
          onClick={() => {
            onClose();
            window.__openAuthGate?.("login");
          }}
          className="workspace-menu-button"
          style={buttonStyle}
        >
          Log in
        </button>
        <button
          onClick={() => {
            onClose();
            window.__openAuthGate?.("signup");
          }}
          className="workspace-menu-button"
          style={buttonStyle}
        >
          Create account
        </button>
        <button onClick={onContactUs} className="workspace-menu-button" style={buttonStyle}>
          Contact Us
        </button>
        {variant === "modal" ? (
          <button onClick={onClose} className="workspace-menu-button" style={buttonStyle}>
            Close
          </button>
        ) : null}
      </div>
    </>
  );

  if (variant === "desktop-popout") {
    return (
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          top: "calc(var(--desktop-header-height) + 8px)",
          right: "var(--desktop-header-horizontal-padding)",
          width: "min(320px, calc(100vw - 32px))",
          maxWidth: "calc(100vw - 32px)",
          zIndex: 2600,
          pointerEvents: "auto",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="workspace-menu-panel" style={panelStyle}>
          {menuBody}
        </div>
      </div>
    );
  }

  if (variant === "mobile-popout") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10010,
          display: "grid",
          alignItems: "start",
          justifyItems: "end",
          pointerEvents: "auto",
          padding: "calc(var(--mobile-header-top-offset) + var(--mobile-header-height) + 8px) var(--mobile-header-horizontal-inset) 16px",
          background: "transparent",
        }}
        onClick={onClose}
      >
        <div
          className="workspace-menu-panel"
          style={{
            width: "min(320px, calc(100vw - (var(--mobile-header-horizontal-inset) * 2)))",
            maxWidth: "calc(100vw - (var(--mobile-header-horizontal-inset) * 2))",
            pointerEvents: "auto",
            ...(panelStyle || {}),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 950, color: darkMode ? "#edf6ff" : undefined }}>Account</div>
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: darkMode ? "1px solid rgba(143, 170, 198, 0.24)" : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: darkMode ? "rgba(28, 43, 60, 0.92)" : "var(--sl-ui-modal-btn-secondary-bg)",
                color: darkMode ? "#edf6ff" : "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Close account menu"
              title="Close"
            >
              ✕
            </button>
          </div>
          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            {menuBody}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="sl-overlay-pass"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10010,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        padding: "16px 56px 16px 16px",
      }}
    >
      <div
        className="workspace-menu-panel"
        style={{
          width: "min(320px, calc(100vw - 112px))",
          pointerEvents: "auto",
          ...(panelStyle || {}),
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 950, color: darkMode ? "#edf6ff" : undefined }}>Account</div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: darkMode ? "1px solid rgba(143, 170, 198, 0.24)" : "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: darkMode ? "rgba(28, 43, 60, 0.92)" : "var(--sl-ui-modal-btn-secondary-bg)",
              color: darkMode ? "#edf6ff" : "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
            }}
            aria-label="Close account menu"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {menuBody}
        </div>
      </div>
    </div>
  );
}

function ContactUsModal({
  open,
  onClose,
  organizationDisplayName,
  contactEmail,
  contactPhone,
  websiteUrl,
  darkMode = false,
}) {
  const emailValue = String(contactEmail || "").trim();
  const phoneValue = String(contactPhone || "").trim();
  const websiteValue = String(websiteUrl || "").trim();

  const contactItems = [
    hasNonEmptyValue(emailValue)
      ? {
          label: "Email",
          value: emailValue,
          href: buildMailtoHref({ to: emailValue }),
        }
      : null,
    hasNonEmptyValue(phoneValue)
      ? {
          label: "Phone",
          value: phoneValue,
          href: normalizePhoneHref(phoneValue),
        }
      : null,
    hasNonEmptyValue(websiteValue)
      ? {
          label: "Website",
          value: websiteValue,
          href: normalizeWebsiteHref(websiteValue),
        }
      : null,
  ].filter(Boolean);

  const contactEyebrowColor = darkMode ? "#9cb6cf" : "#4f6983";
  const contactTileBorder = darkMode ? "1px solid rgba(143, 170, 198, 0.18)" : "1px solid rgba(23, 49, 79, 0.12)";
  const contactTileBackground = darkMode
    ? "linear-gradient(180deg, rgba(23, 37, 53, 0.96) 0%, rgba(17, 28, 40, 0.96) 100%)"
    : "linear-gradient(180deg, rgba(247, 251, 255, 0.98) 0%, rgba(240, 247, 255, 0.92) 100%)";
  const contactMutedColor = darkMode ? "#c4d6e8" : "#4b6784";

  return (
    <ModalShell
      open={open}
      zIndex={10055}
      panelStyle={{
        width: "min(480px, 100%)",
        borderRadius: 24,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gap: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "22px 22px 18px" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: contactEyebrowColor }}>
              Contact Us
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.05, color: "var(--sl-ui-text)" }}>
              {organizationDisplayName || "Organization"}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.82 }}>
              Reach this organization using the contact options they have made available for the reporting map.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
            aria-label="Close contact us"
          >
            ✕
          </button>
        </div>

        <div style={{ display: "grid", gap: 12, padding: "0 22px 22px" }}>
          {contactItems.length ? (
            contactItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.label === "Website" ? "_blank" : undefined}
                rel={item.label === "Website" ? "noreferrer" : undefined}
                style={{
                  display: "grid",
                  gap: 4,
                  textDecoration: "none",
                  color: "inherit",
                  padding: "14px 16px",
                  borderRadius: 18,
                  border: contactTileBorder,
                  background: contactTileBackground,
                }}
              >
                <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: contactEyebrowColor }}>
                  {item.label}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35, color: "var(--sl-ui-text)", overflowWrap: "anywhere" }}>
                  {item.value}
                </span>
              </a>
            ))
          ) : (
            <div
              style={{
                padding: "16px 18px",
                borderRadius: 18,
                border: contactTileBorder,
                background: contactTileBackground,
                fontSize: 14,
                lineHeight: 1.5,
                color: contactMutedColor,
              }}
            >
              Contact information is not available for this organization yet.
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function NotificationPreferencesModal({
  open,
  onClose,
  onSave,
  topics,
  preferencesByTopic,
  updatePreferenceDraft,
  saving,
  loading,
  status,
  darkMode = false,
}) {
  const hasError = String(status || "").toLowerCase().includes("could not");
  const sectionEyebrowColor = darkMode ? "#9cb6cf" : "#4f6983";
  const topicCardBorder = darkMode ? "1px solid rgba(143, 170, 198, 0.18)" : "1px solid rgba(23, 49, 79, 0.08)";
  const topicCardBackground = darkMode
    ? "linear-gradient(180deg, rgba(23, 37, 53, 0.96) 0%, rgba(17, 28, 40, 0.96) 100%)"
    : "linear-gradient(180deg, rgba(251, 253, 255, 0.96) 0%, rgba(242, 247, 251, 0.96) 100%)";
  const topicDescriptionColor = darkMode ? "#c4d6e8" : "#58718a";
  const footerBorder = darkMode ? "1px solid rgba(143, 170, 198, 0.16)" : "1px solid rgba(23, 49, 79, 0.08)";
  const checkboxLabelColor = darkMode ? "#edf6ff" : "var(--sl-ui-text)";

  return (
    <ModalShell
      open={open}
      zIndex={10050}
      panelStyle={{
        width: "min(820px, 100%)",
        maxHeight: "min(88vh, 900px)",
        borderRadius: 24,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          maxHeight: "min(88vh, 900px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "22px 22px 18px" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: sectionEyebrowColor }}>
              Notification Preferences
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.05, color: "var(--sl-ui-text)" }}>
              Events and alerts
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.82 }}>
              Manage the same resident notification categories used in the hub. In-app and email are live now; web push is next.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
            aria-label="Close notification preferences"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            overflowY: "auto",
            padding: "0 14px 0 22px",
            marginRight: 4,
          }}
        >
          {loading ? (
            <div style={{ fontSize: 13, opacity: 0.82, paddingBottom: 12 }}>Loading your notification preferences…</div>
          ) : (
            <div style={{ display: "grid", gap: 14, paddingBottom: 12 }}>
              {topics.map((topic) => {
                const current = preferencesByTopic?.[topic.topic_key] || {
                  in_app_enabled: Boolean(topic.default_enabled),
                  email_enabled: false,
                  web_push_enabled: false,
                };
                return (
                  <article
                    key={topic.topic_key}
                    style={{
                      padding: 18,
                      borderRadius: 20,
                      border: topicCardBorder,
                      background: topicCardBackground,
                      display: "grid",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <h4 style={{ margin: 0, fontSize: 18, lineHeight: 1.2 }}>{topic.label}</h4>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: topicDescriptionColor }}>{topic.description}</p>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: checkboxLabelColor }}>
                        <input
                          type="checkbox"
                          checked={Boolean(current.in_app_enabled)}
                          onChange={(event) => updatePreferenceDraft(topic.topic_key, "in_app_enabled", event.target.checked)}
                        />
                        In-app
                      </label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: checkboxLabelColor }}>
                        <input
                          type="checkbox"
                          checked={Boolean(current.email_enabled)}
                          onChange={(event) => updatePreferenceDraft(topic.topic_key, "email_enabled", event.target.checked)}
                        />
                        Email
                      </label>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, opacity: 0.7, color: checkboxLabelColor }}>
                        <input
                          type="checkbox"
                          checked={Boolean(current.web_push_enabled)}
                          disabled
                          readOnly
                        />
                        Web push (next)
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gap: 12, padding: "14px 22px 22px", borderTop: footerBorder }}>
          {status ? (
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.4,
                color: hasError ? "#ffb4b4" : "var(--sl-ui-text)",
                opacity: hasError ? 1 : 0.84,
              }}
            >
              {status}
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || loading}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: "none",
                background: "var(--sl-ui-brand-blue)",
                color: "#fff",
                fontWeight: 900,
                cursor: saving || loading ? "not-allowed" : "pointer",
                opacity: saving || loading ? 0.65 : 1,
              }}
            >
              {saving ? "Saving…" : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function residentFeedBadgeStyle({ bg = "rgba(22, 109, 120, 0.12)", border = "rgba(22, 109, 120, 0.18)", color = "#124c57" } = {}) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px 8px",
    borderRadius: 999,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: 11.5,
    fontWeight: 800,
    lineHeight: 1.1,
    textTransform: "capitalize",
  };
}

function ResidentFeedWindow({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  iconSrc,
  countLabel,
  loading,
  error,
  emptyText,
  items,
  renderItem,
  darkMode = false,
}) {
  const headerBorder = darkMode ? "1px solid rgba(143, 170, 198, 0.16)" : "1px solid rgba(23, 49, 79, 0.08)";
  const eyebrowBadgeTone = darkMode
    ? { bg: "rgba(49, 78, 112, 0.42)", border: "rgba(143, 170, 198, 0.2)", color: "#d9e7f5" }
    : { bg: "rgba(17, 61, 95, 0.10)", border: "rgba(17, 61, 95, 0.14)", color: "#113d5f" };
  const countBadgeTone = darkMode
    ? { bg: "rgba(27, 96, 84, 0.34)", border: "rgba(95, 208, 180, 0.18)", color: "#b7efe1" }
    : { bg: "rgba(22, 109, 120, 0.08)", border: "rgba(22, 109, 120, 0.12)", color: "#176d78" };
  const iconShellStyle = darkMode
    ? {
        background: "linear-gradient(180deg, rgba(24, 38, 55, 0.98) 0%, rgba(16, 27, 39, 0.98) 100%)",
        border: "1px solid rgba(143, 170, 198, 0.18)",
      }
    : {
        background: "linear-gradient(180deg, rgba(242, 247, 251, 0.98) 0%, rgba(232, 240, 247, 0.98) 100%)",
        border: "1px solid rgba(23, 49, 79, 0.08)",
      };
  const subtitleColor = darkMode ? "#c4d6e8" : undefined;
  const errorColor = darkMode ? "#ffb4b4" : "#b23a48";

  return (
    <ModalShell
      open={open}
      zIndex={10055}
      panelStyle={{
        width: "min(860px, 100%)",
        maxHeight: "min(88vh, 900px)",
        borderRadius: 24,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr)",
          maxHeight: "min(88vh, 900px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 14,
            padding: "22px 22px 18px",
            borderBottom: headerBorder,
          }}
        >
          <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={residentFeedBadgeStyle(eyebrowBadgeTone)}>
                {eyebrow}
              </div>
              {countLabel ? (
                <div style={residentFeedBadgeStyle(countBadgeTone)}>
                  {countLabel}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 16,
                  ...iconShellStyle,
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                }}
              >
                <AppIcon src={iconSrc} size={26} />
              </div>
              <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.05, color: "var(--sl-ui-text)" }}>{title}</div>
                <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.82, color: subtitleColor }}>{subtitle}</div>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: "pointer",
              flex: "0 0 auto",
            }}
            aria-label={`Close ${title}`}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "18px 18px 20px 22px", marginRight: 4 }}>
          {loading && !items.length ? (
            <div style={{ fontSize: 13, opacity: 0.82, color: subtitleColor }}>Loading updates…</div>
          ) : error ? (
            <div style={{ fontSize: 13, color: errorColor, lineHeight: 1.45 }}>{error}</div>
          ) : !items.length ? (
            <div style={{ fontSize: 13, opacity: 0.82, color: subtitleColor }}>{emptyText}</div>
          ) : (
            <div style={{ display: "grid", gap: 14, paddingBottom: 2 }}>
              {items.map(renderItem)}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function AlertsWindow({ open, onClose, alerts, loading, error, darkMode = false }) {
  const activeCount = useMemo(() => countActivePublishedAlerts(alerts), [alerts]);
  const countLabel = activeCount === 1 ? "1 active alert" : `${activeCount} active alerts`;
  const cardBorder = darkMode ? "1px solid rgba(143, 170, 198, 0.18)" : "1px solid rgba(23, 49, 79, 0.08)";
  const cardBackground = darkMode
    ? "linear-gradient(180deg, rgba(23, 37, 53, 0.96) 0%, rgba(17, 28, 40, 0.96) 100%)"
    : "linear-gradient(180deg, rgba(251, 253, 255, 0.98) 0%, rgba(242, 247, 251, 0.98) 100%)";
  const titleColor = darkMode ? "#edf6ff" : "#17314f";
  const summaryColor = darkMode ? "#d4e0ec" : "#35516d";
  const bodyColor = darkMode ? "#b9cadd" : "#58718a";
  const metaColor = darkMode ? "#9cb6cf" : "#4f6983";
  const ctaStyle = darkMode
    ? {
        border: "1px solid rgba(143, 170, 198, 0.22)",
        background: "rgba(28, 43, 60, 0.92)",
        color: "#edf6ff",
      }
    : {
        border: "1px solid rgba(23, 49, 79, 0.15)",
        background: "rgba(255, 255, 255, 0.92)",
        color: "#17314f",
      };
  return (
    <ResidentFeedWindow
      open={open}
      onClose={onClose}
      eyebrow="Hub Alerts"
      title="Location Alerts"
      subtitle="Published resident alerts from the organization hub."
      iconSrc={UI_ICON_SRC.notification}
      countLabel={countLabel}
      loading={loading}
      error={error}
      emptyText="No active alerts are published right now."
      items={alerts}
      darkMode={darkMode}
      renderItem={(alert) => {
        const severityKey = String(alert?.severity || "info").trim().toLowerCase();
        const severityTone =
          severityKey === "emergency"
            ? (darkMode
              ? { bg: "rgba(143, 29, 29, 0.32)", border: "rgba(255, 132, 132, 0.2)", color: "#ffb4b4" }
              : { bg: "rgba(183, 28, 28, 0.10)", border: "rgba(183, 28, 28, 0.16)", color: "#8f1d1d" })
            : severityKey === "urgent"
              ? (darkMode
                ? { bg: "rgba(178, 86, 0, 0.28)", border: "rgba(255, 193, 125, 0.18)", color: "#ffd6a6" }
                : { bg: "rgba(239, 108, 0, 0.10)", border: "rgba(239, 108, 0, 0.16)", color: "#b25600" })
              : severityKey === "advisory"
                ? (darkMode
                  ? { bg: "rgba(140, 106, 0, 0.24)", border: "rgba(255, 227, 132, 0.16)", color: "#ffe79a" }
                  : { bg: "rgba(245, 190, 28, 0.12)", border: "rgba(245, 190, 28, 0.18)", color: "#8c6a00" })
                : (darkMode
                  ? { bg: "rgba(27, 111, 180, 0.24)", border: "rgba(143, 196, 242, 0.18)", color: "#c8e6ff" }
                  : { bg: "rgba(30, 136, 229, 0.10)", border: "rgba(30, 136, 229, 0.16)", color: "#1b6fb4" });
        const pinnedTone = darkMode
          ? { bg: "rgba(27, 96, 84, 0.34)", border: "rgba(95, 208, 180, 0.18)", color: "#b7efe1" }
          : { bg: "rgba(22, 109, 120, 0.08)", border: "rgba(22, 109, 120, 0.12)", color: "#176d78" };
        const topicTone = darkMode
          ? { bg: "rgba(49, 78, 112, 0.42)", border: "rgba(143, 170, 198, 0.2)", color: "#d9e7f5" }
          : { bg: "rgba(17, 61, 95, 0.08)", border: "rgba(17, 61, 95, 0.12)", color: "#113d5f" };
        return (
          <article
            key={`map-alert-${alert.id}`}
            style={{
              padding: 18,
              borderRadius: 20,
              border: cardBorder,
              background: cardBackground,
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={residentFeedBadgeStyle(severityTone)}>{alert.severity || "info"}</div>
              {alert?.pinned ? (
                <div style={residentFeedBadgeStyle(pinnedTone)}>
                  Pinned
                </div>
              ) : null}
              {alert?.topic_label ? (
                <div style={residentFeedBadgeStyle(topicTone)}>
                  {alert.topic_label}
                </div>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.15, color: titleColor }}>{alert.title || "Untitled alert"}</h3>
              {alert.summary ? <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: summaryColor }}>{alert.summary}</p> : null}
              {alert.body ? <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: bodyColor }}>{alert.body}</p> : null}
            </div>
            <div style={{ display: "grid", gap: 4, fontSize: 12.5, color: metaColor, lineHeight: 1.45 }}>
              <div>{formatResidentAlertWindow(alert)}</div>
              {alert.location_name || alert.location_address ? (
                <div>{[alert.location_name, alert.location_address].filter(Boolean).join(" • ")}</div>
              ) : null}
            </div>
            {alert.cta_url ? (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <a
                  href={alert.cta_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "10px 14px",
                    borderRadius: 999,
                    ...ctaStyle,
                    textDecoration: "none",
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  {alert.cta_label || "More details"}
                </a>
              </div>
            ) : null}
          </article>
        );
      }}
    />
  );
}

function EventsWindow({ open, onClose, events, loading, error, darkMode = false }) {
  const upcomingCount = useMemo(() => countUpcomingPublishedEvents(events), [events]);
  const countLabel = upcomingCount === 1 ? "1 upcoming event" : `${upcomingCount} upcoming events`;
  const cardBorder = darkMode ? "1px solid rgba(143, 170, 198, 0.18)" : "1px solid rgba(23, 49, 79, 0.08)";
  const cardBackground = darkMode
    ? "linear-gradient(180deg, rgba(23, 37, 53, 0.96) 0%, rgba(17, 28, 40, 0.96) 100%)"
    : "linear-gradient(180deg, rgba(251, 253, 255, 0.98) 0%, rgba(242, 247, 251, 0.98) 100%)";
  const titleColor = darkMode ? "#edf6ff" : "#17314f";
  const summaryColor = darkMode ? "#d4e0ec" : "#35516d";
  const bodyColor = darkMode ? "#b9cadd" : "#58718a";
  const metaColor = darkMode ? "#9cb6cf" : "#4f6983";
  const topicTone = darkMode
    ? { bg: "rgba(49, 78, 112, 0.42)", border: "rgba(143, 170, 198, 0.2)", color: "#d9e7f5" }
    : { bg: "rgba(17, 61, 95, 0.08)", border: "rgba(17, 61, 95, 0.12)", color: "#113d5f" };
  const allDayTone = darkMode
    ? { bg: "rgba(27, 96, 84, 0.34)", border: "rgba(95, 208, 180, 0.18)", color: "#b7efe1" }
    : { bg: "rgba(22, 109, 120, 0.08)", border: "rgba(22, 109, 120, 0.12)", color: "#176d78" };
  const ctaStyle = darkMode
    ? {
        border: "1px solid rgba(143, 170, 198, 0.22)",
        background: "rgba(28, 43, 60, 0.92)",
        color: "#edf6ff",
      }
    : {
        border: "1px solid rgba(23, 49, 79, 0.15)",
        background: "rgba(255, 255, 255, 0.92)",
        color: "#17314f",
      };
  return (
    <ResidentFeedWindow
      open={open}
      onClose={onClose}
      eyebrow="Hub Events"
      title="Location Events"
      subtitle="Published resident events from the organization hub."
      iconSrc={UI_ICON_SRC.calendar}
      countLabel={countLabel}
      loading={loading}
      error={error}
      emptyText="No upcoming events are published yet."
      items={events}
      darkMode={darkMode}
      renderItem={(event) => (
        <article
          key={`map-event-${event.id}`}
          style={{
            padding: 18,
            borderRadius: 20,
            border: cardBorder,
            background: cardBackground,
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={residentFeedBadgeStyle(topicTone)}>
              {event.topic_label || event.topic_key || "Event"}
            </div>
            {event.all_day ? (
              <div style={residentFeedBadgeStyle(allDayTone)}>
                All day
              </div>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <h3 style={{ margin: 0, fontSize: 20, lineHeight: 1.15, color: titleColor }}>{event.title || "Untitled event"}</h3>
            {event.summary ? <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: summaryColor }}>{event.summary}</p> : null}
            {event.body ? <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, color: bodyColor }}>{event.body}</p> : null}
          </div>
          <div style={{ display: "grid", gap: 4, fontSize: 12.5, color: metaColor, lineHeight: 1.45 }}>
            <div>{formatResidentEventRange(event)}</div>
            {event.location_name || event.location_address ? (
              <div>{[event.location_name, event.location_address].filter(Boolean).join(" • ")}</div>
            ) : null}
          </div>
          {event.cta_url ? (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <a
                href={event.cta_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "10px 14px",
                  borderRadius: 999,
                  ...ctaStyle,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                {event.cta_label || "Event details"}
              </a>
            </div>
          ) : null}
        </article>
      )}
    />
  );
}


function useIsMobile(breakpointPx = 640) {
  const [isMobile, setIsMobile] = useState(() => {
    try {
      return window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let mql;
    try {
      mql = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    } catch {
      return;
    }

    const onChange = (e) => setIsMobile(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);

    setIsMobile(mql.matches);

    return () => {
      if (!mql) return;
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [breakpointPx]);

  return isMobile;
}

function uniqueLightIdsForCluster(light) {
  const ids = new Set();
  if (light?.lightId) ids.add(light.lightId);
  for (const r of light?.reports || []) {
    const id = r.light_id || lightIdFor(r.lat, r.lng);
    ids.add(id);
  }
  return Array.from(ids);
}

function formatDateTime(ts) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function getCoordsForLightId(lightId, reports, officialLights) {
  // official lights have exact coords
  const ol = (officialLights || []).find((x) => x.id === lightId);
  if (ol) return { lat: ol.lat, lng: ol.lng, isOfficial: true };

  // community: use average of all reports on that lightId
  const rows = (reports || []).filter((r) => (r.light_id || "") === lightId);
  if (!rows.length) return null;

  const avg = rows.reduce(
    (acc, r) => ({ lat: acc.lat + r.lat, lng: acc.lng + r.lng }),
    { lat: 0, lng: 0 }
  );
  return { lat: avg.lat / rows.length, lng: avg.lng / rows.length, isOfficial: false };
}

// CMD+F: function makeLightIdFromCoords
function makeLightIdFromCoords(lat, lng) {
  const lat5 = Math.abs(Number(lat)).toFixed(5).split(".")[1] || "00000";
  const lng5 = Math.abs(Number(lng)).toFixed(5).split(".")[1] || "00000";
  // ✅ order: lng then lat (per your spec)
  return `SL${lng5}${lat5}`;
}

function makePotholeIdFromCoords(lat, lng) {
  const lat5 = Math.abs(Number(lat)).toFixed(5).split(".")[1] || "00000";
  const lng5 = Math.abs(Number(lng)).toFixed(5).split(".")[1] || "00000";
  return `PH${lng5}${lat5}`;
}

function makeWaterDrainIdFromIncidentId(incidentId) {
  const s = String(incidentId || "").trim();
  if (!s) return "WD0000000000";

  const m = s.match(/^[^:]+:([-]?\d+(?:\.\d+)?):([-]?\d+(?:\.\d+)?)$/);
  if (m) {
    const lat5 = String(Math.abs(Number(m[1])).toFixed(5).split(".")[1] || "00000").slice(0, 5).padEnd(5, "0");
    const lng5 = String(Math.abs(Number(m[2])).toFixed(5).split(".")[1] || "00000").slice(0, 5).padEnd(5, "0");
    if (/^\d{5}$/.test(lat5) && /^\d{5}$/.test(lng5)) return `WD${lng5}${lat5}`;
  }

  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return `WD${String(h >>> 0).padStart(10, "0").slice(-10)}`;
}

function collectIncidentIdsFromRows(rows, fallbackIncidentId = "") {
  const out = [];
  const seen = new Set();
  const push = (raw) => {
    const id = String(raw || "").trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const r of rows || []) push(r?.light_id);
  push(fallbackIncidentId);
  return out;
}

function canonicalWaterDrainIncidentIdFromRows(rows, fallbackIncidentId = "") {
  const list = collectIncidentIdsFromRows(rows, fallbackIncidentId);
  if (!list.length) return "";

  const counts = new Map();
  const oldestById = new Map();
  for (const r of rows || []) {
    const id = String(r?.light_id || "").trim();
    if (!id) continue;
    const ts = Number(r?.ts || 0);
    counts.set(id, (counts.get(id) || 0) + 1);
    const curOldest = Number(oldestById.get(id) || 0);
    if (!curOldest || (ts > 0 && ts < curOldest)) oldestById.set(id, ts);
  }

  let bestId = list[0];
  let bestCount = Number(counts.get(bestId) || 0);
  let bestOldest = Number(oldestById.get(bestId) || Number.MAX_SAFE_INTEGER);
  for (const id of list) {
    const c = Number(counts.get(id) || 0);
    const oldest = Number(oldestById.get(id) || Number.MAX_SAFE_INTEGER);
    if (c > bestCount || (c === bestCount && oldest < bestOldest) || (c === bestCount && oldest === bestOldest && id < bestId)) {
      bestId = id;
      bestCount = c;
      bestOldest = oldest;
    }
  }
  return bestId;
}

function nearestWaterDrainMarkerForPoint(lat, lng, markers, radiusMeters = GROUP_RADIUS_METERS) {
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  const arr = Array.isArray(markers) ? markers : [];
  let best = null;
  let bestMeters = Infinity;
  for (const marker of arr) {
    const mLat = Number(marker?.lat);
    const mLng = Number(marker?.lng);
    if (!Number.isFinite(mLat) || !Number.isFinite(mLng)) continue;
    const d = metersBetween({ lat: nLat, lng: nLng }, { lat: mLat, lng: mLng });
    if (d <= radiusMeters && d < bestMeters) {
      bestMeters = d;
      best = marker;
    }
  }
  if (!best) return null;
  return { marker: best, distance: bestMeters };
}

function nearestPotholeForPoint(lat, lng, potholes, radiusMeters = POTHOLE_MERGE_RADIUS_METERS) {
  const arr = Array.isArray(potholes) ? potholes : [];
  let best = null;
  let bestMeters = Infinity;
  for (const p of arr) {
    const plat = Number(p?.lat);
    const plng = Number(p?.lng);
    if (!Number.isFinite(plat) || !Number.isFinite(plng)) continue;
    const d = metersBetween({ lat, lng }, { lat: plat, lng: plng });
    if (d < bestMeters) {
      bestMeters = d;
      best = p;
    }
  }
  if (!best || bestMeters > radiusMeters) return null;
  return best;
}


// Build "All Reports" timeline: reports + fix events
function buildLightHistory({ reportRows, fixActionRows }) {
  const items = [];
  const hasWorkingReport = (reportRows || []).some((r) => isWorkingReportType(r));

  // reports
  for (const r of reportRows || []) {
    const typeKey = normalizeReportTypeValue(r.type || r.report_type);
    const label = isWorkingReportType(typeKey)
      ? "Reported Working"
      : (REPORT_TYPES[typeKey] || r.type || "Report");
      items.push({
        kind: "report",
        ts: r.ts || 0,
        label,
        note: r.note || "",
        type: r.type || "",
        report_number: reportNumberForRow(r, r.pothole_id ? "potholes" : reportDomainFromLightId(r.light_id)),

        // ✅ reporter fields (for admin "Reporter Details" button)
        reporter_user_id: r.reporter_user_id || null,
        reporter_name: r.reporter_name || null,
        reporter_phone: r.reporter_phone || null,
        reporter_email: r.reporter_email || null,
      });
  }

  // fix / reopen actions (full history)
  for (const a of fixActionRows || []) {
    const action = String(a.action || "").toLowerCase();
    const ts = a.ts || 0;
    const actorName = String(a?.actor_name || a?.reporter_name || "").trim();
    const actorEmail = normalizeEmail(a?.actor_email || a?.reporter_email || "");
    const actorPhone = normalizePhone(a?.actor_phone || a?.reporter_phone || "");
    const actorUserId = String(a?.actor_user_id || a?.reporter_user_id || "").trim();

    if (action === "fix") {
      items.push({
        kind: "fix",
        ts,
        label: "Marked fixed",
        note: "",
        actor_name: actorName || null,
        actor_email: actorEmail || null,
        actor_phone: actorPhone || null,
        actor_user_id: actorUserId || null,
      });
    } else if (action === "reopen") {
      items.push({
        kind: "reopen",
        ts,
        label: "Re-opened",
        note: a.note || "",
        actor_name: actorName || null,
        actor_email: actorEmail || null,
        actor_phone: actorPhone || null,
        actor_user_id: actorUserId || null,
      });
    }
  }

  items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return items;
}

function isValidCoord(n) {
  const x = Number(n);
  return Number.isFinite(x);
}

function isValidLatLng(lat, lng) {
  return isValidCoord(lat) && isValidCoord(lng);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function lngInBounds(lng, west, east) {
  if (west <= east) return lng >= west && lng <= east;
  // antimeridian crossing
  return lng >= west || lng <= east;
}

function pointInBoundsWithPadding(lat, lng, bounds, padLat = 0, padLng = 0) {
  if (!bounds) return true;
  const north = Number(bounds.north) + padLat;
  const south = Number(bounds.south) - padLat;
  const west = Number(bounds.west) - padLng;
  const east = Number(bounds.east) + padLng;
  return lat >= south && lat <= north && lngInBounds(lng, west, east);
}

function normalizeOfficialLightRow(row) {
  if (!row || !row.id) return null;

  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!isValidLatLng(lat, lng)) return null;

  return {
    id: row.id,
    sl_id: row.sl_id || null,
    lat,
    lng,
    nearest_address: String(row?.nearest_address || "").trim() || "",
    nearest_cross_street: String(row?.nearest_cross_street || "").trim() || "",
    nearest_landmark: String(row?.nearest_landmark || "").trim() || "",
  };
}

function normalizeOfficialSignRow(row) {
  if (!row || !row.id) return null;

  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!isValidLatLng(lat, lng)) return null;

  return {
    id: String(row.id).trim(),
    sign_type: String(row.sign_type || "other").trim().toLowerCase() || "other",
    lat,
    lng,
    active: row.active !== false,
  };
}




// ==================================================
// SECTION 8 — Main App
// ==================================================
export default function App({ onBackToHub = null }) {
  const tenant = useContext(TenantContext);
  const mapRef = useRef(null);
  const desktopAccountMenuAnchorRef = useRef(null);
  const desktopAccountMenuPanelRef = useRef(null);
  const flyAnimRef = useRef(null);
  const flyInfoTimerRef = useRef(null);
  const officialCanvasOverlayRef = useRef(null);
  const smoothedHeadingRef = useRef(null);
  const lastFollowCameraRef = useRef({ lat: null, lng: null, heading: null });
  const followTargetRef = useRef(null);
  const followRafRef = useRef(null);
  const followLastFrameAtRef = useRef(0);
  const lastFollowStateSyncRef = useRef(0);
  const liveMotionRef = useRef({ lat: null, lng: null, heading: null, speed: 0, ts: 0 });
  const lastUserLocUiRef = useRef({ lat: null, lng: null, ts: 0 });
  const boundaryCameraSignatureRef = useRef("");
  const reportDeepLinkHandledRef = useRef(false);
  const initialReportDeepLinkRef = useRef(
    typeof window === "undefined" ? readReportDeepLinkRequest("") : readReportDeepLinkRequest(window.location.search || "")
  );
  const preserveReportFlyTargetCameraRef = useRef(Boolean(initialReportDeepLinkRef.current?.hasFlyTarget));
  const isMobile = useIsMobile(640);
  const [prefersDarkMode, setPrefersDarkMode] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [titleLogoError, setTitleLogoError] = useState(false);
  const [googleMapsAuthError, setGoogleMapsAuthError] = useState("");
  const suppressMapClickRef = useRef({ until: 0 });
  const clickDelayRef = useRef({ lastTs: 0, timer: null, lastLatLng: null });
  const titleLogoSrc = prefersDarkMode ? TITLE_LOGO_DARK_SRC : TITLE_LOGO_SRC;
  const mobileTitleLogoSrc = prefersDarkMode ? MOBILE_TITLE_LOGO_DARK_SRC : MOBILE_TITLE_LOGO_SRC;
  const headerTenantKey = useMemo(() => String(tenant?.tenantKey || activeTenantKey() || "").trim(), [tenant?.tenantKey]);
  const { profile: headerOrganizationProfile, loaded: headerOrganizationProfileLoaded } = useHeaderOrganizationProfile(headerTenantKey);
  const organizationDisplayName = useMemo(
    () =>
      resolvePublicHeaderDisplayName({
        organizationProfile: headerOrganizationProfileLoaded ? headerOrganizationProfile : null,
        tenantConfig: tenant?.tenantConfig,
        tenantKey: headerTenantKey,
      }),
    [headerOrganizationProfile, headerOrganizationProfileLoaded, headerTenantKey, tenant?.tenantConfig]
  );
  const mapHeaderTheme = useMemo(
    () => (
      prefersDarkMode
        ? {
            eyebrowColor: "#5fd0b4",
            textColor: "#edf6ff",
            subtleText: "#c4d6e8",
            desktopBackground: "rgba(11, 18, 29, 0.88)",
            desktopBorder: "1px solid rgba(143, 170, 198, 0.16)",
            desktopMenuBorder: "1px solid rgba(143, 170, 198, 0.28)",
            desktopMenuBackground: "rgba(18, 29, 43, 0.92)",
            desktopMenuShadow: "0 10px 24px rgba(0,0,0,0.22)",
            mobileBackground: "linear-gradient(112deg, rgba(17, 27, 40, 0.94), rgba(20, 39, 49, 0.92))",
            mobileBorder: "1px solid rgba(143, 170, 198, 0.24)",
            mobileMenuBorder: "1px solid rgba(143, 170, 198, 0.28)",
            mobileMenuBackground: "rgba(18, 29, 43, 0.92)",
          }
        : {
            eyebrowColor: "#13856e",
            textColor: "#102b46",
            subtleText: "#4f6983",
            desktopBackground: "rgba(248, 251, 255, 0.88)",
            desktopBorder: "1px solid rgba(23, 49, 79, 0.08)",
            desktopMenuBorder: "1px solid rgba(26, 49, 83, 0.22)",
            desktopMenuBackground: "rgba(255,255,255,0.92)",
            desktopMenuShadow: "none",
            mobileBackground: "var(--mobile-header-background)",
            mobileBorder: "var(--mobile-header-border)",
            mobileMenuBorder: "var(--mobile-header-menu-border)",
            mobileMenuBackground: "var(--mobile-header-menu-background)",
          }
    ),
    [prefersDarkMode]
  );
  const notificationTopics = useMemo(
    () => Object.entries(RESIDENT_NOTIFICATION_TOPIC_DETAILS).map(([topic_key, value]) => ({ topic_key, ...value })),
    []
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      setPrefersDarkMode(Boolean(e.matches));
      setTitleLogoError(false);
    };
    setPrefersDarkMode(Boolean(media.matches));
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const previousHandler = window.gm_authFailure;
    window.gm_authFailure = () => {
      const host = String(window.location.host || "").trim();
      setGoogleMapsAuthError(`Google Maps key is not authorized for ${host || "this host"}.`);
      if (typeof previousHandler === "function") {
        try {
          previousHandler();
        } catch {
          // no-op
        }
      }
    };
    return () => {
      if (typeof previousHandler === "function") {
        window.gm_authFailure = previousHandler;
      } else {
        try {
          delete window.gm_authFailure;
        } catch {
          // no-op
        }
      }
    };
  }, []);

  function cancelFlyAnimation() {
    if (flyAnimRef.current) {
      cancelAnimationFrame(flyAnimRef.current);
      flyAnimRef.current = null;
    }
  }

  function clearFlyInfoTimer() {
    if (flyInfoTimerRef.current) {
      clearTimeout(flyInfoTimerRef.current);
      flyInfoTimerRef.current = null;
    }
  }

  function updateUserLocUi(lat, lng, force = false) {
    const now = Date.now();
    const prev = lastUserLocUiRef.current;
    const next = { lat: Number(lat), lng: Number(lng) };
    if (!Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;

    const movedMeters =
      Number.isFinite(prev?.lat) && Number.isFinite(prev?.lng)
        ? metersBetween({ lat: prev.lat, lng: prev.lng }, next)
        : Infinity;
    const elapsedMs = now - Number(prev?.ts || 0);

    // Keep the blue dot responsive, but avoid re-rendering on every noisy GPS tick.
    if (!force && movedMeters < 0.9 && elapsedMs < 120) return;

    lastUserLocUiRef.current = { lat: next.lat, lng: next.lng, ts: now };
    setUserLoc([next.lat, next.lng]);
  }

  function stopFollowCameraAnimation() {
    if (followRafRef.current) {
      cancelAnimationFrame(followRafRef.current);
      followRafRef.current = null;
    }
    followLastFrameAtRef.current = 0;
    followTargetRef.current = null;
  }

  // Suppress popups
  const [popupsSuppressed, setPopupsSuppressed] = useState(false);
  const popupSuppressTimerRef = useRef(null);

  function getInitials(nameOrEmail = "") {
    if (!nameOrEmail) return "";

    // If email, use prefix
    const base = nameOrEmail.includes("@")
      ? nameOrEmail.split("@")[0]
      : nameOrEmail;

    const parts = base
      .replace(/[^a-zA-Z\s]/g, " ")
      .trim()
      .split(/\s+/);

    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function suppressPopups(ms = 1200) {
    setPopupsSuppressed(true);

    if (popupSuppressTimerRef.current) {
      clearTimeout(popupSuppressTimerRef.current);
      popupSuppressTimerRef.current = null;
    }

    popupSuppressTimerRef.current = setTimeout(() => {
      setPopupsSuppressed(false);
      popupSuppressTimerRef.current = null;
    }, ms);
  }
  
  useEffect(() => {
    return () => {
      if (popupSuppressTimerRef.current) {
        clearTimeout(popupSuppressTimerRef.current);
      }
    };
  }, []);

  // OFFICIAL LIGHTS (admin-only)
  const [officialLights, setOfficialLights] = useState([]); // rows: {id, lat, lng}
  const [officialSigns, setOfficialSigns] = useState([]); // rows: {id, sign_type, lat, lng, active}
  const [potholes, setPotholes] = useState([]); // rows: {id, ph_id, lat, lng, location_label?}
  const [potholeReports, setPotholeReports] = useState([]); // rows: {id, pothole_id, lat, lng, note, ts, reporter_*}
  const [cityBoundaryGeojson, setCityBoundaryGeojson] = useState(null);
  const [incidentStateByKey, setIncidentStateByKey] = useState({});
  const [tenantDomainPublicConfigByDomain, setTenantDomainPublicConfigByDomain] = useState({});
  const [incidentRepairProgressByKey, setIncidentRepairProgressByKey] = useState({});
  const [waterDrainIncidentsById, setWaterDrainIncidentsById] = useState({});
  // Google Maps InfoWindow selection
  const [selectedOfficialId, setSelectedOfficialId] = useState(null);
  const [selectedQueuedTempId, setSelectedQueuedTempId] = useState(null);
  // Bulk select toggle for official lights
  const toggleBulkSelect = useCallback((lightId) => {
    setBulkSelectedIds((prev) => {
      const has = prev.includes(lightId);
      if (!has && Number(mapZoomRef.current) < 17) {
        openNotice("🔎", "Zoom in to select", "Zoom in closer (level 17+) before selecting lights for bulk reporting.");
        return prev;
      }
      if (!has && prev.length >= BULK_MAX_LIGHTS_PER_SUBMIT) {
        openNotice("⚠️", "Selection limit", `You can select up to ${BULK_MAX_LIGHTS_PER_SUBMIT} lights per bulk report.`);
        return prev;
      }
      return has ? prev.filter((x) => x !== lightId) : [...prev, lightId];
    });
  }, []);
  // Google Maps map instance (optional, but your onLoad uses it)
  const [gmapsRef, setGmapsRef] = useState(null);

  const [mappingMode, setMappingMode] = useState(false);
  // Map type (Google Maps)
  const [mapType, setMapType] = useState("roadmap"); // "roadmap" | "satellite"
  const [mapZoom, setMapZoom] = useState(INITIAL_OVERVIEW_ZOOM);
  const mapZoomRef = useRef(INITIAL_OVERVIEW_ZOOM);
  const lastZoomGestureAtRef = useRef(0);
  const dragFollowOffTimerRef = useRef(null);
  const [mapInteracting, setMapInteracting] = useState(false);
  const mapInteractIdleTimerRef = useRef(null);
  const userDragPanRef = useRef(false);

  // Google Maps center (actual camera center)
  const [mapCenter, setMapCenter] = useState({ lat: USA_OVERVIEW[0], lng: USA_OVERVIEW[1] });
  const [mapBounds, setMapBounds] = useState(null);

  const [reports, setReports] = useState([]);
  const [picked, setPicked] = useState(null);

  const [reportType, setReportType] = useState("out");
  const [note, setNote] = useState("");
  const [streetlightAreaPowerOn, setStreetlightAreaPowerOn] = useState("");
  const [streetlightHazardYesNo, setStreetlightHazardYesNo] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // fixedLights: { [light_id]: fixed_at_ms }
  const [fixedLights, setFixedLights] = useState({});
  const [lastFixByLightId, setLastFixByLightId] = useState({});
  const [actionsByLightId, setActionsByLightId] = useState({});
  const [utilityReportedLightIdSet, setUtilityReportedLightIdSet] = useState(() => new Set());
  const [utilityReportReferenceByLightId, setUtilityReportReferenceByLightId] = useState({});
  const [utilityReportedAnyLightIdSet, setUtilityReportedAnyLightIdSet] = useState(() => new Set());
  const [utilitySignalCountsByLightId, setUtilitySignalCountsByLightId] = useState({});

  // per-light cooldowns: persisted
  const [cooldowns, setCooldowns] = useState(() => pruneCooldowns(loadCooldownsFromStorage()));

  // activeLight: object for modal context
  const [activeLight, setActiveLight] = useState(null);
  const [domainReportTarget, setDomainReportTarget] = useState(null); // { domain, lat, lng, lightId, locationLabel }
  const [domainReportNote, setDomainReportNote] = useState("");
  const [domainReportImageFile, setDomainReportImageFile] = useState(null);
  const [domainReportImagePreviewUrl, setDomainReportImagePreviewUrl] = useState("");
  const [domainReportIssue, setDomainReportIssue] = useState(defaultDomainIssueFor("water_drain_issues"));
  const [potholeConsentChecked, setPotholeConsentChecked] = useState(false);
  const [streetlightUtilityContext, setStreetlightUtilityContext] = useState({
    lightId: "",
    loading: false,
    nearestAddress: "",
    nearestStreet: "",
    nearestCrossStreet: "",
    nearestIntersection: "",
    nearestLandmark: "",
  });
  const [streetlightLocationInfoOpen, setStreetlightLocationInfoOpen] = useState(false);

  useEffect(() => {
    if (!domainReportTarget) {
      setPotholeConsentChecked(false);
      setDomainReportIssue(defaultDomainIssueFor(""));
      setDomainReportImageFile(null);
      setDomainReportImagePreviewUrl("");
      return;
    }
    if (domainReportTarget?.domain === "potholes" || domainReportTarget?.domain === "water_drain_issues") {
      setPotholeConsentChecked(false);
    }
    setDomainReportIssue(defaultDomainIssueFor(domainReportTarget?.domain));
  }, [domainReportTarget?.domain, domainReportTarget?.lat, domainReportTarget?.lng]);

  useEffect(() => {
    if (!domainReportImageFile) {
      setDomainReportImagePreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(domainReportImageFile);
    setDomainReportImagePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [domainReportImageFile]);

  // Notice modal state
  const [notice, setNotice] = useState({ open: false, icon: "", title: "", message: "", compact: false });
  const noticeTimerRef = useRef(null);
  const dbConnectionStartedAtRef = useRef(Date.now());
  const dbConnectionNoticeAtRef = useRef(0);
  const dbConnectionFailureStreakRef = useRef(0);
  const dbConnectionResumeAtRef = useRef(Date.now());
  const placesLookupBlockedRef = useRef(false);
  const placesBlockedNoticeShownRef = useRef(false);
  const [toolHintText, setToolHintText] = useState("");
  const [toolHintIndex, setToolHintIndex] = useState(null);
  const toolHintTimerRef = useRef(null);

  function openNotice(icon, title, message, opts = {}) {
    const { autoCloseMs = 0, compact = false } = opts;
    const rawTitle = String(title ?? "").trim();
    const rawMessage = String(message ?? "").trim();
    const rawIcon = String(icon ?? "");
    let safeTitle = rawTitle;
    let safeMessage = rawMessage;
    if (!safeTitle && !safeMessage) {
      if (rawIcon.includes("⚠️")) {
        safeTitle = "Notice";
        safeMessage = "Something needs attention.";
      } else if (rawIcon.includes("ℹ️")) {
        safeTitle = "Notice";
        safeMessage = "More information is available.";
      }
    }
    const safeCompact = compact && !rawIcon.includes("⚠️");

    // clear any prior timer
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }

    setNotice({ open: true, icon: rawIcon, title: safeTitle, message: safeMessage, compact: safeCompact });

    if (autoCloseMs > 0) {
      noticeTimerRef.current = setTimeout(() => {
        setNotice((p) => ({ ...p, open: false }));
        noticeTimerRef.current = null;
      }, autoCloseMs);
    }
  }

  function closeNotice() {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setNotice((p) => ({ ...p, open: false }));
  }

  async function copyTextToClipboard(label, value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "Unavailable") {
      openNotice("⚠️", "Unavailable", `${label} is unavailable.`, { autoCloseMs: 1200, compact: true });
      return;
    }
    try {
      await navigator.clipboard.writeText(raw);
      openNotice("✅", "Copied", `${label} copied.`, { autoCloseMs: 900, compact: true });
    } catch {
      openNotice("⚠️", "Copy failed", `Could not copy ${label.toLowerCase()}.`, { autoCloseMs: 1400, compact: true });
    }
  }

  function markPlacesLookupBlocked(reason = "") {
    if (placesLookupBlockedRef.current) return;
    placesLookupBlockedRef.current = true;
    const msg = String(reason || "").trim();
    if (msg) {
      console.warn("[places] landmark lookups disabled for this session:", msg);
    } else {
      console.warn("[places] landmark lookups disabled for this session");
    }
    if (isAdmin && !placesBlockedNoticeShownRef.current) {
      placesBlockedNoticeShownRef.current = true;
      openNotice(
        "ℹ️",
        "Places unavailable",
        "Closest landmark lookups are temporarily disabled. Reports still submit normally. Check Google API key restrictions for Places API / Places API (New)."
      );
    }
  }

  function showToolHint(text, ms = 1100, index = null) {
    const msg = String(text || "").trim();
    if (!msg) return;
    if (toolHintTimerRef.current) {
      clearTimeout(toolHintTimerRef.current);
      toolHintTimerRef.current = null;
    }
    setToolHintText(msg);
    setToolHintIndex(Number.isFinite(index) ? index : null);
    toolHintTimerRef.current = setTimeout(() => {
      setToolHintText("");
      setToolHintIndex(null);
      toolHintTimerRef.current = null;
    }, ms);
  }

  function isConnectionLikeDbError(errOrStatus) {
    if (!errOrStatus) return false;

    // Realtime channel status strings
    if (typeof errOrStatus === "string") {
      const s = errOrStatus.toUpperCase();
      return s === "CHANNEL_ERROR" || s === "TIMED_OUT";
    }

    const statusNum = Number(errOrStatus?.status);
    const rawCode = String(errOrStatus?.code || "").toUpperCase();
    const msg = String(errOrStatus?.message || "").toLowerCase();
    const details = String(errOrStatus?.details || "").toLowerCase();
    const hint = String(errOrStatus?.hint || "").toLowerCase();
    const combined = `${msg} ${details} ${hint}`;

    // auth/permission/policy errors are not connectivity outages
    if (statusNum === 401 || statusNum === 403) return false;
    if (rawCode === "42501" || rawCode === "PGRST301" || rawCode === "PGRST116") return false;
    if (
      combined.includes("permission denied") ||
      combined.includes("row-level security") ||
      combined.includes("jwt") ||
      combined.includes("unauthorized") ||
      combined.includes("forbidden")
    ) return false;

    // likely connectivity/server failures
    if (Number.isFinite(statusNum) && statusNum >= 500) return true;
    if (
      combined.includes("failed to fetch") ||
      combined.includes("network") ||
      combined.includes("timeout") ||
      combined.includes("timed out") ||
      combined.includes("connection") ||
      combined.includes("unavailable")
    ) return true;

    return false;
  }

  function isExpectedPermissionError(err) {
    if (!err) return false;
    const statusNum = Number(err?.status);
    const rawCode = String(err?.code || "").toUpperCase();
    const combined = `${String(err?.message || "").toLowerCase()} ${String(err?.details || "").toLowerCase()} ${String(err?.hint || "").toLowerCase()}`;
    if (statusNum === 401 || statusNum === 403) return true;
    if (rawCode === "42501" || rawCode === "PGRST301") return true;
    return (
      combined.includes("permission denied") ||
      combined.includes("row-level security") ||
      combined.includes("forbidden") ||
      combined.includes("not authorized")
    );
  }

  function notifyDbConnectionIssue(errOrStatus) {
    if (!isConnectionLikeDbError(errOrStatus)) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const now = Date.now();
    if (now - dbConnectionStartedAtRef.current < 6000) return; // startup grace period
    if (now - dbConnectionResumeAtRef.current < 5000) return; // tab/app return grace period
    dbConnectionFailureStreakRef.current += 1;
    if (dbConnectionFailureStreakRef.current < 2) return; // require 2 consecutive failures
    if (now - dbConnectionNoticeAtRef.current < 15000) return; // avoid notice spam
    dbConnectionNoticeAtRef.current = now;
    dbConnectionFailureStreakRef.current = 0;
    openNotice(
      "⚠️",
      "Connection issue",
      "Some map/report data may be unavailable temporarily."
    );
  }

  function resetDbConnectionIssueStreak() {
    dbConnectionFailureStreakRef.current = 0;
  }

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return undefined;
    const markResume = () => {
      dbConnectionResumeAtRef.current = Date.now();
      resetDbConnectionIssueStreak();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") markResume();
    };
    window.addEventListener("online", markResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("online", markResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const [allReportsModal, setAllReportsModal] = useState({
    open: false,
    title: "",
    items: [],
    domainKey: "streetlights",
    sharedLocation: "",
    sharedAddress: "",
    sharedLandmark: "",
    currentState: "",
    lastChangedAt: "",
  });
  const officialLightHistoryCacheRef = useRef(new Map());

  const [reporterDetails, setReporterDetails] = useState({ open: false, item: null });

  function openReporterDetails(item) {
    setReporterDetails({ open: true, item });
  }

  function closeReporterDetails() {
    setReporterDetails({ open: false, item: null });
  }

  const [myReportsOpen, setMyReportsOpen] = useState(false);
  const [myReportsExpanded, setMyReportsExpanded] = useState(() => new Set()); // lightIds expanded
  const [myReportsDomain, setMyReportsDomain] = useState("potholes");
  const [myReportsFocusIncidentId, setMyReportsFocusIncidentId] = useState("");
  const [myReportsFocusQuery, setMyReportsFocusQuery] = useState("");
  const [myReportsInViewOnly, setMyReportsInViewOnly] = useState(false);

  const [openReportsOpen, setOpenReportsOpen] = useState(false);
  const [openReportsExpanded, setOpenReportsExpanded] = useState(() => new Set()); // lightIds expanded
  const [openReportsInViewOnly, setOpenReportsInViewOnly] = useState(false);
  const [openReportMapFilterOn, setOpenReportMapFilterOn] = useState(false);
  const [streetlightInViewFilterMode, setStreetlightInViewFilterMode] = useState("");
  const [adminReportDomain, setAdminReportDomain] = useState("potholes");
  const [adminDomainMenuOpen, setAdminDomainMenuOpen] = useState(false);
  const [adminToolboxOpen, setAdminToolboxOpen] = useState(false);
  const [selectedDomainMarker, setSelectedDomainMarker] = useState(null);
  const [infoMenuOpen, setInfoMenuOpen] = useState(false);
  const [alertsWindowOpen, setAlertsWindowOpen] = useState(false);
  const [eventsWindowOpen, setEventsWindowOpen] = useState(false);
  const [mapCommunityAlerts, setMapCommunityAlerts] = useState([]);
  const [mapCommunityEvents, setMapCommunityEvents] = useState([]);
  const [mapCommunityFeedLoading, setMapCommunityFeedLoading] = useState(false);
  const [mapCommunityFeedError, setMapCommunityFeedError] = useState("");
  const [mapCommunityFeedReadState, setMapCommunityFeedReadState] = useState({
    alertsLastViewedAt: 0,
    eventsLastViewedAt: 0,
    alertsReadKeys: [],
    eventsReadKeys: [],
    alertsReadIds: [],
    eventsReadIds: [],
  });


  function toggleMyReportsExpanded(lightId) {
    setMyReportsExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(lightId)) next.delete(lightId);
      else next.add(lightId);
      return next;
    });
  }

  function closeMyReports() {
    setMyReportsOpen(false);
    setMyReportsExpanded(new Set());
    setMyReportsFocusIncidentId("");
    setMyReportsFocusQuery("");
    setMyReportsInViewOnly(false);
  }

  function openMyReports(opts = {}) {
    const domainKey = String(opts?.domainKey || adminReportDomain || "potholes").trim() || "potholes";
    const focusIncidentId = String(opts?.focusIncidentId || "").trim();
    const focusQuery = String(opts?.focusQuery || "").trim();
    const inViewOnly = Boolean(opts?.inViewOnly);
    setAdminReportDomain(domainKey);
    setMyReportsDomain(domainKey);
    setMyReportsExpanded(focusIncidentId ? new Set([focusIncidentId]) : new Set());
    setMyReportsFocusIncidentId(focusIncidentId);
    setMyReportsFocusQuery(focusQuery);
    setMyReportsInViewOnly(inViewOnly);
    setMyReportsOpen(true);
  }

  function toggleOpenReportsExpanded(lightId) {
    const lid = (lightId || "").trim();
    if (!lid) return;
    setOpenReportsExpanded((prev) => {
      if (prev.has(lid)) return new Set();
      return new Set([lid]);
    });
  }

  function closeOpenReports() {
    setOpenReportsOpen(false);
    setOpenReportsExpanded(new Set());
    setOpenReportsInViewOnly(false);
  }

  function openOpenReports({ inViewOnly = false } = {}) {
    setOpenReportsInViewOnly(Boolean(inViewOnly));
    setOpenReportsExpanded(new Set());
    setOpenReportsOpen(true);
  }

  const handleUtilityReportedChange = useCallback((incidentId, reported, opts = {}) => {
    const id = String(incidentId || "").trim();
    if (!id) return;
    const reference = normalizeUtilityReportReference(opts?.reportReference);
    setUtilityReportedLightIdSet((prev) => {
      const next = new Set(prev || []);
      if (reported) next.add(id);
      else next.delete(id);
      return next;
    });
    setUtilityReportReferenceByLightId((prev) => {
      const next = { ...(prev || {}) };
      if (reported) next[id] = reference;
      else delete next[id];
      return next;
    });
  }, []);

  const toggleStreetlightInViewFilter = useCallback((mode) => {
    const normalized = String(mode || "").trim().toLowerCase();
    if (normalized !== "saved" && normalized !== "utility") {
      setStreetlightInViewFilterMode("");
      return;
    }
    setStreetlightInViewFilterMode((prev) => (prev === normalized ? "" : normalized));
  }, []);


  function openAllReports(title, items, opts = {}) {
    setAllReportsModal({
      open: true,
      title: title || "All Reports",
      items: items || [],
      domainKey: String(opts?.domainKey || "streetlights").trim() || "streetlights",
      sharedLocation: String(opts?.sharedLocation || "").trim(),
      sharedAddress: String(opts?.sharedAddress || "").trim(),
      sharedLandmark: String(opts?.sharedLandmark || "").trim(),
      currentState: String(opts?.currentState || "").trim(),
      lastChangedAt: String(opts?.lastChangedAt || "").trim(),
    });
  }

  function closeAllReports() {
    setAllReportsModal((p) => ({ ...p, open: false }));
  }

  const getIncidentSnapshot = useCallback((domain, incidentId) => {
    const id = String(incidentId || "").trim();
    if (!id) return null;

    const candidates = [];
    const pushCandidate = (d) => {
      const normalized = normalizeDomainKey(d) || String(d || "").trim().toLowerCase();
      if (!normalized) return;
      if (candidates.includes(normalized)) return;
      candidates.push(normalized);
    };

    pushCandidate(domain);
    if (id.startsWith("pothole:")) pushCandidate("potholes");
    if (id.startsWith("water_drain_issues:")) {
      // Compatibility: legacy lifecycle rows were written under streetlights domain.
      pushCandidate("water_drain_issues");
      pushCandidate("streetlights");
      pushCandidate("water_main");
    }
    if (id.startsWith("street_signs:")) pushCandidate("street_signs");
    if (id.startsWith("power_outage:")) pushCandidate("power_outage");
    if (id.startsWith("water_main:")) pushCandidate("water_main");
    pushCandidate("streetlights");

    for (const d of candidates) {
      const key = incidentSnapshotKey(d, id);
      if (!key) continue;
      const hit = incidentStateByKey?.[key] || null;
      if (hit) return hit;
    }

    // Final fallback for mixed historical keys.
    for (const [key, value] of Object.entries(incidentStateByKey || {})) {
      if (String(key || "").endsWith(`:${id}`)) return value || null;
    }

    return null;
  }, [incidentStateByKey]);

  const domainForIncidentId = useCallback((incidentIdRaw) => {
    const incidentId = String(incidentIdRaw || "").trim();
    if (!incidentId) return "streetlights";
    if (incidentId.startsWith("pothole:")) return "potholes";
    if (incidentId.startsWith("water_drain_issues:")) return "water_drain_issues";
    if (incidentId.startsWith("street_signs:")) return "street_signs";
    if (incidentId.startsWith("power_outage:")) return "power_outage";
    if (incidentId.startsWith("water_main:")) return "water_main";
    return "streetlights";
  }, []);

  async function getOfficialLightHistoryDetailed(lightId, { preferCache = true } = {}) {
    const lid = (lightId || "").trim();
    if (!lid) return { reportRows: [], fixActionRows: [] };

    const cache = officialLightHistoryCacheRef.current;
    if (preferCache && cache.has(lid)) return cache.get(lid);

    const [repRes, actRes] = await Promise.all([
      supabase
        .from("reports")
        .select("id, created_at, lat, lng, report_type, report_quality, note, light_id, report_number, reporter_user_id, reporter_name, reporter_phone, reporter_email")
        .eq("light_id", lid)
        .order("created_at", { ascending: false }),
      supabase
        .from("light_actions")
        .select("id, light_id, action, note, created_at, actor_user_id")
        .eq("light_id", lid)
        .order("created_at", { ascending: false }),
    ]);

    if (repRes.error) throw repRes.error;
    if (actRes.error) throw actRes.error;

    const reportRows = (repRes.data || []).map((r) => ({
      id: r.id,
      lat: r.lat,
      lng: r.lng,
      type: r.report_type,
      report_quality: normalizeReportQuality(r.report_quality),
      note: r.note || "",
      ts: new Date(r.created_at).getTime(),
      light_id: r.light_id || lightIdFor(r.lat, r.lng),
      report_number: r.report_number || null,
      reporter_user_id: r.reporter_user_id || null,
      reporter_name: r.reporter_name || null,
      reporter_phone: r.reporter_phone || null,
      reporter_email: r.reporter_email || null,
    }));

    const fixActionRows = (actRes.data || []).map((a) => {
      const ts = new Date(a.created_at).getTime();
      const noteContact = parseWorkingContactFromNote(a.note);
      const actorEmail = a.actor_email || a.reporter_email || noteContact.email || null;
      const actorPhone = a.actor_phone || a.reporter_phone || noteContact.phone || null;
      const actorUserId = a.actor_user_id || a.reporter_user_id || null;
      const actorNameRaw = (a.actor_name || a.reporter_name || noteContact.name || "").trim();
      const actorNameFallback = actorEmail ? String(actorEmail).split("@")[0] : "";
      return {
        action: a.action,
        ts,
        note: a.note || null,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        actor_phone: actorPhone,
        actor_name: actorNameRaw || actorNameFallback || null,
        reporter_user_id: a.reporter_user_id || actorUserId,
        reporter_name: (a.reporter_name || "").trim() || actorNameRaw || actorNameFallback || null,
        reporter_email: a.reporter_email || actorEmail,
        reporter_phone: a.reporter_phone || actorPhone,
      };
    });

    const out = { reportRows, fixActionRows };
    cache.set(lid, out);
    return out;
  }

  async function openOfficialLightAllReports(lightId, domain = "streetlights") {
    const lid = (lightId || "").trim();
    if (!lid) return;
    const domainKey = normalizeDomainKey(domain) || "streetlights";
    const isStreetSigns = domainKey === "street_signs";

    let reportRows = (reports || [])
      .filter((r) => (r.light_id || "").trim() === lid)
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
    let fixActionRows = actionsByLightId?.[lid] || [];

    try {
      const detailed = await getOfficialLightHistoryDetailed(lid);
      reportRows = detailed.reportRows;
      fixActionRows = detailed.fixActionRows;
    } catch (e) {
      console.warn("[official light history] detailed fetch failed, using cached in-memory rows:", e);
    }

    const history = buildLightHistory({ reportRows, fixActionRows });
    const snapshot = getIncidentSnapshot(domainKey, lid);
    const title =
      domainKey === "water_drain_issues"
        ? `All Reports (${makeWaterDrainIdFromIncidentId(lid)})`
        : isStreetSigns
          ? "All Reports (Official sign)"
          : "All Reports (Official light)";
    openAllReports(title, history, {
      domainKey,
      currentState: snapshot?.state || "",
      lastChangedAt: snapshot?.last_changed_at || "",
    });
  }

  async function openPotholeAllReportsFromMarker(marker) {
    const pid = String(marker?.pothole_id || "").trim();
    if (!pid) return;
    const lat = Number(marker?.lat);
    const lng = Number(marker?.lng);
    const ph =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? makePotholeIdFromCoords(lat, lng)
        : (String(marker?.id || "").trim() || "PH0000000000");
    const reportRows = (potholeReports || [])
      .filter((r) => String(r?.pothole_id || "").trim() === pid)
      .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0))
      .map((r) => ({
        id: r.id,
        type: "other",
        note: r.note || null,
        ts: Number(r.ts || 0),
        report_number: r.report_number || null,
        pothole_id: pid,
        reporter_user_id: r.reporter_user_id || null,
        reporter_name: r.reporter_name || null,
        reporter_email: r.reporter_email || null,
        reporter_phone: r.reporter_phone || null,
      }));
    const fixActionRows = (actionsByLightId?.[`pothole:${pid}`] || [])
      .filter((a) => {
        const t = String(a?.action || "").toLowerCase();
        return t === "fix" || t === "reopen";
      })
      .map((a) => ({
        action: a.action,
        ts: Number(a.ts || 0),
        note: a.note || null,
      }));
    const history = buildLightHistory({ reportRows, fixActionRows });
    const addrFromNote = readAddressFromNote(reportRows?.[0]?.note);
    const landmarkFromNote = readLandmarkFromNote(reportRows?.[0]?.note);
    const locationLine =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        : "";
    const markerGeoAddress = String(marker?._geoNearestAddress || "").trim();
    const markerGeoLandmark = String(marker?._geoNearestLandmark || "").trim();
    const addressLine = markerGeoAddress || addrFromNote || "Address unavailable";
    const snapshot = getIncidentSnapshot("potholes", `pothole:${pid}`);
    openAllReports(`All Reports (${ph})`, history, {
      domainKey: "potholes",
      sharedLocation: locationLine,
      sharedAddress: addressLine,
      sharedLandmark: markerGeoLandmark || landmarkFromNote || "No nearby landmark",
      currentState: snapshot?.state || "",
      lastChangedAt: snapshot?.last_changed_at || "",
    });
  }

  async function insertLightActionsWithFallback(rows, { selectCols = "" } = {}) {
    const payload = Array.isArray(rows) ? rows : [];
    const runInsert = async (insertRows) => {
      let q = supabase.from("light_actions").insert(insertRows);
      if (selectCols) q = q.select(selectCols);
      return await q;
    };

    const actorColsSupported = lightActionsActorColumnsSupportedRef.current;
    const payloadNoActorCols = payload.map((r) => {
      const next = { ...(r || {}) };
      delete next.actor_name;
      delete next.actor_email;
      delete next.actor_phone;
      return next;
    });
    const initialPayload = actorColsSupported === false ? payloadNoActorCols : payload;
    let { data, error } = await runInsert(initialPayload);
    if (!error) {
      if (actorColsSupported === null && initialPayload === payload) {
        lightActionsActorColumnsSupportedRef.current = true;
      }
      return { data, error: null };
    }

    const msg = String(error?.message || "").toLowerCase();
    const details = String(error?.details || "").toLowerCase();
    const hint = String(error?.hint || "").toLowerCase();
    const text = `${msg} ${details} ${hint}`;
    const hasActorFieldsInPayload = payload.some((r) =>
      Object.prototype.hasOwnProperty.call(r || {}, "actor_name") ||
      Object.prototype.hasOwnProperty.call(r || {}, "actor_email") ||
      Object.prototype.hasOwnProperty.call(r || {}, "actor_phone")
    );
    const isActorColumnMissing =
      hasActorFieldsInPayload &&
      (
        text.includes("actor_name") ||
        text.includes("actor_email") ||
        text.includes("actor_phone") ||
        text.includes("schema cache") ||
        text.includes("column")
      );

    if (!isActorColumnMissing) return { data, error };
    lightActionsActorColumnsSupportedRef.current = false;

    return await runInsert(payloadNoActorCols);
  }

  async function markPotholeFixed(marker, noteText = "") {
    const pid = String(marker?.pothole_id || "").trim();
    if (!pid || !session?.user?.id) return;
    const noteClean = String(noteText || "").trim();
    const lightActionId = `pothole:${pid}`;
    const { error } = await insertLightActionsWithFallback([{
      light_id: lightActionId,
      action: "fix",
      note: noteClean || null,
      actor_user_id: session.user.id,
    }]);
    if (error) {
      console.error("[pothole mark fixed] insert error:", error);
      openNotice("⚠️", "Couldn’t mark fixed", error.message || "Please try again.");
      return;
    }

    const ts = Date.now();
    setActionsByLightId((prev) => {
      const list = Array.isArray(prev?.[lightActionId]) ? [...prev[lightActionId]] : [];
      list.unshift({
        action: "fix",
        ts,
        note: noteClean || null,
        actor_user_id: session.user.id,
        actor_name:
          String(profile?.full_name || "").trim() ||
          String(session?.user?.user_metadata?.full_name || "").trim() ||
          String(session?.user?.email || "").split("@")[0] ||
          null,
        actor_email: normalizeEmail(session?.user?.email || profile?.email || "") || null,
        actor_phone: normalizePhone(profile?.phone || "") || null,
      });
      return { ...(prev || {}), [lightActionId]: list };
    });
    setLastFixByLightId((prev) => ({ ...(prev || {}), [lightActionId]: Math.max(Number(prev?.[lightActionId] || 0), ts) }));
    setIncidentStateByKey((prev) => {
      const key = incidentSnapshotKey("potholes", lightActionId);
      if (!key) return prev;
      const nextIso = new Date(ts).toISOString();
      return {
        ...(prev || {}),
        [key]: { state: "fixed", last_changed_at: nextIso },
      };
    });
    setSelectedDomainMarker(null);
    openNotice("✅", "Marked fixed", "Pothole marked fixed.");
  }

  function stopLeafletPropagation(e) {
    e.stopPropagation?.();

    // stop the native event Leaflet listens to
    const ne = e?.nativeEvent;
    ne?.stopPropagation?.();
    ne?.stopImmediatePropagation?.();
  }

  function guardPopupAction(e, ms = 900, { prevent = false } = {}) {
    // ✅ IMPORTANT: preventDefault only on "click", NOT on pointer/touch down
    if (prevent) e.preventDefault?.();

    stopLeafletPropagation(e);

    // cancel pending delayed report
    const ref = clickDelayRef.current;
    if (ref?.timer) {
      clearTimeout(ref.timer);
      ref.timer = null;
    }

    // suppress any late/synthetic map click
    suppressMapClickRef.current.until = Date.now() + ms;
  }



  // Location (user-initiated)
  const [userLoc, setUserLoc] = useState(null); // [lat, lng]
  const [mapTarget, setMapTarget] = useState(null); // { pos:[lat,lng], zoom:number, nonce:number }
  const [locating, setLocating] = useState(false);
  const [autoFollow, setAutoFollow] = useState(false);
  const [followCamera, setFollowCamera] = useState(false);
  const lightActionsActorColumnsSupportedRef = useRef(false); // hard-disable actor_* writes unless explicitly enabled later
  const followHeadingEnabledRef = useRef(true);

  const lastTrackedPosRef = useRef(null);
  // Map style
  const [mapStyle, setMapStyle] = useState("streets"); // "streets" | "sat"


  // Remember if the browser reported "denied"
  const [geoDenied, setGeoDenied] = useState(() => {
    try {
      return localStorage.getItem("streetlight_geo_denied_v1") === "1";
    } catch {
      return false;
    }
  });

  function setGeoDeniedPersist(v) {
    setGeoDenied(v);
    try {
      localStorage.setItem("streetlight_geo_denied_v1", v ? "1" : "0");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    // Ask for location immediately on first load (once per tab session)
    try {
      const alreadyPrompted = sessionStorage.getItem(LOC_PROMPTED_SESSION_KEY) === "1";
      if (!alreadyPrompted) {
        sessionStorage.setItem(LOC_PROMPTED_SESSION_KEY, "1");
        setShowLocationPrompt(true);
      }
    } catch {
      // If sessionStorage fails, still show once
      setShowLocationPrompt(true);
    }
  }, []);



  const [authGateOpen, setAuthGateOpen] = useState(false);
  const [authGateStep, setAuthGateStep] = useState("welcome"); // welcome | login | signup | guest

  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const isTouchDevice = useMemo(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    return ("ontouchstart" in window) || Number(navigator.maxTouchPoints || 0) > 0;
  }, []);


  // Auth
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tenantVisibilityByDomain, setTenantVisibilityByDomain] = useState({});
  const [tenantVisibilityLoaded, setTenantVisibilityLoaded] = useState(false);
  const [tenantMapFeatures, setTenantMapFeatures] = useState({
    show_boundary_border: true,
    shade_outside_boundary: true,
    show_alert_icon: true,
    show_event_icon: true,
    outside_shade_opacity: 0.42,
    boundary_border_color: "#e53935",
    boundary_border_width: 4,
  });
  const [openAbuseFlagSummary, setOpenAbuseFlagSummary] = useState({ total: 0, maxSeverity: 0 });
  const [moderationFlagsOpen, setModerationFlagsOpen] = useState(false);
  const [moderationFlagRows, setModerationFlagRows] = useState([]);
  const [moderationFlagsLoading, setModerationFlagsLoading] = useState(false);
  const [moderationFlagsError, setModerationFlagsError] = useState("");
  const abuseFlagBannerShownRef = useRef(false);
  const isDomainPublic = useCallback((domainKey) => {
    const key = String(domainKey || "").trim();
    if (!key) return false;
    if (!ENABLE_TENANT_VISIBILITY_CONFIG || !tenantVisibilityLoaded) {
      return DEFAULT_PUBLIC_DOMAINS.has(key);
    }
    const configured = String(tenantVisibilityByDomain?.[key] || "").trim().toLowerCase();
    if (configured === "public") return true;
    if (configured === "internal_only") return false;
    return false;
  }, [tenantVisibilityByDomain, tenantVisibilityLoaded]);
  const visibleDomainOptions = useMemo(() => {
    return REPORT_DOMAIN_OPTIONS.filter((d) => isDomainPublic(d.key)).map((d) => ({
      ...d,
      enabled: true,
    }));
  }, [isDomainPublic]);
  const openReportsDomainOptions = useMemo(
    () => (visibleDomainOptions || []).filter((d) => d.key !== "streetlights"),
    [visibleDomainOptions]
  );

  useEffect(() => {
    if (!openReportsOpen) return;
    if (!openReportsDomainOptions.length) return;
    if (openReportsDomainOptions.some((d) => d.key === adminReportDomain)) return;
    setAdminReportDomain(openReportsDomainOptions[0].key);
  }, [openReportsOpen, openReportsDomainOptions, adminReportDomain]);

  useEffect(() => {
    if (!isAdmin) return;
    if (!myReportsOpen) return;
    if (myReportsDomain === adminReportDomain) return;
    setMyReportsDomain(adminReportDomain);
  }, [isAdmin, myReportsOpen, myReportsDomain, adminReportDomain]);

      useEffect(() => {
      // simple bridge so AccountMenuPanel can open auth gate without prop-drilling
      window.__openAuthGate = (step = "welcome") => {
        // ✅ If already logged in, don’t open auth gate
        if (session?.user?.id) return;

        setAuthGateStep(step);
        setAuthGateOpen(true);
      };

      return () => {
        try {
          delete window.__openAuthGate;
        } catch {}
      };
    }, [session?.user?.id, session?.user?.email]);


  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [authResetLoading, setAuthResetLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");

  // Signup fields
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPassword2, setSignupPassword2] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupLegalAccepted, setSignupLegalAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    if (!authGateOpen) setLoginError("");
  }, [authGateOpen, authGateStep]);

  useEffect(() => {
    if (authGateOpen) return;
    setSignupLegalAccepted(false);
    setTermsOpen(false);
    setPrivacyOpen(false);
  }, [authGateOpen]);


  // Gate flow
  const [guestInfo, setGuestInfo] = useState({ name: "", phone: "", email: "" });
  const [guestInfoDraft, setGuestInfoDraft] = useState({ name: "", phone: "", email: "" });
  const [guestInfoOpen, setGuestInfoOpen] = useState(false);
  const [contactChoiceOpen, setContactChoiceOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [pendingGuestAction, setPendingGuestAction] = useState(null); // { kind: "report" | "working" | "bulk" | "repair", lightId?: string, incidentId?: string, domainKey?: string }
  const guestSubmitBypassRef = useRef(false);
  const domainSubmitInFlightRef = useRef(false);
  const domainSubmitDedupRef = useRef(new Map());
  const [profile, setProfile] = useState(null); // { full_name, phone, email }


  const [showAdminLogin] = useState(() => {
    try {
      return window.location.hash.includes("admin");
    } catch {
      return false;
    }
  });

  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountView, setAccountView] = useState("menu"); 
  // "menu" | "manage" | "myReports"
  const [contactUsOpen, setContactUsOpen] = useState(false);
  const [notificationPreferencesOpen, setNotificationPreferencesOpen] = useState(false);
  const [notificationPreferencesByTopic, setNotificationPreferencesByTopic] = useState({});
  const [savedNotificationPreferencesByTopic, setSavedNotificationPreferencesByTopic] = useState({});
  const [notificationPreferencesLoading, setNotificationPreferencesLoading] = useState(false);
  const [notificationPreferencesSaving, setNotificationPreferencesSaving] = useState(false);
  const [notificationPreferencesStatus, setNotificationPreferencesStatus] = useState("");

  const handleAccountMenuToggle = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setAccountMenuOpen((prev) => !prev);
    setAccountView("menu");
  }, []);

  useEffect(() => {
    if (!accountMenuOpen || isMobile || typeof window === "undefined") return undefined;

    const handlePointerDown = (event) => {
      const anchor = desktopAccountMenuAnchorRef.current;
      const panel = desktopAccountMenuPanelRef.current;
      if (anchor && anchor.contains(event.target)) return;
      if (panel && panel.contains(event.target)) return;
      setAccountMenuOpen(false);
      setAccountView("menu");
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setAccountMenuOpen(false);
      setAccountView("menu");
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [accountMenuOpen, isMobile]);

  useEffect(() => {
    let cancelled = false;

    async function loadNotificationPreferences() {
      if (!session?.user?.id) {
        setNotificationPreferencesByTopic({});
        setSavedNotificationPreferencesByTopic({});
        setNotificationPreferencesLoading(false);
        setNotificationPreferencesStatus("");
        return;
      }

      setNotificationPreferencesLoading(true);
      setNotificationPreferencesStatus("");
      const { data, error } = await supabase
        .from("resident_notification_preferences")
        .select("topic_key,in_app_enabled,email_enabled,web_push_enabled")
        .eq("tenant_key", activeTenantKey())
        .eq("user_id", session.user.id);

      if (cancelled) return;

      if (error) {
        setNotificationPreferencesLoading(false);
        if (isMissingRelationError(error)) {
          setNotificationPreferencesByTopic({});
          setSavedNotificationPreferencesByTopic({});
          return;
        }
        setNotificationPreferencesStatus(error.message || "Could not load your notification preferences.");
        return;
      }

      const next = {};
      for (const row of data || []) {
        next[row.topic_key] = {
          in_app_enabled: Boolean(row?.in_app_enabled),
          email_enabled: Boolean(row?.email_enabled),
          web_push_enabled: Boolean(row?.web_push_enabled),
        };
      }
      setNotificationPreferencesByTopic(next);
      setSavedNotificationPreferencesByTopic(next);
      setNotificationPreferencesLoading(false);
      setNotificationPreferencesStatus("");
    }

    void loadNotificationPreferences();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, tenant?.tenantKey]);

  const updateNotificationPreferenceDraft = useCallback((topicKey, field, nextValue) => {
    setNotificationPreferencesByTopic((prev) => ({
      ...prev,
      [topicKey]: {
        in_app_enabled: prev?.[topicKey]?.in_app_enabled ?? Boolean(RESIDENT_NOTIFICATION_TOPIC_DETAILS?.[topicKey]?.default_enabled),
        email_enabled: prev?.[topicKey]?.email_enabled ?? false,
        web_push_enabled: prev?.[topicKey]?.web_push_enabled ?? false,
        [field]: nextValue,
      },
    }));
  }, []);

  const saveNotificationPreferences = useCallback(async () => {
    if (!session?.user?.id) return;

    setNotificationPreferencesSaving(true);
    setNotificationPreferencesStatus("");
    const rows = notificationTopics.map((topic) => {
      const current = notificationPreferencesByTopic?.[topic.topic_key] || {};
      return {
        tenant_key: activeTenantKey(),
        user_id: session.user.id,
        topic_key: topic.topic_key,
        in_app_enabled: current.in_app_enabled ?? Boolean(topic.default_enabled),
        email_enabled: current.email_enabled ?? false,
        web_push_enabled: current.web_push_enabled ?? false,
      };
    });

    const { error } = await supabase
      .from("resident_notification_preferences")
      .upsert(rows, { onConflict: "tenant_key,user_id,topic_key" });

    setNotificationPreferencesSaving(false);
    if (error) {
      setNotificationPreferencesStatus(error.message || "Could not save your notification preferences.");
      return;
    }

    setSavedNotificationPreferencesByTopic(notificationPreferencesByTopic);
    setNotificationPreferencesStatus("Notification preferences saved.");
    setNotificationPreferencesOpen(false);
  }, [notificationPreferencesByTopic, notificationTopics, session?.user?.id]);

  const [manageOpen, setManageOpen] = useState(false);
  const [manageEditing, setManageEditing] = useState(false);
  const [manageSaving, setManageSaving] = useState(false);
  const [manageForm, setManageForm] = useState({ full_name: "", phone: "" });
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthSaving, setReauthSaving] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthIntent, setReauthIntent] = useState(null); // "edit_profile" | "save_profile"
  const reauthAtRef = useRef(0);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordSaving, setChangePasswordSaving] = useState(false);
  const [changePasswordValue, setChangePasswordValue] = useState("");
  const [changePasswordValue2, setChangePasswordValue2] = useState("");
  const [changePasswordCurrentValue, setChangePasswordCurrentValue] = useState("");
  const [recoveryPasswordOpen, setRecoveryPasswordOpen] = useState(false);
  const [recoveryPasswordSaving, setRecoveryPasswordSaving] = useState(false);
  const [recoveryPasswordValue, setRecoveryPasswordValue] = useState("");
  const [recoveryPasswordValue2, setRecoveryPasswordValue2] = useState("");

  const showAdminTools = isAdmin || showAdminLogin;



  // =========================
  // BULK REPORTING (official lights)
  // =========================
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState([]); // array of official light UUIDs
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [isWorkingConfirmOpen, setIsWorkingConfirmOpen] = useState(false);
  const [pendingWorkingLightId, setPendingWorkingLightId] = useState(null);
  const [utilityReportDialogOpen, setUtilityReportDialogOpen] = useState(false);
  const [pendingUtilityReportLightId, setPendingUtilityReportLightId] = useState(null);
  const [pendingUtilityReportReference, setPendingUtilityReportReference] = useState("");
  const [markFixedConfirmOpen, setMarkFixedConfirmOpen] = useState(false);
  const [pendingMarkFixedLightId, setPendingMarkFixedLightId] = useState(null);
  const [pendingMarkFixedClusterReports, setPendingMarkFixedClusterReports] = useState([]);
  const [pendingMarkFixedPotholeMarker, setPendingMarkFixedPotholeMarker] = useState(null);
  const [pendingIncidentActionType, setPendingIncidentActionType] = useState("fix"); // fix | reopen
  const [markFixedNote, setMarkFixedNote] = useState("");
  const [deleteOfficialConfirmOpen, setDeleteOfficialConfirmOpen] = useState(false);
  const [pendingDeleteOfficialLightId, setPendingDeleteOfficialLightId] = useState(null);
  const [deleteCircleMode, setDeleteCircleMode] = useState(false);
  const [deleteCircleDraft, setDeleteCircleDraft] = useState(null); // { center: {lat,lng}, radiusMeters }
  const [deleteCircleConfirmOpen, setDeleteCircleConfirmOpen] = useState(false);
  const [deleteCircleNote, setDeleteCircleNote] = useState("");
  const [deleteOfficialSignConfirmOpen, setDeleteOfficialSignConfirmOpen] = useState(false);
  const [pendingDeleteOfficialSignId, setPendingDeleteOfficialSignId] = useState(null);
  const [clearQueuedConfirmOpen, setClearQueuedConfirmOpen] = useState(false);
  const [domainSwitchConfirmOpen, setDomainSwitchConfirmOpen] = useState(false);
  const [pendingDomainSwitchTarget, setPendingDomainSwitchTarget] = useState(null);
  const [queueSignTypeOpen, setQueueSignTypeOpen] = useState(false);
  const [pendingQueuedSign, setPendingQueuedSign] = useState(null); // {lat, lng, sign_type}
  const [potholeAdvisoryOpen, setPotholeAdvisoryOpen] = useState(false);
  const [pendingPotholeDomainTarget, setPendingPotholeDomainTarget] = useState(null);

  const bulkSelectedSet = useMemo(() => new Set(bulkSelectedIds), [bulkSelectedIds]);
  const bulkSelectedCount = bulkSelectedIds.length;

  function clearBulkSelection() {
    setBulkSelectedIds([]);
  }
  

  function toggleBulkSelection(id) {
    const alreadySelected = bulkSelectedSet.has(id);
    if (!alreadySelected && Number(mapZoomRef.current || mapZoom) < 17) {
      openNotice("🔎", "Zoom in to select", "Zoom in closer (level 17+) before selecting lights for bulk reporting.");
      return;
    }
    setBulkSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= BULK_MAX_LIGHTS_PER_SUBMIT) {
        openNotice("⚠️", "Selection limit", `You can select up to ${BULK_MAX_LIGHTS_PER_SUBMIT} lights per bulk report.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function exitBulkMode() {
    setBulkMode(false);
    setBulkConfirmOpen(false);
    clearBulkSelection();
  }

  function resetDeleteCircleTool() {
    setDeleteCircleMode(false);
    setDeleteCircleDraft(null);
    setDeleteCircleConfirmOpen(false);
    setDeleteCircleNote("");
  }

  const [exitMappingConfirmOpen, setExitMappingConfirmOpen] = useState(false);

  function exitMappingMode() {
    setMappingMode(false);
    setMappingQueue([]);
    setSelectedQueuedTempId(null);
  }

  function requestClearQueuedLights() {
    if (!mappingQueue.length) return;
    setClearQueuedConfirmOpen(true);
  }

  function confirmClearQueuedLights() {
    setMappingQueue([]);
    setSelectedQueuedTempId(null);
    setClearQueuedConfirmOpen(false);
  }

  function requestExitMappingMode() {
    if (mappingQueue.length > 0) {
      setExitMappingConfirmOpen(true);
      return;
    }
    exitMappingMode();
  }

  function requestAdminDomainSwitch(domainKey, domainLabel) {
    const nextKey = String(domainKey || "").trim();
    if (!nextKey) return;
    if (nextKey === adminReportDomain) {
      setAdminDomainMenuOpen(false);
      return;
    }
    if (mappingMode && mappingQueue.length > 0) {
      setPendingDomainSwitchTarget({ key: nextKey, label: String(domainLabel || nextKey) });
      setDomainSwitchConfirmOpen(true);
      return;
    }
    setAdminReportDomain(nextKey);
    setAdminDomainMenuOpen(false);
    showToolHint(`Domain: ${String(domainLabel || nextKey)}`, 1000, 3);
  }

  function cancelAdminDomainSwitch() {
    setDomainSwitchConfirmOpen(false);
    setPendingDomainSwitchTarget(null);
  }

  async function placeQueuedAndSwitchDomain() {
    if (!pendingDomainSwitchTarget?.key) {
      cancelAdminDomainSwitch();
      return;
    }
    const ok = await confirmMappingQueue();
    if (!ok) return;
    setAdminReportDomain(pendingDomainSwitchTarget.key);
    setAdminDomainMenuOpen(false);
    showToolHint(`Domain: ${String(pendingDomainSwitchTarget.label || pendingDomainSwitchTarget.key)}`, 1000, 3);
    cancelAdminDomainSwitch();
  }

  function clearQueuedAndSwitchDomain() {
    if (!pendingDomainSwitchTarget?.key) {
      cancelAdminDomainSwitch();
      return;
    }
    setMappingQueue([]);
    setSelectedQueuedTempId(null);
    setAdminReportDomain(pendingDomainSwitchTarget.key);
    setAdminDomainMenuOpen(false);
    showToolHint(`Domain: ${String(pendingDomainSwitchTarget.label || pendingDomainSwitchTarget.key)}`, 1000, 3);
    cancelAdminDomainSwitch();
  }

  async function saveAndExitMappingMode() {
    const ok = await confirmMappingQueue();
    if (!ok) return; // keep mapping on if saving failed
    setExitMappingConfirmOpen(false);
    exitMappingMode();
  }

  function exitAdminModes() {
    // one-stop cleanup if needed later
    exitBulkMode();
    exitMappingMode();
  }

  useEffect(() => {
    // Hard guarantee: never allow both modes at once
    if (bulkMode && mappingMode) {
      setMappingMode(false);
      setMappingQueue([]);
    }
  }, [bulkMode, mappingMode]);


  // =========================
  // ADMIN LIGHT MAPPING QUEUE
  // =========================
  const [mappingQueue, setMappingQueue] = useState([]);
  // rows: { lat, lng, tempId, domain, sl_id?, sign_type? }

  function queueOfficialLight(lat, lng) {
    if (!isValidLatLng(lat, lng)) return;
    if (Number(mapZoom) < MAPPING_MIN_ZOOM) {
      openNotice(
        "⚠️",
        "Zoom in to place lights",
        `Zoom to at least level ${MAPPING_MIN_ZOOM} to place official lights.`
      );
      return;
    }

    const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const sl_id = makeLightIdFromCoords(lat, lng);

    setMappingQueue((prev) => [
      ...prev,
      { lat: Number(lat), lng: Number(lng), tempId, sl_id, domain: "streetlights" },
    ]);
  }

  function queueOfficialSign(lat, lng, signType) {
    if (!isValidLatLng(lat, lng)) return;
    if (Number(mapZoom) < MAPPING_MIN_ZOOM) {
      openNotice(
        "⚠️",
        "Zoom in to place signs",
        `Zoom to at least level ${MAPPING_MIN_ZOOM} to place official signs.`
      );
      return;
    }
    const nextType = String(signType || "").trim().toLowerCase();
    if (!STREET_SIGN_TYPE_VALUES.has(nextType)) {
      openNotice("⚠️", "Sign type required", "Select a sign type before adding this sign to the queue.");
      return;
    }

    const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setMappingQueue((prev) => [
      ...prev,
      {
        lat: Number(lat),
        lng: Number(lng),
        tempId,
        domain: "street_signs",
        sign_type: nextType,
      },
    ]);
    // Keep mapping flow fast: do not auto-open queued popup after sign type confirmation.
    setSelectedQueuedTempId(null);
  }

  function requestQueueOfficialSign(lat, lng) {
    if (!isValidLatLng(lat, lng)) return;
    if (Number(mapZoom) < MAPPING_MIN_ZOOM) {
      openNotice(
        "⚠️",
        "Zoom in to place signs",
        `Zoom to at least level ${MAPPING_MIN_ZOOM} to place official signs.`
      );
      return;
    }
    setPendingQueuedSign({
      lat: Number(lat),
      lng: Number(lng),
      sign_type: "",
    });
    setQueueSignTypeOpen(true);
  }

  function cancelQueueOfficialSign() {
    setQueueSignTypeOpen(false);
    setPendingQueuedSign(null);
  }

  function confirmQueueOfficialSign() {
    const next = pendingQueuedSign;
    if (!next) return;
    queueOfficialSign(next.lat, next.lng, next.sign_type);
    setQueueSignTypeOpen(false);
    setPendingQueuedSign(null);
  }

  function updateQueuedSignType(tempId, signType) {
    const nextType = String(signType || "other").trim().toLowerCase() || "other";
    setMappingQueue((prev) =>
      prev.map((q) =>
        q.tempId === tempId && q.domain === "street_signs"
          ? { ...q, sign_type: nextType }
          : q
      )
    );
  }


  // Persist cooldowns anytime they change
  useEffect(() => {
    const pruned = pruneCooldowns(cooldowns);
    if (Object.keys(pruned).length !== Object.keys(cooldowns).length) {
      setCooldowns(pruned);
      saveCooldownsToStorage(pruned);
      return;
    }
    saveCooldownsToStorage(pruned);
  }, [cooldowns]);

  // -------------------------
  // Auth: session + admin check
  // -------------------------
    // -------------------------
  // Email confirmation flash (one-time)
  // -------------------------
  useEffect(() => {
    const KEY = "sl_email_confirmed_flash_shown";
    if (sessionStorage.getItem(KEY)) return;

    const search = window.location.search || "";
    const hash = window.location.hash || "";

    // Supabase confirmation links can arrive as:
    // - ?code=...&type=signup (PKCE)
    // - #access_token=...&type=signup (implicit)
    // - ?token_hash=...&type=signup (older patterns)
    const looksLikeEmailConfirm =
      /type=signup/i.test(search + hash) &&
      (/(^|[?#&])code=/i.test(search) ||
        /(^|[?#&])token_hash=/i.test(search) ||
        /(^|[?#&])access_token=/i.test(hash));

    if (!looksLikeEmailConfirm) return;

    sessionStorage.setItem(KEY, "1");

    // Clean URL so refresh doesn't re-trigger the flash
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      // ignore
    }

    openNotice("✅", "Email confirmed", "You're all set.", {
      autoCloseMs: 2000,
      compact: true,
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    hydrateCrossTenantSession(supabase).then((nextSession) => {
      if (!mounted) return;
      setSession(nextSession || null);
      setAuthReady(true); // ✅ important
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        syncCrossTenantAuthState(event, newSession || null);
        setSession(newSession);
        setAuthReady(true); // ✅ important
        if (event === "PASSWORD_RECOVERY") {
          setAuthGateOpen(false);
          setForgotPasswordOpen(false);
          setRecoveryPasswordValue("");
          setRecoveryPasswordValue2("");
          setRecoveryPasswordOpen(true);
        }
      }
    );

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function checkAdmin() {
      if (!session?.user?.id) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        if (!isExpectedPermissionError(error)) {
          console.error(error);
        }
        setIsAdmin(false);
        return;
      }

      setIsAdmin(Boolean(data?.user_id));
    }

    checkAdmin();
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    async function loadTenantVisibilityConfig() {
      // Week 3 noise hardening: keep default visibility unless this feature is explicitly enabled.
      if (!authReady) return;
      if (!ENABLE_TENANT_VISIBILITY_CONFIG) {
        if (!cancelled) {
          setTenantVisibilityByDomain({});
          setTenantVisibilityLoaded(false);
        }
        return;
      }
      const tenantKey = activeTenantKey();
      const { data, error } = await supabase
        .from("tenant_visibility_config")
        .select("domain,visibility")
        .eq("tenant_key", tenantKey);

      if (cancelled) return;
      if (error) {
        const errCode = String(error?.code || "").trim();
        const errMsg = String(error?.message || "").trim();
        const isDenied = errCode === "42501" || /permission denied|forbidden/i.test(errMsg);
        if (isDenied) {
          // Graceful fallback: keep default visibility and avoid noisy warnings/notices on auth refresh.
          setTenantVisibilityByDomain({});
          setTenantVisibilityLoaded(false);
          return;
        }
        console.warn("[tenant_visibility_config]", errMsg || error);
        setTenantVisibilityByDomain({});
        setTenantVisibilityLoaded(false);
        return;
      }

      const next = {};
      for (const row of data || []) {
        const key = String(row?.domain || "").trim();
        if (!key) continue;
        next[key] = String(row?.visibility || "").trim().toLowerCase();
      }
      setTenantVisibilityByDomain(next);
      setTenantVisibilityLoaded(true);
    }
    loadTenantVisibilityConfig();
    return () => {
      cancelled = true;
    };
  }, [authReady]);

  useEffect(() => {
    let cancelled = false;
    async function loadTenantMapFeatures() {
      const fallback = {
        show_boundary_border: true,
        shade_outside_boundary: true,
        show_alert_icon: true,
        show_event_icon: true,
        outside_shade_opacity: 0.42,
        boundary_border_color: "#e53935",
        boundary_border_width: 4,
      };
      if (!authReady) return;
      const tenantKey = activeTenantKey();
      const { data, error } = await supabase
        .from("tenant_map_features")
        .select("show_boundary_border,shade_outside_boundary,show_alert_icon,show_event_icon,outside_shade_opacity,boundary_border_color,boundary_border_width")
        .eq("tenant_key", tenantKey)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        const errCode = String(error?.code || "").trim();
        const errMsg = String(error?.message || "").trim();
        const isExpected = errCode === "42501" || /permission denied|forbidden/i.test(errMsg);
        const isMissing = errCode === "42P01" || /does not exist|relation|schema cache/i.test(errMsg);
        if (!isExpected && !isMissing) {
          console.warn("[tenant_map_features]", errMsg || error);
        }
        setTenantMapFeatures(fallback);
        return;
      }

      const nextOpacityRaw = Number(data?.outside_shade_opacity);
      const nextOpacity = Number.isFinite(nextOpacityRaw)
        ? Math.max(0, Math.min(1, nextOpacityRaw))
        : 0.42;
      const nextBorderColorRaw = String(data?.boundary_border_color || "").trim();
      const nextBorderColor = /^#[0-9a-fA-F]{6}$/.test(nextBorderColorRaw)
        ? nextBorderColorRaw.toLowerCase()
        : "#e53935";
      const nextBorderWidthRaw = Number(data?.boundary_border_width);
      const nextBorderWidth = Number.isFinite(nextBorderWidthRaw)
        ? Math.max(0.5, Math.min(8, nextBorderWidthRaw))
        : 4;
      setTenantMapFeatures({
        show_boundary_border: data?.show_boundary_border !== false,
        shade_outside_boundary: data?.shade_outside_boundary !== false,
        show_alert_icon: data?.show_alert_icon !== false,
        show_event_icon: data?.show_event_icon !== false,
        outside_shade_opacity: nextOpacity,
        boundary_border_color: nextBorderColor,
        boundary_border_width: nextBorderWidth,
      });
    }

    loadTenantMapFeatures();
    return () => {
      cancelled = true;
    };
  }, [authReady]);

  const resolvedCommunityFeedTenantKey = String(
    tenant?.tenantKey || tenant?.tenantConfig?.tenant_key || activeTenantKey() || ""
  ).trim().toLowerCase();
  const communityFeedViewerKey = String(session?.user?.id || "anon").trim().toLowerCase() || "anon";

  useEffect(() => {
    setMapCommunityFeedReadState(loadMapCommunityFeedReadState(resolvedCommunityFeedTenantKey, communityFeedViewerKey));
  }, [resolvedCommunityFeedTenantKey, communityFeedViewerKey]);

  const markMapCommunityFeedViewed = useCallback((kind) => {
    const tenantKey = resolvedCommunityFeedTenantKey;
    if (!tenantKey) return;
    const sourceItems = kind === "alerts" ? mapCommunityAlerts : mapCommunityEvents;
    const nextTs = maxMapCommunityFeedTs(sourceItems);
    if (!nextTs) return;
    const nextReadKeys = sourceItems
      .map((item) => mapCommunityFeedItemReadKey(item))
      .filter(Boolean);
    const nextReadIds = sourceItems
      .map((item) => String(item?.id || "").trim())
      .filter(Boolean);
    setMapCommunityFeedReadState((prev) => {
      const mergedAlertKeys = new Set(Array.isArray(prev?.alertsReadKeys) ? prev.alertsReadKeys : []);
      const mergedEventKeys = new Set(Array.isArray(prev?.eventsReadKeys) ? prev.eventsReadKeys : []);
      const mergedAlertIds = new Set(Array.isArray(prev?.alertsReadIds) ? prev.alertsReadIds : []);
      const mergedEventIds = new Set(Array.isArray(prev?.eventsReadIds) ? prev.eventsReadIds : []);
      if (kind === "alerts") {
        nextReadKeys.forEach((key) => mergedAlertKeys.add(key));
        nextReadIds.forEach((id) => mergedAlertIds.add(id));
      } else {
        nextReadKeys.forEach((key) => mergedEventKeys.add(key));
        nextReadIds.forEach((id) => mergedEventIds.add(id));
      }
      const next = {
        alertsLastViewedAt: kind === "alerts"
          ? Math.max(Number(prev?.alertsLastViewedAt || 0), nextTs)
          : Math.max(0, Number(prev?.alertsLastViewedAt || 0)),
        eventsLastViewedAt: kind === "events"
          ? Math.max(Number(prev?.eventsLastViewedAt || 0), nextTs)
          : Math.max(0, Number(prev?.eventsLastViewedAt || 0)),
        alertsReadKeys: Array.from(mergedAlertKeys).slice(-300),
        eventsReadKeys: Array.from(mergedEventKeys).slice(-300),
        alertsReadIds: Array.from(mergedAlertIds).slice(-300),
        eventsReadIds: Array.from(mergedEventIds).slice(-300),
      };
      saveMapCommunityFeedReadState(tenantKey, communityFeedViewerKey, next);
      return next;
    });
  }, [communityFeedViewerKey, mapCommunityAlerts, mapCommunityEvents, resolvedCommunityFeedTenantKey]);

  const loadMapCommunityFeed = useCallback(async () => {
    if (!authReady || tenant?.ready === false) return;
    const tenantKey = resolvedCommunityFeedTenantKey;
    if (!tenantKey) {
      setMapCommunityAlerts([]);
      setMapCommunityEvents([]);
      setMapCommunityFeedLoading(false);
      setMapCommunityFeedError("");
      return;
    }

    setMapCommunityFeedLoading(true);
    setMapCommunityFeedError("");

    const topicQuery = supabase
      .from("notification_topics")
      .select("topic_key,label")
      .eq("tenant_key", tenantKey)
      .eq("active", true)
      .order("sort_order", { ascending: true });

    const alertQuery = supabase
      .from("municipality_alerts")
      .select("id,tenant_key,topic_key,title,summary,body,severity,location_name,location_address,cta_label,cta_url,pinned,status,starts_at,ends_at,published_at,created_at,updated_at")
      .eq("tenant_key", tenantKey)
      .eq("status", "published")
      .order("pinned", { ascending: false })
      .order("starts_at", { ascending: false })
      .order("created_at", { ascending: false });

    const eventQuery = supabase
      .from("municipality_events")
      .select("id,tenant_key,topic_key,title,summary,body,location_name,location_address,cta_label,cta_url,all_day,status,starts_at,ends_at,published_at,created_at,updated_at")
      .eq("tenant_key", tenantKey)
      .eq("status", "published")
      .order("starts_at", { ascending: true })
      .order("created_at", { ascending: false });

    const [topicRes, alertRes, eventRes] = await Promise.all([topicQuery, alertQuery, eventQuery]);

    const firstError = alertRes.error || eventRes.error;
    if (firstError) {
      if (!isMissingRelationError(firstError)) {
        console.warn("[map community feed]", firstError?.message || firstError);
        setMapCommunityFeedError("Could not load alerts and events right now.");
      } else {
        setMapCommunityFeedError("");
      }
      setMapCommunityAlerts([]);
      setMapCommunityEvents([]);
      setMapCommunityFeedLoading(false);
      return;
    }

    if (topicRes.error && !isMissingRelationError(topicRes.error)) {
      console.warn("[map community topics]", topicRes.error?.message || topicRes.error);
    }

    const topicLabelsByKey = Object.fromEntries(
      (topicRes.data || []).map((topic) => [topic.topic_key, String(topic?.label || "").trim() || topic?.topic_key])
    );

    setMapCommunityAlerts(
      sortResidentAlerts((alertRes.data || [])
        .filter((alert) => !shouldAutoArchiveResidentCommunityItem(alert))
        .map((alert) => ({
          ...alert,
          topic_label: topicLabelsByKey[alert.topic_key] || RESIDENT_NOTIFICATION_TOPIC_DETAILS?.[alert.topic_key]?.label || alert.topic_key,
        })))
    );
    setMapCommunityEvents(
      sortResidentEvents((eventRes.data || [])
        .filter((event) => !shouldAutoArchiveResidentCommunityItem(event))
        .map((event) => ({
          ...event,
          topic_label: topicLabelsByKey[event.topic_key] || RESIDENT_NOTIFICATION_TOPIC_DETAILS?.[event.topic_key]?.label || event.topic_key,
        })))
    );
    setMapCommunityFeedLoading(false);
  }, [authReady, resolvedCommunityFeedTenantKey, tenant?.ready]);

  useEffect(() => {
    let cancelled = false;
    void loadMapCommunityFeed().catch((error) => {
      if (cancelled) return;
      console.warn("[map community feed]", error?.message || error);
      setMapCommunityFeedError("Could not load alerts and events right now.");
      setMapCommunityFeedLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadMapCommunityFeed]);

  useEffect(() => {
    if (!alertsWindowOpen && !eventsWindowOpen) return;
    void loadMapCommunityFeed();
  }, [alertsWindowOpen, eventsWindowOpen, loadMapCommunityFeed]);

  useEffect(() => {
    if (!alertsWindowOpen || mapCommunityFeedLoading) return;
    markMapCommunityFeedViewed("alerts");
  }, [alertsWindowOpen, mapCommunityFeedLoading, mapCommunityAlerts, markMapCommunityFeedViewed]);

  useEffect(() => {
    if (!eventsWindowOpen || mapCommunityFeedLoading) return;
    markMapCommunityFeedViewed("events");
  }, [eventsWindowOpen, mapCommunityFeedLoading, mapCommunityEvents, markMapCommunityFeedViewed]);

  useEffect(() => {
    if (!visibleDomainOptions.length) return;
    const hasAdminDomain = visibleDomainOptions.some((d) => d.key === adminReportDomain);
    if (!hasAdminDomain) setAdminReportDomain(visibleDomainOptions[0].key);
    const hasMyDomain = visibleDomainOptions.some((d) => d.key === myReportsDomain);
    if (!hasMyDomain) setMyReportsDomain(visibleDomainOptions[0].key);
  }, [visibleDomainOptions, adminReportDomain, myReportsDomain]);

  useEffect(() => {
    if (reportDeepLinkHandledRef.current) return;
    if (typeof window === "undefined" || !visibleDomainOptions.length) return;

    const { requestedDomain, focusIncidentId, flyLat, flyLng, flyZoom, hasFlyTarget } =
      initialReportDeepLinkRef.current || readReportDeepLinkRequest(window.location.search || "");
    const nextDomain = visibleDomainOptions.some((d) => d.key === requestedDomain) ? requestedDomain : "";

    if (!nextDomain && !focusIncidentId && !hasFlyTarget) {
      reportDeepLinkHandledRef.current = true;
      return;
    }

    reportDeepLinkHandledRef.current = true;

    if (nextDomain) {
      setAdminReportDomain(nextDomain);
      setMyReportsDomain(nextDomain);
    }

    if (focusIncidentId && isAdmin) {
      setOpenReportsExpanded(new Set([focusIncidentId]));
      setOpenReportsOpen(true);
    }

    if (hasFlyTarget) {
      preserveReportFlyTargetCameraRef.current = true;
      flyToTarget([flyLat, flyLng], flyZoom);
    }
  }, [visibleDomainOptions, isAdmin]);

  useEffect(() => {
    let cancelled = false;

    async function loadOpenAbuseFlags() {
      if (!isAdmin) {
        if (!cancelled) setOpenAbuseFlagSummary({ total: 0, maxSeverity: 0 });
        abuseFlagBannerShownRef.current = false;
        return;
      }

      const { data, error } = await supabase
        .from("metrics_open_abuse_flags_v1")
        .select("open_flag_count,severity");

      if (cancelled) return;
      if (error) {
        if (!isExpectedPermissionError(error)) {
          console.warn("[abuse flags]", error?.message || error);
        }
        return;
      }

      let total = 0;
      let maxSeverity = 0;
      for (const r of data || []) {
        const count = Math.max(0, Number(r?.open_flag_count || 0));
        const sev = Math.max(0, Number(r?.severity || 0));
        total += count;
        if (sev > maxSeverity) maxSeverity = sev;
      }

      setOpenAbuseFlagSummary({ total, maxSeverity });

      if (total > 0 && !abuseFlagBannerShownRef.current) {
        // Keep admin anomaly totals in state, but avoid disruptive modal on login/refresh.
        abuseFlagBannerShownRef.current = true;
      } else if (total === 0) {
        abuseFlagBannerShownRef.current = false;
      }
    }

    loadOpenAbuseFlags();
    const timer = setInterval(loadOpenAbuseFlags, 60000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isAdmin]);

  const loadModerationFlagRows = useCallback(async () => {
    if (!isAdmin) {
      setModerationFlagRows([]);
      setModerationFlagsError("");
      setModerationFlagsLoading(false);
      return;
    }
    setModerationFlagsLoading(true);
    setModerationFlagsError("");
    const tryQueries = [
      () => supabase.from("abuse_events").select("*").order("created_at", { ascending: false }).limit(300),
      () => supabase.from("abuse_events").select("*").order("ts", { ascending: false }).limit(300),
      () => supabase.from("abuse_events").select("*").order("id", { ascending: false }).limit(300),
    ];
    let lastErr = null;
    for (const run of tryQueries) {
      try {
        const { data, error } = await run();
        if (error) {
          lastErr = error;
          continue;
        }
        const rows = Array.isArray(data) ? data : [];
        setModerationFlagRows(rows);
        setModerationFlagsError("");
        setModerationFlagsLoading(false);
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    setModerationFlagRows([]);
    setModerationFlagsError(String(lastErr?.message || lastErr || "Unable to load moderation flags"));
    setModerationFlagsLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (!moderationFlagsOpen) return;
    void loadModerationFlagRows();
  }, [moderationFlagsOpen, loadModerationFlagRows]);

    useEffect(() => {
      let cancelled = false;

      async function loadProfile() {
        if (!session?.user?.id) {
          setProfile(null);
          return;
        }

        const uid = session.user.id;

        const { data, error: profErr } = await supabase
          .from("profiles")
          .select("full_name, phone, email")
          .eq("user_id", uid)
          .maybeSingle();

        // ✅ Self-heal profile after email confirmation:
        // If no row exists (or phone/name missing), upsert from auth metadata.
        const meta = session?.user?.user_metadata || {};
        const desiredFullName = (meta.full_name || meta.name || "").trim() || null;
        const desiredPhone = (meta.phone || meta.phone_number || "").trim() || null;
        const desiredEmail = (session?.user?.email || "").trim() || null;

        const missingRow = !data;
        const missingName = !((data?.full_name || "").trim()) && !!desiredFullName;
        const missingPhone = !((data?.phone || "").trim()) && !!desiredPhone;

        if (!profErr && (missingRow || missingName || missingPhone)) {
          const { error: upErr } = await supabase
            .from("profiles")
            .upsert(
              [{
                user_id: uid,
                full_name: desiredFullName,
                phone: desiredPhone,
                email: desiredEmail,
              }],
              { onConflict: "user_id" }
            );

          if (upErr) {
            console.error("[profiles] upsert error:", upErr);
          }
        }

        if (cancelled) return;

        if (profErr) {
          console.error("[profiles] load error:", profErr);

          // ✅ fallback to auth metadata instead of nuking profile
          setProfile({
            full_name: (session?.user?.user_metadata?.full_name || "").trim() || null,
            phone:
              (session?.user?.user_metadata?.phone || "").trim() ||
              (session?.user?.user_metadata?.phone_number || "").trim() ||
              null,
            email: session?.user?.email || null,
          });
          return;
        }

        // ✅ if no row, still fallback (prevents email-prefix behavior)
        setProfile(
          data || {
            full_name: (session?.user?.user_metadata?.full_name || "").trim() || null,
            phone:
              (session?.user?.user_metadata?.phone || "").trim() ||
              (session?.user?.user_metadata?.phone_number || "").trim() ||
              null,
            email: session?.user?.email || null,
          }
        );
      }

      loadProfile();

      return () => {
        cancelled = true;
      };
    }, [session?.user?.id, session?.user?.email]);


  useEffect(() => {
    if (!manageOpen) return;

    setManageForm({
      full_name: (profile?.full_name || "").trim(),
      phone: (profile?.phone || "").trim(),
    });
  }, [manageOpen, profile?.full_name, profile?.phone]);


  useEffect(() => {
    if (!isAdmin && mappingMode) setMappingMode(false);
  }, [isAdmin, mappingMode]);

  async function signIn() {
    setAuthLoading(true);
    setLoginError("");

    const email = (authEmail || "").trim().toLowerCase();
    const password = authPassword || "";

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setAuthLoading(false);

    if (error) {
      setLoginError("invalid_credentials");
      return false;
    }

    setAccountMenuOpen(false);
    setLoginError("");
    return true;
  }

  function openForgotPasswordModal() {
    setForgotPasswordEmail((authEmail || "").trim());
    setForgotPasswordError("");
    setForgotPasswordOpen(true);
  }

  async function sendPasswordReset() {
    const email = (forgotPasswordEmail || "").trim().toLowerCase();
    if (!email) {
      setForgotPasswordError("Enter email");
      return false;
    }

    setForgotPasswordError("");
    setAuthResetLoading(true);
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    setAuthResetLoading(false);

    if (error) {
      openNotice("⚠️", "Couldn’t send reset", error.message || "Password reset email failed.");
      return false;
    }

    setForgotPasswordOpen(false);
    openNotice("✅", "Check your email", "If an account exists for that email, a password reset link has been sent.");
    return true;
  }

    async function userLogin(email, password) {
      const e = (email || "").trim().toLowerCase();
      const p = password || "";

      const { error } = await supabase.auth.signInWithPassword({ email: e, password: p });
      // CMD+F: async function userLogin(email, password)
      if (error) {
        openNotice("⚠️", "Sign-in failed", error.message);
        return false;
      }
      return true;
    }

  async function userCreateAccount({ email, password, full_name, phone }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          phone,
          terms_accepted: true,
          privacy_accepted: true,
          contact_forwarding_consent: true,
          legal_accepted_at: new Date().toISOString(),
        },
      },
    });

    if (error) {
      openNotice("⚠️", "Sign up failed", error.message);
      return false;
    }

    // user may be immediately available or may require email confirmation depending on your Supabase settings
    const uid = data?.user?.id;
    if (uid) {
      const { error: profErr } = await supabase
        .from("profiles")
        .insert([{ user_id: uid, full_name, phone: phone || null, email }]);

      if (profErr) {
        console.error(profErr);
      }
    }

    return true;
  }

  async function handleCreateAccount() {
    const email = signupEmail.trim();
    const password = signupPassword;
    const full_name = signupName.trim();
    const phone = signupPhone.trim();

    if (!full_name) {
      openNotice("⚠️", "Name required", "Please enter your full name.");
      return;
    }
    if (!email) {
      openNotice("⚠️", "Email required", "Please enter your email.");
      return;
    }
    if (!phone) {
      openNotice("⚠️", "Phone required", "Please enter your phone number.");
      return;
    }
    if (!validateStrongPassword(password)) {
      openNotice("⚠️", "Weak password", "Use 8+ chars with uppercase, lowercase, number, and special character.");
      return;
    }
    if (signupPassword !== signupPassword2) {
      openNotice("⚠️", "Passwords don’t match", "Please re-enter your password so both fields match.");
      return;
    }
    if (!signupLegalAccepted) {
      openNotice(
        "⚠️",
        "Agreement required",
        "Please accept the Terms of Use and Privacy Policy to create an account."
      );
      return;
    }


    setSignupLoading(true);
    const ok = await userCreateAccount({ email, password, full_name, phone });
      setSignupLoading(false);

      if (!ok) return;

      // Close gate first so the notice is foreground
      setAuthGateOpen(false);
      setAuthGateStep("welcome");

      // ✅ Show correct message (no auto-login attempt)
      openNotice(
        "✅",
        "Confirmation sent",
        "Check your email for the confirmation link. After you confirm, come back here to sign in."
      );
  

    // Clear fields
    setSignupName("");
    setSignupPhone("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupPassword2("");
    setSignupLegalAccepted(false);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      markCrossTenantLogout();
    }
    reauthAtRef.current = 0;
    setIsAdmin(false);
    setAuthEmail("");
    setAuthPassword("");
    setAccountMenuOpen(false);
  }

  async function saveManagedProfile() {
    if (!session?.user?.id) return;

    const full_name = (manageForm.full_name || "").trim();
    const phone = (manageForm.phone || "").trim();

    if (!full_name) {
      openNotice("⚠️", "Name required", "Please enter your full name.");
      return;
    }

    if (Date.now() - reauthAtRef.current > 5 * 60 * 1000) {
      setReauthIntent("save_profile");
      setReauthPassword("");
      setReauthOpen(true);
      return;
    }

    setManageSaving(true);

    // 1) Update profiles table
    const { error: upErr } = await supabase
      .from("profiles")
      .upsert(
        [{
          user_id: session.user.id,
          full_name,
          phone: phone || null,
          email: (profile?.email || session.user.email || null),
        }],
        { onConflict: "user_id" }
      );

    if (upErr) {
      console.error(upErr);
      openNotice("⚠️", "Save failed", "Could not update your profile. Please try again.");
      setManageSaving(false);
      return;
    }

    // 2) Best-effort: mirror into auth metadata too (helps fallbacks)
    const { error: metaErr } = await supabase.auth.updateUser({
      data: { full_name, phone: phone || null },
    });

    if (metaErr) {
      // not fatal
      console.warn("[auth.updateUser] warning:", metaErr);
    }

    // 3) Update local state immediately
    setProfile((prev) => ({
      ...(prev || {}),
      full_name,
      phone: phone || null,
      email: (prev?.email || session.user.email || null),
    }));

    setManageSaving(false);
    setManageEditing(false);
    openNotice("✅", "Saved", "Your account details were updated.");
  }

  async function handleChangePassword() {
    const p1 = String(changePasswordValue || "");
    const p2 = String(changePasswordValue2 || "");
    const current = String(changePasswordCurrentValue || "");
    if (!validateStrongPassword(p1)) {
      openNotice("⚠️", "Weak password", "Use 8+ chars with uppercase, lowercase, number, and special character.");
      return;
    }
    if (p1 !== p2) {
      openNotice("⚠️", "Passwords don’t match", "Please re-enter your password so both fields match.");
      return;
    }
    if (!current.trim()) {
      openNotice("⚠️", "Current password required", "Enter your current password to continue.");
      return;
    }

    setChangePasswordSaving(true);
    const email = String(session?.user?.email || profile?.email || "").trim().toLowerCase();
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (reauthError) {
      setChangePasswordSaving(false);
      openNotice("⚠️", "Re-auth failed", reauthError.message || "Please verify your current password.");
      return;
    }

    reauthAtRef.current = Date.now();
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setChangePasswordSaving(false);

    if (error) {
      openNotice("⚠️", "Couldn’t update password", error.message || "Please try again.");
      return;
    }

    setChangePasswordValue("");
    setChangePasswordValue2("");
    setChangePasswordCurrentValue("");
    setChangePasswordOpen(false);
    // Soft refresh auth context without forcing a full sign-out/login.
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data?.session) setSession(data.session);
    } catch {
      // no-op
    }
    openNotice("✅", "Password updated", "Your password was changed successfully.");
  }

  async function handleRecoveryPasswordUpdate() {
    const p1 = String(recoveryPasswordValue || "");
    const p2 = String(recoveryPasswordValue2 || "");
    if (!validateStrongPassword(p1)) {
      openNotice("⚠️", "Weak password", "Use 8+ chars with uppercase, lowercase, number, and special character.");
      return;
    }
    if (p1 !== p2) {
      openNotice("⚠️", "Passwords don’t match", "Please re-enter your password so both fields match.");
      return;
    }

    setRecoveryPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: p1 });
    setRecoveryPasswordSaving(false);

    if (error) {
      openNotice("⚠️", "Couldn’t update password", error.message || "Please try again.");
      return;
    }

    setRecoveryPasswordValue("");
    setRecoveryPasswordValue2("");
    setRecoveryPasswordOpen(false);
    // Soft refresh auth context without forcing a full sign-out/login.
    try {
      const { data } = await supabase.auth.refreshSession();
      if (data?.session) setSession(data.session);
    } catch {
      // no-op
    }
    openNotice("✅", "Password updated", "Your password was reset successfully.");
  }

  function requestEditManagedProfile() {
    if (Date.now() - reauthAtRef.current <= 5 * 60 * 1000) {
      setManageEditing(true);
      return;
    }
    setReauthIntent("edit_profile");
    setReauthPassword("");
    setReauthOpen(true);
  }

  async function confirmReauth() {
    const email = String(session?.user?.email || profile?.email || "").trim().toLowerCase();
    const password = String(reauthPassword || "");
    if (!email || !password) {
      openNotice("⚠️", "Re-auth failed", "Current password is required.");
      return;
    }

    setReauthSaving(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setReauthSaving(false);

    if (error) {
      openNotice("⚠️", "Re-auth failed", error.message || "Please verify your current password.");
      return;
    }

    reauthAtRef.current = Date.now();
    const intent = reauthIntent;
    setReauthOpen(false);
    setReauthPassword("");
    setReauthIntent(null);

    if (intent === "edit_profile") {
      setManageEditing(true);
      return;
    }
    if (intent === "save_profile") {
      saveManagedProfile();
      return;
    }
  }

  // -------------------------
  // Load reports + fixed + official
  // -------------------------
  // CMD+F: async function fetchAllOfficialLights
  async function fetchAllOfficialLights() {
    const pageSize = 1000;
    let from = 0;
    let all = [];

    while (true) {
      const { data, error } = await supabase
        .from("official_lights")
        .select("id, sl_id, lat, lng, nearest_address, nearest_cross_street, nearest_landmark")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      all = all.concat(data || []);

      if (!data || data.length < pageSize) break; // done
      from += pageSize;
    }

    return all;
  }

  async function fetchAllOfficialSigns() {
    const pageSize = 1000;
    let from = 0;
    let all = [];

    while (true) {
      const { data, error } = await supabase
        .from("official_signs")
        .select("id, sign_type, lat, lng, active")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      all = all.concat(data || []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }

    return all;
  }

  async function fetchAllIncidentStateCurrent() {
    const pageSize = 1000;
    let from = 0;
    let all = [];
    while (true) {
      const { data, error } = await supabase
        .from("incident_state_current")
        .select("domain, incident_id, state, last_changed_at")
        .order("last_changed_at", { ascending: false })
        .order("domain", { ascending: true })
        .order("incident_id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const batch = data || [];
      all = all.concat(batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  async function fetchAllWaterDrainIncidents() {
    const pageSize = 1000;
    let from = 0;
    let all = [];
    while (true) {
      const { data, error } = await supabase
        .from("water_drain_incidents")
        .select("incident_id, wd_id, issue_type, lat, lng, nearest_address, nearest_cross_street, nearest_landmark, geo_updated_at, updated_at")
        .order("updated_at", { ascending: false })
        .order("incident_id", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const batch = data || [];
      all = all.concat(batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }
    return all;
  }

  async function fetchTenantDomainPublicConfig() {
    const { data, error } = await supabase.rpc("tenant_domain_public_config");
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }

  useEffect(() => {
    if (!authReady) return; // ✅ wait until auth restored
    async function loadAll() {
      setLoading(true);
      setError("");

      const isAuthed = Boolean(session?.user?.id);
      const reportSelectPublic = "id, created_at, lat, lng, report_type, report_quality, note, light_id";
      const reportSelectPublicWithNumber = "id, created_at, lat, lng, report_type, report_quality, note, light_id, report_number";
      const reportSelectPublicLegacy = "id, created_at, lat, lng, report_type, report_quality, note, light_id";
      const reportSelectFull = "id, created_at, lat, lng, report_type, report_quality, note, light_id, report_number, reporter_user_id, reporter_name, reporter_phone, reporter_email";
      const actionsSelectPublic = "id, light_id, action, created_at";
      const actionsSelectFull = "id, light_id, action, note, created_at, actor_user_id";

      const reportsPromise = isAdmin
        ? supabase.from("reports").select(reportSelectFull).order("created_at", { ascending: false })
        : (async () => {
            const first = await supabase
              .from("reports_public")
              .select(reportSelectPublic)
              .order("created_at", { ascending: false });
            const msg = String(first?.error?.message || "").toLowerCase();
            const missingReportNumber =
              first?.error && msg.includes("report_number") && msg.includes("does not exist");
            if (!missingReportNumber) return first;
            return supabase
              .from("reports_public")
              .select(reportSelectPublicLegacy)
              .order("created_at", { ascending: false });
          })();

      const ownReportsPromise = (!isAdmin && isAuthed)
        ? supabase
            .from("reports")
            .select(reportSelectFull)
            .eq("reporter_user_id", session.user.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });
      const utilityStatusPromise = isAuthed
        ? supabase
            .from("utility_report_status")
            .select("incident_id, report_reference")
            .eq("tenant_key", activeTenantKey())
            .eq("user_id", session.user.id)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });
      const utilitySignalCountsPromise = supabase.rpc("streetlight_utility_signal_counts");
      const utilityStatusAllPromise = isAdmin
        ? supabase
            .from("utility_report_status")
            .select("incident_id")
            .eq("tenant_key", activeTenantKey())
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const actionsPromise = isAdmin
        ? supabase.from("light_actions").select(actionsSelectFull).order("created_at", { ascending: false })
        : supabase.from("light_actions_public").select(actionsSelectPublic).order("created_at", { ascending: false });

      const [
        { data: reportDataRaw, error: repErrRaw },
        { data: ownReportData, error: ownRepErr },
        { data: utilityStatusDataRaw, error: utilityStatusErrRaw },
        { data: utilitySignalCountData, error: utilitySignalCountErr },
        { data: utilityStatusAllData, error: utilityStatusAllErr },
        { data: fixedData, error: fixErr },
        { data: actionData, error: actErr },
      ] = await Promise.all([
        reportsPromise,
        ownReportsPromise,
        utilityStatusPromise,
        utilitySignalCountsPromise,
        utilityStatusAllPromise,
        supabase.from("fixed_lights").select("*"),
        actionsPromise,
      ]);
      let utilityStatusData = utilityStatusDataRaw;
      let utilityStatusErr = utilityStatusErrRaw;
      if (utilityStatusErr && isMissingUtilityReportReferenceColumnError(utilityStatusErr) && isAuthed) {
        const fallback = await supabase
          .from("utility_report_status")
          .select("incident_id")
          .eq("tenant_key", activeTenantKey())
          .eq("user_id", session.user.id)
          .order("updated_at", { ascending: false });
        utilityStatusData = fallback.data || [];
        utilityStatusErr = fallback.error || null;
      }
      let reportData = reportDataRaw;
      let repErr = repErrRaw;
      if (!isAdmin && (repErr || !(Array.isArray(reportData) && reportData.length))) {
        try {
          const fallback = await supabase
            .from("reports")
            .select(reportSelectPublicWithNumber)
            .order("created_at", { ascending: false });
          if (!fallback.error && Array.isArray(fallback.data) && fallback.data.length) {
            reportData = fallback.data;
            repErr = null;
          }
        } catch {
          // keep original result
        }
      }

      // Potholes (dedicated tables)
      const potholeSelect = "id, ph_id, lat, lng, location_label, created_at";
      const potholeReportSelect =
        "id, pothole_id, lat, lng, note, report_number, created_at, reporter_user_id, reporter_name, reporter_phone, reporter_email";
      let potholeData = [];
      let potholeRepData = [];
      let potholeErr = null;
      let potholeRepErr = null;
      try {
        const [{ data: pd, error: pe }, { data: prd, error: pre }] = await Promise.all([
          supabase.from("potholes").select(potholeSelect).order("created_at", { ascending: true }),
          supabase.from("pothole_reports").select(potholeReportSelect).order("created_at", { ascending: false }),
        ]);
        potholeData = pd || [];
        potholeRepData = prd || [];
        potholeErr = pe;
        potholeRepErr = pre;
      } catch (e) {
        potholeErr = e;
      }

      let officialData = [];
      let offErr = null;
      let officialSignData = [];
      let signErr = null;
      let incidentStateRows = [];
      let incidentStateErr = null;
      let waterDrainIncidentRows = [];
      let waterDrainIncidentErr = null;
      let cityBoundaryErr = null;
      try {
        officialData = await fetchAllOfficialLights();
      } catch (e) {
        offErr = e;
        console.error("[official_lights] load error:", e);
      }
      try {
        officialSignData = await fetchAllOfficialSigns();
      } catch (e) {
        signErr = e;
        console.error("[official_signs] load error:", e);
      }
      try {
        incidentStateRows = await fetchAllIncidentStateCurrent();
      } catch (e) {
        incidentStateErr = e;
        if (!isExpectedPermissionError(e)) {
          console.warn("[incident_state_current] load warning:", e?.message || e);
        }
      }
      try {
        waterDrainIncidentRows = await fetchAllWaterDrainIncidents();
      } catch (e) {
        waterDrainIncidentErr = e;
        const msg = String(e?.message || "").toLowerCase();
        if (!(msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache"))) {
          console.warn("[water_drain_incidents] load warning:", e?.message || e);
        }
      }
      try {
        let boundaryKey = tenantBoundaryConfigKey();
        const tenantKey = activeTenantKey();
        const tenantBoundary = await supabase
          .from("tenants")
          .select("boundary_config_key")
          .eq("tenant_key", tenantKey)
          .maybeSingle();
        if (!tenantBoundary.error && tenantBoundary.data?.boundary_config_key) {
          const configuredBoundaryKey = String(tenantBoundary.data.boundary_config_key || "").trim();
          if (configuredBoundaryKey) boundaryKey = configuredBoundaryKey;
        }
        let { data: cfg, error: cfgErr } = await supabase
          .from("app_config")
          .select("value")
          .eq("key", boundaryKey)
          .maybeSingle();
        if ((!cfg?.value || cfgErr) && tenantKey === "ashtabulacity" && boundaryKey !== "ashtabula_city_geojson") {
          const fallback = await supabase
            .from("app_config")
            .select("value")
            .eq("key", "ashtabula_city_geojson")
            .maybeSingle();
          if (!fallback.error && fallback.data?.value) {
            cfg = fallback.data;
            cfgErr = null;
          }
        }
        if (!cfg?.value || cfgErr) {
          const { data: boundaryFiles, error: boundaryFilesErr } = await supabase
            .from("tenant_files")
            .select("storage_bucket,storage_path")
            .eq("tenant_key", tenantKey)
            .eq("file_category", "boundary_geojson")
            .eq("active", true)
            .order("uploaded_at", { ascending: false })
            .limit(1);
          if (!boundaryFilesErr && Array.isArray(boundaryFiles) && boundaryFiles.length > 0) {
            const newest = boundaryFiles[0] || {};
            const bucket = String(newest?.storage_bucket || "tenant-files").trim() || "tenant-files";
            const path = String(newest?.storage_path || "").trim();
            if (path) {
              const signed = await supabase.storage.from(bucket).createSignedUrl(path, 90);
              const signedUrl = String(signed?.data?.signedUrl || "").trim();
              if (!signed?.error && signedUrl) {
                try {
                  const resp = await fetch(signedUrl, { method: "GET" });
                  if (resp.ok) {
                    const rawText = await resp.text();
                    const parsed = parseGeoJsonValue(rawText);
                    if (parsed) {
                      cfg = { value: parsed };
                      cfgErr = null;
                    }
                  }
                } catch {
                  // ignore boundary file fetch/parse fallback failure
                }
              }
            }
          }
        }
        cityBoundaryErr = cfgErr || null;
        setCityBoundaryGeojson(cfg?.value || null);
      } catch (e) {
        cityBoundaryErr = e;
        setCityBoundaryGeojson(null);
      }
      if (cityBoundaryErr) {
        console.warn("[app_config city boundary] load warning:", cityBoundaryErr?.message || cityBoundaryErr);
      }

      if (offErr) {
        openNotice("⚠️", "Official lights failed to load", offErr.message || "Check Supabase RLS policies.");
      } else {
        setOfficialLights(
          (officialData || [])
            .map(normalizeOfficialLightRow)
            .filter(Boolean)
        );
      }
      if (!signErr) {
        setOfficialSigns(
          (officialSignData || [])
            .map(normalizeOfficialSignRow)
            .filter(Boolean)
        );
      }
      if (!incidentStateErr) {
        const next = {};
        for (const row of incidentStateRows || []) {
          const key = incidentSnapshotKey(row?.domain, row?.incident_id);
          if (!key) continue;
          next[key] = {
            state: String(row?.state || "").trim(),
            last_changed_at: row?.last_changed_at || null,
          };
        }
        setIncidentStateByKey(next);
        setLastFixByLightId((prev) => {
          const out = { ...(prev || {}) };
          for (const [key, snap] of Object.entries(next || {})) {
            const keyStr = String(key || "");
            const sep = keyStr.indexOf(":");
            if (sep < 0) continue;
            const incidentId = keyStr.slice(sep + 1).trim();
            if (!incidentId) continue;
            const state = String(snap?.state || "").trim().toLowerCase();
            if (!(state === "fixed" || state === "archived")) continue;
            const ts = Date.parse(String(snap?.last_changed_at || "")) || 0;
            if (!ts) continue;
            if (!out[incidentId] || ts > Number(out[incidentId] || 0)) {
              out[incidentId] = ts;
            }
          }
          return out;
        });
      }
      if (!waterDrainIncidentErr) {
        const nextWaterCache = {};
        for (const row of waterDrainIncidentRows || []) {
          const key = String(row?.incident_id || "").trim();
          if (!key) continue;
          nextWaterCache[key] = {
            wd_id: String(row?.wd_id || "").trim(),
            issue_type: String(row?.issue_type || "").trim().toLowerCase(),
            lat: Number(row?.lat),
            lng: Number(row?.lng),
            nearest_address: String(row?.nearest_address || "").trim(),
            nearest_cross_street: String(row?.nearest_cross_street || "").trim(),
            nearest_landmark: String(row?.nearest_landmark || "").trim(),
            geo_updated_at: row?.geo_updated_at || null,
            updated_at: row?.updated_at || null,
          };
        }
        setWaterDrainIncidentsById(nextWaterCache);
      }

      const officialIdByAlias = new Map();
      const officialIdByCoordKey = new Map();
      for (const ol of officialData || []) {
        const id = String(ol?.id || "").trim();
        if (!id) continue;
        officialIdByAlias.set(id, id);
        const sl = String(ol?.sl_id || "").trim();
        if (sl) officialIdByAlias.set(sl, id);
        const lat = Number(ol?.lat);
        const lng = Number(ol?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          officialIdByCoordKey.set(`${lat.toFixed(5)}:${lng.toFixed(5)}`, id);
          officialIdByCoordKey.set(`${lat.toFixed(4)}:${lng.toFixed(4)}`, id);
        }
      }

      if (potholeErr) {
        console.warn("[potholes] load warning:", potholeErr?.message || potholeErr);
      } else {
        setPotholes(
          (potholeData || [])
            .map((p) => ({
              id: p.id,
              ph_id: (p.ph_id || "").trim() || null,
              lat: Number(p.lat),
              lng: Number(p.lng),
              location_label: (p.location_label || "").trim() || null,
            }))
            .filter((p) => p.id && isValidLatLng(p.lat, p.lng))
        );
      }
      if (potholeRepErr) {
        console.warn("[pothole_reports] load warning:", potholeRepErr?.message || potholeRepErr);
      } else {
        setPotholeReports(
          (potholeRepData || []).map((r) => ({
            id: r.id,
            pothole_id: r.pothole_id || null,
            lat: Number(r.lat),
            lng: Number(r.lng),
            note: r.note || "",
            report_number: r.report_number || null,
            ts: new Date(r.created_at).getTime(),
            reporter_user_id: r.reporter_user_id || null,
            reporter_name: r.reporter_name || null,
            reporter_phone: r.reporter_phone || null,
            reporter_email: r.reporter_email || null,
          }))
        );
      }

      if (repErr) {
        if (!isExpectedPermissionError(repErr)) {
          console.error(repErr);
        }
      }
      if (ownRepErr) {
        if (!isExpectedPermissionError(ownRepErr)) {
          console.error("[reports own] load error:", ownRepErr);
        }
      }
      if (utilityStatusErr) {
        if (!isExpectedPermissionError(utilityStatusErr)) {
          console.error("[utility_report_status] load error:", utilityStatusErr);
        }
      }
      if (utilityStatusAllErr) {
        if (!isExpectedPermissionError(utilityStatusAllErr)) {
          console.error("[utility_report_status all] load error:", utilityStatusAllErr);
        }
      }
      if (utilitySignalCountErr) {
        const msg = String(utilitySignalCountErr?.message || "").toLowerCase();
        if (!(msg.includes("does not exist") || msg.includes("function") || msg.includes("schema cache"))) {
          console.error("[streetlight_utility_signal_counts] load error:", utilitySignalCountErr);
        }
      }

      const normalizedPublicReports = (reportData || []).map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        type: r.report_type,
        report_quality: normalizeReportQuality(r.report_quality),
        note: r.note || "",
        ts: new Date(r.created_at).getTime(),
        light_id: canonicalOfficialLightId(r.light_id, r.lat, r.lng, officialIdByAlias, officialIdByCoordKey),
        report_number: r.report_number || null,
        reporter_user_id: r.reporter_user_id || null,
        reporter_name: r.reporter_name || null,
        reporter_phone: r.reporter_phone || null,
        reporter_email: r.reporter_email || null,
      }));

      const normalizedOwnReports = (ownReportData || []).map((r) => ({
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        type: r.report_type,
        report_quality: normalizeReportQuality(r.report_quality),
        note: r.note || "",
        ts: new Date(r.created_at).getTime(),
        light_id: canonicalOfficialLightId(r.light_id, r.lat, r.lng, officialIdByAlias, officialIdByCoordKey),
        report_number: r.report_number || null,
        reporter_user_id: r.reporter_user_id || null,
        reporter_name: r.reporter_name || null,
        reporter_phone: r.reporter_phone || null,
        reporter_email: r.reporter_email || null,
      }));

      const reportMap = new Map();
      for (const r of normalizedPublicReports) reportMap.set(r.id, r);
      for (const r of normalizedOwnReports) reportMap.set(r.id, r); // own rows overwrite public-safe rows
      setReports(Array.from(reportMap.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0)));

      const utilitySet = new Set();
      const utilityReferenceMap = {};
      for (const row of utilityStatusData || []) {
        const rawId = String(row?.incident_id || "").trim();
        if (!rawId) continue;
        const normalizedId = canonicalOfficialLightId(rawId, null, null, officialIdByAlias, officialIdByCoordKey);
        const id = String(normalizedId || "").trim();
        if (!id || !officialIdByAlias.has(id)) continue;
        utilitySet.add(id);
        utilityReferenceMap[id] = normalizeUtilityReportReference(row?.report_reference);
      }
      setUtilityReportedLightIdSet(utilitySet);
      setUtilityReportReferenceByLightId(utilityReferenceMap);

      const utilityAnySet = new Set();
      for (const row of utilityStatusAllData || []) {
        const rawId = String(row?.incident_id || "").trim();
        if (!rawId) continue;
        const normalizedId = canonicalOfficialLightId(rawId, null, null, officialIdByAlias, officialIdByCoordKey);
        const id = String(normalizedId || "").trim();
        if (!id || !officialIdByAlias.has(id)) continue;
        utilityAnySet.add(id);
      }
      setUtilityReportedAnyLightIdSet(utilityAnySet);

      const utilityCountMap = {};
      for (const row of utilitySignalCountData || []) {
        const rawId = String(row?.incident_id || "").trim();
        if (!rawId) continue;
        const normalizedId = canonicalOfficialLightId(rawId, null, null, officialIdByAlias, officialIdByCoordKey);
        const id = String(normalizedId || "").trim();
        if (!id || !officialIdByAlias.has(id)) continue;
        utilityCountMap[id] = {
          reportedCount: Math.max(0, Number(row?.reported_count || 0)),
          referenceCount: Math.max(0, Number(row?.reference_count || 0)),
          latestReportedTs: Date.parse(String(row?.latest_reported_at || "")) || 0,
        };
        if (Number(row?.reported_count || 0) > 0) utilityAnySet.add(id);
      }
      setUtilitySignalCountsByLightId(utilityCountMap);
      setUtilityReportedAnyLightIdSet(utilityAnySet);

      const fixedMap = {};
      for (const row of fixedData || []) fixedMap[row.light_id] = new Date(row.fixed_at).getTime();
      setFixedLights(fixedMap);

      let map = {};
      if (fixErr) {
        console.error(fixErr);
      }
      if (actErr) {
        if (!isExpectedPermissionError(actErr)) {
          console.error(actErr);
        }
      }
      else {
        for (const a of actionData || []) {
          if (String(a.action || "").toLowerCase() !== "fix") continue;
          const ts = new Date(a.created_at).getTime();
          if (!map[a.light_id] || ts > map[a.light_id]) map[a.light_id] = ts;
        }
        const byId = {};
        for (const a of actionData || []) {
          const ts = new Date(a.created_at).getTime();
          if (!byId[a.light_id]) byId[a.light_id] = [];
          const noteContact = parseWorkingContactFromNote(a.note);
          const actorEmail = a.actor_email || a.reporter_email || noteContact.email || null;
          const actorPhone = a.actor_phone || a.reporter_phone || noteContact.phone || null;
          const actorUserId = a.actor_user_id || a.reporter_user_id || null;
          const actorNameRaw = (a.actor_name || a.reporter_name || noteContact.name || "").trim();
          const actorNameFallback = actorEmail ? String(actorEmail).split("@")[0] : "";
          byId[a.light_id].push({
            action: a.action,
            ts,
            note: a.note || null,
            actor_user_id: actorUserId,
            actor_email: actorEmail,
            actor_phone: actorPhone,
            actor_name: actorNameRaw || actorNameFallback || null,
            reporter_user_id: a.reporter_user_id || actorUserId,
            reporter_name: (a.reporter_name || "").trim() || actorNameRaw || actorNameFallback || null,
            reporter_email: a.reporter_email || actorEmail,
            reporter_phone: a.reporter_phone || actorPhone,
          });
        }
        setActionsByLightId(byId);

        setLastFixByLightId(map);
      }

      const loadHadConnectionFailure = [repErr, ownRepErr, utilityStatusErr, utilitySignalCountErr, fixErr, actErr, offErr, signErr, potholeErr, potholeRepErr, incidentStateErr].some((e) =>
        isConnectionLikeDbError(e)
      );
      if (loadHadConnectionFailure) notifyDbConnectionIssue({ message: "connection check failed" });
      else resetDbConnectionIssueStreak();

      setLoading(false);
    }

    loadAll();
  }, [authReady, isAdmin, session?.user?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    const lid = (selectedOfficialId || "").trim();
    if (!lid) return;
    getOfficialLightHistoryDetailed(lid).catch((e) => {
      console.warn("[official light history prefetch] failed:", e);
    });
  }, [isAdmin, selectedOfficialId]);


  // -------------------------
  // Realtime subscriptions
  // -------------------------
  useEffect(() => {
    const viewerUserId = String(session?.user?.id || "").trim();
    let utilityRefreshTimer = null;
    let utilityRefreshInFlight = false;

    const refreshUtilityStatusSets = async () => {
      if (utilityRefreshInFlight) return;
      utilityRefreshInFlight = true;
      try {
        const tenantKey = activeTenantKey();
        if (viewerUserId) {
          let { data, error } = await supabase
            .from("utility_report_status")
            .select("incident_id, report_reference")
            .eq("tenant_key", tenantKey)
            .eq("user_id", viewerUserId)
            .order("updated_at", { ascending: false });
          if (error && isMissingUtilityReportReferenceColumnError(error)) {
            const fallback = await supabase
              .from("utility_report_status")
              .select("incident_id")
              .eq("tenant_key", tenantKey)
              .eq("user_id", viewerUserId)
              .order("updated_at", { ascending: false });
            data = fallback.data;
            error = fallback.error;
          }
          if (!error) {
            const next = new Set();
            const nextRefs = {};
            for (const row of data || []) {
              const incidentId = String(row?.incident_id || "").trim();
              if (!incidentId) continue;
              next.add(incidentId);
              nextRefs[incidentId] = normalizeUtilityReportReference(row?.report_reference);
            }
            setUtilityReportedLightIdSet(next);
            setUtilityReportReferenceByLightId(nextRefs);
          }
        }

        const { data: utilityCountData, error: utilityCountErr } = await supabase.rpc("streetlight_utility_signal_counts");
        if (!utilityCountErr) {
          const nextCounts = {};
          const nextAny = new Set();
          for (const row of utilityCountData || []) {
            const incidentId = String(row?.incident_id || "").trim();
            if (!incidentId) continue;
            const reportedCount = Math.max(0, Number(row?.reported_count || 0));
            nextCounts[incidentId] = {
              reportedCount,
              referenceCount: Math.max(0, Number(row?.reference_count || 0)),
              latestReportedTs: Date.parse(String(row?.latest_reported_at || "")) || 0,
            };
            if (reportedCount > 0) nextAny.add(incidentId);
          }
          setUtilitySignalCountsByLightId(nextCounts);
          setUtilityReportedAnyLightIdSet(nextAny);
        }
      } catch (e) {
        console.warn("[utility_report_status realtime refresh] warning:", e?.message || e);
      } finally {
        utilityRefreshInFlight = false;
      }
    };

    const scheduleUtilityStatusRefresh = () => {
      if (utilityRefreshTimer) clearTimeout(utilityRefreshTimer);
      utilityRefreshTimer = setTimeout(() => {
        utilityRefreshTimer = null;
        refreshUtilityStatusSets();
      }, 180);
    };

    const reportsChannel = isAdmin ? supabase
      .channel("realtime-reports")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reports" }, (payload) => {
        const r = payload.new;
        const incoming = {
          id: r.id,
          lat: r.lat,
          lng: r.lng,
          type: r.report_type,
          report_quality: normalizeReportQuality(r.report_quality),
          note: r.note || "",
          ts: new Date(r.created_at).getTime(),
          light_id: r.light_id || lightIdFor(r.lat, r.lng),
          report_number: r.report_number || null,

          reporter_user_id: r.reporter_user_id || null,
          reporter_name: r.reporter_name || null,
          reporter_phone: r.reporter_phone || null,
          reporter_email: r.reporter_email || null,
        };

        setReports((prev) => {
          if (prev.some((x) => x.id === incoming.id)) return prev;
          return [incoming, ...prev];
        });

        const incidentId = String(r?.light_id || "").trim();
        if (incidentId) {
          const nextIso = r?.created_at ? String(r.created_at) : new Date(incoming.ts || Date.now()).toISOString();
          setIncidentStateByKey((prev) => {
            const key = incidentSnapshotKey("streetlights", incidentId);
            if (!key) return prev;
            const prevIso = String(prev?.[key]?.last_changed_at || "");
            const prevTs = Date.parse(prevIso) || 0;
            const nextTs = Date.parse(nextIso) || 0;
            if (prevTs > nextTs) return prev;
            return {
              ...(prev || {}),
              [key]: { state: "reported", last_changed_at: nextIso },
            };
          });
        }
      })
      .subscribe() : null;

    const fixedChannel = supabase
      .channel("realtime-fixed")
      .on("postgres_changes", { event: "*", schema: "public", table: "fixed_lights" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const lightId = payload?.old?.light_id;
          if (!lightId) {
            console.warn("[fixed_lights DELETE] missing payload.old.light_id", payload);
            return;
          }

          setFixedLights((prev) => {
            const next = { ...prev };
            delete next[lightId];
            return next;
          });
          return;
        }

        const row = payload.new;
        setFixedLights((prev) => ({
          ...prev,
          [row.light_id]: new Date(row.fixed_at).getTime(),
        }));
      })
      .subscribe();

    const actionsChannel = isAdmin ? supabase
      .channel("realtime-actions")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "light_actions" }, (payload) => {
        const a = payload.new;
        const ts = new Date(a.created_at).getTime();

        setActionsByLightId((prev) => {
          const list = prev[a.light_id] ? [...prev[a.light_id]] : [];
          const noteContact = parseWorkingContactFromNote(a.note);
          const actorEmail = a.actor_email || a.reporter_email || noteContact.email || null;
          const actorPhone = a.actor_phone || a.reporter_phone || noteContact.phone || null;
          const actorUserId = a.actor_user_id || a.reporter_user_id || null;
          const actorNameRaw = (a.actor_name || a.reporter_name || noteContact.name || "").trim();
          const actorNameFallback = actorEmail ? String(actorEmail).split("@")[0] : "";
          const incoming = {
            action_id: a.id || null,
            action: a.action,
            ts,
            note: a.note || null,
            actor_user_id: actorUserId,
            actor_email: actorEmail,
            actor_phone: actorPhone,
            actor_name: actorNameRaw || actorNameFallback || null,
            reporter_user_id: a.reporter_user_id || actorUserId,
            reporter_name: (a.reporter_name || "").trim() || actorNameRaw || actorNameFallback || null,
            reporter_email: a.reporter_email || actorEmail,
            reporter_phone: a.reporter_phone || actorPhone,
          };
          const alreadyExists = list.some((x) => {
            const sameId = incoming.action_id && x?.action_id && String(x.action_id) === String(incoming.action_id);
            if (sameId) return true;
            // Guard against local-optimistic + realtime duplicate rows.
            return (
              String(x?.action || "").toLowerCase() === String(incoming.action || "").toLowerCase()
              && Number(x?.ts || 0) === Number(incoming.ts || 0)
              && String(x?.note || "") === String(incoming.note || "")
              && String(x?.actor_user_id || "") === String(incoming.actor_user_id || "")
            );
          });
          if (alreadyExists) return prev;
          list.unshift(incoming);
          return { ...prev, [a.light_id]: list };
        });

        const incidentId = String(a?.light_id || "").trim();
        const t = String(a.action || "").toLowerCase();
        if (t === "fix") {
          setLastFixByLightId((prev) => {
            const cur = prev[a.light_id] || 0;
            if (ts <= cur) return prev;
            return { ...prev, [a.light_id]: ts };
          });
        } else if (t === "reopen") {
          setLastFixByLightId((prev) => {
            if (!Object.prototype.hasOwnProperty.call(prev || {}, a.light_id)) return prev;
            const next = { ...(prev || {}) };
            delete next[a.light_id];
            return next;
          });
        } else {
          return;
        }

        if (incidentId) {
          const incidentDomain = domainForIncidentId(incidentId);
          const nextIso = a?.created_at ? String(a.created_at) : new Date(ts || Date.now()).toISOString();
          setIncidentStateByKey((prev) => {
            const key = incidentSnapshotKey(incidentDomain, incidentId);
            if (!key) return prev;
            const prevIso = String(prev?.[key]?.last_changed_at || "");
            const prevTs = Date.parse(prevIso) || 0;
            const nextTs = Date.parse(nextIso) || 0;
            if (prevTs > nextTs) return prev;
            return {
              ...(prev || {}),
              [key]: { state: t === "fix" ? "fixed" : "reopened", last_changed_at: nextIso },
            };
          });
        }
      })
      .subscribe() : null;


    const officialChannel = supabase
      .channel("realtime-official-lights")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "official_lights" },
        (payload) => {
          const row = payload.new;

          // INSERT/UPDATE give payload.new, DELETE does not
          if (!row) return;

          const clean = normalizeOfficialLightRow(row);
          if (!clean) {
            console.warn("[official_lights realtime] invalid row, ignoring:", row);
            return;
          }

          setOfficialLights((prev) => {
            const next = Array.isArray(prev) ? [...prev] : [];
            const idx = next.findIndex((x) => x.id === clean.id);

            if (idx >= 0) next[idx] = { ...next[idx], ...clean };
            else next.push(clean);

            // final de-dupe guard by id
            const dedup = new Map();
            for (const item of next) dedup.set(item.id, item);
            return Array.from(dedup.values());
          });
        }
      )

      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "official_lights" },
        (payload) => {
          const id = payload?.old?.id; // ✅ may be missing depending on replica identity / realtime config
          if (!id) {
            console.warn("[official_lights DELETE] missing payload.old.id", payload);
            return; // ✅ don’t crash the app
          }
          setOfficialLights((prev) => prev.filter((x) => x.id !== id));
        }
      )
      .subscribe((status) => {
        console.log("OFFICIAL realtime subscribe status:", status);
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") notifyDbConnectionIssue(status);
        if (status === "SUBSCRIBED") resetDbConnectionIssueStreak();
      });

    const potholesChannel = supabase
      .channel("realtime-potholes")
      .on("postgres_changes", { event: "*", schema: "public", table: "potholes" }, (payload) => {
        if (payload.eventType === "DELETE") {
          const id = payload?.old?.id;
          if (!id) return;
          setPotholes((prev) => prev.filter((x) => x.id !== id));
          return;
        }
        const p = payload?.new;
        const clean = {
          id: p?.id,
          ph_id: (p?.ph_id || "").trim() || null,
          lat: Number(p?.lat),
          lng: Number(p?.lng),
          location_label: (p?.location_label || "").trim() || null,
        };
        if (!clean.id || !isValidLatLng(clean.lat, clean.lng)) return;
        setPotholes((prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          const idx = next.findIndex((x) => x.id === clean.id);
          if (idx >= 0) next[idx] = { ...next[idx], ...clean };
          else next.push(clean);
          return next;
        });
      })
      .subscribe();

    const potholeReportsChannel = supabase
      .channel("realtime-pothole-reports")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pothole_reports" }, (payload) => {
        const r = payload?.new;
        const incoming = {
          id: r?.id,
          pothole_id: r?.pothole_id || null,
          lat: Number(r?.lat),
          lng: Number(r?.lng),
          note: r?.note || "",
          report_number: r?.report_number || null,
          ts: new Date(r?.created_at).getTime(),
          reporter_user_id: r?.reporter_user_id || null,
          reporter_name: r?.reporter_name || null,
          reporter_phone: r?.reporter_phone || null,
          reporter_email: r?.reporter_email || null,
        };
        if (!incoming.id) return;
        setPotholeReports((prev) => {
          if (prev.some((x) => x.id === incoming.id)) return prev;
          return [incoming, ...prev];
        });

        const pid = String(r?.pothole_id || "").trim();
        if (pid) {
          const nextIso = r?.created_at ? String(r.created_at) : new Date(incoming.ts || Date.now()).toISOString();
          setIncidentStateByKey((prev) => {
            const key = incidentSnapshotKey("potholes", `pothole:${pid}`);
            if (!key) return prev;
            const prevIso = String(prev?.[key]?.last_changed_at || "");
            const prevTs = Date.parse(prevIso) || 0;
            const nextTs = Date.parse(nextIso) || 0;
            if (prevTs > nextTs) return prev;
            return {
              ...(prev || {}),
              [key]: { state: "reported", last_changed_at: nextIso },
            };
          });
        }
      })
      .subscribe();

    const waterDrainIncidentsChannel = supabase
      .channel("realtime-water-drain-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "water_drain_incidents" }, (payload) => {
        const eventType = String(payload?.eventType || "").toUpperCase();
        if (eventType === "DELETE") {
          const incidentId = String(payload?.old?.incident_id || "").trim();
          if (!incidentId) return;
          setWaterDrainIncidentsById((prev) => {
            if (!Object.prototype.hasOwnProperty.call(prev || {}, incidentId)) return prev;
            const next = { ...(prev || {}) };
            delete next[incidentId];
            return next;
          });
          return;
        }

        const row = payload?.new;
        const incidentId = String(row?.incident_id || "").trim();
        if (!incidentId) return;
        setWaterDrainIncidentsById((prev) => ({
          ...(prev || {}),
          [incidentId]: {
            wd_id: String(row?.wd_id || "").trim(),
            issue_type: String(row?.issue_type || "").trim().toLowerCase(),
            lat: Number(row?.lat),
            lng: Number(row?.lng),
            nearest_address: String(row?.nearest_address || "").trim(),
            nearest_cross_street: String(row?.nearest_cross_street || "").trim(),
            nearest_landmark: String(row?.nearest_landmark || "").trim(),
            geo_updated_at: row?.geo_updated_at || null,
            updated_at: row?.updated_at || null,
          },
        }));
      })
      .subscribe();

    const utilityStatusChannel = (isAdmin || viewerUserId) ? supabase
      .channel("realtime-utility-report-status")
      .on("postgres_changes", { event: "*", schema: "public", table: "utility_report_status" }, () => {
        scheduleUtilityStatusRefresh();
      })
      .subscribe() : null;

    const incidentStateChannel = supabase
      .channel("realtime-incident-state-current")
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_state_current" }, (payload) => {
        const row = payload?.new;
        const oldRow = payload?.old;
        const eventType = String(payload?.eventType || "").toUpperCase();
        const incidentId = String((eventType === "DELETE" ? oldRow?.incident_id : row?.incident_id) || "").trim();
        const stateLower = String(row?.state || "").trim().toLowerCase();
        const changedAtIso = String(row?.last_changed_at || "").trim();
        const changedAtTs = Date.parse(changedAtIso) || 0;

        setIncidentStateByKey((prev) => {
          const next = { ...(prev || {}) };
          const newKey = incidentSnapshotKey(row?.domain, row?.incident_id);
          const oldKey = incidentSnapshotKey(oldRow?.domain, oldRow?.incident_id);
          if (eventType === "DELETE") {
            if (oldKey) delete next[oldKey];
            return next;
          }
          if (oldKey && oldKey !== newKey) delete next[oldKey];
          if (newKey) {
            next[newKey] = {
              state: String(row?.state || "").trim(),
              last_changed_at: row?.last_changed_at || null,
            };
          }
          return next;
        });

        if (incidentId) {
          setLastFixByLightId((prev) => {
            const next = { ...(prev || {}) };
            const prevTs = Number(next[incidentId] || 0);
            if (eventType === "DELETE") return next;
            if (stateLower === "fixed" || stateLower === "archived") {
              if (!changedAtTs || changedAtTs >= prevTs) {
                next[incidentId] = changedAtTs || Date.now();
              }
              return next;
            }
            if (
              stateLower === "reported"
              || stateLower === "reopened"
              || stateLower === "confirmed"
            ) {
              if (Object.prototype.hasOwnProperty.call(next, incidentId)) {
                delete next[incidentId];
              }
              return next;
            }
            return next;
          });
        }
      })
      .subscribe();


    return () => {
      if (utilityRefreshTimer) clearTimeout(utilityRefreshTimer);
      if (reportsChannel) supabase.removeChannel(reportsChannel);
      if (fixedChannel) supabase.removeChannel(fixedChannel);
      if (actionsChannel) supabase.removeChannel(actionsChannel);
      if (officialChannel) supabase.removeChannel(officialChannel);
      if (potholesChannel) supabase.removeChannel(potholesChannel);
      if (potholeReportsChannel) supabase.removeChannel(potholeReportsChannel);
      if (waterDrainIncidentsChannel) supabase.removeChannel(waterDrainIncidentsChannel);
      if (utilityStatusChannel) supabase.removeChannel(utilityStatusChannel);
      if (incidentStateChannel) supabase.removeChannel(incidentStateChannel);
    };
  }, [isAdmin, session?.user?.id, domainForIncidentId]);

  // Build a fast lookup of official IDs
  const officialIdSet = useMemo(() => new Set(officialLights.map((o) => o.id)), [officialLights]);
  const officialSignIdSet = useMemo(() => new Set((officialSigns || []).map((s) => String(s?.id || "").trim()).filter(Boolean)), [officialSigns]);


  const slIdByUuid = useMemo(() => {
    const m = new Map();
    for (const l of officialLights || []) {
      const uuid = (l.id || "").trim();
      const sl = (l.sl_id || "").trim();
      if (uuid && sl) m.set(uuid, sl);
    }
    return m;
  }, [officialLights]);

  const openReportOfficialIdSet = useMemo(() => {
    const out = new Set();
    for (const r of reports || []) {
      if (!isOutageReportType(r)) continue;
      const lightId = (r.light_id || "").trim();
      if (!lightId || !officialIdSet.has(lightId)) continue;
      const lastFixTs = Math.max(lastFixByLightId?.[lightId] || 0, fixedLights?.[lightId] || 0);
      if (lastFixTs && (r.ts || 0) <= lastFixTs) continue;
      out.add(lightId);
    }
    return out;
  }, [reports, officialIdSet, fixedLights, lastFixByLightId]);

  const isStreetlightsDomain = adminReportDomain === "streetlights";
  const isStreetSignsDomain = adminReportDomain === "street_signs";
  const isPotholesDomain = adminReportDomain === "potholes";
  const isWaterDrainDomain = adminReportDomain === "water_drain_issues";
  const isAssetReportingDomain = isStreetlightsDomain || isStreetSignsDomain;
  const isAggregatedReportingDomain = !isAssetReportingDomain;
  const canUseStreetlightBulk = isStreetlightsDomain;
  const mappingUnitLabel = isStreetSignsDomain ? "Sign" : "Light";
  const cityLimitPolygons = useMemo(
    () => extractPolygonsFromGeoJson(cityBoundaryGeojson),
    [cityBoundaryGeojson]
  );
  const cityBoundaryViewport = useMemo(
    () => boundaryViewportFromPolygons(cityLimitPolygons),
    [cityLimitPolygons]
  );
  const cityBoundaryOuterRings = useMemo(
    () => (cityLimitPolygons || []).map((poly) => poly?.[0]).filter((ring) => Array.isArray(ring) && ring.length >= 3),
    [cityLimitPolygons]
  );
  const cityOutsideMaskPaths = useMemo(() => {
    if (!cityBoundaryOuterRings.length) return [];
    const outerRing = buildWorldMaskRing();
    const holeRings = cityBoundaryOuterRings
      .map((ring) => orientRing(ring, "counterclockwise"))
      .filter((ring) => ring.length >= 3);
    return [outerRing, ...holeRings];
  }, [cityBoundaryOuterRings]);
  const showCityBoundaryBorder = tenantMapFeatures?.show_boundary_border !== false;
  const showCityOutsideShade = tenantMapFeatures?.shade_outside_boundary !== false;
  const hasMapSession = Boolean(session?.user?.id);
  const showMapAlertIcon = hasMapSession && tenantMapFeatures?.show_alert_icon !== false;
  const showMapEventIcon = hasMapSession && tenantMapFeatures?.show_event_icon !== false;
  const cityOutsideShadeOpacity = Number.isFinite(Number(tenantMapFeatures?.outside_shade_opacity))
    ? Math.max(0, Math.min(1, Number(tenantMapFeatures.outside_shade_opacity)))
    : 0.42;
  const cityBoundaryBorderColor = /^#[0-9a-fA-F]{6}$/.test(String(tenantMapFeatures?.boundary_border_color || "").trim())
    ? String(tenantMapFeatures?.boundary_border_color || "").trim().toLowerCase()
    : "#e53935";
  const cityBoundaryBorderWidth = Number.isFinite(Number(tenantMapFeatures?.boundary_border_width))
    ? Math.max(0.5, Math.min(8, Number(tenantMapFeatures?.boundary_border_width)))
    : 4;
  const restrictPublicMarkersToCity = !isAdmin && cityLimitPolygons.length > 0;
  const isWithinAshtabulaCityLimits = useCallback(
    (lat, lng) => isPointInPolygons(Number(lat), Number(lng), cityLimitPolygons),
    [cityLimitPolygons]
  );

  useEffect(() => {
    if (!showMapAlertIcon) setAlertsWindowOpen(false);
  }, [showMapAlertIcon]);

  useEffect(() => {
    if (!showMapEventIcon) setEventsWindowOpen(false);
  }, [showMapEventIcon]);

  useEffect(() => {
    if (!cityBoundaryViewport) {
      boundaryCameraSignatureRef.current = "";
      return;
    }

    const map = mapRef.current;
    const tenantKey = activeTenantKey();
    const signature = [
      tenantKey,
      cityBoundaryViewport.north.toFixed(6),
      cityBoundaryViewport.south.toFixed(6),
      cityBoundaryViewport.east.toFixed(6),
      cityBoundaryViewport.west.toFixed(6),
    ].join("|");

    // Preserve hub fly-to deep links instead of snapping back to the tenant
    // boundary once the boundary data finishes loading.
    if (preserveReportFlyTargetCameraRef.current) {
      boundaryCameraSignatureRef.current = signature;
      return;
    }

    const nextCenter = cityBoundaryViewport.center;
    setMapCenter((prev) => {
      if (!prev) return nextCenter;
      if (Math.abs(Number(prev.lat) - Number(nextCenter.lat)) < 0.000001 && Math.abs(Number(prev.lng) - Number(nextCenter.lng)) < 0.000001) {
        return prev;
      }
      return nextCenter;
    });

    if (!map) return;
    if (boundaryCameraSignatureRef.current === signature) return;
    if (!window?.google?.maps?.LatLngBounds) return;

    try {
      const bounds = new window.google.maps.LatLngBounds(
        { lat: cityBoundaryViewport.south, lng: cityBoundaryViewport.west },
        { lat: cityBoundaryViewport.north, lng: cityBoundaryViewport.east }
      );
      map.fitBounds(bounds, 42);
      boundaryCameraSignatureRef.current = signature;
      window.requestAnimationFrame(() => {
        const c = map.getCenter?.();
        const z = Number(map.getZoom?.());
        const lat = Number(c?.lat?.());
        const lng = Number(c?.lng?.());
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setMapCenter({ lat, lng });
        }
        if (Number.isFinite(z)) {
          mapZoomRef.current = z;
          setMapZoom(Math.round(z));
        }
      });
    } catch (err) {
      console.warn("[boundary camera] fitBounds failed:", err?.message || err);
    }
  }, [cityBoundaryViewport, gmapsRef]);

  const selectedDomainReports = useMemo(() => {
    if (isPotholesDomain) return potholeReports;
    const all = Array.isArray(reports) ? reports : [];
    return all.filter((r) => reportDomainForRow(r, officialIdSet, officialSignIdSet) === adminReportDomain);
  }, [isPotholesDomain, potholeReports, reports, officialIdSet, officialSignIdSet, adminReportDomain]);

  const potholeLastFixById = useMemo(() => {
    const out = {};

    // Source 1: action history (when available)
    const byId = actionsByLightId || {};
    for (const [lid, acts] of Object.entries(byId)) {
      if (!String(lid || "").startsWith("pothole:")) continue;
      const pid = String(lid).slice("pothole:".length).trim();
      if (!pid) continue;
      for (const a of acts || []) {
        if (String(a?.action || "").toLowerCase() !== "fix") continue;
        const ts = Number(a?.ts || 0);
        if (!Number.isFinite(ts) || ts <= 0) continue;
        if (!out[pid] || ts > out[pid]) out[pid] = ts;
      }
    }

    // Source 2: lifecycle snapshot (works for public clients without action feed)
    for (const [key, snap] of Object.entries(incidentStateByKey || {})) {
      const keyStr = String(key || "");
      const sep = keyStr.indexOf(":");
      if (sep < 0) continue;
      const incidentId = keyStr.slice(sep + 1).trim();
      if (!incidentId.startsWith("pothole:")) continue;
      const state = String(snap?.state || "").trim().toLowerCase();
      if (!(state === "fixed" || state === "archived")) continue;
      const pid = incidentId.slice("pothole:".length).trim();
      if (!pid) continue;
      const ts = Date.parse(String(snap?.last_changed_at || "")) || 0;
      if (!ts) continue;
      if (!out[pid] || ts > out[pid]) out[pid] = ts;
    }

    return out;
  }, [actionsByLightId, incidentStateByKey]);

  const renderedOfficialLights = useMemo(() => {
    if (!isStreetlightsDomain) return [];
    const base = (Array.isArray(officialLights) ? officialLights : []).map(normalizeOfficialLightRow).filter(Boolean);
    const cityFiltered = restrictPublicMarkersToCity
      ? base.filter((l) => isWithinAshtabulaCityLimits(l.lat, l.lng))
      : base;
    // In mapping mode, always show full official asset layer so existing lights are never hidden.
    if (mappingMode) return cityFiltered;
    if (!(isAdmin && openReportMapFilterOn)) return cityFiltered;
    return cityFiltered.filter((l) => openReportOfficialIdSet.has((l.id || "").trim()));
  }, [
    officialLights,
    isStreetlightsDomain,
    isAdmin,
    mappingMode,
    openReportMapFilterOn,
    openReportOfficialIdSet,
    restrictPublicMarkersToCity,
    isWithinAshtabulaCityLimits,
  ]);

  const deleteCircleCandidateIds = useMemo(() => {
    if (!deleteCircleDraft?.center) return [];
    const centerLat = Number(deleteCircleDraft.center.lat);
    const centerLng = Number(deleteCircleDraft.center.lng);
    const radius = Number(deleteCircleDraft.radiusMeters || 0);
    if (!isValidLatLng(centerLat, centerLng) || !Number.isFinite(radius) || radius <= 0) return [];
    const ids = [];
    if (isStreetlightsDomain) {
      for (const row of officialLights || []) {
        const light = normalizeOfficialLightRow(row);
        if (!light) continue;
        const lid = String(light.id || "").trim();
        if (!lid || !openReportOfficialIdSet.has(lid)) continue;
        const dist = metersBetween(
          { lat: centerLat, lng: centerLng },
          { lat: Number(light.lat), lng: Number(light.lng) }
        );
        if (dist <= radius) ids.push(lid);
      }
      return ids.filter(Boolean);
    }
    if (isPotholesDomain) {
      for (const p of potholes || []) {
        const pid = String(p?.id || "").trim();
        const lat = Number(p?.lat);
        const lng = Number(p?.lng);
        if (!pid || !isValidLatLng(lat, lng)) continue;
        const lastFixTs = Number(potholeLastFixById?.[pid] || 0);
        const openCount = (potholeReports || []).filter((r) => String(r?.pothole_id || "").trim() === pid && Number(r?.ts || 0) > lastFixTs).length;
        if (openCount <= 0) continue;
        const dist = metersBetween({ lat: centerLat, lng: centerLng }, { lat, lng });
        if (dist <= radius) ids.push(`pothole:${pid}`);
      }
      return Array.from(new Set(ids.filter(Boolean)));
    }
    if (isWaterDrainDomain || isStreetSignsDomain) {
      const byIncident = new Map();
      for (const r of selectedDomainReports || []) {
        const incidentId = String(r?.light_id || "").trim();
        const lat = Number(r?.lat);
        const lng = Number(r?.lng);
        if (!incidentId || !isValidLatLng(lat, lng)) continue;
        const prev = byIncident.get(incidentId);
        const ts = Number(r?.ts || 0);
        if (!prev || ts > Number(prev?.ts || 0)) {
          byIncident.set(incidentId, { incidentId, lat, lng, ts });
        }
      }
      for (const x of byIncident.values()) {
        const dist = metersBetween({ lat: centerLat, lng: centerLng }, { lat: Number(x.lat), lng: Number(x.lng) });
        if (dist <= radius) ids.push(String(x.incidentId || "").trim());
      }
      return Array.from(new Set(ids.filter(Boolean)));
    }
    return Array.from(new Set(ids.filter(Boolean)));
  }, [
    deleteCircleDraft,
    isStreetlightsDomain,
    isPotholesDomain,
    isWaterDrainDomain,
    isStreetSignsDomain,
    officialLights,
    openReportOfficialIdSet,
    potholes,
    potholeReports,
    potholeLastFixById,
    selectedDomainReports,
  ]);

  const nonStreetlightDomainMarkers = useMemo(() => {
    if (isStreetlightsDomain) return [];
    if (isPotholesDomain) {
      const byId = new Map();
      for (const p of potholes || []) {
        if (!p?.id || !isValidLatLng(Number(p.lat), Number(p.lng))) continue;
        byId.set(p.id, {
          id: String(p.ph_id || "").trim() || makePotholeIdFromCoords(Number(p.lat), Number(p.lng)),
          pothole_id: p.id,
          lat: Number(p.lat),
          lng: Number(p.lng),
          count: 0,
          lastTs: 0,
          lastFixTs: Number(potholeLastFixById?.[String(p.id).trim()] || 0),
          location_label: p.location_label || "",
        });
      }
      for (const r of potholeReports || []) {
        const pid = (r.pothole_id || "").trim();
        if (!pid) continue;
        const m = byId.get(pid);
        if (!m) continue;
        const lastFixTs = Number(m.lastFixTs || 0);
        const ts = Number(r.ts || 0);
        if (lastFixTs && ts <= lastFixTs) continue;
        m.count += 1;
        if (ts > m.lastTs) m.lastTs = ts;
      }
      return Array.from(byId.values()).sort((a, b) => (b.count - a.count) || (b.lastTs - a.lastTs));
    }
    if (isStreetSignsDomain) {
      const byId = new Map();
      for (const s of officialSigns || []) {
        const id = String(s?.id || "").trim();
        if (!id || !isValidLatLng(Number(s?.lat), Number(s?.lng))) continue;
        const lastFixTs = Math.max(Number(lastFixByLightId?.[id] || 0), Number(fixedLights?.[id] || 0));
        byId.set(id, {
          id,
          sign_type: String(s?.sign_type || "other").trim().toLowerCase() || "other",
          lat: Number(s.lat),
          lng: Number(s.lng),
          count: 0,
          lastTs: 0,
          lastFixTs,
        });
      }
      for (const r of selectedDomainReports || []) {
        const lid = String(r?.light_id || "").trim();
        const marker = byId.get(lid);
        if (!marker) continue;
        const ts = Number(r?.ts || 0);
        const lastFixTs = Number(marker.lastFixTs || 0);
        if (lastFixTs && ts <= lastFixTs) continue;
        marker.count += 1;
        if (ts > marker.lastTs) marker.lastTs = ts;
      }
      return Array.from(byId.values())
        .sort((a, b) => (b.count - a.count) || (b.lastTs - a.lastTs));
    }
    if (isWaterDrainDomain) {
      const clustered = groupIntoLights(
        (selectedDomainReports || [])
          .filter((r) => isValidLatLng(Number(r?.lat), Number(r?.lng)))
          .map((r) => ({
            ...r,
            lat: Number(r.lat),
            lng: Number(r.lng),
            light_id: String(r?.light_id || "").trim() || lightIdFor(Number(r.lat), Number(r.lng)),
          }))
      );
      return clustered
        .map((c) => {
          const fallbackIncidentId = String(c?.lightId || lightIdFor(Number(c?.lat || 0), Number(c?.lng || 0))).trim();
          const allRows = [...(c?.reports || [])].sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
          const incidentIds = collectIncidentIdsFromRows(allRows, fallbackIncidentId);
          const canonicalIncidentId = canonicalWaterDrainIncidentIdFromRows(allRows, fallbackIncidentId);
          const maxLastFixTs = incidentIds.reduce(
            (max, incidentId) => Math.max(max, Number(lastFixByLightId?.[String(incidentId || "").trim()] || 0)),
            0
          );
          const rows = allRows.filter((r) => {
            const rowIncidentId = String(r?.light_id || canonicalIncidentId).trim();
            const fixTs = Number(lastFixByLightId?.[rowIncidentId] || 0);
            return Number(r?.ts || 0) > fixTs;
          });
          return {
            id: canonicalIncidentId || fallbackIncidentId,
            incident_ids: incidentIds,
            display_id: makeWaterDrainIdFromIncidentId(canonicalIncidentId || fallbackIncidentId),
            lat: Number(c?.lat),
            lng: Number(c?.lng),
            count: rows.length,
            lastTs: Number(rows?.[0]?.ts || 0),
            location_label: readLocationFromNote(rows?.[0]?.note) || "",
            rows,
            lastFixTs: maxLastFixTs,
          };
        })
        .filter((x) => isValidLatLng(Number(x?.lat), Number(x?.lng)) && Number(x?.count || 0) > 0)
        .sort((a, b) => (b.count - a.count) || (b.lastTs - a.lastTs));
    }
    const byLight = new Map();
    for (const r of selectedDomainReports) {
      const lat = Number(r.lat);
      const lng = Number(r.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const lid = String(r.light_id || `${lat.toFixed(5)}:${lng.toFixed(5)}`).trim();
      const prev = byLight.get(lid);
      if (!prev) {
        byLight.set(lid, { id: lid, lat, lng, count: 1, lastTs: Number(r.ts || 0) || 0 });
      } else {
        prev.count += 1;
        if (Number(r.ts || 0) > prev.lastTs) prev.lastTs = Number(r.ts || 0);
      }
    }
    return Array.from(byLight.values());
  }, [isStreetlightsDomain, isPotholesDomain, isStreetSignsDomain, isWaterDrainDomain, potholes, potholeReports, selectedDomainReports, potholeLastFixById, officialSigns, lastFixByLightId, fixedLights]);

  const viewerIdentityKey = useMemo(
    () => reporterIdentityKey({ session, profile, guestInfo }),
    [session?.user?.id, guestInfo?.email, guestInfo?.phone, guestInfo?.name]
  );
  const viewerSavedStreetlightLightIdSet = useMemo(() => {
    const out = new Set();
    if (!viewerIdentityKey) return out;

    for (const r of reports || []) {
      if (!isOutageReportType(r)) continue;
      const lid = (r.light_id || "").trim();
      if (!lid || !officialIdSet.has(lid)) continue;
      if (reportIdentityKey(r) === viewerIdentityKey) out.add(lid);
    }

    return out;
  }, [viewerIdentityKey, reports, officialIdSet]);

  const viewerUtilityReportedLightIdSet = useMemo(() => {
    const out = new Set();
    if (!viewerIdentityKey) return out;
    for (const lid of utilityReportedLightIdSet || []) {
      const id = String(lid || "").trim();
      if (!id || !officialIdSet.has(id)) continue;
      out.add(id);
    }
    return out;
  }, [viewerIdentityKey, utilityReportedLightIdSet, officialIdSet]);

  const refreshIncidentRepairProgress = useCallback(async (identityKey = viewerIdentityKey) => {
    try {
      const { data, error } = await supabase.rpc("incident_repair_progress_public", {
        p_viewer_identity_hash: String(identityKey || "").trim() || null,
      });
      if (error) throw error;
      const next = {};
      for (const row of data || []) {
        const key = incidentSnapshotKey(row?.domain, row?.incident_id);
        if (!key) continue;
        next[key] = {
          issueScore: Number(row?.issue_score || 0),
          repairProgress: Math.max(0, Math.min(INCIDENT_REPAIR_TARGET, Number(row?.repair_progress || 0))),
          lastIssueAt: row?.last_issue_at || null,
          lastRepairAt: row?.last_repair_at || null,
          lastMovementAt: row?.last_movement_at || null,
          archived: row?.archived === true,
          likelyFixed: row?.likely_fixed === true,
          viewerIsOriginalReporter: row?.viewer_is_original_reporter === true,
          viewerHasIssueReport: row?.viewer_has_issue_report === true,
          viewerHasRepairSignal: row?.viewer_has_repair_signal === true,
        };
      }
      setIncidentRepairProgressByKey(next);
    } catch (e) {
      const msg = String(e?.message || "").toLowerCase();
      if (!(msg.includes("does not exist") || msg.includes("function") || msg.includes("schema cache"))) {
        console.warn("[incident_repair_progress_public] load warning:", e?.message || e);
      }
      setIncidentRepairProgressByKey({});
    }
  }, [viewerIdentityKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadDomainPublicConfig() {
      try {
        const rows = await fetchTenantDomainPublicConfig();
        if (cancelled) return;
        const next = {};
        for (const row of rows || []) {
          const domainKey = String(row?.domain || "").trim().toLowerCase();
          if (!domainKey) continue;
          next[domainKey] = {
            domain_type: String(row?.domain_type || "").trim().toLowerCase() || defaultDomainType(domainKey),
            organization_monitored_repairs: row?.organization_monitored_repairs !== false,
          };
        }
        setTenantDomainPublicConfigByDomain(next);
      } catch (e) {
        const msg = String(e?.message || "").toLowerCase();
        if (!(msg.includes("does not exist") || msg.includes("function") || msg.includes("schema cache"))) {
          console.warn("[tenant_domain_public_config] load warning:", e?.message || e);
        }
        if (!cancelled) setTenantDomainPublicConfigByDomain({});
      }
    }
    loadDomainPublicConfig();
    return () => {
      cancelled = true;
    };
  }, [authReady]);

  useEffect(() => {
    if (!authReady) return;
    void refreshIncidentRepairProgress(viewerIdentityKey);
  }, [authReady, viewerIdentityKey, refreshIncidentRepairProgress]);

  useEffect(() => {
    if (!authReady) return undefined;
    const channel = supabase
      .channel("realtime-incident-repair-signals")
      .on("postgres_changes", { event: "*", schema: "public", table: "incident_repair_signals" }, () => {
        void refreshIncidentRepairProgress(viewerIdentityKey);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authReady, viewerIdentityKey, refreshIncidentRepairProgress]);

  const getIncidentRepairSnapshot = useCallback((domain, incidentId) => {
    const key = incidentSnapshotKey(domain, incidentId);
    if (!key) return null;
    return incidentRepairProgressByKey?.[key] || null;
  }, [incidentRepairProgressByKey]);

  const isPublicRepairEnabledForDomain = useCallback((domainKeyRaw) => {
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    if (!domainKey) return false;
    const cfg = tenantDomainPublicConfigByDomain?.[domainKey] || null;
    const domainType = String(cfg?.domain_type || defaultDomainType(domainKey)).trim().toLowerCase();
    if (domainType !== "incident_driven") return false;
    return cfg?.organization_monitored_repairs === false;
  }, [tenantDomainPublicConfigByDomain]);

  const canShowPublicRepairAction = useCallback((incidentIdRaw, domainKeyRaw) => {
    const incidentId = String(incidentIdRaw || "").trim();
    const domainKey = String(domainKeyRaw || "").trim().toLowerCase();
    if (!incidentId || !domainKey) return false;
    if (!isPublicRepairEnabledForDomain(domainKey)) return false;
    const snapshot = getIncidentRepairSnapshot(domainKey, incidentId);
    if (snapshot?.archived) return false;
    if (snapshot?.likelyFixed) return false;
    if (snapshot?.viewerHasRepairSignal) return false;
    return true;
  }, [isPublicRepairEnabledForDomain, getIncidentRepairSnapshot]);

  const streetlightConfidenceByLightId = useMemo(() => {
    const byLight = {};
    const signalMap = new Map();
    const lightIds = new Set();

    for (const light of officialLights || []) {
      const lid = String(light?.id || "").trim();
      if (lid) lightIds.add(lid);
    }

    for (const row of reports || []) {
      const lid = String(row?.light_id || "").trim();
      if (!lid || !officialIdSet.has(lid)) continue;
      lightIds.add(lid);
      const lastFixTs = Math.max(Number(lastFixByLightId?.[lid] || 0), Number(fixedLights?.[lid] || 0));
      const ts = Number(row?.ts || 0);
      if (lastFixTs && ts <= lastFixTs) continue;
      const reporterKey = String(reportIdentityKey(row) || `report:${row?.id || ts}`).trim();
      const current = signalMap.get(lid) || { outageSignals: [], workingSignals: [] };
      if (isWorkingReportType(row)) {
        current.workingSignals.push({ reporterKey, ts });
      } else if (isOutageReportType(row)) {
        current.outageSignals.push({ reporterKey, ts });
      }
      signalMap.set(lid, current);
    }

    for (const lid of Object.keys(utilitySignalCountsByLightId || {})) {
      if (String(lid || "").trim()) lightIds.add(String(lid || "").trim());
    }

    for (const lid of lightIds) {
      const signals = signalMap.get(lid) || { outageSignals: [], workingSignals: [] };
      const utility = utilitySignalCountsByLightId?.[lid] || {};
      byLight[lid] = computeStreetlightConfidenceSnapshot({
        outageSignals: signals.outageSignals,
        workingSignals: signals.workingSignals,
        utilityReportedCount: Number(utility?.reportedCount || 0),
        utilityReferenceCount: Number(utility?.referenceCount || 0),
        utilityLastTs: Number(utility?.latestReportedTs || 0),
        viewerIdentityKey,
        viewerHasSaved: viewerSavedStreetlightLightIdSet.has(lid),
        viewerUtilityReported: viewerUtilityReportedLightIdSet.has(lid),
        rolloutStartMs: STREETLIGHT_STALENESS_ROLLOUT_START,
      });
    }

    return byLight;
  }, [
    officialLights,
    reports,
    officialIdSet,
    lastFixByLightId,
    fixedLights,
    utilitySignalCountsByLightId,
    viewerIdentityKey,
    viewerSavedStreetlightLightIdSet,
    viewerUtilityReportedLightIdSet,
  ]);

  const viewerStreetlightRingOpenIdSet = useMemo(() => {
    const openSet = new Set();
    const candidateIds = new Set([
      ...(viewerSavedStreetlightLightIdSet || []),
      ...(viewerUtilityReportedLightIdSet || []),
    ]);
    if (!candidateIds.size) return openSet;

    for (const lidRaw of candidateIds) {
      const lid = String(lidRaw || "").trim();
      if (!lid) continue;
      const confidence = streetlightConfidenceByLightId?.[lid] || null;
      if (confidence && !confidence.closed) openSet.add(lid);
    }

    return openSet;
  }, [
    viewerSavedStreetlightLightIdSet,
    viewerUtilityReportedLightIdSet,
    streetlightConfidenceByLightId,
  ]);

  const officialMarkerRingColorForViewer = useCallback((lightId) => {
    const lid = (lightId || "").trim();
    if (!lid) return "#fff";
    if (!viewerStreetlightRingOpenIdSet.has(lid)) return "#fff";
    if (viewerUtilityReportedLightIdSet.has(lid)) return "#1e88e5";
    if (viewerSavedStreetlightLightIdSet.has(lid)) return "#2ecc71";
    return "#fff";
  }, [viewerStreetlightRingOpenIdSet, viewerUtilityReportedLightIdSet, viewerSavedStreetlightLightIdSet]);

  const viewerReportedPotholeIdSet = useMemo(() => {
    const out = new Set();
    if (!viewerIdentityKey) return out;
    for (const r of potholeReports || []) {
      const pid = String(r?.pothole_id || "").trim();
      if (!pid) continue;
      if (reportIdentityKey(r) === viewerIdentityKey) out.add(pid);
    }
    return out;
  }, [viewerIdentityKey, potholeReports]);

  const viewerReportedWaterIncidentIdSet = useMemo(() => {
    const out = new Set();
    if (!viewerIdentityKey) return out;
    if (!isWaterDrainDomain) return out;
    for (const m of nonStreetlightDomainMarkers || []) {
      const incidentId = String(m?.id || "").trim();
      if (!incidentId) continue;
      const rows = Array.isArray(m?.rows) ? m.rows : [];
      if (rows.some((r) => reportIdentityKey(r) === viewerIdentityKey)) out.add(incidentId);
    }
    return out;
  }, [viewerIdentityKey, isWaterDrainDomain, nonStreetlightDomainMarkers]);

  const renderedDomainMarkers = useMemo(() => {
    if (isStreetSignsDomain) {
      const adminView = Boolean(isAdmin);
      const shaped = (nonStreetlightDomainMarkers || [])
        .map((m) => {
          const count = Number(m?.count || 0);
          if (!adminView && count < 1) return null;
          return {
            ...m,
            color: officialStatusFromSinceFixCount(count).color,
            ringColor: "#fff",
            glyph: signMarkerGlyphForType(m?.sign_type),
            glyphSrc: signMarkerIconSrcForType(m?.sign_type),
          };
        })
        .filter(Boolean)
        .sort((a, b) => (Number(b.count || 0) - Number(a.count || 0)) || (Number(b.lastTs || 0) - Number(a.lastTs || 0)));
      if (!restrictPublicMarkersToCity) return shaped;
      return shaped.filter((m) => isWithinAshtabulaCityLimits(m?.lat, m?.lng));
    }

    if (isWaterDrainDomain) {
      const isLoggedIn = Boolean(session?.user?.id);
      const adminView = Boolean(isAdmin);
      const shaped = (nonStreetlightDomainMarkers || [])
        .map((m) => {
          const count = Number(m?.count || 0);
          const incidentId = String(m?.id || "").trim();
          const repairSnapshot = getIncidentRepairSnapshot("water_drain_issues", incidentId);
          if (repairSnapshot?.archived) return null;
          const userReported = incidentId ? viewerReportedWaterIncidentIdSet.has(incidentId) : false;
          const resolvedByCommunity = repairSnapshot?.likelyFixed === true;
          if (adminView) {
            if (count < 1) return null;
            return {
              ...m,
              color: resolvedByCommunity ? "var(--sl-ui-brand-green)" : waterDrainColorFromCount(count),
              ringColor: userReported ? "#1e88e5" : "#fff",
              glyph: "",
              glyphSrc: UI_ICON_SRC.waterMain,
            };
          }
          const isPublic = count >= 2;
          const isPrivateOwn = isLoggedIn && userReported && count === 1;
          if (!isPublic && !isPrivateOwn) return null;
          const privateOwnYellow = officialStatusFromSinceFixCount(1).color;
          return {
            ...m,
            color: resolvedByCommunity
              ? "var(--sl-ui-brand-green)"
              : (isPrivateOwn ? privateOwnYellow : waterDrainColorFromCount(count)),
            ringColor: userReported ? "#1e88e5" : "#fff",
            glyph: "",
            glyphSrc: UI_ICON_SRC.waterMain,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (Number(b.count || 0) - Number(a.count || 0)) || (Number(b.lastTs || 0) - Number(a.lastTs || 0)));
      if (!restrictPublicMarkersToCity) return shaped;
      return shaped.filter((m) => isWithinAshtabulaCityLimits(m?.lat, m?.lng));
    }

    if (!isPotholesDomain) {
      const base = Array.isArray(nonStreetlightDomainMarkers) ? nonStreetlightDomainMarkers : [];
      if (!restrictPublicMarkersToCity) return base;
      return base.filter((m) => isWithinAshtabulaCityLimits(m?.lat, m?.lng));
    }
    const isLoggedIn = Boolean(session?.user?.id);
    const adminView = Boolean(isAdmin);
    const shaped = (nonStreetlightDomainMarkers || [])
      .map((m) => {
        const pid = String(m?.pothole_id || "").trim();
        const count = Number(m?.count || 0);
        const incidentId = pid ? `pothole:${pid}` : "";
        const repairSnapshot = getIncidentRepairSnapshot("potholes", incidentId);
        if (repairSnapshot?.archived) return null;
        const userReported = pid ? viewerReportedPotholeIdSet.has(pid) : false;
        const resolvedByCommunity = repairSnapshot?.likelyFixed === true;
        if (adminView) {
          if (count < 1) return null;
          return {
            ...m,
            color: resolvedByCommunity ? "var(--sl-ui-brand-green)" : potholeColorFromCount(count),
            ringColor: userReported ? "#1e88e5" : "#fff",
            glyph: "",
            glyphSrc: UI_ICON_SRC.pothole,
          };
        }
        const isPublic = count >= 2;
        const isPrivateOwn = isLoggedIn && userReported && count === 1;
        if (!isPublic && !isPrivateOwn) return null;
        return {
          ...m,
          color: resolvedByCommunity ? "var(--sl-ui-brand-green)" : potholeColorFromCount(count),
          ringColor: userReported ? "#1e88e5" : "#fff",
          glyph: "",
          glyphSrc: UI_ICON_SRC.pothole,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (Number(b.count || 0) - Number(a.count || 0)) || (Number(b.lastTs || 0) - Number(a.lastTs || 0)));
    if (!restrictPublicMarkersToCity) return shaped;
    return shaped.filter((m) => isWithinAshtabulaCityLimits(m?.lat, m?.lng));
  }, [
    isStreetSignsDomain,
    isWaterDrainDomain,
    isPotholesDomain,
    nonStreetlightDomainMarkers,
    viewerReportedWaterIncidentIdSet,
    viewerReportedPotholeIdSet,
    getIncidentRepairSnapshot,
    session?.user?.id,
    isAdmin,
    restrictPublicMarkersToCity,
    isWithinAshtabulaCityLimits,
  ]);

  const selectedOfficialLightForPopup = useMemo(() => {
    if (bulkMode || !isStreetlightsDomain) return null;
    const id = (selectedOfficialId || "").trim();
    if (!id) return null;
    return (officialLights || []).find((x) => (x.id || "").trim() === id) || null;
  }, [bulkMode, isStreetlightsDomain, selectedOfficialId, officialLights]);

  const selectedOfficialPopupPixel = useMemo(() => {
    const ol = selectedOfficialLightForPopup;
    if (!ol) return null;
    return officialCanvasOverlayRef.current?.projectLatLngToContainerPixel?.(ol.lat, ol.lng) || null;
  }, [selectedOfficialLightForPopup, mapCenter, mapZoom, mapInteracting]);

  useEffect(() => {
    setStreetlightLocationInfoOpen(false);
  }, [selectedOfficialLightForPopup?.id]);

  useEffect(() => {
    const selected = selectedOfficialLightForPopup;
    if (!(isStreetlightsDomain && selected)) {
      setStreetlightUtilityContext({
        lightId: "",
        loading: false,
        nearestAddress: "",
        nearestStreet: "",
        nearestCrossStreet: "",
        nearestIntersection: "",
        nearestLandmark: "",
      });
      return;
    }

    const lid = String(selected?.id || "").trim();
    setStreetlightUtilityContext({
      lightId: lid,
      loading: false,
      nearestAddress: String(selected?.nearest_address || "").trim() || "Address unavailable",
      nearestStreet: "",
      nearestCrossStreet: String(selected?.nearest_cross_street || "").trim(),
      nearestIntersection: "",
      nearestLandmark: String(selected?.nearest_landmark || "").trim(),
    });
  }, [
    isStreetlightsDomain,
    selectedOfficialLightForPopup?.id,
    selectedOfficialLightForPopup?.nearest_address,
    selectedOfficialLightForPopup?.nearest_cross_street,
    selectedOfficialLightForPopup?.nearest_landmark,
  ]);

  const streetlightLocationRows = useMemo(() => {
    const coords = selectedOfficialLightForPopup
      ? { lat: selectedOfficialLightForPopup.lat, lng: selectedOfficialLightForPopup.lng }
      : null;
    return buildStreetlightUtilityRows(streetlightUtilityContext, coords);
  }, [streetlightUtilityContext, selectedOfficialLightForPopup?.lat, selectedOfficialLightForPopup?.lng]);

  const ensureStreetlightLocationInfoForPopup = useCallback(async (light) => {
    const lid = String(light?.id || "").trim();
    const lat = Number(light?.lat);
    const lng = Number(light?.lng);
    if (!lid || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const fromDb = (officialLights || []).find((x) => String(x?.id || "").trim() === lid) || light;
    const existingAddress = String(fromDb?.nearest_address || "").trim();
    const existingCrossStreet = String(fromDb?.nearest_cross_street || "").trim();
    const existingLandmark = String(fromDb?.nearest_landmark || "").trim();
    const hasCachedGeo = Boolean(existingAddress && existingCrossStreet && existingLandmark);

    if (hasCachedGeo) {
      setStreetlightUtilityContext((prev) => ({
        ...prev,
        lightId: lid,
        loading: false,
        nearestAddress: existingAddress || prev.nearestAddress || "Address unavailable",
        nearestCrossStreet: existingCrossStreet || prev.nearestCrossStreet || "",
        nearestLandmark: existingLandmark || prev.nearestLandmark || "",
      }));
      return;
    }

    setStreetlightUtilityContext((prev) => ({
      ...prev,
      lightId: lid,
      loading: true,
    }));

    try {
      // This is an explicit user action from the popup, so use the full lookup path.
      // The quick mode intentionally skips landmark/intersection enrichment.
      const geo = await reverseGeocodeRoadLabel(lat, lng, { mode: "full" });
      const nearestAddress = String(geo?.nearestAddress || "").trim();
      const nearestStreet = String(geo?.nearestStreet || "").trim();
      const nearestCrossStreet = String(geo?.nearestCrossStreet || "").trim();
      const nearestLandmark = String(geo?.nearestLandmark || "").trim();
      const nearestIntersection = String(geo?.nearestIntersection || "").trim();

      if (nearestAddress || nearestCrossStreet || nearestLandmark) {
        const { error: cacheErr } = await supabase.functions.invoke("cache-official-light-geo", {
          body: {
            tenant_key: activeTenantKey(),
            domain: "streetlights",
            incident_id: lid,
            light_id: lid,
            nearest_address: nearestAddress || null,
            nearest_cross_street: nearestCrossStreet || null,
            nearest_landmark: nearestLandmark || null,
          },
        });
        if (cacheErr) {
          console.warn("[cache-official-light-geo] streetlight popup cache warning:", cacheErr);
        }
        setOfficialLights((prev) => (prev || []).map((row) => {
          if (String(row?.id || "").trim() !== lid) return row;
          return {
            ...row,
            nearest_address: nearestAddress || row?.nearest_address || "",
            nearest_cross_street: nearestCrossStreet || row?.nearest_cross_street || "",
            nearest_landmark: nearestLandmark || row?.nearest_landmark || "",
          };
        }));
      }

      setStreetlightUtilityContext((prev) => ({
        ...prev,
        lightId: lid,
        loading: false,
        nearestAddress: nearestAddress || existingAddress || "Address unavailable",
        nearestStreet: nearestStreet || "",
        nearestCrossStreet: nearestCrossStreet || existingCrossStreet || "",
        nearestIntersection: nearestIntersection || "",
        nearestLandmark: nearestLandmark || existingLandmark || "",
      }));
    } catch {
      setStreetlightUtilityContext((prev) => ({ ...prev, lightId: lid, loading: false }));
    }
  }, [officialLights, reverseGeocodeRoadLabel]);

  const selectedDomainPopupPixel = useMemo(() => {
    const marker = selectedDomainMarker;
    if (!marker) return null;
    const lat = Number(marker?.lat);
    const lng = Number(marker?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return officialCanvasOverlayRef.current?.projectLatLngToContainerPixel?.(lat, lng) || null;
  }, [selectedDomainMarker, mapCenter, mapZoom, mapInteracting]);

  const selectedOfficialLifecycleSnapshot = useMemo(() => {
    if (!selectedOfficialLightForPopup) return null;
    return getIncidentSnapshot("streetlights", selectedOfficialLightForPopup.id);
  }, [selectedOfficialLightForPopup, getIncidentSnapshot]);

  const selectedStreetSignLifecycleSnapshot = useMemo(() => {
    if (!(adminReportDomain === "street_signs" && selectedDomainMarker)) return null;
    const signId = String(selectedDomainMarker?.id || "").trim();
    if (!signId) return null;
    return getIncidentSnapshot("street_signs", signId);
  }, [adminReportDomain, selectedDomainMarker, getIncidentSnapshot]);

  const selectedPotholeInfo = useMemo(() => {
    if (!(adminReportDomain === "potholes" && selectedDomainMarker)) return null;
    const pid = String(selectedDomainMarker?.pothole_id || "").trim();
    if (!pid) return null;
    const lastFixTs = Number(potholeLastFixById?.[pid] || 0);
    const rows = (potholeReports || [])
      .filter((r) => String(r?.pothole_id || "").trim() === pid)
      .filter((r) => Number(r?.ts || 0) > lastFixTs)
      .sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
    const latest = rows[0] || null;
    const addrFromNote = readAddressFromNote(latest?.note);
    const landmarkFromNote = readLandmarkFromNote(latest?.note);
    const baseLocation =
      String(selectedDomainMarker?._geoNearestAddress || "").trim() ||
      String(selectedDomainMarker?.location_label || "").trim() ||
      addrFromNote ||
      readLocationFromNote(latest?.note) ||
      (Number.isFinite(Number(selectedDomainMarker?.lat)) && Number.isFinite(Number(selectedDomainMarker?.lng))
        ? `${Number(selectedDomainMarker.lat).toFixed(5)}, ${Number(selectedDomainMarker.lng).toFixed(5)}`
        : "Location unavailable");
    const resolvedLandmark = String(selectedDomainMarker?._geoNearestLandmark || "").trim() || landmarkFromNote;
    const locationLabel =
      resolvedLandmark ? `${baseLocation} (Near: ${resolvedLandmark})` : baseLocation;
    const lifecycleSnapshot = getIncidentSnapshot("potholes", `pothole:${pid}`);
    const latestReportTs = Number(rows?.[0]?.ts || 0);
    const derivedState =
      String(lifecycleSnapshot?.state || "").trim() ||
      (rows.length > 0 ? "reported" : "");
    const derivedLastChangedAt =
      String(lifecycleSnapshot?.last_changed_at || "").trim() ||
      (latestReportTs ? new Date(latestReportTs).toISOString() : "");
    return {
      openCount: rows.length,
      locationLabel,
      currentState: derivedState,
      lastChangedAt: derivedLastChangedAt,
    };
  }, [adminReportDomain, selectedDomainMarker, potholeReports, potholeLastFixById, getIncidentSnapshot]);

  const selectedWaterDrainInfo = useMemo(() => {
    if (!(adminReportDomain === "water_drain_issues" && selectedDomainMarker)) return null;
    const markerIncidentId = String(selectedDomainMarker?.id || "").trim();
    const allRows = Array.isArray(selectedDomainMarker?.rows) ? [...selectedDomainMarker.rows] : [];
    allRows.sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
    const incidentIds = collectIncidentIdsFromRows(
      allRows,
      markerIncidentId || String(selectedDomainMarker?.incident_ids?.[0] || "").trim()
    );
    const incidentId = markerIncidentId || incidentIds[0] || "";
    const cached = waterDrainIncidentsById?.[incidentId]
      || incidentIds.map((id) => waterDrainIncidentsById?.[id]).find(Boolean)
      || null;
    const maxLastFixTs = incidentIds.reduce(
      (max, id) => Math.max(max, Number(lastFixByLightId?.[String(id || "").trim()] || 0)),
      0
    );
    const rows = allRows.filter((r) => {
      const rowIncidentId = String(r?.light_id || incidentId).trim();
      const fixTs = Number(lastFixByLightId?.[rowIncidentId] || 0);
      return Number(r?.ts || 0) > fixTs;
    });
    const latestTs = Number(rows?.[0]?.ts || selectedDomainMarker?.lastTs || 0);
    const counts = new Map();
    const latestByType = new Map();
    for (const r of rows) {
      let t = String(r?.type || r?.report_type || "").trim().toLowerCase() || "other";
      if (t === "other") {
        const fromNote = waterDrainIssueKeyFromNote(r?.note);
        if (fromNote) t = fromNote;
      }
      const ts = Number(r?.ts || 0);
      counts.set(t, (counts.get(t) || 0) + 1);
      latestByType.set(t, Math.max(Number(latestByType.get(t) || 0), ts));
    }
    let issueType = "";
    let bestCount = -1;
    let bestLatest = -1;
    for (const [typeKey, count] of counts.entries()) {
      const latest = Number(latestByType.get(typeKey) || 0);
      if (count > bestCount || (count === bestCount && latest > bestLatest)) {
        issueType = typeKey;
        bestCount = count;
        bestLatest = latest;
      }
    }
    const latest = rows?.[0] || null;
    const addrFromNote = readAddressFromNote(latest?.note);
    const landmarkFromNote = readLandmarkFromNote(latest?.note);
    const locationLabel =
      String(cached?.nearest_address || "").trim() ||
      String(selectedDomainMarker?._geoNearestAddress || "").trim() ||
      String(selectedDomainMarker?.location_label || "").trim() ||
      addrFromNote ||
      readLocationFromNote(latest?.note) ||
      (Number.isFinite(Number(selectedDomainMarker?.lat)) && Number.isFinite(Number(selectedDomainMarker?.lng))
        ? `${Number(selectedDomainMarker.lat).toFixed(5)}, ${Number(selectedDomainMarker.lng).toFixed(5)}`
        : "Location unavailable");
    const resolvedLandmark =
      String(cached?.nearest_landmark || "").trim() ||
      String(selectedDomainMarker?._geoNearestLandmark || "").trim() ||
      landmarkFromNote;
    const lifecycleSnapshot = incidentIds
      .map((id) => ({ id, snap: getIncidentSnapshot("water_drain_issues", id) }))
      .map((entry) => ({
        ...entry,
        ts: Date.parse(String(entry?.snap?.last_changed_at || "")) || 0,
      }))
      .sort((a, b) => b.ts - a.ts)
      .find((entry) => Boolean(entry?.snap))
      ?.snap || null;
    const currentState =
      String(lifecycleSnapshot?.state || "").trim() ||
      (rows.length > 0 ? "reported" : (maxLastFixTs > 0 ? "fixed" : ""));
    const lastChangedAt =
      String(lifecycleSnapshot?.last_changed_at || "").trim() ||
      (latestTs ? new Date(latestTs).toISOString() : "") ||
      (maxLastFixTs ? new Date(maxLastFixTs).toISOString() : "");
    const displayId = String(cached?.wd_id || "").trim() || makeWaterDrainIdFromIncidentId(incidentId);

    return {
      displayId,
      issueLabel: formatWaterDrainIssueLabel(String(cached?.issue_type || "").trim() || issueType),
      lastReportedTs: latestTs,
      openCount: rows.length,
      isFixedNow: rows.length <= 0 && maxLastFixTs > 0,
      locationLabel: resolvedLandmark ? `${locationLabel} (Near: ${resolvedLandmark})` : locationLabel,
      currentState,
      lastChangedAt,
      incidentId,
      incidentIds,
    };
  }, [adminReportDomain, selectedDomainMarker, lastFixByLightId, getIncidentSnapshot, waterDrainIncidentsById]);

  useEffect(() => {
    if (!isStreetlightsDomain) {
      if (selectedOfficialId) setSelectedOfficialId(null);
      return;
    }
    if (!(isAdmin && openReportMapFilterOn)) return;
    const id = (selectedOfficialId || "").trim();
    if (!id) return;
    if (!openReportOfficialIdSet.has(id)) setSelectedOfficialId(null);
  }, [isStreetlightsDomain, isAdmin, openReportMapFilterOn, selectedOfficialId, openReportOfficialIdSet]);

  useEffect(() => {
    const keep =
      adminReportDomain === "potholes" ||
      adminReportDomain === "street_signs" ||
      adminReportDomain === "water_drain_issues";
    if (!keep && selectedDomainMarker) setSelectedDomainMarker(null);
  }, [adminReportDomain, selectedDomainMarker]);

  useEffect(() => {
    if (!queueSignTypeOpen) return;
    if (!(mappingMode && isAdmin && adminReportDomain === "street_signs")) {
      setQueueSignTypeOpen(false);
      setPendingQueuedSign(null);
    }
  }, [queueSignTypeOpen, mappingMode, isAdmin, adminReportDomain]);


  const selectedQueuedLightForPopup = useMemo(() => {
    if (bulkMode || !mappingMode || !isAdmin) return null;
    const id = (selectedQueuedTempId || "").trim();
    if (!id) return null;
    return (mappingQueue || []).find((x) => (x.tempId || "").trim() === id) || null;
  }, [bulkMode, mappingMode, isAdmin, selectedQueuedTempId, mappingQueue]);

  const selectedQueuedPopupPixel = useMemo(() => {
    const q = selectedQueuedLightForPopup;
    if (!q) return null;
    return officialCanvasOverlayRef.current?.projectLatLngToContainerPixel?.(q.lat, q.lng) || null;
  }, [selectedQueuedLightForPopup, mapCenter, mapZoom, mapInteracting]);

    // ✅ Per-official-light report counts since last fix
    const reportsByOfficialId = useMemo(() => {
      const out = {}; // id -> { sinceFixCount }
      const all = Array.isArray(reports) ? reports : [];

      for (const r of all) {
        if (!isOutageReportType(r)) continue;
        const lid = (r.light_id || "").trim();
        if (!lid) continue;

        // only official lights
        if (!officialIdSet.has(lid)) continue;

        const lastFixTs = Math.max(lastFixByLightId?.[lid] || 0, fixedLights?.[lid] || 0);
        const ts = r.ts || 0;

        // only count reports after last fix (or all if never fixed)
        if (lastFixTs && ts <= lastFixTs) continue;

        if (!out[lid]) out[lid] = { sinceFixCount: 0 };
        out[lid].sinceFixCount += 1;
      }

      return out;
    }, [reports, officialIdSet, fixedLights, lastFixByLightId]);

    const openIncidentCountByOfficialId = useMemo(() => {
      const out = {};
      for (const r of reports || []) {
        const lid = String(r?.light_id || "").trim();
        if (!lid) continue;
        const isOfficial = officialIdSet.has(lid) || officialSignIdSet.has(lid);
        if (!isOfficial) continue;

        const domain = reportDomainForRow(r, officialIdSet, officialSignIdSet);
        if (domain === "streetlights" && !isOutageReportType(r)) continue;
        if (domain !== "streetlights" && normalizeReportQuality(r?.report_quality) === "good") continue;

        const lastFixTs = Math.max(Number(lastFixByLightId?.[lid] || 0), Number(fixedLights?.[lid] || 0));
        const ts = Number(r?.ts || 0);
        if (lastFixTs && ts <= lastFixTs) continue;

        out[lid] = Number(out[lid] || 0) + 1;
      }
      return out;
    }, [reports, officialIdSet, officialSignIdSet, fixedLights, lastFixByLightId]);

    // ✅ Simple status mapping based on count since last fix
  const officialMarkerColorForViewer = useCallback((lightId) => {
    const lid = (lightId || "").trim();
    if (!lid) return "#111";

    const confidence = streetlightConfidenceByLightId?.[lid] || null;
    if (!confidence) return "#111";
    if (confidence.state === "high_confidence_outage") return "#f57c00";
    if (confidence.state === "likely_outage") return "#f1c40f";
    if (confidence.state === "unconfirmed" && confidence.viewerHasOpenInterest && !confidence.viewerHasWorkingAck) {
      return "#f1c40f";
    }
    return "#111";
  }, [
    streetlightConfidenceByLightId,
  ]);

  const streetlightFilterMatchesLight = useCallback((lightIdRaw) => {
    const mode = String(streetlightInViewFilterMode || "").trim().toLowerCase();
    if (mode !== "saved" && mode !== "utility") return true;
    const lid = String(lightIdRaw || "").trim();
    if (!lid) return false;

    if (isAdmin) {
      const sinceFixCount = Number(reportsByOfficialId?.[lid]?.sinceFixCount ?? 0);
      if (sinceFixCount < 1) return false;
      if (mode === "saved") return true;
      return utilityReportedAnyLightIdSet.has(lid);
    }

    if (!viewerStreetlightRingOpenIdSet.has(lid)) return false;
    if (mode === "saved") return viewerSavedStreetlightLightIdSet.has(lid);
    return viewerUtilityReportedLightIdSet.has(lid);
  }, [
    streetlightInViewFilterMode,
    isAdmin,
    reportsByOfficialId,
    utilityReportedAnyLightIdSet,
    viewerStreetlightRingOpenIdSet,
    viewerSavedStreetlightLightIdSet,
    viewerUtilityReportedLightIdSet,
  ]);

  const handleOfficialMarkerClick = useCallback((lightId) => {
    if (mappingMode) {
      setSelectedQueuedTempId(null);
      setSelectedDomainMarker(null);
      setSelectedOfficialId(lightId);
      return;
    }

    if (bulkMode) {
      toggleBulkSelect(lightId);
      return;
    }

    setSelectedQueuedTempId(null);
    setSelectedDomainMarker(null);
    setSelectedOfficialId(lightId);
  }, [mappingMode, bulkMode, toggleBulkSelect]);

  const selectDomainMarkerWithGeo = useCallback((marker) => {
    if (!marker) return;
    const domainKey = String(adminReportDomain || "").trim();
    const shouldEnrich = domainKey === "potholes" || domainKey === "water_drain_issues";
    setSelectedDomainMarker(marker);
    if (!shouldEnrich) return;

    const lat = Number(marker?.lat);
    const lng = Number(marker?.lng);
    if (!isValidLatLng(lat, lng)) return;

    const markerId = String(marker?.id || marker?.pothole_id || "").trim();
    const markerLightId = String(marker?.lightId || "").trim();
    const markerKey = [domainKey, markerId, markerLightId, lat.toFixed(6), lng.toFixed(6)].join("|");

    // Passive marker-click geocoding disabled for cost control.
    // Marker details should come from persisted data only.
  }, [adminReportDomain, isValidLatLng, reverseGeocodeRoadLabel]);

  // Only "community" reports get clustered into community lights
  const communityReports = useMemo(
    () => reports.filter((r) => !officialIdSet.has(r.light_id) && !officialSignIdSet.has(r.light_id)),
    [reports, officialIdSet, officialSignIdSet]
  );

  const myReportDomainCounts = useMemo(() => {
    const identityKey = viewerIdentityKey;
    const empty = { streetlights: 0, street_signs: 0, potholes: 0, water_drain_issues: 0, power_outage: 0, water_main: 0 };
    if (!identityKey) return empty;

    const counts = { ...empty };
    for (const r of reports || []) {
      if (reportIdentityKey(r) !== identityKey) continue;
      const domain = reportDomainForRow(r, officialIdSet, officialSignIdSet);
      if (Object.prototype.hasOwnProperty.call(counts, domain)) counts[domain] += 1;
    }
    for (const r of potholeReports || []) {
      if (reportIdentityKey(r) !== identityKey) continue;
      counts.potholes += 1;
    }
    return counts;
  }, [viewerIdentityKey, reports, potholeReports, officialIdSet, officialSignIdSet]);

  const myReportsByLight = useMemo(() => {
    const identityKey = viewerIdentityKey;
    if (!identityKey) return [];

    if (myReportsDomain === "potholes") {
      const potholeById = new Map((potholes || []).map((p) => [String(p?.id || "").trim(), p]));
      const mineRows = (potholeReports || []).filter((r) => reportIdentityKey(r) === identityKey);
      const map = new Map(); // potholeId -> rows
      for (const r of mineRows) {
        const pid = String(r?.pothole_id || "").trim();
        if (!pid) continue;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid).push(r);
      }

      const groups = Array.from(map.entries()).map(([pid, rows]) => {
        rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        const p = potholeById.get(pid);
        const avg = rows.reduce(
          (acc, r) => ({ lat: acc.lat + Number(r?.lat || 0), lng: acc.lng + Number(r?.lng || 0) }),
          { lat: 0, lng: 0 }
        );
        const n = rows.length || 1;
        return {
          domainKey: "potholes",
          lightId: `potholes:${pid}`,
          displayId: String(p?.ph_id || "").trim() || pid,
          center: Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng))
            ? { lat: Number(p.lat), lng: Number(p.lng), isOfficial: false }
            : { lat: avg.lat / n, lng: avg.lng / n, isOfficial: false },
          mineRows: rows,
          totalCount: Number(rows.length || 0),
          lastTs: rows?.[0]?.ts || 0,
        };
      });

      groups.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      return groups;
    }

    // reports you already store are normalized as:
    // { id, lat, lng, type, note, ts, light_id }
    const mine = reports.filter((r) => (
      reportIdentityKey(r) === identityKey &&
      reportDomainForRow(r, officialIdSet, officialSignIdSet) === myReportsDomain
    ));

    const map = new Map(); // lightId -> array of reports
    for (const r of mine) {
      const lid = r.light_id || lightIdFor(r.lat, r.lng);
      if (!map.has(lid)) map.set(lid, []);
      map.get(lid).push(r);
    }

    // sort each group newest first
    for (const [lid, arr] of map.entries()) {
      arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    }

    // return list sorted by most recent activity in that light
    const groups = Array.from(map.entries()).map(([lightId, mineRows]) => ({
      domainKey: myReportsDomain,
      lightId,
      mineRows,
      lastTs: mineRows?.[0]?.ts || 0,
      totalCount: mineRows?.length || 0,
    }));

    groups.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
    return groups;
  }, [viewerIdentityKey, reports, potholeReports, potholes, officialIdSet, officialSignIdSet, myReportsDomain]);

  const myReportsAllDomainRows = useMemo(
    () => (myReportsByLight || []).flatMap((g) => (Array.isArray(g?.mineRows) ? g.mineRows : [])),
    [myReportsByLight]
  );

  const myReportsStandardGroups = useMemo(() => {
    return (myReportsByLight || []).map((g) => {
      const rows = Array.isArray(g?.mineRows) ? g.mineRows : [];
      const lightId = String(g?.lightId || "").trim();
      const incidentId = myReportsDomain === "potholes"
        ? String(lightId || "").replace(/^potholes:/i, "pothole:")
        : lightId;
      return {
        ...g,
        incidentId,
        rows,
        count: Number(g?.totalCount || rows.length || 0),
        lastTs: Number(g?.lastTs || rows?.[0]?.ts || 0),
      };
    });
  }, [myReportsByLight, myReportsDomain]);

  const activeAggregationStrategy = useMemo(() => {
    if (adminReportDomain === "streetlights") return "asset_based";
    if (adminReportDomain === "street_signs") return "asset_based";
    if (adminReportDomain === "potholes") return "proximity_based";
    if (adminReportDomain === "water_drain_issues") return "water_proximity";
    if (adminReportDomain === "power_outage") return "area_based";
    if (adminReportDomain === "water_main") return "severity_based";
    return "asset_based";
  }, [adminReportDomain]);

  const aggregationStrategies = useMemo(() => {
    return {
      asset_based: () => {
        const grouped = new Map(); // incident_id -> rows
        if (adminReportDomain === "streetlights") {
          for (const r of reports || []) {
            if (!isOutageReportType(r)) continue;
            const incidentId = String(r?.light_id || "").trim();
            if (!incidentId || !officialIdSet.has(incidentId)) continue;
            const lastFixTs = Math.max(lastFixByLightId?.[incidentId] || 0, fixedLights?.[incidentId] || 0);
            const ts = Number(r?.ts || 0);
            if (lastFixTs && ts <= lastFixTs) continue;
            if (!grouped.has(incidentId)) grouped.set(incidentId, []);
            grouped.get(incidentId).push(r);
          }
        } else if (adminReportDomain === "street_signs") {
          for (const r of reports || []) {
            const incidentId = String(r?.light_id || "").trim();
            if (!incidentId || !officialSignIdSet.has(incidentId)) continue;
            if (reportDomainForRow(r, officialIdSet, officialSignIdSet) !== "street_signs") continue;
            if (!grouped.has(incidentId)) grouped.set(incidentId, []);
            grouped.get(incidentId).push(r);
          }
        }
        return Array.from(grouped.entries()).map(([incidentId, rows]) => {
          const orderedRows = [...rows].sort((a, b) => (b.ts || 0) - (a.ts || 0));
          const center = adminReportDomain === "street_signs"
            ? (() => {
                const s = (officialSigns || []).find((x) => String(x?.id || "").trim() === incidentId);
                if (!s) return null;
                return { lat: Number(s.lat), lng: Number(s.lng), isOfficial: true };
              })()
            : getCoordsForLightId(incidentId, reports, officialLights);
          return {
            incident_id: incidentId,
            domain: adminReportDomain === "street_signs" ? "street_signs" : "streetlights",
            count: orderedRows.length,
            last_ts: Number(orderedRows?.[0]?.ts || 0),
            center: center ? { lat: Number(center.lat), lng: Number(center.lng) } : null,
            rows: orderedRows,
            display_id: incidentId,
            location_label: "",
          };
        });
      },
      proximity_based: () => {
        return (nonStreetlightDomainMarkers || [])
          .filter((m) => Number(m?.count || 0) > 0)
          .map((m) => {
            const pid = String(m?.pothole_id || "").trim();
            const lastFixTs = Number(m?.lastFixTs || 0);
            const rows = (potholeReports || [])
              .filter((r) => String(r?.pothole_id || "").trim() === pid)
              .filter((r) => Number(r?.ts || 0) > lastFixTs)
              .sort((a, b) => (b.ts || 0) - (a.ts || 0));
            return {
              incident_id: `pothole:${pid}`,
              domain: "potholes",
              count: Number(m?.count || 0),
              last_ts: Number(m?.lastTs || 0),
              center: isValidLatLng(Number(m?.lat), Number(m?.lng))
                ? { lat: Number(m.lat), lng: Number(m.lng) }
                : null,
              rows,
              display_id: String(m?.id || "").trim(),
              location_label: String(m?.location_label || "").trim(),
            };
          });
      },
      water_proximity: () => {
        const rows = (selectedDomainReports || [])
          .filter((r) => isValidLatLng(Number(r?.lat), Number(r?.lng)))
          .map((r) => ({
            ...r,
            lat: Number(r.lat),
            lng: Number(r.lng),
            light_id: String(r?.light_id || "").trim() || lightIdFor(Number(r.lat), Number(r.lng)),
          }));
        const clusters = groupIntoLights(rows);
        return clusters
          .map((c) => {
            const incidentId = String(c?.lightId || lightIdFor(Number(c?.lat || 0), Number(c?.lng || 0))).trim();
            const clusterRows = [...(c?.reports || [])].sort((a, b) => (Number(b?.ts || 0) - Number(a?.ts || 0)));
            const displayId = String(selectedWaterDrainInfo?.displayId || "").trim() || makeWaterDrainIdFromIncidentId(incidentId);
            const locationLabel =
              readLocationFromNote(clusterRows?.[0]?.note) ||
              (isValidLatLng(Number(c?.lat), Number(c?.lng))
                ? `${Number(c.lat).toFixed(5)}, ${Number(c.lng).toFixed(5)}`
                : "");
            return {
              incident_id: incidentId,
              domain: "water_drain_issues",
              count: clusterRows.length,
              last_ts: Number(clusterRows?.[0]?.ts || 0),
              center: isValidLatLng(Number(c?.lat), Number(c?.lng))
                ? { lat: Number(c.lat), lng: Number(c.lng) }
                : null,
              rows: clusterRows,
              display_id: displayId,
              location_label: locationLabel,
            };
          })
          .filter((x) => Number(x?.count || 0) > 0);
      },
      area_based: () => {
        return (nonStreetlightDomainMarkers || []).map((m) => ({
          incident_id: String(m?.id || "").trim(),
          domain: "power_outage",
          count: Number(m?.count || 0),
          last_ts: Number(m?.lastTs || 0),
          center: isValidLatLng(Number(m?.lat), Number(m?.lng))
            ? { lat: Number(m.lat), lng: Number(m.lng) }
            : null,
          rows: selectedDomainReports
            .filter((r) => String(r?.light_id || "").trim() === String(m?.id || "").trim())
            .sort((a, b) => (b.ts || 0) - (a.ts || 0)),
          display_id: String(m?.id || "").trim(),
          location_label: "",
        }));
      },
      severity_based: () => {
        return (nonStreetlightDomainMarkers || []).map((m) => ({
          incident_id: String(m?.id || "").trim(),
          domain: "water_main",
          count: Number(m?.count || 0),
          last_ts: Number(m?.lastTs || 0),
          center: isValidLatLng(Number(m?.lat), Number(m?.lng))
            ? { lat: Number(m.lat), lng: Number(m.lng) }
            : null,
          rows: selectedDomainReports
            .filter((r) => String(r?.light_id || "").trim() === String(m?.id || "").trim())
            .sort((a, b) => (b.ts || 0) - (a.ts || 0)),
          display_id: String(m?.id || "").trim(),
          location_label: "",
        }));
      },
    };
  }, [
    adminReportDomain,
    reports,
    officialIdSet,
    officialSignIdSet,
    lastFixByLightId,
    fixedLights,
    officialLights,
    officialSigns,
    nonStreetlightDomainMarkers,
    potholeReports,
    selectedDomainReports,
  ]);

  const openIncidentGroupsNormalized = useMemo(() => {
    const builder = aggregationStrategies?.[activeAggregationStrategy];
    const groups = typeof builder === "function" ? builder() : [];
    return (Array.isArray(groups) ? groups : [])
      .filter((g) => Number(g?.count || 0) > 0)
      .sort((a, b) => (Number(b?.count || 0) - Number(a?.count || 0)) || (Number(b?.last_ts || 0) - Number(a?.last_ts || 0)));
  }, [aggregationStrategies, activeAggregationStrategy]);

  const openReportsInViewCount = useMemo(() => {
    const inView = (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (!mapBounds) return true;
      return isPointInBounds(lat, lng, mapBounds);
    };

    if (adminReportDomain === "streetlights") {
      let count = 0;
      for (const l of renderedOfficialLights || []) {
        const lid = String(l?.id || "").trim();
        if (!lid) continue;
        const lat = Number(l?.lat);
        const lng = Number(l?.lng);
        if (!inView(lat, lng)) continue;
        const markerColor = String(officialMarkerColorForViewer(lid) || "").trim().toLowerCase();
        // Operational/closed lights are rendered black and should not count as open reports in view.
        if (markerColor === "#111" || markerColor === "#111111" || markerColor === "black") continue;
        count += 1;
      }
      return count;
    }

    let count = 0;
    for (const m of renderedDomainMarkers || []) {
      const lat = Number(m?.lat);
      const lng = Number(m?.lng);
      if (inView(lat, lng) && Number(m?.count || 0) > 0) count += 1;
    }
    return count;
  }, [adminReportDomain, renderedOfficialLights, renderedDomainMarkers, officialMarkerColorForViewer, mapBounds]);

  const streetlightPersonalInViewStats = useMemo(() => {
    const empty = { saved: 0, utility: 0 };
    if (!isStreetlightsDomain) return empty;

    const inView = (lat, lng) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      if (!mapBounds) return true;
      return isPointInBounds(lat, lng, mapBounds);
    };

    let saved = 0;
    let utility = 0;
    for (const l of renderedOfficialLights || []) {
      const lid = String(l?.id || "").trim();
      if (!lid) continue;
      const lat = Number(l?.lat);
      const lng = Number(l?.lng);
      if (!inView(lat, lng)) continue;
      if (isAdmin) {
        const sinceFixCount = Number(reportsByOfficialId?.[lid]?.sinceFixCount ?? 0);
        if (sinceFixCount >= 1) {
          saved += 1;
          if (utilityReportedAnyLightIdSet.has(lid)) utility += 1;
        }
        continue;
      }

      if (!viewerStreetlightRingOpenIdSet.has(lid)) continue;
      if (viewerSavedStreetlightLightIdSet.has(lid)) saved += 1;
      if (viewerUtilityReportedLightIdSet.has(lid)) utility += 1;
    }

    return { saved, utility };
  }, [
    isStreetlightsDomain,
    isAdmin,
    mapBounds,
    renderedOfficialLights,
    reportsByOfficialId,
    utilityReportedAnyLightIdSet,
    viewerStreetlightRingOpenIdSet,
    viewerSavedStreetlightLightIdSet,
    viewerUtilityReportedLightIdSet,
  ]);

  const visibleOfficialLights = useMemo(() => {
    if (!isStreetlightsDomain) return renderedOfficialLights;
    return (renderedOfficialLights || []).filter((l) => {
      const lid = String(l?.id || "").trim();
      return streetlightFilterMatchesLight(lid);
    });
  }, [isStreetlightsDomain, renderedOfficialLights, streetlightFilterMatchesLight]);

  useEffect(() => {
    if (!isStreetlightsDomain) return;
    const selectedId = String(selectedOfficialId || "").trim();
    if (!selectedId) return;
    const stillVisible = (visibleOfficialLights || []).some((l) => String(l?.id || "").trim() === selectedId);
    if (!stillVisible) setSelectedOfficialId(null);
  }, [isStreetlightsDomain, selectedOfficialId, visibleOfficialLights]);

  const openReportsModalGroupsBase = useMemo(() => {
    return (openIncidentGroupsNormalized || [])
      .map((g) => ({
        lightId: String(g?.display_id || g?.incident_id || "").trim(),
        incidentId: String(g?.incident_id || "").trim(),
        count: Number(g?.count || 0),
        lastTs: Number(g?.last_ts || 0),
        rows: Array.isArray(g?.rows) ? g.rows : [],
        lat: Number(g?.center?.lat),
        lng: Number(g?.center?.lng),
        location_label: String(g?.location_label || "").trim(),
        domain: String(g?.domain || adminReportDomain || "").trim(),
      }))
      .filter((g) => {
        if (String(g?.domain || "").trim() !== "streetlights") return true;
        const incidentId = String(g?.incidentId || "").trim();
        return incidentId && officialIdSet.has(incidentId);
      })
      .filter((g) => {
        const domain = String(g?.domain || "").trim();
        if (domain !== "potholes" && domain !== "water_drain_issues") return true;
        if (cityLimitPolygons.length <= 0) return true;
        return isWithinAshtabulaCityLimits(g?.lat, g?.lng);
      });
  }, [openIncidentGroupsNormalized, adminReportDomain, officialIdSet, cityLimitPolygons.length, isWithinAshtabulaCityLimits]);

  const openReportsModalGroups = useMemo(() => {
    const base = Array.isArray(openReportsModalGroupsBase) ? openReportsModalGroupsBase : [];
    if (!openReportsInViewOnly || !mapBounds) return base;

    return base.filter((g) => {
      const lat = Number(g?.lat);
      const lng = Number(g?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      return isPointInBounds(lat, lng, mapBounds);
    });
  }, [openReportsModalGroupsBase, openReportsInViewOnly, mapBounds]);

  // -------------------------
  // Google Maps marker status helper
  // -------------------------

  // CMD+F: function formatTs
  function formatTs(input) {
    if (input == null) return "";

    // Accept: ms number, ISO string, Date, or seconds
    let t = input;

    if (t instanceof Date) t = t.getTime();

    if (typeof t === "string") {
      const parsed = Date.parse(t);
      if (!Number.isNaN(parsed)) t = parsed;
      else {
        const asNum = Number(t);
        t = Number.isFinite(asNum) ? asNum : 0;
      }
    }

    if (typeof t === "number") {
      // if it looks like seconds, convert → ms
      if (t > 0 && t < 2_000_000_000) t = t * 1000;
    }

    const ms = Number(t);
    if (!Number.isFinite(ms) || ms <= 0) return "";

    try {
      return new Date(ms).toLocaleString();
    } catch {
      return "";
    }
  }


  // -------------------------
  // SECTION 8F — Actions
  // -------------------------
  
  // CMD+F: function prettyReportType
  function prettyReportType(t) {
    const key = String(t || "").toLowerCase().trim();
    const map = {
      out: "Light is out",
      flicker: "Flickering",
      on_day: "On during day",
      downed_pole: "Downed pole",
      pole_down: "Downed pole",
      "downed-pole": "Downed pole",
      other: "Other",
    };
    return map[key] || (key ? key.replace(/_/g, " ") : "Report");
  }

  // CMD+F: function officialReportsSinceFix
  function officialReportsSinceFix(lightId) {
    const id = (lightId || "").trim();
    if (!id) return [];

    const lastFixTs = Math.max(lastFixByLightId?.[id] || 0, fixedLights?.[id] || 0);

    return (reports || [])
      .filter((r) => (r.light_id || "").trim() === id)
      .filter((r) => isOutageReportType(r))
      .filter((r) => (!lastFixTs ? true : (r.ts || 0) > lastFixTs))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  // CMD+F: function majorityIssueSinceFix
  function majorityIssueSinceFix(lightId) {
    const rows = officialReportsSinceFix(lightId);
    if (!rows.length) {
      return { total: 0, type: null, label: "No open reports", count: 0 };
    }

    const counts = new Map();
    const latestByType = new Map();

    for (const r of rows) {
      const t = String(r.type || r.report_type || "").trim() || "unknown";
      counts.set(t, (counts.get(t) || 0) + 1);
      latestByType.set(t, Math.max(latestByType.get(t) || 0, r.ts || 0));
    }

    let bestType = null;
    let bestCount = -1;
    let bestLatest = -1;

    for (const [t, c] of counts.entries()) {
      const latest = latestByType.get(t) || 0;
      if (c > bestCount || (c === bestCount && latest > bestLatest)) {
        bestType = t;
        bestCount = c;
        bestLatest = latest;
      }
    }

    return {
      total: rows.length,
      type: bestType,
      label: prettyReportType(bestType),
      count: bestCount,
    };
  }

  // CMD+F: function closeAnyPopup
  function closeAnyPopup() {
    // Google Maps InfoWindow (official)
    try { setSelectedOfficialId(null); } catch {}
    try { setSelectedDomainMarker(null); } catch {}

    // ✅ queued marker popup
    try { setSelectedQueuedTempId(null); } catch {}

    // Leaflet legacy (safe no-op if not present)
    try { mapRef.current?.closePopup?.(); } catch {}
  }

  // CMD+F: function suppressPopupsSafe
  function suppressPopupsSafe(_ms = 800) {
    // With Google Maps, we primarily suppress by closing InfoWindows
    // and ignoring quick subsequent clicks if you have logic for that.
    // Keep as a safe stub so calls won't crash.
  }

  function clearGuestContact() {
    setGuestInfo({ name: "", phone: "", email: "" });
    setGuestInfoDraft({ name: "", phone: "", email: "" });
  }

  function requestGuestChallenge(kind, lightId = "", domainKey = "") {
    setPendingGuestAction(
      kind === "working"
        ? { kind, lightId: (lightId || "").trim() }
        : kind === "repair"
          ? { kind, incidentId: String(lightId || "").trim(), domainKey: String(domainKey || "").trim() }
        : { kind }
    );
    setContactChoiceOpen(true);
  }

  async function reverseGeocodeRoadLabel(lat, lng, options = {}) {
    const fallbackLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const mode = String(options?.mode || "full").trim().toLowerCase();
    const includeLandmark = mode !== "quick";
    const includeIntersection = mode !== "quick";
    const includeCrossStreet = mode !== "quick";

    const distanceMeters = (aLat, aLng, bLat, bLng) => {
      const R = 6371000;
      const toRad = (v) => (v * Math.PI) / 180;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const aa =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    };

    const geocodeAddressAt = async (qlat, qlng) => {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const res = await new Promise((resolve) => {
          geocoder.geocode({ location: { lat: qlat, lng: qlng } }, (results, status) => {
            resolve({ results: Array.isArray(results) ? results : [], status });
          });
        });
        if (res.status !== "OK" || !res.results.length) return "";
        const ranked = res.results.find((r) => {
          const t = Array.isArray(r?.types) ? r.types : [];
          const comps = Array.isArray(r?.address_components) ? r.address_components : [];
          const hasStreetNo = comps.some((c) => (Array.isArray(c?.types) ? c.types : []).includes("street_number"));
          const hasRoute = comps.some((c) => (Array.isArray(c?.types) ? c.types : []).includes("route"));
          const hasPremise = comps.some((c) => {
            const ct = Array.isArray(c?.types) ? c.types : [];
            return ct.includes("premise") || ct.includes("subpremise");
          });
          return t.includes("street_address") || (hasStreetNo && hasRoute) || (hasPremise && hasRoute);
        });
        return String(ranked?.formatted_address || "").trim();
      } catch {
        return "";
      }
    };

    const lookupStreetNameAt = async (qlat, qlng) => {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const res = await new Promise((resolve) => {
          geocoder.geocode({ location: { lat: qlat, lng: qlng } }, (results, status) => {
            resolve({ results: Array.isArray(results) ? results : [], status });
          });
        });
        if (res.status !== "OK" || !res.results.length) return "";
        for (const r of res.results) {
          const comps = Array.isArray(r?.address_components) ? r.address_components : [];
          const routeComp = comps.find((c) =>
            (Array.isArray(c?.types) ? c.types : []).includes("route")
          );
          const routeName = String(routeComp?.long_name || "").trim();
          if (routeName) return routeName;
        }
      } catch {
        // ignore
      }
      return "";
    };

    const lookupClosestCrossStreetAt = async (qlat, qlng, onStreetName) => {
      const normalizeRoad = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const onStreetKey = normalizeRoad(onStreetName);
      try {
        const geocoder = new window.google.maps.Geocoder();
        const probeStep = 0.00045;
        const probes = [
          [qlat, qlng],
          [qlat + probeStep, qlng],
          [qlat - probeStep, qlng],
          [qlat, qlng + probeStep],
          [qlat, qlng - probeStep],
          [qlat + probeStep, qlng + probeStep],
          [qlat + probeStep, qlng - probeStep],
          [qlat - probeStep, qlng + probeStep],
          [qlat - probeStep, qlng - probeStep],
        ];
        const bestByRoute = new Map();
        for (const [plat, plng] of probes) {
          const res = await new Promise((resolve) => {
            geocoder.geocode({ location: { lat: plat, lng: plng } }, (results, status) => {
              resolve({ results: Array.isArray(results) ? results : [], status });
            });
          });
          if (res.status !== "OK" || !res.results.length) continue;
          for (const r of res.results) {
            const rLat = Number(r?.geometry?.location?.lat?.());
            const rLng = Number(r?.geometry?.location?.lng?.());
            if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
            const comps = Array.isArray(r?.address_components) ? r.address_components : [];
            const routeComp = comps.find((c) => (Array.isArray(c?.types) ? c.types : []).includes("route"));
            const routeName = String(routeComp?.long_name || "").trim();
            if (!routeName) continue;
            const routeKey = normalizeRoad(routeName);
            if (!routeKey) continue;
            if (onStreetKey) {
              if (routeKey === onStreetKey) continue;
              if (routeKey.includes(onStreetKey) || onStreetKey.includes(routeKey)) continue;
            }
            const d = distanceMeters(qlat, qlng, rLat, rLng);
            const existing = bestByRoute.get(routeKey);
            if (!existing || d < existing.distance) {
              bestByRoute.set(routeKey, { name: routeName, distance: d });
            }
          }
        }
        const nearest = Array.from(bestByRoute.values()).sort((a, b) => a.distance - b.distance)[0];
        return String(nearest?.name || "").trim();
      } catch {
        return "";
      }
    };

    const bearingDegrees = (fromLat, fromLng, toLat, toLng) => {
      const toRad = (v) => (v * Math.PI) / 180;
      const toDeg = (v) => (v * 180) / Math.PI;
      const phi1 = toRad(fromLat);
      const phi2 = toRad(toLat);
      const lam1 = toRad(fromLng);
      const lam2 = toRad(toLng);
      const y = Math.sin(lam2 - lam1) * Math.cos(phi2);
      const x =
        Math.cos(phi1) * Math.sin(phi2) -
        Math.sin(phi1) * Math.cos(phi2) * Math.cos(lam2 - lam1);
      return (toDeg(Math.atan2(y, x)) + 360) % 360;
    };

    const directionFromBearing = (deg) => {
      const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      const idx = Math.round((deg % 360) / 45) % 8;
      return dirs[idx];
    };

    const lookupNearestIntersectionWithDirection = async (qlat, qlng) => {
      const routeNameFromResult = (r) => {
        const comps = Array.isArray(r?.address_components) ? r.address_components : [];
        const routeComp = comps.find((c) =>
          (Array.isArray(c?.types) ? c.types : []).includes("route")
        );
        return String(routeComp?.long_name || "").trim();
      };

      const extractIntersectionRoutes = (r) => {
        const comps = Array.isArray(r?.address_components) ? r.address_components : [];
        const names = [];
        for (const c of comps) {
          const ct = Array.isArray(c?.types) ? c.types : [];
          if (!ct.includes("route")) continue;
          const nm = String(c?.long_name || "").trim();
          if (nm) names.push(nm);
        }
        return Array.from(new Set(names));
      };

      try {
        const geocoder = new window.google.maps.Geocoder();
        const centerGeocode = await new Promise((resolve) => {
          geocoder.geocode({ location: { lat: qlat, lng: qlng } }, (results, status) => {
            resolve({ results: Array.isArray(results) ? results : [], status });
          });
        });
        let preferredRoute = "";
        if (centerGeocode.status === "OK" && centerGeocode.results.length) {
          preferredRoute = routeNameFromResult(centerGeocode.results[0]);
        }
        const preferredRoutePoints = [];

        const probeStep = 0.00035; // ~115 ft
        const probes = [
          [qlat, qlng],
          [qlat + probeStep, qlng],
          [qlat - probeStep, qlng],
          [qlat, qlng + probeStep],
          [qlat, qlng - probeStep],
          [qlat + probeStep, qlng + probeStep],
          [qlat + probeStep, qlng - probeStep],
          [qlat - probeStep, qlng + probeStep],
          [qlat - probeStep, qlng - probeStep],
        ];

        const candidates = [];
        for (const [plat, plng] of probes) {
          const res = await new Promise((resolve) => {
            geocoder.geocode({ location: { lat: plat, lng: plng } }, (results, status) => {
              resolve({ results: Array.isArray(results) ? results : [], status });
            });
          });
          if (res.status !== "OK" || !res.results.length) continue;
          for (const r of res.results) {
            const t = Array.isArray(r?.types) ? r.types : [];
            const rLat = Number(r?.geometry?.location?.lat?.());
            const rLng = Number(r?.geometry?.location?.lng?.());
            const comps = Array.isArray(r?.address_components) ? r.address_components : [];
            const routeComp = comps.find((c) =>
              (Array.isArray(c?.types) ? c.types : []).includes("route")
            );
            const routeName = String(routeComp?.long_name || "").trim();
            if (
              preferredRoute &&
              routeName &&
              routeName.toLowerCase() === preferredRoute.toLowerCase()
            ) {
              preferredRoutePoints.push([rLat, rLng]);
            }
            if (routeName && Number.isFinite(rLat) && Number.isFinite(rLng)) {
              routeCandidates.push({
                name: routeName,
                lat: rLat,
                lng: rLng,
                distance: distanceMeters(qlat, qlng, rLat, rLng),
              });
            }
            if (!t.includes("intersection")) continue;
            if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
            const label = String(r?.formatted_address || "").trim();
            if (!label) continue;
            candidates.push({
              label,
              lat: rLat,
              lng: rLng,
              routes: extractIntersectionRoutes(r),
              distance: distanceMeters(qlat, qlng, rLat, rLng),
            });
          }
        }

        if (candidates.length) {
          let ranked = candidates;
          if (preferredRoute) {
            const preferredKey = preferredRoute.toLowerCase();
            const matched = candidates.filter((c) =>
              (c.routes || []).some((nm) => String(nm || "").toLowerCase() === preferredKey)
            );
            if (matched.length) ranked = matched;
          }
          ranked.sort((a, b) => a.distance - b.distance);
          const nearest = ranked[0];
          if (nearest.distance <= 8) return `At ${nearest.label}`;
          const formatIntersection = (c) => {
            const cross = (c.routes || []).find(
              (nm) => String(nm || "").toLowerCase() !== String(preferredRoute || "").toLowerCase()
            );
            if (preferredRoute && cross) return `${preferredRoute} & ${cross}`;
            return c.label;
          };
          let isEastWest = null;
          if (preferredRoutePoints.length >= 2) {
            let minLat = Infinity;
            let maxLat = -Infinity;
            let minLng = Infinity;
            let maxLng = -Infinity;
            for (const [plat, plng] of preferredRoutePoints) {
              if (plat < minLat) minLat = plat;
              if (plat > maxLat) maxLat = plat;
              if (plng < minLng) minLng = plng;
              if (plng > maxLng) maxLng = plng;
            }
            const midLat = (minLat + maxLat) / 2;
            const latMeters = (maxLat - minLat) * 111320;
            const lngMeters = (maxLng - minLng) * 111320 * Math.cos((midLat * Math.PI) / 180);
            isEastWest = Math.abs(lngMeters) >= Math.abs(latMeters);

            if (preferredRoute) {
              const onRoute = ranked.filter((c) =>
                (c.routes || []).some(
                  (nm) => String(nm || "").toLowerCase() === String(preferredRoute || "").toLowerCase()
                )
              );
              if (onRoute.length >= 2) {
                let nearestPos = null;
                let nearestNeg = null;
                for (const c of onRoute) {
                  const delta = isEastWest ? qlng - c.lng : qlat - c.lat;
                  if (delta >= 0) {
                    if (!nearestPos || Math.abs(delta) < Math.abs(nearestPos.delta)) nearestPos = { c, delta };
                  } else {
                    if (!nearestNeg || Math.abs(delta) < Math.abs(nearestNeg.delta)) nearestNeg = { c, delta };
                  }
                }
                if (nearestPos && nearestNeg) {
                  const left = isEastWest ? nearestNeg.c : nearestNeg.c;  // west/south side
                  const right = isEastWest ? nearestPos.c : nearestPos.c; // east/north side
                  return `On ${preferredRoute}, between ${formatIntersection(left)} and ${formatIntersection(right)}`;
                }
              }
              // If we know the road but cannot confidently bracket between two intersections,
              // prefer "near" phrasing over a cardinal direction.
              return `On ${preferredRoute} near ${formatIntersection(nearest)}`;
            }
          }
          if (preferredRoute) {
            return `On ${preferredRoute} near ${formatIntersection(nearest)}`;
          }
          const dir = directionFromBearing(
            bearingDegrees(nearest.lat, nearest.lng, qlat, qlng)
          );
          return `${dir} of ${formatIntersection(nearest)}`;
        }
      } catch {
        // continue to route-based fallback below
      }

      // Fallback: derive nearest cross streets from route components.
      try {
        const geocoder = new window.google.maps.Geocoder();
        const probeStep = 0.00055; // ~180 ft
        const probes = [
          [qlat, qlng],
          [qlat + probeStep, qlng],
          [qlat - probeStep, qlng],
          [qlat, qlng + probeStep],
          [qlat, qlng - probeStep],
          [qlat + probeStep, qlng + probeStep],
          [qlat + probeStep, qlng - probeStep],
          [qlat - probeStep, qlng + probeStep],
          [qlat - probeStep, qlng - probeStep],
        ];

        const routeHits = [];
        for (const [plat, plng] of probes) {
          const res = await new Promise((resolve) => {
            geocoder.geocode({ location: { lat: plat, lng: plng } }, (results, status) => {
              resolve({ results: Array.isArray(results) ? results : [], status });
            });
          });
          if (res.status !== "OK" || !res.results.length) continue;
          for (const r of res.results) {
            const rLat = Number(r?.geometry?.location?.lat?.());
            const rLng = Number(r?.geometry?.location?.lng?.());
            if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
            const comps = Array.isArray(r?.address_components) ? r.address_components : [];
            const routeComp = comps.find((c) =>
              (Array.isArray(c?.types) ? c.types : []).includes("route")
            );
            const routeName = String(routeComp?.long_name || "").trim();
            if (!routeName) continue;
            routeHits.push({
              name: routeName,
              lat: rLat,
              lng: rLng,
              distance: distanceMeters(qlat, qlng, rLat, rLng),
            });
          }
        }

        if (!routeHits.length) return "";

        // Keep nearest hit per distinct route name.
        const byRoute = new Map();
        for (const hit of routeHits) {
          const key = hit.name.toLowerCase();
          const cur = byRoute.get(key);
          if (!cur || hit.distance < cur.distance) byRoute.set(key, hit);
        }
        const uniqueRoutes = Array.from(byRoute.values()).sort((a, b) => a.distance - b.distance);
        if (uniqueRoutes.length < 2) return "";

        const a = uniqueRoutes[0];
        const b = uniqueRoutes[1];
        const midpointLat = (a.lat + b.lat) / 2;
        const midpointLng = (a.lng + b.lng) / 2;
        const dir = directionFromBearing(
          bearingDegrees(midpointLat, midpointLng, qlat, qlng)
        );
        return `${dir} of ${a.name} & ${b.name}`;
      } catch {
        return "";
      }
    };

    const lookupNearestLandmark = async (qlat, qlng) => {
      const sanitizeLandmarkName = (raw) => {
        const v = String(raw || "").trim();
        if (!v) return "";
        const lower = v.toLowerCase();
        if (
          lower === "ashtabula" ||
          lower === "ohio" ||
          lower === "usa" ||
          lower === "ashtabula county" ||
          lower === "ashtabula, ohio" ||
          lower === "ashtabula, oh"
        ) {
          return "";
        }
        if (/^\d+\s*\/\s*\d+$/.test(v)) return "";
        if (/^\d+$/.test(v)) return "";
        return v;
      };
      try {
        if (placesLookupBlockedRef.current) return "";
        if (ENABLE_LEGACY_PLACES_SERVICE) {
          const placesNS = window.google?.maps?.places;
          if (placesNS?.PlacesService) {
            const service = new placesNS.PlacesService(document.createElement("div"));

            const nearbyByType = async (type) =>
              new Promise((resolve) => {
                service.nearbySearch(
                  {
                    location: { lat: qlat, lng: qlng },
                    radius: 152, // ~500 ft
                    type,
                  },
                  (results, status) => {
                    const blocked =
                      status === placesNS.PlacesServiceStatus.REQUEST_DENIED;
                    if (blocked) {
                      markPlacesLookupBlocked("REQUEST_DENIED");
                    }
                    resolve({
                      results: Array.isArray(results) ? results : [],
                      ok:
                        status === placesNS.PlacesServiceStatus.OK ||
                        status === placesNS.PlacesServiceStatus.ZERO_RESULTS,
                      blocked,
                    });
                  }
                );
              });

            const candidates = [];
            for (const type of ["establishment", "point_of_interest"]) {
              const res = await nearbyByType(type);
              if (res?.blocked) return "";
              if (!res.ok || !res.results.length) continue;
              for (const r of res.results) {
                const nm = String(r?.name || "").trim();
                const rLat = Number(r?.geometry?.location?.lat?.());
                const rLng = Number(r?.geometry?.location?.lng?.());
                if (!nm || !Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
                candidates.push({ name: nm, d: distanceMeters(qlat, qlng, rLat, rLng) });
              }
              if (candidates.length) break;
            }

            if (candidates.length) {
              candidates.sort((a, b) => a.d - b.d);
              return sanitizeLandmarkName(candidates[0]?.name || "");
            }

            // Fallback 2: distance-ranked search without a strict type
            const byDistance = await new Promise((resolve) => {
              service.nearbySearch(
                {
                  location: { lat: qlat, lng: qlng },
                  rankBy: placesNS.RankBy.DISTANCE,
                  keyword: "business",
                },
                (results, status) => {
                  const blocked =
                    status === placesNS.PlacesServiceStatus.REQUEST_DENIED;
                  if (blocked) {
                    markPlacesLookupBlocked("REQUEST_DENIED");
                  }
                  resolve({
                    results: Array.isArray(results) ? results : [],
                    ok:
                      status === placesNS.PlacesServiceStatus.OK ||
                      status === placesNS.PlacesServiceStatus.ZERO_RESULTS,
                    blocked,
                  });
                }
              );
            });
            if (byDistance?.blocked) return "";
            if (byDistance.ok && byDistance.results.length) {
              const named = byDistance.results
                .map((r) => String(r?.name || "").trim())
                .filter(Boolean);
              if (named.length) return sanitizeLandmarkName(named[0]);
            }
          }
        }

        // Geocoder fallback: avoids legacy PlacesService warning noise.
        const geocoder = new window.google.maps.Geocoder();
        const geo = await new Promise((resolve) => {
          geocoder.geocode({ location: { lat: qlat, lng: qlng } }, (results, status) => {
            resolve({ results: Array.isArray(results) ? results : [], status });
          });
        });
        if (geo.status !== "OK" || !geo.results.length) return "";
        for (const r of geo.results) {
          const t = Array.isArray(r?.types) ? r.types : [];
          if (!t.includes("establishment") && !t.includes("point_of_interest") && !t.includes("premise")) continue;
          const comps = Array.isArray(r?.address_components) ? r.address_components : [];
          const namedComp = comps.find((c) => {
            const ct = Array.isArray(c?.types) ? c.types : [];
            return ct.includes("establishment") || ct.includes("point_of_interest") || ct.includes("premise");
          });
          const compName = String(namedComp?.long_name || "").trim();
          if (compName && !/^\d+\s/.test(compName)) return sanitizeLandmarkName(compName);
          const formatted = String(r?.formatted_address || "").trim();
          const firstChunk = formatted.split(",")[0]?.trim() || "";
          if (firstChunk && !/^\d+\s/.test(firstChunk)) return sanitizeLandmarkName(firstChunk);
        }
        return "";
      } catch (e) {
        const msg = String(e?.message || e || "").toLowerCase();
        if (
          msg.includes("apitargetblockedmaperror") ||
          msg.includes("request_denied") ||
          msg.includes("not authorized to use this service or api")
        ) {
          markPlacesLookupBlocked(msg);
        }
        return "";
      }
    };

    // 1) Roads API nearest-road snap (deterministic road check)
    try {
      if (GMAPS_KEY) {
        const points = `${lat},${lng}`;

        const resp = await fetch(
          `https://roads.googleapis.com/v1/nearestRoads?points=${encodeURIComponent(points)}&key=${encodeURIComponent(GMAPS_KEY)}`
        );

        if (resp.ok) {
          const json = await resp.json();
          const snapped = Array.isArray(json?.snappedPoints) ? json.snappedPoints : [];
          if (snapped.length) {
            let best = null;
            for (const sp of snapped) {
              const slat = Number(sp?.location?.latitude);
              const slng = Number(sp?.location?.longitude);
              if (!Number.isFinite(slat) || !Number.isFinite(slng)) continue;
              const dMeters = distanceMeters(lat, lng, slat, slng);
              if (!best || dMeters < best.distance) best = { lat: slat, lng: slng, distance: dMeters };
            }
            if (best) {
              const isRoad = best.distance <= POTHOLE_ROAD_HIT_METERS;
              const [nearestAddressRaw, nearestStreetRaw, nearestLandmarkRaw, nearestIntersectionRaw] = await Promise.all([
                geocodeAddressAt(best.lat, best.lng),
                includeCrossStreet ? lookupStreetNameAt(best.lat, best.lng) : Promise.resolve(""),
                includeLandmark ? lookupNearestLandmark(best.lat, best.lng) : Promise.resolve(""),
                includeIntersection ? lookupNearestIntersectionWithDirection(best.lat, best.lng) : Promise.resolve(""),
              ]);
              const nearestAddress = String(nearestAddressRaw || "").trim();
              const nearestStreet = String(nearestStreetRaw || "").trim();
              const nearestCrossStreet = includeCrossStreet
                ? ((await lookupClosestCrossStreetAt(best.lat, best.lng, nearestStreet)) || "")
                : "";
              const nearestLandmark = String(nearestLandmarkRaw || "").trim();
              const nearestIntersection = String(nearestIntersectionRaw || "").trim();
              return {
                isRoad,
                label: nearestAddress || fallbackLabel,
                nearestAddress,
                nearestStreet,
                nearestCrossStreet,
                nearestLandmark,
                nearestIntersection,
                snappedLat: best.lat,
                snappedLng: best.lng,
                distance: best.distance,
                validationUnavailable: false,
              };
            }
          }
        }
      }
    } catch {
      // fall through to geocoder fallback
    }

    // 2) Geocoder fallback
    try {
      const geocoder = new window.google.maps.Geocoder();
      const geocodeOnce = (qlat, qlng) =>
        new Promise((resolve) => {
          geocoder.geocode({ location: { lat: qlat, lng: qlng } }, (results, status) => {
            resolve({ results: Array.isArray(results) ? results : [], status });
          });
        });

      const isRoadLikeResult = (r) => {
        const t = Array.isArray(r?.types) ? r.types : [];
        if (
          t.includes("route") ||
          t.includes("street_address") ||
          t.includes("intersection") ||
          t.includes("range_interpolated")
        ) {
          return true;
        }
        const comps = Array.isArray(r?.address_components) ? r.address_components : [];
        return comps.some((c) => {
          const ct = Array.isArray(c?.types) ? c.types : [];
          return ct.includes("route");
        });
      };

      const probes = [
        [lat, lng],
        [lat + 0.0001, lng],
        [lat - 0.0001, lng],
        [lat, lng + 0.0001],
        [lat, lng - 0.0001],
      ];

      let best = null;
      let bestLabel = "";
      let gotAnyResults = false;

      for (const [plat, plng] of probes) {
        const { results, status } = await geocodeOnce(plat, plng);
        if (status !== "OK" || !results.length) continue;
        gotAnyResults = true;
        for (const r of results) {
          if (!isRoadLikeResult(r)) continue;
          const rLat = Number(r?.geometry?.location?.lat?.());
          const rLng = Number(r?.geometry?.location?.lng?.());
          if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
          const dMeters = distanceMeters(lat, lng, rLat, rLng);
          if (!best || dMeters < best.distance) {
            best = { lat: rLat, lng: rLng, distance: dMeters };
            const maybe = String(r?.formatted_address || "").trim();
            if (maybe) bestLabel = maybe;
          }
        }
      }

      if (best) {
        const [nearestStreetRaw, nearestLandmarkRaw, nearestIntersectionRaw] = await Promise.all([
          includeCrossStreet ? lookupStreetNameAt(best.lat, best.lng) : Promise.resolve(""),
          includeLandmark ? lookupNearestLandmark(best.lat, best.lng) : Promise.resolve(""),
          includeIntersection ? lookupNearestIntersectionWithDirection(best.lat, best.lng) : Promise.resolve(""),
        ]);
        const nearestAddress = bestLabel || "";
        const nearestStreet = String(nearestStreetRaw || "").trim();
        const nearestCrossStreet = includeCrossStreet
          ? ((await lookupClosestCrossStreetAt(best.lat, best.lng, nearestStreet)) || "")
          : "";
        const nearestLandmark = String(nearestLandmarkRaw || "").trim();
        const nearestIntersection = String(nearestIntersectionRaw || "").trim();
        return {
          isRoad: best.distance <= POTHOLE_ROAD_HIT_METERS,
          label: nearestAddress || fallbackLabel,
          nearestAddress,
          nearestStreet,
          nearestCrossStreet,
          nearestLandmark,
          nearestIntersection,
          snappedLat: best.lat,
          snappedLng: best.lng,
          distance: best.distance,
          validationUnavailable: false,
        };
      }

      if (gotAnyResults) {
        const [nearestStreetRaw, nearestLandmarkRaw, nearestIntersectionRaw] = await Promise.all([
          includeCrossStreet ? lookupStreetNameAt(lat, lng) : Promise.resolve(""),
          includeLandmark ? lookupNearestLandmark(lat, lng) : Promise.resolve(""),
          includeIntersection ? lookupNearestIntersectionWithDirection(lat, lng) : Promise.resolve(""),
        ]);
        const nearestAddress = bestLabel || "";
        const nearestStreet = String(nearestStreetRaw || "").trim();
        const nearestCrossStreet = includeCrossStreet
          ? ((await lookupClosestCrossStreetAt(lat, lng, nearestStreet)) || "")
          : "";
        const nearestLandmark = String(nearestLandmarkRaw || "").trim();
        const nearestIntersection = String(nearestIntersectionRaw || "").trim();
        return {
          isRoad: false,
          label: nearestAddress || fallbackLabel,
          nearestAddress,
          nearestStreet,
          nearestCrossStreet,
          nearestLandmark,
          nearestIntersection,
          snappedLat: null,
          snappedLng: null,
          distance: Infinity,
          validationUnavailable: false,
        };
      }
    } catch {
      // handled below as unavailable
    }

    // 3) If validation services are unavailable, allow but mark uncertain.
    return {
      isRoad: true,
      label: fallbackLabel,
      nearestAddress: "",
      nearestStreet: "",
      nearestCrossStreet: "",
      nearestLandmark: "",
      nearestIntersection: "",
      snappedLat: lat,
      snappedLng: lng,
      distance: Infinity,
      validationUnavailable: true,
    };
  }

  function resumePendingGuestAction() {
    const action = pendingGuestAction;
    if (!action) return;
    setPendingGuestAction(null);

    setTimeout(() => {
      if (action.kind === "working") {
        submitIsWorking(action.lightId || "");
        return;
      }
      if (action.kind === "repair") {
        submitIncidentRepairConfirmation(action.incidentId || "", action.domainKey || "");
        return;
      }
      if (action.kind === "bulk") {
        submitBulkReports();
        return;
      }
      if (action.kind === "domain") {
        submitDomainReport();
        return;
      }
      submitReport();
    }, 0);
  }

  async function sendPotholeEmailNotice({
    potholeCode,
    reportNumber,
    notes,
    lat,
    lng,
    closestAddress,
    closestLandmark,
    closestCrossStreet,
    closestIntersection,
    submittedAtIso,
    reporter,
  }) {
    try {
      const tenantKey = activeTenantKey();
      const { data, error } = await supabase.functions.invoke("email-pothole-report", {
        body: {
          tenant_key: tenantKey,
          title: "Attention Public Works, Pothole report",
          potholeCode: String(potholeCode || "").trim(),
          reportNumber: String(reportNumber || "").trim(),
          notes: String(notes || "").trim(),
          location: {
            lat: Number(lat),
            lng: Number(lng),
            text: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
          },
          closestAddress: String(closestAddress || "").trim() || "Address unavailable",
          closestLandmark: String(closestLandmark || "").trim() || "No nearby landmark",
          closestCrossStreet: String(closestCrossStreet || "").trim() || "No nearby cross street",
          closestIntersection: String(closestIntersection || "").trim() || "No nearby intersection",
          submittedAtIso: String(submittedAtIso || new Date().toISOString()),
          submittedAtLocal: new Date(submittedAtIso || Date.now()).toLocaleString(),
          reporter: {
            type: reporter?.type === "guest" ? "guest" : "user",
            userId: reporter?.userId || null,
            name: String(reporter?.name || "").trim() || "Unknown",
            email: String(reporter?.email || "").trim() || "Not provided",
            phone: String(reporter?.phone || "").trim() || "Not provided",
          },
        },
      });
      if (error) {
        console.warn("[pothole email notice] invoke error:", error?.message || error);
        return { ok: false, reason: String(error?.message || "invoke_error").trim() || "invoke_error", skipped: false };
      }
      const skipped = Boolean(data?.skipped);
      const ok = data?.ok !== false && !skipped;
      const reason = String(data?.reason || "").trim();
      if (!ok) {
        console.warn("[pothole email notice] not sent:", data);
      }
      return {
        ok,
        skipped,
        reason: reason || (skipped ? "skipped" : ""),
      };
    } catch (e) {
      console.warn("[pothole email notice] invoke failed:", e?.message || e);
      return { ok: false, reason: String(e?.message || "invoke_failed"), skipped: false };
    }
  }

  async function sendWaterDrainEmailNotice({
    issueTypeLabel,
    reportNumber,
    notes,
    lat,
    lng,
    closestAddress,
    closestLandmark,
    closestCrossStreet,
    closestIntersection,
    submittedAtIso,
    reporter,
  }) {
    try {
      const tenantKey = activeTenantKey();
      const { data, error } = await supabase.functions.invoke("email-water-drain-report", {
        body: {
          tenant_key: tenantKey,
          title: "Attention Public Works, Water/Drain issue report",
          issueType: String(issueTypeLabel || "").trim() || "Water / Drain Issue",
          reportNumber: String(reportNumber || "").trim(),
          notes: String(notes || "").trim(),
          location: {
            lat: Number(lat),
            lng: Number(lng),
            text: `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`,
          },
          closestAddress: String(closestAddress || "").trim() || "Address unavailable",
          closestLandmark: String(closestLandmark || "").trim() || "No nearby landmark",
          closestCrossStreet: String(closestCrossStreet || "").trim() || "No nearby cross street",
          closestIntersection: String(closestIntersection || "").trim() || "No nearby intersection",
          submittedAtIso: String(submittedAtIso || new Date().toISOString()),
          submittedAtLocal: new Date(submittedAtIso || Date.now()).toLocaleString(),
          reporter: {
            type: reporter?.type === "guest" ? "guest" : "user",
            userId: reporter?.userId || null,
            name: String(reporter?.name || "").trim() || "Unknown",
            email: String(reporter?.email || "").trim() || "Not provided",
            phone: String(reporter?.phone || "").trim() || "Not provided",
          },
        },
      });
      if (error) {
        console.warn("[water/drain email notice] invoke error:", error?.message || error);
        return { ok: false, reason: String(error?.message || "invoke_error").trim() || "invoke_error", skipped: false };
      }

      const skipped = Boolean(data?.skipped);
      const ok = data?.ok !== false && !skipped;
      const reason = String(data?.reason || "").trim();
      if (!ok) {
        console.warn("[water/drain email notice] not sent:", data);
      }
      return {
        ok,
        skipped,
        reason: reason || (skipped ? "skipped" : ""),
      };
    } catch (e) {
      console.warn("[water/drain email notice] invoke failed:", e?.message || e);
      return { ok: false, reason: String(e?.message || "invoke_failed"), skipped: false };
    }
  }

  function notifyAsyncEmailDelivery(domainLabel, noticeRes) {
    const label = String(domainLabel || "Report").trim();
    if (noticeRes?.ok) return;
    const reason = String(noticeRes?.reason || "").trim();
    if (noticeRes?.skipped) {
      console.info(`[${label} email notice] skipped by tenant config`);
      return;
    }
    console.warn(`[${label} email notice] not confirmed${reason ? ` (${reason})` : ""}`);
  }

  async function uploadDomainReportImageIfAny(file, domainKey, reportKeyHint = "") {
    const f = file instanceof File ? file : null;
    if (!f) return "";
    const tenantKey = activeTenantKey();
    const domain = normalizeDomainKey(domainKey || "general");
    const ext = extFromFileName(f.name, "jpg");
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 9);
    const keyHint = String(reportKeyHint || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
    const path = `${tenantKey}/${domain}/${new Date().toISOString().slice(0, 10)}/${ts}_${keyHint || "report"}_${rand}.${ext}`;
    const { error: upErr } = await supabase.storage.from("report-images").upload(path, f, {
      cacheControl: "3600",
      upsert: false,
      contentType: f.type || undefined,
    });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from("report-images").getPublicUrl(path);
    return String(data?.publicUrl || "").trim();
  }

  function municipalBoundaryGate(domainKey, lat, lng, { showNotice = true } = {}) {
    const domain = normalizeDomainKey(domainKey);
    const municipalDomain = domain === "potholes" || domain === "water_drain_issues";
    if (!municipalDomain || isAdmin) return true;
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
      if (showNotice) {
        openNotice("⚠️", "Location unavailable", "Could not validate city limits for this report.");
      }
      return false;
    }
    // Boundary unavailable should not block reporting (fail-open fallback).
    if (cityLimitPolygons.length <= 0) {
      console.warn("[municipalBoundaryGate] boundary unavailable; allowing submit without boundary check");
      return true;
    }
    if (!isWithinAshtabulaCityLimits(nLat, nLng)) {
      if (showNotice) {
        openNotice(
          "⚠️",
          "Outside city limits",
          "You are outside of the city limits. This report will not be submitted to the city."
        );
      }
      return false;
    }
    return true;
  }

  async function submitDomainReport() {
    const targetRaw = domainReportTarget;
    if (!targetRaw || saving || domainSubmitInFlightRef.current) return;
    let target = targetRaw;
    const targetDomain = normalizeDomainKey(targetRaw?.domain);
    if (targetDomain === "water_drain_issues") {
      const near = nearestWaterDrainMarkerForPoint(targetRaw?.lat, targetRaw?.lng, nonStreetlightDomainMarkers);
      const resolvedIncidentId = String(near?.marker?.id || "").trim();
      if (resolvedIncidentId && resolvedIncidentId !== String(targetRaw?.lightId || "").trim()) {
        target = {
          ...targetRaw,
          lightId: resolvedIncidentId,
          locationLabel:
            String(near?.marker?.location_label || "").trim()
            || String(targetRaw?.locationLabel || "").trim(),
        };
      }
    }
    const submitKey = domainSubmitIdempotencyKey({
      target,
      issue: domainReportIssue,
      note: domainReportNote,
    });
    const nowTs = Date.now();
    const dedupeMap = domainSubmitDedupRef.current;
    for (const [k, ts] of dedupeMap.entries()) {
      if (!k || !Number.isFinite(Number(ts)) || (nowTs - Number(ts)) > DOMAIN_SUBMIT_DEDUPE_WINDOW_MS) {
        dedupeMap.delete(k);
      }
    }
    if (submitKey) {
      const prevTs = Number(dedupeMap.get(submitKey) || 0);
      if (prevTs > 0 && (nowTs - prevTs) < DOMAIN_SUBMIT_DEDUPE_WINDOW_MS) {
        openNotice("ℹ️", "Already processing", "This report is already being submitted. Please wait a moment.");
        return;
      }
      dedupeMap.set(submitKey, nowTs);
    }
    domainSubmitInFlightRef.current = true;
    setSaving(true);
    let persistedSubmission = false;
    try {
      const boundaryLat = Number.isFinite(Number(target?.sourceLat)) ? Number(target.sourceLat) : Number(target?.lat);
      const boundaryLng = Number.isFinite(Number(target?.sourceLng)) ? Number(target.sourceLng) : Number(target?.lng);
      if (!municipalBoundaryGate(target.domain, boundaryLat, boundaryLng, { showNotice: true })) {
        return;
      }
      if ((target.domain === "potholes" || target.domain === "water_drain_issues") && !potholeConsentChecked) {
        openNotice(
          "⚠️",
          "Consent required",
          `Please confirm authorization to submit your ${target.domain === "water_drain_issues" ? "water/drain issue" : "pothole"} report and contact information.`
        );
        return;
      }

      const isAuthed = Boolean(session?.user?.id);
      const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
      if (!isAuthed && !usingGuestBypass) {
        requestGuestChallenge("domain");
        return;
      }
      const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
      if (usingGuestBypass) guestSubmitBypassRef.current = false;

      const authedEmail = session?.user?.email || "";
      const authedName =
        (profile?.full_name || "").trim() ||
        (session?.user?.user_metadata?.full_name || "").trim() ||
        (authedEmail ? authedEmail.split("@")[0] : "User");
      const name = isAuthed ? authedName : (guestSource.name || "");
      const phone = isAuthed ? (profile?.phone || "") : (guestSource.phone || "");
      const email = isAuthed ? ((profile?.email || authedEmail) || "") : (guestSource.email || "");
      const identityGuestInfo = isAuthed ? null : { name, phone, email };

      if (!isAuthed && (!name.trim() || !normalizeEmail(email) || !normalizePhone(phone))) {
        requestGuestChallenge("domain");
        openNotice("⚠️", "Contact required", "Please add your name, email, and phone before submitting.");
        return;
      }

      const abuseGate = await registerAbuseEventWithServer({
        session,
        profile,
        guestInfo: identityGuestInfo,
        domain: target.domain || selectedDomain,
        idempotencyKey: submitKey,
        bypass: false,
      });
      if (!abuseGate.allowed) {
        openRateLimitNotice(openNotice, abuseGate);
        return;
      }
      if (abuseGate.duplicate) {
        openNotice("ℹ️", "Already submitted", "Duplicate report blocked. If needed, edit your note and submit again.");
        return;
      }

      if (target.domain === "potholes") {
      const submitGeoPromise = reverseGeocodeRoadLabel(Number(target.lat), Number(target.lng), { mode: "quick" });
      const potholeImageUploadPromise = domainReportImageFile
        ? uploadDomainReportImageIfAny(domainReportImageFile, "potholes", target.lightId || target.pothole_id || "")
            .catch((e) => {
              console.warn("[pothole image upload] failed:", e?.message || e);
              openNotice("⚠️", "Image upload failed", "Your report will still submit, but the image could not be uploaded.");
              return "";
            })
        : Promise.resolve("");
      const [submitGeo, imageUrl] = await Promise.all([submitGeoPromise, potholeImageUploadPromise]);
      if (!submitGeo.isRoad) {
        openNotice("⚠️", "Road required", "Pothole reports must be placed on a road.");
        return;
      }
      if (submitGeo.validationUnavailable) {
        openNotice("⚠️", "Road validation unavailable", "Road validation is temporarily unavailable. Please try again.");
        return;
      }
      const submitLat = Number.isFinite(Number(submitGeo.snappedLat)) ? Number(submitGeo.snappedLat) : Number(target.lat);
      const submitLng = Number.isFinite(Number(submitGeo.snappedLng)) ? Number(submitGeo.snappedLng) : Number(target.lng);
      let potholeId = (target.pothole_id || "").trim();
      let phId = (target.lightId || "").trim();
      const potholeAddress =
        String(submitGeo.nearestAddress || target.nearestAddress || "").trim() || "Address unavailable";
      const potholeLandmark = String(submitGeo.nearestLandmark || target.nearestLandmark || "").trim();
      const potholeCrossStreet = String(submitGeo.nearestCrossStreet || target.nearestCrossStreet || "").trim();
      const potholeIntersection = String(submitGeo.nearestIntersection || target.nearestIntersection || "").trim();

      if (!potholeId) {
        const nearest = nearestPotholeForPoint(submitLat, submitLng, potholes, POTHOLE_MERGE_RADIUS_METERS);
        if (nearest?.id) {
          potholeId = nearest.id;
          phId = nearest.ph_id || phId;
        }
      }

      if (potholeId) {
        const potholeIncidentId = `pothole:${String(potholeId || "").trim()}`;
        if (!canIdentityReportLight(potholeIncidentId, {
          session,
          profile,
          guestInfo: identityGuestInfo,
          reports,
          fixedLights,
          lastFixByLightId,
          potholeReports,
          potholeLastFixById,
        })) {
          openNotice("⏳", "Already reported", "You already reported this pothole. You can report again after it is marked fixed.");
          return;
        }
      }

      if (!potholeId) {
        const insPothole = await supabase
          .from("potholes")
          .insert([{
            ph_id: phId || makePotholeIdFromCoords(submitLat, submitLng),
            lat: submitLat,
            lng: submitLng,
            location_label: potholeAddress || null,
            created_by: session?.user?.id || null,
          }])
          .select("id, ph_id, lat, lng, location_label")
          .single();
        if (insPothole.error) {
          console.error(insPothole.error);
          openNotice("⚠️", "Couldn’t submit", insPothole.error?.message || "Failed to create pothole location.");
          return;
        }
        potholeId = insPothole.data?.id;
        phId = (insPothole.data?.ph_id || phId || "").trim();
        if (potholeId) {
          setPotholes((prev) => {
            const incoming = {
              id: potholeId,
              ph_id: phId || null,
              lat: Number(insPothole.data?.lat),
              lng: Number(insPothole.data?.lng),
              location_label: (insPothole.data?.location_label || "").trim() || null,
            };
            if (!incoming.id || !isValidLatLng(incoming.lat, incoming.lng)) return prev;
            if (prev.some((x) => x.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        }
      }

      if (potholeId && (potholeAddress || potholeCrossStreet || potholeLandmark)) {
        void (async () => {
          const { data: cacheData, error: cacheErr } = await supabase.functions.invoke("cache-official-light-geo", {
            body: {
              tenant_key: activeTenantKey(),
              domain: "potholes",
              incident_id: potholeId,
              nearest_address: potholeAddress || null,
              nearest_cross_street: potholeCrossStreet || null,
              nearest_landmark: potholeLandmark || null,
            },
          });
          if (cacheErr) {
            console.warn("[cache-domain-geo potholes] non-fatal error:", cacheErr);
            return;
          }
          setPotholes((prev) => (prev || []).map((row) => {
            if (String(row?.id || "").trim() !== String(potholeId || "").trim()) return row;
            return {
              ...row,
              nearest_address: potholeAddress || row?.nearest_address || "",
              nearest_cross_street: potholeCrossStreet || row?.nearest_cross_street || "",
              nearest_landmark: potholeLandmark || row?.nearest_landmark || "",
              location_label: potholeAddress || row?.location_label || "",
            };
          }));
        })();
      }

      const potholeReportPayload = {
        pothole_id: potholeId,
        lat: submitLat,
        lng: submitLng,
        note: [domainReportNote.trim() || "", imageUrl ? `Image: ${imageUrl}` : ""].filter(Boolean).join(" | ") || null,
        reporter_user_id: isAuthed ? session.user.id : null,
        reporter_name: name.trim(),
        reporter_phone: phone.trim() || null,
        reporter_email: email.trim() || null,
      };

      const insReport = await supabase
        .from("pothole_reports")
        .insert([potholeReportPayload])
        .select("*")
        .single();

      if (insReport.error) {
        console.error(insReport.error);
        openNotice("⚠️", "Couldn’t submit", insReport.error?.message || "Failed to submit pothole report.");
        return;
      }

      const saved = {
        id: insReport.data?.id,
        pothole_id: insReport.data?.pothole_id || potholeId,
        lat: Number(insReport.data?.lat),
        lng: Number(insReport.data?.lng),
        note: insReport.data?.note || potholeReportPayload.note || "",
        report_number: insReport.data?.report_number || null,
        ts: new Date(insReport.data?.created_at).getTime(),
        reporter_user_id: insReport.data?.reporter_user_id || null,
        reporter_name: insReport.data?.reporter_name || null,
        reporter_phone: insReport.data?.reporter_phone || null,
        reporter_email: insReport.data?.reporter_email || null,
      };
      if (saved.id) {
        setPotholeReports((prev) => (prev.some((x) => x.id === saved.id) ? prev : [saved, ...prev]));
      }
      persistedSubmission = true;

      const submittedAtIso = insReport.data?.created_at || new Date().toISOString();
      void sendPotholeEmailNotice({
        potholeCode: phId || target.lightId || saved.pothole_id || "Pothole",
        reportNumber: insReport.data?.report_number || saved.report_number || "",
        notes: insReport.data?.note || potholeReportPayload.note || "",
        lat: Number(insReport.data?.lat ?? submitLat),
        lng: Number(insReport.data?.lng ?? submitLng),
        closestAddress: potholeAddress,
        closestLandmark: potholeLandmark || "No nearby landmark",
        closestCrossStreet: potholeCrossStreet || "No nearby cross street",
        closestIntersection: potholeIntersection || "No nearby intersection",
        submittedAtIso,
        reporter: {
          type: isAuthed ? "user" : "guest",
          userId: isAuthed ? (session?.user?.id || null) : null,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
        },
      }).then((noticeRes) => {
        notifyAsyncEmailDelivery("Pothole", noticeRes);
      });
      } else {
      const isStreetSignsTarget = target.domain === "street_signs";
      const isWaterDrainTarget = target.domain === "water_drain_issues";
      const canonicalWaterDrainIncidentId = isWaterDrainTarget
        ? String(target?.lightId || "").trim()
        : "";
      if (isWaterDrainTarget && canonicalWaterDrainIncidentId) {
        if (!canIdentityReportLight(canonicalWaterDrainIncidentId, {
          session,
          profile,
          guestInfo: identityGuestInfo,
          reports,
          fixedLights,
          lastFixByLightId,
        })) {
          openNotice("⏳", "Already reported", "You already reported this water/drain issue. You can report again after it is marked fixed.");
          return;
        }
      }
      const waterGeoPromise = isWaterDrainTarget
        ? reverseGeocodeRoadLabel(Number(target.lat), Number(target.lng), { mode: "quick" })
        : Promise.resolve(null);
      const waterImageUploadPromise = (isWaterDrainTarget && domainReportImageFile)
        ? uploadDomainReportImageIfAny(domainReportImageFile, "water_drain_issues", target.lightId || "")
            .catch((e) => {
              console.warn("[water/drain image upload] failed:", e?.message || e);
              openNotice("⚠️", "Image upload failed", "Your report will still submit, but the image could not be uploaded.");
              return "";
            })
        : Promise.resolve("");
      const [waterSubmitGeo, imageUrl] = await Promise.all([waterGeoPromise, waterImageUploadPromise]);
      const waterNearestAddress = String(waterSubmitGeo?.nearestAddress || target.nearestAddress || "").trim();
      const waterNearestLandmark = String(waterSubmitGeo?.nearestLandmark || target.nearestLandmark || "").trim();
      const waterNearestCrossStreet = String(waterSubmitGeo?.nearestCrossStreet || target.nearestCrossStreet || "").trim();
      const waterNearestIntersection = String(waterSubmitGeo?.nearestIntersection || target.nearestIntersection || "").trim();
      const signIssue = isStreetSignsTarget
        ? STREET_SIGN_ISSUE_OPTIONS.find((x) => x.value === domainReportIssue)?.label || "Other"
        : "";
      const waterDrainIssue = isWaterDrainTarget
        ? WATER_DRAIN_ISSUE_OPTIONS.find((x) => x.value === domainReportIssue)?.label || "Water / Drain Issue"
        : "";
      const issueNote = isStreetSignsTarget
        ? `Sign issue: ${signIssue}`
        : isWaterDrainTarget
          ? `Water issue: ${waterDrainIssue}`
          : null;
      const signTypeNote = isStreetSignsTarget
        ? `Sign type: ${String(target.signType || "").trim() || "Unknown"}`
        : null;
      const reportType = isWaterDrainTarget
        ? String(domainReportIssue || WATER_DRAIN_ISSUE_OPTIONS[0].value).trim().toLowerCase()
        : "other";
      const normalizedReportType = reportType === "sewer_backup" || reportType === "storm_drain_clog"
        ? reportType
        : "storm_drain_clog";
      const payload = {
        lat: target.lat,
        lng: target.lng,
        // Keep DB-compatible value to avoid expected 400 noise from report_type check constraints.
        // Water/drain subtype is preserved in note text and email payload.
        report_type: "other",
        report_quality: "bad",
        note: [
          `Location: ${waterNearestAddress || target.locationLabel || `${target.lat.toFixed(5)}, ${target.lng.toFixed(5)}`}`,
          signTypeNote,
          issueNote,
          domainReportNote.trim() || null,
          imageUrl ? `Image: ${imageUrl}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
        light_id: (isWaterDrainTarget && canonicalWaterDrainIncidentId)
          ? canonicalWaterDrainIncidentId
          : (String(target.lightId || "").trim() || `${isWaterDrainTarget ? "water_main" : target.domain}:${target.lat.toFixed(5)}:${target.lng.toFixed(5)}`),
        reporter_user_id: isAuthed ? session.user.id : null,
        reporter_name: name.trim(),
        reporter_phone: phone.trim() || null,
        reporter_email: email.trim() || null,
      };

      const { data, error: insErr } = await insertReportWithFallback(payload);

      if (insErr) {
        console.error(insErr);
        openNotice("⚠️", "Couldn’t submit", insErr?.message || "Failed to submit report.");
        return;
      }

      const saved = {
        id: data.id,
        lat: data.lat,
        lng: data.lng,
        type: data.report_type,
        report_quality: normalizeReportQuality(data.report_quality) || "bad",
        note: data.note || "",
        ts: new Date(data.created_at).getTime(),
        light_id: data.light_id || target.lightId,
        report_number: data.report_number || null,
        reporter_user_id: data.reporter_user_id || null,
        reporter_name: data.reporter_name || null,
        reporter_phone: data.reporter_phone || null,
        reporter_email: data.reporter_email || null,
      };
      setReports((prev) => [saved, ...prev]);
      persistedSubmission = true;

      if (isWaterDrainTarget && saved?.light_id) {
        const nearestAddress = String(waterNearestAddress || "").trim();
        const nearestCrossStreet = String(waterNearestCrossStreet || "").trim();
        const nearestLandmark = String(waterNearestLandmark || "").trim();
        if (nearestAddress || nearestCrossStreet || nearestLandmark) {
          void (async () => {
            const { data: cacheData, error: cacheErr } = await supabase.functions.invoke("cache-official-light-geo", {
              body: {
                tenant_key: activeTenantKey(),
                domain: "water_main",
                incident_id: String(saved.light_id || "").trim(),
                lat: Number(data?.lat ?? target.lat),
                lng: Number(data?.lng ?? target.lng),
                issue_type: normalizedReportType,
                nearest_address: nearestAddress || null,
                nearest_cross_street: nearestCrossStreet || null,
                nearest_landmark: nearestLandmark || null,
              },
            });
            if (cacheErr) {
              console.warn("[cache-domain-geo water_drain_issues] non-fatal error:", cacheErr);
              return;
            }
            const incidentKey = String(saved.light_id || "").trim();
            if (incidentKey) {
              setWaterDrainIncidentsById((prev) => ({
                ...(prev || {}),
                [incidentKey]: {
                  wd_id: String(cacheData?.row?.wd_id || "").trim() || makeWaterDrainIdFromIncidentId(incidentKey),
                  issue_type: normalizedReportType,
                  lat: Number(data?.lat ?? target.lat),
                  lng: Number(data?.lng ?? target.lng),
                  nearest_address: nearestAddress || "",
                  nearest_cross_street: nearestCrossStreet || "",
                  nearest_landmark: nearestLandmark || "",
                  geo_updated_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              }));
            }
          })();
        }
      }

      if (isWaterDrainTarget) {
        const issueLabel =
          WATER_DRAIN_ISSUE_OPTIONS.find((x) => x.value === normalizedReportType)?.label ||
          waterDrainIssue ||
          "Water / Drain Issue";
        const submittedAtIso = data?.created_at || new Date().toISOString();
        const nearestAddress = String(waterNearestAddress || "").trim() || "Address unavailable";
        const nearestLandmark = String(waterNearestLandmark || "").trim() || "No nearby landmark";
        const nearestCrossStreet = String(waterNearestCrossStreet || "").trim() || "No nearby cross street";
        const nearestIntersection = String(waterNearestIntersection || "").trim() || "No nearby intersection";
        const userNotesOnly = [domainReportNote.trim() || "", imageUrl ? `Image: ${imageUrl}` : ""].filter(Boolean).join(" | ");
        void sendWaterDrainEmailNotice({
          issueTypeLabel: issueLabel,
          reportNumber: data?.report_number || saved.report_number || "",
          notes: userNotesOnly,
          lat: Number(data?.lat ?? target.lat),
          lng: Number(data?.lng ?? target.lng),
          closestAddress: nearestAddress,
          closestLandmark: nearestLandmark,
          closestCrossStreet: nearestCrossStreet,
          closestIntersection: nearestIntersection,
          submittedAtIso,
          reporter: {
            type: isAuthed ? "user" : "guest",
            userId: isAuthed ? (session?.user?.id || null) : null,
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim(),
          },
        }).then((noticeRes) => {
          notifyAsyncEmailDelivery("Water / Drain", noticeRes);
        });
      }
    }

      if (!isAuthed) clearGuestContact();
      setDomainReportNote("");
      setDomainReportImageFile(null);
      setDomainReportImagePreviewUrl("");
      setDomainReportIssue(defaultDomainIssueFor(target.domain));
      setPotholeConsentChecked(false);
      setDomainReportTarget(null);
      openNotice("✅", "Reported", `${target.domainLabel || "Issue"} reported successfully.`);
    } finally {
      if (!persistedSubmission && submitKey) {
        domainSubmitDedupRef.current.delete(submitKey);
      }
      setSaving(false);
      domainSubmitInFlightRef.current = false;
    }
  }


function canRetryInsertWithoutSelect(err) {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("select") ||
    msg.includes("violates row-level security policy")
  );
}

async function insertReportWithFallback(payload) {
    const extraTypeCandidates = Array.isArray(payload?.report_type_candidates)
      ? payload.report_type_candidates
      : [];
    const tryValues = [payload.report_type, ...extraTypeCandidates]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);

    if (payload.report_type === "downed_pole") {
      tryValues.push("pole_down");
      tryValues.push("downed-pole");
    }

    let lastErr = null;

    for (const rt of tryValues) {
      const { report_type_candidates, ...payloadBase } = payload || {};
      const attempt = { ...payloadBase, report_type: rt };
      const canReadInsertedRow = Boolean(attempt.reporter_user_id);
      let data = null;
      let insErr = null;

      if (canReadInsertedRow) {
        const first = await supabase
          .from("reports")
          .insert([attempt])
          .select("*")
          .single();
        data = first.data;
        insErr = first.error;

        // Backward-compatible fallback when report_quality column is not present yet.
        if (insErr && String(insErr.message || "").toLowerCase().includes("report_quality")) {
          const { report_quality, ...withoutQuality } = attempt;
          const second = await supabase
            .from("reports")
            .insert([withoutQuality])
            .select("*")
            .single();
          data = second.data;
          insErr = second.error;
        }
      } else {
        let plain = await supabase.from("reports").insert([attempt]);
        if (plain.error && String(plain.error.message || "").toLowerCase().includes("report_quality")) {
          const { report_quality, ...withoutQuality } = attempt;
          plain = await supabase.from("reports").insert([withoutQuality]);
        }
        if (!plain.error) {
          return {
            data: {
              id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
              created_at: new Date().toISOString(),
              ...attempt,
            },
            usedReportType: rt,
          };
        }
        insErr = plain.error;
      }

      if (!insErr) return { data, usedReportType: rt };

      // If SELECT on reports is restricted (security hardening), retry insert without RETURNING row.
      if (canRetryInsertWithoutSelect(insErr)) {
        let plain = await supabase.from("reports").insert([attempt]);
        if (plain.error && String(plain.error.message || "").toLowerCase().includes("report_quality")) {
          const { report_quality, ...withoutQuality } = attempt;
          plain = await supabase.from("reports").insert([withoutQuality]);
        }
        if (!plain.error) {
          return {
            data: {
              id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
              created_at: new Date().toISOString(),
              ...attempt,
            },
            usedReportType: rt,
          };
        }
      }

      lastErr = insErr;
    }

    return { data: null, error: lastErr };
  }

  async function submitIsWorking(lightId) {
    const lid = (lightId || "").trim();
    if (!lid || saving) return;

    const isAuthed = Boolean(session?.user?.id);
    const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
    if (!isAuthed && !usingGuestBypass) {
      requestGuestChallenge("working", lid);
      return;
    }
    const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
    if (usingGuestBypass) guestSubmitBypassRef.current = false;

    const name = isAuthed
      ? ((profile?.full_name || session?.user?.user_metadata?.full_name || "").trim() || "User")
      : (guestSource?.name || "");
    const phone = isAuthed ? (profile?.phone || "") : (guestSource?.phone || "");
    const email = isAuthed
      ? ((profile?.email || session?.user?.email) || "")
      : (guestSource?.email || "");

    if (!isAuthed && (!name.trim() || !normalizeEmail(email) || !normalizePhone(phone))) {
      requestGuestChallenge("working", lid);
      openNotice("⚠️", "Contact required", "Please add your name, email, and phone before submitting Is working.");
      return;
    }

    const abuseGate = await registerAbuseEventWithServer({
      session,
      profile,
      guestInfo: isAuthed ? null : { name, phone, email },
      domain: "streetlights",
      bypass: false,
    });
    if (!abuseGate.allowed) {
      openRateLimitNotice(openNotice, abuseGate);
      return;
    }

    setSaving(true);

    const normName = (name || "").trim() || null;
    const normEmail = normalizeEmail(email) || null;
    const normPhone = normalizePhone(phone) || null;
    const light = (officialLights || []).find((x) => (x.id || "").trim() === lid);
    const lat = Number(light?.lat);
    const lng = Number(light?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setSaving(false);
      openNotice("⚠️", "Couldn’t save", "Could not locate this light.");
      return;
    }

    const workingPayloadBase = {
      lat,
      lng,
      report_type: "working",
      report_quality: "good",
      note: null,
      light_id: lid,
      reporter_user_id: isAuthed ? session.user.id : null,
      reporter_name: normName,
      reporter_phone: normPhone,
      reporter_email: normEmail,
    };

    const workingTypeCandidates = ["working", "is_working", "reported_working"];
    let savedWorking = null;
    let workingErr = null;

    for (const rt of workingTypeCandidates) {
      const attempt = { ...workingPayloadBase, report_type: rt };
      const canReadInsertedRow = Boolean(attempt.reporter_user_id);
      let res = canReadInsertedRow
        ? await supabase
            .from("reports")
            .insert([attempt])
            .select("*")
            .single()
        : await supabase.from("reports").insert([attempt]);

      if (!canReadInsertedRow && !res.error) {
        res = {
          data: {
            id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            created_at: new Date().toISOString(),
            ...attempt,
          },
          error: null,
        };
      }

      if (res.error && canRetryInsertWithoutSelect(res.error)) {
        const plain = await supabase.from("reports").insert([attempt]);
        if (!plain.error) {
          res = {
            data: {
              id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
              created_at: new Date().toISOString(),
              ...attempt,
            },
            error: null,
          };
        }
      }

      if (!res.error) {
        savedWorking = res.data || null;
        workingErr = null;
        break;
      }
      workingErr = res.error;
    }

    setSaving(false);

    if (!savedWorking) {
      console.error(workingErr);
      openNotice("⚠️", "Couldn’t save", workingErr?.message || "Could not record working report.");
      return;
    }

    setReports((prev) => {
      const incoming = {
        id: savedWorking.id,
        lat: savedWorking.lat,
        lng: savedWorking.lng,
        type: savedWorking.report_type,
        report_quality: normalizeReportQuality(savedWorking.report_quality) || "good",
        note: savedWorking.note || "",
        ts: new Date(savedWorking.created_at).getTime(),
        light_id: savedWorking.light_id || lid,
        reporter_user_id: savedWorking.reporter_user_id || null,
        reporter_name: savedWorking.reporter_name || normName,
        reporter_phone: savedWorking.reporter_phone || normPhone,
        reporter_email: savedWorking.reporter_email || normEmail,
      };
      if (prev.some((x) => x.id === incoming.id)) return prev;
      return [incoming, ...prev];
    });

    if (!isAuthed) clearGuestContact();
    openNotice("✅", "Thanks", "Reported working.");
  }

  async function submitIncidentRepairConfirmation(incidentIdRaw, domainKeyRaw) {
    const incidentId = String(incidentIdRaw || "").trim();
    const domainKey = normalizeDomainKey(domainKeyRaw) || domainForIncidentId(incidentId);
    if (!incidentId || !domainKey || saving) return;

    if (!isPublicRepairEnabledForDomain(domainKey)) {
      openNotice("⚠️", "Repair confirmations unavailable", "This organization is handling repairs directly for this domain.");
      return;
    }

    const currentSnapshot = getIncidentRepairSnapshot(domainKey, incidentId);
    if (currentSnapshot?.archived) {
      openNotice("ℹ️", "Incident archived", "This incident has already been archived due to inactivity.");
      return;
    }
    if (currentSnapshot?.likelyFixed) {
      openNotice("ℹ️", "Already likely fixed", "Community repair confirmations already reached the fixed threshold.");
      return;
    }
    if (currentSnapshot?.viewerHasRepairSignal) {
      openNotice("ℹ️", "Already confirmed", "You already marked this incident fixed.");
      return;
    }

    const isAuthed = Boolean(session?.user?.id);
    const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
    if (!isAuthed && !usingGuestBypass) {
      requestGuestChallenge("repair", incidentId, domainKey);
      return;
    }
    const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
    if (usingGuestBypass) guestSubmitBypassRef.current = false;

    const name = isAuthed
      ? ((profile?.full_name || session?.user?.user_metadata?.full_name || "").trim() || "User")
      : (guestSource?.name || "");
    const phone = isAuthed ? (profile?.phone || "") : (guestSource?.phone || "");
    const email = isAuthed
      ? ((profile?.email || session?.user?.email) || "")
      : (guestSource?.email || "");
    const identityGuestInfo = isAuthed ? null : { name, phone, email };

    if (!isAuthed && (!name.trim() || !normalizeEmail(email) || !normalizePhone(phone))) {
      requestGuestChallenge("repair", incidentId, domainKey);
      openNotice("⚠️", "Contact required", "Please add your name, email, and phone before confirming a repair.");
      return;
    }

    const identityKey = reporterIdentityKey({ session, profile, guestInfo: identityGuestInfo });
    if (!identityKey) {
      openNotice("⚠️", "Identity required", "Please add contact details before confirming a repair.");
      return;
    }

    const abuseGate = await registerAbuseEventWithServer({
      session,
      profile,
      guestInfo: identityGuestInfo,
      domain: domainKey,
      bypass: false,
    });
    if (!abuseGate.allowed) {
      openRateLimitNotice(openNotice, abuseGate);
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("incident_repair_signals")
      .insert([{
        tenant_key: activeTenantKey(),
        domain: domainKey,
        incident_id: incidentId,
        identity_hash: identityKey,
        reporter_user_id: isAuthed ? session.user.id : null,
      }]);
    setSaving(false);

    if (error) {
      const code = String(error?.code || "").trim();
      const msg = String(error?.message || "").toLowerCase();
      if (code === "23505" || msg.includes("duplicate")) {
        openNotice("ℹ️", "Already confirmed", "You already marked this incident fixed.");
        return;
      }
      console.error("[incident_repair_signals] insert error:", error);
      openNotice("⚠️", "Couldn’t save", error.message || "Could not record repair confirmation.");
      return;
    }

    await refreshIncidentRepairProgress(identityKey);
    if (!isAuthed) clearGuestContact();
    openNotice("✅", "Repair confirmation saved", "Thanks. Community repair progress has been updated.");
  }

  function resumeSubmitIfPending() {
    if (!pendingSubmit) return;
    setPendingSubmit(false);

    // Ensure state updates (session/profile/guestInfo) are committed before submit reads them
    setTimeout(() => {
      submitReport();
    }, 0);
  }

  function openConfirmForLight({ lat, lng, lightId, isOfficial = false, reports = [] }) {
    if (isOfficial && Number(mapZoomRef.current || mapZoom) < REPORTING_MIN_ZOOM) {
      openNotice("🔎", "Zoom in to report", `Zoom in closer (level ${REPORTING_MIN_ZOOM}+) before submitting a report on a light.`);
      return;
    }
    setPicked([lat, lng]);
    setActiveLight({ lat, lng, lightId, isOfficial, reports });
    setNote("");           // optional: reset note each time
    setReportType("out");  // optional: default each time
    setStreetlightAreaPowerOn("");
    setStreetlightHazardYesNo("");
  }

  async function submitReport() {
    if (!picked || saving || !activeLight) return;

    const lightId = activeLight.lightId || lightIdFor(picked[0], picked[1]);
    const isAuthed = Boolean(session?.user?.id);
    const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
    if (!isAuthed && !usingGuestBypass) {
      requestGuestChallenge("report");
      return;
    }
    const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
    if (usingGuestBypass) guestSubmitBypassRef.current = false;

    if (reportType === "other" && !note.trim()) {
      openNotice("⚠️", "Notes required", "Please add a brief note for “Other”.");
      return;
    }

        // Best-effort fallbacks for authed users (so we never block them)
        const authedEmail = session?.user?.email || "";
        const authedName =
          (profile?.full_name || "").trim() ||
          (session?.user?.user_metadata?.full_name || "").trim() ||
          (authedEmail ? authedEmail.split("@")[0] : "User");

        const name = isAuthed ? authedName : (guestSource.name || "");
        const phone = isAuthed ? (profile?.phone || "") : (guestSource.phone || "");
        const email = isAuthed
          ? ((profile?.email || authedEmail) || "")
          : (guestSource.email || "");

        // ✅ Only guests get blocked and routed to login/create/guest
        if (!isAuthed) {
          if (!name.trim() || (!phone.trim() && !email.trim())) {
            requestGuestChallenge("report");
            setSaving(false);
            return;
          }
        }

        // ✅ Identity enforcement AFTER identity is known
        const identityGuestInfo = isAuthed ? null : { name, phone, email };

        if (!canIdentityReportLight(lightId, {
          session,
          profile,
          guestInfo: identityGuestInfo,
          reports,
          fixedLights,
          lastFixByLightId,
        })) {
          openNotice("⏳", "Already reported", "You already reported this light. You can report again after it is marked fixed.");
          setActiveLight(null);
          setPicked(null);
          return;
        }

        const abuseGate = await registerAbuseEventWithServer({
          session,
          profile,
          guestInfo: identityGuestInfo,
          domain: "streetlights",
          bypass: false,
        });
        if (!abuseGate.allowed) {
          openRateLimitNotice(openNotice, abuseGate);
          return;
        }

        // Explicit-action geo persistence for official streetlights:
        // only call GCP if official_lights is missing cached geo fields.
        if (activeLight?.isOfficial && lightId) {
          const existing = (officialLights || []).find((x) => String(x?.id || "").trim() === String(lightId || "").trim());
          const hasCachedGeo =
            Boolean(String(existing?.nearest_address || "").trim()) ||
            Boolean(String(existing?.nearest_cross_street || "").trim()) ||
            Boolean(String(existing?.nearest_landmark || "").trim());
          if (!hasCachedGeo && Number.isFinite(Number(picked?.[0])) && Number.isFinite(Number(picked?.[1]))) {
            try {
              const geo = await reverseGeocodeRoadLabel(Number(picked[0]), Number(picked[1]), { mode: "quick" });
              const nearestAddress = String(geo?.nearestAddress || "").trim();
              const nearestCrossStreet = String(geo?.nearestCrossStreet || "").trim();
              const nearestLandmark = String(geo?.nearestLandmark || "").trim();
              if (nearestAddress || nearestCrossStreet || nearestLandmark) {
                const { data: cacheData, error: cacheErr } = await supabase.functions.invoke("cache-official-light-geo", {
                  body: {
                    tenant_key: activeTenantKey(),
                    domain: "streetlights",
                    incident_id: lightId,
                    light_id: lightId,
                    nearest_address: nearestAddress || null,
                    nearest_cross_street: nearestCrossStreet || null,
                    nearest_landmark: nearestLandmark || null,
                  },
                });
                if (cacheErr) {
                  console.warn("[cache-official-light-geo] non-fatal error:", cacheErr);
                }
                setOfficialLights((prev) => (prev || []).map((row) => {
                  if (String(row?.id || "").trim() !== String(lightId || "").trim()) return row;
                  return {
                    ...row,
                    nearest_address: nearestAddress || row?.nearest_address || "",
                    nearest_cross_street: nearestCrossStreet || row?.nearest_cross_street || "",
                    nearest_landmark: nearestLandmark || row?.nearest_landmark || "",
                  };
                }));
              }
            } catch {
              // non-fatal: reporting flow continues even if geo enrichment fails
            }
          }
        }

        setSaving(true);

        const payload = {
          lat: picked[0],
          lng: picked[1],
          report_type: reportType,
          report_quality: "bad",
          note: composeStreetlightQaNote(note, streetlightAreaPowerOn, streetlightHazardYesNo) || null,
          light_id: lightId,

          reporter_user_id: isAuthed ? session.user.id : null,
          reporter_name: name.trim(),
          reporter_phone: phone.trim() || null,
          reporter_email: email.trim() || null,
        };


    const { data, error: insErr } = await insertReportWithFallback(payload);

    if (insErr) {
      console.error(insErr);
      setActiveLight(null);
      setPicked(null);
      openNotice("⚠️", "Couldn’t submit", "Something went wrong while submitting your report. Please try again.");
      setSaving(false);
      return;
    }

    const saved = {
      id: data.id,
      lat: data.lat,
      lng: data.lng,
      type: data.report_type,
      report_quality: normalizeReportQuality(data.report_quality) || "bad",
      note: data.note || "",
      ts: new Date(data.created_at).getTime(),
      light_id: data.light_id || lightId,
      report_number: data.report_number || null,

      reporter_user_id: data.reporter_user_id || null,
      reporter_name: data.reporter_name || null,
      reporter_phone: data.reporter_phone || null,
      reporter_email: data.reporter_email || null,
    };

    setReports((prev) => [saved, ...prev]);
    // A new saved report starts a fresh utility-follow-up cycle for this user/light.
    await clearUtilityReportedForViewer(saved.light_id || lightId);

    if (!session?.user?.id) {
      setCooldowns((prev) => {
        const next = pruneCooldowns({ ...prev, [lightId]: Date.now() });
        saveCooldownsToStorage(next);
        return next;
      });
    }

    setActiveLight(null);
    setPicked(null);
    setNote("");
    setStreetlightAreaPowerOn("");
    setStreetlightHazardYesNo("");
    setSaving(false);
    if (!isAuthed) clearGuestContact();

    // ✅ hard-close any popup + suppress any late/synthetic click
    closeAnyPopup();
    setTimeout(() => closeAnyPopup(), 0);
    suppressMapClickRef.current.until = Date.now() + 900;

    openNotice("✅", "Report saved", "Saved to My Reports for utility follow-up.", { autoCloseMs: 1200 });
  }

  // ✅ Auto-resume pending report after successful login
  useEffect(() => {
    if (!pendingSubmit) return;
    if (!session?.user?.id) return;

    // close all auth-related modals
    setAuthGateOpen(false);
    setAuthGateStep("welcome");
    setContactChoiceOpen(false);
    setGuestInfoOpen(false);

    // allow React state to settle, then submit
    setPendingSubmit(false);
    setTimeout(() => {
      submitReport();
    }, 0);
  }, [pendingSubmit, session?.user?.id]);

  useEffect(() => {
    if (!pendingGuestAction) return;
    if (!session?.user?.id) return;

    setContactChoiceOpen(false);
    setGuestInfoOpen(false);
    resumePendingGuestAction();
  }, [pendingGuestAction, session?.user?.id]);
  
  function removeFromMappingQueue(tempId) {
    setMappingQueue((prev) => prev.filter((q) => q.tempId !== tempId));
  }

  // CMD+F: async function confirmMappingQueue
  async function confirmMappingQueue() {
    if (!session?.user?.id) {
      openNotice("⚠️", "Not signed in", "You must be logged in to place mapped assets.");
      return false;
    }
    if (!isAdmin) {
      openNotice("⚠️", "Admin only", "Only admins can place mapped assets.");
      return false;
    }
    if (!mappingQueue.length) return true;

    setSaving(true);

    try {
      const lightRows = mappingQueue
        .filter((q) => (q?.domain || "streetlights") === "streetlights")
        .map((q) => ({
        sl_id: makeLightIdFromCoords(q.lat, q.lng),
        lat: Number(q.lat),
        lng: Number(q.lng),
        created_by: session.user.id,
      }));

      const uniqueLightRows = lightRows.filter(
        (r, i, arr) => arr.findIndex((x) => x.sl_id === r.sl_id) === i
      );

      const signRows = mappingQueue
        .filter((q) => q?.domain === "street_signs")
        .map((q) => ({
          sign_type: String(q.sign_type || "other").trim().toLowerCase() || "other",
          lat: Number(q.lat),
          lng: Number(q.lng),
          created_by: session.user.id,
        }));

      const uniqueSignRows = signRows.filter(
        (r, i, arr) =>
          arr.findIndex(
            (x) =>
              x.sign_type === r.sign_type &&
              Math.abs(Number(x.lat) - Number(r.lat)) < 0.000001 &&
              Math.abs(Number(x.lng) - Number(r.lng)) < 0.000001
          ) === i
      );

      let insertedLights = [];
      let insertedSigns = [];
      let existingLights = [];
      let duplicateLightCount = 0;

      if (uniqueLightRows.length) {
        const slIds = uniqueLightRows.map((r) => String(r.sl_id || "").trim()).filter(Boolean);
        if (slIds.length) {
          const { data: existingData, error: existingErr } = await supabase
            .from("official_lights")
            .select("id, sl_id, lat, lng, nearest_address, nearest_cross_street, nearest_landmark")
            .in("sl_id", slIds);
          if (existingErr) {
            console.error("[confirmMappingQueue] lights pre-check error:", existingErr);
            openNotice("⚠️", "Save failed", existingErr.message || "Could not validate mapped lights.");
            setSaving(false);
            return false;
          }
          existingLights = (existingData || [])
            .map(normalizeOfficialLightRow)
            .filter(Boolean);
          const existingSlSet = new Set(existingLights.map((x) => String(x?.sl_id || "").trim()).filter(Boolean));
          duplicateLightCount = existingSlSet.size;
          const rowsToInsert = uniqueLightRows.filter((r) => !existingSlSet.has(String(r.sl_id || "").trim()));
          if (rowsToInsert.length) {
            const { data, error } = await supabase
              .from("official_lights")
              .insert(rowsToInsert)
              .select("id, sl_id, lat, lng, nearest_address, nearest_cross_street, nearest_landmark");
            if (error) {
              console.error("[confirmMappingQueue] lights insert error:", error);
              openNotice("⚠️", "Save failed", error.message || "Could not save mapped lights.");
              setSaving(false);
              return false;
            }
            insertedLights = data || [];
          } else {
            insertedLights = [];
          }
        }
      }

      if (uniqueSignRows.length) {
        const { data, error } = await supabase
          .from("official_signs")
          .insert(uniqueSignRows)
          .select("id, sign_type, lat, lng, active");
        if (error) {
          console.error("[confirmMappingQueue] signs insert error:", error);
          openNotice("⚠️", "Save failed", error.message || "Could not save mapped signs.");
          setSaving(false);
          return false;
        }
        insertedSigns = data || [];
      }

      const cleanInsertedLights = insertedLights
        .map((r) => ({
          id: r.id,
          sl_id: r.sl_id || null,
          lat: Number(r.lat),
          lng: Number(r.lng),
        }))
        .filter((r) => r.id && isValidLatLng(r.lat, r.lng));
      const cleanExistingLights = (existingLights || [])
        .map((r) => normalizeOfficialLightRow(r))
        .filter(Boolean);

      const cleanInsertedSigns = insertedSigns
        .map((r) => normalizeOfficialSignRow(r))
        .filter(Boolean);

      // Merge + de-dupe by id
      setOfficialLights((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        for (const row of [...cleanExistingLights, ...cleanInsertedLights]) {
          const idx = next.findIndex((x) => x.id === row.id);
          if (idx >= 0) next[idx] = { ...next[idx], ...row };
          else next.push(row);
        }
        return next;
      });
      setOfficialSigns((prev) => {
        const next = Array.isArray(prev) ? [...prev] : [];
        for (const row of cleanInsertedSigns) {
          const idx = next.findIndex((x) => x.id === row.id);
          if (idx >= 0) next[idx] = { ...next[idx], ...row };
          else next.push(row);
        }
        return next;
      });

      setMappingQueue([]);
      const lightCount = cleanInsertedLights.length;
      const signCount = cleanInsertedSigns.length;
      if (lightCount > 0 && signCount > 0) {
        openNotice("✅", "Assets added successfully.", `${lightCount} light${lightCount === 1 ? "" : "s"}, ${signCount} sign${signCount === 1 ? "" : "s"}.`, { autoCloseMs: 1400 });
      } else if (signCount > 0) {
        openNotice("✅", "Signs added successfully.", "", { autoCloseMs: 1200 });
      } else if (lightCount > 0) {
        openNotice("✅", "Lights added successfully.", "", { autoCloseMs: 1200 });
      } else {
        openNotice("⚠️", "Nothing saved", "Queued lights already existed or no valid mapped assets were queued.");
      }
      if (duplicateLightCount > 0) {
        openNotice(
          "ℹ️",
          "Existing lights skipped",
          `${duplicateLightCount} queued light${duplicateLightCount === 1 ? "" : "s"} already existed and were not re-added.`,
          { autoCloseMs: 1800 }
        );
      }

      setSaving(false);
      return true;
    } catch (e) {
      console.error("[confirmMappingQueue] exception:", e);
      openNotice("⚠️", "Save failed", "Unexpected error saving mapped assets.");
      setSaving(false);
      return false;
    }
  }

  // Submit bulk reports
  async function submitBulkReports() {
  if (saving) return;

  if (Number(mapZoomRef.current || mapZoom) < REPORTING_MIN_ZOOM) {
    openNotice("🔎", "Zoom in to report", `Zoom in closer (level ${REPORTING_MIN_ZOOM}+) before submitting bulk reports.`);
    return;
  }

  const ids = bulkSelectedIds;
  if (!ids.length) return;
  if (ids.length > BULK_MAX_LIGHTS_PER_SUBMIT) {
    openNotice("⚠️", "Selection limit", `You can submit up to ${BULK_MAX_LIGHTS_PER_SUBMIT} lights in one bulk report.`);
    return;
  }
  

  // guests must have contact; authed users are never blocked
  const isAuthed = Boolean(session?.user?.id);
  const usingGuestBypass = !isAuthed && guestSubmitBypassRef.current;
  if (!isAuthed && !usingGuestBypass) {
    requestGuestChallenge("bulk");
    return;
  }
  const guestSource = usingGuestBypass ? guestInfoDraft : guestInfo;
  if (usingGuestBypass) guestSubmitBypassRef.current = false;

  const authedEmail = session?.user?.email || "";
  const authedName =
    (profile?.full_name || "").trim() ||
    (session?.user?.user_metadata?.full_name || "").trim() ||
    (authedEmail ? authedEmail.split("@")[0] : "User");

  const name = isAuthed ? authedName : (guestSource.name || "");
  const phone = isAuthed ? (profile?.phone || "") : (guestSource.phone || "");
  const email = isAuthed ? ((profile?.email || authedEmail) || "") : (guestSource.email || "");

  if (!isAuthed) {
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      requestGuestChallenge("bulk");
      return;
    }
  }

  const abuseGate = await registerAbuseEventWithServer({
    session,
    profile,
    guestInfo: isAuthed ? null : { name, phone, email },
    domain: "streetlights",
    // Bulk submit is one user action; count as one event for per-minute throttle.
    count: 1,
    unitCount: ids.length,
    bypass: false,
  });
  if (!abuseGate.allowed) {
    openRateLimitNotice(openNotice, abuseGate);
    return;
  }


  // close any popup + suppress popups while modal closes
  closeAnyPopup();
  suppressPopupsSafe(1600);

  setSaving(true);

  let okCount = 0;
  let skipAlreadyReported = 0;

  for (const lightId of ids) {
    // identity guard (one report per light since last fixed)
    const identityGuestInfo = isAuthed ? null : { name, phone, email };

    if (!canIdentityReportLight(lightId, {
      session,
      profile,
      guestInfo: identityGuestInfo,
      reports,
      fixedLights,
      lastFixByLightId,
    })) {
      skipAlreadyReported += 1;
      continue;
    }

    const ol = officialLights.find((x) => x.id === lightId);
    if (!ol) continue;

    // notes required rule
    if (reportType === "other" && !note.trim()) {
      openNotice("⚠️", "Notes required", "Please add a brief note for “Other”.");
      setSaving(false);
      return;
    }

    const payload = {
      lat: ol.lat,
      lng: ol.lng,
      report_type: reportType,
      report_quality: "bad",
      note: composeStreetlightQaNote(note, streetlightAreaPowerOn, streetlightHazardYesNo) || null,
      light_id: lightId,

      reporter_user_id: isAuthed ? session.user.id : null,
      reporter_name: name.trim(),
      reporter_phone: phone.trim() || null,
      reporter_email: email.trim() || null,
    };

    const { data, error: insErr } = await insertReportWithFallback(payload);

    if (insErr) {
      console.error(insErr);
      continue; // keep going; bulk shouldn’t fail entirely
    }

    okCount += 1;

    // optimistic local list (same shape you use)
    const saved = {
      id: data.id,
      lat: data.lat,
      lng: data.lng,
      type: data.report_type,
      report_quality: normalizeReportQuality(data.report_quality) || "bad",
      note: data.note || "",
      ts: new Date(data.created_at).getTime(),
      light_id: data.light_id || lightId,
      report_number: data.report_number || null,

      reporter_user_id: data.reporter_user_id || null,
      reporter_name: data.reporter_name || null,
      reporter_phone: data.reporter_phone || null,
      reporter_email: data.reporter_email || null,
    };

    setReports((prev) => [saved, ...prev]);
    // New save should show as saved-only (green) until user marks utility reported again.
    await clearUtilityReportedForViewer(saved.light_id || lightId);

    // update per-light cooldown
    if (!session?.user?.id) {
      setCooldowns((prev) => {
        const next = pruneCooldowns({ ...prev, [lightId]: Date.now() });
        saveCooldownsToStorage(next);
        return next;
      });
    }
  } // ✅ CLOSE the for-loop HERE

  setSaving(false);
  setBulkConfirmOpen(false);
  clearBulkSelection();
  setNote("");
  setStreetlightAreaPowerOn("");
  setStreetlightHazardYesNo("");
  if (!isAuthed) clearGuestContact();

  if (okCount > 0) {
    openNotice("✅", "Reports saved", `Saved ${okCount} report${okCount === 1 ? "" : "s"} to My Reports.`);
  } else if (skipAlreadyReported > 0) {
    openNotice("⏳", "Already reported", "Some selected lights were already reported by you and are waiting to be marked fixed.");
  } else {
    openNotice("⚠️", "No reports submitted", "Nothing was submitted. Try again.");
  }
}


  // Admin: optimistic add official light (no OK spam)
  async function addOfficialLight(lat, lng) {
    if (!isAdmin) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, sl_id: makeLightIdFromCoords(lat, lng), lat, lng };

    // Show immediately
    setOfficialLights((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("official_lights")
      .insert([{
        sl_id: makeLightIdFromCoords(lat, lng), // ✅ add this
        lat,
        lng,
        created_by: session?.user?.id
      }])
      .select("id, sl_id, lat, lng, nearest_address, nearest_cross_street, nearest_landmark")
      .single();

    if (error) {
      console.error(error);
      // Rollback optimistic
      setOfficialLights((prev) => prev.filter((x) => x.id !== tempId));
      openNotice("⚠️", "Insert failed", error.message || "Couldn’t add official light.");
      return;
    }

    // Replace temp with real
    setOfficialLights((prev) =>
      prev.map((x) => (x.id === tempId ? data : x))
    );
  }

  async function deleteOfficialLight(id) {
    if (!isAdmin) return;

    // ✅ close popup before mutating marker list
    closeAnyPopup();
    suppressPopupsSafe(1600);

    // ✅ snapshot must be a COPY, not the same array reference
    const snapshot = [...officialLights];

    // optimistic remove
    setOfficialLights((prev) => prev.filter((x) => x.id !== id));

    try {
      const { error } = await supabase.from("official_lights").delete().eq("id", id);

      if (error) {
        console.error(error);
        setOfficialLights(snapshot);
        openNotice("⚠️", "Couldn’t delete light", error.message || "Delete failed.");
      }
    } catch (err) {
      console.error(err);
      setOfficialLights(snapshot);
      openNotice("⚠️", "Couldn’t delete light", "Delete failed.");
    }
  }

  async function deleteOfficialLightsByIds(ids = []) {
    if (!isAdmin) return;
    const uniqueIds = Array.from(new Set((ids || []).map((x) => String(x || "").trim()).filter(Boolean)));
    if (!uniqueIds.length) {
      openNotice("⚠️", "No lights selected", "No lights were found in the selected circle.");
      return;
    }

    closeAnyPopup();
    suppressPopupsSafe(1600);
    setDeleteCircleConfirmOpen(false);
    setSaving(true);

    const snapshot = [...officialLights];
    const idSet = new Set(uniqueIds);
    setOfficialLights((prev) => prev.filter((x) => !idSet.has(String(x?.id || "").trim())));
    if (selectedOfficialId && idSet.has(String(selectedOfficialId || "").trim())) {
      setSelectedOfficialId(null);
    }

    try {
      const chunkSize = 200;
      for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        const { error } = await supabase.from("official_lights").delete().in("id", chunk);
        if (error) throw error;
      }
      setDeleteCircleDraft(null);
      openNotice(
        "✅",
        "Lights deleted",
        `${uniqueIds.length} official light${uniqueIds.length === 1 ? "" : "s"} deleted.`
      );
    } catch (err) {
      console.error(err);
      setOfficialLights(snapshot);
      openNotice("⚠️", "Couldn’t delete lights", err?.message || "Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  async function markIncidentsFixedByIds(ids = [], noteText = "") {
    if (!isAdmin) return;
    const uniqueIds = Array.from(new Set((ids || []).map((x) => String(x || "").trim()).filter(Boolean)));
    if (!uniqueIds.length) {
      openNotice("⚠️", "No incidents selected", "No report incidents were found in the selected circle.");
      return;
    }
    const noteClean = String(noteText || "").trim();
    closeAnyPopup();
    suppressPopupsSafe(1200);
    setDeleteCircleConfirmOpen(false);
    setSaving(true);
    try {
      for (const id of uniqueIds) {
        if (id.startsWith("pothole:")) {
          const pid = String(id.slice("pothole:".length) || "").trim();
          if (!pid) continue;
          const pothole = (potholes || []).find((p) => String(p?.id || "").trim() === pid);
          await markPotholeFixed(
            {
              pothole_id: pid,
              lat: Number(pothole?.lat || 0),
              lng: Number(pothole?.lng || 0),
              ph_id: String(pothole?.ph_id || "").trim() || makePotholeIdFromCoords(Number(pothole?.lat || 0), Number(pothole?.lng || 0)),
            },
            noteClean
          );
          continue;
        }
        await markFixed({ lightId: id, isOfficial: true }, noteClean);
      }
      setDeleteCircleDraft(null);
      setDeleteCircleNote("");
      openNotice(
        "✅",
        "Incidents marked fixed",
        `${uniqueIds.length} incident${uniqueIds.length === 1 ? "" : "s"} marked fixed.`
      );
    } catch (err) {
      console.error(err);
      openNotice("⚠️", "Couldn’t mark incidents fixed", err?.message || "Action failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOfficialSign(id) {
    if (!isAdmin) return;

    closeAnyPopup();
    suppressPopupsSafe(1600);

    const snapshot = [...officialSigns];
    setOfficialSigns((prev) => prev.filter((x) => x.id !== id));

    try {
      const { error } = await supabase.from("official_signs").delete().eq("id", id);
      if (error) {
        console.error(error);
        setOfficialSigns(snapshot);
        openNotice("⚠️", "Couldn’t delete sign", error.message || "Delete failed.");
      }
    } catch (err) {
      console.error(err);
      setOfficialSigns(snapshot);
      openNotice("⚠️", "Couldn’t delete sign", "Delete failed.");
    }
  }

  // CMD+F: function isLightFixed
  function isLightFixed(lightId) {
    const id = (lightId || "").trim();
    if (!id) return false;
    const lastFixTs = Math.max(lastFixByLightId?.[id] || 0, fixedLights?.[id] || 0);
    const sinceFixCount = Number(openIncidentCountByOfficialId?.[id] || 0);
    if (sinceFixCount > 0) return false;
    return Boolean(lastFixTs);
  }

  // CMD+F: function toggleFixed
  function toggleFixed(lightId) {
    const light = { lightId, isOfficial: true };
    if (isLightFixed(lightId)) return reopenLight(light);
    return markFixed(light);
  }

  function openMarkFixedDialogForLight(lightId, actionType = "fix", clusterReports = null) {
    const lid = String(lightId || "").trim();
    if (!lid) return;
    setPendingMarkFixedPotholeMarker(null);
    setPendingMarkFixedLightId(lid);
    setPendingMarkFixedClusterReports(Array.isArray(clusterReports) ? clusterReports : []);
    setPendingIncidentActionType(actionType === "reopen" ? "reopen" : "fix");
    setMarkFixedNote("");
    setMarkFixedConfirmOpen(true);
  }

  function openMarkFixedDialogForPothole(marker, actionType = "fix") {
    if (!marker) return;
    setPendingMarkFixedLightId(null);
    setPendingMarkFixedClusterReports([]);
    setPendingMarkFixedPotholeMarker(marker);
    setPendingIncidentActionType(actionType === "reopen" ? "reopen" : "fix");
    setMarkFixedNote("");
    setMarkFixedConfirmOpen(true);
  }

  async function markFixed(light, noteText = "") {
    if (!light) return;
    const noteClean = String(noteText || "").trim();
    const isOfficial = Boolean(light?.isOfficial);

    const ids = isOfficial
      ? [light.lightId] // official = single id (uuid)
      : uniqueLightIdsForCluster(light); // community cluster = many ids

    // 1) Write to light_actions for EACH affected light_id (this is the permanent history)
    const { data: actRows, error: actErr } = await insertLightActionsWithFallback(
      ids.map((id) => ({
        light_id: id,
        action: "fix",
        note: noteClean || null,
        actor_user_id: session?.user?.id || null,
      })),
      { selectCols: "light_id, created_at" }
    );

    if (actErr) {
      console.error(actErr);
      openNotice("⚠️", "Action failed", "Couldn’t record fix history.");
      return;
    }

    // Use server time from the newest insert row (they’ll be basically identical)
    const newest = (actRows || []).reduce((best, r) => {
      const t = new Date(r.created_at).getTime();
      return !best || t > best.t ? { t, iso: r.created_at } : best;
    }, null);

    const fixIso = newest?.iso || new Date().toISOString();
    const fixMs = new Date(fixIso).getTime();

    // 2) Update fixed_lights cache only for official streetlights.
    // Other domains (potholes/water/signs) rely on action log + lastFixByLightId.
    const allOfficialLights = ids.every((id) => officialIdSet.has(String(id || "").trim()));
    if (allOfficialLights) {
      const { error: fixErr } = await supabase
        .from("fixed_lights")
        .upsert(ids.map((id) => ({ light_id: id, fixed_at: fixIso })));

      if (fixErr) {
        console.error(fixErr);
        openNotice("⚠️", "Action failed", "Couldn’t update fixed state.");
        return;
      }
    }

    // 3) Update local state so UI reflects instantly
    setFixedLights((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = fixMs;
      return next;
    });

    setLastFixByLightId((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = fixMs;
      return next;
    });
    setIncidentStateByKey((prev) => {
      const next = { ...(prev || {}) };
      const nextIso = new Date(fixMs).toISOString();
      for (const id of ids) {
        const d = domainForIncidentId(id);
        const key = incidentSnapshotKey(d, id);
        if (!key) continue;
        next[key] = { state: "fixed", last_changed_at: nextIso };
      }
      return next;
    });
    setActionsByLightId((prev) => {
      const next = { ...(prev || {}) };
      for (const id of ids) {
        const list = Array.isArray(next[id]) ? [...next[id]] : [];
        list.unshift({
          action: "fix",
          ts: fixMs,
          note: noteClean || null,
          actor_user_id: session?.user?.id || null,
          actor_name:
            String(profile?.full_name || "").trim() ||
            String(session?.user?.user_metadata?.full_name || "").trim() ||
            String(session?.user?.email || "").split("@")[0] ||
            null,
          actor_email: normalizeEmail(session?.user?.email || profile?.email || "") || null,
          actor_phone: normalizePhone(profile?.phone || "") || null,
        });
        next[id] = list;
      }
      return next;
    });
    const idForMessage = String(ids?.[0] || "").trim();
    if (idForMessage.startsWith("water_drain_issues:")) {
      setSelectedDomainMarker(null);
      openNotice("✅", "Marked fixed", "Water / Drain issue marked fixed.");
    } else if (idForMessage.startsWith("street_signs:")) {
      setSelectedDomainMarker(null);
      openNotice("✅", "Marked fixed", "Street sign issue marked fixed.");
    } else if (idForMessage && !idForMessage.startsWith("pothole:")) {
      openNotice("✅", "Marked fixed", "Incident marked fixed.");
    }
  }


  async function reopenLight(light, noteText = "") {
    if (!light) return;
    const noteClean = String(noteText || "").trim();

    const isOfficial = Boolean(light?.isOfficial);

    const ids = isOfficial
      ? [light.lightId]
      : uniqueLightIdsForCluster(light);

    // 1) Record reopen history for each id
    const { error: logErr } = await supabase
      .from("light_actions")
      .insert(
        ids.map((id) => ({
          light_id: id,
          action: "reopen",
          note: noteClean || null,
          actor_user_id: session?.user?.id || null,
        }))
      );

    if (logErr) console.error(logErr);

    // 2) Clear fixed_lights cache
    const { error: reErr } = await supabase
      .from("fixed_lights")
      .delete()
      .in("light_id", ids);

    if (reErr) {
      console.error(reErr);
      openNotice("⚠️", "Action failed", "Couldn’t re-open this light.");
      return;
    }

    // 3) Update local state
    setFixedLights((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });

    setLastFixByLightId((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
    setActionsByLightId((prev) => {
      const next = { ...(prev || {}) };
      const ts = Date.now();
      for (const id of ids) {
        const list = Array.isArray(next[id]) ? [...next[id]] : [];
        list.unshift({
          action: "reopen",
          ts,
          note: noteClean || null,
          actor_user_id: session?.user?.id || null,
          actor_name:
            String(profile?.full_name || "").trim() ||
            String(session?.user?.user_metadata?.full_name || "").trim() ||
            String(session?.user?.email || "").split("@")[0] ||
            null,
          actor_email: normalizeEmail(session?.user?.email || profile?.email || "") || null,
          actor_phone: normalizePhone(profile?.phone || "") || null,
        });
        next[id] = list;
      }
      return next;
    });
    setIncidentStateByKey((prev) => {
      const next = { ...(prev || {}) };
      const tsIso = new Date().toISOString();
      for (const id of ids) {
        const d = domainForIncidentId(id);
        const key = incidentSnapshotKey(d, id);
        if (!key) continue;
        next[key] = { state: "reopened", last_changed_at: tsIso };
      }
      return next;
    });
    openNotice("✅", "Re-opened", "Incident re-opened.");
  }

  function openUtilityReportDialogForLight(lightId) {
    const lid = String(lightId || "").trim();
    if (!lid) return;
    if (!session?.user?.id) {
      openNotice("⚠️", "Login required", "Please sign in to track utility reporting on this light.");
      return;
    }
    setPendingUtilityReportLightId(lid);
    setPendingUtilityReportReference(String(utilityReportReferenceByLightId?.[lid] || "").trim());
    setUtilityReportDialogOpen(true);
  }

  function closeUtilityReportDialog() {
    setUtilityReportDialogOpen(false);
    setPendingUtilityReportLightId(null);
    setPendingUtilityReportReference("");
  }

  async function markUtilityReportedForViewer(lightId, reportReference = "") {
    const lid = String(lightId || "").trim();
    const uid = String(session?.user?.id || "").trim();
    if (!lid || !uid) return;
    const normalizedReference = normalizeUtilityReportReference(reportReference);
    const hadReported = utilityReportedLightIdSet.has(lid);
    const previousReference = String(utilityReportReferenceByLightId?.[lid] || "").trim();
    setUtilityReportedLightIdSet((prev) => {
      const next = new Set(prev || []);
      next.add(lid);
      return next;
    });
    setUtilityReportReferenceByLightId((prev) => ({
      ...(prev || {}),
      [lid]: normalizedReference,
    }));
    let { error } = await supabase
      .from("utility_report_status")
      .upsert(
        [{
          tenant_key: activeTenantKey(),
          user_id: uid,
          incident_id: lid,
          reported_at: new Date().toISOString(),
          report_reference: normalizedReference || null,
        }],
        { onConflict: "tenant_key,user_id,incident_id" }
      );
    if (error && isMissingUtilityReportReferenceColumnError(error)) {
      const fallback = await supabase
        .from("utility_report_status")
        .upsert(
          [{
            tenant_key: activeTenantKey(),
            user_id: uid,
            incident_id: lid,
            reported_at: new Date().toISOString(),
          }],
          { onConflict: "tenant_key,user_id,incident_id" }
        );
      error = fallback.error || null;
    }
    if (error) {
      console.warn("[utility_report_status] upsert warning:", error?.message || error);
      setUtilityReportedLightIdSet((prev) => {
        const next = new Set(prev || []);
        if (hadReported) next.add(lid);
        else next.delete(lid);
        return next;
      });
      setUtilityReportReferenceByLightId((prev) => {
        const next = { ...(prev || {}) };
        if (hadReported) next[lid] = previousReference;
        else delete next[lid];
        return next;
      });
      return false;
    }
    return true;
  }

  async function clearUtilityReportedForViewer(lightId) {
    const lid = String(lightId || "").trim();
    const uid = String(session?.user?.id || "").trim();
    if (!lid || !uid) return;
    setUtilityReportedLightIdSet((prev) => {
      const next = new Set(prev || []);
      next.delete(lid);
      return next;
    });
    setUtilityReportReferenceByLightId((prev) => {
      const next = { ...(prev || {}) };
      delete next[lid];
      return next;
    });
    const { error } = await supabase
      .from("utility_report_status")
      .delete()
      .eq("tenant_key", activeTenantKey())
      .eq("user_id", uid)
      .eq("incident_id", lid);
    if (error) {
      console.warn("[utility_report_status] clear warning:", error?.message || error);
    }
  }

  // Helper: always forces map camera move
  function flyToTarget(pos, zoom) {
    const lat = Number(pos?.[0]);
    const lng = Number(pos?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const map = mapRef.current;
    const targetZoom = Number.isFinite(Number(zoom)) ? Number(zoom) : Number(mapZoom);

    if (mapInteractIdleTimerRef.current) {
      clearTimeout(mapInteractIdleTimerRef.current);
      mapInteractIdleTimerRef.current = null;
    }
    setMapInteracting(true);

    if (!map) {
      setMapCenter({ lat, lng });
      if (Number.isFinite(targetZoom)) setMapZoom(targetZoom);
      mapInteractIdleTimerRef.current = setTimeout(() => {
        setMapInteracting(false);
        mapInteractIdleTimerRef.current = null;
      }, 750);
    } else {
      cancelFlyAnimation();

      const curCenter = map.getCenter?.();
      const startLat = Number(curCenter?.lat?.() ?? mapCenter.lat);
      const startLng = Number(curCenter?.lng?.() ?? mapCenter.lng);
      const startZoom = Number(map.getZoom?.() ?? mapZoom);
      const endZoom = Number.isFinite(targetZoom) ? targetZoom : startZoom;
      const t0 = performance.now();
      const duration = 650;
      const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

      const frame = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        const e = easeOutCubic(p);

        const clat = startLat + (lat - startLat) * e;
        const clng = startLng + (lng - startLng) * e;
        const cz = startZoom + (endZoom - startZoom) * e;

        try {
          if (map.moveCamera) {
            map.moveCamera({ center: { lat: clat, lng: clng }, zoom: cz });
          } else {
            map.panTo?.({ lat: clat, lng: clng });
            map.setZoom?.(cz);
          }
        } catch {
          // ignore
        }

        setMapCenter({ lat: clat, lng: clng });
        setMapZoom(cz);

        if (p < 1) {
          flyAnimRef.current = requestAnimationFrame(frame);
        } else {
          flyAnimRef.current = null;
          if (mapInteractIdleTimerRef.current) {
            clearTimeout(mapInteractIdleTimerRef.current);
            mapInteractIdleTimerRef.current = null;
          }
          mapInteractIdleTimerRef.current = setTimeout(() => {
            setMapInteracting(false);
            mapInteractIdleTimerRef.current = null;
          }, 750);
        }
      };

      flyAnimRef.current = requestAnimationFrame(frame);
    }

    // keep your existing nonce pattern too (safe if you still use mapTarget elsewhere)
    setMapTarget((prev) => ({
      pos: [lat, lng],
      zoom: targetZoom,
      nonce: (prev?.nonce || 0) + 1,
    }));
  }

  function flyToLightAndOpen(pos, zoom, lightId) {
    flyToTarget(pos, zoom);
    clearFlyInfoTimer();

    const lid = (lightId || "").trim();
    if (!lid || !officialIdSet?.has?.(lid)) return;

    flyInfoTimerRef.current = setTimeout(() => {
      setSelectedQueuedTempId(null);
      setSelectedDomainMarker(null);
      setSelectedOfficialId(lid);
      flyInfoTimerRef.current = null;
    }, 700);
  }

  function nudgeMapZoom(delta) {
    const map = mapRef.current;
    if (!map) return;
    const cur = Number(map.getZoom?.() ?? mapZoomRef.current ?? mapZoom);
    if (!Number.isFinite(cur)) return;
    const next = clamp(cur + delta, 3, 22);
    try {
      if (map.moveCamera) map.moveCamera({ zoom: next });
      else map.setZoom?.(next);
    } catch {
      // ignore
    }
    mapZoomRef.current = next;
    const rounded = Math.round(next);
    setMapZoom((prev) => (prev === rounded ? prev : rounded));
  }

  function moveFollowCamera({ lat, lng, heading, syncState = false }) {
    const map = mapRef.current;
    if (!map) return;

    const headingNum = Number(heading);
    const hasHeading = Number.isFinite(headingNum);
    const currentZoom = Number(map.getZoom?.() ?? mapZoomRef.current ?? LOCATE_ZOOM);
    const targetZoom = Number.isFinite(currentZoom) ? currentZoom : LOCATE_ZOOM;

    try {
      if (map.moveCamera) {
        const camera = {
          center: { lat, lng },
          zoom: targetZoom,
          tilt: 0,
        };
        // Preserve heading while stopped or when heading is unavailable.
        if (hasHeading) camera.heading = headingNum;
        map.moveCamera(camera);
      } else {
        map.setCenter?.({ lat, lng });
        map.setZoom?.(targetZoom);
        if (hasHeading) map.setHeading?.(headingNum);
      }
    } catch {
      // ignore
    }

    if (syncState) {
      setMapCenter({ lat, lng });
      if (Number.isFinite(targetZoom)) setMapZoom(Math.round(targetZoom));
    }
  }

  function queueFollowCameraTarget({ lat, lng, heading }) {
    followTargetRef.current = { lat, lng, heading };
    if (followRafRef.current) return;

    const step = () => {
      const map = mapRef.current;
      const target = followTargetRef.current;
      if (!map || !target || !followCamera) {
        followRafRef.current = null;
        return;
      }

      const targetLat = Number(target.lat);
      const targetLng = Number(target.lng);
      let targetHeading = Number(target.heading);
      if (!followHeadingEnabledRef.current) targetHeading = NaN;

      moveFollowCamera({
        lat: targetLat,
        lng: targetLng,
        heading: Number.isFinite(targetHeading) ? targetHeading : null,
        syncState: false,
      });

      const now = Date.now();
      if (now - lastFollowStateSyncRef.current >= 120) {
        setMapCenter({ lat: targetLat, lng: targetLng });
        const z = Number(map.getZoom?.() ?? mapZoomRef.current);
        if (Number.isFinite(z)) setMapZoom(Math.round(z));
        lastFollowStateSyncRef.current = now;
      }

      followRafRef.current = null;
    };

    followRafRef.current = requestAnimationFrame(step);
  }



  async function findMyLocation(force = false) {
    if (!window.isSecureContext) {
      openNotice("⚠️", "Needs HTTPS", "Location requires HTTPS. Use your ngrok HTTPS URL when testing.");
      return;
    }

    if (!navigator.geolocation) {
      openNotice("⚠️", "Location unavailable", "Location is not available on this device.");
      return;
    }

    // If previously denied, only proceed if forced
    if (geoDenied && !force) {
      setShowLocationPrompt(true);
      return;
    }

    // Best-effort: check permission state when available
    try {
      if (navigator.permissions?.query) {
        const status = await navigator.permissions.query({ name: "geolocation" });

        if (status.state === "denied" && !force) {
          setGeoDeniedPersist(true);
          setShowLocationPrompt(true);
          return;
        }

        if (status.state === "granted" && geoDenied) {
          setGeoDeniedPersist(false);
        }
      }
    } catch {
      // ignore
    }

    setLocating(true);
    // Explicit locate action re-enables heading orientation while tracking.
    followHeadingEnabledRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateUserLocUi(lat, lng, true);
        lastTrackedPosRef.current = { lat, lng };
        smoothedHeadingRef.current = null;
        lastFollowCameraRef.current = { lat, lng, heading: null };
        flyToTarget([lat, lng], LOCATE_ZOOM);

        setAutoFollow(true);
        setFollowCamera(true);

        if (geoDenied) setGeoDeniedPersist(false);
        setLocating(false);
      },
      (err) => {
        setLocating(false);

        const code = Number(err?.code);
        if (code === 1) {
          setGeoDeniedPersist(true);
          setShowLocationPrompt(true);
          openNotice("⚠️", "Location denied", "Unable to access location. You can still pan and tap the map.");
          return;
        }

        // Timeout/unavailable are not permission denials.
        setGeoDeniedPersist(false);

        if (code === 3) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              const lat = fallbackPos.coords.latitude;
              const lng = fallbackPos.coords.longitude;
              updateUserLocUi(lat, lng, true);
              lastTrackedPosRef.current = { lat, lng };
              flyToTarget([lat, lng], LOCATE_ZOOM);
              setAutoFollow(true);
              setFollowCamera(true);
            },
            () => {
              openNotice("⚠️", "Location timeout", "Couldn’t get GPS quickly. Try again in a clearer area.");
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 10000 }
          );
          return;
        }

        if (code === 2) {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              const lat = fallbackPos.coords.latitude;
              const lng = fallbackPos.coords.longitude;
              updateUserLocUi(lat, lng, true);
              lastTrackedPosRef.current = { lat, lng };
              flyToTarget([lat, lng], LOCATE_ZOOM);
              setAutoFollow(true);
              setFollowCamera(true);
            },
            () => {
              openNotice("⚠️", "Location unavailable", "Your device could not determine location right now.");
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
          );
          return;
        }

        openNotice("⚠️", "Location error", "Could not determine your location right now.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }


  // Watch position (smoother + heading updates)
  useEffect(() => {
    if (!autoFollow) return;
    if (!window.isSecureContext || !navigator.geolocation) return;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const nextPos = { lat, lng };
        const prevPos = lastTrackedPosRef.current;
        const ts = Number(pos?.timestamp) || Date.now();
        const accuracyM = Number(pos?.coords?.accuracy);

        updateUserLocUi(lat, lng, false);
        lastTrackedPosRef.current = nextPos;

        const rawSpeed = Number(pos?.coords?.speed);
        let speedMps = Number.isFinite(rawSpeed) && rawSpeed >= 0 ? rawSpeed : NaN;
        const headingFreezeMps = 1.6; // ~3.6 mph
        const headingHeavyDampMps = 3.6; // ~8 mph

        const prevMotionTs = Number(liveMotionRef.current?.ts);
        if ((!Number.isFinite(speedMps) || speedMps < 0) && prevPos && Number.isFinite(prevMotionTs)) {
          const dtSec = (ts - prevMotionTs) / 1000;
          if (dtSec > 0.2) speedMps = metersBetween(prevPos, nextPos) / dtSec;
        }

        let heading = Number(pos?.coords?.heading);
        if (!Number.isFinite(heading) || heading < 0) {
          if (prevPos) {
            const movedMeters = metersBetween(prevPos, nextPos);
            if (movedMeters >= 4) heading = bearingBetween(prevPos, nextPos);
          }
        }

        if (Number.isFinite(heading)) {
          const prev = smoothedHeadingRef.current;
          if (!Number.isFinite(prev)) {
            if (!Number.isFinite(speedMps) || speedMps >= headingFreezeMps) {
              smoothedHeadingRef.current = heading;
            }
          } else {
            const speedForSmoothing = Number.isFinite(speedMps) ? speedMps : 0;
            const headingAlpha =
              speedForSmoothing >= 12 ? 0.62 :
              speedForSmoothing >= 6 ? 0.48 :
              speedForSmoothing >= headingHeavyDampMps ? 0.32 :
              0.20;
            const delta = ((heading - prev + 540) % 360) - 180;
            const headingDeadband =
              speedForSmoothing >= 12 ? 0.8 :
              speedForSmoothing >= 6 ? 1.2 :
              speedForSmoothing >= headingHeavyDampMps ? 2 :
              5;
            if (speedForSmoothing >= headingFreezeMps && Math.abs(delta) >= headingDeadband) {
              smoothedHeadingRef.current = (prev + delta * headingAlpha + 360) % 360;
            }
          }
        }

        const speedForHeading = Number.isFinite(speedMps) ? speedMps : 0;
        const effectiveHeading =
          speedForHeading < headingFreezeMps
            ? Number(liveMotionRef.current?.heading)
            : (Number.isFinite(smoothedHeadingRef.current) ? smoothedHeadingRef.current : heading);

        liveMotionRef.current = {
          lat,
          lng,
          heading: Number.isFinite(effectiveHeading)
            ? effectiveHeading
            : Number(liveMotionRef.current?.heading),
          speed: Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0,
          ts,
        };

        if (followCamera) {
          const speedForThresholds = Number.isFinite(speedMps) && speedMps > 0 ? speedMps : 0;
          const poorAccuracySmallMove =
            Number.isFinite(accuracyM) &&
            accuracyM > 25 &&
            prevPos &&
            metersBetween(prevPos, nextPos) < Math.min(accuracyM * 0.5, 18);

          const last = lastFollowCameraRef.current;
          const movedMeters = Number.isFinite(last.lat) && Number.isFinite(last.lng)
            ? metersBetween({ lat: last.lat, lng: last.lng }, nextPos)
            : Infinity;

          const headingDelta = !followHeadingEnabledRef.current
            ? 0
            : Number.isFinite(last.heading) && Number.isFinite(effectiveHeading)
              ? Math.abs(((effectiveHeading - last.heading + 540) % 360) - 180)
              : Infinity;

          const moveTriggerMeters =
            Number.isFinite(accuracyM) && accuracyM > 40 ? 3 :
            Number.isFinite(accuracyM) && accuracyM > 20 ? 2 :
            speedForThresholds >= 12 ? 1.5 :
            speedForThresholds >= 6 ? 1.2 :
            speedForThresholds >= headingHeavyDampMps ? 2.2 : 3.2;
          const headingTriggerDeg =
            speedForThresholds >= 12 ? 3 :
            speedForThresholds >= 6 ? 4 :
            speedForThresholds >= headingHeavyDampMps ? 8 :
            14;

          if (!poorAccuracySmallMove && (movedMeters >= moveTriggerMeters || headingDelta >= headingTriggerDeg || !followTargetRef.current)) {
            const queuedHeading =
              (followHeadingEnabledRef.current && speedForThresholds >= headingFreezeMps)
                ? effectiveHeading
                : null;
            queueFollowCameraTarget({ lat, lng, heading: queuedHeading });
            lastFollowCameraRef.current = { lat, lng, heading: queuedHeading };
          }
        }
      },
      (err) => {
        const code = Number(err?.code);
        if (code === 1) {
          setAutoFollow(false);
          setGeoDeniedPersist(true);
          setShowLocationPrompt(true);
          openNotice("⚠️", "Location denied", "Location access was blocked.");
          return;
        }

        // Keep current mode; non-permission errors should not lock user into denied state.
        setGeoDeniedPersist(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
    );

    return () => {
      try { navigator.geolocation.clearWatch(id); } catch {}
    };
  }, [autoFollow, followCamera]);

  useEffect(() => () => {
    cancelFlyAnimation();
    clearFlyInfoTimer();
    stopFollowCameraAnimation();
  }, []);

  useEffect(() => {
    if (followCamera) return;
    stopFollowCameraAnimation();
  }, [followCamera]);


  // -------------------------
  // Render
  // -------------------------

  // ✅ Load Google Maps JS before rendering <GoogleMap />
  // Uses Vite env var: VITE_GOOGLE_MAPS_API_KEY
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: GMAPS_ACTIVE_KEY,
    libraries: GMAPS_LIBRARIES,
  });

  // -------------------------
  // Popup button styles (Google InfoWindow)
  // -------------------------
  const btnPopupPrimary = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "none",
    background: "var(--sl-ui-brand-blue)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
  };

  const btnPopupSecondary = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: "var(--sl-ui-modal-btn-secondary-bg)",
    color: "var(--sl-ui-modal-btn-secondary-text)",
    fontWeight: 900,
    cursor: "pointer",
  };
  const mapAlertsUnreadCount = useMemo(
    () => countUnreadMapCommunityFeedItems(mapCommunityAlerts, mapCommunityFeedReadState, "alerts"),
    [mapCommunityAlerts, mapCommunityFeedReadState]
  );
  const mapEventsUnreadCount = useMemo(
    () => countUnreadMapCommunityFeedItems(mapCommunityEvents, mapCommunityFeedReadState, "events"),
    [mapCommunityEvents, mapCommunityFeedReadState]
  );
  const markerPopupCardStyle = {
    minWidth: 210,
    display: "grid",
    gap: 8,
    background: "var(--sl-ui-modal-bg)",
    border: "1px solid var(--sl-ui-modal-border)",
    borderRadius: 12,
    boxShadow: "var(--sl-ui-modal-shadow)",
    padding: 10,
    color: "var(--sl-ui-text)",
  };
  const markerPopupActionSecondary = {
    ...btnPopupSecondary,
    padding: "8px 10px",
    borderRadius: 9,
  };
  const markerPopupActionPrimary = {
    ...btnPopupPrimary,
    padding: "8px 10px",
    borderRadius: 9,
  };
  const markerPopupActionDanger = {
    ...markerPopupActionPrimary,
    background: "#d32f2f",
  };
  const markerPopupCopyValueStyle = {
    wordBreak: "break-word",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    color: "#7fd7ff",
    fontWeight: 700,
  };
  const markerPopupCopyRowStyle = {
    borderRadius: 7,
    padding: "2px 4px",
    cursor: "copy",
    userSelect: "text",
    fontSize: 12,
    opacity: 0.92,
    lineHeight: 1.35,
  };

  const canShowOfficialLightsByZoom = true;
  const showOfficialLights = canShowOfficialLightsByZoom;
  const adminDomainMeta =
    visibleDomainOptions.find((d) => d.key === adminReportDomain) || visibleDomainOptions[0] || REPORT_DOMAIN_OPTIONS[0];
  const domainMarkerColor = adminReportDomain === "potholes"
    ? "#8e24aa"
    : adminReportDomain === "street_signs"
      ? "#1e88e5"
    : adminReportDomain === "water_drain_issues"
      ? "#0288d1"
    : adminReportDomain === "power_outage"
      ? "#d32f2f"
      : adminReportDomain === "water_main"
        ? "#1e88e5"
        : "#111";
  const isSavedStreetlightFilterOn = isStreetlightsDomain && streetlightInViewFilterMode === "saved";
  const isUtilityStreetlightFilterOn = isStreetlightsDomain && streetlightInViewFilterMode === "utility";
  const inViewCounterColor = "var(--sl-ui-text)";
  const inViewCounterBg = "var(--sl-ui-surface-bg)";
  const inViewCounterBorder = "var(--sl-ui-surface-border)";

  useEffect(() => {
    mapZoomRef.current = mapZoom;
  }, [mapZoom]);

  useEffect(() => {
    return () => {
      if (dragFollowOffTimerRef.current) {
        clearTimeout(dragFollowOffTimerRef.current);
        dragFollowOffTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (canShowOfficialLightsByZoom) return;
    if (selectedOfficialId) setSelectedOfficialId(null);
  }, [canShowOfficialLightsByZoom, selectedOfficialId]);

  useEffect(() => {
    if (isStreetlightsDomain || isStreetSignsDomain) return;
    if (bulkMode) {
      setBulkMode(false);
      setBulkConfirmOpen(false);
      clearBulkSelection();
    }
    if (mappingMode) {
      setMappingMode(false);
      setMappingQueue([]);
    }
    if (openReportMapFilterOn) setOpenReportMapFilterOn(false);
    if (streetlightInViewFilterMode) setStreetlightInViewFilterMode("");
    if (selectedOfficialId) setSelectedOfficialId(null);
  }, [
    isStreetlightsDomain,
    isStreetSignsDomain,
    bulkMode,
    mappingMode,
    openReportMapFilterOn,
    streetlightInViewFilterMode,
    selectedOfficialId,
    clearBulkSelection,
  ]);

  useEffect(() => {
    if (isAdmin) return;
    if (!deleteCircleMode && !deleteCircleDraft && !deleteCircleConfirmOpen) return;
    setDeleteCircleMode(false);
    setDeleteCircleDraft(null);
    setDeleteCircleConfirmOpen(false);
    setDeleteCircleNote("");
  }, [isAdmin, deleteCircleMode, deleteCircleDraft, deleteCircleConfirmOpen]);

  useEffect(() => {
    if (canUseStreetlightBulk || !bulkMode) return;
    setBulkMode(false);
    setBulkConfirmOpen(false);
    clearBulkSelection();
  }, [canUseStreetlightBulk, bulkMode, clearBulkSelection]);

  const beginMapInteraction = useCallback(() => {
    if (mapInteractIdleTimerRef.current) {
      clearTimeout(mapInteractIdleTimerRef.current);
      mapInteractIdleTimerRef.current = null;
    }
    setMapInteracting((prev) => (prev ? prev : true));
  }, []);

  const endMapInteractionSoon = useCallback((delayMs = 80) => {
    if (mapInteractIdleTimerRef.current) {
      clearTimeout(mapInteractIdleTimerRef.current);
    }
    mapInteractIdleTimerRef.current = setTimeout(() => {
      setMapInteracting(false);
      mapInteractIdleTimerRef.current = null;
    }, delayMs);
  }, []);

  useEffect(() => () => {
    if (mapInteractIdleTimerRef.current) {
      clearTimeout(mapInteractIdleTimerRef.current);
      mapInteractIdleTimerRef.current = null;
    }
    if (toolHintTimerRef.current) {
      clearTimeout(toolHintTimerRef.current);
      toolHintTimerRef.current = null;
    }
  }, []);

  if (!GMAPS_ACTIVE_KEY) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        Google Maps key is missing. Set `VITE_GOOGLE_MAPS_API_KEY` (and optionally `VITE_GOOGLE_MAPS_API_KEY_DEV` for localhost/ngrok).
      </div>
    );
  }

  if (loadError || googleMapsAuthError) {
    const activeHost = typeof window !== "undefined" ? String(window.location.host || "").trim() : "";
    const referrerHint = activeHost
      ? `${typeof window !== "undefined" ? window.location.protocol : "https:"}//${activeHost}/*`
      : "(your-current-host)/*";
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        <div style={{ marginBottom: 8 }}>
          {googleMapsAuthError || "Google Maps failed to load. Check API key and referrer restrictions."}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          Add this referrer in Google Cloud Console for your browser key:
          <div style={{ marginTop: 4, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{referrerHint}</div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ padding: 16, fontFamily: "system-ui" }}>
        Loading map…
      </div>
    );
  }

  return (
    <div
      className="sl-root"
      style={{
        position: "fixed",
        inset: 0,
        height: "100dvh",
        minHeight: "100vh",
        width: "100%",
        maxWidth: "100%",
        overflow: "hidden",
      }}
    >
      <style>{`
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow: hidden;
          overscroll-behavior: none;
          -webkit-overflow-scrolling: auto;
          background: #fff;
        }
        #root {
          height: 100%;
          width: 100%;
          overflow: hidden;
        }

        :root {
          --sl-ui-brand-green: #2a7262;
          --sl-ui-brand-green-border: #2a7262;
          --sl-ui-brand-blue: #1a3153;
          --sl-ui-brand-blue-border: #1a3153;
          --sl-ui-surface-bg: rgba(255,255,255,0.96);
          --sl-ui-surface-border: rgba(0,0,0,0.10);
          --sl-ui-surface-shadow: 0 10px 22px rgba(0,0,0,0.18);
          --sl-ui-surface-shadow-bottom: 0 -10px 22px rgba(0,0,0,0.18);
          --sl-ui-text: #111;
          --sl-ui-zoom-bg: rgba(255,255,255,0.96);
          --sl-ui-zoom-border: rgba(0,0,0,0.28);
          --sl-ui-zoom-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 18px rgba(0,0,0,0.22);
          --sl-ui-zoom-shadow-mobile: inset 0 1px 0 rgba(255,255,255,0.75), 0 6px 14px rgba(0,0,0,0.22);
          --sl-ui-tool-btn-bg: rgba(255,255,255,0.96);
          --sl-ui-tool-btn-border: rgba(0,0,0,0.34);
          --sl-ui-tool-btn-shadow: inset 0 1px 0 rgba(255,255,255,0.78), inset 0 -2px 0 rgba(0,0,0,0.10), 0 4px 10px rgba(0,0,0,0.22), 0 10px 18px rgba(0,0,0,0.14);
          --sl-ui-modal-bg: rgba(255,255,255,0.98);
          --sl-ui-modal-border: rgba(0,0,0,0.12);
          --sl-ui-modal-shadow: 0 10px 30px rgba(0,0,0,0.25);
          --sl-ui-modal-input-bg: #fff;
          --sl-ui-modal-input-border: #ddd;
          --sl-ui-modal-btn-secondary-bg: #fff;
          --sl-ui-modal-btn-secondary-border: rgba(0,0,0,0.18);
          --sl-ui-modal-btn-secondary-text: #111;
          --sl-ui-modal-btn-dark-bg: #111;
          --sl-ui-modal-btn-dark-text: #fff;
          --sl-ui-modal-subtle-bg: rgba(0,0,0,0.02);
          --sl-ui-alert-danger-bg: rgba(183,28,28,0.08);
          --sl-ui-alert-danger-border: rgba(183,28,28,0.35);
          --sl-ui-alert-danger-text: #b71c1c;
          --sl-ui-open-reports-item-border: rgba(0,0,0,0.10);
          --sl-ui-metrics-panel-border: rgba(0,0,0,0.22);
          --sl-ui-tool-active-bg: var(--sl-ui-brand-green);
          --sl-ui-tool-active-border: var(--sl-ui-brand-green-border);
          --sl-ui-tool-active-text: #fff;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --sl-ui-surface-bg: rgba(28,31,35,0.94);
            --sl-ui-surface-border: rgba(255,255,255,0.12);
            --sl-ui-surface-shadow: 0 12px 28px rgba(0,0,0,0.45);
            --sl-ui-surface-shadow-bottom: 0 -12px 26px rgba(0,0,0,0.42);
            --sl-ui-text: #f3f5f7;
            --sl-ui-zoom-bg: rgba(28,31,35,0.94);
            --sl-ui-zoom-border: rgba(255,255,255,0.24);
            --sl-ui-zoom-shadow: inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.24), 0 10px 22px rgba(0,0,0,0.50), 0 2px 6px rgba(0,0,0,0.26);
            --sl-ui-zoom-shadow-mobile: inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.24), 0 8px 18px rgba(0,0,0,0.50), 0 2px 5px rgba(0,0,0,0.24);
            --sl-ui-tool-btn-bg: rgba(28,31,35,0.94);
            --sl-ui-tool-btn-border: rgba(255,255,255,0.22);
            --sl-ui-tool-btn-shadow: inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.24), 0 4px 10px rgba(0,0,0,0.42), 0 10px 18px rgba(0,0,0,0.34), 0 1px 3px rgba(0,0,0,0.22);
            --sl-ui-modal-bg: rgba(28,31,35,0.96);
            --sl-ui-modal-border: rgba(255,255,255,0.14);
            --sl-ui-modal-shadow: 0 14px 34px rgba(0,0,0,0.45);
            --sl-ui-modal-input-bg: rgba(44,49,55,0.98);
            --sl-ui-modal-input-border: rgba(255,255,255,0.14);
            --sl-ui-modal-btn-secondary-bg: rgba(44,49,55,0.98);
            --sl-ui-modal-btn-secondary-border: rgba(255,255,255,0.16);
            --sl-ui-modal-btn-secondary-text: #f3f5f7;
            --sl-ui-modal-btn-dark-bg: rgba(68,74,82,0.98);
            --sl-ui-modal-btn-dark-text: #f3f5f7;
            --sl-ui-modal-subtle-bg: rgba(255,255,255,0.03);
            --sl-ui-alert-danger-bg: rgba(183,28,28,1);
            --sl-ui-alert-danger-border: rgba(183,28,28,0.455);
            --sl-ui-alert-danger-text: #fff;
            --sl-ui-open-reports-item-border: #ffffff;
            --sl-ui-metrics-panel-border: rgba(255,255,255,0.46);
          }

          .sl-map-tool .sl-map-tool-mini.is-on,
          .sl-map-tool .sl-map-tool-btn.is-on {
            box-shadow:
              inset 0 1px 0 rgba(255,255,255,0.16),
              inset 0 -2px 0 rgba(0,0,0,0.28),
              0 4px 10px rgba(0,0,0,0.44),
              0 10px 18px rgba(0,0,0,0.34) !important;
          }
        }

        .sl-overlay-pass { pointer-events: none; }
        .sl-overlay-pass > * { pointer-events: auto; }

        .sl-desktop-panel { pointer-events: auto; }

        .sl-desktop-only { display: block; }
        .sl-mobile-only { display: none; }
        @media (max-width: 640px) {
          .sl-desktop-only { display: none; }
          .sl-mobile-only { display: block; }
        }

        .sl-map-tool {
          position: fixed;
          top: 50%;
          right: 14px;
          transform: translateY(-50%);
          z-index: 2200;
          pointer-events: auto;
          display: grid;
          gap: 8px;
          justify-items: end;
        }

        .sl-map-tool-left {
          position: fixed;
          top: 50%;
          left: 14px;
          transform: translateY(-50%);
          z-index: 2200;
          pointer-events: auto;
          display: grid;
          gap: 8px;
          justify-items: start;
        }

        .sl-map-tool-btn {
          width: 48px;
          height: 48px;
          border-radius: 13px;
          border: 1px solid var(--sl-ui-tool-btn-border);
          background: var(--sl-ui-tool-btn-bg);
          box-shadow: var(--sl-ui-tool-btn-shadow);
          display: grid;
          place-items: center;
          padding: 0;
          line-height: 1;
          font-size: 20px;
          font-weight: 900;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          touch-action: manipulation;
        }

        .sl-map-tool-btn.is-on {
          background: rgba(17,17,17,0.92);
          color: white;
          border: 1px solid rgba(0,0,0,0.35);
        }

        .sl-map-tool-mini {
          width: 48px;
          height: 48px;
          border-radius: 13px;
          border: 1px solid var(--sl-ui-tool-btn-border);
          background: var(--sl-ui-tool-btn-bg);
          box-shadow: var(--sl-ui-tool-btn-shadow);
          display: grid;
          place-items: center;
          padding: 0;
          line-height: 1;
          font-size: 18px;
          font-weight: 950;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          touch-action: manipulation;
        }

        .sl-map-tool-mini.is-on {
          background: rgba(17,17,17,0.92);
          color: white;
          border: 1px solid rgba(0,0,0,0.35);
        }

        .sl-map-tool-mini.sl-has-submenu {
          position: relative;
          overflow: visible;
        }

        .sl-map-tool-mini.sl-has-submenu::after {
          content: "";
          position: absolute;
          right: 6px;
          bottom: 6px;
          width: 3px;
          height: 3px;
          border-radius: 999px;
          background: #1976d2;
          box-shadow: -4px 0 0 #1976d2, -8px 0 0 #1976d2;
          opacity: 0.95;
          pointer-events: none;
        }

        .sl-map-tool .sl-bulk-tool-btn.is-on,
        .sl-map-tool .sl-account-btn.signed-in {
          background: var(--sl-ui-tool-active-bg) !important;
          color: var(--sl-ui-tool-active-text) !important;
          border: 1px solid var(--sl-ui-tool-active-border) !important;
        }

        .sl-map-tool-btn img,
        .sl-map-tool-mini img {
          display: block;
          margin: 0 auto;
        }

        .sl-map-tool-hint {
          font-size: 11px;
          font-weight: 900;
          background: rgba(17,17,17,0.88);
          color: white;
          padding: 6px 8px;
          border-radius: 10px;
          width: max-content;
          max-width: 240px;
          box-shadow: 0 10px 22px rgba(0,0,0,0.18);
          animation: sl-tool-hint-fade 1100ms ease forwards;
        }

        @keyframes sl-tool-hint-fade {
          0% { opacity: 0; transform: translateY(-2px); }
          12% { opacity: 1; transform: translateY(0); }
          72% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-3px); }
        }
      `}</style>

      <AuthGateModal
        open={authGateOpen && !session}
        step={authGateStep}
        setStep={setAuthGateStep}
        onContinueGuest={() => {
          setAuthGateOpen(false);
          setAuthGateStep("welcome");
          setSignupLegalAccepted(false);
        }}

        authEmail={authEmail}
        setAuthEmail={setAuthEmail}
        authPassword={authPassword}
        setAuthPassword={setAuthPassword}
        authLoading={authLoading}
        loginError={loginError}
        clearLoginError={() => setLoginError("")}
        onOpenForgotPassword={openForgotPasswordModal}
        onLogin={async () => {
          const ok = await signIn();
          if (!ok) return;

          setAuthGateOpen(false);
          setAuthGateStep("welcome");
        }}

        signupName={signupName}
        setSignupName={setSignupName}
        signupPhone={signupPhone}
        setSignupPhone={setSignupPhone}
        signupEmail={signupEmail}
        setSignupEmail={setSignupEmail}
        signupPassword={signupPassword}
        setSignupPassword={setSignupPassword}
        signupPassword2={signupPassword2}
        setSignupPassword2={setSignupPassword2}
        signupLoading={signupLoading}
        signupLegalAccepted={signupLegalAccepted}
        setSignupLegalAccepted={setSignupLegalAccepted}
        onOpenTerms={() => setTermsOpen(true)}
        onOpenPrivacy={() => setPrivacyOpen(true)}
        onCreateAccount={handleCreateAccount}
      />

      <TermsOfUseModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
      />

      <PrivacyPolicyModal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
      />

      <ForgotPasswordModal
        open={forgotPasswordOpen}
        email={forgotPasswordEmail}
        setEmail={(v) => { setForgotPasswordEmail(v); if (forgotPasswordError) setForgotPasswordError(""); }}
        loading={authResetLoading}
        errorText={forgotPasswordError}
        onSend={sendPasswordReset}
        onClose={() => {
          if (authResetLoading) return;
          setForgotPasswordOpen(false);
          setForgotPasswordError("");
        }}
      />

      <GuestInfoModal
        open={guestInfoOpen}
        info={guestInfoDraft}
        setInfo={setGuestInfoDraft}
        onCancel={() => {
          setGuestInfoOpen(false);
          setPendingSubmit(false);
          setPendingGuestAction(null);
        }}
        onContinue={() => {
          setGuestInfo({
            name: String(guestInfoDraft?.name || ""),
            phone: String(guestInfoDraft?.phone || ""),
            email: String(guestInfoDraft?.email || ""),
          });
          guestSubmitBypassRef.current = true;
          setGuestInfoOpen(false);
          setAuthGateOpen(false);
          setAuthGateStep("welcome");
          resumePendingGuestAction();
        }}
      />

      <LocationPromptModal
        open={showLocationPrompt}
        onEnable={async () => {
          await findMyLocation(true);  // ✅ forced retry
          setShowLocationPrompt(false);
        }}
        onSkip={() => {
          setShowLocationPrompt(false);
        }}
      />

      <ContactRequiredModal
        open={contactChoiceOpen}
        onClose={() => {
          setContactChoiceOpen(false);
          setPendingSubmit(false);
          setPendingGuestAction(null);
        }}
        onLogin={() => {
          setContactChoiceOpen(false);
          setAuthGateStep("login");
          setAuthGateOpen(true);
        }}
        onSignup={() => {
          setContactChoiceOpen(false);
          setAuthGateStep("signup");
          setAuthGateOpen(true);
        }}
        onGuest={() => {
          const pendingKind = String(pendingGuestAction?.kind || "").trim().toLowerCase();
          const fromStreetlightSaveFlow =
            pendingKind === "report" ||
            pendingKind === "bulk" ||
            Boolean(activeLight) ||
            Boolean(bulkConfirmOpen);
          if (fromStreetlightSaveFlow) {
            setContactChoiceOpen(false);
            setPendingSubmit(false);
            setPendingGuestAction(null);
            openNotice("⚠️", "Account required", "Account Required to Save Light");
            return;
          }
          setContactChoiceOpen(false);
          setGuestInfoDraft({
            name: "",
            phone: "",
            email: "",
          });
          setGuestInfoOpen(true);
        }}
      />

      <InfoMenuModal
        open={infoMenuOpen}
        onClose={() => setInfoMenuOpen(false)}
        isAdmin={isAdmin}
        onOpenTerms={() => setTermsOpen(true)}
        onOpenPrivacy={() => setPrivacyOpen(true)}
      />

      <NoticeModal
        open={notice.open}
        icon={notice.icon}
        title={notice.title}
        message={notice.message}
        compact={notice.compact}
        buttonText="OK"
        onClose={closeNotice}
      />

      <ModalShell open={exitMappingConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Save queued assets?</div>

          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            You have <b>{mappingQueue.length}</b> queued asset{mappingQueue.length === 1 ? "" : "s"}.
            Save them before turning mapping off?
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <button
              type="button"
              onClick={async () => {
                const ok = await confirmMappingQueue();
                if (!ok) return; // keep modal open if insert failed
                setExitMappingConfirmOpen(false);
                exitMappingMode();
              }}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-green)",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Placing…" : "Place & Turn Off"}
            </button>

            <button
              type="button"
              onClick={() => {
                setExitMappingConfirmOpen(false);
                exitMappingMode(); // discard queue
              }}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "#d32f2f",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Discard & Turn Off
            </button>

            <button
              type="button"
              onClick={() => setExitMappingConfirmOpen(false)}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={clearQueuedConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Clear queued assets?</div>

          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Remove <b>{mappingQueue.length}</b> queued asset{mappingQueue.length === 1 ? "" : "s"} that have not been saved yet?
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={confirmClearQueuedLights}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "#d32f2f",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Clear Queued Assets
            </button>

            <button
              type="button"
              onClick={() => setClearQueuedConfirmOpen(false)}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={domainSwitchConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Switch report domain?</div>

          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            You have <b>{mappingQueue.length}</b> queued asset{mappingQueue.length === 1 ? "" : "s"} in mapping mode.
            Place or clear queued assets before switching to <b>{String(pendingDomainSwitchTarget?.label || "the selected domain")}</b>.
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={placeQueuedAndSwitchDomain}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-green)",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Placing..." : "Place & Switch"}
            </button>

            <button
              type="button"
              onClick={clearQueuedAndSwitchDomain}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "#d32f2f",
                color: "white",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Clear & Switch
            </button>

            <button
              type="button"
              onClick={cancelAdminDomainSwitch}
              disabled={saving}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={queueSignTypeOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>Select sign type</div>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.35 }}>
            Choose the official sign type before adding this asset to the queue.
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, opacity: 0.9 }}>Sign type</span>
            <select
              value={String(pendingQueuedSign?.sign_type || "")}
              onChange={(e) =>
                setPendingQueuedSign((prev) =>
                  prev
                    ? { ...prev, sign_type: String(e.target.value || "").trim().toLowerCase() }
                    : prev
                )
              }
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
                fontWeight: 700,
              }}
            >
              <option value="" disabled>
                Select sign type...
              </option>
              {STREET_SIGN_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gap: 8, marginTop: 2 }}>
            <button
              type="button"
              onClick={confirmQueueOfficialSign}
              disabled={!STREET_SIGN_TYPE_VALUES.has(String(pendingQueuedSign?.sign_type || "").trim().toLowerCase())}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-green)",
                color: "white",
                fontWeight: 900,
                cursor: STREET_SIGN_TYPE_VALUES.has(String(pendingQueuedSign?.sign_type || "").trim().toLowerCase()) ? "pointer" : "not-allowed",
                opacity: STREET_SIGN_TYPE_VALUES.has(String(pendingQueuedSign?.sign_type || "").trim().toLowerCase()) ? 1 : 0.6,
              }}
            >
              Add to Queue
            </button>
            <button
              type="button"
              onClick={cancelQueueOfficialSign}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={potholeAdvisoryOpen} zIndex={10013}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 950, fontSize: 16 }}>🚨 Pothole Reporting Notice</div>

          <div style={{ fontSize: 15, opacity: 0.95, lineHeight: 1.45 }}>
            If you need to report damage to your vehicle from a pothole, you will need to file a police report as soon as possible, then bring this information to the City Manager's Office.
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                const next = pendingPotholeDomainTarget;
                setPotholeAdvisoryOpen(false);
                setPendingPotholeDomainTarget(null);
                if (!next) return;
                if (!municipalBoundaryGate("potholes", next?.sourceLat ?? next?.lat, next?.sourceLng ?? next?.lng, { showNotice: true })) {
                  return;
                }
                setDomainReportTarget(next);
                setDomainReportNote("");
              }}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "none",
                background: "var(--sl-ui-brand-blue)",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
              disabled={!pendingPotholeDomainTarget}
            >
              OK
            </button>

            <button
              type="button"
              onClick={() => {
                setPotholeAdvisoryOpen(false);
                setPendingPotholeDomainTarget(null);
              }}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ConfirmReportModal
        open={Boolean(activeLight) || bulkConfirmOpen}
        onCancel={() => {
          if (saving) return;

          // close single
          setActiveLight(null);
          setPicked(null);
          setNote("");
          setStreetlightAreaPowerOn("");
          setStreetlightHazardYesNo("");

          // close bulk
          setBulkConfirmOpen(false);
        }}
        onConfirm={() => {
          if (bulkConfirmOpen) submitBulkReports();
          else submitReport();
        }}
        reportType={reportType}
        setReportType={setReportType}
        note={note}
        setNote={setNote}
        areaPowerOn={streetlightAreaPowerOn}
        setAreaPowerOn={setStreetlightAreaPowerOn}
        hazardYesNo={streetlightHazardYesNo}
        setHazardYesNo={setStreetlightHazardYesNo}
        saving={saving}
        titleLabel={bulkConfirmOpen ? "Save selected lights?" : "Save this light?"}
        confirmLabel={bulkConfirmOpen ? "Save lights" : "Save light"}
      />

      <DomainReportModal
        open={Boolean(domainReportTarget)}
        domain={domainReportTarget?.domain || ""}
        domainLabel={domainReportTarget?.domainLabel || "Issue"}
        locationLabel={domainReportTarget?.locationLabel || ""}
        note={domainReportNote}
        setNote={setDomainReportNote}
        streetSignIssue={domainReportIssue}
        setStreetSignIssue={setDomainReportIssue}
        consentChecked={potholeConsentChecked}
        setConsentChecked={setPotholeConsentChecked}
        imageFile={domainReportImageFile}
        imagePreviewUrl={domainReportImagePreviewUrl}
        setImageFile={setDomainReportImageFile}
        saving={saving}
        onCancel={() => {
          setDomainReportTarget(null);
          setDomainReportNote("");
          setDomainReportImageFile(null);
          setDomainReportImagePreviewUrl("");
          setDomainReportIssue(defaultDomainIssueFor(""));
          setPotholeConsentChecked(false);
        }}
        onSubmit={submitDomainReport}
      />

      <ModalShell open={isWorkingConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Is Working</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Submit this light as working?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={async () => {
                const lid = (pendingWorkingLightId || "").trim();
                setIsWorkingConfirmOpen(false);
                setPendingWorkingLightId(null);
                if (!lid) return;
                await submitIsWorking(lid);
              }}
              style={btnPopupPrimary}
            >
              Confirm
            </button>
            <button
              onClick={() => {
                setIsWorkingConfirmOpen(false);
                setPendingWorkingLightId(null);
              }}
              style={btnPopupSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={utilityReportDialogOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Utility Report</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Confirm that you reported this light to the utility. Add the utility report number or reference if you have it.
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Utility report number or reference</div>
            <input
              value={pendingUtilityReportReference}
              onChange={(e) => setPendingUtilityReportReference(e.target.value)}
              placeholder="Optional reference number"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
                fontWeight: 700,
              }}
            />
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={async () => {
                const lid = String(pendingUtilityReportLightId || "").trim();
                const reference = pendingUtilityReportReference;
                closeUtilityReportDialog();
                if (!lid) return;
                const saved = await markUtilityReportedForViewer(lid, reference);
                if (saved) {
                  openNotice("✅", "Utility report saved", "Utility reporting status was updated.");
                }
              }}
              style={{ ...btnPopupPrimary, background: "var(--sl-ui-brand-blue)" }}
            >
              Save Utility Report
            </button>
            <button
              onClick={closeUtilityReportDialog}
              style={btnPopupSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={markFixedConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>
            {pendingIncidentActionType === "reopen" ? "Re-open Incident" : "Mark Fixed"}
          </div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            {pendingIncidentActionType === "reopen"
              ? "Add optional re-open notes, then confirm."
              : "Add optional resolution notes, then confirm."}
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Notes (optional)</div>
            <textarea
              value={markFixedNote}
              onChange={(e) => setMarkFixedNote(e.target.value)}
              placeholder={pendingIncidentActionType === "reopen"
                ? "Why is this being re-opened? (new damage, recurring issue, etc.)"
                : "What was fixed? (crew notes, observed condition, etc.)"}
              style={{
                minHeight: 88,
                resize: "vertical",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
                padding: 10,
                fontSize: 14,
                lineHeight: 1.35,
              }}
            />
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={async () => {
                const lid = (pendingMarkFixedLightId || "").trim();
                const clusterReports = Array.isArray(pendingMarkFixedClusterReports) ? pendingMarkFixedClusterReports : [];
                const potholeMarker = pendingMarkFixedPotholeMarker;
                const noteText = String(markFixedNote || "").trim();
                const actionType = pendingIncidentActionType === "reopen" ? "reopen" : "fix";
                setMarkFixedConfirmOpen(false);
                setPendingMarkFixedLightId(null);
                setPendingMarkFixedClusterReports([]);
                setPendingMarkFixedPotholeMarker(null);
                setPendingIncidentActionType("fix");
                setMarkFixedNote("");
                if (potholeMarker) {
                  if (actionType === "reopen") {
                    const pid = String(potholeMarker?.pothole_id || "").trim();
                    if (!pid) return;
                    await reopenLight({ lightId: `pothole:${pid}`, isOfficial: true }, noteText);
                    return;
                  }
                  await markPotholeFixed(potholeMarker, noteText);
                  return;
                }
                if (!lid) return;
                const clusterLight = (clusterReports.length > 0)
                  ? { lightId: lid, isOfficial: false, reports: clusterReports }
                  : { lightId: lid, isOfficial: true };
                if (actionType === "reopen") {
                  await reopenLight(clusterLight, noteText);
                  return;
                }
                await markFixed(clusterLight, noteText);
              }}
              style={btnPopupPrimary}
            >
              {pendingIncidentActionType === "reopen" ? "Confirm Re-open" : "Confirm"}
            </button>
            <button
              onClick={() => {
                setMarkFixedConfirmOpen(false);
                setPendingMarkFixedLightId(null);
                setPendingMarkFixedClusterReports([]);
                setPendingMarkFixedPotholeMarker(null);
                setPendingIncidentActionType("fix");
                setMarkFixedNote("");
              }}
              style={btnPopupSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={deleteCircleConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Circle Mark Fixed</div>
          <div style={{ fontSize: 13, opacity: 0.92, lineHeight: 1.4 }}>
            Mark fixed <b>{deleteCircleCandidateIds.length}</b> incident{deleteCircleCandidateIds.length === 1 ? "" : "s"} inside this circle?
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.82 }}>Notes (optional)</div>
            <textarea
              value={deleteCircleNote}
              onChange={(e) => setDeleteCircleNote(e.target.value)}
              placeholder="Resolution notes for this batch mark-fixed action"
              style={{
                minHeight: 72,
                resize: "vertical",
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-input-border)",
                background: "var(--sl-ui-modal-input-bg)",
                color: "var(--sl-ui-text)",
                padding: 10,
                fontSize: 14,
                lineHeight: 1.35,
              }}
            />
          </label>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={async () => {
                if (saving) return;
                await markIncidentsFixedByIds(deleteCircleCandidateIds, String(deleteCircleNote || "").trim());
              }}
              style={btnPopupPrimary}
              disabled={saving || deleteCircleCandidateIds.length === 0}
            >
              {saving ? "Applying..." : `Mark fixed ${deleteCircleCandidateIds.length}`}
            </button>
            <button
              onClick={() => {
                if (saving) return;
                setDeleteCircleConfirmOpen(false);
              }}
              style={btnPopupSecondary}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (saving) return;
                setDeleteCircleConfirmOpen(false);
                setDeleteCircleDraft(null);
                setDeleteCircleNote("");
              }}
              style={btnPopupSecondary}
              disabled={saving}
            >
              Clear Circle
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={deleteOfficialConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Delete Light</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Delete this saved light?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={async () => {
                const lid = (pendingDeleteOfficialLightId || "").trim();
                setDeleteOfficialConfirmOpen(false);
                setPendingDeleteOfficialLightId(null);
                if (!lid) return;
                await deleteOfficialLight(lid);
                closeAnyPopup();
              }}
              style={btnPopupPrimary}
            >
              Confirm
            </button>
            <button
              onClick={() => {
                setDeleteOfficialConfirmOpen(false);
                setPendingDeleteOfficialLightId(null);
              }}
              style={btnPopupSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <ModalShell open={deleteOfficialSignConfirmOpen} zIndex={10012}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Confirm Delete Sign</div>
          <div style={{ fontSize: 13, opacity: 0.9, lineHeight: 1.4 }}>
            Delete this saved sign?
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <button
              onClick={async () => {
                const sid = (pendingDeleteOfficialSignId || "").trim();
                setDeleteOfficialSignConfirmOpen(false);
                setPendingDeleteOfficialSignId(null);
                if (!sid) return;
                await deleteOfficialSign(sid);
                closeAnyPopup();
              }}
              style={btnPopupPrimary}
            >
              Confirm
            </button>
            <button
              onClick={() => {
                setDeleteOfficialSignConfirmOpen(false);
                setPendingDeleteOfficialSignId(null);
              }}
              style={btnPopupSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      </ModalShell>

      <AllReportsModal
        open={allReportsModal.open}
        title={allReportsModal.title}
        items={allReportsModal.items}
        domainKey={allReportsModal.domainKey}
        sharedLocation={allReportsModal.sharedLocation}
        sharedAddress={allReportsModal.sharedAddress}
        sharedLandmark={allReportsModal.sharedLandmark}
        currentState={allReportsModal.currentState}
        lastChangedAt={allReportsModal.lastChangedAt}
        onCopyField={copyTextToClipboard}
        onClose={closeAllReports}
        onReporterDetails={openReporterDetails}
      />

      <ReporterDetailsModal
        open={reporterDetails.open}
        reportItem={reporterDetails.item}
        onClose={closeReporterDetails}
      />

      <ModerationFlagsModal
        open={moderationFlagsOpen}
        onClose={() => setModerationFlagsOpen(false)}
        rows={moderationFlagRows}
        loading={moderationFlagsLoading}
        error={moderationFlagsError}
        onRefresh={() => void loadModerationFlagRows()}
      />

      <OpenReportsModal
        open={myReportsOpen}
        onClose={closeMyReports}
        isAdmin={true}
        modalTitle="My Reports"
        activeDomain={myReportsDomain}
        domainOptions={visibleDomainOptions}
        onSelectDomain={(domainKey) => {
          setMyReportsDomain(domainKey);
          setAdminReportDomain(domainKey);
          setMyReportsExpanded(new Set());
        }}
        groups={myReportsStandardGroups}
        expandedSet={myReportsExpanded}
        onToggleExpand={toggleMyReportsExpanded}
        reports={reports}
        potholes={potholes}
        allDomainReports={myReportsAllDomainRows}
        officialLights={officialLights}
        slIdByUuid={slIdByUuid}
        fixedLights={fixedLights}
        lastFixByLightId={lastFixByLightId}
        onFlyTo={(pos, zoom, lightId) => {
          closeMyReports();
          flyToLightAndOpen(pos, zoom, lightId);
        }}
        onMarkFixedIncident={null}
        onOpenAllReports={openAllReports}
        onReporterDetails={openReporterDetails}
        actionsByLightId={actionsByLightId}
        session={session}
        profile={profile}
        incidentStateByKey={incidentStateByKey}
        officialSignIdSetForExport={officialSignIdSet}
        cityBoundaryLoaded={cityLimitPolygons.length > 0}
        isWithinCityLimits={isWithinAshtabulaCityLimits}
        getStreetlightUtilityDetails={reverseGeocodeRoadLabel}
        onUtilityReportedChange={handleUtilityReportedChange}
        onMarkWorkingIncident={(incidentId) => {
          const lid = String(incidentId || "").trim();
          if (!lid) return;
          closeMyReports();
          setPendingWorkingLightId(lid);
          setIsWorkingConfirmOpen(true);
        }}
        streetlightConfidenceByLightId={streetlightConfidenceByLightId}
        incidentRepairProgressByKey={incidentRepairProgressByKey}
        canShowPublicRepairAction={canShowPublicRepairAction}
        onConfirmRepairIncident={submitIncidentRepairConfirmation}
        focusIncidentId={myReportsFocusIncidentId}
        initialSearchQuery={myReportsFocusQuery}
        mapBounds={mapBounds}
        onInitialFocusApplied={() => {
          setMyReportsFocusIncidentId("");
          setMyReportsFocusQuery("");
        }}
        inViewOnly={myReportsInViewOnly}
      />

      <OpenReportsModal
        open={openReportsOpen}
        onClose={closeOpenReports}
        isAdmin={isAdmin}
        activeDomain={adminReportDomain}
        domainOptions={openReportsDomainOptions}
        onSelectDomain={setAdminReportDomain}
        groups={openReportsModalGroups}
        expandedSet={openReportsExpanded}
        onToggleExpand={toggleOpenReportsExpanded}
        reports={reports}
        potholes={potholes}
        allDomainReports={selectedDomainReports}
        officialLights={officialLights}
        slIdByUuid={slIdByUuid}
        fixedLights={fixedLights}
        lastFixByLightId={lastFixByLightId}
        onFlyTo={(pos, zoom, lightId) => {
          closeOpenReports();
          flyToLightAndOpen(pos, zoom, lightId);
        }}
        onMarkFixedIncident={(incidentId, actionType = "fix") => {
          const desiredAction = actionType === "reopen" ? "reopen" : "fix";
          const incidentKey = String(incidentId || "").trim();
          if (!incidentKey) return;
          closeOpenReports();
          if (incidentKey.startsWith("pothole:")) {
            const pid = String(incidentKey.slice("pothole:".length) || "").trim();
            if (!pid) return;
            const m = (potholes || []).find((p) => String(p?.id || "").trim() === pid);
            openMarkFixedDialogForPothole({
              pothole_id: pid,
              lat: Number(m?.lat || 0),
              lng: Number(m?.lng || 0),
              ph_id: String(m?.ph_id || "").trim() || makePotholeIdFromCoords(Number(m?.lat || 0), Number(m?.lng || 0)),
            }, desiredAction);
            return;
          }
          if (desiredAction === "reopen") {
            openMarkFixedDialogForLight(incidentKey, "reopen");
            return;
          }
          if (isStreetlightsDomain && isLightFixed(incidentKey)) {
            toggleFixed(incidentKey);
            return;
          }
          openMarkFixedDialogForLight(incidentKey, "fix");
        }}
        onOpenAllReports={(lightId) => {
          openOfficialLightAllReports(lightId);
        }}
        onReporterDetails={openReporterDetails}
        actionsByLightId={actionsByLightId}
        session={session}
        profile={profile}
        incidentStateByKey={incidentStateByKey}
        officialSignIdSetForExport={officialSignIdSet}
        cityBoundaryLoaded={cityLimitPolygons.length > 0}
        isWithinCityLimits={isWithinAshtabulaCityLimits}
        getStreetlightUtilityDetails={reverseGeocodeRoadLabel}
        onUtilityReportedChange={handleUtilityReportedChange}
        streetlightConfidenceByLightId={streetlightConfidenceByLightId}
        incidentRepairProgressByKey={incidentRepairProgressByKey}
        canShowPublicRepairAction={canShowPublicRepairAction}
        onConfirmRepairIncident={submitIncidentRepairConfirmation}
      />

      <ModalShell
        open={streetlightLocationInfoOpen}
        zIndex={10018}
        panelStyle={{
          width: "min(420px, 100%)",
          maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          padding: 0,
        }}
      >
        <div style={{ padding: "16px 16px 12px", display: "grid", gap: 6, borderBottom: "1px solid var(--sl-ui-modal-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>Streetlight Location Info</div>
              <div style={{ fontSize: 12.5, opacity: 0.84, lineHeight: 1.35 }}>
                Use this location information to submit directly to the electric utility.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStreetlightLocationInfoOpen(false)}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
              }}
              aria-label="Close location info"
            >
              ✕
            </button>
          </div>
        </div>
        <div style={{ padding: 16, overflow: "auto", display: "grid", gap: 8, minHeight: 0 }}>
          {streetlightUtilityContext.loading ? (
            <div style={{ fontSize: 12.5, opacity: 0.82 }}>Loading location details...</div>
          ) : (
            <>
              <div style={{ fontSize: 11.5, opacity: 0.72 }}>(Tap or click any line below to copy)</div>
              <div style={{ display: "grid", gap: 4 }}>
                {streetlightLocationRows.map((item) => (
                  <button
                    key={`location-modal-${item.label}`}
                    type="button"
                    onClick={() => copyTextToClipboard(item.label, item.value)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                      textAlign: "left",
                      color: "var(--sl-ui-text)",
                      cursor: "copy",
                      fontSize: 12.5,
                      lineHeight: 1.35,
                    }}
                  >
                    <b>{item.label}:</b>{" "}
                    <span
                      style={{
                        wordBreak: "break-word",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                        color: "#7fd7ff",
                        fontWeight: 700,
                      }}
                    >
                      {item.value}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.8, lineHeight: 1.35 }}>
                Verify all information before submitting to the utility company. CityReport.io provides reference data and is not responsible for submission errors.
              </div>
            </>
          )}
        </div>
      </ModalShell>

      <ManageAccountModal
        open={manageOpen}
        onClose={() => {
          setManageOpen(false);
          setManageEditing(false);
        }}
        profile={profile}
        session={session}
        saving={manageSaving}
        editing={manageEditing}
        setEditing={setManageEditing}
        form={manageForm}
        setForm={setManageForm}
        onSave={saveManagedProfile}
        onRequestEdit={requestEditManagedProfile}
        onOpenChangePassword={() => {
          setChangePasswordValue("");
          setChangePasswordValue2("");
          setChangePasswordCurrentValue("");
          setChangePasswordOpen(true);
        }}
      />

      <ReauthModal
        open={reauthOpen}
        onClose={() => {
          if (reauthSaving) return;
          setReauthOpen(false);
          setReauthPassword("");
          setReauthIntent(null);
        }}
        password={reauthPassword}
        setPassword={setReauthPassword}
        saving={reauthSaving}
        onConfirm={confirmReauth}
      />

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => {
          if (changePasswordSaving) return;
          setChangePasswordOpen(false);
          setChangePasswordValue("");
          setChangePasswordValue2("");
          setChangePasswordCurrentValue("");
        }}
        password={changePasswordValue}
        setPassword={setChangePasswordValue}
        password2={changePasswordValue2}
        setPassword2={setChangePasswordValue2}
        currentPassword={changePasswordCurrentValue}
        setCurrentPassword={setChangePasswordCurrentValue}
        saving={changePasswordSaving}
        onSubmit={handleChangePassword}
      />

      <RecoveryPasswordModal
        open={recoveryPasswordOpen}
        onClose={() => {
          if (recoveryPasswordSaving) return;
          setRecoveryPasswordOpen(false);
          setRecoveryPasswordValue("");
          setRecoveryPasswordValue2("");
        }}
        password={recoveryPasswordValue}
        setPassword={setRecoveryPasswordValue}
        password2={recoveryPasswordValue2}
        setPassword2={setRecoveryPasswordValue2}
        saving={recoveryPasswordSaving}
        onSubmit={handleRecoveryPasswordUpdate}
      />


      {/* =========================
          Map (Google Maps)
         ========================= */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={mapZoom}
        onLoad={(map) => {
          setGmapsRef(map);
          mapRef.current = map; // keep your existing ref name working
        }}
        onDragStart={() => {
          beginMapInteraction();
          userDragPanRef.current = true;
          if (followCamera) {
            stopFollowCameraAnimation();
            setFollowCamera(false);
          }
        }}
        onZoomChanged={() => {
          beginMapInteraction();
          lastZoomGestureAtRef.current = Date.now();
          const z = Number(mapRef.current?.getZoom?.());
          if (!Number.isFinite(z)) return;
          mapZoomRef.current = z;
          const rounded = Math.round(z);
          setMapZoom((prev) => (prev === rounded ? prev : rounded));
        }}
        onIdle={() => {
          endMapInteractionSoon(750);
          userDragPanRef.current = false;
          const map = mapRef.current;
          if (!map) return;

          const z = Number(map.getZoom?.());
          if (Number.isFinite(z)) {
            const rounded = Math.round(z);
            setMapZoom((prev) => (prev === rounded ? prev : rounded));
          }

          const c = map.getCenter?.();
          const lat = Number(c?.lat?.());
          const lng = Number(c?.lng?.());
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setMapCenter((prev) => {
              if (!prev) return { lat, lng };
              if (Math.abs(prev.lat - lat) < 0.000001 && Math.abs(prev.lng - lng) < 0.000001) return prev;
              return { lat, lng };
            });
          }

          const b = map.getBounds?.();
          const ne = b?.getNorthEast?.();
          const sw = b?.getSouthWest?.();
          const north = Number(ne?.lat?.());
          const east = Number(ne?.lng?.());
          const south = Number(sw?.lat?.());
          const west = Number(sw?.lng?.());
          if ([north, east, south, west].every(Number.isFinite)) {
            setMapBounds((prev) => {
              if (
                prev &&
                Math.abs(prev.north - north) < 0.000001 &&
                Math.abs(prev.east - east) < 0.000001 &&
                Math.abs(prev.south - south) < 0.000001 &&
                Math.abs(prev.west - west) < 0.000001
              ) {
                return prev;
              }
              return { north, east, south, west };
            });
          }
        }}
        options={{
          mapTypeId: mapType,
          mapId: GMAPS_MAP_ID || undefined,
          gestureHandling: "greedy",
          disableDoubleClickZoom: isTouchDevice,
          isFractionalZoomEnabled: false,
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
          rotateControl: true,
          headingInteractionEnabled: true,
          tiltInteractionEnabled: false,
        }}
        onClick={(e) => {
          setAdminDomainMenuOpen(false);
          setAdminToolboxOpen(false);
          if (Date.now() < (suppressMapClickRef.current?.until || 0)) return;
          const lat = Number(e?.latLng?.lat?.());
          const lng = Number(e?.latLng?.lng?.());
          if (deleteCircleMode && isAdmin) {
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            if (!deleteCircleDraft?.center) {
              setDeleteCircleDraft({ center: { lat, lng }, radiusMeters: 0 });
              openNotice("🟢", "Circle center set", "Tap a second point to set the radius.", { autoCloseMs: 1200, compact: true });
              return;
            }
            const center = deleteCircleDraft.center;
            const radiusMeters = metersBetween(
              { lat: Number(center.lat), lng: Number(center.lng) },
              { lat, lng }
            );
            if (!Number.isFinite(radiusMeters) || radiusMeters < 2) {
              openNotice("⚠️", "Radius too small", "Tap farther from the center to define a larger circle.");
              return;
            }
            setDeleteCircleDraft({ center, radiusMeters });
            setDeleteCircleConfirmOpen(true);
            return;
          }
          if (showOfficialLights && Number.isFinite(lat) && Number.isFinite(lng)) {
            const hitOfficialId = officialCanvasOverlayRef.current?.hitTestByLatLng?.(lat, lng);
            if (hitOfficialId) {
              handleOfficialMarkerClick(hitOfficialId);
              return;
            }
          }

          // Clicking map background should close any open info windows.
          if (selectedOfficialId || selectedQueuedTempId || selectedDomainMarker) {
            setSelectedOfficialId(null);
            setSelectedQueuedTempId(null);
            setSelectedDomainMarker(null);
          }

          if (!isAdmin && !visibleDomainOptions.some((d) => d.key === adminReportDomain)) {
            openNotice("⚠️", "Domain unavailable", "This report domain is not enabled for public reporting.");
            return;
          }

          if (mappingMode && isAdmin && adminReportDomain === "street_signs") {
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            requestQueueOfficialSign(lat, lng);
            return;
          }

          if (adminReportDomain !== "streetlights") {
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            (async () => {
              if (adminReportDomain === "street_signs") {
                openNotice("🛑", "Street signs", "Tap a mapped street-sign marker to view details and report.");
                return;
              }
              if (Number(mapZoomRef.current || mapZoom) < REPORTING_MIN_ZOOM) {
                openNotice("🔎", "Zoom in to report", `Zoom in closer (level ${REPORTING_MIN_ZOOM}+) before placing a report.`);
                return;
              }
              if (!municipalBoundaryGate(adminReportDomain, lat, lng, { showNotice: true })) {
                return;
              }
              if (adminReportDomain === "potholes") {
                const domainLabel =
                  visibleDomainOptions.find((d) => d.key === adminReportDomain)?.label || "Report";
                const targetToken = `pothole:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
                const provisionalTarget = {
                  domain: adminReportDomain,
                  domainLabel,
                  lat,
                  lng,
                  sourceLat: lat,
                  sourceLng: lng,
                  lightId: makePotholeIdFromCoords(lat, lng),
                  pothole_id: null,
                  locationLabel: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                  nearestAddress: "",
                  nearestLandmark: "",
                  nearestCrossStreet: "",
                  nearestIntersection: "",
                  _targetToken: targetToken,
                };
                setPendingPotholeDomainTarget(provisionalTarget);
                setPotholeAdvisoryOpen(true);
                return;
              }
              const geo = {
                isRoad: true,
                label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                nearestAddress: "",
                nearestLandmark: "",
                nearestCrossStreet: "",
                nearestIntersection: "",
                nearestStreet: "",
                snappedLat: lat,
                snappedLng: lng,
              };
              const targetLat = lat;
              const targetLng = lng;
              const nearestWaterMarker = adminReportDomain === "water_drain_issues"
                ? nearestWaterDrainMarkerForPoint(targetLat, targetLng, nonStreetlightDomainMarkers)
                : null;
              const resolvedWaterIncidentId = String(nearestWaterMarker?.marker?.id || "").trim();
              const lightId = adminReportDomain === "water_drain_issues"
                ? (resolvedWaterIncidentId || `${adminReportDomain}:${targetLat.toFixed(5)}:${targetLng.toFixed(5)}`)
                : `${adminReportDomain}:${targetLat.toFixed(5)}:${targetLng.toFixed(5)}`;
              const domainLabel =
                visibleDomainOptions.find((d) => d.key === adminReportDomain)?.label || "Report";
              const nextTarget = {
                domain: adminReportDomain,
                domainLabel,
                lat: targetLat,
                lng: targetLng,
                sourceLat: lat,
                sourceLng: lng,
                lightId,
                pothole_id: null,
                locationLabel:
                  String(nearestWaterMarker?.marker?.location_label || "").trim()
                  || geo.nearestAddress
                  || geo.label
                  || `${targetLat.toFixed(5)}, ${targetLng.toFixed(5)}`,
                nearestAddress: geo.nearestAddress || "",
                nearestLandmark: geo.nearestLandmark || "",
                nearestCrossStreet: geo.nearestCrossStreet || "",
                nearestIntersection: geo.nearestIntersection || "",
              };
              setDomainReportTarget(nextTarget);
              setDomainReportNote("");

              // Cost guardrail: no passive geocode on click.
              // Geocoding runs only during explicit submit flows.
            })();
            return;
          }

          if (!mappingMode) return;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

          queueOfficialLight(lat, lng);
        }}
      >
        {showCityOutsideShade && cityOutsideMaskPaths.length > 0 && (
          <PolygonF
            paths={cityOutsideMaskPaths}
            options={{
              clickable: false,
              strokeOpacity: 0,
              fillColor: "#0b0f17",
              fillOpacity: cityOutsideShadeOpacity,
              zIndex: 1,
            }}
          />
        )}
        {showCityBoundaryBorder && cityBoundaryOuterRings.map((ring, idx) => (
          <PolygonF
            key={`city-boundary-${idx}`}
            paths={ring}
            options={{
              clickable: false,
              strokeColor: cityBoundaryBorderColor,
              strokeOpacity: 1,
              strokeWeight: cityBoundaryBorderWidth,
              fillOpacity: 0,
              zIndex: 2200,
            }}
          />
        ))}
        {userLoc && (
          <SmoothUserMarker position={{ lat: userLoc[0], lng: userLoc[1] }} />
        )}
        {/* Canvas overlay replaces thousands of MarkerF nodes for smoother pan/zoom */}
        <OfficialLightsCanvasOverlay
          ref={officialCanvasOverlayRef}
          map={gmapsRef}
          show={showOfficialLights && !mapInteracting}
          lights={visibleOfficialLights}
          bulkMode={bulkMode}
          bulkSelectedSet={bulkSelectedSet}
          getMarkerColor={officialMarkerColorForViewer}
          getMarkerRingColor={officialMarkerRingColorForViewer}
        />
        {deleteCircleMode && isAdmin && deleteCircleDraft?.center && (
          <CircleF
            center={deleteCircleDraft.center}
            radius={Math.max(2, Number(deleteCircleDraft.radiusMeters || 0))}
            options={{
              clickable: false,
              draggable: false,
              editable: false,
              strokeColor: "#ff1744",
              strokeOpacity: 0.95,
              strokeWeight: 2,
              fillColor: "#ff1744",
              fillOpacity: 0.12,
              zIndex: 2100,
            }}
          />
        )}

        {!isStreetlightsDomain && renderedDomainMarkers.map((m) => (
          <MarkerF
            key={`domain-${adminReportDomain}-${m.id}`}
            position={{ lat: m.lat, lng: m.lng }}
            icon={
              adminReportDomain === "street_signs"
                ? gmapsImageIcon(m.glyphSrc || signMarkerIconSrcForType(m?.sign_type), STREET_SIGN_MARKER_SIZE)
                : gmapsDotIcon(
                    m.color || domainMarkerColor,
                    m.ringColor || "#fff",
                    m.glyph || adminDomainMeta.icon || "💡",
                    m.glyphSrc || adminDomainMeta.iconSrc || UI_ICON_SRC.streetlight
                  )
            }
            onClick={() => {
              setSelectedQueuedTempId(null);
              setSelectedOfficialId(null);
              if (adminReportDomain === "potholes") {
                selectDomainMarkerWithGeo(m);
                return;
              }
              if (adminReportDomain === "street_signs") {
                setSelectedDomainMarker(m);
                return;
              }
              if (adminReportDomain === "water_drain_issues") {
                selectDomainMarkerWithGeo(m);
                return;
              }
              openNotice(
                adminDomainMeta.icon,
                adminDomainMeta.label,
                `${m.count} report${m.count === 1 ? "" : "s"} at this location.`,
                { autoCloseMs: 1800, compact: true }
              );
            }}
          />
        ))}

        {/* Queued markers (mapping mode preview) */}
        {mappingMode && isAdmin && (mappingQueue || []).map((q) => (
          <MarkerF
            key={q.tempId}
            position={{ lat: q.lat, lng: q.lng }}
            icon={(q.domain || "streetlights") === "street_signs"
              ? gmapsImageIcon(signMarkerIconSrcForType(q.sign_type), STREET_SIGN_MARKER_SIZE, {
                  border: true,
                  borderColor: "#39ff14",
                  borderWidth: 3,
                })
              : gmapsDotIcon(
                  "#2ecc71",
                  "#fff",
                  "💡",
                  UI_ICON_SRC.streetlight
                )}
            onClick={() => {
              setSelectedOfficialId(null);
              setSelectedDomainMarker(null);
              setSelectedQueuedTempId(q.tempId);
            }}
          />
        ))}

      </GoogleMap>

      {!bulkMode && selectedOfficialLightForPopup && selectedOfficialPopupPixel && (
        <div
          style={{
            position: "absolute",
            left: selectedOfficialPopupPixel.x,
            top: selectedOfficialPopupPixel.y,
            transform: "translate(-50%, calc(-100% - 14px))",
            zIndex: 2600,
            pointerEvents: "auto",
            maxWidth: "min(280px, calc(100vw - 20px))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div
            style={{
              ...markerPopupCardStyle,
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedOfficialId(null)}
              aria-label="Close"
              style={{
                position: "absolute",
                marginLeft: "auto",
                right: 8,
                top: 8,
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                cursor: "pointer",
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              ×
            </button>

            <div style={{ fontWeight: 900, paddingRight: 26 }}>
              Streetlight • {displayLightId(selectedOfficialLightForPopup?.id, slIdByUuid)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.78, marginTop: -7, letterSpacing: 0.1 }}>
              Utility-owned
            </div>
            <button
              type="button"
              onClick={() => {
                setStreetlightLocationInfoOpen(true);
                void ensureStreetlightLocationInfoForPopup(selectedOfficialLightForPopup);
              }}
              style={btnPopupSecondary}
            >
              Location Info
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.open(STREETLIGHT_UTILITY_REPORT_URL, "_blank", "noopener,noreferrer");
                }
              }}
              style={{ ...btnPopupPrimary, background: "var(--sl-ui-brand-blue)" }}
            >
              Report Outage to Utility
            </button>

            {(() => {
              const lid = String(selectedOfficialLightForPopup?.id || "").trim();
              const alreadySaved = lid ? viewerSavedStreetlightLightIdSet.has(lid) : false;
              const currentlyOpen = lid ? viewerStreetlightRingOpenIdSet.has(lid) : false;
              const hideSaveForOpenSaved = alreadySaved && currentlyOpen;
              if (hideSaveForOpenSaved) return null;
              const canSaveReportHere = Number(mapZoom) >= REPORTING_MIN_ZOOM;
              return (
                <button
                  style={{ ...btnPopupPrimary, background: "var(--sl-ui-brand-green)", opacity: canSaveReportHere ? 1 : 0.6, cursor: canSaveReportHere ? "pointer" : "not-allowed" }}
                  disabled={!canSaveReportHere}
                  onClick={() => {
                    openConfirmForLight({
                      lat: selectedOfficialLightForPopup.lat,
                      lng: selectedOfficialLightForPopup.lng,
                      lightId: selectedOfficialLightForPopup.id,
                      isOfficial: true,
                    });
                  }}
                  title={canSaveReportHere ? "Save light" : "Zoom in closer to save"}
                >
                  Save light
                </button>
              );
            })()}
            {(() => {
              const lid = String(selectedOfficialLightForPopup?.id || "").trim();
              if (!lid) return null;
              if (!session?.user?.id) return null;
              const canTrackUtility = viewerSavedStreetlightLightIdSet.has(lid) || viewerUtilityReportedLightIdSet.has(lid);
              if (!canTrackUtility) return null;
              return (
                <>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.95 }}>
                    <input
                      type="checkbox"
                      checked={viewerUtilityReportedLightIdSet.has(lid)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          openUtilityReportDialogForLight(lid);
                        } else {
                          void clearUtilityReportedForViewer(lid);
                        }
                      }}
                    />
                    Utility reported
                  </label>
                  {viewerUtilityReportedLightIdSet.has(lid) && (
                    <button
                      type="button"
                      onClick={() => openUtilityReportDialogForLight(lid)}
                      style={btnPopupSecondary}
                    >
                      {utilityReportReferenceByLightId?.[lid] ? "Edit report #" : "Add report #"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      openMyReports({
                        domainKey: "streetlights",
                        focusIncidentId: lid,
                        focusQuery: displayLightId(lid, slIdByUuid),
                      })
                    }
                    style={btnPopupSecondary}
                  >
                    View My Report
                  </button>
                  {viewerUtilityReportedLightIdSet.has(lid) && (
                    <div style={{ fontSize: 12, opacity: 0.84 }}>
                      Utility report #: {utilityReportReferenceByLightId?.[lid] || "Not added yet"}
                    </div>
                  )}
                </>
              );
            })()}
            {(() => {
              const lid = String(selectedOfficialLightForPopup?.id || "").trim();
              if (!lid) return null;
              const confidence = streetlightConfidenceByLightId?.[lid] || null;
              if (!confidence?.canViewerMarkWorking) return null;
              return (
                <button
                  type="button"
                  onClick={() => {
                    closeAnyPopup();
                    setPendingWorkingLightId(lid);
                    setIsWorkingConfirmOpen(true);
                  }}
                  style={{ ...btnPopupPrimary, background: "var(--sl-ui-brand-green)" }}
                >
                  Is working
                </button>
              );
            })()}
            <div style={{ fontSize: 12, fontWeight: 800, color: "#ffd27d", lineHeight: 1.35 }}>
              Immediate danger? Call 911.
            </div>

            {Number(mapZoom) < REPORTING_MIN_ZOOM && (
              <div style={{ fontSize: 11.5, opacity: 0.78, lineHeight: 1.25 }}>
                Zoom in closer to save this light.
              </div>
            )}

            {mappingMode && isAdmin && (
              <button
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "none",
                  background: "#d32f2f",
                  color: "white",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
                onClick={() => {
                  setPendingDeleteOfficialLightId(selectedOfficialLightForPopup.id);
                  setDeleteOfficialConfirmOpen(true);
                }}
              >
                Delete Light
              </button>
            )}
          </div>

          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -7,
              width: 12,
              height: 12,
              background: "var(--sl-ui-modal-bg)",
              borderRight: "1px solid var(--sl-ui-modal-border)",
              borderBottom: "1px solid var(--sl-ui-modal-border)",
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>
      )}

      {!bulkMode && adminReportDomain === "potholes" && selectedDomainMarker && selectedDomainPopupPixel && (
        <div
          style={{
            position: "absolute",
            left: selectedDomainPopupPixel.x,
            top: selectedDomainPopupPixel.y,
            transform: "translate(-50%, calc(-100% - 14px))",
            zIndex: 2600,
            pointerEvents: "auto",
            maxWidth: "min(280px, calc(100vw - 20px))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div style={{ ...markerPopupCardStyle, gap: 10 }}>
            <button
              type="button"
              onClick={() => setSelectedDomainMarker(null)}
              aria-label="Close"
              style={{
                position: "absolute",
                marginLeft: "auto",
                right: 8,
                top: 8,
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                cursor: "pointer",
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <div style={{ fontWeight: 900, paddingRight: 26 }}>Pothole Issue</div>
            {(() => {
              const lat = Number(selectedDomainMarker?.lat);
              const lng = Number(selectedDomainMarker?.lng);
              const coordsText =
                Number.isFinite(lat) && Number.isFinite(lng)
                  ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                  : "Unavailable";
              const locationLabelRaw = String(selectedPotholeInfo?.locationLabel || "").trim();
              const nearMatch = locationLabelRaw.match(/\s*\(Near:\s*(.*?)\)\s*$/i);
              const nearestLandmark = String(nearMatch?.[1] || "").trim();
              const nearestAddress = nearMatch
                ? locationLabelRaw.replace(/\s*\(Near:\s*.*?\)\s*$/i, "").trim()
                : locationLabelRaw;
              const displayId = makePotholeIdFromCoords(lat, lng);
              return (
                <>
                  <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.35 }}>
                    <b>ID:</b> {displayId || "PH0000000000"}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyTextToClipboard("Closest address", nearestAddress || "Unavailable")}
                    title="Click to copy location"
                    style={{ ...markerPopupCopyRowStyle, width: "100%", textAlign: "left", border: "none", background: "transparent" }}
                  >
                    <span style={{ fontWeight: 800, opacity: 0.9, color: "var(--sl-ui-text)" }}>Location:</span>{" "}
                    <span style={markerPopupCopyValueStyle}>{nearestAddress || "Unavailable"}</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => copyTextToClipboard("Coordinates", coordsText)}
                      title="Click to copy coordinates"
                      style={{ ...markerPopupCopyRowStyle, width: "100%", textAlign: "left", border: "none", background: "transparent" }}
                    >
                      <span style={{ fontWeight: 800, opacity: 0.9, color: "var(--sl-ui-text)" }}>Coordinates:</span>{" "}
                      <span style={markerPopupCopyValueStyle}>{coordsText}</span>
                    </button>
                  )}
                  <div style={markerPopupCopyRowStyle}>
                    <span style={{ fontWeight: 800, opacity: 0.9 }}>Nearest landmark:</span>{" "}
                    <span>{nearestLandmark || "No nearby landmark"}</span>
                  </div>
                </>
              );
            })()}
            {isAdmin && (
              <>
                <div style={{ height: 4 }} />
                <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.35 }}>
                  <b>State:</b> {incidentStateLabel(selectedPotholeInfo?.currentState || "reported")}{" "}
                  <span style={{ opacity: 0.75 }}>•</span>{" "}
                  <b>Reports:</b> {Number(selectedPotholeInfo?.openCount || selectedDomainMarker.count || 0)}
                </div>
                <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                  <b>Last updated:</b>{" "}
                  {String(selectedPotholeInfo?.lastChangedAt || "").trim()
                    ? formatTs(selectedPotholeInfo.lastChangedAt)
                    : "Unknown"}
                </div>
                <button
                  type="button"
                  onClick={() => openPotholeAllReportsFromMarker(selectedDomainMarker)}
                  style={markerPopupActionSecondary}
                >
                  All Reports
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const pid = String(selectedDomainMarker?.pothole_id || "").trim();
                    const potholeLightId = pid ? `pothole:${pid}` : "";
                    const isFixedNow = potholeLightId ? isLightFixed(potholeLightId) : false;
                    if (isFixedNow && potholeLightId) {
                      toggleFixed(potholeLightId);
                      return;
                    }
                    openMarkFixedDialogForPothole(selectedDomainMarker);
                  }}
                  style={{ ...markerPopupActionPrimary, background: "var(--sl-ui-brand-green)" }}
                >
                  {(() => {
                    const pid = String(selectedDomainMarker?.pothole_id || "").trim();
                    const potholeLightId = pid ? `pothole:${pid}` : "";
                    return potholeLightId && isLightFixed(potholeLightId) ? "Re-open" : "Mark fixed";
                  })()}
                </button>
              </>
            )}
            {!isAdmin && (() => {
              const pid = String(selectedDomainMarker?.pothole_id || "").trim();
              const incidentId = pid ? `pothole:${pid}` : "";
              const repairSnapshot = incidentId ? getIncidentRepairSnapshot("potholes", incidentId) : null;
              const userReported = Boolean(pid && viewerReportedPotholeIdSet.has(pid));
              const lat = Number(selectedDomainMarker?.lat);
              const lng = Number(selectedDomainMarker?.lng);
              const ph = Number.isFinite(lat) && Number.isFinite(lng)
                ? makePotholeIdFromCoords(lat, lng)
                : "";
              const showPublicRepairAction = canShowPublicRepairAction(incidentId, "potholes");
              if (!userReported && !showPublicRepairAction && !repairSnapshot) return null;
              return (
                <>
                  <div style={{ height: 4 }} />
                  {repairSnapshot && (
                    <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                      <b>Community repair:</b> {incidentRepairSummaryText(repairSnapshot)}
                    </div>
                  )}
                  {userReported && (
                    <button
                      type="button"
                      onClick={() => {
                        openMyReports({
                          domainKey: "potholes",
                          focusIncidentId: `pothole:${pid}`,
                          focusQuery: ph || pid,
                        });
                      }}
                      style={markerPopupActionSecondary}
                    >
                      View Report
                    </button>
                  )}
                  {showPublicRepairAction && (
                    <button
                      type="button"
                      onClick={() => submitIncidentRepairConfirmation(incidentId, "potholes")}
                      style={{ ...markerPopupActionPrimary, background: "var(--sl-ui-brand-green)" }}
                    >
                      Is fixed
                    </button>
                  )}
                  {repairSnapshot?.viewerHasRepairSignal && (
                    <div style={{ fontSize: 12, opacity: 0.82, lineHeight: 1.3 }}>
                      You already confirmed this repair.
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -7,
              width: 12,
              height: 12,
              background: "var(--sl-ui-modal-bg)",
              borderRight: "1px solid var(--sl-ui-modal-border)",
              borderBottom: "1px solid var(--sl-ui-modal-border)",
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>
      )}

      {!bulkMode && adminReportDomain === "water_drain_issues" && selectedDomainMarker && selectedDomainPopupPixel && (
        <div
          style={{
            position: "absolute",
            left: selectedDomainPopupPixel.x,
            top: selectedDomainPopupPixel.y,
            transform: "translate(-50%, calc(-100% - 14px))",
            zIndex: 2600,
            pointerEvents: "auto",
            maxWidth: "min(280px, calc(100vw - 20px))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div style={{ ...markerPopupCardStyle, gap: 10 }}>
            <button
              type="button"
              onClick={() => setSelectedDomainMarker(null)}
              aria-label="Close"
              style={{
                position: "absolute",
                marginLeft: "auto",
                right: 8,
                top: 8,
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                cursor: "pointer",
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <div style={{ fontWeight: 900, paddingRight: 26 }}>Water / Drain Issue</div>
            {(() => {
              const incidentId = String(selectedWaterDrainInfo?.incidentId || selectedDomainMarker?.id || "").trim();
              const displayId = String(selectedWaterDrainInfo?.displayId || "").trim() || makeWaterDrainIdFromIncidentId(incidentId);
              const lat = Number(selectedDomainMarker?.lat);
              const lng = Number(selectedDomainMarker?.lng);
              const coordsText =
                Number.isFinite(lat) && Number.isFinite(lng)
                  ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                  : "Unavailable";
              const locationLabelRaw = String(selectedWaterDrainInfo?.locationLabel || "").trim();
              const nearMatch = locationLabelRaw.match(/\s*\(Near:\s*(.*?)\)\s*$/i);
              const nearestLandmark = String(nearMatch?.[1] || "").trim();
              const nearestAddress = nearMatch
                ? locationLabelRaw.replace(/\s*\(Near:\s*.*?\)\s*$/i, "").trim()
                : locationLabelRaw;
              return (
                <>
                  <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.35 }}>
                    <b>ID:</b> {displayId || "WD0000000000"}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                    <b>Issue type:</b> {selectedWaterDrainInfo?.issueLabel || "Water / Drain Issue"}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyTextToClipboard("Closest address", nearestAddress || "Unavailable")}
                    title="Click to copy location"
                    style={{ ...markerPopupCopyRowStyle, width: "100%", textAlign: "left", border: "none", background: "transparent" }}
                  >
                    <span style={{ fontWeight: 800, opacity: 0.9, color: "var(--sl-ui-text)" }}>Location:</span>{" "}
                    <span style={markerPopupCopyValueStyle}>{nearestAddress || "Unavailable"}</span>
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => copyTextToClipboard("Coordinates", coordsText)}
                      title="Click to copy coordinates"
                      style={{ ...markerPopupCopyRowStyle, width: "100%", textAlign: "left", border: "none", background: "transparent" }}
                    >
                      <span style={{ fontWeight: 800, opacity: 0.9, color: "var(--sl-ui-text)" }}>Coordinates:</span>{" "}
                      <span style={markerPopupCopyValueStyle}>{coordsText}</span>
                    </button>
                  )}
                  <div style={markerPopupCopyRowStyle}>
                    <span style={{ fontWeight: 800, opacity: 0.9 }}>Nearest landmark:</span>{" "}
                    <span>{nearestLandmark || "No nearby landmark"}</span>
                  </div>
                </>
              );
            })()}
            {isAdmin && (() => {
              const incidentId = String(selectedDomainMarker?.id || "").trim();
              const clusterRows = Array.isArray(selectedDomainMarker?.rows) ? selectedDomainMarker.rows : [];
              const clusterLight = { lightId: incidentId, isOfficial: false, reports: clusterRows };
              const openCount = Number(selectedWaterDrainInfo?.openCount || 0);
              const isFixedNow = Boolean(selectedWaterDrainInfo?.isFixedNow);
              return (
                <>
                  <div style={{ height: 4 }} />
                  <div style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.35 }}>
                    <b>State:</b> {incidentStateLabel(selectedWaterDrainInfo?.currentState || (isFixedNow ? "fixed" : "reported"))}{" "}
                    <span style={{ opacity: 0.75 }}>•</span>{" "}
                    <b>Reports:</b> {openCount}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                    <b>Last updated:</b>{" "}
                    {String(selectedWaterDrainInfo?.lastChangedAt || "").trim()
                      ? formatTs(selectedWaterDrainInfo.lastChangedAt)
                      : (selectedWaterDrainInfo?.lastReportedTs ? formatTs(selectedWaterDrainInfo.lastReportedTs) : "Unknown")}
                  </div>
                  <button
                    type="button"
                    onClick={() => openOfficialLightAllReports(incidentId, "water_drain_issues")}
                    style={markerPopupActionSecondary}
                  >
                    All Reports
                  </button>
                  {(openCount > 0 || isFixedNow) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isFixedNow) {
                          reopenLight(clusterLight);
                          return;
                        }
                        openMarkFixedDialogForLight(incidentId, "fix", clusterRows);
                      }}
                      style={{ ...markerPopupActionPrimary, background: "var(--sl-ui-brand-green)" }}
                    >
                      {isFixedNow ? "Re-open" : "Mark fixed"}
                    </button>
                  )}
                </>
              );
            })()}
            {!isAdmin && (() => {
              const incidentId = String(selectedWaterDrainInfo?.incidentId || selectedDomainMarker?.id || "").trim();
              const repairSnapshot = incidentId ? getIncidentRepairSnapshot("water_drain_issues", incidentId) : null;
              const userReported = Boolean(incidentId && viewerReportedWaterIncidentIdSet.has(incidentId));
              const wd = makeWaterDrainIdFromIncidentId(incidentId);
              const showPublicRepairAction = canShowPublicRepairAction(incidentId, "water_drain_issues");
              if (!userReported && !showPublicRepairAction && !repairSnapshot) return null;
              return (
                <>
                  <div style={{ height: 4 }} />
                  {repairSnapshot && (
                    <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                      <b>Community repair:</b> {incidentRepairSummaryText(repairSnapshot)}
                    </div>
                  )}
                  {userReported && (
                    <button
                      type="button"
                      onClick={() => {
                        openMyReports({
                          domainKey: "water_drain_issues",
                          focusIncidentId: incidentId,
                          focusQuery: wd || incidentId,
                        });
                      }}
                      style={markerPopupActionSecondary}
                    >
                      View Report
                    </button>
                  )}
                  {showPublicRepairAction && (
                    <button
                      type="button"
                      onClick={() => submitIncidentRepairConfirmation(incidentId, "water_drain_issues")}
                      style={{ ...markerPopupActionPrimary, background: "var(--sl-ui-brand-green)" }}
                    >
                      Is fixed
                    </button>
                  )}
                  {repairSnapshot?.viewerHasRepairSignal && (
                    <div style={{ fontSize: 12, opacity: 0.82, lineHeight: 1.3 }}>
                      You already confirmed this repair.
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -7,
              width: 12,
              height: 12,
              background: "var(--sl-ui-modal-bg)",
              borderRight: "1px solid var(--sl-ui-modal-border)",
              borderBottom: "1px solid var(--sl-ui-modal-border)",
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>
      )}

      {!bulkMode && adminReportDomain === "street_signs" && selectedDomainMarker && selectedDomainPopupPixel && (
        <div
          style={{
            position: "absolute",
            left: selectedDomainPopupPixel.x,
            top: selectedDomainPopupPixel.y,
            transform: "translate(-50%, calc(-100% - 14px))",
            zIndex: 2600,
            pointerEvents: "auto",
            maxWidth: "min(280px, calc(100vw - 20px))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div style={{ ...markerPopupCardStyle, gap: 10 }}>
            <button
              type="button"
              onClick={() => setSelectedDomainMarker(null)}
              aria-label="Close"
              style={{
                position: "absolute",
                marginLeft: "auto",
                right: 8,
                top: 8,
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                cursor: "pointer",
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <div style={{ fontWeight: 900, paddingRight: 26 }}>
              Sign ID: {String(selectedDomainMarker.id || "").slice(0, 8) || "Sign"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              <b>Sign type:</b> {formatStreetSignTypeLabel(selectedDomainMarker.sign_type)}
            </div>
            {(() => {
              const signId = String(selectedDomainMarker.id || "").trim();
              const openCount = Number(openIncidentCountByOfficialId?.[signId] || 0);
              const statusInfo = officialStatusFromSinceFixCount(openCount);
              const isFixedNow = isLightFixed(signId);
              const lifecycleState = String(selectedStreetSignLifecycleSnapshot?.state || "").trim();
              const lifecycleChangedAt = String(selectedStreetSignLifecycleSnapshot?.last_changed_at || "").trim();
              return (
                <>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    <b>Likelihood:</b> {statusInfo.label}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9 }}>
                    <b>{openCount}</b> open report{openCount === 1 ? "" : "s"}
                  </div>
                  {!!lifecycleState && (
                    <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.35 }}>
                      <b>Current state:</b> {incidentStateLabel(lifecycleState)}
                      {!!lifecycleChangedAt && (
                        <> • <b>Last updated:</b> {formatTs(lifecycleChangedAt)}</>
                      )}
                    </div>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => openOfficialLightAllReports(signId, "street_signs")}
                        style={markerPopupActionSecondary}
                      >
                        All Reports
                      </button>
                      {openCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isFixedNow) {
                              toggleFixed(signId);
                              return;
                            }
                            openMarkFixedDialogForLight(signId);
                          }}
                          style={{ ...markerPopupActionPrimary, background: "var(--sl-ui-brand-green)" }}
                        >
                          {isFixedNow ? "Re-open" : "Mark fixed"}
                        </button>
                      )}
                      {mappingMode && (
                        <button
                          type="button"
                          onClick={() => {
                            setPendingDeleteOfficialSignId(signId);
                            setDeleteOfficialSignConfirmOpen(true);
                          }}
                          style={markerPopupActionDanger}
                        >
                          Delete Sign
                        </button>
                      )}
                    </>
                  )}
                </>
              );
            })()}
            {Number(mapZoom) < REPORTING_MIN_ZOOM && (
              <div style={{ fontSize: 11.5, opacity: 0.78, lineHeight: 1.25 }}>
                Zoom in closer to report this sign.
              </div>
            )}
            <button
              type="button"
              disabled={Number(mapZoom) < REPORTING_MIN_ZOOM}
              onClick={() => {
                const signType = formatStreetSignTypeLabel(selectedDomainMarker.sign_type);
                const domainLabel =
                  visibleDomainOptions.find((d) => d.key === adminReportDomain)?.label || "Street signs";
                setDomainReportTarget({
                  domain: "street_signs",
                  domainLabel,
                  lat: Number(selectedDomainMarker.lat),
                  lng: Number(selectedDomainMarker.lng),
                  lightId: String(selectedDomainMarker.id || "").trim(),
                  locationLabel: `${signType} • ${Number(selectedDomainMarker.lat).toFixed(5)}, ${Number(selectedDomainMarker.lng).toFixed(5)}`,
                  signType,
                  nearestAddress: "",
                  nearestLandmark: "",
                  nearestIntersection: "",
                });
                setDomainReportIssue(defaultDomainIssueFor("street_signs"));
                setDomainReportNote("");
              }}
              style={{
                ...markerPopupActionPrimary,
                background: "var(--sl-ui-brand-blue)",
                cursor: Number(mapZoom) < REPORTING_MIN_ZOOM ? "not-allowed" : "pointer",
                opacity: Number(mapZoom) < REPORTING_MIN_ZOOM ? 0.6 : 1,
              }}
              title={Number(mapZoom) >= REPORTING_MIN_ZOOM ? "Report issue" : "Zoom in closer to report"}
            >
              Report issue
            </button>
          </div>
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -7,
              width: 12,
              height: 12,
              background: "var(--sl-ui-modal-bg)",
              borderRight: "1px solid var(--sl-ui-modal-border)",
              borderBottom: "1px solid var(--sl-ui-modal-border)",
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>
      )}

      {!bulkMode && selectedQueuedLightForPopup && selectedQueuedPopupPixel && (
        <div
          style={{
            position: "absolute",
            left: selectedQueuedPopupPixel.x,
            top: selectedQueuedPopupPixel.y,
            transform: "translate(-50%, calc(-100% - 14px))",
            zIndex: 2600,
            pointerEvents: "auto",
            maxWidth: "min(280px, calc(100vw - 20px))",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div
            style={{
              ...markerPopupCardStyle,
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => setSelectedQueuedTempId(null)}
              aria-label="Close"
              style={{
                position: "absolute",
                marginLeft: "auto",
                right: 8,
                top: 8,
                width: 26,
                height: 26,
                borderRadius: 999,
                border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                cursor: "pointer",
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              ×
            </button>

            <div style={{ fontWeight: 900, paddingRight: 26 }}>
              {(selectedQueuedLightForPopup.domain || "streetlights") === "street_signs" ? "Queued sign" : "Queued light"}
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.8 }}>Not saved yet</div>
            {(selectedQueuedLightForPopup.domain || "streetlights") === "street_signs" && (
              <label style={{ display: "grid", gap: 6, fontSize: 12.5, opacity: 0.95 }}>
                <span style={{ fontWeight: 800 }}>Sign type</span>
                <select
                  value={String(selectedQueuedLightForPopup.sign_type || "other")}
                  onChange={(e) =>
                    updateQueuedSignType(selectedQueuedLightForPopup.tempId, e.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 700,
                  }}
                >
                  {STREET_SIGN_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "none",
                background: "#d32f2f",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
              onClick={() => {
                removeFromMappingQueue(selectedQueuedLightForPopup.tempId);
                setSelectedQueuedTempId(null);
                openNotice("✅", "", "", { autoCloseMs: 500, compact: true });
              }}
            >
              {(selectedQueuedLightForPopup.domain || "streetlights") === "street_signs" ? "Delete Sign" : "Delete Light"}
            </button>

            <button style={btnPopupSecondary} onClick={() => setSelectedQueuedTempId(null)}>
              Close
            </button>
          </div>

          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -7,
              width: 12,
              height: 12,
              background: "var(--sl-ui-modal-bg)",
              borderRight: "1px solid var(--sl-ui-modal-border)",
              borderBottom: "1px solid var(--sl-ui-modal-border)",
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />
        </div>
      )}



      {/* =========================
          Floating tool buttons (mobile + desktop)
         ========================= */}
      <div className="sl-map-tool">
        {!!toolHintText && (
          <div
            style={{
              position: "absolute",
              right: "calc(100% + 10px)",
              top: `${(Number.isFinite(toolHintIndex) ? toolHintIndex : 0) * 56 + 24}px`,
              transform: "translateY(-50%)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <div className="sl-map-tool-hint">{toolHintText}</div>
          </div>
        )}

        {/* Satellite toggle */}
        <button
          type="button"
          className="sl-map-tool-mini"
                    onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMapType((t) => {
              const next = t === "roadmap" ? "satellite" : "roadmap";
              showToolHint(next === "satellite" ? "Satellite view" : "Map view", 1100, 0);
              return next;
            });
          }}
          title={mapType === "satellite" ? "Satellite" : "Street map"}
          aria-label="Toggle satellite map"
        >
            <AppIcon
              src={mapType === "satellite" ? UI_ICON_SRC.streetMap : UI_ICON_SRC.satellite}
              size={38}
            />
          </button>

        <button
          type="button"
          className="sl-map-tool-mini"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Freeze heading orientation until the user explicitly taps location again.
            followHeadingEnabledRef.current = false;
            try {
              if (mapRef.current?.moveCamera) {
                mapRef.current.moveCamera({
                  heading: 0,
                  tilt: 0,
                });
              } else if (mapRef.current?.setHeading) {
                mapRef.current.setHeading(0);
                mapRef.current?.setTilt?.(0);
              }
            } catch {
              // ignore
            }
            showToolHint("Realigned to north", 1100, 1);
          }}
          title="Reset heading"
          aria-label="Reset heading"
        >
          <AppIcon src={UI_ICON_SRC.headingReset} size={38} />
        </button>

        <button
          type="button"
          className={`sl-map-tool-mini ${locating ? "is-on" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            // If denied previously → show prompt modal (which calls forced retry)
            if (geoDenied) {
            setShowLocationPrompt(true);
            return;
          }

            // Normal locate
            showToolHint("Location", 1100, 2);
            followHeadingEnabledRef.current = true;
            findMyLocation(false);
          }}
          title="Find my location"
          aria-label="Find my location"
        >
            <AppIcon src={UI_ICON_SRC.location} size={38} />
          </button>

        {
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className={`sl-map-tool-mini sl-has-submenu ${adminDomainMenuOpen ? "is-on" : ""}`}
              title={`Report domain: ${adminDomainMeta.label}`}
              aria-label="Select report domain"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAdminDomainMenuOpen((p) => {
                  const next = !p;
                  if (next) setAdminToolboxOpen(false);
                  return next;
                });
                showToolHint(`Domain: ${adminDomainMeta.label}`, 1000, 3);
              }}
            >
              <AppIcon src={adminDomainMeta.iconSrc} size={38} />
            </button>
            {adminDomainMenuOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  right: "calc(100% + 10px)",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "var(--sl-ui-modal-bg)",
                  border: "1px solid var(--sl-ui-modal-border)",
                  borderRadius: 12,
                  boxShadow: "var(--sl-ui-modal-shadow)",
                  padding: 8,
                  display: "grid",
                  gap: 6,
                  zIndex: 3,
                  minWidth: 170,
                }}
              >
                {visibleDomainOptions.map((d) => {
                  const isOn = d.key === adminReportDomain;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => {
                        if (!d.enabled) return;
                        requestAdminDomainSwitch(d.key, d.label);
                      }}
                      disabled={!d.enabled}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 9px",
                        borderRadius: 9,
                        border: isOn
                          ? "1px solid var(--sl-ui-tool-active-border)"
                          : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                        background: isOn
                          ? "var(--sl-ui-tool-active-bg)"
                          : "var(--sl-ui-modal-btn-secondary-bg)",
                        color: isOn
                          ? "var(--sl-ui-tool-active-text)"
                          : "var(--sl-ui-modal-btn-secondary-text)",
                        fontWeight: 900,
                        cursor: d.enabled ? "pointer" : "not-allowed",
                        opacity: d.enabled ? 1 : 0.6,
                        justifyContent: "flex-start",
                      }}
                    >
                      <AppIcon src={d.iconSrc} size={30} />
                      <span style={{ fontSize: 12.5 }}>{d.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        }

        {canUseStreetlightBulk && (
          <button
            type="button"
            className={`sl-map-tool-mini sl-bulk-tool-btn ${bulkMode ? "is-on" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();

              setBulkConfirmOpen(false);

              setBulkMode((on) => {
                const next = !on;
                showToolHint(next ? "Save multiple light reports" : "Save one light report", 1100, 4);

                if (next) {
                  setDeleteCircleMode(false);
                  setDeleteCircleDraft(null);
                  setDeleteCircleConfirmOpen(false);
                  setSelectedOfficialId(null);
                  setMappingMode(false);
                  setMappingQueue([]);

                  closeAnyPopup();
                  suppressPopupsSafe(1600);
                } else {
                  clearBulkSelection();
                }

                return next;
              });
            }}
            title={bulkMode ? "Bulk selection ON" : "Bulk selection OFF"}
            aria-label="Toggle bulk selection"
          >
            <AppIcon src={UI_ICON_SRC.bulk} size={38} />
          </button>
        )}
        {(isAdmin || showAdminTools) && (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              className={`sl-map-tool-mini sl-has-submenu ${adminToolboxOpen ? "is-on" : ""}`}
              title="Admin tools"
              aria-label="Admin tools"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAdminToolboxOpen((p) => {
                  const next = !p;
                  if (next) setAdminDomainMenuOpen(false);
                  return next;
                });
                showToolHint("Admin tools", 1000, 5);
              }}
            >
              <AppIcon src={UI_ICON_SRC.toolbox} size={38} />
            </button>

            {adminToolboxOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: "absolute",
                  right: "calc(100% + 10px)",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "var(--sl-ui-modal-bg)",
                  border: "1px solid var(--sl-ui-modal-border)",
                  borderRadius: 12,
                  boxShadow: "var(--sl-ui-modal-shadow)",
                  padding: 8,
                  display: "grid",
                  gap: 6,
                  zIndex: 3,
                  minWidth: 180,
                }}
              >
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (mappingMode) requestExitMappingMode();
                      if (bulkMode) setBulkMode(false);
                      openOpenReports({ inViewOnly: false });
                      setAdminToolboxOpen(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 9px",
                      borderRadius: 9,
                      border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: "var(--sl-ui-modal-btn-secondary-bg)",
                      color: "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                      justifyContent: "flex-start",
                    }}
                  >
                      <AppIcon src={UI_ICON_SRC.openReports} size={30} />
                      <span style={{ fontSize: 12.5 }}>Reports</span>
                    </button>
                )}

                {isAdmin && isStreetlightsDomain && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteCircleMode((on) => {
                        const next = !on;
                        if (next) {
                          setDeleteCircleDraft(null);
                          setDeleteCircleConfirmOpen(false);
                          setDeleteCircleNote("");
                          setMappingMode(false);
                          setMappingQueue([]);
                          setBulkMode(false);
                          setBulkConfirmOpen(false);
                          clearBulkSelection();
                          closeAnyPopup();
                          suppressPopupsSafe(1200);
                          openNotice("🟢", "Circle mark fixed on", "Tap map once for center, then again for radius.");
                        } else {
                          setDeleteCircleDraft(null);
                          setDeleteCircleConfirmOpen(false);
                          setDeleteCircleNote("");
                          openNotice("✅", "Circle mark fixed off", "", { autoCloseMs: 800, compact: true });
                        }
                        return next;
                      });
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 9px",
                      borderRadius: 9,
                      border: deleteCircleMode
                        ? "1px solid #ff1744"
                        : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: deleteCircleMode
                        ? "rgba(255, 23, 68, 0.12)"
                        : "var(--sl-ui-modal-btn-secondary-bg)",
                      color: deleteCircleMode
                        ? "#ff1744"
                        : "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                      justifyContent: "flex-start",
                    }}
                  >
                    <span style={{ fontSize: 16, lineHeight: 1 }}>◯</span>
                    <span style={{ fontSize: 12.5 }}>
                      {deleteCircleMode ? "Circle Mark Fixed On" : "Circle Mark Fixed"}
                    </span>
                  </button>
                )}

                {showAdminTools && (isStreetlightsDomain || isStreetSignsDomain) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMappingMode((on) => {
                        const next = !on;
                        showToolHint(next ? "Mapping mode on" : "Mapping mode off", 1100, 2);

                        if (next) {
                          setBulkMode(false);
                          setBulkConfirmOpen(false);
                          clearBulkSelection();
                          setDeleteCircleMode(false);
                          setDeleteCircleDraft(null);
                          setDeleteCircleConfirmOpen(false);
                          setDeleteCircleNote("");
                          suppressPopupsSafe(1600);
                          closeAnyPopup();
                        } else if (mappingQueue.length > 0) {
                          setExitMappingConfirmOpen(true);
                          return true;
                        } else {
                          setMappingQueue([]);
                        }
                        return next;
                      });
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 9px",
                      borderRadius: 9,
                      border: mappingMode
                        ? "1px solid var(--sl-ui-tool-active-border)"
                        : "1px solid var(--sl-ui-modal-btn-secondary-border)",
                      background: mappingMode
                        ? "var(--sl-ui-tool-active-bg)"
                        : "var(--sl-ui-modal-btn-secondary-bg)",
                      color: mappingMode
                        ? "var(--sl-ui-tool-active-text)"
                        : "var(--sl-ui-modal-btn-secondary-text)",
                      fontWeight: 900,
                      cursor: "pointer",
                      justifyContent: "flex-start",
                    }}
                  >
                      <AppIcon src={UI_ICON_SRC.mapping} size={30} />
                      <span style={{ fontSize: 12.5 }}>{mappingMode ? "Mapping On" : "Mapping"}</span>
                    </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <NotificationPreferencesModal
        open={notificationPreferencesOpen}
        onClose={() => {
          setNotificationPreferencesByTopic(savedNotificationPreferencesByTopic);
          setNotificationPreferencesStatus("");
          setNotificationPreferencesOpen(false);
        }}
        onSave={() => void saveNotificationPreferences()}
        topics={notificationTopics}
        preferencesByTopic={notificationPreferencesByTopic}
        updatePreferenceDraft={updateNotificationPreferenceDraft}
        saving={notificationPreferencesSaving}
        loading={notificationPreferencesLoading}
        status={notificationPreferencesStatus}
        darkMode={prefersDarkMode}
      />
      <ContactUsModal
        open={contactUsOpen}
        onClose={() => setContactUsOpen(false)}
        organizationDisplayName={organizationDisplayName}
        contactEmail={headerOrganizationProfile?.contact_primary_email}
        contactPhone={headerOrganizationProfile?.contact_primary_phone}
        websiteUrl={headerOrganizationProfile?.website_url}
        darkMode={prefersDarkMode}
      />
      <AlertsWindow
        open={alertsWindowOpen}
        onClose={() => setAlertsWindowOpen(false)}
        alerts={mapCommunityAlerts}
        loading={mapCommunityFeedLoading}
        error={mapCommunityFeedError}
        darkMode={prefersDarkMode}
      />
      <EventsWindow
        open={eventsWindowOpen}
        onClose={() => setEventsWindowOpen(false)}
        events={mapCommunityEvents}
        loading={mapCommunityFeedLoading}
        error={mapCommunityFeedError}
        darkMode={prefersDarkMode}
      />

      {/* =========================
          Mobile UI overlays
         ========================= */}
          
      {/* =========================
          Desktop UI overlays
        ========================= */}
      <div className="sl-desktop-only">
        {/* TOP overlay */}
        <div
          className="sl-overlay-pass"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1600,
            pointerEvents: "none",
            fontFamily: "var(--app-header-font-family)",
          }}
        >
          <div
            style={{
              padding: "0 var(--desktop-header-horizontal-padding)",
              borderBottom: mapHeaderTheme.desktopBorder,
              backdropFilter: "blur(14px)",
              background: mapHeaderTheme.desktopBackground,
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(var(--desktop-header-side-column), 1fr) minmax(0, 2fr) minmax(var(--desktop-header-side-column), 1fr)",
                alignItems: "center",
                gap: 16,
                height: "var(--desktop-header-height)",
                minHeight: "var(--desktop-header-height)",
                minWidth: 0,
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "grid",
                  alignItems: "center",
                  justifyItems: "start",
                  minWidth: 0,
                }}
              >
                {titleLogoError ? (
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 950,
                      lineHeight: 1.05,
                      color: mapHeaderTheme.textColor,
                    }}
                  >
                    CityReport.io
                  </span>
                ) : (
                  <img
                    src={titleLogoSrc}
                    alt={TITLE_LOGO_ALT}
                    onError={() => setTitleLogoError(true)}
                    style={{
                      width: "auto",
                      maxWidth: "min(240px, calc(100vw - 180px))",
                      height: "var(--desktop-header-logo-height)",
                      objectFit: "contain",
                      objectPosition: "left center",
                      display: "block",
                    }}
                  />
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "var(--desktop-header-stack-gap)",
                  minWidth: 0,
                  textAlign: "center",
                  justifyItems: "center",
                  color: mapHeaderTheme.textColor,
                }}
              >
                <span className="app-header-eyebrow" style={{ color: mapHeaderTheme.eyebrowColor }}>Reporting Map</span>
                <h1
                  style={{
                    margin: 0,
                    fontSize: "var(--desktop-header-title-size)",
                    fontWeight: "var(--desktop-header-title-weight)",
                    lineHeight: "var(--desktop-header-title-line-height)",
                    color: mapHeaderTheme.textColor,
                  }}
                >
                  {organizationDisplayName}
                </h1>
              </div>

              <div
                ref={desktopAccountMenuAnchorRef}
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  minWidth: 0,
                  position: "relative",
                }}
              >
                <button
                  type="button"
                  onClick={handleAccountMenuToggle}
                  aria-label={session?.user?.id ? "Open account menu" : "Log in"}
                  title={session?.user?.id ? "Account" : "Log in"}
                  style={{
                    width: session?.user?.id ? "var(--desktop-header-menu-size)" : "auto",
                    height: "var(--desktop-header-menu-size)",
                    borderRadius: 999,
                    border: mapHeaderTheme.desktopMenuBorder,
                    background: mapHeaderTheme.desktopMenuBackground,
                    color: mapHeaderTheme.textColor,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: session?.user?.id ? 0 : "0 14px",
                    cursor: "pointer",
                    lineHeight: 1,
                    boxShadow: mapHeaderTheme.desktopMenuShadow,
                    fontSize: session?.user?.id ? undefined : 13,
                    fontWeight: session?.user?.id ? undefined : 900,
                    letterSpacing: session?.user?.id ? undefined : "0.01em",
                  }}
                >
                  {session?.user?.id ? (
                    <span style={{ display: "grid", gap: 4 }}>
                      <span style={{ width: 18, height: 2, borderRadius: 999, background: "currentColor", display: "block" }} />
                      <span style={{ width: 18, height: 2, borderRadius: 999, background: "currentColor", display: "block" }} />
                      <span style={{ width: 18, height: 2, borderRadius: 999, background: "currentColor", display: "block" }} />
                    </span>
                  ) : (
                    "Log in"
                  )}
                </button>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "10px var(--desktop-header-horizontal-padding) 0",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: "100%",
                padding: 0,
                pointerEvents: "auto",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px minmax(0, 1fr)",
                  alignItems: "start",
                  gap: 16,
                  width: "100%",
                }}
              >
                <div style={{ display: "grid", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => nudgeMapZoom(1)}
                    aria-label="Zoom in"
                    title="Zoom in"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-zoom-border)",
                      background: "var(--sl-ui-zoom-bg)",
                      boxShadow: "var(--sl-ui-zoom-shadow)",
                      color: "var(--sl-ui-text)",
                      fontSize: 22,
                      fontWeight: 900,
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => nudgeMapZoom(-1)}
                    aria-label="Zoom out"
                    title="Zoom out"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: "1px solid var(--sl-ui-zoom-border)",
                      background: "var(--sl-ui-zoom-bg)",
                      boxShadow: "var(--sl-ui-zoom-shadow)",
                      color: "var(--sl-ui-text)",
                      fontSize: 22,
                      fontWeight: 900,
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    –
                  </button>
                  {showMapAlertIcon ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAdminDomainMenuOpen(false);
                      setAdminToolboxOpen(false);
                      setEventsWindowOpen(false);
                      setAlertsWindowOpen((prev) => !prev);
                    }}
                    aria-label="Open alerts"
                    title="Open alerts"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: alertsWindowOpen
                        ? "1px solid var(--sl-ui-tool-active-border)"
                        : "1px solid var(--sl-ui-zoom-border)",
                      background: alertsWindowOpen
                        ? "var(--sl-ui-tool-active-bg)"
                        : "var(--sl-ui-zoom-bg)",
                      boxShadow: "var(--sl-ui-zoom-shadow)",
                      color: alertsWindowOpen
                        ? "var(--sl-ui-tool-active-text)"
                        : "var(--sl-ui-text)",
                      cursor: "pointer",
                      lineHeight: 1,
                      position: "relative",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <AppIcon src={UI_ICON_SRC.notification} size={22} />
                    {mapAlertsUnreadCount > 0 ? (
                      <span
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -4,
                          minWidth: 18,
                          height: 18,
                          padding: "0 5px",
                          borderRadius: 999,
                          background: "#c62828",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.88)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10.5,
                          fontWeight: 900,
                          lineHeight: 1,
                        }}
                    >
                      {mapAlertsUnreadCount > 99 ? "99+" : mapAlertsUnreadCount}
                    </span>
                  ) : null}
                  </button>
                  ) : null}
                  {showMapEventIcon ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAdminDomainMenuOpen(false);
                      setAdminToolboxOpen(false);
                      setAlertsWindowOpen(false);
                      setEventsWindowOpen((prev) => !prev);
                    }}
                    aria-label="Open events"
                    title="Open events"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      border: eventsWindowOpen
                        ? "1px solid var(--sl-ui-tool-active-border)"
                        : "1px solid var(--sl-ui-zoom-border)",
                      background: eventsWindowOpen
                        ? "var(--sl-ui-tool-active-bg)"
                        : "var(--sl-ui-zoom-bg)",
                      boxShadow: "var(--sl-ui-zoom-shadow)",
                      color: eventsWindowOpen
                        ? "var(--sl-ui-tool-active-text)"
                        : "var(--sl-ui-text)",
                      cursor: "pointer",
                      lineHeight: 1,
                      position: "relative",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <AppIcon src={UI_ICON_SRC.calendar} size={22} />
                    {mapEventsUnreadCount > 0 ? (
                      <span
                        style={{
                          position: "absolute",
                          top: -4,
                          right: -4,
                          minWidth: 18,
                          height: 18,
                          padding: "0 5px",
                          borderRadius: 999,
                          background: "#176d78",
                          color: "#fff",
                          border: "1px solid rgba(255,255,255,0.88)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 10.5,
                          fontWeight: 900,
                          lineHeight: 1,
                        }}
                    >
                      {mapEventsUnreadCount > 99 ? "99+" : mapEventsUnreadCount}
                    </span>
                  ) : null}
                  </button>
                  ) : null}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    flexWrap: "wrap",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  {isAggregatedReportingDomain && (
                    <div
                      onClick={() => openMyReports({ domainKey: adminReportDomain, inViewOnly: true })}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openMyReports({ domainKey: adminReportDomain, inViewOnly: true });
                        }
                      }}
                      style={{
                        width: "fit-content",
                        maxWidth: "min(720px, calc(100vw - 180px))",
                        fontSize: 11.5,
                        opacity: 1,
                        textAlign: "left",
                        color: inViewCounterColor,
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: `1px solid ${inViewCounterBorder}`,
                        background: inViewCounterBg,
                        boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
                        backdropFilter: "blur(2px)",
                        WebkitBackdropFilter: "blur(2px)",
                        cursor: "pointer",
                      }}
                    >
                      Reports in view: <b>{openReportsInViewCount}</b>
                    </div>
                  )}
                  {isStreetlightsDomain && (
                    <>
                      <div
                        onClick={() => toggleStreetlightInViewFilter("saved")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleStreetlightInViewFilter("saved");
                          }
                        }}
                        style={{
                          width: "fit-content",
                          maxWidth: "min(720px, calc(100vw - 180px))",
                          fontSize: 11.5,
                          opacity: 1,
                          textAlign: "left",
                          color: inViewCounterColor,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: isSavedStreetlightFilterOn
                            ? "1px solid var(--sl-ui-tool-active-border)"
                            : `1px solid ${inViewCounterBorder}`,
                          background: isSavedStreetlightFilterOn
                            ? "var(--sl-ui-tool-active-bg)"
                            : inViewCounterBg,
                          boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
                          backdropFilter: "blur(2px)",
                          WebkitBackdropFilter: "blur(2px)",
                          cursor: "pointer",
                        }}
                      >
                        Saved lights in view: <b>{Number(streetlightPersonalInViewStats.saved || 0)}</b>
                      </div>
                      <div
                        onClick={() => toggleStreetlightInViewFilter("utility")}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleStreetlightInViewFilter("utility");
                          }
                        }}
                        style={{
                          width: "fit-content",
                          maxWidth: "min(720px, calc(100vw - 180px))",
                          fontSize: 11.5,
                          opacity: 1,
                          textAlign: "left",
                          color: inViewCounterColor,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: isUtilityStreetlightFilterOn
                            ? "1px solid var(--sl-ui-tool-active-border)"
                            : `1px solid ${inViewCounterBorder}`,
                          background: isUtilityStreetlightFilterOn
                            ? "var(--sl-ui-tool-active-bg)"
                            : inViewCounterBg,
                          boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
                          backdropFilter: "blur(2px)",
                          WebkitBackdropFilter: "blur(2px)",
                          cursor: "pointer",
                        }}
                      >
                        Utility reported in view: <b>{Number(streetlightPersonalInViewStats.utility || 0)}</b>
                      </div>
                    </>
                  )}
                  {isAdmin && openAbuseFlagSummary.total > 0 && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setModerationFlagsOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setModerationFlagsOpen(true);
                        }
                      }}
                      style={{
                        width: "fit-content",
                        maxWidth: "min(720px, calc(100vw - 180px))",
                        fontSize: 11.5,
                        fontWeight: 850,
                        textAlign: "left",
                        color: "#fff",
                        padding: "4px 8px",
                        borderRadius: 999,
                        border: "1px solid rgba(255,255,255,0.18)",
                        background:
                          openAbuseFlagSummary.maxSeverity >= 3
                            ? "rgba(183, 28, 28, 0.86)"
                            : openAbuseFlagSummary.maxSeverity >= 2
                              ? "rgba(239, 108, 0, 0.84)"
                              : "rgba(33, 150, 83, 0.80)",
                        boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
                        backdropFilter: "blur(2px)",
                        WebkitBackdropFilter: "blur(2px)",
                        cursor: "pointer",
                      }}
                      title="Open moderation flags"
                    >
                      Moderation flags open: <b>{openAbuseFlagSummary.total}</b>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <AccountMenuPanel
          open={accountMenuOpen && !isMobile}
          session={session}
          profile={profile}
          variant="desktop-popout"
          containerRef={desktopAccountMenuPanelRef}
          onClose={() => {
            setAccountMenuOpen(false);
            setAccountView("menu");
          }}
          onManage={() => {
            setAccountMenuOpen(false);
            setManageEditing(false);
            setManageOpen(true);
          }}
          onNotificationPreferences={() => {
            setAccountMenuOpen(false);
            setNotificationPreferencesStatus("");
            setNotificationPreferencesOpen(true);
          }}
          onMyReports={() => {
            setAccountMenuOpen(false);
            openMyReports();
          }}
          darkMode={prefersDarkMode}
          onContactUs={() => {
            setAccountMenuOpen(false);
            setContactUsOpen(true);
          }}
          onLogout={() => {
            signOut();
            setAccountMenuOpen(false);
          }}
        />

        {/* =========================
              Bulk Action Bar (desktop)
            ========================= */}
          {canUseStreetlightBulk && bulkMode && (
            <div
              className="sl-overlay-pass"
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "calc(14px + 86px)", // sits above the disclaimer card
                zIndex: 1601,
                padding: "0 16px",
              }}
            >
              <div
                style={{
                  width: "min(720px, calc(100vw - 32px))",
                  margin: "0 auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    alignSelf: "center",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: 0.2,
                    color: "#fff",
                    background: "rgba(0,0,0,0.68)",
                    boxShadow: "0 8px 18px rgba(0,0,0,0.2)",
                  }}
                >
                  Max {BULK_MAX_LIGHTS_PER_SUBMIT} lights per bulk report
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearBulkSelection();
                  }}
                  disabled={bulkSelectedCount === 0 || saving}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "rgba(255,255,255,0.96)",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                    fontWeight: 900,
                    cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
                    opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
                  }}
                >
                  Clear Selection
                </button>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (bulkSelectedCount === 0) {
                      openNotice("⚠️", "No lights selected", "Tap multiple official 💡 lights first.");
                      return;
                    }

                    if (Number(mapZoomRef.current || mapZoom) < REPORTING_MIN_ZOOM) {
                      openNotice("🔎", "Zoom in to report", `Zoom in closer (level ${REPORTING_MIN_ZOOM}+) before submitting bulk reports.`);
                      return;
                    }

                    closeAnyPopup();
                    suppressPopupsSafe(1600);

                    setNote("");
                    setReportType("out");
                    setStreetlightAreaPowerOn("");
                    setStreetlightHazardYesNo("");
                    setBulkConfirmOpen(true);
                  }}
                  disabled={bulkSelectedCount === 0 || saving}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "none",
                    background: "var(--sl-ui-brand-green)",
                    color: "white",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                    fontWeight: 900,
                    cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
                    opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
                  }}
                >
                  Save light{bulkSelectedCount === 1 ? "" : "s"} {bulkSelectedCount ? `(${bulkSelectedCount})` : ""}
                </button>
                </div>
              </div>
            </div>
          )}

          {mappingMode && mappingQueue.length > 0 && (
            <div
              className="sl-overlay-pass"
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "calc(14px + 86px)",
                zIndex: 1601,
                padding: "0 16px",
              }}
            >
              <div
                style={{
                  width: "min(720px, calc(100vw - 32px))",
                  margin: "0 auto",
                  display: "flex",
                  gap: 10,
                }}
              >
                <button
                  onClick={requestClearQueuedLights}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 900,
                  }}
                >
                  Clear
                </button>

                <button
                  onClick={confirmMappingQueue}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "none",
                    background: "var(--sl-ui-brand-green)",
                    color: "white",
                    fontWeight: 900,
                  }}
                >
                  Place {mappingQueue.length} {mappingUnitLabel}{mappingQueue.length !== 1 && "s"}
                </button>
              </div>
            </div>
          )}


        {/* BOTTOM about/disclaimer */}
        <div
          className="sl-overlay-pass"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1600,
            padding: "0 16px 14px",
          }}
        >
          <div
            style={{
              display: "none",
              width: "fit-content",
              maxWidth: "min(720px, calc(100vw - 32px))",
              margin: "0 auto 6px",
              fontSize: 11.5,
              opacity: 1,
              textAlign: "left",
              color: inViewCounterColor,
              padding: "4px 8px",
              borderRadius: 999,
              border: `1px solid ${inViewCounterBorder}`,
              background: inViewCounterBg,
              boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          >
            Reports in view: <b>{openReportsInViewCount}</b>
          </div>
          <div
              style={{
                width: "calc(100vw - 32px)",
                margin: "0 auto",
                background: "var(--sl-ui-surface-bg)",
                border: "1px solid var(--sl-ui-surface-border)",
                borderRadius: 14,
                boxShadow: "var(--sl-ui-surface-shadow-bottom)",
              padding: 12,
              display: "grid",
              gap: 8,
              position: "relative",
                color: "var(--sl-ui-text)",
              }}
          >
            <button
              type="button"
              onClick={() => setInfoMenuOpen(true)}
              title="Info"
              aria-label="Open info menu"
              style={{
                position: "absolute",
                right: 10,
                top: 10,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: "none",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                lineHeight: 1,
                pointerEvents: "auto",
                touchAction: "manipulation",
                zIndex: 2,
              }}
            >
              <AppIcon src={UI_ICON_SRC.info} size={20} />
            </button>
            <div style={{ fontSize: 12.5, opacity: 0.78, lineHeight: 1.35, paddingRight: 34, display: "grid", gap: 4 }}>
              <div>
                <b>About:</b> Community-reported issues and repair confirmations are shared here for public visibility.
              </div>
              <div>
                <b>Disclaimer:</b> This does not replace emergency services or official agency reporting.
              </div>
            </div>
          </div>
        </div>
      </div>

        <div className="sl-mobile-only">
        {/* TOP overlay */}
        <div
          className="sl-overlay-pass"
          style={{
            position: "fixed",
            top: "calc(8px + env(safe-area-inset-top))",
            left: 0,
            right: 0,
            zIndex: accountMenuOpen ? 2602 : 1600,
            display: "grid",
            placeItems: "center",
            padding: "0 10px",
            fontFamily: "var(--app-header-font-family)",
          }}
        >
            <div
              style={{
                position: "relative",
                width: "min(520px, calc(100vw - 20px))",
                marginLeft: 0,
              }}
            >
              <div
                style={{
                  position: "fixed",
                  left: 10,
                  bottom: "calc(10px + env(safe-area-inset-bottom) + 86px)",
                  transform: "none",
                  display: "none",
                  gap: 6,
                  pointerEvents: "auto",
                  zIndex: 2201,
                }}
              >
              <button
                type="button"
                onClick={() => nudgeMapZoom(1)}
                aria-label="Zoom in"
                title="Zoom in"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid var(--sl-ui-zoom-border)",
                    background: "var(--sl-ui-zoom-bg)",
                    boxShadow: "var(--sl-ui-zoom-shadow-mobile)",
                    color: "var(--sl-ui-text)",
                    fontSize: 20,
                  fontWeight: 900,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => nudgeMapZoom(-1)}
                aria-label="Zoom out"
                title="Zoom out"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid var(--sl-ui-zoom-border)",
                    background: "var(--sl-ui-zoom-bg)",
                    boxShadow: "var(--sl-ui-zoom-shadow-mobile)",
                    color: "var(--sl-ui-text)",
                    fontSize: 20,
                  fontWeight: 900,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
              >
                –
              </button>
            </div>

            <div
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "var(--mobile-header-side-column) 1fr var(--mobile-header-side-column)",
                  alignItems: "center",
                  gap: 0,
                  height: "var(--mobile-header-height)",
                  minHeight: "var(--mobile-header-height)",
                  padding: "var(--mobile-header-padding-y) var(--mobile-header-padding-x)",
                  border: mapHeaderTheme.mobileBorder,
                  borderRadius: "var(--mobile-header-radius)",
                  background: mapHeaderTheme.mobileBackground,
                  boxShadow: "var(--mobile-header-shadow)",
                  color: mapHeaderTheme.textColor,
                  overflow: accountMenuOpen ? "visible" : "hidden",
                }}
            >
              <div
                style={{
                  gridColumn: 1,
                  width: "var(--mobile-header-side-column)",
                  minWidth: 0,
                  alignSelf: "stretch",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  flex: "0 0 auto",
                }}
              >
                {titleLogoError ? (
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 950,
                      lineHeight: 1.05,
                      color: mapHeaderTheme.textColor,
                    }}
                  >
                    CR
                  </span>
                ) : (
                  <img
                    src={mobileTitleLogoSrc}
                    alt={TITLE_LOGO_ALT}
                    onError={() => setTitleLogoError(true)}
                    style={{
                      width: "var(--mobile-header-logo-size)",
                      height: "var(--mobile-header-logo-size)",
                      objectFit: "contain",
                      objectPosition: "left center",
                      display: "block",
                    }}
                  />
                )}
              </div>

              <div
                className="app-mobile-header-copy"
                style={{
                  gridColumn: 2,
                  minWidth: 0,
                }}
              >
                <span className="app-header-eyebrow" style={{ color: mapHeaderTheme.eyebrowColor }}>Reporting Map</span>
                <h1 className="app-mobile-header-title" style={{ color: mapHeaderTheme.textColor }}>{organizationDisplayName}</h1>
              </div>

              <div
                style={{
                  gridColumn: 3,
                  position: "static",
                  width: "auto",
                  minWidth: "var(--mobile-header-side-column)",
                  alignSelf: "stretch",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  zIndex: 2,
                }}
              >
                <button
                  type="button"
                  onClick={handleAccountMenuToggle}
                  aria-label={session?.user?.id ? "Open account menu" : "Login"}
                  title={session?.user?.id ? "Account" : "Login"}
                  style={{
                    width: session?.user?.id ? "var(--mobile-header-menu-size)" : "auto",
                    minWidth: "var(--mobile-header-side-column)",
                    height: "var(--mobile-header-menu-size)",
                    border: session?.user?.id ? mapHeaderTheme.mobileMenuBorder : mapHeaderTheme.mobileMenuBorder,
                    background: session?.user?.id ? mapHeaderTheme.mobileMenuBackground : mapHeaderTheme.mobileMenuBackground,
                    color: mapHeaderTheme.textColor,
                    borderRadius: 999,
                    padding: session?.user?.id ? 0 : "var(--app-tab-button-padding-y) var(--app-tab-button-padding-x)",
                    display: "inline-flex",
                    flexDirection: session?.user?.id ? "column" : "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: session?.user?.id ? 4 : 0,
                    cursor: "pointer",
                    boxShadow: "none",
                    fontSize: session?.user?.id ? undefined : "var(--app-tab-button-font-size)",
                    fontWeight: session?.user?.id ? undefined : "var(--app-tab-button-font-weight)",
                    textDecoration: "none",
                    lineHeight: 1,
                  }}
                >
                  {session?.user?.id ? (
                    <>
                      <span style={{ width: 18, height: 2, borderRadius: 999, background: "currentColor", display: "block" }} />
                      <span style={{ width: 18, height: 2, borderRadius: 999, background: "currentColor", display: "block" }} />
                      <span style={{ width: 18, height: 2, borderRadius: 999, background: "currentColor", display: "block" }} />
                    </>
                  ) : (
                    "Login"
                  )}
                </button>
              </div>

            {/* Account Menu panel (mobile) */}
            <AccountMenuPanel
              open={accountMenuOpen}
              session={session}
              profile={profile}
              variant="mobile-popout"
              onClose={() => {
                setAccountMenuOpen(false);
                setAccountView("menu");
              }}
              onManage={() => {
                setAccountMenuOpen(false);
                setManageEditing(false);
                setManageOpen(true);
              }}
              onNotificationPreferences={() => {
                setAccountMenuOpen(false);
                setNotificationPreferencesStatus("");
                setNotificationPreferencesOpen(true);
              }}
              onMyReports={() => {
                setAccountMenuOpen(false);
                openMyReports();
              }}
              darkMode={prefersDarkMode}
              onContactUs={() => {
                setAccountMenuOpen(false);
                setContactUsOpen(true);
              }}
              onLogout={() => {
                signOut();
                setAccountMenuOpen(false);
              }}
            />

              </div>

            <div
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                width: "min(520px, calc(100vw - 20px))",
                pointerEvents: "auto",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => nudgeMapZoom(1)}
                  aria-label="Zoom in"
                  title="Zoom in"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid var(--sl-ui-zoom-border)",
                    background: "var(--sl-ui-zoom-bg)",
                    boxShadow: "var(--sl-ui-zoom-shadow-mobile)",
                    color: "var(--sl-ui-text)",
                    fontSize: 20,
                    fontWeight: 900,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => nudgeMapZoom(-1)}
                  aria-label="Zoom out"
                  title="Zoom out"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: "1px solid var(--sl-ui-zoom-border)",
                    background: "var(--sl-ui-zoom-bg)",
                    boxShadow: "var(--sl-ui-zoom-shadow-mobile)",
                    color: "var(--sl-ui-text)",
                    fontSize: 20,
                    fontWeight: 900,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  –
                </button>
                {showMapAlertIcon ? (
                <button
                  type="button"
                  onClick={() => {
                    setAdminDomainMenuOpen(false);
                    setAdminToolboxOpen(false);
                    setEventsWindowOpen(false);
                    setAlertsWindowOpen((prev) => !prev);
                  }}
                  aria-label="Open alerts"
                  title="Open alerts"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: alertsWindowOpen
                      ? "1px solid var(--sl-ui-tool-active-border)"
                      : "1px solid var(--sl-ui-zoom-border)",
                    background: alertsWindowOpen
                      ? "var(--sl-ui-tool-active-bg)"
                      : "var(--sl-ui-zoom-bg)",
                    boxShadow: "var(--sl-ui-zoom-shadow-mobile)",
                    color: alertsWindowOpen
                      ? "var(--sl-ui-tool-active-text)"
                      : "var(--sl-ui-text)",
                    cursor: "pointer",
                    lineHeight: 1,
                    position: "relative",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <AppIcon src={UI_ICON_SRC.notification} size={18} />
                  {mapAlertsUnreadCount > 0 ? (
                    <span
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        minWidth: 16,
                        height: 16,
                        padding: "0 4px",
                        borderRadius: 999,
                        background: "#c62828",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.88)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9.5,
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                  >
                    {mapAlertsUnreadCount > 99 ? "99+" : mapAlertsUnreadCount}
                  </span>
                ) : null}
                </button>
                ) : null}
                {showMapEventIcon ? (
                <button
                  type="button"
                  onClick={() => {
                    setAdminDomainMenuOpen(false);
                    setAdminToolboxOpen(false);
                    setAlertsWindowOpen(false);
                    setEventsWindowOpen((prev) => !prev);
                  }}
                  aria-label="Open events"
                  title="Open events"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: eventsWindowOpen
                      ? "1px solid var(--sl-ui-tool-active-border)"
                      : "1px solid var(--sl-ui-zoom-border)",
                    background: eventsWindowOpen
                      ? "var(--sl-ui-tool-active-bg)"
                      : "var(--sl-ui-zoom-bg)",
                    boxShadow: "var(--sl-ui-zoom-shadow-mobile)",
                    color: eventsWindowOpen
                      ? "var(--sl-ui-tool-active-text)"
                      : "var(--sl-ui-text)",
                    cursor: "pointer",
                    lineHeight: 1,
                    position: "relative",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <AppIcon src={UI_ICON_SRC.calendar} size={18} />
                  {mapEventsUnreadCount > 0 ? (
                    <span
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -4,
                        minWidth: 16,
                        height: 16,
                        padding: "0 4px",
                        borderRadius: 999,
                        background: "#176d78",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.88)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9.5,
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                  >
                    {mapEventsUnreadCount > 99 ? "99+" : mapEventsUnreadCount}
                  </span>
                ) : null}
                </button>
                ) : null}
              </div>
              {isAggregatedReportingDomain && (
                <div
                  onClick={() => openMyReports({ domainKey: adminReportDomain, inViewOnly: true })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openMyReports({ domainKey: adminReportDomain, inViewOnly: true });
                    }
                  }}
                  style={{
                    width: "fit-content",
                    maxWidth: "min(520px, calc(100vw - 90px))",
                    marginTop: 1,
                    fontSize: 11,
                    opacity: 1,
                    textAlign: "left",
                    color: inViewCounterColor,
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: `1px solid ${inViewCounterBorder}`,
                    background: inViewCounterBg,
                    boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                    cursor: "pointer",
                  }}
                >
                  Reports in view: <b>{openReportsInViewCount}</b>
                </div>
              )}
              {isStreetlightsDomain && (
                <>
                  <div
                    onClick={() => toggleStreetlightInViewFilter("saved")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleStreetlightInViewFilter("saved");
                      }
                    }}
                    style={{
                      width: "fit-content",
                      maxWidth: "min(520px, calc(100vw - 90px))",
                      marginTop: 1,
                      fontSize: 11,
                      opacity: 1,
                      textAlign: "left",
                      color: inViewCounterColor,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: isSavedStreetlightFilterOn
                        ? "1px solid var(--sl-ui-tool-active-border)"
                        : `1px solid ${inViewCounterBorder}`,
                      background: isSavedStreetlightFilterOn
                        ? "var(--sl-ui-tool-active-bg)"
                        : inViewCounterBg,
                      boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
                      backdropFilter: "blur(2px)",
                      WebkitBackdropFilter: "blur(2px)",
                      cursor: "pointer",
                    }}
                  >
                    Saved lights in view: <b>{Number(streetlightPersonalInViewStats.saved || 0)}</b>
                  </div>
                  <div
                    onClick={() => toggleStreetlightInViewFilter("utility")}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleStreetlightInViewFilter("utility");
                      }
                    }}
                    style={{
                      width: "fit-content",
                      maxWidth: "min(520px, calc(100vw - 90px))",
                      marginTop: 1,
                      fontSize: 11,
                      opacity: 1,
                      textAlign: "left",
                      color: inViewCounterColor,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: isUtilityStreetlightFilterOn
                        ? "1px solid var(--sl-ui-tool-active-border)"
                        : `1px solid ${inViewCounterBorder}`,
                      background: isUtilityStreetlightFilterOn
                        ? "var(--sl-ui-tool-active-bg)"
                        : inViewCounterBg,
                      boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
                      backdropFilter: "blur(2px)",
                      WebkitBackdropFilter: "blur(2px)",
                      cursor: "pointer",
                    }}
                  >
                    Utility reported in view: <b>{Number(streetlightPersonalInViewStats.utility || 0)}</b>
                  </div>
                </>
              )}
              {isAdmin && openAbuseFlagSummary.total > 0 && (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setModerationFlagsOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setModerationFlagsOpen(true);
                    }
                  }}
                  style={{
                    width: "fit-content",
                    maxWidth: "min(720px, calc(100vw - 100px))",
                    marginTop: 4,
                    fontSize: 11.5,
                    fontWeight: 850,
                    textAlign: "left",
                    color: "#fff",
                    padding: "4px 8px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background:
                      openAbuseFlagSummary.maxSeverity >= 3
                        ? "rgba(183, 28, 28, 0.86)"
                        : openAbuseFlagSummary.maxSeverity >= 2
                          ? "rgba(239, 108, 0, 0.84)"
                          : "rgba(33, 150, 83, 0.80)",
                    boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
                    backdropFilter: "blur(2px)",
                    WebkitBackdropFilter: "blur(2px)",
                    cursor: "pointer",
                  }}
                  title="Open moderation flags"
                >
                  Moderation flags open: <b>{openAbuseFlagSummary.total}</b>
                </div>
              )}
            </div>
            </div>
          </div>


        {/* =========================
              Bulk Action Bar (mobile)
            ========================= */}
          {canUseStreetlightBulk && bulkMode && (
            <div
              className="sl-overlay-pass"
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "calc(10px + env(safe-area-inset-bottom) + 78px)",
                zIndex: 1601,
                padding: "0 10px",
              }}
            >
              <div
                style={{
                  width: "min(520px, calc(100vw - 20px))",
                  margin: "0 auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    alignSelf: "center",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 850,
                    letterSpacing: 0.2,
                    color: "#fff",
                    background: "rgba(0,0,0,0.68)",
                    boxShadow: "0 8px 18px rgba(0,0,0,0.2)",
                  }}
                >
                  Max {BULK_MAX_LIGHTS_PER_SUBMIT}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearBulkSelection();
                  }}
                  disabled={bulkSelectedCount === 0 || saving}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "rgba(255,255,255,0.96)",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                    fontWeight: 950,
                    cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
                    opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
                  }}
                >
                  Clear
                </button>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (bulkSelectedCount === 0) {
                      openNotice("⚠️", "No lights selected", "Tap multiple official 💡 lights first.");
                      return;
                    }

                    if (Number(mapZoomRef.current || mapZoom) < REPORTING_MIN_ZOOM) {
                      openNotice("🔎", "Zoom in to report", `Zoom in closer (level ${REPORTING_MIN_ZOOM}+) before submitting bulk reports.`);
                      return;
                    }

                    closeAnyPopup();
                    suppressPopupsSafe(1600);

                    setNote("");
                    setReportType("out");
                    setStreetlightAreaPowerOn("");
                    setStreetlightHazardYesNo("");
                    setBulkConfirmOpen(true);
                  }}
                  disabled={bulkSelectedCount === 0 || saving}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "none",
                    background: "var(--sl-ui-brand-green)",
                    color: "white",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
                    fontWeight: 950,
                    cursor: bulkSelectedCount === 0 || saving ? "not-allowed" : "pointer",
                    opacity: bulkSelectedCount === 0 || saving ? 0.6 : 1,
                  }}
                >
                  Save light{bulkSelectedCount === 1 ? "" : "s"} {bulkSelectedCount ? `(${bulkSelectedCount})` : ""}
                </button>
                </div>
              </div>
            </div>
          )}

        {/* =========================
              Mapping Action Bar (mobile)
            ========================= */}
          {mappingMode && mappingQueue.length > 0 && (
            <div
              className="sl-overlay-pass"
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: "calc(10px + env(safe-area-inset-bottom) + 78px)",
                zIndex: 1601,
                padding: "0 10px",
              }}
            >
              <div
                style={{
                  width: "min(520px, calc(100vw - 20px))",
                  margin: "0 auto",
                  display: "flex",
                  gap: 10,
                }}
              >
                <button
                  onClick={requestClearQueuedLights}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
                    background: "var(--sl-ui-modal-btn-secondary-bg)",
                    color: "var(--sl-ui-modal-btn-secondary-text)",
                    fontWeight: 900,
                  }}
                >
                  Clear
                </button>

                <button
                  onClick={confirmMappingQueue}
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 12,
                    border: "none",
                    background: "var(--sl-ui-brand-green)",
                    color: "white",
                    fontWeight: 900,
                  }}
                >
                  Place {mappingQueue.length} {mappingUnitLabel}{mappingQueue.length !== 1 && "s"}
                </button>
              </div>
            </div>
          )}

        {/* ✅ Mapping queue markers (clickable) */}
        {mappingMode && isAdmin && (mappingQueue || []).map((q) => (
          <MarkerF
            key={q.tempId}
            position={{ lat: q.lat, lng: q.lng }}
            icon={(q.domain || "streetlights") === "street_signs"
              ? gmapsImageIcon(signMarkerIconSrcForType(q.sign_type), STREET_SIGN_MARKER_SIZE, {
                  border: true,
                  borderColor: "#39ff14",
                  borderWidth: 3,
                })
              : gmapsDotIcon(
                  "#2ecc71",
                  "#fff",
                  "💡",
                  UI_ICON_SRC.streetlight
                )} // queued preview
            onClick={() => {
              // clicking queued asset opens its popup
              setSelectedOfficialId(null);
              setSelectedDomainMarker(null);
              setSelectedQueuedTempId(q.tempId);
            }}
          />
        ))}


        {/* BOTTOM fixed actions */}
        <div
          className="sl-overlay-pass"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1600,
            padding: "0 10px calc(10px + env(safe-area-inset-bottom))",
          }}
        >
          <div
            style={{
              display: "none",
              width: "fit-content",
              maxWidth: "min(520px, calc(100vw - 20px))",
              margin: "0 auto 6px",
              fontSize: 11,
              opacity: 1,
              textAlign: "left",
              color: inViewCounterColor,
              padding: "4px 8px",
              borderRadius: 999,
              border: `1px solid ${inViewCounterBorder}`,
              background: inViewCounterBg,
              boxShadow: "0 3px 10px rgba(0,0,0,0.20)",
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          >
            Reports in view: <b>{openReportsInViewCount}</b>
          </div>
          <div
              style={{
                width: "min(520px, calc(100vw - 20px))",
                margin: "0 auto",
                background: "var(--sl-ui-surface-bg)",
                border: "1px solid var(--sl-ui-surface-border)",
                borderRadius: 14,
                boxShadow: "var(--sl-ui-surface-shadow-bottom)",
              padding: 10,
              display: "grid",
              gap: 8,
              position: "relative",
                color: "var(--sl-ui-text)",
              }}
          >
            <button
              type="button"
              onClick={() => setInfoMenuOpen(true)}
              title="Info"
              aria-label="Open info menu"
              style={{
                position: "absolute",
                right: 8,
                top: 8,
                width: 30,
                height: 30,
                borderRadius: 999,
                border: "none",
                background: "var(--sl-ui-modal-btn-secondary-bg)",
                color: "var(--sl-ui-modal-btn-secondary-text)",
                fontWeight: 900,
                cursor: "pointer",
                lineHeight: 1,
                fontSize: 14,
                pointerEvents: "auto",
                touchAction: "manipulation",
                zIndex: 2,
              }}
            >
              <AppIcon src={UI_ICON_SRC.info} size={18} />
            </button>

            <div style={{ fontSize: 11.5, opacity: 0.75, lineHeight: 1.35, paddingRight: 30, display: "grid", gap: 4 }}>
              <div>
                <b>About:</b> Community-reported issues and repair confirmations are shared here for public visibility.
              </div>
              <div>
                <b>Disclaimer:</b> This does not replace emergency services or official agency reporting.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop panel removed here for brevity — you can paste yours back in if you want it */}
    </div>
  );
}
