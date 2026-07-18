export function shouldWaitForAuthenticatedReportAccessShared({
  authReady = false,
  sessionUserId = "",
  reportAccessResolved = false,
} = {}) {
  return Boolean(authReady && String(sessionUserId || "").trim() && !reportAccessResolved);
}

export function isMapReadAccessReadyShared({
  authReady = false,
  shouldWaitForAuth = false,
  waitingForReportAccess = false,
} = {}) {
  return Boolean((authReady || !shouldWaitForAuth) && !waitingForReportAccess);
}

export function shouldHydratePublicMapCoreCacheShared({
  tenantKey = "",
  reportsAdminView = false,
  shouldHydrateAuthEagerly = false,
  authReady = false,
  waitingForReportAccess = false,
} = {}) {
  return Boolean(
    String(tenantKey || "").trim()
    && !reportsAdminView
    && !(shouldHydrateAuthEagerly && !authReady)
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
