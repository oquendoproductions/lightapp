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

type TenantRuntimeConfig = {
  tenantKey: string;
  boundaryConfigKey: string;
  waterDrainEmailTo: string;
};

const DEFAULT_TENANT_KEY = "ashtabulacity";
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000;
const BOUNDARY_CACHE_TTL_MS = 5 * 60 * 1000;
const TENANT_FALLBACK_ENABLED =
  String(Deno.env.get("TENANT_FALLBACK_ENABLED") || "true").trim().toLowerCase() === "true";

const tenantConfigCache = new Map<string, { expiresAt: number; value: TenantRuntimeConfig | null }>();
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
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return key;
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
    .filter((s) => !/^(address|landmark|location|image)\s*:/i.test(s));
  return chunks.join(" | ").trim() || "No notes provided";
}

function extractImageUrl(raw: unknown): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const m = text.match(/(?:^|\s)Image:\s*(https?:\/\/[^\s|]+)(?:\s*\||$)/i);
  return String(m?.[1] || "").trim();
}

function normalizeLandmark(raw: unknown): string {
  const v = String(raw || "").trim();
  if (!v) return "No nearby landmark";
  if (/^\d+\s*\/\s*\d+$/.test(v)) return "No nearby landmark";
  if (/^\d+$/.test(v)) return "No nearby landmark";
  if (v.length < 3) return "No nearby landmark";
  return v;
}

function normalizeCrossStreet(raw: unknown): string {
  const v = String(raw || "").trim();
  if (!v) return "No nearby cross street";
  if (/^\d+\s*\/\s*\d+$/.test(v)) return "No nearby cross street";
  if (v.length < 2) return "No nearby cross street";
  return v;
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
      for (const f of obj.features) {
        const parsedFeature = parseBoundaryObject(f);
        if (parsedFeature) return parsedFeature;
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function loadTenantRuntimeConfig(admin: SupabaseClient, tenantKey: string): Promise<TenantRuntimeConfig | null> {
  const cacheHit = tenantConfigCache.get(tenantKey);
  if (cacheHit && cacheHit.expiresAt > Date.now()) return cacheHit.value;

  const { data, error } = await admin
    .from("tenants")
    .select("tenant_key,boundary_config_key,notification_email_water_drain,active")
    .eq("tenant_key", tenantKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load tenant config");
  }

  let value: TenantRuntimeConfig | null = null;
  if (data && data.active !== false) {
    let domainNotificationEmail = "";
    const { data: domainConfig, error: domainConfigError } = await admin
      .from("tenant_domain_configs")
      .select("notification_email")
      .eq("tenant_key", tenantKey)
      .eq("domain", "water_drain_issues")
      .maybeSingle();
    if (domainConfigError) {
      const message = String(domainConfigError.message || "").toLowerCase();
      if (!message.includes("tenant_domain_configs") && !message.includes("relation") && !message.includes("schema cache")) {
        throw new Error(domainConfigError.message || "Failed to load domain config");
      }
    } else {
      domainNotificationEmail = String(domainConfig?.notification_email || "").trim();
    }
    value = {
      tenantKey: String(data.tenant_key || tenantKey).trim().toLowerCase() || tenantKey,
      boundaryConfigKey: String(data.boundary_config_key || `${tenantKey}_city_geojson`).trim() || `${tenantKey}_city_geojson`,
      waterDrainEmailTo: domainNotificationEmail || String(data.notification_email_water_drain || "").trim(),
    };
  } else if (TENANT_FALLBACK_ENABLED && tenantKey === DEFAULT_TENANT_KEY) {
    value = {
      tenantKey,
      boundaryConfigKey: "ashtabula_city_geojson",
      waterDrainEmailTo: "",
    };
  }

  tenantConfigCache.set(tenantKey, {
    expiresAt: Date.now() + TENANT_CACHE_TTL_MS,
    value,
  });

  return value;
}

async function loadBoundary(admin: SupabaseClient, tenantCfg: TenantRuntimeConfig): Promise<MultiPolygon | null> {
  const cacheKey = `${tenantCfg.tenantKey}:${tenantCfg.boundaryConfigKey}`;
  const cacheHit = boundaryCache.get(cacheKey);
  if (cacheHit && cacheHit.expiresAt > Date.now()) return cacheHit.value;

  let parsed: MultiPolygon | null = null;

  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", tenantCfg.boundaryConfigKey)
    .maybeSingle();

  parsed = parseBoundaryObject(data?.value);

  if (!parsed && TENANT_FALLBACK_ENABLED && tenantCfg.tenantKey === DEFAULT_TENANT_KEY) {
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
    if (!tenantKey) {
      return json({ ok: false, error: "tenant_key is required" }, 400);
    }
    const headerTenantKey = requestTenantKey(req);
    if (headerTenantKey && headerTenantKey !== tenantKey) {
      return json({ ok: false, error: "tenant_key mismatch with request header" }, 409);
    }

    const admin = createAdminClient();
    const tenantCfg = await loadTenantRuntimeConfig(admin, tenantKey);
    if (!tenantCfg) {
      return json({ ok: false, error: "Unknown or inactive tenant" }, 404);
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
      const m = String(location.text)
        .trim()
        .match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (m) {
        lat = toFiniteNumber(m[1]) ?? lat;
        lng = toFiniteNumber(m[2]) ?? lng;
      }
    }

    if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
      return json({ ok: false, error: "Missing/invalid coordinates" }, 400);
    }

    const boundary = await loadBoundary(admin, tenantCfg);
    if (!boundary) {
      return json({ ok: true, skipped: true, reason: "city_boundary_not_configured" });
    }

    const inCity = pointInMultiPolygon(lat, lng, boundary);
    if (!inCity) {
      return json({ ok: true, skipped: true, reason: "outside_city_limits" });
    }

    if (validateOnly) {
      return json({ ok: true, skipped: false, qualified: true, reason: "qualified_in_city_limits" });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
    const TO_EMAIL = tenantCfg.waterDrainEmailTo || Deno.env.get("PW_REPORT_TO") || "";
    const FROM_EMAIL =
      Deno.env.get("PW_REPORT_FROM") || "CityReport.io <noreply@auth.cityreport.io>";

    if (!RESEND_API_KEY || !TO_EMAIL) {
      await logEmailDeliveryEvent(admin, {
        tenantKey: tenantCfg.tenantKey,
        domain: "water_drain_issues",
        reportNumber: String(body?.reportNumber || "").trim(),
        recipientEmail: String(TO_EMAIL || "").trim(),
        httpStatus: 500,
        success: false,
        errorText: "Missing email config",
        metadata: { missingResendApiKey: !RESEND_API_KEY, missingRecipient: !TO_EMAIL },
      });
      return json({ ok: false, error: "Missing email config" }, 500);
    }

    const title = String(body?.title || "").trim() || "Attention Public Works, Water/Drain issue report";
    const issueType = String(body?.issueType || "").trim() || "Water / Drain Issue";
    const reportNumber = String(body?.reportNumber || "").trim() || "Unknown";
    const notesRaw = String(body?.notes || "").trim();
    const notes = normalizeNotes(notesRaw);
    const imageUrl = extractImageUrl(notesRaw);
    const locationText = String(location?.text || "").trim() || "Unknown";
    const closestAddress = String(body?.closestAddress || "").trim() || "Address unavailable";
    const closestLandmark = normalizeLandmark(body?.closestLandmark);
    const closestCrossStreet = normalizeCrossStreet(body?.closestCrossStreet);
    const submittedAtLocal = String(body?.submittedAtLocal || "").trim();
    const reporter = body?.reporter || {};
    const reporterName = String(reporter?.name || "").trim() || "Unknown";
    const reporterEmail = String(reporter?.email || "").trim() || "Not provided";
    const reporterPhone = String(reporter?.phone || "").trim() || "Not provided";

    const subject = title;

    const text = [
      title,
      "",
      `Tenant: ${tenantCfg.tenantKey}`,
      `Issue Type: ${issueType}`,
      `Report Number: ${reportNumber}`,
      `Closest Address: ${closestAddress}`,
      `Cross Street: ${closestCrossStreet}`,
      `Closest Landmark: ${closestLandmark}`,
      `Location: ${locationText}`,
      ...(imageUrl ? [`Image: View image (${imageUrl})`] : []),
      `Notes: ${notes}`,
      `Submitted (Local): ${submittedAtLocal || "Unknown"}`,
      "",
      "Reported by:",
      `Name: ${reporterName}`,
      `Email: ${reporterEmail}`,
      `Phone: ${reporterPhone}`,
      "",
      "Disclaimer:",
      "This report was submitted through CityReport.io and forwarded by our system as an intermediary.",
      "For questions or follow-up, please contact the reporter directly using the contact information above.",
    ].join("\n");

    const html = `
      <h2>${subject}</h2>
      <p><b>Tenant:</b> ${tenantCfg.tenantKey}</p>
      <p><b>Issue Type:</b> ${issueType}</p>
      <p><b>Report Number:</b> ${reportNumber}</p>
      <p><b>Closest Address:</b> ${closestAddress}</p>
      <p><b>Cross Street:</b> ${closestCrossStreet}</p>
      <p><b>Closest Landmark:</b> ${closestLandmark}</p>
      <p><b>Location:</b> ${locationText}</p>
      ${imageUrl ? `<p><b>Image:</b> <a href="${imageUrl}" target="_blank" rel="noopener noreferrer">View image</a></p>` : ""}
      <p><b>Notes:</b> ${notes}</p>
      <p><b>Submitted (Local):</b> ${submittedAtLocal || "Unknown"}</p>
      <hr />
      <p><b>Reported by:</b></p>
      <p><b>Name:</b> ${reporterName}</p>
      <p><b>Email:</b> ${reporterEmail}</p>
      <p><b>Phone:</b> ${reporterPhone}</p>
      <hr />
      <p><b>Disclaimer:</b> This report was submitted through CityReport.io and forwarded by our system as an intermediary.</p>
      <p>For questions or follow-up, please contact the reporter directly using the contact information above.</p>
    `;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
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
      providerMessageId = String(parsed?.id || "").trim();
    } catch {
      providerMessageId = "";
    }

    if (!resendRes.ok) {
      await logEmailDeliveryEvent(admin, {
        tenantKey: tenantCfg.tenantKey,
        domain: "water_drain_issues",
        reportNumber,
        recipientEmail: TO_EMAIL,
        providerMessageId,
        httpStatus: resendStatus || 502,
        success: false,
        errorText: resendBodyText || "Resend returned non-2xx",
        metadata: { issueType },
      });
      return json({ ok: false, error: resendBodyText }, 502);
    }

    await logEmailDeliveryEvent(admin, {
      tenantKey: tenantCfg.tenantKey,
      domain: "water_drain_issues",
      reportNumber,
      recipientEmail: TO_EMAIL,
      providerMessageId,
      httpStatus: resendStatus || 200,
      success: true,
      metadata: {
        issueType,
        closestAddress,
        closestCrossStreet,
        closestLandmark,
      },
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err || "Unknown error") }, 500);
  }
});
