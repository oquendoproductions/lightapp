import { isNativeAppRuntime } from "../platform/runtime.js";
import { readLocalStorageItem, writeLocalStorageItem } from "../platform/storage.js";

const DEFAULT_TENANT_KEY = "ashtabulacity";
const TENANT_STORAGE_KEY = "cityreport.active_tenant_key";

function sanitizeTenantKey(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return key || "";
}

export function getConfiguredNativeTenantKey() {
  if (!isNativeAppRuntime()) return "";
  return sanitizeTenantKey(import.meta.env.VITE_NATIVE_TENANT_KEY || import.meta.env.VITE_MOBILE_TENANT_KEY || "");
}

export function hasConfiguredNativeTenantKey() {
  return Boolean(getConfiguredNativeTenantKey());
}

export function getPersistedRuntimeTenantKey() {
  try {
    const fromWindow = sanitizeTenantKey(globalThis?.__CITYREPORT_TENANT_KEY);
    if (fromWindow) return fromWindow;
  } catch {
    // ignore
  }

  try {
    const fromStorage = sanitizeTenantKey(readLocalStorageItem(TENANT_STORAGE_KEY));
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }

  return "";
}

export function hasPersistedRuntimeTenantKey() {
  return Boolean(getPersistedRuntimeTenantKey());
}

export function getDefaultTenantKey() {
  return getConfiguredNativeTenantKey() || DEFAULT_TENANT_KEY;
}

export function getRuntimeTenantKey() {
  const persisted = getPersistedRuntimeTenantKey();
  if (persisted) return persisted;

  return getConfiguredNativeTenantKey() || DEFAULT_TENANT_KEY;
}

export function setRuntimeTenantKey(rawTenantKey) {
  const next = sanitizeTenantKey(rawTenantKey) || getConfiguredNativeTenantKey() || DEFAULT_TENANT_KEY;
  try {
    globalThis.__CITYREPORT_TENANT_KEY = next;
  } catch {
    // ignore
  }
  try {
    writeLocalStorageItem(TENANT_STORAGE_KEY, next);
  } catch {
    // ignore
  }
  return next;
}
