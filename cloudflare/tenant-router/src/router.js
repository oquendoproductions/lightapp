const PROD_APEX_HOSTS = new Set(["cityreport.io", "www.cityreport.io"]);
const RESERVED_SLUGS = new Set(["www", "dev", "api", "auth", "platform"]);
const PASSTHROUGH_HOSTS = new Set(["assets.cityreport.io"]);
const LOCAL_DEV_HOST_SUFFIXES = [
  ".ngrok-free.app",
  ".ngrok-free.dev",
  ".ngrok.io",
  ".ngrok.app",
];

function sanitizeSlug(raw) {
  const slug = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return slug || "";
}

function normalizeKnownTenantKeys(input) {
  const keys = new Set();

  if (input instanceof Set) {
    for (const value of input.values()) {
      const slug = sanitizeSlug(value);
      if (slug) keys.add(slug);
    }
    return keys;
  }

  if (Array.isArray(input)) {
    for (const value of input) {
      const slug = sanitizeSlug(value);
      if (slug) keys.add(slug);
    }
    return keys;
  }

  const raw = String(input || "");
  if (!raw) return keys;

  for (const value of raw.split(",")) {
    const slug = sanitizeSlug(value);
    if (slug) keys.add(slug);
  }
  return keys;
}

function leadingRawPathSegment(pathname) {
  const path = String(pathname || "/");
  const parts = path.split("/").filter(Boolean);
  return String(parts[0] || "").trim();
}

function leadingPathSegment(pathname) {
  return sanitizeSlug(leadingRawPathSegment(pathname));
}

function stripLeadingSegment(pathname) {
  const path = String(pathname || "/");
  const parts = path.split("/").filter(Boolean);
  const remainder = parts.slice(1).join("/");
  return remainder ? `/${remainder}` : "/";
}

function cleanPath(pathname) {
  const path = String(pathname || "")
    .trim()
    .split(/[?#]/)[0];
  if (!path) return "/";
  if (!path.startsWith("/")) return `/${path}`;
  return path || "/";
}

function normalizeHubInternalPath(pathname) {
  const path = cleanPath(pathname);
  if (path === "/hub" || path === "/hub/") return "/";
  if (path.startsWith("/hub/")) return path.slice(4) || "/";
  if (path === "/home" || path.startsWith("/home/")) return "/";
  if (path === "/report" || path.startsWith("/report/")) return "/report";
  if (path === "/reports" || path.startsWith("/reports/")) return "/reports";
  if (path === "/alerts/create" || path.startsWith("/alerts/create/")) return "/alerts/create";
  if (path === "/alerts" || path.startsWith("/alerts/")) return "/alerts";
  if (path === "/events/create" || path.startsWith("/events/create/")) return "/events/create";
  if (path === "/events" || path.startsWith("/events/")) return "/events";
  if (path === "/preferences" || path.startsWith("/preferences/")) return "/settings/account-notifications";
  if (path === "/notifications" || path.startsWith("/notifications/")) return "/settings/account-notifications";
  if (path === "/account" || path.startsWith("/account/")) return "/settings/account-info";
  if (path === "/settings" || path.startsWith("/settings/")) return path;
  return null;
}

function buildHubPath(internalPath) {
  return internalPath === "/" ? "/hub" : `/hub${internalPath}`;
}

function isApexStaticPath(pathname) {
  const raw = leadingRawPathSegment(pathname).toLowerCase();
  if (!raw) return false;
  if (raw === "assets") return true;
  if (raw.includes(".")) return true;
  return false;
}

function makeResult(partial = {}) {
  return {
    mode: partial.mode || "marketing_home",
    tenantKey: partial.tenantKey || null,
    redirectTo: partial.redirectTo || null,
    env: partial.env || "prod",
    reason: partial.reason || "",
    unknownSlug: partial.unknownSlug || "",
    appScope: partial.appScope || null,
  };
}

function isLocalDevHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") return true;
  return LOCAL_DEV_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

export function resolveTenantRequest(input = {}, options = {}) {
  const hostname = String(input.hostname || "").trim().toLowerCase();
  const pathname = String(input.pathname || "/");
  const search = String(input.search || "");
  const defaultTenant = String(options.defaultTenant || "ashtabulacity").trim().toLowerCase();
  const segment = leadingPathSegment(pathname);
  const knownTenantKeys = normalizeKnownTenantKeys(options.knownTenantKeys);

  const isKnownTenant = (slug) => {
    const key = sanitizeSlug(slug);
    if (!key) return false;
    if (!knownTenantKeys.size) return true;
    return knownTenantKeys.has(key);
  };

  if (!hostname) {
    return makeResult({
      mode: "municipality_app",
      tenantKey: defaultTenant,
      reason: "missing_hostname_default_tenant",
      appScope: "map",
    });
  }

  if (PASSTHROUGH_HOSTS.has(hostname)) {
    return makeResult({ mode: "marketing_home", reason: "passthrough_host" });
  }

  if (hostname === "dev.cityreport.io") {
    if (pathname.startsWith("/gmaps")) {
      return makeResult({
        mode: "redirect",
        env: "staging",
        redirectTo: `https://dev.cityreport.io/${defaultTenant}/`,
        tenantKey: defaultTenant,
        reason: "legacy_gmaps_redirect",
      });
    }
    if (!segment || RESERVED_SLUGS.has(segment)) {
      return makeResult({
        mode: "not_found",
        env: "staging",
        reason: "invalid_or_missing_dev_slug",
        unknownSlug: segment,
      });
    }
    if (!isKnownTenant(segment)) {
      return makeResult({
        mode: "not_found",
        env: "staging",
        reason: "unknown_dev_slug",
        unknownSlug: segment,
      });
    }

    const strippedPath = stripLeadingSegment(pathname);
    if (strippedPath.startsWith("/platform")) {
      return makeResult({
        mode: "platform_admin",
        env: "staging",
        tenantKey: segment,
        reason: "dev_platform_admin",
      });
    }
    const devHubInternalPath = normalizeHubInternalPath(strippedPath);
    if (strippedPath.startsWith("/hub")) {
      return makeResult({
        mode: "municipality_app",
        env: "staging",
        tenantKey: segment,
        reason: "dev_hub_tenant",
        appScope: "hub",
      });
    }
    if (devHubInternalPath) {
      return makeResult({
        mode: "redirect",
        env: "staging",
        tenantKey: segment,
        reason: "dev_legacy_hub_redirect",
        redirectTo: `https://dev.cityreport.io/${segment}${buildHubPath(devHubInternalPath)}${search || ""}`,
      });
    }
    if (strippedPath.startsWith("/gmaps")) {
      return makeResult({
        mode: "redirect",
        env: "staging",
        tenantKey: segment,
        reason: "dev_legacy_gmaps_redirect",
        redirectTo: `https://dev.cityreport.io/${segment}/`,
      });
    }
    return makeResult({
      mode: "municipality_app",
      env: "staging",
      tenantKey: segment,
      reason: "dev_city_path_tenant",
      appScope: "map",
    });
  }

  const subdomainMatch = hostname.match(/^([a-z0-9-]+)\.cityreport\.io$/);
  if (subdomainMatch) {
    const slug = sanitizeSlug(subdomainMatch[1]);
    if (!slug || RESERVED_SLUGS.has(slug)) {
      return makeResult({
        mode: "not_found",
        tenantKey: null,
        reason: "reserved_or_invalid_subdomain_slug",
        unknownSlug: slug,
      });
    }
    if (!isKnownTenant(slug)) {
      return makeResult({
        mode: "not_found",
        tenantKey: null,
        reason: "unknown_subdomain_slug",
        unknownSlug: slug,
      });
    }
    if (pathname.startsWith("/gmaps")) {
      return makeResult({
        mode: "redirect",
        tenantKey: slug,
        reason: "legacy_gmaps_redirect",
        redirectTo: `https://${slug}.cityreport.io/`,
      });
    }
    if (pathname.startsWith("/platform")) {
      return makeResult({
        mode: "platform_admin",
        tenantKey: slug,
        reason: "subdomain_platform_admin",
      });
    }
    const subdomainHubInternalPath = normalizeHubInternalPath(pathname);
    if (pathname.startsWith("/hub")) {
      return makeResult({
        mode: "municipality_app",
        tenantKey: slug,
        reason: "subdomain_hub_tenant",
        appScope: "hub",
      });
    }
    if (subdomainHubInternalPath) {
      return makeResult({
        mode: "redirect",
        tenantKey: slug,
        reason: "subdomain_legacy_hub_redirect",
        redirectTo: `https://${slug}.cityreport.io${buildHubPath(subdomainHubInternalPath)}${search || ""}`,
      });
    }
    return makeResult({
      mode: "municipality_app",
      tenantKey: slug,
      reason: "subdomain_tenant",
      appScope: "map",
    });
  }

  if (PROD_APEX_HOSTS.has(hostname)) {
    if (pathname === "/" || pathname === "") {
      return makeResult({ mode: "marketing_home", reason: "apex_home" });
    }
    if (pathname === "/platform" || pathname.startsWith("/platform/")) {
      return makeResult({ mode: "platform_admin", reason: "apex_platform_admin" });
    }
    if (pathname.startsWith("/gmaps")) {
      return makeResult({
        mode: "redirect",
        tenantKey: defaultTenant,
        reason: "apex_legacy_gmaps_redirect",
        redirectTo: `https://${defaultTenant}.cityreport.io/`,
      });
    }
    if (pathname.startsWith("/legal/")) {
      return makeResult({ mode: "marketing_home", reason: "apex_legal_passthrough" });
    }
    if (isApexStaticPath(pathname)) {
      return makeResult({ mode: "marketing_home", reason: "apex_static_passthrough" });
    }
    if (segment && !RESERVED_SLUGS.has(segment)) {
      if (!isKnownTenant(segment)) {
        return makeResult({
          mode: "not_found",
          reason: "apex_unknown_slug",
          unknownSlug: segment,
        });
      }
      const suffix = pathname.split("/").slice(2).join("/");
      const suffixPath = suffix ? `/${suffix}` : "/";
      const apexHubInternalPath = normalizeHubInternalPath(suffixPath);
      const destinationPath = apexHubInternalPath ? buildHubPath(apexHubInternalPath) : suffixPath;
      const qs = search || "";
      return makeResult({
        mode: "redirect",
        tenantKey: segment,
        reason: "apex_slug_redirect",
        redirectTo: `https://${segment}.cityreport.io${destinationPath}${qs}`,
      });
    }
    return makeResult({
      mode: "not_found",
      reason: "apex_unknown_path",
      unknownSlug: segment,
    });
  }

  if (isLocalDevHost(hostname)) {
    if (pathname === "/platform" || pathname.startsWith("/platform/")) {
      return makeResult({
        mode: "platform_admin",
        env: "staging",
        reason: "local_platform_admin",
      });
    }
    if (pathname.startsWith("/gmaps")) {
      return makeResult({
        mode: "municipality_app",
        tenantKey: defaultTenant,
        env: "staging",
        reason: "local_legacy_gmaps_municipality",
        appScope: "map",
      });
    }
    if (segment && !RESERVED_SLUGS.has(segment)) {
      if (!isKnownTenant(segment)) {
        return makeResult({
          mode: "not_found",
          env: "staging",
          reason: "local_unknown_slug",
          unknownSlug: segment,
        });
      }
      const localStrippedPath = stripLeadingSegment(pathname);
      const localHubInternalPath = normalizeHubInternalPath(localStrippedPath);
      if (localStrippedPath.startsWith("/hub")) {
        return makeResult({
          mode: "municipality_app",
          tenantKey: segment,
          env: "staging",
          reason: "local_hub_tenant",
          appScope: "hub",
        });
      }
      if (localHubInternalPath) {
        return makeResult({
          mode: "redirect",
          tenantKey: segment,
          env: "staging",
          reason: "local_legacy_hub_redirect",
          redirectTo: `/${segment}${buildHubPath(localHubInternalPath)}${search || ""}`,
        });
      }
      return makeResult({
        mode: "municipality_app",
        tenantKey: segment,
        env: "staging",
        reason: "local_path_tenant",
        appScope: "map",
      });
    }
    return makeResult({
      mode: "marketing_home",
      env: "staging",
      reason: "local_marketing_home",
    });
  }

  if (pathname.startsWith("/gmaps")) {
    return makeResult({
      mode: "redirect",
      tenantKey: defaultTenant,
      reason: "unknown_host_legacy_redirect",
      redirectTo: `https://${defaultTenant}.cityreport.io/`,
    });
  }

  return makeResult({
    mode: "marketing_home",
    reason: "fallback_marketing_home",
  });
}

export function buildUnknownTenantSlugEvent(resolution, context = {}) {
  if (!resolution || resolution.mode !== "not_found") return null;
  const slug = String(resolution.unknownSlug || "").trim();
  if (!slug) return null;
  return {
    host: String(context.hostname || "").trim(),
    path: String(context.pathname || "").trim(),
    slug,
    ts: new Date().toISOString(),
  };
}
