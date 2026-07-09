import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version, x-tenant-key",
};

type DomainSubmitConfig = {
  domainKey: string;
  seededTable: string;
  reportsTable: string;
  seededSelect: string;
  reportSelect: string;
  seededIncidentIdField: string;
  seededExternalIdField: string;
  reportIncidentIdField: string;
  seededLocationLabelField?: string;
  seededNearestAddressField?: string;
  seededNearestCrossStreetField?: string;
  seededNearestLandmarkField?: string;
  seededCreatedByField?: string;
};

const DOMAIN_SUBMIT_CONFIG: Record<string, DomainSubmitConfig> = {
  potholes: {
    domainKey: "potholes",
    seededTable: "potholes",
    reportsTable: "pothole_reports",
    seededSelect: "id, tenant_key, ph_id, lat, lng, location_label, nearest_address, nearest_cross_street, nearest_landmark, created_at",
    reportSelect:
      "id, tenant_key, pothole_id, lat, lng, note, report_number, created_at, reporter_user_id, reporter_name, reporter_phone, reporter_email",
    seededIncidentIdField: "id",
    seededExternalIdField: "ph_id",
    reportIncidentIdField: "pothole_id",
    seededLocationLabelField: "location_label",
    seededNearestAddressField: "nearest_address",
    seededNearestCrossStreetField: "nearest_cross_street",
    seededNearestLandmarkField: "nearest_landmark",
    seededCreatedByField: "created_by",
  },
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeTenantKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function requestTenantKey(req: Request): string {
  return normalizeTenantKey(req.headers.get("x-tenant-key"));
}

function normalizeDomainKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanText(value: unknown, max = 1000): string {
  const text = String(value || "").trim();
  return text ? text.slice(0, max) : "";
}

function isUuidLike(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function normalizePotholeIncidentId(value: unknown): string {
  const normalized = String(value || "").replace(/^potholes?:/i, "").trim();
  return isUuidLike(normalized) ? normalized : "";
}

function normalizeIncidentId(domainKey: string, value: unknown): string {
  if (domainKey === "potholes") return normalizePotholeIncidentId(value);
  return cleanText(value, 120);
}

function createAdminClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceRole) {
    throw new Error("Missing Supabase service role configuration");
  }
  return createClient(url, serviceRole, { auth: { persistSession: false } });
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

    const domainKey = normalizeDomainKey(body?.domain_key ?? body?.domain);
    const config = DOMAIN_SUBMIT_CONFIG[domainKey] || null;
    if (!config) {
      return json({ ok: false, error: "Unsupported domain submit configuration" }, 400);
    }

    const lat = finiteOrNull(body?.lat);
    const lng = finiteOrNull(body?.lng);
    if (lat == null || lng == null) {
      return json({ ok: false, error: "lat and lng are required" }, 400);
    }

    const seededIncidentIdInput = normalizeIncidentId(
      domainKey,
      body?.incident_id ?? body?.incidentId ?? body?.light_id ?? body?.lightId ?? body?.[config.reportIncidentIdField]
    );
    const seededExternalId = cleanText(body?.[config.seededExternalIdField], 120);
    const locationLabel = cleanText(body?.location_label ?? body?.locationLabel, 400);
    const nearestAddress = cleanText(body?.nearest_address ?? body?.nearestAddress, 400);
    const nearestCrossStreet = cleanText(body?.nearest_cross_street ?? body?.nearestCrossStreet, 240);
    const nearestLandmark = cleanText(body?.nearest_landmark ?? body?.nearestLandmark, 240);
    const note = cleanText(body?.note, 5000) || null;
    const reporterUserId = cleanText(body?.reporter_user_id ?? body?.reporterUserId, 120) || null;
    const reporterName = cleanText(body?.reporter_name ?? body?.reporterName, 240);
    const reporterPhone = cleanText(body?.reporter_phone ?? body?.reporterPhone, 80) || null;
    const reporterEmail = cleanText(body?.reporter_email ?? body?.reporterEmail, 240) || null;
    const createdBy = cleanText(body?.created_by ?? body?.createdBy, 120) || null;

    const admin = createAdminClient();
    let seededRow: Record<string, unknown> | null = null;

    if (seededIncidentIdInput) {
      const existingByIncidentId = await admin
        .from(config.seededTable)
        .select(config.seededSelect)
        .eq("tenant_key", tenantKey)
        .eq(config.seededIncidentIdField, seededIncidentIdInput)
        .maybeSingle();
      if (existingByIncidentId.error) {
        return json({ ok: false, error: existingByIncidentId.error.message || "Could not load seeded incident record" }, 400);
      }
      seededRow = existingByIncidentId.data as Record<string, unknown> | null;
    }

    if (!seededRow && seededExternalId) {
      const existingByExternalId = await admin
        .from(config.seededTable)
        .select(config.seededSelect)
        .eq("tenant_key", tenantKey)
        .eq(config.seededExternalIdField, seededExternalId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!existingByExternalId.error && existingByExternalId.data) {
        seededRow = existingByExternalId.data as Record<string, unknown>;
      }
    }

    if (!seededRow) {
      const seededInsertPayload: Record<string, unknown> = {
        tenant_key: tenantKey,
        lat,
        lng,
      };
      if (config.seededExternalIdField) seededInsertPayload[config.seededExternalIdField] = seededExternalId || null;
      if (config.seededLocationLabelField) {
        seededInsertPayload[config.seededLocationLabelField] = locationLabel || nearestAddress || null;
      }
      if (config.seededNearestAddressField) seededInsertPayload[config.seededNearestAddressField] = nearestAddress || null;
      if (config.seededNearestCrossStreetField) seededInsertPayload[config.seededNearestCrossStreetField] = nearestCrossStreet || null;
      if (config.seededNearestLandmarkField) seededInsertPayload[config.seededNearestLandmarkField] = nearestLandmark || null;
      if (config.seededCreatedByField) seededInsertPayload[config.seededCreatedByField] = createdBy;

      const created = await admin
        .from(config.seededTable)
        .insert([seededInsertPayload])
        .select(config.seededSelect)
        .single();
      if (created.error) {
        return json({ ok: false, error: created.error.message || "Could not create seeded incident record" }, 400);
      }
      seededRow = created.data as Record<string, unknown>;
    }

    const resolvedIncidentId = cleanText(seededRow?.[config.seededIncidentIdField], 120);
    if (!resolvedIncidentId) {
      return json({ ok: false, error: "Resolved incident location is missing an id" }, 500);
    }

    const existingReport = await admin
      .from(config.reportsTable)
      .select(config.reportSelect)
      .eq("tenant_key", tenantKey)
      .eq(config.reportIncidentIdField, resolvedIncidentId)
      .eq("lat", lat)
      .eq("lng", lng)
      .eq("note", note)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingReport.error) {
      return json({ ok: false, error: existingReport.error.message || "Could not inspect existing reports" }, 400);
    }

    let reportRow = existingReport.data as Record<string, unknown> | null;
    if (!reportRow) {
      const reportInsertPayload: Record<string, unknown> = {
        tenant_key: tenantKey,
        lat,
        lng,
        note,
        reporter_user_id: reporterUserId,
        reporter_name: reporterName,
        reporter_phone: reporterPhone,
        reporter_email: reporterEmail,
      };
      reportInsertPayload[config.reportIncidentIdField] = resolvedIncidentId;
      const createdReport = await admin
        .from(config.reportsTable)
        .insert([reportInsertPayload])
        .select(config.reportSelect)
        .single();
      if (createdReport.error) {
        return json({ ok: false, error: createdReport.error.message || "Could not create report" }, 400);
      }
      reportRow = createdReport.data as Record<string, unknown>;
    }

    return json({
      ok: true,
      tenant_key: tenantKey,
      domain_key: domainKey,
      seeded: seededRow,
      report: reportRow,
    });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err || "Unknown error") }, 500);
  }
});
