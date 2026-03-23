import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-tenant-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizePhoneDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeTenantKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function normalizeRoleKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function titleCaseWords(value: unknown) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function userMeta(user: any) {
  if (user?.user_metadata && typeof user.user_metadata === "object") return user.user_metadata;
  if (user?.raw_user_meta_data && typeof user.raw_user_meta_data === "object") return user.raw_user_meta_data;
  return {};
}

function buildUserDisplayName(user: any) {
  const meta = userMeta(user);
  const first = normalizeText(meta.first_name);
  const last = normalizeText(meta.last_name);
  const fullName =
    normalizeText(meta.full_name) ||
    normalizeText(meta.name) ||
    normalizeText([first, last].filter(Boolean).join(" "));
  if (fullName) return titleCaseWords(fullName);

  const email = normalizeEmail(user?.email);
  if (email) {
    return titleCaseWords(String(email.split("@")[0] || "").replace(/[._-]+/g, " "));
  }

  return String(user?.id || "").trim();
}

function buildUserPhone(user: any) {
  const meta = userMeta(user);
  return normalizeText(user?.phone) || normalizeText(meta.phone);
}

function toUserSummary(user: any) {
  return {
    id: String(user?.id || "").trim(),
    display_name: buildUserDisplayName(user),
    email: normalizeEmail(user?.email),
    phone: buildUserPhone(user),
  };
}

async function requirePlatformOwner(req: Request, admin: ReturnType<typeof createClient>) {
  const authHeader = String(req.headers.get("authorization") || "").trim();
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, response: json({ ok: false, error: "Missing bearer token." }, 401) };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, response: json({ ok: false, error: "Missing bearer token." }, 401) };
  }

  const { data: userResult, error: userError } = await admin.auth.getUser(token);
  if (userError || !userResult?.user?.id) {
    return { ok: false, response: json({ ok: false, error: "Invalid session." }, 401) };
  }

  const userId = String(userResult.user.id || "").trim();
  const [rolesResult, legacyAdminResult] = await Promise.all([
    admin
      .from("platform_user_roles")
      .select("role,status")
      .eq("user_id", userId)
      .eq("status", "active"),
    admin
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (rolesResult.error || legacyAdminResult.error) {
    return { ok: false, response: json({ ok: false, error: "Unable to verify platform role." }, 403) };
  }

  const roles = Array.isArray(rolesResult.data) ? rolesResult.data : [];
  const isOwner = roles.some((row) => String(row?.role || "").trim().toLowerCase() === "platform_owner");
  const isLegacyAdmin = Boolean(legacyAdminResult?.data?.user_id);
  if (!isOwner && !isLegacyAdmin) {
    return { ok: false, response: json({ ok: false, error: "Only Platform Owner can manage tenant users here." }, 403) };
  }

  return { ok: true, userId };
}

async function collectUsers(
  admin: ReturnType<typeof createClient>,
  matcher: (user: any) => boolean,
  limit = 12,
) {
  const results: any[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;

    const users = Array.isArray(data?.users) ? data.users : [];
    for (const user of users) {
      const userId = String(user?.id || "").trim();
      if (!userId || seen.has(userId)) continue;
      if (!matcher(user)) continue;
      seen.add(userId);
      results.push(toUserSummary(user));
      if (results.length >= limit) return results;
    }

    if (users.length < 200) break;
  }

  return results;
}

async function findUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
) {
  const matches = await collectUsers(
    admin,
    (user) => normalizeEmail(user?.email) === email,
    1,
  );
  return matches[0] || null;
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const inviteRedirectTo = Deno.env.get("PLATFORM_USER_INVITE_REDIRECT_TO") || undefined;

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Missing server configuration." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const authCheck = await requirePlatformOwner(req, admin);
  if (!authCheck.ok) {
    return authCheck.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Malformed JSON payload." }, 400);
  }

  const action = String(body?.action || "").trim().toLowerCase();

  if (action === "search") {
    const rawQuery = normalizeText(body?.query);
    const query = rawQuery.toLowerCase();
    const phoneDigits = normalizePhoneDigits(body?.query);
    const isEmailQuery = looksLikeEmail(query);
    const isPhoneQuery = phoneDigits.length >= 7;
    const isFullNameQuery = rawQuery.length >= 5 && rawQuery.includes(" ");

    if (!isEmailQuery && !isPhoneQuery && !isFullNameQuery) {
      return json({
        ok: false,
        error: "Search must use an exact email, exact phone number, or full name.",
      }, 400);
    }

    try {
      const results = await collectUsers(admin, (user) => {
        const name = buildUserDisplayName(user).toLowerCase();
        const email = normalizeEmail(user?.email);
        const phoneDigitsValue = normalizePhoneDigits(buildUserPhone(user));

        if (isEmailQuery) return email === query;
        if (isPhoneQuery) return phoneDigitsValue === phoneDigits;
        return name === query;
      }, 5);
      return json({ ok: true, results });
    } catch (error) {
      return json({ ok: false, error: String((error as Error)?.message || error || "Search failed.") }, 500);
    }
  }

  if (action === "lookup_users") {
    const requestedUserIds = Array.isArray(body?.user_ids)
      ? body.user_ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)
      : [];
    const uniqueUserIds = [...new Set(requestedUserIds)].slice(0, 100);

    if (!uniqueUserIds.length) {
      return json({ ok: true, results: [] });
    }

    const requestedIdSet = new Set(uniqueUserIds);

    try {
      const results = await collectUsers(
        admin,
        (user) => requestedIdSet.has(String(user?.id || "").trim()),
        uniqueUserIds.length,
      );
      return json({ ok: true, results });
    } catch (error) {
      return json({ ok: false, error: String((error as Error)?.message || error || "Lookup failed.") }, 500);
    }
  }

  if (action === "invite_and_assign") {
    const tenantKey = normalizeTenantKey(body?.tenant_key);
    const role = normalizeRoleKey(body?.role);
    const firstName = normalizeText(body?.first_name);
    const lastName = normalizeText(body?.last_name);
    const email = normalizeEmail(body?.email);
    const phone = normalizeText(body?.phone);

    if (!tenantKey || !role || !firstName || !lastName || !email) {
      return json({ ok: false, error: "tenant_key, role, first_name, last_name, and email are required." }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Email address is invalid." }, 400);
    }

    try {
      let userSummary = await findUserByEmail(admin, email);
      let inviteSent = false;

      if (!userSummary) {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`.trim(),
            phone,
          },
          redirectTo: inviteRedirectTo,
        });
        if (error || !data?.user?.id) {
          return json({
            ok: false,
            error: String(error?.message || "Unable to create invited account."),
          }, 500);
        }

        inviteSent = true;
        userSummary = toUserSummary({
          ...data.user,
          user_metadata: {
            ...(data.user.user_metadata || {}),
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`.trim(),
            phone,
          },
          phone: data.user.phone || phone,
        });
      }

      const userId = String(userSummary?.id || "").trim();
      if (!userId) {
        return json({ ok: false, error: "Unable to resolve invited user." }, 500);
      }

      const { error: roleError } = await admin
        .from("tenant_user_roles")
        .upsert([{ tenant_key: tenantKey, user_id: userId, role, status: "active" }], {
          onConflict: "tenant_key,user_id,role",
        });
      if (roleError) {
        return json({ ok: false, error: String(roleError.message || roleError) }, 500);
      }

      return json({
        ok: true,
        inviteSent,
        user: userSummary,
      });
    } catch (error) {
      return json({ ok: false, error: String((error as Error)?.message || error || "Unable to create tenant user.") }, 500);
    }
  }

  return json({ ok: false, error: "Unsupported action." }, 400);
});
