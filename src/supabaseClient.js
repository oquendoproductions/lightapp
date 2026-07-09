import { createClient } from "@supabase/supabase-js";
import { getRuntimeTenantKey } from "./tenant/runtimeTenant";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const globalHeaders = {
  "x-tenant-key": getRuntimeTenantKey(),
};

function resolveSupabaseAuthStorageKey() {
  const normalizedUrl = String(supabaseUrl || "").trim();
  if (!normalizedUrl) return "";
  try {
    return `sb-${new URL(normalizedUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return "";
  }
}

export function getSupabaseAuthStorageKey() {
  return resolveSupabaseAuthStorageKey();
}

export function hasPersistedSupabaseSessionHint() {
  if (typeof window === "undefined") return false;
  const storageKey = resolveSupabaseAuthStorageKey();
  if (!storageKey) return false;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw || raw === "null" || raw === "{}") return false;
    return raw.length > 8;
  } catch {
    return false;
  }
}

export function setSupabaseTenantKey(tenantKey) {
  const next = String(tenantKey || "").trim().toLowerCase();
  if (next) {
    globalHeaders["x-tenant-key"] = next;
  } else {
    delete globalHeaders["x-tenant-key"];
  }
}

export function getSupabaseTenantKey() {
  return String(globalHeaders["x-tenant-key"] || "").trim().toLowerCase();
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: globalHeaders,
  },
});
