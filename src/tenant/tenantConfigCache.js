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
    const raw = globalThis?.sessionStorage?.getItem(cacheKey);
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
    globalThis?.sessionStorage?.setItem(
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

export async function loadTenantConfigCached(tenantKey, fetcher, opts = {}) {
  const ttlMs = Math.max(1000, Number(opts.ttlMs) || 300000);
  const cacheKey = keyFor(tenantKey);

  const memRecord = memoryCache.get(cacheKey);
  if (isFresh(memRecord)) return memRecord.value;

  const sessionRecord = readSessionRecord(cacheKey);
  if (isFresh(sessionRecord)) {
    memoryCache.set(cacheKey, sessionRecord);
    return sessionRecord.value;
  }

  const value = await fetcher();
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
    globalThis?.sessionStorage?.removeItem(cacheKey);
  } catch {
    // ignore
  }
}
