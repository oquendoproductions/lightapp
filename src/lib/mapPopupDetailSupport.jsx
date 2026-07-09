export {
  composeStreetlightQaNote,
  hasUsableLocationDetailText,
  isCoordinatePairText,
  isIncidentPopupLocationCompleteForMode,
  isPlaceholderLocationText,
  isUsableAddressText,
} from "./mapPopupTextSupport.js";
import {
  composeStreetlightQaNote,
} from "./mapPopupTextSupport.js";
export {
  splitStreetlightAddressParts,
  deriveStreetlightCrossStreet,
  buildStreetlightUtilityRows,
} from "./mapStreetlightUtilityRowsSupport.js";
export {
  ReportTypeOptionDetails,
  summarizeIssueTypes,
} from "./mapPopupTypeDetailSupport.jsx";
export { displayLightId } from "./mapStreetlightDisplayIdSupport.js";

export function parseStreetlightQaFromNote(note) {
  const raw = String(note || "");
  const m = raw.match(/\[SL_QA\s+power_on=(yes|no|unknown)\s+hazardous=(yes|no|unknown)\]/i);
  if (!m) return null;
  return {
    powerOn: String(m[1] || "").toLowerCase(),
    hazardous: String(m[2] || "").toLowerCase(),
  };
}

export function stripSystemMetadataFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const structuredText = String(parsed.note || parsed.text || "").trim();
      return structuredText ? stripSystemMetadataFromNote(structuredText) : "";
    }
  } catch {
    // fall through to legacy note parsing
  }
  return raw
    .replace(/(?:^|\s)Location:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Address:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Cross Street:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Intersection:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Landmark:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Issue Type:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Water issue:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Sign issue:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Type:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Sign type:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/(?:^|\s)Type Option\s+[^:|]+:\s*([^|]+?)(?:\s*\||$)/gi, "")
    .replace(/\[SL_QA\s+power_on=(yes|no|unknown)\s+hazardous=(yes|no|unknown)\]/gi, "")
    .replace(/(?:^|\s)Image:\s*(https?:\/\/[^\s|]+)(?:\s*\||$)/gi, "")
    .replace(/^\|\s*/, "")
    .replace(/\s*\|\s*$/, "")
    .replace(/\s*\|\s*\|\s*/g, " | ")
    .replace(/^\s*Note:\s*/i, "")
    .trim();
}

export function noteDisplayText(note) {
  return stripSystemMetadataFromNote(note);
}
