export type AnalyticsPayload = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: AnalyticsPayload }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

const provider = String(import.meta.env.VITE_ANALYTICS_PROVIDER || "").trim().toLowerCase();
const debug = String(import.meta.env.VITE_ANALYTICS_DEBUG || "false").trim().toLowerCase() === "true";

export function trackEvent(eventName: string, payload: AnalyticsPayload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  if (debug) {
    // Debug logging is intentionally concise for quick verification.
    console.info("[analytics]", eventName, payload);
  }

  if (!provider || provider === "plausible") {
    window.plausible?.(eventName, { props: payload });
  }

  if (!provider || provider === "ga") {
    window.gtag?.("event", eventName, payload);
  }
}
