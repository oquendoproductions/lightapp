function trimOrEmpty(value) {
  return String(value || "").trim();
}

export function resolveHeaderDisplayName({ organizationProfile = null, tenantConfig = null } = {}) {
  return (
    trimOrEmpty(organizationProfile?.display_name) ||
    trimOrEmpty(tenantConfig?.display_name) ||
    "Municipality"
  );
}

export function resolvePublicHeaderDisplayName({ organizationProfile = null, tenantConfig = null } = {}) {
  return (
    trimOrEmpty(organizationProfile?.display_name) ||
    trimOrEmpty(tenantConfig?.display_name) ||
    "Municipality"
  );
}
