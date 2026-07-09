import { useEffect, useMemo, useState } from "react";
import { createTenantScopedReadClient } from "./tenantScopedSupabase";

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

export function useHeaderOrganizationProfile(tenantKey, options = {}) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  const enabled = options?.enabled !== false;
  const deferUntilIdle = options?.deferUntilIdle === true;
  const idleTimeoutMs = Number(options?.idleTimeoutMs || 1800);
  const fallbackDelayMs = Number(options?.fallbackDelayMs || 180);
  const scopedSupabase = useMemo(() => {
    if (!enabled || !normalizedTenantKey) return null;
    return createTenantScopedReadClient(normalizedTenantKey);
  }, [enabled, normalizedTenantKey]);
  const [headerOrganizationProfile, setHeaderOrganizationProfile] = useState(null);
  const [headerOrganizationProfileLoaded, setHeaderOrganizationProfileLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleHandle = null;
    let timeoutHandle = null;

    async function loadHeaderOrganizationProfile() {
      setHeaderOrganizationProfile(null);
      setHeaderOrganizationProfileLoaded(false);
      if (!enabled || !normalizedTenantKey || !scopedSupabase) {
        setHeaderOrganizationProfile(null);
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

    if (deferUntilIdle) {
      if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => {
          idleHandle = null;
          if (!cancelled) void loadHeaderOrganizationProfile();
        }, { timeout: idleTimeoutMs });
      } else if (typeof window !== "undefined") {
        timeoutHandle = window.setTimeout(() => {
          timeoutHandle = null;
          if (!cancelled) void loadHeaderOrganizationProfile();
        }, fallbackDelayMs);
      } else {
        void loadHeaderOrganizationProfile();
      }
    } else {
      void loadHeaderOrganizationProfile();
    }
    return () => {
      cancelled = true;
      if (idleHandle != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle != null && typeof window !== "undefined") {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [
    deferUntilIdle,
    enabled,
    fallbackDelayMs,
    idleTimeoutMs,
    normalizedTenantKey,
    scopedSupabase,
  ]);

  return { profile: headerOrganizationProfile, loaded: headerOrganizationProfileLoaded };
}
