const TENANT_PARKS_CACHE_KEY = "cityreport_tenant_parks_v1";

function isExpectedTenantParkError(error) {
  const errCode = String(error?.code || "").trim();
  const errMsg = String(error?.message || "").trim();
  return (
    errCode === "42P01"
    || errCode === "42501"
    || /does not exist|relation|schema cache|permission denied|forbidden/i.test(errMsg)
  );
}

function tenantParksCacheStorageKeyShared(tenantKey) {
  const normalizedTenantKey = String(tenantKey || "").trim().toLowerCase();
  if (!normalizedTenantKey) return "";
  return `${TENANT_PARKS_CACHE_KEY}:${normalizedTenantKey}`;
}

export function normalizeCachedTenantParksShared(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: row?.id ?? null,
      tenant_key: String(row?.tenant_key || "").trim().toLowerCase(),
      park_key: String(row?.park_key || "").trim(),
      park_name: String(row?.park_name || "").trim(),
      boundary_geojson: row?.boundary_geojson ?? null,
      border_color: String(row?.border_color || "").trim(),
      border_width: row?.border_width ?? null,
      fill_color: String(row?.fill_color || "").trim(),
      fill_opacity: row?.fill_opacity ?? null,
      label_color: String(row?.label_color || "").trim(),
      show_label: row?.show_label !== false,
      label_lat: row?.label_lat ?? null,
      label_lng: row?.label_lng ?? null,
      sort_order: row?.sort_order ?? null,
      active: row?.active !== false,
    }));
}

export function readCachedTenantParksShared(tenantKey) {
  if (typeof window === "undefined") return null;
  const storageKey = tenantParksCacheStorageKeyShared(tenantKey);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const cachedRows = parsed && typeof parsed === "object" && Array.isArray(parsed.rows)
      ? parsed.rows
      : parsed;
    return normalizeCachedTenantParksShared(cachedRows);
  } catch {
    return null;
  }
}

export function writeCachedTenantParksShared(tenantKey, rows) {
  if (typeof window === "undefined") return;
  const storageKey = tenantParksCacheStorageKeyShared(tenantKey);
  if (!storageKey) return;
  try {
    const normalizedRows = normalizeCachedTenantParksShared(rows);
    window.localStorage.setItem(storageKey, JSON.stringify({
      rows: normalizedRows,
      cachedAt: new Date().toISOString(),
    }));
  } catch {
    // ignore cache write failures
  }
}

export async function loadTenantParksShared({
  authReady,
  tenantKey,
  readCachedTenantParks = readCachedTenantParksShared,
  normalizeCachedTenantParks = normalizeCachedTenantParksShared,
  tenantScopedReadClient,
  createTenantScopedReadClient,
  supabase,
  setTenantParks,
  setTenantParksLoaded,
  writeCachedTenantParks = writeCachedTenantParksShared,
}) {
  if (!authReady) return [];
  if (!tenantKey) {
    setTenantParks([]);
    setTenantParksLoaded(true);
    return [];
  }

  const cachedParks = readCachedTenantParks(tenantKey);
  if (!cachedParks) {
    setTenantParksLoaded(false);
  }

  const readClient = tenantScopedReadClient || createTenantScopedReadClient(tenantKey) || supabase;
  const { data, error } = await readClient
    .from("tenant_parks")
    .select("id,tenant_key,park_key,park_name,boundary_geojson,border_color,border_width,fill_color,fill_opacity,label_color,show_label,label_lat,label_lng,sort_order,active")
    .eq("tenant_key", tenantKey)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("park_name", { ascending: true });

  if (error) {
    if (!isExpectedTenantParkError(error)) {
      console.warn("[tenant_parks]", String(error?.message || "").trim() || error);
    }
    setTenantParks([]);
    setTenantParksLoaded(true);
    writeCachedTenantParks(tenantKey, []);
    return [];
  }

  const normalizedRows = normalizeCachedTenantParks(data);
  setTenantParks(normalizedRows);
  setTenantParksLoaded(true);
  writeCachedTenantParks(tenantKey, normalizedRows);
  return normalizedRows;
}

export async function loadTenantParksRuntimeShared({
  promiseRef,
  authReady,
  tenantKey,
  readCachedTenantParks = readCachedTenantParksShared,
  normalizeCachedTenantParks = normalizeCachedTenantParksShared,
  tenantScopedReadClient,
  createTenantScopedReadClient,
  supabase,
  setTenantParks,
  setTenantParksLoaded,
  writeCachedTenantParks = writeCachedTenantParksShared,
}) {
  if (promiseRef?.current) {
    return promiseRef.current;
  }
  const nextPromise = loadTenantParksShared({
    authReady,
    tenantKey,
    readCachedTenantParks,
    normalizeCachedTenantParks,
    tenantScopedReadClient,
    createTenantScopedReadClient,
    supabase,
    setTenantParks,
    setTenantParksLoaded,
    writeCachedTenantParks,
  });
  if (promiseRef) {
    promiseRef.current = nextPromise;
  }
  try {
    return await nextPromise;
  } finally {
    if (promiseRef?.current === nextPromise) {
      promiseRef.current = null;
    }
  }
}

export function scheduleTenantParksLoadRuntimeShared(state = {}) {
  let cancelled = false;
  let idleHandle = null;
  let timeoutHandle = null;

  const runLoad = async () => {
    try {
      await state.loadTenantParksNow?.();
    } catch {
      // loadTenantParksNow handles logging/state fallback
    }
  };

  const idleTimeoutMs = state.idleTimeoutMs ?? 1200;
  const fallbackDelayMs = state.fallbackDelayMs ?? 280;

  if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
    idleHandle = window.requestIdleCallback(() => {
      idleHandle = null;
      if (!cancelled) void runLoad();
    }, { timeout: idleTimeoutMs });
  } else if (typeof window !== "undefined") {
    timeoutHandle = window.setTimeout(() => {
      timeoutHandle = null;
      if (!cancelled) void runLoad();
    }, fallbackDelayMs);
  } else {
    void runLoad();
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
