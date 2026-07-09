import { useEffect } from "react";
import { INCIDENT_REPORTING_LAYER_KEY } from "./lib/mapDomainSelectionConfig.js";
import {
  clearCachedUserProfileShared,
  normalizeCachedUserProfileShared,
  readCachedUserAdminFlagShared,
  readCachedUserProfileShared,
  readCachedUserReportAccessShared,
  writeCachedUserAdminFlagShared,
  writeCachedUserProfileShared,
  writeCachedUserReportAccessShared,
} from "./lib/mapAccountCacheSupport.js";

const loadDeferredAccountRuntimeModule = () => import("./lib/mapDeferredAccountRuntime.js");

export default function MapLazyAccountAccessController({
  session,
  sessionUserId,
  tenantKey,
  nonCriticalStartupReady,
  authGateOpen,
  authGateStep,
  useAppShellLayout,
  accountMenuOpen,
  adminDomainMenuOpen,
  showNotificationPreferencesEntry,
  notificationPreferencesOpen,
  activeMapLayerKey,
  incidentLayerDomainOptionCount,
  manageOpen,
  profile,
  desktopAccountMenuAnchorRef,
  desktopAccountMenuPanelRef,
  domainMenuAnchorRef,
  domainMenuPanelRef,
  shouldLoadAdminStateEagerly,
  shouldLoadReportAccessEagerly,
  shouldLoadProfileEagerly,
  supabase,
  isExpectedPermissionError,
  isMissingFunctionError,
  buildProfileFallbackFromSession,
  setIsAdmin,
  setCanAccessAdminReports,
  setCanAccessDomainReports,
  setCanEditDomainReports,
  setReportAccessResolved,
  setProfile,
  setAccountView,
  setAccountMenuOpen,
  setLoginError,
  setSignupLegalAccepted,
  setTermsOpen,
  setPrivacyOpen,
  setSavedNotificationPreferencesByTopic,
  setAdminDomainMenuOpen,
  setNotificationPreferencesOpen,
  setMobileIncidentDomainMenuOpen,
  setManageForm,
}) {
  useEffect(() => {
    if (!authGateOpen) setLoginError("");
  }, [authGateOpen, authGateStep, setLoginError]);

  useEffect(() => {
    if (authGateOpen) return;
    setSignupLegalAccepted(false);
    setTermsOpen(false);
    setPrivacyOpen(false);
  }, [
    authGateOpen,
    setPrivacyOpen,
    setSignupLegalAccepted,
    setTermsOpen,
  ]);

  useEffect(() => {
    setSavedNotificationPreferencesByTopic({});
  }, [setSavedNotificationPreferencesByTopic, tenantKey]);

  useEffect(() => {
    if (!accountMenuOpen || useAppShellLayout || typeof window === "undefined") return undefined;

    const handlePointerDown = (event) => {
      const anchor = desktopAccountMenuAnchorRef.current;
      const panel = desktopAccountMenuPanelRef.current;
      if (anchor && anchor.contains(event.target)) return;
      if (panel && panel.contains(event.target)) return;
      setAccountMenuOpen(false);
      setAccountView("menu");
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setAccountMenuOpen(false);
      setAccountView("menu");
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    accountMenuOpen,
    desktopAccountMenuAnchorRef,
    desktopAccountMenuPanelRef,
    setAccountMenuOpen,
    setAccountView,
    useAppShellLayout,
  ]);

  useEffect(() => {
    if (!adminDomainMenuOpen || useAppShellLayout || typeof window === "undefined") return undefined;

    const handlePointerDown = (event) => {
      const anchor = domainMenuAnchorRef.current;
      const panel = domainMenuPanelRef.current;
      if (anchor && anchor.contains(event.target)) return;
      if (panel && panel.contains(event.target)) return;
      setAdminDomainMenuOpen(false);
    };

    const handleEscape = (event) => {
      if (event.key !== "Escape") return;
      setAdminDomainMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [
    adminDomainMenuOpen,
    domainMenuAnchorRef,
    domainMenuPanelRef,
    setAdminDomainMenuOpen,
    useAppShellLayout,
  ]);

  useEffect(() => {
    if (activeMapLayerKey !== INCIDENT_REPORTING_LAYER_KEY || incidentLayerDomainOptionCount <= 1) {
      setMobileIncidentDomainMenuOpen(false);
    }
  }, [
    activeMapLayerKey,
    incidentLayerDomainOptionCount,
    setMobileIncidentDomainMenuOpen,
  ]);

  useEffect(() => {
    if (showNotificationPreferencesEntry) return;
    if (!notificationPreferencesOpen) return;
    setNotificationPreferencesOpen(false);
  }, [
    notificationPreferencesOpen,
    setNotificationPreferencesOpen,
    showNotificationPreferencesEntry,
  ]);

  useEffect(() => {
    if (!manageOpen) return;

    setManageForm({
      full_name: String(profile?.full_name || "").trim(),
      phone: String(profile?.phone || "").trim(),
    });
  }, [manageOpen, profile?.full_name, profile?.phone, setManageForm]);

  useEffect(() => {
    const userId = String(sessionUserId || "").trim();
    if (!userId) return undefined;
    const cachedAdminFlag = readCachedUserAdminFlagShared(userId);
    if (cachedAdminFlag !== null) {
      setIsAdmin(Boolean(cachedAdminFlag));
    }
    if (!shouldLoadAdminStateEagerly && !nonCriticalStartupReady) return undefined;
    let dispose = () => {};
    let cancelled = false;

    void loadDeferredAccountRuntimeModule()
      .then(({
        scheduleAdminStateLoadRuntimeShared,
      }) => {
        if (cancelled) return;
        dispose = scheduleAdminStateLoadRuntimeShared({
          sessionUserId: userId,
          shouldLoadAdminStateEagerly,
          nonCriticalStartupReady,
          cachedAdminFlag,
        }, {
          supabase,
          isExpectedPermissionError,
          setIsAdmin,
          writeCachedUserAdminFlag: writeCachedUserAdminFlagShared,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    isExpectedPermissionError,
    nonCriticalStartupReady,
    sessionUserId,
    setIsAdmin,
    shouldLoadAdminStateEagerly,
    supabase,
  ]);

  useEffect(() => {
    const userId = String(sessionUserId || "").trim();
    const safeTenantKey = String(tenantKey || "").trim().toLowerCase();
    if (!userId || !safeTenantKey) return undefined;
    const cachedAccess = readCachedUserReportAccessShared(userId, safeTenantKey);
    if (!cachedAccess) {
      setCanAccessAdminReports(false);
      setCanAccessDomainReports(false);
      setCanEditDomainReports(false);
      setReportAccessResolved(false);
    } else {
      setCanAccessAdminReports(Boolean(cachedAccess.canAccessAdminReports));
      setCanAccessDomainReports(Boolean(cachedAccess.canAccessDomainReports));
      setCanEditDomainReports(Boolean(cachedAccess.canEditDomainReports));
      setReportAccessResolved(true);
    }
    if (!shouldLoadReportAccessEagerly) return undefined;
    let dispose = () => {};
    let cancelled = false;

    void loadDeferredAccountRuntimeModule()
      .then(({
        scheduleReportAccessLoadRuntimeShared,
      }) => {
        if (cancelled) return;
        dispose = scheduleReportAccessLoadRuntimeShared({
          sessionUserId: userId,
          tenantKey: safeTenantKey,
          shouldLoadReportAccessEagerly,
          userId,
          cachedAccess,
        }, {
          supabase,
          isMissingFunctionError,
          isExpectedPermissionError,
          setCanAccessAdminReports,
          setCanAccessDomainReports,
          setCanEditDomainReports,
          setReportAccessResolved,
          writeCachedUserReportAccess: writeCachedUserReportAccessShared,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    isExpectedPermissionError,
    isMissingFunctionError,
    sessionUserId,
    setCanAccessAdminReports,
    setCanAccessDomainReports,
    setCanEditDomainReports,
    setReportAccessResolved,
    shouldLoadReportAccessEagerly,
    supabase,
    tenantKey,
  ]);

  useEffect(() => {
    const userId = String(sessionUserId || "").trim();
    if (!userId) return undefined;
    const cachedProfile = readCachedUserProfileShared(userId);
    if (cachedProfile) {
      setProfile(cachedProfile);
    } else {
      setProfile(buildProfileFallbackFromSession(session));
    }
    if (!shouldLoadProfileEagerly) return undefined;
    let dispose = () => {};
    let cancelled = false;

    void loadDeferredAccountRuntimeModule()
      .then(({
        scheduleProfileLoadRuntimeShared,
      }) => {
        if (cancelled) return;
        dispose = scheduleProfileLoadRuntimeShared({
          session,
          shouldLoadProfileEagerly,
        }, {
          supabase,
          buildProfileFallbackFromSession,
          setProfile,
          normalizeCachedUserProfile: normalizeCachedUserProfileShared,
          writeCachedUserProfile: writeCachedUserProfileShared,
          clearCachedUserProfile: clearCachedUserProfileShared,
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      dispose();
    };
  }, [
    buildProfileFallbackFromSession,
    session,
    sessionUserId,
    setProfile,
    shouldLoadProfileEagerly,
    supabase,
  ]);

  return null;
}
