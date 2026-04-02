import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-api-version",
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

function normalizeRoleKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isMissingRelationError(error: any) {
  const code = String(error?.code || "").trim().toUpperCase();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

async function resolveSessionUser(req: Request, admin: ReturnType<typeof createClient>) {
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

  return {
    ok: true,
    userId: String(userResult.user.id || "").trim(),
  };
}

async function resolvePlatformAccess(userId: string, admin: ReturnType<typeof createClient>) {
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

  if (legacyAdminResult.error) {
    return { ok: false, response: json({ ok: false, error: "Unable to verify platform role." }, 403) };
  }

  if (rolesResult.error) {
    if (!isMissingRelationError(rolesResult.error)) {
      return { ok: false, response: json({ ok: false, error: "Unable to verify platform role." }, 403) };
    }
    const isLegacyAdmin = Boolean(legacyAdminResult?.data?.user_id);
    return {
      ok: true,
      roleKeys: [],
      legacyAdmin: isLegacyAdmin,
      permissions: {
        rolesEdit: isLegacyAdmin,
        rolesDelete: isLegacyAdmin,
      },
    };
  }

  const roleKeys = [...new Set(
    (Array.isArray(rolesResult.data) ? rolesResult.data : [])
      .map((row) => normalizeRoleKey(row?.role))
      .filter(Boolean),
  )];
  const isLegacyAdmin = Boolean(legacyAdminResult?.data?.user_id);
  if (isLegacyAdmin || roleKeys.includes("platform_owner")) {
    return {
      ok: true,
      roleKeys,
      legacyAdmin: isLegacyAdmin,
      permissions: {
        rolesEdit: true,
        rolesDelete: true,
      },
    };
  }

  if (!roleKeys.length) {
    return {
      ok: true,
      roleKeys,
      legacyAdmin: false,
      permissions: {
        rolesEdit: false,
        rolesDelete: false,
      },
    };
  }

  const [roleDefinitionsResult, rolePermissionsResult] = await Promise.all([
    admin
      .from("platform_role_definitions")
      .select("role,active")
      .in("role", roleKeys),
    admin
      .from("platform_role_permissions")
      .select("role,permission_key,allowed")
      .eq("allowed", true)
      .in("role", roleKeys),
  ]);

  if (roleDefinitionsResult.error || rolePermissionsResult.error) {
    const firstError = roleDefinitionsResult.error || rolePermissionsResult.error;
    if (isMissingRelationError(firstError)) {
      return {
        ok: true,
        roleKeys,
        legacyAdmin: false,
        permissions: {
          rolesEdit: false,
          rolesDelete: false,
        },
      };
    }
    return { ok: false, response: json({ ok: false, error: "Unable to verify platform permissions." }, 403) };
  }

  const activeRoleSet = new Set(
    (Array.isArray(roleDefinitionsResult.data) ? roleDefinitionsResult.data : [])
      .filter((row) => row?.active !== false)
      .map((row) => normalizeRoleKey(row?.role))
      .filter(Boolean),
  );
  const permissionSet = new Set(
    (Array.isArray(rolePermissionsResult.data) ? rolePermissionsResult.data : [])
      .filter((row) => activeRoleSet.has(normalizeRoleKey(row?.role)))
      .map((row) => String(row?.permission_key || "").trim().toLowerCase())
      .filter(Boolean),
  );

  return {
    ok: true,
    roleKeys,
    legacyAdmin: false,
    permissions: {
      rolesEdit: permissionSet.has("roles.edit"),
      rolesDelete: permissionSet.has("roles.delete"),
    },
  };
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
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Missing server configuration." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Malformed JSON payload." }, 400);
  }

  const sessionUserResult = await resolveSessionUser(req, admin);
  if (!sessionUserResult.ok) return sessionUserResult.response;

  const accessResult = await resolvePlatformAccess(sessionUserResult.userId, admin);
  if (!accessResult.ok) return accessResult.response;

  const action = String(body?.action || "").trim().toLowerCase();

  if (action === "create_role") {
    if (!accessResult.permissions.rolesEdit) {
      return json({ ok: false, error: "You need the roles.edit permission to create PCP roles." }, 403);
    }

    const role = normalizeRoleKey(body?.role);
    const roleLabel = normalizeText(body?.role_label);
    if (!role) {
      return json({ ok: false, error: "Role key is required." }, 400);
    }

    const { data: existingRole, error: existingError } = await admin
      .from("platform_role_definitions")
      .select("role")
      .eq("role", role)
      .maybeSingle();
    if (existingError) {
      return json({ ok: false, error: String(existingError.message || existingError) }, 500);
    }
    if (existingRole?.role) {
      return json({ ok: false, error: `Role ${role} already exists.` }, 400);
    }

    const { error: roleInsertError } = await admin
      .from("platform_role_definitions")
      .insert([{
        role,
        role_label: roleLabel || role.replace(/_/g, " "),
        is_system: false,
        active: true,
        created_by: sessionUserResult.userId,
      }]);
    if (roleInsertError) {
      return json({ ok: false, error: String(roleInsertError.message || roleInsertError) }, 500);
    }

    const { data: catalogRows, error: catalogError } = await admin
      .from("platform_permissions_catalog")
      .select("permission_key");
    if (catalogError) {
      return json({ ok: false, error: String(catalogError.message || catalogError) }, 500);
    }

    const permissionRows = (Array.isArray(catalogRows) ? catalogRows : []).map((row) => ({
      role,
      permission_key: String(row?.permission_key || "").trim(),
      allowed: false,
      updated_by: sessionUserResult.userId,
    })).filter((row) => row.permission_key);

    if (permissionRows.length) {
      const { error: permissionsError } = await admin
        .from("platform_role_permissions")
        .upsert(permissionRows, { onConflict: "role,permission_key" });
      if (permissionsError) {
        return json({ ok: false, error: String(permissionsError.message || permissionsError) }, 500);
      }
    }

    return json({ ok: true, role });
  }

  if (action === "save_permissions") {
    if (!accessResult.permissions.rolesEdit) {
      return json({ ok: false, error: "You need the roles.edit permission to update PCP role permissions." }, 403);
    }

    const role = normalizeRoleKey(body?.role);
    const permissions = body?.permissions && typeof body.permissions === "object" ? body.permissions : null;
    if (!role || !permissions) {
      return json({ ok: false, error: "Role and permissions are required." }, 400);
    }

    const { data: catalogRows, error: catalogError } = await admin
      .from("platform_permissions_catalog")
      .select("permission_key");
    if (catalogError) {
      return json({ ok: false, error: String(catalogError.message || catalogError) }, 500);
    }

    const rows = (Array.isArray(catalogRows) ? catalogRows : []).map((row) => {
      const permissionKey = String(row?.permission_key || "").trim();
      return {
        role,
        permission_key: permissionKey,
        allowed: Boolean(permissions?.[permissionKey]),
        updated_by: sessionUserResult.userId,
      };
    }).filter((row) => row.permission_key);

    const { error } = await admin
      .from("platform_role_permissions")
      .upsert(rows, { onConflict: "role,permission_key" });
    if (error) {
      return json({ ok: false, error: String(error.message || error) }, 500);
    }

    return json({ ok: true, role });
  }

  if (action === "delete_role") {
    if (!accessResult.permissions.rolesDelete) {
      return json({ ok: false, error: "You need the roles.delete permission to remove PCP roles." }, 403);
    }

    const role = normalizeRoleKey(body?.role);
    if (!role) {
      return json({ ok: false, error: "Role is required." }, 400);
    }

    const { data: roleDefinition, error: roleError } = await admin
      .from("platform_role_definitions")
      .select("role,is_system")
      .eq("role", role)
      .maybeSingle();
    if (roleError) {
      return json({ ok: false, error: String(roleError.message || roleError) }, 500);
    }
    if (!roleDefinition?.role) {
      return json({ ok: false, error: "Role not found." }, 404);
    }
    if (roleDefinition.is_system === true) {
      return json({ ok: false, error: "System platform roles cannot be removed." }, 400);
    }

    const { count, error: assignmentError } = await admin
      .from("platform_user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", role)
      .eq("status", "active");
    if (assignmentError) {
      return json({ ok: false, error: String(assignmentError.message || assignmentError) }, 500);
    }
    if (Number(count || 0) > 0) {
      return json({ ok: false, error: `Remove or reassign ${count} platform assignment(s) for ${role} before deleting it.` }, 400);
    }

    const { error } = await admin
      .from("platform_role_definitions")
      .delete()
      .eq("role", role);
    if (error) {
      return json({ ok: false, error: String(error.message || error) }, 500);
    }

    return json({ ok: true, role });
  }

  return json({ ok: false, error: "Unsupported action." }, 400);
});
