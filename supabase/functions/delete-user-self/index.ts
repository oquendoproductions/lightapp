import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

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

function trimOrEmpty(raw: unknown): string {
  return String(raw || "").trim();
}

function normalizeEmail(raw: unknown): string {
  return trimOrEmpty(raw).toLowerCase();
}

function normalizePhoneDigits(raw: unknown): string {
  return String(raw || "").replace(/\D/g, "");
}

function isMissingRelationError(error: any) {
  const code = trimOrEmpty(error?.code).toUpperCase();
  const message = trimOrEmpty(error?.message).toLowerCase();
  return code === "42P01" || message.includes("relation") || message.includes("does not exist");
}

function createAdminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !service) throw new Error("Missing Supabase service role configuration");
  return createClient(url, service, { auth: { persistSession: false } });
}

async function requireSessionUser(req: Request, admin: SupabaseClient) {
  const authHeader = trimOrEmpty(req.headers.get("authorization"));
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, response: json({ ok: false, error: "Missing bearer token." }, 401) };
  }

  const token = trimOrEmpty(authHeader.slice(7));
  if (!token) {
    return { ok: false, response: json({ ok: false, error: "Missing bearer token." }, 401) };
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !trimOrEmpty(data?.user?.id)) {
    return { ok: false, response: json({ ok: false, error: "Invalid session." }, 401) };
  }

  return { ok: true, user: data.user };
}

async function safeDeleteByEq(
  admin: SupabaseClient,
  table: string,
  column: string,
  value: string,
) {
  if (!trimOrEmpty(value)) return 0;
  const { error, count } = await admin
    .from(table)
    .delete({ count: "exact" })
    .eq(column, value);

  if (error) {
    if (isMissingRelationError(error)) return 0;
    throw new Error(`${table}: ${error.message || error}`);
  }
  return Number(count || 0);
}

async function safeUpdateByEq(
  admin: SupabaseClient,
  table: string,
  matchColumn: string,
  matchValue: string,
  patch: Record<string, unknown>,
) {
  if (!trimOrEmpty(matchValue)) return 0;
  const { error, count } = await admin
    .from(table)
    .update(patch, { count: "exact" })
    .eq(matchColumn, matchValue);

  if (error) {
    if (isMissingRelationError(error)) return 0;
    throw new Error(`${table}: ${error.message || error}`);
  }
  return Number(count || 0);
}

async function hasBlockingStaffRoles(admin: SupabaseClient, userId: string) {
  const [platformRoles, tenantRoles, tenantAdmins, legacyAdmins] = await Promise.all([
    admin.from("platform_user_roles").select("role,status").eq("user_id", userId).eq("status", "active").limit(1),
    admin.from("tenant_user_roles").select("tenant_key,role,status").eq("user_id", userId).eq("status", "active").limit(1),
    admin.from("tenant_admins").select("tenant_key,user_id").eq("user_id", userId).limit(1),
    admin.from("admins").select("user_id").eq("user_id", userId).limit(1),
  ]);

  const results = [platformRoles, tenantRoles, tenantAdmins, legacyAdmins];
  for (const result of results) {
    if (result.error && !isMissingRelationError(result.error)) {
      throw new Error(result.error.message || "Unable to verify account roles.");
    }
  }

  return (
    Array.isArray(platformRoles.data) && platformRoles.data.length > 0
  ) || (
    Array.isArray(tenantRoles.data) && tenantRoles.data.length > 0
  ) || (
    Array.isArray(tenantAdmins.data) && tenantAdmins.data.length > 0
  ) || (
    Array.isArray(legacyAdmins.data) && legacyAdmins.data.length > 0
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);

  try {
    const admin = createAdminClient();
    const sessionUser = await requireSessionUser(req, admin);
    if (!sessionUser.ok) return sessionUser.response;

    const user = sessionUser.user;
    const userId = trimOrEmpty(user.id);
    const userEmail = normalizeEmail(user.email);
    const userPhoneDigits =
      normalizePhoneDigits(user.phone)
      || normalizePhoneDigits(user.user_metadata?.phone)
      || normalizePhoneDigits(user.user_metadata?.phone_number);

    if (await hasBlockingStaffRoles(admin, userId)) {
      return json(
        {
          ok: false,
          code: "staff_account",
          error: "Organization staff accounts must be removed through support so admin access can be reassigned first.",
        },
        409,
      );
    }

    const scrubbedReporterFields = {
      reporter_user_id: null,
      reporter_name: "Deleted User",
      reporter_email: null,
      reporter_phone: null,
    };

    const deletedCounts: Record<string, number> = {};
    const scrubbedCounts: Record<string, number> = {};

    deletedCounts.resident_notification_preferences = await safeDeleteByEq(
      admin,
      "resident_notification_preferences",
      "user_id",
      userId,
    );
    deletedCounts.native_push_tokens = await safeDeleteByEq(admin, "native_push_tokens", "user_id", userId);
    deletedCounts.resident_tenant_interests = await safeDeleteByEq(admin, "resident_tenant_interests", "user_id", userId);
    deletedCounts.utility_report_status = await safeDeleteByEq(admin, "utility_report_status", "user_id", userId);
    deletedCounts.platform_user_security_profiles = await safeDeleteByEq(admin, "platform_user_security_profiles", "user_id", userId);
    deletedCounts.tenant_user_security_profiles = await safeDeleteByEq(admin, "tenant_user_security_profiles", "user_id", userId);
    deletedCounts.profiles = await safeDeleteByEq(admin, "profiles", "user_id", userId);

    const identityHashes = [
      userId ? `uid:${userId}` : "",
      userEmail ? `email:${userEmail}` : "",
      userPhoneDigits ? `phone:${userPhoneDigits}` : "",
    ].filter(Boolean);

    let repairSignalDeletes = 0;
    let abuseRateDeletes = 0;
    for (const identityHash of identityHashes) {
      repairSignalDeletes += await safeDeleteByEq(admin, "incident_repair_signals", "identity_hash", identityHash);
      abuseRateDeletes += await safeDeleteByEq(admin, "abuse_rate_events", "identity_hash", identityHash);
    }
    deletedCounts.incident_repair_signals = repairSignalDeletes;
    deletedCounts.abuse_rate_events = abuseRateDeletes;

    scrubbedCounts.reports_by_user = await safeUpdateByEq(
      admin,
      "reports",
      "reporter_user_id",
      userId,
      scrubbedReporterFields,
    );
    scrubbedCounts.pothole_reports_by_user = await safeUpdateByEq(
      admin,
      "pothole_reports",
      "reporter_user_id",
      userId,
      scrubbedReporterFields,
    );

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json({ ok: false, error: deleteError.message || "Could not delete account." }, 500);
    }

    return json({
      ok: true,
      deleted_counts: deletedCounts,
      scrubbed_counts: scrubbedCounts,
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : "Unexpected account deletion failure." },
      500,
    );
  }
});
