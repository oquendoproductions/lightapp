import { useEffect, useRef } from "react";
import { shouldOpenExpiredSessionPrompt } from "./lib/mapAuthBootstrapSupport.js";

const loadCrossTenantAuthModule = () => import("./auth/crossTenantAuth");

export default function MapLazyAuthBootstrapController({
  shouldHydrateMapAuthEagerly,
  hydrateImmediately = false,
  supabase,
  sessionUserId,
  authReady,
  openNotice,
  setSession,
  setAuthReady,
  setAccountView,
  setAccountMenuOpen,
  setAuthGateOpen,
  setAuthGateStep,
  setForgotPasswordOpen,
  setRecoveryPasswordValue,
  setRecoveryPasswordValue2,
  setRecoveryPasswordOpen,
  publicAppOnboardingPendingAuthKey,
  publicAccountDeletePendingAuthKey,
  readDeleteAccountDeepLinkRequest,
  clearDeleteAccountQuery,
  openDeleteAccountFlow,
  wasUserInitiatedLogout,
}) {
  const openNoticeRef = useRef(openNotice);

  useEffect(() => {
    openNoticeRef.current = openNotice;
  }, [openNotice]);

  useEffect(() => {
    const KEY = "sl_email_confirmed_flash_shown";
    if (sessionStorage.getItem(KEY)) return;

    const search = window.location.search || "";
    const hash = window.location.hash || "";
    const looksLikeEmailConfirm =
      /type=signup/i.test(search + hash) &&
      (/(^|[?#&])code=/i.test(search) ||
        /(^|[?#&])token_hash=/i.test(search) ||
        /(^|[?#&])access_token=/i.test(hash));

    if (!looksLikeEmailConfirm) return;

    sessionStorage.setItem(KEY, "1");

    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      // ignore
    }

    openNoticeRef.current("✅", "Email confirmed", "You're all set.", {
      autoCloseMs: 2000,
      compact: true,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    window.__openAuthGate = (step = "welcome") => {
      if (sessionUserId) return;
      setAuthGateStep(step);
      setAuthGateOpen(true);
    };

    return () => {
      try {
        delete window.__openAuthGate;
      } catch {
        // ignore
      }
    };
  }, [sessionUserId, setAuthGateOpen, setAuthGateStep]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const openAuthStep = (stepValue = "login") => {
      if (sessionUserId) return;
      const step = String(stepValue || "login").trim() || "login";
      window.setTimeout(() => {
        setAccountView("menu");
        setAccountMenuOpen(false);
        setAuthGateStep(step);
        setAuthGateOpen(true);
      }, 0);
    };
    const consumePendingOnboardingAuth = () => {
      try {
        const pending = String(window.sessionStorage.getItem(publicAppOnboardingPendingAuthKey) || "").trim();
        if (!pending) return;
        window.sessionStorage.removeItem(publicAppOnboardingPendingAuthKey);
        openAuthStep(pending);
      } catch {
        // ignore storage failures
      }
    };
    const handleOnboardingOpenAuth = (event) => {
      try {
        window.sessionStorage.removeItem(publicAppOnboardingPendingAuthKey);
      } catch {
        // ignore storage failures
      }
      openAuthStep(event?.detail?.step || "login");
    };
    window.addEventListener("cityreport:public-onboarding-open-auth", handleOnboardingOpenAuth);
    consumePendingOnboardingAuth();
    return () => {
      window.removeEventListener("cityreport:public-onboarding-open-auth", handleOnboardingOpenAuth);
    };
  }, [
    publicAppOnboardingPendingAuthKey,
    sessionUserId,
    setAccountMenuOpen,
    setAccountView,
    setAuthGateOpen,
    setAuthGateStep,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (shouldHydrateMapAuthEagerly && !authReady) return undefined;

    const requestedByQuery = readDeleteAccountDeepLinkRequest(window.location.search || "");
    if (!sessionUserId) {
      if (!requestedByQuery) return undefined;
      try {
        window.sessionStorage.setItem(publicAccountDeletePendingAuthKey, "1");
      } catch {
        // ignore storage failures
      }
      clearDeleteAccountQuery();
      window.setTimeout(() => {
        setAccountView("menu");
        setAccountMenuOpen(false);
        setAuthGateStep("login");
        setAuthGateOpen(true);
      }, 0);
      return undefined;
    }

    let pendingDelete = false;
    try {
      pendingDelete = String(window.sessionStorage.getItem(publicAccountDeletePendingAuthKey) || "").trim() === "1";
      if (pendingDelete) window.sessionStorage.removeItem(publicAccountDeletePendingAuthKey);
    } catch {
      // ignore storage failures
    }
    if (!pendingDelete && !requestedByQuery) return undefined;
    clearDeleteAccountQuery();
    window.setTimeout(() => {
      openDeleteAccountFlow();
    }, 0);
    return undefined;
  }, [
    authReady,
    clearDeleteAccountQuery,
    openDeleteAccountFlow,
    publicAccountDeletePendingAuthKey,
    readDeleteAccountDeepLinkRequest,
    sessionUserId,
    setAccountMenuOpen,
    setAccountView,
    setAuthGateOpen,
    setAuthGateStep,
    shouldHydrateMapAuthEagerly,
  ]);

  useEffect(() => {
    let mounted = true;
    let hydrateStarted = false;
    let idleHandle = null;
    let timeoutHandle = null;

    async function hydrateSessionNow() {
      if (!mounted || hydrateStarted) return;
      hydrateStarted = true;
      try {
        const { hydrateCrossTenantSession } = await loadCrossTenantAuthModule();
        const nextSession = await hydrateCrossTenantSession(supabase);
        if (!mounted) return;
        setSession(nextSession || null);
        setAuthReady(true);
        if (shouldOpenExpiredSessionPrompt({
          nextSession,
          shouldHydrateMapAuthEagerly,
          userInitiatedLogout: wasUserInitiatedLogout?.() === true,
        })) {
          openNoticeRef.current(
            "Session expired",
            "Sign in again",
            "Your saved session is no longer valid. The map is currently showing public incident visibility."
          );
          setAccountView("menu");
          setAccountMenuOpen(false);
          setAuthGateStep("login");
          setAuthGateOpen(true);
        }
      } catch (error) {
        if (!mounted) return;
        console.warn("[auth hydrate]", error?.message || error);
        setSession(null);
        setAuthReady(true);
      }
    }

    if (shouldHydrateMapAuthEagerly || hydrateImmediately) {
      void hydrateSessionNow();
    } else if (typeof window === "undefined") {
      void hydrateSessionNow();
    } else {
      const delayedHydrateMs = 1600;
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(() => {
          void hydrateSessionNow();
        }, { timeout: delayedHydrateMs });
      }
      timeoutHandle = window.setTimeout(() => {
        void hydrateSessionNow();
      }, delayedHydrateMs);
    }

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        void (async () => {
          try {
            const { syncCrossTenantAuthState } = await loadCrossTenantAuthModule();
            syncCrossTenantAuthState(event, newSession || null);
          } catch (error) {
            console.warn("[auth state sync]", error?.message || error);
          }
        })();
        setSession(newSession);
        setAuthReady(true);
        if (event === "PASSWORD_RECOVERY") {
          setAuthGateOpen(false);
          setForgotPasswordOpen(false);
          setRecoveryPasswordValue("");
          setRecoveryPasswordValue2("");
          setRecoveryPasswordOpen(true);
        }
      }
    );

    return () => {
      mounted = false;
      if (
        idleHandle !== null &&
        typeof window !== "undefined" &&
        typeof window.cancelIdleCallback === "function"
      ) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null && typeof window !== "undefined") {
        window.clearTimeout(timeoutHandle);
      }
      listener?.subscription?.unsubscribe();
    };
  }, [
    setAuthGateOpen,
    setAuthReady,
    setForgotPasswordOpen,
    setAccountMenuOpen,
    setAccountView,
    setAuthGateStep,
    setRecoveryPasswordOpen,
    setRecoveryPasswordValue,
    setRecoveryPasswordValue2,
    setSession,
    hydrateImmediately,
    shouldHydrateMapAuthEagerly,
    supabase,
    wasUserInitiatedLogout,
  ]);

  return null;
}
