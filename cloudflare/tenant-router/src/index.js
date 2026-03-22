import { buildUnknownTenantSlugEvent, resolveTenantRequest } from "./router.js";

const DEFAULT_ORIGIN = "lightapp-ak2.pages.dev";
const DEFAULT_TENANT_KEYS_SYNC_TTL_SEC = 30;
let tenantKeysCache = {
  expiresAt: 0,
  keys: null,
  signature: "",
};
let tenantKeysInflight = {
  signature: "",
  promise: null,
};

function sanitizeTenantKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function parseKnownTenantKeys(raw, fallbackTenant) {
  const keys = new Set();

  const value = String(raw || "").trim();
  if (value) {
    for (const entry of value.split(",")) {
      const slug = sanitizeTenantKey(entry);
      if (slug) keys.add(slug);
    }
  }

  const fallback = sanitizeTenantKey(fallbackTenant);
  if (fallback) keys.add(fallback);

  return keys;
}

function parsePositiveInt(raw, fallback) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.trunc(n);
}

async function fetchActiveTenantKeysFromSupabase(env) {
  const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const supabaseAnonKey = String(env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const endpoint = `${supabaseUrl}/rest/v1/tenants?select=tenant_key&active=eq.true`;
  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: "application/json",
      },
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

  const keys = new Set();
  for (const row of payload) {
    const slug = sanitizeTenantKey(row?.tenant_key);
    if (slug) keys.add(slug);
  }
  return keys;
}

async function isTenantActiveInSupabase(env, tenantKey) {
  const slug = sanitizeTenantKey(tenantKey);
  if (!slug) return false;

  const supabaseUrl = String(env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
  const supabaseAnonKey = String(env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !supabaseAnonKey) return false;

  const endpoint =
    `${supabaseUrl}/rest/v1/tenants` +
    `?select=tenant_key&tenant_key=eq.${encodeURIComponent(slug)}&active=eq.true&limit=1`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "x-tenant-key": slug,
        Accept: "application/json",
      },
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });
  } catch (error) {
    console.warn("[tenant-router][tenant-probe-fetch-error]", slug, String(error?.message || error));
    return false;
  }

  if (!response.ok) {
    console.warn("[tenant-router][tenant-probe-http-error]", slug, response.status);
    return false;
  }

  const payload = await response.json().catch(() => null);
  if (!Array.isArray(payload)) return false;
  return payload.some((row) => sanitizeTenantKey(row?.tenant_key) === slug);
}

async function resolveKnownTenantKeys(env, defaultTenant) {
  const fallbackKeys = parseKnownTenantKeys(env.KNOWN_TENANT_KEYS, defaultTenant);
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
    tenantKeysCache.signature === signature &&
    tenantKeysCache.keys instanceof Set &&
    tenantKeysCache.expiresAt > now
  ) {
    return new Set(tenantKeysCache.keys);
  }

  if (tenantKeysInflight.signature === signature && tenantKeysInflight.promise) {
    const inflight = await tenantKeysInflight.promise;
    return new Set(inflight);
  }

  tenantKeysInflight = {
    signature,
    promise: (async () => {
    const synced = await fetchActiveTenantKeysFromSupabase(env);
    const merged = new Set(fallbackKeys);
    if (synced instanceof Set) {
      for (const key of synced.values()) merged.add(key);
    }
    const fallback = sanitizeTenantKey(defaultTenant);
    if (fallback) merged.add(fallback);

    tenantKeysCache = {
      keys: merged,
      expiresAt: Date.now() + (ttlSec * 1000),
      signature,
    };
    return merged;
  })(),
  };

  try {
    const keys = await tenantKeysInflight.promise;
    return new Set(keys);
  } finally {
    tenantKeysInflight = {
      signature: "",
      promise: null,
    };
  }
}

function withTenantHeaders(headers, resolution) {
  const nextHeaders = new Headers(headers || {});
  if (resolution?.tenantKey) {
    nextHeaders.set("x-tenant-key", resolution.tenantKey);
  } else {
    nextHeaders.delete("x-tenant-key");
  }
  nextHeaders.set("x-tenant-mode", resolution?.mode || "marketing_home");
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
    const knownTenantKeys = await resolveKnownTenantKeys(env, defaultTenant);

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
      if (slug && !knownTenantKeys.has(slug)) {
        const activeTenant = await isTenantActiveInSupabase(env, slug);
        if (activeTenant) {
          knownTenantKeys.add(slug);
          tenantKeysCache = {
            signature: tenantKeysCache.signature,
            keys: new Set([...(tenantKeysCache.keys || []), slug]),
            expiresAt: tenantKeysCache.expiresAt || (Date.now() + 30_000),
          };
          resolution = resolveTenantRequest(
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
