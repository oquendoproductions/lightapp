import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { REPORT_TYPES } from "./lib/mapDomainTypeOptionSupport.js";
import { hasIssueTypeOptionDetail } from "./lib/mapDomainDetailSupport.js";
import { incidentStateLabel } from "./lib/incidentLifecycle.js";
import { reportNumberForRowShared } from "./lib/mapReportDisplaySupport.js";
import {
  parseStreetlightQaFromNote,
  ReportTypeOptionDetails,
  noteDisplayText,
} from "./lib/mapPopupDetailSupport.jsx";
import { readImageUrlFromNote } from "./lib/mapReportParsingSupport.js";
import { resolveReportTypeOptionDetails as resolveReportTypeOptionDetailsShared } from "./lib/mapReportTypeOptionSupport.js";

function isExpectedPermissionError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").trim().toLowerCase();
  return code === "42501" || message.includes("permission denied") || message.includes("forbidden");
}

async function loadModerationFlagRowsShared() {
  try {
    const { data, error } = await supabase
      .from("abuse_anomaly_flags")
      .select("*")
      .eq("status", "open")
      .order("last_seen_at", { ascending: false })
      .limit(300);
    if (!error) {
      return {
        rows: Array.isArray(data)
          ? data.map((row) => ({ ...row, _source: "abuse_anomaly_flags" }))
          : [],
        error: "",
      };
    }
  } catch {
    // Older deployments may not expose the anomaly table; fall through to telemetry/events.
  }

  const tryQueries = [
    () => supabase.from("abuse_events").select("*").is("acknowledged_at", null).order("created_at", { ascending: false }).limit(300),
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
      return {
        rows: Array.isArray(data)
          ? data
              .filter((row) => !String(row?.acknowledged_at || "").trim())
              .map((row) => ({ ...row, _source: "abuse_events" }))
          : [],
        error: "",
      };
    } catch (e) {
      lastErr = e;
    }
  }
  try {
    const { data, error } = await supabase
      .from("metrics_open_abuse_flags_v1")
      .select("domain,reason,severity,open_flag_count,last_seen_at")
      .order("severity", { ascending: false })
      .order("open_flag_count", { ascending: false });
    if (!error) {
      return {
        rows: Array.isArray(data)
          ? data.map((row, idx) => ({
              id: `summary-${idx}-${String(row?.domain || "unknown")}-${String(row?.reason || "flag")}-${Number(row?.severity || 0)}`,
              _source: "summary_metrics_open_abuse_flags_v1",
              domain: row?.domain || "unknown",
              reason: row?.reason || "flag",
              severity: Number(row?.severity || 0),
              open_flag_count: Number(row?.open_flag_count || 0),
              last_seen_at: row?.last_seen_at || "",
              is_open: true,
            }))
          : [],
        error: "",
      };
    }
    lastErr = error;
  } catch (e) {
    lastErr = e;
  }
  return {
    rows: [],
    error: String(lastErr?.message || lastErr || "Unable to load moderation flags"),
  };
}

function ModalShell({ open, children, zIndex = 9999, panelStyle, fullScreen = false, overlayStyle = null }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: fullScreen ? "var(--sl-ui-modal-bg)" : "rgba(0,0,0,0.4)",
        display: "grid",
        placeItems: fullScreen ? "stretch" : "center",
        zIndex,
        padding: fullScreen ? 0 : 16,
        animation: fullScreen ? "none" : "sl-modal-overlay-enter 140ms ease-out both",
        ...(overlayStyle || {}),
      }}
    >
      <div
        style={{
          background: "var(--sl-ui-modal-bg)",
          border: fullScreen ? "none" : "1px solid var(--sl-ui-modal-border)",
          color: "var(--sl-ui-text)",
          fontFamily: "var(--app-header-font-family)",
          padding: fullScreen
            ? "calc(env(safe-area-inset-top) + 12px) 14px calc(env(safe-area-inset-bottom) + 12px)"
            : 18,
          borderRadius: fullScreen ? 0 : 10,
          width: fullScreen ? "100vw" : "min(360px, 100%)",
          maxWidth: fullScreen ? "100vw" : undefined,
          minWidth: fullScreen ? "100vw" : undefined,
          height: fullScreen ? "100dvh" : undefined,
          maxHeight: fullScreen ? "100dvh" : undefined,
          display: "grid",
          gap: 12,
          boxShadow: fullScreen ? "none" : "var(--sl-ui-modal-shadow)",
          pointerEvents: "auto",
          animation: fullScreen
            ? "sl-mobile-page-enter 155ms cubic-bezier(0.2, 0.8, 0.2, 1) both"
            : "sl-modal-panel-enter 160ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
          ...(panelStyle || {}),
        }}
      >
        {children}
      </div>
    </div>
  );
}

const btnPrimaryDark = {
  padding: 10,
  borderRadius: 10,
  border: "none",
  background: "var(--sl-ui-modal-btn-dark-bg)",
  color: "var(--sl-ui-modal-btn-dark-text)",
  fontWeight: 900,
  cursor: "pointer",
  width: "100%",
};

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

export function ReporterDetailsModal({ open, onClose, reportItem }) {
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

      const uid = String(reportItem?.reporter_user_id || "").trim();
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

      const full = String(data?.full_name || "").trim();
      const phone = String(data?.phone || "").trim();
      const email = String(data?.email || "").trim();
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

  const profileEmailFallback = String(resolvedProfile.email || "").trim();
  const profileNameFallback = profileEmailFallback ? profileEmailFallback.split("@")[0] : "";
  const name =
    String(reportItem?.reporter_name || "").trim() ||
    String(resolvedProfile.name || "").trim() ||
    profileNameFallback ||
    "—";
  const phone =
    String(reportItem?.reporter_phone || "").trim() ||
    String(resolvedProfile.phone || "").trim() ||
    "—";
  const email =
    String(reportItem?.reporter_email || "").trim() ||
    String(resolvedProfile.email || "").trim() ||
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

export function IncidentLocationModal({
  open,
  onClose,
  title = "",
  rows = [],
  loading = false,
  copyHint = "",
  onCopyRow = null,
  copyToast = null,
  showReportToUtility = false,
  onReportToUtility = null,
  reportToUtilityLabel = "Report to Utility",
}) {
  if (!open) return null;

  return (
    <ModalShell open={open} zIndex={10012}>
      <div
        data-incident-location-modal="true"
        style={{ display: "grid", gap: 10, position: "relative" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 950 }}>{title || "Incident Location"}</div>
            <div style={{ fontSize: 12.5, opacity: 0.82, lineHeight: 1.35 }}>
              Incident location information
            </div>
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
            ✕
          </button>
        </div>

        {copyHint ? (
          <div style={{ fontSize: 11.5, opacity: 0.72, lineHeight: 1.35 }}>
            {copyHint}
          </div>
        ) : null}

        {copyToast?.scope === "incident_location_modal" ? (
          <div
            style={{
              position: "absolute",
              top: copyToast?.localY ?? 12,
              left: copyToast?.localX ?? 18,
              zIndex: 2,
              padding: "7px 11px",
              borderRadius: 8,
              border: "1px solid var(--sl-ui-brand-blue-border)",
              background: "var(--sl-ui-brand-blue)",
              color: "white",
              fontSize: 12,
              fontWeight: 900,
              boxShadow: "0 8px 20px rgba(0,0,0,0.24)",
              pointerEvents: "none",
              maxWidth: "calc(100% - 24px)",
            }}
          >
            {copyToast?.text || "Copied to clipboard"}
          </div>
        ) : null}

        <div
          style={{
            border: "1px solid var(--sl-ui-modal-border)",
            borderRadius: 12,
            background: "var(--sl-ui-modal-subtle-bg)",
            overflow: "hidden",
          }}
        >
          {(Array.isArray(rows) ? rows : []).map((row, index) => (
            <button
              key={`${row?.label || "row"}-${index}`}
              type="button"
              onClick={typeof onCopyRow === "function" ? (event) => onCopyRow(row, event.currentTarget) : undefined}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(118px, 0.42fr) minmax(0, 1fr)",
                gap: 10,
                padding: "10px 12px",
                borderBottom: index < rows.length - 1 ? "1px solid var(--sl-ui-modal-border)" : "none",
                fontSize: 12.5,
                lineHeight: 1.35,
                width: "100%",
                textAlign: "left",
                borderLeft: "none",
                borderRight: "none",
                borderTop: "none",
                background: "transparent",
                color: "var(--sl-ui-text)",
                cursor: typeof onCopyRow === "function" ? "copy" : "default",
              }}
            >
              <span style={{ fontWeight: 900, opacity: 0.76 }}>{row?.label}</span>
              <span
                style={{
                  fontWeight: 800,
                  overflowWrap: "anywhere",
                  textDecoration: typeof onCopyRow === "function" ? "underline" : "none",
                  textUnderlineOffset: typeof onCopyRow === "function" ? "2px" : undefined,
                }}
              >
                {row?.value}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ fontSize: 12.5, opacity: 0.82, lineHeight: 1.35 }}>
            Loading location info...
          </div>
        ) : null}

        {showReportToUtility && typeof onReportToUtility === "function" ? (
          <button
            type="button"
            onClick={onReportToUtility}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 12,
              border: "none",
              background: "var(--sl-ui-brand-blue)",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {reportToUtilityLabel}
          </button>
        ) : null}

        <button onClick={onClose} style={{ ...btnPrimaryDark, width: "100%" }}>
          Close
        </button>
      </div>
    </ModalShell>
  );
}

export function AllReportsModal({
  open,
  title,
  items,
  reportRows = [],
  fixActionRows = [],
  issueStateByIncident = {},
  onClose,
  domainKey = "streetlights",
  incidentLabel = "",
  sharedLocation = "",
  sharedAddress = "",
  sharedCrossStreet = "",
  sharedLandmark = "",
  sharedCoordinates = "",
  geoLoading = false,
  currentState = "",
  lastChangedAt = "",
  onCopyField = null,
  isMobile = false,
  preferCompactBehavior = false,
  hideSubmittedBy = false,
  useSubmittedReportFormat = false,
  isWorkingReportType,
  resolveReportIssueLabel,
  runtimeDomainMeta,
}) {
  const [actionProfileByUserId, setActionProfileByUserId] = useState({});
  const [reporterDetails, setReporterDetails] = useState({ open: false, item: null });
  const showCompactMobileLayout = Boolean(isMobile || preferCompactBehavior);
  const handleOpenReporterDetails = useCallback((item) => {
    setReporterDetails({ open: true, item: item || null });
  }, []);
  const handleCloseReporterDetails = useCallback(() => {
    setReporterDetails({ open: false, item: null });
  }, []);
  const resolveReportTypeOptionDetails = (row, domainKeyRaw) => (
    resolveReportTypeOptionDetailsShared(row, domainKeyRaw, runtimeDomainMeta)
  );
  const reportNumberForRow = useCallback((row, domainHint = "") => (
    reportNumberForRowShared(row, domainHint, {
      runtimeDomainMeta,
    })
  ), [runtimeDomainMeta]);
  const effectiveItems = useMemo(() => {
    if (Array.isArray(items) && items.length) return items;

    const normalizedDomainKey = String(domainKey || "streetlights").trim() || "streetlights";
    const next = [];

    for (const row of Array.isArray(reportRows) ? reportRows : []) {
      const rawType = String(row?.type || row?.report_type || "").trim();
      const typeKey = rawType.toLowerCase();
      const issueLabel = typeof resolveReportIssueLabel === "function"
        ? String(resolveReportIssueLabel(row, normalizedDomainKey, issueStateByIncident) || "").trim()
        : "";
      const label = isWorkingReportType(typeKey)
        ? "Reported Working"
        : (issueLabel || REPORT_TYPES[typeKey] || rawType || "Report");
      next.push({
        kind: "report",
        ts: Number(row?.ts || 0),
        label,
        issueLabel,
        note: row?.note || "",
        type: row?.type || row?.report_type || "",
        report_number: reportNumberForRow(row, normalizedDomainKey),
        report_domain: normalizedDomainKey,
        domainKey: normalizedDomainKey,
        reporter_user_id: row?.reporter_user_id || null,
        reporter_name: row?.reporter_name || null,
        reporter_phone: row?.reporter_phone || null,
        reporter_email: row?.reporter_email || null,
      });
    }

    for (const actionRow of Array.isArray(fixActionRows) ? fixActionRows : []) {
      const action = String(actionRow?.action || "").trim().toLowerCase();
      const label = action === "fix"
        ? "Marked fixed"
        : action === "reopen"
          ? "Reported again"
          : "";
      if (!label) continue;
      next.push({
        kind: action,
        ts: Number(actionRow?.ts || 0),
        label,
        note: actionRow?.note || "",
        actor_name: actionRow?.actor_name || actionRow?.reporter_name || null,
        actor_email: actionRow?.actor_email || actionRow?.reporter_email || null,
        actor_phone: actionRow?.actor_phone || actionRow?.reporter_phone || null,
        actor_user_id: actionRow?.actor_user_id || actionRow?.reporter_user_id || null,
      });
    }

    next.sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
    return next;
  }, [
    domainKey,
    fixActionRows,
    isWorkingReportType,
    issueStateByIncident,
    items,
    reportRows,
    reportNumberForRow,
    resolveReportIssueLabel,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!open) return;

    const wanted = Array.from(new Set(
      (effectiveItems || [])
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
  }, [open, effectiveItems, actionProfileByUserId]);

  useEffect(() => {
    if (!open) handleCloseReporterDetails();
  }, [handleCloseReporterDetails, open]);

  return (
    <>
      <ModalShell open={open} zIndex={10010}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "grid", gap: showCompactMobileLayout && incidentLabel ? 2 : 0 }}>
          <div style={{ fontSize: 16, fontWeight: 950 }}>
            {title || "All Reports"}
            {!showCompactMobileLayout && incidentLabel ? ` (${incidentLabel})` : ""}
          </div>
          {showCompactMobileLayout && incidentLabel ? (
            <div style={{ fontSize: 12, lineHeight: 1.3, opacity: 0.78 }}>
              {incidentLabel}
            </div>
          ) : null}
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
          ✕
        </button>
      </div>

      {(String(currentState || "").trim() || String(lastChangedAt || "").trim()) && (
        showCompactMobileLayout ? (
          <div style={{ marginTop: 2, fontSize: 12, lineHeight: 1.35, opacity: 0.92, display: "grid", gap: 2 }}>
            {!!String(currentState || "").trim() && (
              <div><b>Current status:</b> {incidentStateLabel(currentState)}</div>
            )}
            {!!String(lastChangedAt || "").trim() && (
              <div><b>Last updated:</b> {formatTs(lastChangedAt)}</div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 2, fontSize: 12, lineHeight: 1.35, opacity: 0.92 }}>
            {!!String(currentState || "").trim() && (
              <>
                <b>Current status:</b> {incidentStateLabel(currentState)}
              </>
            )}
            {!!String(lastChangedAt || "").trim() && (
              <>
                {!!String(currentState || "").trim() ? " • " : null}
                <b>Last updated:</b> {formatTs(lastChangedAt)}
              </>
            )}
          </div>
        )
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
        {!effectiveItems?.length ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>No history for this light yet.</div>
        ) : (
          effectiveItems.map((it, idx) => {
            const isFix = it.kind === "fix";
            const isReopen = it.kind === "reopen";
            const isWorking = it.kind === "working";
            const isWorkingReport = it.kind === "report" && isWorkingReportType(it.type);
            const imageUrl = readImageUrlFromNote(it.note);
            const displayNote = noteDisplayText(it.note);
            const typeOptionDetails = resolveReportTypeOptionDetails(
              it,
              it?.domainKey || it?.report_domain || it?.domain || ""
            );
            const itemDomainKey = String(it?.domainKey || it?.report_domain || it?.domain || domainKey || "").trim();
            const itemIsStreetlight = itemDomainKey === "streetlights";
            const issueLabel = String(it?.issueLabel || "").trim();
            const qa = parseStreetlightQaFromNote(it.note);
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

            const isPoleDown =
              !isFix &&
              ["downed_pole", "pole_down", "downed-pole"].includes(String(it.type || "").toLowerCase());

            const dot = isFix ? "#111" : (isWorking || isWorkingReport) ? "#2e7d32" : isPoleDown ? "#b71c1c" : "#fbc02d";

            if (useSubmittedReportFormat && (it.kind === "report" || it.kind === "working")) {
              return (
                <div
                  key={`${it.kind}-${it.ts}-${idx}`}
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.08)",
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.15 }}>
                    {it.report_number || reportNumberForRow(it, itemDomainKey)}
                  </div>
                  {!hideSubmittedBy && (
                    <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                      <b>Submitted By:</b>{" "}
                      <button
                        type="button"
                        onClick={() => handleOpenReporterDetails(it)}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          margin: 0,
                          color: "var(--sl-ui-text)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                          cursor: "pointer",
                          fontWeight: 500,
                          fontSize: "inherit",
                          lineHeight: "inherit",
                        }}
                      >
                        {String(it?.reporter_name || "").trim() || String(it?.reporter_email || "").trim() || "Unknown"}
                      </button>
                    </div>
                  )}
                  <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                    <b>Date/Time:</b> {formatDateTime(it.ts)}
                  </div>
                  {itemIsStreetlight ? (
                    <>
                      <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                        <b>What are you seeing:</b> {issueLabel || REPORT_TYPES?.[String(it.type || "").trim()] || "Streetlight issue"}
                      </div>
                      <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                        <b>Power on in area:</b> {qa?.powerOn ? (qa.powerOn === "yes" ? "Yes" : qa.powerOn === "no" ? "No" : "Unknown") : "Unknown"}
                      </div>
                      <div style={{ opacity: 0.9, lineHeight: 1.3 }}>
                        <b>Hazardous situation:</b> {qa?.hazardous ? (qa.hazardous === "yes" ? "Yes" : qa.hazardous === "no" ? "No" : "Unknown") : "Unknown"}
                      </div>
                    </>
                  ) : (
                    <>
                      {!!issueLabel && !hasIssueTypeOptionDetail(typeOptionDetails) && (
                        <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                          <b>Issue Type:</b> {issueLabel}
                        </div>
                      )}
                      <ReportTypeOptionDetails
                        details={typeOptionDetails}
                        textStyle={{ opacity: 0.95, lineHeight: 1.35 }}
                      />
                    </>
                  )}
                  <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                    <b>Notes:</b> {String(displayNote || "").trim() || "—"}
                  </div>
                  <div style={{ opacity: 0.95, lineHeight: 1.35 }}>
                    <b>Image:</b>{" "}
                    {imageUrl ? (
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "var(--sl-ui-text)",
                          textDecoration: "underline",
                          textUnderlineOffset: "2px",
                          fontWeight: 500,
                        }}
                        title="View attached image"
                      >
                        View Image
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
              );
            }

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

                {showCompactMobileLayout ? (
                  <>
                    {!!it.report_number && (
                      <div style={{ fontSize: 11.5, opacity: 0.9, fontWeight: 900 }}>
                        Report #: {it.report_number}
                      </div>
                    )}
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      {formatDateTime(it.ts)}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      {formatDateTime(it.ts)}
                    </div>
                    {!!it.report_number && (
                      <div style={{ fontSize: 11.5, opacity: 0.9, fontWeight: 900 }}>
                        Report #: {it.report_number}
                      </div>
                    )}
                  </>
                )}

                {!!String(it?.issueLabel || "").trim() && String(it?.issueLabel || "").trim() !== String(it?.label || "").trim() && !hasIssueTypeOptionDetail(typeOptionDetails) && (
                  <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
                    <b>Issue type:</b> {it.issueLabel}
                  </div>
                )}
                <ReportTypeOptionDetails
                  details={typeOptionDetails}
                  textStyle={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}
                />

                {!hideSubmittedBy && (it.kind === "report" || it.kind === "working") && (
                  <div style={{ fontSize: 11.5, opacity: 0.9, lineHeight: 1.3 }}>
                    <b>Submitted by:</b>{" "}
                    <button
                      type="button"
                      onClick={() => handleOpenReporterDetails(it)}
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

                {!!String(displayNote || "").trim() && (
                  <div style={{ fontSize: 12, opacity: 0.9, lineHeight: 1.3 }}>
                    <b>Note:</b> {displayNote}
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

                {(isFix || isReopen) && (
                  <div style={{ fontSize: 11.5, opacity: 0.9, lineHeight: 1.3 }}>
                    <b>{isFix ? "Fixed by:" : "Action by:"}</b>{" "}
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenReporterDetails({
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
      <ReporterDetailsModal
        open={reporterDetails.open}
        reportItem={reporterDetails.item}
        onClose={handleCloseReporterDetails}
      />
    </>
  );
}

export function ModerationFlagsModal({
  open,
  onClose,
  isAdmin = false,
  onSummaryRefresh = null,
  isMobile = false,
  pageTopInset = "",
  pageBottomInset = "",
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !isAdmin) {
      setRows([]);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;

    const loadRows = async () => {
      setLoading(true);
      setError("");
      const result = await loadModerationFlagRowsShared();
      if (cancelled) return;
      setRows(result.rows || []);
      setError(String(result.error || "").trim());
      setLoading(false);
    };

    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, open]);

  if (!open) return null;

  const toTsLabel = (row) => {
    const candidates = [
      row?.last_seen_at,
      row?.created_at,
      row?.occurred_at,
      row?.event_ts,
      row?.ts,
      row?.inserted_at,
      row?.updated_at,
    ];
    for (const value of candidates) {
      const parsed = Date.parse(String(value || ""));
      if (Number.isFinite(parsed) && parsed > 0) return formatTs(parsed);
    }
    return "—";
  };

  const isStillOpen = (row) => {
    const closed = String(
      row?.acknowledged_at ||
      row?.reviewed_at ||
      row?.resolved_at ||
      row?.closed_at ||
      row?.cleared_at ||
      ""
    ).trim();
    if (closed) return false;
    const explicit = row?.is_open;
    if (explicit === true) return true;
    if (explicit === false) return false;
    const status = String(row?.status || "").trim().toLowerCase();
    if (status && status !== "open") return false;
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

  const canAcknowledgeRow = (row) => {
    if (!isAdmin) return false;
    if (!isStillOpen(row)) return false;
    if (String(row?._source || "").startsWith("summary")) {
      return Boolean(String(row?.domain || "").trim() && String(row?.reason || "").trim());
    }
    return Number.isFinite(Number(row?.id));
  };

  const refreshRows = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    const result = await loadModerationFlagRowsShared();
    setRows(result.rows || []);
    setError(String(result.error || "").trim());
    setLoading(false);
  };

  const promptAcknowledge = async (row) => {
    if (!canAcknowledgeRow(row)) return;
    const note = window.prompt("Optional close note", "");
    if (note === null) return;
    const id = Number(row?.id);
    const source = String(row?._source || (row?.status ? "abuse_anomaly_flags" : "abuse_events")).trim() || "abuse_events";
    const cleanNote = String(note || "").trim();
    const summaryMode = source.startsWith("summary");
    const summaryDomain = String(row?.domain || "").trim();
    const summaryReason = String(row?.reason || row?.event_type || row?.flag_type || "").trim();

    if (!summaryMode && !Number.isFinite(id)) return;
    if (summaryMode && (!summaryDomain || !summaryReason)) return;

    setError("");
    setLoading(true);
    let saved = false;
    let lastErr = null;

    try {
      if (summaryMode) {
        const { data, error: summaryError } = await supabase.rpc("acknowledge_moderation_flag_summary", {
          p_domain: summaryDomain,
          p_reason: summaryReason,
          p_note: cleanNote || null,
        });
        if (summaryError) {
          lastErr = summaryError;
        } else {
          saved = Number(data || 0) > 0;
          if (!saved) lastErr = new Error("No open moderation flags matched this summary");
        }
      } else {
        const { data, error: ackError } = await supabase.rpc("acknowledge_moderation_flag", {
          p_source: source,
          p_id: id,
          p_note: cleanNote || null,
        });
        if (ackError) {
          lastErr = ackError;
        } else {
          saved = data !== false;
        }
      }
    } catch (ackErr) {
      lastErr = ackErr;
    }

    if (summaryMode && !saved && isExpectedPermissionError(lastErr)) {
      const reloadResult = await loadModerationFlagRowsShared();
      const stillOpen = (reloadResult.rows || []).some((item) => String(item?.domain || "").trim() === summaryDomain
        && String(item?.reason || item?.event_type || item?.flag_type || "").trim() === summaryReason);
      if (!stillOpen) {
        saved = true;
      } else {
        lastErr = lastErr || new Error("Summary moderation flag still appears open");
      }
      setRows(reloadResult.rows || []);
      setError(String(reloadResult.error || "").trim());
    }

    if (saved) {
      setRows((prev) => {
        if (summaryMode) {
          return (prev || []).filter((item) => !(String(item?._source || "").startsWith("summary")
            && String(item?.domain || "").trim() === summaryDomain
            && String(item?.reason || "").trim() === summaryReason));
        }
        return (prev || []).filter((item) => String(item?.id) !== String(id) || String(item?._source || source) !== source);
      });
      if (typeof onSummaryRefresh === "function") {
        await onSummaryRefresh();
      }
      await refreshRows();
      return;
    }

    setError(String(lastErr?.message || lastErr || "Unable to acknowledge moderation flag"));
    setLoading(false);
  };

  const detailForRow = (row) => {
    if (Number.isFinite(Number(row?.open_flag_count || 0)) && Number(row?.open_flag_count || 0) > 0) {
      const count = Math.max(0, Number(row?.open_flag_count || 0));
      return `${count} open moderation flag${count === 1 ? "" : "s"} in summary view.`;
    }
    return String(
      row?.message ||
      row?.details ||
      row?.note ||
      row?.context ||
      row?.source ||
      ""
    ).trim();
  };

  const severityTone = (row) => {
    const severity = Math.max(0, Number(row?.severity || 0));
    if (severity >= 3) {
      return {
        bg: "rgba(183, 28, 28, 0.16)",
        border: "rgba(183, 28, 28, 0.42)",
        text: "#ff8a80",
      };
    }
    if (severity >= 2) {
      return {
        bg: "rgba(239, 108, 0, 0.16)",
        border: "rgba(239, 108, 0, 0.42)",
        text: "#ffb74d",
      };
    }
    return {
      bg: "rgba(46, 125, 50, 0.14)",
      border: "rgba(46, 125, 50, 0.40)",
      text: "#81c784",
    };
  };

  return (
    <ModalShell
      open={open}
      zIndex={10011}
      overlayStyle={
        isMobile
          ? {
              padding: `${pageTopInset || "16px"} 10px ${pageBottomInset || "16px"}`,
            }
          : null
      }
      panelStyle={{
        width: isMobile ? "min(calc(100vw - 20px), 420px)" : "min(980px, calc(100vw - 32px))",
        maxWidth: isMobile ? "420px" : "980px",
        minWidth: isMobile ? "min(calc(100vw - 20px), 320px)" : "min(680px, calc(100vw - 32px))",
        height: isMobile ? "auto" : "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)",
        maxHeight: isMobile
          ? `calc(100dvh - ${pageTopInset || "16px"} - ${pageBottomInset || "16px"})`
          : "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 20px)",
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
        <div style={{ fontSize: 12.5, opacity: 0.85, lineHeight: 1.35 }}>
          Admin-only telemetry view of active/recorded moderation events.
        </div>
        <button
          type="button"
          onClick={() => void refreshRows()}
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
        ) : isMobile ? (
          <div style={{ padding: 10, display: "grid", gap: 10 }}>
            {rows.map((row, idx) => {
              const tone = severityTone(row);
              return (
                <div
                  key={`${String(row?.id || "flag")}-${idx}`}
                  style={{
                    border: "1px solid var(--sl-ui-open-reports-item-border)",
                    borderRadius: 12,
                    padding: "10px 11px",
                    display: "grid",
                    gap: 9,
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.66, fontWeight: 900 }}>
                        {domainForRow(row)}
                      </div>
                      <div style={{ fontSize: 14.5, fontWeight: 900, lineHeight: 1.2, wordBreak: "break-word" }}>
                        {reasonForRow(row)}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "4px 8px",
                        borderRadius: 999,
                        background: tone.bg,
                        border: `1px solid ${tone.border}`,
                        color: tone.text,
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                    >
                      Severity {Math.max(0, Number(row?.severity || 0))}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontSize: 12.5, lineHeight: 1.35 }}>
                      <b>Status:</b> {isStillOpen(row) ? "Open" : "Closed"}
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.35 }}>
                      <b>Last seen:</b> {toTsLabel(row)}
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                      <b>Details:</b> {detailForRow(row) || "—"}
                    </div>
                  </div>
                  {canAcknowledgeRow(row) ? (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => promptAcknowledge(row)}
                        style={{
                          padding: "8px 11px",
                          borderRadius: 10,
                          border: "1px solid rgba(31,122,95,0.65)",
                          background: "rgba(31,122,95,0.24)",
                          color: "var(--sl-ui-modal-text)",
                          fontWeight: 950,
                          cursor: "pointer",
                        }}
                      >
                        Close flag
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
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
                <th style={{ textAlign: "right", padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)" }}>Action</th>
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
                  <td style={{ padding: "8px 10px", borderBottom: "1px solid var(--sl-ui-open-reports-item-border)", textAlign: "right" }}>
                    {canAcknowledgeRow(row) ? (
                      <button
                        type="button"
                        onClick={() => promptAcknowledge(row)}
                        style={{
                          padding: "6px 9px",
                          borderRadius: 8,
                          border: "1px solid rgba(31,122,95,0.65)",
                          background: "rgba(31,122,95,0.20)",
                          color: "var(--sl-ui-modal-text)",
                          fontWeight: 900,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Close flag
                      </button>
                    ) : "—"}
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

export function LocationDiagnosticsModal({
  open,
  onClose,
  debug,
  onCopy,
  isMobile = false,
  pageTopInset = "16px",
  pageBottomInset = "16px",
}) {
  if (!open) return null;

  const d = debug || {};
  const formatNumber = (value, digits = 1, suffix = "") => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "—";
    return `${num.toFixed(digits)}${suffix}`;
  };
  const formatCoord = (value) => formatNumber(value, 6);
  const formatAge = (value) => {
    const ms = Number(value);
    if (!Number.isFinite(ms)) return "—";
    if (ms < 1000) return `${Math.max(0, Math.round(ms))} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  };
  const updatedAt = Number(d.updatedAt || 0);
  const speedMps = Number(d.speedMps);
  const rows = [
    ["Status", String(d.status || "Waiting for location")],
    ["Prediction", d.predictionActive ? "Active" : "Inactive"],
    ["Follow camera", d.followCamera ? "On" : "Off"],
    ["Travel follow", d.travelFollowMode ? "On" : "Off"],
    ["Raw position", Number.isFinite(Number(d.rawLat)) && Number.isFinite(Number(d.rawLng)) ? `${formatCoord(d.rawLat)}, ${formatCoord(d.rawLng)}` : "—"],
    ["Display position", Number.isFinite(Number(d.displayLat)) && Number.isFinite(Number(d.displayLng)) ? `${formatCoord(d.displayLat)}, ${formatCoord(d.displayLng)}` : "—"],
    ["Raw to display", formatNumber(d.rawToDisplayM, 1, " m")],
    ["GPS accuracy", formatNumber(d.accuracyM, 1, " m")],
    ["Speed", Number.isFinite(speedMps) ? `${formatNumber(speedMps, 2, " m/s")} / ${formatNumber(speedMps * 2.236936, 1, " mph")}` : "—"],
    ["Heading", formatNumber(d.headingDeg, 1, "°")],
    ["Follow heading", formatNumber(d.followHeadingDeg, 1, "°")],
    ["Raw heading", formatNumber(d.rawHeadingDeg, 1, "°")],
    ["Heading accuracy", formatNumber(d.headingAccuracyDeg, 1, "°")],
    ["GPS fix age", formatAge(d.fixAgeMs)],
    ["Moved from last fix", formatNumber(d.movedMeters, 1, " m")],
    ["Stationary drift", formatNumber(d.stationaryDriftM, 1, " m")],
    ["Stationary lock", d.stationaryLocked ? "On" : "Off"],
    ["Last update", updatedAt ? new Date(updatedAt).toLocaleTimeString() : "—"],
  ];

  return (
    <ModalShell
      open={open}
      zIndex={10064}
      overlayStyle={
        isMobile
          ? { padding: `${pageTopInset || "16px"} 10px ${pageBottomInset || "16px"}` }
          : null
      }
      panelStyle={{
        width: isMobile ? "min(calc(100vw - 20px), 430px)" : "min(520px, calc(100vw - 32px))",
        maxHeight: isMobile
          ? `calc(100dvh - ${pageTopInset || "16px"} - ${pageBottomInset || "16px"})`
          : "min(86vh, 760px)",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "auto auto minmax(0, 1fr)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "grid", gap: 3 }}>
          <div style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.1 }}>Location Diagnostics</div>
          <div style={{ fontSize: 12.5, opacity: 0.78, lineHeight: 1.35 }}>
            Admin-only field test readout for GPS, heading, smoothing, and prediction.
          </div>
        </div>
        <button
          type="button"
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
          aria-label="Close location diagnostics"
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          type="button"
          onClick={onCopy}
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
          Copy Debug
        </button>
      </div>

      <div
        style={{
          marginTop: 10,
          overflow: "auto",
          border: "1px solid var(--sl-ui-modal-border)",
          borderRadius: 12,
          background: "var(--sl-ui-modal-subtle-bg)",
        }}
      >
        {rows.map(([label, value]) => (
          <div
            key={label}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(116px, 0.42fr) minmax(0, 1fr)",
              gap: 10,
              padding: "9px 11px",
              borderBottom: "1px solid var(--sl-ui-modal-border)",
              fontSize: 12.5,
              lineHeight: 1.35,
            }}
          >
            <span style={{ fontWeight: 900, opacity: 0.72 }}>{label}</span>
            <span style={{ fontWeight: 800, overflowWrap: "anywhere" }}>{value}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}
