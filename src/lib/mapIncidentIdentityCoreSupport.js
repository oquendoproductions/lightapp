import {
  UUID_LIKE_RE,
} from "./mapDomainSelectionConfig.js";
import {
  normalizeEmail,
  normalizePhone,
  normalizeReportTypeValue,
  reportDomainFromLightId,
} from "./mapReportParsingCoreSupport.js";

export function normalizeReportQuality(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "good" || normalized === "bad") return normalized;
  return "";
}

export function stripCanonicalIncidentPrefix(value) {
  return String(value || "").replace(/^[a-z_]+:/i, "").trim();
}

export function normalizeUuidIncidentPersistenceId(value) {
  const normalized = stripCanonicalIncidentPrefix(value);
  return UUID_LIKE_RE.test(normalized) ? normalized : "";
}

export function isWorkingReportType(target) {
  if (target && typeof target === "object") {
    const quality = normalizeReportQuality(target.report_quality || target.quality);
    if (quality === "good") return true;
    if (quality === "bad") return false;
  }
  const raw = typeof target === "object"
    ? (target?.type || target?.report_type)
    : target;
  const type = normalizeReportTypeValue(raw);
  return type === "working" || type === "reported_working" || type === "is_working";
}

export function isOutageReportType(target) {
  return !isWorkingReportType(target);
}

export function reporterIdentityKey({ session, profile, guestInfo }) {
  const uid = session?.user?.id;
  if (uid) return `uid:${uid}`;

  const email = normalizeEmail(guestInfo?.email || profile?.email || session?.user?.email);
  if (email) return `email:${email}`;

  const phone = normalizePhone(guestInfo?.phone || profile?.phone);
  if (phone) return `phone:${phone}`;

  const name = String(guestInfo?.name || profile?.full_name || "").trim().toLowerCase();
  if (name) return `name:${name}`;

  return null;
}

export function reportIdentityKey(row) {
  if (row?.reporter_user_id) return `uid:${row.reporter_user_id}`;
  const email = normalizeEmail(row?.reporter_email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(row?.reporter_phone);
  if (phone) return `phone:${phone}`;
  return null;
}

export function incidentDomainIdentityReportRows(helper, { reports = [], reportRows = [] } = {}) {
  if (helper?.identityReportSource === "reportRows") {
    return Array.isArray(reportRows) ? reportRows : [];
  }
  return Array.isArray(reports) ? reports : [];
}

export function incidentDomainMatchesIdentityReportRow({ helper, row, incidentId, domainKey }) {
  if (typeof helper?.matchesIdentityReportRow === "function") {
    return Boolean(helper.matchesIdentityReportRow({
      row,
      incidentId,
      domainKey,
    }));
  }
  const alternateField = String(
    helper?.reportsLookupField
    || helper?.normalizeReportRecordIncidentIdField
    || ""
  ).trim();
  if (helper?.identityReportSource === "reportRows" || alternateField) {
    return String(
      row?.incident_id
      || (alternateField ? row?.[alternateField] : "")
      || row?.light_id
      || ""
    ).trim() === String(incidentId || "").trim();
  }
  return String(row?.light_id || "").trim() === String(incidentId || "").trim();
}

export function incidentDomainIdentityLastFixTs({
  helper,
  domainKey,
  incidentId,
  lastFixByIncidentMap = {},
  lastFixByLightId = {},
  fixedLights = {},
}) {
  const normalizedLastFixByIncidentMap = lastFixByIncidentMap || {};
  if (typeof helper?.resolveIdentityLastFixTs === "function") {
    return Number(helper.resolveIdentityLastFixTs({
      domainKey,
      incidentId,
      lastFixByIncidentMap: normalizedLastFixByIncidentMap,
      lastFixByLightId,
      fixedLights,
    }) || 0);
  }
  if (String(helper?.identityLastFixMode || "").trim() === "incident_map") {
    return Number(normalizedLastFixByIncidentMap?.[incidentId] || 0);
  }
  return Math.max(
    Number(lastFixByLightId?.[incidentId] || 0),
    Number(fixedLights?.[incidentId] || 0)
  );
}

export function incidentDomainBuildLastFixByIncidentMap({
  domainKey,
  actionsByLightId = {},
  incidentStateByKey = {},
  hasIncidentIdPrefix,
  normalizeIncidentDrivenLookupId,
}) {
  if (!domainKey) return {};

  const out = {};
  for (const [lightId, actions] of Object.entries(actionsByLightId || {})) {
    if (typeof hasIncidentIdPrefix === "function" && !hasIncidentIdPrefix(lightId, domainKey)) continue;
    const incidentId = typeof normalizeIncidentDrivenLookupId === "function"
      ? normalizeIncidentDrivenLookupId(domainKey, lightId)
      : "";
    if (!incidentId) continue;
    for (const action of actions || []) {
      if (String(action?.action || "").trim().toLowerCase() !== "fix") continue;
      const ts = Number(action?.ts || 0);
      if (!Number.isFinite(ts) || ts <= 0) continue;
      if (!out[incidentId] || ts > out[incidentId]) out[incidentId] = ts;
    }
  }

  for (const [snapshotKeyValue, snapshot] of Object.entries(incidentStateByKey || {})) {
    const key = String(snapshotKeyValue || "");
    const sep = key.indexOf(":");
    if (sep < 0) continue;
    const incidentId = key.slice(sep + 1).trim();
    if (typeof hasIncidentIdPrefix === "function" && !hasIncidentIdPrefix(incidentId, domainKey)) continue;
    if (String(snapshot?.state || "").trim().toLowerCase() !== "fixed") continue;
    const lookupId = typeof normalizeIncidentDrivenLookupId === "function"
      ? normalizeIncidentDrivenLookupId(domainKey, incidentId)
      : "";
    if (!lookupId) continue;
    const ts = Date.parse(String(snapshot?.last_changed_at || "")) || 0;
    if (!ts) continue;
    if (!out[lookupId] || ts > out[lookupId]) out[lookupId] = ts;
  }

  return out;
}

export function canIdentityReportLight(lightId, {
  session,
  profile,
  guestInfo,
  reports,
  reportRows = [],
  fixedLights,
  lastFixByLightId,
  lastFixByIncidentMap = {},
  allowRepeatAfterArchive = false,
  prefixedIncidentDomainKey,
  normalizeIncidentDrivenLookupId,
  getIncidentDomainHelper,
}) {
  const key = reporterIdentityKey({ session, profile, guestInfo });
  if (!key) return true;

  const lightIdValue = String(lightId || "").trim();
  const domainKey = (typeof prefixedIncidentDomainKey === "function" ? prefixedIncidentDomainKey(lightIdValue) : "")
    || reportDomainFromLightId(lightIdValue);
  const identityIncidentId = typeof normalizeIncidentDrivenLookupId === "function"
    ? (normalizeIncidentDrivenLookupId(domainKey, lightIdValue) || lightIdValue)
    : lightIdValue;
  if (!identityIncidentId) return true;

  const helper = typeof getIncidentDomainHelper === "function"
    ? getIncidentDomainHelper(domainKey)
    : null;
  const lastFixTs = incidentDomainIdentityLastFixTs({
    helper,
    domainKey,
    incidentId: identityIncidentId,
    lastFixByIncidentMap,
    lastFixByLightId,
    fixedLights,
  });
  const candidateRows = incidentDomainIdentityReportRows(helper, { reports, reportRows });

  for (const row of candidateRows) {
    if (!incidentDomainMatchesIdentityReportRow({
      helper,
      row,
      incidentId: identityIncidentId,
      domainKey,
    })) continue;
    const rowKey = reportIdentityKey(row);
    if (!(rowKey && rowKey === key)) continue;

    const ts = Number(row?.ts || 0);
    if (!Number.isFinite(ts)) continue;
    if (!lastFixTs || ts > lastFixTs) {
      if (allowRepeatAfterArchive) continue;
      return false;
    }
  }

  return true;
}
