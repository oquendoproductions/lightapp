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

  useEffect(() => {
    let cancelled = false;

    async function loadHeaderOrganizationProfile() {
      if (!normalizedTenantKey) {
        setHeaderOrganizationProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("tenant_profiles")
        .select("display_name")
        .eq("tenant_key", normalizedTenantKey)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        if (isMissingRelationError(error)) {
          setHeaderOrganizationProfile(null);
          return;
        }
        setHeaderOrganizationProfile(null);
        return;
      }

      setHeaderOrganizationProfile(data || null);
    }

    void loadHeaderOrganizationProfile();
    return () => {
      cancelled = true;
    };
  }, [normalizedTenantKey]);

  return headerOrganizationProfile;
}
