import React from "react";
import { COMMUNITY_FEED_STATUS_OPTIONS } from "./lib/mapCommunityFeedSupport.js";
import { loadCommunityFeedAccessPermissions } from "./lib/mapCommunityFeedAccessSupport";
import {
  coerceResidentFeedDateTime,
  makeCommunityFeedForm,
  residentCommunityStatusDescription,
  residentCommunityStatusTone,
  toResidentFeedDateInputValue,
  trimResidentFeedValue,
} from "./lib/mapResidentFeedSupport";

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

export function CommunityFeedEditorModal({
  open,
  kind = "alert",
  mode = "create",
  topics = [],
  form,
  setForm,
  saving = false,
  deleting = false,
  canDelete = false,
  error = "",
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  onClose,
  onDelete,
  onSubmit,
  communityFeedStatusOptions = [],
}) {
  const isEvent = kind === "event";
  const actionPending = saving || deleting;
  const showDelete = mode === "edit" && canDelete && typeof onDelete === "function";
  const canSchedule = mode !== "edit" || String(form?.status || "").trim().toLowerCase() === "scheduled";
  const statusOptions = canSchedule
    ? communityFeedStatusOptions
    : communityFeedStatusOptions.filter((option) => option.value !== "scheduled");
  const title = `${mode === "edit" ? "Edit" : "Create"} ${isEvent ? "Event" : "Alert"}`;
  const fieldStyle = {
    display: "grid",
    gap: 6,
    minWidth: 0,
  };
  const labelStyle = {
    fontSize: 11.5,
    fontWeight: 900,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    opacity: 0.78,
  };
  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 42,
    borderRadius: 12,
    border: darkMode ? "1px solid rgba(143, 170, 198, 0.2)" : "1px solid rgba(23, 49, 79, 0.14)",
    background: darkMode ? "rgba(13, 24, 36, 0.74)" : "rgba(255, 255, 255, 0.96)",
    color: "var(--sl-ui-text)",
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 750,
    fontFamily: "var(--app-header-font-family)",
    outline: "none",
  };
  const secondaryButtonStyle = {
    minHeight: 36,
    borderRadius: 10,
    border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
    background: "var(--sl-ui-modal-btn-secondary-bg)",
    color: "var(--sl-ui-modal-btn-secondary-text)",
    fontWeight: 900,
    cursor: actionPending ? "default" : "pointer",
  };
  const primaryButtonStyle = {
    minHeight: 36,
    borderRadius: 10,
    border: "1px solid rgba(95, 208, 180, 0.24)",
    background: "linear-gradient(180deg, rgba(31, 132, 113, 0.98) 0%, rgba(24, 108, 94, 0.98) 100%)",
    color: "#fff",
    fontWeight: 950,
    cursor: actionPending ? "default" : "pointer",
  };
  const destructiveButtonStyle = {
    minHeight: 36,
    borderRadius: 10,
    border: darkMode ? "1px solid rgba(248, 113, 113, 0.4)" : "1px solid rgba(185, 28, 28, 0.22)",
    background: darkMode ? "rgba(127, 29, 29, 0.36)" : "rgba(254, 226, 226, 0.92)",
    color: darkMode ? "#fecaca" : "#991b1b",
    fontWeight: 950,
    cursor: actionPending ? "default" : "pointer",
  };
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setPublishingStatus = (nextStatus) => {
    const normalized = String(nextStatus || "published").trim().toLowerCase();
    setForm((prev) => {
      const next = { ...prev, status: normalized };
      if (normalized === "scheduled" && !String(next.publish_at || "").trim()) {
        next.publish_at = toResidentFeedDateInputValue(new Date(Date.now() + 60 * 60 * 1000));
      }
      return next;
    });
  };

  return (
    <ModalShell
      open={open}
      zIndex={10070}
      fullScreen={pageMode}
      overlayStyle={pageMode ? {
        top: pageTopInset,
        left: 0,
        right: 0,
        bottom: pageBottomInset,
        inset: "unset",
        background: "var(--sl-ui-modal-bg)",
        display: "block",
        overflowX: "hidden",
      } : null}
      panelStyle={{
        width: pageMode ? "100%" : "min(620px, 100%)",
        height: pageMode ? "100%" : undefined,
        maxWidth: "100%",
        maxHeight: pageMode ? undefined : "min(88vh, 840px)",
        borderRadius: pageMode ? 0 : 22,
        padding: 0,
        overflow: "hidden",
        overflowX: "hidden",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          display: "grid",
          gridTemplateRows: "auto minmax(0, 1fr) auto",
          height: pageMode ? "100%" : undefined,
          maxHeight: pageMode ? undefined : "min(88vh, 840px)",
          minHeight: 0,
          width: "100%",
          maxWidth: "100%",
          overflowX: "hidden",
          color: "var(--sl-ui-text)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            padding: pageMode ? "14px" : "20px 20px 16px",
            borderBottom: darkMode ? "1px solid rgba(143, 170, 198, 0.16)" : "1px solid rgba(23, 49, 79, 0.08)",
          }}
        >
          <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "#53c3a7", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              {isEvent ? "Community Event" : "Location Alert"}
            </div>
            <div style={{ fontSize: 22, fontWeight: 950, lineHeight: 1.1 }}>{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={actionPending}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              border: "1px solid var(--sl-ui-modal-btn-secondary-border)",
              background: "var(--sl-ui-modal-btn-secondary-bg)",
              color: "var(--sl-ui-modal-btn-secondary-text)",
              fontWeight: 900,
              cursor: actionPending ? "default" : "pointer",
              flex: "0 0 auto",
            }}
            aria-label={`Close ${title}`}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", overflowX: "hidden", minHeight: 0, minWidth: 0, padding: pageMode ? "14px" : "18px 20px", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: pageMode ? "1fr" : "1fr 1fr", gap: 12 }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Topic</span>
              <select
                value={form.topic_key}
                onChange={(event) => setField("topic_key", event.target.value)}
                style={inputStyle}
              >
                {topics.map((topic) => (
                  <option key={topic.topic_key} value={topic.topic_key}>
                    {topic.label || topic.topic_key}
                  </option>
                ))}
              </select>
            </label>
            {!isEvent ? (
              <label style={fieldStyle}>
                <span style={labelStyle}>Severity</span>
                <select value={form.severity} onChange={(event) => setField("severity", event.target.value)} style={inputStyle}>
                  <option value="info">Info</option>
                  <option value="advisory">Advisory</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </label>
            ) : (
              <label style={{ ...fieldStyle, alignContent: "end" }}>
                <span style={labelStyle}>Event Type</span>
                <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 42, fontSize: 13, fontWeight: 850 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.all_day)}
                    onChange={(event) => setField("all_day", event.target.checked)}
                  />
                  All day event
                </label>
              </label>
            )}
          </div>

          <label style={fieldStyle}>
            <span style={labelStyle}>Title</span>
            <input
              value={form.title}
              onChange={(event) => setField("title", event.target.value)}
              placeholder={isEvent ? "Memorial Day parade" : "Water main repair on Lake Ave"}
              style={inputStyle}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Summary</span>
            <textarea
              value={form.summary}
              onChange={(event) => setField("summary", event.target.value)}
              placeholder="Short resident-facing summary"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", minHeight: 76 }}
            />
          </label>

          <label style={fieldStyle}>
            <span style={labelStyle}>Details</span>
            <textarea
              value={form.body}
              onChange={(event) => setField("body", event.target.value)}
              placeholder={isEvent ? "Parking guidance, route info, and resident expectations." : "What residents should expect and what action they should take."}
              rows={4}
              style={{ ...inputStyle, resize: "vertical", minHeight: 98 }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: pageMode ? "1fr" : "1fr 1fr", gap: 12 }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Starts</span>
              <input type="datetime-local" value={form.starts_at} onChange={(event) => setField("starts_at", event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Ends</span>
              <input type="datetime-local" value={form.ends_at} onChange={(event) => setField("ends_at", event.target.value)} style={inputStyle} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: pageMode ? "1fr" : "1fr 1fr", gap: 12 }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>Location Name</span>
              <input value={form.location_name} onChange={(event) => setField("location_name", event.target.value)} placeholder="City Hall, Lake Ave, etc." style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Location Address</span>
              <input value={form.location_address} onChange={(event) => setField("location_address", event.target.value)} placeholder="Optional address" style={inputStyle} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: pageMode ? "1fr" : "1fr 1fr", gap: 12 }}>
            <label style={fieldStyle}>
              <span style={labelStyle}>CTA Label</span>
              <input value={form.cta_label} onChange={(event) => setField("cta_label", event.target.value)} placeholder="More details" style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>CTA URL</span>
              <input value={form.cta_url} onChange={(event) => setField("cta_url", event.target.value)} placeholder="https://..." style={inputStyle} />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: pageMode ? "1fr" : (isEvent ? "1fr" : "minmax(0, 0.72fr) minmax(0, 1.28fr)"),
              gap: 12,
              alignItems: "stretch",
            }}
          >
            {!isEvent ? (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 42,
                  fontSize: 13,
                  fontWeight: 850,
                  borderRadius: 14,
                  border: darkMode ? "1px solid rgba(143, 170, 198, 0.16)" : "1px solid rgba(23, 49, 79, 0.1)",
                  background: darkMode ? "rgba(13, 24, 36, 0.4)" : "rgba(255, 255, 255, 0.6)",
                  padding: "10px 12px",
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(form.pinned)}
                  disabled={actionPending}
                  onChange={(event) => setField("pinned", event.target.checked)}
                />
                Pin at top
              </label>
            ) : null}
            <div style={{ ...fieldStyle, gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={labelStyle}>Publishing</span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 850,
                    color: residentCommunityStatusTone(form.status, darkMode).color,
                  }}
                >
                  {residentCommunityStatusDescription(form.status)}
                </span>
              </div>
              <div
                role="group"
                aria-label={`${isEvent ? "Event" : "Alert"} publishing status`}
                style={{
                  display: "grid",
                  gridTemplateColumns: pageMode ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
                  gap: 6,
                  padding: 5,
                  borderRadius: 14,
                  border: darkMode ? "1px solid rgba(143, 170, 198, 0.16)" : "1px solid rgba(23, 49, 79, 0.1)",
                  background: darkMode ? "rgba(13, 24, 36, 0.54)" : "rgba(239, 245, 250, 0.92)",
                }}
              >
                {statusOptions.map((option) => {
                  const active = String(form.status || "").trim().toLowerCase() === option.value;
                  const tone = residentCommunityStatusTone(option.value, darkMode);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={actionPending}
                      onClick={() => setPublishingStatus(option.value)}
                      style={{
                        minHeight: 38,
                        borderRadius: 11,
                        border: active ? `1px solid ${tone.border}` : "1px solid transparent",
                        background: active ? tone.bg : "transparent",
                        color: active ? tone.color : "var(--sl-ui-text)",
                        fontSize: 12,
                        fontWeight: 950,
                        cursor: actionPending ? "default" : "pointer",
                        opacity: actionPending && !active ? 0.58 : 1,
                      }}
                      aria-pressed={active}
                      title={option.description}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {canSchedule && String(form.status || "").trim().toLowerCase() === "scheduled" ? (
            <label style={fieldStyle}>
              <span style={labelStyle}>Publish At</span>
              <input
                type="datetime-local"
                value={form.publish_at}
                onChange={(event) => setField("publish_at", event.target.value)}
                style={inputStyle}
              />
            </label>
          ) : null}

          {error ? (
            <div style={{ color: darkMode ? "#ffb4b4" : "#b23a48", fontSize: 13, fontWeight: 800, lineHeight: 1.4 }}>
              {error}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            padding: pageMode ? "8px 14px 9px" : "12px 20px 14px",
            borderTop: darkMode ? "1px solid rgba(143, 170, 198, 0.16)" : "1px solid rgba(23, 49, 79, 0.08)",
            background: "var(--sl-ui-modal-bg)",
            position: pageMode ? "sticky" : "static",
            bottom: 0,
            zIndex: 2,
          }}
        >
          {showDelete ? (
            <button
              type="button"
              onClick={onDelete}
              disabled={actionPending}
              style={{ ...destructiveButtonStyle, gridColumn: "1 / -1" }}
            >
              {deleting ? "Deleting…" : `Delete ${isEvent ? "Event" : "Alert"}`}
            </button>
          ) : null}
          <button type="button" onClick={onClose} disabled={actionPending} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button type="submit" disabled={actionPending} style={primaryButtonStyle}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function shouldSendResidentNotificationEmail(currentStatus, nextStatus) {
  const previous = trimResidentFeedValue(currentStatus).toLowerCase();
  const next = trimResidentFeedValue(nextStatus).toLowerCase();
  return next === "published" && previous !== "published";
}

async function triggerResidentNotificationEmail({ supabase, kind, item }) {
  const safeKind = kind === "event" ? "event" : "alert";
  const safeItem = item && typeof item === "object" ? item : null;
  if (!safeItem || trimResidentFeedValue(safeItem.status).toLowerCase() !== "published") {
    return { ok: true, skipped: true, reason: "status_not_published" };
  }

  const { data, error } = await supabase.functions.invoke("send-resident-notification", {
    body: {
      tenant_key: trimResidentFeedValue(safeItem.tenant_key),
      kind: safeKind,
      item: safeItem,
    },
  });

  if (error) {
    return {
      ok: false,
      error: trimResidentFeedValue(error.message) || "Could not send resident email notifications.",
    };
  }
  if (data?.ok === false) {
    return {
      ok: false,
      error: trimResidentFeedValue(data?.error) || "Could not send resident email notifications.",
    };
  }
  return {
    ok: true,
    skipped: Boolean(data?.skipped),
    sentCount: Number(data?.sent_count || 0),
    attemptedCount: Number(data?.attempted_count || 0),
    failures: Array.isArray(data?.failures) ? data.failures : [],
    reason: trimResidentFeedValue(data?.reason),
  };
}

export function CommunityFeedEditorController({
  open,
  kind = "alert",
  mode = "create",
  item = null,
  allTopics = [],
  darkMode = false,
  pageMode = false,
  pageTopInset = "0px",
  pageBottomInset = "0px",
  onClose,
  supabase,
  resolvedCommunityFeedTenantKey = "",
  sessionUserId = "",
  loadMapCommunityFeed,
  openNotice,
}) {
  const safeKind = kind === "event" ? "event" : "alert";
  const topics = React.useMemo(
    () => (Array.isArray(allTopics) ? allTopics : []).filter(
      (topic) => String(topic?.topic_kind || "").trim().toLowerCase() === safeKind
    ),
    [allTopics, safeKind]
  );
  const [form, setForm] = React.useState(() => makeCommunityFeedForm(safeKind, topics, item));
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [canManage, setCanManage] = React.useState(false);
  const [canDelete, setCanDelete] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setForm(makeCommunityFeedForm(safeKind, topics, item));
    setError("");
  }, [item, open, safeKind, topics]);

  React.useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      if (!open) {
        setCanManage(false);
        setCanDelete(false);
        return;
      }
      const next = await loadCommunityFeedAccessPermissions({
        supabase,
        tenantKey: resolvedCommunityFeedTenantKey,
        userId: sessionUserId,
        onWarn: (label, issue) => console.warn(label, issue?.message || issue),
      });
      if (cancelled) return;
      setCanManage(next.canManage);
      setCanDelete(next.canDelete && next.canManage);
    }

    void loadAccess();
    return () => {
      cancelled = true;
    };
  }, [open, resolvedCommunityFeedTenantKey, sessionUserId, supabase]);

  React.useEffect(() => {
    if (!open || !topics.length) return;
    const currentKey = trimResidentFeedValue(form.topic_key);
    if (currentKey && topics.some((topic) => trimResidentFeedValue(topic?.topic_key) === currentKey)) return;
    setForm((prev) => ({ ...prev, topic_key: trimResidentFeedValue(topics[0]?.topic_key) }));
  }, [form.topic_key, open, topics]);

  const actionPending = saving || deleting;

  const handleClose = React.useCallback(() => {
    if (actionPending) return;
    onClose?.();
  }, [actionPending, onClose]);

  const handleSubmit = React.useCallback(async (event) => {
    event.preventDefault();
    if (!canManage || actionPending || !supabase) return;
    const isEvent = safeKind === "event";
    const isEditing = mode === "edit" && item?.id;
    const tenantKey = trimResidentFeedValue(resolvedCommunityFeedTenantKey);
    if (!tenantKey) {
      setError("Tenant is not ready yet.");
      return;
    }

    const basePayload = {
      tenant_key: tenantKey,
      topic_key: trimResidentFeedValue(form.topic_key),
      title: trimResidentFeedValue(form.title),
      summary: trimResidentFeedValue(form.summary),
      body: trimResidentFeedValue(form.body),
      location_name: trimResidentFeedValue(form.location_name),
      location_address: trimResidentFeedValue(form.location_address),
      cta_label: trimResidentFeedValue(form.cta_label),
      cta_url: trimResidentFeedValue(form.cta_url),
      status: trimResidentFeedValue(form.status) || "published",
      starts_at: coerceResidentFeedDateTime(form.starts_at),
      ends_at: coerceResidentFeedDateTime(form.ends_at),
      delivery_channels: ["in_app", "email"],
    };

    if (!basePayload.topic_key || !basePayload.title) {
      setError(`${isEvent ? "Event" : "Alert"} title and topic are required.`);
      return;
    }
    if (isEvent && !basePayload.starts_at) {
      setError("Event start time is required.");
      return;
    }
    const currentItem = item || null;
    const currentStatus = trimResidentFeedValue(currentItem?.status).toLowerCase();
    if (isEditing && currentStatus !== "scheduled" && basePayload.status === "scheduled") {
      setError("Scheduling is only available before an alert or event has been published.");
      return;
    }
    const scheduledPublishAt = coerceResidentFeedDateTime(form.publish_at);
    if (basePayload.status === "scheduled") {
      if (!scheduledPublishAt) {
        setError("Choose when this should publish.");
        return;
      }
      if (new Date(scheduledPublishAt).getTime() <= Date.now()) {
        setError("Scheduled publish time must be in the future.");
        return;
      }
    }

    const payload = isEvent
      ? {
          ...basePayload,
          all_day: Boolean(form.all_day),
        }
      : {
          ...basePayload,
          severity: trimResidentFeedValue(form.severity) || "info",
          pinned: Boolean(form.pinned),
        };
    payload.published_at = payload.status === "scheduled"
      ? scheduledPublishAt
      : trimResidentFeedValue(currentItem?.status).toLowerCase() === "published" && currentItem?.published_at
        ? currentItem.published_at
        : payload.status === "published"
          ? new Date().toISOString()
          : null;

    const shouldSendEmail = shouldSendResidentNotificationEmail(currentStatus, payload.status);
    setSaving(true);
    setError("");
    const tableName = isEvent ? "municipality_events" : "municipality_alerts";
    const query = isEditing
      ? supabase.from(tableName).update(payload).eq("tenant_key", tenantKey).eq("id", item.id).select("*").single()
      : supabase.from(tableName).insert([payload]).select("*").single();
    const { data: savedItem, error: saveError } = await query;
    setSaving(false);

    if (saveError) {
      setError(saveError.message || `Could not save the ${isEvent ? "event" : "alert"}.`);
      return;
    }

    onClose?.();
    let successMessage = `${isEvent ? "Event" : "Alert"} was saved successfully.`;
    if (shouldSendEmail) {
      const notificationResult = await triggerResidentNotificationEmail({
        supabase,
        kind: safeKind,
        item: savedItem && typeof savedItem === "object" ? savedItem : {
          id: item?.id || null,
          ...payload,
        },
      });
      if (!notificationResult.ok) {
        successMessage = `${successMessage} Resident email notifications were not sent: ${notificationResult.error}`;
      } else if (!notificationResult.skipped) {
        successMessage = `${successMessage} Resident email notifications sent to ${notificationResult.sentCount} subscriber${notificationResult.sentCount === 1 ? "" : "s"}.`;
      }
    }
    openNotice?.("✅", isEvent ? "Event saved" : "Alert saved", successMessage, {
      autoCloseMs: successMessage.includes("Resident email notifications") ? 3200 : 1400,
      compact: !successMessage.includes("Resident email notifications"),
    });
    await loadMapCommunityFeed?.();
  }, [
    actionPending,
    canManage,
    form,
    item,
    loadMapCommunityFeed,
    mode,
    onClose,
    openNotice,
    resolvedCommunityFeedTenantKey,
    safeKind,
    sessionUserId,
    supabase,
  ]);

  const handleDelete = React.useCallback(async () => {
    if (!canDelete || actionPending || !supabase) return;
    const isEvent = safeKind === "event";
    const itemId = item?.id;
    const tenantKey = trimResidentFeedValue(resolvedCommunityFeedTenantKey);
    if (!tenantKey || !itemId) {
      setError(`${isEvent ? "Event" : "Alert"} is not ready to delete yet.`);
      return;
    }

    const itemTitle = trimResidentFeedValue(item?.title) || `this ${isEvent ? "event" : "alert"}`;
    const confirmed = typeof window === "undefined" || window.confirm(`Delete "${itemTitle}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    const tableName = isEvent ? "municipality_events" : "municipality_alerts";
    const { error: deleteError } = await supabase
      .from(tableName)
      .delete()
      .eq("tenant_key", tenantKey)
      .eq("id", itemId);
    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message || `Could not delete the ${isEvent ? "event" : "alert"}.`);
      return;
    }

    onClose?.();
    openNotice?.("✅", isEvent ? "Event deleted" : "Alert deleted", `${isEvent ? "Event" : "Alert"} was deleted.`, {
      autoCloseMs: 1400,
      compact: true,
    });
    await loadMapCommunityFeed?.();
  }, [
    actionPending,
    canDelete,
    item,
    loadMapCommunityFeed,
    onClose,
    openNotice,
    resolvedCommunityFeedTenantKey,
    safeKind,
    sessionUserId,
    supabase,
  ]);

  return (
    <CommunityFeedEditorModal
      open={open}
      kind={safeKind}
      mode={mode}
      topics={topics}
      form={form}
      setForm={setForm}
      saving={saving}
      deleting={deleting}
      canDelete={canDelete}
      error={error}
      darkMode={darkMode}
      pageMode={pageMode}
      pageTopInset={pageTopInset}
      pageBottomInset={pageBottomInset}
      onClose={handleClose}
      onDelete={handleDelete}
      onSubmit={handleSubmit}
      communityFeedStatusOptions={COMMUNITY_FEED_STATUS_OPTIONS}
    />
  );
}
