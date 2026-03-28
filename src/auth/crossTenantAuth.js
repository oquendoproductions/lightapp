const AUTH_BRIDGE_COOKIE = "cityreport_auth_bridge_v1";
const LOGOUT_MARKER_COOKIE = "cityreport_auth_logout_v1";
const BRIDGE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function trimOrEmpty(value) {
  return String(value || "").trim();
}

function getCookieDomain(hostname = globalThis?.location?.hostname) {
  const host = trimOrEmpty(hostname).toLowerCase();
  if (!host) return "";
  if (host === "cityreport.io" || host.endsWith(".cityreport.io")) {
    return ".cityreport.io";
  }
  return "";
}

function buildCookieAttributes(options = {}) {
  const attrs = ["Path=/", "SameSite=Lax"];
  const domain = trimOrEmpty(options.domain || getCookieDomain());
  if (domain) attrs.push(`Domain=${domain}`);
  if (globalThis?.location?.protocol === "https:") attrs.push("Secure");
  if (Number.isFinite(options.maxAge)) attrs.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  return attrs.join("; ");
}

function writeCookie(name, value, options = {}) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${value}; ${buildCookieAttributes(options)}`;
}

function expireCookie(name, options = {}) {
  writeCookie(name, "", { ...options, maxAge: 0 });
}

function readCookie(name) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  const parts = String(document.cookie || "").split(/;\s*/);
  for (const part of parts) {
    if (part.startsWith(prefix)) return part.slice(prefix.length);
  }
  return "";
}

function encodePayload(payload) {
  try {
    return encodeURIComponent(JSON.stringify(payload));
  } catch {
    return "";
  }
}

function decodePayload(raw) {
  try {
    const decoded = decodeURIComponent(String(raw || ""));
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readBridgePayload() {
  return decodePayload(readCookie(AUTH_BRIDGE_COOKIE));
}

function readLogoutPayload() {
  return decodePayload(readCookie(LOGOUT_MARKER_COOKIE));
}

export function persistCrossTenantSession(session) {
  const accessToken = trimOrEmpty(session?.access_token);
  const refreshToken = trimOrEmpty(session?.refresh_token);
  if (!accessToken || !refreshToken) return;
  writeCookie(
    AUTH_BRIDGE_COOKIE,
    encodePayload({
      access_token: accessToken,
      refresh_token: refreshToken,
      user_id: trimOrEmpty(session?.user?.id) || null,
      ts: Date.now(),
    }),
    { maxAge: BRIDGE_MAX_AGE_SECONDS }
  );
  expireCookie(LOGOUT_MARKER_COOKIE);
}

export function markCrossTenantLogout() {
  expireCookie(AUTH_BRIDGE_COOKIE);
  writeCookie(
    LOGOUT_MARKER_COOKIE,
    encodePayload({ ts: Date.now() }),
    { maxAge: BRIDGE_MAX_AGE_SECONDS }
  );
}

export function extractTenantSwitchSession(rawHash) {
  const hash = trimOrEmpty(rawHash).replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const accessToken = trimOrEmpty(params.get("cr_access_token"));
  const refreshToken = trimOrEmpty(params.get("cr_refresh_token"));
  if (!accessToken || !refreshToken) return null;
  params.delete("cr_access_token");
  params.delete("cr_refresh_token");
  const nextHash = params.toString();
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    cleanedHash: nextHash ? `#${nextHash}` : "",
  };
}

export async function hydrateCrossTenantSession(supabase) {
  if (!supabase?.auth) return null;

  if (typeof window !== "undefined") {
    const handoffSession = extractTenantSwitchSession(window.location.hash);
    if (handoffSession) {
      try {
        await supabase.auth.setSession({
          access_token: handoffSession.access_token,
          refresh_token: handoffSession.refresh_token,
        });
        const nextUrl = `${window.location.pathname}${window.location.search}${handoffSession.cleanedHash}`;
        window.history.replaceState({}, "", nextUrl);
      } catch {
        // ignore
      }
    }
  }

  let { data } = await supabase.auth.getSession();
  let session = data?.session || null;
  const bridgePayload = readBridgePayload();
  const logoutPayload = readLogoutPayload();

  if (logoutPayload && !bridgePayload) {
    if (session) {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }
    return null;
  }

  if (!session && bridgePayload?.access_token && bridgePayload?.refresh_token) {
    try {
      await supabase.auth.setSession({
        access_token: bridgePayload.access_token,
        refresh_token: bridgePayload.refresh_token,
      });
      ({ data } = await supabase.auth.getSession());
      session = data?.session || null;
    } catch {
      markCrossTenantLogout();
      return null;
    }
  }

  if (session) {
    persistCrossTenantSession(session);
  }

  return session;
}

export function syncCrossTenantAuthState(event, nextSession) {
  if (nextSession?.access_token && nextSession?.refresh_token) {
    persistCrossTenantSession(nextSession);
    return;
  }
  const authEvent = trimOrEmpty(event).toUpperCase();
  if (authEvent === "SIGNED_OUT" || authEvent === "USER_DELETED") {
    markCrossTenantLogout();
  }
}
