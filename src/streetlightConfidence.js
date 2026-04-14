export const STREETLIGHT_CONFIDENCE = {
  likelyOutageMinScore: 4,
  highConfidenceOutageMinScore: 6,
  likelyResolvedMinWorkingUsers: 2,
  staleUnconfirmedMs: 14 * 24 * 60 * 60 * 1000,
  archivedResolvedMs: 45 * 24 * 60 * 60 * 1000,
};

function toFiniteMs(value) {
  const ms = Number(value || 0);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function normalizeSignalList(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => ({
      reporterKey: String(item?.reporterKey || "").trim(),
      ts: toFiniteMs(item?.ts),
    }))
    .filter((item) => item.ts > 0);
}

export function computeStreetlightConfidenceSnapshot({
  outageSignals = [],
  workingSignals = [],
  utilityReportedCount = 0,
  utilityReferenceCount = 0,
  utilityLastTs = 0,
  viewerIdentityKey = "",
  viewerHasSaved = false,
  viewerUtilityReported = false,
  rolloutStartMs = 0,
  now = Date.now(),
} = {}) {
  const outage = normalizeSignalList(outageSignals);
  const working = normalizeSignalList(workingSignals);
  const viewerKey = String(viewerIdentityKey || "").trim();

  let latestOutageTs = 0;
  const outageReporterSet = new Set();
  for (const signal of outage) {
    latestOutageTs = Math.max(latestOutageTs, signal.ts);
    outageReporterSet.add(signal.reporterKey || `outage:${signal.ts}`);
  }

  let latestWorkingTs = 0;
  let viewerHasWorkingAck = false;
  const workingReporterSet = new Set();
  for (const signal of working) {
    latestWorkingTs = Math.max(latestWorkingTs, signal.ts);
    if (latestOutageTs > 0 && signal.ts <= latestOutageTs) continue;
    workingReporterSet.add(signal.reporterKey || `working:${signal.ts}`);
    if (viewerKey && signal.reporterKey === viewerKey) {
      viewerHasWorkingAck = true;
    }
  }

  const reportedCount = Math.max(0, Number(utilityReportedCount || 0));
  const referencedCount = Math.max(0, Number(utilityReferenceCount || 0));
  const outageScore = outageReporterSet.size + reportedCount + referencedCount;
  const lastSignalTs = Math.max(latestOutageTs, latestWorkingTs, toFiniteMs(utilityLastTs));
  const rolloutBaselineMs = toFiniteMs(rolloutStartMs);
  const effectiveStalenessStartMs = Math.max(lastSignalTs, rolloutBaselineMs);
  const nowMs = toFiniteMs(now) || Date.now();

  let state = "operational";
  if (outageScore > 0) state = "unconfirmed";
  if (outageScore >= STREETLIGHT_CONFIDENCE.likelyOutageMinScore) state = "likely_outage";
  if (outageScore >= STREETLIGHT_CONFIDENCE.highConfidenceOutageMinScore) state = "high_confidence_outage";

  if (
    outageScore > 0 &&
    latestWorkingTs > latestOutageTs &&
    workingReporterSet.size >= STREETLIGHT_CONFIDENCE.likelyResolvedMinWorkingUsers
  ) {
    state = "likely_resolved";
  }

  if (
    state === "unconfirmed" &&
    effectiveStalenessStartMs > 0 &&
    nowMs - effectiveStalenessStartMs >= STREETLIGHT_CONFIDENCE.staleUnconfirmedMs
  ) {
    state = "archived";
  }

  if (
    state === "likely_resolved" &&
    Math.max(latestWorkingTs, rolloutBaselineMs) > 0 &&
    nowMs - Math.max(latestWorkingTs, rolloutBaselineMs) >= STREETLIGHT_CONFIDENCE.archivedResolvedMs
  ) {
    state = "archived";
  }

  const publicVisibleOutage = state === "likely_outage" || state === "high_confidence_outage";
  const closed = state === "likely_resolved" || state === "archived";
  const viewerHasOpenInterest = Boolean(viewerHasSaved || viewerUtilityReported);
  const canViewerRestartArchivedCycle = state === "archived" && (viewerHasOpenInterest || publicVisibleOutage);

  return {
    state,
    outageScore,
    outageReporterCount: outageReporterSet.size,
    utilityReportedCount: reportedCount,
    utilityReferenceCount: referencedCount,
    workingReporterCount: workingReporterSet.size,
    latestOutageTs,
    latestWorkingTs,
    lastSignalTs,
    effectiveStalenessStartMs,
    viewerHasWorkingAck,
    viewerHasOpenInterest,
    publicVisibleOutage,
    closed,
    canViewerMarkWorking:
      canViewerRestartArchivedCycle
      || (!closed && !viewerHasWorkingAck && (viewerHasOpenInterest || publicVisibleOutage)),
  };
}
