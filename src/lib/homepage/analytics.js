const provider = String(import.meta.env.VITE_ANALYTICS_PROVIDER || "").trim().toLowerCase();
const debug = String(import.meta.env.VITE_ANALYTICS_DEBUG || "false").trim().toLowerCase() === "true";

export function trackEvent(eventName, payload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  if (debug) {
    console.info("[analytics]", eventName, payload);
  }

  if (!provider || provider === "plausible") {
    window.plausible?.(eventName, { props: payload });
  }

  if (!provider || provider === "ga") {
    window.gtag?.("event", eventName, payload);
  }
}
