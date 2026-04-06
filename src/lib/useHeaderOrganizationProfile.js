import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

export function useHeaderOrganizationProfile(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  const [headerOrganizationProfile, setHeaderOrganizationProfile] = useState(null);
  const [headerOrganizationProfileLoaded, setHeaderOrganizationProfileLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHeaderOrganizationProfile() {
      setHeaderOrganizationProfileLoaded(false);
      if (!normalizedTenantKey) {
        setHeaderOrganizationProfile(null);
        setHeaderOrganizationProfileLoaded(true);
        return;
      }

      const { data, error } = await supabase.rpc("tenant_header_profile_public");

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
  }, [normalizedTenantKey]);

  return { profile: headerOrganizationProfile, loaded: headerOrganizationProfileLoaded };
}
