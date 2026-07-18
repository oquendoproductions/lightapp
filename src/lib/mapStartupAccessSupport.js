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
