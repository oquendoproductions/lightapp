import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version, x-tenant-key",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clampText(value: unknown, max = 255): string {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, max);
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function normalizeDomain(value: unknown): "streetlights" | "potholes" | "water_main" {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "potholes") return "potholes";
  if (
    raw === "water_drain_issues" ||
    raw === "water drain issues" ||
    raw === "water_drain" ||
    raw === "water_main" ||
    raw === "water main"
  ) {
    return "water_main";
  }
  return "streetlights";
}

function normalizeWaterIssueType(value: unknown): "sewer_backup" | "storm_drain_clog" {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "sewer_backup" || raw === "sewer backup") return "sewer_backup";
  return "storm_drain_clog";
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

    const domain = normalizeDomain(body?.domain);
    const incidentId = String(
      body?.incident_id || body?.incidentId || body?.light_id || body?.lightId || body?.pothole_id || ""
    ).trim();
    if (!incidentId) {
      return json({ ok: false, error: "Missing incident identifier" }, 400);
    }

    const nearestAddress = clampText(body?.nearest_address ?? body?.nearestAddress, 400);
    const nearestCrossStreet = clampText(body?.nearest_cross_street ?? body?.nearestCrossStreet, 240);
    const nearestLandmark = clampText(body?.nearest_landmark ?? body?.nearestLandmark, 240);
    const lat = finiteOrNull(body?.lat);
    const lng = finiteOrNull(body?.lng);
    const issueType = normalizeWaterIssueType(body?.issue_type ?? body?.issueType);

    if (!nearestAddress && !nearestCrossStreet && !nearestLandmark) {
      return json({ ok: true, skipped: true, reason: "no_geo_values" });
    }

    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !serviceRole) {
      return json({ ok: false, error: "Missing Supabase service role configuration" }, 500);
    }

    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    const updatePayload = {
      tenant_key: tenantKey,
      nearest_address: nearestAddress || null,
      nearest_cross_street: nearestCrossStreet || null,
      nearest_landmark: nearestLandmark || null,
      geo_updated_at: new Date().toISOString(),
    };
    let data: Record<string, unknown> | null = null;
    let error: { message?: string } | null = null;

    if (domain === "streetlights") {
      const res = await admin
        .from("official_lights")
        .update(updatePayload)
        .eq("tenant_key", tenantKey)
        .eq("id", incidentId)
        .select("tenant_key,id, nearest_address, nearest_cross_street, nearest_landmark, geo_updated_at")
        .maybeSingle();
      data = res.data as Record<string, unknown> | null;
      error = res.error as { message?: string } | null;
    } else if (domain === "potholes") {
      const res = await admin
        .from("potholes")
        .update({
          ...updatePayload,
          location_label: nearestAddress || null,
        })
        .eq("tenant_key", tenantKey)
        .eq("id", incidentId)
        .select("tenant_key,id, nearest_address, nearest_cross_street, nearest_landmark, geo_updated_at")
        .maybeSingle();
      data = res.data as Record<string, unknown> | null;
      error = res.error as { message?: string } | null;
    } else {
      const nowIso = new Date().toISOString();
      const res = await admin
        .from("water_drain_incidents")
        .upsert(
          [
            {
              tenant_key: tenantKey,
              incident_id: incidentId,
              issue_type: issueType,
              lat,
              lng,
              nearest_address: nearestAddress || null,
              nearest_cross_street: nearestCrossStreet || null,
              nearest_landmark: nearestLandmark || null,
              geo_updated_at: nowIso,
            },
          ],
          { onConflict: "tenant_key,incident_id" }
        )
        .select("tenant_key,incident_id, wd_id, issue_type, lat, lng, nearest_address, nearest_cross_street, nearest_landmark, geo_updated_at, updated_at")
        .maybeSingle();
      data = res.data as Record<string, unknown> | null;
      error = res.error as { message?: string } | null;
    }

    if (error) {
      return json({ ok: false, error: error.message }, 400);
    }
    if (!data) {
      return json({ ok: true, skipped: true, reason: "row_not_found", domain, incident_id: incidentId });
    }

    return json({ ok: true, tenant_key: tenantKey, domain, incident_id: incidentId, row: data });
  } catch (err) {
    return json({ ok: false, error: String((err as Error)?.message || err || "Unknown error") }, 500);
  }
});
