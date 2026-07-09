import { createTenantScopedReadClient } from "./tenantScopedSupabase";

export async function fetchTenantPublicDisplayName(tenantKeyRaw) {
  const tenantKey = String(tenantKeyRaw || "").trim().toLowerCase();
  const readClient = createTenantScopedReadClient(tenantKey);
  if (!tenantKey || !readClient) return "";

  try {
    const { data, error } = await readClient.rpc("tenant_header_profile_public");
    if (error) return "";
    const profile = Array.isArray(data) ? (data[0] || null) : (data || null);
    return String(profile?.display_name || "").trim();
  } catch {
    return "";
  }
}

export async function loadFollowedTenantKeys({ supabase, userId }) {
  const userKey = String(userId || "").trim();
  if (!supabase || !userKey) return [];

  const { data, error } = await supabase
    .from("resident_tenant_interests")
    .select("tenant_key")
    .eq("user_id", userKey);

  if (error) throw error;

  return [...new Set(
    (Array.isArray(data) ? data : [])
      .map((row) => String(row?.tenant_key || "").trim().toLowerCase())
      .filter(Boolean)
  )];
}

export async function persistFollowedTenantKey({
  supabase,
  userId,
  tenantKey,
  shouldFollow,
}) {
  const userKey = String(userId || "").trim();
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  if (!supabase || !userKey || !normalizedTenantKey) return false;

  const request = shouldFollow
    ? supabase
      .from("resident_tenant_interests")
      .upsert([{ user_id: userKey, tenant_key: normalizedTenantKey }], { onConflict: "user_id,tenant_key" })
    : supabase
      .from("resident_tenant_interests")
      .delete()
      .eq("user_id", userKey)
      .eq("tenant_key", normalizedTenantKey);

  const { error } = await request;
  if (error) throw error;
  return true;
}
