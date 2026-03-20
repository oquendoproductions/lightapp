import { createClient } from "@supabase/supabase-js";
import { getRuntimeTenantKey } from "./tenant/runtimeTenant";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const globalHeaders = {
  "x-tenant-key": getRuntimeTenantKey(),
};

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
