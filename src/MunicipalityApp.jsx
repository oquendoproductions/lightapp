import { lazy, Suspense, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { TenantContext } from "./tenant/contextObject";
import {
  buildMunicipalityAppHref,
  normalizeMunicipalityAppPath,
} from "./municipality/appShellRouting";
import "./municipality-app.css";

const MapGoogleFull = lazy(() => import("./MapGoogleFull.jsx"));

const BRAND_LOGO_SRC = import.meta.env.VITE_TITLE_LOGO_SRC || "/CityReport-pin-logo.png";

const NAV_ITEMS = [
  { key: "home", label: "Home", path: "/" },
  { key: "alerts", label: "Alerts", path: "/alerts" },
  { key: "events", label: "Events", path: "/events" },
  { key: "report", label: "Report An Issue", path: "/report", primary: true },
];

const ACCOUNT_PATH = "/account";

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

function trimOrEmpty(value) {
  return String(value || "").trim();
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

function buildTenantSwitchHref(env, targetTenant, currentRoutePath) {
  const tenantKey = trimOrEmpty(targetTenant?.tenant_key).toLowerCase();
  const subdomain = trimOrEmpty(targetTenant?.primary_subdomain).toLowerCase();
  const routePath = currentRoutePath === ACCOUNT_PATH ? "/" : normalizeMunicipalityAppPath(currentRoutePath || "/", tenantKey);
  if (!tenantKey) return "/";
  if (env === "staging") {
    return `https://dev.cityreport.io/${tenantKey}${routePath === "/" ? "" : routePath}`;
  }
  const host = subdomain || `${tenantKey}.cityreport.io`;
  return `https://${host}${routePath === "/" ? "" : routePath}`;
}

function useResidentAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data?.session || null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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

function AlertFeed({ alerts, emptyText, showStatus = false, onStatusChange = null }) {
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

function EventFeed({ events, emptyText, showStatus = false, onStatusChange = null }) {
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

function AlertComposer({ topicLookup, alertForm, setAlertForm, onSubmit }) {
  return (
    <form className="municipality-topic-row municipality-topic-card" onSubmit={onSubmit}>
      <h4>Create Alert</h4>
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
            </select>
          </label>
        </div>
      </div>
      <div className="municipality-actions">
        <button type="submit" className="municipality-button municipality-button--primary">Save Alert</button>
      </div>
    </form>
  );
}

function EventComposer({ topicLookup, eventForm, setEventForm, onSubmit }) {
  return (
    <form className="municipality-topic-row municipality-topic-card" onSubmit={onSubmit}>
      <h4>Create Event</h4>
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
            </select>
          </label>
        </div>
      </div>
      <div className="municipality-actions">
        <button type="submit" className="municipality-button municipality-button--primary">Save Event</button>
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
  const [featureStatus, setFeatureStatus] = useState({ ready: true, message: "" });
  const [dataLoading, setDataLoading] = useState(true);
  const [manageAccess, setManageAccess] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [alertForm, setAlertForm] = useState(EMPTY_ALERT_FORM);
  const [eventForm, setEventForm] = useState(() => ({ ...EMPTY_EVENT_FORM, starts_at: toDateInputValue(new Date()) }));
  const [adminStatus, setAdminStatus] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ full_name: "", email: "", password: "" });
  const [authStatus, setAuthStatus] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [showAlertComposer, setShowAlertComposer] = useState(false);
  const [showEventComposer, setShowEventComposer] = useState(false);
  const [openNavMenu, setOpenNavMenu] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [availableHubTenants, setAvailableHubTenants] = useState([]);
  const [interestedTenantKeys, setInterestedTenantKeys] = useState([]);
  const [savedInterestedTenantKeys, setSavedInterestedTenantKeys] = useState([]);
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
        active: item.path === routePath,
      })),
    [routePath, tenantKey]
  );

  const switchableTenants = useMemo(() => {
    const lookup = new Map();
    for (const tenantRow of availableHubTenants || []) {
      const key = trimOrEmpty(tenantRow?.tenant_key).toLowerCase();
      if (!key) continue;
      lookup.set(key, tenantRow);
    }
    if (tenantKey && !lookup.has(tenantKey)) {
      lookup.set(tenantKey, {
        tenant_key: tenantKey,
        name: tenantName,
        primary_subdomain: trimOrEmpty(tenant?.tenantConfig?.primary_subdomain) || `${tenantKey}.cityreport.io`,
      });
    }
    return [...lookup.values()].filter((row) => interestedTenantKeys.includes(trimOrEmpty(row?.tenant_key).toLowerCase()));
  }, [availableHubTenants, interestedTenantKeys, tenant?.tenantConfig?.primary_subdomain, tenantKey, tenantName]);

  const publishedAlerts = useMemo(
    () => sortAlerts(alerts.filter((alert) => String(alert?.status || "").trim().toLowerCase() === "published")),
    [alerts]
  );

  const publishedEvents = useMemo(
    () => sortEvents(events.filter((event) => String(event?.status || "").trim().toLowerCase() === "published")),
    [events]
  );

  const homeAlerts = useMemo(() => publishedAlerts.slice(0, 3), [publishedAlerts]);
  const homeEvents = useMemo(() => publishedEvents.slice(0, 4), [publishedEvents]);

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

      if (tenantListRes.error) {
        if (isMissingFunctionError(tenantListRes.error)) {
          setAvailableHubTenants([
            {
              tenant_key: tenantKey,
              name: tenantName,
              primary_subdomain: trimOrEmpty(tenant?.tenantConfig?.primary_subdomain) || `${tenantKey}.cityreport.io`,
            },
          ]);
        } else {
          setAvailableHubTenants([]);
        }
      } else {
        setAvailableHubTenants(Array.isArray(tenantListRes.data) ? tenantListRes.data : []);
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
      const normalizedKeys = nextKeys.includes(tenantKey) ? nextKeys : [tenantKey, ...nextKeys];
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
      setFeatureStatus({ ready: true, message: "" });

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
        .select("id,tenant_key,topic_key,title,summary,body,location_name,location_address,cta_label,cta_url,all_day,delivery_channels,status,starts_at,ends_at,published_at,created_at,updated_at")
        .order("starts_at", { ascending: true })
        .order("created_at", { ascending: false });

      const [topicRes, alertRes, eventRes] = await Promise.all([topicQuery, alertQuery, eventQuery]);

      if (cancelled) return;

      const firstError = topicRes.error || alertRes.error || eventRes.error;
      if (firstError) {
        if (isMissingRelationError(firstError)) {
          setFeatureStatus({
            ready: false,
            message: "This tenant updates feature is ready in code, but the database migration has not been applied yet.",
          });
          setTopics([]);
          setAlerts([]);
          setEvents([]);
          setDataLoading(false);
          return;
        }
        setFeatureStatus({ ready: false, message: firstError.message || "Unable to load municipality updates." });
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
          setFeatureStatus({
            ready: false,
            message: "Resident notification preferences are waiting on the latest database migration.",
          });
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
      setAuthStatus("Signed in.");
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
    setAuthStatus("Account created. If email confirmation is enabled, please confirm your email and then sign in.");
    setAuthMode("login");
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
      published_at: alertForm.status === "published" ? new Date().toISOString() : null,
      delivery_channels: ["in_app", "email"],
    };
    if (!payload.title || !payload.topic_key) {
      setAdminStatus("Alert title and topic are required.");
      return;
    }
    const { error } = await supabase.from("municipality_alerts").insert([payload]);
    if (error) {
      setAdminStatus(error.message || "Could not publish the alert.");
      return;
    }
    setAlertForm(EMPTY_ALERT_FORM);
    setAdminStatus("Alert saved.");
    setShowAlertComposer(true);
    setRoutePath((prev) => prev);
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
      published_at: eventForm.status === "published" ? new Date().toISOString() : null,
      delivery_channels: ["in_app", "email"],
    };
    if (!payload.title || !payload.topic_key || !payload.starts_at) {
      setAdminStatus("Event title, topic, and start time are required.");
      return;
    }
    const { error } = await supabase.from("municipality_events").insert([payload]);
    if (error) {
      setAdminStatus(error.message || "Could not save the event.");
      return;
    }
    setEventForm({ ...EMPTY_EVENT_FORM, starts_at: toDateInputValue(new Date()) });
    setAdminStatus("Event saved.");
    setShowEventComposer(true);
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
    return (
      <header className={`municipality-topbar${floating ? " municipality-topbar--floating" : ""}`}>
        <div className="municipality-brand">
          <img src={BRAND_LOGO_SRC} alt="CityReport.io" />
          <div>
            <p className="municipality-brand-eyebrow">Municipality Updates Hub</p>
            <h1>{tenantName}</h1>
            <p>Resident notices, civic events, and issue reporting in one place.</p>
          </div>
        </div>
        <div className="municipality-topbar-actions">
          <nav className="municipality-nav" aria-label="Municipality navigation">
            {navLinks.map((item) => {
              const showManageMenu = manageAccess && (item.key === "alerts" || item.key === "events");
              if (!showManageMenu) {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    className={`${item.primary ? "municipality-button municipality-button--primary" : "municipality-nav-link"}${item.active ? " is-active" : ""}`}
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
                          if (isAlertsMenu) setShowAlertComposer(true);
                          else setShowEventComposer(true);
                          navigate(item.path);
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
              <div className="municipality-nav-dropdown" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className={`municipality-nav-link municipality-nav-button${openNavMenu === "tenants" ? " is-active" : ""}`}
                  onClick={() => setOpenNavMenu((prev) => (prev === "tenants" ? "" : "tenants"))}
                >
                  Tenants
                </button>
                {openNavMenu === "tenants" ? (
                  <div className="municipality-nav-menu">
                    {switchableTenants.map((city) => {
                      const cityKey = trimOrEmpty(city?.tenant_key).toLowerCase();
                      const targetHref = buildTenantSwitchHref(tenant?.env, city, routePath);
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
                ) : null}
              </div>
            ) : null}
          </nav>

          <div className="municipality-account-anchor" onClick={(event) => event.stopPropagation()}>
            {!session?.user?.id ? (
              <button
                type="button"
                className="municipality-button municipality-button--ghost"
                onClick={() => navigate(ACCOUNT_PATH)}
              >
                Login
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="municipality-account-toggle"
                  aria-label="Open account menu"
                  onClick={() => setAccountMenuOpen((prev) => !prev)}
                >
                  <span />
                  <span />
                  <span />
                </button>
                {accountMenuOpen ? (
                  <div className="municipality-account-menu">
                    <button
                      type="button"
                      className="municipality-nav-menu-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        navigate(ACCOUNT_PATH);
                      }}
                    >
                      Account Settings
                    </button>
                    <button
                      type="button"
                      className="municipality-nav-menu-item"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        void supabase.auth.signOut();
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </header>
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

  return (
    <div className="municipality-shell">
      {renderHeader(false)}
      <main className="municipality-main">
        {!featureStatus.ready ? (
          <section className="municipality-card municipality-section">
            <h3>Updates Feature Status</h3>
            <p className="municipality-section-subtitle">{featureStatus.message}</p>
          </section>
        ) : null}

        {routePath === "/" ? (
          <>
            <section className="municipality-hero municipality-hero--single">
              <div className="municipality-card municipality-hero-copy">
                <h2>City notices first. Reporting tools right behind them.</h2>
                <p>
                  Residents can come here first for live alerts, service changes, parade notices, and planned maintenance,
                  then jump straight into issue reporting when they need the map workspace.
                </p>
                <div className="municipality-hero-actions">
                  <button type="button" className="municipality-button municipality-button--primary" onClick={() => navigate("/report")}>
                    Report An Issue
                  </button>
                  <button type="button" className="municipality-button municipality-button--ghost" onClick={() => navigate("/events")}>
                    Browse Events
                  </button>
                  <button type="button" className="municipality-button municipality-button--ghost" onClick={() => navigate(ACCOUNT_PATH)}>
                    Account Settings
                  </button>
                </div>
                <div className="municipality-metrics">
                  <div className="municipality-metric">
                    <strong>{activeAlertCount(publishedAlerts)}</strong>
                    <span>Active Alerts</span>
                  </div>
                  <div className="municipality-metric">
                    <strong>{upcomingEventCount(publishedEvents)}</strong>
                    <span>Upcoming Events</span>
                  </div>
                  <div className="municipality-metric">
                    <strong>{session?.user?.id ? currentPreferenceCount : 0}</strong>
                    <span>{session?.user?.id ? "Enabled Topics" : "Topics Ready"}</span>
                  </div>
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

        {routePath === "/alerts" ? (
          <HomeCard title="Municipality Alerts" subtitle="Published alerts stay visible here for residents, while drafts remain visible only to staff with communications access.">
            {manageAccess ? (
              <div className="municipality-admin-panel">
                <div className="municipality-actions municipality-actions--toolbar">
                  <button
                    type="button"
                    className="municipality-button municipality-button--primary"
                    onClick={() => setShowAlertComposer((prev) => !prev)}
                  >
                    {showAlertComposer ? "Back" : "Create Alert"}
                  </button>
                </div>
                {showAlertComposer ? (
                  <AlertComposer
                    topicLookup={topicLookup}
                    alertForm={alertForm}
                    setAlertForm={setAlertForm}
                    onSubmit={createAlert}
                  />
                ) : null}
                {adminStatus ? <p className={`municipality-inline-status${adminStatus.toLowerCase().includes("could not") ? " is-error" : ""}`}>{adminStatus}</p> : null}
              </div>
            ) : null}
            {dataLoading ? <div className="municipality-empty">Loading alerts…</div> : (
              <AlertFeed
                alerts={manageAccess ? alerts : publishedAlerts}
                emptyText="No alerts have been published yet."
                showStatus={manageAccess}
                onStatusChange={manageAccess ? updateAlertStatus : null}
              />
            )}
          </HomeCard>
        ) : null}

        {routePath === "/events" ? (
          <HomeCard title="Municipality Events" subtitle="Calendar-friendly city events, scheduled maintenance, and public operations notices.">
            <div className="municipality-admin-panel">
              <div className="municipality-actions municipality-actions--toolbar" style={{ marginTop: 16 }}>
                {manageAccess ? (
                  <button
                    type="button"
                    className="municipality-button municipality-button--primary"
                    onClick={() => setShowEventComposer((prev) => !prev)}
                  >
                    {showEventComposer ? "Back" : "Create Event"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="municipality-button municipality-button--ghost"
                  onClick={() => {
                    if (!publishedEvents.length) return;
                    downloadTextFile(
                      `${tenantKey || "municipality"}-events.ics`,
                      buildIcsFile(publishedEvents, tenantName),
                      "text/calendar;charset=utf-8"
                    );
                  }}
                >
                  Download Calendar (.ics)
                </button>
              </div>
              {manageAccess && showEventComposer ? (
                <EventComposer
                  topicLookup={topicLookup}
                  eventForm={eventForm}
                  setEventForm={setEventForm}
                  onSubmit={createEvent}
                />
              ) : null}
              {manageAccess && adminStatus ? <p className={`municipality-inline-status${adminStatus.toLowerCase().includes("could not") ? " is-error" : ""}`}>{adminStatus}</p> : null}
            </div>
            {dataLoading ? <div className="municipality-empty">Loading events…</div> : (
              <EventFeed
                events={manageAccess ? events : publishedEvents}
                emptyText="No events have been published yet."
                showStatus={manageAccess}
                onStatusChange={manageAccess ? updateEventStatus : null}
              />
            )}
          </HomeCard>
        ) : null}

        {routePath === ACCOUNT_PATH ? (
          <section>
            <HomeCard title="Account Settings" subtitle="Manage your notification preferences and the cities you want to follow.">
              {!session?.user?.id ? (
                <form className="municipality-auth-panel" onSubmit={handleAuthSubmit}>
                  <h4>{authMode === "login" ? "Sign in to manage your cities" : "Create your resident account"}</h4>
                  <div className="municipality-form-grid">
                    {authMode === "signup" ? (
                      <div className="municipality-field">
                        <label htmlFor="resident-name">Full name</label>
                        <input id="resident-name" value={authForm.full_name} onChange={(event) => setAuthForm((prev) => ({ ...prev, full_name: event.target.value }))} placeholder="Your name" />
                      </div>
                    ) : null}
                    <div className="municipality-field">
                      <label htmlFor="resident-email">Email</label>
                      <input id="resident-email" type="email" value={authForm.email} onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="you@example.com" />
                    </div>
                    <div className="municipality-field">
                      <label htmlFor="resident-password">Password</label>
                      <input id="resident-password" type="password" value={authForm.password} onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="Password" />
                    </div>
                  </div>
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
              ) : (
                <div className="municipality-topic-row">
                  <div className="municipality-account-card municipality-account-card--section">
                    <div className="municipality-settings-header">
                      <div>
                        <h4>Account Information</h4>
                        <p className="municipality-note">Review your resident profile and update your name or phone number when needed.</p>
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
                          <label htmlFor="account-full-name">Full name</label>
                          <input id="account-full-name" value={accountProfileDraft.full_name} onChange={(event) => setAccountProfileDraft((prev) => ({ ...prev, full_name: event.target.value }))} />
                        </div>
                        <div className="municipality-field">
                          <label htmlFor="account-phone">Phone number</label>
                          <input id="account-phone" value={accountProfileDraft.phone} onChange={(event) => setAccountProfileDraft((prev) => ({ ...prev, phone: event.target.value }))} placeholder="(000) 000-0000" />
                        </div>
                        <div className="municipality-field">
                          <label htmlFor="account-email-readonly">Email</label>
                          <input id="account-email-readonly" value={trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email)} readOnly />
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
                      </div>
                    )}
                    {accountSectionStatus.profile ? <p className={`municipality-inline-status${accountSectionStatus.profile.toLowerCase().includes("could not") || accountSectionStatus.profile.toLowerCase().includes("please") ? " is-error" : ""}`}>{accountSectionStatus.profile}</p> : null}
                  </div>

                  <div className="municipality-account-card municipality-account-card--section">
                    <div className="municipality-settings-header">
                      <div>
                        <h4>My Cities</h4>
                        <p className="municipality-note">Choose which municipality hubs appear in your tenant switcher.</p>
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
                          <label htmlFor="city-search">Search municipalities or tenants</label>
                          <input id="city-search" value={citySearchQuery} onChange={(event) => setCitySearchQuery(event.target.value)} placeholder="Search by city name or tenant key" />
                        </div>
                        <div className="municipality-topic-row" style={{ marginTop: 12 }}>
                          {availableHubTenants
                            .filter((city) => {
                              const query = trimOrEmpty(citySearchQuery).toLowerCase();
                              if (!query) return true;
                              return `${trimOrEmpty(city?.name)} ${trimOrEmpty(city?.tenant_key)}`.toLowerCase().includes(query);
                            })
                            .map((city) => {
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
                      </>
                    ) : (
                      <div className="municipality-detail-grid">
                        {(switchableTenants.length ? switchableTenants : availableHubTenants.filter((city) => interestedTenantKeys.includes(trimOrEmpty(city?.tenant_key).toLowerCase()))).map((city) => (
                          <div key={trimOrEmpty(city?.tenant_key)} className="municipality-detail-item">
                            <span>Following</span>
                            <strong>{trimOrEmpty(city?.name) || trimOrEmpty(city?.tenant_key)}</strong>
                          </div>
                        ))}
                      </div>
                    )}
                    {accountSectionStatus.cities ? <p className={`municipality-inline-status${accountSectionStatus.cities.toLowerCase().includes("could not") ? " is-error" : ""}`}>{accountSectionStatus.cities}</p> : null}
                  </div>

                  <div className="municipality-account-card municipality-account-card--section">
                    <div className="municipality-settings-header">
                      <div>
                        <h4>Notification Preferences</h4>
                        <p className="municipality-note">Manage all of your update categories in one place. In-app and email are live now; web push is next.</p>
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
                            {accountSectionEdit.notifications ? (
                              <div className="municipality-checkbox-row" style={{ marginTop: 12 }}>
                                <label className="municipality-checkbox">
                                  <input type="checkbox" checked={Boolean(current.in_app_enabled)} onChange={(event) => updatePreferenceDraft(topic.topic_key, "in_app_enabled", event.target.checked)} />
                                  In-app
                                </label>
                                <label className="municipality-checkbox">
                                  <input type="checkbox" checked={Boolean(current.email_enabled)} onChange={(event) => updatePreferenceDraft(topic.topic_key, "email_enabled", event.target.checked)} />
                                  Email
                                </label>
                                <label className="municipality-checkbox">
                                  <input type="checkbox" checked={Boolean(current.web_push_enabled)} disabled />
                                  Web push (next)
                                </label>
                              </div>
                            ) : (
                              <div className="municipality-note municipality-topic-channel-summary">
                                {[current.in_app_enabled ? "In-app" : null, current.email_enabled ? "Email" : null, current.web_push_enabled ? "Web push" : null].filter(Boolean).join(" • ") || "Off"}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                    {accountSectionStatus.notifications ? <p className={`municipality-inline-status${accountSectionStatus.notifications.toLowerCase().includes("could not") ? " is-error" : ""}`}>{accountSectionStatus.notifications}</p> : null}
                  </div>

                  <div className="municipality-account-card municipality-account-card--section">
                    <div className="municipality-settings-header">
                      <div>
                        <h4>Sign-In & Security</h4>
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
                      </div>
                    )}
                    {accountSectionStatus.security ? <p className={`municipality-inline-status${accountSectionStatus.security.toLowerCase().includes("could not") || accountSectionStatus.security.toLowerCase().includes("enter your current password") || accountSectionStatus.security.toLowerCase().includes("use 8+") ? " is-error" : ""}`}>{accountSectionStatus.security}</p> : null}
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
