export function resolveIncidentDomainHelperEntryShared(domainKeyRaw, deps = {}) {
  const { normalizeDomainKeyOrSlug, getIncidentDomainHelper } = deps;
  if (typeof normalizeDomainKeyOrSlug !== "function" || typeof getIncidentDomainHelper !== "function") {
    return null;
  }
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return null;
  return {
    domainKey,
    helper: getIncidentDomainHelper(domainKey),
  };
}

export function readIncidentDomainHelperStringShared(domainKeyRaw, fieldName, fallback = "", deps = {}) {
  const resolved = resolveIncidentDomainHelperEntryShared(domainKeyRaw, deps);
  if (!resolved) return String(fallback || "").trim();
  return String(resolved.helper?.[fieldName] || fallback || "").trim();
}

export function readIncidentDomainHelperBooleanShared(domainKeyRaw, fieldName, deps = {}) {
  const resolved = resolveIncidentDomainHelperEntryShared(domainKeyRaw, deps);
  return Boolean(resolved?.helper?.[fieldName]);
}

export function readIncidentDomainConfiguredCollectionHelperStringShared(
  domainKeyRaw,
  kindRaw,
  reportsField,
  seededField,
  deps = {},
) {
  const resolved = resolveIncidentDomainHelperEntryShared(domainKeyRaw, deps);
  if (!resolved) return "";
  const kind = String(kindRaw || "seeded").trim().toLowerCase();
  return String(kind === "reports" ? resolved.helper?.[reportsField] : resolved.helper?.[seededField] || "").trim();
}

export function incidentDomainResolveLookupValueByModeShared(modeRaw, row = null, domainKeyRaw = "", deps = {}) {
  const mode = String(modeRaw || "").trim();
  if (!mode || mode === "incident_or_domain_report_id") {
    const helper = typeof deps?.getIncidentDomainHelper === "function"
      ? deps.getIncidentDomainHelper(domainKeyRaw)
      : null;
    const alternateField = String(
      helper?.reportsLookupField
      || helper?.normalizeReportRecordIncidentIdField
      || ""
    ).trim();
    return String(
      row?.incident_id
      || (alternateField ? row?.[alternateField] : "")
      || row?.light_id
      || ""
    ).trim();
  }
  return String(row?.incident_id || row?.light_id || "").trim();
}

export function stripConfiguredIncidentLookupPrefixShared(domainKeyRaw, incidentIdRaw = "", deps = {}) {
  const { normalizeDomainKeyOrSlug, getIncidentDomainHelper } = deps;
  if (typeof normalizeDomainKeyOrSlug !== "function" || typeof getIncidentDomainHelper !== "function") {
    return "";
  }
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const incidentId = String(incidentIdRaw || "").trim();
  if (!domainKey || !incidentId) return "";
  const helper = getIncidentDomainHelper(domainKey) || {};
  const configuredPrefix = String(
    helper?.canonicalIncidentPrefix
    || helper?.prefix
    || domainKey
    || ""
  ).trim().toLowerCase();
  if (!configuredPrefix) return incidentId;
  const lowerIncidentId = incidentId.toLowerCase();
  const candidatePrefixes = Array.from(new Set([
    configuredPrefix,
    configuredPrefix.endsWith("s") ? configuredPrefix.slice(0, -1) : `${configuredPrefix}s`,
  ]))
    .map((prefix) => `${String(prefix || "").trim().toLowerCase()}:`)
    .filter((prefix) => prefix !== ":");
  for (const prefix of candidatePrefixes) {
    if (!lowerIncidentId.startsWith(prefix)) continue;
    return incidentId.slice(prefix.length).trim();
  }
  return incidentId;
}

export function normalizeIncidentDrivenLookupIdShared(domainKeyRaw, incidentIdRaw, deps = {}) {
  const { normalizeDomainKeyOrSlug, getIncidentDomainHelper } = deps;
  if (typeof normalizeDomainKeyOrSlug !== "function" || typeof getIncidentDomainHelper !== "function") {
    return String(incidentIdRaw || "").trim();
  }
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const incidentId = String(incidentIdRaw || "").trim();
  if (!domainKey || !incidentId) return "";
  const helper = getIncidentDomainHelper(domainKey) || {};
  const canonicalIncidentIdMode = String(helper?.canonicalIncidentIdMode || "").trim();
  if (Boolean(helper?.usesCanonicalPrefixedId) || canonicalIncidentIdMode === "prefix_lookup") {
    return stripConfiguredIncidentLookupPrefixShared(domainKey, incidentId, {
      normalizeDomainKeyOrSlug,
      getIncidentDomainHelper,
    });
  }
  return incidentId;
}

export function canonicalIncidentDrivenIncidentIdShared(domainKeyRaw, row = null, fallbackIncidentIdRaw = "", deps = {}) {
  const { normalizeDomainKeyOrSlug, getIncidentDomainHelper } = deps;
  if (typeof normalizeDomainKeyOrSlug !== "function" || typeof getIncidentDomainHelper !== "function") {
    return "";
  }
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!domainKey) return "";
  const helper = getIncidentDomainHelper(domainKey) || {};
  const rawIncidentId = String(row?.incident_id || row?.light_id || fallbackIncidentIdRaw || "").trim();
  const lookupId = normalizeIncidentDrivenLookupIdShared(domainKey, rawIncidentId, {
    normalizeDomainKeyOrSlug,
    getIncidentDomainHelper,
  });
  const canonicalIncidentIdMode = String(helper?.canonicalIncidentIdMode || "").trim();
  if (canonicalIncidentIdMode === "prefix_lookup") {
    const canonicalPrefix = String(helper?.canonicalIncidentPrefix || helper?.prefix || domainKey).trim().toLowerCase();
    return lookupId && canonicalPrefix ? `${canonicalPrefix}:${lookupId}` : "";
  }
  if (canonicalIncidentIdMode === "lookup_or_light_id") {
    return lookupId || rawIncidentId;
  }
  return lookupId || rawIncidentId;
}

export function hasIncidentIdPrefixShared(incidentIdRaw, domainKeyRaw, deps = {}) {
  const { normalizeDomainKeyOrSlug, getIncidentDomainHelper } = deps;
  if (typeof normalizeDomainKeyOrSlug !== "function" || typeof getIncidentDomainHelper !== "function") {
    return false;
  }
  const incidentId = String(incidentIdRaw || "").trim().toLowerCase();
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  if (!incidentId || !domainKey) return false;
  const prefix = String(getIncidentDomainHelper(domainKey)?.prefix || domainKey || "").trim().toLowerCase();
  return Boolean(prefix) && incidentId.startsWith(`${prefix}:`);
}

export function incidentSnapshotCandidateDomainsShared(domainKeyRaw, incidentIdRaw, deps = {}) {
  const {
    normalizeDomainKey,
    normalizeDomainKeyOrSlug,
    getIncidentDomainHelper,
  } = deps;
  if (
    typeof normalizeDomainKey !== "function"
    || typeof normalizeDomainKeyOrSlug !== "function"
    || typeof getIncidentDomainHelper !== "function"
  ) {
    return [];
  }

  const incidentId = String(incidentIdRaw || "").trim();
  const candidates = [];
  const pushCandidate = (candidateDomainKeyRaw) => {
    const normalized = normalizeDomainKey(candidateDomainKeyRaw)
      || String(candidateDomainKeyRaw || "").trim().toLowerCase();
    if (!normalized || candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  pushCandidate(domainKeyRaw);

  const resolved = resolveIncidentDomainHelperEntryShared(domainKeyRaw, {
    normalizeDomainKeyOrSlug,
    getIncidentDomainHelper,
  });
  for (const alias of resolved?.helper?.snapshotAliases || []) {
    pushCandidate(alias);
  }

  if (incidentId) {
    const canonicalDomainOptions = Array.from(new Set([
      String(domainKeyRaw || "").trim(),
      ...candidates,
    ].filter(Boolean)));
    for (const candidateDomainKey of canonicalDomainOptions) {
      if (!hasIncidentIdPrefixShared(incidentId, candidateDomainKey, {
        normalizeDomainKeyOrSlug,
        getIncidentDomainHelper,
      })) continue;
      pushCandidate(candidateDomainKey);
      const helper = getIncidentDomainHelper(candidateDomainKey) || {};
      for (const alias of helper?.snapshotAliases || []) {
        pushCandidate(alias);
      }
    }
  }

  pushCandidate("streetlights");
  return candidates;
}
