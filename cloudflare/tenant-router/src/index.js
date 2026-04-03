import { buildUnknownTenantSlugEvent, resolveTenantRequest } from "./router.js";

const DEFAULT_ORIGIN = "lightapp-ak2.pages.dev";
const DEFAULT_TENANT_KEYS_SYNC_TTL_SEC = 30;
let tenantRoutesCache = {
  expiresAt: 0,
  routes: null,
  signature: "",
};
let tenantRoutesInflight = {
  signature: "",
  promise: null,
};

function sanitizeTenantKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function parseKnownTenantRoutes(raw, fallbackTenant) {
  const routeToTenant = new Map();
  const primaryHostByTenant = new Map();

  const value = String(raw || "").trim();
  if (value) {
    for (const entry of value.split(",")) {
      const slug = sanitizeTenantKey(entry);
      if (slug) {
        routeToTenant.set(slug, slug);
        primaryHostByTenant.set(slug, `${slug}.cityreport.io`);
      }
    }
  }

  const fallback = sanitizeTenantKey(fallbackTenant);
  if (fallback) {
    routeToTenant.set(fallback, fallback);
    primaryHostByTenant.set(fallback, `${fallback}.cityreport.io`);
  }

  return {
    routeToTenant,
    primaryHostByTenant,
  };
}

function parsePositiveInt(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

async function fetchActiveTenantRoutesFromSupabase(env) {
  const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const supabaseAnonKey = String(env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const endpoint = `${supabaseUrl}/rest/v1/rpc/list_active_tenant_routes`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });
  } catch (error) {
    console.warn("[tenant-router][tenant-sync-fetch-error]", String(error?.message || error));
    return null;
  }

  if (!response.ok) {
    console.warn("[tenant-router][tenant-sync-http-error]", response.status);
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload)) {
    console.warn("[tenant-router][tenant-sync-invalid-payload]");
    return null;
  }

  const routeToTenant = new Map();
  const primaryHostByTenant = new Map();
  for (const row of payload) {
    const tenantKey = sanitizeTenantKey(row?.tenant_key);
    const routeSlug = sanitizeTenantKey(row?.route_slug);
    const primaryHost = String(row?.primary_subdomain || "").trim().toLowerCase();
    if (tenantKey) {
      routeToTenant.set(tenantKey, tenantKey);
      primaryHostByTenant.set(tenantKey, primaryHost || `${tenantKey}.cityreport.io`);
    }
    if (routeSlug) routeToTenant.set(routeSlug, tenantKey || routeSlug);
  }
  return {
    routeToTenant,
    primaryHostByTenant,
  };
}

async function resolveTenantRouteInSupabase(env, tenantRoute) {
  const slug = sanitizeTenantKey(tenantRoute);
  if (!slug) return null;

  const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const supabaseAnonKey = String(env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const endpoint = `${supabaseUrl}/rest/v1/rpc/resolve_tenant_route`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ route_input: slug }),
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });
  } catch (error) {
    console.warn("[tenant-router][tenant-probe-fetch-error]", slug, String(error?.message || error));
    return null;
  }

  if (!response.ok) {
    console.warn("[tenant-router][tenant-probe-http-error]", slug, response.status);
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload)) return null;
  const match = payload[0] || null;
  if (!match) return null;
  const tenantKey = sanitizeTenantKey(match?.tenant_key);
  const primarySubdomain = String(match?.primary_subdomain || "").trim().toLowerCase();
  const routeSlug = sanitizeTenantKey(primarySubdomain.split(".")[0]);
  if (!tenantKey) return null;
  return {
    tenantKey,
    routeSlug: routeSlug || slug,
    primarySubdomain,
  };
}

async function resolveKnownTenantRoutes(env, defaultTenant) {
  const fallbackRoutes = parseKnownTenantRoutes(env.KNOWN_TENANT_KEYS, defaultTenant);
  const ttlSec = parsePositiveInt(env.TENANT_KEYS_SYNC_TTL_SEC, DEFAULT_TENANT_KEYS_SYNC_TTL_SEC);
  const signature = [
    String(env.KNOWN_TENANT_KEYS || "").trim(),
    String(defaultTenant || "").trim(),
    String(env.SUPABASE_URL || "").trim(),
    String(env.SUPABASE_ANON_KEY || "").trim(),
    String(ttlSec),
  ].join("|");
  const now = Date.now();

  if (
    tenantRoutesCache.signature === signature &&
    tenantRoutesCache.routes &&
    tenantRoutesCache.expiresAt > now
  ) {
    return {
      routeToTenant: new Map(tenantRoutesCache.routes.routeToTenant),
      primaryHostByTenant: new Map(tenantRoutesCache.routes.primaryHostByTenant),
    };
  }

  if (tenantRoutesInflight.signature === signature && tenantRoutesInflight.promise) {
    const inflight = await tenantRoutesInflight.promise;
    return {
      routeToTenant: new Map(inflight.routeToTenant),
      primaryHostByTenant: new Map(inflight.primaryHostByTenant),
    };
  }

  tenantRoutesInflight = {
    signature,
    promise: (async () => {
      const synced = await fetchActiveTenantRoutesFromSupabase(env);
      const merged = {
        routeToTenant: new Map(fallbackRoutes.routeToTenant),
        primaryHostByTenant: new Map(fallbackRoutes.primaryHostByTenant),
      };
      if (synced?.routeToTenant instanceof Map) {
        for (const [routeSlug, tenantKey] of synced.routeToTenant.entries()) {
          merged.routeToTenant.set(routeSlug, tenantKey);
        }
      }
      if (synced?.primaryHostByTenant instanceof Map) {
        for (const [tenantKey, primaryHost] of synced.primaryHostByTenant.entries()) {
          merged.primaryHostByTenant.set(tenantKey, primaryHost);
        }
      }
      const fallback = sanitizeTenantKey(defaultTenant);
      if (fallback) {
        merged.routeToTenant.set(fallback, fallback);
        if (!merged.primaryHostByTenant.has(fallback)) {
          merged.primaryHostByTenant.set(fallback, `${fallback}.cityreport.io`);
        }
      }

      tenantRoutesCache = {
        routes: merged,
        expiresAt: Date.now() + (ttlSec * 1000),
        signature,
      };
      return merged;
    })(),
  };

  try {
    const routes = await tenantRoutesInflight.promise;
    return {
      routeToTenant: new Map(routes.routeToTenant),
      primaryHostByTenant: new Map(routes.primaryHostByTenant),
    };
  } finally {
    tenantRoutesInflight = {
      signature: "",
      promise: null,
    };
  }
}

function extractSubdomainSlug(hostname) {
  const match = String(hostname || "").trim().toLowerCase().match(/^([a-z0-9-]+)\.cityreport\.io$/);
  return match ? sanitizeTenantKey(match[1]) : "";
}

function withTenantHeaders(headers, resolution) {
  const nextHeaders = new Headers(headers || {});
  if (resolution?.tenantKey) {
    nextHeaders.set("x-tenant-key", resolution.tenantKey);
  } else {
    nextHeaders.delete("x-tenant-key");
  }
  nextHeaders.set("x-tenant-mode", resolution?.mode || "marketing_home");
  if (resolution?.appScope) {
    nextHeaders.set("x-tenant-app-scope", resolution.appScope);
  } else {
    nextHeaders.delete("x-tenant-app-scope");
  }
  nextHeaders.set("x-tenant-env", resolution?.env || "prod");
  return nextHeaders;
}

function rewriteLocationHeader(location, originalHost, originHost) {
  if (!location) return null;
  try {
    const parsed = new URL(location);
    if (parsed.hostname === originHost) {
      parsed.hostname = originalHost;
      return parsed.toString();
    }
  } catch {
    return location;
  }
  return location;
}

function toAssetsCanonicalRedirect(url) {
  if (url.hostname !== "assets.cityreport.io") return null;
  const normalized = url.pathname.startsWith("/assets/")
    ? url.pathname
    : `/assets${url.pathname.startsWith("/") ? url.pathname : `/${url.pathname}`}`;
  return `https://cityreport.io${normalized}${url.search || ""}`;
}

async function proxyToPages(request, resolution, env) {
  const incomingUrl = new URL(request.url);
  const originHost = String(env.PAGES_ORIGIN || DEFAULT_ORIGIN).trim();
  const upstreamUrl = new URL(incomingUrl.toString());
  upstreamUrl.protocol = "https:";
  upstreamUrl.hostname = originHost;

  const upstreamRequest = new Request(upstreamUrl.toString(), {
    method: request.method,
    headers: withTenantHeaders(request.headers, resolution),
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    redirect: "manual",
  });

  const upstreamResponse = await fetch(upstreamRequest);
  const responseHeaders = new Headers(upstreamResponse.headers);
  const rewrittenLocation = rewriteLocationHeader(
    responseHeaders.get("location"),
    incomingUrl.hostname,
    originHost,
  );
  if (rewrittenLocation) {
    responseHeaders.set("location", rewrittenLocation);
  }
  responseHeaders.set("x-cityreport-resolver-mode", resolution.mode);
  if (resolution.tenantKey) {
    responseHeaders.set("x-cityreport-tenant-key", resolution.tenantKey);
  }
  if (resolution.appScope) {
    responseHeaders.set("x-cityreport-app-scope", resolution.appScope);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}

function logUnknownSlug(requestUrl, resolution) {
  const event = buildUnknownTenantSlugEvent(resolution, {
    hostname: requestUrl.hostname,
    pathname: requestUrl.pathname,
  });
  if (!event) return;
  console.warn("[tenant-router][unknown-slug]", JSON.stringify(event));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderUnknownTenantPage(unknownSlug) {
  const slug = escapeHtml(unknownSlug || "unknown");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>Municipality Not Found | CityReport.io</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: radial-gradient(1100px 540px at 10% -20%, #2f907f22 0%, #f5fbff 60%);
      color: #143252;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(720px, 100%);
      background: #ffffff;
      border: 1px solid #d6e4f3;
      border-radius: 18px;
      padding: 28px;
      box-shadow: 0 12px 40px rgba(13, 40, 76, 0.08);
    }
    .brand {
      font-size: 1.05rem;
      font-weight: 800;
      letter-spacing: 0.2px;
      color: #183a63;
      margin: 0 0 12px;
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(1.8rem, 4vw, 2.4rem);
      line-height: 1.15;
    }
    p {
      margin: 0 0 14px;
      color: #335273;
      line-height: 1.55;
    }
    .slug {
      display: inline-block;
      margin: 6px 0 16px;
      padding: 8px 12px;
      border-radius: 999px;
      background: #eef5fc;
      border: 1px solid #d5e4f4;
      color: #22476e;
      font-size: 0.95rem;
      font-weight: 700;
    }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px; }
    .btn {
      text-decoration: none;
      border-radius: 11px;
      padding: 10px 14px;
      font-weight: 700;
      border: 1px solid transparent;
      transition: transform 120ms ease;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary { background: #183a63; color: #fff; }
    .btn-secondary { background: #fff; color: #183a63; border-color: #c9dbee; }
  </style>
</head>
<body>
  <main class="card" aria-labelledby="title">
    <p class="brand">CityReport.io</p>
    <h1 id="title">Municipality Not Found</h1>
    <p>This municipality URL is not configured in CityReport.</p>
    <p class="slug">Unknown slug: ${slug}</p>
    <p>Please verify the subdomain or go back to the main CityReport site.</p>
    <div class="actions">
      <a class="btn btn-primary" href="https://cityreport.io/">Go to CityReport.io</a>
      <a class="btn btn-secondary" href="mailto:cityreport.io@gmail.com">Contact Support</a>
    </div>
  </main>
</body>
</html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const assetsRedirect = toAssetsCanonicalRedirect(url);
    if (assetsRedirect) {
      return new Response(null, {
        status: 302,
        headers: {
          location: assetsRedirect,
          "cache-control": "no-store",
        },
      });
    }

    const defaultTenant = String(env.DEFAULT_TENANT_KEY || "ashtabulacity")
      .trim()
      .toLowerCase();
    const tenantRoutes = await resolveKnownTenantRoutes(env, defaultTenant);
    const knownTenantKeys = new Set(tenantRoutes.routeToTenant.keys());

    let resolution = resolveTenantRequest(
      {
        hostname: url.hostname,
        pathname: url.pathname,
        search: url.search,
      },
      {
        defaultTenant,
        knownTenantKeys,
      },
    );

    // Auto-promote newly added active tenants without manual allowlist edits.
    if (resolution.mode === "not_found") {
      const slug = sanitizeTenantKey(resolution.unknownSlug);
      if (slug && !tenantRoutes.routeToTenant.has(slug)) {
        const activeTenant = await resolveTenantRouteInSupabase(env, slug);
        if (activeTenant?.tenantKey) {
          tenantRoutes.routeToTenant.set(slug, activeTenant.tenantKey);
          if (activeTenant.routeSlug) {
            tenantRoutes.routeToTenant.set(activeTenant.routeSlug, activeTenant.tenantKey);
          }
          if (activeTenant.primarySubdomain) {
            tenantRoutes.primaryHostByTenant.set(activeTenant.tenantKey, activeTenant.primarySubdomain);
          }
          tenantRoutesCache = {
            signature: tenantRoutesCache.signature,
            routes: {
              routeToTenant: new Map(tenantRoutes.routeToTenant),
              primaryHostByTenant: new Map(tenantRoutes.primaryHostByTenant),
            },
            expiresAt: tenantRoutesCache.expiresAt || (Date.now() + 30_000),
          };
          resolution = resolveTenantRequest(
            {
              hostname: url.hostname,
              pathname: url.pathname,
              search: url.search,
            },
            {
              defaultTenant,
              knownTenantKeys: new Set(tenantRoutes.routeToTenant.keys()),
            },
          );
        }
      }
    }

    if (resolution.tenantKey) {
      const actualTenantKey = tenantRoutes.routeToTenant.get(sanitizeTenantKey(resolution.tenantKey));
      if (actualTenantKey) {
        resolution = {
          ...resolution,
          tenantKey: actualTenantKey,
        };
        const requestSlug = extractSubdomainSlug(url.hostname);
        const canonicalHost = String(tenantRoutes.primaryHostByTenant.get(actualTenantKey) || "").trim().toLowerCase();
        if (
          requestSlug &&
          canonicalHost &&
          canonicalHost !== url.hostname.toLowerCase()
        ) {
          return Response.redirect(`https://${canonicalHost}${url.pathname}${url.search || ""}`, 301);
        }
      }
    }

    if (resolution.mode === "redirect" && resolution.redirectTo) {
      return Response.redirect(resolution.redirectTo, 301);
    }

    if (resolution.mode === "not_found") {
      logUnknownSlug(url, resolution);
      return new Response(renderUnknownTenantPage(resolution.unknownSlug), {
        status: 404,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-robots-tag": "noindex, nofollow",
        },
      });
    }

    return proxyToPages(request, resolution, env);
  },
};
