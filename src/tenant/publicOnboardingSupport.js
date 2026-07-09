export const PUBLIC_APP_ONBOARDING_SEEN_KEY = "cityreport.public_onboarding_seen_v1";
export const PUBLIC_APP_ONBOARDING_OPEN_AUTH_EVENT = "cityreport:public-onboarding-open-auth";
export const PUBLIC_APP_ONBOARDING_PENDING_AUTH_KEY = "cityreport.public_onboarding_pending_auth_v1";

export function publicOnboardingStorageKey(tenantKey) {
  const key = String(tenantKey || "").trim().toLowerCase() || "unknown";
  return `${PUBLIC_APP_ONBOARDING_SEEN_KEY}:${key}`;
}

export function hasSeenPublicOnboarding(tenantKey) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(publicOnboardingStorageKey(tenantKey)) === "1";
  } catch {
    return false;
  }
}

export function markPublicOnboardingSeen(tenantKey) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(publicOnboardingStorageKey(tenantKey), "1");
  } catch {
    // ignore storage failures
  }
}
