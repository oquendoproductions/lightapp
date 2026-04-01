import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import "./headerStandards.css";
import {
  STANDARD_LOGIN_EMAIL_INPUT_PROPS,
  STANDARD_LOGIN_FORM_PROPS,
  getStandardLoginPasswordInputProps,
} from "./auth/loginFieldStandards";

const TITLE_LOGO_SRC = import.meta.env.VITE_TITLE_LOGO_SRC || "/CityReport-logo.png";
const MOBILE_TITLE_LOGO_SRC = import.meta.env.VITE_MOBILE_TITLE_LOGO_SRC || "/CityReport-pin-logo.png";
const TITLE_LOGO_ALT = "CityReport.io";

const DOMAIN_OPTIONS = [
  { key: "streetlights", label: "Streetlights" },
  { key: "street_signs", label: "Street Signs" },
  { key: "potholes", label: "Potholes" },
  { key: "water_drain_issues", label: "Water / Drain" },
  { key: "power_outage", label: "Power Outage" },
  { key: "water_main", label: "Water Main" },
];

const TAB_OPTIONS = [
  { key: "tenants", label: "Organization Info" },
  { key: "users", label: "Users/Admins" },
  { key: "roles", label: "Roles + Permissions" },
  { key: "domains", label: "Domains + Features" },
  { key: "files", label: "Files" },
  { key: "audit", label: "Audit" },
];

const CONTROL_PLANE_SECTIONS = [
  { key: "organizations", label: "Organizations" },
  { key: "settings", label: "Settings" },
  { key: "reports", label: "Reports" },
];

const CONTROL_PLANE_PAGES = [
  { key: "manage-organizations", section: "organizations", label: "Manage Organizations" },
  { key: "manage-leads", section: "organizations", label: "Manage Leads" },
  { key: "account-info", section: "settings", label: "Account Info" },
  { key: "manage-team", section: "settings", label: "Manage Team" },
  { key: "roles-permissions", section: "settings", label: "Roles & Permissions" },
  { key: "security-checks", section: "settings", label: "Security Checks" },
  { key: "organization-reports", section: "reports", label: "Organization Reports" },
  { key: "domain-reports", section: "reports", label: "Domain Reports" },
  { key: "leads-reports", section: "reports", label: "Leads Reports" },
  { key: "finance-reports", section: "reports", label: "Finance Reports" },
];

const DEFAULT_CONTROL_PLANE_PAGE = "organization-reports";

const PLATFORM_ROLE_OPTIONS = [
  { key: "platform_owner", label: "Platform Owner" },
  { key: "platform_staff", label: "Platform Staff" },
];

const CONTROL_PLANE_PAGE_ACCESS = {
  "manage-organizations": ["platform_owner", "legacy_admin", "platform_staff"],
  "manage-leads": ["platform_owner", "legacy_admin", "platform_staff"],
  "account-info": ["platform_owner", "legacy_admin", "platform_staff"],
  "manage-team": ["platform_owner", "legacy_admin"],
  "roles-permissions": ["platform_owner", "legacy_admin"],
  "security-checks": ["platform_owner", "legacy_admin"],
  "organization-reports": ["platform_owner", "legacy_admin", "platform_staff"],
  "domain-reports": ["platform_owner", "legacy_admin", "platform_staff"],
  "leads-reports": ["platform_owner", "legacy_admin", "platform_staff"],
  "finance-reports": ["platform_owner", "legacy_admin"],
};

const ROLE_PERMISSION_ACTIONS = [
  { key: "access", label: "Access" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
];

const ROLE_PERMISSION_MODULES = [
  { key: "reports", label: "Reports" },
  { key: "users", label: "Users" },
  { key: "domains", label: "Domains + Features" },
  { key: "files", label: "Files" },
  { key: "audit", label: "Audit" },
  { key: "roles", label: "Roles" },
];

const DEFAULT_TENANT_PERMISSION_KEYS = ROLE_PERMISSION_MODULES.flatMap((module) =>
  ROLE_PERMISSION_ACTIONS.map((action) => `${module.key}.${action.key}`)
);

const ORGANIZATION_DELETION_HOLD_DAYS = 30;

const palette = {
  navy900: "#102b46",
  navy700: "#1d466d",
  navy500: "#2e628f",
  mint600: "#12806a",
  mint700: "#0f6e5c",
  red600: "#d14343",
  canvas: "#e8eef5",
  card: "#ffffff",
  border: "#c7d6e6",
  borderStrong: "#afc4d9",
  text: "#17314f",
  textMuted: "#4a617a",
};

const FIXED_BANNER_TOP = "0px";
const FIXED_BANNER_HEIGHT = "var(--desktop-header-height)";

const shell = {
  minHeight: "100vh",
  padding: `calc(${FIXED_BANNER_HEIGHT} + ${FIXED_BANNER_TOP} + 24px) 18px 42px`,
  fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  background: `linear-gradient(180deg, ${palette.mint600} 0%, ${palette.mint700} 100%)`,
  color: palette.text,
};

const stickyBanner = {
  position: "fixed",
  top: FIXED_BANNER_TOP,
  left: 0,
  transform: "none",
  zIndex: 90,
  display: "grid",
  gridTemplateColumns: "minmax(var(--desktop-header-side-column), 1fr) minmax(0, 2fr) minmax(var(--desktop-header-side-column), 1fr)",
  alignItems: "center",
  gap: "1rem",
  width: "100%",
  minHeight: FIXED_BANNER_HEIGHT,
  padding: "16px var(--desktop-header-horizontal-padding)",
  border: 0,
  borderBottom: "1px solid rgba(23, 49, 79, 0.08)",
  background: "rgba(248, 251, 255, 0.88)",
  backdropFilter: "blur(14px)",
  boxShadow: "none",
  boxSizing: "border-box",
};

const card = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(248,251,255,0.98) 100%)",
  borderRadius: 16,
  border: `1px solid ${palette.border}`,
  boxShadow: "0 16px 34px rgba(16,43,70,0.08)",
  padding: 16,
};

const inputBase = {
  width: "100%",
  border: `1px solid ${palette.borderStrong}`,
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 16,
  boxSizing: "border-box",
  color: palette.navy900,
  background: "#fbfdff",
};

const buttonBase = {
  border: `1px solid ${palette.navy700}`,
  background: `linear-gradient(180deg, ${palette.navy700} 0%, ${palette.navy900} 100%)`,
  color: "#f8fbff",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 8px 16px rgba(16,43,70,0.2)",
};

const buttonAlt = {
  ...buttonBase,
  border: `1px solid ${palette.borderStrong}`,
  background: "#f4f8fd",
  color: palette.navy900,
  boxShadow: "none",
};

const passwordFieldWrap = {
  position: "relative",
};

const passwordToggleInline = {
  position: "absolute",
  top: "50%",
  right: 10,
  transform: "translateY(-50%)",
  border: 0,
  background: "transparent",
  color: palette.mint700,
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
  padding: 0,
};

const signOutButton = {
  ...buttonAlt,
  padding: "4px 10px",
  minHeight: 28,
};

const headerActionButton = {
  ...buttonAlt,
  padding: "4px 10px",
  minHeight: 28,
};

const subPanel = {
  border: `1px solid ${palette.border}`,
  borderRadius: 12,
  background: "rgba(255,255,255,0.78)",
  padding: 12,
};

const responsiveTwoColGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
  gap: 8,
};

const authModalBackdrop = {
  position: "fixed",
  inset: 0,
  zIndex: 95,
  display: "grid",
  placeItems: "center",
  padding: 20,
  background: "rgba(9, 25, 41, 0.38)",
};

const authModalCard = {
  width: "min(480px, calc(100vw - 24px))",
  display: "grid",
  gap: 14,
  padding: 18,
  borderRadius: 20,
  border: `1px solid ${palette.border}`,
  background: "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(246,251,255,0.98) 100%)",
  boxShadow: "0 24px 46px rgba(16,43,70,0.18)",
};

const responsiveActionGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
  gap: 8,
  alignItems: "end",
};

const responsiveDomainGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
  gap: 8,
};

const listActionButton = {
  ...buttonAlt,
  textAlign: "left",
  display: "grid",
  gap: 2,
  fontWeight: 700,
};

const tableHeadCell = {
  textAlign: "left",
  borderBottom: `1px solid ${palette.border}`,
  padding: "8px 0",
  color: palette.textMuted,
  fontWeight: 800,
};

const brandTitleStack = {
  display: "grid",
  gap: "var(--desktop-header-stack-gap)",
  textAlign: "center",
};

const brandResetButton = {
  border: 0,
  background: "transparent",
  padding: 0,
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  cursor: "pointer",
};

const brandLogo = {
  height: "var(--desktop-header-logo-height)",
  width: "auto",
  maxWidth: "min(240px, calc(100vw - 180px))",
  display: "block",
};

const menuToggleButton = {
  border: "1px solid rgba(26, 49, 83, 0.22)",
  background: "rgba(255,255,255,0.92)",
  color: palette.navy900,
  width: "var(--desktop-header-menu-size)",
  height: "var(--desktop-header-menu-size)",
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "none",
};

const menuSheet = {
  position: "absolute",
  top: "calc(100% + 10px)",
  right: 0,
  width: "min(320px, calc(100vw - 36px))",
  background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,255,0.98) 100%)",
  border: `1px solid ${palette.border}`,
  borderRadius: 18,
  boxShadow: "0 20px 36px rgba(8,24,42,0.18)",
  padding: 14,
  display: "grid",
  gap: 12,
};

const tabSelectBase = {
  ...inputBase,
  minWidth: 220,
  fontWeight: 700,
  background: "#ffffff",
};

const fullWidthSection = {
  width: "100%",
  margin: "0 auto",
};

const controlPlaneTabsRail = {
  position: "sticky",
  top: FIXED_BANNER_HEIGHT,
  zIndex: 25,
  padding: "8px 0 10px",
  background: "transparent",
};

const controlPlaneTabsShell = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid rgba(23, 49, 79, 0.08)",
  borderRadius: 22,
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 10px 24px rgba(17, 49, 79, 0.06)",
};

const controlPlaneTabsBar = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(0, 1fr)",
  minWidth: 0,
  width: "100%",
  gap: 12,
  alignItems: "stretch",
};

const controlPlaneTabButton = {
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "1px solid rgba(23, 49, 79, 0.15)",
  borderRadius: 999,
  background: "rgba(255, 255, 255, 0.92)",
  color: palette.text,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
};

const controlPlaneTabButtonActive = {
  ...controlPlaneTabButton,
  background: "linear-gradient(135deg, #113d5f 0%, #176d78 100%)",
  border: "1px solid transparent",
  color: "#f7fbff",
  textShadow: "0 1px 0 rgba(9, 31, 48, 0.22)",
};

const controlPlaneSubmenu = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  left: 0,
  minWidth: 220,
  padding: 8,
  borderRadius: 18,
  border: "1px solid rgba(23, 49, 79, 0.12)",
  background: "rgba(255, 255, 255, 0.98)",
  boxShadow: "0 18px 36px rgba(17, 49, 79, 0.14)",
  display: "grid",
  gap: 6,
  zIndex: 30,
};

const controlPlaneSubmenuItem = {
  display: "grid",
  width: "100%",
  border: "1px solid rgba(23, 49, 79, 0.08)",
  borderRadius: 14,
  background: "rgba(246, 250, 255, 0.96)",
  color: palette.text,
  padding: "10px 12px",
  font: "inherit",
  fontWeight: 700,
  textAlign: "left",
  cursor: "pointer",
  gap: 2,
};

const metricCard = {
  ...subPanel,
  display: "grid",
  gap: 4,
  alignContent: "start",
  minHeight: 96,
};

const ADD_TENANT_STEPS = [
  { key: "organization", label: "Organization Contact Information" },
  { key: "contacts", label: "Primary + Additional Contacts" },
  { key: "setup", label: "Basic Setup" },
];

function initialTenantForm() {
  return {
    tenant_key: "",
    name: "",
    primary_subdomain: "",
    boundary_config_key: "",
    notification_email_potholes: "",
    notification_email_water_drain: "",
    resident_portal_enabled: false,
    is_pilot: false,
    active: true,
  };
}

function initialProfileForm() {
  return {
    organization_type: "municipality",
    legal_name: "",
    display_name: "",
    mailing_address_1: "",
    mailing_address_2: "",
    mailing_city: "",
    mailing_state: "",
    mailing_zip: "",
    website_url: "",
    url_extension: "",
    billing_email: "",
    timezone: "America/New_York",
    contact_primary_name: "",
    contact_primary_title: "",
    contact_primary_email: "",
    contact_primary_phone: "",
    additional_contacts: [],
    contract_status: "pending",
    contract_start_date: "",
    contract_end_date: "",
    renewal_date: "",
    notes: "",
  };
}

function emptyAdditionalContact(seed = {}) {
  return {
    name: String(seed?.name || "").trim(),
    title: String(seed?.title || "").trim(),
    email: String(seed?.email || "").trim(),
    phone: String(seed?.phone || "").trim(),
  };
}

function hasAdditionalContactValue(contact) {
  return Boolean(
    String(contact?.name || "").trim() ||
    String(contact?.title || "").trim() ||
    String(contact?.email || "").trim() ||
    String(contact?.phone || "").trim()
  );
}

function normalizeAdditionalContacts(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => emptyAdditionalContact(row))
    .filter((row) => hasAdditionalContactValue(row));
}

function profileRowToForm(profile) {
  if (!profile) return initialProfileForm();
  const legacyAddress = String(profile.mailing_address || "").trim();
  const address1 = String(profile.mailing_address_1 || "").trim();
  const address2 = String(profile.mailing_address_2 || "").trim();
  const city = String(profile.mailing_city || "").trim();
  const state = String(profile.mailing_state || "").trim();
  const zip = String(profile.mailing_zip || "").trim();
  const additionalContacts = normalizeAdditionalContacts(profile.additional_contacts);
  const legacyContacts = [
    {
      name: String(profile.contact_technical_name || "").trim(),
      title: "Technical Contact",
      email: String(profile.contact_technical_email || "").trim(),
      phone: String(profile.contact_technical_phone || "").trim(),
    },
    {
      name: String(profile.contact_legal_name || "").trim(),
      title: "Legal Contact",
      email: String(profile.contact_legal_email || "").trim(),
      phone: String(profile.contact_legal_phone || "").trim(),
    },
  ].filter((row) => hasAdditionalContactValue(row));
  const mergedAdditionalContacts = [...additionalContacts];
  for (const legacy of legacyContacts) {
    const duplicate = mergedAdditionalContacts.some((row) =>
      String(row?.email || "").trim().toLowerCase() === String(legacy.email || "").trim().toLowerCase()
      && String(row?.name || "").trim().toLowerCase() === String(legacy.name || "").trim().toLowerCase()
    );
    if (!duplicate) mergedAdditionalContacts.push(emptyAdditionalContact(legacy));
  }
  return {
    organization_type: String(profile.organization_type || "municipality"),
    legal_name: String(profile.legal_name || ""),
    display_name: String(profile.display_name || ""),
    mailing_address_1: address1 || legacyAddress,
    mailing_address_2: address2,
    mailing_city: city,
    mailing_state: state,
    mailing_zip: zip,
    website_url: String(profile.website_url || ""),
    url_extension: String(profile.url_extension || ""),
    billing_email: String(profile.billing_email || ""),
    timezone: String(profile.timezone || "America/New_York"),
    contact_primary_name: String(profile.contact_primary_name || ""),
    contact_primary_title: String(profile.contact_primary_title || ""),
    contact_primary_email: String(profile.contact_primary_email || ""),
    contact_primary_phone: String(profile.contact_primary_phone || ""),
    additional_contacts: mergedAdditionalContacts,
    contract_status: String(profile.contract_status || "pending"),
    contract_start_date: String(profile.contract_start_date || ""),
    contract_end_date: String(profile.contract_end_date || ""),
    renewal_date: String(profile.renewal_date || ""),
    notes: String(profile.notes || ""),
  };
}

function initialDomainVisibilityForm() {
  const out = {};
  for (const d of DOMAIN_OPTIONS) out[d.key] = "enabled";
  return out;
}

function initialMapFeaturesForm() {
  return {
    show_boundary_border: true,
    shade_outside_boundary: true,
    outside_shade_opacity: "0.42",
    boundary_border_color: "#e53935",
    boundary_border_width: "4",
  };
}

function sanitizeTenantKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function sanitizeRoleKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function toOrganizationLanguage(value) {
  return String(value || "")
    .replace(/\bTenants\b/g, "Organizations")
    .replace(/\btenants\b/g, "organizations")
    .replace(/\bTenant\b/g, "Organization")
    .replace(/\btenant\b/g, "organization");
}

function isMissingColumnError(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function roleKeyToLabel(roleKey) {
  return toOrganizationLanguage(String(roleKey || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase()));
}

function buildAssignmentRowKey(row) {
  return `${String(row?.tenant_key || "").trim()}:${String(row?.user_id || "").trim()}:${String(row?.role || "").trim()}`;
}

function titleCaseWords(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatSessionDisplayName(name, email) {
  const rawName = String(name || "").trim();
  if (rawName) return titleCaseWords(rawName);

  const emailPrefix = String(email || "").trim().split("@")[0] || "";
  if (!emailPrefix) return "";
  return titleCaseWords(emailPrefix.replace(/[._-]+/g, " "));
}

function platformRoleToLabel(role) {
  if (role === "platform_owner" || role === "legacy_admin") return "Platform Owner";
  if (role === "platform_staff") return "Platform Staff";
  return "Platform Administrator";
}

function buildAuditActionLabel(row) {
  const action = String(row?.action || "").trim().toLowerCase();
  const roleLabel = roleKeyToLabel(String(row?.details?.role || "").trim());

  if (action === "tenant_upsert") return "Saved organization details";
  if (action === "tenant_profile_upsert") return "Saved contact profile";
  if (action === "tenant_domains_features_upsert") return "Saved domains and map features";
  if (action === "tenant_user_role_assigned") {
    return roleLabel ? `Assigned ${roleLabel} role` : "Assigned organization role";
  }
  if (action === "tenant_user_role_removed") {
    return roleLabel ? `Removed ${roleLabel} role` : "Removed organization role";
  }
  if (action === "tenant_user_role_changed") {
    return roleLabel ? `Changed role to ${roleLabel}` : "Changed organization role";
  }
  if (action === "tenant_role_created") return "Created organization role";
  if (action === "tenant_role_removed") return "Removed organization role definition";
  if (action === "tenant_role_permissions_saved") return "Saved role permissions";
  if (action === "tenant_boundary_from_file_applied") return "Applied boundary from file";
  if (action === "tenant_file_uploaded") return "Uploaded organization file";
  if (action === "tenant_file_removed") return "Removed organization file";

  return toOrganizationLanguage(titleCaseWords(action.replace(/_/g, " ")));
}

function buildAuditEntityLabel(row) {
  const entityType = String(row?.entity_type || "").trim().toLowerCase();
  const entityId = String(row?.entity_id || "").trim();
  const roleLabel = roleKeyToLabel(String(row?.details?.role || "").trim());
  const fileName = String(row?.details?.file_name || "").trim();

  if (entityType === "tenant") return entityId ? `Organization: ${entityId}` : "Organization";
  if (entityType === "tenant_profile") return "Organization contact profile";
  if (entityType === "tenant_config") return "Organization domains and map settings";
  if (entityType === "tenant_user_role") {
    return roleLabel ? `${roleLabel} assignment` : (entityId ? `User ${entityId}` : "Organization user role");
  }
  if (entityType === "tenant_role") return roleLabel || (entityId ? `Role: ${entityId}` : "Organization role");
  if (entityType === "tenant_permissions") return roleLabel ? `${roleLabel} permissions` : "Organization role permissions";
  if (entityType === "tenant_boundary") return entityId ? `Boundary: ${entityId}` : "Organization boundary";
  if (entityType === "tenant_file") return fileName || entityId || "Organization file";

  return entityId ? `${toOrganizationLanguage(titleCaseWords(entityType.replace(/_/g, " ")))}: ${entityId}` : toOrganizationLanguage(titleCaseWords(entityType.replace(/_/g, " ")));
}

function cleanOptional(value) {
  const v = String(value || "").trim();
  return v || null;
}

function composeMailingAddress(parts) {
  const address1 = cleanOptional(parts?.mailing_address_1);
  const address2 = cleanOptional(parts?.mailing_address_2);
  const city = cleanOptional(parts?.mailing_city);
  const state = cleanOptional(parts?.mailing_state);
  const zip = cleanOptional(parts?.mailing_zip);
  const locality = [city, state, zip].filter(Boolean).join(" ");
  return [address1, address2, locality].filter(Boolean).join(", ");
}

function resolveOrganizationName(row) {
  return String(row?.name || "").trim() || String(row?.tenant_key || "").trim();
}

function resolvePublicDisplayName(row, profile) {
  return String(profile?.display_name || "").trim() || resolveOrganizationName(row);
}

function resolveLegalOrganizationName(profile) {
  return String(profile?.legal_name || "").trim();
}

function buildDefaultBoundaryKey(tenantKey) {
  const key = sanitizeTenantKey(tenantKey);
  return key ? `${key}_city_geojson` : "";
}

function extractBoundaryGeoJsonPayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  let candidate = raw;
  if (candidate.geojson && typeof candidate.geojson === "object") candidate = candidate.geojson;
  else if (candidate.value && typeof candidate.value === "object") candidate = candidate.value;
  else if (candidate.boundary && typeof candidate.boundary === "object") candidate = candidate.boundary;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const allowedTypes = new Set([
    "FeatureCollection",
    "Feature",
    "GeometryCollection",
    "Polygon",
    "MultiPolygon",
    "LineString",
    "MultiLineString",
    "Point",
    "MultiPoint",
  ]);
  const t = String(candidate?.type || "").trim();
  if (!allowedTypes.has(t)) return null;
  return candidate;
}

function sanitizeHexColor(value, fallback = "#e53935") {
  const raw = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  return String(fallback || "#e53935").toLowerCase();
}

function normalizePrimarySubdomain(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  const withoutProtocol = raw.replace(/^https?:\/\//, "");
  const hostOnly = withoutProtocol.split("/")[0] || "";
  if (!hostOnly) return "";

  if (hostOnly.endsWith(".cityreport.io")) {
    const prefix = sanitizeTenantKey(hostOnly.replace(/\.cityreport\.io$/, ""));
    return prefix ? `${prefix}.cityreport.io` : "";
  }

  if (hostOnly.includes(".")) {
    return hostOnly;
  }

  const prefix = sanitizeTenantKey(hostOnly);
  return prefix ? `${prefix}.cityreport.io` : "";
}

function primarySubdomainPrefix(value) {
  const normalized = normalizePrimarySubdomain(value);
  if (normalized.endsWith(".cityreport.io")) {
    return normalized.replace(/\.cityreport\.io$/, "");
  }
  return normalized;
}

function makeLiveUrl(primarySubdomain, tenantKey) {
  const host = normalizePrimarySubdomain(primarySubdomain);
  if (host) {
    return `https://${host}/`;
  }
  return `https://${sanitizeTenantKey(tenantKey)}.cityreport.io/`;
}

function makeDevUrl(tenantKey) {
  return `https://dev.cityreport.io/${sanitizeTenantKey(tenantKey)}/`;
}

function sanitizeFileNameSegment(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 120);
  return normalized || "file";
}

function toDatePath(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function statusText(error, okText) {
  if (!error) return okText;
  return `Error: ${String(error?.message || error || "unknown error")}`;
}

function formatDateTimeDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("relation") || msg.includes("does not exist");
}

function normalizeBoundedDecimalInput(value, { min = 0, max = 1 } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (!/^-?\d*\.?\d*$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return "";
  return String(Math.max(min, Math.min(max, parsed)));
}

function normalizeHexDraft(value, fallback = "#e53935") {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (raw.startsWith("#") && raw.length <= 7 && /^#[0-9a-f]*$/i.test(raw)) return raw;
  if (!raw.startsWith("#") && raw.length <= 6 && /^[0-9a-f]*$/i.test(raw)) return `#${raw}`;
  return sanitizeHexColor(fallback, "#e53935");
}

export default function PlatformAdminApp() {
  const [authReady, setAuthReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [sessionActorName, setSessionActorName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openControlPlaneDropdown, setOpenControlPlaneDropdown] = useState("");
  const bannerMenuRef = useRef(null);
  const controlPlaneNavRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [platformAccessRole, setPlatformAccessRole] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginStatus, setLoginStatus] = useState("");
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordError, setForgotPasswordError] = useState("");
  const [authResetLoading, setAuthResetLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("tenants");
  const [controlPlaneSection, setControlPlaneSection] = useState("reports");
  const [controlPlanePage, setControlPlanePage] = useState(DEFAULT_CONTROL_PLANE_PAGE);

  const [tenants, setTenants] = useState([]);
  const [tenantAdmins, setTenantAdmins] = useState([]);
  const [platformTeamAssignments, setPlatformTeamAssignments] = useState([]);
  const [platformTeamUserSummariesById, setPlatformTeamUserSummariesById] = useState({});
  const [platformUserSearchQuery, setPlatformUserSearchQuery] = useState("");
  const [platformUserSearchResults, setPlatformUserSearchResults] = useState([]);
  const [platformTeamForm, setPlatformTeamForm] = useState({ user_id: "", role: "platform_staff" });
  const [platformTeamStatus, setPlatformTeamStatus] = useState("");
  const [platformUserSearchLoading, setPlatformUserSearchLoading] = useState(false);
  const [leadRows, setLeadRows] = useState([]);
  const [leadDraftById, setLeadDraftById] = useState({});
  const [leadStatus, setLeadStatus] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [tenantRoleDefinitions, setTenantRoleDefinitions] = useState([]);
  const [tenantRolePermissions, setTenantRolePermissions] = useState([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState("");
  const [roleForm, setRoleForm] = useState({ role: "", role_label: "" });
  const [rolePermissionDraft, setRolePermissionDraft] = useState({});
  const [rolePermissionDirty, setRolePermissionDirty] = useState(false);
  const [tenantFiles, setTenantFiles] = useState([]);
  const [auditRows, setAuditRows] = useState([]);

  const [tenantProfilesByTenant, setTenantProfilesByTenant] = useState({});
  const [tenantVisibilityByTenant, setTenantVisibilityByTenant] = useState({});
  const [tenantMapFeaturesByTenant, setTenantMapFeaturesByTenant] = useState({});

  const [selectedTenantKey, setSelectedTenantKey] = useState("ashtabulacity");
  const [entryStep, setEntryStep] = useState("start"); // start | add | tenant
  const [addTenantStep, setAddTenantStep] = useState(ADD_TENANT_STEPS[0].key);
  const [tenantSearch, setTenantSearch] = useState("");

  const [tenantForm, setTenantForm] = useState(initialTenantForm);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [domainVisibilityForm, setDomainVisibilityForm] = useState(initialDomainVisibilityForm);
  const [mapFeaturesForm, setMapFeaturesForm] = useState(initialMapFeaturesForm);
  const [assignForm, setAssignForm] = useState({ tenant_key: "", user_id: "", role: "tenant_employee" });
  const [userAssignmentMode, setUserAssignmentMode] = useState("existing");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [assignmentUserSummariesById, setAssignmentUserSummariesById] = useState({});
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [editingAssignmentKey, setEditingAssignmentKey] = useState("");
  const [editingAssignmentRole, setEditingAssignmentRole] = useState("");
  const [fileForm, setFileForm] = useState({ category: "contract", notes: "", file: null });
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [status, setStatus] = useState({
    tenant: "",
    profile: "",
    users: "",
    roles: "",
    domains: "",
    files: "",
    audit: "",
    hydrate: "",
  });

  const invokePlatformUserAdmin = useCallback(async (body) => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return { data: null, error: sessionError };
    }

    const accessToken = String(sessionData?.session?.access_token || "").trim();
    if (!accessToken) {
      return {
        data: null,
        error: new Error("Platform admin session expired. Sign in again and retry."),
      };
    }

    return supabase.functions.invoke("platform-user-admin", {
      body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }, []);
  const tenantAdminsRef = useRef([]);

  const tenantOptions = useMemo(
    () => (Array.isArray(tenants) ? tenants.map((t) => String(t?.tenant_key || "").trim()).filter(Boolean) : []),
    [tenants]
  );

  const selectedTenant = useMemo(
    () => (tenants || []).find((t) => String(t?.tenant_key || "") === String(selectedTenantKey || "")) || null,
    [tenants, selectedTenantKey]
  );
  const selectedTenantProfile = useMemo(
    () => tenantProfilesByTenant?.[sanitizeTenantKey(selectedTenantKey)] || null,
    [selectedTenantKey, tenantProfilesByTenant]
  );
  const selectedTenantOrganizationName = useMemo(
    () => resolveOrganizationName(selectedTenant),
    [selectedTenant]
  );
  const selectedTenantPublicDisplayName = useMemo(
    () => resolvePublicDisplayName(selectedTenant, selectedTenantProfile),
    [selectedTenant, selectedTenantProfile]
  );
  const selectedTenantLegalOrganizationName = useMemo(
    () => resolveLegalOrganizationName(selectedTenantProfile),
    [selectedTenantProfile]
  );
  const selectedTenantDeletionScheduledFor = String(selectedTenant?.deletion_scheduled_for || "").trim();
  const selectedTenantPendingDeletion = Boolean(selectedTenantDeletionScheduledFor);

  const filteredTenantRows = useMemo(() => {
    const q = String(tenantSearch || "").trim().toLowerCase();
    if (!q) return [];
    return (tenants || []).filter((row) => {
      const key = String(row?.tenant_key || "").trim().toLowerCase();
      const name = String(row?.name || "").trim().toLowerCase();
      const sub = String(row?.primary_subdomain || "").trim().toLowerCase();
      const profile = tenantProfilesByTenant?.[sanitizeTenantKey(row?.tenant_key)] || null;
      const displayName = String(profile?.display_name || "").trim().toLowerCase();
      const legalName = String(profile?.legal_name || "").trim().toLowerCase();
      return key.includes(q) || name.includes(q) || sub.includes(q) || displayName.includes(q) || legalName.includes(q);
    });
  }, [tenantProfilesByTenant, tenantSearch, tenants]);

  const selectedTenantLiveUrl = useMemo(
    () => (selectedTenant ? makeLiveUrl(selectedTenant.primary_subdomain, selectedTenant.tenant_key) : ""),
    [selectedTenant]
  );

  const selectedTenantDevUrl = useMemo(
    () => (selectedTenant ? makeDevUrl(selectedTenant.tenant_key) : ""),
    [selectedTenant]
  );

  const sortedTenantRoleDefinitions = useMemo(() => {
    const rows = Array.isArray(tenantRoleDefinitions) ? [...tenantRoleDefinitions] : [];
    rows.sort((a, b) => {
      const aSystem = a?.is_system === true ? 1 : 0;
      const bSystem = b?.is_system === true ? 1 : 0;
      if (aSystem !== bSystem) return bSystem - aSystem;
      return String(a?.role || "").localeCompare(String(b?.role || ""));
    });
    return rows;
  }, [tenantRoleDefinitions]);

  const roleLabelByKey = useMemo(() => {
    const out = {};
    for (const row of tenantRoleDefinitions || []) {
      const key = String(row?.role || "").trim();
      if (!key) continue;
      out[key] = toOrganizationLanguage(String(row?.role_label || "").trim() || roleKeyToLabel(key));
    }
    return out;
  }, [tenantRoleDefinitions]);

  const assignableTenantRoles = useMemo(
    () => sortedTenantRoleDefinitions.filter((row) => row?.active !== false),
    [sortedTenantRoleDefinitions]
  );

  const userSearchResultById = useMemo(() => {
    const out = {};
    for (const row of userSearchResults || []) {
      const key = String(row?.id || "").trim();
      if (!key) continue;
      out[key] = row;
    }
    return out;
  }, [userSearchResults]);

  const selectedTenantRoleAssignments = useMemo(
    () => (tenantAdmins || []).filter((row) => String(row?.tenant_key || "") === String(selectedTenantKey || "")),
    [tenantAdmins, selectedTenantKey]
  );
  const tenantAdminAssignments = useMemo(
    () => (tenantAdmins || []).filter((row) => String(row?.role || "").trim() === "tenant_admin"),
    [tenantAdmins]
  );
  const tenantEmployeeAssignments = useMemo(
    () => (tenantAdmins || []).filter((row) => String(row?.role || "").trim() === "tenant_employee"),
    [tenantAdmins]
  );
  const residentPortalCount = useMemo(
    () => (tenants || []).filter((row) => Boolean(row?.resident_portal_enabled)).length,
    [tenants]
  );
  const activeOrganizationCount = useMemo(
    () => (tenants || []).filter((row) => row?.active !== false).length,
    [tenants]
  );
  const pilotOrganizationCount = useMemo(
    () => (tenants || []).filter((row) => Boolean(row?.is_pilot)).length,
    [tenants]
  );
  const leadStatusCounts = useMemo(() => {
    const counts = {};
    for (const row of leadRows || []) {
      const key = String(row?.status || "new").trim().toLowerCase() || "new";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [leadRows]);
  const leadDomainCounts = useMemo(() => {
    const counts = {};
    for (const row of leadRows || []) {
      const key = String(row?.priority_domain || "other").trim().toLowerCase() || "other";
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [leadRows]);
  const domainReportRows = useMemo(() => (
    DOMAIN_OPTIONS.map((domain) => {
      let publicCount = 0;
      let restrictedCount = 0;
      for (const tenantKey of Object.keys(tenantVisibilityByTenant || {})) {
        const visibility = String(tenantVisibilityByTenant?.[tenantKey]?.[domain.key] || "public").trim().toLowerCase();
        if (visibility === "private" || visibility === "disabled" || visibility === "hidden") restrictedCount += 1;
        else publicCount += 1;
      }
      return {
        ...domain,
        publicCount,
        restrictedCount,
      };
    })
  ), [tenantVisibilityByTenant]);

  const tenantRoleAssignmentCounts = useMemo(() => {
    const counts = {};
    for (const row of selectedTenantRoleAssignments) {
      const role = String(row?.role || "").trim();
      if (!role) continue;
      counts[role] = (counts[role] || 0) + 1;
    }
    return counts;
  }, [selectedTenantRoleAssignments]);

  const rolePermissionMap = useMemo(() => {
    const out = {};
    for (const row of tenantRolePermissions || []) {
      const role = String(row?.role || "").trim();
      const permission = String(row?.permission_key || "").trim();
      if (!role || !permission) continue;
      out[`${role}:${permission}`] = Boolean(row?.allowed);
    }
    return out;
  }, [tenantRolePermissions]);

  const selectedRoleDefinition = useMemo(
    () => sortedTenantRoleDefinitions.find((row) => String(row?.role || "") === String(selectedRoleKey || "")) || null,
    [sortedTenantRoleDefinitions, selectedRoleKey]
  );

  const tenantSearchQuery = String(tenantSearch || "").trim();
  const hasTenantSearchQuery = tenantSearchQuery.length > 0;
  const isPlatformOwner = platformAccessRole === "platform_owner" || platformAccessRole === "legacy_admin";
  const isPlatformStaff = platformAccessRole === "platform_staff";
  const canEditTenantCore = isPlatformOwner;
  const canEditTenantOperational = isPlatformOwner || isPlatformStaff;
  const currentPlatformRoleKey = platformAccessRole || (isPlatformOwner ? "platform_owner" : isPlatformStaff ? "platform_staff" : "");
  const platformRoleLabel = platformRoleToLabel(platformAccessRole);
  const sessionDisplayName = formatSessionDisplayName(sessionActorName, sessionEmail);
  const canAccessControlPlanePage = useCallback((pageKey) => {
    const allowedRoles = CONTROL_PLANE_PAGE_ACCESS[pageKey] || [];
    return allowedRoles.includes(currentPlatformRoleKey);
  }, [currentPlatformRoleKey]);
  const visibleControlPlanePagesBySection = useMemo(
    () => Object.fromEntries(
      CONTROL_PLANE_SECTIONS.map((section) => [
        section.key,
        CONTROL_PLANE_PAGES.filter((page) => page.section === section.key && canAccessControlPlanePage(page.key)),
      ])
    ),
    [canAccessControlPlanePage]
  );
  const currentSectionPages = useMemo(
    () => visibleControlPlanePagesBySection[controlPlaneSection] || [],
    [controlPlaneSection, visibleControlPlanePagesBySection]
  );
  const controlPlanePageLabel = useMemo(
    () => CONTROL_PLANE_PAGES.find((page) => page.key === controlPlanePage)?.label || "",
    [controlPlanePage]
  );
  const addTenantStepIndex = Math.max(0, ADD_TENANT_STEPS.findIndex((step) => step.key === addTenantStep));
  const currentAddTenantStep = ADD_TENANT_STEPS[addTenantStepIndex] || ADD_TENANT_STEPS[0];
  const selectedSearchAccount = assignForm.user_id ? userSearchResultById?.[assignForm.user_id] || null : null;
  const resolveKnownUserSummary = useCallback((userId) => {
    const key = String(userId || "").trim();
    if (!key) return null;
    return assignmentUserSummariesById?.[key] || userSearchResultById?.[key] || null;
  }, [assignmentUserSummariesById, userSearchResultById]);
  const formatKnownUserLabel = useCallback((userId) => {
    const summary = resolveKnownUserSummary(userId);
    return String(summary?.display_name || "").trim() || String(summary?.email || "").trim() || "Selected account";
  }, [resolveKnownUserSummary]);
  const formatPlatformUserLabel = useCallback((userId) => {
    const key = String(userId || "").trim();
    if (!key) return "Selected account";
    const summary = platformTeamUserSummariesById?.[key];
    return String(summary?.display_name || "").trim() || String(summary?.email || "").trim() || "Selected account";
  }, [platformTeamUserSummariesById]);

  const updateAdditionalContact = useCallback((index, field, value) => {
    setProfileForm((prev) => ({
      ...prev,
      additional_contacts: (Array.isArray(prev.additional_contacts) ? prev.additional_contacts : []).map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      ),
    }));
  }, []);

  const addAdditionalContact = useCallback(() => {
    setProfileForm((prev) => ({
      ...prev,
      additional_contacts: [...(Array.isArray(prev.additional_contacts) ? prev.additional_contacts : []), emptyAdditionalContact()],
    }));
  }, []);

  const removeAdditionalContact = useCallback((index) => {
    setProfileForm((prev) => ({
      ...prev,
      additional_contacts: (Array.isArray(prev.additional_contacts) ? prev.additional_contacts : []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }, []);

  const logAudit = useCallback(async (payload) => {
    const actorName = cleanOptional(sessionActorName) || cleanOptional(sessionEmail?.split("@")?.[0]);
    const actorEmail = cleanOptional(sessionEmail);
    const detailPayload = {
      ...(payload?.details || {}),
      actor_name: actorName,
      actor_email: actorEmail,
    };
    try {
      await supabase.from("tenant_audit_log").insert([
        {
          tenant_key: cleanOptional(payload?.tenant_key),
          actor_user_id: cleanOptional(sessionUserId),
          action: String(payload?.action || "").trim() || "unknown",
          entity_type: String(payload?.entity_type || "").trim() || "unknown",
          entity_id: cleanOptional(payload?.entity_id),
          details: detailPayload,
        },
      ]);
    } catch {
      // non-blocking
    }
  }, [sessionActorName, sessionEmail, sessionUserId]);

  const loadTenants = useCallback(async () => {
    const baseSelect = "tenant_key,name,primary_subdomain,boundary_config_key,notification_email_potholes,notification_email_water_drain,is_pilot,active,updated_at";
    const deleteSelect = "deletion_requested_at,deletion_scheduled_for,deletion_requested_by,active_before_deletion";
    let result = await supabase
      .from("tenants")
      .select(`${baseSelect},resident_portal_enabled,${deleteSelect}`)
      .order("tenant_key", { ascending: true });

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase
        .from("tenants")
        .select(baseSelect)
        .order("tenant_key", { ascending: true });
      if (result.error) throw result.error;
      const fallbackRows = Array.isArray(result.data)
        ? result.data.map((row) => ({
          ...row,
          resident_portal_enabled: false,
          deletion_requested_at: null,
          deletion_scheduled_for: null,
          deletion_requested_by: null,
          active_before_deletion: null,
        }))
        : [];
      setTenants(fallbackRows);
      return;
    }

    if (result.error) throw result.error;
    setTenants(Array.isArray(result.data) ? result.data : []);
  }, []);

  const loadTenantAdmins = useCallback(async () => {
    const { data, error } = await supabase
      .from("tenant_user_roles")
      .select("tenant_key,user_id,role,status,created_at")
      .eq("status", "active")
      .order("tenant_key", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    setTenantAdmins(Array.isArray(data) ? data : []);
  }, []);

  const loadPlatformTeamAssignments = useCallback(async () => {
    if (!isPlatformOwner) {
      setPlatformTeamAssignments([]);
      return;
    }
    const { data, error } = await supabase
      .from("platform_user_roles")
      .select("user_id,role,status,created_at,updated_at")
      .eq("status", "active")
      .order("role", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    setPlatformTeamAssignments(Array.isArray(data) ? data : []);
  }, [isPlatformOwner]);

  const loadClientLeads = useCallback(async () => {
    let result = await supabase
      .from("client_leads")
      .select("id,created_at,full_name,work_email,city_agency,role_title,priority_domain,notes,status,internal_notes,follow_up_on,last_follow_up_at,updated_at")
      .order("created_at", { ascending: false });

    if (result.error && isMissingColumnError(result.error)) {
      result = await supabase
        .from("client_leads")
        .select("id,created_at,full_name,work_email,city_agency,role_title,priority_domain,notes,status")
        .order("created_at", { ascending: false });
      if (result.error) throw result.error;
      const fallbackRows = Array.isArray(result.data)
        ? result.data.map((row) => ({
          ...row,
          internal_notes: "",
          follow_up_on: null,
          last_follow_up_at: null,
          updated_at: row?.created_at || null,
        }))
        : [];
      setLeadRows(fallbackRows);
      return;
    }

    if (result.error) throw result.error;
    setLeadRows(Array.isArray(result.data) ? result.data : []);
  }, []);

  const loadTenantRoleConfig = useCallback(async (tenantKeyInput = selectedTenantKey) => {
    const key = sanitizeTenantKey(tenantKeyInput);
    if (!key) {
      setTenantRoleDefinitions([]);
      setTenantRolePermissions([]);
      return;
    }

    const [rolesResult, permsResult] = await Promise.all([
      supabase
        .from("tenant_role_definitions")
        .select("tenant_key,role,role_label,is_system,active,created_at,updated_at")
        .eq("tenant_key", key)
        .order("is_system", { ascending: false })
        .order("role", { ascending: true }),
      supabase
        .from("tenant_role_permissions")
        .select("tenant_key,role,permission_key,allowed")
        .eq("tenant_key", key),
    ]);

    if (rolesResult.error || permsResult.error) {
      const firstError = rolesResult.error || permsResult.error;
      if (isMissingRelationError(firstError)) {
        const fallbackRoleSet = new Set(["tenant_admin", "tenant_employee"]);
        for (const row of tenantAdminsRef.current || []) {
          if (String(row?.tenant_key || "") !== key) continue;
          const role = String(row?.role || "").trim().toLowerCase();
          if (role) fallbackRoleSet.add(role);
        }
        const fallbackRoles = [...fallbackRoleSet].sort().map((role) => ({
          tenant_key: key,
          role,
          role_label: roleKeyToLabel(role),
          is_system: role === "tenant_admin" || role === "tenant_employee",
          active: true,
        }));
        setTenantRoleDefinitions(fallbackRoles);
        setTenantRolePermissions([]);
        setStatus((prev) => ({
          ...prev,
          roles: "Role catalog tables are not available yet. Run latest migrations to enable role and permission editing.",
        }));
        return;
      }
      throw firstError;
    }

    setTenantRoleDefinitions(Array.isArray(rolesResult.data) ? rolesResult.data : []);
    setTenantRolePermissions(Array.isArray(permsResult.data) ? permsResult.data : []);
    setStatus((prev) => ({ ...prev, roles: "" }));
  }, [selectedTenantKey]);

  const loadTenantProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from("tenant_profiles")
      .select("*");
    if (error) throw error;
    const next = {};
    for (const row of data || []) {
      const key = String(row?.tenant_key || "").trim();
      if (!key) continue;
      next[key] = row;
    }
    setTenantProfilesByTenant(next);
  }, []);

  const loadTenantVisibility = useCallback(async () => {
    const { data, error } = await supabase
      .from("tenant_visibility_config")
      .select("tenant_key,domain,visibility");
    if (error) throw error;
    const next = {};
    for (const row of data || []) {
      const tenantKey = sanitizeTenantKey(row?.tenant_key);
      const domain = String(row?.domain || "").trim();
      if (!tenantKey || !domain) continue;
      if (!next[tenantKey]) next[tenantKey] = {};
      next[tenantKey][domain] = String(row?.visibility || "public").trim().toLowerCase() || "public";
    }
    setTenantVisibilityByTenant(next);
  }, []);

  const loadTenantMapFeatures = useCallback(async () => {
    const { data, error } = await supabase
      .from("tenant_map_features")
      .select("tenant_key,show_boundary_border,shade_outside_boundary,outside_shade_opacity,boundary_border_color,boundary_border_width");
    if (error) throw error;
    const next = {};
    for (const row of data || []) {
      const key = sanitizeTenantKey(row?.tenant_key);
      if (!key) continue;
      const nextBorderWidthRaw = Number(row?.boundary_border_width);
      const nextBorderWidth = Number.isFinite(nextBorderWidthRaw)
        ? Math.max(0.5, Math.min(8, nextBorderWidthRaw))
        : 4;
      next[key] = {
        show_boundary_border: row?.show_boundary_border !== false,
        shade_outside_boundary: row?.shade_outside_boundary !== false,
        outside_shade_opacity: Number.isFinite(Number(row?.outside_shade_opacity))
          ? Number(row.outside_shade_opacity)
          : 0.42,
        boundary_border_color: sanitizeHexColor(row?.boundary_border_color, "#e53935"),
        boundary_border_width: nextBorderWidth,
      };
    }
    setTenantMapFeaturesByTenant(next);
  }, []);

  const loadTenantFiles = useCallback(async (tenantKey) => {
    const key = sanitizeTenantKey(tenantKey);
    if (!key) {
      setTenantFiles([]);
      return;
    }
    const { data, error } = await supabase
      .from("tenant_files")
      .select("id,tenant_key,file_category,file_name,storage_bucket,storage_path,mime_type,size_bytes,uploaded_by,uploaded_at,notes,active")
      .eq("tenant_key", key)
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    setTenantFiles(Array.isArray(data) ? data : []);
  }, []);

  const loadAudit = useCallback(async (tenantKeyInput = selectedTenantKey) => {
    const key = sanitizeTenantKey(tenantKeyInput);
    if (!key) {
      setAuditRows([]);
      return;
    }

    const limit = 120;
    const rpcResult = await supabase.rpc("platform_admin_audit_feed", {
      p_tenant_key: key,
      p_limit: limit,
    });
    if (!rpcResult.error && Array.isArray(rpcResult.data)) {
      setAuditRows(rpcResult.data);
      return;
    }

    const { data, error } = await supabase
      .from("tenant_audit_log")
      .select("id,tenant_key,actor_user_id,action,entity_type,entity_id,details,created_at")
      .eq("tenant_key", key)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    const fallbackRows = (Array.isArray(data) ? data : []).map((row) => ({
      ...row,
      actor_name: String(row?.details?.actor_name || "").trim() || null,
    }));
    setAuditRows(fallbackRows);
  }, [selectedTenantKey]);

  const purgeExpiredOrganizationDeletions = useCallback(async () => {
    if (!canEditTenantCore) return;
    const { data, error } = await supabase
      .from("tenants")
      .select("tenant_key,name,deletion_requested_at,deletion_scheduled_for,deletion_requested_by");
    if (error) {
      if (isMissingColumnError(error)) return;
      throw error;
    }
    const now = Date.now();
    const dueRows = (Array.isArray(data) ? data : []).filter((row) => {
      const scheduled = String(row?.deletion_scheduled_for || "").trim();
      if (!scheduled) return false;
      const scheduledMs = new Date(scheduled).getTime();
      return Number.isFinite(scheduledMs) && scheduledMs <= now;
    });
    for (const row of dueRows) {
      const tenantKey = sanitizeTenantKey(row?.tenant_key);
      if (!tenantKey) continue;
      await logAudit({
        tenant_key: tenantKey,
        action: "tenant_deleted",
        entity_type: "tenant",
        entity_id: tenantKey,
        details: {
          scheduled_for: cleanOptional(row?.deletion_scheduled_for),
          requested_at: cleanOptional(row?.deletion_requested_at),
          requested_by: cleanOptional(row?.deletion_requested_by),
          deleted_by: cleanOptional(sessionUserId),
        },
      });
      const { error: deleteError } = await supabase
        .from("tenants")
        .delete()
        .eq("tenant_key", tenantKey);
      if (deleteError) throw deleteError;
    }
  }, [canEditTenantCore, logAudit, sessionUserId]);

  const refreshControlPlaneData = useCallback(async () => {
    try {
      await purgeExpiredOrganizationDeletions();
      await Promise.all([
        loadTenants(),
        loadTenantAdmins(),
        loadPlatformTeamAssignments(),
        loadClientLeads(),
        loadTenantRoleConfig(),
        loadTenantProfiles(),
        loadTenantVisibility(),
        loadTenantMapFeatures(),
        loadAudit(),
      ]);
      setStatus((prev) => ({ ...prev, hydrate: "" }));
    } catch (error) {
      setStatus((prev) => ({ ...prev, hydrate: statusText(error, "") }));
    }
  }, [purgeExpiredOrganizationDeletions, loadTenants, loadTenantAdmins, loadPlatformTeamAssignments, loadClientLeads, loadTenantRoleConfig, loadTenantProfiles, loadTenantVisibility, loadTenantMapFeatures, loadAudit]);

  const loadAssignmentUserSummaries = useCallback(async () => {
    if (!canEditTenantCore) {
      setAssignmentUserSummariesById({});
      return;
    }

    const userIds = [...new Set(selectedTenantRoleAssignments.map((row) => String(row?.user_id || "").trim()).filter(Boolean))];
    if (!userIds.length) {
      setAssignmentUserSummariesById({});
      return;
    }

    const { data, error } = await invokePlatformUserAdmin({
      action: "lookup_users",
      user_ids: userIds,
    });

    if (error) {
      return;
    }

    const next = {};
    for (const row of Array.isArray(data?.results) ? data.results : []) {
      const key = String(row?.id || "").trim();
      if (!key) continue;
      next[key] = row;
    }
    setAssignmentUserSummariesById(next);
  }, [canEditTenantCore, invokePlatformUserAdmin, selectedTenantRoleAssignments]);

  const loadPlatformTeamUserSummaries = useCallback(async () => {
    if (!isPlatformOwner) {
      setPlatformTeamUserSummariesById({});
      return;
    }

    const userIds = [...new Set(platformTeamAssignments.map((row) => String(row?.user_id || "").trim()).filter(Boolean))];
    if (!userIds.length) {
      setPlatformTeamUserSummariesById({});
      return;
    }

    const { data, error } = await invokePlatformUserAdmin({
      action: "lookup_users",
      user_ids: userIds,
    });

    if (error) return;

    const next = {};
    for (const row of Array.isArray(data?.results) ? data.results : []) {
      const key = String(row?.id || "").trim();
      if (!key) continue;
      next[key] = row;
    }
    setPlatformTeamUserSummariesById(next);
  }, [invokePlatformUserAdmin, isPlatformOwner, platformTeamAssignments]);

  useEffect(() => {
    tenantAdminsRef.current = tenantAdmins;
  }, [tenantAdmins]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncViewportWidth = () => setViewportWidth(window.innerWidth);
    syncViewportWidth();
    window.addEventListener("resize", syncViewportWidth);
    return () => window.removeEventListener("resize", syncViewportWidth);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !menuOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (bannerMenuRef.current?.contains(event.target)) return;
      setMenuOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutsideClick);
    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window === "undefined" || !openControlPlaneDropdown) return undefined;
    const closeOnOutsideClick = (event) => {
      if (controlPlaneNavRef.current?.contains(event.target)) return;
      setOpenControlPlaneDropdown("");
    };
    window.addEventListener("pointerdown", closeOnOutsideClick);
    return () => window.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [openControlPlaneDropdown]);

  useEffect(() => {
    let mounted = true;
    const syncSession = (session) => {
      if (!mounted) return;
      const userId = String(session?.user?.id || "").trim();
      const userEmail = String(session?.user?.email || "").trim().toLowerCase();
      const metadataName =
        String(session?.user?.user_metadata?.full_name || "").trim() ||
        String(session?.user?.user_metadata?.name || "").trim();
      const emailName = userEmail ? String(userEmail.split("@")[0] || "").trim() : "";
      setSessionUserId(userId);
      setSessionEmail(userEmail);
      setSessionActorName(metadataName || emailName);
      setLoginError("");
      setAuthReady(true);
    };

    supabase.auth.getSession().then(({ data }) => {
      syncSession(data?.session || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session || null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const signInPlatformAdmin = useCallback(async (event) => {
    event.preventDefault();
    const email = String(loginEmail || "").trim().toLowerCase();
    const password = String(loginPassword || "");
    if (!email || !password) {
      setLoginError("Email and password are required.");
      return;
    }
    setLoginLoading(true);
    setLoginError("");
    setLoginStatus("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoginLoading(false);
    if (error) {
      setLoginError(String(error?.message || "Unable to sign in."));
      return;
    }
    setLoginPassword("");
  }, [loginEmail, loginPassword]);

  const openForgotPasswordModal = useCallback(() => {
    setForgotPasswordEmail(String(loginEmail || "").trim());
    setForgotPasswordError("");
    setForgotPasswordOpen(true);
  }, [loginEmail]);

  const closeForgotPasswordModal = useCallback(() => {
    setForgotPasswordOpen(false);
    setForgotPasswordError("");
    setAuthResetLoading(false);
  }, []);

  const sendPasswordReset = useCallback(async () => {
    const email = String(forgotPasswordEmail || "").trim().toLowerCase();
    if (!email) {
      setForgotPasswordError("Enter email");
      return false;
    }

    setForgotPasswordError("");
    setAuthResetLoading(true);
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
    setAuthResetLoading(false);

    if (error) {
      setForgotPasswordError(String(error?.message || "Password reset email failed."));
      return false;
    }

    setForgotPasswordOpen(false);
    setLoginStatus("Check your email. If an account exists for that address, a password reset link has been sent.");
    return true;
  }, [forgotPasswordEmail]);

  const signOutPlatformAdmin = useCallback(async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
    setOpenControlPlaneDropdown("");
    setIsPlatformAdmin(false);
    setPlatformAccessRole("");
    setLoginPassword("");
    setControlPlaneSection("reports");
    setControlPlanePage(DEFAULT_CONTROL_PLANE_PAGE);
    setEntryStep("start");
  }, []);

  const openAddTenantStep = useCallback(() => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, tenant: "Only Platform Owner can create a tenant." }));
      return;
    }
    setControlPlaneSection("organizations");
    setControlPlanePage("manage-organizations");
    setOpenControlPlaneDropdown("");
    setEntryStep("add");
    setAddTenantStep(ADD_TENANT_STEPS[0].key);
    setActiveTab("tenants");
    setTenantForm(initialTenantForm());
    setProfileForm(initialProfileForm());
    setUserAssignmentMode("existing");
    setUserSearchQuery("");
    setUserSearchResults([]);
    setInviteForm({ first_name: "", last_name: "", email: "", phone: "" });
    setAssignForm({ tenant_key: "", user_id: "", role: "tenant_employee" });
    setIsEditingTenant(true);
    setIsEditingProfile(true);
    setStatus((prev) => ({ ...prev, tenant: "", profile: "", users: "", hydrate: "" }));
  }, [canEditTenantCore]);

  const openTenantWorkspace = useCallback((tenantKey) => {
    const key = sanitizeTenantKey(tenantKey);
    if (!key) {
      setStatus((prev) => ({ ...prev, hydrate: "No tenants found yet. Use Add Tenant to create one." }));
      return;
    }
    setControlPlaneSection("organizations");
    setControlPlanePage("manage-organizations");
    setOpenControlPlaneDropdown("");
    setSelectedTenantKey(key);
    setEntryStep("tenant");
    setAddTenantStep(ADD_TENANT_STEPS[0].key);
    setActiveTab("tenants");
    setUserAssignmentMode("existing");
    setUserSearchQuery("");
    setUserSearchResults([]);
    setInviteForm({ first_name: "", last_name: "", email: "", phone: "" });
    setAssignForm((prev) => ({ ...prev, user_id: "", role: prev.role || "tenant_employee" }));
    setIsEditingTenant(false);
    setIsEditingProfile(false);
    setStatus((prev) => ({ ...prev, users: "", hydrate: "" }));
  }, []);

  const returnToStart = useCallback(() => {
    setControlPlaneSection("reports");
    setControlPlanePage(DEFAULT_CONTROL_PLANE_PAGE);
    setOpenControlPlaneDropdown("");
    setEntryStep("start");
    setAddTenantStep(ADD_TENANT_STEPS[0].key);
    setTenantSearch("");
    setUserAssignmentMode("existing");
    setUserSearchQuery("");
    setUserSearchResults([]);
    setInviteForm({ first_name: "", last_name: "", email: "", phone: "" });
    setIsEditingTenant(false);
    setIsEditingProfile(false);
    setStatus((prev) => ({ ...prev, users: "", hydrate: "" }));
  }, []);

  const openControlPlaneSection = useCallback((sectionKey) => {
    const nextSection = String(sectionKey || "").trim();
    if (!nextSection) return;
    const nextPages = visibleControlPlanePagesBySection[nextSection] || [];
    if (!nextPages.length) return;
    setOpenControlPlaneDropdown((prev) => (prev === nextSection ? "" : nextSection));
  }, [visibleControlPlanePagesBySection]);

  const openControlPlanePage = useCallback((pageKey) => {
    const nextPage = CONTROL_PLANE_PAGES.find((page) => page.key === pageKey);
    if (!nextPage || !canAccessControlPlanePage(nextPage.key)) return;
    setControlPlaneSection(nextPage.section);
    setControlPlanePage(nextPage.key);
    setOpenControlPlaneDropdown("");
  }, [canAccessControlPlanePage]);

  const searchPlatformUsers = useCallback(async (event) => {
    event.preventDefault();
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, users: "Only Platform Owner can search tenant users from this control plane." }));
      return;
    }

    const query = String(userSearchQuery || "").trim();
    if (query.length < 2) {
      setUserSearchResults([]);
      setAssignForm((prev) => ({ ...prev, user_id: "" }));
      setStatus((prev) => ({ ...prev, users: "Enter an exact email, exact phone number, or the full name for the account you want to find." }));
      return;
    }

    setUserSearchLoading(true);
    setStatus((prev) => ({ ...prev, users: "" }));
    const { data, error } = await invokePlatformUserAdmin({
      action: "search",
      query,
    });
    setUserSearchLoading(false);

    if (error) {
      setUserSearchResults([]);
      setStatus((prev) => ({ ...prev, users: statusText(error, "") }));
      return;
    }

    const rows = Array.isArray(data?.results) ? data.results : [];
    setUserSearchResults(rows);
    if (!rows.length) {
      setAssignForm((prev) => ({ ...prev, user_id: "" }));
      setStatus((prev) => ({ ...prev, users: "No matching account was found. Use Create Account if this person is new." }));
      return;
    }

    setStatus((prev) => ({ ...prev, users: `Found ${rows.length} matching account${rows.length === 1 ? "" : "s"}.` }));
  }, [canEditTenantCore, invokePlatformUserAdmin, userSearchQuery]);

  const searchPlatformTeamUsers = useCallback(async (event) => {
    event.preventDefault();
    if (!isPlatformOwner) {
      setPlatformTeamStatus("Only Platform Owner can manage the internal team.");
      return;
    }

    const query = String(platformUserSearchQuery || "").trim();
    if (query.length < 2) {
      setPlatformUserSearchResults([]);
      setPlatformTeamForm((prev) => ({ ...prev, user_id: "" }));
      setPlatformTeamStatus("Enter an exact email, exact phone number, or full name to find a platform team member.");
      return;
    }

    setPlatformUserSearchLoading(true);
    setPlatformTeamStatus("");
    const { data, error } = await invokePlatformUserAdmin({
      action: "search",
      query,
    });
    setPlatformUserSearchLoading(false);

    if (error) {
      setPlatformUserSearchResults([]);
      setPlatformTeamStatus(statusText(error, ""));
      return;
    }

    const rows = Array.isArray(data?.results) ? data.results : [];
    setPlatformUserSearchResults(rows);
    if (!rows.length) {
      setPlatformTeamForm((prev) => ({ ...prev, user_id: "" }));
      setPlatformTeamStatus("No matching internal account was found.");
      return;
    }

    setPlatformTeamStatus(`Found ${rows.length} matching account${rows.length === 1 ? "" : "s"}.`);
  }, [invokePlatformUserAdmin, isPlatformOwner, platformUserSearchQuery]);

  const assignPlatformRole = useCallback(async () => {
    if (!isPlatformOwner) {
      setPlatformTeamStatus("Only Platform Owner can assign platform roles.");
      return;
    }
    const userId = String(platformTeamForm.user_id || "").trim();
    const role = String(platformTeamForm.role || "").trim();
    if (!userId || !role) {
      setPlatformTeamStatus("Select an account and choose a platform role.");
      return;
    }
    const { error } = await supabase
      .from("platform_user_roles")
      .upsert([{ user_id: userId, role, status: "active", assigned_by: sessionUserId }], { onConflict: "user_id,role" });
    if (error) {
      setPlatformTeamStatus(statusText(error, ""));
      return;
    }
    setPlatformTeamStatus("Platform role assigned.");
    setPlatformTeamForm({ user_id: "", role });
    setPlatformUserSearchQuery("");
    setPlatformUserSearchResults([]);
    await loadPlatformTeamAssignments();
  }, [isPlatformOwner, loadPlatformTeamAssignments, platformTeamForm.role, platformTeamForm.user_id, sessionUserId]);

  const removePlatformRole = useCallback(async (row) => {
    if (!isPlatformOwner) {
      setPlatformTeamStatus("Only Platform Owner can remove platform roles.");
      return;
    }
    const userId = String(row?.user_id || "").trim();
    const role = String(row?.role || "").trim();
    if (!userId || !role) return;
    if (role === "platform_owner" && String(userId) === String(sessionUserId)) {
      setPlatformTeamStatus("You cannot remove your own Platform Owner role from this screen.");
      return;
    }
    const { error } = await supabase
      .from("platform_user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    if (error) {
      setPlatformTeamStatus(statusText(error, ""));
      return;
    }
    setPlatformTeamStatus("Platform role removed.");
    await loadPlatformTeamAssignments();
  }, [isPlatformOwner, loadPlatformTeamAssignments, sessionUserId]);

  const updateLeadDraft = useCallback((leadId, field, value) => {
    const key = String(leadId || "").trim();
    if (!key) return;
    setLeadDraftById((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
      },
    }));
  }, []);

  const saveLeadUpdate = useCallback(async (leadRow) => {
    if (!canEditTenantOperational) {
      setLeadStatus("Your platform role does not allow lead updates.");
      return;
    }
    const leadId = String(leadRow?.id || "").trim();
    if (!leadId) return;
    const draft = leadDraftById[leadId] || {};
    const payload = {
      status: String(draft.status ?? leadRow?.status ?? "new").trim() || "new",
      internal_notes: String(draft.internal_notes ?? leadRow?.internal_notes ?? "").trim() || null,
      follow_up_on: String(draft.follow_up_on ?? leadRow?.follow_up_on ?? "").trim() || null,
      last_follow_up_at: draft.mark_follow_up ? new Date().toISOString() : (leadRow?.last_follow_up_at || null),
    };
    setLeadLoading(true);
    const { error } = await supabase
      .from("client_leads")
      .update(payload)
      .eq("id", leadId);
    setLeadLoading(false);
    if (error) {
      setLeadStatus(statusText(error, ""));
      return;
    }
    setLeadStatus(`Saved lead updates for ${String(leadRow?.full_name || "").trim() || leadId}.`);
    setLeadDraftById((prev) => {
      const next = { ...prev };
      delete next[leadId];
      return next;
    });
    await loadClientLeads();
  }, [canEditTenantOperational, leadDraftById, loadClientLeads]);

  const createAndAssignTenantUser = useCallback(async (event) => {
    event.preventDefault();
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, users: "Only Platform Owner can create tenant users from this control plane." }));
      return;
    }

    const tenant_key = sanitizeTenantKey(selectedTenantKey);
    const role = String(assignForm.role || "").trim().toLowerCase() || String(assignableTenantRoles?.[0]?.role || "tenant_employee");
    const first_name = String(inviteForm.first_name || "").trim();
    const last_name = String(inviteForm.last_name || "").trim();
    const email = String(inviteForm.email || "").trim().toLowerCase();
    const phone = String(inviteForm.phone || "").trim();

    if (!tenant_key || !role || !first_name || !last_name || !email) {
      setStatus((prev) => ({ ...prev, users: "First name, last name, email, and role are required." }));
      return;
    }

    const { data, error } = await invokePlatformUserAdmin({
      action: "invite_and_assign",
      tenant_key,
      role,
      first_name,
      last_name,
      email,
      phone,
    });

    if (error) {
      setStatus((prev) => ({ ...prev, users: statusText(error, "") }));
      return;
    }

    const createdUserId = String(data?.user?.id || "").trim();
    const inviteSent = data?.inviteSent === true;
    await logAudit({
      tenant_key,
      action: "tenant_user_role_assigned",
      entity_type: "tenant_user_role",
      entity_id: createdUserId || email,
      details: {
        role,
        email,
        phone: phone || null,
        invited: inviteSent,
      },
    });

    setInviteForm({ first_name: "", last_name: "", email: "", phone: "" });
    setAssignForm((prev) => ({ ...prev, user_id: "", role }));
    setUserAssignmentMode("existing");
    setUserSearchQuery(email);
    setUserSearchResults([]);
    setStatus((prev) => ({
      ...prev,
      users: inviteSent
        ? `Created account invitation for ${email} and assigned ${roleKeyToLabel(role)}.`
        : `Assigned ${roleKeyToLabel(role)} to existing account ${email}.`,
    }));
    await refreshControlPlaneData();
  }, [canEditTenantCore, selectedTenantKey, assignForm.role, assignableTenantRoles, inviteForm, invokePlatformUserAdmin, logAudit, refreshControlPlaneData]);

  useEffect(() => {
    let cancelled = false;
    async function checkPlatformAdmin() {
      if (!authReady || !sessionUserId) {
        setIsPlatformAdmin(false);
        setPlatformAccessRole("");
        return;
      }

      const isMissingRoleTableError = (error) => {
        const code = String(error?.code || "").trim().toUpperCase();
        const msg = String(error?.message || "").toLowerCase();
        return code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
      };

      const [platformRoleResult, legacyAdminResult] = await Promise.all([
        supabase
          .from("platform_user_roles")
          .select("role,status")
          .eq("user_id", sessionUserId)
          .eq("status", "active"),
        supabase
          .from("admins")
          .select("user_id")
          .eq("user_id", sessionUserId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const platformRoleError = platformRoleResult?.error;
      const legacyAdminError = legacyAdminResult?.error;
      if (platformRoleError && !isMissingRoleTableError(platformRoleError)) {
        setIsPlatformAdmin(false);
        setPlatformAccessRole("");
        return;
      }
      if (legacyAdminError && !isMissingRoleTableError(legacyAdminError)) {
        setIsPlatformAdmin(false);
        setPlatformAccessRole("");
        return;
      }

      const roles = Array.isArray(platformRoleResult?.data) ? platformRoleResult.data : [];
      const hasOwner = roles.some((row) => String(row?.role || "").trim().toLowerCase() === "platform_owner");
      const hasStaff = roles.some((row) => String(row?.role || "").trim().toLowerCase() === "platform_staff");
      const hasLegacyAdmin = Boolean(legacyAdminResult?.data?.user_id);

      if (hasOwner || hasLegacyAdmin) {
        setIsPlatformAdmin(true);
        setPlatformAccessRole(hasOwner ? "platform_owner" : "legacy_admin");
        return;
      }
      if (hasStaff) {
        setIsPlatformAdmin(true);
        setPlatformAccessRole("platform_staff");
        return;
      }

      setIsPlatformAdmin(false);
      setPlatformAccessRole("");
    }
    checkPlatformAdmin();
    return () => {
      cancelled = true;
    };
  }, [authReady, sessionUserId]);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    void refreshControlPlaneData();
  }, [isPlatformAdmin, refreshControlPlaneData]);

  useEffect(() => {
    if (!currentPlatformRoleKey) return;
    const currentPageAllowed = canAccessControlPlanePage(controlPlanePage);
    const currentSectionAllowedPages = CONTROL_PLANE_PAGES.filter(
      (page) => page.section === controlPlaneSection && canAccessControlPlanePage(page.key)
    );

    if (!currentPageAllowed) {
      const fallbackPage = currentSectionAllowedPages[0]?.key
        || CONTROL_PLANE_PAGES.find((page) => canAccessControlPlanePage(page.key))?.key
        || DEFAULT_CONTROL_PLANE_PAGE;
      const fallbackSection = CONTROL_PLANE_PAGES.find((page) => page.key === fallbackPage)?.section || "reports";
      if (fallbackSection !== controlPlaneSection) setControlPlaneSection(fallbackSection);
      if (fallbackPage !== controlPlanePage) setControlPlanePage(fallbackPage);
      return;
    }

    if (!currentSectionAllowedPages.some((page) => page.key === controlPlanePage)) {
      const nextPage = currentSectionAllowedPages[0]?.key;
      if (nextPage && nextPage !== controlPlanePage) {
        setControlPlanePage(nextPage);
      }
    }
  }, [canAccessControlPlanePage, controlPlanePage, controlPlaneSection, currentPlatformRoleKey]);

  useEffect(() => {
    if (!tenantOptions.length) return;
    if (!tenantOptions.includes(selectedTenantKey)) {
      setSelectedTenantKey(tenantOptions[0]);
    }
  }, [tenantOptions, selectedTenantKey]);

  useEffect(() => {
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
    setDeleteLoading(false);
  }, [selectedTenantKey]);

  useEffect(() => {
    if (entryStep !== "tenant") return;
    if (isEditingTenant) return;
    if (!selectedTenant) return;
    setTenantForm({
      tenant_key: String(selectedTenant.tenant_key || ""),
      name: String(selectedTenant.name || ""),
      primary_subdomain: String(selectedTenant.primary_subdomain || ""),
      boundary_config_key: String(selectedTenant.boundary_config_key || ""),
      notification_email_potholes: String(selectedTenant.notification_email_potholes || ""),
      notification_email_water_drain: String(selectedTenant.notification_email_water_drain || ""),
      resident_portal_enabled: Boolean(selectedTenant.resident_portal_enabled),
      is_pilot: Boolean(selectedTenant.is_pilot),
      active: Boolean(selectedTenant.active),
    });
  }, [entryStep, isEditingTenant, selectedTenant]);

  useEffect(() => {
    const key = sanitizeTenantKey(selectedTenantKey);
    if (!key) return;

    const profile = tenantProfilesByTenant?.[key] || null;
    setProfileForm(profileRowToForm(profile));

    const visibility = tenantVisibilityByTenant?.[key] || {};
    const nextVisibility = initialDomainVisibilityForm();
    for (const d of DOMAIN_OPTIONS) {
      const configured = String(visibility?.[d.key] || "").trim().toLowerCase();
      nextVisibility[d.key] = configured === "internal_only" ? "disabled" : "enabled";
    }
    setDomainVisibilityForm(nextVisibility);

    const features = tenantMapFeaturesByTenant?.[key] || null;
    if (features) {
      setMapFeaturesForm({
        show_boundary_border: features.show_boundary_border !== false,
        shade_outside_boundary: features.shade_outside_boundary !== false,
        outside_shade_opacity: String(Number.isFinite(Number(features.outside_shade_opacity)) ? Number(features.outside_shade_opacity) : 0.42),
        boundary_border_color: sanitizeHexColor(features.boundary_border_color, "#e53935"),
        boundary_border_width: String(Number.isFinite(Number(features.boundary_border_width)) ? Math.max(0.5, Math.min(8, Number(features.boundary_border_width))) : 4),
      });
    } else {
      setMapFeaturesForm(initialMapFeaturesForm());
    }

    void loadTenantFiles(key).catch((error) => {
      setStatus((prev) => ({ ...prev, files: statusText(error, "") }));
    });
    void loadTenantRoleConfig(key).catch((error) => {
      setStatus((prev) => ({ ...prev, roles: statusText(error, "") }));
    });
    void loadAudit(key).catch((error) => {
      setStatus((prev) => ({ ...prev, audit: statusText(error, "") }));
    });
  }, [selectedTenantKey, tenantProfilesByTenant, tenantVisibilityByTenant, tenantMapFeaturesByTenant, loadTenantFiles, loadTenantRoleConfig, loadAudit]);

  useEffect(() => {
    if (!sortedTenantRoleDefinitions.length) {
      setSelectedRoleKey("");
      return;
    }
    if (!sortedTenantRoleDefinitions.some((row) => String(row?.role || "") === String(selectedRoleKey || ""))) {
      setSelectedRoleKey(String(sortedTenantRoleDefinitions[0]?.role || ""));
    }
  }, [sortedTenantRoleDefinitions, selectedRoleKey]);

  useEffect(() => {
    void loadAssignmentUserSummaries();
  }, [loadAssignmentUserSummaries]);

  useEffect(() => {
    void loadPlatformTeamUserSummaries();
  }, [loadPlatformTeamUserSummaries]);

  useEffect(() => {
    if (!assignableTenantRoles.length) return;
    if (!assignableTenantRoles.some((row) => String(row?.role || "") === String(assignForm.role || ""))) {
      setAssignForm((prev) => ({ ...prev, role: String(assignableTenantRoles[0]?.role || "tenant_employee") }));
    }
  }, [assignableTenantRoles, assignForm.role]);

  useEffect(() => {
    if (!selectedRoleKey) {
      setRolePermissionDraft({});
      setRolePermissionDirty(false);
      return;
    }
    const nextDraft = {};
    for (const permissionKey of DEFAULT_TENANT_PERMISSION_KEYS) {
      nextDraft[permissionKey] = Boolean(rolePermissionMap[`${selectedRoleKey}:${permissionKey}`]);
    }
    setRolePermissionDraft(nextDraft);
    setRolePermissionDirty(false);
  }, [selectedRoleKey, rolePermissionMap]);

  const persistTenantRecord = useCallback(async ({ tenantKeyOverride } = {}) => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, tenant: "Only Platform Owner can create or modify core tenant records." }));
      return { ok: false, tenantKey: "" };
    }
    const resolvedTenantKey = tenantKeyOverride
      ? sanitizeTenantKey(tenantKeyOverride)
      : entryStep === "tenant"
      ? sanitizeTenantKey(selectedTenantKey)
      : sanitizeTenantKey(tenantForm.tenant_key);
    const defaultBoundaryKey = buildDefaultBoundaryKey(resolvedTenantKey);
    const payload = {
      tenant_key: resolvedTenantKey,
      name: String(tenantForm.name || "").trim(),
      primary_subdomain: normalizePrimarySubdomain(tenantForm.primary_subdomain),
      boundary_config_key: String(tenantForm.boundary_config_key || defaultBoundaryKey).trim() || defaultBoundaryKey,
      notification_email_potholes: cleanOptional(tenantForm.notification_email_potholes),
      notification_email_water_drain: cleanOptional(tenantForm.notification_email_water_drain),
      resident_portal_enabled: Boolean(tenantForm.resident_portal_enabled),
      is_pilot: Boolean(tenantForm.is_pilot),
      active: Boolean(tenantForm.active),
    };

    if (!payload.tenant_key || !payload.name || !payload.primary_subdomain) {
      setStatus((prev) => ({ ...prev, tenant: "Tenant key, name, and primary subdomain are required." }));
      return { ok: false, tenantKey: "" };
    }

    const { error } = await supabase.from("tenants").upsert([payload], { onConflict: "tenant_key" });
    if (error) {
      setStatus((prev) => ({ ...prev, tenant: statusText(error, "") }));
      return { ok: false, tenantKey: payload.tenant_key };
    }

    await logAudit({
      tenant_key: payload.tenant_key,
      action: "tenant_upsert",
      entity_type: "tenant",
      entity_id: payload.tenant_key,
      details: {
        primary_subdomain: payload.primary_subdomain,
        boundary_config_key: payload.boundary_config_key,
        resident_portal_enabled: payload.resident_portal_enabled,
        is_pilot: payload.is_pilot,
        active: payload.active,
      },
    });

    setStatus((prev) => ({ ...prev, tenant: `Saved tenant ${payload.tenant_key}.` }));
    return { ok: true, tenantKey: payload.tenant_key };
  }, [canEditTenantCore, entryStep, selectedTenantKey, tenantForm, logAudit]);

  const persistTenantProfileRecord = useCallback(async ({ tenantKeyOverride } = {}) => {
    const key = tenantKeyOverride
      ? sanitizeTenantKey(tenantKeyOverride)
      : entryStep === "add"
        ? sanitizeTenantKey(tenantForm.tenant_key)
        : sanitizeTenantKey(selectedTenantKey);
    if (entryStep === "add") {
      // onboarding saves the profile after the tenant record exists
    }
    if (!canEditTenantOperational) {
      setStatus((prev) => ({ ...prev, profile: "Your platform role does not permit tenant profile changes." }));
      return { ok: false };
    }
    if (!key) {
      setStatus((prev) => ({ ...prev, profile: "Select a tenant first." }));
      return { ok: false };
    }
    if (!String(profileForm.legal_name || "").trim()) {
      setStatus((prev) => ({ ...prev, profile: "Legal organization name is required." }));
      return { ok: false };
    }
    if (!String(profileForm.contact_primary_email || "").trim()) {
      setStatus((prev) => ({ ...prev, profile: "Primary contact email is required." }));
      return { ok: false };
    }

    const additionalContacts = normalizeAdditionalContacts(profileForm.additional_contacts);

    const payload = {
      tenant_key: key,
      organization_type: String(profileForm.organization_type || "municipality").trim() || "municipality",
      legal_name: cleanOptional(profileForm.legal_name),
      display_name: cleanOptional(profileForm.display_name),
      mailing_address: cleanOptional(composeMailingAddress(profileForm)),
      mailing_address_1: cleanOptional(profileForm.mailing_address_1),
      mailing_address_2: cleanOptional(profileForm.mailing_address_2),
      mailing_city: cleanOptional(profileForm.mailing_city),
      mailing_state: cleanOptional(profileForm.mailing_state),
      mailing_zip: cleanOptional(profileForm.mailing_zip),
      website_url: cleanOptional(profileForm.website_url),
      url_extension: cleanOptional(profileForm.url_extension),
      billing_email: cleanOptional(profileForm.billing_email),
      timezone: String(profileForm.timezone || "America/New_York").trim() || "America/New_York",
      contact_primary_name: cleanOptional(profileForm.contact_primary_name),
      contact_primary_title: cleanOptional(profileForm.contact_primary_title),
      contact_primary_email: cleanOptional(profileForm.contact_primary_email),
      contact_primary_phone: cleanOptional(profileForm.contact_primary_phone),
      contact_technical_name: null,
      contact_technical_email: null,
      contact_technical_phone: null,
      contact_legal_name: null,
      contact_legal_email: null,
      contact_legal_phone: null,
      additional_contacts: additionalContacts,
      contract_status: String(profileForm.contract_status || "pending").trim() || "pending",
      contract_start_date: cleanOptional(profileForm.contract_start_date),
      contract_end_date: cleanOptional(profileForm.contract_end_date),
      renewal_date: cleanOptional(profileForm.renewal_date),
      notes: cleanOptional(profileForm.notes),
    };

    const { error } = await supabase
      .from("tenant_profiles")
      .upsert([payload], { onConflict: "tenant_key" });
    if (error) {
      setStatus((prev) => ({ ...prev, profile: statusText(error, "") }));
      return { ok: false };
    }

    await logAudit({
      tenant_key: key,
      action: "tenant_profile_upsert",
      entity_type: "tenant_profile",
      entity_id: key,
      details: {
        contract_status: payload.contract_status,
        contact_primary_email: payload.contact_primary_email,
        additional_contact_count: additionalContacts.length,
      },
    });

    setStatus((prev) => ({ ...prev, profile: `Saved intake profile for ${key}.` }));
    return { ok: true, tenantKey: key };
  }, [canEditTenantOperational, entryStep, profileForm, selectedTenantKey, tenantForm.tenant_key, logAudit]);

  const saveTenant = useCallback(async (event) => {
    event.preventDefault();
    const result = await persistTenantRecord();
    if (!result.ok) return;
    if (entryStep === "add") {
      setTenantForm(initialTenantForm());
      setIsEditingTenant(true);
    } else {
      setIsEditingTenant(false);
    }
    setSelectedTenantKey(result.tenantKey);
    await refreshControlPlaneData();
  }, [entryStep, persistTenantRecord, refreshControlPlaneData]);

  const cancelTenantEditing = useCallback(() => {
    if (!selectedTenant) return;
    setTenantForm({
      tenant_key: String(selectedTenant.tenant_key || ""),
      name: String(selectedTenant.name || ""),
      primary_subdomain: String(selectedTenant.primary_subdomain || ""),
      boundary_config_key: String(selectedTenant.boundary_config_key || ""),
      notification_email_potholes: String(selectedTenant.notification_email_potholes || ""),
      notification_email_water_drain: String(selectedTenant.notification_email_water_drain || ""),
      resident_portal_enabled: Boolean(selectedTenant.resident_portal_enabled),
      is_pilot: Boolean(selectedTenant.is_pilot),
      active: Boolean(selectedTenant.active),
    });
    setIsEditingTenant(false);
  }, [selectedTenant]);

  const saveTenantProfile = useCallback(async (event) => {
    event.preventDefault();
    const result = await persistTenantProfileRecord();
    if (!result.ok) return;
    setIsEditingProfile(false);
    await refreshControlPlaneData();
  }, [persistTenantProfileRecord, refreshControlPlaneData]);

  const finishAddTenantSetup = useCallback(async (event) => {
    event.preventDefault();
    const tenantResult = await persistTenantRecord({ tenantKeyOverride: tenantForm.tenant_key });
    if (!tenantResult.ok) return;
    const profileResult = await persistTenantProfileRecord({ tenantKeyOverride: tenantResult.tenantKey });
    if (!profileResult.ok) return;
    setSelectedTenantKey(tenantResult.tenantKey);
    setEntryStep("tenant");
    setActiveTab("tenants");
    setIsEditingTenant(false);
    setIsEditingProfile(false);
    await refreshControlPlaneData();
  }, [persistTenantProfileRecord, persistTenantRecord, refreshControlPlaneData, tenantForm.tenant_key]);

  const scheduleOrganizationDeletion = useCallback(async () => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, tenant: "Only Platform Owner can schedule organization deletion." }));
      return;
    }
    const tenantKey = sanitizeTenantKey(selectedTenantKey);
    if (!tenantKey || !selectedTenant) {
      setStatus((prev) => ({ ...prev, tenant: "Select an organization first." }));
      return;
    }
    if (deleteConfirmText !== tenantKey) {
      setStatus((prev) => ({ ...prev, tenant: `Type ${tenantKey} exactly to confirm the 30-day deletion hold.` }));
      return;
    }

    const scheduledFor = new Date();
    scheduledFor.setDate(scheduledFor.getDate() + ORGANIZATION_DELETION_HOLD_DAYS);

    setDeleteLoading(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        deletion_requested_at: new Date().toISOString(),
        deletion_scheduled_for: scheduledFor.toISOString(),
        deletion_requested_by: cleanOptional(sessionUserId),
        active_before_deletion: selectedTenant?.active !== false,
        active: false,
      })
      .eq("tenant_key", tenantKey);

    setDeleteLoading(false);
    if (error) {
      setStatus((prev) => ({ ...prev, tenant: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key: tenantKey,
      action: "tenant_deletion_scheduled",
      entity_type: "tenant",
      entity_id: tenantKey,
      details: {
        scheduled_for: scheduledFor.toISOString(),
        hold_days: ORGANIZATION_DELETION_HOLD_DAYS,
      },
    });

    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
    setStatus((prev) => ({
      ...prev,
      tenant: `Scheduled ${tenantKey} for deletion on ${formatDateTimeDisplay(scheduledFor.toISOString())}. Organization data will be held for ${ORGANIZATION_DELETION_HOLD_DAYS} days before deletion.`,
    }));
    await refreshControlPlaneData();
  }, [canEditTenantCore, deleteConfirmText, refreshControlPlaneData, selectedTenant, selectedTenantKey, sessionUserId, logAudit]);

  const cancelOrganizationDeletion = useCallback(async () => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, tenant: "Only Platform Owner can cancel organization deletion." }));
      return;
    }
    const tenantKey = sanitizeTenantKey(selectedTenantKey);
    if (!tenantKey || !selectedTenantPendingDeletion) {
      setStatus((prev) => ({ ...prev, tenant: "No scheduled organization deletion is active." }));
      return;
    }

    setDeleteLoading(true);
    const { error } = await supabase
      .from("tenants")
      .update({
        deletion_requested_at: null,
        deletion_scheduled_for: null,
        deletion_requested_by: null,
        active: selectedTenant?.active_before_deletion === null || selectedTenant?.active_before_deletion === undefined
          ? selectedTenant?.active !== false
          : Boolean(selectedTenant?.active_before_deletion),
        active_before_deletion: null,
      })
      .eq("tenant_key", tenantKey);
    setDeleteLoading(false);

    if (error) {
      setStatus((prev) => ({ ...prev, tenant: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key: tenantKey,
      action: "tenant_deletion_cancelled",
      entity_type: "tenant",
      entity_id: tenantKey,
      details: {
        cancelled_by: cleanOptional(sessionUserId),
      },
    });

    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
    setStatus((prev) => ({ ...prev, tenant: `Cancelled the scheduled deletion hold for ${tenantKey}.` }));
    await refreshControlPlaneData();
  }, [canEditTenantCore, logAudit, refreshControlPlaneData, selectedTenant, selectedTenantKey, selectedTenantPendingDeletion, sessionUserId]);

  const saveDomainAndFeatureSettings = useCallback(async (event) => {
    event.preventDefault();
    if (!canEditTenantOperational) {
      setStatus((prev) => ({ ...prev, domains: "Your platform role does not permit domain/feature updates." }));
      return;
    }
    const key = sanitizeTenantKey(selectedTenantKey);
    if (!key) {
      setStatus((prev) => ({ ...prev, domains: "Select a tenant first." }));
      return;
    }

    const visibilityRows = DOMAIN_OPTIONS.map((d) => ({
      tenant_key: key,
      domain: d.key,
      visibility: String(domainVisibilityForm?.[d.key] || "enabled").trim().toLowerCase() === "disabled"
        ? "internal_only"
        : "public",
    }));

    const opacityRaw = Number(mapFeaturesForm?.outside_shade_opacity);
    const opacity = Number.isFinite(opacityRaw) ? Math.max(0, Math.min(1, opacityRaw)) : 0.42;
    const borderColor = sanitizeHexColor(mapFeaturesForm?.boundary_border_color, "#e53935");
    const borderWidthRaw = Number(mapFeaturesForm?.boundary_border_width);
    const borderWidth = Number.isFinite(borderWidthRaw) ? Math.max(0.5, Math.min(8, borderWidthRaw)) : 4;
    const mapPayload = {
      tenant_key: key,
      show_boundary_border: Boolean(mapFeaturesForm?.show_boundary_border),
      shade_outside_boundary: Boolean(mapFeaturesForm?.shade_outside_boundary),
      outside_shade_opacity: opacity,
      boundary_border_color: borderColor,
      boundary_border_width: borderWidth,
    };

    const [{ error: visError }, { error: featureError }] = await Promise.all([
      supabase.from("tenant_visibility_config").upsert(visibilityRows, { onConflict: "tenant_key,domain" }),
      supabase.from("tenant_map_features").upsert([mapPayload], { onConflict: "tenant_key" }),
    ]);

    if (visError || featureError) {
      setStatus((prev) => ({ ...prev, domains: statusText(visError || featureError, "") }));
      return;
    }

    await logAudit({
      tenant_key: key,
      action: "tenant_domains_features_upsert",
      entity_type: "tenant_config",
      entity_id: key,
      details: {
        visibility: visibilityRows,
        map_features: mapPayload,
      },
    });

    setStatus((prev) => ({ ...prev, domains: `Saved domain + map settings for ${key}.` }));
    await refreshControlPlaneData();
  }, [canEditTenantOperational, selectedTenantKey, domainVisibilityForm, mapFeaturesForm, logAudit, refreshControlPlaneData]);

  const assignTenantAdmin = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, users: "Only Platform Owner can assign tenant roles from this control plane." }));
      return;
    }
    const tenant_key = sanitizeTenantKey(selectedTenantKey);
    const user_id = String(assignForm.user_id || "").trim();
    const role = String(assignForm.role || "").trim().toLowerCase() || String(assignableTenantRoles?.[0]?.role || "tenant_employee");

    if (!tenant_key || !user_id) {
      setStatus((prev) => ({ ...prev, users: "Select an account before assigning a tenant role." }));
      return;
    }
    if (!role) {
      setStatus((prev) => ({ ...prev, users: "Select a valid tenant role." }));
      return;
    }

    const { error } = await supabase
      .from("tenant_user_roles")
      .upsert([{ tenant_key, user_id, role, status: "active" }], { onConflict: "tenant_key,user_id,role" });
    if (error) {
      setStatus((prev) => ({ ...prev, users: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key,
      action: "tenant_user_role_assigned",
      entity_type: "tenant_user_role",
      entity_id: user_id,
      details: { role },
    });

    const personLabel = formatKnownUserLabel(user_id);
    setStatus((prev) => ({ ...prev, users: `Assigned ${roleKeyToLabel(role)} to ${personLabel}.` }));
    setAssignForm((prev) => ({ ...prev, tenant_key: "", user_id: "", role }));
    await refreshControlPlaneData();
  }, [canEditTenantCore, assignForm, assignableTenantRoles, selectedTenantKey, logAudit, refreshControlPlaneData, formatKnownUserLabel]);

  const removeTenantAdmin = useCallback(async (row) => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, users: "Only Platform Owner can remove tenant roles from this control plane." }));
      return;
    }
    const tenant_key = sanitizeTenantKey(row?.tenant_key);
    const user_id = String(row?.user_id || "").trim();
    const role = String(row?.role || "").trim().toLowerCase();
    if (!tenant_key || !user_id || !role) return;

    const { error } = await supabase
      .from("tenant_user_roles")
      .delete()
      .eq("tenant_key", tenant_key)
      .eq("user_id", user_id)
      .eq("role", role);
    if (error) {
      setStatus((prev) => ({ ...prev, users: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key,
      action: "tenant_user_role_removed",
      entity_type: "tenant_user_role",
      entity_id: user_id,
      details: {},
    });

    const personLabel = formatKnownUserLabel(user_id);
    setStatus((prev) => ({ ...prev, users: `Removed ${roleKeyToLabel(role)} from ${personLabel}.` }));
    await refreshControlPlaneData();
  }, [canEditTenantCore, logAudit, refreshControlPlaneData, formatKnownUserLabel]);

  const saveTenantAdminRoleEdit = useCallback(async (row) => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, users: "Only Platform Owner can edit tenant roles from this control plane." }));
      return;
    }

    const tenant_key = sanitizeTenantKey(row?.tenant_key);
    const user_id = String(row?.user_id || "").trim();
    const previousRole = String(row?.role || "").trim().toLowerCase();
    const nextRole = String(editingAssignmentRole || "").trim().toLowerCase();
    if (!tenant_key || !user_id || !previousRole || !nextRole) {
      setStatus((prev) => ({ ...prev, users: "Select a valid tenant role." }));
      return;
    }

    if (previousRole === nextRole) {
      setEditingAssignmentKey("");
      setEditingAssignmentRole("");
      return;
    }

    const { error: deleteError } = await supabase
      .from("tenant_user_roles")
      .delete()
      .eq("tenant_key", tenant_key)
      .eq("user_id", user_id)
      .eq("role", previousRole);
    if (deleteError) {
      setStatus((prev) => ({ ...prev, users: statusText(deleteError, "") }));
      return;
    }

    const { error: insertError } = await supabase
      .from("tenant_user_roles")
      .upsert([{ tenant_key, user_id, role: nextRole, status: "active" }], { onConflict: "tenant_key,user_id,role" });
    if (insertError) {
      setStatus((prev) => ({ ...prev, users: statusText(insertError, "") }));
      return;
    }

    await logAudit({
      tenant_key,
      action: "tenant_user_role_changed",
      entity_type: "tenant_user_role",
      entity_id: user_id,
      details: {
        previous_role: previousRole,
        role: nextRole,
      },
    });

    const personLabel = formatKnownUserLabel(user_id);
    setEditingAssignmentKey("");
    setEditingAssignmentRole("");
    setStatus((prev) => ({ ...prev, users: `Updated ${personLabel} to ${roleKeyToLabel(nextRole)}.` }));
    await refreshControlPlaneData();
  }, [canEditTenantCore, editingAssignmentRole, logAudit, refreshControlPlaneData, formatKnownUserLabel]);

  const createTenantRole = useCallback(async (event) => {
    event.preventDefault();
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, roles: "Only Platform Owner can create roles." }));
      return;
    }

    const tenant_key = sanitizeTenantKey(selectedTenantKey);
    const role = sanitizeRoleKey(roleForm.role);
    const role_label = toOrganizationLanguage(String(roleForm.role_label || "").trim() || roleKeyToLabel(role));
    if (!tenant_key) {
      setStatus((prev) => ({ ...prev, roles: "Select a tenant first." }));
      return;
    }
    if (!role) {
      setStatus((prev) => ({ ...prev, roles: "Role key is required (example: field_supervisor)." }));
      return;
    }
    if (sortedTenantRoleDefinitions.some((row) => String(row?.role || "") === role)) {
      setStatus((prev) => ({ ...prev, roles: `Role ${role} already exists for ${tenant_key}.` }));
      return;
    }

    const { error: roleInsertError } = await supabase
      .from("tenant_role_definitions")
      .insert([{
        tenant_key,
        role,
        role_label,
        is_system: false,
        active: true,
        created_by: cleanOptional(sessionUserId),
      }]);
    if (roleInsertError) {
      setStatus((prev) => ({ ...prev, roles: statusText(roleInsertError, "") }));
      return;
    }

    const permissionRows = DEFAULT_TENANT_PERMISSION_KEYS.map((permission_key) => ({
      tenant_key,
      role,
      permission_key,
      allowed: false,
      updated_by: cleanOptional(sessionUserId),
    }));

    const { error: permissionSeedError } = await supabase
      .from("tenant_role_permissions")
      .upsert(permissionRows, { onConflict: "tenant_key,role,permission_key" });
    if (permissionSeedError) {
      setStatus((prev) => ({ ...prev, roles: statusText(permissionSeedError, "") }));
      return;
    }

    await logAudit({
      tenant_key,
      action: "tenant_role_created",
      entity_type: "tenant_role",
      entity_id: role,
      details: { role_label },
    });

    setRoleForm({ role: "", role_label: "" });
    setSelectedRoleKey(role);
    setStatus((prev) => ({ ...prev, roles: `Created role ${role} for ${tenant_key}.` }));
    await loadTenantRoleConfig(tenant_key);
  }, [canEditTenantCore, selectedTenantKey, roleForm, sortedTenantRoleDefinitions, sessionUserId, logAudit, loadTenantRoleConfig]);

  const removeTenantRole = useCallback(async (row) => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, roles: "Only Platform Owner can remove roles." }));
      return;
    }
    const tenant_key = sanitizeTenantKey(row?.tenant_key || selectedTenantKey);
    const role = String(row?.role || "").trim().toLowerCase();
    if (!tenant_key || !role) return;
    if (row?.is_system === true) {
      setStatus((prev) => ({ ...prev, roles: "System roles cannot be removed." }));
      return;
    }
    const assignmentCount = Number(tenantRoleAssignmentCounts?.[role] || 0);
    if (assignmentCount > 0) {
      setStatus((prev) => ({ ...prev, roles: `Remove or reassign ${assignmentCount} user assignment(s) for ${role} before deleting it.` }));
      return;
    }

    const { error } = await supabase
      .from("tenant_role_definitions")
      .delete()
      .eq("tenant_key", tenant_key)
      .eq("role", role);
    if (error) {
      setStatus((prev) => ({ ...prev, roles: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key,
      action: "tenant_role_removed",
      entity_type: "tenant_role",
      entity_id: role,
      details: {},
    });

    setStatus((prev) => ({ ...prev, roles: `Removed role ${role} from ${tenant_key}.` }));
    await loadTenantRoleConfig(tenant_key);
    await loadTenantAdmins();
  }, [canEditTenantCore, selectedTenantKey, tenantRoleAssignmentCounts, logAudit, loadTenantRoleConfig, loadTenantAdmins]);

  const saveRolePermissions = useCallback(async () => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, roles: "Only Platform Owner can update role permissions." }));
      return;
    }
    const tenant_key = sanitizeTenantKey(selectedTenantKey);
    const role = String(selectedRoleKey || "").trim().toLowerCase();
    if (!tenant_key || !role) {
      setStatus((prev) => ({ ...prev, roles: "Select a tenant role first." }));
      return;
    }

    const rows = DEFAULT_TENANT_PERMISSION_KEYS.map((permission_key) => ({
      tenant_key,
      role,
      permission_key,
      allowed: Boolean(rolePermissionDraft?.[permission_key]),
      updated_by: cleanOptional(sessionUserId),
    }));
    const { error } = await supabase
      .from("tenant_role_permissions")
      .upsert(rows, { onConflict: "tenant_key,role,permission_key" });
    if (error) {
      setStatus((prev) => ({ ...prev, roles: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key,
      action: "tenant_role_permissions_saved",
      entity_type: "tenant_role",
      entity_id: role,
      details: {
        permission_count: rows.length,
      },
    });

    setRolePermissionDirty(false);
    setStatus((prev) => ({ ...prev, roles: `Saved permissions for ${role}.` }));
    await loadTenantRoleConfig(tenant_key);
  }, [canEditTenantCore, selectedTenantKey, selectedRoleKey, rolePermissionDraft, sessionUserId, logAudit, loadTenantRoleConfig]);

  const applyBoundaryPayloadToTenant = useCallback(async ({ tenantKey, boundaryGeoJson, sourceLabel }) => {
    if (!canEditTenantOperational) return { ok: false, error: "Your platform role does not permit boundary updates." };
    const key = sanitizeTenantKey(tenantKey);
    if (!key) return { ok: false, error: "Tenant key is required." };
    if (!boundaryGeoJson || typeof boundaryGeoJson !== "object") {
      return { ok: false, error: "Boundary GeoJSON payload is missing or invalid." };
    }

    const boundaryConfigKey = buildDefaultBoundaryKey(key);
    const { error: appConfigError } = await supabase
      .from("app_config")
      .upsert([{ key: boundaryConfigKey, value: boundaryGeoJson }], { onConflict: "key" });

    if (appConfigError) {
      return { ok: false, error: appConfigError };
    }

    const { error: tenantError } = await supabase
      .from("tenants")
      .update({ boundary_config_key: boundaryConfigKey })
      .eq("tenant_key", key);
    if (tenantError) {
      return { ok: false, error: tenantError };
    }

    await logAudit({
      tenant_key: key,
      action: "tenant_boundary_from_file_applied",
      entity_type: "tenant_boundary",
      entity_id: boundaryConfigKey,
      details: {
        source: String(sourceLabel || "").trim() || "boundary file",
      },
    });

    return { ok: true, boundaryConfigKey };
  }, [canEditTenantOperational, logAudit]);

  const uploadTenantFile = useCallback(async (event) => {
    event.preventDefault();
    if (!canEditTenantOperational) {
      setStatus((prev) => ({ ...prev, files: "Your platform role does not permit file uploads." }));
      return;
    }
    const tenantKey = sanitizeTenantKey(selectedTenantKey);
    const file = fileForm.file;
    if (!tenantKey) {
      setStatus((prev) => ({ ...prev, files: "Select a tenant first." }));
      return;
    }
    if (!file) {
      setStatus((prev) => ({ ...prev, files: "Choose a file to upload." }));
      return;
    }

    const category = String(fileForm.category || "other").trim().toLowerCase();
    let boundaryGeoJson = null;
    if (category === "boundary_geojson") {
      try {
        const rawText = await file.text();
        const parsed = JSON.parse(rawText);
        boundaryGeoJson = extractBoundaryGeoJsonPayload(parsed);
      } catch {
        boundaryGeoJson = null;
      }
      if (!boundaryGeoJson) {
        setStatus((prev) => ({ ...prev, files: "Boundary file must be valid GeoJSON (or wrapper containing GeoJSON)." }));
        return;
      }
    }

    const now = Date.now();
    const fileName = sanitizeFileNameSegment(file.name);
    const path = `${tenantKey}/${category}/${toDatePath(new Date())}/${now}_${fileName}`;
    const contentType = String(file.type || "application/octet-stream");

    const { error: uploadError } = await supabase
      .storage
      .from("tenant-files")
      .upload(path, file, { upsert: false, contentType });

    if (uploadError) {
      setStatus((prev) => ({ ...prev, files: statusText(uploadError, "") }));
      return;
    }

    const metadataPayload = {
      tenant_key: tenantKey,
      file_category: category,
      file_name: file.name,
      storage_bucket: "tenant-files",
      storage_path: path,
      mime_type: contentType,
      size_bytes: Number(file.size || 0),
      uploaded_by: cleanOptional(sessionUserId),
      notes: cleanOptional(fileForm.notes),
      active: true,
    };

    const { error: metaError } = await supabase.from("tenant_files").insert([metadataPayload]);
    if (metaError) {
      setStatus((prev) => ({ ...prev, files: statusText(metaError, "") }));
      return;
    }

    await logAudit({
      tenant_key: tenantKey,
      action: "tenant_file_uploaded",
      entity_type: "tenant_file",
      entity_id: path,
      details: {
        category,
        file_name: file.name,
        size_bytes: metadataPayload.size_bytes,
      },
    });

    if (category === "boundary_geojson" && boundaryGeoJson) {
      const applied = await applyBoundaryPayloadToTenant({
        tenantKey,
        boundaryGeoJson,
        sourceLabel: file.name,
      });
      if (!applied.ok) {
        setStatus((prev) => ({
          ...prev,
          files: `Uploaded ${file.name}, but failed to apply boundary: ${statusText(applied.error, "")}`,
        }));
        await loadTenantFiles(tenantKey);
        await loadAudit();
        return;
      }
      setTenantForm((prev) => ({ ...prev, boundary_config_key: applied.boundaryConfigKey || prev.boundary_config_key }));
      setStatus((prev) => ({
        ...prev,
        files: `Uploaded ${file.name} and applied as active boundary.`,
      }));
      setFileForm({ category: "contract", notes: "", file: null });
      await refreshControlPlaneData();
      return;
    }

    setFileForm({ category: "contract", notes: "", file: null });
    setStatus((prev) => ({ ...prev, files: `Uploaded ${file.name}.` }));
    await loadTenantFiles(tenantKey);
    await loadAudit();
  }, [canEditTenantOperational, selectedTenantKey, fileForm, sessionUserId, logAudit, loadTenantFiles, loadAudit, applyBoundaryPayloadToTenant, refreshControlPlaneData]);

  const openTenantFile = useCallback(async (row) => {
    const bucket = String(row?.storage_bucket || "tenant-files").trim() || "tenant-files";
    const path = String(row?.storage_path || "").trim();
    if (!path) return;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      setStatus((prev) => ({ ...prev, files: statusText(error || "Unable to create signed URL", "") }));
      return;
    }
    if (typeof window !== "undefined") {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  }, []);

  const setBoundaryFromFile = useCallback(async (row) => {
    if (!canEditTenantOperational) {
      setStatus((prev) => ({ ...prev, files: "Your platform role does not permit boundary updates." }));
      return;
    }
    const tenantKey = sanitizeTenantKey(row?.tenant_key || selectedTenantKey);
    const bucket = String(row?.storage_bucket || "tenant-files").trim() || "tenant-files";
    const path = String(row?.storage_path || "").trim();
    const fileName = String(row?.file_name || path || "boundary file");
    if (!tenantKey || !path) {
      setStatus((prev) => ({ ...prev, files: "Boundary file is missing tenant key or path." }));
      return;
    }
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 90);
    if (error || !data?.signedUrl) {
      setStatus((prev) => ({ ...prev, files: statusText(error || "Unable to read boundary file", "") }));
      return;
    }

    let boundaryGeoJson = null;
    try {
      const response = await fetch(data.signedUrl);
      if (!response.ok) {
        throw new Error(`boundary fetch failed (${response.status})`);
      }
      const parsed = await response.json();
      boundaryGeoJson = extractBoundaryGeoJsonPayload(parsed);
    } catch (fetchError) {
      setStatus((prev) => ({ ...prev, files: statusText(fetchError, "") }));
      return;
    }
    if (!boundaryGeoJson) {
      setStatus((prev) => ({ ...prev, files: "Selected file is not valid GeoJSON boundary data." }));
      return;
    }

    const applied = await applyBoundaryPayloadToTenant({
      tenantKey,
      boundaryGeoJson,
      sourceLabel: fileName,
    });
    if (!applied.ok) {
      setStatus((prev) => ({ ...prev, files: statusText(applied.error, "") }));
      return;
    }

    setTenantForm((prev) => ({ ...prev, boundary_config_key: applied.boundaryConfigKey || prev.boundary_config_key }));
    setStatus((prev) => ({ ...prev, files: `Boundary set from ${fileName}.` }));
    await refreshControlPlaneData();
  }, [canEditTenantOperational, selectedTenantKey, applyBoundaryPayloadToTenant, refreshControlPlaneData]);

  const removeTenantFile = useCallback(async (row) => {
    if (!canEditTenantOperational) {
      setStatus((prev) => ({ ...prev, files: "Your platform role does not permit file removal." }));
      return;
    }
    const tenantKey = sanitizeTenantKey(row?.tenant_key);
    const fileId = Number(row?.id || 0);
    const bucket = String(row?.storage_bucket || "tenant-files").trim() || "tenant-files";
    const path = String(row?.storage_path || "").trim();
    if (!tenantKey || !fileId || !path) return;

    const { error: removeStorageError } = await supabase.storage.from(bucket).remove([path]);
    if (removeStorageError) {
      setStatus((prev) => ({ ...prev, files: statusText(removeStorageError, "") }));
      return;
    }

    const { error: removeMetaError } = await supabase.from("tenant_files").delete().eq("id", fileId);
    if (removeMetaError) {
      setStatus((prev) => ({ ...prev, files: statusText(removeMetaError, "") }));
      return;
    }

    await logAudit({
      tenant_key: tenantKey,
      action: "tenant_file_removed",
      entity_type: "tenant_file",
      entity_id: String(fileId),
      details: { storage_path: path },
    });

    setStatus((prev) => ({ ...prev, files: `Removed ${row?.file_name || path}.` }));
    await loadTenantFiles(tenantKey);
    await loadAudit();
  }, [canEditTenantOperational, logAudit, loadTenantFiles, loadAudit]);

  const inTenantWorkspace = entryStep === "tenant";
  const inAddTenantFlow = entryStep === "add";
  const inEntryPrompt = entryStep === "start";
  const showTenantsSection = inAddTenantFlow || (inTenantWorkspace && activeTab === "tenants");
  const tenantReadOnly = inTenantWorkspace && !isEditingTenant;
  const profileReadOnly = inTenantWorkspace && !isEditingProfile;
  const isCompactViewport = viewportWidth <= 760;
  const showBannerMenu = Boolean(sessionUserId);
  const bannerMenuLabel = menuOpen ? "Close menu" : "Open menu";
  const shellStyle = isCompactViewport
    ? { ...shell, padding: "calc(var(--mobile-header-top-offset) + var(--mobile-header-height) + 18px) 8px 42px" }
    : shell;
  const bannerStyle = isCompactViewport
    ? {
        ...stickyBanner,
        top: "var(--mobile-header-top-offset)",
        left: "var(--mobile-header-horizontal-inset)",
        right: "var(--mobile-header-horizontal-inset)",
        width: "auto",
        gridTemplateColumns: "var(--mobile-header-side-column) 1fr var(--mobile-header-side-column)",
        height: "var(--mobile-header-height)",
        minHeight: "var(--mobile-header-height)",
        padding: "var(--mobile-header-padding-y) var(--mobile-header-padding-x)",
        border: "1px solid rgba(23, 49, 79, 0.18)",
        borderRadius: "var(--mobile-header-radius)",
        background: "var(--mobile-header-background)",
        boxShadow: "var(--mobile-header-shadow)",
      }
    : stickyBanner;
  const bannerLogoStyle = isCompactViewport
    ? { ...brandLogo, height: "var(--mobile-header-logo-size)", maxWidth: "var(--mobile-header-logo-size)" }
    : brandLogo;
  const bannerLogoSrc = isCompactViewport ? MOBILE_TITLE_LOGO_SRC : TITLE_LOGO_SRC;
  const bannerMenuButtonStyle = isCompactViewport
    ? { ...menuToggleButton, width: "var(--mobile-header-menu-size)", height: "var(--mobile-header-menu-size)" }
    : menuToggleButton;
  const menuLineWidth = isCompactViewport ? 16 : 18;
  const menuLineGap = isCompactViewport ? 3 : 4;

  const fixedBanner = (
    <div style={bannerStyle}>
      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          returnToStart();
        }}
        style={{
          ...brandResetButton,
          width: isCompactViewport ? "var(--mobile-header-side-column)" : undefined,
          justifySelf: "start",
          zIndex: 1,
        }}
        aria-label="Return to Start Here"
      >
        <img src={bannerLogoSrc} alt={TITLE_LOGO_ALT} style={bannerLogoStyle} />
      </button>
      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          returnToStart();
        }}
        style={{
          ...brandResetButton,
          ...brandTitleStack,
          gap: isCompactViewport ? "var(--mobile-header-stack-gap)" : brandTitleStack.gap,
          width: isCompactViewport ? "100%" : "min(640px, calc(100vw - 320px))",
          paddingInline: isCompactViewport ? 6 : 0,
          minWidth: 0,
          justifySelf: "center",
          alignContent: isCompactViewport ? "center" : undefined,
        }}
      >
        <span className="app-header-eyebrow">
          Developer Dashboard
        </span>
        <span style={{
          fontSize: isCompactViewport ? "var(--mobile-header-title-size)" : "var(--desktop-header-title-size)",
          fontWeight: "var(--desktop-header-title-weight)",
          color: palette.navy900,
          lineHeight: isCompactViewport ? "var(--mobile-header-title-line-height)" : "var(--desktop-header-title-line-height)",
        }}>
          Platform Control Plane
        </span>
      </button>
      {showBannerMenu ? (
        <div ref={bannerMenuRef} style={{ position: "relative", zIndex: 1, justifySelf: "end", width: isCompactViewport ? "var(--mobile-header-side-column)" : undefined }}>
          <button
            type="button"
            aria-label={bannerMenuLabel}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
            style={bannerMenuButtonStyle}
          >
            <span style={{ display: "grid", gap: menuLineGap }}>
              <span style={{ width: menuLineWidth, height: 2, borderRadius: 999, background: palette.navy900, display: "block" }} />
              <span style={{ width: menuLineWidth, height: 2, borderRadius: 999, background: palette.navy900, display: "block" }} />
              <span style={{ width: menuLineWidth, height: 2, borderRadius: 999, background: palette.navy900, display: "block" }} />
            </span>
          </button>
          {menuOpen ? (
            <div style={menuSheet}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.textMuted }}>
                  Signed In
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: palette.navy900 }}>
                  {sessionDisplayName || "Platform User"}
                </div>
                <div style={{ fontSize: 13, color: palette.textMuted }}>
                  {platformRoleLabel}
                </div>
                {sessionEmail ? (
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                    {sessionEmail}
                  </div>
                ) : null}
              </div>
              <button type="button" style={{ ...signOutButton, width: "fit-content" }} onClick={() => void signOutPlatformAdmin()}>
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const controlPlaneNavigation = sessionUserId && isPlatformAdmin ? (
    <section style={{ ...fullWidthSection, display: "grid", gap: 12 }}>
      <div
        ref={controlPlaneNavRef}
        style={
          isCompactViewport
            ? { ...fullWidthSection, display: "grid", gap: 10 }
            : { ...controlPlaneTabsRail }
        }
      >
        <div style={controlPlaneTabsShell}>
          <nav style={controlPlaneTabsBar} aria-label="Platform Control Plane navigation">
            {CONTROL_PLANE_SECTIONS.map((section) => {
              const visiblePages = visibleControlPlanePagesBySection[section.key] || [];
              if (!visiblePages.length) return null;
              const active = section.key === controlPlaneSection;
              const isOpen = section.key === openControlPlaneDropdown;
              return (
                <div key={section.key} style={{ position: "relative", minWidth: 0 }} onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => openControlPlaneSection(section.key)}
                    style={active || isOpen ? controlPlaneTabButtonActive : controlPlaneTabButton}
                  >
                    <span>{section.label}</span>
                    <span aria-hidden="true" style={{ fontSize: 12, opacity: active || isOpen ? 0.92 : 0.64 }}>
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {isOpen ? (
                    <div style={controlPlaneSubmenu}>
                      {visiblePages.map((page) => {
                        const pageActive = page.key === controlPlanePage;
                        return (
                          <button
                            key={page.key}
                            type="button"
                            onClick={() => openControlPlanePage(page.key)}
                            style={{
                              ...controlPlaneSubmenuItem,
                              ...(pageActive
                                ? {
                                    border: "1px solid rgba(18, 128, 106, 0.28)",
                                    background: "rgba(229, 247, 243, 0.98)",
                                  }
                                : null),
                            }}
                          >
                            <span>{page.label}</span>
                            {pageActive ? (
                              <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                                Current page
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>
      </div>
      <div style={{ ...card, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.textMuted }}>
          Current Page
        </div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: palette.navy900 }}>
          {controlPlanePageLabel}
        </h1>
      </div>
    </section>
  ) : null;

  if (!authReady) {
    return (
      <main style={shellStyle}>
        {fixedBanner}
        <section style={{ ...fullWidthSection, ...card }}>
          <h1 style={{ marginTop: 0, marginBottom: 8, color: palette.navy900 }}>Loading Session</h1>
          <p style={{ margin: 0, color: palette.textMuted }}>Loading session...</p>
        </section>
      </main>
    );
  }

  if (!sessionUserId) {
    return (
      <main style={shellStyle}>
        {fixedBanner}
        <section style={{ ...fullWidthSection, ...card, display: "grid", gap: 10 }}>
          <h1 style={{ marginTop: 0, marginBottom: 6, color: palette.navy900 }}>Sign In</h1>
          <p style={{ margin: 0, color: palette.textMuted }}>
            Sign in with your platform admin account to manage municipalities and operational settings.
          </p>
          <form onSubmit={signInPlatformAdmin} style={{ display: "grid", gap: 8, maxWidth: 420 }} {...STANDARD_LOGIN_FORM_PROPS}>
            <input
              {...STANDARD_LOGIN_EMAIL_INPUT_PROPS}
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              style={inputBase}
            />
            <div style={{ display: "grid", gap: 6 }}>
              <div style={passwordFieldWrap}>
                <input
                  {...getStandardLoginPasswordInputProps(showLoginPassword)}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{ ...inputBase, paddingRight: 74 }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((prev) => !prev)}
                  style={passwordToggleInline}
                  aria-label={showLoginPassword ? "Hide password" : "Show password"}
                >
                  {showLoginPassword ? "Hide" : "Show"}
                </button>
              </div>
              <button
                type="button"
                onClick={openForgotPasswordModal}
                style={{
                  border: 0,
                  background: "transparent",
                  color: palette.mint700,
                  font: "inherit",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  padding: 0,
                  justifySelf: "start",
                }}
              >
                Forgot password?
              </button>
            </div>
            <button type="submit" style={{ ...buttonBase, width: "fit-content", minWidth: 140 }} disabled={loginLoading}>
              {loginLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          {loginError ? <p style={{ margin: 0, color: palette.red600, fontSize: 12.5 }}>{loginError}</p> : null}
          {loginStatus ? <p style={{ margin: 0, color: palette.mint700, fontSize: 12.5, fontWeight: 700 }}>{loginStatus}</p> : null}
          {forgotPasswordOpen ? (
            <div style={authModalBackdrop} onClick={closeForgotPasswordModal}>
              <div style={authModalCard} onClick={(event) => event.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Reset Password</h2>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                      Enter your account email and we&apos;ll send a password reset link.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeForgotPasswordModal}
                    style={{
                      ...buttonAlt,
                      minWidth: 0,
                      width: 34,
                      height: 34,
                      padding: 0,
                      borderRadius: 10,
                      fontSize: 18,
                      lineHeight: 1,
                    }}
                    aria-label="Close password reset dialog"
                  >
                    ×
                  </button>
                </div>
                <input
                  {...STANDARD_LOGIN_EMAIL_INPUT_PROPS}
                  value={forgotPasswordEmail}
                  onChange={(event) => setForgotPasswordEmail(event.target.value)}
                  style={inputBase}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !authResetLoading) {
                      event.preventDefault();
                      void sendPasswordReset();
                    }
                  }}
                />
                {forgotPasswordError ? <p style={{ margin: 0, color: palette.red600, fontSize: 12.5 }}>{forgotPasswordError}</p> : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={{ ...buttonBase, minWidth: 160 }} disabled={authResetLoading} onClick={() => void sendPasswordReset()}>
                    {authResetLoading ? "Sending reset..." : "Send Reset Email"}
                  </button>
                  <button type="button" style={{ ...buttonAlt, minWidth: 120 }} onClick={closeForgotPasswordModal}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <main style={shellStyle}>
        {fixedBanner}
        <section style={{ ...fullWidthSection, ...card }}>
          <h1 style={{ marginTop: 0, color: palette.navy900 }}>Access Denied</h1>
          <p style={{ marginBottom: 0 }}>
            Access denied. This route is restricted to platform users with `platform_owner` or `platform_staff` role.
          </p>
          <p style={{ marginBottom: 0, fontSize: 12.5 }}>
            Signed in as <b>{sessionUserId}</b>.
          </p>
          <div>
            <button type="button" style={signOutButton} onClick={() => void signOutPlatformAdmin()}>
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      {fixedBanner}
      {controlPlaneNavigation}
      {controlPlanePage === "organization-reports" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13.5, color: palette.textMuted }}>
              Platform-wide organization coverage, access footprint, and launch readiness.
            </div>
            <div style={responsiveTwoColGrid}>
              <div style={metricCard}>
                <div style={{ fontSize: 13, fontWeight: 800, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Organizations</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: palette.navy900 }}>{tenants.length}</div>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>Configured across the platform.</div>
              </div>
              <div style={metricCard}>
                <div style={{ fontSize: 13, fontWeight: 800, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Active Organizations</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: palette.navy900 }}>{activeOrganizationCount}</div>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>Live and available in production.</div>
              </div>
              <div style={metricCard}>
                <div style={{ fontSize: 13, fontWeight: 800, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Organization Admins</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: palette.navy900 }}>{tenantAdminAssignments.length}</div>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>Primary location operators currently assigned.</div>
              </div>
              <div style={metricCard}>
                <div style={{ fontSize: 13, fontWeight: 800, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Organization Employees</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: palette.navy900 }}>{tenantEmployeeAssignments.length}</div>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>Scoped staff assignments across all organizations.</div>
              </div>
            </div>
            <div style={responsiveTwoColGrid}>
              <div style={metricCard}>
                <div style={{ fontSize: 13, fontWeight: 800, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Resident Hubs Enabled</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: palette.navy900 }}>{residentPortalCount}</div>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>Organizations using the resident updates homepage.</div>
              </div>
              <div style={metricCard}>
                <div style={{ fontSize: 13, fontWeight: 800, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>Pilot Organizations</div>
                <div style={{ fontSize: 34, fontWeight: 900, color: palette.navy900 }}>{pilotOrganizationCount}</div>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>Currently flagged for pilot operations.</div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "domain-reports" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 10 }}>
            <div style={{ fontSize: 13.5, color: palette.textMuted }}>
              Domain readiness by visibility footprint across all organizations.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCell}>Domain</th>
                    <th style={tableHeadCell}>Public / Enabled</th>
                    <th style={tableHeadCell}>Restricted</th>
                  </tr>
                </thead>
                <tbody>
                  {domainReportRows.map((row) => (
                    <tr key={row.key}>
                      <td style={{ padding: "10px 0", fontWeight: 800, color: palette.navy900 }}>{row.label}</td>
                      <td style={{ padding: "10px 0" }}>{row.publicCount}</td>
                      <td style={{ padding: "10px 0" }}>{row.restrictedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "leads-reports" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13.5, color: palette.textMuted }}>
              Lead pipeline counts across the homepage intake funnel.
            </div>
            <div style={responsiveTwoColGrid}>
              {["new", "reviewed", "contacted", "closed"].map((statusKey) => (
                <div key={statusKey} style={metricCard}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{statusKey}</div>
                  <div style={{ fontSize: 34, fontWeight: 900, color: palette.navy900 }}>{leadStatusCounts[statusKey] || 0}</div>
                </div>
              ))}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCell}>Priority Domain</th>
                    <th style={tableHeadCell}>Lead Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(leadDomainCounts).map(([domainKey, count]) => (
                    <tr key={domainKey}>
                      <td style={{ padding: "10px 0", fontWeight: 800, color: palette.navy900 }}>{roleKeyToLabel(domainKey)}</td>
                      <td style={{ padding: "10px 0" }}>{count}</td>
                    </tr>
                  ))}
                  {!Object.keys(leadDomainCounts).length ? (
                    <tr>
                      <td colSpan={2} style={{ padding: "10px 0", color: palette.textMuted }}>No leads captured yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "finance-reports" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 10 }}>
            <h2 style={{ margin: 0, color: palette.navy900 }}>Finance Reports Foundation</h2>
            <p style={{ margin: 0, color: palette.textMuted }}>
              Finance reporting is scaffolded into the PCP structure now. Billing, contract value, collections, and pilot revenue metrics can plug into this page next without reshaping the control plane.
            </p>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "account-info" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, color: palette.navy900 }}>Account Info</h2>
            <div style={responsiveTwoColGrid}>
              <div style={metricCard}>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>Name</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: palette.navy900 }}>{sessionDisplayName || "Platform User"}</div>
              </div>
              <div style={metricCard}>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>Email</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: palette.navy900 }}>{sessionEmail || "No email on file"}</div>
              </div>
              <div style={metricCard}>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>Phone</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: palette.navy900 }}>Coming next</div>
              </div>
              <div style={metricCard}>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>PIN Security Checkpoint</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: palette.navy900 }}>Foundation ready</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={buttonBase}
                onClick={() => {
                  setForgotPasswordEmail(sessionEmail);
                  setForgotPasswordOpen(true);
                }}
              >
                Update Password
              </button>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "manage-team" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 10 }}>
            <h2 style={{ margin: 0, color: palette.navy900 }}>Manage Team</h2>
            <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
              Assign internal platform roles from the PCP. Platform Owner can grant or remove internal access here.
            </p>
            <form onSubmit={searchPlatformTeamUsers} style={responsiveActionGrid}>
              <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                <span>Find Internal Account</span>
                <input
                  value={platformUserSearchQuery}
                  onChange={(e) => setPlatformUserSearchQuery(e.target.value)}
                  placeholder="Exact email, exact phone, or full name"
                  style={inputBase}
                  disabled={!isPlatformOwner}
                />
              </label>
              <button type="submit" style={{ ...buttonBase, opacity: isPlatformOwner ? 1 : 0.55 }} disabled={!isPlatformOwner || platformUserSearchLoading}>
                {platformUserSearchLoading ? "Searching..." : "Search Accounts"}
              </button>
            </form>
            {platformUserSearchResults.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {platformUserSearchResults.map((row) => {
                  const userId = String(row?.id || "").trim();
                  const selected = userId === platformTeamForm.user_id;
                  return (
                    <button
                      key={userId}
                      type="button"
                      onClick={() => setPlatformTeamForm((prev) => ({ ...prev, user_id: userId }))}
                      style={{
                        ...listActionButton,
                        border: selected ? `1px solid ${palette.mint700}` : listActionButton.border,
                        background: selected ? "rgba(18,128,106,0.08)" : listActionButton.background,
                      }}
                    >
                      <span>{String(row?.display_name || "").trim() || row?.email || "Unnamed account"}</span>
                      <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                        {[row?.email, row?.phone].filter(Boolean).join(" • ") || "No email or phone on file"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
              <label style={{ fontSize: 12.5, display: "grid", gap: 4, minWidth: 220 }}>
                <span>Platform Role</span>
                <select
                  value={platformTeamForm.role}
                  onChange={(e) => setPlatformTeamForm((prev) => ({ ...prev, role: e.target.value }))}
                  style={inputBase}
                  disabled={!isPlatformOwner}
                >
                  {PLATFORM_ROLE_OPTIONS.map((row) => (
                    <option key={row.key} value={row.key}>{row.label}</option>
                  ))}
                </select>
              </label>
              <button type="button" style={{ ...buttonBase, opacity: isPlatformOwner && platformTeamForm.user_id ? 1 : 0.55 }} disabled={!isPlatformOwner || !platformTeamForm.user_id} onClick={() => void assignPlatformRole()}>
                Assign Platform Role
              </button>
            </div>
            {platformTeamStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{platformTeamStatus}</div> : null}
          </div>
          <div style={{ ...card, display: "grid", gap: 10 }}>
            <h2 style={{ margin: 0, color: palette.navy900 }}>Current Platform Team</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCell}>Team Member</th>
                    <th style={tableHeadCell}>Role</th>
                    <th style={tableHeadCell}>Updated</th>
                    <th style={tableHeadCell}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {platformTeamAssignments.map((row) => (
                    <tr key={`${row.user_id}:${row.role}`}>
                      <td style={{ padding: "10px 0" }}>{formatPlatformUserLabel(row.user_id)}</td>
                      <td style={{ padding: "10px 0" }}>{platformRoleToLabel(row.role)}</td>
                      <td style={{ padding: "10px 0" }}>{row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
                      <td style={{ padding: "10px 0" }}>
                        <button type="button" style={{ ...buttonAlt, opacity: isPlatformOwner ? 1 : 0.55 }} disabled={!isPlatformOwner} onClick={() => void removePlatformRole(row)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!platformTeamAssignments.length ? (
                    <tr>
                      <td colSpan={4} style={{ padding: "10px 0", color: palette.textMuted }}>No platform roles have been assigned yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "roles-permissions" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 10 }}>
            <h2 style={{ margin: 0, color: palette.navy900 }}>Roles & Permissions</h2>
            <p style={{ margin: 0, color: palette.textMuted }}>
              PCP access is now page-based. This foundation page defines which internal roles can access each control-plane page.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCell}>Page</th>
                    <th style={tableHeadCell}>Platform Owner</th>
                    <th style={tableHeadCell}>Platform Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {CONTROL_PLANE_PAGES.map((page) => (
                    <tr key={page.key}>
                      <td style={{ padding: "10px 0", fontWeight: 800, color: palette.navy900 }}>{page.label}</td>
                      <td style={{ padding: "10px 0" }}>{CONTROL_PLANE_PAGE_ACCESS[page.key]?.includes("platform_owner") || CONTROL_PLANE_PAGE_ACCESS[page.key]?.includes("legacy_admin") ? "Yes" : "No"}</td>
                      <td style={{ padding: "10px 0" }}>{CONTROL_PLANE_PAGE_ACCESS[page.key]?.includes("platform_staff") ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "security-checks" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 10 }}>
            <h2 style={{ margin: 0, color: palette.navy900 }}>Security Checks</h2>
            <p style={{ margin: 0, color: palette.textMuted }}>
              PIN checkpoint controls are reserved here for sensitive actions like role changes, account updates, and report-state changes. This page is now part of the PCP foundation so those controls can be wired without changing the hierarchy again.
            </p>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "manage-leads" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 10 }}>
            <h2 style={{ margin: 0, color: palette.navy900 }}>Manage Leads</h2>
            <p style={{ margin: 0, color: palette.textMuted }}>
              Track municipal leads captured from CityReport.io, update status, set follow-ups, and keep internal notes in one place.
            </p>
            {leadStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{leadStatus}</div> : null}
            <div style={{ display: "grid", gap: 12 }}>
              {leadRows.map((lead) => {
                const draft = leadDraftById[String(lead.id)] || {};
                return (
                  <div key={lead.id} style={{ ...subPanel, display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gap: 2 }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: palette.navy900 }}>{lead.full_name}</div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        {[lead.work_email, lead.city_agency, lead.role_title].filter(Boolean).join(" • ")}
                      </div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Submitted {lead.created_at ? new Date(lead.created_at).toLocaleString() : "-"} • Priority domain: {roleKeyToLabel(lead.priority_domain)}
                      </div>
                    </div>
                    <div style={responsiveTwoColGrid}>
                      <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                        <span>Lead Status</span>
                        <select value={draft.status ?? lead.status ?? "new"} onChange={(e) => updateLeadDraft(lead.id, "status", e.target.value)} style={inputBase}>
                          <option value="new">New</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="contacted">Contacted</option>
                          <option value="closed">Closed</option>
                        </select>
                      </label>
                      <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                        <span>Follow-up Date</span>
                        <input type="date" value={draft.follow_up_on ?? String(lead.follow_up_on || "").slice(0, 10)} onChange={(e) => updateLeadDraft(lead.id, "follow_up_on", e.target.value)} style={inputBase} />
                      </label>
                    </div>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Internal Notes</span>
                      <textarea value={draft.internal_notes ?? lead.internal_notes ?? lead.notes ?? ""} onChange={(e) => updateLeadDraft(lead.id, "internal_notes", e.target.value)} style={{ ...inputBase, minHeight: 88 }} />
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" style={buttonBase} disabled={leadLoading} onClick={() => void saveLeadUpdate(lead)}>
                        {leadLoading ? "Saving..." : "Save Lead"}
                      </button>
                      <button type="button" style={buttonAlt} onClick={() => updateLeadDraft(lead.id, "mark_follow_up", true)}>
                        Mark Follow-up Done On Save
                      </button>
                      {lead.last_follow_up_at ? (
                        <span style={{ fontSize: 12.5, color: palette.textMuted }}>Last follow-up: {new Date(lead.last_follow_up_at).toLocaleString()}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {!leadRows.length ? (
                <div style={{ ...subPanel, color: palette.textMuted }}>No leads have been captured yet.</div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "manage-organizations" ? (
      <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
        <header style={{ ...card, display: "grid", gap: 12 }}>
          {inEntryPrompt ? (
            <div style={{ ...subPanel, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: palette.navy900 }}>Start Here</h2>
              <p style={{ margin: 0, fontSize: 13.5, color: palette.textMuted }}>
                Add a new organization, or search and open an existing organization workspace.
              </p>
              <button type="button" style={{ ...buttonBase, width: "fit-content" }} onClick={openAddTenantStep}>
                Add Organization
              </button>
              <input
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                placeholder="Search organizations by name, key, or subdomain"
                style={{ ...inputBase, maxWidth: 620, fontSize: 16 }}
              />
              <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto", paddingRight: 2 }}>
                {hasTenantSearchQuery ? filteredTenantRows.map((row) => {
                  const key = String(row?.tenant_key || "").trim();
                  if (!key) return null;
                  const profile = tenantProfilesByTenant?.[sanitizeTenantKey(key)] || null;
                  const publicDisplayName = resolvePublicDisplayName(row, profile);
                  const organizationName = resolveOrganizationName(row);
                  const legalName = resolveLegalOrganizationName(profile);
                  const subdomain = String(row?.primary_subdomain || "").trim();
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => openTenantWorkspace(key)}
                      style={listActionButton}
                    >
                      <span>{publicDisplayName}</span>
                      {publicDisplayName !== organizationName ? (
                        <span style={{ fontSize: 11.5, opacity: 0.82 }}>Organization name: {organizationName}</span>
                      ) : null}
                      {legalName ? (
                        <span style={{ fontSize: 11.5, opacity: 0.82 }}>Legal name: {legalName}</span>
                      ) : null}
                      <span style={{ fontSize: 11.5, opacity: 0.8 }}>{key}{subdomain ? ` • ${subdomain}` : ""}</span>
                    </button>
                  );
                }) : (
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                    Search results will appear after you enter an organization name, key, or subdomain.
                  </div>
                )}
                {hasTenantSearchQuery && !filteredTenantRows.length ? (
                  <div style={{ fontSize: 12.5, color: palette.red600 }}>No organizations match this search.</div>
                ) : null}
              </div>
            </div>
          ) : null}
          {inAddTenantFlow ? (
            <div style={{ ...subPanel, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, color: palette.textMuted }}>
                  New organization flow active. Complete each onboarding step in order.
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={buttonAlt} onClick={returnToStart}>Back</button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ADD_TENANT_STEPS.map((step, index) => {
                  const isCurrent = step.key === addTenantStep;
                  const isComplete = index < addTenantStepIndex;
                  return (
                    <div
                      key={step.key}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: `1px solid ${isCurrent ? palette.navy700 : palette.border}`,
                        background: isCurrent
                          ? "linear-gradient(180deg, rgba(16,43,70,0.1) 0%, rgba(18,128,106,0.12) 100%)"
                          : isComplete
                            ? "rgba(18,128,106,0.12)"
                            : "rgba(255,255,255,0.72)",
                        color: palette.navy900,
                        fontSize: 12.5,
                        fontWeight: 800,
                      }}
                    >
                      {index + 1}. {step.label}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {inTenantWorkspace ? (
            <>
              <div style={{ ...subPanel, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13.5, color: palette.textMuted }}>
                  Switch workspaces, start a new organization, or save organization setup changes from here.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={headerActionButton} onClick={returnToStart}>Switch Organization</button>
                  <button
                    type="button"
                    style={{ ...headerActionButton, opacity: canEditTenantCore ? 1 : 0.55 }}
                    onClick={openAddTenantStep}
                    disabled={!canEditTenantCore}
                    title={canEditTenantCore ? "Create organization" : "Only Platform Owner can create organizations"}
                  >
                    Add Organization
                  </button>
                </div>
              </div>
              <div style={{ ...subPanel, display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 2 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.textMuted }}>
                    Organization
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 900, color: palette.navy900 }}>
                    {selectedTenantPublicDisplayName || selectedTenantKey}
                  </div>
                  {selectedTenantPublicDisplayName !== selectedTenantOrganizationName ? (
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Organization Name: {selectedTenantOrganizationName}
                    </div>
                  ) : null}
                  {selectedTenantLegalOrganizationName ? (
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Legal Organization Name: {selectedTenantLegalOrganizationName}
                    </div>
                  ) : null}
                  <div style={{ fontSize: 13, color: palette.textMuted }}>
                    {normalizePrimarySubdomain(selectedTenant?.primary_subdomain) || `${sanitizeTenantKey(selectedTenantKey)}.cityreport.io`}
                  </div>
                </div>
                <div style={{ ...subPanel, display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.textMuted }}>
                    Primary URL Prefix
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 900, color: palette.navy900 }}>
                    {primarySubdomainPrefix(selectedTenant?.primary_subdomain) || sanitizeTenantKey(selectedTenantKey)}
                  </div>
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                    This controls the live organization URL: {normalizePrimarySubdomain(selectedTenant?.primary_subdomain) || `${sanitizeTenantKey(selectedTenantKey)}.cityreport.io`}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={{ ...buttonAlt, opacity: canEditTenantCore ? 1 : 0.55 }}
                      onClick={() => {
                        setActiveTab("tenants");
                        setIsEditingTenant(true);
                      }}
                      disabled={!canEditTenantCore}
                      title={canEditTenantCore ? "Edit the cityreport.io URL prefix" : "Only Platform Owner can edit the URL prefix"}
                    >
                      Edit URL Prefix
                    </button>
                  </div>
                </div>
                <div style={{ ...responsiveActionGrid, marginTop: 2 }}>
                  <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={tenantForm.resident_portal_enabled}
                      disabled={!isEditingTenant || !canEditTenantCore}
                      onChange={(e) => setTenantForm((p) => ({ ...p, resident_portal_enabled: e.target.checked }))}
                    /> Resident Updates Homepage Enabled
                  </label>
                  <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={tenantForm.is_pilot}
                      disabled={!isEditingTenant || !canEditTenantCore}
                      onChange={(e) => setTenantForm((p) => ({ ...p, is_pilot: e.target.checked }))}
                    /> Pilot Municipality
                  </label>
                  <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={tenantForm.active}
                      disabled={!isEditingTenant || !canEditTenantCore}
                      onChange={(e) => setTenantForm((p) => ({ ...p, active: e.target.checked }))}
                    /> Active Organization
                  </label>
                </div>
                {isEditingTenant ? (
                  <div style={{ fontSize: 11.5, color: palette.textMuted }}>
                    Setup toggles are editable here. Save them from the organization setup editor below.
                  </div>
                ) : null}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {isEditingTenant ? (
                    <>
                      <button
                        type="button"
                        style={{ ...buttonBase, opacity: canEditTenantCore ? 1 : 0.55 }}
                        onClick={() => void saveTenant({ preventDefault() {} })}
                        disabled={!canEditTenantCore}
                        title={canEditTenantCore ? "Save organization setup" : "Only Platform Owner can save organization setup"}
                      >
                        Save Organization Setup
                      </button>
                      <button
                        type="button"
                        style={buttonAlt}
                        onClick={cancelTenantEditing}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        style={{ ...headerActionButton, opacity: canEditTenantCore ? 1 : 0.55 }}
                        onClick={() => {
                          setActiveTab("tenants");
                          setIsEditingTenant(true);
                        }}
                        disabled={!canEditTenantCore}
                        title={canEditTenantCore ? "Edit organization setup" : "Only Platform Owner can edit organization setup"}
                      >
                        Edit Organization Setup
                      </button>
                      {selectedTenantPendingDeletion ? (
                        <button
                          type="button"
                          style={{ ...buttonAlt, borderColor: palette.red600, color: palette.red600, opacity: canEditTenantCore ? 1 : 0.55 }}
                          onClick={() => void cancelOrganizationDeletion()}
                          disabled={!canEditTenantCore || deleteLoading}
                          title={canEditTenantCore ? "Cancel scheduled organization deletion" : "Only Platform Owner can cancel organization deletion"}
                        >
                          {deleteLoading ? "Saving..." : "Cancel Deletion"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={{ ...buttonAlt, borderColor: palette.red600, color: palette.red600, opacity: canEditTenantCore ? 1 : 0.55 }}
                          onClick={() => {
                            setDeleteConfirmOpen((prev) => !prev);
                            setDeleteConfirmText("");
                            setStatus((prev) => ({ ...prev, tenant: "" }));
                          }}
                          disabled={!canEditTenantCore}
                          title={canEditTenantCore ? "Schedule organization deletion" : "Only Platform Owner can schedule organization deletion"}
                        >
                          Schedule Deletion
                        </button>
                      )}
                    </>
                  )}
                </div>
                {selectedTenantPendingDeletion ? (
                  <div style={{ fontSize: 12.5, color: palette.red600 }}>
                    This organization is scheduled for deletion on {formatDateTimeDisplay(selectedTenantDeletionScheduledFor)}.
                    The record is being held for {ORGANIZATION_DELETION_HOLD_DAYS} days before removal.
                  </div>
                ) : null}
                {!isEditingTenant && deleteConfirmOpen ? (
                  <div style={{ ...subPanel, display: "grid", gap: 8, borderColor: "rgba(209, 67, 67, 0.3)" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: palette.navy900 }}>
                      Schedule organization deletion
                    </div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Type <b>{selectedTenantKey}</b> to confirm. This organization will be marked inactive now and permanently deleted after a {ORGANIZATION_DELETION_HOLD_DAYS}-day hold.
                    </div>
                    <input
                      value={deleteConfirmText}
                      onChange={(event) => setDeleteConfirmText(event.target.value)}
                      placeholder={`Type ${selectedTenantKey} to confirm`}
                      style={{ ...inputBase, maxWidth: 320 }}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={{ ...buttonBase, background: `linear-gradient(180deg, ${palette.red600} 0%, #a12626 100%)`, borderColor: palette.red600 }}
                        disabled={deleteLoading || deleteConfirmText !== selectedTenantKey}
                        onClick={() => void scheduleOrganizationDeletion()}
                      >
                        {deleteLoading ? "Scheduling..." : "Confirm 30-Day Deletion Hold"}
                      </button>
                      <button
                        type="button"
                        style={buttonAlt}
                        disabled={deleteLoading}
                        onClick={() => {
                          setDeleteConfirmOpen(false);
                          setDeleteConfirmText("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <div style={{ ...subPanel, borderRadius: 10, padding: "10px 12px", display: "grid", gap: 8 }}>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4, maxWidth: 360 }}>
                  <span>Workspace Section</span>
                  <select value={activeTab} onChange={(e) => setActiveTab(e.target.value)} style={tabSelectBase}>
                    {TAB_OPTIONS.map((tab) => (
                      <option key={tab.key} value={tab.key}>{tab.label}</option>
                    ))}
                  </select>
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedTenantLiveUrl ? (
                    <a href={selectedTenantLiveUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonBase, textDecoration: "none" }}>
                      Open Organization Hub
                    </a>
                  ) : null}
                  {selectedTenantDevUrl ? (
                    <a href={selectedTenantDevUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonBase, textDecoration: "none" }}>
                      Open Dev Organization Hub
                    </a>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
          {status.hydrate ? <div style={{ fontSize: 12.5, color: palette.red600 }}>{toOrganizationLanguage(status.hydrate)}</div> : null}
        </header>

        {showTenantsSection ? (
          <section style={{ display: "grid", gap: 14 }}>
            {(inAddTenantFlow ? addTenantStep === "organization" : true) ? (
              <div style={{ ...card, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>
                    {inAddTenantFlow ? "Organization Contact Information" : "Organization Contact Information"}
                  </h2>
                  {!inAddTenantFlow ? (
                    profileReadOnly ? (
                      <button type="button" style={buttonAlt} onClick={() => setIsEditingProfile(true)}>
                        Edit Contact Information
                      </button>
                    ) : (
                      <button
                        type="button"
                        style={buttonAlt}
                        onClick={() => {
                          const key = sanitizeTenantKey(selectedTenantKey);
                          setProfileForm(profileRowToForm(tenantProfilesByTenant?.[key] || null));
                          setIsEditingProfile(false);
                        }}
                      >
                        Cancel
                      </button>
                    )
                  ) : null}
                </div>
                <section style={{ ...subPanel, display: "grid", gap: 8 }}>
                  <h3 style={{ margin: 0, color: palette.navy900 }}>Organization Information</h3>
                  <div style={responsiveTwoColGrid}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Legal Organization Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.legal_name} onChange={(e) => setProfileForm((p) => ({ ...p, legal_name: e.target.value }))} placeholder="Example Municipality Public Works" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                      <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                        Formal entity name used for contracts, billing, and official documentation.
                      </span>
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Public Display Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.display_name} onChange={(e) => setProfileForm((p) => ({ ...p, display_name: e.target.value }))} placeholder="Example Municipality" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                      <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                        Preferred outward-facing label. Falls back to Organization Name anywhere a public label is needed.
                      </span>
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Address 1</span>
                      <input readOnly={profileReadOnly} value={profileForm.mailing_address_1} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_address_1: e.target.value }))} placeholder="100 Civic Center Dr" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Address 2</span>
                      <input readOnly={profileReadOnly} value={profileForm.mailing_address_2} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_address_2: e.target.value }))} placeholder="Building A, Suite 200 (optional)" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>City</span>
                      <input readOnly={profileReadOnly} value={profileForm.mailing_city} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_city: e.target.value }))} placeholder="Example City" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>State</span>
                      <input readOnly={profileReadOnly} value={profileForm.mailing_state} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_state: e.target.value }))} placeholder="ST" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>ZIP</span>
                      <input readOnly={profileReadOnly} value={profileForm.mailing_zip} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_zip: e.target.value }))} placeholder="12345" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Municipality Website URL</span>
                      <input readOnly={profileReadOnly} value={profileForm.website_url} onChange={(e) => setProfileForm((p) => ({ ...p, website_url: e.target.value }))} placeholder="https://www.examplemunicipality.gov" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>URL Extension (Profile Alias)</span>
                    <input readOnly={profileReadOnly} value={profileForm.url_extension} onChange={(e) => setProfileForm((p) => ({ ...p, url_extension: e.target.value }))} placeholder="examplemunicipality" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                      Stored in the organization profile for reference and future alias use. It does not currently change live cityreport.io routing.
                    </span>
                  </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Billing Email</span>
                      <input readOnly={profileReadOnly} value={profileForm.billing_email} onChange={(e) => setProfileForm((p) => ({ ...p, billing_email: e.target.value }))} placeholder="billing@examplemunicipality.gov" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Timezone</span>
                      <input readOnly={profileReadOnly} value={profileForm.timezone} onChange={(e) => setProfileForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="America/New_York" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Contract Status</span>
                      <select disabled={profileReadOnly} value={profileForm.contract_status} onChange={(e) => setProfileForm((p) => ({ ...p, contract_status: e.target.value }))} style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }}>
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="expired">Expired</option>
                        <option value="terminated">Terminated</option>
                      </select>
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Contract Start Date</span>
                      <input readOnly={profileReadOnly} type="date" value={profileForm.contract_start_date} onChange={(e) => setProfileForm((p) => ({ ...p, contract_start_date: e.target.value }))} style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Contract End Date</span>
                      <input readOnly={profileReadOnly} type="date" value={profileForm.contract_end_date} onChange={(e) => setProfileForm((p) => ({ ...p, contract_end_date: e.target.value }))} style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Renewal Date</span>
                      <input readOnly={profileReadOnly} type="date" value={profileForm.renewal_date} onChange={(e) => setProfileForm((p) => ({ ...p, renewal_date: e.target.value }))} style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4, gridColumn: "1 / -1" }}>
                      <span>Operational / Onboarding Notes</span>
                      <textarea readOnly={profileReadOnly} value={profileForm.notes} onChange={(e) => setProfileForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Add context for onboarding, constraints, and operating notes." style={{ ...inputBase, minHeight: 90, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                  </div>
                </section>
                {inAddTenantFlow ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={buttonBase} onClick={() => setAddTenantStep("contacts")}>
                      Next: Contacts
                    </button>
                  </div>
                ) : !profileReadOnly ? (
                  <form onSubmit={saveTenantProfile} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="submit" style={buttonBase}>Save Contact Information</button>
                  </form>
                ) : null}
                {status.profile ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.profile)}</div> : null}
              </div>
            ) : null}

            {(inAddTenantFlow ? addTenantStep === "contacts" : true) ? (
              <div style={{ ...card, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>
                    {inAddTenantFlow ? "Primary + Additional Contacts" : "Primary + Additional Contacts"}
                  </h2>
                  {!inAddTenantFlow && profileReadOnly ? (
                    <button type="button" style={buttonAlt} onClick={() => setIsEditingProfile(true)}>
                      Edit Contacts
                    </button>
                  ) : null}
                </div>
                <section style={{ ...subPanel, display: "grid", gap: 8 }}>
                  <h3 style={{ margin: 0, color: palette.navy900 }}>Primary Contact</h3>
                  <div style={responsiveTwoColGrid}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Primary Contact Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_primary_name} onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_name: e.target.value }))} placeholder="Primary Contact" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Primary Contact Role / Title</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_primary_title} onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_title: e.target.value }))} placeholder="Director of Public Works" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Primary Contact Email</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_primary_email} onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_email: e.target.value }))} placeholder="primary.contact@examplemunicipality.gov" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Primary Contact Phone</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_primary_phone} onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_phone: e.target.value }))} placeholder="(000) 000-0000" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                  </div>
                </section>
                <section style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <h3 style={{ margin: 0, color: palette.navy900 }}>Additional Contacts</h3>
                    {!profileReadOnly ? (
                      <button type="button" style={buttonAlt} onClick={addAdditionalContact}>
                        Add Contact
                      </button>
                    ) : null}
                  </div>
                  {Array.isArray(profileForm.additional_contacts) && profileForm.additional_contacts.length ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      {profileForm.additional_contacts.map((contact, index) => (
                        <div key={`contact-${index}`} style={{ ...subPanel, display: "grid", gap: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                            <strong style={{ color: palette.navy900 }}>Additional Contact {index + 1}</strong>
                            {!profileReadOnly ? (
                              <button type="button" style={buttonAlt} onClick={() => removeAdditionalContact(index)}>
                                Remove
                              </button>
                            ) : null}
                          </div>
                          <div style={responsiveTwoColGrid}>
                            <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                              <span>Name</span>
                              <input readOnly={profileReadOnly} value={contact.name} onChange={(e) => updateAdditionalContact(index, "name", e.target.value)} placeholder="Department Contact" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                            </label>
                            <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                              <span>Role / Title</span>
                              <input readOnly={profileReadOnly} value={contact.title} onChange={(e) => updateAdditionalContact(index, "title", e.target.value)} placeholder="Finance Director" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                            </label>
                            <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                              <span>Email</span>
                              <input readOnly={profileReadOnly} value={contact.email} onChange={(e) => updateAdditionalContact(index, "email", e.target.value)} placeholder="finance@examplemunicipality.gov" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                            </label>
                            <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                              <span>Phone</span>
                              <input readOnly={profileReadOnly} value={contact.phone} onChange={(e) => updateAdditionalContact(index, "phone", e.target.value)} placeholder="(000) 000-0000" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      {profileReadOnly ? "No additional contacts saved yet." : "Add technical, legal, finance, or department contacts as needed."}
                    </div>
                  )}
                </section>
                {inAddTenantFlow ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={buttonAlt} onClick={() => setAddTenantStep("organization")}>
                      Back
                    </button>
                    <button type="button" style={buttonBase} onClick={() => setAddTenantStep("setup")}>
                      Next: Basic Setup
                    </button>
                  </div>
                ) : !profileReadOnly ? (
                  <form onSubmit={saveTenantProfile} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="submit" style={buttonBase}>Save Contact Information</button>
                  </form>
                ) : null}
                {status.profile ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.profile)}</div> : null}
              </div>
            ) : null}

            {(inAddTenantFlow ? addTenantStep === "setup" : !tenantReadOnly) ? (
              <div style={{ ...card, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>
                    {inAddTenantFlow ? "Basic Setup" : "Edit Organization Setup"}
                  </h2>
                  {!inAddTenantFlow && !tenantReadOnly ? (
                    <button
                      type="button"
                      style={buttonAlt}
                      onClick={cancelTenantEditing}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
                <form onSubmit={inAddTenantFlow ? finishAddTenantSetup : saveTenant} style={responsiveTwoColGrid}>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Organization Key (system ID)</span>
                    <input
                      value={tenantForm.tenant_key}
                      onChange={(e) => {
                        const nextTenantKeyRaw = e.target.value;
                        const nextBoundaryKey = buildDefaultBoundaryKey(nextTenantKeyRaw);
                        setTenantForm((p) => ({
                          ...p,
                          tenant_key: nextTenantKeyRaw,
                          boundary_config_key: nextBoundaryKey || p.boundary_config_key,
                        }));
                      }}
                      placeholder="examplemunicipality"
                      readOnly={!inAddTenantFlow}
                      style={{
                        ...inputBase,
                        background: !inAddTenantFlow ? "#eef4fb" : inputBase.background,
                        cursor: !inAddTenantFlow ? "not-allowed" : "text",
                      }}
                    />
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Organization Name</span>
                    <input readOnly={tenantReadOnly} value={tenantForm.name} onChange={(e) => setTenantForm((p) => ({ ...p, name: e.target.value }))} placeholder="Example Municipality" style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }} />
                    <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                      Primary platform organization name used for tenant records and internal administration.
                    </span>
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Primary URL Prefix</span>
                    <input readOnly={tenantReadOnly} value={primarySubdomainPrefix(tenantForm.primary_subdomain)} onChange={(e) => setTenantForm((p) => ({ ...p, primary_subdomain: e.target.value }))} placeholder="examplemunicipality" style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }} />
                    <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                      Saves as {normalizePrimarySubdomain(tenantForm.primary_subdomain) || "examplemunicipality.cityreport.io"} and controls the live organization subdomain.
                    </span>
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Boundary Dataset Key (auto-managed)</span>
                    <input readOnly value={tenantForm.boundary_config_key} placeholder="examplemunicipality_city_geojson" style={{ ...inputBase, background: "#eef4fb", cursor: "not-allowed" }} />
                    <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                      Upload a `Boundary GeoJSON` file in Files, then set it as boundary.
                    </span>
                  </label>
                  <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: palette.textMuted, marginTop: -2 }}>
                    Turn on the resident updates homepage only when you want this organization root URL to open into the
                    new alerts, events, and municipality hub. Leave it off to keep the map-first experience.
                  </div>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Pothole Notification Email</span>
                    <input readOnly={tenantReadOnly} value={tenantForm.notification_email_potholes} onChange={(e) => setTenantForm((p) => ({ ...p, notification_email_potholes: e.target.value }))} placeholder="roads@examplemunicipality.gov" style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }} />
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Water / Drain Notification Email</span>
                    <input readOnly={tenantReadOnly} value={tenantForm.notification_email_water_drain} onChange={(e) => setTenantForm((p) => ({ ...p, notification_email_water_drain: e.target.value }))} placeholder="utilities@examplemunicipality.gov" style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }} />
                  </label>
                  <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={tenantForm.resident_portal_enabled} disabled={tenantReadOnly} onChange={(e) => setTenantForm((p) => ({ ...p, resident_portal_enabled: e.target.checked }))} /> Resident Updates Homepage Enabled
                  </label>
                  <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={tenantForm.is_pilot} disabled={tenantReadOnly} onChange={(e) => setTenantForm((p) => ({ ...p, is_pilot: e.target.checked }))} /> Pilot Municipality
                  </label>
                  <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <input type="checkbox" checked={tenantForm.active} disabled={tenantReadOnly} onChange={(e) => setTenantForm((p) => ({ ...p, active: e.target.checked }))} /> Active Organization
                  </label>
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {inAddTenantFlow ? (
                      <>
                        <button type="button" style={buttonAlt} onClick={() => setAddTenantStep("contacts")}>
                          Back
                        </button>
                        <button type="submit" style={buttonBase}>
                          Create Organization
                        </button>
                      </>
                    ) : (
                      <button type="submit" style={buttonBase}>
                        Save Organization Setup
                      </button>
                    )}
                  </div>
                </form>
                {status.tenant ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.tenant)}</div> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "users" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Users and Admins</h2>
              <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                Add a person to this organization by finding an existing account or creating a new invited account, then assign one organization role.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={userAssignmentMode === "existing" ? buttonBase : buttonAlt}
                  onClick={() => setUserAssignmentMode("existing")}
                >
                  Find Existing Account
                </button>
                <button
                  type="button"
                  style={userAssignmentMode === "invite" ? buttonBase : buttonAlt}
                  onClick={() => setUserAssignmentMode("invite")}
                >
                  Create Account
                </button>
              </div>

              {userAssignmentMode === "existing" ? (
                <>
                  <form onSubmit={searchPlatformUsers} style={responsiveActionGrid}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Find Person</span>
                      <input
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="Exact email, exact phone, or full name"
                        style={{ ...inputBase, fontSize: 16 }}
                        disabled={!canEditTenantCore}
                      />
                    </label>
                    <button
                      type="submit"
                      style={{ ...buttonBase, opacity: canEditTenantCore ? 1 : 0.55 }}
                      disabled={!canEditTenantCore || userSearchLoading}
                    >
                      {userSearchLoading ? "Searching..." : "Search Accounts"}
                    </button>
                  </form>

                  {userSearchResults.length ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      {userSearchResults.map((row) => {
                        const userId = String(row?.id || "").trim();
                        const displayName = String(row?.display_name || "").trim() || row?.email || "Unnamed account";
                        const isSelected = userId === assignForm.user_id;
                        return (
                          <button
                            key={userId}
                            type="button"
                            onClick={() => setAssignForm((prev) => ({ ...prev, user_id: userId }))}
                            style={{
                              ...listActionButton,
                              border: isSelected ? `1px solid ${palette.mint700}` : listActionButton.border,
                              background: isSelected ? "rgba(18,128,106,0.08)" : listActionButton.background,
                            }}
                          >
                            <span>{displayName}</span>
                            <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                              {[row?.email, row?.phone].filter(Boolean).join(" • ") || "No email or phone on file"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div style={{ display: "grid", gap: 8 }}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4, maxWidth: 320 }}>
                      <span>Organization Role</span>
                      <select
                        value={assignForm.role}
                        onChange={(e) => setAssignForm((p) => ({ ...p, role: e.target.value }))}
                        style={inputBase}
                        disabled={!canEditTenantCore}
                      >
                        {assignableTenantRoles.map((row) => {
                          const key = String(row?.role || "");
                          if (!key) return null;
                          const label = toOrganizationLanguage(String(row?.role_label || "").trim() || roleKeyToLabel(key));
                          return (
                            <option key={key} value={key}>{label}</option>
                          );
                        })}
                        {!assignableTenantRoles.length ? (
                          <>
                            <option value="tenant_employee">Organization Employee</option>
                            <option value="tenant_admin">Organization Admin</option>
                          </>
                        ) : null}
                      </select>
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={() => void assignTenantAdmin({ preventDefault() {} })}
                      style={{ ...buttonBase, opacity: canEditTenantCore && assignForm.user_id ? 1 : 0.55 }}
                      disabled={!canEditTenantCore || !assignForm.user_id}
                      title={assignForm.user_id ? "Assign organization role" : "Select an account first"}
                    >
                      Assign Role
                    </button>
                    {assignForm.user_id ? (
                      <span style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Selected account: <b>{String(selectedSearchAccount?.display_name || "").trim() || selectedSearchAccount?.email || "Account selected"}</b>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12.5, color: palette.textMuted }}>
                        For privacy, account lookup uses exact email, exact phone, or full-name matching before assignment.
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={createAndAssignTenantUser} style={responsiveActionGrid}>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>First Name</span>
                    <input
                      value={inviteForm.first_name}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, first_name: e.target.value }))}
                      placeholder="Jordan"
                      style={inputBase}
                      disabled={!canEditTenantCore}
                    />
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Last Name</span>
                    <input
                      value={inviteForm.last_name}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, last_name: e.target.value }))}
                      placeholder="Rivera"
                      style={inputBase}
                      disabled={!canEditTenantCore}
                    />
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Email</span>
                    <input
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="jordan.rivera@example.gov"
                      style={inputBase}
                      disabled={!canEditTenantCore}
                    />
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Phone Number</span>
                    <input
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 555-0101"
                      style={inputBase}
                      disabled={!canEditTenantCore}
                    />
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Organization Role</span>
                    <select
                      value={assignForm.role}
                      onChange={(e) => setAssignForm((p) => ({ ...p, role: e.target.value }))}
                      style={inputBase}
                      disabled={!canEditTenantCore}
                    >
                      {assignableTenantRoles.map((row) => {
                        const key = String(row?.role || "");
                        if (!key) return null;
                        const label = toOrganizationLanguage(String(row?.role_label || "").trim() || roleKeyToLabel(key));
                        return (
                          <option key={key} value={key}>{label}</option>
                        );
                      })}
                      {!assignableTenantRoles.length ? (
                        <>
                          <option value="tenant_employee">Organization Employee</option>
                          <option value="tenant_admin">Organization Admin</option>
                        </>
                      ) : null}
                    </select>
                  </label>
                  <button
                    type="submit"
                    style={{ ...buttonBase, opacity: canEditTenantCore ? 1 : 0.55 }}
                    disabled={!canEditTenantCore}
                    title={canEditTenantCore ? "Create account and assign organization role" : "Only Platform Owner can create organization users here"}
                  >
                    Create Account + Assign Role
                  </button>
                </form>
              )}
              {status.users ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.users)}</div> : null}
            </div>

            <div style={{ ...card, display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Current Organization Role Assignments</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={tableHeadCell}>User</th>
                      <th style={tableHeadCell}>Role</th>
                      <th style={tableHeadCell}>Created</th>
                      <th style={tableHeadCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTenantRoleAssignments.map((row) => {
                      const rowKey = buildAssignmentRowKey(row);
                      const isEditingRole = editingAssignmentKey === rowKey;
                      const userLabel = formatKnownUserLabel(row.user_id);
                      return (
                      <tr key={rowKey}>
                        <td style={{ padding: "8px 0" }}>{userLabel}</td>
                        <td style={{ padding: "8px 0" }}>
                          {isEditingRole ? (
                            <select
                              value={editingAssignmentRole}
                              onChange={(e) => setEditingAssignmentRole(e.target.value)}
                              style={{ ...inputBase, minWidth: 180 }}
                              disabled={!canEditTenantCore}
                            >
                              {assignableTenantRoles.map((roleRow) => {
                                const key = String(roleRow?.role || "").trim();
                                if (!key) return null;
                                const label = toOrganizationLanguage(String(roleRow?.role_label || "").trim() || roleKeyToLabel(key));
                                return (
                                  <option key={key} value={key}>{label}</option>
                                );
                              })}
                              {!assignableTenantRoles.length ? (
                                <>
                                  <option value="tenant_employee">Organization Employee</option>
                                  <option value="tenant_admin">Organization Admin</option>
                                </>
                              ) : null}
                            </select>
                          ) : (
                            roleLabelByKey?.[row.role] || roleKeyToLabel(row.role)
                          )}
                        </td>
                        <td style={{ padding: "8px 0" }}>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                        <td style={{ padding: "8px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {isEditingRole ? (
                            <>
                              <button
                                type="button"
                                style={{ ...buttonAlt, opacity: canEditTenantCore ? 1 : 0.55 }}
                                onClick={() => void saveTenantAdminRoleEdit(row)}
                                disabled={!canEditTenantCore}
                                title={canEditTenantCore ? "Save role change" : "Only Platform Owner can edit organization roles here"}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                style={buttonAlt}
                                onClick={() => {
                                  setEditingAssignmentKey("");
                                  setEditingAssignmentRole("");
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                style={{ ...buttonAlt, opacity: canEditTenantCore ? 1 : 0.55 }}
                                onClick={() => {
                                  setEditingAssignmentKey(rowKey);
                                  setEditingAssignmentRole(String(row?.role || "").trim());
                                }}
                                disabled={!canEditTenantCore}
                                title={canEditTenantCore ? "Edit role" : "Only Platform Owner can edit organization roles here"}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                style={{ ...buttonAlt, opacity: canEditTenantCore ? 1 : 0.55 }}
                                onClick={() => void removeTenantAdmin(row)}
                                disabled={!canEditTenantCore}
                                title={canEditTenantCore ? "Remove role" : "Only Platform Owner can remove organization roles here"}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    )})}
                    {!selectedTenantRoleAssignments.length ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "10px 0", opacity: 0.75 }}>No organization users have been assigned yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "roles" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Create Organization Role</h2>
              <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                Create custom roles for {selectedTenantKey}, then enable or disable organization permissions.
              </p>
              <form onSubmit={createTenantRole} style={responsiveActionGrid}>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>Role Key</span>
                  <input
                    value={roleForm.role}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, role: sanitizeRoleKey(e.target.value) }))}
                    placeholder="field_supervisor"
                    style={inputBase}
                    disabled={!canEditTenantCore}
                  />
                </label>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>Role Label</span>
                  <input
                    value={roleForm.role_label}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, role_label: e.target.value }))}
                    placeholder="Field Supervisor"
                    style={inputBase}
                    disabled={!canEditTenantCore}
                  />
                </label>
                <button
                  type="submit"
                  style={{ ...buttonBase, opacity: canEditTenantCore ? 1 : 0.55 }}
                  disabled={!canEditTenantCore}
                  title={canEditTenantCore ? "Create role" : "Only Platform Owner can create roles"}
                >
                  Create Role
                </button>
              </form>
              {status.roles ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.roles)}</div> : null}
            </div>

            <div style={{ ...card, display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Roles for {selectedTenantKey}</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={tableHeadCell}>Role</th>
                      <th style={tableHeadCell}>Assignments</th>
                      <th style={tableHeadCell}>Type</th>
                      <th style={tableHeadCell}>State</th>
                      <th style={tableHeadCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTenantRoleDefinitions.map((row) => {
                      const role = String(row?.role || "").trim();
                      if (!role) return null;
                      const roleLabel = toOrganizationLanguage(String(row?.role_label || "").trim() || roleKeyToLabel(role));
                      const assignments = Number(tenantRoleAssignmentCounts?.[role] || 0);
                      const isSelected = role === selectedRoleKey;
                      const canRemove = canEditTenantCore && row?.is_system !== true && assignments === 0;
                      return (
                        <tr key={role} style={{ background: isSelected ? "rgba(18,128,106,0.08)" : "transparent" }}>
                          <td style={{ padding: "8px 0" }}>
                            {roleLabel}
                            <span style={{ marginLeft: 6, color: palette.textMuted, fontSize: 11.5 }}>({role})</span>
                          </td>
                          <td style={{ padding: "8px 0" }}>{assignments}</td>
                          <td style={{ padding: "8px 0" }}>{row?.is_system ? "System" : "Custom"}</td>
                          <td style={{ padding: "8px 0" }}>{row?.active === false ? "Disabled" : "Active"}</td>
                          <td style={{ padding: "8px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" style={buttonAlt} onClick={() => setSelectedRoleKey(role)}>
                              Manage Permissions
                            </button>
                            <button
                              type="button"
                              style={{ ...buttonAlt, opacity: canRemove ? 1 : 0.55 }}
                              disabled={!canRemove}
                              title={
                                row?.is_system
                                  ? "System roles cannot be removed."
                                  : assignments > 0
                                    ? "Remove assignments before deleting this role."
                                    : "Remove role"
                              }
                              onClick={() => void removeTenantRole(row)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!sortedTenantRoleDefinitions.length ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "10px 0", opacity: 0.75 }}>No roles found for this organization.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...card, display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>
                Manage Role Permission {selectedRoleDefinition ? `(${toOrganizationLanguage(String(selectedRoleDefinition.role_label || selectedRoleDefinition.role))})` : ""}
              </h2>
              {selectedRoleDefinition ? (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th style={tableHeadCell}>Module</th>
                          {ROLE_PERMISSION_ACTIONS.map((action) => (
                            <th key={action.key} style={tableHeadCell}>{action.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ROLE_PERMISSION_MODULES.map((module) => (
                          <tr key={module.key}>
                            <td style={{ padding: "8px 0", fontWeight: 700 }}>{module.label}</td>
                            {ROLE_PERMISSION_ACTIONS.map((action) => {
                              const permissionKey = `${module.key}.${action.key}`;
                              return (
                                <td key={permissionKey} style={{ padding: "8px 0" }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(rolePermissionDraft?.[permissionKey])}
                                    disabled={!canEditTenantCore}
                                    onChange={(e) => {
                                      const nextAllowed = e.target.checked;
                                      setRolePermissionDraft((prev) => ({ ...prev, [permissionKey]: nextAllowed }));
                                      setRolePermissionDirty(true);
                                    }}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      style={{ ...buttonBase, opacity: canEditTenantCore ? 1 : 0.55 }}
                      disabled={!canEditTenantCore || !rolePermissionDirty}
                      onClick={() => void saveRolePermissions()}
                    >
                      Save Permission Changes
                    </button>
                    <button
                      type="button"
                      style={buttonAlt}
                      onClick={() => {
                        const resetDraft = {};
                        for (const permissionKey of DEFAULT_TENANT_PERMISSION_KEYS) {
                          resetDraft[permissionKey] = Boolean(rolePermissionMap[`${selectedRoleKey}:${permissionKey}`]);
                        }
                        setRolePermissionDraft(resetDraft);
                        setRolePermissionDirty(false);
                      }}
                      disabled={!rolePermissionDirty}
                    >
                      Reset Changes
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                  Select a role above to edit permissions.
                </p>
              )}
            </div>
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "domains" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Domain Enablement + Map Features</h2>
              <form onSubmit={saveDomainAndFeatureSettings} style={{ display: "grid", gap: 12 }}>
                <div style={responsiveDomainGrid}>
                  {DOMAIN_OPTIONS.map((d) => (
                    <label key={d.key} style={{ display: "grid", gap: 5, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 8, background: "#f8fbff" }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800 }}>{d.label}</span>
                      <select
                        value={domainVisibilityForm[d.key] || "enabled"}
                        onChange={(e) => setDomainVisibilityForm((prev) => ({ ...prev, [d.key]: e.target.value }))}
                        style={inputBase}
                      >
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </label>
                  ))}
                </div>

                <div style={{ border: `1px solid ${palette.border}`, borderRadius: 10, padding: 10, display: "grid", gap: 8, background: "#f8fbff" }}>
                  <div style={{ fontWeight: 900, color: palette.navy900 }}>Map Feature Toggles ({selectedTenantKey})</div>
                  {(() => {
                    const borderEnabled = Boolean(mapFeaturesForm.show_boundary_border);
                    const shadeEnabled = Boolean(mapFeaturesForm.shade_outside_boundary);
                    const disabledFieldStyle = {
                      ...inputBase,
                      opacity: 0.55,
                      cursor: "not-allowed",
                      background: "#edf2f7",
                    };
                    return (
                      <>
                  <label style={{ fontSize: 12.5, display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(mapFeaturesForm.show_boundary_border)}
                      onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, show_boundary_border: e.target.checked }))}
                    />
                    Show boundary border
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4, maxWidth: 240, opacity: borderEnabled ? 1 : 0.65 }}>
                    <span>Boundary border color</span>
                    <div style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 8, alignItems: "center" }}>
                      <input
                        type="color"
                        value={sanitizeHexColor(mapFeaturesForm.boundary_border_color, "#e53935")}
                        disabled={!borderEnabled}
                        onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, boundary_border_color: e.target.value }))}
                        style={borderEnabled ? { ...inputBase, padding: 4, height: 42 } : { ...disabledFieldStyle, padding: 4, height: 42 }}
                      />
                      <input
                        type="text"
                        inputMode="text"
                        value={mapFeaturesForm.boundary_border_color}
                        disabled={!borderEnabled}
                        onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, boundary_border_color: e.target.value }))}
                        onBlur={(e) => setMapFeaturesForm((prev) => ({
                          ...prev,
                          boundary_border_color: sanitizeHexColor(normalizeHexDraft(e.target.value, prev.boundary_border_color), "#e53935"),
                        }))}
                        placeholder="#e53935"
                        style={borderEnabled ? inputBase : disabledFieldStyle}
                      />
                    </div>
                    <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                      Enter a hex color if the mobile picker does not confirm cleanly.
                    </span>
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4, maxWidth: 240, opacity: borderEnabled ? 1 : 0.65 }}>
                    <span>Boundary thickness (0.5 - 8)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={mapFeaturesForm.boundary_border_width}
                      disabled={!borderEnabled}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        if (nextValue === "" || /^-?\d*\.?\d*$/.test(nextValue)) {
                          setMapFeaturesForm((prev) => ({ ...prev, boundary_border_width: nextValue }));
                        }
                      }}
                      onBlur={(e) => {
                        const normalized = normalizeBoundedDecimalInput(e.target.value, { min: 0.5, max: 8 });
                        setMapFeaturesForm((prev) => ({
                          ...prev,
                          boundary_border_width: normalized || "4",
                        }));
                      }}
                      placeholder="4"
                      style={borderEnabled ? inputBase : disabledFieldStyle}
                    />
                  </label>
                  <label style={{ fontSize: 12.5, display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(mapFeaturesForm.shade_outside_boundary)}
                      onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, shade_outside_boundary: e.target.checked }))}
                    />
                    Shade outside boundary
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4, maxWidth: 240, opacity: shadeEnabled ? 1 : 0.65 }}>
                    <span>Outside shade opacity (0.0 - 1.0)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={mapFeaturesForm.outside_shade_opacity}
                      disabled={!shadeEnabled}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        if (nextValue === "" || /^-?\d*\.?\d*$/.test(nextValue)) {
                          setMapFeaturesForm((prev) => ({ ...prev, outside_shade_opacity: nextValue }));
                        }
                      }}
                      onBlur={(e) => {
                        const normalized = normalizeBoundedDecimalInput(e.target.value, { min: 0, max: 1 });
                        setMapFeaturesForm((prev) => ({
                          ...prev,
                          outside_shade_opacity: normalized || "0.42",
                        }));
                      }}
                      placeholder="0.42"
                      style={shadeEnabled ? inputBase : disabledFieldStyle}
                    />
                  </label>
                      </>
                    );
                  })()}
                </div>

                <button type="submit" style={{ ...buttonBase, width: "fit-content" }}>Save Domains + Features</button>
              </form>
              {status.domains ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.domains)}</div> : null}
            </div>
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "files" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Organization Files</h2>
              <form onSubmit={uploadTenantFile} style={responsiveActionGrid}>
                <select value={fileForm.category} onChange={(e) => setFileForm((p) => ({ ...p, category: e.target.value }))} style={inputBase}>
                  <option value="contract">Contract</option>
                  <option value="asset_coordinates">Asset Coordinates</option>
                  <option value="boundary_geojson">Boundary GeoJSON</option>
                  <option value="other">Other</option>
                </select>
                <input type="file" onChange={(e) => setFileForm((p) => ({ ...p, file: e.target.files?.[0] || null }))} style={inputBase} />
                <input value={fileForm.notes} onChange={(e) => setFileForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" style={inputBase} />
                <button type="submit" style={buttonBase}>Upload</button>
              </form>
              {status.files ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.files)}</div> : null}
            </div>

            <div style={{ ...card, display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Files for {selectedTenantKey}</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={tableHeadCell}>Category</th>
                      <th style={tableHeadCell}>Name</th>
                      <th style={tableHeadCell}>Size</th>
                      <th style={tableHeadCell}>Uploaded</th>
                      <th style={tableHeadCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantFiles.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: "8px 0" }}>{row.file_category}</td>
                        <td style={{ padding: "8px 0" }}>{row.file_name}</td>
                        <td style={{ padding: "8px 0" }}>{formatBytes(row.size_bytes)}</td>
                        <td style={{ padding: "8px 0" }}>{row.uploaded_at ? new Date(row.uploaded_at).toLocaleString() : "-"}</td>
                        <td style={{ padding: "8px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button type="button" style={buttonAlt} onClick={() => void openTenantFile(row)}>Open (signed)</button>
                          {String(row?.file_category || "").trim().toLowerCase() === "boundary_geojson" ? (
                            <button type="button" style={buttonAlt} onClick={() => void setBoundaryFromFile(row)}>Set as Boundary</button>
                          ) : null}
                          <button type="button" style={buttonAlt} onClick={() => void removeTenantFile(row)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                    {!tenantFiles.length ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "10px 0", opacity: 0.75 }}>No files yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "audit" ? (
          <section style={{ ...card, display: "grid", gap: 8 }}>
            <h2 style={{ margin: 0, color: palette.navy900 }}>Recent Organization Audit ({selectedTenantKey})</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCell}>When</th>
                    <th style={tableHeadCell}>Organization</th>
                    <th style={tableHeadCell}>What Happened</th>
                    <th style={tableHeadCell}>Changed Item</th>
                    <th style={tableHeadCell}>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "8px 0" }}>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                      <td style={{ padding: "8px 0" }}>{row.tenant_key || "-"}</td>
                      <td style={{ padding: "8px 0" }}>{buildAuditActionLabel(row)}</td>
                      <td style={{ padding: "8px 0" }}>{buildAuditEntityLabel(row)}</td>
                      <td style={{ padding: "8px 0" }}>{String(row?.actor_name || "").trim() || row.actor_user_id || "-"}</td>
                    </tr>
                  ))}
                  {!auditRows.length ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "10px 0", opacity: 0.75 }}>No audit rows yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {status.audit ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.audit)}</div> : null}
          </section>
        ) : null}
      </section>
      ) : null}
      {forgotPasswordOpen ? (
        <div style={authModalBackdrop} onClick={closeForgotPasswordModal}>
          <div style={authModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Reset Password</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Enter your account email and we&apos;ll send a password reset link.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForgotPasswordModal}
                style={{
                  ...buttonAlt,
                  minWidth: 0,
                  width: 34,
                  height: 34,
                  padding: 0,
                  borderRadius: 10,
                  fontSize: 18,
                  lineHeight: 1,
                }}
                aria-label="Close password reset dialog"
              >
                ×
              </button>
            </div>
            <input
              {...STANDARD_LOGIN_EMAIL_INPUT_PROPS}
              value={forgotPasswordEmail}
              onChange={(event) => setForgotPasswordEmail(event.target.value)}
              style={inputBase}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !authResetLoading) {
                  event.preventDefault();
                  void sendPasswordReset();
                }
              }}
            />
            {forgotPasswordError ? <p style={{ margin: 0, color: palette.red600, fontSize: 12.5 }}>{forgotPasswordError}</p> : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={{ ...buttonBase, minWidth: 160 }} disabled={authResetLoading} onClick={() => void sendPasswordReset()}>
                {authResetLoading ? "Sending reset..." : "Send Reset Email"}
              </button>
              <button type="button" style={{ ...buttonAlt, minWidth: 120 }} onClick={closeForgotPasswordModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
