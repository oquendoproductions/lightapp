import { fetchOpenAbuseFlagSummary } from "./mapAbuseFlagSummarySupport";

const OPEN_ABUSE_FLAG_SUMMARY_CACHE_KEY = "cityreport_open_abuse_flag_summary_v1";

function normalizeCachedOpenAbuseFlagSummaryShared(value) {
  if (!value || typeof value !== "object") return null;
  return {
    total: Math.max(0, Number(value.total || 0)),
    maxSeverity: Math.max(0, Number(value.maxSeverity || 0)),
  };
}

export function readCachedOpenAbuseFlagSummaryShared() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(OPEN_ABUSE_FLAG_SUMMARY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedSummary = parsed && typeof parsed === "object" && parsed.summary
      ? parsed.summary
      : parsed;
    return normalizeCachedOpenAbuseFlagSummaryShared(cachedSummary);
  } catch {
    return null;
  }
}

export function writeCachedOpenAbuseFlagSummaryShared(summary) {
  if (typeof window === "undefined") return;
  try {
    const normalizedSummary = normalizeCachedOpenAbuseFlagSummaryShared(summary);
    if (!normalizedSummary) {
      window.localStorage.removeItem(OPEN_ABUSE_FLAG_SUMMARY_CACHE_KEY);
      return;
    }
    window.localStorage.setItem(OPEN_ABUSE_FLAG_SUMMARY_CACHE_KEY, JSON.stringify({
      summary: normalizedSummary,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}

export function openRateLimitNoticeRuntimeShared(openNoticeFn, abuseGate, deps = {}) {
  const abuseWindowMs = Number.isFinite(Number(deps?.abuseWindowMs))
    ? Number(deps.abuseWindowMs)
    : 60000;
  const waitMins = Math.max(1, Math.ceil((abuseGate?.retryAfterMs || abuseWindowMs) / 60000));
  const hitLightCap = Number(abuseGate?.remainingUnits) <= 0;
  const body = hitLightCap
    ? `Too many reported lights in a short window. Please wait about ${waitMins} minute${waitMins === 1 ? "" : "s"} and try again.`
    : `Too many submissions. Please wait about ${waitMins} minute${waitMins === 1 ? "" : "s"} and try again.`;
  if (typeof openNoticeFn === "function") {
    openNoticeFn("⏳", "Rate limited", body);
  }
}

export async function registerAbuseEventWithServerRuntimeShared(args = {}, deps = {}) {
  const normalizeEmail =
    typeof deps?.normalizeEmail === "function"
      ? deps.normalizeEmail
      : (value) => String(value || "").trim().toLowerCase();
  const normalizePhone =
    typeof deps?.normalizePhone === "function"
      ? deps.normalizePhone
      : (value) => String(value || "").trim();
  const reporterIdentityKey =
    typeof deps?.reporterIdentityKey === "function"
      ? deps.reporterIdentityKey
      : () => "";
  const normalizeDomainKeyOrSlug =
    typeof deps?.normalizeDomainKeyOrSlug === "function"
      ? deps.normalizeDomainKeyOrSlug
      : (value) => String(value || "").trim().toLowerCase();
  const activeTenantKey =
    typeof deps?.activeTenantKey === "function"
      ? deps.activeTenantKey
      : () => "";
  const supabase = deps?.supabase;
  const abuseGateFunction = String(deps?.abuseGateFunction || "").trim();
  const abuseWindowMs = Number.isFinite(Number(deps?.abuseWindowMs))
    ? Number(deps.abuseWindowMs)
    : 60000;
  const abuseMaxEventsPerWindow = Number.isFinite(Number(deps?.abuseMaxEventsPerWindow))
    ? Number(deps.abuseMaxEventsPerWindow)
    : 6;
  const abuseMaxLightsPerWindow = Number.isFinite(Number(deps?.abuseMaxLightsPerWindow))
    ? Number(deps.abuseMaxLightsPerWindow)
    : abuseMaxEventsPerWindow;
  const abuseBackoffMaxMs = Number.isFinite(Number(deps?.abuseBackoffMaxMs))
    ? Number(deps.abuseBackoffMaxMs)
    : abuseWindowMs * 8;
  const logger = deps?.logger || console;
  const localStorageLike = deps?.localStorageLike || globalThis?.localStorage;

  const loadAbuseRateFromStorage = () => {
    try {
      const raw = localStorageLike?.getItem?.(String(deps?.abuseRateKey || ""));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch {
      return {};
    }
  };

  const saveAbuseRateToStorage = (value) => {
    try {
      localStorageLike?.setItem?.(String(deps?.abuseRateKey || ""), JSON.stringify(value || {}));
    } catch {
      // ignore
    }
  };

  const loadAbuseBackoffFromStorage = () => {
    try {
      const raw = localStorageLike?.getItem?.(String(deps?.abuseBackoffKey || ""));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      return parsed;
    } catch {
      return {};
    }
  };

  const saveAbuseBackoffToStorage = (value) => {
    try {
      localStorageLike?.setItem?.(String(deps?.abuseBackoffKey || ""), JSON.stringify(value || {}));
    } catch {
      // ignore
    }
  };

  const nextAbuseBackoffMs = (identityKey, retryAfterMs = abuseWindowMs) => {
    const now = Date.now();
    const key = String(identityKey || "").trim();
    if (!key) return Math.max(1000, Number(retryAfterMs) || abuseWindowMs);
    const base = Math.max(1000, Number(retryAfterMs) || abuseWindowMs);
    const map = loadAbuseBackoffFromStorage();
    const prev = Number(map[key] || 0);
    const next = Math.min(abuseBackoffMaxMs, prev > 0 ? prev * 2 : base);
    map[key] = next;
    map[`${key}:updated_at`] = now;
    saveAbuseBackoffToStorage(map);
    return next;
  };

  const clearAbuseBackoff = (identityKey) => {
    const key = String(identityKey || "").trim();
    if (!key) return;
    const map = loadAbuseBackoffFromStorage();
    delete map[key];
    delete map[`${key}:updated_at`];
    saveAbuseBackoffToStorage(map);
  };

  const logAbuseEventAttempt = async (payload) => {
    try {
      const tenantKey = activeTenantKey();
      await supabase?.from?.("abuse_events")?.insert?.([{
        tenant_key: tenantKey,
        domain: String(payload?.domain || "streetlights"),
        identity_hash: payload?.identity_hash || null,
        ip_hash: payload?.ip_hash || null,
        event_kind: String(payload?.event_kind || "submission_attempt"),
        allowed: Boolean(payload?.allowed),
        event_count: Math.max(1, Number(payload?.event_count || 1)),
        unit_count: Math.max(1, Number(payload?.unit_count || 1)),
        reason: payload?.reason ? String(payload.reason) : null,
        metadata: payload?.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
        created_at: new Date().toISOString(),
      }]);
    } catch {
      // non-blocking telemetry
    }
  };

  const registerAbuseEvent = ({
    session,
    profile,
    guestInfo,
    domain = "streetlights",
    count = 1,
    bypass = false,
  }) => {
    if (bypass) return { allowed: true, remaining: abuseMaxEventsPerWindow };
    const identity = reporterIdentityKey({ session, profile, guestInfo });
    if (!identity) return { allowed: true, remaining: abuseMaxEventsPerWindow };

    const now = Date.now();
    const safeCount = Math.max(1, Math.trunc(Number(count) || 1));
    const key = `${identity}::${normalizeDomainKeyOrSlug(domain, { allowUnknown: true }) || "streetlights"}`;
    const buckets = loadAbuseRateFromStorage();
    const windowStart = now - abuseWindowMs;
    const prev = Array.isArray(buckets[key]) ? buckets[key] : [];
    const active = prev.filter((x) => Number.isFinite(Number(x?.ts)) && Number(x.ts) >= windowStart);
    const used = active.reduce((acc, x) => acc + Math.max(1, Math.trunc(Number(x?.count) || 1)), 0);

    if (used + safeCount > abuseMaxEventsPerWindow) {
      const backoffMs = nextAbuseBackoffMs(key, abuseWindowMs - (now - Number(active[0]?.ts || now)));
      void logAbuseEventAttempt({
        domain: normalizeDomainKeyOrSlug(domain, { allowUnknown: true }) || "streetlights",
        identity_hash: identity,
        event_kind: "rate_limit_block_local",
        allowed: false,
        event_count: safeCount,
        unit_count: safeCount,
        reason: "local_event_cap",
        metadata: { used, cap: abuseMaxEventsPerWindow, retry_after_ms: backoffMs },
      });
      return {
        allowed: false,
        remaining: Math.max(0, abuseMaxEventsPerWindow - used),
        retryAfterMs: backoffMs,
      };
    }

    const nextActive = [...active, { ts: now, count: safeCount }];
    buckets[key] = nextActive;
    saveAbuseRateToStorage(buckets);
    clearAbuseBackoff(key);
    return {
      allowed: true,
      remaining: Math.max(0, abuseMaxEventsPerWindow - (used + safeCount)),
    };
  };

  const {
    session,
    profile,
    guestInfo,
    domain = "streetlights",
    count = 1,
    unitCount = 1,
    idempotencyKey = "",
    bypass = false,
  } = args || {};

  const effectiveBypass = false;
  const identity = {
    user_id: session?.user?.id || null,
    email: normalizeEmail(guestInfo?.email || profile?.email || session?.user?.email || "") || null,
    phone: normalizePhone(guestInfo?.phone || profile?.phone || "") || null,
    name: String(guestInfo?.name || profile?.full_name || session?.user?.user_metadata?.full_name || "").trim() || null,
  };
  const identityKey = reporterIdentityKey({ session, profile, guestInfo });
  const normalizedDomain = normalizeDomainKeyOrSlug(domain, { allowUnknown: true }) || "streetlights";
  const tenantKey = activeTenantKey();

  try {
    const { data, error } = await supabase.functions.invoke(abuseGateFunction, {
      body: {
        tenant_key: tenantKey,
        domain: normalizedDomain,
        count: Math.max(1, Math.trunc(Number(count) || 1)),
        unitCount: Math.max(1, Math.trunc(Number(unitCount) || 1)),
        idempotency_key: String(idempotencyKey || "").trim() || null,
        windowMs: abuseWindowMs,
        maxEvents: abuseMaxEventsPerWindow,
        maxUnits: abuseMaxLightsPerWindow,
        identity,
      },
    });

    if (!error && data && typeof data === "object") {
      if (data.allowed === false) {
        const retryAfterMsRaw = Number.isFinite(Number(data.retryAfterMs))
          ? Number(data.retryAfterMs)
          : abuseWindowMs;
        const retryAfterMs = nextAbuseBackoffMs(identityKey, retryAfterMsRaw);
        void logAbuseEventAttempt({
          domain: normalizedDomain,
          identity_hash: identityKey || null,
          event_kind: "rate_limit_block_server",
          allowed: false,
          event_count: Math.max(1, Math.trunc(Number(count) || 1)),
          unit_count: Math.max(1, Math.trunc(Number(unitCount) || 1)),
          reason: "server_gate_denied",
          metadata: {
            remaining: Number(data.remaining || 0),
            remaining_units: Number(data.remainingUnits || 0),
            retry_after_ms: retryAfterMs,
          },
        });
        return {
          allowed: false,
          remaining: Number.isFinite(Number(data.remaining)) ? Number(data.remaining) : 0,
          remainingUnits: Number.isFinite(Number(data.remainingUnits))
            ? Number(data.remainingUnits)
            : 0,
          retryAfterMs,
        };
      }
      if (data.allowed === true) {
        clearAbuseBackoff(identityKey);
        return {
          allowed: true,
          duplicate: Boolean(data.duplicate),
          remaining: Number.isFinite(Number(data.remaining))
            ? Number(data.remaining)
            : abuseMaxEventsPerWindow,
          remainingUnits: Number.isFinite(Number(data.remainingUnits))
            ? Number(data.remainingUnits)
            : abuseMaxLightsPerWindow,
        };
      }
    } else if (error) {
      logger.warn("[abuse gate] server function error, using local fallback:", error?.message || error);
    }
  } catch (error) {
    logger.warn("[abuse gate] server function exception, using local fallback:", error?.message || error);
  }

  return registerAbuseEvent({
    session,
    profile,
    guestInfo,
    domain,
    count,
    bypass: effectiveBypass || bypass,
  });
}

export async function refreshOpenAbuseFlagSummaryRuntimeShared({
  isAdmin,
  supabase,
  setOpenAbuseFlagSummary,
  writeCachedOpenAbuseFlagSummary,
  abuseFlagBannerShownRef,
  silent = true,
  isExpectedPermissionError,
}) {
  if (!isAdmin) {
    setOpenAbuseFlagSummary({ total: 0, maxSeverity: 0 });
    if (abuseFlagBannerShownRef) abuseFlagBannerShownRef.current = false;
    return;
  }

  try {
    const nextSummary = await fetchOpenAbuseFlagSummary({ supabaseClient: supabase });
    setOpenAbuseFlagSummary(nextSummary);
    writeCachedOpenAbuseFlagSummary(nextSummary);

    if (nextSummary.total > 0 && abuseFlagBannerShownRef && !abuseFlagBannerShownRef.current) {
      abuseFlagBannerShownRef.current = true;
    } else if (nextSummary.total === 0 && abuseFlagBannerShownRef) {
      abuseFlagBannerShownRef.current = false;
    }
  } catch (error) {
    if (!silent && !isExpectedPermissionError(error)) {
      console.warn("[abuse flags]", error?.message || error);
    }
  }
}
