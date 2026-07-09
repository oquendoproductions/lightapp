import {
  INCIDENT_DOMAIN_CORE_HELPERS,
  getIncidentDomainCoreHelperShared,
  incidentDomainCoreHelperKeysForConfiguredFieldShared,
} from "./mapIncidentDomainCoreConfig.js";

export function buildIncidentIssueStateByDomainShared(persistedIncidentRecordStateByDomain = {}) {
  const byDomain = new Map();
  for (const domainKey of incidentDomainCoreHelperKeysForConfiguredFieldShared("storedIssueValueStateField")) {
    const stateRecords = persistedIncidentRecordStateByDomain?.[domainKey] || null;
    byDomain.set(
      domainKey,
      stateRecords && typeof stateRecords === "object" ? stateRecords : {}
    );
  }
  return byDomain;
}

export function buildIncidentDrivenRecordMapByDomainShared({
  configuredIncidentSeededByIdByDomain = new Map(),
  persistedIncidentRecordStateByDomain = {},
  shouldBuild = true,
} = {}) {
  if (!shouldBuild) return new Map();
  const byDomain = new Map(configuredIncidentSeededByIdByDomain || []);
  for (const domainKey of Object.keys(INCIDENT_DOMAIN_CORE_HELPERS).filter((key) => (
    String(getIncidentDomainCoreHelperShared(key)?.applyPersistedLocationCacheStateMode || "").trim() === "patch_record_state_map"
  ))) {
    const helper = getIncidentDomainCoreHelperShared(domainKey);
    const recordIdField = String(helper?.applyPersistedLocationCacheStateRecordIdField || "").trim();
    const stateRecords = persistedIncidentRecordStateByDomain?.[domainKey] || null;
    if (!recordIdField || !stateRecords || typeof stateRecords !== "object") continue;
    byDomain.set(domainKey, new Map(
      Object.entries(stateRecords)
        .map(([incidentId, value]) => [
          String(value?.[recordIdField] || incidentId || "").trim(),
          value,
        ])
        .filter(([recordId]) => Boolean(recordId))
    ));
  }
  return byDomain;
}
