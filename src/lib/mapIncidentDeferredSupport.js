import {
  normalizeEmail,
  normalizePhone,
} from "./mapReportParsingSupport.js";

export function parseWorkingContactFromNote(note) {
  const raw = String(note || "").trim();
  if (!raw) return { name: null, email: null, phone: null };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { name: null, email: null, phone: null };
    }

    const name = String(parsed.reporter_name || parsed.actor_name || "").trim() || null;
    const email = normalizeEmail(parsed.reporter_email || parsed.actor_email || "") || null;
    const phone = normalizePhone(parsed.reporter_phone || parsed.actor_phone || "") || null;
    return { name, email, phone };
  } catch {
    return { name: null, email: null, phone: null };
  }
}

export function composeIncidentActionAuditNote(
  noteText,
  {
    actorName = "",
    actorEmail = "",
    actorPhone = "",
    imageUrl = "",
    imagePath = "",
    imageMimeType = "",
    imageFileName = "",
    capturedAt = "",
  } = {}
) {
  const payload = {};
  const noteValue = String(noteText || "").trim();
  const actorNameValue = String(actorName || "").trim();
  const actorEmailValue = normalizeEmail(actorEmail || "") || "";
  const actorPhoneValue = normalizePhone(actorPhone || "") || "";
  const imageUrlValue = String(imageUrl || "").trim();
  const imagePathValue = String(imagePath || "").trim();
  const imageMimeTypeValue = String(imageMimeType || "").trim();
  const imageFileNameValue = String(imageFileName || "").trim();
  const capturedAtValue = String(capturedAt || "").trim();

  if (noteValue) payload.note = noteValue;
  if (actorNameValue) payload.actor_name = actorNameValue;
  if (actorEmailValue) payload.actor_email = actorEmailValue;
  if (actorPhoneValue) payload.actor_phone = actorPhoneValue;
  if (imageUrlValue) payload.image_url = imageUrlValue;
  if (imagePathValue) payload.image_path = imagePathValue;
  if (imageMimeTypeValue) payload.image_mime_type = imageMimeTypeValue;
  if (imageFileNameValue) payload.image_file_name = imageFileNameValue;
  if (capturedAtValue) payload.captured_at = capturedAtValue;

  return Object.keys(payload).length ? JSON.stringify(payload) : (noteValue || null);
}

export function normalizeUtilityReportReference(value) {
  const raw = String(value || "").trim();
  return raw ? raw.slice(0, 120) : "";
}

export function isMissingUtilityReportReferenceColumnError(error) {
  const text = `${String(error?.message || "")} ${String(error?.details || "")} ${String(error?.hint || "")}`.toLowerCase();
  return text.includes("report_reference") && text.includes("does not exist");
}
