const DEFAULT_TENANT_KEY = "ashtabulacity";
const TENANT_STORAGE_KEY = "cityreport.active_tenant_key";

function sanitizeTenantKey(raw) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return key || "";
}

export function getDefaultTenantKey() {
  return DEFAULT_TENANT_KEY;
}

export function getRuntimeTenantKey() {
  try {
    const fromWindow = sanitizeTenantKey(globalThis?.__CITYREPORT_TENANT_KEY);
    if (fromWindow) return fromWindow;
  } catch {
    // ignore
  }

  try {
    const fromStorage = sanitizeTenantKey(globalThis?.localStorage?.getItem(TENANT_STORAGE_KEY));
    if (fromStorage) return fromStorage;
  } catch {
    // ignore
  }

  return DEFAULT_TENANT_KEY;
}

export function setRuntimeTenantKey(rawTenantKey) {
  const next = sanitizeTenantKey(rawTenantKey) || DEFAULT_TENANT_KEY;
  try {
    globalThis.__CITYREPORT_TENANT_KEY = next;
  } catch {
    // ignore
  }
  try {
    globalThis.localStorage?.setItem(TENANT_STORAGE_KEY, next);
  } catch {
    // ignore
  }
  return next;
}
