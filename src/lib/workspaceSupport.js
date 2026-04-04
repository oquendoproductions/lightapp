export const CITYREPORT_SUPPORT_EMAIL =
  String(import.meta.env.VITE_CITYREPORT_SUPPORT_EMAIL || import.meta.env.VITE_SUPPORT_EMAIL || "cityreport.io@gmail.com").trim() ||
  "cityreport.io@gmail.com";

function trimOrEmpty(value) {
  return String(value || "").trim();
}

export function buildMailtoHref({ to = CITYREPORT_SUPPORT_EMAIL, subject = "", body = "" } = {}) {
  const email = trimOrEmpty(to);
  const params = new URLSearchParams();
  const cleanSubject = trimOrEmpty(subject);
  const cleanBody = trimOrEmpty(body);
  if (cleanSubject) params.set("subject", cleanSubject);
  if (cleanBody) params.set("body", cleanBody);
  const query = params.toString();
  return `mailto:${email}${query ? `?${query}` : ""}`;
}

export function normalizeWebsiteHref(raw) {
  const value = trimOrEmpty(raw);
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export function normalizePhoneHref(raw) {
  const value = trimOrEmpty(raw);
  if (!value) return "";
  const digits = value.replace(/[^+\d]/g, "");
  return digits ? `tel:${digits}` : "";
}

export function hasNonEmptyValue(value) {
  return trimOrEmpty(value).length > 0;
}
