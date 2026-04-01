import { lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { TenantContext } from "./tenant/contextObject";
import {
  buildMunicipalityAppHref,
  normalizeMunicipalityAppPath,
} from "./municipality/appShellRouting";
import {
  hydrateCrossTenantSession,
  markCrossTenantLogout,
  syncCrossTenantAuthState,
} from "./auth/crossTenantAuth";
import {
  STANDARD_LOGIN_EMAIL_INPUT_PROPS,
  STANDARD_LOGIN_FORM_PROPS,
  getStandardLoginPasswordInputProps,
} from "./auth/loginFieldStandards";
import "./headerStandards.css";
import "./municipality-app.css";

const MapGoogleFull = lazy(() => import("./MapGoogleFull.jsx"));

const BRAND_LOGO_SRC = import.meta.env.VITE_TITLE_LOGO_SRC || "/CityReport-logo.png";
const MOBILE_BRAND_LOGO_SRC = import.meta.env.VITE_MOBILE_TITLE_LOGO_SRC || "/CityReport-pin-logo.png";

const NAV_ITEMS = [
  { key: "home", label: "Home", path: "/" },
  { key: "alerts", label: "Alerts", path: "/alerts" },
  { key: "events", label: "Events", path: "/events" },
  { key: "reports", label: "Reports", path: "/reports" },
  { key: "report", label: "View Map", path: "/report", primary: true },
];

const SETTINGS_PATH = "/settings";
const SETTINGS_DEFAULT_PAGE = "/settings/account-info";
const SETTINGS_NAV = [
  {
    key: "account",
    label: "Account",
    items: [
      { key: "account-info", label: "Account Info", path: "/settings/account-info" },
      { key: "account-notifications", label: "Notification Preferences", path: "/settings/account-notifications" },
      { key: "update-password", label: "Update Password", path: "/settings/update-password" },
    ],
  },
  {
    key: "organization",
    label: "Organization Info",
    items: [
      { key: "organization-general", label: "General Settings", path: "/settings/organization-general" },
      { key: "organization-assets", label: "Assets", path: "/settings/organization-assets" },
      { key: "calendar", label: "Calendar", path: "/settings/calendar" },
    ],
  },
  {
    key: "team",
    label: "Team Access",
    items: [
      { key: "manage-employees", label: "Manage Employees", path: "/settings/manage-employees" },
      { key: "roles-permissions", label: "Roles & Permissions", path: "/settings/roles-permissions" },
      { key: "security-checks", label: "Security Checks", path: "/settings/security-checks" },
    ],
  },
  {
    key: "map",
    label: "Map Settings",
    items: [
      { key: "visual-appearance", label: "Visual Appearance", path: "/settings/visual-appearance" },
    ],
  },
];

const DEFAULT_TOPIC_DETAILS = {
  emergency_alerts: { label: "Emergency Alerts", description: "Urgent citywide issues that need immediate attention." },
  water_utility: { label: "Water + Utility", description: "Water breaks, utility outages, and infrastructure service notices." },
  road_closures: { label: "Road Closures", description: "Closures, detours, and traffic-impacting maintenance work." },
  street_maintenance: { label: "Street Maintenance", description: "Planned street, sidewalk, sign, and streetlight work." },
  trash_recycling: { label: "Trash + Recycling", description: "Pickup changes, holiday schedules, and sanitation reminders." },
  community_events: { label: "Community Events", description: "Parades, public meetings, and city-run civic events." },
  general_updates: { label: "General City Updates", description: "General municipality notices that do not fit another topic." },
};

const EMPTY_ALERT_FORM = {
  topic_key: "general_updates",
  title: "",
  summary: "",
  body: "",
  severity: "info",
  location_name: "",
  location_address: "",
  cta_label: "",
  cta_url: "",
  starts_at: "",
  ends_at: "",
  pinned: false,
  status: "published",
};

const EMPTY_EVENT_FORM = {
  topic_key: "community_events",
  title: "",
  summary: "",
  body: "",
  location_name: "",
  location_address: "",
  cta_label: "",
  cta_url: "",
  starts_at: "",
  ends_at: "",
  all_day: false,
  status: "published",
};

const LOCATION_ASSET_CATEGORIES = [
  { key: "logo", label: "Logo" },
  { key: "boundary_geojson", label: "Boundary" },
  { key: "calendar_source", label: "Calendar Source" },
  { key: "asset", label: "Asset" },
  { key: "contract", label: "Contract" },
  { key: "other", label: "Other" },
];

const LOCATION_ASSET_OWNERSHIP_OPTIONS = [
  { key: "organization_owned", label: "Organization-Owned" },
  { key: "utility_owned", label: "Utility-Owned" },
  { key: "third_party", label: "Third-Party" },
];

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("relation") || msg.includes("does not exist");
}

function isMissingFunctionError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42883" || msg.includes("function") || msg.includes("schema cache");
}

function isPermissionError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42501" || msg.includes("permission") || msg.includes("policy") || msg.includes("row level");
}

function sanitizeHexColor(value, fallback = "#e53935") {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return String(fallback || "#e53935").toLowerCase();
}

function normalizeBoundedDecimalInput(value, { min = 0, max = 1 } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^-?\d*\.?\d*$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.max(min, Math.min(max, parsed)));
}

function normalizeHexDraft(value, fallback = "#e53935") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("#") && raw.length <= 7 && /^#[0-9a-f]*$/i.test(raw)) return raw;
  if (!raw.startsWith("#") && raw.length <= 6 && /^[0-9a-f]*$/i.test(raw)) return `#${raw}`;
  return sanitizeHexColor(fallback, "#e53935");
}

function trimOrEmpty(value) {
  return String(value || "").trim();
}

function buildOrganizationProfileDraft(profile, fallbackName = "") {
  return {
    display_name: trimOrEmpty(profile?.display_name) || trimOrEmpty(fallbackName),
    contact_primary_email: trimOrEmpty(profile?.contact_primary_email),
    legal_name: trimOrEmpty(profile?.legal_name),
    contact_primary_phone: trimOrEmpty(profile?.contact_primary_phone),
    website_url: trimOrEmpty(profile?.website_url),
    mailing_address_1: trimOrEmpty(profile?.mailing_address_1),
    mailing_address_2: trimOrEmpty(profile?.mailing_address_2),
    mailing_city: trimOrEmpty(profile?.mailing_city),
    mailing_state: trimOrEmpty(profile?.mailing_state),
    mailing_zip: trimOrEmpty(profile?.mailing_zip),
    timezone: trimOrEmpty(profile?.timezone) || "America/New_York",
  };
}

function resolveOrganizationDisplayName(profile, fallbackName = "") {
  return trimOrEmpty(profile?.display_name) || trimOrEmpty(fallbackName);
}

function buildMapAppearanceDraft(row) {
  return {
    show_boundary_border: row?.show_boundary_border !== false,
    shade_outside_boundary: row?.shade_outside_boundary !== false,
    outside_shade_opacity: String(Number.isFinite(Number(row?.outside_shade_opacity)) ? Number(row.outside_shade_opacity) : 0.42),
    boundary_border_color: sanitizeHexColor(row?.boundary_border_color, "#e53935"),
    boundary_border_width: String(Number.isFinite(Number(row?.boundary_border_width)) ? Number(row.boundary_border_width) : 4),
  };
}

function sanitizeFileNameSegment(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 120);
  return normalized || "file";
}

function toDatePath(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function summarizeAssetCategory(categoryKey) {
  const key = trimOrEmpty(categoryKey).toLowerCase();
  if (!key) return "Asset";
  const standard = LOCATION_ASSET_CATEGORIES.find((row) => row.key === key);
  if (standard) return standard.label;
  if (key === "general_asset") return "Asset";
  if (key === "streetlight_inventory") return "Asset";
  if (key === "asset_coordinates") return "Coordinate File";
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeAssetOwnership(ownerType) {
  const key = trimOrEmpty(ownerType).toLowerCase();
  if (!key) return "";
  return LOCATION_ASSET_OWNERSHIP_OPTIONS.find((row) => row.key === key)?.label
    || key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function isAssetLibraryFile(fileRow) {
  const category = trimOrEmpty(fileRow?.file_category).toLowerCase();
  return category === "asset" || category === "general_asset" || category === "streetlight_inventory";
}

function validateStrongPassword(value) {
  const password = String(value || "");
  return (
    password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
  );
}

function coerceDateTimeInput(value) {
  const raw = trimOrEmpty(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatDateTime(value, opts = {}) {
  if (!value) return "TBD";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: opts.dateStyle || "medium",
    timeStyle: opts.timeStyle || "short",
  }).format(parsed);
}

function formatEventRange(event) {
  if (!event?.starts_at) return "Date TBD";
  const start = new Date(event.starts_at);
  const end = event?.ends_at ? new Date(event.ends_at) : null;
  if (event?.all_day) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(start);
  }
  if (!end || Number.isNaN(end.getTime())) return formatDateTime(start.toISOString());
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(start)} • ${new Intl.DateTimeFormat("en-US", {
      timeStyle: "short",
    }).format(start)} - ${new Intl.DateTimeFormat("en-US", { timeStyle: "short" }).format(end)}`;
  }
  return `${formatDateTime(start.toISOString())} - ${formatDateTime(end.toISOString())}`;
}

function formatAlertWindow(alert) {
  if (!alert?.starts_at && !alert?.ends_at) return "Effective immediately";
  if (alert?.starts_at && alert?.ends_at) {
    return `${formatDateTime(alert.starts_at)} - ${formatDateTime(alert.ends_at)}`;
  }
  if (alert?.starts_at) return `Starts ${formatDateTime(alert.starts_at)}`;
  return `Runs until ${formatDateTime(alert.ends_at)}`;
}

function severityBadgeClass(severity) {
  const key = trimOrEmpty(severity).toLowerCase();
  if (key === "emergency") return "municipality-badge municipality-badge--emergency";
  if (key === "urgent") return "municipality-badge municipality-badge--urgent";
  if (key === "advisory") return "municipality-badge municipality-badge--advisory";
  return "municipality-badge municipality-badge--info";
}

function statusBadgeClass(status) {
  const key = trimOrEmpty(status).toLowerCase();
  if (key === "published") return "municipality-badge municipality-badge--published";
  if (key === "archived") return "municipality-badge municipality-badge--archived";
  return "municipality-badge municipality-badge--draft";
}

function activeAlertCount(alerts) {
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

function upcomingEventCount(events) {
  const now = Date.now();
  return (events || []).filter((event) => {
    if (String(event?.status || "").trim().toLowerCase() !== "published") return false;
    const startsAt = event?.starts_at ? new Date(event.starts_at).getTime() : null;
    return !startsAt || startsAt >= now - (60 * 60 * 1000);
  }).length;
}

function sortAlerts(rows = []) {
  return [...rows].sort((a, b) => {
    const aPinned = a?.pinned ? 1 : 0;
    const bPinned = b?.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aSeverity = severityRank(a?.severity);
    const bSeverity = severityRank(b?.severity);
    if (aSeverity !== bSeverity) return bSeverity - aSeverity;
    return new Date(b?.starts_at || b?.published_at || b?.created_at || 0).getTime()
      - new Date(a?.starts_at || a?.published_at || a?.created_at || 0).getTime();
  });
}

function sortEvents(rows = []) {
  return [...rows].sort((a, b) => {
    const aStart = new Date(a?.starts_at || a?.created_at || 0).getTime();
    const bStart = new Date(b?.starts_at || b?.created_at || 0).getTime();
    return aStart - bStart;
  });
}

function severityRank(severity) {
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

function toDateInputValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDateInputValue(parsed);
}

function buildIcsFile(events, tenantName) {
  const escapeValue = (value) =>
    String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  const toUtcStamp = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const pad = (input) => String(input).padStart(2, "0");
    return `${parsed.getUTCFullYear()}${pad(parsed.getUTCMonth() + 1)}${pad(parsed.getUTCDate())}T${pad(parsed.getUTCHours())}${pad(parsed.getUTCMinutes())}${pad(parsed.getUTCSeconds())}Z`;
  };

  const publishedEvents = (events || []).filter((event) => String(event?.status || "").trim().toLowerCase() === "published");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CityReport.io//Municipality Updates//EN",
    `X-WR-CALNAME:${escapeValue(`${tenantName} Events`)}`,
    "CALSCALE:GREGORIAN",
  ];

  for (const event of publishedEvents) {
    const uid = `${event.id || event.title || Math.random()}@cityreport.io`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeValue(uid)}`);
    lines.push(`DTSTAMP:${toUtcStamp(new Date().toISOString())}`);
    lines.push(`SUMMARY:${escapeValue(event.title)}`);
    if (event.summary) lines.push(`DESCRIPTION:${escapeValue(event.summary)}${event.body ? `\\n\\n${escapeValue(event.body)}` : ""}`);
    if (event.location_name || event.location_address) {
      lines.push(`LOCATION:${escapeValue([event.location_name, event.location_address].filter(Boolean).join(" • "))}`);
    }
    if (event.all_day) {
      const start = new Date(event.starts_at);
      const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + (24 * 60 * 60 * 1000));
      const pad = (input) => String(input).padStart(2, "0");
      const formatDateOnly = (value) => `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}`;
      lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(end)}`);
    } else {
      lines.push(`DTSTART:${toUtcStamp(event.starts_at)}`);
      if (event.ends_at) lines.push(`DTEND:${toUtcStamp(event.ends_at)}`);
    }
    if (event.cta_url) lines.push(`URL:${escapeValue(event.cta_url)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function downloadTextFile(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const normalized = String(value ?? "");
  if (!normalized.includes(",") && !normalized.includes("\"") && !normalized.includes("\n")) return normalized;
  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

function buildCsvFile(headers, rows) {
  const lines = [headers.map(escapeCsvValue).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvValue).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

function summarizeSourceLabel(sourceType) {
  const key = trimOrEmpty(sourceType).toLowerCase();
  if (!key || key === "manual") return "Manual";
  if (key === "calendar_import") return "Calendar Import";
  return key.replace(/_/g, " ");
}

function shortUserId(value) {
  const normalized = trimOrEmpty(value);
  if (normalized.length <= 12) return normalized || "Unknown user";
  return `${normalized.slice(0, 8)}…${normalized.slice(-4)}`;
}

function roleKeyToLabel(roleKey) {
  return trimOrEmpty(roleKey)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase()) || "Employee";
}

function buildTenantOption(row, fallbackTenantKey, fallbackTenantName, fallbackSubdomain) {
  const tenantKey = trimOrEmpty(row?.tenant_key).toLowerCase() || trimOrEmpty(fallbackTenantKey).toLowerCase();
  if (!tenantKey) return null;
  return {
    tenant_key: tenantKey,
    name: trimOrEmpty(row?.name) || trimOrEmpty(fallbackTenantName) || tenantKey,
    primary_subdomain: trimOrEmpty(row?.primary_subdomain) || trimOrEmpty(fallbackSubdomain) || `${tenantKey}.cityreport.io`,
  };
}

function buildTenantSwitchHash(session) {
  const accessToken = trimOrEmpty(session?.access_token);
  const refreshToken = trimOrEmpty(session?.refresh_token);
  if (!accessToken || !refreshToken) return "";
  const params = new URLSearchParams();
  params.set("cr_access_token", accessToken);
  params.set("cr_refresh_token", refreshToken);
  return `#${params.toString()}`;
}

function buildTenantSwitchHref(env, targetTenant, currentRoutePath, session = null) {
  const tenantKey = trimOrEmpty(targetTenant?.tenant_key).toLowerCase();
  const subdomain = trimOrEmpty(targetTenant?.primary_subdomain).toLowerCase();
  const normalizedPath = normalizeMunicipalityAppPath(currentRoutePath || "/", tenantKey);
  const routePath = String(normalizedPath || "").startsWith("/settings") ? "/" : normalizedPath;
  if (!tenantKey) return "/";
  if (env === "staging") {
    return `https://dev.cityreport.io/${tenantKey}${routePath === "/" ? "" : routePath}${buildTenantSwitchHash(session)}`;
  }
  const host = subdomain || `${tenantKey}.cityreport.io`;
  return `https://${host}${routePath === "/" ? "" : routePath}${buildTenantSwitchHash(session)}`;
}

function getSettingsPageMeta(routePath) {
  for (const category of SETTINGS_NAV) {
    for (const item of category.items) {
      if (item.path === routePath) {
        return { category, item };
      }
    }
  }
  return { category: SETTINGS_NAV[0], item: SETTINGS_NAV[0].items[0] };
}

function useResidentAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    let mounted = true;
    const hydrateSession = async () => {
      const sessionData = await hydrateCrossTenantSession(supabase);
      if (!mounted) return;
      setSession(sessionData || null);
      setAuthReady(true);
    };
    void hydrateSession();
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      syncCrossTenantAuthState(event, nextSession || null);
      setSession(nextSession || null);
      setAuthReady(true);
    });
    return () => {
      mounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile(null);
        return;
      }
      setLoadingProfile(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone, email")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (cancelled) return;
      setLoadingProfile(false);
      if (error) {
        setProfile({
          full_name: trimOrEmpty(session?.user?.user_metadata?.full_name),
          phone: trimOrEmpty(session?.user?.user_metadata?.phone),
          email: trimOrEmpty(session?.user?.email),
        });
        return;
      }
      setProfile(
        data || {
          full_name: trimOrEmpty(session?.user?.user_metadata?.full_name),
          phone: trimOrEmpty(session?.user?.user_metadata?.phone),
          email: trimOrEmpty(session?.user?.email),
        }
      );
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.email]);

  return { session, setSession, profile, setProfile, authReady, loadingProfile };
}

function HomeCard({ title, children, subtitle, onTitleClick = null }) {
  return (
    <section className="municipality-card municipality-section">
      {typeof onTitleClick === "function" ? (
        <button type="button" className="municipality-title-link" onClick={onTitleClick}>
          {title}
        </button>
      ) : (
        <h3>{title}</h3>
      )}
      {subtitle ? <p className="municipality-section-subtitle">{subtitle}</p> : null}
      {children}
    </section>
  );
}

function AlertFeed({ alerts, emptyText, showStatus = false, onStatusChange = null, onEdit = null }) {
  if (!alerts.length) return <div className="municipality-empty">{emptyText}</div>;
  return (
    <div className="municipality-item-list">
      {alerts.map((alert) => (
        <article key={`alert-${alert.id}`} className="municipality-feed-item">
          <div className="municipality-meta-row">
            <span className={severityBadgeClass(alert.severity)}>{alert.severity || "info"}</span>
            {showStatus ? <span className={statusBadgeClass(alert.status)}>{alert.status || "draft"}</span> : null}
            {alert?.pinned ? <span className="municipality-badge municipality-badge--published">Pinned</span> : null}
          </div>
          <h4>{alert.title}</h4>
          {alert.summary ? <p>{alert.summary}</p> : null}
          {alert.body ? <p>{alert.body}</p> : null}
          <p className="municipality-note">{formatAlertWindow(alert)}</p>
          {alert.location_name || alert.location_address ? (
            <p className="municipality-note">
              {[alert.location_name, alert.location_address].filter(Boolean).join(" • ")}
            </p>
          ) : null}
          {alert.cta_url ? (
            <div className="municipality-actions" style={{ marginTop: 10 }}>
              <a className="municipality-button municipality-button--ghost" href={alert.cta_url} target="_blank" rel="noreferrer">
                {alert.cta_label || "More details"}
              </a>
            </div>
          ) : null}
          {showStatus && typeof onStatusChange === "function" ? (
            <div className="municipality-actions" style={{ marginTop: 12 }}>
              {typeof onEdit === "function" ? (
                <button type="button" className="municipality-button municipality-button--ghost" onClick={() => onEdit(alert)}>
                  Edit
                </button>
              ) : null}
              {alert.status !== "published" ? (
                <button type="button" className="municipality-button municipality-button--primary" onClick={() => onStatusChange(alert, "published")}>
                  Publish
                </button>
              ) : null}
              {alert.status !== "archived" ? (
                <button type="button" className="municipality-button municipality-button--ghost" onClick={() => onStatusChange(alert, "archived")}>
                  Archive
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function EventFeed({ events, emptyText, showStatus = false, onStatusChange = null, onEdit = null }) {
  if (!events.length) return <div className="municipality-empty">{emptyText}</div>;
  return (
    <div className="municipality-item-list">
      {events.map((event) => (
        <article key={`event-${event.id}`} className="municipality-feed-item">
          <div className="municipality-meta-row">
            <span className="municipality-badge municipality-badge--info">{event.topic_label || event.topic_key}</span>
            {showStatus ? <span className={statusBadgeClass(event.status)}>{event.status || "draft"}</span> : null}
            {event.all_day ? <span className="municipality-badge municipality-badge--published">All day</span> : null}
          </div>
          <h4>{event.title}</h4>
          {event.summary ? <p>{event.summary}</p> : null}
          {event.body ? <p>{event.body}</p> : null}
          <p className="municipality-note">{formatEventRange(event)}</p>
          {event.location_name || event.location_address ? (
            <p className="municipality-note">
              {[event.location_name, event.location_address].filter(Boolean).join(" • ")}
            </p>
          ) : null}
          {event.cta_url ? (
            <div className="municipality-actions" style={{ marginTop: 10 }}>
              <a className="municipality-button municipality-button--ghost" href={event.cta_url} target="_blank" rel="noreferrer">
                {event.cta_label || "Event details"}
              </a>
            </div>
          ) : null}
          {showStatus && typeof onStatusChange === "function" ? (
            <div className="municipality-actions" style={{ marginTop: 12 }}>
              {typeof onEdit === "function" ? (
                <button type="button" className="municipality-button municipality-button--ghost" onClick={() => onEdit(event)}>
                  Edit
                </button>
              ) : null}
              {event.status !== "published" ? (
                <button type="button" className="municipality-button municipality-button--primary" onClick={() => onStatusChange(event, "published")}>
                  Publish
                </button>
              ) : null}
              {event.status !== "archived" ? (
                <button type="button" className="municipality-button municipality-button--ghost" onClick={() => onStatusChange(event, "archived")}>
                  Archive
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function AlertComposer({ topicLookup, alertForm, setAlertForm, onSubmit, heading = "Create Alert", submitLabel = "Save Alert" }) {
  return (
    <form className="municipality-topic-row municipality-topic-card" onSubmit={onSubmit}>
      <h4>{heading}</h4>
      <div className="municipality-form-grid">
        <div className="municipality-field">
          <label htmlFor="alert-topic">Topic</label>
          <select id="alert-topic" value={alertForm.topic_key} onChange={(event) => setAlertForm((prev) => ({ ...prev, topic_key: event.target.value }))}>
            {Object.values(topicLookup).map((topic) => (
              <option key={topic.topic_key} value={topic.topic_key}>
                {topic.label}
              </option>
            ))}
          </select>
        </div>
        <div className="municipality-field">
          <label htmlFor="alert-severity">Severity</label>
          <select id="alert-severity" value={alertForm.severity} onChange={(event) => setAlertForm((prev) => ({ ...prev, severity: event.target.value }))}>
            <option value="info">Info</option>
            <option value="advisory">Advisory</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
        <div className="municipality-field">
          <label htmlFor="alert-title">Title</label>
          <input id="alert-title" value={alertForm.title} onChange={(event) => setAlertForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Water main repair on Lake Ave" />
        </div>
        <div className="municipality-field">
          <label htmlFor="alert-summary">Summary</label>
          <textarea id="alert-summary" value={alertForm.summary} onChange={(event) => setAlertForm((prev) => ({ ...prev, summary: event.target.value }))} placeholder="Short resident-facing summary" />
        </div>
        <div className="municipality-field">
          <label htmlFor="alert-body">Details</label>
          <textarea id="alert-body" value={alertForm.body} onChange={(event) => setAlertForm((prev) => ({ ...prev, body: event.target.value }))} placeholder="What residents should expect and what action they should take." />
        </div>
        <div className="municipality-field">
          <label htmlFor="alert-starts">Starts</label>
          <input id="alert-starts" type="datetime-local" value={alertForm.starts_at} onChange={(event) => setAlertForm((prev) => ({ ...prev, starts_at: event.target.value }))} />
        </div>
        <div className="municipality-field">
          <label htmlFor="alert-ends">Ends</label>
          <input id="alert-ends" type="datetime-local" value={alertForm.ends_at} onChange={(event) => setAlertForm((prev) => ({ ...prev, ends_at: event.target.value }))} />
        </div>
        <div className="municipality-checkbox-row">
          <label className="municipality-checkbox">
            <input type="checkbox" checked={alertForm.pinned} onChange={(event) => setAlertForm((prev) => ({ ...prev, pinned: event.target.checked }))} />
            Pin at top
          </label>
          <label className="municipality-checkbox">
            <span>Status</span>
            <select value={alertForm.status} onChange={(event) => setAlertForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="published">Publish now</option>
              <option value="draft">Save draft</option>
              <option value="archived">Keep archived</option>
            </select>
          </label>
        </div>
      </div>
      <div className="municipality-actions">
        <button type="submit" className="municipality-button municipality-button--primary">{submitLabel}</button>
      </div>
    </form>
  );
}

function EventComposer({ topicLookup, eventForm, setEventForm, onSubmit, heading = "Create Event", submitLabel = "Save Event" }) {
  return (
    <form className="municipality-topic-row municipality-topic-card" onSubmit={onSubmit}>
      <h4>{heading}</h4>
      <div className="municipality-form-grid">
        <div className="municipality-field">
          <label htmlFor="event-topic">Topic</label>
          <select id="event-topic" value={eventForm.topic_key} onChange={(event) => setEventForm((prev) => ({ ...prev, topic_key: event.target.value }))}>
            {Object.values(topicLookup).map((topic) => (
              <option key={topic.topic_key} value={topic.topic_key}>
                {topic.label}
              </option>
            ))}
          </select>
        </div>
        <div className="municipality-field">
          <label htmlFor="event-title">Title</label>
          <input id="event-title" value={eventForm.title} onChange={(event) => setEventForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Memorial Day parade route change" />
        </div>
        <div className="municipality-field">
          <label htmlFor="event-summary">Summary</label>
          <textarea id="event-summary" value={eventForm.summary} onChange={(event) => setEventForm((prev) => ({ ...prev, summary: event.target.value }))} placeholder="Short event summary" />
        </div>
        <div className="municipality-field">
          <label htmlFor="event-body">Details</label>
          <textarea id="event-body" value={eventForm.body} onChange={(event) => setEventForm((prev) => ({ ...prev, body: event.target.value }))} placeholder="Parking guidance, route info, and resident expectations." />
        </div>
        <div className="municipality-field">
          <label htmlFor="event-starts">Starts</label>
          <input id="event-starts" type="datetime-local" value={eventForm.starts_at} onChange={(event) => setEventForm((prev) => ({ ...prev, starts_at: event.target.value }))} />
        </div>
        <div className="municipality-field">
          <label htmlFor="event-ends">Ends</label>
          <input id="event-ends" type="datetime-local" value={eventForm.ends_at} onChange={(event) => setEventForm((prev) => ({ ...prev, ends_at: event.target.value }))} />
        </div>
        <div className="municipality-checkbox-row">
          <label className="municipality-checkbox">
            <input type="checkbox" checked={eventForm.all_day} onChange={(event) => setEventForm((prev) => ({ ...prev, all_day: event.target.checked }))} />
            All day event
          </label>
          <label className="municipality-checkbox">
            <span>Status</span>
            <select value={eventForm.status} onChange={(event) => setEventForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="published">Publish now</option>
              <option value="draft">Save draft</option>
              <option value="archived">Keep archived</option>
            </select>
          </label>
        </div>
      </div>
      <div className="municipality-actions">
        <button type="submit" className="municipality-button municipality-button--primary">{submitLabel}</button>
      </div>
    </form>
  );
}

export default function MunicipalityApp() {
  const tenant = useContext(TenantContext);
  const { session, setSession, profile, setProfile, authReady, loadingProfile } = useResidentAuth();
  const tenantKey = String(tenant?.tenantKey || "").trim().toLowerCase();
  const tenantName = trimOrEmpty(tenant?.tenantConfig?.name) || "Municipality";
  const residentPortalEnabled = Boolean(tenant?.tenantConfig?.resident_portal_enabled);
  const [routePath, setRoutePath] = useState(() => normalizeMunicipalityAppPath(window.location.pathname, tenantKey));
  const [topics, setTopics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [preferencesByTopic, setPreferencesByTopic] = useState({});
  const [savedPreferencesByTopic, setSavedPreferencesByTopic] = useState({});
  const [dataLoading, setDataLoading] = useState(true);
  const [manageAccess, setManageAccess] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [alertForm, setAlertForm] = useState(EMPTY_ALERT_FORM);
  const [eventForm, setEventForm] = useState(() => ({ ...EMPTY_EVENT_FORM, starts_at: toDateInputValue(new Date()) }));
  const [adminStatus, setAdminStatus] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ full_name: "", email: "", password: "" });
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authStatus, setAuthStatus] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authResetLoading, setAuthResetLoading] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [showAlertComposer, setShowAlertComposer] = useState(false);
  const [showEventComposer, setShowEventComposer] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [openNavMenu, setOpenNavMenu] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [availableHubTenants, setAvailableHubTenants] = useState([]);
  const [interestedTenantKeys, setInterestedTenantKeys] = useState([]);
  const [savedInterestedTenantKeys, setSavedInterestedTenantKeys] = useState([]);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [settingsSearchQuery, setSettingsSearchQuery] = useState("");
  const [openSettingsGroups, setOpenSettingsGroups] = useState({
    account: true,
    organization: true,
    team: true,
    map: true,
  });
  const [teamAssignments, setTeamAssignments] = useState([]);
  const [roleDefinitions, setRoleDefinitions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [permissionCatalog, setPermissionCatalog] = useState([]);
  const [organizationProfile, setOrganizationProfile] = useState(null);
  const organizationDisplayName = resolveOrganizationDisplayName(organizationProfile, tenantName) || tenantName;
  const [organizationProfileDraft, setOrganizationProfileDraft] = useState(() => buildOrganizationProfileDraft(null, tenantName));
  const [mapAppearance, setMapAppearance] = useState(null);
  const [mapAppearanceDraft, setMapAppearanceDraft] = useState(() => buildMapAppearanceDraft(null));
  const [assetLibrary, setAssetLibrary] = useState([]);
  const [assetFiles, setAssetFiles] = useState([]);
  const [assetUploadDraft, setAssetUploadDraft] = useState({
    category: "asset",
    asset_subtype: "",
    asset_owner_type: "organization_owned",
    notes: "",
    file: null,
  });
  const [settingsSectionEdit, setSettingsSectionEdit] = useState({
    organization: false,
    map: false,
    assets: false,
  });
  const [settingsSectionSaving, setSettingsSectionSaving] = useState({
    organization: false,
    map: false,
    assets: false,
  });
  const [teamAssignmentBusy, setTeamAssignmentBusy] = useState({});
  const [teamManagementView, setTeamManagementView] = useState("list");
  const [teamAssignmentMode, setTeamAssignmentMode] = useState("existing");
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [teamSearchResults, setTeamSearchResults] = useState([]);
  const [teamSearchLoading, setTeamSearchLoading] = useState(false);
  const [teamAssignLoading, setTeamAssignLoading] = useState(false);
  const [teamInviteLoading, setTeamInviteLoading] = useState(false);
  const [teamAssignForm, setTeamAssignForm] = useState({ user_id: "", role: "tenant_employee" });
  const [teamInviteForm, setTeamInviteForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [teamUserSummariesById, setTeamUserSummariesById] = useState({});
  const [settingsSectionStatus, setSettingsSectionStatus] = useState({
    organization: "",
    assets: "",
    reports: "",
    team: "",
    roles: "",
    calendar: "",
    map: "",
  });
  const [accountProfileDraft, setAccountProfileDraft] = useState({ full_name: "", phone: "", email: "" });
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [accountSectionEdit, setAccountSectionEdit] = useState({
    profile: false,
    cities: false,
    notifications: false,
    security: false,
  });
  const [accountSectionStatus, setAccountSectionStatus] = useState({
    profile: "",
    cities: "",
    notifications: "",
    security: "",
  });
  const [securityDraft, setSecurityDraft] = useState({
    next_email: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [savingSection, setSavingSection] = useState({
    profile: false,
    cities: false,
    notifications: false,
    security: false,
  });
  const authPasswordAutoComplete = authMode === "login" ? "current-password" : "new-password";
  const settingsMeta = useMemo(() => getSettingsPageMeta(routePath), [routePath]);
  const activeSettingsCategoryKey = settingsMeta.category.key;
  const activeSettingsItemKey = settingsMeta.item.key;
  const invokeTeamUserAdmin = useCallback(async (body) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return { data: null, error: sessionError };
    }

    const accessToken = trimOrEmpty(sessionData?.session?.access_token);
    if (!accessToken) {
      return {
        data: null,
        error: new Error("Your session expired. Sign in again and retry."),
      };
    }

    const requestTenantKey = trimOrEmpty(body?.tenant_key).toLowerCase() || tenantKey;
    const requestBody = requestTenantKey ? { ...body, tenant_key: requestTenantKey } : { ...body };

    return supabase.functions.invoke("platform-user-admin", {
      body: requestBody,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(requestTenantKey ? { "x-tenant-key": requestTenantKey } : {}),
      },
    });
  }, [tenantKey]);

  function openAuthModal(nextMode = "login") {
    setAuthMode(nextMode);
    setAuthStatus("");
    setShowAuthPassword(false);
    setForgotPasswordOpen(false);
    setForgotPasswordError("");
    setAuthModalOpen(true);
  }

  function closeAuthModal() {
    setAuthModalOpen(false);
    setAuthStatus("");
    setShowAuthPassword(false);
    setForgotPasswordOpen(false);
    setForgotPasswordError("");
    setAuthResetLoading(false);
  }

  function openForgotPasswordModal() {
    setForgotPasswordEmail(trimOrEmpty(authForm.email));
    setForgotPasswordError("");
    setForgotPasswordOpen(true);
  }

  function closeForgotPasswordModal() {
    setForgotPasswordOpen(false);
    setForgotPasswordError("");
    setAuthResetLoading(false);
  }

  async function sendPasswordReset() {
    const email = trimOrEmpty(forgotPasswordEmail).toLowerCase();
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
      setForgotPasswordError(String(error?.message || "Password reset email failed."));
      return false;
    }

    setForgotPasswordOpen(false);
    setAuthStatus("Check your email. If an account exists for that address, a password reset link has been sent.");
    return true;
  }

  useEffect(() => {
    function onPopState() {
      setRoutePath(normalizeMunicipalityAppPath(window.location.pathname, tenantKey));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [tenantKey]);

  useEffect(() => {
    setRoutePath(normalizeMunicipalityAppPath(window.location.pathname, tenantKey));
  }, [tenantKey]);

  useEffect(() => {
    setOpenNavMenu("");
  }, [routePath]);

  useEffect(() => {
    if (!String(routePath || "").startsWith("/settings")) return;
    setOpenSettingsGroups((prev) => ({ ...prev, [activeSettingsCategoryKey]: true }));
  }, [activeSettingsCategoryKey, routePath]);

  useEffect(() => {
    if (typeof window === "undefined" || !openNavMenu) return undefined;
    const closeMenu = () => setOpenNavMenu("");
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [openNavMenu]);

  useEffect(() => {
    if (typeof window === "undefined" || !accountMenuOpen) return undefined;
    const closeMenu = () => setAccountMenuOpen(false);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [accountMenuOpen]);

  useEffect(() => {
    setAccountProfileDraft({
      full_name: trimOrEmpty(profile?.full_name) || trimOrEmpty(session?.user?.user_metadata?.full_name),
      phone: trimOrEmpty(profile?.phone) || trimOrEmpty(session?.user?.user_metadata?.phone),
      email: trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email),
    });
  }, [profile?.email, profile?.full_name, profile?.phone, session?.user?.email, session?.user?.user_metadata?.full_name, session?.user?.user_metadata?.phone]);

  useEffect(() => {
    setSecurityDraft((prev) => ({
      ...prev,
      next_email: trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email),
    }));
  }, [profile?.email, session?.user?.email]);

  useEffect(() => {
    setOrganizationProfileDraft(buildOrganizationProfileDraft(organizationProfile, tenantName));
  }, [organizationProfile, tenantName]);

  useEffect(() => {
    setMapAppearanceDraft(buildMapAppearanceDraft(mapAppearance));
  }, [mapAppearance]);

  if (!residentPortalEnabled) {
    return (
      <Suspense fallback={<div className="municipality-empty" style={{ margin: 16 }}>Loading reporting workspace…</div>}>
        <MapGoogleFull />
      </Suspense>
    );
  }

  const topicLookup = useMemo(() => {
    const lookup = {};
    for (const topic of topics || []) {
      const key = trimOrEmpty(topic?.topic_key);
      if (!key) continue;
      lookup[key] = topic;
    }
    for (const [key, value] of Object.entries(DEFAULT_TOPIC_DETAILS)) {
      if (!lookup[key]) {
        lookup[key] = { topic_key: key, ...value, default_enabled: false, active: true };
      }
    }
    return lookup;
  }, [topics]);

  const navLinks = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        ...item,
        href: buildMunicipalityAppHref(window.location.pathname, tenantKey, item.path),
        active:
          routePath === item.path
          || (item.path === "/alerts" && routePath.startsWith("/alerts"))
          || (item.path === "/events" && routePath.startsWith("/events"))
          || (item.path === "/reports" && routePath.startsWith("/reports")),
      })),
    [routePath, tenantKey]
  );
  const filteredSettingsNav = useMemo(() => {
    const query = trimOrEmpty(settingsSearchQuery).toLowerCase();
    if (!query) return SETTINGS_NAV;
    return SETTINGS_NAV
      .map((category) => {
        const categoryMatches = trimOrEmpty(category.label).toLowerCase().includes(query);
        if (categoryMatches) return category;
        const filteredItems = category.items.filter((item) => trimOrEmpty(item.label).toLowerCase().includes(query));
        if (!filteredItems.length) return null;
        return { ...category, items: filteredItems };
      })
      .filter(Boolean);
  }, [settingsSearchQuery]);

  const switchableTenants = useMemo(() => {
    const lookup = new Map();
    for (const tenantRow of availableHubTenants || []) {
      const key = trimOrEmpty(tenantRow?.tenant_key).toLowerCase();
      if (!key) continue;
      lookup.set(key, tenantRow);
    }
    const currentTenantOption = buildTenantOption(
      null,
      tenantKey,
      tenantName,
      trimOrEmpty(tenant?.tenantConfig?.primary_subdomain)
    );
    if (currentTenantOption && !lookup.has(currentTenantOption.tenant_key)) {
      lookup.set(currentTenantOption.tenant_key, currentTenantOption);
    }
    return [...lookup.values()].filter((row) => interestedTenantKeys.includes(trimOrEmpty(row?.tenant_key).toLowerCase()));
  }, [availableHubTenants, interestedTenantKeys, tenant?.tenantConfig?.primary_subdomain, tenantKey, tenantName]);

  const selectableTenants = useMemo(() => {
    const lookup = new Map();
    const currentTenantOption = buildTenantOption(
      null,
      tenantKey,
      tenantName,
      trimOrEmpty(tenant?.tenantConfig?.primary_subdomain)
    );
    if (currentTenantOption) {
      lookup.set(currentTenantOption.tenant_key, currentTenantOption);
    }
    for (const tenantRow of availableHubTenants || []) {
      const normalized = buildTenantOption(
        tenantRow,
        tenantKey,
        tenantName,
        trimOrEmpty(tenant?.tenantConfig?.primary_subdomain)
      );
      if (!normalized) continue;
      lookup.set(normalized.tenant_key, normalized);
    }
    return [...lookup.values()].sort((a, b) => (trimOrEmpty(a?.name) || a.tenant_key).localeCompare(trimOrEmpty(b?.name) || b.tenant_key));
  }, [availableHubTenants, tenant?.tenantConfig?.primary_subdomain, tenantKey, tenantName]);

  const searchedTenants = useMemo(() => {
    const query = trimOrEmpty(citySearchQuery).toLowerCase();
    if (!query) return [];
    return selectableTenants.filter((city) =>
      `${trimOrEmpty(city?.name)} ${trimOrEmpty(city?.tenant_key)}`.toLowerCase().includes(query)
    );
  }, [citySearchQuery, selectableTenants]);

  const accountDisplayName = trimOrEmpty(profile?.full_name)
    || trimOrEmpty(session?.user?.user_metadata?.full_name)
    || trimOrEmpty(profile?.email)
    || trimOrEmpty(session?.user?.email)
    || "Resident";
  const accountEmail = trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email);
  const accountRoleLabel = manageAccess ? "Municipality Staff" : "Resident Account";

  const publishedAlerts = useMemo(
    () => sortAlerts(alerts.filter((alert) => String(alert?.status || "").trim().toLowerCase() === "published")),
    [alerts]
  );

  const publishedEvents = useMemo(
    () => sortEvents(events.filter((event) => String(event?.status || "").trim().toLowerCase() === "published")),
    [events]
  );
  const permissionLabelLookup = useMemo(
    () => Object.fromEntries((permissionCatalog || []).map((row) => [row.permission_key, trimOrEmpty(row?.label) || row.permission_key])),
    [permissionCatalog]
  );
  const roleDefinitionLookup = useMemo(
    () => Object.fromEntries((roleDefinitions || []).map((row) => [trimOrEmpty(row?.role), row])),
    [roleDefinitions]
  );
  const assignableTeamRoles = useMemo(
    () => (roleDefinitions || []).filter((row) => row?.active !== false && (row?.is_system !== true || trimOrEmpty(row?.role) === "tenant_employee")),
    [roleDefinitions]
  );
  const teamSearchResultById = useMemo(
    () => Object.fromEntries((teamSearchResults || []).map((row) => [trimOrEmpty(row?.id), row]).filter(([key]) => key)),
    [teamSearchResults]
  );
  const selectedTeamSearchAccount = teamAssignForm.user_id ? teamSearchResultById?.[teamAssignForm.user_id] || null : null;
  const resolveKnownTeamUserSummary = useCallback((userId) => {
    const key = trimOrEmpty(userId);
    if (!key) return null;
    return teamUserSummariesById?.[key] || teamSearchResultById?.[key] || null;
  }, [teamSearchResultById, teamUserSummariesById]);
  const formatKnownTeamUserLabel = useCallback((userId) => {
    const summary = resolveKnownTeamUserSummary(userId);
    return trimOrEmpty(summary?.display_name) || trimOrEmpty(summary?.email) || shortUserId(userId);
  }, [resolveKnownTeamUserSummary]);
  const permissionsByRole = useMemo(() => {
    const lookup = {};
    for (const row of rolePermissions || []) {
      const roleKey = trimOrEmpty(row?.role);
      if (!roleKey || !row?.allowed) continue;
      if (!lookup[roleKey]) lookup[roleKey] = [];
      lookup[roleKey].push(row);
    }
    return lookup;
  }, [rolePermissions]);
  const teamAssignmentsByRole = useMemo(() => {
    const lookup = {};
    for (const row of teamAssignments || []) {
      const roleKey = trimOrEmpty(row?.role) || "unassigned";
      lookup[roleKey] = (lookup[roleKey] || 0) + 1;
    }
    return lookup;
  }, [teamAssignments]);
  const eventSourceSummary = useMemo(() => {
    const lookup = {};
    for (const row of events || []) {
      const key = trimOrEmpty(row?.source_type) || "manual";
      lookup[key] = (lookup[key] || 0) + 1;
    }
    return lookup;
  }, [events]);

  const homeAlerts = useMemo(() => publishedAlerts.slice(0, 3), [publishedAlerts]);
  const homeEvents = useMemo(() => publishedEvents.slice(0, 4), [publishedEvents]);
  const teamSectionBlocked = /could not load team access/i.test(trimOrEmpty(settingsSectionStatus.team).toLowerCase());
  const teamSectionStatusIsError = /requires|could not|invalid|unable|only|select|need/i.test(trimOrEmpty(settingsSectionStatus.team));
  const loadTeamUserSummaries = useCallback(async () => {
    if (!session?.user?.id) {
      setTeamUserSummariesById({});
      return;
    }

    const userIds = [...new Set((teamAssignments || []).map((row) => trimOrEmpty(row?.user_id)).filter(Boolean))];
    if (!userIds.length) {
      setTeamUserSummariesById({});
      return;
    }

    const { data, error } = await invokeTeamUserAdmin({
      action: "lookup_users",
      user_ids: userIds,
    });

    if (error) return;

    const nextLookup = {};
    for (const row of Array.isArray(data?.results) ? data.results : []) {
      const key = trimOrEmpty(row?.id);
      if (!key) continue;
      nextLookup[key] = row;
    }
    setTeamUserSummariesById(nextLookup);
  }, [invokeTeamUserAdmin, session?.user?.id, teamAssignments]);

  useEffect(() => {
    void loadTeamUserSummaries();
  }, [loadTeamUserSummaries]);

  useEffect(() => {
    if (!assignableTeamRoles.length) {
      if (trimOrEmpty(teamAssignForm.role) !== "tenant_employee") {
        setTeamAssignForm((prev) => ({ ...prev, role: "tenant_employee" }));
      }
      return;
    }
    if (!assignableTeamRoles.some((row) => trimOrEmpty(row?.role) === trimOrEmpty(teamAssignForm.role))) {
      setTeamAssignForm((prev) => ({ ...prev, role: trimOrEmpty(assignableTeamRoles[0]?.role) || "tenant_employee" }));
    }
  }, [assignableTeamRoles, teamAssignForm.role]);

  useEffect(() => {
    let cancelled = false;

    async function loadTenantInterests() {
      if (!session?.user?.id) {
        setAvailableHubTenants([]);
        setInterestedTenantKeys([]);
        setSavedInterestedTenantKeys([]);
        return;
      }

      const [tenantListRes, interestsRes] = await Promise.all([
        supabase.rpc("list_resident_hub_tenants"),
        supabase
          .from("resident_tenant_interests")
          .select("tenant_key")
          .eq("user_id", session.user.id),
      ]);

      if (cancelled) return;

      const fallbackCurrentTenant = buildTenantOption(
        null,
        tenantKey,
        tenantName,
        trimOrEmpty(tenant?.tenantConfig?.primary_subdomain)
      );

      if (tenantListRes.error) {
        if (isMissingFunctionError(tenantListRes.error)) {
          setAvailableHubTenants(fallbackCurrentTenant ? [fallbackCurrentTenant] : []);
        } else {
          setAvailableHubTenants(fallbackCurrentTenant ? [fallbackCurrentTenant] : []);
          setAccountSectionStatus((prev) => ({
            ...prev,
            cities: tenantListRes.error.message || "Could not load the available municipality list.",
          }));
        }
      } else {
        const nextTenantList = Array.isArray(tenantListRes.data) ? tenantListRes.data : [];
        setAvailableHubTenants(nextTenantList.length ? nextTenantList : (fallbackCurrentTenant ? [fallbackCurrentTenant] : []));
        setAccountSectionStatus((prev) => ({ ...prev, cities: "" }));
      }

      if (interestsRes.error) {
        if (isMissingRelationError(interestsRes.error)) {
          setInterestedTenantKeys([tenantKey]);
          setSavedInterestedTenantKeys([tenantKey]);
        } else {
          setInterestedTenantKeys([]);
          setSavedInterestedTenantKeys([]);
        }
        return;
      }

      const nextKeys = [...new Set((interestsRes.data || []).map((row) => trimOrEmpty(row?.tenant_key).toLowerCase()).filter(Boolean))];
      let normalizedKeys = nextKeys.includes(tenantKey) ? nextKeys : [tenantKey, ...nextKeys];
      if (!nextKeys.includes(tenantKey)) {
        const { error: syncError } = await supabase
          .from("resident_tenant_interests")
          .upsert([{ user_id: session.user.id, tenant_key: tenantKey }], { onConflict: "user_id,tenant_key" });
        if (!cancelled && syncError) {
          setAccountSectionStatus((prev) => ({
            ...prev,
            cities: syncError.message || "Could not sync the current municipality into your saved cities.",
          }));
        }
      }
      normalizedKeys = [...new Set(normalizedKeys)];
      setInterestedTenantKeys(normalizedKeys);
      setSavedInterestedTenantKeys(normalizedKeys);
    }

    void loadTenantInterests();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, tenant?.tenantConfig?.primary_subdomain, tenantKey, tenantName]);

  useEffect(() => {
    let cancelled = false;

    async function loadManageAccess() {
      if (!session?.user?.id) {
        setManageAccess(false);
        return;
      }
      setManageLoading(true);
      const { data, error } = await supabase.rpc("can_manage_tenant_communications", { p_tenant: tenantKey });
      if (cancelled) return;
      setManageLoading(false);
      if (error && !isMissingFunctionError(error)) {
        setManageAccess(false);
        return;
      }
      if (error && isMissingFunctionError(error)) {
        const fallback = await supabase
          .from("tenant_user_roles")
          .select("role")
          .eq("tenant_key", tenantKey)
          .eq("user_id", session.user.id)
          .eq("status", "active");
        if (cancelled) return;
        if (fallback.error) {
          setManageAccess(false);
          return;
        }
        const hasTenantAdminRole = (fallback.data || []).some((row) => trimOrEmpty(row?.role) === "tenant_admin");
        setManageAccess(hasTenantAdminRole);
        return;
      }
      setManageAccess(Boolean(data));
    }

    void loadManageAccess();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, tenantKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      setDataLoading(true);

      const topicQuery = supabase
        .from("notification_topics")
        .select("tenant_key,topic_key,label,description,default_enabled,active,sort_order")
        .order("sort_order", { ascending: true });

      const alertQuery = supabase
        .from("municipality_alerts")
        .select("id,tenant_key,topic_key,title,summary,body,severity,location_name,location_address,cta_label,cta_url,pinned,delivery_channels,status,starts_at,ends_at,published_at,created_at,updated_at")
        .order("pinned", { ascending: false })
        .order("starts_at", { ascending: false })
        .order("created_at", { ascending: false });

      const eventQuery = supabase
        .from("municipality_events")
        .select("id,tenant_key,topic_key,title,summary,body,location_name,location_address,cta_label,cta_url,all_day,delivery_channels,status,starts_at,ends_at,published_at,created_at,updated_at,source_type,source_ref")
        .order("starts_at", { ascending: true })
        .order("created_at", { ascending: false });

      const [topicRes, alertRes, eventRes] = await Promise.all([topicQuery, alertQuery, eventQuery]);

      if (cancelled) return;

      const firstError = topicRes.error || alertRes.error || eventRes.error;
      if (firstError) {
        if (isMissingRelationError(firstError)) {
          setTopics([]);
          setAlerts([]);
          setEvents([]);
          setDataLoading(false);
          return;
        }
        setTopics([]);
        setAlerts([]);
        setEvents([]);
        setDataLoading(false);
        return;
      }

      const nextTopics = (topicRes.data || []).map((topic) => ({
        ...topic,
        label: trimOrEmpty(topic?.label) || topic?.topic_key,
        description: trimOrEmpty(topic?.description),
      }));
      const labelsByTopic = Object.fromEntries(nextTopics.map((topic) => [topic.topic_key, topic.label]));

      setTopics(nextTopics);
      setAlerts(
        sortAlerts((alertRes.data || []).map((alert) => ({
          ...alert,
          topic_label: labelsByTopic[alert.topic_key] || DEFAULT_TOPIC_DETAILS[alert.topic_key]?.label || alert.topic_key,
        })))
      );
      setEvents(
        sortEvents((eventRes.data || []).map((event) => ({
          ...event,
          topic_label: labelsByTopic[event.topic_key] || DEFAULT_TOPIC_DETAILS[event.topic_key]?.label || event.topic_key,
        })))
      );
      setDataLoading(false);
    }

    void loadContent();
    return () => {
      cancelled = true;
    };
  }, [tenantKey, session?.user?.id, manageAccess]);

  useEffect(() => {
    let cancelled = false;

    async function loadLocationSettingsData() {
      if (!String(routePath || "").startsWith(SETTINGS_PATH) || !session?.user?.id) {
        setSettingsLoading(false);
        return;
      }

      setSettingsLoading(true);
      setSettingsStatus("");
      setSettingsSectionStatus({
        organization: "",
        assets: "",
        reports: "",
        team: "",
        roles: "",
        calendar: "",
        map: "",
      });

      const locationQueries = Promise.all([
        manageAccess
          ? supabase
            .from("tenant_profiles")
            .select("*")
            .eq("tenant_key", tenantKey)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        manageAccess
          ? supabase
            .from("tenant_map_features")
            .select("tenant_key,show_boundary_border,shade_outside_boundary,outside_shade_opacity,boundary_border_color,boundary_border_width")
            .eq("tenant_key", tenantKey)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        session?.user?.id
          ? supabase
            .from("tenant_user_roles")
            .select("user_id,role,status,created_at,updated_at")
            .eq("tenant_key", tenantKey)
            .order("updated_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        session?.user?.id
          ? supabase
            .from("tenant_role_definitions")
            .select("role,role_label,is_system,active,created_at,updated_at")
            .eq("tenant_key", tenantKey)
            .order("is_system", { ascending: false })
            .order("role_label", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        session?.user?.id
          ? supabase
            .from("tenant_role_permissions")
            .select("role,permission_key,allowed")
            .eq("tenant_key", tenantKey)
            .eq("allowed", true)
            .order("role", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        session?.user?.id
          ? supabase
            .from("tenant_permissions_catalog")
            .select("permission_key,module_key,action_key,label,sort_order")
            .order("sort_order", { ascending: true })
          : Promise.resolve({ data: [], error: null }),
        manageAccess
          ? supabase
            .from("tenant_files")
            .select("id,tenant_key,file_category,file_name,storage_bucket,storage_path,mime_type,size_bytes,uploaded_by,uploaded_at,notes,active,asset_subtype,asset_owner_type")
            .eq("tenant_key", tenantKey)
            .order("uploaded_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      const [profileRes, mapRes, teamRes, rolesRes, permissionsRes, catalogRes, filesRes] = await locationQueries;

      if (cancelled) return;

      const nextProfile = profileRes?.error ? null : (profileRes?.data || null);
      const nextMapAppearance = mapRes?.error ? null : (mapRes?.data || null);
      const nextAssetLibrary = [
        {
          key: "location-logo",
          label: "Location Logo",
          description: "Primary CityReport location branding asset.",
          status: filesRes?.error ? "Unavailable" : ((filesRes?.data || []).some((row) => trimOrEmpty(row?.file_category).toLowerCase() === "logo") ? "Uploaded" : "Ready"),
        },
        nextProfile?.website_url ? {
          key: "location-website",
          label: "Website Link",
          description: nextProfile.website_url,
          status: "Linked",
        } : null,
        tenant?.tenantConfig?.boundary_config_key ? {
          key: "boundary-config",
          label: "Boundary Config",
          description: tenant.tenantConfig.boundary_config_key,
          status: ((filesRes?.data || []).some((row) => trimOrEmpty(row?.file_category).toLowerCase() === "boundary_geojson")) ? "Uploaded" : "Attached",
        } : null,
        {
          key: "asset-library",
          label: "Asset Library",
          description: "Physical infrastructure files can be tracked here as assets with subcategories like streetlights, hydrants, or other inventory.",
          status: ((filesRes?.data || []).some((row) => isAssetLibraryFile(row))) ? "Loaded" : "Available",
        },
        {
          key: "calendar-feed",
          label: "Calendar Feed",
          description: "Published events can be exported as a calendar feed for this location.",
          status: ((filesRes?.data || []).some((row) => trimOrEmpty(row?.file_category).toLowerCase() === "calendar_source"))
            ? "Linked"
            : (publishedEvents.length ? "Published" : "Ready"),
        },
      ].filter(Boolean);

      setOrganizationProfile(nextProfile);
      setMapAppearance(nextMapAppearance);
      setAssetLibrary(nextAssetLibrary);
      setAssetFiles(filesRes?.error ? [] : (filesRes?.data || []));
      setTeamAssignments(teamRes?.error ? [] : (teamRes?.data || []));
      setRoleDefinitions(rolesRes?.error ? [] : (rolesRes?.data || []));
      setRolePermissions(permissionsRes?.error ? [] : (permissionsRes?.data || []));
      setPermissionCatalog(catalogRes?.error ? [] : (catalogRes?.data || []));
      setSettingsSectionStatus({
        organization: profileRes?.error
          ? ((isPermissionError(profileRes.error)
            ? "Organization information is not available to this account yet."
            : profileRes.error.message) || "Could not load organization information.")
          : "",
        assets: filesRes?.error
          ? ((isPermissionError(filesRes.error)
            ? "Asset files are not available to this account yet."
            : filesRes.error.message) || "Could not load location assets.")
          : "",
        reports: "",
        team: teamRes?.error
          ? (isPermissionError(teamRes.error) ? "Team access visibility requires the users.access permission for this location." : teamRes.error.message || "Could not load team access.")
          : "",
        roles: rolesRes?.error || permissionsRes?.error || catalogRes?.error
          ? ((isPermissionError(rolesRes?.error || permissionsRes?.error || catalogRes?.error)
            ? "Role details require the roles.access or users.access permission for this location."
            : (rolesRes?.error || permissionsRes?.error || catalogRes?.error)?.message) || "Could not load roles and permissions.")
          : "",
        calendar: "",
        map: mapRes?.error
          ? ((isPermissionError(mapRes.error)
            ? "Map appearance settings are not available to this account yet."
            : mapRes.error.message) || "Could not load map settings.")
          : "",
      });
      setSettingsLoading(false);
    }

    void loadLocationSettingsData();
    return () => {
      cancelled = true;
    };
  }, [manageAccess, publishedEvents.length, routePath, session?.user?.id, tenant?.tenantConfig?.boundary_config_key, tenantKey]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreferences() {
      if (!session?.user?.id) {
        setPreferencesByTopic({});
        setSavedPreferencesByTopic({});
        return;
      }
      const { data, error } = await supabase
        .from("resident_notification_preferences")
        .select("topic_key,in_app_enabled,email_enabled,web_push_enabled")
        .eq("tenant_key", tenantKey)
        .eq("user_id", session.user.id);

      if (cancelled) return;
      if (error) {
        if (isMissingRelationError(error)) {
          setPreferencesByTopic({});
          setSavedPreferencesByTopic({});
          return;
        }
        setAccountSectionStatus((prev) => ({ ...prev, notifications: error.message || "Could not load your notification preferences." }));
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
      setPreferencesByTopic(next);
      setSavedPreferencesByTopic(next);
    }
    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, tenantKey]);

  function navigate(nextPath) {
    const target = buildMunicipalityAppHref(window.location.pathname, tenantKey, nextPath);
    window.history.pushState({}, "", target);
    setRoutePath(normalizeMunicipalityAppPath(target, tenantKey));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updatePreferenceDraft(topicKey, field, nextValue) {
    setPreferencesByTopic((prev) => ({
      ...prev,
      [topicKey]: {
        in_app_enabled: prev?.[topicKey]?.in_app_enabled ?? Boolean(topicLookup?.[topicKey]?.default_enabled),
        email_enabled: prev?.[topicKey]?.email_enabled ?? false,
        web_push_enabled: prev?.[topicKey]?.web_push_enabled ?? false,
        [field]: nextValue,
      },
    }));
  }

  function populateAlertForm(alert) {
    setAlertForm({
      topic_key: trimOrEmpty(alert?.topic_key) || EMPTY_ALERT_FORM.topic_key,
      title: trimOrEmpty(alert?.title),
      summary: trimOrEmpty(alert?.summary),
      body: trimOrEmpty(alert?.body),
      severity: trimOrEmpty(alert?.severity) || EMPTY_ALERT_FORM.severity,
      location_name: trimOrEmpty(alert?.location_name),
      location_address: trimOrEmpty(alert?.location_address),
      cta_label: trimOrEmpty(alert?.cta_label),
      cta_url: trimOrEmpty(alert?.cta_url),
      starts_at: toDateTimeLocalValue(alert?.starts_at),
      ends_at: toDateTimeLocalValue(alert?.ends_at),
      pinned: Boolean(alert?.pinned),
      status: trimOrEmpty(alert?.status) || EMPTY_ALERT_FORM.status,
    });
  }

  function populateEventForm(eventRow) {
    setEventForm({
      topic_key: trimOrEmpty(eventRow?.topic_key) || EMPTY_EVENT_FORM.topic_key,
      title: trimOrEmpty(eventRow?.title),
      summary: trimOrEmpty(eventRow?.summary),
      body: trimOrEmpty(eventRow?.body),
      location_name: trimOrEmpty(eventRow?.location_name),
      location_address: trimOrEmpty(eventRow?.location_address),
      cta_label: trimOrEmpty(eventRow?.cta_label),
      cta_url: trimOrEmpty(eventRow?.cta_url),
      starts_at: toDateTimeLocalValue(eventRow?.starts_at),
      ends_at: toDateTimeLocalValue(eventRow?.ends_at),
      all_day: Boolean(eventRow?.all_day),
      status: trimOrEmpty(eventRow?.status) || EMPTY_EVENT_FORM.status,
    });
  }

  function startNewAlert() {
    setAdminStatus("");
    setEditingAlertId(null);
    setAlertForm({ ...EMPTY_ALERT_FORM });
    setShowAlertComposer(true);
  }

  function startEditAlert(alert) {
    setAdminStatus("");
    setEditingAlertId(alert?.id || null);
    populateAlertForm(alert);
    setShowAlertComposer(true);
  }

  function closeAlertComposer() {
    setShowAlertComposer(false);
    setEditingAlertId(null);
    setAlertForm({ ...EMPTY_ALERT_FORM });
  }

  function startNewEvent() {
    setAdminStatus("");
    setEditingEventId(null);
    setEventForm({ ...EMPTY_EVENT_FORM, starts_at: toDateInputValue(new Date()) });
    setShowEventComposer(true);
  }

  function startEditEvent(eventRow) {
    setAdminStatus("");
    setEditingEventId(eventRow?.id || null);
    populateEventForm(eventRow);
    setShowEventComposer(true);
  }

  function closeEventComposer() {
    setShowEventComposer(false);
    setEditingEventId(null);
    setEventForm({ ...EMPTY_EVENT_FORM, starts_at: toDateInputValue(new Date()) });
  }

  function updateTenantInterest(tenantKeyInput, enabled) {
    const key = trimOrEmpty(tenantKeyInput).toLowerCase();
    if (!key) return;
    setInterestedTenantKeys((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(key);
      else next.delete(key);
      return [...next];
    });
  }

  function setSectionEditing(sectionKey, isEditing) {
    setAccountSectionEdit((prev) => ({ ...prev, [sectionKey]: isEditing }));
  }

  async function saveNotificationPreferences() {
    if (!session?.user?.id) return;
    setSavingSection((prev) => ({ ...prev, notifications: true }));
    setAccountSectionStatus((prev) => ({ ...prev, notifications: "" }));
    const rows = Object.keys(topicLookup).map((topicKey) => {
      const fallbackEnabled = Boolean(topicLookup?.[topicKey]?.default_enabled);
      const current = preferencesByTopic?.[topicKey] || {};
      return {
        tenant_key: tenantKey,
        user_id: session.user.id,
        topic_key: topicKey,
        in_app_enabled: current.in_app_enabled ?? fallbackEnabled,
        email_enabled: current.email_enabled ?? false,
        web_push_enabled: current.web_push_enabled ?? false,
      };
    });
    const { error: preferencesError } = await supabase
      .from("resident_notification_preferences")
      .upsert(rows, { onConflict: "tenant_key,user_id,topic_key" });

    if (preferencesError) {
      setSavingSection((prev) => ({ ...prev, notifications: false }));
      setAccountSectionStatus((prev) => ({ ...prev, notifications: preferencesError.message || "Could not save your notification preferences." }));
      return;
    }

    setSavedPreferencesByTopic(preferencesByTopic);
    setSavingSection((prev) => ({ ...prev, notifications: false }));
    setAccountSectionStatus((prev) => ({ ...prev, notifications: "Notification preferences saved." }));
    setSectionEditing("notifications", false);
  }

  async function saveInterestedCities() {
    if (!session?.user?.id) return;
    setSavingSection((prev) => ({ ...prev, cities: true }));
    setAccountSectionStatus((prev) => ({ ...prev, cities: "" }));
    const nextInterestKeys = [...new Set(interestedTenantKeys.map((value) => trimOrEmpty(value).toLowerCase()).filter(Boolean))];
    const savedKeys = new Set(savedInterestedTenantKeys);
    const nextKeys = new Set(nextInterestKeys);
    const keysToDelete = [...savedKeys].filter((key) => !nextKeys.has(key));
    const keysToInsert = nextInterestKeys.filter((key) => !savedKeys.has(key));

    if (keysToDelete.length) {
      const { error: deleteError } = await supabase
        .from("resident_tenant_interests")
        .delete()
        .eq("user_id", session.user.id)
        .in("tenant_key", keysToDelete);
      if (deleteError) {
        setSavingSection((prev) => ({ ...prev, cities: false }));
        setAccountSectionStatus((prev) => ({ ...prev, cities: deleteError.message || "Could not update your city selections." }));
        return;
      }
    }

    if (keysToInsert.length) {
      const { error: insertError } = await supabase
        .from("resident_tenant_interests")
        .insert(keysToInsert.map((selectedTenantKey) => ({
          user_id: session.user.id,
          tenant_key: selectedTenantKey,
        })));
      if (insertError) {
        setSavingSection((prev) => ({ ...prev, cities: false }));
        setAccountSectionStatus((prev) => ({ ...prev, cities: insertError.message || "Could not update your city selections." }));
        return;
      }
    }

    setSavedInterestedTenantKeys(nextInterestKeys);
    setSavingSection((prev) => ({ ...prev, cities: false }));
    setAccountSectionStatus((prev) => ({ ...prev, cities: "City selections saved." }));
    setSectionEditing("cities", false);
  }

  async function saveAccountProfile() {
    if (!session?.user?.id) return;
    const full_name = trimOrEmpty(accountProfileDraft.full_name);
    const phone = trimOrEmpty(accountProfileDraft.phone);
    const email = trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email);
    if (!full_name) {
      setAccountSectionStatus((prev) => ({ ...prev, profile: "Please enter your full name." }));
      return;
    }

    setSavingSection((prev) => ({ ...prev, profile: true }));
    setAccountSectionStatus((prev) => ({ ...prev, profile: "" }));
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert(
        [{
          user_id: session.user.id,
          full_name,
          phone: phone || null,
          email: email || null,
        }],
        { onConflict: "user_id" }
      );

    if (profileError) {
      setSavingSection((prev) => ({ ...prev, profile: false }));
      setAccountSectionStatus((prev) => ({ ...prev, profile: profileError.message || "Could not update your account information." }));
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { full_name, phone: phone || null },
    });

    if (metadataError) {
      console.warn("[municipality account] auth metadata update warning:", metadataError);
    }

    setProfile((prev) => ({
      ...(prev || {}),
      full_name,
      phone: phone || null,
      email: email || prev?.email || null,
    }));
    setSavingSection((prev) => ({ ...prev, profile: false }));
    setAccountSectionStatus((prev) => ({ ...prev, profile: "Account information saved." }));
    setSectionEditing("profile", false);
  }

  async function saveSecuritySettings() {
    if (!session?.user?.id) return;
    const nextEmail = trimOrEmpty(securityDraft.next_email).toLowerCase();
    const currentEmail = trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email);
    const currentPassword = String(securityDraft.current_password || "");
    const newPassword = String(securityDraft.new_password || "");
    const confirmPassword = String(securityDraft.confirm_password || "");

    if (!currentPassword.trim()) {
      setAccountSectionStatus((prev) => ({ ...prev, security: "Enter your current password to change email or password." }));
      return;
    }

    if ((newPassword || confirmPassword) && !validateStrongPassword(newPassword)) {
      setAccountSectionStatus((prev) => ({ ...prev, security: "Use 8+ characters with uppercase, lowercase, number, and special character." }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setAccountSectionStatus((prev) => ({ ...prev, security: "New password and confirmation do not match." }));
      return;
    }

    setSavingSection((prev) => ({ ...prev, security: true }));
    setAccountSectionStatus((prev) => ({ ...prev, security: "" }));

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    });
    if (reauthError) {
      setSavingSection((prev) => ({ ...prev, security: false }));
      setAccountSectionStatus((prev) => ({ ...prev, security: reauthError.message || "Please verify your current password." }));
      return;
    }

    let nextStatus = [];
    if (nextEmail && nextEmail !== currentEmail) {
      const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail });
      if (emailError) {
        setSavingSection((prev) => ({ ...prev, security: false }));
        setAccountSectionStatus((prev) => ({ ...prev, security: emailError.message || "Could not start the email change process." }));
        return;
      }
      nextStatus.push("Check your inbox to verify your new email address.");
    }

    if (newPassword) {
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) {
        setSavingSection((prev) => ({ ...prev, security: false }));
        setAccountSectionStatus((prev) => ({ ...prev, security: passwordError.message || "Could not update your password." }));
        return;
      }
      nextStatus.push("Password updated.");
    }

    try {
      const { data } = await supabase.auth.refreshSession();
      if (data?.session) setSession(data.session);
    } catch {
      // no-op
    }

    setSecurityDraft({
      next_email: nextEmail || currentEmail,
      current_password: "",
      new_password: "",
      confirm_password: "",
    });
    setSavingSection((prev) => ({ ...prev, security: false }));
    setAccountSectionStatus((prev) => ({ ...prev, security: nextStatus.length ? nextStatus.join(" ") : "Security settings saved." }));
    setSectionEditing("security", false);
  }

  async function saveOrganizationGeneralSettings() {
    if (!manageAccess) return;
    const displayName = trimOrEmpty(organizationProfileDraft.display_name) || tenantName;
    if (!displayName) {
      setSettingsSectionStatus((prev) => ({ ...prev, organization: "Enter the organization name before saving." }));
      return;
    }

    setSettingsSectionSaving((prev) => ({ ...prev, organization: true }));
    setSettingsSectionStatus((prev) => ({ ...prev, organization: "" }));

    const payload = {
      tenant_key: tenantKey,
      display_name: displayName,
      contact_primary_email: trimOrEmpty(organizationProfileDraft.contact_primary_email) || null,
      legal_name: trimOrEmpty(organizationProfileDraft.legal_name) || null,
      contact_primary_phone: trimOrEmpty(organizationProfileDraft.contact_primary_phone) || null,
      website_url: trimOrEmpty(organizationProfileDraft.website_url) || null,
      mailing_address_1: trimOrEmpty(organizationProfileDraft.mailing_address_1) || null,
      mailing_address_2: trimOrEmpty(organizationProfileDraft.mailing_address_2) || null,
      mailing_city: trimOrEmpty(organizationProfileDraft.mailing_city) || null,
      mailing_state: trimOrEmpty(organizationProfileDraft.mailing_state) || null,
      mailing_zip: trimOrEmpty(organizationProfileDraft.mailing_zip) || null,
      timezone: trimOrEmpty(organizationProfileDraft.timezone) || "America/New_York",
    };

    const { data, error } = await supabase
      .from("tenant_profiles")
      .upsert([payload], { onConflict: "tenant_key" })
      .select("*")
      .maybeSingle();

    setSettingsSectionSaving((prev) => ({ ...prev, organization: false }));

    if (error) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        organization: error.message || "Could not save the organization settings.",
      }));
      return;
    }

    setOrganizationProfile(data || { ...(organizationProfile || {}), ...payload });
    setSettingsSectionEdit((prev) => ({ ...prev, organization: false }));
    setSettingsSectionStatus((prev) => ({ ...prev, organization: "Organization settings saved." }));
  }

  async function saveMapAppearanceSettings() {
    if (!manageAccess) return;

    const opacityRaw = Number(mapAppearanceDraft?.outside_shade_opacity);
    const opacity = Number.isFinite(opacityRaw) ? Math.max(0, Math.min(1, opacityRaw)) : 0.42;
    const borderColor = sanitizeHexColor(mapAppearanceDraft?.boundary_border_color, "#e53935");
    const borderWidthRaw = Number(mapAppearanceDraft?.boundary_border_width);
    const borderWidth = Number.isFinite(borderWidthRaw) ? Math.max(0.5, Math.min(8, borderWidthRaw)) : 4;
    const payload = {
      tenant_key: tenantKey,
      show_boundary_border: Boolean(mapAppearanceDraft?.show_boundary_border),
      shade_outside_boundary: Boolean(mapAppearanceDraft?.shade_outside_boundary),
      outside_shade_opacity: opacity,
      boundary_border_color: borderColor,
      boundary_border_width: borderWidth,
    };

    setSettingsSectionSaving((prev) => ({ ...prev, map: true }));
    setSettingsSectionStatus((prev) => ({ ...prev, map: "" }));

    const { data, error } = await supabase
      .from("tenant_map_features")
      .upsert([payload], { onConflict: "tenant_key" })
      .select("tenant_key,show_boundary_border,shade_outside_boundary,outside_shade_opacity,boundary_border_color,boundary_border_width")
      .maybeSingle();

    setSettingsSectionSaving((prev) => ({ ...prev, map: false }));

    if (error) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        map: error.message || "Could not save the map appearance settings.",
      }));
      return;
    }

    const nextMapAppearance = data || payload;
    setMapAppearance(nextMapAppearance);
    setMapAppearanceDraft(buildMapAppearanceDraft(nextMapAppearance));
    setSettingsSectionEdit((prev) => ({ ...prev, map: false }));
    setSettingsSectionStatus((prev) => ({ ...prev, map: "Map appearance settings saved." }));
  }

  async function reloadAssetFiles() {
    const { data, error } = await supabase
      .from("tenant_files")
      .select("id,tenant_key,file_category,file_name,storage_bucket,storage_path,mime_type,size_bytes,uploaded_by,uploaded_at,notes,active,asset_subtype,asset_owner_type")
      .eq("tenant_key", tenantKey)
      .order("uploaded_at", { ascending: false });

    if (error) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        assets: error.message || "Could not refresh the asset library.",
      }));
      return;
    }

    setAssetFiles(Array.isArray(data) ? data : []);
  }

  async function reloadTeamAssignments() {
    const { data, error } = await supabase
      .from("tenant_user_roles")
      .select("user_id,role,status,created_at,updated_at")
      .eq("tenant_key", tenantKey)
      .order("updated_at", { ascending: false });

    if (error) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        team: isPermissionError(error)
          ? "Team access visibility requires the users.access permission for this location."
          : (error.message || "Could not refresh team access."),
      }));
      return false;
    }

    setTeamAssignments(Array.isArray(data) ? data : []);
    return true;
  }

  async function searchTeamAccounts(event) {
    event.preventDefault();
    setSettingsSectionStatus((prev) => ({ ...prev, team: "" }));
    setTeamSearchLoading(true);

    const { data, error } = await invokeTeamUserAdmin({
      action: "search",
      query: teamSearchQuery,
    });

    setTeamSearchLoading(false);

    if (error) {
      setTeamSearchResults([]);
      setSettingsSectionStatus((prev) => ({
        ...prev,
        team: String(error?.message || "Could not search existing accounts."),
      }));
      return;
    }

    const results = Array.isArray(data?.results) ? data.results : [];
    setTeamSearchResults(results);
    setTeamAssignForm((prev) => ({
      ...prev,
      user_id: results.some((row) => trimOrEmpty(row?.id) === trimOrEmpty(prev.user_id))
        ? prev.user_id
        : "",
    }));
    setSettingsSectionStatus((prev) => ({
      ...prev,
      team: results.length
        ? `Found ${results.length} matching account${results.length === 1 ? "" : "s"}.`
        : "No matching account was found. Try an exact email, exact phone number, or full name.",
    }));
  }

  async function assignExistingTeamAccount(event) {
    event?.preventDefault?.();
    const userId = trimOrEmpty(teamAssignForm.user_id);
    const role = trimOrEmpty(teamAssignForm.role).toLowerCase() || trimOrEmpty(assignableTeamRoles[0]?.role) || "tenant_employee";

    if (!userId) {
      setSettingsSectionStatus((prev) => ({ ...prev, team: "Select an account before assigning a role." }));
      return;
    }
    if (!role) {
      setSettingsSectionStatus((prev) => ({ ...prev, team: "Select a valid role before assigning access." }));
      return;
    }

    setSettingsSectionStatus((prev) => ({ ...prev, team: "" }));
    setTeamAssignLoading(true);

    const { error } = await invokeTeamUserAdmin({
      action: "assign_existing",
      user_id: userId,
      role,
    });

    setTeamAssignLoading(false);

    if (error) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        team: String(error?.message || "Could not assign this employee role."),
      }));
      return;
    }

    await reloadTeamAssignments();
    const personLabel = trimOrEmpty(selectedTeamSearchAccount?.display_name) || trimOrEmpty(selectedTeamSearchAccount?.email) || shortUserId(userId);
    setSettingsSectionStatus((prev) => ({
      ...prev,
      team: `Assigned ${roleDefinitionLookup[role]?.role_label || roleKeyToLabel(role)} to ${personLabel}.`,
    }));
    setTeamManagementView("list");
    setTeamAssignForm((prev) => ({ ...prev, user_id: "", role }));
  }

  async function createAndAssignTeamUser(event) {
    event.preventDefault();
    const role = trimOrEmpty(teamAssignForm.role).toLowerCase() || trimOrEmpty(assignableTeamRoles[0]?.role) || "tenant_employee";
    const firstName = trimOrEmpty(teamInviteForm.first_name);
    const lastName = trimOrEmpty(teamInviteForm.last_name);
    const email = trimOrEmpty(teamInviteForm.email).toLowerCase();
    const phone = trimOrEmpty(teamInviteForm.phone);

    if (!role || !firstName || !lastName || !email) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        team: "First name, last name, email, and role are required.",
      }));
      return;
    }

    setSettingsSectionStatus((prev) => ({ ...prev, team: "" }));
    setTeamInviteLoading(true);

    const { data, error } = await invokeTeamUserAdmin({
      action: "invite_and_assign",
      role,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
    });

    setTeamInviteLoading(false);

    if (error) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        team: String(error?.message || "Could not create or assign this employee account."),
      }));
      return;
    }

    await reloadTeamAssignments();
    setTeamInviteForm({ first_name: "", last_name: "", email: "", phone: "" });
    setTeamAssignForm((prev) => ({ ...prev, user_id: "", role }));
    setTeamManagementView("list");
    setTeamAssignmentMode("existing");
    setTeamSearchQuery(email);
    setTeamSearchResults([]);
    setSettingsSectionStatus((prev) => ({
      ...prev,
      team: data?.inviteSent === true
        ? `Created an invited account for ${email} and assigned ${roleDefinitionLookup[role]?.role_label || roleKeyToLabel(role)}.`
        : `Assigned ${roleDefinitionLookup[role]?.role_label || roleKeyToLabel(role)} to existing account ${email}.`,
    }));
  }

  async function uploadAssetFile(event) {
    event.preventDefault();
    if (!manageAccess) return;
    const file = assetUploadDraft.file;
    if (!file) {
      setSettingsSectionStatus((prev) => ({ ...prev, assets: "Choose a file to upload first." }));
      return;
    }

    setSettingsSectionSaving((prev) => ({ ...prev, assets: true }));
    setSettingsSectionStatus((prev) => ({ ...prev, assets: "" }));

    const category = trimOrEmpty(assetUploadDraft.category).toLowerCase() || "asset";
    const assetSubtype = trimOrEmpty(assetUploadDraft.asset_subtype);
    const assetOwnerType = category === "asset"
      ? (trimOrEmpty(assetUploadDraft.asset_owner_type).toLowerCase() || "organization_owned")
      : null;
    if (category === "asset" && !assetSubtype) {
      setSettingsSectionSaving((prev) => ({ ...prev, assets: false }));
      setSettingsSectionStatus((prev) => ({ ...prev, assets: "Enter an asset subtype like streetlights or fire hydrants." }));
      return;
    }
    const now = Date.now();
    const subtypeSegment = category === "asset" ? `/${sanitizeFileNameSegment(assetSubtype.toLowerCase())}` : "";
    const path = `${tenantKey}/${category}${subtypeSegment}/${toDatePath(new Date())}/${now}_${sanitizeFileNameSegment(file.name)}`;
    const contentType = String(file.type || "application/octet-stream");

    const { error: uploadError } = await supabase
      .storage
      .from("tenant-files")
      .upload(path, file, { upsert: false, contentType });

    if (uploadError) {
      setSettingsSectionSaving((prev) => ({ ...prev, assets: false }));
      setSettingsSectionStatus((prev) => ({ ...prev, assets: uploadError.message || "Could not upload the asset file." }));
      return;
    }

    const metadataPayload = {
      tenant_key: tenantKey,
      file_category: category,
      file_name: file.name,
      storage_bucket: "tenant-files",
      storage_path: path,
      mime_type: contentType,
      size_bytes: Number(file.size || 0),
      uploaded_by: session?.user?.id || null,
      asset_subtype: category === "asset" ? assetSubtype : null,
      asset_owner_type: assetOwnerType,
      notes: trimOrEmpty(assetUploadDraft.notes) || null,
      active: true,
    };

    const { error: metaError } = await supabase.from("tenant_files").insert([metadataPayload]);
    if (metaError) {
      setSettingsSectionSaving((prev) => ({ ...prev, assets: false }));
      setSettingsSectionStatus((prev) => ({ ...prev, assets: metaError.message || "Could not save the asset record." }));
      return;
    }

    setAssetUploadDraft({ category: "asset", asset_subtype: "", asset_owner_type: "organization_owned", notes: "", file: null });
    setSettingsSectionSaving((prev) => ({ ...prev, assets: false }));
    setSettingsSectionStatus((prev) => ({ ...prev, assets: `Uploaded ${file.name}.` }));
    await reloadAssetFiles();
  }

  async function openAssetFile(row) {
    const bucket = String(row?.storage_bucket || "tenant-files").trim() || "tenant-files";
    const path = String(row?.storage_path || "").trim();
    if (!path) return;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        assets: String(error?.message || "Could not open the asset file."),
      }));
      return;
    }
    if (typeof window !== "undefined") {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function removeAssetFile(row) {
    const fileId = Number(row?.id || 0);
    const bucket = String(row?.storage_bucket || "tenant-files").trim() || "tenant-files";
    const path = String(row?.storage_path || "").trim();
    if (!fileId || !path) return;

    setSettingsSectionSaving((prev) => ({ ...prev, assets: true }));
    setSettingsSectionStatus((prev) => ({ ...prev, assets: "" }));

    const { error: removeStorageError } = await supabase.storage.from(bucket).remove([path]);
    if (removeStorageError) {
      setSettingsSectionSaving((prev) => ({ ...prev, assets: false }));
      setSettingsSectionStatus((prev) => ({
        ...prev,
        assets: removeStorageError.message || "Could not remove the asset file.",
      }));
      return;
    }

    const { error: removeMetaError } = await supabase.from("tenant_files").delete().eq("id", fileId);
    setSettingsSectionSaving((prev) => ({ ...prev, assets: false }));

    if (removeMetaError) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        assets: removeMetaError.message || "Could not remove the asset record.",
      }));
      return;
    }

    setSettingsSectionStatus((prev) => ({
      ...prev,
      assets: `Removed ${trimOrEmpty(row?.file_name) || "asset file"}.`,
    }));
    await reloadAssetFiles();
  }

  async function updateTeamAssignmentStatus(assignment, nextStatus) {
    const assignmentKey = `${assignment.user_id}-${assignment.role}`;
    setTeamAssignmentBusy((prev) => ({ ...prev, [assignmentKey]: true }));
    setSettingsSectionStatus((prev) => ({ ...prev, team: "" }));

    const { error } = await supabase
      .from("tenant_user_roles")
      .update({ status: nextStatus })
      .eq("tenant_key", tenantKey)
      .eq("user_id", assignment.user_id)
      .eq("role", assignment.role);

    setTeamAssignmentBusy((prev) => ({ ...prev, [assignmentKey]: false }));

    if (error) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        team: error.message || "Could not update this employee assignment.",
      }));
      return;
    }

    setTeamAssignments((prev) =>
      prev.map((row) => ((row.user_id === assignment.user_id && row.role === assignment.role)
        ? { ...row, status: nextStatus }
        : row))
    );
    setSettingsSectionStatus((prev) => ({ ...prev, team: "Employee access updated." }));
  }

  async function removeTeamAssignment(assignment) {
    const assignmentKey = `${assignment.user_id}-${assignment.role}`;
    setTeamAssignmentBusy((prev) => ({ ...prev, [assignmentKey]: true }));
    setSettingsSectionStatus((prev) => ({ ...prev, team: "" }));

    const { error } = await supabase
      .from("tenant_user_roles")
      .delete()
      .eq("tenant_key", tenantKey)
      .eq("user_id", assignment.user_id)
      .eq("role", assignment.role);

    setTeamAssignmentBusy((prev) => ({ ...prev, [assignmentKey]: false }));

    if (error) {
      setSettingsSectionStatus((prev) => ({
        ...prev,
        team: error.message || "Could not remove this employee assignment.",
      }));
      return;
    }

    setTeamAssignments((prev) => prev.filter((row) => !(row.user_id === assignment.user_id && row.role === assignment.role)));
    setSettingsSectionStatus((prev) => ({ ...prev, team: "Employee assignment removed." }));
  }

  function focusSettingsSection(routeTarget) {
    if (!routeTarget) return;
    navigate(routeTarget);
  }

  function downloadActivityExport() {
    const rows = [
      ...alerts.map((alert) => [
        "alert",
        trimOrEmpty(alert?.title),
        trimOrEmpty(alert?.status),
        trimOrEmpty(alert?.topic_label || alert?.topic_key),
        trimOrEmpty(alert?.severity),
        trimOrEmpty(alert?.starts_at),
        trimOrEmpty(alert?.ends_at),
        trimOrEmpty(alert?.location_name),
        trimOrEmpty(alert?.location_address),
      ]),
      ...events.map((eventRow) => [
        "event",
        trimOrEmpty(eventRow?.title),
        trimOrEmpty(eventRow?.status),
        trimOrEmpty(eventRow?.topic_label || eventRow?.topic_key),
        eventRow?.all_day ? "all_day" : "scheduled",
        trimOrEmpty(eventRow?.starts_at),
        trimOrEmpty(eventRow?.ends_at),
        trimOrEmpty(eventRow?.location_name),
        trimOrEmpty(eventRow?.location_address),
      ]),
    ];
    downloadTextFile(
      `${tenantKey || "location"}-activity-export.csv`,
      buildCsvFile(
        ["record_type", "title", "status", "topic", "priority_or_timing", "starts_at", "ends_at", "location_name", "location_address"],
        rows
      ),
      "text/csv;charset=utf-8"
    );
    setSettingsStatus("Location activity export downloaded.");
  }

  function downloadRoleAccessExport() {
    const rows = (roleDefinitions || []).map((roleRow) => {
      const allowedPermissions = (permissionsByRole[roleRow.role] || []).map((permissionRow) =>
        permissionLabelLookup[permissionRow.permission_key] || permissionRow.permission_key
      );
      return [
        trimOrEmpty(roleRow?.role_label) || trimOrEmpty(roleRow?.role),
        roleRow?.active ? "active" : "inactive",
        roleRow?.is_system ? "system" : "custom",
        String(allowedPermissions.length),
        allowedPermissions.join(" | "),
      ];
    });
    downloadTextFile(
      `${tenantKey || "location"}-role-access.csv`,
      buildCsvFile(["role", "status", "type", "allowed_permissions", "permission_labels"], rows),
      "text/csv;charset=utf-8"
    );
    setSettingsStatus("Role and permission export downloaded.");
  }

  function downloadLocationCalendar() {
    if (!publishedEvents.length) {
      setSettingsStatus("Publish an event first, then download the location calendar.");
      return;
    }
    downloadTextFile(
      `${tenantKey || "location"}-events.ics`,
      buildIcsFile(publishedEvents, organizationDisplayName),
      "text/calendar;charset=utf-8"
    );
    setSettingsStatus("Location calendar downloaded.");
  }

  function handleLocationSettingsAction(actionKey) {
    switch (actionKey) {
      case "run-reports":
        focusSettingsSection("/reports");
        setSettingsStatus("Reports are ready below.");
        return;
      case "export-activity":
        focusSettingsSection("/reports");
        downloadActivityExport();
        return;
      case "add-users":
        focusSettingsSection("/settings/manage-employees");
        setSettingsStatus("Team access tools are ready below. New account creation will plug into this section next.");
        return;
      case "view-team-access":
        focusSettingsSection("/settings/manage-employees");
        setSettingsStatus("Current location access is listed below.");
        return;
      case "assign-roles":
        focusSettingsSection("/settings/roles-permissions");
        setSettingsStatus("Role assignments and permission coverage are ready below.");
        return;
      case "review-permissions":
        focusSettingsSection("/settings/roles-permissions");
        setSettingsStatus("Permission coverage is ready below.");
        return;
      case "sync-calendars":
        focusSettingsSection("/settings/calendar");
        downloadLocationCalendar();
        return;
      case "review-sources":
        focusSettingsSection("/settings/calendar");
        setSettingsStatus("Calendar sources are summarized below.");
        return;
      default:
        return;
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true);
    setAuthStatus("");
    const email = trimOrEmpty(authForm.email).toLowerCase();
    const password = authForm.password || "";
    const fullName = trimOrEmpty(authForm.full_name);

    if (!email || !password) {
      setAuthBusy(false);
      setAuthStatus("Email and password are required.");
      return;
    }

    if (authMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setAuthBusy(false);
      if (error) {
        setAuthStatus(error.message || "Could not sign in.");
        return;
      }
      setAuthStatus("");
      setAuthForm({ full_name: "", email: "", password: "" });
      setShowAuthPassword(false);
      setAuthModalOpen(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || null,
        },
      },
    });
    if (error) {
      setAuthBusy(false);
      setAuthStatus(error.message || "Could not create your account.");
      return;
    }
    const uid = data?.user?.id;
    if (uid) {
      await supabase.from("profiles").upsert(
        [{ user_id: uid, full_name: fullName || null, email }],
        { onConflict: "user_id" }
      );
    }
    setAuthBusy(false);
    if (data?.session?.user?.id) {
      setAuthStatus("");
      setAuthForm({ full_name: "", email: "", password: "" });
      setShowAuthPassword(false);
      setAuthModalOpen(false);
      return;
    }
    setAuthStatus("Account created. If email confirmation is enabled, please confirm your email and then sign in.");
    setAuthMode("login");
  }

  async function handleResidentSignOut() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      markCrossTenantLogout();
    }
  }

  async function reloadAlerts() {
    const { data } = await supabase
      .from("municipality_alerts")
      .select("id,tenant_key,topic_key,title,summary,body,severity,location_name,location_address,cta_label,cta_url,pinned,delivery_channels,status,starts_at,ends_at,published_at,created_at,updated_at")
      .order("pinned", { ascending: false })
      .order("starts_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (data) {
      setAlerts(sortAlerts(data.map((item) => ({
        ...item,
        topic_label: topicLookup[item.topic_key]?.label || item.topic_key,
      }))));
    }
  }

  async function reloadEvents() {
    const { data } = await supabase
      .from("municipality_events")
      .select("id,tenant_key,topic_key,title,summary,body,location_name,location_address,cta_label,cta_url,all_day,delivery_channels,status,starts_at,ends_at,published_at,created_at,updated_at")
      .order("starts_at", { ascending: true })
      .order("created_at", { ascending: false });
    if (data) {
      setEvents(sortEvents(data.map((item) => ({
        ...item,
        topic_label: topicLookup[item.topic_key]?.label || item.topic_key,
      }))));
    }
  }

  async function createAlert(event) {
    event.preventDefault();
    setAdminStatus("");
    const payload = {
      tenant_key: tenantKey,
      topic_key: alertForm.topic_key,
      title: trimOrEmpty(alertForm.title),
      summary: trimOrEmpty(alertForm.summary),
      body: trimOrEmpty(alertForm.body),
      severity: alertForm.severity,
      location_name: trimOrEmpty(alertForm.location_name),
      location_address: trimOrEmpty(alertForm.location_address),
      cta_label: trimOrEmpty(alertForm.cta_label),
      cta_url: trimOrEmpty(alertForm.cta_url),
      pinned: Boolean(alertForm.pinned),
      status: alertForm.status,
      starts_at: coerceDateTimeInput(alertForm.starts_at),
      ends_at: coerceDateTimeInput(alertForm.ends_at),
      delivery_channels: ["in_app", "email"],
    };
    if (!payload.title || !payload.topic_key) {
      setAdminStatus("Alert title and topic are required.");
      return;
    }
    const isEditing = Boolean(editingAlertId);
    const currentAlert = isEditing ? alerts.find((item) => item.id === editingAlertId) : null;
    payload.published_at = payload.status === "published"
      ? (currentAlert?.published_at || new Date().toISOString())
      : null;
    const query = isEditing
      ? supabase.from("municipality_alerts").update(payload).eq("id", editingAlertId)
      : supabase.from("municipality_alerts").insert([payload]);
    const { error } = await query;
    if (error) {
      setAdminStatus(error.message || `Could not ${isEditing ? "update" : "publish"} the alert.`);
      return;
    }
    closeAlertComposer();
    setAdminStatus(isEditing ? "Alert updated." : "Alert saved.");
    await reloadAlerts();
  }

  async function createEvent(event) {
    event.preventDefault();
    setAdminStatus("");
    const payload = {
      tenant_key: tenantKey,
      topic_key: eventForm.topic_key,
      title: trimOrEmpty(eventForm.title),
      summary: trimOrEmpty(eventForm.summary),
      body: trimOrEmpty(eventForm.body),
      location_name: trimOrEmpty(eventForm.location_name),
      location_address: trimOrEmpty(eventForm.location_address),
      cta_label: trimOrEmpty(eventForm.cta_label),
      cta_url: trimOrEmpty(eventForm.cta_url),
      all_day: Boolean(eventForm.all_day),
      status: eventForm.status,
      starts_at: coerceDateTimeInput(eventForm.starts_at),
      ends_at: coerceDateTimeInput(eventForm.ends_at),
      delivery_channels: ["in_app", "email"],
    };
    if (!payload.title || !payload.topic_key || !payload.starts_at) {
      setAdminStatus("Event title, topic, and start time are required.");
      return;
    }
    const isEditing = Boolean(editingEventId);
    const currentEvent = isEditing ? events.find((item) => item.id === editingEventId) : null;
    payload.published_at = payload.status === "published"
      ? (currentEvent?.published_at || new Date().toISOString())
      : null;
    const query = isEditing
      ? supabase.from("municipality_events").update(payload).eq("id", editingEventId)
      : supabase.from("municipality_events").insert([payload]);
    const { error } = await query;
    if (error) {
      setAdminStatus(error.message || `Could not ${isEditing ? "update" : "save"} the event.`);
      return;
    }
    closeEventComposer();
    setAdminStatus(isEditing ? "Event updated." : "Event saved.");
    await reloadEvents();
  }

  async function updateAlertStatus(alert, nextStatus) {
    const { error } = await supabase
      .from("municipality_alerts")
      .update({
        status: nextStatus,
        published_at: nextStatus === "published" && !alert?.published_at ? new Date().toISOString() : alert?.published_at,
      })
      .eq("id", alert.id);
    if (error) {
      setAdminStatus(error.message || "Could not update alert status.");
      return;
    }
    setAlerts((prev) =>
      sortAlerts(prev.map((item) => (item.id === alert.id ? {
        ...item,
        status: nextStatus,
        published_at: nextStatus === "published" && !item?.published_at ? new Date().toISOString() : item?.published_at,
      } : item)))
    );
  }

  async function updateEventStatus(eventRow, nextStatus) {
    const { error } = await supabase
      .from("municipality_events")
      .update({
        status: nextStatus,
        published_at: nextStatus === "published" && !eventRow?.published_at ? new Date().toISOString() : eventRow?.published_at,
      })
      .eq("id", eventRow.id);
    if (error) {
      setAdminStatus(error.message || "Could not update event status.");
      return;
    }
    setEvents((prev) =>
      sortEvents(prev.map((item) => (item.id === eventRow.id ? {
        ...item,
        status: nextStatus,
        published_at: nextStatus === "published" && !item?.published_at ? new Date().toISOString() : item?.published_at,
      } : item)))
    );
  }

  function renderHeader(floating = false) {
    const mobileNavItems = [
      { key: "home", label: "Home", path: "/" },
      { key: "events", label: "Events", path: "/events" },
      { key: "alerts", label: "Alerts", path: "/alerts" },
      { key: "reports", label: "Reports", path: "/reports" },
    ];
    const reportNavItem = { key: "report", label: "Map", path: "/report", primary: true };
    const standardNavItems = navLinks.filter((item) => item.key !== "report");
    const reportDesktopItem = navLinks.find((item) => item.key === "report");

    return (
      <>
        <header className={`municipality-topbar${floating ? " municipality-topbar--floating" : ""}`}>
          <div className="municipality-title-bar">
            <button
              type="button"
              className="municipality-brand"
              onClick={() => navigate("/")}
              aria-label="Return to municipality home"
            >
              <picture>
                <source media="(max-width: 720px)" srcSet={MOBILE_BRAND_LOGO_SRC} />
                <img src={BRAND_LOGO_SRC} alt="CityReport.io" />
              </picture>
            </button>
            <div className="municipality-brand-copy">
              <span className="municipality-brand-eyebrow app-header-eyebrow">Municipality Hub</span>
              <h1>{organizationDisplayName}</h1>
            </div>
            <div className="municipality-account-anchor" onClick={(event) => event.stopPropagation()}>
              {!session?.user?.id ? (
                <button
                  type="button"
                  className="municipality-button municipality-button--ghost"
                  onClick={() => openAuthModal("login")}
                >
                  Login
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="municipality-account-toggle"
                    aria-label="Open account menu"
                    aria-expanded={accountMenuOpen}
                    onClick={() => setAccountMenuOpen((prev) => !prev)}
                  >
                    <span />
                    <span />
                    <span />
                  </button>
                  {accountMenuOpen ? (
                    <div className="municipality-account-menu">
                      <div className="municipality-account-menu-card">
                        <div className="municipality-account-menu-eyebrow">Signed In</div>
                        <div className="municipality-account-menu-name">{accountDisplayName}</div>
                        <div className="municipality-account-menu-role">{accountRoleLabel}</div>
                        {accountEmail ? <div className="municipality-account-menu-email">{accountEmail}</div> : null}
                        <div className="municipality-account-menu-actions">
                          {session?.user?.id && switchableTenants.length ? (
                            <button
                              type="button"
                              className="municipality-nav-menu-item"
                              onClick={() => {
                                setAccountMenuOpen(false);
                                setOpenNavMenu("tenants");
                              }}
                            >
                              Locations
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="municipality-nav-menu-item"
                            onClick={() => {
                              setAccountMenuOpen(false);
                              navigate(SETTINGS_DEFAULT_PAGE);
                            }}
                          >
                            Settings
                          </button>
                          <button
                            type="button"
                            className="municipality-nav-menu-item municipality-account-menu-signout"
                            onClick={() => {
                              setAccountMenuOpen(false);
                              void handleResidentSignOut();
                            }}
                          >
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </header>
        <div className="municipality-tabs-shell">
          <div className="municipality-tabs-bar">
            <nav className="municipality-nav" aria-label="Municipality navigation">
            {standardNavItems.map((item) => {
              const showManageMenu = manageAccess && (item.key === "alerts" || item.key === "events");
              if (!showManageMenu) {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    className={`${item.primary ? "municipality-button municipality-button--primary municipality-nav-link--primary" : "municipality-nav-link"}${item.active ? " is-active" : ""}`}
                    onClick={(event) => {
                      event.preventDefault();
                      navigate(item.path);
                    }}
                  >
                    {item.label}
                  </a>
                );
              }

              const isAlertsMenu = item.key === "alerts";
              const isOpen = openNavMenu === item.key;
              const createLabel = isAlertsMenu ? "Create Alert" : "Create Event";
              const viewLabel = isAlertsMenu ? "View Alerts" : "View Events";
              return (
                <div
                  key={item.key}
                  className="municipality-nav-dropdown"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className={`municipality-nav-link municipality-nav-button${item.active ? " is-active" : ""}`}
                    onClick={() => setOpenNavMenu((prev) => (prev === item.key ? "" : item.key))}
                  >
                    {item.label}
                  </button>
                  {isOpen ? (
                    <div className="municipality-nav-menu">
                      <button
                        type="button"
                        className="municipality-nav-menu-item"
                        onClick={() => {
                          setOpenNavMenu("");
                          navigate(item.path);
                        }}
                      >
                        {viewLabel}
                      </button>
                      <button
                        type="button"
                        className="municipality-nav-menu-item"
                        onClick={() => {
                          setOpenNavMenu("");
                          if (isAlertsMenu) startNewAlert();
                          else startNewEvent();
                          navigate(isAlertsMenu ? "/alerts/create" : "/events/create");
                        }}
                      >
                        {createLabel}
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {session?.user?.id && switchableTenants.length ? (
              null
            ) : null}
            {reportDesktopItem ? (
              <a
                href={reportDesktopItem.href}
                className={`${reportDesktopItem.primary ? "municipality-button municipality-button--primary municipality-nav-link--primary" : "municipality-nav-link"}${reportDesktopItem.active ? " is-active" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(reportDesktopItem.path);
                }}
              >
                {reportDesktopItem.label}
              </a>
            ) : null}
            </nav>
          </div>
        </div>
        <nav
          className="municipality-mobile-nav"
          aria-label="Municipality mobile navigation"
          style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
        >
          {mobileNavItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`municipality-mobile-nav-link${routePath === item.path || (item.path === "/alerts" && routePath.startsWith("/alerts")) || (item.path === "/events" && routePath.startsWith("/events")) || (item.path === "/reports" && routePath.startsWith("/reports")) ? " is-active" : ""}${item.primary ? " municipality-mobile-nav-link--primary" : ""}`}
              onClick={() => navigate(item.path)}
            >
              {item.label}
            </button>
          ))}
          {session?.user?.id && switchableTenants.length ? (
            <button
              type="button"
              className={`municipality-mobile-nav-link${openNavMenu === "tenants" ? " is-active" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                setOpenNavMenu((prev) => (prev === "tenants" ? "" : "tenants"));
              }}
            >
              Locations
            </button>
          ) : null}
          <button
            type="button"
            className={`municipality-mobile-nav-link${reportNavItem.path === routePath ? " is-active" : ""}${reportNavItem.primary ? " municipality-mobile-nav-link--primary" : ""}`}
            onClick={() => navigate(reportNavItem.path)}
          >
            {reportNavItem.label}
          </button>
        </nav>
        {session?.user?.id && switchableTenants.length && openNavMenu === "tenants" ? (
          <div className="municipality-mobile-sheet-backdrop" onClick={() => setOpenNavMenu("")}>
            <div className="municipality-mobile-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="municipality-mobile-sheet-header">
                <strong>Switch Location</strong>
                <button type="button" className="municipality-mobile-sheet-close" onClick={() => setOpenNavMenu("")}>
                  Close
                </button>
              </div>
              <div className="municipality-mobile-sheet-list">
                {switchableTenants.map((city) => {
                  const cityKey = trimOrEmpty(city?.tenant_key).toLowerCase();
                  const targetHref = buildTenantSwitchHref(tenant?.env, city, routePath, session);
                  return (
                    <a
                      key={cityKey}
                      href={targetHref}
                      className="municipality-nav-menu-item municipality-nav-menu-item--link"
                      onClick={() => setOpenNavMenu("")}
                    >
                      {trimOrEmpty(city?.name) || cityKey}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
        {authModalOpen && !session?.user?.id ? (
          <div className="municipality-auth-modal-backdrop" onClick={closeAuthModal}>
            <div className="municipality-auth-modal" onClick={(event) => event.stopPropagation()}>
              <div className="municipality-auth-modal-header">
                <div>
                  <h3>{authMode === "login" ? "Sign In" : "Create Account"}</h3>
                  <p>
                    {authMode === "login"
                      ? "Sign in with your resident account to manage preferences and follow locations."
                      : "Create your resident account to manage notifications and saved location selections."}
                  </p>
                </div>
                <button type="button" className="municipality-auth-modal-close" onClick={closeAuthModal} aria-label="Close sign-in dialog">
                  Close
                </button>
              </div>
              <form className="municipality-auth-panel municipality-auth-panel--modal" onSubmit={handleAuthSubmit} key={`modal-auth-${authMode}`} {...STANDARD_LOGIN_FORM_PROPS}>
                {authMode === "login" ? (
                  <div className="municipality-auth-login-fields">
                    <input
                      id="resident-auth-modal-email"
                      {...STANDARD_LOGIN_EMAIL_INPUT_PROPS}
                      value={authForm.email}
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                    />
                    <div className="municipality-password-row">
                      <input
                        id="resident-auth-modal-password"
                        {...getStandardLoginPasswordInputProps(showAuthPassword)}
                        value={authForm.password}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                      />
                      <button
                        type="button"
                        className="municipality-password-toggle"
                        onClick={() => setShowAuthPassword((prev) => !prev)}
                        aria-label={showAuthPassword ? "Hide password" : "Show password"}
                      >
                        {showAuthPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="municipality-auth-password-toggle-link"
                      onClick={openForgotPasswordModal}
                    >
                      Forgot password?
                    </button>
                  </div>
                ) : (
                  <div className="municipality-form-grid">
                    <div className="municipality-field">
                      <label htmlFor="resident-auth-modal-name">Full name</label>
                      <input
                        id="resident-auth-modal-name"
                        name="name"
                        autoComplete="name"
                        value={authForm.full_name}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, full_name: event.target.value }))}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="municipality-field">
                      <label htmlFor="resident-auth-modal-email-signup">Email</label>
                      <input
                        id="resident-auth-modal-email-signup"
                        name="email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        value={authForm.email}
                        onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="municipality-field">
                      <label htmlFor="resident-auth-modal-password-signup">Password</label>
                      <div className="municipality-password-row">
                        <input
                          id="resident-auth-modal-password-signup"
                          type={showAuthPassword ? "text" : "password"}
                          name="new-password"
                          autoComplete={authPasswordAutoComplete}
                          placeholder="Password"
                          value={authForm.password}
                          onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                        />
                        <button
                          type="button"
                          className="municipality-password-toggle"
                          onClick={() => setShowAuthPassword((prev) => !prev)}
                          aria-label={showAuthPassword ? "Hide password" : "Show password"}
                        >
                          {showAuthPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <div className="municipality-actions">
                  <button type="submit" className="municipality-button municipality-button--primary" disabled={authBusy}>
                    {authBusy ? "Working…" : authMode === "login" ? "Sign In" : "Create Account"}
                  </button>
                  <button type="button" className="municipality-button municipality-button--ghost" onClick={() => setAuthMode((prev) => (prev === "login" ? "signup" : "login"))}>
                    {authMode === "login" ? "Create Account Instead" : "Use Existing Account"}
                  </button>
                </div>
                {authStatus ? <p className={`municipality-inline-status${authStatus.toLowerCase().includes("could not") || authStatus.toLowerCase().includes("required") ? " is-error" : ""}`}>{authStatus}</p> : null}
              </form>
            </div>
          </div>
        ) : null}
        {forgotPasswordOpen && !session?.user?.id ? (
          <div className="municipality-auth-modal-backdrop" onClick={closeForgotPasswordModal}>
            <div className="municipality-auth-modal" onClick={(event) => event.stopPropagation()}>
              <div className="municipality-auth-modal-header">
                <div>
                  <h3>Reset Password</h3>
                  <p>Enter your account email and we&apos;ll send a password reset link.</p>
                </div>
                <button type="button" className="municipality-auth-modal-close" onClick={closeForgotPasswordModal} aria-label="Close password reset dialog">
                  Close
                </button>
              </div>
              <div className="municipality-auth-login-fields">
                <input
                  id="resident-auth-modal-reset-email"
                  {...STANDARD_LOGIN_EMAIL_INPUT_PROPS}
                  value={forgotPasswordEmail}
                  onChange={(event) => setForgotPasswordEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !authResetLoading) {
                      event.preventDefault();
                      void sendPasswordReset();
                    }
                  }}
                />
              </div>
              {forgotPasswordError ? <p className="municipality-inline-status is-error">{forgotPasswordError}</p> : null}
              <div className="municipality-actions">
                <button type="button" className="municipality-button municipality-button--primary" disabled={authResetLoading} onClick={() => void sendPasswordReset()}>
                  {authResetLoading ? "Sending reset…" : "Send Reset Email"}
                </button>
                <button type="button" className="municipality-button municipality-button--ghost" onClick={closeForgotPasswordModal}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (routePath === "/report") {
    return (
      <div className="municipality-shell">
        <div className="municipality-main municipality-main--report">
          <Suspense fallback={<div className="municipality-empty" style={{ margin: 16 }}>Loading reporting workspace…</div>}>
            <MapGoogleFull onBackToHub={() => navigate("/")} />
          </Suspense>
        </div>
      </div>
    );
  }

  const currentPreferenceCount = Object.values(preferencesByTopic || {}).filter((entry) => entry?.in_app_enabled || entry?.email_enabled).length;
  const alertsCreateMode = routePath === "/alerts/create";
  const eventsCreateMode = routePath === "/events/create";
  const settingsRouteActive = String(routePath || "").startsWith("/settings");
  const organizationInfo = organizationProfile || {};
  const organizationGeneralFields = [
    { label: "Organization Name", value: tenantName },
    { label: "Public Display Name", value: trimOrEmpty(organizationInfo.display_name) || tenantName },
    { label: "Email", value: trimOrEmpty(organizationInfo.contact_primary_email) || "Not provided" },
    { label: "Legal Organization Name", value: trimOrEmpty(organizationInfo.legal_name) || "Not provided" },
    { label: "Phone", value: trimOrEmpty(organizationInfo.contact_primary_phone) || "Not provided" },
    { label: "Website", value: trimOrEmpty(organizationInfo.website_url) || "Not provided" },
    {
      label: "Address",
      value: [
        trimOrEmpty(organizationInfo.mailing_address_1),
        trimOrEmpty(organizationInfo.mailing_address_2),
        trimOrEmpty(organizationInfo.mailing_city),
        trimOrEmpty(organizationInfo.mailing_state),
        trimOrEmpty(organizationInfo.mailing_zip),
      ].filter(Boolean).join(", ") || trimOrEmpty(organizationInfo.mailing_address) || "Not provided",
    },
    { label: "Time Zone", value: trimOrEmpty(organizationInfo.timezone) || "America/New_York" },
  ];
  const mapAppearanceFields = [
    { label: "Boundary Border", value: mapAppearance?.show_boundary_border === false ? "Hidden" : "Visible" },
    { label: "Outside Boundary Shade", value: mapAppearance?.shade_outside_boundary === false ? "Off" : "On" },
    { label: "Border Color", value: trimOrEmpty(mapAppearance?.boundary_border_color) || "#e53935" },
    { label: "Border Width", value: `${mapAppearance?.boundary_border_width || 4}px` },
  ];
  const manageableTeamAssignments = teamAssignments.filter((assignment) => {
    const roleKey = trimOrEmpty(assignment?.role);
    const roleRow = roleDefinitionLookup[roleKey];
    return Boolean(roleRow) && (roleRow?.is_system !== true || roleKey === "tenant_employee");
  });
  const groupedAssetFiles = useMemo(() => ({
    logo: assetFiles.filter((row) => trimOrEmpty(row?.file_category).toLowerCase() === "logo"),
    boundary: assetFiles.filter((row) => trimOrEmpty(row?.file_category).toLowerCase() === "boundary_geojson"),
    assetLibrary: assetFiles.filter((row) => isAssetLibraryFile(row)),
    calendar: assetFiles.filter((row) => trimOrEmpty(row?.file_category).toLowerCase() === "calendar_source"),
    contract: assetFiles.filter((row) => trimOrEmpty(row?.file_category).toLowerCase() === "contract"),
    other: assetFiles.filter((row) => {
      const key = trimOrEmpty(row?.file_category).toLowerCase();
      return key && !["logo", "boundary_geojson", "asset", "general_asset", "streetlight_inventory", "calendar_source", "contract"].includes(key);
    }),
  }), [assetFiles]);

  return (
    <div className="municipality-shell">
      {renderHeader(false)}
      <main className="municipality-main">
        {routePath === "/" ? (
          <>
            <section className="municipality-hero municipality-hero--single">
              <div className="municipality-card municipality-hero-copy">
                <h2>Location summary first. Operations tools right behind it.</h2>
                <p>
                  Use the hub to keep up with live alerts, scheduled events, and location-wide activity, then jump into the
                  map workspace when you need to process reports directly.
                </p>
                <div className="municipality-metrics">
                  <button type="button" className="municipality-metric municipality-metric--button" onClick={() => navigate("/alerts")}>
                    <strong>{activeAlertCount(publishedAlerts)}</strong>
                    <span>Active Alerts</span>
                  </button>
                  <button type="button" className="municipality-metric municipality-metric--button" onClick={() => navigate("/events")}>
                    <strong>{upcomingEventCount(publishedEvents)}</strong>
                    <span>Upcoming Events</span>
                  </button>
                  <button type="button" className="municipality-metric municipality-metric--button" onClick={() => navigate("/reports")}>
                    <strong>{publishedAlerts.length + publishedEvents.length}</strong>
                    <span>Domain Overview</span>
                  </button>
                </div>
                <div className="municipality-hero-actions">
                  <button type="button" className="municipality-button municipality-button--primary" onClick={() => navigate("/report")}>
                    Open Map Workspace
                  </button>
                </div>
              </div>
            </section>

            <section className="municipality-section-grid">
              <HomeCard
                title="Current Alerts"
                subtitle="Road work, utility interruptions, service changes, and urgent notices."
                onTitleClick={() => navigate("/alerts")}
              >
                {dataLoading ? <div className="municipality-empty">Loading alerts…</div> : <AlertFeed alerts={homeAlerts} emptyText="No active alerts are published right now." />}
              </HomeCard>
              <HomeCard
                title="Upcoming Events"
                subtitle="Parades, public meetings, sanitation changes, and scheduled maintenance."
                onTitleClick={() => navigate("/events")}
              >
                {dataLoading ? <div className="municipality-empty">Loading events…</div> : <EventFeed events={homeEvents} emptyText="No upcoming events are published yet." />}
              </HomeCard>
            </section>
          </>
        ) : null}

        {(routePath === "/alerts" || routePath === "/alerts/create") ? (
          <HomeCard title="Location Alerts" subtitle="Create, schedule, and review public alerts for this location.">
            <div className="municipality-admin-panel">
              <div className="municipality-actions municipality-actions--toolbar">
                <button
                  type="button"
                  className={`municipality-button${!alertsCreateMode ? " municipality-button--primary" : " municipality-button--ghost"}`}
                  onClick={() => navigate("/alerts")}
                >
                  View Alerts
                </button>
                {manageAccess ? (
                  <button
                    type="button"
                    className={`municipality-button${alertsCreateMode ? " municipality-button--primary" : " municipality-button--ghost"}`}
                    onClick={() => {
                      startNewAlert();
                      navigate("/alerts/create");
                    }}
                  >
                    Create / Schedule
                  </button>
                ) : null}
              </div>
              {manageAccess && alertsCreateMode ? (
                <AlertComposer
                  topicLookup={topicLookup}
                  alertForm={alertForm}
                  setAlertForm={setAlertForm}
                  onSubmit={createAlert}
                  heading={editingAlertId ? "Edit Alert" : "Create Alert"}
                  submitLabel={editingAlertId ? "Update Alert" : "Save Alert"}
                />
              ) : null}
              {adminStatus ? <p className={`municipality-inline-status${adminStatus.toLowerCase().includes("could not") ? " is-error" : ""}`}>{adminStatus}</p> : null}
            </div>
            {dataLoading ? <div className="municipality-empty">Loading alerts…</div> : (
              <AlertFeed
                alerts={manageAccess ? alerts : publishedAlerts}
                emptyText="No alerts have been published yet."
                showStatus={manageAccess}
                onStatusChange={manageAccess ? updateAlertStatus : null}
                onEdit={manageAccess ? (alert) => {
                  startEditAlert(alert);
                  navigate("/alerts/create");
                } : null}
              />
            )}
          </HomeCard>
        ) : null}

        {(routePath === "/events" || routePath === "/events/create") ? (
          <HomeCard title="Location Events" subtitle="Create, schedule, and review public events for this location.">
            <div className="municipality-admin-panel">
              <div className="municipality-actions municipality-actions--toolbar">
                <button
                  type="button"
                  className={`municipality-button${!eventsCreateMode ? " municipality-button--primary" : " municipality-button--ghost"}`}
                  onClick={() => navigate("/events")}
                >
                  View Events
                </button>
                {manageAccess ? (
                  <button
                    type="button"
                    className={`municipality-button${eventsCreateMode ? " municipality-button--primary" : " municipality-button--ghost"}`}
                    onClick={() => {
                      startNewEvent();
                      navigate("/events/create");
                    }}
                  >
                    Create / Schedule
                  </button>
                ) : null}
                <button
                  type="button"
                  className="municipality-button municipality-button--ghost"
                  onClick={() => {
                    if (!publishedEvents.length) return;
                    downloadTextFile(
                      `${tenantKey || "location"}-events.ics`,
                      buildIcsFile(publishedEvents, organizationDisplayName),
                      "text/calendar;charset=utf-8"
                    );
                  }}
                >
                  Download Calendar (.ics)
                </button>
              </div>
              {manageAccess && eventsCreateMode ? (
                <EventComposer
                  topicLookup={topicLookup}
                  eventForm={eventForm}
                  setEventForm={setEventForm}
                  onSubmit={createEvent}
                  heading={editingEventId ? "Edit Event" : "Create Event"}
                  submitLabel={editingEventId ? "Update Event" : "Save Event"}
                />
              ) : null}
              {adminStatus ? <p className={`municipality-inline-status${adminStatus.toLowerCase().includes("could not") ? " is-error" : ""}`}>{adminStatus}</p> : null}
            </div>
            {dataLoading ? <div className="municipality-empty">Loading events…</div> : (
              <EventFeed
                events={manageAccess ? events : publishedEvents}
                emptyText="No events have been published yet."
                showStatus={manageAccess}
                onStatusChange={manageAccess ? updateEventStatus : null}
                onEdit={manageAccess ? (eventRow) => {
                  startEditEvent(eventRow);
                  navigate("/events/create");
                } : null}
              />
            )}
          </HomeCard>
        ) : null}

        {routePath === "/reports" ? (
          <HomeCard title="Domain Reports" subtitle="Review domain activity for this location and export what your team needs.">
            <div className="municipality-admin-panel">
              <div className="municipality-detail-grid">
                <div className="municipality-detail-item">
                  <span>Published Alerts</span>
                  <strong>{publishedAlerts.length}</strong>
                </div>
                <div className="municipality-detail-item">
                  <span>Published Events</span>
                  <strong>{publishedEvents.length}</strong>
                </div>
                <div className="municipality-detail-item">
                  <span>Enabled Topics</span>
                  <strong>{topics.length}</strong>
                </div>
                <div className="municipality-detail-item">
                  <span>Resident Preferences</span>
                  <strong>{session?.user?.id ? currentPreferenceCount : 0}</strong>
                </div>
              </div>
              <div className="municipality-actions">
                <button type="button" className="municipality-button municipality-button--primary" onClick={downloadActivityExport}>
                  Export Activity CSV
                </button>
                {manageAccess ? (
                  <button type="button" className="municipality-button municipality-button--ghost" onClick={downloadRoleAccessExport}>
                    Export Role Matrix
                  </button>
                ) : null}
                <button type="button" className="municipality-button municipality-button--ghost" onClick={() => navigate("/report")}>
                  Open Map
                </button>
              </div>
              <p className="municipality-note">This reports view mirrors the location activity summary side of the map reports flow while keeping exports and overview metrics in one place.</p>
            </div>
          </HomeCard>
        ) : null}

        {settingsRouteActive ? (
          <section>
            <HomeCard title="Settings" subtitle="Manage your account, organization details, team access, and map presentation from one place.">
              {!session?.user?.id ? (
                <div className="municipality-auth-cta">
                  <h4>Sign in to open settings</h4>
                  <p className="municipality-note">Use the location login to manage account details, locations, and organization tools.</p>
                  <div className="municipality-actions">
                    <button type="button" className="municipality-button municipality-button--primary" onClick={() => openAuthModal("login")}>
                      Sign In
                    </button>
                    <button type="button" className="municipality-button municipality-button--ghost" onClick={() => openAuthModal("signup")}>
                      Create Account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="municipality-settings-layout">
                  <aside className="municipality-settings-sidebar">
                    <div className="municipality-settings-sidebar-shell">
                      <div className="municipality-settings-sidebar-header">
                        <h3>Settings</h3>
                        <p>Browse account, organization, team, and map categories.</p>
                      </div>
                      <div className="municipality-settings-search">
                        <input
                          type="search"
                          value={settingsSearchQuery}
                          onChange={(event) => setSettingsSearchQuery(event.target.value)}
                          placeholder="Search settings"
                          aria-label="Search settings"
                        />
                      </div>
                      <div className="municipality-settings-sidebar-groups">
                        {filteredSettingsNav.map((category) => {
                          const isExpanded = trimOrEmpty(settingsSearchQuery) ? true : Boolean(openSettingsGroups[category.key]);
                          return (
                            <div key={category.key} className="municipality-settings-group">
                              <button
                                type="button"
                                className={`municipality-settings-group-toggle${activeSettingsCategoryKey === category.key ? " is-active" : ""}`}
                                onClick={() => setOpenSettingsGroups((prev) => ({ ...prev, [category.key]: !prev[category.key] }))}
                              >
                                <span>{category.label}</span>
                                <span className="municipality-settings-group-caret">{isExpanded ? "v" : ">"}</span>
                              </button>
                              {isExpanded ? (
                                <div className="municipality-settings-group-items">
                                  {category.items.map((item) => (
                                    <button
                                      key={item.key}
                                      type="button"
                                      className={`municipality-settings-link${activeSettingsItemKey === item.key ? " is-active" : ""}`}
                                      onClick={() => navigate(item.path)}
                                    >
                                      {item.label}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        {!filteredSettingsNav.length ? (
                          <div className="municipality-settings-sidebar-empty">No settings matched your search.</div>
                        ) : null}
                      </div>
                    </div>
                  </aside>

                  <div className="municipality-settings-content">
                    {settingsStatus ? <p className="municipality-inline-status">{settingsStatus}</p> : null}
                    {settingsLoading ? <p className="municipality-inline-status">Loading location settings…</p> : null}

                    {activeSettingsItemKey === "account-info" ? (
                      <div className="municipality-topic-row">
                        <div className="municipality-account-card municipality-account-card--section">
                          <div className="municipality-settings-header">
                            <div>
                              <h4>Account Info</h4>
                              <p className="municipality-note">Review your account details and update your name or phone when needed.</p>
                            </div>
                            {accountSectionEdit.profile ? (
                              <div className="municipality-actions">
                                <button
                                  type="button"
                                  className="municipality-button municipality-button--ghost"
                                  onClick={() => {
                                    setAccountProfileDraft({
                                      full_name: trimOrEmpty(profile?.full_name) || trimOrEmpty(session?.user?.user_metadata?.full_name),
                                      phone: trimOrEmpty(profile?.phone) || trimOrEmpty(session?.user?.user_metadata?.phone),
                                      email: trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email),
                                    });
                                    setSectionEditing("profile", false);
                                  }}
                                >
                                  Cancel
                                </button>
                                <button type="button" className="municipality-button municipality-button--primary" onClick={() => void saveAccountProfile()} disabled={savingSection.profile || loadingProfile || !authReady}>
                                  {savingSection.profile ? "Saving…" : "Save"}
                                </button>
                              </div>
                            ) : (
                              <button type="button" className="municipality-button municipality-button--ghost" onClick={() => setSectionEditing("profile", true)}>
                                Edit
                              </button>
                            )}
                          </div>
                          {accountSectionEdit.profile ? (
                            <div className="municipality-form-grid">
                              <div className="municipality-field">
                                <label htmlFor="account-full-name">Name</label>
                                <input id="account-full-name" value={accountProfileDraft.full_name} onChange={(event) => setAccountProfileDraft((prev) => ({ ...prev, full_name: event.target.value }))} />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="account-email-readonly">Email</label>
                                <input id="account-email-readonly" value={trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email)} readOnly />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="account-phone">Phone</label>
                                <input id="account-phone" value={accountProfileDraft.phone} onChange={(event) => setAccountProfileDraft((prev) => ({ ...prev, phone: event.target.value }))} placeholder="(000) 000-0000" />
                              </div>
                            </div>
                          ) : (
                            <div className="municipality-detail-grid">
                              <div className="municipality-detail-item">
                                <span>Name</span>
                                <strong>{trimOrEmpty(profile?.full_name) || trimOrEmpty(session?.user?.user_metadata?.full_name) || "Not provided"}</strong>
                              </div>
                              <div className="municipality-detail-item">
                                <span>Email</span>
                                <strong>{trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email) || "Email unavailable"}</strong>
                              </div>
                              <div className="municipality-detail-item">
                                <span>Phone</span>
                                <strong>{trimOrEmpty(profile?.phone) || trimOrEmpty(session?.user?.user_metadata?.phone) || "Not provided"}</strong>
                              </div>
                              <div className="municipality-detail-item">
                                <span>PIN</span>
                                <strong>Security checkpoint setup coming next</strong>
                              </div>
                            </div>
                          )}
                          {accountSectionStatus.profile ? <p className={`municipality-inline-status${accountSectionStatus.profile.toLowerCase().includes("could not") || accountSectionStatus.profile.toLowerCase().includes("please") ? " is-error" : ""}`}>{accountSectionStatus.profile}</p> : null}
                        </div>

                        <div className="municipality-account-card municipality-account-card--section">
                          <div className="municipality-settings-header">
                            <div>
                              <h4>Locations</h4>
                              <p className="municipality-note">Choose which locations appear in your switcher.</p>
                            </div>
                            {accountSectionEdit.cities ? (
                              <div className="municipality-actions">
                                <button
                                  type="button"
                                  className="municipality-button municipality-button--ghost"
                                  onClick={() => {
                                    setInterestedTenantKeys(savedInterestedTenantKeys);
                                    setCitySearchQuery("");
                                    setSectionEditing("cities", false);
                                  }}
                                >
                                  Cancel
                                </button>
                                <button type="button" className="municipality-button municipality-button--primary" onClick={() => void saveInterestedCities()} disabled={savingSection.cities}>
                                  {savingSection.cities ? "Saving…" : "Save"}
                                </button>
                              </div>
                            ) : (
                              <button type="button" className="municipality-button municipality-button--ghost" onClick={() => setSectionEditing("cities", true)}>
                                Edit
                              </button>
                            )}
                          </div>
                          {accountSectionEdit.cities ? (
                            <>
                              <div className="municipality-field">
                                <label htmlFor="city-search">Search locations</label>
                                <input id="city-search" value={citySearchQuery} onChange={(event) => setCitySearchQuery(event.target.value)} placeholder="Search by location name or cityreport key" />
                              </div>
                              {(switchableTenants.length ? switchableTenants : availableHubTenants.filter((city) => interestedTenantKeys.includes(trimOrEmpty(city?.tenant_key).toLowerCase()))).length ? (
                                <div className="municipality-detail-grid">
                                  {(switchableTenants.length ? switchableTenants : availableHubTenants.filter((city) => interestedTenantKeys.includes(trimOrEmpty(city?.tenant_key).toLowerCase()))).map((city) => (
                                    <div key={trimOrEmpty(city?.tenant_key)} className="municipality-detail-item">
                                      <span>Following</span>
                                      <strong>{trimOrEmpty(city?.name) || trimOrEmpty(city?.tenant_key)}</strong>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="municipality-note">You are not following any locations yet.</p>
                              )}
                              {trimOrEmpty(citySearchQuery) ? searchedTenants.length ? (
                                <div className="municipality-topic-row" style={{ marginTop: 12 }}>
                                  {searchedTenants.map((city) => {
                                    const cityKey = trimOrEmpty(city?.tenant_key).toLowerCase();
                                    const checked = interestedTenantKeys.includes(cityKey);
                                    return (
                                      <label key={cityKey} className="municipality-checkbox">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(event) => updateTenantInterest(cityKey, event.target.checked)}
                                        />
                                        {trimOrEmpty(city?.name) || cityKey}
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="municipality-note" style={{ marginTop: 12 }}>
                                  No locations matched that search yet.
                                </p>
                              ) : (
                                <p className="municipality-note" style={{ marginTop: 12 }}>
                                  Search for a location to add it to your list.
                                </p>
                              )}
                            </>
                          ) : (
                            (switchableTenants.length ? switchableTenants : availableHubTenants.filter((city) => interestedTenantKeys.includes(trimOrEmpty(city?.tenant_key).toLowerCase()))).length ? (
                              <div className="municipality-detail-grid">
                                {(switchableTenants.length ? switchableTenants : availableHubTenants.filter((city) => interestedTenantKeys.includes(trimOrEmpty(city?.tenant_key).toLowerCase()))).map((city) => (
                                  <div key={trimOrEmpty(city?.tenant_key)} className="municipality-detail-item">
                                    <span>Following</span>
                                    <strong>{trimOrEmpty(city?.name) || trimOrEmpty(city?.tenant_key)}</strong>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="municipality-note">Search for locations to build your followed list.</p>
                            )
                          )}
                          {accountSectionStatus.cities ? <p className={`municipality-inline-status${accountSectionStatus.cities.toLowerCase().includes("could not") ? " is-error" : ""}`}>{accountSectionStatus.cities}</p> : null}
                        </div>
                      </div>
                    ) : null}

                    {activeSettingsItemKey === "account-notifications" ? (
                      <div className="municipality-account-card municipality-account-card--section">
                        <div className="municipality-settings-header">
                          <div>
                            <h4>Notification Preferences</h4>
                            <p className="municipality-note">Manage all update categories in one place. In-app and email are live now; web push is next.</p>
                          </div>
                          {accountSectionEdit.notifications ? (
                            <div className="municipality-actions">
                              <button
                                type="button"
                                className="municipality-button municipality-button--ghost"
                                onClick={() => {
                                  setPreferencesByTopic(savedPreferencesByTopic);
                                  setSectionEditing("notifications", false);
                                }}
                              >
                                Cancel
                              </button>
                              <button type="button" className="municipality-button municipality-button--primary" onClick={() => void saveNotificationPreferences()} disabled={savingSection.notifications}>
                                {savingSection.notifications ? "Saving…" : "Save"}
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="municipality-button municipality-button--ghost" onClick={() => setSectionEditing("notifications", true)}>
                              Edit
                            </button>
                          )}
                        </div>
                        <div className="municipality-topic-row municipality-topic-row--stacked">
                          {Object.values(topicLookup).map((topic) => {
                            const current = preferencesByTopic?.[topic.topic_key] || {
                              in_app_enabled: Boolean(topic.default_enabled),
                              email_enabled: false,
                              web_push_enabled: false,
                            };
                            return (
                              <article key={topic.topic_key} className="municipality-topic-card municipality-topic-card--row">
                                <div className="municipality-topic-copy">
                                  <h4>{topic.label}</h4>
                                  <p className="municipality-note">{topic.description}</p>
                                </div>
                                <div className={`municipality-checkbox-row${accountSectionEdit.notifications ? "" : " municipality-checkbox-row--readonly"}`} style={{ marginTop: 12 }}>
                                  <label className="municipality-checkbox">
                                    <input type="checkbox" checked={Boolean(current.in_app_enabled)} disabled={!accountSectionEdit.notifications} readOnly={!accountSectionEdit.notifications} onChange={(event) => updatePreferenceDraft(topic.topic_key, "in_app_enabled", event.target.checked)} />
                                    In-app
                                  </label>
                                  <label className="municipality-checkbox">
                                    <input type="checkbox" checked={Boolean(current.email_enabled)} disabled={!accountSectionEdit.notifications} readOnly={!accountSectionEdit.notifications} onChange={(event) => updatePreferenceDraft(topic.topic_key, "email_enabled", event.target.checked)} />
                                    Email
                                  </label>
                                  <label className="municipality-checkbox">
                                    <input type="checkbox" checked={Boolean(current.web_push_enabled)} disabled readOnly />
                                    Web push (next)
                                  </label>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                        {accountSectionStatus.notifications ? <p className={`municipality-inline-status${accountSectionStatus.notifications.toLowerCase().includes("could not") ? " is-error" : ""}`}>{accountSectionStatus.notifications}</p> : null}
                      </div>
                    ) : null}

                    {activeSettingsItemKey === "update-password" ? (
                      <div className="municipality-account-card municipality-account-card--section">
                        <div className="municipality-settings-header">
                          <div>
                            <h4>Update Password</h4>
                            <p className="municipality-note">Change your email with verification, or update your password from this section.</p>
                          </div>
                          {accountSectionEdit.security ? (
                            <div className="municipality-actions">
                              <button
                                type="button"
                                className="municipality-button municipality-button--ghost"
                                onClick={() => {
                                  setSecurityDraft({
                                    next_email: trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email),
                                    current_password: "",
                                    new_password: "",
                                    confirm_password: "",
                                  });
                                  setSectionEditing("security", false);
                                }}
                              >
                                Cancel
                              </button>
                              <button type="button" className="municipality-button municipality-button--primary" onClick={() => void saveSecuritySettings()} disabled={savingSection.security}>
                                {savingSection.security ? "Saving…" : "Save"}
                              </button>
                            </div>
                          ) : (
                            <button type="button" className="municipality-button municipality-button--ghost" onClick={() => setSectionEditing("security", true)}>
                              Edit
                            </button>
                          )}
                        </div>
                        {accountSectionEdit.security ? (
                          <div className="municipality-form-grid">
                            <div className="municipality-field">
                              <label htmlFor="next-email">New email address</label>
                              <input id="next-email" type="email" value={securityDraft.next_email} onChange={(event) => setSecurityDraft((prev) => ({ ...prev, next_email: event.target.value }))} />
                              <p className="municipality-note">If you change this, we will send a verification message before the new email becomes active.</p>
                            </div>
                            <div className="municipality-field">
                              <label htmlFor="current-password">Current password</label>
                              <input id="current-password" type="password" value={securityDraft.current_password} onChange={(event) => setSecurityDraft((prev) => ({ ...prev, current_password: event.target.value }))} />
                            </div>
                            <div className="municipality-field">
                              <label htmlFor="new-password">New password</label>
                              <input id="new-password" type="password" value={securityDraft.new_password} onChange={(event) => setSecurityDraft((prev) => ({ ...prev, new_password: event.target.value }))} placeholder="Leave blank to keep your current password" />
                            </div>
                            <div className="municipality-field">
                              <label htmlFor="confirm-password">Confirm new password</label>
                              <input id="confirm-password" type="password" value={securityDraft.confirm_password} onChange={(event) => setSecurityDraft((prev) => ({ ...prev, confirm_password: event.target.value }))} />
                            </div>
                          </div>
                        ) : (
                          <div className="municipality-detail-grid">
                            <div className="municipality-detail-item">
                              <span>Current email</span>
                              <strong>{trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email) || "Email unavailable"}</strong>
                            </div>
                            <div className="municipality-detail-item">
                              <span>Password</span>
                              <strong>Managed securely</strong>
                            </div>
                            <div className="municipality-detail-item">
                              <span>PIN Checkpoint</span>
                              <strong>Password challenge required when PIN management is introduced.</strong>
                            </div>
                          </div>
                        )}
                        {accountSectionStatus.security ? <p className={`municipality-inline-status${accountSectionStatus.security.toLowerCase().includes("could not") || accountSectionStatus.security.toLowerCase().includes("enter your current password") || accountSectionStatus.security.toLowerCase().includes("use 8+") ? " is-error" : ""}`}>{accountSectionStatus.security}</p> : null}
                      </div>
                    ) : null}

                    {activeSettingsItemKey === "organization-general" ? (
                      !manageAccess ? (
                        <div className="municipality-auth-cta">
                          <h4>Organization information is limited to location staff</h4>
                          <p className="municipality-note">This page is reserved for the tenant owner and permitted location staff.</p>
                        </div>
                      ) : (
                        <div className="municipality-account-card municipality-account-card--section">
                          <div className="municipality-settings-header">
                            <div>
                              <h4>General Settings</h4>
                              <p className="municipality-note">These are the organization fields already collected for this location.</p>
                            </div>
                            {settingsSectionEdit.organization ? (
                              <div className="municipality-actions">
                                <button
                                  type="button"
                                  className="municipality-button municipality-button--ghost"
                                  onClick={() => {
                                    setOrganizationProfileDraft(buildOrganizationProfileDraft(organizationProfile, tenantName));
                                    setSettingsSectionEdit((prev) => ({ ...prev, organization: false }));
                                    setSettingsSectionStatus((prev) => ({ ...prev, organization: "" }));
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="municipality-button municipality-button--primary"
                                  onClick={() => void saveOrganizationGeneralSettings()}
                                  disabled={settingsSectionSaving.organization}
                                >
                                  {settingsSectionSaving.organization ? "Saving…" : "Save"}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="municipality-button municipality-button--ghost"
                                onClick={() => {
                                  setOrganizationProfileDraft(buildOrganizationProfileDraft(organizationProfile, tenantName));
                                  setSettingsSectionEdit((prev) => ({ ...prev, organization: true }));
                                  setSettingsSectionStatus((prev) => ({ ...prev, organization: "" }));
                                }}
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          {settingsSectionStatus.organization ? <p className={`municipality-inline-status${settingsSectionStatus.organization.toLowerCase().includes("could not") || settingsSectionStatus.organization.toLowerCase().includes("enter") ? " is-error" : ""}`}>{settingsSectionStatus.organization}</p> : null}
                          {settingsSectionEdit.organization ? (
                            <div className="municipality-form-grid">
                              <div className="municipality-field">
                                <label htmlFor="organization-name-readonly">Organization Name</label>
                                <input
                                  id="organization-name-readonly"
                                  value={tenantName}
                                  readOnly
                                  style={{ background: "#eef4fb", cursor: "not-allowed" }}
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-display-name">Public Display Name</label>
                                <input
                                  id="organization-display-name"
                                  value={organizationProfileDraft.display_name}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, display_name: event.target.value }))}
                                />
                                <small>Preferred outward-facing label. Falls back to Organization Name when blank.</small>
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-email">Email</label>
                                <input
                                  id="organization-email"
                                  type="email"
                                  value={organizationProfileDraft.contact_primary_email}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, contact_primary_email: event.target.value }))}
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-legal-name">Legal Organization Name</label>
                                <input
                                  id="organization-legal-name"
                                  value={organizationProfileDraft.legal_name}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, legal_name: event.target.value }))}
                                />
                                <small>Formal entity name used for contracts, billing, and official records.</small>
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-phone">Phone</label>
                                <input
                                  id="organization-phone"
                                  value={organizationProfileDraft.contact_primary_phone}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, contact_primary_phone: event.target.value }))}
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-website">Website</label>
                                <input
                                  id="organization-website"
                                  type="url"
                                  value={organizationProfileDraft.website_url}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, website_url: event.target.value }))}
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-timezone">Time Zone</label>
                                <input
                                  id="organization-timezone"
                                  value={organizationProfileDraft.timezone}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, timezone: event.target.value }))}
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-address-1">Address Line 1</label>
                                <input
                                  id="organization-address-1"
                                  value={organizationProfileDraft.mailing_address_1}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, mailing_address_1: event.target.value }))}
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-address-2">Address Line 2</label>
                                <input
                                  id="organization-address-2"
                                  value={organizationProfileDraft.mailing_address_2}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, mailing_address_2: event.target.value }))}
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-city">City</label>
                                <input
                                  id="organization-city"
                                  value={organizationProfileDraft.mailing_city}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, mailing_city: event.target.value }))}
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-state">State</label>
                                <input
                                  id="organization-state"
                                  value={organizationProfileDraft.mailing_state}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, mailing_state: event.target.value }))}
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="organization-zip">ZIP</label>
                                <input
                                  id="organization-zip"
                                  value={organizationProfileDraft.mailing_zip}
                                  onChange={(event) => setOrganizationProfileDraft((prev) => ({ ...prev, mailing_zip: event.target.value }))}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="municipality-detail-grid">
                              {organizationGeneralFields.map((field) => (
                                <div key={field.label} className="municipality-detail-item">
                                  <span>{field.label}</span>
                                  <strong>{field.value}</strong>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    ) : null}

                    {activeSettingsItemKey === "organization-assets" ? (
                      !manageAccess ? (
                        <div className="municipality-auth-cta">
                          <h4>Assets are limited to location staff</h4>
                          <p className="municipality-note">Asset management is reserved for the tenant owner and permitted location staff.</p>
                        </div>
                      ) : (
                        <div className="municipality-account-card municipality-account-card--section">
                          <div className="municipality-settings-header">
                            <div>
                              <h4>Assets</h4>
                              <p className="municipality-note">Review the current location asset library first, then add new files as needed.</p>
                            </div>
                            {settingsSectionEdit.assets ? (
                              <button
                                type="button"
                                className="municipality-button municipality-button--ghost"
                                onClick={() => {
                                  setAssetUploadDraft({ category: "asset", asset_subtype: "", asset_owner_type: "organization_owned", notes: "", file: null });
                                  setSettingsSectionEdit((prev) => ({ ...prev, assets: false }));
                                  setSettingsSectionStatus((prev) => ({ ...prev, assets: "" }));
                                }}
                              >
                                Back
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="municipality-button municipality-button--primary"
                                onClick={() => {
                                  setSettingsSectionEdit((prev) => ({ ...prev, assets: true }));
                                  setSettingsSectionStatus((prev) => ({ ...prev, assets: "" }));
                                }}
                              >
                                Add New Asset
                              </button>
                            )}
                          </div>
                          {settingsSectionStatus.assets ? <p className={`municipality-inline-status${settingsSectionStatus.assets.toLowerCase().includes("could not") || settingsSectionStatus.assets.toLowerCase().includes("choose") ? " is-error" : ""}`}>{settingsSectionStatus.assets}</p> : null}
                          {settingsSectionEdit.assets ? (
                            <div className="municipality-asset-form-shell">
                              <form className="municipality-form-grid municipality-form-grid--asset" onSubmit={uploadAssetFile}>
                                <div className="municipality-field">
                                  <label htmlFor="asset-category">Category</label>
                                  <select
                                    id="asset-category"
                                    value={assetUploadDraft.category}
                                    onChange={(event) => setAssetUploadDraft((prev) => ({
                                      ...prev,
                                      category: event.target.value,
                                      asset_subtype: event.target.value === "asset" ? prev.asset_subtype : "",
                                      asset_owner_type: event.target.value === "asset" ? prev.asset_owner_type : "organization_owned",
                                    }))}
                                  >
                                    {LOCATION_ASSET_CATEGORIES.map((category) => (
                                      <option key={category.key} value={category.key}>{category.label}</option>
                                    ))}
                                  </select>
                                </div>
                                {assetUploadDraft.category === "asset" ? (
                                  <>
                                    <div className="municipality-field">
                                      <label htmlFor="asset-subtype">Asset Subcategory</label>
                                      <input
                                        id="asset-subtype"
                                        value={assetUploadDraft.asset_subtype}
                                        onChange={(event) => setAssetUploadDraft((prev) => ({ ...prev, asset_subtype: event.target.value }))}
                                        placeholder="Streetlights, fire hydrants, benches…"
                                      />
                                    </div>
                                    <div className="municipality-field">
                                      <label htmlFor="asset-owner-type">Asset Ownership</label>
                                      <select
                                        id="asset-owner-type"
                                        value={assetUploadDraft.asset_owner_type}
                                        onChange={(event) => setAssetUploadDraft((prev) => ({ ...prev, asset_owner_type: event.target.value }))}
                                      >
                                        {LOCATION_ASSET_OWNERSHIP_OPTIONS.map((option) => (
                                          <option key={option.key} value={option.key}>{option.label}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </>
                                ) : null}
                                <div className="municipality-field">
                                  <label htmlFor="asset-notes">Notes</label>
                                  <input
                                    id="asset-notes"
                                    value={assetUploadDraft.notes}
                                    onChange={(event) => setAssetUploadDraft((prev) => ({ ...prev, notes: event.target.value }))}
                                    placeholder="What is this file for?"
                                  />
                                </div>
                                <div className="municipality-field municipality-field--file">
                                  <label htmlFor="asset-file">Select File</label>
                                  <input
                                    id="asset-file"
                                    type="file"
                                    onChange={(event) => setAssetUploadDraft((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
                                  />
                                  {assetUploadDraft.file ? (
                                    <p className="municipality-note">{assetUploadDraft.file.name} • {formatBytes(assetUploadDraft.file.size)}</p>
                                  ) : null}
                                </div>
                                <div className="municipality-actions">
                                  <button type="submit" className="municipality-button municipality-button--primary" disabled={settingsSectionSaving.assets}>
                                    {settingsSectionSaving.assets ? "Uploading…" : "Save Asset"}
                                  </button>
                                </div>
                              </form>
                            </div>
                          ) : null}
                          <div className="municipality-settings-list">
                            {assetLibrary.map((asset) => {
                              let matchingFiles = [];
                              if (asset.key === "location-logo") matchingFiles = groupedAssetFiles.logo;
                              else if (asset.key === "boundary-config") matchingFiles = groupedAssetFiles.boundary;
                              else if (asset.key === "asset-library") matchingFiles = groupedAssetFiles.assetLibrary;
                              else if (asset.key === "calendar-feed") matchingFiles = groupedAssetFiles.calendar;
                              return (
                                <div key={asset.key} className="municipality-settings-list-item municipality-settings-list-item--stacked">
                                  <div className="municipality-settings-item-actions-row">
                                    <div>
                                      <strong>{asset.label}</strong>
                                      <p className="municipality-note">{asset.description}</p>
                                    </div>
                                    <span className="municipality-chip">{asset.status}</span>
                                  </div>
                                  {matchingFiles.length ? (
                                    <div className="municipality-settings-sublist">
                                      {matchingFiles.map((fileRow) => (
                                        <div key={fileRow.id} className="municipality-settings-sublist-item">
                                          <div>
                                            <strong>{trimOrEmpty(fileRow.file_name) || "Unnamed file"}</strong>
                                            <p className="municipality-note">
                                              {summarizeAssetCategory(fileRow.file_category)}
                                              {trimOrEmpty(fileRow.asset_subtype) ? ` • ${trimOrEmpty(fileRow.asset_subtype)}` : ""}
                                              {trimOrEmpty(fileRow.asset_owner_type) ? ` • ${summarizeAssetOwnership(fileRow.asset_owner_type)}` : ""}
                                              {" • "}
                                              {formatBytes(fileRow.size_bytes)}
                                              {" • "}
                                              {fileRow.uploaded_at ? formatDateTime(fileRow.uploaded_at) : "Upload date unavailable"}
                                            </p>
                                            {trimOrEmpty(fileRow.notes) ? <p className="municipality-note">{trimOrEmpty(fileRow.notes)}</p> : null}
                                          </div>
                                          <div className="municipality-actions municipality-actions--compact">
                                            <button
                                              type="button"
                                              className="municipality-button municipality-button--ghost"
                                              onClick={() => void openAssetFile(fileRow)}
                                            >
                                              Open
                                            </button>
                                            <button
                                              type="button"
                                              className="municipality-button municipality-button--ghost municipality-button--danger"
                                              onClick={() => void removeAssetFile(fileRow)}
                                              disabled={settingsSectionSaving.assets}
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="municipality-note">No files are currently attached under this category.</p>
                                  )}
                                </div>
                              );
                            })}
                            {groupedAssetFiles.contract.length ? (
                              <div className="municipality-settings-list-item municipality-settings-list-item--stacked">
                                <div className="municipality-settings-item-actions-row">
                                  <div>
                                    <strong>Contracts</strong>
                                    <p className="municipality-note">Agreement and contract files attached to this location.</p>
                                  </div>
                                  <span className="municipality-chip">Loaded</span>
                                </div>
                                <div className="municipality-settings-sublist">
                                  {groupedAssetFiles.contract.map((fileRow) => (
                                    <div key={fileRow.id} className="municipality-settings-sublist-item">
                                      <div>
                                        <strong>{trimOrEmpty(fileRow.file_name) || "Unnamed file"}</strong>
                                        <p className="municipality-note">
                                          {formatBytes(fileRow.size_bytes)}
                                          {" • "}
                                          {fileRow.uploaded_at ? formatDateTime(fileRow.uploaded_at) : "Upload date unavailable"}
                                        </p>
                                      </div>
                                      <div className="municipality-actions municipality-actions--compact">
                                        <button type="button" className="municipality-button municipality-button--ghost" onClick={() => void openAssetFile(fileRow)}>Open</button>
                                        <button type="button" className="municipality-button municipality-button--ghost municipality-button--danger" onClick={() => void removeAssetFile(fileRow)} disabled={settingsSectionSaving.assets}>Remove</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {groupedAssetFiles.other.length ? (
                              <div className="municipality-settings-list-item municipality-settings-list-item--stacked">
                                <div className="municipality-settings-item-actions-row">
                                  <div>
                                    <strong>Other Files</strong>
                                    <p className="municipality-note">Additional files that do not fall into the main current asset categories.</p>
                                  </div>
                                  <span className="municipality-chip">Loaded</span>
                                </div>
                                <div className="municipality-settings-sublist">
                                  {groupedAssetFiles.other.map((fileRow) => (
                                    <div key={fileRow.id} className="municipality-settings-sublist-item">
                                      <div>
                                        <strong>{trimOrEmpty(fileRow.file_name) || "Unnamed file"}</strong>
                                        <p className="municipality-note">
                                          {summarizeAssetCategory(fileRow.file_category)}
                                          {" • "}
                                          {formatBytes(fileRow.size_bytes)}
                                          {" • "}
                                          {fileRow.uploaded_at ? formatDateTime(fileRow.uploaded_at) : "Upload date unavailable"}
                                        </p>
                                      </div>
                                      <div className="municipality-actions municipality-actions--compact">
                                        <button type="button" className="municipality-button municipality-button--ghost" onClick={() => void openAssetFile(fileRow)}>Open</button>
                                        <button type="button" className="municipality-button municipality-button--ghost municipality-button--danger" onClick={() => void removeAssetFile(fileRow)} disabled={settingsSectionSaving.assets}>Remove</button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                          {!assetFiles.length ? (
                            <div className="municipality-empty">No uploaded asset files are attached to this location yet.</div>
                          ) : null}
                        </div>
                      )
                    ) : null}

                    {activeSettingsItemKey === "calendar" ? (
                      !manageAccess ? (
                        <div className="municipality-auth-cta">
                          <h4>Calendar controls are limited to location staff</h4>
                          <p className="municipality-note">Calendar sync and export tools are reserved for the tenant owner and permitted location staff.</p>
                        </div>
                      ) : (
                        <div className="municipality-account-card municipality-account-card--section">
                          <div className="municipality-settings-header">
                            <div>
                              <h4>Calendar</h4>
                              <p className="municipality-note">Download the live location calendar and review which event sources are currently driving the public schedule.</p>
                            </div>
                            <div className="municipality-actions">
                              <button type="button" className="municipality-button municipality-button--primary" onClick={downloadLocationCalendar}>
                                Download Calendar (.ics)
                              </button>
                              <button type="button" className="municipality-button municipality-button--ghost" onClick={() => navigate("/events")}>
                                Open Events
                              </button>
                            </div>
                          </div>
                          {settingsSectionStatus.calendar ? <p className="municipality-inline-status">{settingsSectionStatus.calendar}</p> : null}
                          <div className="municipality-detail-grid">
                            <div className="municipality-detail-item">
                              <span>Published Events</span>
                              <strong>{publishedEvents.length}</strong>
                            </div>
                            {Object.entries(eventSourceSummary).map(([sourceKey, count]) => (
                              <div key={sourceKey} className="municipality-detail-item">
                                <span>{summarizeSourceLabel(sourceKey)}</span>
                                <strong>{count}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ) : null}

                    {activeSettingsItemKey === "manage-employees" ? (
                      !session?.user?.id ? (
                        <div className="municipality-auth-cta">
                          <h4>Team access is limited to location staff</h4>
                          <p className="municipality-note">Sign in with a location-staff account to manage employee access.</p>
                        </div>
                      ) : (
                        <div className="municipality-account-card municipality-account-card--section">
                          <div className="municipality-settings-header">
                            <div>
                              <h4>Manage Employees</h4>
                              <p className="municipality-note">Review the employees who currently have access to this location, then add a new employee when needed.</p>
                            </div>
                            <div className="municipality-actions">
                                <button
                                  type="button"
                                  className={`municipality-button${teamManagementView === "add" ? " municipality-button--ghost" : " municipality-button--primary"}`}
                                  onClick={() => setTeamManagementView((prev) => (prev === "add" ? "list" : "add"))}
                                >
                                  {teamManagementView === "add" ? "Hide Add Employee" : "Add Employee"}
                                </button>
                            </div>
                          </div>
                          {settingsSectionStatus.team ? <p className={`municipality-inline-status${teamSectionStatusIsError ? " is-error" : ""}`}>{settingsSectionStatus.team}</p> : null}
                          {!teamSectionBlocked ? (
                          <>
                              <div className="municipality-detail-grid">
                                <div className="municipality-detail-item">
                                  <span>Total Assignments</span>
                                  <strong>{teamAssignments.length}</strong>
                                </div>
                                {Object.entries(teamAssignmentsByRole).map(([roleKey, count]) => (
                                  <div key={roleKey} className="municipality-detail-item">
                                    <span>{trimOrEmpty(roleDefinitions.find((row) => row.role === roleKey)?.role_label) || roleKey.replace(/_/g, " ")}</span>
                                    <strong>{count}</strong>
                                  </div>
                                ))}
                              </div>
                              <p className="municipality-note">
                                Employee and active custom roles can be assigned here. Tenant admin stays controlled from the developer dashboard.
                              </p>
                              {teamManagementView === "add" ? (
                                <div className="municipality-settings-list-item municipality-settings-list-item--stacked municipality-settings-sublist">
                                  <div className="municipality-settings-item-actions-row">
                                    <div>
                                      <strong>Add New Employee</strong>
                                      <p className="municipality-note">Choose whether you are assigning an existing account or creating a new invited account.</p>
                                    </div>
                                  </div>
                                  <div className="municipality-actions">
                                    <button
                                      type="button"
                                      className={`municipality-button${teamAssignmentMode === "existing" ? " municipality-button--primary" : " municipality-button--ghost"}`}
                                      onClick={() => setTeamAssignmentMode("existing")}
                                    >
                                      Find Existing Account
                                    </button>
                                    <button
                                      type="button"
                                      className={`municipality-button${teamAssignmentMode === "invite" ? " municipality-button--primary" : " municipality-button--ghost"}`}
                                      onClick={() => setTeamAssignmentMode("invite")}
                                    >
                                      Create Account
                                    </button>
                                  </div>
                                  {teamAssignmentMode === "existing" ? (
                                    <>
                                      <form className="municipality-form-grid" onSubmit={searchTeamAccounts}>
                                        <div className="municipality-field">
                                          <label htmlFor="team-search-query">Find Person</label>
                                          <input
                                            id="team-search-query"
                                            value={teamSearchQuery}
                                            onChange={(event) => setTeamSearchQuery(event.target.value)}
                                            placeholder="Exact email, exact phone, or full name"
                                          />
                                        </div>
                                        <div className="municipality-actions">
                                          <button type="submit" className="municipality-button municipality-button--primary" disabled={teamSearchLoading}>
                                            {teamSearchLoading ? "Searching…" : "Search Accounts"}
                                          </button>
                                        </div>
                                      </form>
                                      {teamSearchResults.length ? (
                                        <div className="municipality-settings-list">
                                          {teamSearchResults.map((row) => {
                                            const userId = trimOrEmpty(row?.id);
                                            const isSelected = userId === trimOrEmpty(teamAssignForm.user_id);
                                            return (
                                              <button
                                                key={userId}
                                                type="button"
                                                className="municipality-settings-list-item municipality-settings-list-item--stacked"
                                                onClick={() => setTeamAssignForm((prev) => ({ ...prev, user_id: userId }))}
                                                style={{
                                                  width: "100%",
                                                  textAlign: "left",
                                                  cursor: "pointer",
                                                  borderColor: isSelected ? "rgba(23, 109, 120, 0.55)" : undefined,
                                                  background: isSelected ? "rgba(23, 109, 120, 0.08)" : undefined,
                                                }}
                                              >
                                                <strong>{trimOrEmpty(row?.display_name) || trimOrEmpty(row?.email) || shortUserId(userId)}</strong>
                                                <p className="municipality-note">
                                                  {[trimOrEmpty(row?.email), trimOrEmpty(row?.phone)].filter(Boolean).join(" • ") || "No email or phone on file"}
                                                </p>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      ) : null}
                                      <div className="municipality-form-grid">
                                        <div className="municipality-field">
                                          <label htmlFor="team-role-select-existing">Organization Role</label>
                                          <select
                                            id="team-role-select-existing"
                                            value={teamAssignForm.role}
                                            onChange={(event) => setTeamAssignForm((prev) => ({ ...prev, role: event.target.value }))}
                                          >
                                            {assignableTeamRoles.map((row) => {
                                              const roleKey = trimOrEmpty(row?.role);
                                              if (!roleKey) return null;
                                              return (
                                                <option key={roleKey} value={roleKey}>
                                                  {trimOrEmpty(row?.role_label) || roleKeyToLabel(roleKey)}
                                                </option>
                                              );
                                            })}
                                            {!assignableTeamRoles.length ? <option value="tenant_employee">Tenant Employee</option> : null}
                                          </select>
                                        </div>
                                      </div>
                                      <div className="municipality-actions">
                                        <button
                                          type="button"
                                          className="municipality-button municipality-button--primary"
                                          onClick={() => void assignExistingTeamAccount()}
                                          disabled={teamAssignLoading || !trimOrEmpty(teamAssignForm.user_id)}
                                          title={trimOrEmpty(teamAssignForm.user_id) ? "Assign organization role" : "Select an account first"}
                                        >
                                          {teamAssignLoading ? "Assigning…" : "Assign Role"}
                                        </button>
                                        {trimOrEmpty(teamAssignForm.user_id) ? (
                                          <p className="municipality-note">
                                            Selected account: <strong>{trimOrEmpty(selectedTeamSearchAccount?.display_name) || trimOrEmpty(selectedTeamSearchAccount?.email) || "Account selected"}</strong>
                                          </p>
                                        ) : (
                                          <p className="municipality-note">For privacy, account lookup uses exact email, exact phone, or full-name matching before assignment.</p>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    <form className="municipality-form-grid" onSubmit={createAndAssignTeamUser}>
                                      <div className="municipality-field">
                                        <label htmlFor="team-invite-first-name">First Name</label>
                                        <input
                                          id="team-invite-first-name"
                                          value={teamInviteForm.first_name}
                                          onChange={(event) => setTeamInviteForm((prev) => ({ ...prev, first_name: event.target.value }))}
                                          placeholder="Jordan"
                                        />
                                      </div>
                                      <div className="municipality-field">
                                        <label htmlFor="team-invite-last-name">Last Name</label>
                                        <input
                                          id="team-invite-last-name"
                                          value={teamInviteForm.last_name}
                                          onChange={(event) => setTeamInviteForm((prev) => ({ ...prev, last_name: event.target.value }))}
                                          placeholder="Rivera"
                                        />
                                      </div>
                                      <div className="municipality-field">
                                        <label htmlFor="team-invite-email">Email</label>
                                        <input
                                          id="team-invite-email"
                                          type="email"
                                          value={teamInviteForm.email}
                                          onChange={(event) => setTeamInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                                          placeholder="jordan.rivera@example.gov"
                                        />
                                      </div>
                                      <div className="municipality-field">
                                        <label htmlFor="team-invite-phone">Phone Number</label>
                                        <input
                                          id="team-invite-phone"
                                          value={teamInviteForm.phone}
                                          onChange={(event) => setTeamInviteForm((prev) => ({ ...prev, phone: event.target.value }))}
                                          placeholder="(555) 555-0101"
                                        />
                                      </div>
                                      <div className="municipality-field">
                                        <label htmlFor="team-role-select-invite">Organization Role</label>
                                        <select
                                          id="team-role-select-invite"
                                          value={teamAssignForm.role}
                                          onChange={(event) => setTeamAssignForm((prev) => ({ ...prev, role: event.target.value }))}
                                        >
                                          {assignableTeamRoles.map((row) => {
                                            const roleKey = trimOrEmpty(row?.role);
                                            if (!roleKey) return null;
                                            return (
                                              <option key={roleKey} value={roleKey}>
                                                {trimOrEmpty(row?.role_label) || roleKeyToLabel(roleKey)}
                                              </option>
                                            );
                                          })}
                                          {!assignableTeamRoles.length ? <option value="tenant_employee">Tenant Employee</option> : null}
                                        </select>
                                      </div>
                                      <div className="municipality-actions">
                                        <button type="submit" className="municipality-button municipality-button--primary" disabled={teamInviteLoading}>
                                          {teamInviteLoading ? "Creating…" : "Create Account + Assign Role"}
                                        </button>
                                      </div>
                                    </form>
                                  )}
                                </div>
                              ) : null}
                              <div className="municipality-settings-header">
                                <div>
                                  <h4>Current Employees</h4>
                                  <p className="municipality-note">The current access list stays visible here even while you are adding a new employee.</p>
                                </div>
                              </div>
                              {teamAssignments.length ? (
                                <div className="municipality-settings-list">
                                  {teamAssignments.map((assignment) => (
                                    (() => {
                                      const roleKey = trimOrEmpty(assignment?.role);
                                      const assignmentKey = `${assignment.user_id}-${roleKey}`;
                                      const roleRow = roleDefinitionLookup[roleKey];
                                      const isManageableRole = Boolean(roleRow) && (roleRow?.is_system !== true || roleKey === "tenant_employee");
                                      const isBusy = Boolean(teamAssignmentBusy[assignmentKey]);
                                      const nextStatus = trimOrEmpty(assignment?.status) === "inactive" ? "active" : "inactive";
                                      const userSummary = resolveKnownTeamUserSummary(assignment.user_id);
                                      return (
                                        <div key={assignmentKey} className="municipality-settings-list-item">
                                          <div>
                                            <strong>{formatKnownTeamUserLabel(assignment.user_id)}{assignment.user_id === session?.user?.id ? " · You" : ""}</strong>
                                            {trimOrEmpty(userSummary?.email) || trimOrEmpty(userSummary?.phone) ? (
                                              <p className="municipality-note">
                                                {[trimOrEmpty(userSummary?.email), trimOrEmpty(userSummary?.phone)].filter(Boolean).join(" • ")}
                                              </p>
                                            ) : null}
                                            <p className="municipality-note">
                                              {trimOrEmpty(roleRow?.role_label) || roleKeyToLabel(roleKey)}
                                              {" • "}
                                              {trimOrEmpty(assignment.status) || "active"}
                                            </p>
                                            {!isManageableRole ? (
                                              <p className="municipality-note">This system role still needs PCP control.</p>
                                            ) : null}
                                          </div>
                                          <div className="municipality-settings-item-actions">
                                            <span className={statusBadgeClass(assignment.status)}>{trimOrEmpty(assignment.status) || "active"}</span>
                                            {isManageableRole ? (
                                              <div className="municipality-actions municipality-actions--compact">
                                                <button
                                                  type="button"
                                                  className="municipality-button municipality-button--ghost"
                                                  onClick={() => void updateTeamAssignmentStatus(assignment, nextStatus)}
                                                  disabled={isBusy}
                                                >
                                                  {isBusy ? "Saving…" : nextStatus === "active" ? "Reactivate" : "Deactivate"}
                                                </button>
                                                <button
                                                  type="button"
                                                  className="municipality-button municipality-button--ghost municipality-button--danger"
                                                  onClick={() => void removeTeamAssignment(assignment)}
                                                  disabled={isBusy}
                                                >
                                                  Remove
                                                </button>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                      );
                                    })()
                                  ))}
                                </div>
                              ) : (
                                <div className="municipality-empty">No location access assignments are visible yet.</div>
                              )}
                              {!manageableTeamAssignments.length ? (
                                <p className="municipality-note">No hub-manageable employee assignments are visible yet. Tenant admin is still managed from the developer dashboard.</p>
                              ) : null}
                          </>
                          ) : null}
                        </div>
                      )
                    ) : null}

                    {activeSettingsItemKey === "roles-permissions" ? (
                      !manageAccess ? (
                        <div className="municipality-auth-cta">
                          <h4>Roles and permissions are limited to location staff</h4>
                          <p className="municipality-note">Role management is reserved for the tenant owner and permitted location staff.</p>
                        </div>
                      ) : (
                        <div className="municipality-account-card municipality-account-card--section">
                          <div className="municipality-settings-header">
                            <div>
                              <h4>Roles & Permissions</h4>
                              <p className="municipality-note">Use this role matrix to confirm who can access reports, users, communications, and other location admin tools.</p>
                            </div>
                            <div className="municipality-actions">
                              <button type="button" className="municipality-button municipality-button--ghost" onClick={downloadRoleAccessExport}>
                                Export Roles CSV
                              </button>
                            </div>
                          </div>
                          {settingsSectionStatus.roles ? <p className="municipality-inline-status is-error">{settingsSectionStatus.roles}</p> : null}
                          {!settingsSectionStatus.roles ? (
                            roleDefinitions.length ? (
                              <div className="municipality-settings-list">
                                {roleDefinitions.map((roleRow) => {
                                  const allowedPermissions = permissionsByRole[roleRow.role] || [];
                                  return (
                                    <div key={roleRow.role} className="municipality-settings-list-item municipality-settings-list-item--stacked">
                                      <div>
                                        <strong>{trimOrEmpty(roleRow?.role_label) || trimOrEmpty(roleRow?.role)}</strong>
                                        <p className="municipality-note">
                                          {roleRow?.is_system ? "System role" : "Custom role"}
                                          {" • "}
                                          {roleRow?.active ? "Active" : "Inactive"}
                                        </p>
                                      </div>
                                      <div className="municipality-chip-row">
                                        {allowedPermissions.length ? (
                                          allowedPermissions.map((permissionRow) => (
                                            <span key={`${roleRow.role}-${permissionRow.permission_key}`} className="municipality-chip">
                                              {permissionLabelLookup[permissionRow.permission_key] || permissionRow.permission_key}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="municipality-note">No permissions enabled for this role.</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="municipality-empty">No role definitions are visible for this location yet.</div>
                            )
                          ) : null}
                        </div>
                      )
                    ) : null}

                    {activeSettingsItemKey === "security-checks" ? (
                      !manageAccess ? (
                        <div className="municipality-auth-cta">
                          <h4>Security checks are limited to location staff</h4>
                          <p className="municipality-note">PIN-based checkpoint rules are reserved for the tenant owner and permitted location staff.</p>
                        </div>
                      ) : (
                        <div className="municipality-account-card municipality-account-card--section">
                          <div className="municipality-settings-header">
                            <div>
                              <h4>Security Checks</h4>
                              <p className="municipality-note">PIN-based security triggers will live here for fixed-status changes, account changes, and employee updates.</p>
                            </div>
                          </div>
                          <div className="municipality-settings-list">
                            <div className="municipality-settings-list-item">
                              <div>
                                <strong>Require PIN for report status changes</strong>
                                <p className="municipality-note">Recommended before staff begin closing reports in volume.</p>
                              </div>
                              <span className="municipality-chip">Next</span>
                            </div>
                            <div className="municipality-settings-list-item">
                              <div>
                                <strong>Require PIN for employee access changes</strong>
                                <p className="municipality-note">Protect team-access edits and sensitive organization changes.</p>
                              </div>
                              <span className="municipality-chip">Next</span>
                            </div>
                            <div className="municipality-settings-list-item">
                              <div>
                                <strong>Require PIN for organization setting changes</strong>
                                <p className="municipality-note">Adds a checkpoint when sensitive organization details are edited.</p>
                              </div>
                              <span className="municipality-chip">Next</span>
                            </div>
                          </div>
                        </div>
                      )
                    ) : null}

                    {activeSettingsItemKey === "visual-appearance" ? (
                      !manageAccess ? (
                        <div className="municipality-auth-cta">
                          <h4>Map settings are limited to location staff</h4>
                          <p className="municipality-note">Visual appearance is reserved for the tenant owner and permitted location staff.</p>
                        </div>
                      ) : (
                        <div className="municipality-account-card municipality-account-card--section">
                          <div className="municipality-settings-header">
                            <div>
                              <h4>Visual Appearance</h4>
                              <p className="municipality-note">Visual appearance is the current map-settings surface for this location.</p>
                            </div>
                            {settingsSectionEdit.map ? (
                              <div className="municipality-actions">
                                <button
                                  type="button"
                                  className="municipality-button municipality-button--ghost"
                                  onClick={() => {
                                    setMapAppearanceDraft(buildMapAppearanceDraft(mapAppearance));
                                    setSettingsSectionEdit((prev) => ({ ...prev, map: false }));
                                    setSettingsSectionStatus((prev) => ({ ...prev, map: "" }));
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="municipality-button municipality-button--primary"
                                  onClick={() => void saveMapAppearanceSettings()}
                                  disabled={settingsSectionSaving.map}
                                >
                                  {settingsSectionSaving.map ? "Saving…" : "Save"}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="municipality-button municipality-button--ghost"
                                onClick={() => {
                                  setMapAppearanceDraft(buildMapAppearanceDraft(mapAppearance));
                                  setSettingsSectionEdit((prev) => ({ ...prev, map: true }));
                                  setSettingsSectionStatus((prev) => ({ ...prev, map: "" }));
                                }}
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          {settingsSectionStatus.map ? <p className={`municipality-inline-status${settingsSectionStatus.map.toLowerCase().includes("could not") ? " is-error" : ""}`}>{settingsSectionStatus.map}</p> : null}
                          {settingsSectionEdit.map ? (
                            <div className="municipality-form-grid">
                              <label className="municipality-checkbox">
                                <input
                                  type="checkbox"
                                  checked={Boolean(mapAppearanceDraft.show_boundary_border)}
                                  onChange={(event) => setMapAppearanceDraft((prev) => ({ ...prev, show_boundary_border: event.target.checked }))}
                                />
                                <span>Show boundary border</span>
                              </label>
                              <label className="municipality-checkbox">
                                <input
                                  type="checkbox"
                                  checked={Boolean(mapAppearanceDraft.shade_outside_boundary)}
                                  onChange={(event) => setMapAppearanceDraft((prev) => ({ ...prev, shade_outside_boundary: event.target.checked }))}
                                />
                                <span>Shade outside boundary</span>
                              </label>
                              <div className="municipality-field">
                                <label htmlFor="map-border-color">Boundary Border Color</label>
                                <div className="municipality-inline-field-row">
                                  <input
                                    id="map-border-color"
                                    type="color"
                                    value={sanitizeHexColor(mapAppearanceDraft.boundary_border_color, "#e53935")}
                                    disabled={!Boolean(mapAppearanceDraft.show_boundary_border)}
                                    onChange={(event) => setMapAppearanceDraft((prev) => ({ ...prev, boundary_border_color: event.target.value }))}
                                  />
                                  <input
                                    type="text"
                                    inputMode="text"
                                    value={mapAppearanceDraft.boundary_border_color}
                                    disabled={!Boolean(mapAppearanceDraft.show_boundary_border)}
                                    onChange={(event) => setMapAppearanceDraft((prev) => ({ ...prev, boundary_border_color: event.target.value }))}
                                    onBlur={(event) => setMapAppearanceDraft((prev) => ({
                                      ...prev,
                                      boundary_border_color: sanitizeHexColor(normalizeHexDraft(event.target.value, prev.boundary_border_color), "#e53935"),
                                    }))}
                                    placeholder="#e53935"
                                  />
                                </div>
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="map-border-width">Boundary Border Width (0.5 - 8)</label>
                                <input
                                  id="map-border-width"
                                  type="text"
                                  inputMode="decimal"
                                  value={mapAppearanceDraft.boundary_border_width}
                                  disabled={!Boolean(mapAppearanceDraft.show_boundary_border)}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    if (nextValue === "" || /^-?\d*\.?\d*$/.test(nextValue)) {
                                      setMapAppearanceDraft((prev) => ({ ...prev, boundary_border_width: nextValue }));
                                    }
                                  }}
                                  onBlur={(event) => {
                                    const normalized = normalizeBoundedDecimalInput(event.target.value, { min: 0.5, max: 8 });
                                    setMapAppearanceDraft((prev) => ({ ...prev, boundary_border_width: normalized || "4" }));
                                  }}
                                  placeholder="4"
                                />
                              </div>
                              <div className="municipality-field">
                                <label htmlFor="map-shade-opacity">Outside Shade Opacity (0 - 1)</label>
                                <input
                                  id="map-shade-opacity"
                                  type="text"
                                  inputMode="decimal"
                                  value={mapAppearanceDraft.outside_shade_opacity}
                                  disabled={!Boolean(mapAppearanceDraft.shade_outside_boundary)}
                                  onChange={(event) => {
                                    const nextValue = event.target.value;
                                    if (nextValue === "" || /^-?\d*\.?\d*$/.test(nextValue)) {
                                      setMapAppearanceDraft((prev) => ({ ...prev, outside_shade_opacity: nextValue }));
                                    }
                                  }}
                                  onBlur={(event) => {
                                    const normalized = normalizeBoundedDecimalInput(event.target.value, { min: 0, max: 1 });
                                    setMapAppearanceDraft((prev) => ({ ...prev, outside_shade_opacity: normalized || "0.42" }));
                                  }}
                                  placeholder="0.42"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="municipality-detail-grid">
                              {mapAppearanceFields.map((field) => (
                                <div key={field.label} className="municipality-detail-item">
                                  <span>{field.label}</span>
                                  <strong>{field.value}</strong>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    ) : null}
                  </div>
                </div>
              )}
            </HomeCard>
          </section>
        ) : null}

        {manageLoading ? <p className="municipality-inline-status" style={{ marginTop: 18 }}>Checking municipality publishing access…</p> : null}
      </main>
    </div>
  );
}
