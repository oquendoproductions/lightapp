const USER_PROFILE_CACHE_KEY = "cityreport_public_user_profile_v1";
const USER_ADMIN_FLAG_CACHE_KEY = "cityreport_public_user_admin_flag_v1";
const USER_REPORT_ACCESS_CACHE_KEY = "cityreport_public_user_report_access_v1";

function userProfileCacheStorageKeyShared(userId) {
  const normalizedUserId = String(userId || "").trim().toLowerCase();
  if (!normalizedUserId) return "";
  return `${USER_PROFILE_CACHE_KEY}:${normalizedUserId}`;
}

function userAdminFlagCacheStorageKeyShared(userId) {
  const normalizedUserId = String(userId || "").trim().toLowerCase();
  if (!normalizedUserId) return "";
  return `${USER_ADMIN_FLAG_CACHE_KEY}:${normalizedUserId}`;
}

function userReportAccessCacheStorageKeyShared(userId, tenantKey) {
  const normalizedUserId = String(userId || "").trim().toLowerCase();
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  if (!normalizedUserId || !normalizedTenantKey) return "";
  return `${USER_REPORT_ACCESS_CACHE_KEY}:${normalizedUserId}:${normalizedTenantKey}`;
}

export function normalizeCachedUserProfileShared(profile) {
  if (!profile || typeof profile !== "object") return null;
  const fullName = String(profile?.full_name || "").trim() || null;
  const phone = String(profile?.phone || "").trim() || null;
  const email = String(profile?.email || "").trim() || null;
  if (!fullName && !phone && !email) return null;
  return {
    full_name: fullName,
    phone,
    email,
  };
}

export function readCachedUserProfileShared(userId) {
  if (typeof window === "undefined") return null;
  const storageKey = userProfileCacheStorageKeyShared(userId);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedProfile = parsed && typeof parsed === "object" && parsed.profile
      ? parsed.profile
      : parsed;
    return normalizeCachedUserProfileShared(cachedProfile);
  } catch {
    return null;
  }
}

export function writeCachedUserProfileShared(userId, profile) {
  if (typeof window === "undefined") return;
  const storageKey = userProfileCacheStorageKeyShared(userId);
  if (!storageKey) return;
  try {
    const normalizedProfile = normalizeCachedUserProfileShared(profile);
    if (!normalizedProfile) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify({
      profile: normalizedProfile,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}

export function clearCachedUserProfileShared(userId) {
  if (typeof window === "undefined") return;
  const storageKey = userProfileCacheStorageKeyShared(userId);
  if (!storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore cache clear failures
  }
}

export function readCachedUserAdminFlagShared(userId) {
  if (typeof window === "undefined") return null;
  const storageKey = userAdminFlagCacheStorageKeyShared(userId);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.isAdmin === "boolean") {
      return parsed.isAdmin;
    }
    if (typeof parsed === "boolean") return parsed;
    return null;
  } catch {
    return null;
  }
}

export function writeCachedUserAdminFlagShared(userId, isAdmin) {
  if (typeof window === "undefined") return;
  const storageKey = userAdminFlagCacheStorageKeyShared(userId);
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({
      isAdmin: Boolean(isAdmin),
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}

export function normalizeCachedUserReportAccessShared(value) {
  if (!value || typeof value !== "object") return null;
  return {
    canAccessAdminReports: value.canAccessAdminReports === true,
    canAccessDomainReports: value.canAccessDomainReports === true,
    canEditDomainReports: value.canEditDomainReports === true,
  };
}

export function readCachedUserReportAccessShared(userId, tenantKey) {
  if (typeof window === "undefined") return null;
  const storageKey = userReportAccessCacheStorageKeyShared(userId, tenantKey);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedAccess = parsed && typeof parsed === "object" && parsed.access
      ? parsed.access
      : parsed;
    return normalizeCachedUserReportAccessShared(cachedAccess);
  } catch {
    return null;
  }
}

export function writeCachedUserReportAccessShared(userId, tenantKey, access) {
  if (typeof window === "undefined") return;
  const storageKey = userReportAccessCacheStorageKeyShared(userId, tenantKey);
  if (!storageKey) return;
  try {
    const normalizedAccess = normalizeCachedUserReportAccessShared(access);
    if (!normalizedAccess) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, JSON.stringify({
      access: normalizedAccess,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}
