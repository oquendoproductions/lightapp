const loadDeferredAccountActionSupportModule = () => import("./mapDeferredAccountActionSupport.js");
const loadPlatformAuthModule = () => import("../platform/auth.js");
const loadCrossTenantAuthModule = () => import("../auth/crossTenantAuth");
const loadDeferredReportAccessSupportModule = () => import("./mapDeferredReportAccessSupport.js");
const loadCapacitorPushNotificationsModule = () => import("@capacitor/push-notifications");
export {
  clearCachedUserProfileShared,
  normalizeCachedUserProfileShared,
  normalizeCachedUserReportAccessShared,
  readCachedUserAdminFlagShared,
  readCachedUserProfileShared,
  readCachedUserReportAccessShared,
  writeCachedUserAdminFlagShared,
  writeCachedUserProfileShared,
  writeCachedUserReportAccessShared,
} from "./mapAccountCacheSupport.js";

export async function sendPasswordResetRuntimeShared(state = {}, deps = {}) {
  const { getAuthRedirectOptions } = await loadPlatformAuthModule();
  const { sendPasswordResetAction } = await loadDeferredAccountActionSupportModule();
  return sendPasswordResetAction({
    supabase: deps.supabase,
    forgotPasswordEmail: state.forgotPasswordEmail,
    setForgotPasswordError: deps.setForgotPasswordError,
    setAuthResetLoading: deps.setAuthResetLoading,
    setForgotPasswordOpen: deps.setForgotPasswordOpen,
    openNotice: deps.openNotice,
    getAuthRedirectOptions,
  });
}

export async function userCreateAccountRuntimeShared(state = {}, deps = {}) {
  const { userCreateAccountAction } = await loadDeferredAccountActionSupportModule();
  return userCreateAccountAction({
    supabase: deps.supabase,
    email: state.email,
    password: state.password,
    full_name: state.fullName,
    phone: state.phone,
  });
}

export async function signOutRuntimeShared(state = {}, deps = {}) {
  const { error } = await deps.supabase.auth.signOut();
  if (!error) {
    const { markCrossTenantLogout } = await loadCrossTenantAuthModule();
    markCrossTenantLogout();
  }
  deps.clearReauthAt();
  deps.setIsAdmin(false);
  deps.setAuthEmail("");
  deps.setAuthPassword("");
  deps.setAccountMenuOpen(false);
  deps.setFollowedLocationsOpen(false);
}

export async function saveManagedProfileRuntimeShared(state = {}, deps = {}) {
  const { saveManagedProfileAction } = await loadDeferredAccountActionSupportModule();
  return saveManagedProfileAction({
    supabase: deps.supabase,
    sessionUserId: state.sessionUserId,
    sessionUserEmail: state.sessionUserEmail,
    profileEmail: state.profileEmail,
    manageForm: state.manageForm,
    reauthAt: state.reauthAt,
    setReauthIntent: deps.setReauthIntent,
    setReauthPassword: deps.setReauthPassword,
    setReauthOpen: deps.setReauthOpen,
    setManageSaving: deps.setManageSaving,
    setProfile: deps.setProfile,
    setManageEditing: deps.setManageEditing,
    openNotice: deps.openNotice,
  });
}

export async function performDeleteAccountRuntimeShared(state = {}, deps = {}) {
  const { markCrossTenantLogout } = await loadCrossTenantAuthModule();
  const { performDeleteAccountAction } = await loadDeferredAccountActionSupportModule();
  return performDeleteAccountAction({
    supabase: deps.supabase,
    sessionUserId: state.sessionUserId,
    publicAccountDeletePendingAuthKey: deps.publicAccountDeletePendingAuthKey,
    clearDeleteAccountQuery: deps.clearDeleteAccountQuery,
    setDeleteAccountSaving: deps.setDeleteAccountSaving,
    setDeleteAccountOpen: deps.setDeleteAccountOpen,
    setDeleteAccountConfirmText: deps.setDeleteAccountConfirmText,
    setDeleteAccountDisclosureAccepted: deps.setDeleteAccountDisclosureAccepted,
    setManageOpen: deps.setManageOpen,
    setManageEditing: deps.setManageEditing,
    setAccountMenuOpen: deps.setAccountMenuOpen,
    setNotificationPreferencesOpen: deps.setNotificationPreferencesOpen,
    setFollowedLocationsOpen: deps.setFollowedLocationsOpen,
    setAccountView: deps.setAccountView,
    setSession: deps.setSession,
    setProfile: deps.setProfile,
    clearReauthAt: deps.clearReauthAt,
    markCrossTenantLogout,
    openNotice: deps.openNotice,
  });
}

export async function changePasswordRuntimeShared(state = {}, deps = {}) {
  const { changePasswordAction } = await loadDeferredAccountActionSupportModule();
  return changePasswordAction({
    supabase: deps.supabase,
    sessionUserEmail: state.sessionUserEmail,
    profileEmail: state.profileEmail,
    changePasswordCurrentValue: state.changePasswordCurrentValue,
    changePasswordValue: state.changePasswordValue,
    changePasswordValue2: state.changePasswordValue2,
    validateStrongPassword: deps.validateStrongPassword,
    openNotice: deps.openNotice,
    setChangePasswordSaving: deps.setChangePasswordSaving,
    setChangePasswordValue: deps.setChangePasswordValue,
    setChangePasswordValue2: deps.setChangePasswordValue2,
    setChangePasswordCurrentValue: deps.setChangePasswordCurrentValue,
    setChangePasswordOpen: deps.setChangePasswordOpen,
    setSession: deps.setSession,
    setReauthAt: deps.setReauthAt,
  });
}

export async function recoveryPasswordUpdateRuntimeShared(state = {}, deps = {}) {
  const { recoveryPasswordUpdateAction } = await loadDeferredAccountActionSupportModule();
  return recoveryPasswordUpdateAction({
    supabase: deps.supabase,
    recoveryPasswordValue: state.recoveryPasswordValue,
    recoveryPasswordValue2: state.recoveryPasswordValue2,
    validateStrongPassword: deps.validateStrongPassword,
    openNotice: deps.openNotice,
    setRecoveryPasswordSaving: deps.setRecoveryPasswordSaving,
    setRecoveryPasswordValue: deps.setRecoveryPasswordValue,
    setRecoveryPasswordValue2: deps.setRecoveryPasswordValue2,
    setRecoveryPasswordOpen: deps.setRecoveryPasswordOpen,
    setSession: deps.setSession,
  });
}

export async function confirmReauthRuntimeShared(state = {}, deps = {}) {
  const { confirmReauthAction } = await loadDeferredAccountActionSupportModule();
  return confirmReauthAction({
    supabase: deps.supabase,
    sessionUserEmail: state.sessionUserEmail,
    profileEmail: state.profileEmail,
    reauthPassword: state.reauthPassword,
    reauthIntent: state.reauthIntent,
    openNotice: deps.openNotice,
    setReauthSaving: deps.setReauthSaving,
    setReauthOpen: deps.setReauthOpen,
    setReauthPassword: deps.setReauthPassword,
    setReauthIntent: deps.setReauthIntent,
    setManageEditing: deps.setManageEditing,
    setReauthAt: deps.setReauthAt,
    onSaveProfile: deps.onSaveProfile,
    onDeleteAccount: deps.onDeleteAccount,
  });
}

export function scheduleAdminStateLoadRuntimeShared(state = {}, deps = {}) {
  let cancelled = false;
  let idleHandle = null;
  let timeoutHandle = null;

  async function checkAdmin() {
    const userId = String(state.sessionUserId || "").trim();
    if (!userId) {
      deps.setIsAdmin(false);
      return;
    }

    const { data, error } = await deps.supabase
      .from("admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (cancelled) return;

    if (error) {
      if (!deps.isExpectedPermissionError(error)) {
        console.error(error);
      }
      deps.setIsAdmin(false);
      return;
    }

    const nextIsAdmin = Boolean(data?.user_id);
    deps.setIsAdmin(nextIsAdmin);
    deps.writeCachedUserAdminFlag(userId, nextIsAdmin);
  }

  const userId = String(state.sessionUserId || "").trim();
  if (!userId) {
    deps.setIsAdmin(false);
    return () => {
      cancelled = true;
    };
  }

  if (!state.shouldLoadAdminStateEagerly && !state.nonCriticalStartupReady) {
    return () => {
      cancelled = true;
    };
  }

  const cachedAdminFlag = state.cachedAdminFlag;
  const idleTimeout = state.shouldLoadAdminStateEagerly
    ? (cachedAdminFlag === null ? 300 : 1000)
    : (cachedAdminFlag === null ? 5200 : 2800);
  const fallbackDelayMs = state.shouldLoadAdminStateEagerly
    ? (cachedAdminFlag === null ? 120 : 220)
    : (cachedAdminFlag === null ? 1800 : 900);

  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    idleHandle = window.requestIdleCallback(() => {
      idleHandle = null;
      void checkAdmin();
    }, { timeout: idleTimeout });
  } else if (typeof window !== "undefined") {
    timeoutHandle = window.setTimeout(() => {
      timeoutHandle = null;
      void checkAdmin();
    }, fallbackDelayMs);
  } else {
    void checkAdmin();
  }

  return () => {
    cancelled = true;
    if (idleHandle != null && typeof window !== "undefined" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle != null && typeof window !== "undefined") {
      window.clearTimeout(timeoutHandle);
    }
  };
}

export function scheduleReportAccessLoadRuntimeShared(state = {}, deps = {}) {
  let cancelled = false;
  const userId = String(state.userId || "").trim();
  const tenantKey = String(state.tenantKey || "").trim().toLowerCase();

  async function loadReportAccess() {
    const { loadReportAccessShared } = await loadDeferredReportAccessSupportModule();
    await loadReportAccessShared({
      sessionUserId: state.sessionUserId,
      tenantKey,
      supabase: deps.supabase,
      isMissingFunctionError: deps.isMissingFunctionError,
      isExpectedPermissionError: deps.isExpectedPermissionError,
      setCanAccessAdminReports: (...args) => {
        if (cancelled) return;
        deps.setCanAccessAdminReports(...args);
      },
      setCanAccessDomainReports: (...args) => {
        if (cancelled) return;
        deps.setCanAccessDomainReports(...args);
      },
      setCanEditDomainReports: (...args) => {
        if (cancelled) return;
        deps.setCanEditDomainReports(...args);
      },
      setReportAccessResolved: (...args) => {
        if (cancelled) return;
        deps.setReportAccessResolved(...args);
      },
      writeCachedUserReportAccess: deps.writeCachedUserReportAccess,
      userId,
    });
  }

  if (!state.sessionUserId) {
    deps.setCanAccessAdminReports(false);
    deps.setCanAccessDomainReports(false);
    deps.setCanEditDomainReports(false);
    deps.setReportAccessResolved(true);
    return () => {
      cancelled = true;
    };
  }

  if (!state.cachedAccess) {
    deps.setReportAccessResolved(false);
  }

  if (!state.shouldLoadReportAccessEagerly) {
    return () => {
      cancelled = true;
    };
  }

  void loadReportAccess();
  return () => {
    cancelled = true;
  };
}

export function scheduleProfileLoadRuntimeShared(state = {}, deps = {}) {
  let cancelled = false;

  async function loadProfile() {
    const userId = String(state.session?.user?.id || "").trim();
    if (!userId) {
      deps.setProfile(null);
      return;
    }

    const { data, error: profErr } = await deps.supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", userId)
      .maybeSingle();

    const fallbackProfile = deps.buildProfileFallbackFromSession(state.session);
    const desiredFullName = fallbackProfile?.full_name || null;
    const desiredPhone = fallbackProfile?.phone || null;
    const desiredEmail = fallbackProfile?.email || null;

    const missingRow = !data;
    const missingName = !((data?.full_name || "").trim()) && !!desiredFullName;
    const missingPhone = !((data?.phone || "").trim()) && !!desiredPhone;

    if (!profErr && (missingRow || missingName || missingPhone)) {
      const { error: upErr } = await deps.supabase
        .from("profiles")
        .upsert(
          [{
            user_id: userId,
            full_name: desiredFullName,
            phone: desiredPhone,
            email: desiredEmail,
          }],
          { onConflict: "user_id" }
        );

      if (upErr) {
        console.error("[profiles] upsert error:", upErr);
      }
    }

    if (cancelled) return;

    if (profErr) {
      console.error("[profiles] load error:", profErr);
      const resolvedFallbackProfile = fallbackProfile || deps.buildProfileFallbackFromSession(state.session);
      deps.setProfile(resolvedFallbackProfile);
      deps.writeCachedUserProfile(userId, resolvedFallbackProfile);
      return;
    }

    const resolvedProfile = deps.normalizeCachedUserProfile(data) || fallbackProfile;
    deps.setProfile(resolvedProfile);
    deps.writeCachedUserProfile(userId, resolvedProfile);
  }

  const userId = String(state.session?.user?.id || "").trim();
  if (!userId) {
    deps.setProfile(null);
    deps.clearCachedUserProfile(userId);
    return () => {
      cancelled = true;
    };
  }

  if (!state.shouldLoadProfileEagerly) {
    return () => {
      cancelled = true;
    };
  }

  void loadProfile();
  return () => {
    cancelled = true;
  };
}

export function attachNativePushListenersRuntimeShared(state = {}, deps = {}) {
  if (!state.nativePushEnabled) return undefined;
  if (!deps.isNativeAppRuntime()) return undefined;
  if (!state.sessionUserId || !state.nativePushShouldRegister) return undefined;

  let cancelled = false;
  const listenerHandles = [];
  const tenantKey = state.resolvedCommunityFeedTenantKey;
  const userId = state.sessionUserId;
  const platform = deps.getPlatformName();
  const safePlatform = platform === "android" ? "android" : platform === "ios" ? "ios" : "";
  if (!tenantKey || !safePlatform) return undefined;

  const rememberToken = async (tokenValue) => {
    const token = String(tokenValue || "").trim();
    if (!token || cancelled) return;
    const { error } = await deps.supabase
      .from("native_push_tokens")
      .upsert([{
        tenant_key: tenantKey,
        user_id: userId,
        platform: safePlatform,
        token,
        enabled: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }], { onConflict: "tenant_key,user_id,platform,token" });
    if (error && !deps.isMissingRelationError(error) && !deps.isExpectedPermissionError(error)) {
      console.warn("[native push token]", error?.message || error);
    }
  };

  const attachListeners = async () => {
    try {
      const { PushNotifications } = await loadCapacitorPushNotificationsModule();
      listenerHandles.push(await PushNotifications.addListener("registration", (token) => {
        void rememberToken(token?.value);
      }));
      listenerHandles.push(await PushNotifications.addListener("registrationError", (error) => {
        console.warn("[native push registration]", error?.error || error);
      }));
      listenerHandles.push(await PushNotifications.addListener("pushNotificationReceived", () => {
        void deps.loadMapCommunityFeed();
      }));
      listenerHandles.push(await PushNotifications.addListener("pushNotificationActionPerformed", () => {
        void deps.loadMapCommunityFeed();
      }));
    } catch (error) {
      if (!cancelled) console.warn("[native push listeners]", error?.message || error);
    }
  };

  void attachListeners();

  return () => {
    cancelled = true;
    for (const handle of listenerHandles) {
      try {
        void handle?.remove?.();
      } catch {
        // ignore listener cleanup failures
      }
    }
  };
}

export function scheduleNativePushRegistrationRuntimeShared(state = {}, deps = {}) {
  if (!state.nativePushEnabled) return undefined;
  if (!deps.isNativeAppRuntime()) return undefined;
  if (!state.sessionUserId || !state.nativePushShouldRegister) return undefined;
  if (state.nativePushRegisteringRef?.current) return undefined;

  let cancelled = false;
  const tenantKey = state.resolvedCommunityFeedTenantKey;
  const userId = state.sessionUserId;
  if (!tenantKey || !userId) return undefined;

  async function registerForNativePush() {
    state.nativePushRegisteringRef.current = true;
    try {
      const { PushNotifications } = await loadCapacitorPushNotificationsModule();
      const platform = deps.getPlatformName();
      if (platform === "android") {
        try {
          await PushNotifications.createChannel({
            id: "cityreport-updates",
            name: "CityReport updates",
            description: "Alerts and events from your selected city.",
            importance: 4,
            visibility: 1,
            sound: "default",
          });
        } catch (error) {
          console.warn("[native push channel]", error?.message || error);
        }
      }

      let permission = await PushNotifications.checkPermissions();
      if (permission?.receive === "prompt") {
        permission = await PushNotifications.requestPermissions();
      }
      if (cancelled || permission?.receive !== "granted") return;

      await PushNotifications.register();
      try {
        localStorage.setItem(`${state.nativePushRegisteredKey}:${tenantKey}:${userId}`, "1");
      } catch {
        // ignore storage failures
      }
    } catch (error) {
      if (!cancelled) console.warn("[native push register]", error?.message || error);
    } finally {
      state.nativePushRegisteringRef.current = false;
    }
  }

  void registerForNativePush();
  return () => {
    cancelled = true;
  };
}
