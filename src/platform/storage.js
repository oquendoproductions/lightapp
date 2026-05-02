const localFallbackStore = new Map();
const sessionFallbackStore = new Map();

function readStorageArea(areaName) {
  try {
    return globalThis?.[areaName] || null;
  } catch {
    return null;
  }
}

function getFallbackStore(areaName) {
  return areaName === "sessionStorage" ? sessionFallbackStore : localFallbackStore;
}

function readStorageItem(areaName, key) {
  const storage = readStorageArea(areaName);
  const fallback = getFallbackStore(areaName);
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return null;
  try {
    const raw = storage?.getItem?.(normalizedKey);
    if (raw != null) {
      fallback.set(normalizedKey, raw);
      return raw;
    }
  } catch {
    // ignore and fall through to memory
  }
  return fallback.has(normalizedKey) ? fallback.get(normalizedKey) : null;
}

function writeStorageItem(areaName, key, value) {
  const storage = readStorageArea(areaName);
  const fallback = getFallbackStore(areaName);
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return;
  const normalizedValue = String(value ?? "");
  fallback.set(normalizedKey, normalizedValue);
  try {
    storage?.setItem?.(normalizedKey, normalizedValue);
  } catch {
    // ignore
  }
}

function removeStorageItem(areaName, key) {
  const storage = readStorageArea(areaName);
  const fallback = getFallbackStore(areaName);
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) return;
  fallback.delete(normalizedKey);
  try {
    storage?.removeItem?.(normalizedKey);
  } catch {
    // ignore
  }
}

export function readLocalStorageItem(key) {
  return readStorageItem("localStorage", key);
}

export function writeLocalStorageItem(key, value) {
  writeStorageItem("localStorage", key, value);
}

export function removeLocalStorageItem(key) {
  removeStorageItem("localStorage", key);
}

export function readSessionStorageItem(key) {
  return readStorageItem("sessionStorage", key);
}

export function writeSessionStorageItem(key, value) {
  writeStorageItem("sessionStorage", key, value);
}

export function removeSessionStorageItem(key) {
  removeStorageItem("sessionStorage", key);
}
