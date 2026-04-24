import { getCurrentLocationSnapshot, isNativeAppRuntime } from "./runtime.js";

const AUTH_REDIRECT_URL = String(import.meta.env.VITE_AUTH_REDIRECT_URL || "").trim();
const NATIVE_AUTH_REDIRECT_URL = String(
  import.meta.env.VITE_NATIVE_AUTH_REDIRECT_URL ||
  import.meta.env.VITE_MOBILE_AUTH_REDIRECT_URL ||
  ""
).trim();

function getDefaultNativeAuthRedirectUrl() {
  const appScope = String(import.meta.env.VITE_NATIVE_APP_SCOPE || "")
    .trim()
    .toLowerCase();
  return appScope === "hub" ? "cityreporthub://auth/callback" : "cityreport://auth/callback";
}

export function getAuthRedirectUrl(pathname = "/") {
  if (isNativeAppRuntime()) {
    return NATIVE_AUTH_REDIRECT_URL || getDefaultNativeAuthRedirectUrl();
  }
  if (AUTH_REDIRECT_URL) {
    return AUTH_REDIRECT_URL;
  }
  const location = getCurrentLocationSnapshot();
  if (!location.origin) return undefined;
  try {
    return new URL(String(pathname || "/"), location.origin).toString();
  } catch {
    return location.origin;
  }
}

export function getAuthRedirectOptions(pathname = "/") {
  const redirectTo = getAuthRedirectUrl(pathname);
  return redirectTo ? { redirectTo } : undefined;
}
