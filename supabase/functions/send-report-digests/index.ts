import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version, x-tenant-key",
};

type DigestSettingsRow = {
  tenant_key: string;
  config_status: string;
  digest_enabled: boolean;
  primary_recipient_email: string | null;
  cc_recipient_emails: string | null;
  urgent_recipient_email: string | null;
  digest_frequency: string;
  digest_time_local: string;
  digest_timezone: string;
  include_weekends: boolean;
  include_closed_reports: boolean;
  notes: string | null;
};

type DigestRunRow = {
  id: number;
  tenant_key: string;
  digest_local_date: string;
  status: string;
  updated_at?: string | null;
};

type TenantProfileRow = {
  tenant_key: string;
  display_name?: string | null;
  timezone?: string | null;
};

type DigestItem = {
  domainKey: string;
  domainLabel: string;
  reportNumber: string;
  submittedAt: string;
  locationLine: string;
  crossStreet: string;
  landmark: string;
  notes: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeTenantKey(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function trimOrEmpty(raw: unknown): string {
  return String(raw || "").trim();
}

function clipText(raw: unknown, maxLen = 900): string {
  const value = trimOrEmpty(raw);
  if (!value) return "";
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}...`;
}

function splitEmails(raw: unknown): string[] {
  return trimOrEmpty(raw)
    .split(/[,\n;]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function dedupeEmails(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const normalized = trimOrEmpty(value).toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
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

async function requireManualDigestAccess(
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
    return { ok: false, response: json({ ok: false, error: accessError.message || "Unable to verify digest access." }, 403) };
  }
  if (!canManage) {
    return { ok: false, response: json({ ok: false, error: "You do not have permission to send a test digest for this organization." }, 403) };
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
      tenant_key: trimOrEmpty(input.tenantKey).toLowerCase(),
      domain: "other",
      report_number: null,
      recipient_email: trimOrEmpty(input.recipientEmail).toLowerCase() || null,
      provider: "resend",
      provider_message_id: trimOrEmpty(input.providerMessageId) || null,
      http_status: Number.isFinite(Number(input.httpStatus)) ? Number(input.httpStatus) : null,
      success: Boolean(input.success),
      error_text: clipText(input.errorText || "", 900) || null,
      metadata: { type: "report_digest", ...(input.metadata || {}) },
    };
    const { error } = await admin.from("email_delivery_events").insert([payload]);
    if (error) console.warn("[email_delivery_events] digest insert warning:", error.message || error);
  } catch (error) {
    console.warn("[email_delivery_events] digest log warning:", (error as Error)?.message || error);
  }
}

function parseTaggedField(note: unknown, label: string): string {
  const raw = trimOrEmpty(note);
  if (!raw) return "";
  const regex = new RegExp(`(?:^|\\s)${label}:\\s*([^|]+?)(?:\\s*\\||$)`, "i");
  const match = raw.match(regex);
  return trimOrEmpty(match?.[1]);
}

function stripSystemMetadataFromNote(note: unknown): string {
  return trimOrEmpty(note)
    .replace(/(?:^|\s)Location:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Address:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Cross Street:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Landmark:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Water issue:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Sign issue:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Sign type:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Image:\s*(https?:\/\/[^\s|]+)(?:\s*\||$)/gi, "")
    .replace(/\s*\|\s*\|\s*/g, " | ")
    .replace(/^\s*\|\s*/, "")
    .replace(/\s*\|\s*$/, "")
    .trim();
}

function domainFromLightId(lightId: unknown): string {
  const value = trimOrEmpty(lightId).toLowerCase();
  if (!value) return "streetlights";
  if (
    value.startsWith("water_drain_issues:")
    || value.startsWith("water_drain:")
    || value.startsWith("storm_drain:")
    || value.startsWith("sewer_backup:")
    || value.startsWith("water_main:")
  ) return "water_drain_issues";
  if (value.startsWith("street_signs:")) return "street_signs";
  return "streetlights";
}

function domainLabel(domainKey: string): string {
  switch (trimOrEmpty(domainKey)) {
    case "potholes":
      return "Potholes";
    case "water_drain_issues":
      return "Water / Drain Issues";
    case "street_signs":
      return "Street Signs";
    default:
      return "Streetlights";
  }
}

function localTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => trimOrEmpty(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    weekday: get("weekday"),
  };
}

function digestDueNow(setting: DigestSettingsRow, now: Date) {
  const timeZone = trimOrEmpty(setting.digest_timezone) || "America/New_York";
  const parts = localTimeParts(now, timeZone);
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const currentMinutes = Number(parts.hour || 0) * 60 + Number(parts.minute || 0);
  const [rawHour, rawMinute] = trimOrEmpty(setting.digest_time_local || "07:00").split(":");
  const targetMinutes = Math.max(0, Math.min(23, Number(rawHour || 7))) * 60 + Math.max(0, Math.min(59, Number(rawMinute || 0)));
  const weekday = trimOrEmpty(parts.weekday).toLowerCase();
  const isWeekend = weekday === "sat" || weekday === "sun";
  const allowWeekend = setting.digest_frequency === "daily_all_days" || setting.include_weekends;
  const dueToday = allowWeekend || !isWeekend;
  return {
    timeZone,
    localDate,
    due: dueToday && currentMinutes >= targetMinutes,
  };
}

async function claimDigestRun(
  admin: SupabaseClient,
  setting: DigestSettingsRow,
  localDate: string,
  windowStartedAt: string,
  windowEndedAt: string,
  options: {
    force?: boolean;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<{ row: DigestRunRow | null; claimed: boolean }> {
  const tenantKey = trimOrEmpty(setting.tenant_key).toLowerCase();
  const { data: existing, error: existingError } = await admin
    .from("organization_digest_runs")
    .select("id,tenant_key,digest_local_date,status,updated_at")
    .eq("tenant_key", tenantKey)
    .eq("digest_local_date", localDate)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message || "Could not load digest run history");
  const existingRow = (existing || null) as DigestRunRow | null;
  if (existingRow?.status === "processing") {
    return { row: existingRow, claimed: false };
  }
  if (existingRow && options.force) {
    const { data: updated, error: updateError } = await admin
      .from("organization_digest_runs")
      .update({
        status: "processing",
        error_text: null,
        window_started_at: windowStartedAt,
        window_ended_at: windowEndedAt,
        recipient_email: trimOrEmpty(setting.primary_recipient_email).toLowerCase() || null,
        cc_recipient_emails: trimOrEmpty(setting.cc_recipient_emails) || null,
        urgent_recipient_email: trimOrEmpty(setting.urgent_recipient_email).toLowerCase() || null,
        provider_message_id: null,
        delivered_at: null,
        metadata: { ...(options.metadata || {}), manual_test_retry: true },
      })
      .eq("id", existingRow.id)
      .select("id,tenant_key,digest_local_date,status,updated_at")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message || "Could not prepare test digest run");
    return { row: updated as DigestRunRow, claimed: true };
  }
  if (existingRow?.status === "sent") {
    return { row: existingRow, claimed: false };
  }
  if (existingRow?.status === "failed" || existingRow?.status === "skipped") {
    const { data: updated, error: updateError } = await admin
      .from("organization_digest_runs")
      .update({
        status: "processing",
        error_text: null,
        window_started_at: windowStartedAt,
        window_ended_at: windowEndedAt,
        recipient_email: trimOrEmpty(setting.primary_recipient_email).toLowerCase() || null,
        cc_recipient_emails: trimOrEmpty(setting.cc_recipient_emails) || null,
        urgent_recipient_email: trimOrEmpty(setting.urgent_recipient_email).toLowerCase() || null,
        metadata: { retry: true, ...(options.metadata || {}) },
      })
      .eq("id", existingRow.id)
      .select("id,tenant_key,digest_local_date,status,updated_at")
      .maybeSingle();
    if (updateError) throw new Error(updateError.message || "Could not retry digest run");
    return { row: updated as DigestRunRow, claimed: true };
  }

  const { data: inserted, error: insertError } = await admin
    .from("organization_digest_runs")
    .insert([{
      tenant_key: tenantKey,
      digest_local_date: localDate,
      digest_timezone: trimOrEmpty(setting.digest_timezone) || "America/New_York",
      window_started_at: windowStartedAt,
      window_ended_at: windowEndedAt,
      recipient_email: trimOrEmpty(setting.primary_recipient_email).toLowerCase() || null,
      cc_recipient_emails: trimOrEmpty(setting.cc_recipient_emails) || null,
      urgent_recipient_email: trimOrEmpty(setting.urgent_recipient_email).toLowerCase() || null,
      status: "processing",
      metadata: options.metadata || {},
    }])
    .select("id,tenant_key,digest_local_date,status,updated_at")
    .maybeSingle();
  if (insertError) {
    const msg = trimOrEmpty(insertError.message).toLowerCase();
    if (msg.includes("organization_digest_runs_unique_day") || msg.includes("duplicate key")) {
      return { row: null, claimed: false };
    }
    throw new Error(insertError.message || "Could not create digest run");
  }
  return { row: inserted as DigestRunRow, claimed: true };
}

async function updateDigestRun(
  admin: SupabaseClient,
  runId: number,
  patch: Record<string, unknown>,
) {
  const { error } = await admin
    .from("organization_digest_runs")
    .update(patch)
    .eq("id", runId);
  if (error) console.warn("[organization_digest_runs] update warning:", error.message || error);
}

async function loadDigestContent(admin: SupabaseClient, tenantKey: string, sinceIso: string) {
  const [
    { data: reportRows, error: reportsError },
    { data: potholeReportRows, error: potholeReportsError },
  ] = await Promise.all([
    admin
      .from("reports")
      .select("id,created_at,lat,lng,report_type,report_quality,note,light_id,report_number,reporter_name,reporter_email,reporter_phone")
      .eq("tenant_key", tenantKey)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(250),
    admin
      .from("pothole_reports")
      .select("id,pothole_id,lat,lng,note,report_number,created_at,reporter_name,reporter_email,reporter_phone")
      .eq("tenant_key", tenantKey)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(250),
  ]);
  if (reportsError) throw new Error(reportsError.message || "Could not load report activity");
  if (potholeReportsError) throw new Error(potholeReportsError.message || "Could not load pothole report activity");

  const allReports = Array.isArray(reportRows) ? reportRows : [];
  const allPotholeReports = Array.isArray(potholeReportRows) ? potholeReportRows : [];

  const waterIncidentIds = dedupeStrings(
    allReports
      .filter((row) => domainFromLightId(row?.light_id) === "water_drain_issues")
      .map((row) => trimOrEmpty(row?.light_id)),
  );
  const streetlightIds = dedupeStrings(
    allReports
      .filter((row) => domainFromLightId(row?.light_id) === "streetlights")
      .map((row) => trimOrEmpty(row?.light_id)),
  );
  const potholeIds = dedupeStrings(allPotholeReports.map((row) => trimOrEmpty(row?.pothole_id)));

  const [waterMetaRes, streetlightMetaRes, potholeMetaRes] = await Promise.all([
    waterIncidentIds.length
      ? admin
        .from("water_drain_incidents")
        .select("incident_id,nearest_address,nearest_cross_street,nearest_landmark")
        .eq("tenant_key", tenantKey)
        .in("incident_id", waterIncidentIds)
      : Promise.resolve({ data: [], error: null }),
    streetlightIds.length
      ? admin
        .from("streetlight_location_cache")
        .select("light_id,nearest_address,nearest_cross_street")
        .in("light_id", streetlightIds)
      : Promise.resolve({ data: [], error: null }),
    potholeIds.length
      ? admin
        .from("potholes")
        .select("id,nearest_address,nearest_cross_street,nearest_landmark,location_label")
        .eq("tenant_key", tenantKey)
        .in("id", potholeIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (waterMetaRes.error) throw new Error(waterMetaRes.error.message || "Could not load water/drain location details");
  if (streetlightMetaRes.error) throw new Error(streetlightMetaRes.error.message || "Could not load streetlight location details");
  if (potholeMetaRes.error) throw new Error(potholeMetaRes.error.message || "Could not load pothole location details");

  const waterMetaById = new Map((waterMetaRes.data || []).map((row) => [trimOrEmpty(row.incident_id), row]));
  const streetlightMetaById = new Map((streetlightMetaRes.data || []).map((row) => [trimOrEmpty(row.light_id), row]));
  const potholeMetaById = new Map((potholeMetaRes.data || []).map((row) => [trimOrEmpty(row.id), row]));

  const items: DigestItem[] = [];
  const domainCounts: Record<string, number> = {};

  for (const row of allPotholeReports) {
    const potholeId = trimOrEmpty(row?.pothole_id);
    const meta = potholeMetaById.get(potholeId);
    const nearestAddress = trimOrEmpty(meta?.nearest_address) || trimOrEmpty(meta?.location_label) || parseTaggedField(row?.note, "Address") || `Coordinates: ${Number(row?.lat || 0).toFixed(5)}, ${Number(row?.lng || 0).toFixed(5)}`;
    const crossStreet = trimOrEmpty(meta?.nearest_cross_street) || parseTaggedField(row?.note, "Cross Street") || "Unavailable";
    const landmark = trimOrEmpty(meta?.nearest_landmark) || parseTaggedField(row?.note, "Landmark") || "Unavailable";
    domainCounts.potholes = (domainCounts.potholes || 0) + 1;
    items.push({
      domainKey: "potholes",
      domainLabel: domainLabel("potholes"),
      reportNumber: trimOrEmpty(row?.report_number) || "Pending number",
      submittedAt: trimOrEmpty(row?.created_at),
      locationLine: nearestAddress,
      crossStreet,
      landmark,
      notes: clipText(stripSystemMetadataFromNote(row?.note), 220) || "No additional notes provided.",
    });
  }

  for (const row of allReports) {
    const domainKey = domainFromLightId(row?.light_id);
    const quality = trimOrEmpty(row?.report_quality).toLowerCase();
    if (domainKey === "streetlights" && quality === "good") continue;
    const incidentId = trimOrEmpty(row?.light_id);
    const waterMeta = waterMetaById.get(incidentId);
    const streetlightMeta = streetlightMetaById.get(incidentId);
    const nearestAddress =
      trimOrEmpty(domainKey === "water_drain_issues" ? waterMeta?.nearest_address : streetlightMeta?.nearest_address)
      || parseTaggedField(row?.note, "Location")
      || parseTaggedField(row?.note, "Address")
      || `Coordinates: ${Number(row?.lat || 0).toFixed(5)}, ${Number(row?.lng || 0).toFixed(5)}`;
    const crossStreet =
      trimOrEmpty(domainKey === "water_drain_issues" ? waterMeta?.nearest_cross_street : streetlightMeta?.nearest_cross_street)
      || parseTaggedField(row?.note, "Cross Street")
      || "Unavailable";
    const landmark =
      trimOrEmpty(waterMeta?.nearest_landmark)
      || parseTaggedField(row?.note, "Landmark")
      || "Unavailable";
    domainCounts[domainKey] = (domainCounts[domainKey] || 0) + 1;
    items.push({
      domainKey,
      domainLabel: domainLabel(domainKey),
      reportNumber: trimOrEmpty(row?.report_number) || "Pending number",
      submittedAt: trimOrEmpty(row?.created_at),
      locationLine: nearestAddress,
      crossStreet,
      landmark,
      notes: clipText(stripSystemMetadataFromNote(row?.note), 220) || "No additional notes provided.",
    });
  }

  items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  const includedReportNumbers = dedupeStrings(
    items
      .map((item) => trimOrEmpty(item.reportNumber))
      .filter((value) => value && value.toLowerCase() !== "pending number"),
  );
  const displayedItems = items.slice(0, 18);
  const displayedReportNumbers = dedupeStrings(
    displayedItems
      .map((item) => trimOrEmpty(item.reportNumber))
      .filter((value) => value && value.toLowerCase() !== "pending number"),
  );
  const pendingReportNumberCount = items.filter((item) => trimOrEmpty(item.reportNumber).toLowerCase() === "pending number").length;
  const sourceLimits = {
    reports: 250,
    potholes: 250,
    displayed_items: 18,
  };
  return {
    domainCounts,
    itemCount: items.length,
    items: displayedItems,
    includedReportNumbers,
    displayedReportNumbers,
    pendingReportNumberCount,
    sourceLimitReached: allReports.length >= sourceLimits.reports || allPotholeReports.length >= sourceLimits.potholes,
    sourceLimits,
    sourceRowCounts: {
      reports: allReports.length,
      potholes: allPotholeReports.length,
    },
  };
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const normalized = trimOrEmpty(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

function formatDigestSubject(displayName: string, localDate: string) {
  return `CityReport daily digest for ${displayName} • ${localDate}`;
}

function formatDigestText(input: {
  displayName: string;
  localDate: string;
  timeZone: string;
  windowStartedAt: string;
  windowEndedAt: string;
  domainCounts: Record<string, number>;
  items: DigestItem[];
}) {
  const countLines = Object.entries(input.domainCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domainKey, count]) => `- ${domainLabel(domainKey)}: ${count}`);
  const itemLines = input.items.flatMap((item, index) => [
    `${index + 1}. ${item.domainLabel} • ${item.reportNumber}`,
    `   Submitted: ${item.submittedAt}`,
    `   Nearest address: ${item.locationLine}`,
    `   Closest cross street: ${item.crossStreet || "Unavailable"}`,
    `   Closest landmark: ${item.landmark || "Unavailable"}`,
    `   Notes: ${item.notes || "No additional notes provided."}`,
  ]);

  return [
    `CityReport daily digest for ${input.displayName}`,
    "",
    `Digest date (${input.timeZone}): ${input.localDate}`,
    `Window: ${input.windowStartedAt} to ${input.windowEndedAt}`,
    "",
    "New report counts in this digest window:",
    ...(countLines.length ? countLines : ["- No new reports in this window"]),
    "",
    "Recent reports:",
    ...(itemLines.length ? itemLines : ["No new reports were submitted in this window."]),
    "",
    "Disclaimer:",
    "CityReport forwards this digest as a convenience and operational summary. It should not be treated as the city's sole legal notice channel.",
  ].join("\n");
}

function formatDigestHtml(input: {
  displayName: string;
  localDate: string;
  timeZone: string;
  windowStartedAt: string;
  windowEndedAt: string;
  domainCounts: Record<string, number>;
  items: DigestItem[];
}) {
  const countRows = Object.entries(input.domainCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([domainKey, count]) => (
      `<tr><td style="padding:6px 8px;border-bottom:1px solid #d9e2ea;"><strong>${escapeHtml(domainLabel(domainKey))}</strong></td><td style="padding:6px 8px;border-bottom:1px solid #d9e2ea;text-align:right;">${count}</td></tr>`
    ))
    .join("");

  const itemBlocks = input.items.map((item) => `
    <div style="padding:12px 14px;border:1px solid #d9e2ea;border-radius:14px;background:#ffffff;margin-bottom:10px;">
      <div style="font-weight:800;color:#17314f;">${escapeHtml(item.domainLabel)} • ${escapeHtml(item.reportNumber)}</div>
      <div style="margin-top:6px;color:#41566a;"><strong>Submitted:</strong> ${escapeHtml(item.submittedAt)}</div>
      <div style="color:#41566a;"><strong>Nearest address:</strong> ${escapeHtml(item.locationLine || "Unavailable")}</div>
      <div style="color:#41566a;"><strong>Closest cross street:</strong> ${escapeHtml(item.crossStreet || "Unavailable")}</div>
      <div style="color:#41566a;"><strong>Closest landmark:</strong> ${escapeHtml(item.landmark || "Unavailable")}</div>
      <div style="margin-top:6px;color:#41566a;"><strong>Notes:</strong> ${escapeHtml(item.notes || "No additional notes provided.")}</div>
    </div>
  `).join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f8fb;padding:20px;color:#17314f;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:18px;padding:24px;border:1px solid #dbe4ea;">
        <h2 style="margin:0 0 8px;">CityReport daily digest for ${escapeHtml(input.displayName)}</h2>
        <p style="margin:0 0 4px;color:#4c6277;"><strong>Digest date (${escapeHtml(input.timeZone)}):</strong> ${escapeHtml(input.localDate)}</p>
        <p style="margin:0 0 18px;color:#4c6277;"><strong>Window:</strong> ${escapeHtml(input.windowStartedAt)} to ${escapeHtml(input.windowEndedAt)}</p>

        <h3 style="margin:0 0 10px;">New report counts</h3>
        ${
          countRows
            ? `<table style="width:100%;border-collapse:collapse;margin-bottom:18px;">${countRows}</table>`
            : `<p style="margin:0 0 18px;color:#4c6277;">No new reports were submitted in this window.</p>`
        }

        <h3 style="margin:0 0 10px;">Recent reports</h3>
        ${itemBlocks || `<p style="margin:0 0 18px;color:#4c6277;">No new reports were submitted in this window.</p>`}

        <div style="margin-top:18px;padding:14px 16px;border-radius:14px;background:#f6fafc;border:1px solid #d9e2ea;color:#52687a;">
          <strong>Disclaimer:</strong> CityReport forwards this digest as a convenience and operational summary. It should not be treated as the city's sole legal notice channel.
        </div>
      </div>
    </div>
  `;
}

async function sendDigestEmail(input: {
  admin: SupabaseClient;
  settings: DigestSettingsRow;
  displayName: string;
  localDate: string;
  timeZone: string;
  windowStartedAt: string;
  windowEndedAt: string;
  domainCounts: Record<string, number>;
  items: DigestItem[];
}) {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
  const FROM_EMAIL =
    Deno.env.get("CITYREPORT_DIGEST_FROM")
    || Deno.env.get("PW_REPORT_FROM")
    || "CityReport.io <noreply@auth.cityreport.io>";
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY");
  }
  const primary = trimOrEmpty(input.settings.primary_recipient_email).toLowerCase();
  if (!primary) {
    throw new Error("Primary digest inbox is not configured");
  }

  const ccRecipients = splitEmails(input.settings.cc_recipient_emails);
  const urgentRecipients = (input.domainCounts.water_drain_issues || 0) > 0
    ? splitEmails(input.settings.urgent_recipient_email)
    : [];
  const recipients = dedupeEmails([primary]);
  const cc = dedupeEmails([...ccRecipients, ...urgentRecipients].filter((email) => email !== primary));

  const subject = formatDigestSubject(input.displayName, input.localDate);
  const text = formatDigestText(input);
  const html = formatDigestHtml(input);

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: recipients,
      ...(cc.length ? { cc } : {}),
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

  await logEmailDeliveryEvent(input.admin, {
    tenantKey: input.settings.tenant_key,
    recipientEmail: recipients.join(", "),
    providerMessageId,
    httpStatus: resendStatus || 200,
    success: true,
    metadata: {
      digest_local_date: input.localDate,
      domain_counts: input.domainCounts,
      item_count: input.items.length,
      cc_recipients: cc,
    },
  });

  return {
    providerMessageId,
    recipientList: recipients,
    ccList: cc,
    httpStatus: resendStatus || 200,
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
    const requestedTenant = normalizeTenantKey(body?.tenant_key);
    const manualTest = body?.manual_test === true;
    const now = new Date();
    const admin = createAdminClient();

    if (manualTest) {
      if (!requestedTenant) {
        return json({ ok: false, error: "tenant_key is required for manual test sends." }, 400);
      }
      const accessResult = await requireManualDigestAccess(req, admin, requestedTenant);
      if (!accessResult.ok) return accessResult.response;
    }

    let query = admin
      .from("organization_digest_settings")
      .select("tenant_key,config_status,digest_enabled,primary_recipient_email,cc_recipient_emails,urgent_recipient_email,digest_frequency,digest_time_local,digest_timezone,include_weekends,include_closed_reports,notes")
      .eq("digest_enabled", true)
      .eq("config_status", "ready");
    if (requestedTenant) {
      query = query.eq("tenant_key", requestedTenant);
    }
    const { data: settingsRows, error: settingsError } = await query;
    if (settingsError) {
      throw new Error(settingsError.message || "Could not load organization digest settings");
    }

    const settings = (settingsRows || []) as DigestSettingsRow[];
    if (manualTest && requestedTenant && !settings.some((row) => trimOrEmpty(row.tenant_key).toLowerCase() === requestedTenant)) {
      return json({
        ok: false,
        error: "No ready and enabled digest settings were found for this organization.",
      }, 400);
    }
    const tenantKeys = dedupeStrings(settings.map((row) => trimOrEmpty(row.tenant_key)));
    const { data: profileRows, error: profilesError } = tenantKeys.length
      ? await admin
          .from("tenant_profiles")
          .select("tenant_key,display_name,timezone")
          .in("tenant_key", tenantKeys)
      : { data: [], error: null };
    if (profilesError) {
      throw new Error(profilesError.message || "Could not load tenant profiles for digests");
    }
    const profilesByTenant = new Map<string, TenantProfileRow>(
      ((profileRows || []) as TenantProfileRow[]).map((row) => [trimOrEmpty(row.tenant_key).toLowerCase(), row]),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const setting of settings) {
      const tenantKey = trimOrEmpty(setting.tenant_key).toLowerCase();
      const profile = profilesByTenant.get(tenantKey);
      const effectiveTimeZone = trimOrEmpty(setting.digest_timezone) || trimOrEmpty(profile?.timezone) || "America/New_York";
      const displayName =
        trimOrEmpty(profile?.display_name)
        || trimOrEmpty(profile?.tenant_key)
        || tenantKey;
      const isManualTestRun = manualTest && requestedTenant === tenantKey;
      const dueInfo = digestDueNow({ ...setting, digest_timezone: effectiveTimeZone }, now);
      if (!isManualTestRun && !dueInfo.due) {
        results.push({ tenant_key: tenantKey, status: "not_due", local_date: dueInfo.localDate });
        continue;
      }

      const windowEndedAtIso = now.toISOString();
      const windowStartedAtIso = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
      const claim = await claimDigestRun(
        admin,
        { ...setting, digest_timezone: effectiveTimeZone },
        dueInfo.localDate,
        windowStartedAtIso,
        windowEndedAtIso,
        {
          force: isManualTestRun,
          metadata: {
            trigger_source: isManualTestRun ? "manual_test" : trimOrEmpty(body?.source) || "scheduled",
            manual_test: isManualTestRun,
            manual_test_triggered_at: isManualTestRun ? now.toISOString() : null,
          },
        },
      );
      if (!claim.claimed || !claim.row?.id) {
        results.push({
          tenant_key: tenantKey,
          status: isManualTestRun ? "already_processing" : "already_processed",
          local_date: dueInfo.localDate,
        });
        continue;
      }

      let digest: Awaited<ReturnType<typeof loadDigestContent>> | null = null;
      try {
        digest = await loadDigestContent(admin, tenantKey, windowStartedAtIso);
        const sent = await sendDigestEmail({
          admin,
          settings: { ...setting, digest_timezone: effectiveTimeZone },
          displayName,
          localDate: dueInfo.localDate,
          timeZone: effectiveTimeZone,
          windowStartedAt: windowStartedAtIso,
          windowEndedAt: windowEndedAtIso,
          domainCounts: digest.domainCounts,
          items: digest.items,
        });
        await updateDigestRun(admin, claim.row.id, {
          status: "sent",
          item_count: Number(digest.itemCount || 0),
          domain_counts: digest.domainCounts,
          provider_message_id: sent.providerMessageId || null,
          delivered_at: new Date().toISOString(),
          metadata: {
            recipient_list: sent.recipientList,
            cc_list: sent.ccList,
            digest_display_name: displayName,
            included_report_numbers: digest.includedReportNumbers,
            displayed_report_numbers: digest.displayedReportNumbers,
            displayed_item_count: digest.items.length,
            pending_report_number_count: digest.pendingReportNumberCount,
            source_limit_reached: digest.sourceLimitReached,
            source_limits: digest.sourceLimits,
            source_row_counts: digest.sourceRowCounts,
            trigger_source: isManualTestRun ? "manual_test" : trimOrEmpty(body?.source) || "scheduled",
            manual_test: isManualTestRun,
            manual_test_triggered_at: isManualTestRun ? now.toISOString() : null,
          },
        });
        results.push({
          tenant_key: tenantKey,
          status: "sent",
          local_date: dueInfo.localDate,
          item_count: digest.itemCount,
          domain_counts: digest.domainCounts,
        });
      } catch (error) {
        const message = clipText((error as Error)?.message || error || "Unknown digest send error", 900);
        await updateDigestRun(admin, claim.row.id, {
          status: "failed",
          error_text: message,
          ...(digest
            ? {
                item_count: Number(digest.itemCount || 0),
                domain_counts: digest.domainCounts,
                metadata: {
                  digest_display_name: displayName,
                  included_report_numbers: digest.includedReportNumbers,
                  displayed_report_numbers: digest.displayedReportNumbers,
                  displayed_item_count: digest.items.length,
                  pending_report_number_count: digest.pendingReportNumberCount,
                  source_limit_reached: digest.sourceLimitReached,
                  source_limits: digest.sourceLimits,
                  source_row_counts: digest.sourceRowCounts,
                  delivery_attempted: true,
                  failure_stage: "send",
                  trigger_source: isManualTestRun ? "manual_test" : trimOrEmpty(body?.source) || "scheduled",
                  manual_test: isManualTestRun,
                  manual_test_triggered_at: isManualTestRun ? now.toISOString() : null,
                },
              }
            : {
                metadata: {
                  digest_display_name: displayName,
                  delivery_attempted: false,
                  failure_stage: "prepare",
                  trigger_source: isManualTestRun ? "manual_test" : trimOrEmpty(body?.source) || "scheduled",
                  manual_test: isManualTestRun,
                  manual_test_triggered_at: isManualTestRun ? now.toISOString() : null,
                },
              }),
        });
        await logEmailDeliveryEvent(admin, {
          tenantKey,
          recipientEmail: trimOrEmpty(setting.primary_recipient_email).toLowerCase(),
          httpStatus: 500,
          success: false,
          errorText: message,
          metadata: {
            digest_local_date: dueInfo.localDate,
            type: "report_digest",
          },
        });
        results.push({ tenant_key: tenantKey, status: "failed", local_date: dueInfo.localDate, error: message });
      }
    }

    return json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    return json({ ok: false, error: String((error as Error)?.message || error || "Unknown error") }, 500);
  }
});
