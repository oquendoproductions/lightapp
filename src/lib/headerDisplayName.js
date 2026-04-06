function trimOrEmpty(value) {
  return String(value || "").trim();
}

function formatTenantKeyLabel(tenantKey = "") {
  const normalizedTenantKey = trimOrEmpty(tenantKey);
  if (!normalizedTenantKey) return "";
  return normalizedTenantKey
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveHeaderDisplayName({ organizationProfile = null, tenantConfig = null, tenantKey = "" } = {}) {
  return (
    trimOrEmpty(organizationProfile?.display_name) ||
    trimOrEmpty(tenantConfig?.display_name) ||
    trimOrEmpty(tenantConfig?.name) ||
    formatTenantKeyLabel(tenantKey) ||
    "Municipality"
  );
}

export function resolvePublicHeaderDisplayName({ organizationProfile = null, tenantConfig = null, tenantKey = "" } = {}) {
  return (
    trimOrEmpty(organizationProfile?.display_name) ||
    trimOrEmpty(tenantConfig?.display_name) ||
    formatTenantKeyLabel(tenantKey) ||
    "Municipality"
  );
}
