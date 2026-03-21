const PROD_APEX_HOSTS = new Set(["cityreport.io", "www.cityreport.io"]);
const RESERVED_SLUGS = new Set(["www", "dev", "api", "auth", "platform"]);
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

function leadingPathSegment(pathname) {
  const path = String(pathname || "/");
  const parts = path.split("/").filter(Boolean);
  return sanitizeSlug(parts[0] || "");
}

function stripLeadingSegment(pathname) {
  const path = String(pathname || "/");
  const parts = path.split("/").filter(Boolean);
  const remainder = parts.slice(1).join("/");
  return remainder ? `/${remainder}` : "/";
}

function makeResult(partial = {}) {
  return {
    mode: partial.mode || "marketing_home",
    tenantKey: partial.tenantKey || null,
    redirectTo: partial.redirectTo || null,
    env: partial.env || "prod",
    reason: partial.reason || "",
    unknownSlug: partial.unknownSlug || "",
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

  if (!hostname) {
    return makeResult({
      mode: "municipality_app",
      tenantKey: defaultTenant,
      reason: "missing_hostname_default_tenant",
    });
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

    const strippedPath = stripLeadingSegment(pathname);
    if (strippedPath.startsWith("/platform")) {
      return makeResult({
        mode: "platform_admin",
        env: "staging",
        tenantKey: segment,
        reason: "dev_platform_admin",
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
    return makeResult({
      mode: "municipality_app",
      tenantKey: slug,
      reason: "subdomain_tenant",
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
    if (segment && !RESERVED_SLUGS.has(segment)) {
      const suffix = pathname.split("/").slice(2).join("/");
      const suffixPath = suffix ? `/${suffix}` : "/";
      const qs = search || "";
      return makeResult({
        mode: "redirect",
        tenantKey: segment,
        reason: "apex_slug_redirect",
        redirectTo: `https://${segment}.cityreport.io${suffixPath}${qs}`,
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
      });
    }
    if (segment && !RESERVED_SLUGS.has(segment)) {
      return makeResult({
        mode: "municipality_app",
        tenantKey: segment,
        env: "staging",
        reason: "local_path_tenant",
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
