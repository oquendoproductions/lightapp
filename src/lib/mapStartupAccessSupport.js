export function shouldWaitForAuthenticatedMapAccessShared({
  authReady = false,
  sessionUserId = "",
  adminStateResolved = false,
  reportAccessResolved = false,
} = {}) {
  return Boolean(
    authReady
    && String(sessionUserId || "").trim()
    && (!adminStateResolved || !reportAccessResolved)
  );
}

export function isMapReadAccessReadyShared({
  authReady = false,
  shouldWaitForAuth = false,
  waitingForReportAccess = false,
} = {}) {
  return Boolean((authReady || !shouldWaitForAuth) && !waitingForReportAccess);
}

export function isIncidentMapSnapshotReadyShared({
  incidentLayerActive = false,
  publicReadAccessReady = false,
  waitingForTenantDomainConfig = false,
  tenantDomainConfigLoaded = false,
  loading = false,
  hasCompleteCachedSnapshot = false,
  pendingConfiguredDomainCount = 0,
  pendingPersistedStateDomainCount = 0,
} = {}) {
  if (!incidentLayerActive) return true;
  return Boolean(
    publicReadAccessReady
    && !waitingForTenantDomainConfig
    && tenantDomainConfigLoaded
    && (!loading || hasCompleteCachedSnapshot)
    && Number(pendingConfiguredDomainCount || 0) === 0
    && Number(pendingPersistedStateDomainCount || 0) === 0
  );
}

export function shouldHydratePublicMapCoreCacheShared({
  tenantKey = "",
  reportsAdminView = false,
  authReady = false,
  sessionUserId = "",
  waitingForReportAccess = false,
} = {}) {
  return Boolean(
    String(tenantKey || "").trim()
    && !reportsAdminView
    && authReady
    && !String(sessionUserId || "").trim()
    && !waitingForReportAccess
  );
}

function hasRows(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some((rows) => Array.isArray(rows) && rows.length > 0);
}

export function hasRenderableMapRuntimeDataShared({
  reports = [],
  officialLights = [],
  sharedIncidentMarkersByDomain = {},
  configuredIncidentSeededRowsByDomain = {},
  configuredIncidentReportRowsByDomain = {},
} = {}) {
  return Boolean(
    hasRows(reports)
    || hasRows(officialLights)
    || hasRows(sharedIncidentMarkersByDomain)
    || hasRows(configuredIncidentSeededRowsByDomain)
    || hasRows(configuredIncidentReportRowsByDomain)
  );
}
