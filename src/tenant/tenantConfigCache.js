import {
  readSessionStorageItem,
  removeSessionStorageItem,
  writeSessionStorageItem,
} from "../platform/storage.js";

const CACHE_PREFIX = "cityreport.tenant_config.v1";
const memoryCache = new Map();

function keyFor(tenantKey) {
  return `${CACHE_PREFIX}:${String(tenantKey || "").trim().toLowerCase()}`;
}

function nowMs() {
  return Date.now();
}

function isFresh(record) {
  if (!record || typeof record !== "object") return false;
  const expiresAt = Number(record.expiresAt || 0);
  return Number.isFinite(expiresAt) && expiresAt > nowMs();
}

function readSessionRecord(cacheKey) {
  try {
    const raw = readSessionStorageItem(cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeSessionRecord(cacheKey, value, ttlMs) {
  try {
    const expiresAt = nowMs() + Math.max(1000, Number(ttlMs) || 300000);
    writeSessionStorageItem(
      cacheKey,
      JSON.stringify({
        value,
        expiresAt,
      })
    );
  } catch {
    // ignore
  }
}

function shouldCacheValue(value) {
  if (!value || typeof value !== "object") return false;
  if (value.active === false) return false;
  return true;
}

export async function loadTenantConfigCached(tenantKey, fetcher, opts = {}) {
  const ttlMs = Math.max(1000, Number(opts.ttlMs) || 300000);
  const cacheKey = keyFor(tenantKey);

  const memRecord = memoryCache.get(cacheKey);
  if (isFresh(memRecord) && shouldCacheValue(memRecord.value)) {
    return memRecord.value;
  }
  if (memRecord && !shouldCacheValue(memRecord.value)) {
    memoryCache.delete(cacheKey);
  }

  const sessionRecord = readSessionRecord(cacheKey);
  if (isFresh(sessionRecord) && shouldCacheValue(sessionRecord.value)) {
    memoryCache.set(cacheKey, sessionRecord);
    return sessionRecord.value;
  }
  if (sessionRecord && !shouldCacheValue(sessionRecord.value)) {
    try {
      removeSessionStorageItem(cacheKey);
    } catch {
      // ignore
    }
  }

  const value = await fetcher();

  if (!shouldCacheValue(value)) {
    // Keep missing/inactive tenant checks fresh so newly configured tenants become available on refresh.
    clearTenantConfigCache(tenantKey);
    return value;
  }

  const record = {
    value,
    expiresAt: nowMs() + ttlMs,
  };
  memoryCache.set(cacheKey, record);
  writeSessionRecord(cacheKey, value, ttlMs);
  return value;
}

export function clearTenantConfigCache(tenantKey) {
  const cacheKey = keyFor(tenantKey);
  memoryCache.delete(cacheKey);
  try {
    removeSessionStorageItem(cacheKey);
  } catch {
    // ignore
  }
}
