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
  { key: "preferences", label: "Preferences", path: "/preferences" },
  { key: "report", label: "Report An Issue", path: "/report", primary: true },
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

  return { session, profile, authReady, loadingProfile };
}

function HomeCard({ title, children, subtitle }) {
  return (
    <section className="municipality-card municipality-section">
      <h3>{title}</h3>
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

export default function MunicipalityApp() {
  const tenant = useContext(TenantContext);
  const { session, profile, authReady, loadingProfile } = useResidentAuth();
  const tenantKey = String(tenant?.tenantKey || "").trim().toLowerCase();
  const tenantName = trimOrEmpty(tenant?.tenantConfig?.name) || "Municipality";
  const residentPortalEnabled = Boolean(tenant?.tenantConfig?.resident_portal_enabled);
  const [routePath, setRoutePath] = useState(() => normalizeMunicipalityAppPath(window.location.pathname, tenantKey));
  const [topics, setTopics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [events, setEvents] = useState([]);
  const [preferencesByTopic, setPreferencesByTopic] = useState({});
  const [featureStatus, setFeatureStatus] = useState({ ready: true, message: "" });
  const [dataLoading, setDataLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsStatus, setPrefsStatus] = useState("");
  const [manageAccess, setManageAccess] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [alertForm, setAlertForm] = useState(EMPTY_ALERT_FORM);
  const [eventForm, setEventForm] = useState(() => ({ ...EMPTY_EVENT_FORM, starts_at: toDateInputValue(new Date()) }));
  const [adminStatus, setAdminStatus] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ full_name: "", email: "", password: "" });
  const [authStatus, setAuthStatus] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

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
        setPrefsStatus(error.message || "Could not load your notification preferences.");
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

  async function savePreferences() {
    if (!session?.user?.id) return;
    setSavingPrefs(true);
    setPrefsStatus("");
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
    const { error } = await supabase
      .from("resident_notification_preferences")
      .upsert(rows, { onConflict: "tenant_key,user_id,topic_key" });
    setSavingPrefs(false);
    if (error) {
      setPrefsStatus(error.message || "Could not save your preferences.");
      return;
    }
    setPrefsStatus("Preferences saved.");
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
        <nav className="municipality-nav" aria-label="Municipality navigation">
          {navLinks.map((item) => (
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
          ))}
        </nav>
      </header>
    );
  }

  if (routePath === "/report") {
    return (
      <div className="municipality-shell">
        <div className="municipality-report-overlay">
          <button type="button" className="municipality-button municipality-button--primary" onClick={() => navigate("/")}>
            Back To Updates
          </button>
        </div>
        <div className="municipality-main municipality-main--report">
          <Suspense fallback={<div className="municipality-empty" style={{ margin: 16 }}>Loading reporting workspace…</div>}>
            <MapGoogleFull />
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
            <section className="municipality-hero">
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
                  <button type="button" className="municipality-button municipality-button--ghost" onClick={() => navigate("/preferences")}>
                    Manage Preferences
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
                    <span>{session?.user?.id ? "Subscribed Topics" : "Topics Ready"}</span>
                  </div>
                </div>
              </div>

              <div className="municipality-side-stack">
                <aside className="municipality-card municipality-side-panel">
                  <h3>Resident Account</h3>
                  {session?.user?.id ? (
                    <>
                      <p>
                        Signed in as <strong>{trimOrEmpty(profile?.full_name) || trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email) || "Resident"}</strong>.
                      </p>
                      <div className="municipality-actions">
                        <button type="button" className="municipality-button municipality-button--ghost" onClick={() => navigate("/preferences")}>
                          Notification Preferences
                        </button>
                        <button
                          type="button"
                          className="municipality-button municipality-button--ghost"
                          onClick={() => {
                            void supabase.auth.signOut();
                          }}
                        >
                          Sign Out
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p>Create a resident account to choose which city updates you want to receive first.</p>
                      <div className="municipality-actions">
                        <button type="button" className="municipality-button municipality-button--primary" onClick={() => navigate("/preferences")}>
                          Sign In Or Create Account
                        </button>
                      </div>
                    </>
                  )}
                </aside>

                <aside className="municipality-card municipality-side-panel">
                  <h3>Calendar-Friendly</h3>
                  <p>
                    Upcoming civic events and planned maintenance can be downloaded into a calendar file today,
                    with linked calendar subscriptions ready for the next delivery step.
                  </p>
                  <div className="municipality-actions">
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
                      Download Calendar File
                    </button>
                  </div>
                </aside>
              </div>
            </section>

            <section className="municipality-section-grid">
              <HomeCard title="Current Alerts" subtitle="Road work, utility interruptions, service changes, and urgent notices.">
                {dataLoading ? <div className="municipality-empty">Loading alerts…</div> : <AlertFeed alerts={homeAlerts} emptyText="No active alerts are published right now." />}
              </HomeCard>
              <HomeCard title="Upcoming Events" subtitle="Parades, public meetings, sanitation changes, and scheduled maintenance.">
                {dataLoading ? <div className="municipality-empty">Loading events…</div> : <EventFeed events={homeEvents} emptyText="No upcoming events are published yet." />}
              </HomeCard>
            </section>

            {manageAccess ? (
              <section className="municipality-card municipality-section" style={{ marginTop: 22 }}>
                <h3>Municipality Publishing Desk</h3>
                <p className="municipality-section-subtitle">
                  Publish resident-facing alerts and events from the tenant homepage. Delivery is live in-app now, with email
                  and push delivery fields already modeled for the next rollout.
                </p>
                <div className="municipality-admin-split" style={{ marginTop: 18 }}>
                  <form className="municipality-topic-row municipality-topic-card" onSubmit={createAlert}>
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

                  <form className="municipality-topic-row municipality-topic-card" onSubmit={createEvent}>
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
                </div>
                {adminStatus ? <p className={`municipality-inline-status${adminStatus.toLowerCase().includes("could not") ? " is-error" : ""}`} style={{ marginTop: 14 }}>{adminStatus}</p> : null}
              </section>
            ) : null}
          </>
        ) : null}

        {routePath === "/alerts" ? (
          <HomeCard title="Municipality Alerts" subtitle="Published alerts stay visible here for residents, while drafts remain visible only to staff with communications access.">
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
            <div className="municipality-actions" style={{ marginTop: 16 }}>
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

        {routePath === "/preferences" ? (
          <section className="municipality-section-grid">
            <HomeCard title="Notification Preferences" subtitle="Choose which city updates you want first. In-app and email preferences are live now; web push is held for the next delivery pass.">
              {!session?.user?.id ? (
                <form className="municipality-auth-panel" onSubmit={handleAuthSubmit}>
                  <h4>{authMode === "login" ? "Sign in to manage alerts" : "Create your resident account"}</h4>
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
                  {Object.values(topicLookup).map((topic) => {
                    const current = preferencesByTopic?.[topic.topic_key] || {
                      in_app_enabled: Boolean(topic.default_enabled),
                      email_enabled: false,
                      web_push_enabled: false,
                    };
                    return (
                      <article key={topic.topic_key} className="municipality-topic-card">
                        <h4>{topic.label}</h4>
                        <p className="municipality-note">{topic.description}</p>
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
                      </article>
                    );
                  })}
                  <div className="municipality-actions">
                    <button type="button" className="municipality-button municipality-button--primary" onClick={() => void savePreferences()} disabled={savingPrefs || loadingProfile || !authReady}>
                      {savingPrefs ? "Saving…" : "Save Preferences"}
                    </button>
                  </div>
                  {prefsStatus ? <p className={`municipality-inline-status${prefsStatus.toLowerCase().includes("could not") ? " is-error" : ""}`}>{prefsStatus}</p> : null}
                </div>
              )}
            </HomeCard>

            <HomeCard title="Resident Summary" subtitle="This is the first-pass account experience for the municipality hub. The reporting workspace still keeps its own deeper account tools.">
              {session?.user?.id ? (
                <div className="municipality-account-card">
                  <h4>{trimOrEmpty(profile?.full_name) || trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email) || "Resident"}</h4>
                  <p className="municipality-note">{trimOrEmpty(profile?.email) || trimOrEmpty(session?.user?.email) || "Email unavailable"}</p>
                  <p className="municipality-note">
                    {currentPreferenceCount} topic{currentPreferenceCount === 1 ? "" : "s"} currently enabled across in-app or email delivery.
                  </p>
                  <div className="municipality-actions">
                    <button type="button" className="municipality-button municipality-button--ghost" onClick={() => navigate("/report")}>
                      Open Reporting Workspace
                    </button>
                    <button type="button" className="municipality-button municipality-button--ghost" onClick={() => { void supabase.auth.signOut(); }}>
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <div className="municipality-account-card">
                  <h4>Why sign in?</h4>
                  <p className="municipality-note">
                    Resident accounts unlock notification preferences now and will also carry forward into mobile-app delivery later.
                  </p>
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
