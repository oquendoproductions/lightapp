import { getPlatformName, isNativeAppRuntime } from "./runtime.js";

export function buildMapNavigationUrl(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const destination = `${lat},${lng}`;
  const platform = getPlatformName();

  if (isNativeAppRuntime() && platform === "ios") {
    return `maps://?daddr=${encodeURIComponent(destination)}&dirflg=d`;
  }
  if (isNativeAppRuntime() && platform === "android") {
    return `geo:0,0?q=${encodeURIComponent(destination)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export async function openMapNavigation(latitude, longitude) {
  const url = buildMapNavigationUrl(latitude, longitude);
  if (!url) return false;
  return openExternalUrl(url);
}

export async function openMapNavigationFromCoordinates(rawCoordinates) {
  const matches = String(rawCoordinates || "").match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!matches) return false;
  return openMapNavigation(matches[1], matches[2]);
}

export async function openExternalUrl(rawUrl, options = {}) {
  const url = String(rawUrl || "").trim();
  if (!url) return false;

  if (isNativeAppRuntime()) {
    try {
      const { registerPlugin } = await import("@capacitor/core");
      const ExternalBrowser = registerPlugin("ExternalBrowser");
      await ExternalBrowser.openUrl({ url });
      return true;
    } catch {
      // fall back to browser open below
    }
  }

  if (typeof window !== "undefined") {
    window.open(url, String(options.target || "_blank"), "noopener,noreferrer");
    return true;
  }

  return false;
}
