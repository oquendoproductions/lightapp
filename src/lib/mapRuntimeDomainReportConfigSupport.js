import {
  defaultDomainIssueOptions,
  defaultDomainTypeOptionConfigs,
  mergeDomainTypeOptionConfigsWithIssueOptions,
  normalizeDomainIssueOptions,
} from "./mapDomainConfigSupport";
import { getIncidentDomainCoreHelperShared as getIncidentDomainHelperShared } from "./mapIncidentDomainCoreConfig.js";
import { buildSharedIncidentAuthorizationDisclosures } from "./mapSharedIncidentSupport.js";
import { RUNTIME_DOMAIN_META } from "./mapRuntimeDomainMeta";
import { normalizeDomainKeyOrSlug } from "./mapReportParsingSupport.js";

const DEFAULT_PUBLIC_SUBMIT_DISCLOSURE =
  "Submitting a report through CityReport helps notify the city, but it does not guarantee receipt, review, response, or acceptance as legal notice. For emergencies or immediate hazards, contact emergency services or the responsible agency directly.";

function normalizeRuntimeDomainKey(domainKeyRaw = "") {
  return normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
}

export function defaultAllowReportImagesForDomainShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  if (!domainKey) return false;
  return Boolean(getIncidentDomainHelperShared(domainKey).allowReportImagesDefault);
}

export function publicSubmitDisclosureTextShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  const helper = getIncidentDomainHelperShared(domainKey);
  return String(helper.submitDisclosureText || "").trim() || DEFAULT_PUBLIC_SUBMIT_DISCLOSURE;
}

export function publicConsentDisclosureTextShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  return String(getIncidentDomainHelperShared(domainKey).submitConsentDisclosureText || "").trim();
}

export function defaultDomainDisclosuresShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  const helper = getIncidentDomainHelperShared(domainKey);
  const baseDisclosures = [
    {
      id: `${domainKey || "domain"}_submission_notice`,
      title: "Submission notice",
      body: publicSubmitDisclosureTextShared(domainKey),
      required_acknowledgement: false,
      display_position: "inside_form",
    },
  ];

  if (helper.authorizationDisclosureId) {
    return buildSharedIncidentAuthorizationDisclosures({
      authorizationId: helper.authorizationDisclosureId,
      authorizationBody: publicConsentDisclosureTextShared(domainKey),
      baseDisclosures,
      extraBefore: helper.authorizationDisclosureExtraBefore,
    });
  }

  return baseDisclosures;
}

export function normalizeDomainDisclosureRowsShared(value, domainKeyRaw = "", options = {}) {
  const { fallbackToDefaults = false } = options;
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);

  if (!Array.isArray(value)) {
    return fallbackToDefaults ? defaultDomainDisclosuresShared(domainKey) : [];
  }

  const rows = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const title = String(row?.title || "").trim();
    const body = String(row?.body || "").trim();
    if (!title && !body) continue;
    rows.push({
      id: String(row?.id || "").trim(),
      title: title || "Disclosure",
      body,
      required_acknowledgement: row?.required_acknowledgement === true || row?.required === true,
      display_position: String(row?.display_position || "").trim().toLowerCase() === "before_form"
        ? "before_form"
        : "inside_form",
    });
  }

  if (!rows.length && fallbackToDefaults) {
    return defaultDomainDisclosuresShared(domainKey);
  }

  return rows;
}

export function resolveRuntimeDomainIssueOptionsShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  if (!domainKey) return [];
  if (RUNTIME_DOMAIN_META.issueTypesByDomain.has(domainKey)) {
    return RUNTIME_DOMAIN_META.issueTypesByDomain.get(domainKey) || [];
  }
  if (RUNTIME_DOMAIN_META.rawIssueTypesByDomain.has(domainKey)) {
    const normalized = normalizeDomainIssueOptions(
      RUNTIME_DOMAIN_META.rawIssueTypesByDomain.get(domainKey)
    );
    RUNTIME_DOMAIN_META.issueTypesByDomain.set(domainKey, normalized);
    return normalized;
  }
  return defaultDomainIssueOptions(domainKey);
}

export function resolveRuntimeDomainTypeOptionConfigsShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  if (!domainKey) return [];
  if (RUNTIME_DOMAIN_META.typeOptionsByDomain.has(domainKey)) {
    return RUNTIME_DOMAIN_META.typeOptionsByDomain.get(domainKey) || [];
  }
  const issueOptions = resolveRuntimeDomainIssueOptionsShared(domainKey);
  if (RUNTIME_DOMAIN_META.rawTypeOptionsByDomain.has(domainKey)) {
    const merged = mergeDomainTypeOptionConfigsWithIssueOptions(
      domainKey,
      RUNTIME_DOMAIN_META.rawTypeOptionsByDomain.get(domainKey) || [],
      issueOptions
    );
    RUNTIME_DOMAIN_META.typeOptionsByDomain.set(domainKey, merged);
    return merged;
  }
  const merged = mergeDomainTypeOptionConfigsWithIssueOptions(
    domainKey,
    defaultDomainTypeOptionConfigs(domainKey),
    issueOptions
  );
  RUNTIME_DOMAIN_META.typeOptionsByDomain.set(domainKey, merged);
  return merged;
}

export function resolveRuntimeDomainDisclosuresShared(domainKeyRaw = "", options = {}) {
  const { position = "", fallbackToDefaults = true } = options;
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  if (!domainKey) return [];
  const all = RUNTIME_DOMAIN_META.disclosuresByDomain.has(domainKey)
    ? normalizeDomainDisclosureRowsShared(
        RUNTIME_DOMAIN_META.disclosuresByDomain.get(domainKey),
        domainKey,
        { fallbackToDefaults }
      )
    : defaultDomainDisclosuresShared(domainKey);
  const normalizedPosition = String(position || "").trim().toLowerCase();
  if (!normalizedPosition) return all;
  return all.filter((row) => row?.display_position === normalizedPosition);
}

export function resolveRuntimeDomainAllowReportImagesShared(domainKeyRaw = "") {
  const domainKey = normalizeRuntimeDomainKey(domainKeyRaw);
  if (!domainKey) return false;
  if (RUNTIME_DOMAIN_META.allowReportImagesByDomain.has(domainKey)) {
    return RUNTIME_DOMAIN_META.allowReportImagesByDomain.get(domainKey) === true;
  }
  return defaultAllowReportImagesForDomainShared(domainKey);
}
