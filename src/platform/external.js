import { isNativeAppRuntime } from "./runtime.js";

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
