import { Capacitor } from "@capacitor/core";

const DEFAULT_NATIVE_APP_SCOPE = "map";

export function isNativeAppRuntime() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getPlatformName() {
  try {
    return String(Capacitor.getPlatform?.() || "web").trim().toLowerCase() || "web";
  } catch {
    return "web";
  }
}

export function getNativeAppScope() {
  const envScope = String(import.meta.env.VITE_NATIVE_APP_SCOPE || "")
    .trim()
    .toLowerCase();
  if (envScope === "hub" || envScope === "map") return envScope;
  try {
    const runtimeScope = String(globalThis?.__CITYREPORT_NATIVE_APP_SCOPE || "")
      .trim()
      .toLowerCase();
    if (runtimeScope === "hub" || runtimeScope === "map") return runtimeScope;
  } catch {
    // ignore
  }
  return DEFAULT_NATIVE_APP_SCOPE;
}

export function getCurrentLocationSnapshot() {
  if (typeof window === "undefined" || !window.location) {
    return {
      origin: "",
      hostname: "",
      host: "",
      pathname: "/",
      search: "",
      hash: "",
      protocol: "",
    };
  }
  return {
    origin: String(window.location.origin || "").trim(),
    hostname: String(window.location.hostname || "").trim(),
    host: String(window.location.host || "").trim(),
    pathname: String(window.location.pathname || "/"),
    search: String(window.location.search || ""),
    hash: String(window.location.hash || ""),
    protocol: String(window.location.protocol || "").trim(),
  };
}
