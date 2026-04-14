function trimOrEmpty(value) {
  return String(value || "").trim();
}

function resolveTenantDisplayName(tenantConfig) {
  return (
    trimOrEmpty(tenantConfig?.display_name) ||
    trimOrEmpty(tenantConfig?.name)
  );
}

export function resolveHeaderDisplayName({ organizationProfile = null, tenantConfig = null } = {}) {
  return (
    trimOrEmpty(organizationProfile?.display_name) ||
    resolveTenantDisplayName(tenantConfig) ||
    "Municipality"
  );
}

export function resolvePublicHeaderDisplayName({ organizationProfile = null, tenantConfig = null } = {}) {
  return (
    trimOrEmpty(organizationProfile?.display_name) ||
    resolveTenantDisplayName(tenantConfig) ||
    "Municipality"
  );
}
