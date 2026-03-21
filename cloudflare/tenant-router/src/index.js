import { buildUnknownTenantSlugEvent, resolveTenantRequest } from "./router.js";

const DEFAULT_ORIGIN = "lightapp-ak2.pages.dev";

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

    const resolution = resolveTenantRequest(
      {
        hostname: url.hostname,
        pathname: url.pathname,
        search: url.search,
      },
      {
        defaultTenant,
      },
    );

    if (resolution.mode === "redirect" && resolution.redirectTo) {
      return Response.redirect(resolution.redirectTo, 301);
    }

    if (resolution.mode === "not_found") {
      logUnknownSlug(url, resolution);
      return new Response("Not Found", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return proxyToPages(request, resolution, env);
  },
};
