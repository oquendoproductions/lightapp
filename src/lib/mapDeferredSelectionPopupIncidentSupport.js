import {
  normalizeLooseIssueToken,
  resolveDomainTypeSelectionLabel,
} from "./mapDomainTypeOptionSupport.js";
import { resolveRuntimeDomainTypeOptionConfigsShared } from "./mapRuntimeDomainReportConfigSupport.js";

export {
  buildSharedConfiguredIncidentPopupVariantConfig,
  buildSharedIncidentDrivenPopupVariant,
} from "./mapIncidentPopupVariantSupport.js";

export {
  ReportTypeOptionDetails,
  summarizeIssueTypes,
} from "./mapPopupTypeDetailSupport.jsx";

export {
  resolveIncidentDrivenDomainMetaShared,
  resolveIncidentDrivenGroupMetaShared,
  resolveIncidentDrivenPopupLocationContextShared,
  resolveIncidentDrivenPopupMetaContextShared,
} from "./mapIncidentPopupLocationSupport.js";

export {
  resolveIncidentDrivenLocationContextForRowShared,
} from "./mapIncidentPopupRowLocationContextSupport.js";

export {
  resolveConfiguredDomainIssueLabelShared,
  resolveReportIssueLabelShared,
} from "./mapReportIssueLabelSupport.js";

export { resolveReportTypeOptionDetails as resolveReportTypeOptionDetailsShared } from "./mapReportTypeOptionSupport.js";

export { buildSelectedIncidentPopupInfoShared } from "./mapSelectedIncidentPopupSupport.jsx";

export {
  buildIncidentDrivenPopupVariantShared,
  buildIncidentPopupRenderModelShared,
} from "./mapDeferredSelectionPopupRenderSupport.jsx";

export function resolveConfiguredDomainTypeSelectionLabelShared(domainKeyRaw, optionKeyRaw, rawValue, deps = {}) {
  const { normalizeDomainKeyOrSlug } = deps;
  if (typeof normalizeDomainKeyOrSlug !== "function") return "";
  const domainKey = normalizeDomainKeyOrSlug(domainKeyRaw, { allowUnknown: true });
  const optionKey = normalizeLooseIssueToken(optionKeyRaw);
  const value = String(rawValue || "").trim();
  if (!(domainKey && optionKey && value)) return "";
  const typeOptionConfigs = resolveRuntimeDomainTypeOptionConfigsShared(domainKey);
  const config = typeOptionConfigs.find((entry, index) => {
    const entryOptionKey = normalizeLooseIssueToken(String(entry?.optionKey || "").trim() || `type_option_${index + 1}`);
    return entryOptionKey === optionKey;
  });
  return String(resolveDomainTypeSelectionLabel(value, config) || "").trim();
}

export function formatConfiguredPopupDetailValueShared(rawValue, formatModeRaw = "", options = {}, deps = {}) {
  const value = String(rawValue || "").trim();
  const formatMode = String(formatModeRaw || "").trim();
  if (!value) return "";
  if (formatMode === "domain_type_option_label") {
    return resolveConfiguredDomainTypeSelectionLabelShared(
      options?.domainKey,
      options?.optionKey,
      value,
      deps
    ) || value;
  }
  return value;
}
