import { summarizeIncidentRowsAfterFixWindowShared } from "./mapIncidentPopupRowSupport.js";
import { resolveIncidentMarkerLookupIdShared } from "./mapIncidentDomainHelperSupport.js";

function resolvePopupRowsShared(domainKey, marker, deps = {}) {
  const {
    getIncidentDomainHelper,
    normalizeDomainKeyOrSlug,
    resolveIncidentDrivenCandidateRows,
    resolveIncidentDrivenFixTsForId,
    resolveIncidentDrivenScopedIncidentIds,
  } = deps;
  if (
    typeof getIncidentDomainHelper !== "function"
    || typeof normalizeDomainKeyOrSlug !== "function"
    || typeof resolveIncidentDrivenCandidateRows !== "function"
    || typeof resolveIncidentDrivenFixTsForId !== "function"
    || typeof resolveIncidentDrivenScopedIncidentIds !== "function"
  ) {
    return null;
  }

  const markerId = resolveIncidentMarkerLookupIdShared(domainKey, marker, "", {
    getIncidentDomainHelper,
    normalizeDomainKeyOrSlug,
  });
  const markerRows = Array.isArray(marker?.rows) ? [...marker.rows] : [];
  let { incidentId, incidentIds } = resolveIncidentDrivenScopedIncidentIds(domainKey, {
    marker,
    markerRows,
    markerId,
    fallbackIncidentId: String(marker?.incident_id || markerId).trim(),
  });
  if (!incidentId) return null;

  incidentIds = Array.from(new Set([
    incidentId,
    markerId,
    ...incidentIds,
    ...markerRows.map((row) => String(row?.incident_id || row?.light_id || "").trim()),
  ].filter(Boolean)));

  const rowCandidates = resolveIncidentDrivenCandidateRows(domainKey, {
    markerRows,
    incidentIds,
    markerId,
    marker,
  });
  const { allRows, rows, latest, maxLastFixTs } = summarizeIncidentRowsAfterFixWindowShared(rowCandidates, {
    incidentIds,
    getFixTsForIncidentId: (id) => resolveIncidentDrivenFixTsForId(domainKey, id, marker),
    resolveRowIncidentId: (row, fallbackId) => String(row?.incident_id || row?.light_id || fallbackId).trim(),
    fallbackIncidentId: incidentId,
  });

  return {
    markerId,
    incidentId,
    incidentIds,
    allRows,
    rows,
    latest,
    maxLastFixTs,
  };
}

function resolvePopupLifecycleSnapshotShared(domainKeyRaw, context = {}) {
  const {
    getIncidentDomainHelper,
    getIncidentSnapshot,
    incidentSnapshotCandidateDomains,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
  } = context;
  if (
    typeof getIncidentDomainHelper !== "function"
    || typeof getIncidentSnapshot !== "function"
    || typeof incidentSnapshotCandidateDomains !== "function"
    || typeof normalizeDomainKey !== "function"
    || typeof normalizeDomainKeyOrSlug !== "function"
  ) {
    return null;
  }

  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return null;
  const helper = getIncidentDomainHelper(domainKey);
  const candidateIncidentIds = Array.from(new Set([
    String(context?.incidentId || "").trim(),
    ...(Array.isArray(context?.incidentIds) ? context.incidentIds : []),
  ].map((id) => String(id || "").trim()).filter(Boolean)));
  if (!candidateIncidentIds.length) return null;

  const candidateDomains = Array.from(new Set([
    domainKey,
    ...((Array.isArray(helper?.snapshotAliases) ? helper.snapshotAliases : [])
      .map((alias) => normalizeDomainKeyOrSlug(alias, { allowUnknown: true }) || normalizeDomainKey(alias))
      .filter(Boolean)),
    ...candidateIncidentIds.flatMap((incidentId) => incidentSnapshotCandidateDomains(domainKey, incidentId)),
  ]));

  return candidateDomains
    .flatMap((candidateDomainKey) => candidateIncidentIds.map((incidentId) => ({
      incidentId,
      domainKey: candidateDomainKey,
      snap: getIncidentSnapshot(candidateDomainKey, incidentId),
    })))
    .map((entry) => ({
      ...entry,
      ts: Date.parse(String(entry?.snap?.last_changed_at || "")) || 0,
    }))
    .sort((a, b) => b.ts - a.ts)
    .find((entry) => Boolean(entry?.snap))
    ?.snap || null;
}

function resolvePopupIssueLabelShared(domainKeyRaw, incidentIdRaw, incidentIdsRaw = [], latestRow = null, deps = {}) {
  const {
    normalizeDomainKeyOrSlug,
    resolveConfiguredDomainIssueLabel,
    resolveIncidentDrivenPopupMetaContext,
    resolveIncidentIssueLabelForDomain,
  } = deps;
  if (
    typeof normalizeDomainKeyOrSlug !== "function"
    || typeof resolveIncidentIssueLabelForDomain !== "function"
    || typeof resolveConfiguredDomainIssueLabel !== "function"
    || typeof resolveIncidentDrivenPopupMetaContext !== "function"
  ) {
    return "";
  }

  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return "";

  const directIssueLabel = resolveIncidentIssueLabelForDomain(latestRow, domainKey);
  if (directIssueLabel) return directIssueLabel;

  const popupMeta = resolveIncidentDrivenPopupMetaContext(domainKey, incidentIdRaw, incidentIdsRaw);
  const popupIssueValue = String(
    popupMeta?.record?.issue_type
    || popupMeta?.record?.type
    || popupMeta?.record?.report_type
    || ""
  ).trim();
  if (!popupIssueValue) return "";

  return resolveConfiguredDomainIssueLabel(domainKey, popupIssueValue) || "";
}

export function buildSelectedIncidentPopupInfoShared(args = {}) {
  const {
    domainKeyRaw,
    marker,
    getIncidentDomainHelper,
    getIncidentSnapshot,
    incidentSnapshotCandidateDomains,
    isLifecycleStateOpen,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    reportIdentityKey,
    resolveConfiguredDomainIssueLabel,
    resolveIncidentDrivenCandidateRows,
    resolveIncidentDrivenFixTsForId,
    resolveIncidentDrivenPopupLocationContext,
    resolveIncidentDrivenPopupMetaContext,
    resolveIncidentDrivenScopedIncidentIds,
    resolveIncidentIssueLabelForDomain,
    resolveReportDomainLabel,
    resolveReportTypeOptionDetails,
    viewerIdentityKey,
  } = args;

  if (
    typeof normalizeDomainKeyOrSlug !== "function"
    || typeof resolveIncidentDrivenPopupLocationContext !== "function"
    || typeof resolveReportDomainLabel !== "function"
    || typeof resolveReportTypeOptionDetails !== "function"
    || typeof reportIdentityKey !== "function"
    || typeof isLifecycleStateOpen !== "function"
  ) {
    return null;
  }

  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey || domainKey === "streetlights" || !marker) return null;

  const popupSource = resolvePopupRowsShared(domainKey, marker, {
    getIncidentDomainHelper,
    normalizeDomainKeyOrSlug,
    resolveIncidentDrivenCandidateRows,
    resolveIncidentDrivenFixTsForId,
    resolveIncidentDrivenScopedIncidentIds,
  });
  if (!popupSource) return null;

  const {
    markerId,
    incidentId,
    incidentIds,
    allRows,
    rows,
    latest,
    maxLastFixTs,
  } = popupSource;
  const locationContext = resolveIncidentDrivenPopupLocationContext({
    domainKey,
    marker,
    markerId,
    incidentId,
    incidentIds,
    allRows,
    latest,
  });
  const displayId = String(locationContext?.displayId || "").trim() || incidentId || markerId || "Incident";
  const locationLabel = String(locationContext?.locationLabel || "").trim() || "Location unavailable";
  const locationDisplay = String(locationContext?.locationDisplay || "").trim() || "Location unavailable";
  const locationPending = Boolean(locationContext?.locationPending);
  const nearestAddress = String(locationContext?.nearestAddress || "").trim() || "Location unavailable";
  const nearestCrossStreet = String(locationContext?.nearestCrossStreet || "").trim();
  const nearestIntersection = String(locationContext?.nearestIntersection || "").trim();
  const nearestLandmark = String(locationContext?.nearestLandmark || "").trim();
  const coordsText = String(locationContext?.coordsText || "Unavailable");

  const lifecycleSnapshot = resolvePopupLifecycleSnapshotShared(domainKey, {
    getIncidentDomainHelper,
    getIncidentSnapshot,
    incidentSnapshotCandidateDomains,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    incidentId,
    incidentIds,
  });
  const lastReportedTs = Number(latest?.ts || marker?.lastTs || 0);
  const currentState =
    String(lifecycleSnapshot?.state || "").trim()
    || (rows.length > 0 ? "reported" : (maxLastFixTs > 0 ? "fixed" : ""));
  const lastChangedAt =
    String(lifecycleSnapshot?.last_changed_at || "").trim()
    || (lastReportedTs ? new Date(lastReportedTs).toISOString() : "")
    || (maxLastFixTs ? new Date(maxLastFixTs).toISOString() : "");

  const issueLabel = resolvePopupIssueLabelShared(domainKey, incidentId, incidentIds, latest, {
    getIncidentDomainHelper,
    getIncidentSnapshot,
    incidentSnapshotCandidateDomains,
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    resolveConfiguredDomainIssueLabel,
    resolveIncidentDrivenPopupMetaContext,
    resolveIncidentIssueLabelForDomain,
  });
  const typeOptionDetails = resolveReportTypeOptionDetails(latest, domainKey);
  const viewerHasReport = Boolean(
    viewerIdentityKey
    && rows.some((row) => reportIdentityKey(row) === viewerIdentityKey)
  );

  return {
    domainKey,
    domainLabel: String(
      marker?.domainLabel || resolveReportDomainLabel(domainKey, "Incident")
    ).trim() || "Incident",
    incidentId,
    incidentIds,
    displayId,
    rows,
    allRows,
    latest,
    issueLabel,
    typeOptionDetails,
    openCount: rows.length || Number(marker?.count || 0),
    locationLabel,
    locationDisplay,
    locationPending,
    nearestAddress,
    nearestCrossStreet,
    nearestIntersection,
    nearestLandmark,
    coordsText,
    currentState,
    lastChangedAt,
    viewerHasReport,
    isFixedNow: !isLifecycleStateOpen(currentState),
  };
}
