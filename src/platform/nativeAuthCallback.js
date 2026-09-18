import { isNativeAppRuntime } from "./runtime.js";

const AUTH_CALLBACK_HOST = "auth";
const AUTH_CALLBACK_PATH = "/callback";
const AUTH_CALLBACK_SCHEMES = new Set(["cityreport:", "cityreporthub:"]);

export function toNativeAuthCallbackLocation(rawUrl, currentOrigin) {
  const origin = String(currentOrigin || "").trim();
  if (!origin) return "";
  try {
    const callback = new URL(String(rawUrl || "").trim());
    if (
      !AUTH_CALLBACK_SCHEMES.has(callback.protocol.toLowerCase())
      || callback.hostname.toLowerCase() !== AUTH_CALLBACK_HOST
      || callback.pathname !== AUTH_CALLBACK_PATH
    ) {
      return "";
    }
    const target = new URL(origin);
    target.pathname = "/";
    target.search = callback.search;
    target.hash = callback.hash;
    return target.toString();
  } catch {
    return "";
  }
}

export async function installNativeAuthCallbackHandler() {
  if (!isNativeAppRuntime() || typeof window === "undefined") return () => {};

  try {
    const { App } = await import("@capacitor/app");
    const openCallback = ({ url } = {}) => {
      const target = toNativeAuthCallbackLocation(url, window.location.origin);
      if (target) window.location.assign(target);
    };
    const listener = await App.addListener("appUrlOpen", openCallback);
    const launchUrl = await App.getLaunchUrl();
    if (launchUrl?.url) openCallback(launchUrl);
    return () => listener?.remove?.();
  } catch (error) {
    console.warn("[native-auth] unable to register callback handler", error);
    return () => {};
  }
}
