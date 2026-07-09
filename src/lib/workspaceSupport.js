export const CITYREPORT_SUPPORT_EMAIL =
  String(import.meta.env.VITE_CITYREPORT_SUPPORT_EMAIL || import.meta.env.VITE_SUPPORT_EMAIL || "cityreport.io@gmail.com").trim() ||
  "cityreport.io@gmail.com";

export { humanizeLabel } from "./workspaceLabelSupport.js";

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

export const DEFAULT_RESIDENT_MENU_SECTION_LABEL = "General";

export function normalizeResidentMenuSectionLabel(value) {
  const label = trimOrEmpty(value);
  return label || DEFAULT_RESIDENT_MENU_SECTION_LABEL;
}

export function buildResidentMenuSectionKey(value) {
  return normalizeResidentMenuSectionLabel(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "general";
}

export function normalizeResidentMenuLinkRow(row) {
  return {
    id: trimOrEmpty(row?.id),
    label: trimOrEmpty(row?.label),
    section_label: normalizeResidentMenuSectionLabel(row?.section_label),
    description: trimOrEmpty(row?.description),
    link_type: trimOrEmpty(row?.link_type || "external_url").toLowerCase() || "external_url",
    url: trimOrEmpty(row?.url),
    phone: trimOrEmpty(row?.phone),
    email: trimOrEmpty(row?.email),
    audience: trimOrEmpty(row?.audience || "public").toLowerCase() || "public",
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : 0,
    enabled: row?.enabled !== false,
  };
}

export function sortResidentMenuLinks(rows) {
  return [...(Array.isArray(rows) ? rows : [])]
    .map((row) => normalizeResidentMenuLinkRow(row))
    .sort((a, b) => {
      const orderDelta = Number(a?.sort_order || 0) - Number(b?.sort_order || 0);
      if (orderDelta !== 0) return orderDelta;
      return String(a?.label || "").localeCompare(String(b?.label || ""), undefined, { sensitivity: "base" });
    });
}

export function normalizeResidentMenuSectionRow(row) {
  return {
    id: trimOrEmpty(row?.id),
    tenant_key: trimOrEmpty(row?.tenant_key).toLowerCase(),
    label: normalizeResidentMenuSectionLabel(row?.label),
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Math.max(1, Number(row.sort_order)) : 1,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

export function sortResidentMenuSectionRows(rows) {
  return [...(Array.isArray(rows) ? rows : [])]
    .map((row) => normalizeResidentMenuSectionRow(row))
    .sort((a, b) => {
      const orderDelta = Number(a?.sort_order || 0) - Number(b?.sort_order || 0);
      if (orderDelta !== 0) return orderDelta;
      return String(a?.label || "").localeCompare(String(b?.label || ""), undefined, { sensitivity: "base" });
    });
}

function groupResidentMenuLinksBySection(rows) {
  const grouped = new Map();
  for (const row of sortResidentMenuLinks(rows)) {
    const sectionLabel = normalizeResidentMenuSectionLabel(row?.section_label);
    const sectionKey = buildResidentMenuSectionKey(sectionLabel);
    const existing = grouped.get(sectionKey);
    if (existing) {
      existing.links.push(row);
      existing.sortOrder = Math.min(existing.sortOrder, Number(row?.sort_order || 0));
      continue;
    }
    grouped.set(sectionKey, {
      key: sectionKey,
      label: sectionLabel,
      sortOrder: Number(row?.sort_order || 0),
      links: [row],
    });
  }

  return [...grouped.values()]
    .sort((a, b) => {
      const orderDelta = Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0);
      if (orderDelta !== 0) return orderDelta;
      return String(a?.label || "").localeCompare(String(b?.label || ""), undefined, { sensitivity: "base" });
    })
    .map((section) => ({
      ...section,
      links: sortResidentMenuLinks(section.links),
    }));
}

export function resolveResidentMenuSections(sectionRows, linkRows, options = {}) {
  const includeEmpty = options?.includeEmpty === true;
  const groupedLinks = groupResidentMenuLinksBySection(linkRows);
  const groupedLinkMap = new Map(groupedLinks.map((section) => [section.key, section]));
  const resolved = [];

  for (const sectionRow of sortResidentMenuSectionRows(sectionRows)) {
    const normalizedSection = normalizeResidentMenuSectionRow(sectionRow);
    const sectionKey = buildResidentMenuSectionKey(normalizedSection.label);
    const matchingLinks = groupedLinkMap.get(sectionKey)?.links || [];
    groupedLinkMap.delete(sectionKey);
    if (!includeEmpty && !matchingLinks.length) continue;
    resolved.push({
      ...normalizedSection,
      key: sectionKey,
      itemCount: matchingLinks.length,
      links: sortResidentMenuLinks(matchingLinks),
    });
  }

  for (const section of groupedLinkMap.values()) {
    if (!includeEmpty && !section.links.length) continue;
    resolved.push({
      id: "",
      tenant_key: "",
      key: section.key,
      label: normalizeResidentMenuSectionLabel(section.label),
      sort_order: Math.max(1, Number(section.sortOrder || 0)),
      itemCount: section.links.length,
      links: sortResidentMenuLinks(section.links),
      created_at: null,
      updated_at: null,
    });
  }

  return resolved.sort((a, b) => {
    const orderDelta = Number(a?.sort_order || 0) - Number(b?.sort_order || 0);
    if (orderDelta !== 0) return orderDelta;
    return String(a?.label || "").localeCompare(String(b?.label || ""), undefined, { sensitivity: "base" });
  });
}
