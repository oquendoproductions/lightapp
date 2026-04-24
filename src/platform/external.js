import { registerPlugin } from "@capacitor/core";
import { isNativeAppRuntime } from "./runtime.js";

const ExternalBrowser = registerPlugin("ExternalBrowser");

export async function openExternalUrl(rawUrl, options = {}) {
  const url = String(rawUrl || "").trim();
  if (!url) return false;

  if (isNativeAppRuntime()) {
    try {
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
