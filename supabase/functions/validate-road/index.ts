import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

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

function normalizeTenantKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function validCoordinate(value: unknown, min: number, max: number): number | null {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max
    ? numberValue
    : null;
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
    const headerTenantKey = normalizeTenantKey(req.headers.get("x-tenant-key"));
    if (!tenantKey) return json({ ok: false, error: "tenant_key is required" }, 400);
    if (headerTenantKey && headerTenantKey !== tenantKey) {
      return json({ ok: false, error: "tenant_key mismatch with request header" }, 409);
    }

    const lat = validCoordinate(body?.lat, -90, 90);
    const lng = validCoordinate(body?.lng, -180, 180);
    if (lat === null || lng === null) {
      return json({ ok: false, error: "Valid lat and lng are required" }, 400);
    }

    const apiKey = String(Deno.env.get("GOOGLE_ROADS_API_KEY") || "").trim();
    if (!apiKey) {
      return json({ ok: false, error: "Road validation is not configured" }, 503);
    }
    const referrer = String(
      Deno.env.get("GOOGLE_ROADS_REFERRER") || "https://testcity.cityreport.io/",
    ).trim();
    const points = `${lat},${lng}`;
    const response = await fetch(
      `https://roads.googleapis.com/v1/nearestRoads?points=${encodeURIComponent(points)}&key=${encodeURIComponent(apiKey)}`,
      { headers: referrer ? { Referer: referrer } : {} },
    );
    if (!response.ok) {
      return json({ ok: false, error: "Road validation provider unavailable" }, 502);
    }

    const payload = await response.json();
    const snappedPoints = (Array.isArray(payload?.snappedPoints) ? payload.snappedPoints : [])
      .map((point: Record<string, unknown>) => {
        const location = point?.location as Record<string, unknown> | undefined;
        const latitude = Number(location?.latitude);
        const longitude = Number(location?.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        return {
          location: { latitude, longitude },
          placeId: String(point?.placeId || "").slice(0, 160),
          originalIndex: Number.isFinite(Number(point?.originalIndex))
            ? Number(point?.originalIndex)
            : undefined,
        };
      })
      .filter(Boolean);

    return json({ ok: true, snappedPoints });
  } catch {
    return json({ ok: false, error: "Road validation request failed" }, 500);
  }
});
