import { createTenantScopedReadClient } from "../lib/tenantScopedSupabase";

function buildTenantOption(tenantConfig, routeRow = null) {
  const tenantKey = String(tenantConfig?.tenant_key || routeRow?.tenant_key || "")
    .trim()
    .toLowerCase();
  if (!tenantKey) return null;
  const displayName = String(tenantConfig?.display_name || "").trim();
  return {
    tenantKey,
    displayName,
    name:
      String(
        displayName ||
          tenantConfig?.name ||
          routeRow?.route_slug ||
          routeRow?.primary_subdomain ||
          tenantKey
      ).trim() || tenantKey,
    primarySubdomain:
      String(tenantConfig?.primary_subdomain || routeRow?.primary_subdomain || "").trim().toLowerCase() || "",
    routeSlug: String(routeRow?.route_slug || "").trim().toLowerCase() || "",
    residentPortalEnabled: tenantConfig?.resident_portal_enabled !== false,
    active: tenantConfig?.active !== false,
  };
}

function normalizePublicTenantHost(option = {}, tenantKey = "") {
  const raw = String(option?.primarySubdomain || "").trim().toLowerCase();
  if (raw) {
    if (raw.includes(".")) return raw;
    return `${raw}.cityreport.io`;
  }
  const normalizedTenantKey = String(tenantKey || option?.tenantKey || "").trim().toLowerCase();
  return normalizedTenantKey ? `${normalizedTenantKey}.cityreport.io` : "";
}

async function fetchTenantDisplayName(
  tenantKey,
  {
    isMissingFunctionError = () => false,
    isMissingRelationError = () => false,
  } = {}
) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  const scopedSupabase = createTenantScopedReadClient(normalizedTenantKey);
  if (!normalizedTenantKey || !scopedSupabase) return "";

  const { data, error } = await scopedSupabase.rpc("tenant_header_profile_public");
  if (error) {
    if (isMissingFunctionError(error) || isMissingRelationError(error)) return "";
    return "";
  }
  const nextProfile = Array.isArray(data) ? (data[0] || null) : (data || null);
  return String(nextProfile?.display_name || "").trim();
}

export function buildWebTenantSwitchUrl(locationLike, env, option, nextTenantKey) {
  const protocol = String(locationLike?.protocol || "https:").trim() || "https:";
  const pathname = String(locationLike?.pathname || "/");
  const search = String(locationLike?.search || "");
  const hash = String(locationLike?.hash || "");
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalizedTenantKey = String(nextTenantKey || "").trim().toLowerCase();
  if (!normalizedTenantKey) return "";

  if (env === "staging") {
    return `${protocol}//dev.cityreport.io/${normalizedTenantKey}${normalizedPath}${search}${hash}`;
  }

  const host = normalizePublicTenantHost(option, normalizedTenantKey);
  if (!host) return "";
  return `${protocol}//${host}${normalizedPath}${search}${hash}`;
}

export async function listAvailablePublicTenants({
  currentTenantConfig = null,
  currentTenantKey = "",
  supabase,
  loadTenantConfigCached,
  fetchTenantConfigFromDb,
  isMissingFunctionError = () => false,
  isMissingRelationError = () => false,
}) {
  const normalizedCurrentKey = String(currentTenantKey || currentTenantConfig?.tenant_key || "")
    .trim()
    .toLowerCase();
  const optionMap = new Map();

  const upsertOption = (option, { forceInclude = false } = {}) => {
    if (!option?.tenantKey) return;
    if (!forceInclude && (option.active === false || option.residentPortalEnabled === false)) return;
    const previous = optionMap.get(option.tenantKey) || {};
    optionMap.set(option.tenantKey, {
      ...previous,
      ...option,
      name: String(option.name || previous.name || option.tenantKey).trim() || option.tenantKey,
    });
  };

  upsertOption(buildTenantOption(currentTenantConfig), { forceInclude: true });

  try {
    const { data, error } = await supabase.rpc("list_active_tenant_routes");
    if (error) throw error;

    const routeRows = Array.isArray(data) ? data : [];
    await Promise.all(
      routeRows.map(async (row) => {
        const tenantKey = String(row?.tenant_key || "").trim().toLowerCase();
        if (!tenantKey) return;
        try {
          const tenantConfig = await loadTenantConfigCached(
            tenantKey,
            async () => {
              const fromDb = await fetchTenantConfigFromDb(tenantKey);
              if (fromDb && !String(fromDb?.display_name || "").trim()) {
                const headerDisplayName = await fetchTenantDisplayName(tenantKey, {
                  isMissingFunctionError,
                  isMissingRelationError,
                });
                if (headerDisplayName) {
                  return { ...fromDb, display_name: headerDisplayName };
                }
              }
              return fromDb;
            },
            { ttlMs: 5 * 60 * 1000 }
          );
          upsertOption(buildTenantOption(tenantConfig, row), { forceInclude: tenantKey === normalizedCurrentKey });
        } catch (routeError) {
          if (tenantKey === normalizedCurrentKey) {
            upsertOption(buildTenantOption(currentTenantConfig, row), { forceInclude: true });
            return;
          }
          if (!isMissingFunctionError(routeError) && !isMissingRelationError(routeError)) {
            console.warn("[tenant-context][list-tenant-config-failed]", tenantKey, routeError);
          }
        }
      })
    );
  } catch (error) {
    if (!isMissingFunctionError(error) && !isMissingRelationError(error)) {
      console.warn("[tenant-context][list-active-routes-failed]", error);
    }
  }

  return Array.from(optionMap.values()).sort((a, b) => {
    const byName = String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return String(a.tenantKey || "").localeCompare(String(b.tenantKey || ""), undefined, { sensitivity: "base" });
  });
}
