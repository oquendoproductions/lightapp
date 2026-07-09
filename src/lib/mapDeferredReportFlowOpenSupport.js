import { defaultDomainIssueValue } from "./mapDomainConfigSupport.js";
import { buildInitialDomainTypeSelections } from "./mapReportFlowSelectionSupport.js";
import {
  resolveRuntimeDomainDisclosuresShared,
  resolveRuntimeDomainIssueOptionsShared,
  resolveRuntimeDomainTypeOptionConfigsShared,
} from "./mapRuntimeDomainReportConfigSupport.js";

export async function prepareDomainReportFlowOpenShared(target, options = {}, deps = {}) {
  const {
    residentIncidentPickerOptions = [],
    municipalBoundaryGate,
    isRoadRequiredForDomain,
    validateAndPrepareRoadTarget,
    ensureParkPlacementForTarget,
  } = deps;

  if (!target) return null;

  if (
    target?.fromMapTap
    && target?.domainExplicitlySelected !== true
    && Array.isArray(residentIncidentPickerOptions)
    && residentIncidentPickerOptions.length > 0
  ) {
    const lat = Number(target?.sourceLat ?? target?.lat);
    const lng = Number(target?.sourceLng ?? target?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        action: "open_picker",
        pickerTarget: { lat, lng },
      };
    }
  }

  let nextTarget = target;
  if (
    typeof municipalBoundaryGate === "function"
    && !municipalBoundaryGate(
      nextTarget?.domain,
      nextTarget?.sourceLat ?? nextTarget?.lat,
      nextTarget?.sourceLng ?? nextTarget?.lng,
      { showNotice: true }
    )
  ) {
    return null;
  }

  if (
    typeof isRoadRequiredForDomain === "function"
    && isRoadRequiredForDomain(target?.domain)
    && options?.skipRoadValidation !== true
    && !target?.roadValidated
    && typeof validateAndPrepareRoadTarget === "function"
  ) {
    const preparedTarget = await validateAndPrepareRoadTarget(target);
    if (!preparedTarget) return null;
    nextTarget = preparedTarget;
  }

  if (typeof ensureParkPlacementForTarget === "function") {
    const parkPlacementAccepted = await ensureParkPlacementForTarget(nextTarget);
    if (!parkPlacementAccepted) return null;
  }

  const beforeFormDisclosures = resolveRuntimeDomainDisclosuresShared(nextTarget?.domain, { position: "before_form" });
  const insideFormDisclosures = resolveRuntimeDomainDisclosuresShared(nextTarget?.domain, { position: "inside_form" });
  const issueOptions = resolveRuntimeDomainIssueOptionsShared(nextTarget?.domain);
  const initialIssue = defaultDomainIssueValue(nextTarget?.domain, issueOptions);
  const typeOptionConfigs = resolveRuntimeDomainTypeOptionConfigsShared(nextTarget?.domain);
  const initialTypeSelections = buildInitialDomainTypeSelections(nextTarget, typeOptionConfigs);
  const nextTargetWithReportConfig = {
    ...nextTarget,
    insideFormDisclosures,
  };

  if (beforeFormDisclosures.length && options?.skipDisclosureGate !== true) {
    return {
      action: "open_disclosure",
      nextTarget: nextTargetWithReportConfig,
      initialIssue,
      initialTypeSelections,
    };
  }

  return {
    action: "open_form",
    nextTarget: nextTargetWithReportConfig,
    initialIssue,
    initialTypeSelections,
  };
}

export async function continueDomainReportAfterDisclosureGateShared(pendingTarget, deps = {}) {
  const {
    isRoadRequiredForDomain,
    validateAndPrepareRoadTarget,
    municipalBoundaryGate,
    ensureParkPlacementForTarget,
  } = deps;

  if (!pendingTarget) return null;

  let nextTarget = pendingTarget;
  if (
    typeof isRoadRequiredForDomain === "function"
    && isRoadRequiredForDomain(nextTarget?.domain)
    && !nextTarget?.roadValidated
    && typeof validateAndPrepareRoadTarget === "function"
  ) {
    const preparedTarget = await validateAndPrepareRoadTarget(nextTarget);
    if (!preparedTarget) return null;
    nextTarget = preparedTarget;
  }

  if (
    typeof municipalBoundaryGate === "function"
    && !municipalBoundaryGate(
      nextTarget?.domain,
      nextTarget?.sourceLat ?? nextTarget?.lat,
      nextTarget?.sourceLng ?? nextTarget?.lng,
      { showNotice: true }
    )
  ) {
    return null;
  }

  if (typeof ensureParkPlacementForTarget === "function") {
    const parkPlacementAccepted = await ensureParkPlacementForTarget(nextTarget);
    if (!parkPlacementAccepted) return null;
  }

  return nextTarget;
}
