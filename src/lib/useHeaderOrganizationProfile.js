import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

export function useHeaderOrganizationProfile(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  const scopedSupabase = useMemo(() => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey || !normalizedTenantKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          "x-tenant-key": normalizedTenantKey,
        },
      },
    });
  }, [normalizedTenantKey]);
  const [headerOrganizationProfile, setHeaderOrganizationProfile] = useState(null);
  const [headerOrganizationProfileLoaded, setHeaderOrganizationProfileLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHeaderOrganizationProfile() {
      setHeaderOrganizationProfile(null);
      setHeaderOrganizationProfileLoaded(false);
      if (!normalizedTenantKey || !scopedSupabase) {
        setHeaderOrganizationProfile(null);
        setHeaderOrganizationProfileLoaded(true);
        return;
      }

      const { data, error } = await scopedSupabase.rpc("tenant_header_profile_public");

      if (cancelled) return;

      if (error) {
        if (isMissingRelationError(error)) {
          setHeaderOrganizationProfile(null);
          setHeaderOrganizationProfileLoaded(true);
          return;
        }
        setHeaderOrganizationProfile(null);
        setHeaderOrganizationProfileLoaded(true);
        return;
      }

      const nextProfile = Array.isArray(data) ? (data[0] || null) : (data || null);
      setHeaderOrganizationProfile(nextProfile);
      setHeaderOrganizationProfileLoaded(true);
    }

    void loadHeaderOrganizationProfile();
    return () => {
      cancelled = true;
    };
  }, [normalizedTenantKey, scopedSupabase]);

  return { profile: headerOrganizationProfile, loaded: headerOrganizationProfileLoaded };
}
