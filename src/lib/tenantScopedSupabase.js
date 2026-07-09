import { createClient } from "@supabase/supabase-js";

const tenantReadClientCache = new Map();
const tenantAuthedClientCache = new Map();

function normalizeTenantKey(tenantKey) {
  return String(tenantKey || "").trim().toLowerCase();
}

function getSupabaseCredentials() {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey };
}

function buildTenantClientConfig(headers, storageKey) {
  return {
    global: {
      headers,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey,
    },
  };
}

export function createTenantScopedReadClient(tenantKey) {
  const normalizedTenantKey = normalizeTenantKey(tenantKey);
  const credentials = getSupabaseCredentials();
  if (!normalizedTenantKey || !credentials) return null;

  const cachedClient = tenantReadClientCache.get(normalizedTenantKey);
  if (cachedClient) return cachedClient;

  const client = createClient(
    credentials.supabaseUrl,
    credentials.supabaseAnonKey,
    buildTenantClientConfig(
      {
        "x-tenant-key": normalizedTenantKey,
      },
      `sb-tenant-readonly-${normalizedTenantKey}`
    )
  );
  tenantReadClientCache.set(normalizedTenantKey, client);
  return client;
}

export function createTenantScopedAuthedClient(tenantKey, accessToken) {
  const normalizedTenantKey = normalizeTenantKey(tenantKey);
  const normalizedAccessToken = String(accessToken || "").trim();
  const credentials = getSupabaseCredentials();
  if (!normalizedTenantKey || !normalizedAccessToken || !credentials) return null;

  const cacheKey = `${normalizedTenantKey}::${normalizedAccessToken}`;
  const cachedClient = tenantAuthedClientCache.get(cacheKey);
  if (cachedClient) return cachedClient;

  const client = createClient(
    credentials.supabaseUrl,
    credentials.supabaseAnonKey,
    buildTenantClientConfig(
      {
        "x-tenant-key": normalizedTenantKey,
        Authorization: `Bearer ${normalizedAccessToken}`,
      },
      `sb-tenant-authed-${normalizedTenantKey}`
    )
  );
  tenantAuthedClientCache.set(cacheKey, client);
  return client;
}
