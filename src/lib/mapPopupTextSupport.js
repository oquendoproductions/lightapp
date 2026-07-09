export function composeStreetlightQaNote(userNote, areaPowerOn, hazardYesNo, issueLabel = "") {
  const power = ["yes", "no"].includes(String(areaPowerOn || "").toLowerCase())
    ? String(areaPowerOn || "").toLowerCase()
    : "unknown";
  const hazard = ["yes", "no"].includes(String(hazardYesNo || "").toLowerCase())
    ? String(hazardYesNo || "").toLowerCase()
    : "unknown";
  const qaTag = `[SL_QA power_on=${power} hazardous=${hazard}]`;
  const issueTag = String(issueLabel || "").trim() ? `Issue Type: ${String(issueLabel || "").trim()}` : "";
  const noteText = String(userNote || "").trim();
  return [issueTag, noteText, qaTag].filter(Boolean).join(" | ");
}

export function isCoordinatePairText(value) {
  return /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/i.test(String(value || "").trim());
}

export function isPlaceholderLocationText(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;
  return (
    text === "unknown"
    || text === "unavailable"
    || text === "address unavailable"
    || text === "location unavailable"
    || text === "resolving nearest address..."
    || text === "resolving location..."
    || text === "no nearby landmark"
    || text === "no nearby cross street"
    || text === "no nearby intersection"
  );
}

export function hasUsableLocationDetailText(value) {
  const text = String(value || "").trim();
  return Boolean(text) && !isPlaceholderLocationText(text);
}

export function isUsableAddressText(value) {
  const text = String(value || "").trim();
  return Boolean(text) && !isCoordinatePairText(text) && !isPlaceholderLocationText(text);
}

export function isIncidentPopupLocationCompleteForMode(modeRaw, {
  address = "",
  crossStreet = "",
  intersection = "",
  landmark = "",
} = {}) {
  const mode = String(modeRaw || "").trim();
  const hasAddress = isUsableAddressText(address);
  const hasCrossStreet = hasUsableLocationDetailText(crossStreet);
  const hasIntersection = hasUsableLocationDetailText(intersection);
  const hasLandmark = hasUsableLocationDetailText(landmark);

  if (mode === "address_cross_landmark") {
    return hasAddress && hasCrossStreet && hasLandmark;
  }
  if (mode === "address_any_detail") {
    return hasAddress && (hasCrossStreet || hasIntersection || hasLandmark);
  }
  return false;
}
