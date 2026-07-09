import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version, x-tenant-key",
};

type Ring = [number, number][];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

type DomainRuntimeConfig = {
  tenantKey: string;
  boundaryConfigKey: string;
  domainKey: string;
  domainLabel: string;
  domainClass: string;
  recipientEmail: string;
  ccRecipientEmails: string;
  assignmentActive: boolean;
  assignmentVisible: boolean;
  notificationTemplateKey: string;
  notificationSubjectTemplate: string;
  notificationBodyTemplate: string;
};

type DomainTypeOptionSelection = {
  key?: string;
  label?: string;
  value?: string;
  valueLabel?: string;
  macroKey?: string;
};

const DEFAULT_TENANT_KEY = "ashtabulacity";
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000;
const BOUNDARY_CACHE_TTL_MS = 5 * 60 * 1000;
const TENANT_FALLBACK_ENABLED =
  String(Deno.env.get("TENANT_FALLBACK_ENABLED") || "true").trim().toLowerCase() === "true";

const domainConfigCache = new Map<string, { expiresAt: number; value: DomainRuntimeConfig | null }>();
const boundaryCache = new Map<string, { expiresAt: number; value: MultiPolygon | null }>();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeTenantKey(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function normalizeDomainKey(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function requestTenantKey(req: Request): string {
  return normalizeTenantKey(req.headers.get("x-tenant-key"));
}

function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !service) {
    throw new Error("Missing Supabase service role configuration");
  }
  return createClient(url, service, { auth: { persistSession: false } });
}

function clipLogText(raw: unknown, maxLen = 900): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function humanizeKey(raw: unknown, fallback = "Report"): string {
  const text = String(raw || "").trim();
  if (!text) return fallback;
  return text
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeTemplateTokenKey(raw: unknown, fallback = "type_option"): string {
  const normalized = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[{}]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
  return normalized || fallback;
}

function isMissingColumnError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || "").trim().toUpperCase();
  const message = String((error as { message?: string })?.message || "").toLowerCase();
  return code === "42703" || message.includes("column") || message.includes("schema cache");
}

function escapeHtml(raw: unknown): string {
  return String(raw || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function splitEmails(raw: unknown): string[] {
  return String(raw || "")
    .split(/[,\n;]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function dedupeEmails(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

function defaultSubjectTemplate() {
  return "{{domain_label}} report ({{report_number}})";
}

function defaultBodyTemplate() {
  return `A new {{domain_label}} report was submitted through CityReport.io.

Tenant: {{tenant_key}}
Domain: {{domain_label}}
Issue Type: {{issue_type}}
Type Details: {{type_options_summary}}
Report Number: {{report_number}}
Closest Address: {{closest_address}}
Cross Street: {{closest_cross_street}}
Closest Intersection: {{closest_intersection}}
Closest Landmark: {{closest_landmark}}
Location: {{location_text}}
Image URL: {{image_url}}
Submitted (Local): {{submitted_at_local}}

Notes:
{{notes}}

Reported by:
Type: {{reporter_type}}
Name: {{reporter_name}}
Email: {{reporter_email}}
Phone: {{reporter_phone}}

This report was submitted through CityReport.io and forwarded by our system as an intermediary.`;
}

function renderTemplate(raw: unknown, variables: Record<string, string>): string {
  let rendered = String(raw || "").trim();
  if (!rendered) return "";
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replaceAll(`{{${key}}}`, String(value ?? ""));
  }
  return rendered.replace(/\r\n/g, "\n").trim();
}

async function logEmailDeliveryEvent(
  admin: SupabaseClient,
  input: {
    tenantKey: string;
    domain: string;
    reportNumber?: string;
    recipientEmail?: string;
    providerMessageId?: string;
    httpStatus?: number | null;
    success: boolean;
    errorText?: string;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    const payload = {
      tenant_key: String(input.tenantKey || "").trim().toLowerCase(),
      domain: String(input.domain || "other").trim().toLowerCase() || "other",
      report_number: String(input.reportNumber || "").trim() || null,
      recipient_email: String(input.recipientEmail || "").trim().toLowerCase() || null,
      provider: "resend",
      provider_message_id: String(input.providerMessageId || "").trim() || null,
      http_status: Number.isFinite(Number(input.httpStatus)) ? Number(input.httpStatus) : null,
      success: Boolean(input.success),
      error_text: clipLogText(input.errorText || "", 900) || null,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    };
    const { error } = await admin.from("email_delivery_events").insert([payload]);
    if (error) {
      console.warn("[email_delivery_events] insert warning:", error.message || error);
    }
  } catch (e) {
    console.warn("[email_delivery_events] log warning:", (e as Error)?.message || e);
  }
}

function normalizeNotes(raw: unknown): string {
  const text = String(raw || "").trim();
  if (!text) return "No notes provided";
  const chunks = text
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^(address|landmark|location|image|type|sign type|type option\s+[^:]+)\s*:/i.test(s));
  return chunks.join(" | ").trim() || "No notes provided";
}

function normalizeDomainTypeOptions(raw: unknown) {
  const rows = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  return rows
    .map((row, index) => {
      if (!row || typeof row !== "object") return null;
      const item = row as DomainTypeOptionSelection;
      const label = String(item.label || "").trim() || humanizeKey(item.key || "", `Type Option ${index + 1}`);
      const value = String(item.value || "").trim().toLowerCase();
      const valueLabel = String(item.valueLabel || item.value || "").trim();
      const macroKey = normalizeTemplateTokenKey(
        item.macroKey || `type_option_${normalizeTemplateTokenKey(item.key || label, `option_${index + 1}`)}`,
        `type_option_${index + 1}`
      );
      if (!label || !valueLabel || seen.has(macroKey)) return null;
      seen.add(macroKey);
      return {
        label,
        value,
        valueLabel,
        macroKey,
      };
    })
    .filter(Boolean) as Array<{ label: string; value: string; valueLabel: string; macroKey: string }>;
}

function extractImageUrl(raw: unknown): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const directUrlMatch = text.match(/^(https?:\/\/\S+)$/i);
  if (directUrlMatch) return String(directUrlMatch[1] || "").trim();
  const taggedMatch = text.match(/(?:^|\s)Image:\s*(https?:\/\/[^\s|]+)(?:\s*\||$)/i);
  return String(taggedMatch?.[1] || "").trim();
}

function normalizeLandmark(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "No nearby landmark";
  if (/^\d+\s*\/\s*\d+$/.test(value)) return "No nearby landmark";
  if (/^\d+$/.test(value)) return "No nearby landmark";
  if (value.length < 3) return "No nearby landmark";
  return value;
}

function normalizeCrossStreet(raw: unknown): string {
  const value = String(raw || "").trim();
  if (!value) return "No nearby cross street";
  if (/^\d+\s*\/\s*\d+$/.test(value)) return "No nearby cross street";
  if (value.length < 2) return "No nearby cross street";
  return value;
}

function pointInRing(lat: number, lng: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lat: number, lng: number, polygon: Polygon) {
  if (!polygon.length) return false;
  const inOuter = pointInRing(lat, lng, polygon[0]);
  if (!inOuter) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(lat, lng, polygon[i])) return false;
  }
  return true;
}

function pointInMultiPolygon(lat: number, lng: number, multi: MultiPolygon) {
  return multi.some((polygon) => pointInPolygon(lat, lng, polygon));
}

function parseBoundaryObject(parsed: unknown): MultiPolygon | null {
  try {
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as {
      type?: string;
      coordinates?: unknown;
      geometry?: unknown;
      features?: unknown;
    };

    if (obj.type === "Polygon" && Array.isArray(obj.coordinates)) {
      return [obj.coordinates as Polygon];
    }
    if (obj.type === "MultiPolygon" && Array.isArray(obj.coordinates)) {
      return obj.coordinates as MultiPolygon;
    }
    if (obj.type === "Feature" && obj.geometry) {
      return parseBoundaryObject(obj.geometry);
    }
    if (obj.type === "FeatureCollection" && Array.isArray(obj.features)) {
      for (const feature of obj.features) {
        const parsedFeature = parseBoundaryObject(feature);
        if (parsedFeature) return parsedFeature;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function loadDomainRuntimeConfig(
  admin: SupabaseClient,
  tenantKey: string,
  domainKey: string,
): Promise<DomainRuntimeConfig | null> {
  const cacheKey = `${tenantKey}:${domainKey}`;
  const cacheHit = domainConfigCache.get(cacheKey);
  if (cacheHit && cacheHit.expiresAt > Date.now()) return cacheHit.value;

  const tenantResult = await admin
    .from("tenants")
    .select("tenant_key,boundary_config_key,notification_email_potholes,notification_email_water_drain,active")
    .eq("tenant_key", tenantKey)
    .maybeSingle();
  if (tenantResult.error) {
    throw new Error(tenantResult.error.message || "Failed to load tenant config");
  }
  const tenant = tenantResult.data;

  let assignmentResult = await admin
    .from("tenant_domain_assignments")
    .select("active,visibility,display_label,notification_email,notification_cc_emails,notification_template_key,notification_subject_template,notification_body_template")
    .eq("tenant_key", tenantKey)
    .eq("domain_key", domainKey)
    .maybeSingle();
  if (assignmentResult.error && isMissingColumnError(assignmentResult.error)) {
    assignmentResult = await admin
      .from("tenant_domain_assignments")
      .select("active,visibility,notification_email")
      .eq("tenant_key", tenantKey)
      .eq("domain_key", domainKey)
      .maybeSingle();
  }
  const definitionResult = await admin
    .from("domain_definitions")
    .select("key,label,domain_class,status,default_notification_email")
    .eq("key", domainKey)
    .maybeSingle();

  if (assignmentResult.error) {
    throw new Error(assignmentResult.error.message || "Failed to load tenant domain assignment");
  }
  if (definitionResult.error) {
    throw new Error(definitionResult.error.message || "Failed to load domain definition");
  }

  let legacyDomainNotificationEmail = "";
  if (domainKey === "potholes" || domainKey === "water_drain_issues") {
    const domainConfigResult = await admin
      .from("tenant_domain_configs")
      .select("notification_email")
      .eq("tenant_key", tenantKey)
      .eq("domain", domainKey)
      .maybeSingle();
    if (domainConfigResult.error) {
      const message = String(domainConfigResult.error.message || "").toLowerCase();
      if (!message.includes("tenant_domain_configs") && !message.includes("relation") && !message.includes("schema cache")) {
        throw new Error(domainConfigResult.error.message || "Failed to load legacy domain config");
      }
    } else {
      legacyDomainNotificationEmail = String(domainConfigResult.data?.notification_email || "").trim();
    }
  }

  let value: DomainRuntimeConfig | null = null;
  if (tenant && tenant.active !== false) {
    const assignment = assignmentResult.data;
    const definition = definitionResult.data;
    const fallbackRecipient =
      domainKey === "potholes"
        ? String(tenant.notification_email_potholes || "").trim()
        : domainKey === "water_drain_issues"
          ? String(tenant.notification_email_water_drain || "").trim()
          : "";
    value = {
      tenantKey: String(tenant.tenant_key || tenantKey).trim().toLowerCase() || tenantKey,
      boundaryConfigKey: String(tenant.boundary_config_key || `${tenantKey}_city_geojson`).trim() || `${tenantKey}_city_geojson`,
      domainKey,
      domainLabel: String(assignment?.display_label || definition?.label || humanizeKey(domainKey, domainKey)).trim() || humanizeKey(domainKey, domainKey),
      domainClass: String(definition?.domain_class || "incident_driven").trim().toLowerCase() || "incident_driven",
      recipientEmail:
        String(assignment?.notification_email || "").trim()
        || String(definition?.default_notification_email || "").trim()
        || legacyDomainNotificationEmail
        || fallbackRecipient,
      ccRecipientEmails: String(assignment?.notification_cc_emails || "").trim(),
      assignmentActive: assignment?.active !== false,
      assignmentVisible: String(assignment?.visibility || "enabled").trim().toLowerCase() !== "disabled",
      notificationTemplateKey: String(assignment?.notification_template_key || "standard_ops").trim().toLowerCase() || "standard_ops",
      notificationSubjectTemplate: String(assignment?.notification_subject_template || "").trim() || defaultSubjectTemplate(),
      notificationBodyTemplate: String(assignment?.notification_body_template || "").trim() || defaultBodyTemplate(),
    };
    if (String(definition?.status || "active").trim().toLowerCase() === "archived") {
      value.assignmentActive = false;
    }
  } else if (TENANT_FALLBACK_ENABLED && tenantKey === DEFAULT_TENANT_KEY) {
    value = {
      tenantKey,
      boundaryConfigKey: "ashtabula_city_geojson",
      domainKey,
      domainLabel: humanizeKey(domainKey, domainKey),
      domainClass: "incident_driven",
      recipientEmail: "",
      ccRecipientEmails: "",
      assignmentActive: true,
      assignmentVisible: true,
      notificationTemplateKey: "standard_ops",
      notificationSubjectTemplate: defaultSubjectTemplate(),
      notificationBodyTemplate: defaultBodyTemplate(),
    };
  }

  domainConfigCache.set(cacheKey, {
    expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
    value,
  });

  return value;
}

async function loadBoundary(admin: SupabaseClient, cfg: DomainRuntimeConfig): Promise<MultiPolygon | null> {
  const cacheKey = `${cfg.tenantKey}:${cfg.boundaryConfigKey}`;
  const cacheHit = boundaryCache.get(cacheKey);
  if (cacheHit && cacheHit.expiresAt > Date.now()) return cacheHit.value;

  let parsed: MultiPolygon | null = null;
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", cfg.boundaryConfigKey)
    .maybeSingle();
  parsed = parseBoundaryObject(data?.value);

  if (!parsed && TENANT_FALLBACK_ENABLED && cfg.tenantKey === DEFAULT_TENANT_KEY) {
    const raw = (Deno.env.get("ASHTABULA_CITY_GEOJSON") || "").trim();
    if (raw) {
      try {
        parsed = parseBoundaryObject(JSON.parse(raw));
      } catch {
        parsed = null;
      }
    }
  }

  boundaryCache.set(cacheKey, {
    expiresAt: Date.now() + BOUNDARY_CACHE_TTL_MS,
    value: parsed,
  });
  return parsed;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const tenantKey = normalizeTenantKey(body?.tenant_key);
    const domainKey = normalizeDomainKey(body?.domain_key || body?.domain);
    if (!tenantKey) return json({ ok: false, error: "tenant_key is required" }, 400);
    if (!domainKey) return json({ ok: false, error: "domain_key is required" }, 400);

    const headerTenantKey = requestTenantKey(req);
    if (headerTenantKey && headerTenantKey !== tenantKey) {
      return json({ ok: false, error: "tenant_key mismatch with request header" }, 409);
    }

    const admin = createAdminClient();
    const cfg = await loadDomainRuntimeConfig(admin, tenantKey, domainKey);
    if (!cfg) {
      return json({ ok: false, error: "Unknown or inactive tenant" }, 404);
    }
    if (!cfg.assignmentActive || !cfg.assignmentVisible) {
      return json({ ok: true, skipped: true, reason: "domain_not_assigned_or_disabled" });
    }

    const validateOnly = Boolean(body?.validate_only || body?.validateOnly);
    const location = body?.location || {};
    let lat = toFiniteNumber(location?.lat);
    let lng = toFiniteNumber(location?.lng);
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
      lat = toFiniteNumber(body?.lat) ?? lat;
      lng = toFiniteNumber(body?.lng) ?? lng;
    }
    if ((!isFiniteNumber(lat) || !isFiniteNumber(lng)) && typeof location?.text === "string") {
      const match = String(location.text).trim().match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (match) {
        lat = toFiniteNumber(match[1]) ?? lat;
        lng = toFiniteNumber(match[2]) ?? lng;
      }
    }
    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
      return json({ ok: false, error: "Missing/invalid coordinates" }, 400);
    }

    const boundary = await loadBoundary(admin, cfg);
    if (!boundary) {
      return json({ ok: true, skipped: true, reason: "city_boundary_not_configured" });
    }
    if (!pointInMultiPolygon(lat, lng, boundary)) {
      return json({ ok: true, skipped: true, reason: "outside_city_limits" });
    }
    if (validateOnly) {
      return json({ ok: true, skipped: false, qualified: true, reason: "qualified_in_city_limits" });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const recipientEmail = String(cfg.recipientEmail || "").trim();
    const ccRecipients = dedupeEmails(splitEmails(cfg.ccRecipientEmails).filter((email) => email !== recipientEmail.toLowerCase()));
    const fromEmail = Deno.env.get("PW_REPORT_FROM") || "CityReport.io <noreply@auth.cityreport.io>";
    const brandLogoUrl =
      Deno.env.get("PW_EMAIL_BRAND_LOGO_DARK_URL")
      || "https://cityreport.io/Logos/cityreport_logo_dark_mode.svg";
    if (!resendApiKey) {
      await logEmailDeliveryEvent(admin, {
        tenantKey: cfg.tenantKey,
        domain: cfg.domainKey,
        reportNumber: String(body?.reportNumber || "").trim(),
        recipientEmail,
        httpStatus: 500,
        success: false,
        errorText: "Missing RESEND_API_KEY",
      });
      return json({ ok: false, error: "Missing email config" }, 500);
    }
    if (!recipientEmail) {
      await logEmailDeliveryEvent(admin, {
        tenantKey: cfg.tenantKey,
        domain: cfg.domainKey,
        reportNumber: String(body?.reportNumber || "").trim(),
        recipientEmail: "",
        httpStatus: 200,
        success: false,
        errorText: "Notification recipient not configured",
        metadata: { skipped: true, reason: "notification_email_not_configured" },
      });
      return json({ ok: true, skipped: true, reason: "notification_email_not_configured" });
    }

    const domainLabel = String(body?.domainLabel || cfg.domainLabel).trim() || cfg.domainLabel;
    const issueType = String(body?.issueType || "").trim();
    const reportNumber = String(body?.reportNumber || "").trim() || "Unknown";
    const notesRaw = String(body?.notes || "").trim();
    const notes = normalizeNotes(notesRaw);
    const imageUrl = extractImageUrl(body?.imageUrl || notesRaw);
    const locationText =
      String(location?.text || "").trim()
      || String(body?.closestAddress || "").trim()
      || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const closestAddress = String(body?.closestAddress || "").trim() || "Address unavailable";
    const closestLandmark = normalizeLandmark(body?.closestLandmark);
    const closestCrossStreet = normalizeCrossStreet(body?.closestCrossStreet);
    const closestIntersection = String(body?.closestIntersection || "").trim() || "No nearby intersection";
    const submittedAtLocal = String(body?.submittedAtLocal || "").trim() || "Unknown";
    const reporter = body?.reporter || {};
    const reporterType = String(reporter?.type || "").trim() || "unknown";
    const reporterName = String(reporter?.name || "").trim() || "Unknown";
    const reporterEmail = String(reporter?.email || "").trim() || "Not provided";
    const reporterPhone = String(reporter?.phone || "").trim() || "Not provided";
    const normalizedTypeOptions = normalizeDomainTypeOptions(body?.typeOptions);
    const typeOptionsSummary = normalizedTypeOptions.length
      ? normalizedTypeOptions.map((row) => `${row.label}: ${row.valueLabel}`).join(" | ")
      : "Not provided";
    const typeOptionTemplateVariables = Object.fromEntries(
      normalizedTypeOptions.map((row) => [row.macroKey, row.valueLabel])
    );

    const templateVariables = {
      tenant_key: cfg.tenantKey,
      domain_label: domainLabel,
      issue_type: issueType || "Not provided",
      type_options_summary: typeOptionsSummary,
      report_number: reportNumber,
      closest_address: closestAddress,
      closest_cross_street: closestCrossStreet,
      closest_intersection: closestIntersection,
      closest_landmark: closestLandmark,
      location_text: locationText,
      image_url: imageUrl || "Not provided",
      submitted_at_local: submittedAtLocal,
      notes,
      reporter_type: reporterType,
      reporter_name: reporterName,
      reporter_email: reporterEmail,
      reporter_phone: reporterPhone,
      ...typeOptionTemplateVariables,
    };

    const subject = renderTemplate(cfg.notificationSubjectTemplate || defaultSubjectTemplate(), templateVariables)
      || (issueType ? `${domainLabel} report: ${issueType} (${reportNumber})` : `${domainLabel} report (${reportNumber})`);
    const bodyText = renderTemplate(cfg.notificationBodyTemplate || defaultBodyTemplate(), templateVariables)
      || renderTemplate(defaultBodyTemplate(), templateVariables);
    const title = String(body?.title || "").trim() || `${domainLabel} report received`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#122033;max-width:700px;margin:0 auto;padding:24px;background:#f5f8fb;">
        <div style="background:#ffffff;border:1px solid #d9e3ee;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(180deg,#16324f 0%,#1b4266 100%);color:#ffffff;padding:18px 24px;">
            <div style="display:grid;gap:14px;">
              <img
                src="${escapeHtml(brandLogoUrl)}"
                alt="CityReport.io"
                width="150"
                style="display:block;width:150px;max-width:100%;height:auto;"
              />
              <h2 style="margin:0;font-size:24px;line-height:1.2;">${escapeHtml(subject)}</h2>
            </div>
          </div>
          <div style="padding:24px;">
            <p style="margin:0 0 16px;">${escapeHtml(title)}</p>
            <div style="padding:16px;background:#f5f8fb;border-radius:12px;white-space:pre-wrap;font-size:14px;">${escapeHtml(bodyText)}</div>
          </div>
        </div>
        <p style="font-size:12px;color:#50667f;margin:14px 4px 0;">
          This report was submitted through CityReport.io and forwarded by our system as an intermediary.
          For questions or follow-up, please contact the reporter directly using the contact information above.
        </p>
      </div>
    `.trim();

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        ...(ccRecipients.length ? { cc: ccRecipients } : {}),
        subject,
        text: bodyText,
        html,
      }),
    });

    const resendStatus = Number(resendRes.status || 0);
    const resendBodyText = await resendRes.text().catch(() => "");
    let providerMessageId = "";
    try {
      const parsed = JSON.parse(resendBodyText);
      providerMessageId = String(parsed?.id || "").trim();
    } catch {
      providerMessageId = "";
    }

    if (!resendRes.ok) {
      await logEmailDeliveryEvent(admin, {
        tenantKey: cfg.tenantKey,
        domain: cfg.domainKey,
        reportNumber,
        recipientEmail,
        providerMessageId,
        httpStatus: resendStatus || 502,
        success: false,
        errorText: resendBodyText || "Resend returned non-2xx",
        metadata: {
          domainLabel,
          issueType,
          notificationTemplateKey: cfg.notificationTemplateKey,
          ccRecipients,
        },
      });
      return json({ ok: false, error: resendBodyText }, 502);
    }

    await logEmailDeliveryEvent(admin, {
      tenantKey: cfg.tenantKey,
      domain: cfg.domainKey,
      reportNumber,
      recipientEmail,
      providerMessageId,
      httpStatus: resendStatus || 200,
      success: true,
        metadata: {
          domainLabel,
          issueType,
          notificationTemplateKey: cfg.notificationTemplateKey,
          ccRecipients,
          closestAddress,
          closestCrossStreet,
          closestIntersection,
        closestLandmark,
      },
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err || "Unknown error") }, 500);
  }
});
