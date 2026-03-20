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

function normalizeEmail(v: unknown) {
  return String(v || "").trim().toLowerCase();
}

function normalizePhone(v: unknown) {
  return String(v || "").replace(/[^\d]/g, "");
}

function normalizeTenantKey(v: unknown) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function requestTenantKey(req: Request) {
  return normalizeTenantKey(req.headers.get("x-tenant-key"));
}

function pickIp(req: Request) {
  const cf = String(req.headers.get("cf-connecting-ip") || "").trim();
  if (cf) return cf;
  const xr = String(req.headers.get("x-real-ip") || "").trim();
  if (xr) return xr;
  const xf = String(req.headers.get("x-forwarded-for") || "").trim();
  if (!xf) return "";
  return String(xf.split(",")[0] || "").trim();
}

function identityKey(identity: {
  user_id?: unknown;
  email?: unknown;
  phone?: unknown;
  name?: unknown;
}) {
  const uid = String(identity?.user_id || "").trim();
  if (uid) return `uid:${uid}`;

  const email = normalizeEmail(identity?.email);
  if (email) return `email:${email}`;

  const phone = normalizePhone(identity?.phone);
  if (phone) return `phone:${phone}`;

  const name = String(identity?.name || "").trim().toLowerCase();
  if (name) return `name:${name}`;

  return "";
}

async function sha256Hex(input: string) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeDomain(v: unknown) {
  const d = String(v || "").trim().toLowerCase();
  return d || "streetlights";
}

function normalizeIdempotencyKey(v: unknown) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

async function logAbuseEvent(
  admin: ReturnType<typeof createClient>,
  row: {
    tenant_key: string;
    domain: string;
    identity_hash: string | null;
    ip_hash: string | null;
    event_kind: string;
    allowed: boolean;
    event_count: number;
    unit_count: number;
    reason?: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    await admin.from("abuse_events").insert([
      {
        tenant_key: row.tenant_key,
        domain: row.domain,
        identity_hash: row.identity_hash,
        ip_hash: row.ip_hash,
        event_kind: row.event_kind,
        allowed: row.allowed,
        event_count: Math.max(1, Math.trunc(Number(row.event_count) || 1)),
        unit_count: Math.max(1, Math.trunc(Number(row.unit_count) || 1)),
        reason: row.reason || null,
        metadata: row.metadata || {},
      },
    ]);
  } catch {
    // telemetry must be non-blocking
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ allowed: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const tenantKey = normalizeTenantKey(body?.tenant_key);
    if (!tenantKey) {
      return json({ allowed: false, error: "tenant_key is required" }, 400);
    }
    const headerTenantKey = requestTenantKey(req);
    if (headerTenantKey && headerTenantKey !== tenantKey) {
      return json({ allowed: false, error: "tenant_key mismatch with request header" }, 409);
    }

    const domain = safeDomain(body?.domain);
    const eventCount = Math.max(1, Math.min(100, Math.trunc(Number(body?.count) || 1)));
    const unitCount = Math.max(1, Math.min(500, Math.trunc(Number(body?.unitCount) || 1)));
    const windowMs = Math.max(1000, Math.min(3600000, Math.trunc(Number(body?.windowMs) || 60000)));
    const maxEvents = Math.max(1, Math.min(500, Math.trunc(Number(body?.maxEvents) || 7)));
    const maxUnits = Math.max(1, Math.min(5000, Math.trunc(Number(body?.maxUnits) || 20)));
    const idempotencyKey = normalizeIdempotencyKey(body?.idempotency_key || body?.idempotencyKey);

    const rawIdentity = identityKey(body?.identity || {});
    if (!rawIdentity) {
      return json({ allowed: true, remaining: maxEvents });
    }

    const ip = pickIp(req);
    const identityHash = await sha256Hex(rawIdentity);
    const ipHash = ip ? await sha256Hex(ip) : null;

    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !serviceRole) {
      return json({ allowed: true, remaining: maxEvents, degraded: true, reason: "missing_service_role" });
    }

    const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
    const sinceIso = new Date(Date.now() - windowMs).toISOString();

    const [identityRes, ipRes] = await Promise.all([
      admin
        .from("abuse_rate_events")
        .select("event_count, metadata, created_at")
        .eq("tenant_key", tenantKey)
        .eq("domain", domain)
        .eq("identity_hash", identityHash)
        .gte("created_at", sinceIso),
      ipHash
        ? admin
            .from("abuse_rate_events")
            .select("event_count, metadata, created_at")
            .eq("tenant_key", tenantKey)
            .eq("domain", domain)
            .eq("ip_hash", ipHash)
            .gte("created_at", sinceIso)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (identityRes.error || ipRes.error) {
      return json({
        allowed: true,
        remaining: maxEvents,
        degraded: true,
        reason: "read_failed",
      });
    }

    const readUnits = (r: { event_count?: unknown; metadata?: Record<string, unknown> }) => {
      const fromMeta = Number((r?.metadata || {})["unit_count"]);
      if (Number.isFinite(fromMeta) && fromMeta > 0) return Math.trunc(fromMeta);
      return Math.max(1, Number(r?.event_count) || 1);
    };

    const identityUsedEvents = (identityRes.data || []).reduce((acc, r) => acc + Math.max(1, Number(r.event_count) || 1), 0);
    const ipUsedEvents = (ipRes.data || []).reduce((acc, r) => acc + Math.max(1, Number(r.event_count) || 1), 0);
    const usedEvents = Math.max(identityUsedEvents, ipUsedEvents);

    const identityUsedUnits = (identityRes.data || []).reduce((acc, r) => acc + readUnits(r), 0);
    const ipUsedUnits = (ipRes.data || []).reduce((acc, r) => acc + readUnits(r), 0);
    const usedUnits = Math.max(identityUsedUnits, ipUsedUnits);

    const rows = [...(identityRes.data || []), ...(ipRes.data || [])];
    if (idempotencyKey) {
      const duplicate = (identityRes.data || []).some((r) => {
        const metadata = (r?.metadata && typeof r.metadata === "object")
          ? (r.metadata as Record<string, unknown>)
          : {};
        const rowKey = normalizeIdempotencyKey(metadata["idempotency_key"]);
        return rowKey && rowKey === idempotencyKey;
      });
      if (duplicate) {
        await logAbuseEvent(admin, {
          tenant_key: tenantKey,
          domain,
          identity_hash: identityHash,
          ip_hash: ipHash,
          event_kind: "idempotency_duplicate",
          allowed: true,
          event_count: eventCount,
          unit_count: unitCount,
          reason: "duplicate_idempotency_key",
          metadata: {
            idempotency_key: idempotencyKey,
          },
        });
        return json({
          allowed: true,
          duplicate: true,
          remaining: Math.max(0, maxEvents - usedEvents),
          remainingUnits: Math.max(0, maxUnits - usedUnits),
        });
      }
    }
    const earliestTs = rows.reduce((minTs, r) => {
      const ts = new Date(String(r.created_at || "")).getTime();
      if (!Number.isFinite(ts)) return minTs;
      if (!Number.isFinite(minTs)) return ts;
      return Math.min(minTs, ts);
    }, Number.NaN);

    if (usedEvents + eventCount > maxEvents || usedUnits + unitCount > maxUnits) {
      const retryAfterMs = Number.isFinite(earliestTs)
        ? Math.max(1000, windowMs - (Date.now() - earliestTs))
        : windowMs;
      await logAbuseEvent(admin, {
        tenant_key: tenantKey,
        domain,
        identity_hash: identityHash,
        ip_hash: ipHash,
        event_kind: "rate_limit_block",
        allowed: false,
        event_count: eventCount,
        unit_count: unitCount,
        reason: usedEvents + eventCount > maxEvents ? "event_cap" : "unit_cap",
        metadata: {
          window_ms: windowMs,
          max_events: maxEvents,
          max_units: maxUnits,
          used_events: usedEvents,
          used_units: usedUnits,
          retry_after_ms: retryAfterMs,
        },
      });
      return json({
        allowed: false,
        remaining: Math.max(0, maxEvents - usedEvents),
        remainingUnits: Math.max(0, maxUnits - usedUnits),
        retryAfterMs,
      });
    }

    const ins = await admin.from("abuse_rate_events").insert([
      {
        tenant_key: tenantKey,
        domain,
        identity_hash: identityHash,
        ip_hash: ipHash,
        event_count: eventCount,
        window_ms: windowMs,
        metadata: {
          source: "edge_function",
          has_ip: Boolean(ipHash),
          unit_count: unitCount,
          action_count: eventCount,
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
        },
      },
    ]);

    if (ins.error) {
      await logAbuseEvent(admin, {
        tenant_key: tenantKey,
        domain,
        identity_hash: identityHash,
        ip_hash: ipHash,
        event_kind: "telemetry_write_error",
        allowed: true,
        event_count: eventCount,
        unit_count: unitCount,
        reason: "abuse_rate_events_insert_failed",
        metadata: {
          message: String(ins.error?.message || ""),
          code: String((ins.error as { code?: string } | null)?.code || ""),
        },
      });
      return json({
        allowed: true,
        remaining: Math.max(0, maxEvents - (usedEvents + eventCount)),
        remainingUnits: Math.max(0, maxUnits - (usedUnits + unitCount)),
        degraded: true,
        reason: "write_failed",
      });
    }

    if (Math.random() < 0.05) {
      await admin.rpc("prune_abuse_rate_events", { p_retention: "7 days" }).catch(() => {});
    }

    await logAbuseEvent(admin, {
      tenant_key: tenantKey,
      domain,
      identity_hash: identityHash,
      ip_hash: ipHash,
      event_kind: "rate_limit_allow",
      allowed: true,
      event_count: eventCount,
      unit_count: unitCount,
      metadata: {
        window_ms: windowMs,
        max_events: maxEvents,
        max_units: maxUnits,
        used_events_before: usedEvents,
        used_units_before: usedUnits,
      },
    });

    return json({
      allowed: true,
      remaining: Math.max(0, maxEvents - (usedEvents + eventCount)),
      remainingUnits: Math.max(0, maxUnits - (usedUnits + unitCount)),
    });
  } catch (e) {
    return json({ allowed: true, degraded: true, reason: "exception", error: String(e) }, 200);
  }
});
