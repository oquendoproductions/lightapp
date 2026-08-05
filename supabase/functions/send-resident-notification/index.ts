import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version, x-tenant-key",
};

type ResidentNotificationKind = "alert" | "event" | "report_update";

type ResidentNotificationItem = {
  id?: number | string | null;
  tenant_key?: string | null;
  topic_key?: string | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  severity?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  published_at?: string | null;
  all_day?: boolean | null;
  status?: string | null;
  domain?: string | null;
  incident_id?: string | null;
  new_state?: string | null;
  report_number?: string | null;
  state_label?: string | null;
  delivery_channels?: string[] | null;
};

type ResidentProfileRow = {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
};

type TopicRow = {
  topic_key: string;
  label?: string | null;
  default_enabled?: boolean | null;
};

type ResidentPreferenceRow = {
  user_id: string;
  in_app_enabled?: boolean | null;
  email_enabled?: boolean | null;
  web_push_enabled?: boolean | null;
};

type NativePushTokenRow = {
  user_id: string;
  token: string;
  platform?: string | null;
};

function dedupeUserIds(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values || []) {
    const normalized = trimOrEmpty(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function trimOrEmpty(raw: unknown): string {
  return String(raw || "").trim();
}

function normalizeTenantKey(raw: unknown): string {
  return trimOrEmpty(raw).toLowerCase().replace(/[^a-z0-9-]/g, "");
}

function normalizeEmail(raw: unknown): string {
  return trimOrEmpty(raw).toLowerCase();
}

function clipText(raw: unknown, maxLen = 900): string {
  const value = trimOrEmpty(raw);
  if (!value) return "";
  return value.length <= maxLen ? value : `${value.slice(0, maxLen)}...`;
}

function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !service) throw new Error("Missing Supabase service role configuration");
  return createClient(url, service, { auth: { persistSession: false } });
}

async function requireResidentNotificationAccess(
  req: Request,
  admin: SupabaseClient,
  tenantKey: string,
) {
  const authHeader = trimOrEmpty(req.headers.get("authorization"));
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, response: json({ ok: false, error: "Missing bearer token." }, 401) };
  }

  const token = trimOrEmpty(authHeader.slice(7));
  if (!token) {
    return { ok: false, response: json({ ok: false, error: "Missing bearer token." }, 401) };
  }

  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  if (userError || !trimOrEmpty(userResult?.user?.id)) {
    return { ok: false, response: json({ ok: false, error: "Invalid session." }, 401) };
  }

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anonKey) {
    return { ok: false, response: json({ ok: false, error: "Missing Supabase anon configuration." }, 500) };
  }

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader,
        ...(tenantKey ? { "x-tenant-key": tenantKey } : {}),
      },
    },
  });
  const { data: canManage, error: accessError } = await userClient.rpc("can_manage_tenant_communications", {
    p_tenant: tenantKey,
  });
  if (accessError) {
    return { ok: false, response: json({ ok: false, error: accessError.message || "Unable to verify communications access." }, 403) };
  }
  if (!canManage) {
    return { ok: false, response: json({ ok: false, error: "You do not have permission to send resident notifications for this organization." }, 403) };
  }

  return { ok: true };
}

async function logEmailDeliveryEvent(
  admin: SupabaseClient,
  input: {
    tenantKey: string;
    recipientEmail?: string;
    providerMessageId?: string;
    httpStatus?: number | null;
    success: boolean;
    errorText?: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    const payload = {
      tenant_key: normalizeTenantKey(input.tenantKey),
      domain: "other",
      report_number: null,
      recipient_email: normalizeEmail(input.recipientEmail) || null,
      provider: "resend",
      provider_message_id: trimOrEmpty(input.providerMessageId) || null,
      http_status: Number.isFinite(Number(input.httpStatus)) ? Number(input.httpStatus) : null,
      success: Boolean(input.success),
      error_text: clipText(input.errorText || "", 900) || null,
      metadata: { type: "resident_notification_email", ...(input.metadata || {}) },
    };
    const { error } = await admin.from("email_delivery_events").insert([payload]);
    if (error) {
      console.warn("[email_delivery_events] resident notification insert warning:", error.message || error);
    }
  } catch (error) {
    console.warn("[email_delivery_events] resident notification log warning:", (error as Error)?.message || error);
  }
}

function dedupeEmails(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const normalized = normalizeEmail(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

function dedupePushTargets(rows: NativePushTokenRow[]): NativePushTokenRow[] {
  const seen = new Set<string>();
  const next: NativePushTokenRow[] = [];
  for (const row of rows || []) {
    const token = trimOrEmpty(row?.token);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    next.push({
      user_id: trimOrEmpty(row?.user_id),
      token,
      platform: trimOrEmpty(row?.platform) || "ios",
    });
  }
  return next;
}

function formatDateTime(raw: unknown) {
  const value = trimOrEmpty(raw);
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatPushBody(item: ResidentNotificationItem) {
  const summary = clipText(item?.summary || "", 140);
  if (summary) return summary;
  const body = clipText(item?.body || "", 140);
  if (body) return body;
  const location = [trimOrEmpty(item?.location_name), trimOrEmpty(item?.location_address)]
    .filter(Boolean)
    .join(" - ");
  if (location) return clipText(location, 140);
  return "Open CityReport to view details.";
}

function humanizeDomainLabel(raw: unknown) {
  const normalized = trimOrEmpty(raw)
    .replaceAll("_", " ")
    .replaceAll("-", " ");
  if (!normalized) return "Unknown domain";
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function reportUpdateStateLabel(item: ResidentNotificationItem) {
  const explicit = trimOrEmpty(item?.state_label);
  if (explicit) return explicit;
  const state = trimOrEmpty(item?.new_state).toLowerCase();
  const labels: Record<string, string> = {
    reported: "Reported",
    aggregated: "Reported",
    confirmed: "Confirmed",
    unconfirmed: "Unconfirmed",
    in_progress: "In Progress",
    fixed: "Resolved",
    reopened: "Reported",
    archived: "Archived",
  };
  return labels[state] || (state ? state.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Updated");
}

function normalizePrivateKey(raw: unknown) {
  return trimOrEmpty(raw).replaceAll("\\n", "\n");
}

function formatSubject(input: {
  displayName: string;
  kind: ResidentNotificationKind;
  title: string;
  topicLabel: string;
}) {
  const kindLabel = input.kind === "event" ? "Event" : input.kind === "report_update" ? "Report update" : "Alert";
  return `${input.displayName}: ${kindLabel} - ${input.title} (${input.topicLabel})`;
}

function formatText(input: {
  displayName: string;
  kind: ResidentNotificationKind;
  topicLabel: string;
  item: ResidentNotificationItem;
}) {
  const kindLabel = input.kind === "event" ? "Event" : "Alert";
  const severityLine = input.kind === "alert" && trimOrEmpty(input.item.severity)
    ? `Severity: ${trimOrEmpty(input.item.severity)}`
    : "";
  const startsAtLine = trimOrEmpty(input.item.starts_at)
    ? `${input.kind === "event" ? "Starts" : "Starts"}: ${formatDateTime(input.item.starts_at)}`
    : "";
  const endsAtLine = trimOrEmpty(input.item.ends_at)
    ? `Ends: ${formatDateTime(input.item.ends_at)}`
    : "";
  const locationParts = [
    trimOrEmpty(input.item.location_name),
    trimOrEmpty(input.item.location_address),
  ].filter(Boolean);
  const ctaLabel = trimOrEmpty(input.item.cta_label);
  const ctaUrl = trimOrEmpty(input.item.cta_url);

  return [
    `${kindLabel} from ${input.displayName}`,
    "",
    `Topic: ${input.topicLabel}`,
    `Title: ${trimOrEmpty(input.item.title)}`,
    severityLine,
    startsAtLine,
    endsAtLine,
    locationParts.length ? `Location: ${locationParts.join(" - ")}` : "",
    trimOrEmpty(input.item.summary) ? `Summary: ${trimOrEmpty(input.item.summary)}` : "",
    trimOrEmpty(input.item.body) ? `Details: ${trimOrEmpty(input.item.body)}` : "",
    ctaLabel && ctaUrl ? `${ctaLabel}: ${ctaUrl}` : (ctaUrl ? `More information: ${ctaUrl}` : ""),
    "",
    "You are receiving this email because you enabled email notifications for this CityReport topic.",
  ].filter(Boolean).join("\n");
}

function formatHtml(input: {
  displayName: string;
  kind: ResidentNotificationKind;
  topicLabel: string;
  item: ResidentNotificationItem;
}) {
  const kindLabel = input.kind === "event" ? "Event" : "Alert";
  const severity = trimOrEmpty(input.item.severity);
  const locationParts = [
    trimOrEmpty(input.item.location_name),
    trimOrEmpty(input.item.location_address),
  ].filter(Boolean);
  const startsAt = trimOrEmpty(input.item.starts_at) ? formatDateTime(input.item.starts_at) : "";
  const endsAt = trimOrEmpty(input.item.ends_at) ? formatDateTime(input.item.ends_at) : "";
  const ctaLabel = trimOrEmpty(input.item.cta_label) || "View details";
  const ctaUrl = trimOrEmpty(input.item.cta_url);

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f8fb;padding:20px;color:#17314f;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:18px;padding:24px;border:1px solid #dbe4ea;">
        <div style="font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#51708b;">${escapeHtml(kindLabel)}</div>
        <h2 style="margin:8px 0 6px;">${escapeHtml(trimOrEmpty(input.item.title))}</h2>
        <div style="margin-bottom:14px;color:#4c6277;"><strong>Topic:</strong> ${escapeHtml(input.topicLabel)}</div>
        ${
          severity
            ? `<div style="margin-bottom:8px;color:#4c6277;"><strong>Severity:</strong> ${escapeHtml(severity)}</div>`
            : ""
        }
        ${
          startsAt
            ? `<div style="color:#4c6277;"><strong>Starts:</strong> ${escapeHtml(startsAt)}</div>`
            : ""
        }
        ${
          endsAt
            ? `<div style="color:#4c6277;"><strong>Ends:</strong> ${escapeHtml(endsAt)}</div>`
            : ""
        }
        ${
          locationParts.length
            ? `<div style="margin-top:8px;color:#4c6277;"><strong>Location:</strong> ${escapeHtml(locationParts.join(" - "))}</div>`
            : ""
        }
        ${
          trimOrEmpty(input.item.summary)
            ? `<p style="margin:18px 0 10px;color:#17314f;"><strong>Summary:</strong> ${escapeHtml(trimOrEmpty(input.item.summary))}</p>`
            : ""
        }
        ${
          trimOrEmpty(input.item.body)
            ? `<div style="margin:0 0 18px;color:#41566a;line-height:1.55;white-space:pre-wrap;">${escapeHtml(trimOrEmpty(input.item.body))}</div>`
            : ""
        }
        ${
          ctaUrl
            ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:11px 16px;border-radius:12px;background:#1f5da2;color:#ffffff;font-weight:800;text-decoration:none;">${escapeHtml(ctaLabel)}</a>`
            : ""
        }
        <div style="margin-top:20px;padding:14px 16px;border-radius:14px;background:#f6fafc;border:1px solid #d9e2ea;color:#52687a;">
          You are receiving this email because you enabled email notifications for this CityReport topic.
        </div>
      </div>
    </div>
  `;
}

async function sendResidentEmail(
  admin: SupabaseClient,
  input: {
    tenantKey: string;
    recipientEmail: string;
    displayName: string;
    kind: ResidentNotificationKind;
    topicLabel: string;
    item: ResidentNotificationItem;
  },
) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
  const FROM_EMAIL =
    Deno.env.get("CITYREPORT_RESIDENT_NOTIFY_FROM")
    || Deno.env.get("PW_REPORT_FROM")
    || "CityReport.io <noreply@auth.cityreport.io>";
  if (!RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

  const subject = formatSubject({
    displayName: input.displayName,
    kind: input.kind,
    title: trimOrEmpty(input.item.title),
    topicLabel: input.topicLabel,
  });
  const text = formatText({
    displayName: input.displayName,
    kind: input.kind,
    topicLabel: input.topicLabel,
    item: input.item,
  });
  const html = formatHtml({
    displayName: input.displayName,
    kind: input.kind,
    topicLabel: input.topicLabel,
    item: input.item,
  });

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [input.recipientEmail],
      subject,
      text,
      html,
    }),
  });

  const resendStatus = Number(resendRes.status || 0);
  const resendBodyText = await resendRes.text().catch(() => "");
  let providerMessageId = "";
  try {
    const parsed = JSON.parse(resendBodyText);
    providerMessageId = trimOrEmpty(parsed?.id);
  } catch {
    providerMessageId = "";
  }
  if (!resendRes.ok) {
    throw new Error(resendBodyText || `Resend returned ${resendStatus || 500}`);
  }

  await logEmailDeliveryEvent(admin, {
    tenantKey: input.tenantKey,
    recipientEmail: input.recipientEmail,
    providerMessageId,
    httpStatus: resendStatus || 200,
    success: true,
    metadata: {
      notification_kind: input.kind,
      topic_key: trimOrEmpty(input.item.topic_key),
      item_id: input.item.id ?? null,
      item_title: trimOrEmpty(input.item.title),
    },
  });
}

async function sendResidentPushIos(
  input: {
    token: string;
    displayName: string;
    kind: ResidentNotificationKind;
    topicLabel: string;
    item: ResidentNotificationItem;
  },
) {
  const teamId = trimOrEmpty(Deno.env.get("APPLE_PUSH_TEAM_ID"));
  const keyId = trimOrEmpty(Deno.env.get("APPLE_PUSH_KEY_ID"));
  const privateKey = normalizePrivateKey(Deno.env.get("APPLE_PUSH_PRIVATE_KEY"));
  const topic = trimOrEmpty(Deno.env.get("APPLE_PUSH_TOPIC")) || "cityreport.io.app";
  if (!teamId || !keyId || !privateKey) {
    return { ok: false, skipped: true, reason: "missing_apns_config" as const };
  }

  const apnsKey = await importPKCS8(privateKey, "ES256");
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(apnsKey);

  const isReportUpdate = input.kind === "report_update";
  const kindLabel = input.kind === "event" ? "Event" : "Alert";
  const title = isReportUpdate
    ? "Report Status Update"
    : (trimOrEmpty(input.item.title) || `${input.displayName} ${kindLabel}`);
  const reportNumber = trimOrEmpty(input.item.report_number);
  const body = isReportUpdate
    ? `${humanizeDomainLabel(input.item.domain)}\n${reportNumber || "Report number unavailable"} — ${reportUpdateStateLabel(input.item)}`
    : formatPushBody(input.item);
  const collapseId = trimOrEmpty(input.item.id) || `${input.kind}:${trimOrEmpty(input.item.topic_key)}`;
  const payload = {
    aps: {
      alert: {
        title,
        body,
      },
      sound: "default",
      badge: 1,
    },
    cityreport: {
      kind: input.kind,
      topic_key: trimOrEmpty(input.item.topic_key),
      topic_label: input.topicLabel,
      item_id: input.item.id ?? null,
      tenant_key: trimOrEmpty(input.item.tenant_key),
    },
  };

  const pushHeaders = {
    authorization: `bearer ${jwt}`,
    "apns-topic": topic,
    "apns-push-type": "alert",
    "apns-priority": "10",
    "apns-collapse-id": collapseId,
    "content-type": "application/json",
  };
  const pushBody = JSON.stringify(payload);
  const endpoints = [
    "https://api.push.apple.com",
    "https://api.sandbox.push.apple.com",
  ];

  let lastFailureReason = "";
  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = endpoints[index];
    const response = await fetch(`${endpoint}/3/device/${encodeURIComponent(input.token)}`, {
      method: "POST",
      headers: pushHeaders,
      body: pushBody,
    });
    if (response.ok) {
      return { ok: true, skipped: false, reason: "" };
    }
    const bodyText = await response.text().catch(() => "");
    lastFailureReason = bodyText || `APNs returned ${response.status}`;
    const shouldRetrySandbox =
      index === 0
      && response.status === 400
      && /BadDeviceToken/i.test(bodyText);
    if (!shouldRetrySandbox) {
      break;
    }
  }

  return {
    ok: false,
    skipped: false,
    reason: lastFailureReason,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tenantKey = normalizeTenantKey(body?.tenant_key || body?.item?.tenant_key);
    const kind: ResidentNotificationKind = body?.kind === "event"
      ? "event"
      : body?.kind === "report_update"
        ? "report_update"
        : "alert";
    const item = (body?.item && typeof body.item === "object" ? body.item : {}) as ResidentNotificationItem;
    const deliveryChannels = Array.isArray(item?.delivery_channels) ? item.delivery_channels : [];
    const deliveryChannelsNormalized = deliveryChannels.map((value) => trimOrEmpty(value).toLowerCase()).filter(Boolean);
    if (!tenantKey) return json({ ok: false, error: "tenant_key is required." }, 400);
    if ((!trimOrEmpty(item?.topic_key) && kind !== "report_update") || !trimOrEmpty(item?.title)) {
      return json({ ok: false, error: "topic_key and title are required." }, 400);
    }

    const admin = createAdminClient();
    const accessResult = await requireResidentNotificationAccess(req, admin, tenantKey);
    if (!accessResult.ok) return accessResult.response;

    if (kind === "report_update") {
      const incidentId = trimOrEmpty((item as Record<string, unknown>)?.incident_id);
      const domain = trimOrEmpty((item as Record<string, unknown>)?.domain);
      const nextState = trimOrEmpty((item as Record<string, unknown>)?.new_state);
      if (!incidentId || !domain || !nextState) {
        return json({ ok: false, error: "incident_id, domain, and new_state are required for report updates." }, 400);
      }

      const { data: updateRows, error: updateError } = await admin
        .from("resident_incident_notifications")
        .select("id,user_id,title,summary")
        .eq("tenant_key", tenantKey)
        .eq("incident_id", incidentId)
        .eq("domain", domain)
        .eq("new_state", nextState)
        .is("push_sent_at", null);
      if (updateError) throw new Error(updateError.message || "Could not load reporter status updates.");

      const notificationRows = (updateRows || []) as Array<{ id: number; user_id: string; title?: string | null; summary?: string | null }>;
      const recipientIds = dedupeUserIds(notificationRows.map((row) => trimOrEmpty(row?.user_id)));
      if (!recipientIds.length) {
        return json({ ok: true, skipped: true, reason: "no_delivery_targets", push_sent_count: 0 });
      }

      const { data: preferenceRows, error: preferenceError } = await admin
        .from("resident_notification_preferences")
        .select("user_id,web_push_enabled")
        .eq("tenant_key", tenantKey)
        .eq("topic_key", "report_updates")
        .eq("web_push_enabled", true)
        .in("user_id", recipientIds);
      if (preferenceError) throw new Error(preferenceError.message || "Could not load reporter notification preferences.");
      const enabledUserIds = dedupeUserIds((preferenceRows || []).map((row) => trimOrEmpty(row?.user_id)));
      if (!enabledUserIds.length) {
        return json({ ok: true, skipped: true, reason: "no_push_preferences_enabled", push_sent_count: 0 });
      }

      const { data: tokenRows, error: tokenError } = await admin
        .from("native_push_tokens")
        .select("user_id,token,platform")
        .eq("tenant_key", tenantKey)
        .eq("enabled", true)
        .eq("platform", "ios")
        .in("user_id", enabledUserIds);
      if (tokenError) throw new Error(tokenError.message || "Could not load reporter push tokens.");

      const displayName = trimOrEmpty(item?.tenant_key) || tenantKey;
      const pushTargets = dedupePushTargets((tokenRows || []) as NativePushTokenRow[]);
      const pushFailures: Array<Record<string, unknown>> = [];
      let pushSentCount = 0;
      for (const target of pushTargets) {
        const row = notificationRows.find((candidate) => trimOrEmpty(candidate.user_id) === target.user_id);
        const pushResult = await sendResidentPushIos({
          token: target.token,
          displayName,
          kind,
          topicLabel: "Your reports",
          item: {
            ...item,
            id: row?.id ?? item.id,
            title: row?.title || item.title,
            summary: row?.summary || item.summary,
          },
        });
        if (pushResult.ok) pushSentCount += 1;
        else if (!pushResult.skipped) pushFailures.push({ user_id: target.user_id, reason: pushResult.reason });
      }

      // Do not repeatedly alert a resident because a device token is stale or
      // because they have not granted iOS notification permission.
      const notificationIds = notificationRows.map((row) => Number(row.id)).filter(Number.isFinite);
      if (notificationIds.length) {
        const { error: markError } = await admin
          .from("resident_incident_notifications")
          .update({ push_sent_at: new Date().toISOString() })
          .in("id", notificationIds);
        if (markError) throw new Error(markError.message || "Could not record reporter push delivery.");
      }

      return json({
        ok: true,
        sent_count: 0,
        push_sent_count: pushSentCount,
        push_attempted_count: pushTargets.length,
        push_failures: pushFailures,
      });
    }

    if (trimOrEmpty(item.status).toLowerCase() !== "published") {
      return json({ ok: true, skipped: true, reason: "status_not_published" });
    }
    const deliveryChannelSet = new Set(deliveryChannelsNormalized);
    const emailChannelEnabled = !deliveryChannelsNormalized.length || deliveryChannelSet.has("email");
    const pushChannelEnabled = !deliveryChannelsNormalized.length
      || deliveryChannelSet.has("in_app")
      || deliveryChannelSet.has("push")
      || deliveryChannelSet.has("native_push");
    if (!emailChannelEnabled && !pushChannelEnabled) {
      return json({ ok: true, skipped: true, reason: "no_supported_delivery_channels" });
    }

    const { data: profileRow, error: profileError } = await admin
      .from("tenant_profiles")
      .select("display_name")
      .eq("tenant_key", tenantKey)
      .maybeSingle();
    if (profileError) {
      throw new Error(profileError.message || "Could not load tenant profile");
    }

    const { data: topicRow, error: topicError } = await admin
      .from("notification_topics")
      .select("topic_key,label,default_enabled")
      .eq("tenant_key", tenantKey)
      .eq("topic_key", trimOrEmpty(item.topic_key))
      .maybeSingle();
    if (topicError) {
      throw new Error(topicError.message || "Could not load notification topic");
    }

    const { data: prefRows, error: prefError } = await admin
      .from("resident_notification_preferences")
      .select("user_id,in_app_enabled,email_enabled,web_push_enabled")
      .eq("tenant_key", tenantKey)
      .eq("topic_key", trimOrEmpty(item.topic_key));
    if (prefError) {
      throw new Error(prefError.message || "Could not load resident notification preferences");
    }

    const preferenceRows = (prefRows || []) as ResidentPreferenceRow[];
    const preferenceRowsByUserId = new Map(
      preferenceRows.map((row) => [trimOrEmpty(row?.user_id), row]),
    );
    const topicDefaultEnabled = Boolean((topicRow as TopicRow | null)?.default_enabled);
    const emailUserIds = emailChannelEnabled
      ? dedupeUserIds(
          preferenceRows
            .filter((row) => Boolean(row?.email_enabled))
            .map((row) => trimOrEmpty(row?.user_id)),
        )
      : [];
    const explicitPushUserIds = pushChannelEnabled
      ? dedupeUserIds(
          preferenceRows
            // Push is its own consent channel.  Treating In-app or Email as
            // Push consent meant the actual Push control was ignored.
            .filter((row) => Boolean(row?.web_push_enabled))
            .map((row) => trimOrEmpty(row?.user_id)),
        )
      : [];
    const optedOutPushUserIds = new Set(
      pushChannelEnabled
        ? dedupeUserIds(
            preferenceRows
              .filter((row) => !Boolean(row?.web_push_enabled))
              .map((row) => trimOrEmpty(row?.user_id)),
          )
        : [],
    );

    const { data: residentRows, error: residentError } = emailUserIds.length
      ? await admin
          .from("profiles")
          .select("user_id,full_name,email")
          .in("user_id", emailUserIds)
      : { data: [], error: null };
    if (residentError) {
      throw new Error(residentError.message || "Could not load resident profiles");
    }

    const recipients = dedupeEmails(
      ((residentRows || []) as ResidentProfileRow[])
        .filter((row) => emailUserIds.includes(trimOrEmpty(row?.user_id)))
        .map((row) => normalizeEmail(row?.email))
        .filter(Boolean),
    );

    const shouldQueryDefaultPushTargets = pushChannelEnabled && topicDefaultEnabled;
    const { data: pushTokenRows, error: pushTokenError } = pushChannelEnabled && (shouldQueryDefaultPushTargets || explicitPushUserIds.length)
      ? await (
          shouldQueryDefaultPushTargets
            ? admin
                .from("native_push_tokens")
                .select("user_id,token,platform")
                .eq("tenant_key", tenantKey)
                .eq("enabled", true)
                .eq("platform", "ios")
            : admin
                .from("native_push_tokens")
                .select("user_id,token,platform")
                .eq("tenant_key", tenantKey)
                .eq("enabled", true)
                .eq("platform", "ios")
                .in("user_id", explicitPushUserIds)
        )
      : { data: [], error: null };
    if (pushTokenError) {
      throw new Error(pushTokenError.message || "Could not load native push tokens");
    }
    const explicitPushUserIdSet = new Set(explicitPushUserIds);
    const pushTargets = dedupePushTargets((pushTokenRows || []) as NativePushTokenRow[])
      .filter((row) => {
        const userId = trimOrEmpty(row?.user_id);
        if (!userId || optedOutPushUserIds.has(userId)) return false;
        if (explicitPushUserIdSet.has(userId)) return true;
        return shouldQueryDefaultPushTargets && !preferenceRowsByUserId.has(userId);
      });

    if (!recipients.length && !pushTargets.length) {
      return json({
        ok: true,
        skipped: true,
        reason: "no_delivery_targets",
        sent_count: 0,
        push_sent_count: 0,
      });
    }

    const displayName = trimOrEmpty(profileRow?.display_name) || tenantKey;
    const topicLabel = trimOrEmpty((topicRow as TopicRow | null)?.label) || trimOrEmpty(item.topic_key);
    const failures: Array<Record<string, unknown>> = [];
    let sentCount = 0;
    const pushFailures: Array<Record<string, unknown>> = [];
    let pushSentCount = 0;
    const pushSkippedReasons = new Set<string>();
    let pushSkippedCount = 0;

    for (const recipientEmail of recipients) {
      try {
        await sendResidentEmail(admin, {
          tenantKey,
          recipientEmail,
          displayName,
          kind,
          topicLabel,
          item,
        });
        sentCount += 1;
      } catch (error) {
        const message = String((error as Error)?.message || error || "Unknown send error");
        failures.push({ recipient_email: recipientEmail, error: message });
        await logEmailDeliveryEvent(admin, {
          tenantKey,
          recipientEmail,
          httpStatus: null,
          success: false,
          errorText: message,
          metadata: {
            notification_kind: kind,
            topic_key: trimOrEmpty(item.topic_key),
            item_id: item.id ?? null,
            item_title: trimOrEmpty(item.title),
          },
        });
      }
    }

    for (const pushTarget of pushTargets) {
      try {
        const pushResult = await sendResidentPushIos({
          token: trimOrEmpty(pushTarget.token),
          displayName,
          kind,
          topicLabel,
          item,
        });
        if (pushResult.ok) {
          pushSentCount += 1;
          continue;
        }
        if (pushResult.skipped) {
          pushSkippedCount += 1;
          if (trimOrEmpty(pushResult.reason)) {
            pushSkippedReasons.add(trimOrEmpty(pushResult.reason));
          }
          continue;
        }
        if (!pushResult.skipped) {
          pushFailures.push({
            user_id: trimOrEmpty(pushTarget.user_id),
            token: trimOrEmpty(pushTarget.token).slice(0, 12),
            error: pushResult.reason,
          });
        }
      } catch (error) {
        pushFailures.push({
          user_id: trimOrEmpty(pushTarget.user_id),
          token: trimOrEmpty(pushTarget.token).slice(0, 12),
          error: String((error as Error)?.message || error || "Unknown push send error"),
        });
      }
    }

    return json({
      ok: failures.length === 0,
      sent_count: sentCount,
      attempted_count: recipients.length,
      push_sent_count: pushSentCount,
      push_attempted_count: pushTargets.length,
      push_skipped_count: pushSkippedCount,
      push_skipped_reasons: Array.from(pushSkippedReasons),
      skipped: false,
      failures,
      push_failures: pushFailures,
    }, failures.length === 0 ? 200 : 207);
  } catch (error) {
    return json({ ok: false, error: String((error as Error)?.message || error || "Unknown error") }, 500);
  }
});
