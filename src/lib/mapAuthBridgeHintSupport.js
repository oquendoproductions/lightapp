const AUTH_BRIDGE_COOKIE = "cityreport_auth_bridge_v1";
const LOGOUT_MARKER_COOKIE = "cityreport_auth_logout_v1";

function trimOrEmpty(value) {
  return String(value || "").trim();
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

function decodePayload(raw) {
  try {
    const decoded = decodeURIComponent(String(raw || ""));
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function readCrossTenantAuthBridgeStateHint() {
  const bridgePayload = decodePayload(readCookie(AUTH_BRIDGE_COOKIE));
  const logoutPayload = decodePayload(readCookie(LOGOUT_MARKER_COOKIE));
  return {
    hasBridgeSessionHint: Boolean(
      trimOrEmpty(bridgePayload?.access_token) && trimOrEmpty(bridgePayload?.refresh_token)
    ),
    hasLogoutMarker: Boolean(logoutPayload),
  };
}
