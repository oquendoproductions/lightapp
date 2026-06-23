import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import "./headerStandards.css";
import {
  STANDARD_LOGIN_EMAIL_INPUT_PROPS,
  STANDARD_LOGIN_FORM_PROPS,
  getStandardLoginPasswordInputProps,
} from "./auth/loginFieldStandards";
import { getAuthRedirectOptions } from "./platform/auth.js";
import { openExternalUrl } from "./platform/external.js";
import {
  MAP_UI_ICON_ACCEPT,
  MAP_UI_ICON_BUCKET,
  MAP_UI_ICON_CATALOG,
  MAP_UI_ICON_DRAFT_CONFIG_KEY,
  MAP_UI_ICON_MAX_BYTES,
  MAP_UI_ICON_PUBLISHED_CONFIG_KEY,
  MAP_UI_ICON_RENDER_MODE,
  MAP_UI_ICON_RENDER_MODE_OPTIONS,
  MAP_UI_ICON_THEME_DEFAULTS,
  MAP_UI_THEME_DEFAULT_THEME_ID,
  MAP_UI_THEME_DRAFT_CONFIG_KEY,
  MAP_UI_THEME_PUBLISHED_CONFIG_KEY,
  MAP_UI_THEME_FIELDS,
  buildMapUiThemeConfigValue,
  isMapUiBaseThemeEnabled,
  mergeMapUiIconMeta,
  mergeMapUiTheme,
  resolveActiveMapUiThemeSchedule,
  sanitizeMapUiIconManifest,
  sanitizeMapUiTheme,
  sanitizeMapUiThemes,
  sanitizeMapUiThemeSchedules,
} from "./mapUiIconCatalog";
import {
  DOMAIN_ICON_TINT_MODE,
  DOMAIN_ICON_TINT_MODE_OPTIONS,
  normalizeDomainIconRenderMode,
  normalizeDomainIconTintColor,
  normalizeDomainIconTintMode,
  resolveDomainMarkerIconTintColor,
} from "./domainIconRendering";
import { buildMailtoHref, CITYREPORT_SUPPORT_EMAIL } from "./lib/workspaceSupport";

const TITLE_LOGO_SRC = import.meta.env.VITE_TITLE_LOGO_SRC || "/Logos/cityreport_logo.svg";
const MOBILE_TITLE_LOGO_SRC =
  import.meta.env.VITE_MOBILE_TITLE_LOGO_SRC || "/Logos/cityreport_pin_logo.svg";
const TITLE_LOGO_ALT = "CityReport.io";

const DOMAIN_OPTIONS = [
  { key: "streetlights", label: "Streetlights" },
  { key: "street_signs", label: "Street Signs" },
  { key: "potholes", label: "Potholes" },
  { key: "water_drain_issues", label: "Water / Drain" },
  { key: "power_outage", label: "Power Outage" },
  { key: "water_main", label: "Water Main" },
  { key: "downed_tree", label: "Downed Tree" },
  { key: "encampment", label: "Encampment" },
  { key: "illegal_dumping", label: "Illegal Dumping" },
  { key: "graffiti", label: "Graffiti" },
];

function fallbackRegistryDomainRows() {
  return DOMAIN_OPTIONS.map((domain, index) => ({
    key: domain.key,
    label: domain.label,
    status: "active",
    domain_class: defaultDomainType(domain.key),
    default_visibility: "enabled",
    sort_order: (index + 1) * 10,
  }));
}

const DOMAIN_TYPE_OPTIONS = [
  { key: "asset_backed", label: "Asset-Backed Domain" },
  { key: "incident_driven", label: "Incident-Driven Domain" },
];

const UPLOAD_DOMAIN_ICON_SELECTION = "__upload__";
const CUSTOM_DOMAIN_ICON_SELECTION = "__custom__";
const DOMAIN_ICON_MAX_BYTES = 2 * 1024 * 1024;
const DOMAIN_ICON_ACCEPT = ".svg,.png,.webp,image/svg+xml,image/png,image/webp";

const DOMAIN_ASSIGNMENT_VISIBILITY_OPTIONS = [
  { key: "enabled", label: "Enabled" },
  { key: "disabled", label: "Disabled" },
];

const DOMAIN_BILLING_STATUS_OPTIONS = [
  { key: "not_applicable", label: "Not Applicable" },
  { key: "pending_review", label: "Pending Review" },
  { key: "approved", label: "Approved" },
  { key: "waived", label: "Waived" },
];

const DOMAIN_BILLING_MODEL_OPTIONS = [
  { key: "included", label: "Included" },
  { key: "add_on", label: "Add-On" },
  { key: "custom", label: "Custom" },
];

function domainAssignmentVisibilityLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  return DOMAIN_ASSIGNMENT_VISIBILITY_OPTIONS.find((option) => option.key === key)?.label || "Enabled";
}

function domainBillingStatusLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  return DOMAIN_BILLING_STATUS_OPTIONS.find((option) => option.key === key)?.label || "Not Applicable";
}

function domainBillingModelLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  return DOMAIN_BILLING_MODEL_OPTIONS.find((option) => option.key === key)?.label || "Included";
}

const DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS = [
  {
    key: "standard_ops",
    label: "Standard Operations",
    description: "Balanced triage format with location, notes, and reporter contact details.",
    subject: "{{domain_label}} report ({{report_number}})",
    body: `A new {{domain_label}} report was submitted through CityReport.io.

Tenant: {{tenant_key}}
Domain: {{domain_label}}
Issue Type: {{issue_type}}
Report Number: {{report_number}}
Closest Address: {{closest_address}}
Cross Street: {{closest_cross_street}}
Closest Intersection: {{closest_intersection}}
Closest Landmark: {{closest_landmark}}
Location: {{location_text}}
Image URL: {{image_url}}
Submitted (Local): {{submitted_at_local}}

Notes:
{{notes}}

Reported by:
Type: {{reporter_type}}
Name: {{reporter_name}}
Email: {{reporter_email}}
Phone: {{reporter_phone}}

This report was submitted through CityReport.io and forwarded by our system as an intermediary.`,
  },
  {
    key: "compact_triage",
    label: "Compact Triage",
    description: "Shorter dispatch-style template for fast operational routing.",
    subject: "New {{domain_label}} report: {{report_number}}",
    body: `{{domain_label}} report for {{tenant_key}}.

Issue Type: {{issue_type}}
Address: {{closest_address}}
Cross Street: {{closest_cross_street}}
Location: {{location_text}}
Submitted: {{submitted_at_local}}

Notes:
{{notes}}

Reporter:
{{reporter_name}} | {{reporter_email}} | {{reporter_phone}}`,
  },
  {
    key: "resident_follow_up",
    label: "Resident Follow-Up",
    description: "Emphasizes resident contact information for direct follow-up.",
    subject: "{{domain_label}} resident report ({{report_number}})",
    body: `CityReport.io forwarded a {{domain_label}} report for {{tenant_key}}.

Report Number: {{report_number}}
Issue Type: {{issue_type}}
Closest Address: {{closest_address}}
Closest Intersection: {{closest_intersection}}
Closest Landmark: {{closest_landmark}}
Location: {{location_text}}
Submitted (Local): {{submitted_at_local}}
Image URL: {{image_url}}

Resident Notes:
{{notes}}

Please follow up with:
Name: {{reporter_name}}
Email: {{reporter_email}}
Phone: {{reporter_phone}}
Reporter Type: {{reporter_type}}`,
  },
];

const DOMAIN_NOTIFICATION_TEMPLATE_TOKENS = [
  "{{tenant_key}}",
  "{{domain_label}}",
  "{{issue_type}}",
  "{{report_number}}",
  "{{closest_address}}",
  "{{closest_cross_street}}",
  "{{closest_intersection}}",
  "{{closest_landmark}}",
  "{{location_text}}",
  "{{image_url}}",
  "{{submitted_at_local}}",
  "{{notes}}",
  "{{reporter_type}}",
  "{{reporter_name}}",
  "{{reporter_email}}",
  "{{reporter_phone}}",
];

const DOMAIN_MARKER_COLOR_DEFAULTS = {
  streetlights: "#234a72",
  street_signs: "#1e88e5",
  potholes: "#8e24aa",
  water_drain_issues: "#0288d1",
  power_outage: "#d32f2f",
  water_main: "#1e88e5",
  downed_tree: "#2e7d32",
  encampment: "#00897b",
  illegal_dumping: "#ef6c00",
  graffiti: "#8e24aa",
};

const TAB_OPTIONS = [
  { key: "tenants", label: "Organization Info" },
  { key: "contacts", label: "Points of Contact" },
  { key: "users", label: "Users/Admins" },
  { key: "roles", label: "Roles + Permissions" },
  { key: "domains", label: "Domains" },
  { key: "map-features", label: "Map Features" },
  { key: "files", label: "Assets" },
  { key: "audit", label: "Audit" },
];

const CONTROL_PLANE_SECTIONS = [
  { key: "organizations", label: "Organizations" },
  { key: "settings", label: "Settings" },
  { key: "reports", label: "Reports" },
];

const CONTROL_PLANE_TAB_SECTIONS = CONTROL_PLANE_SECTIONS.filter((section) => section.key !== "settings");

const CONTROL_PLANE_PAGES = [
  { key: "manage-organizations", section: "organizations", label: "Manage Organizations" },
  { key: "manage-leads", section: "organizations", label: "Manage Leads" },
  { key: "lead-detail", section: "organizations", label: "Lead Detail", hidden: true },
  { key: "account-info", section: "settings", label: "Account Info" },
  { key: "domain-registry", section: "settings", label: "Domain Registry" },
  { key: "map-ui-icons", section: "settings", label: "Map UI Icons" },
  { key: "map-ui-theme", section: "settings", label: "Map UI Themes" },
  { key: "manage-team", section: "settings", label: "Manage Team" },
  { key: "roles-permissions", section: "settings", label: "Roles & Permissions" },
  { key: "security-checks", section: "settings", label: "Security Checks" },
  { key: "organization-reports", section: "reports", label: "Organization Reports" },
  { key: "domain-reports", section: "reports", label: "Domain Reports" },
  { key: "leads-reports", section: "reports", label: "Leads Reports" },
  { key: "finance-reports", section: "reports", label: "Finance Reports" },
];

const DEFAULT_CONTROL_PLANE_PAGE = "organization-reports";
const DEFAULT_SETTINGS_CONTROL_PLANE_PAGE = "account-info";
const CONTROL_PLANE_ROUTE_QUERY_KEYS = {
  section: "pcp_section",
  page: "pcp_page",
  entry: "pcp_entry",
  tenant: "pcp_tenant",
  tab: "pcp_tab",
  addStep: "pcp_add_step",
  lead: "pcp_lead",
};

const CONTROL_PLANE_TOP_NAV_ITEMS = [
  { type: "page", key: "manage-organizations", label: "Manage Organizations" },
  { type: "page", key: "manage-leads", label: "Manage Leads" },
  { type: "section", key: "reports", label: "Reports" },
];

const CONTROL_PLANE_SETTINGS_NAV = [
  {
    key: "account",
    label: "Account",
    items: [
      { key: "account-info", label: "Account Info" },
    ],
  },
  {
    key: "platform",
    label: "Platform",
    items: [
      { key: "domain-registry", label: "Domain Registry" },
      { key: "map-ui-icons", label: "Map UI Icons" },
      { key: "map-ui-theme", label: "Map UI Themes" },
    ],
  },
  {
    key: "team",
    label: "Team Access",
    items: [
      { key: "manage-team", label: "Manage Team" },
      { key: "roles-permissions", label: "Roles & Permissions" },
      { key: "security-checks", label: "Security Checks" },
    ],
  },
];

const DEFAULT_PLATFORM_SECURITY_SETTINGS = {
  require_pin_for_role_changes: false,
  require_pin_for_team_changes: false,
  require_pin_for_account_changes: false,
  require_pin_for_report_state_changes: false,
  require_pin_for_organization_info_changes: false,
  require_pin_for_contact_changes: false,
  require_pin_for_organization_user_changes: false,
  require_pin_for_organization_role_changes: false,
  require_pin_for_domain_settings_changes: false,
};

const DEFAULT_PLATFORM_SECURITY_PIN_DRAFT = {
  current_pin: "",
  account_password: "",
  pin: "",
  confirm_pin: "",
};

function readInitialControlPlaneRouteState() {
  const defaultState = {
    controlPlaneSection: "reports",
    controlPlanePage: DEFAULT_CONTROL_PLANE_PAGE,
    entryStep: "start",
    selectedTenantKey: "ashtabulacity",
    activeTab: "tenants",
    addTenantStep: ADD_TENANT_STEPS[0].key,
    selectedLeadId: "",
  };
  if (typeof window === "undefined") return defaultState;

  const params = new URLSearchParams(window.location.search);
  const requestedPage = String(params.get(CONTROL_PLANE_ROUTE_QUERY_KEYS.page) || "").trim();
  const resolvedPage = CONTROL_PLANE_PAGES.find((page) => page.key === requestedPage);
  const requestedSection = String(params.get(CONTROL_PLANE_ROUTE_QUERY_KEYS.section) || "").trim();
  const resolvedSection = resolvedPage?.section
    || CONTROL_PLANE_SECTIONS.find((section) => section.key === requestedSection)?.key
    || defaultState.controlPlaneSection;
  const requestedEntryStep = String(params.get(CONTROL_PLANE_ROUTE_QUERY_KEYS.entry) || "").trim();
  const entryStep = ["start", "add", "tenant"].includes(requestedEntryStep) ? requestedEntryStep : defaultState.entryStep;
  const tenantKey = sanitizeTenantKey(params.get(CONTROL_PLANE_ROUTE_QUERY_KEYS.tenant) || "") || defaultState.selectedTenantKey;
  const requestedTab = String(params.get(CONTROL_PLANE_ROUTE_QUERY_KEYS.tab) || "").trim();
  const activeTab = TAB_OPTIONS.some((tab) => tab.key === requestedTab) ? requestedTab : defaultState.activeTab;
  const requestedAddStep = String(params.get(CONTROL_PLANE_ROUTE_QUERY_KEYS.addStep) || "").trim();
  const addTenantStep = ADD_TENANT_STEPS.some((step) => step.key === requestedAddStep) ? requestedAddStep : defaultState.addTenantStep;
  const selectedLeadId = String(params.get(CONTROL_PLANE_ROUTE_QUERY_KEYS.lead) || "").trim();

  return {
    controlPlaneSection: resolvedSection,
    controlPlanePage: resolvedPage?.key || defaultState.controlPlanePage,
    entryStep,
    selectedTenantKey: tenantKey,
    activeTab,
    addTenantStep,
    selectedLeadId,
  };
}

const PLATFORM_PERMISSION_ACTIONS = [
  { key: "access", label: "Access" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
];

const PLATFORM_PERMISSION_MODULES = [
  { key: "account", label: "Account" },
  { key: "organizations", label: "Organizations" },
  { key: "leads", label: "Leads" },
  { key: "users", label: "Users" },
  { key: "roles", label: "Roles" },
  { key: "security", label: "Security" },
  { key: "reports", label: "Reports" },
  { key: "finance", label: "Finance" },
  { key: "domains", label: "Domains" },
  { key: "files", label: "Assets" },
  { key: "audit", label: "Audit" },
];

const TENANT_PERMISSION_ACTIONS = [
  { key: "access", label: "Access" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
];

const TENANT_PERMISSION_MODULES = [
  { key: "reports", label: "Reports" },
  { key: "users", label: "Users" },
  { key: "domains", label: "Domains" },
  { key: "files", label: "Assets" },
  { key: "audit", label: "Audit" },
  { key: "roles", label: "Roles" },
];

const ASSIGNED_DOMAIN_SECTION_OPTIONS = [
  { key: "tenant-assignment", label: "Tenant Assignment" },
  { key: "marker-icon", label: "Marker and Icon Settings" },
  { key: "reporting", label: "Reporting" },
  { key: "report-email-template", label: "Report Email Template" },
];

const DEFAULT_PLATFORM_PERMISSION_KEYS = PLATFORM_PERMISSION_MODULES.flatMap((module) =>
  PLATFORM_PERMISSION_ACTIONS.map((action) => `${module.key}.${action.key}`)
);

const DEFAULT_PLATFORM_ROLE_DEFINITIONS = [
  { role: "platform_owner", role_label: "Platform Owner", is_system: true, active: true },
  { role: "platform_staff", role_label: "Platform Staff", is_system: true, active: true },
];

const DEFAULT_PLATFORM_ROLE_PERMISSIONS = DEFAULT_PLATFORM_PERMISSION_KEYS.flatMap((permissionKey) => (
  DEFAULT_PLATFORM_ROLE_DEFINITIONS.map((role) => ({
    role: role.role,
    permission_key: permissionKey,
    allowed: role.role === "platform_owner"
      ? true
      : [
        "account.access",
        "leads.access",
        "leads.edit",
        "organizations.access",
        "reports.access",
        "domains.access",
        "domains.edit",
        "files.access",
        "files.edit",
        "audit.access",
      ].includes(permissionKey),
  }))
));

const CONTROL_PLANE_PAGE_PERMISSIONS = {
  "manage-organizations": "organizations.access",
  "manage-leads": "leads.access",
  "lead-detail": "leads.access",
  "account-info": "account.access",
  "domain-registry": "domains.access",
  "map-ui-icons": "domains.access",
  "map-ui-theme": "domains.access",
  "manage-team": "users.access",
  "roles-permissions": "roles.access",
  "security-checks": "security.access",
  "organization-reports": "reports.access",
  "domain-reports": "reports.access",
  "leads-reports": "reports.access",
  "finance-reports": "finance.access",
};

const TENANT_WORKSPACE_TAB_PERMISSIONS = {
  tenants: "organizations.access",
  contacts: "organizations.access",
  users: "users.access",
  roles: "roles.access",
  domains: "domains.access",
  "map-features": "domains.access",
  files: "files.access",
  audit: "audit.access",
};

const DEFAULT_TENANT_PERMISSION_KEYS = TENANT_PERMISSION_MODULES.flatMap((module) =>
  TENANT_PERMISSION_ACTIONS.map((action) => `${module.key}.${action.key}`)
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
  padding: `calc(${FIXED_BANNER_HEIGHT} + ${FIXED_BANNER_TOP}) 18px 42px`,
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
  minHeight: 44,
  lineHeight: 1.35,
  fontSize: 16,
  boxSizing: "border-box",
  color: palette.navy900,
  background: "#fbfdff",
  verticalAlign: "top",
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
  alignItems: "start",
};

const formFieldLabel = {
  fontSize: 12.5,
  display: "grid",
  gap: 4,
  alignContent: "start",
};

const alignedFormButton = {
  minHeight: inputBase.minHeight,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
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
  alignItems: "start",
};

const listActionButton = {
  ...buttonAlt,
  textAlign: "left",
  display: "grid",
  gap: 2,
  fontWeight: 700,
};

const contactFieldGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
  gap: 10,
  alignItems: "start",
};

const contactField = {
  display: "grid",
  gap: 4,
  fontSize: 12.5,
  color: palette.text,
};

const contactFieldInput = {
  ...inputBase,
  minHeight: 36,
  padding: "6px 10px",
};

const modalField = {
  fontSize: 12.5,
  display: "grid",
  gap: 4,
};

const modalInput = {
  ...inputBase,
  minHeight: 44,
};

const modalActionGrid = {
  ...responsiveActionGrid,
  alignItems: "end",
};

const modalPrimaryButton = {
  ...buttonBase,
  minHeight: 44,
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalSecondaryButton = {
  ...buttonAlt,
  minHeight: 44,
  padding: "0 14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const modalToggleButton = {
  ...modalSecondaryButton,
  minWidth: 180,
};

const modalFooterActions = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
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
  maxWidth: "min(300px, calc(100vw - 220px))",
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
  top: "var(--app-tab-rail-offset)",
  zIndex: 25,
  padding: 0,
  background: "transparent",
};

const controlPlaneTabsShell = {
  width: "100%",
  padding: "var(--app-tab-rail-shell-padding)",
  border: "1px solid rgba(23, 49, 79, 0.08)",
  borderTop: 0,
  borderRadius: 0,
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "none",
};

const controlPlaneTabsBar = {
  display: "grid",
  gridAutoFlow: "column",
  gridAutoColumns: "minmax(0, 1fr)",
  minWidth: 0,
  width: "100%",
  gap: "var(--app-tab-rail-gap)",
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
  padding: "var(--workspace-rail-tab-padding-y) var(--workspace-rail-tab-padding-x)",
  fontSize: "var(--workspace-rail-tab-font-size)",
  fontWeight: "var(--workspace-rail-tab-font-weight)",
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

const controlPlaneMobileTabsShell = {
  padding: 8,
  border: "1px solid rgba(23, 49, 79, 0.12)",
  borderRadius: 28,
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 18px 36px rgba(17, 49, 79, 0.16)",
  backdropFilter: "blur(14px)",
};

const controlPlaneMobileTabButton = {
  width: "100%",
  border: 0,
  borderRadius: 18,
  background: "transparent",
  color: "#17314f",
  minHeight: 48,
  padding: "8px 6px",
  font: "inherit",
  fontSize: 12,
  fontWeight: 800,
  lineHeight: 1.1,
  textAlign: "center",
  cursor: "pointer",
};

const controlPlaneMobileTabButtonActive = {
  ...controlPlaneMobileTabButton,
  background: "rgba(23, 109, 120, 0.14)",
  color: "#0e5d67",
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

const controlPlaneSettingsLayout = {
  display: "grid",
  gridTemplateColumns: "minmax(240px, 280px) minmax(0, 1fr)",
  gap: 18,
  alignItems: "stretch",
};

const controlPlaneSettingsSidebar = {
  position: "sticky",
  top: "calc(var(--desktop-header-height) + 74px)",
  display: "grid",
  gap: 14,
  alignSelf: "stretch",
};

const controlPlaneSettingsSidebarShell = {
  display: "grid",
  gap: 16,
  padding: "18px 14px 16px",
  borderRadius: 24,
  background: "linear-gradient(180deg, #155e59 0%, #154f4b 100%)",
  boxShadow: "0 24px 44px rgba(10, 34, 42, 0.18)",
  minHeight: "calc(100vh - var(--desktop-header-height) - 98px)",
  alignContent: "start",
};

const controlPlaneSettingsGroupButton = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 12px",
  border: 0,
  borderRadius: 14,
  background: "transparent",
  color: "rgba(239, 250, 248, 0.92)",
  font: "inherit",
  fontWeight: 800,
  cursor: "pointer",
};

const controlPlaneSettingsItemButton = {
  width: "100%",
  display: "block",
  padding: "10px 12px",
  border: "1px solid transparent",
  borderRadius: 14,
  background: "transparent",
  color: "rgba(227, 245, 242, 0.92)",
  font: "inherit",
  fontSize: 13,
  fontWeight: 600,
  textAlign: "left",
  cursor: "pointer",
};

const metricCard = {
  ...subPanel,
  display: "grid",
  gap: 4,
  alignContent: "start",
  minHeight: 96,
};

const metricCardButton = {
  ...metricCard,
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
};

const ADD_TENANT_STEPS = [
  { key: "organization", label: "Organization Contact Information" },
  { key: "contacts", label: "Primary + Additional Contacts" },
  { key: "setup", label: "Basic Setup" },
];

const TENANT_ASSET_CATEGORIES = [
  {
    key: "contract",
    label: "Contracts",
    description: "Signed agreements, amendments, and supporting contract documents for the organization.",
  },
  {
    key: "logo",
    label: "Logos",
    description: "Organization logo files used for hub branding, identity, and other public-facing surfaces.",
  },
  {
    key: "asset_coordinates",
    label: "Asset Coordinates",
    description: "Bulk asset coordinate files and source data used to seed or refresh organization asset records.",
  },
  {
    key: "boundary_geojson",
    label: "Boundary GeoJSON",
    description: "Boundary files that define the organization map footprint and service area.",
  },
  {
    key: "other",
    label: "Other Files",
    description: "Additional supporting documents that do not fit the main organization asset categories.",
  },
];

function initialTenantForm() {
  return {
    tenant_key: "",
    name: "",
    primary_subdomain: "",
    boundary_config_key: "",
    notification_email_potholes: "",
    notification_email_water_drain: "",
    resident_portal_enabled: true,
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
  for (const d of DOMAIN_OPTIONS) out[d.key] = "disabled";
  return out;
}

function defaultDomainType(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  if (key === "streetlights" || key === "street_signs") return "asset_backed";
  return "incident_driven";
}

function isLegacyIncidentEnumDomain(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  return [
    "streetlights",
    "street_signs",
    "potholes",
    "water_drain_issues",
    "power_outage",
    "water_main",
  ].includes(key);
}

function defaultDomainLabel(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  return DOMAIN_OPTIONS.find((entry) => entry.key === key)?.label || roleKeyToLabel(key || "domain");
}

function defaultDomainMarkerColor(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  return sanitizeHexColor(DOMAIN_MARKER_COLOR_DEFAULTS[key], "#234a72");
}

function sanitizePositiveIntegerSetting(value, fallback, options = {}) {
  const min = Number.isFinite(Number(options?.min)) ? Number(options.min) : 1;
  const max = Number.isFinite(Number(options?.max)) ? Number(options.max) : 99;
  const resolvedFallback = Math.max(min, Math.min(max, Math.round(Number(fallback || min))));
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return resolvedFallback;
  return Math.max(min, Math.min(max, numeric));
}

function defaultDomainPublicVisibilityMinReports(domainKey) {
  return defaultDomainType(domainKey) === "incident_driven" ? 2 : 1;
}

function defaultDomainHighConfidenceMinReports(domainKey) {
  const publicMin = defaultDomainPublicVisibilityMinReports(domainKey);
  return Math.max(publicMin, 4);
}

function initialDomainConfigForm() {
  const out = {};
  for (const d of DOMAIN_OPTIONS) {
    const preset = domainNotificationTemplateOption("");
    out[d.key] = {
      domain_type: defaultDomainType(d.key),
      display_label: defaultDomainLabel(d.key),
      marker_color: defaultDomainMarkerColor(d.key),
      notification_email: "",
      notification_template_key: preset.key,
      notification_subject_template: preset.subject,
      notification_body_template: preset.body,
      organization_monitored_repairs: true,
      public_visibility_min_reports: defaultDomainPublicVisibilityMinReports(d.key),
      high_confidence_min_reports: defaultDomainHighConfidenceMinReports(d.key),
      icon_render_mode: MAP_UI_ICON_RENDER_MODE.RASTER,
      icon_tint_mode: DOMAIN_ICON_TINT_MODE.AUTO_CONTRAST,
      icon_tint_color: "",
      type_options: [],
      report_disclosures: defaultDomainDisclosures(d.key),
    };
  }
  return out;
}

function defaultTenantDomainIconRenderMode(domainKey = "", iconSrc = "") {
  return normalizeDomainIconRenderMode("", String(iconSrc || "").trim());
}

function slugifyDomainKeyInput(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function parseDomainIssueTypeInput(value) {
  const seen = new Set();
  const rows = [];
  const chunks = String(value || "")
    .split(/\r?\n|,/)
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const issueLabel = chunk.replace(/\s+/g, " ").trim();
    if (!issueLabel) continue;
    const issueKey = slugifyDomainKeyInput(issueLabel);
    if (!issueKey || seen.has(issueKey)) continue;
    seen.add(issueKey);
    rows.push({
      issue_key: issueKey,
      issue_label: issueLabel,
    });
  }
  return rows;
}

function serializeDomainIssueTypeInput(issueTypes) {
  return (Array.isArray(issueTypes) ? issueTypes : [])
    .map((row) => String(row?.issue_label || "").trim())
    .filter(Boolean)
    .join("\n");
}

function parseDomainTypeOptionChoicesInput(value) {
  const seen = new Set();
  const rows = [];
  const chunks = String(value || "")
    .split(/\r?\n|,/)
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  for (const chunk of chunks) {
    const label = chunk.replace(/\s+/g, " ").trim();
    if (!label) continue;
    const key = slugifyDomainKeyInput(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    rows.push({
      value: key,
      label,
    });
  }
  return rows;
}

function serializeDomainTypeOptionChoicesInput(choices) {
  return (Array.isArray(choices) ? choices : [])
    .map((row) => String(row?.label || "").trim())
    .filter(Boolean)
    .join("\n");
}

function defaultDomainTypeOptionLabel(domainKey = "", index = 0) {
  const domain = String(domainKey || "").trim().toLowerCase();
  if (domain === "street_signs" && index === 0) return "Sign Type";
  return `Type Option ${index + 1}`;
}

function isIssueTypeOptionConfig(option) {
  const optionKey = slugifyDomainKeyInput(option?.option_key || option?.optionKey || "");
  const optionLabel = slugifyDomainKeyInput(option?.option_label || option?.optionLabel || option?.label || "");
  return optionKey === "issue_type" || optionLabel === "issue_type";
}

function buildIssueTypeOptionConfigFromLegacy(issueTypes = [], domainKey = "") {
  const choices = (Array.isArray(issueTypes) ? issueTypes : [])
    .map((row, index) => {
      const issueLabel = String(row?.issue_label || row?.label || "").replace(/\s+/g, " ").trim();
      const issueKey = slugifyDomainKeyInput(row?.issue_key || row?.value || issueLabel);
      if (!issueLabel || !issueKey) return null;
      return {
        value: issueKey,
        label: issueLabel,
        sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : (index + 1) * 10,
      };
    })
    .filter(Boolean);
  if (!choices.length) return null;
  return {
    id: `${String(domainKey || "domain").trim().toLowerCase() || "domain"}_issue_type`,
    option_key: "issue_type",
    option_label: "Issue Type",
    choices_input: serializeDomainTypeOptionChoicesInput(choices),
  };
}

function mergeTenantDomainTypeOptions({
  domainKey = "",
  assignmentTypeOptions = [],
  registryTypeOptions = [],
  legacyIssueTypes = [],
} = {}) {
  const assignmentOptions = normalizeDomainTypeOptionConfigs(assignmentTypeOptions, domainKey);
  const registryOptions = normalizeDomainTypeOptionConfigs(registryTypeOptions, domainKey);
  const baseOptions = assignmentOptions.length ? assignmentOptions : registryOptions;
  const nextOptions = Array.isArray(baseOptions) ? [...baseOptions] : [];
  const legacyIssueOption = buildIssueTypeOptionConfigFromLegacy(legacyIssueTypes, domainKey);
  if (legacyIssueOption && !nextOptions.some((row) => isIssueTypeOptionConfig(row))) {
    nextOptions.push(legacyIssueOption);
  }
  return nextOptions;
}

function normalizeDomainTypeOptionConfigs(value, domainKey = "") {
  const rows = Array.isArray(value) ? value : [];
  if (!rows.length) return [];
  const looksLegacyFlat = rows.every((row) => (
    row
    && typeof row === "object"
    && !Array.isArray(row?.choices)
    && !Array.isArray(row?.options)
    && !Array.isArray(row?.type_choices)
    && !row?.option_key
    && !row?.optionKey
    && !row?.option_label
    && !row?.optionLabel
    && (row?.type_key || row?.type_label || row?.label || row?.value)
  ));
  if (looksLegacyFlat) {
    const choices = rows
      .map((row, index) => ({
        value: String(row?.type_key || row?.value || "").trim().toLowerCase(),
        label: String(row?.type_label || row?.label || "").trim(),
        sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : (index + 1) * 10,
      }))
      .filter((row) => row.value && row.label);
    return choices.length ? [{
      id: `${String(domainKey || "domain").trim().toLowerCase() || "domain"}_type_option_1`,
      option_key: domainKey === "street_signs" ? "sign_type" : "type_option_1",
      option_label: defaultDomainTypeOptionLabel(domainKey, 0),
      choices_input: serializeDomainTypeOptionChoicesInput(choices),
    }] : [];
  }

  return rows.map((row, index) => {
    const optionLabel = String(row?.optionLabel || row?.option_label || row?.label || "").replace(/\s+/g, " ").trim() || defaultDomainTypeOptionLabel(domainKey, index);
    const optionKey = slugifyDomainKeyInput(row?.optionKey || row?.option_key || optionLabel || `type_option_${index + 1}`) || `type_option_${index + 1}`;
    const existingChoicesInput = String(row?.choices_input || "").trim();
    const rawChoices = Array.isArray(row?.choices)
      ? row.choices
      : Array.isArray(row?.options)
        ? row.options
        : Array.isArray(row?.type_choices)
          ? row.type_choices
          : [];
    const parsedChoices = rawChoices.map((choice, choiceIndex) => ({
      value: String(choice?.value || choice?.type_key || "").trim().toLowerCase(),
      label: String(choice?.label || choice?.type_label || "").trim(),
      sort_order: Number.isFinite(Number(choice?.sort_order)) ? Number(choice.sort_order) : (choiceIndex + 1) * 10,
    })).filter((choice) => choice.value && choice.label);
    return {
      id: String(row?.id || "").trim() || createDomainDisclosureId("type_option"),
      option_key: optionKey,
      option_label: optionLabel,
      choices_input: existingChoicesInput || serializeDomainTypeOptionChoicesInput(parsedChoices),
    };
  }).filter((row) => row.option_label || row.choices_input);
}

function buildStoredDomainTypeOptionConfigs(value, domainKey = "") {
  return normalizeDomainTypeOptionConfigs(value, domainKey)
    .map((row, index) => {
      const optionLabel = String(row?.option_label || "").replace(/\s+/g, " ").trim() || defaultDomainTypeOptionLabel(domainKey, index);
      const optionKey = slugifyDomainKeyInput(row?.option_key || optionLabel || `type_option_${index + 1}`) || `type_option_${index + 1}`;
      const choices = parseDomainTypeOptionChoicesInput(row?.choices_input || "").map((choice, choiceIndex) => ({
        value: choice.value,
        label: choice.label,
        sort_order: (choiceIndex + 1) * 10,
      }));
      if (!optionLabel && !choices.length) return null;
      return {
        id: String(row?.id || "").trim() || createDomainDisclosureId("type_option"),
        option_key: optionKey,
        option_label: optionLabel,
        choices,
      };
    })
    .filter(Boolean);
}

function domainTypeOptionMacroToken(optionKey = "") {
  const key = slugifyDomainKeyInput(optionKey);
  if (!key) return "";
  return `{{type_option_${key}}}`;
}

function domainNotificationTemplateTokens(typeOptions = []) {
  const tokens = [...DOMAIN_NOTIFICATION_TEMPLATE_TOKENS];
  const normalized = buildStoredDomainTypeOptionConfigs(typeOptions);
  if (normalized.length) {
    tokens.push("{{type_options_summary}}");
    for (const row of normalized) {
      const token = domainTypeOptionMacroToken(row?.option_key);
      if (token && !tokens.includes(token)) tokens.push(token);
    }
  }
  return tokens;
}

function createDomainDisclosureId(prefix = "disclosure") {
  const fallback = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {}
  return fallback;
}

function defaultDomainSubmitDisclosureText(domainKey = "") {
  const domain = String(domainKey || "").trim().toLowerCase();
  if (domain === "water_drain_issues") {
    return "Submitting a report through CityReport helps notify the city, but it does not guarantee receipt, review, response, or acceptance as legal notice. Sewer, storm, or drainage issues may require immediate direct contact with the city or utility. For emergencies, call 911.";
  }
  return "Submitting a report through CityReport helps notify the city, but it does not guarantee receipt, review, response, or acceptance as legal notice. For emergencies or immediate hazards, contact emergency services or the responsible agency directly.";
}

function defaultDomainConsentDisclosureText(domainKey = "") {
  const domain = String(domainKey || "").trim().toLowerCase();
  if (domain === "water_drain_issues") {
    return "I agree to allow CityReport.io to submit this water or drainage issue and my provided contact information to the city, utility, or other responsible agency on my behalf, and I confirm the submitted information is accurate to the best of my knowledge.";
  }
  if (domain === "potholes") {
    return "I agree to allow CityReport.io to submit this pothole report and my provided contact information to the city, utility, or other responsible agency on my behalf, and I confirm the submitted information is accurate to the best of my knowledge.";
  }
  return "";
}

function defaultDomainDisclosures(domainKey = "") {
  const domain = String(domainKey || "").trim().toLowerCase();
  const base = [
    {
      id: `${domain || "domain"}_submission_notice`,
      title: "Submission notice",
      body: defaultDomainSubmitDisclosureText(domain),
      required_acknowledgement: false,
      display_position: "inside_form",
    },
  ];
  if (domain === "potholes") {
    return [
      {
        id: "potholes_vehicle_damage_notice",
        title: "Vehicle damage notice",
        body: "If you need to report damage to your vehicle from a pothole, you will need to file a police report as soon as possible, then bring this information to the City Manager's Office.",
        required_acknowledgement: false,
        display_position: "before_form",
      },
      {
        id: "potholes_submit_authorization",
        title: "Authorization to submit",
        body: defaultDomainConsentDisclosureText(domain),
        required_acknowledgement: true,
        display_position: "inside_form",
      },
      ...base,
    ];
  }
  if (domain === "water_drain_issues") {
    return [
      {
        id: "water_drain_submit_authorization",
        title: "Authorization to submit",
        body: defaultDomainConsentDisclosureText(domain),
        required_acknowledgement: true,
        display_position: "inside_form",
      },
      ...base,
    ];
  }
  return base;
}

function normalizeDomainDisclosureRows(value, domainKey = "", options = {}) {
  const { fallbackToDefaults = false } = options;
  if (!Array.isArray(value)) {
    return fallbackToDefaults ? defaultDomainDisclosures(domainKey) : [];
  }
  const rows = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const title = String(row?.title || "").trim();
    const body = String(row?.body || "").trim();
    if (!title && !body) continue;
    rows.push({
      id: String(row?.id || "").trim() || createDomainDisclosureId("disclosure"),
      title: title || "Disclosure",
      body,
      required_acknowledgement: row?.required_acknowledgement === true || row?.required === true,
      display_position: String(row?.display_position || "").trim().toLowerCase() === "before_form"
        ? "before_form"
        : "inside_form",
    });
  }
  if (!rows.length && fallbackToDefaults) {
    return defaultDomainDisclosures(domainKey);
  }
  return rows;
}

function domainDisclosurePositionLabel(value) {
  return String(value || "").trim().toLowerCase() === "before_form" ? "Before form" : "Inside form";
}

function isUploadedDomainIcon(value) {
  return /\/storage\/v1\/object\/public\/domain-icons\//i.test(String(value || "").trim());
}

function initialDomainRegistryForm() {
  return {
    label: "",
    key: "",
    key_autofill: true,
    description: "",
    domain_class: "incident_driven",
    status: "draft",
    icon_key: "",
    icon_src: "",
    icon_selection: UPLOAD_DOMAIN_ICON_SELECTION,
    custom_icon_src: "",
    icon_file: null,
    ownership_model: "org_managed",
    report_prefix: "",
    allow_report_images: false,
    road_required: false,
    type_options: [],
  };
}

function buildDomainRegistryForm(row) {
  if (!row) return initialDomainRegistryForm();
  const fallbackIconSrc = String(row?.icon_src || "").trim();
  return {
    label: String(row?.label || ""),
    key: String(row?.key || ""),
    key_autofill: false,
    description: String(row?.description || ""),
    domain_class: String(row?.domain_class || "incident_driven"),
    status: String(row?.status || "draft"),
    icon_key: String(row?.icon_key || ""),
    icon_src: String(row?.icon_src || ""),
    icon_selection: fallbackIconSrc ? (isUploadedDomainIcon(fallbackIconSrc) ? UPLOAD_DOMAIN_ICON_SELECTION : CUSTOM_DOMAIN_ICON_SELECTION) : UPLOAD_DOMAIN_ICON_SELECTION,
    custom_icon_src: isUploadedDomainIcon(fallbackIconSrc) ? "" : fallbackIconSrc,
    icon_file: null,
    ownership_model: String(row?.ownership_model || "org_managed"),
    report_prefix: String(row?.report_prefix || "").trim().toUpperCase(),
    allow_report_images: row?.allow_report_images === true,
    road_required: row?.road_required === true,
    type_options: normalizeDomainTypeOptionConfigs(row?.type_options, row?.key),
  };
}

function isTintableSvgAsset(value, file = null) {
  const src = String(value || "").trim();
  if (/\.svg(?:[?#].*)?$/i.test(src)) return true;
  const fileType = String(file?.type || "").trim().toLowerCase();
  if (fileType === "image/svg+xml") return true;
  const fileName = String(file?.name || "").trim();
  return /\.svg$/i.test(fileName);
}

function buildMapUiIconDraftForm(raw) {
  const merged = mergeMapUiIconMeta(raw);
  const next = {};
  for (const entry of MAP_UI_ICON_CATALOG) {
    next[entry.key] = {
      src: String(merged?.[entry.key]?.src || entry.defaultSrc || "").trim(),
      render_mode: String(merged?.[entry.key]?.render_mode || entry.defaultRenderMode || MAP_UI_ICON_RENDER_MODE.RASTER).trim(),
      light_tint_color: String(merged?.[entry.key]?.light_tint_color || "").trim(),
      dark_tint_color: String(merged?.[entry.key]?.dark_tint_color || "").trim(),
      enabled: merged?.[entry.key]?.enabled !== false,
      file: null,
      preview_url: "",
    };
  }
  return next;
}

function extractMapUiIconManifestFromForm(form) {
  const next = {};
  for (const entry of MAP_UI_ICON_CATALOG) {
    const value = String(form?.[entry.key]?.src || "").trim();
    if (!value) continue;
    next[entry.key] = {
      src: value,
      render_mode: String(form?.[entry.key]?.render_mode || entry.defaultRenderMode || MAP_UI_ICON_RENDER_MODE.RASTER).trim(),
      light_tint_color: String(form?.[entry.key]?.light_tint_color || "").trim(),
      dark_tint_color: String(form?.[entry.key]?.dark_tint_color || "").trim(),
      enabled: form?.[entry.key]?.enabled !== false,
    };
  }
  return next;
}

function buildMapUiThemeDraftForm(raw) {
  const overrides = sanitizeMapUiTheme(raw);
  const next = { light: {}, dark: {} };
  for (const mode of ["light", "dark"]) {
    for (const field of MAP_UI_THEME_FIELDS) {
      next[mode][field.key] = String(overrides?.[mode]?.[field.key] || "").trim();
    }
  }
  return next;
}

function extractMapUiThemeFromForm(form) {
  return sanitizeMapUiTheme(form);
}

function buildMapUiThemePreview(themeForm = {}, baseThemeForm = {}) {
  const baseTheme = sanitizeMapUiTheme(baseThemeForm);
  const previewTheme = sanitizeMapUiTheme(themeForm);
  return {
    light: {
      ...MAP_UI_ICON_THEME_DEFAULTS.light,
      ...(baseTheme.light || {}),
      ...(previewTheme.light || {}),
    },
    dark: {
      ...MAP_UI_ICON_THEME_DEFAULTS.dark,
      ...(baseTheme.dark || {}),
      ...(previewTheme.dark || {}),
    },
  };
}

function createMapUiThemeScheduleDraft(seed = {}) {
  const generatedId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `theme-schedule-${Date.now()}-${Math.round(Math.random() * 100000)}`;
  const id = String(seed?.id || generatedId).trim();
  return {
    id: id || generatedId,
    label: String(seed?.label || "").trim(),
    enabled: seed?.enabled !== false,
    start_at: toLocalDateTimeInputValue(seed?.start_at),
    end_at: toLocalDateTimeInputValue(seed?.end_at),
    created_at: String(seed?.created_at || "").trim(),
    updated_at: String(seed?.updated_at || "").trim(),
    themeForm: buildMapUiThemeDraftForm(seed?.theme || seed),
  };
}

function buildMapUiThemeScheduleDrafts(raw) {
  return sanitizeMapUiThemeSchedules(raw).map((entry) => createMapUiThemeScheduleDraft(entry));
}

function validateAndExtractMapUiThemeScheduleDrafts(drafts) {
  const next = [];
  for (const entry of Array.isArray(drafts) ? drafts : []) {
    const label = String(entry?.label || "").trim();
    const startAt = fromLocalDateTimeInputValue(entry?.start_at);
    const endAt = fromLocalDateTimeInputValue(entry?.end_at);
    const theme = extractMapUiThemeFromForm(entry?.themeForm || {});
    const hasAnyValue =
      label
      || String(entry?.start_at || "").trim()
      || String(entry?.end_at || "").trim()
      || Object.keys(theme).length;
    if (!hasAnyValue) continue;
    if (!label) {
      return { schedules: [], error: "Add a label for each temporary theme before saving." };
    }
    if (!startAt || !endAt) {
      return { schedules: [], error: `Choose both a start and end time for ${label}.` };
    }
    if (Date.parse(endAt) <= Date.parse(startAt)) {
      return { schedules: [], error: `${label} must end after it starts.` };
    }
    if (!Object.keys(theme).length) {
      return { schedules: [], error: `Set at least one theme color override for ${label}.` };
    }
    next.push({
      id: String(entry?.id || "").trim() || `theme-schedule-${Date.now()}`,
      label,
      enabled: entry?.enabled !== false,
      start_at: startAt,
      end_at: endAt,
      theme,
      created_at: String(entry?.created_at || "").trim() || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
  return {
    schedules: sanitizeMapUiThemeSchedules(next),
    error: "",
  };
}

function getMapUiThemeScheduleStatus(entry, now = Date.now()) {
  const targetTime = now instanceof Date ? now.getTime() : Number(now);
  const startAt = Date.parse(String(entry?.start_at || ""));
  const endAt = Date.parse(String(entry?.end_at || ""));
  if (entry?.enabled === false) return "Disabled";
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) return "Incomplete";
  if (targetTime < startAt) return "Scheduled";
  if (targetTime >= endAt) return "Ended";
  return "Active";
}

function hasStoredMapUiThemeConfig(raw) {
  return (
    (raw && typeof raw === "object" && Array.isArray(raw.themes))
    || Object.keys(sanitizeMapUiTheme(raw)).length > 0
    || sanitizeMapUiThemeSchedules(raw).length > 0
    || (raw && typeof raw === "object" && raw.theme_enabled === false)
  );
}

function createMapUiThemeRecordId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `map-ui-theme-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function normalizeMapUiThemeDeploymentState(value, fallback = "draft") {
  return String(value || "").trim().toLowerCase() === "published" ? "published" : fallback;
}

function buildMapUiThemeLibraryEntry(seed = {}, fallback = {}) {
  const isDefault = seed?.is_default === true || fallback?.is_default === true || String(seed?.id || fallback?.id || "").trim() === MAP_UI_THEME_DEFAULT_THEME_ID;
  const fallbackId = fallback?.id || (isDefault ? MAP_UI_THEME_DEFAULT_THEME_ID : createMapUiThemeRecordId());
  return {
    id: String(seed?.id || fallbackId).trim() || fallbackId,
    name: String(seed?.name || seed?.label || fallback?.name || (isDefault ? "Default Theme" : "")).trim() || (isDefault ? "Default Theme" : "Untitled Theme"),
    is_default: isDefault,
    deployment_state: normalizeMapUiThemeDeploymentState(seed?.deployment_state, isDefault ? "published" : normalizeMapUiThemeDeploymentState(fallback?.deployment_state, "draft")),
    start_at: isDefault ? "" : toLocalDateTimeInputValue(seed?.start_at || fallback?.start_at),
    end_at: isDefault ? "" : toLocalDateTimeInputValue(seed?.end_at || fallback?.end_at),
    created_at: String(seed?.created_at || fallback?.created_at || "").trim(),
    updated_at: String(seed?.updated_at || fallback?.updated_at || "").trim(),
    themeForm: buildMapUiThemeDraftForm(seed?.theme || seed?.themeForm || fallback?.theme || fallback?.themeForm || {}),
  };
}

function normalizeMapUiThemeLibraryDrafts(rawDraftConfig = {}, rawPublishedConfig = {}) {
  if (rawDraftConfig && typeof rawDraftConfig === "object" && Array.isArray(rawDraftConfig.themes)) {
    const next = rawDraftConfig.themes.map((entry) => buildMapUiThemeLibraryEntry(entry));
    const defaultTheme = next.find((entry) => entry?.is_default) || buildMapUiThemeLibraryEntry({ id: MAP_UI_THEME_DEFAULT_THEME_ID, is_default: true, name: "Default Theme", deployment_state: "published" });
    const others = next.filter((entry) => entry && !entry.is_default);
    return [defaultTheme, ...others];
  }

  if (rawPublishedConfig && typeof rawPublishedConfig === "object" && Array.isArray(rawPublishedConfig.themes)) {
    const next = rawPublishedConfig.themes.map((entry) => buildMapUiThemeLibraryEntry(entry));
    const defaultTheme = next.find((entry) => entry?.is_default) || buildMapUiThemeLibraryEntry({ id: MAP_UI_THEME_DEFAULT_THEME_ID, is_default: true, name: "Default Theme", deployment_state: "published" });
    const others = next.filter((entry) => entry && !entry.is_default);
    return [defaultTheme, ...others];
  }

  const legacyThemes = sanitizeMapUiThemes(rawDraftConfig && hasStoredMapUiThemeConfig(rawDraftConfig) ? rawDraftConfig : rawPublishedConfig);
  if (legacyThemes.length) {
    const defaultTheme = legacyThemes.find((entry) => entry?.is_default) || { id: MAP_UI_THEME_DEFAULT_THEME_ID, is_default: true, name: "Default Theme", theme: {} };
    const others = legacyThemes.filter((entry) => !entry?.is_default);
    return [
      buildMapUiThemeLibraryEntry(defaultTheme),
      ...others.map((entry) => buildMapUiThemeLibraryEntry(entry)),
    ];
  }

  return [buildMapUiThemeLibraryEntry({ id: MAP_UI_THEME_DEFAULT_THEME_ID, is_default: true, name: "Default Theme", deployment_state: "published" })];
}

function serializeMapUiThemeDraftLibrary(themes = []) {
  return themes.map((entry) => ({
    id: String(entry?.id || "").trim() || createMapUiThemeRecordId(),
    name: String(entry?.name || "").trim() || (entry?.is_default ? "Default Theme" : "Untitled Theme"),
    is_default: entry?.is_default === true,
    deployment_state: normalizeMapUiThemeDeploymentState(entry?.deployment_state, entry?.is_default ? "published" : "draft"),
    start_at: entry?.is_default ? "" : fromLocalDateTimeInputValue(entry?.start_at),
    end_at: entry?.is_default ? "" : fromLocalDateTimeInputValue(entry?.end_at),
    created_at: String(entry?.created_at || "").trim(),
    updated_at: String(entry?.updated_at || "").trim(),
    theme: extractMapUiThemeFromForm(entry?.themeForm || {}),
  }));
}

function serializePublishedMapUiThemeLibrary(themes = []) {
  const next = [];
  serializeMapUiThemeDraftLibrary(themes).forEach((entry) => {
    if (entry?.is_default) {
      next.push({
        ...entry,
        deployment_state: "published",
      });
      return;
    }
    const startAt = String(entry?.start_at || "").trim();
    const endAt = String(entry?.end_at || "").trim();
    const hasTheme = Object.keys(sanitizeMapUiTheme(entry?.theme || {})).length > 0;
    if (entry?.deployment_state !== "published" || !startAt || !endAt || !hasTheme) return;
    if (Date.parse(endAt) <= Date.parse(startAt)) return;
    next.push(entry);
  });
  return next;
}

function formatMapUiThemeStatus(entry, now = Date.now()) {
  if (entry?.is_default) return "Default";
  if (String(entry?.deployment_state || "").trim().toLowerCase() !== "published") return "Draft";
  const startAt = Date.parse(fromLocalDateTimeInputValue(entry?.start_at));
  const endAt = Date.parse(fromLocalDateTimeInputValue(entry?.end_at));
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return "Draft";
  if (now < startAt) return "Scheduled";
  if (now >= endAt) return "Ended";
  return "Active";
}

function compareMapUiThemeLibraryEntries(a, b) {
  if (a?.is_default) return -1;
  if (b?.is_default) return 1;
  const statusRank = {
    Active: 0,
    Scheduled: 1,
    Draft: 2,
    Ended: 3,
  };
  const aStatus = formatMapUiThemeStatus(a);
  const bStatus = formatMapUiThemeStatus(b);
  if ((statusRank[aStatus] ?? 99) !== (statusRank[bStatus] ?? 99)) {
    return (statusRank[aStatus] ?? 99) - (statusRank[bStatus] ?? 99);
  }
  const aStart = Date.parse(fromLocalDateTimeInputValue(a?.start_at));
  const bStart = Date.parse(fromLocalDateTimeInputValue(b?.start_at));
  const aEnd = Date.parse(fromLocalDateTimeInputValue(a?.end_at));
  const bEnd = Date.parse(fromLocalDateTimeInputValue(b?.end_at));
  if (aStatus === "Active" && Number.isFinite(aEnd) && Number.isFinite(bEnd) && aEnd !== bEnd) return aEnd - bEnd;
  if (aStatus === "Scheduled" && Number.isFinite(aStart) && Number.isFinite(bStart) && aStart !== bStart) return aStart - bStart;
  if (aStatus === "Ended" && Number.isFinite(aEnd) && Number.isFinite(bEnd) && aEnd !== bEnd) return bEnd - aEnd;
  if (aStatus === "Draft") {
    if (Number.isFinite(aStart) && Number.isFinite(bStart) && aStart !== bStart) return aStart - bStart;
    const aUpdated = Date.parse(String(a?.updated_at || a?.created_at || ""));
    const bUpdated = Date.parse(String(b?.updated_at || b?.created_at || ""));
    if (Number.isFinite(aUpdated) && Number.isFinite(bUpdated) && aUpdated !== bUpdated) return bUpdated - aUpdated;
  }
  return String(a?.name || "").localeCompare(String(b?.name || ""));
}

function createUniqueMapUiThemeName(sourceName, themes, excludeThemeId = "") {
  const baseName = String(sourceName || "").trim() || "Untitled Theme";
  const excludedId = String(excludeThemeId || "").trim();
  const usedNames = new Set(
    (Array.isArray(themes) ? themes : [])
      .filter((entry) => String(entry?.id || "").trim() !== excludedId)
      .map((entry) => String(entry?.name || "").trim().toLowerCase())
      .filter(Boolean)
  );
  if (!usedNames.has(baseName.toLowerCase())) return baseName;
  let copyIndex = 2;
  let candidate = `${baseName} Copy`;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${baseName} Copy ${copyIndex}`;
    copyIndex += 1;
  }
  return candidate;
}

function getMapUiThemeDateWindowInfo(theme) {
  if (!theme || theme?.is_default) {
    return {
      startAtRaw: "",
      endAtRaw: "",
      startAt: Number.NaN,
      endAt: Number.NaN,
      hasBothDates: false,
      hasInvalidWindow: false,
    };
  }
  const startAtRaw = String(theme?.start_at || "").trim();
  const endAtRaw = String(theme?.end_at || "").trim();
  const hasBothDates = Boolean(startAtRaw && endAtRaw);
  const startAt = hasBothDates ? Date.parse(fromLocalDateTimeInputValue(startAtRaw)) : Number.NaN;
  const endAt = hasBothDates ? Date.parse(fromLocalDateTimeInputValue(endAtRaw)) : Number.NaN;
  const hasInvalidWindow = hasBothDates && Number.isFinite(startAt) && Number.isFinite(endAt) && endAt <= startAt;
  return {
    startAtRaw,
    endAtRaw,
    startAt,
    endAt,
    hasBothDates,
    hasInvalidWindow,
  };
}

function findMapUiThemeDateConflicts(theme, themes = []) {
  if (!theme || theme?.is_default) return [];
  const currentId = String(theme?.id || "").trim();
  const { startAt: currentStart, endAt: currentEnd, hasInvalidWindow } = getMapUiThemeDateWindowInfo(theme);
  if (!Number.isFinite(currentStart) || !Number.isFinite(currentEnd) || hasInvalidWindow) return [];
  return (Array.isArray(themes) ? themes : []).filter((entry) => {
    if (!entry || entry?.is_default) return false;
    if (String(entry?.id || "").trim() === currentId) return false;
    const { startAt: otherStart, endAt: otherEnd, hasInvalidWindow: otherHasInvalidWindow } = getMapUiThemeDateWindowInfo(entry);
    if (!Number.isFinite(otherStart) || !Number.isFinite(otherEnd) || otherHasInvalidWindow) return false;
    return currentStart < otherEnd && currentEnd > otherStart;
  });
}

function hasInvalidMapUiThemeDateWindow(theme) {
  return getMapUiThemeDateWindowInfo(theme).hasInvalidWindow;
}

function clampToRange(value, min, max, fallback = min) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function hexToRgbParts(hex) {
  const normalized = String(hex || "").trim().toLowerCase();
  if (!/^#(?:[0-9a-f]{6})$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbaStringFromHex(hex, alphaPercent = 100) {
  const rgb = hexToRgbParts(hex);
  if (!rgb) return "";
  const normalizedAlpha = clampToRange(alphaPercent, 0, 100, 100);
  if (normalizedAlpha >= 100) return hex.toLowerCase();
  const alpha = Math.round((normalizedAlpha / 100) * 100) / 100;
  const alphaText = Number.isInteger(alpha) ? String(alpha) : alpha.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alphaText})`;
}

function parseCssColorToPickerValue(value, fallback = "#111111") {
  const source = String(value || fallback || "").trim();
  if (!source) {
    return { hex: "#111111", alphaPercent: 100 };
  }
  const hexMatch = source.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch) {
    const token = hexMatch[1];
    if (token.length === 3) {
      return {
        hex: `#${token[0]}${token[0]}${token[1]}${token[1]}${token[2]}${token[2]}`.toLowerCase(),
        alphaPercent: 100,
      };
    }
    if (token.length === 6) {
      return { hex: `#${token}`.toLowerCase(), alphaPercent: 100 };
    }
    const alpha = parseInt(token.slice(6, 8), 16);
    return {
      hex: `#${token.slice(0, 6)}`.toLowerCase(),
      alphaPercent: Math.round((alpha / 255) * 100),
    };
  }
  const rgbaMatch = source.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgbaMatch) {
    const r = clampToRange(Math.round(Number(rgbaMatch[1])), 0, 255, 17);
    const g = clampToRange(Math.round(Number(rgbaMatch[2])), 0, 255, 17);
    const b = clampToRange(Math.round(Number(rgbaMatch[3])), 0, 255, 17);
    const alpha = rgbaMatch[4] == null ? 1 : clampToRange(Number(rgbaMatch[4]), 0, 1, 1);
    return {
      hex: `#${[r, g, b].map((part) => String(part.toString(16)).padStart(2, "0")).join("")}`,
      alphaPercent: Math.round(alpha * 100),
    };
  }
  if (source.toLowerCase() === "transparent") {
    return { hex: "#111111", alphaPercent: 0 };
  }
  return parseCssColorToPickerValue(fallback || "#111111", "#111111");
}

function initialTenantDomainAssignmentForm() {
  const preset = DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS[0];
  return {
    domain_key: "",
    active: true,
    visibility: "enabled",
    display_label: "",
    marker_color: "#234a72",
    notification_email: "",
    notification_template_key: preset.key,
    notification_subject_template: preset.subject,
    notification_body_template: preset.body,
    organization_monitored_repairs: true,
    billing_status: "not_applicable",
    billing_model: "included",
    billing_amount: "0",
    billing_notes: "",
  };
}

function buildTenantDomainAssignmentForm(row) {
  const selectedTemplateKey = String(row?.notification_template_key || DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS[0].key).trim().toLowerCase();
  const preset = DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS.find((option) => option.key === selectedTemplateKey) || DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS[0];
  if (!row) return initialTenantDomainAssignmentForm();
  return {
    domain_key: String(row?.domain_key || ""),
    active: row?.active !== false,
    visibility: String(row?.visibility || "enabled"),
    display_label: String(row?.display_label || ""),
    marker_color: sanitizeHexColor(row?.marker_color, defaultDomainMarkerColor(row?.domain_key)),
    notification_email: String(row?.notification_email || ""),
    notification_template_key: preset.key,
    notification_subject_template: String(row?.notification_subject_template || preset.subject || ""),
    notification_body_template: String(row?.notification_body_template || preset.body || ""),
    organization_monitored_repairs: row?.organization_monitored_repairs !== false,
    billing_status: String(row?.billing_status || "not_applicable"),
    billing_model: String(row?.billing_model || "included"),
    billing_amount: String(row?.billing_amount ?? "0"),
    billing_notes: String(row?.billing_notes || ""),
  };
}

function initialMapFeaturesForm() {
  return {
    show_boundary_border: true,
    shade_outside_boundary: true,
    show_alert_icon: true,
    show_event_icon: true,
    outside_shade_opacity: "0.42",
    boundary_border_color: "#e53935",
    boundary_border_width: "4",
  };
}

function buildMapFeaturesForm(features) {
  if (!features) return initialMapFeaturesForm();
  return {
    show_boundary_border: features.show_boundary_border !== false,
    shade_outside_boundary: features.shade_outside_boundary !== false,
    show_alert_icon: features.show_alert_icon !== false,
    show_event_icon: features.show_event_icon !== false,
    outside_shade_opacity: String(Number.isFinite(Number(features.outside_shade_opacity)) ? Number(features.outside_shade_opacity) : 0.42),
    boundary_border_color: sanitizeHexColor(features.boundary_border_color, "#e53935"),
    boundary_border_width: String(Number.isFinite(Number(features.boundary_border_width)) ? Math.max(0.5, Math.min(8, Number(features.boundary_border_width))) : 4),
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

function summarizeTenantAssetCategory(categoryKey) {
  const key = String(categoryKey || "").trim().toLowerCase();
  return TENANT_ASSET_CATEGORIES.find((category) => category.key === key)?.label || roleKeyToLabel(key || "other");
}

function formatLeadNumber(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "Lead Pending";

  const normalizedDigits = rawValue
    .toUpperCase()
    .replace(/^LD-?/, "")
    .replace(/\D/g, "");

  if (normalizedDigits) return `LD${normalizedDigits.padStart(4, "0")}`;

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "Lead Pending";
  return `LD${String(Math.trunc(numericValue)).padStart(4, "0")}`;
}

function domainKeyToLabel(domainKey) {
  return DOMAIN_OPTIONS.find((entry) => entry.key === domainKey)?.label || roleKeyToLabel(domainKey);
}

function domainNotificationTemplateOption(templateKey) {
  return DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS.find((option) => option.key === String(templateKey || "").trim().toLowerCase())
    || DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS[0];
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
  if (action === "tenant_domain_settings_upsert") return "Saved domain settings";
  if (action === "tenant_map_features_upsert") return "Saved map features";
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

async function hashLeadFingerprint(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  try {
    if (typeof crypto !== "undefined" && crypto?.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
      return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // fallback below
  }
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = ((hash << 5) - hash) + normalized.charCodeAt(index);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
}

async function hashSecurityPin(userId, pin) {
  const normalizedUserId = String(userId || "").trim().toLowerCase();
  const normalizedPin = String(pin || "").trim();
  if (!normalizedUserId || !normalizedPin) return "";
  const payload = `platform-pin:${normalizedUserId}:${normalizedPin}`;
  try {
    if (typeof crypto !== "undefined" && crypto?.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
      return Array.from(new Uint8Array(digest)).map((part) => part.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    // fallback below
  }
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(index);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
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

function makeHubUrl(primarySubdomain, tenantKey) {
  const base = makeLiveUrl(primarySubdomain, tenantKey).replace(/\/+$/, "");
  return `${base}/hub`;
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

const MAP_UI_THEME_TIME_ZONE = "America/New_York";
const MAP_UI_THEME_TIME_ZONE_LABEL = "Eastern Time";

function mapUiThemeDateTimePartsForZone(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MAP_UI_THEME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(parsed);
  const next = {};
  parts.forEach((part) => {
    if (part.type !== "literal") next[part.type] = part.value;
  });
  const year = Number(next.year);
  const month = Number(next.month);
  const day = Number(next.day);
  const hour = Number(next.hour);
  const minute = Number(next.minute);
  const second = Number(next.second);
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null;
  return { year, month, day, hour, minute, second };
}

function mapUiThemeTimeZoneOffsetMs(value) {
  const parts = mapUiThemeDateTimePartsForZone(value);
  if (!parts) return 0;
  const utcFromParts = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const instant = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(instant)) return 0;
  return utcFromParts - instant;
}

function parseMapUiThemeDateTimeInputValue(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  return { year, month, day, hour, minute };
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

function padDateTimeInputPart(value) {
  return String(value).padStart(2, "0");
}

function toLocalDateTimeInputValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = mapUiThemeDateTimePartsForZone(parsed);
  if (!parts) return "";
  return [
    parts.year,
    "-",
    padDateTimeInputPart(parts.month),
    "-",
    padDateTimeInputPart(parts.day),
    "T",
    padDateTimeInputPart(parts.hour),
    ":",
    padDateTimeInputPart(parts.minute),
  ].join("");
}

function fromLocalDateTimeInputValue(value) {
  const parts = parseMapUiThemeDateTimeInputValue(value);
  if (!parts) return "";
  const guessUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  let resolvedUtcMs = guessUtcMs - mapUiThemeTimeZoneOffsetMs(new Date(guessUtcMs));
  const refinedOffset = mapUiThemeTimeZoneOffsetMs(new Date(resolvedUtcMs));
  resolvedUtcMs = guessUtcMs - refinedOffset;
  const parsed = new Date(resolvedUtcMs);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function formatMapUiThemeDateTimeDisplay(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MAP_UI_THEME_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(parsed);
}

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const msg = String(error?.message || "").toLowerCase();
  return (
    code === "42P01"
    || msg.includes("relation")
    || msg.includes("does not exist")
    || msg.includes("schema cache")
    || msg.includes("could not find the table")
  );
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
  const initialControlPlaneRouteState = useMemo(() => readInitialControlPlaneRouteState(), []);
  const [authReady, setAuthReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [sessionActorName, setSessionActorName] = useState("");
  const [sessionPhone, setSessionPhone] = useState("");
  const [platformAccountEditMode, setPlatformAccountEditMode] = useState(false);
  const [platformAccountDraft, setPlatformAccountDraft] = useState({ full_name: "", phone: "" });
  const [platformAccountStatus, setPlatformAccountStatus] = useState("");
  const [platformAccountSaving, setPlatformAccountSaving] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordDraft, setChangePasswordDraft] = useState({
    current_password: "",
    new_password: "",
    confirm_new_password: "",
  });
  const [showChangePasswordNew, setShowChangePasswordNew] = useState(false);
  const [showChangePasswordConfirm, setShowChangePasswordConfirm] = useState(false);
  const [showChangePasswordCurrent, setShowChangePasswordCurrent] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSaving, setChangePasswordSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [openControlPlaneDropdown, setOpenControlPlaneDropdown] = useState("");
  const bannerMenuRef = useRef(null);
  const controlPlaneNavRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1280));
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [platformAccessRole, setPlatformAccessRole] = useState("");
  const [, setPlatformAccessRoles] = useState([]);
  const [platformAccessPermissionKeys, setPlatformAccessPermissionKeys] = useState([]);
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

  const [activeTab, setActiveTab] = useState(initialControlPlaneRouteState.activeTab);
  const [controlPlaneSection, setControlPlaneSection] = useState(initialControlPlaneRouteState.controlPlaneSection);
  const [controlPlanePage, setControlPlanePage] = useState(initialControlPlaneRouteState.controlPlanePage);

  const [tenants, setTenants] = useState([]);
  const [tenantAdmins, setTenantAdmins] = useState([]);
  const [platformTeamAssignments, setPlatformTeamAssignments] = useState([]);
  const [platformTeamUserSummariesById, setPlatformTeamUserSummariesById] = useState({});
  const [, setPlatformPermissionCatalog] = useState([]);
  const [platformRoleDefinitions, setPlatformRoleDefinitions] = useState([]);
  const [platformRolePermissions, setPlatformRolePermissions] = useState([]);
  const [platformUserSearchQuery, setPlatformUserSearchQuery] = useState("");
  const [platformUserSearchResults, setPlatformUserSearchResults] = useState([]);
  const [platformTeamForm, setPlatformTeamForm] = useState({ user_id: "", role: "platform_staff" });
  const [platformTeamManagementView, setPlatformTeamManagementView] = useState("list");
  const [platformTeamAssignmentMode, setPlatformTeamAssignmentMode] = useState("existing");
  const [platformInviteForm, setPlatformInviteForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [editingPlatformAssignmentKey, setEditingPlatformAssignmentKey] = useState("");
  const [editingPlatformAssignmentRole, setEditingPlatformAssignmentRole] = useState("");
  const [platformTeamStatus, setPlatformTeamStatus] = useState("");
  const [platformUserSearchLoading, setPlatformUserSearchLoading] = useState(false);
  const [platformTeamDeleteConfirmRow, setPlatformTeamDeleteConfirmRow] = useState(null);
  const [platformTeamDeleteLoading, setPlatformTeamDeleteLoading] = useState(false);
  const [selectedPlatformRoleKey, setSelectedPlatformRoleKey] = useState("platform_owner");
  const [platformRoleForm, setPlatformRoleForm] = useState({ role: "", role_label: "" });
  const [platformRolePermissionDraft, setPlatformRolePermissionDraft] = useState({});
  const [platformRolePermissionDirty, setPlatformRolePermissionDirty] = useState(false);
  const [platformRoleStatus, setPlatformRoleStatus] = useState("");
  const [platformRoleAddModalOpen, setPlatformRoleAddModalOpen] = useState(false);
  const [platformRoleEditMode, setPlatformRoleEditMode] = useState(false);
  const [platformRoleDeleteConfirmOpen, setPlatformRoleDeleteConfirmOpen] = useState(false);
  const [platformRoleDeleteLoading, setPlatformRoleDeleteLoading] = useState(false);
  const [platformSecuritySettingsSaved, setPlatformSecuritySettingsSaved] = useState(DEFAULT_PLATFORM_SECURITY_SETTINGS);
  const [platformSecuritySettingsDraft, setPlatformSecuritySettingsDraft] = useState(DEFAULT_PLATFORM_SECURITY_SETTINGS);
  const [platformSecurityPinDraft, setPlatformSecurityPinDraft] = useState(DEFAULT_PLATFORM_SECURITY_PIN_DRAFT);
  const [platformSecurityPinMeta, setPlatformSecurityPinMeta] = useState({ pin_hash: "" });
  const [platformSecurityPinEditMode, setPlatformSecurityPinEditMode] = useState(false);
  const [platformSecurityChecksEditMode, setPlatformSecurityChecksEditMode] = useState(false);
  const [showPlatformSecurityPin, setShowPlatformSecurityPin] = useState(false);
  const [showPlatformSecurityPinConfirm, setShowPlatformSecurityPinConfirm] = useState(false);
  const [showPlatformSecurityCurrentPin, setShowPlatformSecurityCurrentPin] = useState(false);
  const [showPlatformSecurityAccountPassword, setShowPlatformSecurityAccountPassword] = useState(false);
  const [platformSecurityCheckpointRequest, setPlatformSecurityCheckpointRequest] = useState(null);
  const [platformSecurityCheckpointPin, setPlatformSecurityCheckpointPin] = useState("");
  const [platformSecurityCheckpointStatus, setPlatformSecurityCheckpointStatus] = useState("");
  const [platformSecurityCheckpointVerifying, setPlatformSecurityCheckpointVerifying] = useState(false);
  const [platformSecurityStatus, setPlatformSecurityStatus] = useState("");
  const [platformSecuritySaving, setPlatformSecuritySaving] = useState({ pin: false, checks: false });
  const platformSecurityCheckpointResolverRef = useRef(null);
  const [leadRows, setLeadRows] = useState([]);
  const [leadDraftById, setLeadDraftById] = useState({});
  const [selectedLeadId, setSelectedLeadId] = useState(initialControlPlaneRouteState.selectedLeadId);
  const [leadStatus, setLeadStatus] = useState("");
  const [leadLoading, setLeadLoading] = useState(false);
  const [leadAddModalOpen, setLeadAddModalOpen] = useState(false);
  const [organizationReportFilter, setOrganizationReportFilter] = useState("all");
  const [leadForm, setLeadForm] = useState({
    full_name: "",
    work_email: "",
    city_agency: "",
    role_title: "",
    priority_domain: "potholes",
    notes: "",
    status: "new",
  });
  const [tenantRoleDefinitions, setTenantRoleDefinitions] = useState([]);
  const [tenantRolePermissions, setTenantRolePermissions] = useState([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState("");
  const [roleForm, setRoleForm] = useState({ role: "", role_label: "" });
  const [rolePermissionDraft, setRolePermissionDraft] = useState({});
  const [rolePermissionDirty, setRolePermissionDirty] = useState(false);
  const [tenantRoleEditMode, setTenantRoleEditMode] = useState(false);
  const [tenantRoleDeleteConfirmOpen, setTenantRoleDeleteConfirmOpen] = useState(false);
  const [tenantRoleDeleteLoading, setTenantRoleDeleteLoading] = useState(false);
  const [tenantFiles, setTenantFiles] = useState([]);
  const [auditRows, setAuditRows] = useState([]);

  const [tenantProfilesByTenant, setTenantProfilesByTenant] = useState({});
  const [tenantVisibilityByTenant, setTenantVisibilityByTenant] = useState({});
  const [tenantDomainConfigsByTenant, setTenantDomainConfigsByTenant] = useState({});
  const [tenantDomainIssueTypesByTenant, setTenantDomainIssueTypesByTenant] = useState({});
  const [tenantDomainAssignmentsByTenant, setTenantDomainAssignmentsByTenant] = useState({});
  const [tenantMapFeaturesByTenant, setTenantMapFeaturesByTenant] = useState({});
  const [domainRegistryRows, setDomainRegistryRows] = useState([]);
  const [domainRegistrySchemaReady, setDomainRegistrySchemaReady] = useState(true);
  const [domainRegistryEditorOpen, setDomainRegistryEditorOpen] = useState(false);
  const [editingDomainDefinitionKey, setEditingDomainDefinitionKey] = useState("");
  const [expandedDomainRegistryCardKey, setExpandedDomainRegistryCardKey] = useState("");
  const [domainRegistryForm, setDomainRegistryForm] = useState(initialDomainRegistryForm);
  const [domainRegistrySaving, setDomainRegistrySaving] = useState(false);
  const [mapUiIconDraftConfig, setMapUiIconDraftConfig] = useState({});
  const [mapUiIconPublishedConfig, setMapUiIconPublishedConfig] = useState({});
  const [mapUiThemeDraftConfig, setMapUiThemeDraftConfig] = useState({});
  const [mapUiThemePublishedConfig, setMapUiThemePublishedConfig] = useState({});
  const [mapUiThemeDraftThemes, setMapUiThemeDraftThemes] = useState(() => normalizeMapUiThemeLibraryDrafts({}, {}));
  const [mapUiThemePublishedThemes, setMapUiThemePublishedThemes] = useState(() => normalizeMapUiThemeLibraryDrafts({}, {}));
  const [mapUiThemeEditorOpen, setMapUiThemeEditorOpen] = useState(false);
  const [mapUiThemeEditorDraft, setMapUiThemeEditorDraft] = useState(null);
  const [mapUiIconDraftForm, setMapUiIconDraftForm] = useState(() => buildMapUiIconDraftForm({}));
  const [mapUiThemeDraftForm, setMapUiThemeDraftForm] = useState(() => buildMapUiThemeDraftForm({}));
  const [mapUiThemeBaseEnabled, setMapUiThemeBaseEnabled] = useState(false);
  const [mapUiThemeSchedulesDraft, setMapUiThemeSchedulesDraft] = useState([]);
  const [mapUiThemeSectionOpen, setMapUiThemeSectionOpen] = useState(true);
  const [mapUiThemeExpandedScheduleId, setMapUiThemeExpandedScheduleId] = useState("");
  const [selectedMapUiIconKeysByGroup, setSelectedMapUiIconKeysByGroup] = useState({});
  const [selectedMapUiIconGroup, setSelectedMapUiIconGroup] = useState("");
  const [mapUiIconSavingDraft, setMapUiIconSavingDraft] = useState(false);
  const [mapUiIconPublishing, setMapUiIconPublishing] = useState(false);
  const [mapUiThemeSavingDraft, setMapUiThemeSavingDraft] = useState(false);
  const [mapUiThemePublishing, setMapUiThemePublishing] = useState(false);
  const domainRegistryUploadPreviewUrl = useMemo(() => {
    if (!domainRegistryForm?.icon_file) return "";
    return URL.createObjectURL(domainRegistryForm.icon_file);
  }, [domainRegistryForm?.icon_file]);
  const [tenantDomainAssignmentSchemaReady, setTenantDomainAssignmentSchemaReady] = useState(true);
  const [tenantDomainAssignmentEditorOpen, setTenantDomainAssignmentEditorOpen] = useState(false);
  const [editingTenantDomainAssignmentKey, setEditingTenantDomainAssignmentKey] = useState("");
  const [expandedAssignedDomainCardKey, setExpandedAssignedDomainCardKey] = useState("");
  const [selectedAssignedDomainKey, setSelectedAssignedDomainKey] = useState("");
  const [selectedAssignedDomainSectionKey, setSelectedAssignedDomainSectionKey] = useState(ASSIGNED_DOMAIN_SECTION_OPTIONS[0].key);
  const [tenantDomainAssignmentForm, setTenantDomainAssignmentForm] = useState(initialTenantDomainAssignmentForm);
  const [tenantDomainAssignmentSaving, setTenantDomainAssignmentSaving] = useState(false);
  const assignedDomainCardRefs = useRef({});
  const pendingAssignedDomainFocusKeyRef = useRef("");
  const mapUiIconPreviewUrlsRef = useRef({});

  const [selectedTenantKey, setSelectedTenantKey] = useState(initialControlPlaneRouteState.selectedTenantKey);
  const [entryStep, setEntryStep] = useState(initialControlPlaneRouteState.entryStep); // start | add | tenant
  const [addTenantStep, setAddTenantStep] = useState(initialControlPlaneRouteState.addTenantStep);
  const [tenantSearch, setTenantSearch] = useState("");

  const [tenantForm, setTenantForm] = useState(initialTenantForm);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [domainVisibilityForm, setDomainVisibilityForm] = useState(initialDomainVisibilityForm);
  const [domainConfigForm, setDomainConfigForm] = useState(initialDomainConfigForm);
  const [editingDomainKey, setEditingDomainKey] = useState("");
  const [editingOrganizationSection, setEditingOrganizationSection] = useState("");
  const [editingDomainSnapshot, setEditingDomainSnapshot] = useState(null);
  const [mapFeaturesForm, setMapFeaturesForm] = useState(initialMapFeaturesForm);
  const [mapFeaturesEditMode, setMapFeaturesEditMode] = useState(false);
  const [mapFeaturesSnapshot, setMapFeaturesSnapshot] = useState(null);
  const [assignForm, setAssignForm] = useState({ tenant_key: "", user_id: "", role: "tenant_employee" });
  const [tenantUsersManagementView, setTenantUsersManagementView] = useState("list");
  const [tenantRoleManagementView, setTenantRoleManagementView] = useState("list");
  const [tenantAssetsManagementView, setTenantAssetsManagementView] = useState("list");
  const [userAssignmentMode, setUserAssignmentMode] = useState("existing");
  const [userSearchQuery, setUserSearchQuery] = useState("");

  useEffect(() => {
    const nextPreviewUrls = {};
    for (const [iconKey, row] of Object.entries(mapUiIconDraftForm || {})) {
      const previewUrl = String(row?.preview_url || "").trim();
      if (previewUrl.startsWith("blob:")) {
        nextPreviewUrls[iconKey] = previewUrl;
      }
    }

    const previousPreviewUrls = mapUiIconPreviewUrlsRef.current || {};
    for (const [iconKey, previewUrl] of Object.entries(previousPreviewUrls)) {
      if (nextPreviewUrls[iconKey] === previewUrl) continue;
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // Ignore preview cleanup failures while swapping draft previews.
      }
    }

    mapUiIconPreviewUrlsRef.current = nextPreviewUrls;
  }, [mapUiIconDraftForm]);

  useEffect(() => () => {
    for (const previewUrl of Object.values(mapUiIconPreviewUrlsRef.current || {})) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {
        // Ignore preview cleanup failures on teardown.
      }
    }
  }, []);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [assignmentUserSummariesById, setAssignmentUserSummariesById] = useState({});
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [editingAssignmentKey, setEditingAssignmentKey] = useState("");
  const [editingAssignmentRole, setEditingAssignmentRole] = useState("");
  const [fileForm, setFileForm] = useState({ category: "contract", asset_subtype: "", notes: "", file: null });
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editingPrimaryContact, setEditingPrimaryContact] = useState(false);
  const [editingAdditionalContactIndex, setEditingAdditionalContactIndex] = useState(null);
  const [contactAddModalOpen, setContactAddModalOpen] = useState(false);
  const [newContactForm, setNewContactForm] = useState(() => emptyAdditionalContact());
  const [contactDeleteConfirmIndex, setContactDeleteConfirmIndex] = useState(null);
  const [contactDeleteLoading, setContactDeleteLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [leadFiltersOpen, setLeadFiltersOpen] = useState(true);
  const [leadFilters, setLeadFilters] = useState({
    lead_number: "",
    org_name: "",
    priority_domain: "",
    date_submitted: "",
    status: "",
  });
  const [contractInfoOpen, setContractInfoOpen] = useState(false);

  const [status, setStatus] = useState({
    tenant: "",
    profile: "",
    users: "",
    roles: "",
    domains: "",
    domainRegistry: "",
    mapUiIcons: "",
    mapUiTheme: "",
    domainAssignments: "",
    files: "",
    audit: "",
    hydrate: "",
  });
  const [controlPlaneSettingsSearch, setControlPlaneSettingsSearch] = useState("");
  const [openControlPlaneSettingsGroups, setOpenControlPlaneSettingsGroups] = useState({
    account: true,
    team: true,
  });
  const [mobileSettingsGroupKey, setMobileSettingsGroupKey] = useState("account");

  useEffect(() => {
    if (!domainRegistryUploadPreviewUrl) return undefined;
    return () => {
      URL.revokeObjectURL(domainRegistryUploadPreviewUrl);
    };
  }, [domainRegistryUploadPreviewUrl]);

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
  const invokePlatformRoleAdmin = useCallback(async (body) => {
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

    return supabase.functions.invoke("platform-role-admin", {
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

  const selectedTenantHubUrl = useMemo(
    () => (selectedTenant ? makeHubUrl(selectedTenant.primary_subdomain, selectedTenant.tenant_key) : ""),
    [selectedTenant]
  );
  const visibleDomainRegistryRows = useMemo(
    () => domainRegistryRows.filter((row) => String(row?.status || "").trim().toLowerCase() !== "archived"),
    [domainRegistryRows]
  );
  const activeDomainRegistryRows = useMemo(
    () => domainRegistryRows.filter((row) => String(row?.status || "").trim().toLowerCase() === "active"),
    [domainRegistryRows]
  );
  const archivedDomainRegistryRows = useMemo(
    () => domainRegistryRows.filter((row) => String(row?.status || "").trim().toLowerCase() === "archived"),
    [domainRegistryRows]
  );
  const mapUiIconCatalogGroups = useMemo(() => {
    const groups = new Map();
    for (const entry of MAP_UI_ICON_CATALOG) {
      const groupKey = String(entry?.group || "Map UI").trim() || "Map UI";
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(entry);
    }
    return Array.from(groups.entries()).map(([group, items]) => ({ group, items }));
  }, []);
  useEffect(() => {
    setSelectedMapUiIconKeysByGroup((prev) => {
      const next = {};
      let changed = false;
      for (const { group, items } of mapUiIconCatalogGroups) {
        const selectedKey = String(prev?.[group] || "").trim();
        const fallbackKey = String(items?.[0]?.key || "").trim();
        const resolvedKey = items.some((entry) => entry.key === selectedKey) ? selectedKey : fallbackKey;
        next[group] = resolvedKey;
        if (resolvedKey !== selectedKey) changed = true;
      }
      if (!changed && Object.keys(prev || {}).length === Object.keys(next).length) {
        return prev;
      }
      return next;
    });
  }, [mapUiIconCatalogGroups]);
  useEffect(() => {
    setSelectedMapUiIconGroup((prev) => {
      const availableGroups = mapUiIconCatalogGroups.map(({ group }) => String(group || "").trim()).filter(Boolean);
      if (!availableGroups.length) return "";
      return availableGroups.includes(prev) ? prev : availableGroups[0];
    });
  }, [mapUiIconCatalogGroups]);
  const activeMapUiIconGroup = useMemo(() => {
    const selectedGroup = String(selectedMapUiIconGroup || "").trim();
    if (mapUiIconCatalogGroups.some(({ group }) => group === selectedGroup)) return selectedGroup;
    return String(mapUiIconCatalogGroups?.[0]?.group || "").trim();
  }, [mapUiIconCatalogGroups, selectedMapUiIconGroup]);
  const activeMapUiIconItems = useMemo(
    () => mapUiIconCatalogGroups.find(({ group }) => group === activeMapUiIconGroup)?.items || [],
    [activeMapUiIconGroup, mapUiIconCatalogGroups]
  );
  const activeMapUiIconSelectedKey = useMemo(() => {
    const selectedKey = String(selectedMapUiIconKeysByGroup?.[activeMapUiIconGroup] || "").trim();
    if (activeMapUiIconItems.some((entry) => entry.key === selectedKey)) return selectedKey;
    return String(activeMapUiIconItems?.[0]?.key || "").trim();
  }, [activeMapUiIconGroup, activeMapUiIconItems, selectedMapUiIconKeysByGroup]);
  const activeMapUiIconEntry = useMemo(
    () => activeMapUiIconItems.find((entry) => entry.key === activeMapUiIconSelectedKey) || activeMapUiIconItems[0] || null,
    [activeMapUiIconItems, activeMapUiIconSelectedKey]
  );
  const publishedMapUiIconMeta = useMemo(
    () => mergeMapUiIconMeta(mapUiIconPublishedConfig),
    [mapUiIconPublishedConfig]
  );
  const draftDefaultMapUiThemeEntry = useMemo(
    () => mapUiThemeDraftThemes.find((entry) => entry?.is_default) || null,
    [mapUiThemeDraftThemes]
  );
  const previewMapUiTheme = useMemo(
    () => buildMapUiThemePreview(draftDefaultMapUiThemeEntry?.themeForm || {}),
    [draftDefaultMapUiThemeEntry]
  );
  const publishedMapUiTheme = useMemo(
    () => mergeMapUiTheme(mapUiThemePublishedConfig),
    [mapUiThemePublishedConfig]
  );
  const activePublishedMapUiThemeSchedule = useMemo(
    () => resolveActiveMapUiThemeSchedule(mapUiThemePublishedConfig),
    [mapUiThemePublishedConfig]
  );
  const sortedMapUiThemeDraftThemes = useMemo(
    () => [...mapUiThemeDraftThemes].sort(compareMapUiThemeLibraryEntries),
    [mapUiThemeDraftThemes]
  );
  const mapUiThemeEditorPreview = useMemo(() => {
    if (!mapUiThemeEditorDraft) return buildMapUiThemePreview({});
    if (mapUiThemeEditorDraft.is_default) {
      return buildMapUiThemePreview(mapUiThemeEditorDraft.themeForm || {});
    }
    return buildMapUiThemePreview(
      mapUiThemeEditorDraft.themeForm || {},
      draftDefaultMapUiThemeEntry?.themeForm || {}
    );
  }, [draftDefaultMapUiThemeEntry, mapUiThemeEditorDraft]);
  const mapUiThemeEditorConflicts = useMemo(
    () => findMapUiThemeDateConflicts(mapUiThemeEditorDraft, mapUiThemeDraftThemes),
    [mapUiThemeEditorDraft, mapUiThemeDraftThemes]
  );
  const mapUiThemeEditorHasInvalidDateWindow = useMemo(
    () => hasInvalidMapUiThemeDateWindow(mapUiThemeEditorDraft),
    [mapUiThemeEditorDraft]
  );
  const mapUiThemeEditorDateWindow = useMemo(
    () => getMapUiThemeDateWindowInfo(mapUiThemeEditorDraft),
    [mapUiThemeEditorDraft]
  );
  const selectedTenantDomainAssignments = useMemo(
    () => tenantDomainAssignmentsByTenant?.[sanitizeTenantKey(selectedTenantKey)] || {},
    [selectedTenantKey, tenantDomainAssignmentsByTenant]
  );
  const selectedTenantAssignedDomainRows = useMemo(() => {
    const rows = [];
    for (const domain of visibleDomainRegistryRows) {
      const assignment = selectedTenantDomainAssignments?.[domain.key];
      if (!assignment) continue;
      rows.push({
        ...assignment,
        domain,
      });
    }
    rows.sort((a, b) => {
      const aSort = Number(a?.domain?.sort_order || 100);
      const bSort = Number(b?.domain?.sort_order || 100);
      if (aSort !== bSort) return aSort - bSort;
      return String(a?.domain?.label || "").localeCompare(String(b?.domain?.label || ""));
    });
    return rows;
  }, [selectedTenantDomainAssignments, visibleDomainRegistryRows]);
  useEffect(() => {
    setSelectedAssignedDomainKey((prev) => {
      const availableKeys = selectedTenantAssignedDomainRows
        .map((row) => String(row?.domain?.key || "").trim().toLowerCase())
        .filter(Boolean);
      if (!availableKeys.length) return "";
      return availableKeys.includes(prev) ? prev : availableKeys[0];
    });
  }, [selectedTenantAssignedDomainRows]);
  const selectedAssignedDomainRow = useMemo(() => {
    const selectedKey = String(selectedAssignedDomainKey || "").trim().toLowerCase();
    return selectedTenantAssignedDomainRows.find((row) => row?.domain?.key === selectedKey) || selectedTenantAssignedDomainRows[0] || null;
  }, [selectedAssignedDomainKey, selectedTenantAssignedDomainRows]);
  const scrollAssignedDomainCardIntoView = useCallback((domainKey) => {
    const key = String(domainKey || "").trim().toLowerCase();
    if (!key || typeof window === "undefined") return;
    const node = assignedDomainCardRefs.current?.[key];
    if (!node) return;
    const targetTop = Math.max(window.scrollY + node.getBoundingClientRect().top - 96, 0);
    window.scrollTo({ top: targetTop, behavior: "auto" });
  }, []);
  useEffect(() => {
    const pendingKey = String(pendingAssignedDomainFocusKeyRef.current || "").trim().toLowerCase();
    if (!pendingKey) return;
    if (!selectedTenantAssignedDomainRows.some((row) => row?.domain?.key === pendingKey)) return;
    pendingAssignedDomainFocusKeyRef.current = "";
    setSelectedAssignedDomainKey(pendingKey);
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        scrollAssignedDomainCardIntoView(pendingKey);
      });
    });
  }, [selectedTenantAssignedDomainRows, expandedAssignedDomainCardKey, scrollAssignedDomainCardIntoView]);
  const manageableTenantDomainRows = useMemo(
    () => (visibleDomainRegistryRows.length ? visibleDomainRegistryRows : fallbackRegistryDomainRows()),
    [visibleDomainRegistryRows]
  );
  const activeManageableTenantDomainRows = useMemo(() => {
    if (activeDomainRegistryRows.length) return activeDomainRegistryRows;
    return manageableTenantDomainRows.filter((row) => String(row?.status || "active").trim().toLowerCase() === "active");
  }, [activeDomainRegistryRows, manageableTenantDomainRows]);
  const manageableTenantDomainRowByKey = useMemo(() => {
    const next = {};
    for (const row of manageableTenantDomainRows) {
      const key = String(row?.key || "").trim().toLowerCase();
      if (!key) continue;
      next[key] = row;
    }
    return next;
  }, [manageableTenantDomainRows]);
  const assignableDomainRegistryRows = useMemo(
    () => activeDomainRegistryRows.filter((domain) => !selectedTenantDomainAssignments?.[domain.key]),
    [activeDomainRegistryRows, selectedTenantDomainAssignments]
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

  const sortedPlatformRoleDefinitions = useMemo(() => {
    const rows = Array.isArray(platformRoleDefinitions) && platformRoleDefinitions.length
      ? [...platformRoleDefinitions]
      : [...DEFAULT_PLATFORM_ROLE_DEFINITIONS];
    rows.sort((a, b) => {
      const aSystem = a?.is_system === true ? 1 : 0;
      const bSystem = b?.is_system === true ? 1 : 0;
      if (aSystem !== bSystem) return bSystem - aSystem;
      return String(a?.role || "").localeCompare(String(b?.role || ""));
    });
    return rows;
  }, [platformRoleDefinitions]);

  const roleLabelByKey = useMemo(() => {
    const out = {};
    for (const row of tenantRoleDefinitions || []) {
      const key = String(row?.role || "").trim();
      if (!key) continue;
      out[key] = toOrganizationLanguage(String(row?.role_label || "").trim() || roleKeyToLabel(key));
    }
    return out;
  }, [tenantRoleDefinitions]);

  const platformRoleLabelByKey = useMemo(() => {
    const out = {};
    for (const row of sortedPlatformRoleDefinitions) {
      const key = String(row?.role || "").trim();
      if (!key) continue;
      out[key] = toOrganizationLanguage(String(row?.role_label || "").trim() || roleKeyToLabel(key));
    }
    return out;
  }, [sortedPlatformRoleDefinitions]);

  const assignableTenantRoles = useMemo(
    () => sortedTenantRoleDefinitions.filter((row) => row?.active !== false),
    [sortedTenantRoleDefinitions]
  );

  const assignablePlatformRoles = useMemo(
    () => sortedPlatformRoleDefinitions.filter((row) => row?.active !== false),
    [sortedPlatformRoleDefinitions]
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

  const platformUserSearchResultById = useMemo(() => {
    const out = {};
    for (const row of platformUserSearchResults || []) {
      const key = String(row?.id || "").trim();
      if (!key) continue;
      out[key] = row;
    }
    return out;
  }, [platformUserSearchResults]);

  const selectedTenantRoleAssignments = useMemo(
    () => (tenantAdmins || []).filter((row) => String(row?.tenant_key || "") === String(selectedTenantKey || "")),
    [tenantAdmins, selectedTenantKey]
  );
  const platformRoleAssignmentCounts = useMemo(() => {
    const counts = {};
    for (const row of platformTeamAssignments || []) {
      const role = String(row?.role || "").trim();
      if (!role) continue;
      counts[role] = (counts[role] || 0) + 1;
    }
    return counts;
  }, [platformTeamAssignments]);
  const residentPortalCount = useMemo(
    () => (tenants || []).filter((row) => Boolean(row?.resident_portal_enabled)).length,
    [tenants]
  );
  const activeOrganizationCount = useMemo(
    () => (tenants || []).filter((row) => row?.active !== false).length,
    [tenants]
  );
  const scheduledDeletionCount = useMemo(
    () => (tenants || []).filter((row) => Boolean(String(row?.deletion_scheduled_for || "").trim())).length,
    [tenants]
  );
  const pilotOrganizationCount = useMemo(
    () => (tenants || []).filter((row) => Boolean(row?.is_pilot)).length,
    [tenants]
  );
  const reportDomainRowsSource = useMemo(() => {
    const registryRows = Array.isArray(domainRegistryRows)
      ? domainRegistryRows
        .filter((row) => String(row?.status || "active").trim().toLowerCase() === "active")
        .map((row) => ({
          key: String(row?.key || "").trim().toLowerCase(),
          label: String(row?.label || "").trim() || defaultDomainLabel(row?.key),
        }))
        .filter((row) => row.key)
      : [];
    if (registryRows.length) return registryRows;
    return DOMAIN_OPTIONS.map((domain) => ({ key: domain.key, label: domain.label }));
  }, [domainRegistryRows]);
  const organizationReportRows = useMemo(() => {
    const assignmentCountsByTenant = {};
    for (const row of tenantAdmins || []) {
      const tenantKey = sanitizeTenantKey(row?.tenant_key);
      if (!tenantKey) continue;
      if (!assignmentCountsByTenant[tenantKey]) {
        assignmentCountsByTenant[tenantKey] = { admins: 0, employees: 0 };
      }
      const roleKey = String(row?.role || "").trim().toLowerCase();
      if (roleKey === "tenant_admin") assignmentCountsByTenant[tenantKey].admins += 1;
      else assignmentCountsByTenant[tenantKey].employees += 1;
    }

    return [...(tenants || [])]
      .map((tenant) => {
        const tenantKey = sanitizeTenantKey(tenant?.tenant_key);
        const assignmentMap = tenantDomainAssignmentsByTenant?.[tenantKey] || {};
        const assignedDomainCount = Object.keys(assignmentMap).length;
        const enabledDomainCount = Object.values(assignmentMap).reduce((count, assignment) => {
          const isActive = assignment?.active !== false;
          const visibility = String(assignment?.visibility || "enabled").trim().toLowerCase();
          if (!isActive || visibility === "disabled") return count;
          return count + 1;
        }, 0);
        const scheduledDeletionAt = String(tenant?.deletion_scheduled_for || "").trim();
        const statusLabel = scheduledDeletionAt
          ? "Scheduled for deletion"
          : tenant?.active === false
            ? "Inactive"
            : "Active";
        const counts = assignmentCountsByTenant[tenantKey] || { admins: 0, employees: 0 };
        return {
          tenant_key: tenantKey,
          organization_name: String(tenant?.name || tenantKey || "Unknown organization").trim(),
          public_display_name: String(tenantProfilesByTenant?.[tenantKey]?.display_name || "").trim(),
          admin_count: counts.admins,
          employee_count: counts.employees,
          is_pilot: Boolean(tenant?.is_pilot),
          is_active: tenant?.active !== false,
          deletion_scheduled_for: scheduledDeletionAt,
          status_label: statusLabel,
          assigned_domain_count: assignedDomainCount,
          enabled_domain_count: enabledDomainCount,
          hub_enabled: Boolean(tenant?.resident_portal_enabled),
        };
      })
      .sort((left, right) => left.organization_name.localeCompare(right.organization_name));
  }, [tenantAdmins, tenantDomainAssignmentsByTenant, tenantProfilesByTenant, tenants]);
  const filteredOrganizationReportRows = useMemo(() => {
    switch (organizationReportFilter) {
      case "active":
        return organizationReportRows.filter((row) => row.is_active && !row.deletion_scheduled_for);
      case "scheduled_deletion":
        return organizationReportRows.filter((row) => Boolean(row.deletion_scheduled_for));
      case "hub_enabled":
        return organizationReportRows.filter((row) => row.hub_enabled);
      case "pilot":
        return organizationReportRows.filter((row) => row.is_pilot);
      case "all":
      default:
        return organizationReportRows;
    }
  }, [organizationReportFilter, organizationReportRows]);
  const organizationReportFilters = useMemo(() => ([
    {
      key: "all",
      label: "Total Organizations",
      value: tenants.length,
      note: "Configured across the platform.",
    },
    {
      key: "active",
      label: "Active Organizations",
      value: activeOrganizationCount,
      note: "Live and available in production.",
    },
    {
      key: "scheduled_deletion",
      label: "Scheduled for Deletion",
      value: scheduledDeletionCount,
      note: "Organizations currently in a deletion hold window.",
    },
    {
      key: "hub_enabled",
      label: "Hubs Enabled",
      value: residentPortalCount,
      note: "Organizations using the resident updates homepage.",
    },
    {
      key: "pilot",
      label: "Pilot Organizations",
      value: pilotOrganizationCount,
      note: "Currently flagged for pilot operations.",
    },
  ]), [activeOrganizationCount, pilotOrganizationCount, residentPortalCount, scheduledDeletionCount, tenants.length]);
  const activeOrganizationReportFilter = useMemo(
    () => organizationReportFilters.find((filter) => filter.key === organizationReportFilter) || organizationReportFilters[0],
    [organizationReportFilter, organizationReportFilters]
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
    reportDomainRowsSource.map((domain) => {
      let publicCount = 0;
      let restrictedCount = 0;
      for (const tenant of tenants || []) {
        const tenantKey = sanitizeTenantKey(tenant?.tenant_key);
        if (!tenantKey) continue;
        const assignment = tenantDomainAssignmentsByTenant?.[tenantKey]?.[domain.key];
        if (!assignment) continue;
        const isActive = assignment?.active !== false;
        const visibility = String(assignment?.visibility || "enabled").trim().toLowerCase();
        if (isActive && visibility !== "disabled") publicCount += 1;
        else restrictedCount += 1;
      }
      return {
        ...domain,
        publicCount,
        restrictedCount,
      };
    })
  ), [reportDomainRowsSource, tenantDomainAssignmentsByTenant, tenants]);

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

  const platformRolePermissionMap = useMemo(() => {
    const out = {};
    const rows = Array.isArray(platformRolePermissions) && platformRolePermissions.length
      ? platformRolePermissions
      : DEFAULT_PLATFORM_ROLE_PERMISSIONS;
    for (const row of rows) {
      const role = String(row?.role || "").trim();
      const permission = String(row?.permission_key || "").trim();
      if (!role || !permission) continue;
      out[`${role}:${permission}`] = Boolean(row?.allowed);
    }
    return out;
  }, [platformRolePermissions]);

  const selectedRoleDefinition = useMemo(
    () => sortedTenantRoleDefinitions.find((row) => String(row?.role || "") === String(selectedRoleKey || "")) || null,
    [sortedTenantRoleDefinitions, selectedRoleKey]
  );
  const selectedRoleAssignmentCount = useMemo(
    () => Number(tenantRoleAssignmentCounts?.[String(selectedRoleKey || "").trim()] || 0),
    [tenantRoleAssignmentCounts, selectedRoleKey]
  );
  const pendingTenantRoleDelete = useMemo(() => {
    const role = String(selectedRoleKey || "").trim();
    if (!role) return null;
    return sortedTenantRoleDefinitions.find((row) => String(row?.role || "").trim() === role) || null;
  }, [selectedRoleKey, sortedTenantRoleDefinitions]);
  const selectedPlatformRoleDefinition = useMemo(
    () => sortedPlatformRoleDefinitions.find((row) => String(row?.role || "") === String(selectedPlatformRoleKey || "")) || null,
    [sortedPlatformRoleDefinitions, selectedPlatformRoleKey]
  );
  const selectedPlatformRoleAssignmentCount = useMemo(
    () => Number(platformRoleAssignmentCounts?.[String(selectedPlatformRoleKey || "").trim()] || 0),
    [platformRoleAssignmentCounts, selectedPlatformRoleKey]
  );
  const tenantSearchQuery = String(tenantSearch || "").trim();
  const hasTenantSearchQuery = tenantSearchQuery.length > 0;
  const platformPermissionSet = useMemo(
    () => new Set(Array.isArray(platformAccessPermissionKeys) ? platformAccessPermissionKeys : []),
    [platformAccessPermissionKeys]
  );
  const hasPlatformPermission = useCallback((permissionKey) => {
    const key = String(permissionKey || "").trim().toLowerCase();
    if (!key) return false;
    return platformPermissionSet.has(key);
  }, [platformPermissionSet]);
  const isPlatformOwner = platformAccessRole === "platform_owner" || platformAccessRole === "legacy_admin";
  const isPlatformStaff = platformAccessRole === "platform_staff";
  const canViewPlatformUsers = hasPlatformPermission("users.access") || hasPlatformPermission("users.edit") || hasPlatformPermission("users.delete");
  const canManagePlatformUsers = hasPlatformPermission("users.edit");
  const canRemovePlatformUsers = hasPlatformPermission("users.delete");
  const canViewPlatformRoles = hasPlatformPermission("roles.access") || hasPlatformPermission("roles.edit") || hasPlatformPermission("roles.delete");
  const canManagePlatformRoles = hasPlatformPermission("roles.edit");
  const canDeletePlatformRoles = hasPlatformPermission("roles.delete");
  const canViewPlatformSecurity = hasPlatformPermission("security.access") || hasPlatformPermission("security.edit") || hasPlatformPermission("security.delete");
  const canManagePlatformSecurity = hasPlatformPermission("security.edit");
  const canEditTenantSetup = hasPlatformPermission("organizations.edit");
  const canDeleteTenant = hasPlatformPermission("organizations.delete");
  const canViewTenantUsers = hasPlatformPermission("users.access") || hasPlatformPermission("users.edit") || hasPlatformPermission("users.delete");
  const canManageTenantUsers = hasPlatformPermission("users.edit");
  const canDeleteTenantUsers = hasPlatformPermission("users.delete");
  const canViewTenantRoles = hasPlatformPermission("roles.access") || hasPlatformPermission("roles.edit") || hasPlatformPermission("roles.delete");
  const canManageTenantRoles = hasPlatformPermission("roles.edit");
  const canDeleteTenantRoles = hasPlatformPermission("roles.delete");
  const canEditTenantDomains = hasPlatformPermission("domains.edit");
  const canViewDomainRegistry = isPlatformAdmin && (hasPlatformPermission("domains.access") || hasPlatformPermission("domains.edit"));
  const canManageDomainRegistry = isPlatformAdmin && hasPlatformPermission("domains.edit");
  const canEditTenantFiles = hasPlatformPermission("files.edit");
  const canViewTenantAudit = hasPlatformPermission("audit.access");
  const canEditLead = hasPlatformPermission("leads.edit");
  const pendingContactDelete = contactDeleteConfirmIndex == null
    ? null
    : (Array.isArray(profileForm.additional_contacts) ? profileForm.additional_contacts[contactDeleteConfirmIndex] || null : null);
  const canCreateOrganizations = canEditTenantSetup;
  const currentPlatformRoleKey = platformAccessRole || (isPlatformOwner ? "platform_owner" : isPlatformStaff ? "platform_staff" : "");
  const platformRoleLabel = platformRoleLabelByKey[currentPlatformRoleKey] || platformRoleToLabel(platformAccessRole);
  const selectedLead = useMemo(
    () => (leadRows || []).find((row) => String(row?.id || "") === String(selectedLeadId || "")) || leadRows?.[0] || null,
    [leadRows, selectedLeadId]
  );
  const fallbackLeadNumberById = useMemo(() => {
    const sorted = [...(leadRows || [])].sort((left, right) => {
      const leftTime = new Date(left?.created_at || 0).getTime();
      const rightTime = new Date(right?.created_at || 0).getTime();
      if (leftTime !== rightTime) return leftTime - rightTime;
      return String(left?.id || "").localeCompare(String(right?.id || ""));
    });
    const next = {};
    sorted.forEach((row, index) => {
      const id = String(row?.id || "").trim();
      if (!id) return;
      next[id] = index + 1;
    });
    return next;
  }, [leadRows]);
  const sessionDisplayName = formatSessionDisplayName(sessionActorName, sessionEmail);
  const canAccessControlPlanePage = useCallback((pageKey) => {
    const permissionKey = CONTROL_PLANE_PAGE_PERMISSIONS[pageKey];
    return permissionKey ? hasPlatformPermission(permissionKey) : false;
  }, [hasPlatformPermission]);
  const visibleControlPlaneSettingsNav = useMemo(
    () => CONTROL_PLANE_SETTINGS_NAV
      .map((group) => {
        const items = group.items.filter((item) => canAccessControlPlanePage(item.key));
        return items.length ? { ...group, items } : null;
      })
      .filter(Boolean),
    [canAccessControlPlanePage]
  );
  const activeSettingsGroupKey = useMemo(
    () => visibleControlPlaneSettingsNav.find((group) => group.items.some((item) => item.key === controlPlanePage))?.key || "",
    [controlPlanePage, visibleControlPlaneSettingsNav]
  );
  const filteredControlPlaneSettingsNav = useMemo(() => {
    const query = String(controlPlaneSettingsSearch || "").trim().toLowerCase();
    if (!query) return visibleControlPlaneSettingsNav;
    return visibleControlPlaneSettingsNav
      .map((group) => {
        const groupMatches = String(group.label || "").trim().toLowerCase().includes(query);
        if (groupMatches) return group;
        const nextItems = group.items.filter((item) => String(item.label || "").trim().toLowerCase().includes(query));
        if (!nextItems.length) return null;
        return { ...group, items: nextItems };
      })
      .filter(Boolean);
  }, [controlPlaneSettingsSearch, visibleControlPlaneSettingsNav]);
  const activeMobileSettingsGroup = useMemo(
    () => filteredControlPlaneSettingsNav.find((group) => group.key === mobileSettingsGroupKey)
      || filteredControlPlaneSettingsNav.find((group) => group.key === activeSettingsGroupKey)
      || filteredControlPlaneSettingsNav[0]
      || null,
    [activeSettingsGroupKey, filteredControlPlaneSettingsNav, mobileSettingsGroupKey]
  );
  const availableTenantWorkspaceTabs = useMemo(
    () => TAB_OPTIONS.filter((tab) => hasPlatformPermission(TENANT_WORKSPACE_TAB_PERMISSIONS[tab.key] || "")),
    [hasPlatformPermission]
  );
  const visibleControlPlanePagesBySection = useMemo(
    () => Object.fromEntries(
      CONTROL_PLANE_SECTIONS.map((section) => [
        section.key,
        CONTROL_PLANE_PAGES.filter((page) => page.section === section.key && canAccessControlPlanePage(page.key)),
      ])
    ),
    [canAccessControlPlanePage]
  );
  const visibleControlPlaneTopNavItems = useMemo(
    () => CONTROL_PLANE_TOP_NAV_ITEMS.filter((item) => {
      if (item.type === "page") return canAccessControlPlanePage(item.key);
      return Boolean((visibleControlPlanePagesBySection[item.key] || []).length);
    }),
    [canAccessControlPlanePage, visibleControlPlanePagesBySection]
  );
  const controlPlanePageLabel = useMemo(
    () => {
      if (controlPlanePage === "lead-detail" && selectedLead) {
        return formatLeadNumber(selectedLead?.lead_number || fallbackLeadNumberById?.[String(selectedLead?.id || "").trim()] || 0);
      }
      return CONTROL_PLANE_PAGES.find((page) => page.key === controlPlanePage)?.label || "";
    },
    [controlPlanePage, selectedLead, fallbackLeadNumberById]
  );
  const addTenantStepIndex = Math.max(0, ADD_TENANT_STEPS.findIndex((step) => step.key === addTenantStep));
  const selectedSearchAccount = assignForm.user_id ? userSearchResultById?.[assignForm.user_id] || null : null;
  const selectedPlatformSearchAccount = platformTeamForm.user_id ? platformUserSearchResultById?.[platformTeamForm.user_id] || null : null;
  const formatUserSummaryLabel = useCallback((summary) => {
    if (!summary) return "Selected account";
    const displayName = String(summary?.display_name || summary?.full_name || summary?.name || "").trim();
    if (displayName) return displayName;
    const firstName = String(summary?.first_name || "").trim();
    const lastName = String(summary?.last_name || "").trim();
    const combinedName = `${firstName} ${lastName}`.trim();
    if (combinedName) return combinedName;
    return String(summary?.email || "").trim() || "Selected account";
  }, []);
  const changePasswordRequirements = useMemo(() => {
    const nextPassword = String(changePasswordDraft.new_password || "");
    const confirmPassword = String(changePasswordDraft.confirm_new_password || "");
    const currentPassword = String(changePasswordDraft.current_password || "");
    const hasLen = nextPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(nextPassword);
    const hasLower = /[a-z]/.test(nextPassword);
    const hasNumber = /[0-9]/.test(nextPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(nextPassword);
    const matches = Boolean(confirmPassword) && nextPassword === confirmPassword;
    const strongEnough = hasLen && hasUpper && hasLower && hasNumber && hasSpecial;
    const hasCurrentPassword = currentPassword.trim().length > 0;
    return {
      hasLen,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      matches,
      strongEnough,
      hasCurrentPassword,
      canSubmit: strongEnough && matches && hasCurrentPassword,
    };
  }, [changePasswordDraft.confirm_new_password, changePasswordDraft.current_password, changePasswordDraft.new_password]);
  const groupedTenantFiles = useMemo(() => {
    const grouped = Object.fromEntries(TENANT_ASSET_CATEGORIES.map((category) => [category.key, []]));
    for (const row of tenantFiles || []) {
      const key = String(row?.file_category || "").trim().toLowerCase();
      if (grouped[key]) grouped[key].push(row);
      else grouped.other.push(row);
    }
    return grouped;
  }, [tenantFiles]);
  const domainCoordinateFiles = useMemo(() => {
    const grouped = Object.fromEntries(DOMAIN_OPTIONS.map((domain) => [domain.key, []]));
    for (const row of tenantFiles || []) {
      if (String(row?.file_category || "").trim().toLowerCase() !== "asset_coordinates") continue;
      const domainKey = String(row?.asset_subtype || "").trim().toLowerCase();
      if (grouped[domainKey]) grouped[domainKey].push(row);
    }
    return grouped;
  }, [tenantFiles]);
  const filteredLeadRows = useMemo(() => {
    const leadNumberFilter = String(leadFilters?.lead_number || "").trim().toLowerCase();
    const orgNameFilter = String(leadFilters?.org_name || "").trim().toLowerCase();
    const domainFilter = String(leadFilters?.priority_domain || "").trim().toLowerCase();
    const dateFilter = String(leadFilters?.date_submitted || "").trim();
    const statusFilter = String(leadFilters?.status || "").trim().toLowerCase();

    return (leadRows || []).filter((lead) => {
      const leadId = String(lead?.id || "").trim();
      const leadNumber = String(lead?.lead_number || fallbackLeadNumberById?.[leadId] || "").trim().toLowerCase();
      const leadNumberLabel = formatLeadNumber(lead?.lead_number || fallbackLeadNumberById?.[leadId] || 0).toLowerCase();
      const orgName = String(lead?.city_agency || "").trim().toLowerCase();
      const priorityDomain = String(lead?.priority_domain || "").trim().toLowerCase();
      const submittedDate = String(lead?.created_at || "").slice(0, 10);
      const status = String(lead?.status || "new").trim().toLowerCase();

      if (leadNumberFilter && !leadNumber.includes(leadNumberFilter) && !leadNumberLabel.includes(leadNumberFilter)) return false;
      if (orgNameFilter && !orgName.includes(orgNameFilter)) return false;
      if (domainFilter && priorityDomain !== domainFilter) return false;
      if (dateFilter && submittedDate !== dateFilter) return false;
      if (statusFilter && status !== statusFilter) return false;
      return true;
    });
  }, [leadFilters, leadRows, fallbackLeadNumberById]);
  const resolveKnownUserSummary = useCallback((userId) => {
    const key = String(userId || "").trim();
    if (!key) return null;
    return assignmentUserSummariesById?.[key] || userSearchResultById?.[key] || null;
  }, [assignmentUserSummariesById, userSearchResultById]);
  const formatKnownUserLabel = useCallback((userId) => {
    const summary = resolveKnownUserSummary(userId);
    return formatUserSummaryLabel(summary);
  }, [formatUserSummaryLabel, resolveKnownUserSummary]);
  const formatPlatformUserLabel = useCallback((userId) => {
    const key = String(userId || "").trim();
    if (!key) return "Selected account";
    const summary = platformTeamUserSummariesById?.[key] || platformUserSearchResultById?.[key] || null;
    return formatUserSummaryLabel(summary);
  }, [formatUserSummaryLabel, platformTeamUserSummariesById, platformUserSearchResultById]);

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
    if (!hasPlatformPermission("organizations.access") && !hasPlatformPermission("organizations.edit") && !hasPlatformPermission("organizations.delete")) {
      setTenants([]);
      return;
    }
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
  }, [hasPlatformPermission]);

  const loadTenantAdmins = useCallback(async () => {
    if (!canViewTenantUsers) {
      setTenantAdmins([]);
      return;
    }
    const { data, error } = await supabase
      .from("tenant_user_roles")
      .select("tenant_key,user_id,role,status,created_at")
      .eq("status", "active")
      .order("tenant_key", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    setTenantAdmins(Array.isArray(data) ? data : []);
  }, [canViewTenantUsers]);

  const loadPlatformTeamAssignments = useCallback(async () => {
    if (!canViewPlatformUsers) {
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
  }, [canViewPlatformUsers]);

  const loadPlatformRoleConfig = useCallback(async () => {
    if (!canViewPlatformUsers && !canViewPlatformRoles) {
      setPlatformPermissionCatalog([]);
      setPlatformRoleDefinitions([]);
      setPlatformRolePermissions([]);
      return;
    }
    const [catalogResult, rolesResult, permsResult] = await Promise.all([
      supabase
        .from("platform_permissions_catalog")
        .select("permission_key,module_key,action_key,label,sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("platform_role_definitions")
        .select("role,role_label,is_system,active,created_at,updated_at")
        .order("is_system", { ascending: false })
        .order("role", { ascending: true }),
      supabase
        .from("platform_role_permissions")
        .select("role,permission_key,allowed"),
    ]);

    if (catalogResult.error || rolesResult.error || permsResult.error) {
      const firstError = catalogResult.error || rolesResult.error || permsResult.error;
      if (isMissingRelationError(firstError)) {
        setPlatformPermissionCatalog(
          PLATFORM_PERMISSION_MODULES.flatMap((module) => PLATFORM_PERMISSION_ACTIONS.map((action, actionIndex) => ({
            permission_key: `${module.key}.${action.key}`,
            module_key: module.key,
            action_key: action.key,
            label: `${module.label} ${action.label}`,
            sort_order: (PLATFORM_PERMISSION_MODULES.findIndex((candidate) => candidate.key === module.key) + 1) * 10 + actionIndex,
          })))
        );
        setPlatformRoleDefinitions(DEFAULT_PLATFORM_ROLE_DEFINITIONS);
        setPlatformRolePermissions(DEFAULT_PLATFORM_ROLE_PERMISSIONS);
        setPlatformRoleStatus("Platform RBAC tables are not available yet. Run the latest migrations to enable custom PCP roles.");
        return;
      }
      throw firstError;
    }

    setPlatformPermissionCatalog(Array.isArray(catalogResult.data) ? catalogResult.data : []);
    setPlatformRoleDefinitions(Array.isArray(rolesResult.data) ? rolesResult.data : []);
    setPlatformRolePermissions(Array.isArray(permsResult.data) ? permsResult.data : []);
    setPlatformRoleStatus("");
  }, [canViewPlatformRoles, canViewPlatformUsers]);

  const readPlatformSecuritySnapshot = useCallback(async () => {
    if (!sessionUserId) {
      return {
        settings: DEFAULT_PLATFORM_SECURITY_SETTINGS,
        pin_hash: "",
        error: null,
      };
    }
    const [settingsResult, pinResult] = await Promise.all([
      supabase
        .from("platform_security_settings")
        .select("config_key,require_pin_for_role_changes,require_pin_for_team_changes,require_pin_for_account_changes,require_pin_for_report_state_changes,require_pin_for_organization_info_changes,require_pin_for_contact_changes,require_pin_for_organization_user_changes,require_pin_for_organization_role_changes,require_pin_for_domain_settings_changes")
        .eq("config_key", "default")
        .maybeSingle(),
      supabase
        .from("platform_user_security_profiles")
        .select("user_id,pin_enabled,pin_hash")
        .eq("user_id", sessionUserId)
        .maybeSingle(),
    ]);

    const firstError = settingsResult.error || pinResult.error;
    return {
      settings: {
        require_pin_for_role_changes: Boolean(settingsResult.data?.require_pin_for_role_changes),
        require_pin_for_team_changes: Boolean(settingsResult.data?.require_pin_for_team_changes),
        require_pin_for_account_changes: Boolean(settingsResult.data?.require_pin_for_account_changes),
        require_pin_for_report_state_changes: Boolean(settingsResult.data?.require_pin_for_report_state_changes),
        require_pin_for_organization_info_changes: Boolean(settingsResult.data?.require_pin_for_organization_info_changes),
        require_pin_for_contact_changes: Boolean(settingsResult.data?.require_pin_for_contact_changes),
        require_pin_for_organization_user_changes: Boolean(settingsResult.data?.require_pin_for_organization_user_changes),
        require_pin_for_organization_role_changes: Boolean(settingsResult.data?.require_pin_for_organization_role_changes),
        require_pin_for_domain_settings_changes: Boolean(settingsResult.data?.require_pin_for_domain_settings_changes),
      },
      pin_hash: String(pinResult.data?.pin_hash || "").trim(),
      error: firstError || null,
    };
  }, [sessionUserId]);

  const loadPlatformSecurityConfig = useCallback(async () => {
    if (!sessionUserId || !canViewPlatformSecurity) {
      setPlatformSecuritySettingsSaved(DEFAULT_PLATFORM_SECURITY_SETTINGS);
      setPlatformSecuritySettingsDraft(DEFAULT_PLATFORM_SECURITY_SETTINGS);
      setPlatformSecurityPinDraft(DEFAULT_PLATFORM_SECURITY_PIN_DRAFT);
      setPlatformSecurityPinMeta({ pin_hash: "" });
      setPlatformSecurityChecksEditMode(false);
      setPlatformSecurityStatus("");
      return;
    }

    const snapshot = await readPlatformSecuritySnapshot();
    if (snapshot.error) {
      if (isMissingRelationError(snapshot.error)) {
        setPlatformSecuritySettingsSaved(DEFAULT_PLATFORM_SECURITY_SETTINGS);
        setPlatformSecuritySettingsDraft(DEFAULT_PLATFORM_SECURITY_SETTINGS);
        setPlatformSecurityPinDraft(DEFAULT_PLATFORM_SECURITY_PIN_DRAFT);
        setPlatformSecurityPinMeta({ pin_hash: "" });
        setPlatformSecurityChecksEditMode(false);
        setPlatformSecurityStatus("Security tables are not available yet. Run the latest migrations to enable PIN checkpoints.");
        return;
      }
      setPlatformSecurityStatus(statusText(snapshot.error, ""));
      return;
    }

    setPlatformSecuritySettingsSaved(snapshot.settings);
    setPlatformSecuritySettingsDraft(snapshot.settings);
    setPlatformSecurityPinDraft({
      ...DEFAULT_PLATFORM_SECURITY_PIN_DRAFT,
    });
    setPlatformSecurityPinMeta({
      pin_hash: snapshot.pin_hash,
    });
    setPlatformSecurityChecksEditMode(false);
    setPlatformSecurityStatus("");
  }, [canViewPlatformSecurity, readPlatformSecuritySnapshot, sessionUserId]);

  const closePlatformSecurityCheckpoint = useCallback((approved = false) => {
    const resolver = platformSecurityCheckpointResolverRef.current;
    platformSecurityCheckpointResolverRef.current = null;
    setPlatformSecurityCheckpointRequest(null);
    setPlatformSecurityCheckpointPin("");
    setPlatformSecurityCheckpointStatus("");
    setPlatformSecurityCheckpointVerifying(false);
    if (typeof resolver === "function") resolver(approved);
  }, []);

  const submitPlatformSecurityCheckpoint = useCallback(async (pinOverride = "") => {
    if (!platformSecurityCheckpointRequest?.expected_hash) {
      closePlatformSecurityCheckpoint(false);
      return;
    }
    if (!sessionUserId) {
      setPlatformSecurityCheckpointStatus("Sign in again and retry.");
      return;
    }

    const pin = String(pinOverride || platformSecurityCheckpointPin || "").trim();
    if (!/^\d{4}$/.test(pin)) {
      setPlatformSecurityCheckpointStatus("Enter your 4-digit PIN to continue.");
      return;
    }

    setPlatformSecurityCheckpointVerifying(true);
    setPlatformSecurityCheckpointStatus("");
    const providedHash = await hashSecurityPin(sessionUserId, pin);
    setPlatformSecurityCheckpointVerifying(false);
    if (providedHash !== String(platformSecurityCheckpointRequest.expected_hash || "").trim()) {
      setPlatformSecurityCheckpointStatus("PIN is incorrect.");
      return;
    }

    closePlatformSecurityCheckpoint(true);
  }, [closePlatformSecurityCheckpoint, platformSecurityCheckpointPin, platformSecurityCheckpointRequest, sessionUserId]);

  const requirePlatformSecurityCheckpoint = useCallback(async ({
    settingKey,
    title,
    description,
    onBlocked,
  }) => {
    const snapshot = await readPlatformSecuritySnapshot();
    if (snapshot.error) {
      const message = isMissingRelationError(snapshot.error)
        ? "Security PIN tables are not available in this environment yet. Apply the latest Supabase migrations first."
        : statusText(snapshot.error, "");
      onBlocked?.(message);
      return false;
    }

    setPlatformSecuritySettingsDraft(snapshot.settings);
    setPlatformSecurityPinMeta({ pin_hash: snapshot.pin_hash });
    if (!snapshot.settings?.[settingKey]) return true;

    if (!snapshot.pin_hash) {
      onBlocked?.("This action requires a PIN, but your account does not have one set yet. Set your PIN under Account Info first.");
      return false;
    }

    if (platformSecurityCheckpointResolverRef.current) {
      closePlatformSecurityCheckpoint(false);
    }

    return new Promise((resolve) => {
      platformSecurityCheckpointResolverRef.current = resolve;
      setPlatformSecurityCheckpointPin("");
      setPlatformSecurityCheckpointStatus("");
      setPlatformSecurityCheckpointVerifying(false);
      setPlatformSecurityCheckpointRequest({
        title,
        description,
        expected_hash: snapshot.pin_hash,
      });
    });
  }, [closePlatformSecurityCheckpoint, readPlatformSecuritySnapshot]);

  const loadClientLeads = useCallback(async () => {
    if (!hasPlatformPermission("leads.access") && !hasPlatformPermission("leads.edit")) {
      setLeadRows([]);
      return;
    }
    let result = await supabase
      .from("client_leads")
      .select("id,lead_number,created_at,full_name,work_email,city_agency,role_title,priority_domain,notes,status,internal_notes,follow_up_on,last_follow_up_at,updated_at")
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
          lead_number: null,
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
  }, [hasPlatformPermission]);

  const loadTenantRoleConfig = useCallback(async (tenantKeyInput = selectedTenantKey) => {
    if (!canViewTenantUsers && !canViewTenantRoles) {
      setTenantRoleDefinitions([]);
      setTenantRolePermissions([]);
      return;
    }
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
  }, [canViewTenantRoles, canViewTenantUsers, selectedTenantKey]);

  const loadTenantProfiles = useCallback(async () => {
    if (!hasPlatformPermission("organizations.access") && !hasPlatformPermission("organizations.edit")) {
      setTenantProfilesByTenant({});
      return;
    }
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
  }, [hasPlatformPermission]);

  const loadTenantVisibility = useCallback(async () => {
    if (!hasPlatformPermission("domains.access") && !hasPlatformPermission("domains.edit")) {
      setTenantVisibilityByTenant({});
      return;
    }
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
  }, [hasPlatformPermission]);

  const loadTenantDomainConfigs = useCallback(async () => {
    if (!hasPlatformPermission("domains.access") && !hasPlatformPermission("domains.edit")) {
      setTenantDomainConfigsByTenant({});
      return;
    }
    let { data, error } = await supabase
      .from("tenant_domain_configs")
      .select("tenant_key,domain,domain_type,notification_email,organization_monitored_repairs,public_visibility_min_reports,high_confidence_min_reports");
    if (error && isMissingColumnError(error)) {
      const fallback = await supabase
        .from("tenant_domain_configs")
        .select("tenant_key,domain,domain_type,notification_email,organization_monitored_repairs");
      data = fallback.data;
      error = fallback.error;
    }
    if (error) {
      if (isMissingRelationError(error)) {
        setTenantDomainConfigsByTenant({});
        return;
      }
      throw error;
    }
    const next = {};
    for (const row of data || []) {
      const tenantKey = sanitizeTenantKey(row?.tenant_key);
      const domain = String(row?.domain || "").trim().toLowerCase();
      if (!tenantKey || !domain) continue;
      if (!next[tenantKey]) next[tenantKey] = {};
      next[tenantKey][domain] = {
        domain_type: String(row?.domain_type || defaultDomainType(domain)).trim().toLowerCase() || defaultDomainType(domain),
        notification_email: String(row?.notification_email || "").trim(),
        organization_monitored_repairs: row?.organization_monitored_repairs !== false,
        public_visibility_min_reports: sanitizePositiveIntegerSetting(
          row?.public_visibility_min_reports,
          defaultDomainPublicVisibilityMinReports(domain),
          { min: 1, max: 25 }
        ),
        high_confidence_min_reports: sanitizePositiveIntegerSetting(
          row?.high_confidence_min_reports,
          defaultDomainHighConfidenceMinReports(domain),
          { min: 1, max: 25 }
        ),
      };
    }
    setTenantDomainConfigsByTenant(next);
  }, [hasPlatformPermission]);

  const loadTenantDomainIssueTypes = useCallback(async () => {
    if (!hasPlatformPermission("domains.access") && !hasPlatformPermission("domains.edit")) {
      setTenantDomainIssueTypesByTenant({});
      return;
    }
    const { data, error } = await supabase
      .from("tenant_domain_issue_types")
      .select("tenant_key,domain_key,issue_key,issue_label,sort_order,active")
      .order("tenant_key", { ascending: true })
      .order("domain_key", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("issue_label", { ascending: true });
    if (error) {
      if (isMissingRelationError(error)) {
        setTenantDomainIssueTypesByTenant({});
        return;
      }
      throw error;
    }
    const next = {};
    for (const row of data || []) {
      const tenantKey = sanitizeTenantKey(row?.tenant_key);
      const domainKey = String(row?.domain_key || "").trim().toLowerCase();
      if (!tenantKey || !domainKey) continue;
      if (!next[tenantKey]) next[tenantKey] = {};
      if (!next[tenantKey][domainKey]) next[tenantKey][domainKey] = [];
      next[tenantKey][domainKey].push({
        issue_key: String(row?.issue_key || "").trim(),
        issue_label: String(row?.issue_label || "").trim(),
        sort_order: Number(row?.sort_order || 100),
        active: row?.active !== false,
      });
    }
    setTenantDomainIssueTypesByTenant(next);
  }, [hasPlatformPermission]);

  const loadDomainRegistryData = useCallback(async () => {
    if (!canViewDomainRegistry) {
      setDomainRegistryRows([]);
      setDomainRegistrySchemaReady(true);
      return;
    }
    const definitionsResult = await supabase
      .from("domain_definitions")
      .select("id,key,label,description,domain_class,status,icon_key,icon_src,ownership_model,report_prefix,allow_report_images,road_required,type_options,default_visibility,default_notification_email,default_organization_monitored_repairs,sort_order,created_at,updated_at")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    if (definitionsResult.error) {
      if (isMissingRelationError(definitionsResult.error)) {
        setDomainRegistryRows([]);
        setDomainRegistrySchemaReady(false);
        return;
      }
      throw definitionsResult.error;
    }
    const rows = (definitionsResult.data || []).map((row) => ({
      ...row,
      key: String(row?.key || "").trim().toLowerCase(),
      type_options: normalizeDomainTypeOptionConfigs(row?.type_options, row?.key),
    }));
    setDomainRegistryRows(rows);
    setDomainRegistrySchemaReady(true);
  }, [canViewDomainRegistry]);

  const loadMapUiIconConfigs = useCallback(async () => {
    if (!canViewDomainRegistry) {
      setMapUiIconDraftConfig({});
      setMapUiIconPublishedConfig({});
      setMapUiThemeDraftConfig({});
      setMapUiThemePublishedConfig({});
      const emptyThemeLibrary = normalizeMapUiThemeLibraryDrafts({}, {});
      setMapUiThemeDraftThemes(emptyThemeLibrary);
      setMapUiThemePublishedThemes(emptyThemeLibrary);
      setMapUiThemeEditorOpen(false);
      setMapUiThemeEditorDraft(null);
      setMapUiIconDraftForm(buildMapUiIconDraftForm({}));
      setMapUiThemeDraftForm(buildMapUiThemeDraftForm({}));
      setMapUiThemeBaseEnabled(false);
      setMapUiThemeSchedulesDraft([]);
      setMapUiThemeExpandedScheduleId("");
      return;
    }
    const { data, error } = await supabase
      .from("app_config")
      .select("key,value")
      .in("key", [
        MAP_UI_ICON_DRAFT_CONFIG_KEY,
        MAP_UI_ICON_PUBLISHED_CONFIG_KEY,
        MAP_UI_THEME_DRAFT_CONFIG_KEY,
        MAP_UI_THEME_PUBLISHED_CONFIG_KEY,
      ]);
    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const iconDraftRow = rows.find((row) => String(row?.key || "").trim() === MAP_UI_ICON_DRAFT_CONFIG_KEY) || null;
    const iconPublishedRow = rows.find((row) => String(row?.key || "").trim() === MAP_UI_ICON_PUBLISHED_CONFIG_KEY) || null;
    const themeDraftRow = rows.find((row) => String(row?.key || "").trim() === MAP_UI_THEME_DRAFT_CONFIG_KEY) || null;
    const themePublishedRow = rows.find((row) => String(row?.key || "").trim() === MAP_UI_THEME_PUBLISHED_CONFIG_KEY) || null;
    const iconDraftConfig = iconDraftRow?.value && typeof iconDraftRow.value === "object" ? iconDraftRow.value : {};
    const iconPublishedConfig = iconPublishedRow?.value && typeof iconPublishedRow.value === "object" ? iconPublishedRow.value : {};
    const storedThemeDraftConfig = themeDraftRow?.value && typeof themeDraftRow.value === "object" ? themeDraftRow.value : {};
    const storedThemePublishedConfig = themePublishedRow?.value && typeof themePublishedRow.value === "object" ? themePublishedRow.value : {};
    const themeDraftConfig = hasStoredMapUiThemeConfig(storedThemeDraftConfig)
      ? storedThemeDraftConfig
      : hasStoredMapUiThemeConfig(iconDraftConfig)
        ? iconDraftConfig
        : {};
    const themePublishedConfig = hasStoredMapUiThemeConfig(storedThemePublishedConfig)
      ? storedThemePublishedConfig
      : hasStoredMapUiThemeConfig(iconPublishedConfig)
        ? iconPublishedConfig
        : {};
    const baseIcons = Object.keys(sanitizeMapUiIconManifest(iconDraftConfig)).length
      ? iconDraftConfig
      : iconPublishedConfig;
    const baseTheme = hasStoredMapUiThemeConfig(themeDraftConfig)
      ? themeDraftConfig
      : themePublishedConfig;

    setMapUiIconDraftConfig(iconDraftConfig);
    setMapUiIconPublishedConfig(iconPublishedConfig);
    setMapUiThemeDraftConfig(themeDraftConfig);
    setMapUiThemePublishedConfig(themePublishedConfig);
    const draftThemeLibrary = normalizeMapUiThemeLibraryDrafts(themeDraftConfig, themePublishedConfig);
    const publishedThemeLibrary = normalizeMapUiThemeLibraryDrafts(themePublishedConfig, themePublishedConfig);
    setMapUiThemeDraftThemes(draftThemeLibrary);
    setMapUiThemePublishedThemes(publishedThemeLibrary);
    setMapUiThemeEditorOpen(false);
    setMapUiThemeEditorDraft(null);
    setMapUiIconDraftForm(buildMapUiIconDraftForm(baseIcons));
    const draftDefaultTheme = draftThemeLibrary.find((entry) => entry?.is_default);
    setMapUiThemeDraftForm(buildMapUiThemeDraftForm(draftDefaultTheme?.themeForm || draftDefaultTheme?.theme || baseTheme));
    setMapUiThemeBaseEnabled(isMapUiBaseThemeEnabled(baseTheme));
    const nextScheduleDrafts = buildMapUiThemeScheduleDrafts(baseTheme);
    setMapUiThemeSchedulesDraft(nextScheduleDrafts);
    setMapUiThemeExpandedScheduleId(nextScheduleDrafts[0]?.id || "");
  }, [canViewDomainRegistry]);

  const loadTenantDomainAssignments = useCallback(async () => {
    if (!canViewDomainRegistry) {
      setTenantDomainAssignmentsByTenant({});
      setTenantDomainAssignmentSchemaReady(true);
      return;
    }
    let { data, error } = await supabase
      .from("tenant_domain_assignments")
      .select("id,tenant_key,domain_key,active,visibility,display_label,marker_color,icon_render_mode,icon_tint_mode,icon_tint_color,notification_email,notification_template_key,notification_subject_template,notification_body_template,organization_monitored_repairs,public_visibility_min_reports,high_confidence_min_reports,type_options,report_disclosures,billing_status,billing_model,billing_amount,billing_notes,activated_at,activated_by,created_at,updated_at")
      .order("tenant_key", { ascending: true })
      .order("domain_key", { ascending: true });
    if (error && isMissingColumnError(error)) {
      const fallbackResult = await supabase
        .from("tenant_domain_assignments")
        .select("id,tenant_key,domain_key,active,visibility,notification_email,organization_monitored_repairs,billing_status,billing_model,billing_amount,billing_notes,activated_at,activated_by,created_at,updated_at")
        .order("tenant_key", { ascending: true })
        .order("domain_key", { ascending: true });
      data = fallbackResult.data;
      error = fallbackResult.error;
    }
    if (error) {
      if (isMissingRelationError(error)) {
        setTenantDomainAssignmentsByTenant({});
        setTenantDomainAssignmentSchemaReady(false);
        return;
      }
      throw error;
    }
    const next = {};
    for (const row of data || []) {
      const tenantKey = sanitizeTenantKey(row?.tenant_key);
      const domainKey = String(row?.domain_key || "").trim().toLowerCase();
      if (!tenantKey || !domainKey) continue;
      if (!next[tenantKey]) next[tenantKey] = {};
      next[tenantKey][domainKey] = {
        ...row,
        domain_key: domainKey,
      };
    }
    setTenantDomainAssignmentsByTenant(next);
    setTenantDomainAssignmentSchemaReady(true);
  }, [canViewDomainRegistry]);

  const loadTenantMapFeatures = useCallback(async () => {
    if (!hasPlatformPermission("domains.access") && !hasPlatformPermission("domains.edit")) {
      setTenantMapFeaturesByTenant({});
      return;
    }
    const { data, error } = await supabase
      .from("tenant_map_features")
      .select("tenant_key,show_boundary_border,shade_outside_boundary,show_alert_icon,show_event_icon,outside_shade_opacity,boundary_border_color,boundary_border_width");
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
        show_alert_icon: row?.show_alert_icon !== false,
        show_event_icon: row?.show_event_icon !== false,
        outside_shade_opacity: Number.isFinite(Number(row?.outside_shade_opacity))
          ? Number(row.outside_shade_opacity)
          : 0.42,
        boundary_border_color: sanitizeHexColor(row?.boundary_border_color, "#e53935"),
        boundary_border_width: nextBorderWidth,
      };
    }
    setTenantMapFeaturesByTenant(next);
  }, [hasPlatformPermission]);

  const loadTenantFiles = useCallback(async (tenantKey) => {
    const key = sanitizeTenantKey(tenantKey);
    if (!key) {
      setTenantFiles([]);
      return;
    }
    const { data, error } = await supabase
      .from("tenant_files")
      .select("id,tenant_key,file_category,file_name,storage_bucket,storage_path,mime_type,size_bytes,uploaded_by,uploaded_at,notes,active,asset_subtype")
      .eq("tenant_key", key)
      .order("uploaded_at", { ascending: false });
    if (error) throw error;
    setTenantFiles(Array.isArray(data) ? data : []);
  }, []);

  const loadAudit = useCallback(async (tenantKeyInput = selectedTenantKey) => {
    if (!canViewTenantAudit) {
      setAuditRows([]);
      return;
    }
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
  }, [canViewTenantAudit, selectedTenantKey]);

  const purgeExpiredOrganizationDeletions = useCallback(async () => {
    if (!canDeleteTenant) return;
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
  }, [canDeleteTenant, logAudit, sessionUserId]);

  const refreshControlPlaneData = useCallback(async () => {
    try {
      await purgeExpiredOrganizationDeletions();
      await Promise.all([
        loadTenants(),
        loadTenantAdmins(),
        loadPlatformRoleConfig(),
        loadPlatformTeamAssignments(),
        loadClientLeads(),
        loadTenantRoleConfig(),
        loadTenantProfiles(),
        loadTenantVisibility(),
        loadTenantDomainConfigs(),
        loadTenantDomainIssueTypes(),
        loadDomainRegistryData(),
        loadMapUiIconConfigs(),
        loadTenantDomainAssignments(),
        loadTenantMapFeatures(),
        loadAudit(),
      ]);
      setStatus((prev) => ({ ...prev, hydrate: "" }));
    } catch (error) {
      setStatus((prev) => ({ ...prev, hydrate: statusText(error, "") }));
    }
  }, [purgeExpiredOrganizationDeletions, loadTenants, loadTenantAdmins, loadPlatformRoleConfig, loadPlatformTeamAssignments, loadClientLeads, loadTenantRoleConfig, loadTenantProfiles, loadTenantVisibility, loadTenantDomainConfigs, loadTenantDomainIssueTypes, loadDomainRegistryData, loadMapUiIconConfigs, loadTenantDomainAssignments, loadTenantMapFeatures, loadAudit]);

  const loadAssignmentUserSummaries = useCallback(async () => {
    if (!canViewTenantUsers) {
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
  }, [canViewTenantUsers, invokePlatformUserAdmin, selectedTenantRoleAssignments]);

  const loadPlatformTeamUserSummaries = useCallback(async () => {
    if (!canViewPlatformUsers) {
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
    if (sessionUserId) {
      next[sessionUserId] = {
        id: sessionUserId,
        user_id: sessionUserId,
        display_name: sessionDisplayName || sessionEmail || sessionUserId,
        email: sessionEmail,
        phone: sessionPhone,
      };
    }
    for (const row of Array.isArray(data?.results) ? data.results : []) {
      const key = String(row?.id || row?.user_id || "").trim();
      if (!key) continue;
      next[key] = row;
    }
    setPlatformTeamUserSummariesById(next);
  }, [canViewPlatformUsers, invokePlatformUserAdmin, platformTeamAssignments, sessionDisplayName, sessionEmail, sessionPhone, sessionUserId]);

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
      const metadataPhone =
        String(session?.user?.phone || "").trim() ||
        String(session?.user?.user_metadata?.phone || "").trim();
      const emailName = userEmail ? String(userEmail.split("@")[0] || "").trim() : "";
      setSessionUserId(userId);
      setSessionEmail(userEmail);
      setSessionActorName(metadataName || emailName);
      setSessionPhone(metadataPhone);
      if (userId) {
        setPlatformTeamUserSummariesById((prev) => ({
          ...prev,
          [userId]: {
            ...(prev?.[userId] || {}),
            id: userId,
            user_id: userId,
            display_name: metadataName || emailName || userEmail || userId,
            email: userEmail,
            phone: metadataPhone,
          },
        }));
      }
      setPlatformAccountDraft({
        full_name: metadataName || emailName,
        phone: metadataPhone,
      });
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, getAuthRedirectOptions("/"));
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
    setPlatformAccessRoles([]);
    setPlatformAccessPermissionKeys([]);
    setLoginPassword("");
    setControlPlaneSection("reports");
    setControlPlanePage(DEFAULT_CONTROL_PLANE_PAGE);
    setEntryStep("start");
    setSessionUserId("");
    setSessionEmail("");
    setSessionActorName("");
    setSessionPhone("");
    setPlatformAccountEditMode(false);
    setPlatformAccountDraft({ full_name: "", phone: "" });
    setPlatformAccountStatus("");
  }, []);

  const savePlatformAccountInfo = useCallback(async () => {
    const fullName = String(platformAccountDraft.full_name || "").trim();
    const phone = String(platformAccountDraft.phone || "").trim();
    if (!fullName) {
      setPlatformAccountStatus("Enter your name before saving.");
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_account_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to save account information changes.",
      onBlocked: setPlatformAccountStatus,
    });
    if (!checkpointApproved) return;

    setPlatformAccountSaving(true);
    setPlatformAccountStatus("");
    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: fullName,
        name: fullName,
        phone,
      },
    });
    setPlatformAccountSaving(false);
    if (error) {
      setPlatformAccountStatus(String(error?.message || "Could not save your account information."));
      return;
    }

    setSessionActorName(fullName);
    setSessionPhone(phone);
    setPlatformAccountDraft({ full_name: fullName, phone });
    setPlatformAccountEditMode(false);
    setPlatformAccountStatus("Account information saved.");
  }, [platformAccountDraft.full_name, platformAccountDraft.phone, requirePlatformSecurityCheckpoint]);

  const closeChangePasswordModal = useCallback(() => {
    setChangePasswordOpen(false);
    setChangePasswordDraft({
      current_password: "",
      new_password: "",
      confirm_new_password: "",
    });
    setShowChangePasswordNew(false);
    setShowChangePasswordConfirm(false);
    setShowChangePasswordCurrent(false);
    setChangePasswordError("");
    setChangePasswordSaving(false);
  }, []);

  const savePlatformPassword = useCallback(async () => {
    const email = String(sessionEmail || "").trim().toLowerCase();
    const currentPassword = String(changePasswordDraft.current_password || "");
    const nextPassword = String(changePasswordDraft.new_password || "");
    const confirmPassword = String(changePasswordDraft.confirm_new_password || "");

    if (!email) {
      setChangePasswordError("No account email is available for this session.");
      return;
    }
    if (!currentPassword) {
      setChangePasswordError("Enter your current password.");
      return;
    }
    if (!nextPassword) {
      setChangePasswordError("Enter a new password.");
      return;
    }
    if (nextPassword !== confirmPassword) {
      setChangePasswordError("New passwords do not match.");
      return;
    }
    if (currentPassword === nextPassword) {
      setChangePasswordError("Choose a new password that is different from your current password.");
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_account_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to update your account password.",
      onBlocked: setChangePasswordError,
    });
    if (!checkpointApproved) return;

    setChangePasswordSaving(true);
    setChangePasswordError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) {
      setChangePasswordSaving(false);
      setChangePasswordError("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
    setChangePasswordSaving(false);
    if (updateError) {
      setChangePasswordError(String(updateError?.message || "Could not update your password."));
      return;
    }

    closeChangePasswordModal();
    setPlatformAccountStatus("Password updated.");
  }, [changePasswordDraft.confirm_new_password, changePasswordDraft.current_password, changePasswordDraft.new_password, closeChangePasswordModal, requirePlatformSecurityCheckpoint, sessionEmail]);

  const closePlatformTeamAddModal = useCallback(() => {
    setPlatformTeamManagementView("list");
    setPlatformTeamAssignmentMode("existing");
    setPlatformUserSearchQuery("");
    setPlatformUserSearchResults([]);
    setPlatformInviteForm({ first_name: "", last_name: "", email: "", phone: "" });
    setPlatformTeamForm((prev) => ({
      user_id: "",
      role: prev.role || String(assignablePlatformRoles?.[0]?.role || "platform_staff"),
    }));
  }, [assignablePlatformRoles]);

  const openPlatformTeamAddModal = useCallback(() => {
    setPlatformTeamStatus("");
    setPlatformTeamAssignmentMode("existing");
    setPlatformUserSearchQuery("");
    setPlatformUserSearchResults([]);
    setPlatformInviteForm({ first_name: "", last_name: "", email: "", phone: "" });
    setPlatformTeamForm((prev) => ({
      user_id: "",
      role: prev.role || String(assignablePlatformRoles?.[0]?.role || "platform_staff"),
    }));
    setPlatformTeamManagementView("add");
  }, [assignablePlatformRoles]);

  const openAddTenantStep = useCallback(() => {
    if (!canCreateOrganizations) {
      setStatus((prev) => ({ ...prev, tenant: "You need the Organizations edit permission to create an organization." }));
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
  }, [canCreateOrganizations]);

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

  const openOrganizationSwitcher = useCallback(() => {
    setControlPlaneSection("organizations");
    setControlPlanePage("manage-organizations");
    setOpenControlPlaneDropdown("");
    setEntryStep("start");
    setTenantSearch("");
    setIsEditingTenant(false);
    setIsEditingProfile(false);
    setTenantUsersManagementView("list");
    setTenantRoleManagementView("list");
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

  const openLeadDetailPage = useCallback((leadId) => {
    const key = String(leadId || "").trim();
    if (!key) return;
    setSelectedLeadId(key);
    setControlPlaneSection("organizations");
    setControlPlanePage("lead-detail");
    setOpenControlPlaneDropdown("");
  }, []);

  const searchPlatformUsers = useCallback(async (event) => {
    event.preventDefault();
    if (!canManageTenantUsers) {
      setStatus((prev) => ({ ...prev, users: "You need the Users edit permission to search organization accounts from this control plane." }));
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
  }, [canManageTenantUsers, invokePlatformUserAdmin, userSearchQuery]);

  const searchPlatformTeamUsers = useCallback(async (event) => {
    event.preventDefault();
    if (!canManagePlatformUsers) {
      setPlatformTeamStatus("You need the Users edit permission to manage the internal platform team.");
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
  }, [canManagePlatformUsers, invokePlatformUserAdmin, platformUserSearchQuery]);

  const assignPlatformRole = useCallback(async () => {
    if (!canManagePlatformUsers) {
      setPlatformTeamStatus("You need the Users edit permission to assign platform roles.");
      return;
    }
    const userId = String(platformTeamForm.user_id || "").trim();
    const role = String(platformTeamForm.role || "").trim();
    if (!userId || !role) {
      setPlatformTeamStatus("Select an account and choose a platform role.");
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_team_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to assign a platform team role.",
      onBlocked: setPlatformTeamStatus,
    });
    if (!checkpointApproved) return;
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
  }, [canManagePlatformUsers, loadPlatformTeamAssignments, platformTeamForm.role, platformTeamForm.user_id, requirePlatformSecurityCheckpoint, sessionUserId]);

  const createAndAssignPlatformUser = useCallback(async (event) => {
    event.preventDefault();
    if (!canManagePlatformUsers) {
      setPlatformTeamStatus("You need the Users edit permission to manage the internal platform team.");
      return;
    }

    const role = String(platformTeamForm.role || "").trim().toLowerCase() || String(assignablePlatformRoles?.[0]?.role || "platform_staff");
    const first_name = String(platformInviteForm.first_name || "").trim();
    const last_name = String(platformInviteForm.last_name || "").trim();
    const email = String(platformInviteForm.email || "").trim().toLowerCase();
    const phone = String(platformInviteForm.phone || "").trim();

    if (!role || !first_name || !last_name || !email) {
      setPlatformTeamStatus("First name, last name, email, and platform role are required.");
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_team_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to add a platform team member.",
      onBlocked: setPlatformTeamStatus,
    });
    if (!checkpointApproved) return;

    const { data, error } = await invokePlatformUserAdmin({
      action: "invite_platform_and_assign",
      role,
      first_name,
      last_name,
      email,
      phone,
    });

    if (error) {
      setPlatformTeamStatus(statusText(error, ""));
      return;
    }

    const inviteSent = data?.inviteSent === true;
    setPlatformInviteForm({ first_name: "", last_name: "", email: "", phone: "" });
    setPlatformTeamForm((prev) => ({ ...prev, user_id: "", role }));
    setPlatformTeamAssignmentMode("existing");
    setPlatformUserSearchQuery(email);
    setPlatformUserSearchResults([]);
    setPlatformTeamStatus(
      inviteSent
        ? `Created account invitation for ${email} and assigned ${platformRoleLabelByKey[role] || platformRoleToLabel(role)}.`
        : `Assigned ${platformRoleLabelByKey[role] || platformRoleToLabel(role)} to existing account ${email}.`
    );
    closePlatformTeamAddModal();
    await refreshControlPlaneData();
  }, [assignablePlatformRoles, canManagePlatformUsers, closePlatformTeamAddModal, invokePlatformUserAdmin, platformInviteForm, platformRoleLabelByKey, platformTeamForm.role, refreshControlPlaneData, requirePlatformSecurityCheckpoint]);

  const removePlatformRole = useCallback(async (row) => {
    if (!canRemovePlatformUsers) {
      setPlatformTeamStatus("You need the Users delete permission to remove platform roles.");
      return;
    }
    const userId = String(row?.user_id || "").trim();
    const role = String(row?.role || "").trim();
    if (!userId || !role) return;
    if (role === "platform_owner" && String(userId) === String(sessionUserId)) {
      setPlatformTeamStatus("You cannot remove your own Platform Owner role from this screen.");
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_team_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to remove a platform team member.",
      onBlocked: setPlatformTeamStatus,
    });
    if (!checkpointApproved) return;
    setPlatformTeamDeleteLoading(true);
    const { error } = await supabase
      .from("platform_user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", role);
    setPlatformTeamDeleteLoading(false);
    if (error) {
      setPlatformTeamStatus(statusText(error, ""));
      return;
    }
    setPlatformTeamDeleteConfirmRow(null);
    setPlatformTeamStatus("Platform role removed.");
    await loadPlatformTeamAssignments();
  }, [canRemovePlatformUsers, loadPlatformTeamAssignments, requirePlatformSecurityCheckpoint, sessionUserId]);

  const savePlatformRoleEdit = useCallback(async (row) => {
    if (!canManagePlatformUsers) {
      setPlatformTeamStatus("You need the Users edit permission to change platform roles.");
      return;
    }
    const userId = String(row?.user_id || "").trim();
    const previousRole = String(row?.role || "").trim();
    const nextRole = String(editingPlatformAssignmentRole || "").trim();
    if (!userId || !previousRole || !nextRole) {
      setPlatformTeamStatus("Select a valid platform role.");
      return;
    }
    if (previousRole === nextRole) {
      setEditingPlatformAssignmentKey("");
      setEditingPlatformAssignmentRole("");
      return;
    }
    if (previousRole === "platform_owner" && String(userId) === String(sessionUserId)) {
      setPlatformTeamStatus("You cannot edit your own Platform Owner role from this screen.");
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_team_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to update a platform team role.",
      onBlocked: setPlatformTeamStatus,
    });
    if (!checkpointApproved) return;

    const { error: deleteError } = await supabase
      .from("platform_user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", previousRole);
    if (deleteError) {
      setPlatformTeamStatus(statusText(deleteError, ""));
      return;
    }

    const { error: insertError } = await supabase
      .from("platform_user_roles")
      .upsert([{ user_id: userId, role: nextRole, status: "active", assigned_by: sessionUserId }], { onConflict: "user_id,role" });
    if (insertError) {
      setPlatformTeamStatus(statusText(insertError, ""));
      return;
    }

    setEditingPlatformAssignmentKey("");
    setEditingPlatformAssignmentRole("");
    setPlatformTeamStatus("Platform role updated.");
    await loadPlatformTeamAssignments();
  }, [canManagePlatformUsers, editingPlatformAssignmentRole, loadPlatformTeamAssignments, requirePlatformSecurityCheckpoint, sessionUserId]);

  const createPlatformRole = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!canManagePlatformRoles) {
      setPlatformRoleStatus("You need the Roles edit permission to create PCP roles.");
      return;
    }

    const role_label = toOrganizationLanguage(String(platformRoleForm.role_label || "").trim());
    const role = sanitizeRoleKey(role_label);
    if (!role_label || !role) {
      setPlatformRoleStatus("Role name is required.");
      return;
    }
    if (sortedPlatformRoleDefinitions.some((row) => String(row?.role || "") === role)) {
      setPlatformRoleStatus(`${role_label} already exists.`);
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_role_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to create a PCP role.",
      onBlocked: setPlatformRoleStatus,
    });
    if (!checkpointApproved) return;

    const { error } = await invokePlatformRoleAdmin({
      action: "create_role",
      role,
      role_label,
    });
    if (error) {
      setPlatformRoleStatus(statusText(error, ""));
      return;
    }

    setPlatformRoleForm({ role: "", role_label: "" });
    setSelectedPlatformRoleKey(role);
    setPlatformRoleStatus(`Created PCP role ${role_label}.`);
    setPlatformRoleAddModalOpen(false);
    await loadPlatformRoleConfig();
  }, [canManagePlatformRoles, invokePlatformRoleAdmin, loadPlatformRoleConfig, platformRoleForm, requirePlatformSecurityCheckpoint, sortedPlatformRoleDefinitions]);

  const removePlatformRoleDefinition = useCallback(async (row) => {
    if (!canDeletePlatformRoles) {
      setPlatformRoleStatus("You need the Roles delete permission to remove PCP roles.");
      return;
    }
    const role = String(row?.role || "").trim().toLowerCase();
    if (!role) return;
    if (row?.is_system === true) {
      setPlatformRoleStatus("System platform roles cannot be removed.");
      return;
    }
    const assignmentCount = Number(platformRoleAssignmentCounts?.[role] || 0);
    if (assignmentCount > 0) {
      setPlatformRoleStatus(`Remove or reassign ${assignmentCount} platform assignment(s) for ${role} before deleting it.`);
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_role_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to delete a PCP role.",
      onBlocked: setPlatformRoleStatus,
    });
    if (!checkpointApproved) return;

    setPlatformRoleDeleteLoading(true);
    const { error } = await invokePlatformRoleAdmin({
      action: "delete_role",
      role,
    });
    setPlatformRoleDeleteLoading(false);
    if (error) {
      setPlatformRoleStatus(statusText(error, ""));
      return;
    }

    setPlatformRoleDeleteConfirmOpen(false);
    setPlatformRoleEditMode(false);
    setPlatformRoleStatus(`Removed PCP role ${role}.`);
    await loadPlatformRoleConfig();
    await loadPlatformTeamAssignments();
  }, [canDeletePlatformRoles, invokePlatformRoleAdmin, loadPlatformRoleConfig, loadPlatformTeamAssignments, platformRoleAssignmentCounts, requirePlatformSecurityCheckpoint]);

  const savePlatformRolePermissions = useCallback(async () => {
    if (!canManagePlatformRoles) {
      setPlatformRoleStatus("You need the Roles edit permission to update PCP role permissions.");
      return;
    }
    const role = String(selectedPlatformRoleKey || "").trim().toLowerCase();
    if (!role) {
      setPlatformRoleStatus("Select a PCP role first.");
      return;
    }

    const permissions = Object.fromEntries(
      DEFAULT_PLATFORM_PERMISSION_KEYS.map((permission_key) => [permission_key, Boolean(platformRolePermissionDraft?.[permission_key])])
    );
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_role_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to save PCP role permissions.",
      onBlocked: setPlatformRoleStatus,
    });
    if (!checkpointApproved) return;

    const { error } = await invokePlatformRoleAdmin({
      action: "save_permissions",
      role,
      permissions,
    });
    if (error) {
      setPlatformRoleStatus(statusText(error, ""));
      return;
    }

    setPlatformRolePermissionDirty(false);
    setPlatformRoleStatus(`Saved permissions for ${role}.`);
    await loadPlatformRoleConfig();
  }, [canManagePlatformRoles, invokePlatformRoleAdmin, loadPlatformRoleConfig, platformRolePermissionDraft, requirePlatformSecurityCheckpoint, selectedPlatformRoleKey]);

  const savePlatformSecurityPin = useCallback(async () => {
    if (!sessionUserId) {
      setPlatformSecurityStatus("Sign in again and retry.");
      return;
    }
    if (!canManagePlatformSecurity) {
      setPlatformSecurityStatus("You need the Security edit permission to update your PIN.");
      return;
    }

    const currentPin = String(platformSecurityPinDraft.current_pin || "").trim();
    const accountPassword = String(platformSecurityPinDraft.account_password || "");
    const pin = String(platformSecurityPinDraft.pin || "").trim();
    const confirmPin = String(platformSecurityPinDraft.confirm_pin || "").trim();
    const existingPinHash = String(platformSecurityPinMeta.pin_hash || "").trim();
    const hasExistingPin = Boolean(existingPinHash);
    if (!/^\d{4}$/.test(pin)) {
      setPlatformSecurityStatus("Use a 4-digit PIN.");
      return;
    }
    if (pin !== confirmPin) {
      setPlatformSecurityStatus("PIN and confirmation do not match.");
      return;
    }

    if (hasExistingPin) {
      if (!currentPin && !accountPassword) {
        setPlatformSecurityStatus("Enter your current PIN or your account password to change this PIN.");
        return;
      }

      let verified = false;
      if (currentPin) {
        const currentPinHash = await hashSecurityPin(sessionUserId, currentPin);
        verified = currentPinHash === existingPinHash;
      }

      if (!verified && accountPassword) {
        const email = String(sessionEmail || "").trim().toLowerCase();
        if (!email) {
          setPlatformSecurityStatus("No account email is available for password verification.");
          return;
        }
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: accountPassword,
        });
        if (!signInError) {
          verified = true;
        }
      }

      if (!verified) {
        setPlatformSecurityStatus("Current PIN or account password is incorrect.");
        return;
      }
    }

    setPlatformSecuritySaving((prev) => ({ ...prev, pin: true }));
    setPlatformSecurityStatus("");
    const pin_hash = await hashSecurityPin(sessionUserId, pin);
    const { error } = await supabase
      .from("platform_user_security_profiles")
      .upsert([{
        user_id: sessionUserId,
        pin_hash,
        pin_enabled: true,
        updated_by: cleanOptional(sessionUserId),
      }], { onConflict: "user_id" });
    setPlatformSecuritySaving((prev) => ({ ...prev, pin: false }));
    if (error) {
      if (isMissingRelationError(error)) {
        setPlatformSecurityStatus("Security PIN tables are not available in this environment yet. Apply the latest Supabase migrations, then try saving your PIN again.");
        return;
      }
      setPlatformSecurityStatus(statusText(error, ""));
      return;
    }

    setPlatformSecurityPinDraft({
      ...DEFAULT_PLATFORM_SECURITY_PIN_DRAFT,
    });
    await loadPlatformSecurityConfig();
    setPlatformSecurityPinEditMode(false);
    setShowPlatformSecurityPin(false);
    setShowPlatformSecurityPinConfirm(false);
    setShowPlatformSecurityCurrentPin(false);
    setShowPlatformSecurityAccountPassword(false);
    setPlatformSecurityStatus("Security PIN saved.");
  }, [
    canManagePlatformSecurity,
    platformSecurityPinDraft.account_password,
    platformSecurityPinDraft.confirm_pin,
    platformSecurityPinDraft.current_pin,
    platformSecurityPinDraft.pin,
    platformSecurityPinMeta.pin_hash,
    loadPlatformSecurityConfig,
    sessionEmail,
    sessionUserId,
  ]);

  const savePlatformSecurityChecks = useCallback(async () => {
    if (!canManagePlatformSecurity) {
      setPlatformSecurityStatus("You need the Security edit permission to update checkpoint rules.");
      return;
    }

    setPlatformSecuritySaving((prev) => ({ ...prev, checks: true }));
    setPlatformSecurityStatus("");
    const { error } = await supabase
      .from("platform_security_settings")
      .upsert([{
        config_key: "default",
        ...platformSecuritySettingsDraft,
        updated_by: cleanOptional(sessionUserId),
      }], { onConflict: "config_key" });
    setPlatformSecuritySaving((prev) => ({ ...prev, checks: false }));
    if (error) {
      setPlatformSecurityStatus(statusText(error, ""));
      return;
    }

    setPlatformSecuritySettingsSaved(platformSecuritySettingsDraft);
    setPlatformSecurityChecksEditMode(false);
    setPlatformSecurityStatus("Security checkpoints saved.");
  }, [canManagePlatformSecurity, platformSecuritySettingsDraft, sessionUserId]);

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
    if (!canEditLead) {
      setLeadStatus("You need the Leads edit permission to update leads.");
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
    const currentStatus = String(leadRow?.status || "new").trim() || "new";
    if (payload.status !== currentStatus) {
      const checkpointApproved = await requirePlatformSecurityCheckpoint({
        settingKey: "require_pin_for_report_state_changes",
        title: "Enter Security PIN",
        description: "Enter your PIN to change a lead status.",
        onBlocked: setLeadStatus,
      });
      if (!checkpointApproved) return;
    }
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
  }, [canEditLead, leadDraftById, loadClientLeads, requirePlatformSecurityCheckpoint]);

  const createPlatformLead = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!canEditLead) {
      setLeadStatus("You need the Leads edit permission to create leads.");
      return;
    }

    const payload = {
      full_name: String(leadForm.full_name || "").trim(),
      work_email: String(leadForm.work_email || "").trim().toLowerCase(),
      city_agency: String(leadForm.city_agency || "").trim(),
      role_title: String(leadForm.role_title || "").trim(),
      priority_domain: String(leadForm.priority_domain || "other").trim().toLowerCase() || "other",
      notes: String(leadForm.notes || "").trim() || null,
      status: String(leadForm.status || "new").trim().toLowerCase() || "new",
      source: "pcp",
      ip_hash: await hashLeadFingerprint(`pcp:${sessionUserId || "platform"}:${leadForm.work_email}`),
      email_hash: await hashLeadFingerprint(leadForm.work_email),
      user_agent: "pcp-manual-entry",
    };

    if (!payload.full_name || !payload.work_email || !payload.city_agency || !payload.role_title) {
      setLeadStatus("Name, work email, organization, and role/title are required.");
      return;
    }

    setLeadLoading(true);
    const { error } = await supabase.from("client_leads").insert([payload]);
    setLeadLoading(false);
    if (error) {
      setLeadStatus(statusText(error, ""));
      return;
    }

    setLeadForm({
      full_name: "",
      work_email: "",
      city_agency: "",
      role_title: "",
      priority_domain: "potholes",
      notes: "",
      status: "new",
    });
    setLeadAddModalOpen(false);
    setLeadStatus(`Created a new lead for ${payload.city_agency}.`);
    await loadClientLeads();
  }, [canEditLead, leadForm, sessionUserId, loadClientLeads]);

  const createAndAssignTenantUser = useCallback(async (event) => {
    event.preventDefault();
    if (!canManageTenantUsers) {
      setStatus((prev) => ({ ...prev, users: "You need the Users edit permission to create organization users from this control plane." }));
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
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_organization_user_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to create or assign an organization user.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, users: message })),
    });
    if (!checkpointApproved) return;

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
    setTenantUsersManagementView("list");
    await refreshControlPlaneData();
  }, [canManageTenantUsers, selectedTenantKey, assignForm.role, assignableTenantRoles, inviteForm, invokePlatformUserAdmin, logAudit, refreshControlPlaneData, requirePlatformSecurityCheckpoint]);

  useEffect(() => {
    let cancelled = false;
    async function checkPlatformAdmin() {
      if (!authReady || !sessionUserId) {
        setIsPlatformAdmin(false);
        setPlatformAccessRole("");
        setPlatformAccessRoles([]);
        setPlatformAccessPermissionKeys([]);
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
        setPlatformAccessRoles([]);
        setPlatformAccessPermissionKeys([]);
        return;
      }
      if (legacyAdminError && !isMissingRoleTableError(legacyAdminError)) {
        setIsPlatformAdmin(false);
        setPlatformAccessRole("");
        setPlatformAccessRoles([]);
        setPlatformAccessPermissionKeys([]);
        return;
      }

      const roles = Array.isArray(platformRoleResult?.data) ? platformRoleResult.data : [];
      const normalizedRoleKeys = [...new Set(
        roles
          .map((row) => String(row?.role || "").trim().toLowerCase())
          .filter(Boolean),
      )];
      const hasOwner = normalizedRoleKeys.includes("platform_owner");
      const hasStaff = normalizedRoleKeys.includes("platform_staff");
      const hasLegacyAdmin = Boolean(legacyAdminResult?.data?.user_id);
      const primaryRole = hasOwner
        ? "platform_owner"
        : hasLegacyAdmin
          ? "legacy_admin"
          : hasStaff
            ? "platform_staff"
            : normalizedRoleKeys[0] || "";

      if (hasLegacyAdmin) {
        setIsPlatformAdmin(true);
        setPlatformAccessRole(primaryRole || "legacy_admin");
        setPlatformAccessRoles(normalizedRoleKeys);
        setPlatformAccessPermissionKeys(DEFAULT_PLATFORM_PERMISSION_KEYS);
        return;
      }

      if (!normalizedRoleKeys.length) {
        setIsPlatformAdmin(false);
        setPlatformAccessRole("");
        setPlatformAccessRoles([]);
        setPlatformAccessPermissionKeys([]);
        return;
      }

      const [roleDefinitionsResult, rolePermissionsResult] = await Promise.all([
        supabase
          .from("platform_role_definitions")
          .select("role,active")
          .in("role", normalizedRoleKeys),
        supabase
          .from("platform_role_permissions")
          .select("role,permission_key,allowed")
          .eq("allowed", true)
          .in("role", normalizedRoleKeys),
      ]);

      if (cancelled) return;

      const roleConfigError = roleDefinitionsResult.error || rolePermissionsResult.error;
      if (roleConfigError && !isMissingRoleTableError(roleConfigError)) {
        setIsPlatformAdmin(false);
        setPlatformAccessRole("");
        setPlatformAccessRoles([]);
        setPlatformAccessPermissionKeys([]);
        return;
      }

      let permissionKeys = [];
      if (roleConfigError && isMissingRoleTableError(roleConfigError)) {
        if (hasOwner) permissionKeys = DEFAULT_PLATFORM_PERMISSION_KEYS;
        else if (hasStaff) {
          permissionKeys = DEFAULT_PLATFORM_ROLE_PERMISSIONS
            .filter((row) => row.role === "platform_staff" && row.allowed)
            .map((row) => row.permission_key);
        }
      } else {
        const activeRoleSet = new Set(
          (Array.isArray(roleDefinitionsResult.data) ? roleDefinitionsResult.data : [])
            .filter((row) => row?.active !== false)
            .map((row) => String(row?.role || "").trim().toLowerCase())
            .filter(Boolean),
        );
        permissionKeys = [...new Set(
          (Array.isArray(rolePermissionsResult.data) ? rolePermissionsResult.data : [])
            .filter((row) => row?.allowed !== false && activeRoleSet.has(String(row?.role || "").trim().toLowerCase()))
            .map((row) => String(row?.permission_key || "").trim().toLowerCase())
            .filter(Boolean),
        )];
      }

      setIsPlatformAdmin(permissionKeys.length > 0);
      setPlatformAccessRole(primaryRole);
      setPlatformAccessRoles(normalizedRoleKeys);
      setPlatformAccessPermissionKeys(permissionKeys);
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
    if (!isPlatformAdmin) return;
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
  }, [canAccessControlPlanePage, controlPlanePage, controlPlaneSection, isPlatformAdmin]);

  useEffect(() => {
    if (!availableTenantWorkspaceTabs.length) return;
    if (!availableTenantWorkspaceTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab(availableTenantWorkspaceTabs[0].key);
    }
  }, [activeTab, availableTenantWorkspaceTabs]);

  useEffect(() => {
    if (!tenantOptions.length) return;
    if (!tenantOptions.includes(selectedTenantKey)) {
      setSelectedTenantKey(tenantOptions[0]);
    }
  }, [tenantOptions, selectedTenantKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set(CONTROL_PLANE_ROUTE_QUERY_KEYS.section, controlPlaneSection);
    params.set(CONTROL_PLANE_ROUTE_QUERY_KEYS.page, controlPlanePage);
    params.set(CONTROL_PLANE_ROUTE_QUERY_KEYS.entry, entryStep);

    if (entryStep === "tenant") {
      const tenantKey = sanitizeTenantKey(selectedTenantKey);
      if (tenantKey) {
        params.set(CONTROL_PLANE_ROUTE_QUERY_KEYS.tenant, tenantKey);
      } else {
        params.delete(CONTROL_PLANE_ROUTE_QUERY_KEYS.tenant);
      }
      params.set(CONTROL_PLANE_ROUTE_QUERY_KEYS.tab, activeTab);
    } else {
      params.delete(CONTROL_PLANE_ROUTE_QUERY_KEYS.tenant);
      params.delete(CONTROL_PLANE_ROUTE_QUERY_KEYS.tab);
    }

    if (entryStep === "add") {
      params.set(CONTROL_PLANE_ROUTE_QUERY_KEYS.addStep, addTenantStep);
    } else {
      params.delete(CONTROL_PLANE_ROUTE_QUERY_KEYS.addStep);
    }

    if (controlPlanePage === "lead-detail" && selectedLeadId) {
      params.set(CONTROL_PLANE_ROUTE_QUERY_KEYS.lead, selectedLeadId);
    } else {
      params.delete(CONTROL_PLANE_ROUTE_QUERY_KEYS.lead);
    }

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [controlPlaneSection, controlPlanePage, entryStep, selectedTenantKey, activeTab, addTenantStep, selectedLeadId]);

  useEffect(() => {
    if (!sortedPlatformRoleDefinitions.some((row) => String(row?.role || "") === String(selectedPlatformRoleKey || ""))) {
      setSelectedPlatformRoleKey(String(sortedPlatformRoleDefinitions?.[0]?.role || "platform_owner"));
    }
  }, [sortedPlatformRoleDefinitions, selectedPlatformRoleKey]);

  useEffect(() => {
    if (!selectedPlatformRoleKey) {
      setPlatformRolePermissionDraft({});
      setPlatformRolePermissionDirty(false);
      setPlatformRoleEditMode(false);
      return;
    }
    const nextDraft = {};
    for (const permissionKey of DEFAULT_PLATFORM_PERMISSION_KEYS) {
      nextDraft[permissionKey] = Boolean(platformRolePermissionMap[`${selectedPlatformRoleKey}:${permissionKey}`]);
    }
    setPlatformRolePermissionDraft(nextDraft);
    setPlatformRolePermissionDirty(false);
    setPlatformRoleEditMode(false);
  }, [selectedPlatformRoleKey, platformRolePermissionMap]);

  useEffect(() => {
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
    setDeleteLoading(false);
  }, [selectedTenantKey]);

  useEffect(() => {
    setEditingDomainKey("");
    setEditingDomainSnapshot(null);
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
    for (const d of manageableTenantDomainRows) {
      const assignment = selectedTenantDomainAssignments?.[d.key] || null;
      const configured = String(visibility?.[d.key] || "").trim().toLowerCase();
      if (assignment) {
        nextVisibility[d.key] = assignment.active !== false && String(assignment.visibility || "enabled").trim().toLowerCase() !== "disabled"
          ? "enabled"
          : "disabled";
        continue;
      }
      if (configured === "public") {
        nextVisibility[d.key] = "enabled";
        continue;
      }
      nextVisibility[d.key] = "disabled";
    }
    setDomainVisibilityForm(nextVisibility);

    const configuredDomainSettings = tenantDomainConfigsByTenant?.[key] || {};
    const tenantIssueTypes = tenantDomainIssueTypesByTenant?.[key] || {};
    const nextDomainConfig = initialDomainConfigForm();
    for (const d of manageableTenantDomainRows) {
      const configured = configuredDomainSettings?.[d.key] || null;
      const assignment = selectedTenantDomainAssignments?.[d.key] || null;
      const fallbackNotification = d.key === "potholes"
        ? String(selectedTenant?.notification_email_potholes || "")
        : d.key === "water_drain_issues"
          ? String(selectedTenant?.notification_email_water_drain || "")
          : "";
      const templatePreset = domainNotificationTemplateOption(assignment?.notification_template_key);
      const hasAssignmentDisclosureConfig = Boolean(
        assignment && Object.prototype.hasOwnProperty.call(assignment, "report_disclosures")
      );
      const domainIconSrc = String(d?.icon_src || d?.iconSrc || "").trim();
        nextDomainConfig[d.key] = {
        domain_type: String(configured?.domain_type || defaultDomainType(d.key)).trim().toLowerCase() || defaultDomainType(d.key),
        display_label: String(assignment?.display_label || defaultDomainLabel(d.key)).trim() || defaultDomainLabel(d.key),
        marker_color: sanitizeHexColor(assignment?.marker_color, defaultDomainMarkerColor(d.key)),
        icon_render_mode: normalizeDomainIconRenderMode(
          assignment?.icon_render_mode,
          domainIconSrc
        ),
        icon_tint_mode: normalizeDomainIconTintMode(assignment?.icon_tint_mode),
        icon_tint_color: normalizeDomainIconTintColor(assignment?.icon_tint_color, ""),
        notification_email: String(assignment?.notification_email || configured?.notification_email || fallbackNotification).trim(),
        notification_template_key: templatePreset.key,
        notification_subject_template: String(assignment?.notification_subject_template || templatePreset.subject || ""),
        notification_body_template: String(assignment?.notification_body_template || templatePreset.body || ""),
        organization_monitored_repairs: typeof assignment?.organization_monitored_repairs === "boolean"
          ? assignment.organization_monitored_repairs
          : configured?.organization_monitored_repairs !== false,
        public_visibility_min_reports: sanitizePositiveIntegerSetting(
          assignment?.public_visibility_min_reports ?? configured?.public_visibility_min_reports,
          defaultDomainPublicVisibilityMinReports(d.key),
          { min: 1, max: 25 }
        ),
          high_confidence_min_reports: sanitizePositiveIntegerSetting(
            assignment?.high_confidence_min_reports ?? configured?.high_confidence_min_reports,
            defaultDomainHighConfidenceMinReports(d.key),
            { min: 1, max: 25 }
          ),
        type_options: mergeTenantDomainTypeOptions({
          domainKey: d.key,
          assignmentTypeOptions: assignment?.type_options,
          registryTypeOptions: d?.type_options,
          legacyIssueTypes: tenantIssueTypes?.[d.key] || [],
        }),
        report_disclosures: hasAssignmentDisclosureConfig
          ? normalizeDomainDisclosureRows(assignment?.report_disclosures, d.key)
          : defaultDomainDisclosures(d.key),
      };
    }
    setDomainConfigForm(nextDomainConfig);

    const features = tenantMapFeaturesByTenant?.[key] || null;
    setMapFeaturesForm(buildMapFeaturesForm(features));
    setMapFeaturesEditMode(false);
    setMapFeaturesSnapshot(null);

    void loadTenantFiles(key).catch((error) => {
      setStatus((prev) => ({ ...prev, files: statusText(error, "") }));
    });
    void loadTenantRoleConfig(key).catch((error) => {
      setStatus((prev) => ({ ...prev, roles: statusText(error, "") }));
    });
    void loadAudit(key).catch((error) => {
      setStatus((prev) => ({ ...prev, audit: statusText(error, "") }));
    });
  }, [selectedTenantKey, selectedTenant, tenantProfilesByTenant, tenantVisibilityByTenant, tenantDomainConfigsByTenant, tenantDomainIssueTypesByTenant, tenantMapFeaturesByTenant, selectedTenantDomainAssignments, manageableTenantDomainRows, loadTenantFiles, loadTenantRoleConfig, loadAudit]);

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
    if (!assignablePlatformRoles.length) return;
    if (!assignablePlatformRoles.some((row) => String(row?.role || "") === String(platformTeamForm.role || ""))) {
      setPlatformTeamForm((prev) => ({ ...prev, role: String(assignablePlatformRoles[0]?.role || "platform_staff") }));
    }
  }, [assignablePlatformRoles, platformTeamForm.role]);

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

  useEffect(() => {
    if (!selectedLeadId && leadRows?.length) {
      setSelectedLeadId(String(leadRows[0]?.id || ""));
      return;
    }
    if (selectedLeadId && !leadRows.some((row) => String(row?.id || "") === String(selectedLeadId))) {
      setSelectedLeadId(String(leadRows?.[0]?.id || ""));
    }
  }, [leadRows, selectedLeadId]);

  useEffect(() => {
    if (!activeSettingsGroupKey) return;
    setOpenControlPlaneSettingsGroups((prev) => ({ ...prev, [activeSettingsGroupKey]: true }));
  }, [activeSettingsGroupKey]);

  useEffect(() => {
    if (activeSettingsGroupKey) {
      setMobileSettingsGroupKey(activeSettingsGroupKey);
      return;
    }
    if (filteredControlPlaneSettingsNav[0]?.key) {
      setMobileSettingsGroupKey(filteredControlPlaneSettingsNav[0].key);
    }
  }, [activeSettingsGroupKey, filteredControlPlaneSettingsNav]);

  useEffect(() => {
    if (controlPlanePage === "manage-team") {
      setPlatformTeamManagementView("list");
    }
  }, [controlPlanePage]);

  useEffect(() => {
    if (controlPlanePage !== "security-checks" && controlPlanePage !== "account-info") return;
    void loadPlatformSecurityConfig();
  }, [controlPlanePage, loadPlatformSecurityConfig]);

  useEffect(() => {
    if (controlPlanePage !== "manage-leads") {
      setLeadFiltersOpen(true);
    }
    if (controlPlanePage !== "lead-detail") {
      setSelectedLeadId("");
    }
  }, [controlPlanePage]);

  useEffect(() => {
    if (activeTab !== "users") {
      setTenantUsersManagementView("list");
      setUserAssignmentMode("existing");
    }
    if (activeTab !== "roles") {
      setTenantRoleManagementView("list");
      setTenantRoleEditMode(false);
    }
    if (activeTab !== "contacts") {
      setIsEditingProfile(false);
      setEditingPrimaryContact(false);
      setEditingAdditionalContactIndex(null);
      setContactAddModalOpen(false);
      setNewContactForm(emptyAdditionalContact());
      setContactDeleteConfirmIndex(null);
      setContactDeleteLoading(false);
    }
    if (activeTab !== "files") {
      setTenantAssetsManagementView("list");
    }
    if (activeTab !== "domains") {
      setEditingDomainKey("");
      setEditingDomainSnapshot(null);
      setMapFeaturesEditMode(false);
      setMapFeaturesSnapshot(null);
    }
    if (activeTab !== "organization") {
      setEditingOrganizationSection("");
    }
  }, [activeTab]);

  const persistTenantRecord = useCallback(async ({ tenantKeyOverride, checkpointSettingKey = "", checkpointDescription = "" } = {}) => {
    if (!canEditTenantSetup) {
      setStatus((prev) => ({ ...prev, tenant: "You need the Organizations edit permission to create or modify organization records." }));
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
      resident_portal_enabled: true,
      is_pilot: Boolean(tenantForm.is_pilot),
      active: Boolean(tenantForm.active),
    };

    if (!payload.tenant_key || !payload.name || !payload.primary_subdomain) {
      setStatus((prev) => ({ ...prev, tenant: "Tenant key, name, and primary subdomain are required." }));
      return { ok: false, tenantKey: "" };
    }
    if (checkpointSettingKey) {
      const checkpointApproved = await requirePlatformSecurityCheckpoint({
        settingKey: checkpointSettingKey,
        title: "Enter Security PIN",
        description: checkpointDescription || "Enter your PIN to save organization information changes.",
        onBlocked: (message) => setStatus((prev) => ({ ...prev, tenant: message })),
      });
      if (!checkpointApproved) {
        return { ok: false, tenantKey: payload.tenant_key };
      }
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
  }, [canEditTenantSetup, entryStep, requirePlatformSecurityCheckpoint, selectedTenantKey, tenantForm, logAudit]);

  const persistTenantProfileRecord = useCallback(async ({ tenantKeyOverride, profileFormOverride, checkpointSettingKey = "", checkpointDescription = "" } = {}) => {
    const key = tenantKeyOverride
      ? sanitizeTenantKey(tenantKeyOverride)
      : entryStep === "add"
        ? sanitizeTenantKey(tenantForm.tenant_key)
        : sanitizeTenantKey(selectedTenantKey);
    const profileDraft = profileFormOverride || profileForm;
    if (entryStep === "add") {
      // onboarding saves the profile after the tenant record exists
    }
    if (!canEditTenantSetup) {
      setStatus((prev) => ({ ...prev, profile: "You need the Organizations edit permission to update organization profile details." }));
      return { ok: false };
    }
    if (!key) {
      setStatus((prev) => ({ ...prev, profile: "Select a tenant first." }));
      return { ok: false };
    }
    if (!String(profileDraft.legal_name || "").trim()) {
      setStatus((prev) => ({ ...prev, profile: "Legal organization name is required." }));
      return { ok: false };
    }
    if (!String(profileDraft.contact_primary_email || "").trim()) {
      setStatus((prev) => ({ ...prev, profile: "Primary contact email is required." }));
      return { ok: false };
    }
    if (checkpointSettingKey) {
      const checkpointApproved = await requirePlatformSecurityCheckpoint({
        settingKey: checkpointSettingKey,
        title: "Enter Security PIN",
        description: checkpointDescription || "Enter your PIN to save organization changes.",
        onBlocked: (message) => setStatus((prev) => ({ ...prev, profile: message })),
      });
      if (!checkpointApproved) return { ok: false };
    }

    const additionalContacts = normalizeAdditionalContacts(profileDraft.additional_contacts);

    const payload = {
      tenant_key: key,
      organization_type: String(profileDraft.organization_type || "municipality").trim() || "municipality",
      legal_name: cleanOptional(profileDraft.legal_name),
      display_name: cleanOptional(profileDraft.display_name),
      mailing_address: cleanOptional(composeMailingAddress(profileDraft)),
      mailing_address_1: cleanOptional(profileDraft.mailing_address_1),
      mailing_address_2: cleanOptional(profileDraft.mailing_address_2),
      mailing_city: cleanOptional(profileDraft.mailing_city),
      mailing_state: cleanOptional(profileDraft.mailing_state),
      mailing_zip: cleanOptional(profileDraft.mailing_zip),
      website_url: cleanOptional(profileDraft.website_url),
      url_extension: cleanOptional(profileDraft.url_extension),
      billing_email: cleanOptional(profileDraft.billing_email),
      timezone: String(profileDraft.timezone || "America/New_York").trim() || "America/New_York",
      contact_primary_name: cleanOptional(profileDraft.contact_primary_name),
      contact_primary_title: cleanOptional(profileDraft.contact_primary_title),
      contact_primary_email: cleanOptional(profileDraft.contact_primary_email),
      contact_primary_phone: cleanOptional(profileDraft.contact_primary_phone),
      contact_technical_name: null,
      contact_technical_email: null,
      contact_technical_phone: null,
      contact_legal_name: null,
      contact_legal_email: null,
      contact_legal_phone: null,
      additional_contacts: additionalContacts,
      contract_status: String(profileDraft.contract_status || "pending").trim() || "pending",
      contract_start_date: cleanOptional(profileDraft.contract_start_date),
      contract_end_date: cleanOptional(profileDraft.contract_end_date),
      renewal_date: cleanOptional(profileDraft.renewal_date),
      notes: cleanOptional(profileDraft.notes),
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
  }, [canEditTenantSetup, entryStep, profileForm, requirePlatformSecurityCheckpoint, selectedTenantKey, tenantForm.tenant_key, logAudit]);

  const saveTenant = useCallback(async (event) => {
    event.preventDefault();
    const result = await persistTenantRecord({
      checkpointSettingKey: entryStep === "tenant" ? "require_pin_for_organization_info_changes" : "",
      checkpointDescription: "Enter your PIN to save organization information changes.",
    });
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
    setDeleteConfirmOpen(false);
    setDeleteConfirmText("");
    setIsEditingTenant(false);
  }, [selectedTenant]);

  const resetProfileDraft = useCallback(() => {
    const key = sanitizeTenantKey(selectedTenantKey);
    setProfileForm(profileRowToForm(tenantProfilesByTenant?.[key] || null));
    setIsEditingProfile(false);
    setEditingOrganizationSection("");
    setEditingPrimaryContact(false);
    setEditingAdditionalContactIndex(null);
    setContactAddModalOpen(false);
    setNewContactForm(emptyAdditionalContact());
    setContactDeleteConfirmIndex(null);
    setContactDeleteLoading(false);
  }, [selectedTenantKey, tenantProfilesByTenant]);

  const saveTenantProfile = useCallback(async (event) => {
    event?.preventDefault?.();
    const result = await persistTenantProfileRecord({
      checkpointSettingKey: entryStep === "tenant" ? "require_pin_for_organization_info_changes" : "",
      checkpointDescription: "Enter your PIN to save organization information changes.",
    });
    if (!result.ok) return;
    setIsEditingProfile(false);
    setEditingOrganizationSection("");
    await refreshControlPlaneData();
  }, [entryStep, persistTenantProfileRecord, refreshControlPlaneData]);

  const saveContactsProfile = useCallback(async ({ profileFormOverride } = {}) => {
    const result = await persistTenantProfileRecord({
      profileFormOverride,
      checkpointSettingKey: entryStep === "tenant" ? "require_pin_for_contact_changes" : "",
      checkpointDescription: "Enter your PIN to save points of contact changes.",
    });
    if (!result.ok) return false;
    setIsEditingProfile(false);
    setEditingPrimaryContact(false);
    setEditingAdditionalContactIndex(null);
    setContactAddModalOpen(false);
    setNewContactForm(emptyAdditionalContact());
    setContactDeleteConfirmIndex(null);
    setContactDeleteLoading(false);
    await refreshControlPlaneData();
    return true;
  }, [entryStep, persistTenantProfileRecord, refreshControlPlaneData]);

  const addAdditionalContactFromContactsPage = useCallback(() => {
    if (!canEditTenantSetup) return;
    setIsEditingProfile(false);
    setEditingPrimaryContact(false);
    setEditingAdditionalContactIndex(null);
    setNewContactForm(emptyAdditionalContact());
    setContactAddModalOpen(true);
  }, [canEditTenantSetup]);

  const saveAdditionalContactFromModal = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!canEditTenantSetup) return;
    const nextContact = emptyAdditionalContact(newContactForm);
    if (!hasAdditionalContactValue(nextContact)) {
      setStatus((prev) => ({ ...prev, profile: "Add at least one contact detail before saving." }));
      return;
    }
    const nextProfileForm = {
      ...profileForm,
      additional_contacts: [
        ...(Array.isArray(profileForm.additional_contacts) ? profileForm.additional_contacts : []),
        nextContact,
      ],
    };
    const saved = await saveContactsProfile({ profileFormOverride: nextProfileForm });
    if (saved) {
      setProfileForm(nextProfileForm);
      setContactAddModalOpen(false);
      setNewContactForm(emptyAdditionalContact());
    }
  }, [canEditTenantSetup, newContactForm, profileForm, saveContactsProfile]);

  const removeAdditionalContactAndSave = useCallback(async (index) => {
    const nextProfileForm = {
      ...profileForm,
      additional_contacts: (Array.isArray(profileForm.additional_contacts) ? profileForm.additional_contacts : []).filter((_, rowIndex) => rowIndex !== index),
    };
    const saved = await saveContactsProfile({ profileFormOverride: nextProfileForm });
    if (saved) {
      setProfileForm(nextProfileForm);
    }
  }, [profileForm, saveContactsProfile]);

  const confirmAdditionalContactDelete = useCallback(async () => {
    if (!canEditTenantSetup) return;
    if (contactDeleteConfirmIndex == null) return;
    setContactDeleteLoading(true);
    await removeAdditionalContactAndSave(contactDeleteConfirmIndex);
    setContactDeleteLoading(false);
  }, [canEditTenantSetup, contactDeleteConfirmIndex, removeAdditionalContactAndSave]);

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
    if (!canDeleteTenant) {
      setStatus((prev) => ({ ...prev, tenant: "You need the Organizations delete permission to schedule organization deletion." }));
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
  }, [canDeleteTenant, deleteConfirmText, refreshControlPlaneData, selectedTenant, selectedTenantKey, sessionUserId, logAudit]);

  const cancelOrganizationDeletion = useCallback(async () => {
    if (!canDeleteTenant) {
      setStatus((prev) => ({ ...prev, tenant: "You need the Organizations delete permission to cancel organization deletion." }));
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
  }, [canDeleteTenant, logAudit, refreshControlPlaneData, selectedTenant, selectedTenantKey, selectedTenantPendingDeletion, sessionUserId]);

  const beginCreateDomainDefinition = useCallback(() => {
    if (!canManageDomainRegistry) return;
    setEditingDomainDefinitionKey("");
    setExpandedDomainRegistryCardKey("");
    setDomainRegistryForm(initialDomainRegistryForm());
    setDomainRegistryEditorOpen(true);
    setStatus((prev) => ({ ...prev, domainRegistry: "" }));
  }, [canManageDomainRegistry]);

  const beginEditDomainDefinition = useCallback((domainKey) => {
    if (!canManageDomainRegistry) return;
    const key = String(domainKey || "").trim().toLowerCase();
    const row = domainRegistryRows.find((entry) => entry.key === key);
    if (!row) return;
    setEditingDomainDefinitionKey(key);
    setExpandedDomainRegistryCardKey(key);
    setDomainRegistryForm(buildDomainRegistryForm(row));
    setDomainRegistryEditorOpen(true);
    setStatus((prev) => ({ ...prev, domainRegistry: "" }));
  }, [canManageDomainRegistry, domainRegistryRows]);

  const cancelDomainDefinitionEditor = useCallback(() => {
    setEditingDomainDefinitionKey("");
    setDomainRegistryForm(initialDomainRegistryForm());
    setDomainRegistryEditorOpen(false);
    setStatus((prev) => ({ ...prev, domainRegistry: "" }));
  }, []);

  const updateMapUiIconDraftSrc = useCallback((iconKey, value) => {
    const key = String(iconKey || "").trim();
    if (!key) return;
    setMapUiIconDraftForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev?.[key] || {}),
        src: value,
      },
    }));
  }, []);

  const updateMapUiIconDraftRenderMode = useCallback((iconKey, value) => {
    const key = String(iconKey || "").trim();
    if (!key) return;
    setMapUiIconDraftForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev?.[key] || {}),
        render_mode: String(value || MAP_UI_ICON_RENDER_MODE.RASTER).trim(),
      },
    }));
  }, []);

  const updateMapUiIconDraftTintColor = useCallback((iconKey, tintKey, value) => {
    const key = String(iconKey || "").trim();
    const tintField = String(tintKey || "").trim();
    if (!key || !["light_tint_color", "dark_tint_color"].includes(tintField)) return;
    setMapUiIconDraftForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev?.[key] || {}),
        [tintField]: value,
      },
    }));
  }, []);

  const updateMapUiIconDraftEnabled = useCallback((iconKey, enabled) => {
    const key = String(iconKey || "").trim();
    if (!key) return;
    setMapUiIconDraftForm((prev) => ({
      ...prev,
      [key]: {
        ...(prev?.[key] || {}),
        enabled: enabled !== false,
      },
    }));
  }, []);

  const updateMapUiThemeDraftValue = useCallback((mode, fieldKey, value) => {
    const modeKey = String(mode || "").trim().toLowerCase();
    const resolvedFieldKey = String(fieldKey || "").trim();
    if (!["light", "dark"].includes(modeKey)) return;
    if (!MAP_UI_THEME_FIELDS.some((field) => field.key === resolvedFieldKey)) return;
    setMapUiThemeDraftForm((prev) => ({
      ...prev,
      [modeKey]: {
        ...(prev?.[modeKey] || {}),
        [resolvedFieldKey]: value,
      },
    }));
  }, []);

  const updateMapUiThemeDraftPicker = useCallback((mode, fieldKey, nextHex, nextAlphaPercent) => {
    const modeKey = String(mode || "").trim().toLowerCase();
    const resolvedFieldKey = String(fieldKey || "").trim();
    if (!["light", "dark"].includes(modeKey)) return;
    if (!MAP_UI_THEME_FIELDS.some((field) => field.key === resolvedFieldKey)) return;
    const fallback = MAP_UI_ICON_THEME_DEFAULTS?.[modeKey]?.[resolvedFieldKey] || "#111111";
    const currentValue = String(mapUiThemeDraftForm?.[modeKey]?.[resolvedFieldKey] || fallback).trim();
    const currentPicker = parseCssColorToPickerValue(currentValue, fallback);
    const safeHex = String(nextHex || currentPicker.hex || "#111111").trim() || "#111111";
    const safeAlpha = clampToRange(nextAlphaPercent, 0, 100, currentPicker.alphaPercent);
    updateMapUiThemeDraftValue(modeKey, resolvedFieldKey, rgbaStringFromHex(safeHex, safeAlpha));
  }, [mapUiThemeDraftForm, updateMapUiThemeDraftValue]);

  const openNewMapUiThemeEditor = useCallback(() => {
    if (!canManageDomainRegistry) return;
    setStatus((prev) => ({ ...prev, mapUiTheme: "" }));
    setMapUiThemeEditorDraft(buildMapUiThemeLibraryEntry({
      id: createMapUiThemeRecordId(),
      name: createUniqueMapUiThemeName("New Theme", mapUiThemeDraftThemes),
      is_default: false,
      deployment_state: "draft",
      created_at: new Date().toISOString(),
    }));
    setMapUiThemeEditorOpen(true);
  }, [canManageDomainRegistry, mapUiThemeDraftThemes]);

  const openMapUiThemeEditor = useCallback((themeId) => {
    const targetId = String(themeId || "").trim();
    if (!targetId) return;
    const theme = mapUiThemeDraftThemes.find((entry) => String(entry?.id || "").trim() === targetId);
    if (!theme) return;
    if (theme.is_default && !isPlatformOwner) {
      setStatus((prev) => ({ ...prev, mapUiTheme: "Only PCP super users can edit the default theme." }));
      return;
    }
    setStatus((prev) => ({ ...prev, mapUiTheme: "" }));
    setMapUiThemeEditorDraft(buildMapUiThemeLibraryEntry(theme));
    setMapUiThemeEditorOpen(true);
  }, [isPlatformOwner, mapUiThemeDraftThemes]);

  const duplicateMapUiTheme = useCallback((themeId) => {
    const targetId = String(themeId || "").trim();
    if (!targetId) return;
    const theme = mapUiThemeDraftThemes.find((entry) => String(entry?.id || "").trim() === targetId);
    if (!theme || theme?.is_default) return;
    const duplicateName = createUniqueMapUiThemeName(theme?.name || "Theme", mapUiThemeDraftThemes);
    setStatus((prev) => ({ ...prev, mapUiTheme: "" }));
    setMapUiThemeEditorDraft(buildMapUiThemeLibraryEntry({
      ...theme,
      id: createMapUiThemeRecordId(),
      name: duplicateName,
      deployment_state: "draft",
      created_at: new Date().toISOString(),
      updated_at: "",
    }));
    setMapUiThemeEditorOpen(true);
  }, [mapUiThemeDraftThemes]);

  const closeMapUiThemeEditor = useCallback(() => {
    setMapUiThemeEditorOpen(false);
    setMapUiThemeEditorDraft(null);
    setStatus((prev) => ({ ...prev, mapUiTheme: "" }));
  }, []);

  const updateMapUiThemeEditorMeta = useCallback((fieldKey, value) => {
    const resolvedFieldKey = String(fieldKey || "").trim();
    if (!["name", "start_at", "end_at"].includes(resolvedFieldKey)) return;
    setMapUiThemeEditorDraft((prev) => (
      prev
        ? {
            ...prev,
            [resolvedFieldKey]: prev.is_default && (resolvedFieldKey === "start_at" || resolvedFieldKey === "end_at")
              ? ""
              : value,
          }
        : prev
    ));
  }, []);

  const updateMapUiThemeEditorValue = useCallback((mode, fieldKey, value) => {
    const modeKey = String(mode || "").trim().toLowerCase();
    const resolvedFieldKey = String(fieldKey || "").trim();
    if (!["light", "dark"].includes(modeKey)) return;
    if (!MAP_UI_THEME_FIELDS.some((field) => field.key === resolvedFieldKey)) return;
    setMapUiThemeEditorDraft((prev) => (
      prev
        ? {
            ...prev,
            themeForm: {
              ...(prev.themeForm || {}),
              [modeKey]: {
                ...((prev.themeForm || {})?.[modeKey] || {}),
                [resolvedFieldKey]: value,
              },
            },
          }
        : prev
    ));
  }, []);

  const updateMapUiThemeEditorPicker = useCallback((mode, fieldKey, nextHex, nextAlphaPercent) => {
    const modeKey = String(mode || "").trim().toLowerCase();
    const resolvedFieldKey = String(fieldKey || "").trim();
    if (!["light", "dark"].includes(modeKey)) return;
    if (!MAP_UI_THEME_FIELDS.some((field) => field.key === resolvedFieldKey)) return;
    const fallback = MAP_UI_ICON_THEME_DEFAULTS?.[modeKey]?.[resolvedFieldKey] || "#111111";
    const currentValue = String(mapUiThemeEditorDraft?.themeForm?.[modeKey]?.[resolvedFieldKey] || fallback).trim();
    const currentPicker = parseCssColorToPickerValue(currentValue, fallback);
    const safeHex = String(nextHex || currentPicker.hex || "#111111").trim() || "#111111";
    const safeAlpha = clampToRange(nextAlphaPercent, 0, 100, currentPicker.alphaPercent);
    updateMapUiThemeEditorValue(modeKey, resolvedFieldKey, rgbaStringFromHex(safeHex, safeAlpha));
  }, [mapUiThemeEditorDraft, updateMapUiThemeEditorValue]);

  const saveMapUiThemeEditor = useCallback(async ({ publish = false } = {}) => {
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, mapUiTheme: "You need the Domains edit permission to manage map UI themes." }));
      return { ok: false };
    }
    if (!mapUiThemeEditorDraft) {
      setStatus((prev) => ({ ...prev, mapUiTheme: "Open a theme before saving." }));
      return { ok: false };
    }
    if (mapUiThemeEditorDraft.is_default && !isPlatformOwner) {
      setStatus((prev) => ({ ...prev, mapUiTheme: "Only PCP super users can edit the default theme." }));
      return { ok: false };
    }

    if (publish) {
      setMapUiThemePublishing(true);
    } else {
      setMapUiThemeSavingDraft(true);
    }
    setStatus((prev) => ({ ...prev, mapUiTheme: "" }));

    try {
      const nowIso = new Date().toISOString();
      const trimmedName = String(mapUiThemeEditorDraft?.name || "").trim();
      if (!trimmedName) {
        setStatus((prev) => ({ ...prev, mapUiTheme: "Enter a theme name before saving." }));
        return { ok: false };
      }
      const duplicateName = mapUiThemeDraftThemes.some((entry) => (
        String(entry?.id || "").trim() !== String(mapUiThemeEditorDraft?.id || "").trim()
        && String(entry?.name || "").trim().toLowerCase() === trimmedName.toLowerCase()
      ));
      if (duplicateName) {
        setStatus((prev) => ({ ...prev, mapUiTheme: `${trimmedName} already exists. Use a unique theme name.` }));
        return { ok: false };
      }

      const nextTheme = buildMapUiThemeLibraryEntry({
        ...mapUiThemeEditorDraft,
        name: trimmedName,
        deployment_state: publish
          ? "published"
          : normalizeMapUiThemeDeploymentState(mapUiThemeEditorDraft?.deployment_state, mapUiThemeEditorDraft?.is_default ? "published" : "draft"),
        created_at: String(mapUiThemeEditorDraft?.created_at || nowIso).trim() || nowIso,
        updated_at: nowIso,
      });
      if (hasInvalidMapUiThemeDateWindow(nextTheme)) {
        setStatus((prev) => ({ ...prev, mapUiTheme: `${trimmedName} must end after it starts.` }));
        return { ok: false };
      }
      const themeOverride = extractMapUiThemeFromForm(nextTheme.themeForm || {});
      const nextThemes = (() => {
        const replaced = mapUiThemeDraftThemes.map((entry) => (
          String(entry?.id || "").trim() === String(nextTheme?.id || "").trim()
            ? nextTheme
            : entry
        ));
        if (replaced.some((entry) => String(entry?.id || "").trim() === String(nextTheme?.id || "").trim())) {
          return replaced;
        }
        return [replaced.find((entry) => entry?.is_default) || buildMapUiThemeLibraryEntry({ id: MAP_UI_THEME_DEFAULT_THEME_ID, is_default: true, name: "Default Theme", deployment_state: "published" }), ...replaced.filter((entry) => !entry?.is_default), nextTheme];
      })();

      if (!nextTheme.is_default && publish) {
        const startAt = fromLocalDateTimeInputValue(nextTheme.start_at);
        const endAt = fromLocalDateTimeInputValue(nextTheme.end_at);
        if (!startAt || !endAt) {
          setStatus((prev) => ({ ...prev, mapUiTheme: `Choose both a start and end date for ${trimmedName} before publishing.` }));
          return { ok: false };
        }
        if (!Object.keys(themeOverride).length) {
          setStatus((prev) => ({ ...prev, mapUiTheme: `Set at least one theme color override for ${trimmedName} before publishing.` }));
          return { ok: false };
        }
      }

      const conflicts = findMapUiThemeDateConflicts(nextTheme, nextThemes);
      if (publish && conflicts.length) {
        const conflictNames = conflicts.map((entry) => entry.name).join(", ");
        setStatus((prev) => ({ ...prev, mapUiTheme: `${trimmedName} conflicts with ${conflictNames}. Adjust the effective dates before publishing.` }));
        return { ok: false };
      }

      const draftThemesPayload = serializeMapUiThemeDraftLibrary(nextThemes);
      const draftValue = buildMapUiThemeConfigValue(
        { themes: draftThemesPayload },
        {
          saved_at: nowIso,
          saved_by: sessionUserId || null,
        }
      );
      const draftResult = await supabase
        .from("app_config")
        .upsert([{ key: MAP_UI_THEME_DRAFT_CONFIG_KEY, value: draftValue }], { onConflict: "key" });
      if (draftResult.error) {
        setStatus((prev) => ({ ...prev, mapUiTheme: statusText(draftResult.error, "") }));
        return { ok: false };
      }

      const normalizedDraftThemes = normalizeMapUiThemeLibraryDrafts(draftValue, mapUiThemePublishedConfig);
      setMapUiThemeDraftConfig(draftValue);
      setMapUiThemeDraftThemes(normalizedDraftThemes);
      const nextDefaultTheme = normalizedDraftThemes.find((entry) => entry?.is_default);
      setMapUiThemeDraftForm(buildMapUiThemeDraftForm(nextDefaultTheme?.themeForm || nextDefaultTheme?.theme || {}));
      setMapUiThemeEditorDraft(buildMapUiThemeLibraryEntry(nextTheme));

      if (publish) {
        const publishedValue = buildMapUiThemeConfigValue(
          { themes: serializePublishedMapUiThemeLibrary(nextThemes) },
          {
            published_at: nowIso,
            published_by: sessionUserId || null,
            source_saved_at: draftValue.saved_at,
          }
        );
        const publishResult = await supabase
          .from("app_config")
          .upsert([{ key: MAP_UI_THEME_PUBLISHED_CONFIG_KEY, value: publishedValue }], { onConflict: "key" });
        if (publishResult.error) {
          setStatus((prev) => ({ ...prev, mapUiTheme: statusText(publishResult.error, "") }));
          return { ok: false };
        }
        setMapUiThemePublishedConfig(publishedValue);
        setMapUiThemePublishedThemes(normalizeMapUiThemeLibraryDrafts(publishedValue, publishedValue));
        setMapUiThemeEditorOpen(false);
        setMapUiThemeEditorDraft(null);
        setStatus((prev) => ({ ...prev, mapUiTheme: "Saved the draft and published the selected map UI theme." }));
      } else {
        setStatus((prev) => ({ ...prev, mapUiTheme: "Saved the map UI theme draft." }));
      }

      return { ok: true };
    } finally {
      setMapUiThemeSavingDraft(false);
      setMapUiThemePublishing(false);
    }
  }, [canManageDomainRegistry, isPlatformOwner, mapUiThemeDraftThemes, mapUiThemeEditorDraft, mapUiThemePublishedConfig, sessionUserId]);

  const deleteMapUiTheme = useCallback(async (themeId) => {
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, mapUiTheme: "You need the Domains edit permission to manage map UI themes." }));
      return;
    }
    const targetId = String(themeId || "").trim();
    if (!targetId) return;
    const targetTheme = mapUiThemeDraftThemes.find((entry) => String(entry?.id || "").trim() === targetId);
    if (!targetTheme || targetTheme?.is_default) return;
    if (typeof window !== "undefined" && !window.confirm(`Delete ${targetTheme.name}?`)) return;

    setMapUiThemeSavingDraft(true);
    setStatus((prev) => ({ ...prev, mapUiTheme: "" }));
    try {
      const nowIso = new Date().toISOString();
      const nextThemes = mapUiThemeDraftThemes.filter((entry) => String(entry?.id || "").trim() !== targetId);
      const draftValue = buildMapUiThemeConfigValue(
        { themes: serializeMapUiThemeDraftLibrary(nextThemes) },
        {
          saved_at: nowIso,
          saved_by: sessionUserId || null,
        }
      );
      const publishedValue = buildMapUiThemeConfigValue(
        { themes: serializePublishedMapUiThemeLibrary(nextThemes) },
        {
          published_at: nowIso,
          published_by: sessionUserId || null,
          source_saved_at: nowIso,
        }
      );
      const [{ error: draftError }, { error: publishError }] = await Promise.all([
        supabase.from("app_config").upsert([{ key: MAP_UI_THEME_DRAFT_CONFIG_KEY, value: draftValue }], { onConflict: "key" }),
        supabase.from("app_config").upsert([{ key: MAP_UI_THEME_PUBLISHED_CONFIG_KEY, value: publishedValue }], { onConflict: "key" }),
      ]);
      if (draftError || publishError) {
        setStatus((prev) => ({ ...prev, mapUiTheme: statusText(draftError || publishError, "") }));
        return;
      }
      const normalizedDraftThemes = normalizeMapUiThemeLibraryDrafts(draftValue, publishedValue);
      setMapUiThemeDraftConfig(draftValue);
      setMapUiThemePublishedConfig(publishedValue);
      setMapUiThemeDraftThemes(normalizedDraftThemes);
      setMapUiThemePublishedThemes(normalizeMapUiThemeLibraryDrafts(publishedValue, publishedValue));
      const nextDefaultTheme = normalizedDraftThemes.find((entry) => entry?.is_default);
      setMapUiThemeDraftForm(buildMapUiThemeDraftForm(nextDefaultTheme?.themeForm || nextDefaultTheme?.theme || {}));
      if (String(mapUiThemeEditorDraft?.id || "").trim() === targetId) {
        setMapUiThemeEditorOpen(false);
        setMapUiThemeEditorDraft(null);
      }
      setStatus((prev) => ({ ...prev, mapUiTheme: `Deleted ${targetTheme.name}.` }));
    } finally {
      setMapUiThemeSavingDraft(false);
    }
  }, [canManageDomainRegistry, mapUiThemeDraftThemes, mapUiThemeEditorDraft, sessionUserId]);

  const resetMapUiThemeLibraryToPublished = useCallback(async () => {
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, mapUiTheme: "You need the Domains edit permission to manage map UI themes." }));
      return;
    }
    setMapUiThemeSavingDraft(true);
    setStatus((prev) => ({ ...prev, mapUiTheme: "" }));
    try {
      const nowIso = new Date().toISOString();
      const publishedThemeLibrary = normalizeMapUiThemeLibraryDrafts(mapUiThemePublishedConfig, mapUiThemePublishedConfig);
      const draftValue = buildMapUiThemeConfigValue(
        { themes: serializeMapUiThemeDraftLibrary(publishedThemeLibrary) },
        {
          saved_at: nowIso,
          saved_by: sessionUserId || null,
        }
      );
      const { error } = await supabase
        .from("app_config")
        .upsert([{ key: MAP_UI_THEME_DRAFT_CONFIG_KEY, value: draftValue }], { onConflict: "key" });
      if (error) {
        setStatus((prev) => ({ ...prev, mapUiTheme: statusText(error, "") }));
        return;
      }
      setMapUiThemeDraftConfig(draftValue);
      setMapUiThemeDraftThemes(publishedThemeLibrary);
      const nextDefaultTheme = publishedThemeLibrary.find((entry) => entry?.is_default);
      setMapUiThemeDraftForm(buildMapUiThemeDraftForm(nextDefaultTheme?.themeForm || nextDefaultTheme?.theme || {}));
      setMapUiThemeEditorOpen(false);
      setMapUiThemeEditorDraft(null);
      setStatus((prev) => ({ ...prev, mapUiTheme: "Reset the draft theme library back to the currently published themes." }));
    } finally {
      setMapUiThemeSavingDraft(false);
    }
  }, [canManageDomainRegistry, mapUiThemePublishedConfig, sessionUserId]);

  const addMapUiThemeScheduleDraft = useCallback(() => {
    const nextEntry = createMapUiThemeScheduleDraft({});
    setMapUiThemeSchedulesDraft((prev) => [...prev, nextEntry]);
    setMapUiThemeExpandedScheduleId(nextEntry.id);
  }, []);

  const removeMapUiThemeScheduleDraft = useCallback((scheduleId) => {
    const targetId = String(scheduleId || "").trim();
    if (!targetId) return;
    setMapUiThemeSchedulesDraft((prev) => prev.filter((entry) => entry.id !== targetId));
    setMapUiThemeExpandedScheduleId((prev) => (prev === targetId ? "" : prev));
  }, []);

  const updateMapUiThemeScheduleDraftMeta = useCallback((scheduleId, fieldKey, value) => {
    const targetId = String(scheduleId || "").trim();
    const resolvedFieldKey = String(fieldKey || "").trim();
    if (!targetId) return;
    if (!["label", "start_at", "end_at", "enabled"].includes(resolvedFieldKey)) return;
    setMapUiThemeSchedulesDraft((prev) => prev.map((entry) => (
      entry.id !== targetId
        ? entry
        : {
            ...entry,
            [resolvedFieldKey]: resolvedFieldKey === "enabled" ? value !== false : value,
          }
    )));
  }, []);

  const updateMapUiThemeScheduleDraftValue = useCallback((scheduleId, mode, fieldKey, value) => {
    const targetId = String(scheduleId || "").trim();
    const modeKey = String(mode || "").trim().toLowerCase();
    const resolvedFieldKey = String(fieldKey || "").trim();
    if (!targetId) return;
    if (!["light", "dark"].includes(modeKey)) return;
    if (!MAP_UI_THEME_FIELDS.some((field) => field.key === resolvedFieldKey)) return;
    setMapUiThemeSchedulesDraft((prev) => prev.map((entry) => (
      entry.id !== targetId
        ? entry
        : {
            ...entry,
            themeForm: {
              ...(entry?.themeForm || {}),
              [modeKey]: {
                ...(entry?.themeForm?.[modeKey] || {}),
                [resolvedFieldKey]: value,
              },
            },
          }
    )));
  }, []);

  const updateMapUiThemeScheduleDraftPicker = useCallback((scheduleId, mode, fieldKey, nextHex, nextAlphaPercent) => {
    const targetId = String(scheduleId || "").trim();
    const modeKey = String(mode || "").trim().toLowerCase();
    const resolvedFieldKey = String(fieldKey || "").trim();
    if (!targetId) return;
    if (!["light", "dark"].includes(modeKey)) return;
    if (!MAP_UI_THEME_FIELDS.some((field) => field.key === resolvedFieldKey)) return;
    const scheduleEntry = (mapUiThemeSchedulesDraft || []).find((entry) => entry.id === targetId);
    const fallback = MAP_UI_ICON_THEME_DEFAULTS?.[modeKey]?.[resolvedFieldKey] || "#111111";
    const currentValue = String(scheduleEntry?.themeForm?.[modeKey]?.[resolvedFieldKey] || fallback).trim();
    const currentPicker = parseCssColorToPickerValue(currentValue, fallback);
    const safeHex = String(nextHex || currentPicker.hex || "#111111").trim() || "#111111";
    const safeAlpha = clampToRange(nextAlphaPercent, 0, 100, currentPicker.alphaPercent);
    updateMapUiThemeScheduleDraftValue(targetId, modeKey, resolvedFieldKey, rgbaStringFromHex(safeHex, safeAlpha));
  }, [mapUiThemeSchedulesDraft, updateMapUiThemeScheduleDraftValue]);

  const updateMapUiIconDraftFile = useCallback((iconKey, file) => {
    const key = String(iconKey || "").trim();
    if (!key) return;
    setMapUiIconDraftForm((prev) => {
      const previousPreviewUrl = String(prev?.[key]?.preview_url || "").trim();
      if (previousPreviewUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(previousPreviewUrl);
        } catch {
          // Ignore preview cleanup failures.
        }
      }
      return {
        ...prev,
        [key]: {
          ...(prev?.[key] || {}),
          file: file || null,
          preview_url: file ? URL.createObjectURL(file) : "",
        },
      };
    });
  }, []);

  const persistMapUiIconDraft = useCallback(async ({ publish = false } = {}) => {
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, mapUiIcons: "You need the Domains edit permission to manage map UI icons." }));
      return { ok: false };
    }

    if (publish) {
      setMapUiIconPublishing(true);
    } else {
      setMapUiIconSavingDraft(true);
    }
    setStatus((prev) => ({ ...prev, mapUiIcons: "" }));

    try {
      const nextDraftForm = { ...mapUiIconDraftForm };
      const resolvedIcons = {};

      for (const entry of MAP_UI_ICON_CATALOG) {
        const row = nextDraftForm?.[entry.key] || {};
        const uploadFile = row?.file || null;
        let resolvedSrc = String(row?.src || entry.defaultSrc || "").trim();
        const resolvedRenderMode = String(
          row?.render_mode || entry.defaultRenderMode || MAP_UI_ICON_RENDER_MODE.RASTER
        ).trim();

        if (uploadFile) {
          const mimeType = String(uploadFile.type || "").trim().toLowerCase();
          const fileName = String(uploadFile.name || `${entry.key}-icon`).trim();
          const acceptedType = /^image\/(svg\+xml|png|webp)$/i.test(mimeType) || /\.(svg|png|webp)$/i.test(fileName);
          if (!acceptedType) {
            setStatus((prev) => ({ ...prev, mapUiIcons: `Use an SVG, PNG, or WebP file for ${entry.label}.` }));
            return { ok: false };
          }
          if (Number(uploadFile.size || 0) > MAP_UI_ICON_MAX_BYTES) {
            setStatus((prev) => ({ ...prev, mapUiIcons: `${entry.label} must be 2 MB or smaller.` }));
            return { ok: false };
          }

          const uploadPath = [
            "global",
            "map-ui-icons",
            entry.key,
            toDatePath(new Date()),
            `${Date.now()}_${sanitizeFileNameSegment(fileName)}`,
          ].join("/");
          const { error: uploadError } = await supabase
            .storage
            .from(MAP_UI_ICON_BUCKET)
            .upload(uploadPath, uploadFile, {
              upsert: false,
              contentType: String(uploadFile.type || "application/octet-stream"),
            });
          if (uploadError) {
            setStatus((prev) => ({ ...prev, mapUiIcons: statusText(uploadError, "") }));
            return { ok: false };
          }

          const { data: publicUrlData } = supabase.storage.from(MAP_UI_ICON_BUCKET).getPublicUrl(uploadPath);
          resolvedSrc = String(publicUrlData?.publicUrl || "").trim();
          nextDraftForm[entry.key] = {
            src: resolvedSrc,
            render_mode: resolvedRenderMode,
            light_tint_color: String(row?.light_tint_color || "").trim(),
            dark_tint_color: String(row?.dark_tint_color || "").trim(),
            enabled: row?.enabled !== false,
            file: null,
            preview_url: "",
          };
        }

        if (resolvedSrc) {
          resolvedIcons[entry.key] = {
            src: resolvedSrc,
            render_mode: resolvedRenderMode,
            light_tint_color: String(row?.light_tint_color || "").trim(),
            dark_tint_color: String(row?.dark_tint_color || "").trim(),
            enabled: row?.enabled !== false,
          };
        }
      }

      const draftValue = {
        icons: sanitizeMapUiIconManifest(resolvedIcons),
        saved_at: new Date().toISOString(),
        saved_by: sessionUserId || null,
      };
      const draftResult = await supabase
        .from("app_config")
        .upsert([{ key: MAP_UI_ICON_DRAFT_CONFIG_KEY, value: draftValue }], { onConflict: "key" });
      if (draftResult.error) {
        setStatus((prev) => ({ ...prev, mapUiIcons: statusText(draftResult.error, "") }));
        return { ok: false };
      }

      setMapUiIconDraftConfig(draftValue);
      setMapUiIconDraftForm(buildMapUiIconDraftForm(draftValue));

      if (publish) {
        const publishedValue = {
          icons: draftValue.icons,
          published_at: new Date().toISOString(),
          published_by: sessionUserId || null,
          source_saved_at: draftValue.saved_at,
        };
        const publishResult = await supabase
          .from("app_config")
          .upsert([{ key: MAP_UI_ICON_PUBLISHED_CONFIG_KEY, value: publishedValue }], { onConflict: "key" });
        if (publishResult.error) {
          setStatus((prev) => ({ ...prev, mapUiIcons: statusText(publishResult.error, "") }));
          return { ok: false };
        }
        setMapUiIconPublishedConfig(publishedValue);
        setStatus((prev) => ({ ...prev, mapUiIcons: "Saved the draft and published the full map UI icon set live." }));
      } else {
        setStatus((prev) => ({ ...prev, mapUiIcons: "Saved the map UI icon draft." }));
      }

      return { ok: true };
    } finally {
      setMapUiIconSavingDraft(false);
      setMapUiIconPublishing(false);
    }
  }, [canManageDomainRegistry, mapUiIconDraftForm, sessionUserId]);

  const resetMapUiIconDraftToPublished = useCallback(async () => {
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, mapUiIcons: "You need the Domains edit permission to manage map UI icons." }));
      return;
    }
    setMapUiIconSavingDraft(true);
    setStatus((prev) => ({ ...prev, mapUiIcons: "" }));
    try {
      const publishedIcons = sanitizeMapUiIconManifest(mapUiIconPublishedConfig);
      const draftValue = {
        icons: publishedIcons,
        saved_at: new Date().toISOString(),
        saved_by: sessionUserId || null,
        reset_to_published: true,
      };
      const { error } = await supabase
        .from("app_config")
        .upsert([{ key: MAP_UI_ICON_DRAFT_CONFIG_KEY, value: draftValue }], { onConflict: "key" });
      if (error) {
        setStatus((prev) => ({ ...prev, mapUiIcons: statusText(error, "") }));
        return;
      }
      setMapUiIconDraftConfig(draftValue);
      setMapUiIconDraftForm(buildMapUiIconDraftForm(draftValue));
      setStatus((prev) => ({ ...prev, mapUiIcons: "Reset the draft icon set back to the currently published version." }));
    } finally {
      setMapUiIconSavingDraft(false);
    }
  }, [canManageDomainRegistry, mapUiIconPublishedConfig, sessionUserId]);

  const persistMapUiThemeDraft = useCallback(async ({ publish = false } = {}) => {
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, mapUiTheme: "You need the Domains edit permission to manage the map UI theme." }));
      return { ok: false };
    }

    if (publish) {
      setMapUiThemePublishing(true);
    } else {
      setMapUiThemeSavingDraft(true);
    }
    setStatus((prev) => ({ ...prev, mapUiTheme: "" }));

    try {
      const resolvedTheme = extractMapUiThemeFromForm(mapUiThemeDraftForm);
      const { schedules: resolvedScheduledThemes, error: scheduledThemeError } = validateAndExtractMapUiThemeScheduleDrafts(
        mapUiThemeSchedulesDraft
      );
      if (scheduledThemeError) {
        setStatus((prev) => ({ ...prev, mapUiTheme: scheduledThemeError }));
        return { ok: false };
      }

      const draftValue = buildMapUiThemeConfigValue(
        {
          theme: resolvedTheme,
          theme_enabled: mapUiThemeBaseEnabled,
          scheduled_themes: resolvedScheduledThemes,
        },
        {
          saved_at: new Date().toISOString(),
          saved_by: sessionUserId || null,
        }
      );
      const draftResult = await supabase
        .from("app_config")
        .upsert([{ key: MAP_UI_THEME_DRAFT_CONFIG_KEY, value: draftValue }], { onConflict: "key" });
      if (draftResult.error) {
        setStatus((prev) => ({ ...prev, mapUiTheme: statusText(draftResult.error, "") }));
        return { ok: false };
      }

      const nextScheduleDrafts = buildMapUiThemeScheduleDrafts(draftValue);
      setMapUiThemeDraftConfig(draftValue);
      setMapUiThemeDraftForm(buildMapUiThemeDraftForm(draftValue));
      setMapUiThemeBaseEnabled(isMapUiBaseThemeEnabled(draftValue));
      setMapUiThemeSchedulesDraft(nextScheduleDrafts);
      setMapUiThemeExpandedScheduleId((prev) => (
        nextScheduleDrafts.some((entry) => entry.id === prev) ? prev : nextScheduleDrafts[0]?.id || ""
      ));

      if (publish) {
        const publishedValue = buildMapUiThemeConfigValue(
          {
            theme: resolvedTheme,
            theme_enabled: mapUiThemeBaseEnabled,
            scheduled_themes: resolvedScheduledThemes,
          },
          {
            published_at: new Date().toISOString(),
            published_by: sessionUserId || null,
            source_saved_at: draftValue.saved_at,
          }
        );
        const publishResult = await supabase
          .from("app_config")
          .upsert([{ key: MAP_UI_THEME_PUBLISHED_CONFIG_KEY, value: publishedValue }], { onConflict: "key" });
        if (publishResult.error) {
          setStatus((prev) => ({ ...prev, mapUiTheme: statusText(publishResult.error, "") }));
          return { ok: false };
        }
        setMapUiThemePublishedConfig(publishedValue);
        setStatus((prev) => ({ ...prev, mapUiTheme: "Saved the draft and published the map UI theme live." }));
      } else {
        setStatus((prev) => ({ ...prev, mapUiTheme: "Saved the map UI theme draft." }));
      }

      return { ok: true };
    } finally {
      setMapUiThemeSavingDraft(false);
      setMapUiThemePublishing(false);
    }
  }, [canManageDomainRegistry, mapUiThemeBaseEnabled, mapUiThemeDraftForm, mapUiThemeSchedulesDraft, sessionUserId]);

  const resetMapUiThemeDraftToPublished = useCallback(async () => {
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, mapUiTheme: "You need the Domains edit permission to manage the map UI theme." }));
      return;
    }
    setMapUiThemeSavingDraft(true);
    setStatus((prev) => ({ ...prev, mapUiTheme: "" }));
    try {
      const publishedTheme = sanitizeMapUiTheme(mapUiThemePublishedConfig);
      const publishedThemeSchedules = sanitizeMapUiThemeSchedules(mapUiThemePublishedConfig);
      const draftValue = buildMapUiThemeConfigValue(
        {
          theme: publishedTheme,
          theme_enabled: isMapUiBaseThemeEnabled(mapUiThemePublishedConfig),
          scheduled_themes: publishedThemeSchedules,
        },
        {
          saved_at: new Date().toISOString(),
          saved_by: sessionUserId || null,
          reset_to_published: true,
        }
      );
      const { error } = await supabase
        .from("app_config")
        .upsert([{ key: MAP_UI_THEME_DRAFT_CONFIG_KEY, value: draftValue }], { onConflict: "key" });
      if (error) {
        setStatus((prev) => ({ ...prev, mapUiTheme: statusText(error, "") }));
        return;
      }
      const nextScheduleDrafts = buildMapUiThemeScheduleDrafts(draftValue);
      setMapUiThemeDraftConfig(draftValue);
      setMapUiThemeDraftForm(buildMapUiThemeDraftForm(draftValue));
      setMapUiThemeBaseEnabled(isMapUiBaseThemeEnabled(draftValue));
      setMapUiThemeSchedulesDraft(nextScheduleDrafts);
      setMapUiThemeExpandedScheduleId(nextScheduleDrafts[0]?.id || "");
      setStatus((prev) => ({ ...prev, mapUiTheme: "Reset the draft map UI theme back to the currently published version." }));
    } finally {
      setMapUiThemeSavingDraft(false);
    }
  }, [canManageDomainRegistry, mapUiThemePublishedConfig, sessionUserId]);

  const saveDomainDefinition = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, domainRegistry: "You need the Domains edit permission to manage the global domain registry." }));
      return;
    }

    const label = String(domainRegistryForm?.label || "").trim();
    const key = editingDomainDefinitionKey || slugifyDomainKeyInput(domainRegistryForm?.key || "");
    if (!label) {
      setStatus((prev) => ({ ...prev, domainRegistry: "Enter a domain label before saving." }));
      return;
    }
    if (!key) {
      setStatus((prev) => ({ ...prev, domainRegistry: "Enter a valid domain key before saving." }));
      return;
    }

    const selectedIconMode = String(domainRegistryForm?.icon_selection || "").trim();
    const customIconSrc = String(domainRegistryForm?.custom_icon_src || "").trim();
    const existingIconSrc = String(domainRegistryForm?.icon_src || "").trim();
    let resolvedIconSrc = null;

    if (selectedIconMode === CUSTOM_DOMAIN_ICON_SELECTION) {
      resolvedIconSrc = customIconSrc || null;
    } else if (selectedIconMode === UPLOAD_DOMAIN_ICON_SELECTION) {
      const uploadFile = domainRegistryForm?.icon_file || null;
      if (uploadFile) {
        if (!/^image\/(svg\+xml|png|webp)$/i.test(String(uploadFile.type || ""))) {
          setStatus((prev) => ({ ...prev, domainRegistry: "Use an SVG, PNG, or WebP file for the domain icon." }));
          return;
        }
        if (Number(uploadFile.size || 0) > DOMAIN_ICON_MAX_BYTES) {
          setStatus((prev) => ({ ...prev, domainRegistry: "Domain icons must be 2 MB or smaller." }));
          return;
        }

        const now = Date.now();
        const fileName = sanitizeFileNameSegment(uploadFile.name || `${key}-icon`);
        const path = ["global", "domains", key, toDatePath(new Date()), `${now}_${fileName}`].join("/");
        const contentType = String(uploadFile.type || "application/octet-stream");
        const { error: uploadError } = await supabase
          .storage
          .from("domain-icons")
          .upload(path, uploadFile, { upsert: false, contentType });

        if (uploadError) {
          setStatus((prev) => ({ ...prev, domainRegistry: statusText(uploadError, "") }));
          return;
        }

        const { data: publicUrlData } = supabase.storage.from("domain-icons").getPublicUrl(path);
        resolvedIconSrc = String(publicUrlData?.publicUrl || "").trim() || null;
      } else {
        resolvedIconSrc = existingIconSrc || null;
      }
    }

    const payload = {
      key,
      label,
      description: String(domainRegistryForm?.description || "").trim() || null,
      domain_class: String(domainRegistryForm?.domain_class || "incident_driven").trim().toLowerCase(),
      status: String(domainRegistryForm?.status || "draft").trim().toLowerCase(),
      icon_key: null,
      icon_src: resolvedIconSrc,
      ownership_model: String(domainRegistryForm?.ownership_model || "org_managed").trim().toLowerCase(),
      report_prefix: String(domainRegistryForm?.report_prefix || "").trim().toUpperCase() || null,
      allow_report_images: domainRegistryForm?.allow_report_images === true,
      road_required: domainRegistryForm?.road_required === true,
      type_options: buildStoredDomainTypeOptionConfigs(domainRegistryForm?.type_options, key),
      updated_by: sessionUserId || null,
    };

    if (!payload.report_prefix) {
      setStatus((prev) => ({ ...prev, domainRegistry: "Report Prefix is required. Report numbers use the format <PREFIX>-R<8 digits>." }));
      return;
    }
    if (!/^[A-Z0-9]{1,10}$/.test(String(payload.report_prefix))) {
      setStatus((prev) => ({ ...prev, domainRegistry: "Report Prefix must be 1-10 uppercase letters or numbers with no spaces or punctuation." }));
      return;
    }

    const invalidTypeOption = (Array.isArray(payload.type_options) ? payload.type_options : []).find((row) => {
      const optionLabel = String(row?.option_label || "").trim();
      const choices = Array.isArray(row?.choices) ? row.choices : [];
      return optionLabel && !choices.length;
    });
    if (invalidTypeOption) {
      setStatus((prev) => ({
        ...prev,
        domainRegistry: `${String(invalidTypeOption.option_label || "Type Option").trim()} must include at least one choice before saving.`,
      }));
      return;
    }

    if (!editingDomainDefinitionKey) {
      payload.created_by = sessionUserId || null;
    }

    setDomainRegistrySaving(true);
    setStatus((prev) => ({ ...prev, domainRegistry: "" }));

    const saveResult = editingDomainDefinitionKey
      ? await supabase.from("domain_definitions").update(payload).eq("key", key)
      : await supabase.from("domain_definitions").insert(payload);

    if (saveResult.error) {
      setDomainRegistrySaving(false);
      setStatus((prev) => ({ ...prev, domainRegistry: statusText(saveResult.error, "") }));
      return;
    }

    setDomainRegistrySaving(false);
    cancelDomainDefinitionEditor();
    setStatus((prev) => ({
      ...prev,
      domainRegistry: `${editingDomainDefinitionKey ? "Updated" : "Created"} ${label}.`,
    }));
    await refreshControlPlaneData();
  }, [canManageDomainRegistry, domainRegistryForm, editingDomainDefinitionKey, refreshControlPlaneData, sessionUserId, cancelDomainDefinitionEditor]);

  const archiveDomainDefinition = useCallback(async (domainKey) => {
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, domainRegistry: "You need the Domains edit permission to archive a domain." }));
      return;
    }
    const key = String(domainKey || "").trim().toLowerCase();
    if (!key) return;
    const row = domainRegistryRows.find((entry) => entry.key === key);
    if (!row) return;
    setDomainRegistrySaving(true);
    const { error } = await supabase
      .from("domain_definitions")
      .update({
        status: "archived",
        updated_by: sessionUserId || null,
      })
      .eq("key", key);
    setDomainRegistrySaving(false);
    if (error) {
      setStatus((prev) => ({ ...prev, domainRegistry: statusText(error, "") }));
      return;
    }
    if (editingDomainDefinitionKey === key) {
      cancelDomainDefinitionEditor();
    }
    setStatus((prev) => ({ ...prev, domainRegistry: `Archived ${row.label}.` }));
    await refreshControlPlaneData();
  }, [canManageDomainRegistry, cancelDomainDefinitionEditor, domainRegistryRows, editingDomainDefinitionKey, refreshControlPlaneData, sessionUserId]);

  const beginCreateTenantDomainAssignment = useCallback(() => {
    if (!canManageDomainRegistry) return;
    if (!assignableDomainRegistryRows.length) {
      setStatus((prev) => ({ ...prev, domainAssignments: "All active global domains are already assigned to this organization." }));
      return;
    }
    setEditingTenantDomainAssignmentKey("");
    setExpandedAssignedDomainCardKey("");
    setTenantDomainAssignmentForm({
      ...initialTenantDomainAssignmentForm(),
      domain_key: assignableDomainRegistryRows[0].key,
    });
    setSelectedAssignedDomainSectionKey("tenant-assignment");
    setTenantDomainAssignmentEditorOpen(true);
    setStatus((prev) => ({ ...prev, domainAssignments: "" }));
  }, [assignableDomainRegistryRows, canManageDomainRegistry]);

  const beginEditTenantDomainAssignment = useCallback((domainKey) => {
    if (!canManageDomainRegistry) return;
    const key = String(domainKey || "").trim().toLowerCase();
    const row = selectedTenantDomainAssignments?.[key];
    if (!row) return;
    setEditingTenantDomainAssignmentKey(key);
    setExpandedAssignedDomainCardKey(key);
    setSelectedAssignedDomainKey(key);
    setSelectedAssignedDomainSectionKey("tenant-assignment");
    setTenantDomainAssignmentForm(buildTenantDomainAssignmentForm(row));
    setTenantDomainAssignmentEditorOpen(false);
    setStatus((prev) => ({ ...prev, domainAssignments: "" }));
  }, [canManageDomainRegistry, selectedTenantDomainAssignments]);

  const cancelTenantDomainAssignmentEditor = useCallback(() => {
    setEditingTenantDomainAssignmentKey("");
    setTenantDomainAssignmentForm(initialTenantDomainAssignmentForm());
    setTenantDomainAssignmentEditorOpen(false);
    setStatus((prev) => ({ ...prev, domainAssignments: "" }));
  }, []);

  const saveTenantDomainAssignment = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!canManageDomainRegistry) {
      setStatus((prev) => ({ ...prev, domainAssignments: "You need the Domains edit permission to manage registry-backed tenant assignments." }));
      return;
    }
    const tenantKey = sanitizeTenantKey(selectedTenantKey);
    if (!tenantKey) {
      setStatus((prev) => ({ ...prev, domainAssignments: "Select an organization first." }));
      return;
    }
    const domainKey = String(editingTenantDomainAssignmentKey || tenantDomainAssignmentForm?.domain_key || "").trim().toLowerCase();
    if (!domainKey) {
      setStatus((prev) => ({ ...prev, domainAssignments: "Choose a global domain before saving this assignment." }));
      return;
    }
    const domainDefinition = domainRegistryRows.find((row) => row.key === domainKey) || null;
    if (!domainDefinition) {
      setStatus((prev) => ({ ...prev, domainAssignments: "That global domain could not be found." }));
      return;
    }
    if (String(domainDefinition.status || "").trim().toLowerCase() !== "active") {
      setStatus((prev) => ({ ...prev, domainAssignments: "Only active global domains can be assigned to organizations." }));
      return;
    }
    const payload = {
      tenant_key: tenantKey,
      domain_key: domainKey,
      active: tenantDomainAssignmentForm?.active !== false,
      visibility: String(tenantDomainAssignmentForm?.visibility || "enabled").trim().toLowerCase(),
      notification_email: String(tenantDomainAssignmentForm?.notification_email || "").trim() || null,
      notification_template_key: String(tenantDomainAssignmentForm?.notification_template_key || DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS[0].key).trim().toLowerCase(),
      notification_subject_template: String(tenantDomainAssignmentForm?.notification_subject_template || "").trim() || null,
      notification_body_template: String(tenantDomainAssignmentForm?.notification_body_template || "").trim() || null,
      organization_monitored_repairs: tenantDomainAssignmentForm?.organization_monitored_repairs !== false,
      billing_status: String(tenantDomainAssignmentForm?.billing_status || "not_applicable").trim().toLowerCase(),
      billing_model: String(tenantDomainAssignmentForm?.billing_model || "included").trim().toLowerCase(),
      billing_amount: Number.isFinite(Number(tenantDomainAssignmentForm?.billing_amount))
        ? Number(tenantDomainAssignmentForm.billing_amount)
        : 0,
      billing_notes: String(tenantDomainAssignmentForm?.billing_notes || "").trim() || null,
      updated_by: sessionUserId || null,
    };
    if (payload.active) {
      payload.activated_at = new Date().toISOString();
      payload.activated_by = sessionUserId || null;
    }
    if (!editingTenantDomainAssignmentKey) {
      payload.created_by = sessionUserId || null;
    }

    setTenantDomainAssignmentSaving(true);
    setStatus((prev) => ({ ...prev, domainAssignments: "" }));
    const result = editingTenantDomainAssignmentKey
      ? await supabase
          .from("tenant_domain_assignments")
          .update(payload)
          .eq("tenant_key", tenantKey)
          .eq("domain_key", domainKey)
      : await supabase
          .from("tenant_domain_assignments")
          .insert(payload);
    setTenantDomainAssignmentSaving(false);
    if (result.error) {
      setStatus((prev) => ({ ...prev, domainAssignments: statusText(result.error, "") }));
      return;
    }

    const domainLabel = domainDefinition?.label || domainKey;
    cancelTenantDomainAssignmentEditor();
    pendingAssignedDomainFocusKeyRef.current = domainKey;
    setExpandedAssignedDomainCardKey((prev) => (prev === domainKey ? "" : prev));
    setStatus((prev) => ({
      ...prev,
      domainAssignments: `${editingTenantDomainAssignmentKey ? "Updated" : "Assigned"} ${domainLabel} for ${selectedTenantPublicDisplayName || selectedTenantOrganizationName || tenantKey}.`,
    }));
    await refreshControlPlaneData();
  }, [canManageDomainRegistry, cancelTenantDomainAssignmentEditor, domainRegistryRows, editingTenantDomainAssignmentKey, refreshControlPlaneData, selectedTenantKey, selectedTenantOrganizationName, selectedTenantPublicDisplayName, sessionUserId, tenantDomainAssignmentForm]);

  const saveDomainAndFeatureSettings = useCallback(async (event, options = {}) => {
    event?.preventDefault?.();
    if (!canEditTenantDomains) {
      setStatus((prev) => ({ ...prev, domains: "You need the Domains edit permission to update organization domain settings." }));
      return;
    }
    const key = sanitizeTenantKey(selectedTenantKey);
    if (!key) {
      setStatus((prev) => ({ ...prev, domains: "Select a tenant first." }));
      return;
    }
    const closingDomainKey = String(options?.closeEditingDomain || "").trim().toLowerCase();
    const currentVisibility = closingDomainKey
      ? String(domainVisibilityForm?.[closingDomainKey] || "enabled").trim().toLowerCase()
      : "";
    const snapshotVisibility = closingDomainKey && editingDomainSnapshot?.key === closingDomainKey
      ? String(editingDomainSnapshot?.visibility || "enabled").trim().toLowerCase()
      : "";
    const isDisablingEditedDomain = Boolean(
      closingDomainKey
      && currentVisibility === "disabled"
      && snapshotVisibility !== "disabled"
    );
    if (isDisablingEditedDomain && typeof window !== "undefined") {
      const domainLabel = manageableTenantDomainRowByKey?.[closingDomainKey]?.label || defaultDomainLabel(closingDomainKey) || "this domain";
      const confirmed = window.confirm(
        `Disable ${domainLabel}? It will no longer appear under Enabled Domains until it is added again.`
      );
      if (!confirmed) return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_domain_settings_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to save domain and asset settings.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, domains: message })),
    });
    if (!checkpointApproved) return;

    const persistedDomainRows = activeManageableTenantDomainRows.filter((d) => (
      Boolean(selectedTenantDomainAssignments?.[d.key])
      || String(domainVisibilityForm?.[d.key] || "disabled").trim().toLowerCase() !== "disabled"
      || editingDomainKey === d.key
    ));
    const legacyPersistedDomainRows = persistedDomainRows.filter((d) => isLegacyIncidentEnumDomain(d.key));
    const visibilityRows = legacyPersistedDomainRows.map((d) => ({
      tenant_key: key,
      domain: d.key,
      visibility: String(domainVisibilityForm?.[d.key] || "disabled").trim().toLowerCase() === "disabled"
        ? "internal_only"
        : "public",
    }));
    const domainConfigRows = legacyPersistedDomainRows.map((d) => ({
      tenant_key: key,
      domain: d.key,
      domain_type: String(domainConfigForm?.[d.key]?.domain_type || defaultDomainType(d.key)).trim().toLowerCase() || defaultDomainType(d.key),
      notification_email: cleanOptional(domainConfigForm?.[d.key]?.notification_email),
      organization_monitored_repairs: domainConfigForm?.[d.key]?.organization_monitored_repairs !== false,
      public_visibility_min_reports: sanitizePositiveIntegerSetting(
        domainConfigForm?.[d.key]?.public_visibility_min_reports,
        defaultDomainPublicVisibilityMinReports(d.key),
        { min: 1, max: 25 }
      ),
      high_confidence_min_reports: sanitizePositiveIntegerSetting(
        domainConfigForm?.[d.key]?.high_confidence_min_reports,
        defaultDomainHighConfidenceMinReports(d.key),
        { min: 1, max: 25 }
      ),
      updated_by: cleanOptional(sessionUserId),
    }));
    const assignmentRows = persistedDomainRows.map((d) => ({
      tenant_key: key,
      domain_key: d.key,
      active: String(domainVisibilityForm?.[d.key] || "disabled").trim().toLowerCase() !== "disabled",
      visibility: String(domainVisibilityForm?.[d.key] || "disabled").trim().toLowerCase() === "disabled" ? "disabled" : "enabled",
      display_label: cleanOptional(domainConfigForm?.[d.key]?.display_label),
      marker_color: sanitizeHexColor(domainConfigForm?.[d.key]?.marker_color, defaultDomainMarkerColor(d.key)),
      icon_render_mode: normalizeDomainIconRenderMode(
        domainConfigForm?.[d.key]?.icon_render_mode,
        String(manageableTenantDomainRowByKey?.[d.key]?.icon_src || "").trim()
      ),
      icon_tint_mode: normalizeDomainIconTintMode(domainConfigForm?.[d.key]?.icon_tint_mode),
      icon_tint_color: cleanOptional(normalizeDomainIconTintColor(domainConfigForm?.[d.key]?.icon_tint_color, "")),
      notification_email: cleanOptional(domainConfigForm?.[d.key]?.notification_email),
      notification_template_key: String(domainConfigForm?.[d.key]?.notification_template_key || DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS[0].key).trim().toLowerCase(),
      notification_subject_template: cleanOptional(domainConfigForm?.[d.key]?.notification_subject_template),
      notification_body_template: cleanOptional(domainConfigForm?.[d.key]?.notification_body_template),
      organization_monitored_repairs: domainConfigForm?.[d.key]?.organization_monitored_repairs !== false,
      public_visibility_min_reports: sanitizePositiveIntegerSetting(
        domainConfigForm?.[d.key]?.public_visibility_min_reports,
        defaultDomainPublicVisibilityMinReports(d.key),
        { min: 1, max: 25 }
      ),
      high_confidence_min_reports: sanitizePositiveIntegerSetting(
        domainConfigForm?.[d.key]?.high_confidence_min_reports,
          defaultDomainHighConfidenceMinReports(d.key),
          { min: 1, max: 25 }
        ),
      type_options: buildStoredDomainTypeOptionConfigs(domainConfigForm?.[d.key]?.type_options, d.key),
      report_disclosures: normalizeDomainDisclosureRows(domainConfigForm?.[d.key]?.report_disclosures, d.key),
      updated_by: cleanOptional(sessionUserId),
    }));
    const invalidTypeOption = assignmentRows
      .flatMap((row) => (Array.isArray(row?.type_options) ? row.type_options : []))
      .find((row) => {
        const optionLabel = String(row?.option_label || "").trim();
        const choices = Array.isArray(row?.choices) ? row.choices : [];
        return optionLabel && !choices.length;
      });
    if (invalidTypeOption) {
      setStatus((prev) => ({
        ...prev,
        domains: `${String(invalidTypeOption.option_label || "Type Option").trim()} must include at least one choice before saving.`,
      }));
      return;
    }

    const tenantPayload = {
      notification_email_potholes: cleanOptional(domainConfigForm?.potholes?.notification_email),
      notification_email_water_drain: cleanOptional(domainConfigForm?.water_drain_issues?.notification_email),
    };

    const [{ error: visError }, { error: domainConfigError }, { error: tenantError }, assignmentResult] = await Promise.all([
      supabase.from("tenant_visibility_config").upsert(visibilityRows, { onConflict: "tenant_key,domain" }),
      supabase.from("tenant_domain_configs").upsert(domainConfigRows, { onConflict: "tenant_key,domain" }),
      supabase.from("tenants").update(tenantPayload).eq("tenant_key", key),
      supabase.from("tenant_domain_assignments").upsert(assignmentRows, { onConflict: "tenant_key,domain_key" }),
    ]);
    let assignmentError = assignmentResult.error;
    if (assignmentError && isMissingColumnError(assignmentError)) {
      const fallbackAssignmentRows = assignmentRows.map((row) => ({
        tenant_key: row.tenant_key,
        domain_key: row.domain_key,
        active: row.active,
        visibility: row.visibility,
        notification_email: row.notification_email,
        organization_monitored_repairs: row.organization_monitored_repairs,
        updated_by: row.updated_by,
      }));
      const fallbackAssignmentResult = await supabase
        .from("tenant_domain_assignments")
        .upsert(fallbackAssignmentRows, { onConflict: "tenant_key,domain_key" });
      assignmentError = fallbackAssignmentResult.error;
    }

    if (visError || domainConfigError || tenantError || assignmentError) {
      setStatus((prev) => ({ ...prev, domains: statusText(visError || domainConfigError || tenantError || assignmentError, "") }));
      return;
    }

    await logAudit({
      tenant_key: key,
      action: "tenant_domain_settings_upsert",
      entity_type: "tenant_config",
      entity_id: key,
      details: {
        visibility: visibilityRows,
        domain_configurations: domainConfigRows,
        domain_assignments: assignmentRows,
        notification_emails: tenantPayload,
      },
    });

    setStatus((prev) => ({ ...prev, domains: `Saved domain settings, notification routing, and email templates for ${key}.` }));
    if (closingDomainKey) {
      pendingAssignedDomainFocusKeyRef.current = closingDomainKey;
      const savedAssignment = assignmentRows.find((row) => row.domain_key === closingDomainKey) || null;
      const savedConfig = domainConfigRows.find((row) => row.domain === closingDomainKey) || null;
      if (savedAssignment) {
        setDomainVisibilityForm((prev) => ({
          ...prev,
          [closingDomainKey]: savedAssignment.visibility === "disabled" ? "disabled" : "enabled",
        }));
      }
      if (savedConfig || savedAssignment) {
        setDomainConfigForm((prev) => ({
          ...prev,
          [closingDomainKey]: {
            ...(prev?.[closingDomainKey] || {}),
            ...(savedConfig ? {
              domain_type: savedConfig.domain_type,
              notification_email: savedConfig.notification_email || "",
              organization_monitored_repairs: savedConfig.organization_monitored_repairs !== false,
              public_visibility_min_reports: savedConfig.public_visibility_min_reports,
              high_confidence_min_reports: savedConfig.high_confidence_min_reports,
            } : {}),
            ...(savedAssignment ? {
              display_label: savedAssignment.display_label || "",
              marker_color: savedAssignment.marker_color || defaultDomainMarkerColor(closingDomainKey),
              icon_render_mode: normalizeDomainIconRenderMode(
                savedAssignment.icon_render_mode,
                String(manageableTenantDomainRowByKey?.[closingDomainKey]?.icon_src || "").trim()
              ),
              icon_tint_mode: normalizeDomainIconTintMode(savedAssignment.icon_tint_mode),
              icon_tint_color: normalizeDomainIconTintColor(savedAssignment.icon_tint_color, ""),
              notification_email: savedAssignment.notification_email || (savedConfig?.notification_email || ""),
              notification_template_key: savedAssignment.notification_template_key || DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS[0].key,
              notification_subject_template: savedAssignment.notification_subject_template || "",
              notification_body_template: savedAssignment.notification_body_template || "",
              organization_monitored_repairs: savedAssignment.organization_monitored_repairs !== false,
              type_options: normalizeDomainTypeOptionConfigs(savedAssignment.type_options, closingDomainKey),
              report_disclosures: normalizeDomainDisclosureRows(savedAssignment.report_disclosures, closingDomainKey),
            } : {}),
          },
        }));
      }
      setEditingDomainKey("");
      setEditingDomainSnapshot(null);
      setExpandedAssignedDomainCardKey((prev) => (prev === closingDomainKey ? "" : prev));
    }
    await refreshControlPlaneData();
  }, [canEditTenantDomains, selectedTenantKey, domainVisibilityForm, domainConfigForm, sessionUserId, logAudit, refreshControlPlaneData, requirePlatformSecurityCheckpoint, editingDomainSnapshot, activeManageableTenantDomainRows, selectedTenantDomainAssignments, editingDomainKey, manageableTenantDomainRowByKey]);

  const saveMapFeaturesSettings = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!canEditTenantDomains) {
      setStatus((prev) => ({ ...prev, domains: "You need the Domains edit permission to update map features." }));
      return;
    }
    const key = sanitizeTenantKey(selectedTenantKey);
    if (!key) {
      setStatus((prev) => ({ ...prev, domains: "Select a tenant first." }));
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_domain_settings_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to save map feature settings.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, domains: message })),
    });
    if (!checkpointApproved) return;

    const opacityRaw = Number(mapFeaturesForm?.outside_shade_opacity);
    const opacity = Number.isFinite(opacityRaw) ? Math.max(0, Math.min(1, opacityRaw)) : 0.42;
    const borderColor = sanitizeHexColor(mapFeaturesForm?.boundary_border_color, "#e53935");
    const borderWidthRaw = Number(mapFeaturesForm?.boundary_border_width);
    const borderWidth = Number.isFinite(borderWidthRaw) ? Math.max(0.5, Math.min(8, borderWidthRaw)) : 4;
    const mapPayload = {
      tenant_key: key,
      show_boundary_border: Boolean(mapFeaturesForm?.show_boundary_border),
      shade_outside_boundary: Boolean(mapFeaturesForm?.shade_outside_boundary),
      show_alert_icon: Boolean(mapFeaturesForm?.show_alert_icon),
      show_event_icon: Boolean(mapFeaturesForm?.show_event_icon),
      outside_shade_opacity: opacity,
      boundary_border_color: borderColor,
      boundary_border_width: borderWidth,
    };

    const { error } = await supabase.from("tenant_map_features").upsert([mapPayload], { onConflict: "tenant_key" });
    if (error) {
      setStatus((prev) => ({ ...prev, domains: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key: key,
      action: "tenant_map_features_upsert",
      entity_type: "tenant_map_features",
      entity_id: key,
      details: {
        map_features: mapPayload,
      },
    });

    setMapFeaturesEditMode(false);
    setMapFeaturesSnapshot(null);
    setStatus((prev) => ({ ...prev, domains: `Saved map features for ${key}.` }));
    await refreshControlPlaneData();
  }, [canEditTenantDomains, logAudit, mapFeaturesForm, refreshControlPlaneData, requirePlatformSecurityCheckpoint, selectedTenantKey]);

  const assignTenantAdmin = useCallback(async (event) => {
    event?.preventDefault?.();
    if (!canManageTenantUsers) {
      setStatus((prev) => ({ ...prev, users: "You need the Users edit permission to assign organization roles from this control plane." }));
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
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_organization_user_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to assign an organization user role.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, users: message })),
    });
    if (!checkpointApproved) return;

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
    setTenantUsersManagementView("list");
    await refreshControlPlaneData();
  }, [canManageTenantUsers, assignForm, assignableTenantRoles, selectedTenantKey, logAudit, refreshControlPlaneData, formatKnownUserLabel, requirePlatformSecurityCheckpoint]);

  const removeTenantAdmin = useCallback(async (row) => {
    if (!canDeleteTenantUsers) {
      setStatus((prev) => ({ ...prev, users: "You need the Users delete permission to remove organization roles from this control plane." }));
      return;
    }
    const tenant_key = sanitizeTenantKey(row?.tenant_key);
    const user_id = String(row?.user_id || "").trim();
    const role = String(row?.role || "").trim().toLowerCase();
    if (!tenant_key || !user_id || !role) return;
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_organization_user_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to remove an organization user role.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, users: message })),
    });
    if (!checkpointApproved) return;

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
  }, [canDeleteTenantUsers, logAudit, refreshControlPlaneData, formatKnownUserLabel, requirePlatformSecurityCheckpoint]);

  const saveTenantAdminRoleEdit = useCallback(async (row) => {
    if (!canManageTenantUsers) {
      setStatus((prev) => ({ ...prev, users: "You need the Users edit permission to change organization roles from this control plane." }));
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
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_organization_user_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to change an organization user role.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, users: message })),
    });
    if (!checkpointApproved) return;

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
  }, [canManageTenantUsers, editingAssignmentRole, logAudit, refreshControlPlaneData, formatKnownUserLabel, requirePlatformSecurityCheckpoint]);

  const createTenantRole = useCallback(async (event) => {
    event.preventDefault();
    if (!canManageTenantRoles) {
      setStatus((prev) => ({ ...prev, roles: "You need the Roles edit permission to create organization roles." }));
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
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_organization_role_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to create an organization role.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, roles: message })),
    });
    if (!checkpointApproved) return;

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
    setTenantRoleManagementView("list");
    await loadTenantRoleConfig(tenant_key);
  }, [canManageTenantRoles, selectedTenantKey, roleForm, sortedTenantRoleDefinitions, sessionUserId, logAudit, loadTenantRoleConfig, requirePlatformSecurityCheckpoint]);

  const removeTenantRole = useCallback(async (row) => {
    if (!canDeleteTenantRoles) {
      setStatus((prev) => ({ ...prev, roles: "You need the Roles delete permission to remove organization roles." }));
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
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_organization_role_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to delete an organization role.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, roles: message })),
    });
    if (!checkpointApproved) return;

    setTenantRoleDeleteLoading(true);
    try {
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
      setTenantRoleDeleteConfirmOpen(false);
      setTenantRoleEditMode(false);
      await loadTenantRoleConfig(tenant_key);
      await loadTenantAdmins();
    } finally {
      setTenantRoleDeleteLoading(false);
    }
  }, [canDeleteTenantRoles, selectedTenantKey, tenantRoleAssignmentCounts, logAudit, loadTenantRoleConfig, loadTenantAdmins, requirePlatformSecurityCheckpoint]);

  const saveRolePermissions = useCallback(async () => {
    if (!canManageTenantRoles) {
      setStatus((prev) => ({ ...prev, roles: "You need the Roles edit permission to update organization role permissions." }));
      return;
    }
    const tenant_key = sanitizeTenantKey(selectedTenantKey);
    const role = String(selectedRoleKey || "").trim().toLowerCase();
    if (!tenant_key || !role) {
      setStatus((prev) => ({ ...prev, roles: "Select a tenant role first." }));
      return;
    }
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_organization_role_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to save organization role permissions.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, roles: message })),
    });
    if (!checkpointApproved) return;

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
  }, [canManageTenantRoles, selectedTenantKey, selectedRoleKey, rolePermissionDraft, sessionUserId, logAudit, loadTenantRoleConfig, requirePlatformSecurityCheckpoint]);

  const applyBoundaryPayloadToTenant = useCallback(async ({ tenantKey, boundaryGeoJson, sourceLabel }) => {
    if (!canEditTenantDomains) return { ok: false, error: "You need the Domains edit permission to update organization boundaries." };
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
  }, [canEditTenantDomains, logAudit]);

  const uploadTenantFile = useCallback(async (event) => {
    event.preventDefault();
    if (!canEditTenantFiles) {
      setStatus((prev) => ({ ...prev, files: "You need the Files edit permission to upload organization files." }));
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
    const assetSubtype = String(fileForm.asset_subtype || "").trim().toLowerCase();
    if (category === "asset_coordinates" && !assetSubtype) {
      setStatus((prev) => ({ ...prev, files: "Choose the related domain before uploading coordinate files." }));
      return;
    }
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
    const pathSegments = [tenantKey, category];
    if (category === "asset_coordinates" && assetSubtype) pathSegments.push(assetSubtype);
    pathSegments.push(toDatePath(new Date()), `${now}_${fileName}`);
    const path = pathSegments.join("/");
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
      asset_subtype: cleanOptional(assetSubtype),
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
        asset_subtype: cleanOptional(assetSubtype),
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
      setFileForm({ category: "contract", asset_subtype: "", notes: "", file: null });
      setTenantAssetsManagementView("list");
      await refreshControlPlaneData();
      return;
    }

    setFileForm({ category: "contract", asset_subtype: "", notes: "", file: null });
    setStatus((prev) => ({ ...prev, files: `Uploaded ${file.name}.` }));
    setTenantAssetsManagementView("list");
    await loadTenantFiles(tenantKey);
    await loadAudit();
  }, [canEditTenantFiles, selectedTenantKey, fileForm, sessionUserId, logAudit, loadTenantFiles, loadAudit, applyBoundaryPayloadToTenant, refreshControlPlaneData]);

  const openTenantAssetModal = useCallback((overrides = {}) => {
    setFileForm({
      category: String(overrides?.category || "contract"),
      asset_subtype: String(overrides?.asset_subtype || ""),
      notes: String(overrides?.notes || ""),
      file: null,
    });
    setTenantAssetsManagementView("add");
  }, []);

  const beginDomainEdit = useCallback((domainKey) => {
    const key = String(domainKey || "").trim().toLowerCase();
    if (!key) return;
    setExpandedAssignedDomainCardKey(key);
    setSelectedAssignedDomainKey(key);
    setEditingDomainKey(key);
    setEditingDomainSnapshot({
      key,
      visibility: String(domainVisibilityForm?.[key] || "enabled"),
      config: {
        ...(domainConfigForm?.[key] || {
          domain_type: defaultDomainType(key),
          display_label: defaultDomainLabel(key),
          marker_color: defaultDomainMarkerColor(key),
          notification_email: "",
        }),
      },
    });
  }, [domainVisibilityForm, domainConfigForm]);

  const cancelDomainEdit = useCallback((domainKey) => {
    const key = String(domainKey || "").trim().toLowerCase();
    if (!key) return;
    if (editingDomainSnapshot?.key === key) {
      setDomainVisibilityForm((prev) => ({ ...prev, [key]: editingDomainSnapshot.visibility || "enabled" }));
      setDomainConfigForm((prev) => ({
        ...prev,
        [key]: {
          ...(prev?.[key] || {}),
          ...(editingDomainSnapshot.config || {}),
        },
      }));
    }
    setEditingDomainKey("");
    setEditingDomainSnapshot(null);
  }, [editingDomainSnapshot]);

  const toggleDomainRegistryCard = useCallback((domainKey) => {
    const key = String(domainKey || "").trim().toLowerCase();
    if (!key) return;
    setExpandedDomainRegistryCardKey((prev) => (prev === key ? "" : key));
  }, []);

  const toggleAssignedDomainCard = useCallback((domainKey) => {
    const key = String(domainKey || "").trim().toLowerCase();
    if (!key) return;
    setSelectedAssignedDomainKey(key);
    setExpandedAssignedDomainCardKey(key);
  }, []);

  const beginMapFeaturesEdit = useCallback(() => {
    if (!canEditTenantDomains) return;
    setMapFeaturesSnapshot({ ...mapFeaturesForm });
    setMapFeaturesEditMode(true);
    setStatus((prev) => ({ ...prev, domains: "" }));
  }, [canEditTenantDomains, mapFeaturesForm]);

  const cancelMapFeaturesEdit = useCallback(() => {
    const key = sanitizeTenantKey(selectedTenantKey);
    const configuredFeatures = tenantMapFeaturesByTenant?.[key] || null;
    setMapFeaturesForm(mapFeaturesSnapshot ? { ...mapFeaturesSnapshot } : buildMapFeaturesForm(configuredFeatures));
    setMapFeaturesEditMode(false);
    setMapFeaturesSnapshot(null);
  }, [mapFeaturesSnapshot, selectedTenantKey, tenantMapFeaturesByTenant]);

  const openTenantFile = useCallback(async (row) => {
    const bucket = String(row?.storage_bucket || "tenant-files").trim() || "tenant-files";
    const path = String(row?.storage_path || "").trim();
    if (!path) return;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      setStatus((prev) => ({ ...prev, files: statusText(error || "Unable to create signed URL", "") }));
      return;
    }
    void openExternalUrl(data.signedUrl);
  }, []);

  const setBoundaryFromFile = useCallback(async (row) => {
    if (!canEditTenantDomains) {
      setStatus((prev) => ({ ...prev, files: "You need the Domains edit permission to update organization boundaries." }));
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
  }, [canEditTenantDomains, selectedTenantKey, applyBoundaryPayloadToTenant, refreshControlPlaneData]);

  const removeTenantFile = useCallback(async (row) => {
    if (!canEditTenantFiles) {
      setStatus((prev) => ({ ...prev, files: "You need the Files edit permission to remove organization files." }));
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
  }, [canEditTenantFiles, logAudit, loadTenantFiles, loadAudit]);

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
    ? { ...shell, padding: "calc(var(--mobile-header-top-offset) + var(--mobile-header-height) + 18px) 8px calc(env(safe-area-inset-bottom, 0px) + 108px)" }
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
        border: "var(--mobile-header-border)",
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
    ? {
        ...menuToggleButton,
        width: "var(--mobile-header-menu-size)",
        height: "var(--mobile-header-menu-size)",
        border: "var(--mobile-header-menu-border)",
        background: "var(--mobile-header-menu-background)",
        boxShadow: "var(--mobile-header-menu-shadow)",
      }
    : menuToggleButton;
  const menuLineWidth = isCompactViewport ? "var(--mobile-header-menu-line-width)" : 18;
  const menuLineGap = isCompactViewport ? "var(--mobile-header-menu-line-gap)" : 4;
  const organizationSectionReadOnly = useCallback(
    (sectionKey) => (inTenantWorkspace ? editingOrganizationSection !== sectionKey : false),
    [editingOrganizationSection, inTenantWorkspace]
  );

  const renderDomainRegistryEditor = () => {
    const ownershipModelDescription = ({
      org_managed: "Organization managed means the work is typically owned and fulfilled by the organization running PCP.",
      utility_managed: "Utility managed means the work is typically owned by a public or regulated utility.",
      third_party: "Third party means the work is owned by an outside contractor, vendor, or private operator rather than the organization or utility.",
    }[String(domainRegistryForm?.ownership_model || "org_managed").trim().toLowerCase()] || "Organization managed means the work is typically owned and fulfilled by the organization running PCP.");
    return (
      <form onSubmit={(event) => void saveDomainDefinition(event)} style={{ ...subPanel, display: "grid", gap: 10, background: "rgba(18,128,106,0.08)", borderColor: "rgba(18,128,106,0.22)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900, color: palette.navy900 }}>
          {editingDomainDefinitionKey ? `Edit ${domainRegistryForm.label || editingDomainDefinitionKey}` : "Create Global Domain"}
        </div>
        <div style={{ fontSize: 12.5, color: palette.textMuted }}>
          {editingDomainDefinitionKey ? "Domain key remains stable after creation." : "Keys become the stable identifier across PCP, reports, and the public app."}
        </div>
      </div>
      <div style={responsiveActionGrid}>
        <label style={modalField}>
          <span>Domain Label</span>
          <input
            value={domainRegistryForm.label}
            onChange={(e) => {
              const nextLabel = e.target.value;
              setDomainRegistryForm((prev) => ({
                ...prev,
                label: nextLabel,
                key: !editingDomainDefinitionKey && prev.key_autofill ? slugifyDomainKeyInput(nextLabel) : prev.key,
              }));
            }}
            placeholder="Catch Basins"
            style={modalInput}
          />
        </label>
        <label style={modalField}>
          <span>Status</span>
          <select
            value={domainRegistryForm.status}
            onChange={(e) => setDomainRegistryForm((prev) => ({ ...prev, status: e.target.value }))}
            style={modalInput}
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label style={modalField}>
          <span>Ownership Model</span>
          <select
            value={domainRegistryForm.ownership_model}
            onChange={(e) => setDomainRegistryForm((prev) => ({ ...prev, ownership_model: e.target.value }))}
            style={modalInput}
          >
            <option value="org_managed">Organization Managed</option>
            <option value="utility_managed">Utility Managed</option>
            <option value="third_party">Third Party</option>
          </select>
          <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>
            {ownershipModelDescription}
          </div>
        </label>
        <div style={{ ...responsiveActionGrid, gridColumn: "1 / -1" }}>
          <div style={{ ...modalField, justifyContent: "start" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content" }}>
              <span>Allow Photos</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: palette.text, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={domainRegistryForm.allow_report_images === true}
                  onChange={(e) => setDomainRegistryForm((prev) => ({ ...prev, allow_report_images: e.target.checked }))}
                />
              </label>
            </div>
            <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>
              Allow residents to capture or upload a photo with this domain's report.
            </div>
          </div>
          <div style={{ ...modalField, justifyContent: "start" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, width: "fit-content" }}>
              <span>Road Required</span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: palette.text, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={domainRegistryForm.road_required === true}
                  onChange={(e) => setDomainRegistryForm((prev) => ({ ...prev, road_required: e.target.checked }))}
                />
              </label>
            </div>
            <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>
              Require the public reporting modal pin to land on a road before submission.
            </div>
          </div>
        </div>
        {!editingDomainDefinitionKey ? (
          <>
            <label style={modalField}>
              <span>Domain Key</span>
              <input
                value={domainRegistryForm.key}
                onChange={(e) => setDomainRegistryForm((prev) => ({
                  ...prev,
                  key: slugifyDomainKeyInput(e.target.value),
                  key_autofill: false,
                }))}
                placeholder="catch_basins"
                style={modalInput}
              />
              <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>
                Auto-generated from the label until you manually edit it.
              </div>
            </label>
            <label style={modalField}>
              <span>Domain Class</span>
              <select
                value={domainRegistryForm.domain_class}
                onChange={(e) => setDomainRegistryForm((prev) => ({ ...prev, domain_class: e.target.value }))}
                style={modalInput}
              >
                {DOMAIN_TYPE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
            </label>
            <label style={modalField}>
              <span>Report Prefix</span>
              <input
                value={domainRegistryForm.report_prefix}
                onChange={(e) => setDomainRegistryForm((prev) => ({
                  ...prev,
                  report_prefix: String(e.target.value || "").toUpperCase(),
                }))}
                placeholder="EC"
                style={modalInput}
              />
              <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>
                Required. Report numbers are standardized as <b>{"<PREFIX>-R<8 digits>"}</b>, for example <b>EC-R00000999</b>.
              </div>
            </label>
          </>
        ) : null}
      </div>
      <div style={{ ...subPanel, display: "grid", gap: 10, background: "rgba(255,255,255,0.82)", borderColor: "rgba(17,36,69,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 3 }}>
            <div style={{ fontWeight: 900, color: palette.navy900 }}>Domain Icon</div>
            <div style={{ fontSize: 12.5, color: palette.textMuted }}>
              Preferred spec: SVG with a square artboard, transparent background, and a simple single-icon composition. Best fit is a 64px to 256px square source. Uploads save into the platform domain icon library automatically. PNG and WebP are accepted when needed.
            </div>
          </div>
        </div>
        <div style={responsiveActionGrid}>
          <label style={modalField}>
            <span>Icon Source</span>
            <select
              value={domainRegistryForm.icon_selection}
              onChange={(e) => setDomainRegistryForm((prev) => ({
                ...prev,
                icon_selection: e.target.value,
                custom_icon_src: e.target.value === CUSTOM_DOMAIN_ICON_SELECTION ? prev.custom_icon_src : "",
                icon_file: e.target.value === UPLOAD_DOMAIN_ICON_SELECTION ? prev.icon_file : null,
              }))}
              style={modalInput}
            >
              <option value={UPLOAD_DOMAIN_ICON_SELECTION}>Upload icon file (recommended)</option>
              <option value={CUSTOM_DOMAIN_ICON_SELECTION}>Advanced: public path</option>
              <option value="">No icon</option>
            </select>
          </label>
        </div>
        {domainRegistryForm.icon_selection === UPLOAD_DOMAIN_ICON_SELECTION ? (
          <label style={{ ...modalField, gridColumn: "1 / -1" }}>
            <span>Choose Icon File</span>
            <input
              type="file"
              accept={DOMAIN_ICON_ACCEPT}
              onChange={(e) => {
                const nextFile = e.target.files?.[0] || null;
                setDomainRegistryForm((prev) => ({
                  ...prev,
                  icon_file: nextFile,
                }));
              }}
              style={modalInput}
            />
            <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>
              Preferred: SVG. Also accepted: PNG or WebP. Max size: 2 MB.
            </div>
          </label>
        ) : null}
        {domainRegistryForm.icon_selection === CUSTOM_DOMAIN_ICON_SELECTION ? (
          <label style={{ ...modalField, gridColumn: "1 / -1" }}>
            <span>Custom Icon Public Path (advanced)</span>
            <input
              value={domainRegistryForm.custom_icon_src}
              onChange={(e) => setDomainRegistryForm((prev) => ({ ...prev, custom_icon_src: e.target.value, icon_src: e.target.value }))}
              placeholder="https://... or /public/path/icon.svg"
              style={modalInput}
            />
          </label>
        ) : null}
        {(domainRegistryUploadPreviewUrl || domainRegistryForm.icon_src || domainRegistryForm.custom_icon_src) ? (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12.5, color: palette.textMuted }}>Preview</div>
              <div style={{ width: 68, height: 68, borderRadius: 16, border: "1px solid rgba(17,36,69,0.12)", background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <img
                  src={domainRegistryUploadPreviewUrl || (domainRegistryForm.icon_selection === CUSTOM_DOMAIN_ICON_SELECTION ? domainRegistryForm.custom_icon_src : domainRegistryForm.icon_src)}
                  alt={`${domainRegistryForm.label || "Domain"} icon preview`}
                  style={{ width: 44, height: 44, objectFit: "contain" }}
                />
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: palette.textMuted, maxWidth: 420 }}>
              Upload-first is now the standard flow. The advanced public-path option is only here for legacy or externally hosted icons when you intentionally need it.
            </div>
          </div>
        ) : null}
      </div>
      <label style={{ ...modalField, gridColumn: "1 / -1" }}>
        <span>Description</span>
        <textarea
          value={domainRegistryForm.description}
          onChange={(e) => setDomainRegistryForm((prev) => ({ ...prev, description: e.target.value }))}
          rows={3}
          placeholder="Describe when residents or staff should use this domain."
          style={{ ...modalInput, minHeight: 86, resize: "vertical" }}
        />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="submit"
          style={{ ...buttonBase, opacity: domainRegistrySaving ? 0.65 : 1 }}
          disabled={domainRegistrySaving}
        >
          {domainRegistrySaving ? "Saving..." : editingDomainDefinitionKey ? "Save Domain" : "Create Domain"}
        </button>
        <button
          type="button"
          style={buttonAlt}
          disabled={domainRegistrySaving}
          onClick={cancelDomainDefinitionEditor}
        >
          Cancel
        </button>
      </div>
      </form>
    );
  };

  const renderTenantDomainAssignmentEditor = () => (
    <form onSubmit={(event) => void saveTenantDomainAssignment(event)} style={{ ...subPanel, display: "grid", gap: 10, background: "rgba(46,98,143,0.08)", borderColor: "rgba(46,98,143,0.22)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900, color: palette.navy900 }}>
          {editingTenantDomainAssignmentKey ? `Edit ${tenantDomainAssignmentForm.domain_key} assignment` : "Assign Active Global Domain"}
        </div>
        <div style={{ fontSize: 12.5, color: palette.textMuted }}>
          Billing metadata is informational only in v1 and does not gate activation.
        </div>
      </div>
      <div style={responsiveActionGrid}>
        <label style={modalField}>
          <span>Global Domain</span>
          <select
            value={tenantDomainAssignmentForm.domain_key}
            disabled={Boolean(editingTenantDomainAssignmentKey)}
            onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, domain_key: e.target.value }))}
            style={{ ...modalInput, background: editingTenantDomainAssignmentKey ? "#eef4fb" : modalInput.background }}
          >
            {editingTenantDomainAssignmentKey ? (
              <option value={tenantDomainAssignmentForm.domain_key}>{domainRegistryRows.find((row) => row.key === tenantDomainAssignmentForm.domain_key)?.label || tenantDomainAssignmentForm.domain_key}</option>
            ) : assignableDomainRegistryRows.length ? (
              assignableDomainRegistryRows.map((domain) => (
                <option key={domain.key} value={domain.key}>{domain.label}</option>
              ))
            ) : (
              <option value="">No active unassigned domains available</option>
            )}
          </select>
          {!editingTenantDomainAssignmentKey && !assignableDomainRegistryRows.length ? (
            <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 6 }}>
              Draft domains stay in the registry until you promote them to Active.
            </div>
          ) : null}
        </label>
        <label style={modalField}>
          <span>Assignment Active</span>
          <select
            value={tenantDomainAssignmentForm.active ? "active" : "inactive"}
            onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, active: e.target.value === "active" }))}
            style={modalInput}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label style={modalField}>
          <span>Visibility</span>
          <select
            value={tenantDomainAssignmentForm.visibility}
            onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, visibility: e.target.value }))}
            style={modalInput}
          >
            {DOMAIN_ASSIGNMENT_VISIBILITY_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
        <label style={modalField}>
          <span>Notification Email</span>
          <input
            value={tenantDomainAssignmentForm.notification_email}
            onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, notification_email: e.target.value }))}
            placeholder="notifications@examplecity.gov"
            style={modalInput}
          />
        </label>
        <label style={modalField}>
          <span>Billing Status</span>
          <select
            value={tenantDomainAssignmentForm.billing_status}
            onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, billing_status: e.target.value }))}
            style={modalInput}
          >
            {DOMAIN_BILLING_STATUS_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
        <label style={modalField}>
          <span>Billing Model</span>
          <select
            value={tenantDomainAssignmentForm.billing_model}
            onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, billing_model: e.target.value }))}
            style={modalInput}
          >
            {DOMAIN_BILLING_MODEL_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>
        </label>
        <label style={modalField}>
          <span>Billing Amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={tenantDomainAssignmentForm.billing_amount}
            onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, billing_amount: e.target.value }))}
            placeholder="0.00"
            style={modalInput}
          />
        </label>
        <div style={{ ...modalField, justifyContent: "center" }}>
          <span>Repair Monitoring</span>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 48,
              padding: "0 14px",
              borderRadius: 14,
              border: "1px solid rgba(17, 36, 69, 0.14)",
              background: "rgba(255,255,255,0.92)",
              color: palette.navy900,
              fontWeight: 700,
            }}
          >
            <input
              type="checkbox"
              checked={tenantDomainAssignmentForm.organization_monitored_repairs !== false}
              onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, organization_monitored_repairs: e.target.checked }))}
            />
            <span style={{ display: "grid", gap: 2 }}>
              <span style={{ fontWeight: 800 }}>Managed by Organization?</span>
              <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.78 }}>
                {tenantDomainAssignmentForm.organization_monitored_repairs !== false ? "Yes" : "No"}
              </span>
            </span>
          </label>
        </div>
      </div>
      <div style={{ fontSize: 12, color: palette.textMuted }}>
        Report email templates are configured from <b>Manage Organizations → Domains</b> after the domain is enabled.
      </div>
      <label style={{ ...modalField, gridColumn: "1 / -1" }}>
        <span>Billing Notes</span>
        <textarea
          value={tenantDomainAssignmentForm.billing_notes}
          onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, billing_notes: e.target.value }))}
          rows={3}
          placeholder="Optional notes about pricing, review status, or future billing triggers."
          style={{ ...modalInput, minHeight: 86, resize: "vertical" }}
        />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="submit"
          style={{ ...buttonBase, opacity: tenantDomainAssignmentSaving ? 0.65 : 1 }}
          disabled={tenantDomainAssignmentSaving || (!editingTenantDomainAssignmentKey && !tenantDomainAssignmentForm.domain_key)}
        >
          {tenantDomainAssignmentSaving ? "Saving..." : editingTenantDomainAssignmentKey ? "Save Assignment" : "Create Assignment"}
        </button>
        <button
          type="button"
          style={buttonAlt}
          disabled={tenantDomainAssignmentSaving}
          onClick={cancelTenantDomainAssignmentEditor}
        >
          Cancel
        </button>
      </div>
    </form>
  );

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
          paddingInline: isCompactViewport ? "var(--mobile-header-title-padding-inline)" : 0,
          paddingBlock: isCompactViewport ? "var(--mobile-header-title-padding-block)" : 0,
          minWidth: 0,
          justifySelf: "center",
          alignContent: isCompactViewport ? "center" : undefined,
          transform: isCompactViewport ? "translateY(var(--mobile-header-title-shift-y))" : undefined,
        }}
      >
        <span className="app-header-eyebrow">
          Developer Dashboard
        </span>
        <span style={{
          fontSize: isCompactViewport ? "var(--mobile-header-title-size)" : "var(--desktop-header-title-size)",
          fontWeight: "var(--desktop-header-title-weight)",
          color: isCompactViewport ? "var(--mobile-header-title-color)" : palette.navy900,
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
              <span style={{ width: menuLineWidth, height: isCompactViewport ? "var(--mobile-header-menu-line-height)" : 2, borderRadius: 999, background: isCompactViewport ? "var(--mobile-header-menu-line-color)" : palette.navy900, display: "block" }} />
              <span style={{ width: menuLineWidth, height: isCompactViewport ? "var(--mobile-header-menu-line-height)" : 2, borderRadius: 999, background: isCompactViewport ? "var(--mobile-header-menu-line-color)" : palette.navy900, display: "block" }} />
              <span style={{ width: menuLineWidth, height: isCompactViewport ? "var(--mobile-header-menu-line-height)" : 2, borderRadius: 999, background: isCompactViewport ? "var(--mobile-header-menu-line-color)" : palette.navy900, display: "block" }} />
            </span>
          </button>
          {menuOpen ? (
            <div className="workspace-menu-panel" style={menuSheet}>
              <div className="workspace-menu-account">
                <div className="workspace-menu-eyebrow">
                  Signed In
                </div>
                <div className="workspace-menu-title">
                  {sessionDisplayName || "Platform User"}
                </div>
                <div className="workspace-menu-subtitle">
                  {platformRoleLabel}
                </div>
                {sessionEmail ? (
                  <div className="workspace-menu-meta">
                    {sessionEmail}
                  </div>
                ) : null}
              </div>
              <div className="workspace-menu-actions">
              <button
                type="button"
                className="workspace-menu-button"
                onClick={() => {
                  setMenuOpen(false);
                  setHelpOpen(true);
                }}
              >
                Help
              </button>
              <button
                type="button"
                className="workspace-menu-button"
                onClick={() => {
                  setMenuOpen(false);
                  openControlPlanePage(DEFAULT_SETTINGS_CONTROL_PLANE_PAGE);
                }}
              >
                Settings
              </button>
              <button type="button" className="workspace-menu-button" onClick={() => void signOutPlatformAdmin()}>
                Sign out
              </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  const helpSupportHref = buildMailtoHref({
    to: CITYREPORT_SUPPORT_EMAIL,
    subject: "PCP Help Request",
    body: [
      "Workspace: Platform Control Plane",
      `Page: ${controlPlanePage || "unknown"}`,
      "",
      "What do you need help with?",
    ].join("\n"),
  });

  const helpFeedbackHref = buildMailtoHref({
    to: CITYREPORT_SUPPORT_EMAIL,
    subject: "PCP Product Feedback",
    body: [
      "Workspace: Platform Control Plane",
      `Page: ${controlPlanePage || "unknown"}`,
      "",
      "What product feedback or feature request would you like to share?",
    ].join("\n"),
  });

  const helpModal = helpOpen ? (
    <div style={authModalBackdrop} onClick={() => setHelpOpen(false)}>
      <div style={authModalCard} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Help</h2>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
              Reach CityReport for platform help or share product feedback for the control plane.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(false)}
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
            aria-label="Close help dialog"
          >
            ×
          </button>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <a href={helpSupportHref} style={{ ...buttonBase, minHeight: 44, padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            Get Help
          </a>
          <a href={helpFeedbackHref} style={{ ...buttonAlt, minHeight: 44, padding: "0 14px", display: "inline-flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
            Share Product Feedback
          </a>
          <div style={{ fontSize: 12.5, color: palette.textMuted }}>Messages will open in your email app and send to {CITYREPORT_SUPPORT_EMAIL}.</div>
        </div>
      </div>
    </div>
  ) : null;

  const settingsPageActive = controlPlaneSection === "settings";
  const controlPlaneSettingsLayoutStyle = isCompactViewport ? { display: "grid", gap: 14 } : controlPlaneSettingsLayout;
  const controlPlaneSettingsContentPaneStyle = { display: "grid", gap: 14, minWidth: 0, alignContent: "start" };
  const controlPlaneSettingsSectionStyle = {
    ...fullWidthSection,
    display: "grid",
    gap: 14,
    marginTop: isCompactViewport ? 12 : "var(--app-tab-rail-title-gap)",
  };
  const renderMapUiThemeMobilePreview = useCallback((themeBundle, mode) => {
    const theme = themeBundle?.[mode] || MAP_UI_ICON_THEME_DEFAULTS[mode];
    const darkMode = mode === "dark";
    const frameBorder = darkMode ? "rgba(255,255,255,0.14)" : "rgba(17,36,69,0.12)";
    const mapBackdrop = darkMode
      ? "linear-gradient(180deg, rgba(14,25,39,0.96), rgba(21,41,61,0.96))"
      : "linear-gradient(180deg, rgba(217,232,245,0.98), rgba(199,223,211,0.94))";
    return (
      <div
        key={`map-ui-theme-preview-${mode}`}
        style={{
          borderRadius: 28,
          padding: 12,
          border: `1px solid ${frameBorder}`,
          background: darkMode ? "#08111d" : "#dfeaf4",
          boxShadow: "0 18px 36px rgba(15, 23, 42, 0.18)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 6px", fontSize: 11.5, fontWeight: 800, color: darkMode ? "#dbeafe" : palette.navy900 }}>
          <span>{darkMode ? "Dark Preview" : "Light Preview"}</span>
          <span>9:41</span>
        </div>
        <div
          style={{
            width: "100%",
            maxWidth: 310,
            minHeight: 620,
            borderRadius: 24,
            overflow: "hidden",
            background: mapBackdrop,
            position: "relative",
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
          }}
        >
          <div
            style={{
              background: `linear-gradient(135deg, ${theme.header_bg_primary}, ${theme.header_bg_secondary})`,
              borderBottom: `1px solid ${theme.header_border}`,
              color: theme.header_text,
              padding: "16px 16px 14px",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.header_eyebrow, fontWeight: 800 }}>
              Map UI Theme
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 16, lineHeight: 1.1 }}>CityReport Mobile</strong>
                <span style={{ fontSize: 12, opacity: 0.82 }}>Header, menu, overlays, feeds, and tools</span>
              </div>
              <div
                style={{
                  borderRadius: 14,
                  padding: "10px 12px",
                  border: `1px solid ${theme.header_menu_border}`,
                  background: theme.header_menu_bg,
                  color: theme.header_text,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Menu
              </div>
            </div>
          </div>
          <div style={{ position: "relative", minHeight: 0 }}>
            <div style={{ position: "absolute", inset: 0, opacity: darkMode ? 0.36 : 0.5 }}>
              <div style={{ position: "absolute", top: 86, left: -10, right: -10, height: 3, background: darkMode ? "rgba(191,219,254,0.18)" : "rgba(17,36,69,0.12)", transform: "rotate(-8deg)" }} />
              <div style={{ position: "absolute", top: 198, left: -24, right: -24, height: 3, background: darkMode ? "rgba(191,219,254,0.14)" : "rgba(17,36,69,0.10)", transform: "rotate(12deg)" }} />
              <div style={{ position: "absolute", top: 304, left: 18, right: 18, height: 3, background: darkMode ? "rgba(191,219,254,0.12)" : "rgba(17,36,69,0.10)", transform: "rotate(-18deg)" }} />
            </div>
            <div style={{ position: "absolute", top: 16, right: 12, display: "grid", gap: 10 }}>
              {["Aa", "On", "Go"].map((label, index) => {
                const active = index === 1;
                return (
                  <div
                    key={`${mode}-${label}`}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      border: `1px solid ${active ? theme.tool_active_border : theme.tool_button_border}`,
                      background: active ? theme.tool_active_bg : theme.tool_button_bg,
                      color: active ? theme.tool_active_text : theme.tool_button_text,
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      fontWeight: 900,
                      boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 96,
                borderRadius: 22,
                border: `1px solid ${theme.feed_card_border}`,
                background: theme.feed_card_bg,
                color: theme.surface_text,
                padding: 14,
                display: "grid",
                gap: 10,
                boxShadow: "0 18px 30px rgba(15, 23, 42, 0.16)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong style={{ fontSize: 14 }}>Resident Feed</strong>
                <span
                  style={{
                    borderRadius: 999,
                    padding: "4px 10px",
                    background: theme.feed_status_scheduled_bg,
                    border: `1px solid ${theme.feed_status_scheduled_border}`,
                    color: theme.feed_status_scheduled_text,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  Scheduled
                </span>
              </div>
              <div style={{ fontSize: 12, color: theme.feed_muted_text }}>
                Previewing feed cards, status chips, utility contact tiles, and modal actions.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: theme.feed_badge_bg, border: `1px solid ${theme.feed_badge_border}`, color: theme.feed_badge_text, fontSize: 11, fontWeight: 800 }}>
                  Feed Badge
                </span>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: theme.feed_new_badge_bg, border: `1px solid ${theme.feed_new_badge_border}`, color: theme.feed_new_badge_text, fontSize: 11, fontWeight: 800 }}>
                  New
                </span>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: theme.feed_alert_info_bg, border: `1px solid ${theme.feed_alert_info_border}`, color: theme.feed_alert_info_text, fontSize: 11, fontWeight: 800 }}>
                  Info
                </span>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: theme.feed_alert_advisory_bg, border: `1px solid ${theme.feed_alert_advisory_border}`, color: theme.feed_alert_advisory_text, fontSize: 11, fontWeight: 800 }}>
                  Advisory
                </span>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: theme.feed_alert_urgent_bg, border: `1px solid ${theme.feed_alert_urgent_border}`, color: theme.feed_alert_urgent_text, fontSize: 11, fontWeight: 800 }}>
                  Urgent
                </span>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: theme.feed_alert_emergency_bg, border: `1px solid ${theme.feed_alert_emergency_border}`, color: theme.feed_alert_emergency_text, fontSize: 11, fontWeight: 800 }}>
                  Emergency
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: theme.feed_status_published_bg, border: `1px solid ${theme.feed_status_published_border}`, color: theme.feed_status_published_text, fontSize: 11, fontWeight: 800 }}>
                  Published
                </span>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: theme.feed_status_draft_bg, border: `1px solid ${theme.feed_status_draft_border}`, color: theme.feed_status_draft_text, fontSize: 11, fontWeight: 800 }}>
                  Draft
                </span>
                <span style={{ borderRadius: 999, padding: "4px 10px", background: theme.feed_status_archived_bg, border: `1px solid ${theme.feed_status_archived_border}`, color: theme.feed_status_archived_text, fontSize: 11, fontWeight: 800 }}>
                  Archived
                </span>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                left: 18,
                right: 18,
                bottom: 18,
                borderRadius: 22,
                border: `1px solid ${theme.modal_border}`,
                background: theme.modal_bg,
                color: theme.surface_text,
                padding: 14,
                display: "grid",
                gap: 10,
                boxShadow: "0 18px 36px rgba(15, 23, 42, 0.24)",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 14 }}>Quick Actions</strong>
                <div style={{ fontSize: 12, color: theme.feed_muted_text }}>Modal, inputs, and primary/secondary buttons.</div>
              </div>
              <div style={{ borderRadius: 14, background: theme.modal_subtle_bg, padding: "10px 12px", fontSize: 12, color: theme.surface_text }}>
                Subtle surface preview
              </div>
              <div style={{ borderRadius: 14, border: `1px solid ${theme.modal_input_border}`, background: theme.modal_input_bg, padding: "10px 12px", fontSize: 12.5, color: theme.surface_text }}>
                Search address or report number
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={{ borderRadius: 14, border: `1px solid ${theme.modal_secondary_border}`, background: theme.modal_secondary_bg, color: theme.modal_secondary_text, padding: "10px 12px", fontSize: 12, fontWeight: 800 }}>
                  Secondary
                </button>
                <button type="button" style={{ borderRadius: 14, border: "none", background: theme.modal_filled_bg, color: theme.modal_filled_text, padding: "10px 12px", fontSize: 12, fontWeight: 800 }}>
                  Primary
                </button>
              </div>
              <div style={{ borderRadius: 16, border: `1px solid ${theme.contact_tile_border}`, background: theme.contact_tile_bg, padding: "10px 12px", fontSize: 12, color: theme.surface_text }}>
                Utility Contact Tile
              </div>
            </div>
          </div>
          <div
            style={{
              background: theme.surface_bg,
              borderTop: `1px solid ${theme.surface_border}`,
              color: theme.surface_text,
              padding: "10px 12px 14px",
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {["Map", "Reports", "Alerts", "Account"].map((label, index) => (
              <div key={`${mode}-${label}-tab`} style={{ display: "grid", justifyItems: "center", gap: 4, color: index === 0 ? theme.tool_active_bg : theme.surface_text }}>
                <div style={{ width: 28, height: 28, borderRadius: 10, border: `1px solid ${index === 0 ? theme.tool_active_border : theme.tool_button_border}`, background: index === 0 ? theme.tool_active_bg : theme.tool_button_bg, color: index === 0 ? theme.tool_active_text : theme.tool_button_text, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 900 }}>
                  {label.slice(0, 1)}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }, [palette.navy900]);
  const renderMapUiThemeColorEditor = useCallback((mode, themeForm, onValueChange, onPickerChange, controlsDisabled) => {
    const theme = mapUiThemeEditorPreview?.[mode] || MAP_UI_ICON_THEME_DEFAULTS[mode];
    const modeLabel = mode === "dark" ? "Dark Mode" : "Light Mode";
    const modeBackground = mode === "dark" ? "#102445" : "#f8fbff";
    const modeBorder = mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(17,36,69,0.12)";
    return (
      <div key={`theme-editor-${mode}`} style={{ ...subPanel, display: "grid", gap: 10, background: modeBackground, border: `1px solid ${modeBorder}` }}>
        <div style={{ display: "grid", gap: 4 }}>
          <strong style={{ color: mode === "dark" ? "#f5fbff" : palette.navy900 }}>{modeLabel}</strong>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, border: `1px solid ${theme.tool_button_border}`, background: theme.tool_button_bg, color: theme.tool_button_text, display: "grid", placeItems: "center", boxShadow: "0 8px 18px rgba(15, 23, 42, 0.12)" }}>
              <span style={{ fontSize: 18, fontWeight: 900 }}>Aa</span>
            </div>
            <div style={{ width: 52, height: 52, borderRadius: 14, border: `1px solid ${theme.tool_active_border}`, background: theme.tool_active_bg, color: theme.tool_active_text, display: "grid", placeItems: "center", boxShadow: "0 8px 18px rgba(15, 23, 42, 0.12)" }}>
              <span style={{ fontSize: 18, fontWeight: 900 }}>On</span>
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {MAP_UI_THEME_FIELDS.map((field) => {
            const defaultValue = MAP_UI_ICON_THEME_DEFAULTS?.[mode]?.[field.key] || "#111111";
            const draftValue = String(themeForm?.[field.key] || "").trim();
            const usingDefault = !draftValue;
            const pickerValue = parseCssColorToPickerValue(draftValue || defaultValue, defaultValue);
            return (
              <div key={`${mode}-${field.key}`} style={{ ...subPanel, display: "grid", gap: 8, background: "rgba(255,255,255,0.72)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: palette.navy900 }}>{field.label}</span>
                  <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => onValueChange(mode, field.key, "")}
                    style={{ ...buttonAlt, padding: "6px 10px", fontSize: 11.5, opacity: controlsDisabled ? 0.55 : 1 }}
                  >
                    {usingDefault ? "Using Default" : "Use Default"}
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 10, alignItems: "center" }}>
                  <input
                    type="color"
                    value={pickerValue.hex}
                    disabled={controlsDisabled}
                    onChange={(event) => onPickerChange(mode, field.key, event.target.value, pickerValue.alphaPercent)}
                    style={{ ...modalInput, background: controlsDisabled ? "#eef4fb" : modalInput.background, padding: 4, height: 42 }}
                  />
                  <div style={{ display: "grid", gap: 6 }}>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={pickerValue.alphaPercent}
                      disabled={controlsDisabled}
                      onChange={(event) => onPickerChange(mode, field.key, pickerValue.hex, Number(event.target.value))}
                    />
                    <div style={{ fontSize: 11.5, color: palette.textMuted, display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>Opacity {pickerValue.alphaPercent}%</span>
                      <span>{usingDefault ? "Default palette" : draftValue}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [buttonAlt, mapUiThemeEditorPreview, modalInput, palette.navy900, palette.textMuted, subPanel]);
  const currentPageActions = controlPlanePage === "lead-detail" ? (
    <button type="button" style={headerActionButton} onClick={() => openControlPlanePage("manage-leads")}>
      Back to Leads
    </button>
  ) : controlPlanePage === "manage-leads" ? (
    <button
      type="button"
      style={{ ...headerActionButton, opacity: canEditLead ? 1 : 0.55 }}
      onClick={() => setLeadAddModalOpen(true)}
      disabled={!canEditLead}
      title={canEditLead ? "Add lead" : "You need the Leads edit permission"}
    >
      Add Lead
    </button>
  ) : controlPlanePage === "manage-organizations" ? (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button type="button" style={headerActionButton} onClick={openOrganizationSwitcher}>Switch Organization</button>
      <button
        type="button"
        style={{ ...headerActionButton, opacity: canCreateOrganizations ? 1 : 0.55 }}
        onClick={openAddTenantStep}
        disabled={!canCreateOrganizations}
        title={canCreateOrganizations ? "Create organization" : "You need the Organizations edit permission"}
      >
        Add Organization
      </button>
    </div>
  ) : controlPlanePage === "domain-registry" ? null : (
    controlPlanePage === "map-ui-theme" ? (
      mapUiThemeEditorOpen ? (
        <button type="button" style={headerActionButton} onClick={closeMapUiThemeEditor}>
          Back to Themes
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            style={{ ...headerActionButton, opacity: canManageDomainRegistry ? 1 : 0.55 }}
            onClick={openNewMapUiThemeEditor}
            disabled={!canManageDomainRegistry}
            title={canManageDomainRegistry ? "Create a map UI theme" : "You need the Domains edit permission"}
          >
            New Theme
          </button>
          <button
            type="button"
            style={{ ...headerActionButton, opacity: canManageDomainRegistry && !mapUiThemeSavingDraft ? 1 : 0.55 }}
            onClick={() => void resetMapUiThemeLibraryToPublished()}
            disabled={!canManageDomainRegistry || mapUiThemeSavingDraft}
          >
            Reset Drafts
          </button>
        </div>
      )
    ) : null
  );
  const controlPlaneSettingsActions = settingsPageActive && currentPageActions ? (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
      {currentPageActions}
    </div>
  ) : null;
  const controlPlaneSettingsSidebarContent = settingsPageActive ? (
    isCompactViewport ? (
      <div style={{ ...card, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 4 }}>
          <h3 style={{ margin: 0, color: palette.navy900 }}>Settings</h3>
          <p style={{ margin: 0, color: palette.textMuted, fontSize: 12.5 }}>Switch between settings categories and pages from here.</p>
        </div>
        <input
          value={controlPlaneSettingsSearch}
          onChange={(event) => setControlPlaneSettingsSearch(event.target.value)}
          placeholder="Search settings"
          aria-label="Search settings"
          style={inputBase}
        />
        <label style={{ display: "grid", gap: 6, fontSize: 12.5 }}>
          <span style={{ color: palette.textMuted }}>Settings Category</span>
          <select
            value={activeMobileSettingsGroup?.key || ""}
            onChange={(event) => setMobileSettingsGroupKey(event.target.value)}
            style={inputBase}
          >
            {filteredControlPlaneSettingsNav.map((group) => (
              <option key={group.key} value={group.key}>{group.label}</option>
            ))}
          </select>
        </label>
        {activeMobileSettingsGroup?.items?.length ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {activeMobileSettingsGroup.items.map((item) => {
              const activeItem = item.key === controlPlanePage;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openControlPlanePage(item.key)}
                  style={activeItem ? controlPlaneTabButtonActive : controlPlaneTabButton}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 12.5, color: palette.textMuted }}>
            No settings matched your search.
          </div>
        )}
      </div>
    ) : (
      <aside style={controlPlaneSettingsSidebar}>
        <div style={controlPlaneSettingsSidebarShell}>
          <div style={{ display: "grid", gap: 6 }}>
            <h3 style={{ margin: 0, color: "#f4fbfa", fontSize: 24 }}>Settings</h3>
            <p style={{ margin: 0, color: "rgba(221, 242, 239, 0.86)", fontSize: 12.5, lineHeight: 1.45 }}>
              Platform settings now follow the same left-rail pattern as the hub.
            </p>
          </div>
          <input
            value={controlPlaneSettingsSearch}
            onChange={(event) => setControlPlaneSettingsSearch(event.target.value)}
            placeholder="Search settings"
            style={{
              width: "100%",
              padding: "11px 13px",
              border: "1px solid rgba(212, 236, 232, 0.12)",
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.08)",
              color: "#effaf8",
              font: "inherit",
            }}
          />
          <div style={{ display: "grid", gap: 8 }}>
            {filteredControlPlaneSettingsNav.map((group) => {
              const open = Boolean(openControlPlaneSettingsGroups?.[group.key]);
              const active = activeSettingsGroupKey === group.key;
              return (
                <div key={group.key} style={{ padding: "4px 0", borderBottom: "1px solid rgba(221, 242, 239, 0.12)" }}>
                  <button
                    type="button"
                    onClick={() => setOpenControlPlaneSettingsGroups((prev) => ({ ...prev, [group.key]: !open }))}
                    style={{
                      ...controlPlaneSettingsGroupButton,
                      ...(active ? { background: "rgba(255, 255, 255, 0.08)", color: "#ffffff" } : null),
                    }}
                  >
                    <span>{group.label}</span>
                    <span style={{ color: "rgba(221, 242, 239, 0.68)", fontSize: 12 }}>{open ? "−" : "+"}</span>
                  </button>
                  {open ? (
                    <div style={{ display: "grid", gap: 6, marginTop: 4, paddingLeft: 14 }}>
                      {group.items.map((item) => {
                        const activeItem = item.key === controlPlanePage;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => openControlPlanePage(item.key)}
                            style={{
                              ...controlPlaneSettingsItemButton,
                              ...(activeItem
                                ? {
                                    background: "rgba(33, 141, 132, 0.9)",
                                    borderColor: "rgba(255, 255, 255, 0.08)",
                                    color: "#ffffff",
                                    boxShadow: "inset 0 0 0 1px rgba(255, 255, 255, 0.04)",
                                  }
                                : null),
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    )
  ) : null;

  const controlPlaneTabsNavigation = sessionUserId && isPlatformAdmin ? (
    <div
      ref={controlPlaneNavRef}
      style={
        isCompactViewport
          ? {
              position: "fixed",
              left: 12,
              right: 12,
              bottom: "max(12px, env(safe-area-inset-bottom))",
              zIndex: 34,
            }
          : {
              ...fullWidthSection,
              ...controlPlaneTabsRail,
              width: "calc(100% + 36px)",
              marginLeft: -18,
              marginRight: -18,
            }
      }
    >
      <div style={isCompactViewport ? controlPlaneMobileTabsShell : controlPlaneTabsShell}>
        <nav
          style={
            isCompactViewport
              ? {
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                }
              : controlPlaneTabsBar
          }
          aria-label="Platform Control Plane navigation"
        >
          {visibleControlPlaneTopNavItems.map((item) => {
            if (item.type === "page") {
              const active = item.key === controlPlanePage;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => openControlPlanePage(item.key)}
                  style={isCompactViewport
                    ? (active ? controlPlaneMobileTabButtonActive : controlPlaneMobileTabButton)
                    : (active ? controlPlaneTabButtonActive : controlPlaneTabButton)}
                >
                  <span>{item.label}</span>
                </button>
              );
            }

            const sectionPages = visibleControlPlanePagesBySection[item.key] || [];
            const active = controlPlaneSection === item.key;
            const isOpen = openControlPlaneDropdown === item.key;
            return (
              <div key={item.key} style={{ position: "relative", minWidth: 0 }} onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => openControlPlaneSection(item.key)}
                  style={isCompactViewport
                    ? ((active || isOpen) ? controlPlaneMobileTabButtonActive : controlPlaneMobileTabButton)
                    : ((active || isOpen) ? controlPlaneTabButtonActive : controlPlaneTabButton)}
                >
                  <span>{item.label}</span>
                </button>
                {isOpen ? (
                  <div
                    style={{
                      ...controlPlaneSubmenu,
                      ...(isCompactViewport ? { top: "auto", bottom: "calc(100% + 8px)", left: 0, right: 0, minWidth: 0 } : null),
                    }}
                  >
                    {sectionPages.map((page) => {
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
  ) : null;
  const controlPlanePageHeader = sessionUserId && isPlatformAdmin && controlPlanePage !== "manage-leads" && !settingsPageActive ? (
    <section style={{ ...fullWidthSection, display: "grid", gap: 12, marginTop: isCompactViewport ? 12 : "var(--app-tab-rail-title-gap)" }}>
      <div
        style={{
          ...card,
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: palette.navy900 }}>
              {controlPlanePageLabel}
            </h1>
          </div>
          {currentPageActions}
        </div>
      </div>
    </section>
  ) : null;

  if (!authReady) {
    return (
      <main style={shellStyle}>
        {fixedBanner}
        {helpModal}
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
        {helpModal}
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
        {helpModal}
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
      {helpModal}
      {contactAddModalOpen ? (
        <div style={authModalBackdrop} onClick={() => setContactAddModalOpen(false)}>
          <div style={{ ...authModalCard, width: "min(720px, calc(100vw - 24px))" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Add Contact</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Add a new additional point of contact for this organization.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContactAddModalOpen(false)}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close add contact dialog"
              >
                ×
              </button>
            </div>
            <form onSubmit={(event) => void saveAdditionalContactFromModal(event)} style={{ display: "grid", gap: 12 }}>
              <div style={contactFieldGrid}>
                <label style={modalField}>
                  <span>Name</span>
                  <input
                    value={newContactForm.name}
                    onChange={(e) => setNewContactForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Department Contact"
                    style={modalInput}
                  />
                </label>
                <label style={modalField}>
                  <span>Role / Title</span>
                  <input
                    value={newContactForm.title}
                    onChange={(e) => setNewContactForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Finance Director"
                    style={modalInput}
                  />
                </label>
                <label style={modalField}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={newContactForm.email}
                    onChange={(e) => setNewContactForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="finance@examplemunicipality.gov"
                    style={modalInput}
                  />
                </label>
                <label style={modalField}>
                  <span>Phone</span>
                  <input
                    value={newContactForm.phone}
                    onChange={(e) => setNewContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="(000) 000-0000"
                    style={modalInput}
                  />
                </label>
              </div>
              {status.profile ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.profile)}</div> : null}
              <div style={modalFooterActions}>
                <button type="submit" style={{ ...modalPrimaryButton, opacity: canEditTenantSetup ? 1 : 0.55 }} disabled={!canEditTenantSetup}>
                  Save Contact
                </button>
                <button type="button" style={modalSecondaryButton} onClick={() => setContactAddModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {platformTeamManagementView === "add" ? (
        <div style={authModalBackdrop} onClick={closePlatformTeamAddModal}>
          <div style={{ ...authModalCard, width: "min(760px, calc(100vw - 24px))" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Add Platform Team Member</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Add a platform team member by finding an existing account or creating a new invited account, then assign one platform role.
                </p>
              </div>
              <button
                type="button"
                onClick={closePlatformTeamAddModal}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close add team member dialog"
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                style={platformTeamAssignmentMode === "existing" ? modalPrimaryButton : modalToggleButton}
                onClick={() => setPlatformTeamAssignmentMode("existing")}
              >
                Find Existing Account
              </button>
              <button
                type="button"
                style={platformTeamAssignmentMode === "invite" ? modalPrimaryButton : modalToggleButton}
                onClick={() => setPlatformTeamAssignmentMode("invite")}
              >
                Create Account
              </button>
            </div>
            {platformTeamAssignmentMode === "existing" ? (
              <>
                <form onSubmit={searchPlatformTeamUsers} style={{ display: "grid", gap: 12 }}>
                  <div style={modalActionGrid}>
                    <label style={modalField}>
                      <span>Find Internal Account</span>
                      <input
                        value={platformUserSearchQuery}
                        onChange={(e) => setPlatformUserSearchQuery(e.target.value)}
                        placeholder="Exact email, exact phone, or full name"
                        style={modalInput}
                        disabled={!canManagePlatformUsers}
                      />
                    </label>
                    <div style={{ display: "grid", alignContent: "end" }}>
                      <button type="submit" style={{ ...modalPrimaryButton, opacity: canManagePlatformUsers ? 1 : 0.55 }} disabled={!canManagePlatformUsers || platformUserSearchLoading}>
                        {platformUserSearchLoading ? "Searching..." : "Search Accounts"}
                      </button>
                    </div>
                  </div>
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
                          <span>{formatUserSummaryLabel(row)}</span>
                          <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                            {[row?.email, row?.phone].filter(Boolean).join(" • ") || "No email or phone on file"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                <div style={{ display: "grid", gap: 8 }}>
                  <label style={{ ...modalField, maxWidth: 260 }}>
                    <span>Platform Role</span>
                    <select
                      value={platformTeamForm.role}
                      onChange={(e) => setPlatformTeamForm((prev) => ({ ...prev, role: e.target.value }))}
                      style={{ ...modalInput, minWidth: 0 }}
                      disabled={!canManagePlatformUsers}
                    >
                      {assignablePlatformRoles.map((row) => (
                        <option key={row.role} value={row.role}>
                          {platformRoleLabelByKey[String(row?.role || "").trim()] || platformRoleToLabel(row?.role)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div style={modalFooterActions}>
                  <button type="button" style={{ ...modalPrimaryButton, opacity: canManagePlatformUsers && platformTeamForm.user_id ? 1 : 0.55 }} disabled={!canManagePlatformUsers || !platformTeamForm.user_id} onClick={() => void assignPlatformRole()}>
                    Assign Platform Role
                  </button>
                  {platformTeamForm.user_id ? (
                    <span style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Selected account: <b>{formatPlatformUserLabel(platformTeamForm.user_id) || formatUserSummaryLabel(selectedPlatformSearchAccount)}</b>
                    </span>
                  ) : (
                    <span style={{ fontSize: 12.5, color: palette.textMuted }}>
                      For privacy, account lookup uses exact email, exact phone, or full-name matching before assignment.
                    </span>
                  )}
                </div>
              </>
            ) : (
              <form onSubmit={createAndAssignPlatformUser} style={modalActionGrid}>
                <label style={modalField}>
                  <span>First Name</span>
                  <input
                    value={platformInviteForm.first_name}
                    onChange={(e) => setPlatformInviteForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Jordan"
                    style={modalInput}
                    disabled={!canManagePlatformUsers}
                  />
                </label>
                <label style={modalField}>
                  <span>Last Name</span>
                  <input
                    value={platformInviteForm.last_name}
                    onChange={(e) => setPlatformInviteForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Rivera"
                    style={modalInput}
                    disabled={!canManagePlatformUsers}
                  />
                </label>
                <label style={modalField}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={platformInviteForm.email}
                    onChange={(e) => setPlatformInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="jordan.rivera@cityreport.io"
                    style={modalInput}
                    disabled={!canManagePlatformUsers}
                  />
                </label>
                <label style={modalField}>
                  <span>Phone</span>
                  <input
                    value={platformInviteForm.phone}
                    onChange={(e) => setPlatformInviteForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 555-0100"
                    style={modalInput}
                    disabled={!canManagePlatformUsers}
                  />
                </label>
                <label style={{ ...modalField, maxWidth: 260 }}>
                  <span>Platform Role</span>
                  <select
                    value={platformTeamForm.role}
                    onChange={(e) => setPlatformTeamForm((prev) => ({ ...prev, role: e.target.value }))}
                    style={{ ...modalInput, minWidth: 0 }}
                    disabled={!canManagePlatformUsers}
                  >
                    {assignablePlatformRoles.map((row) => (
                      <option key={row.role} value={row.role}>
                        {platformRoleLabelByKey[String(row?.role || "").trim()] || platformRoleToLabel(row?.role)}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={modalFooterActions}>
                  <button
                    type="submit"
                    style={{ ...modalPrimaryButton, opacity: canManagePlatformUsers ? 1 : 0.55 }}
                    disabled={!canManagePlatformUsers}
                  >
                    Create Account + Assign Role
                  </button>
                  <button type="button" style={modalSecondaryButton} onClick={closePlatformTeamAddModal}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
      {tenantUsersManagementView === "add" ? (
        <div style={authModalBackdrop} onClick={() => setTenantUsersManagementView("list")}>
          <div style={{ ...authModalCard, width: "min(860px, calc(100vw - 24px))" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Add User/Admin</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Add a person to this organization by finding an existing account or creating a new invited account, then assign one organization role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTenantUsersManagementView("list")}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close add user dialog"
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                style={userAssignmentMode === "existing" ? modalPrimaryButton : modalToggleButton}
                onClick={() => setUserAssignmentMode("existing")}
              >
                Find Existing Account
              </button>
              <button
                type="button"
                style={userAssignmentMode === "invite" ? modalPrimaryButton : modalToggleButton}
                onClick={() => setUserAssignmentMode("invite")}
              >
                Create Account
              </button>
            </div>
            {userAssignmentMode === "existing" ? (
              <>
                <form onSubmit={searchPlatformUsers} style={modalActionGrid}>
                  <label style={modalField}>
                    <span>Find Person</span>
                    <input
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Exact email, exact phone, or full name"
                      style={{ ...modalInput, fontSize: 16 }}
                      disabled={!canManageTenantUsers}
                    />
                  </label>
                  <button
                    type="submit"
                    style={{ ...modalPrimaryButton, opacity: canManageTenantUsers ? 1 : 0.55 }}
                    disabled={!canManageTenantUsers || userSearchLoading}
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
                  <label style={{ ...modalField, maxWidth: 260 }}>
                    <span>Organization Role</span>
                    <select
                      value={assignForm.role}
                      onChange={(e) => setAssignForm((p) => ({ ...p, role: e.target.value }))}
                      style={{ ...modalInput, minWidth: 0 }}
                      disabled={!canManageTenantUsers}
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

                <div style={modalFooterActions}>
                  <button
                    type="button"
                    onClick={() => void assignTenantAdmin({ preventDefault() {} })}
                    style={{ ...modalPrimaryButton, opacity: canManageTenantUsers && assignForm.user_id ? 1 : 0.55 }}
                    disabled={!canManageTenantUsers || !assignForm.user_id}
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
              <form onSubmit={createAndAssignTenantUser} style={modalActionGrid}>
                <label style={modalField}>
                  <span>First Name</span>
                  <input
                    value={inviteForm.first_name}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    placeholder="Jordan"
                    style={modalInput}
                    disabled={!canManageTenantUsers}
                  />
                </label>
                <label style={modalField}>
                  <span>Last Name</span>
                  <input
                    value={inviteForm.last_name}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    placeholder="Rivera"
                    style={modalInput}
                    disabled={!canManageTenantUsers}
                  />
                </label>
                <label style={modalField}>
                  <span>Email</span>
                  <input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="jordan.rivera@example.gov"
                    style={modalInput}
                    disabled={!canManageTenantUsers}
                  />
                </label>
                <label style={modalField}>
                  <span>Phone Number</span>
                  <input
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 555-0101"
                    style={modalInput}
                    disabled={!canManageTenantUsers}
                  />
                </label>
                <label style={modalField}>
                  <span>Organization Role</span>
                  <select
                    value={assignForm.role}
                    onChange={(e) => setAssignForm((p) => ({ ...p, role: e.target.value }))}
                    style={modalInput}
                    disabled={!canManageTenantUsers}
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
                  style={{ ...modalPrimaryButton, opacity: canManageTenantUsers ? 1 : 0.55 }}
                  disabled={!canManageTenantUsers}
                  title={canManageTenantUsers ? "Create account and assign organization role" : "You need the Users edit permission"}
                >
                  Create Account + Assign Role
                </button>
              </form>
            )}
            {status.users ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.users)}</div> : null}
            <div style={modalFooterActions}>
              <button type="button" style={modalSecondaryButton} onClick={() => setTenantUsersManagementView("list")}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {tenantRoleManagementView === "add" ? (
        <div style={authModalBackdrop} onClick={() => setTenantRoleManagementView("list")}>
          <div style={{ ...authModalCard, width: "min(720px, calc(100vw - 24px))" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Add Role</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Create a custom role for {selectedTenantKey}, then manage its permissions from the roles workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTenantRoleManagementView("list")}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close add role dialog"
              >
                ×
              </button>
            </div>
            <form onSubmit={createTenantRole} style={{ display: "grid", gap: 12 }}>
              <div style={modalActionGrid}>
                <label style={modalField}>
                  <span>Role Key</span>
                  <input
                    value={roleForm.role}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, role: sanitizeRoleKey(e.target.value) }))}
                    placeholder="field_supervisor"
                    style={modalInput}
                    disabled={!canManageTenantRoles}
                  />
                </label>
                <label style={modalField}>
                  <span>Role Label</span>
                  <input
                    value={roleForm.role_label}
                    onChange={(e) => setRoleForm((prev) => ({ ...prev, role_label: e.target.value }))}
                    placeholder="Field Supervisor"
                    style={modalInput}
                    disabled={!canManageTenantRoles}
                  />
                </label>
              </div>
              {status.roles ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.roles)}</div> : null}
              <div style={modalFooterActions}>
                <button
                  type="submit"
                  style={{ ...modalPrimaryButton, opacity: canManageTenantRoles ? 1 : 0.55 }}
                  disabled={!canManageTenantRoles}
                  title={canManageTenantRoles ? "Create role" : "You need the Roles edit permission"}
                >
                  Create Role
                </button>
                <button type="button" style={modalSecondaryButton} onClick={() => setTenantRoleManagementView("list")}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {tenantRoleDeleteConfirmOpen && pendingTenantRoleDelete ? (
        <div style={authModalBackdrop} onClick={() => !tenantRoleDeleteLoading && setTenantRoleDeleteConfirmOpen(false)}>
          <div style={authModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Delete Role</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  {`Remove ${toOrganizationLanguage(String(pendingTenantRoleDelete?.role_label || pendingTenantRoleDelete?.role || "").trim() || "this role")} from this organization?`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !tenantRoleDeleteLoading && setTenantRoleDeleteConfirmOpen(false)}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close role delete dialog"
                disabled={tenantRoleDeleteLoading}
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 8, fontSize: 13, color: palette.text }}>
              <div><strong>Role:</strong> {toOrganizationLanguage(String(pendingTenantRoleDelete?.role_label || pendingTenantRoleDelete?.role || "").trim() || "Not set")}</div>
              <div><strong>Role Key:</strong> {String(pendingTenantRoleDelete?.role || "").trim() || "Not set"}</div>
              <div><strong>Type:</strong> {pendingTenantRoleDelete?.is_system ? "System role" : "Custom role"}</div>
              <div><strong>Assignments:</strong> {selectedRoleAssignmentCount}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...buttonBase, minWidth: 150, background: `linear-gradient(180deg, ${palette.red600} 0%, #a12626 100%)`, borderColor: palette.red600 }}
                disabled={tenantRoleDeleteLoading || !canDeleteTenantRoles}
                onClick={() => void removeTenantRole(pendingTenantRoleDelete)}
              >
                {tenantRoleDeleteLoading ? "Deleting..." : "Delete Role"}
              </button>
              <button
                type="button"
                style={{ ...buttonAlt, minWidth: 120 }}
                onClick={() => setTenantRoleDeleteConfirmOpen(false)}
                disabled={tenantRoleDeleteLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {platformRoleAddModalOpen ? (
        <div style={authModalBackdrop} onClick={() => setPlatformRoleAddModalOpen(false)}>
          <div style={{ ...authModalCard, width: "min(720px, calc(100vw - 24px))" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Create Role</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Create a custom PCP role, then manage its permissions from the roles workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlatformRoleAddModalOpen(false)}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close create role dialog"
              >
                ×
              </button>
            </div>
            <form onSubmit={(event) => void createPlatformRole(event)} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 10 }}>
                <label style={modalField}>
                  <span>Role Name</span>
                  <input
                    value={platformRoleForm.role_label}
                    onChange={(e) => setPlatformRoleForm((prev) => ({ ...prev, role_label: e.target.value }))}
                    placeholder="Revenue Operations"
                    style={modalInput}
                    disabled={!canManagePlatformRoles}
                  />
                </label>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                  Internal role keys are generated automatically from the role name.
                </div>
              </div>
              {platformRoleStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{platformRoleStatus}</div> : null}
              <div style={modalFooterActions}>
                <button
                  type="submit"
                  style={{ ...modalPrimaryButton, opacity: canManagePlatformRoles ? 1 : 0.55 }}
                  disabled={!canManagePlatformRoles}
                  title={canManagePlatformRoles ? "Create role" : "You need the Roles edit permission"}
                >
                  Create Role
                </button>
                <button type="button" style={modalSecondaryButton} onClick={() => setPlatformRoleAddModalOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {platformRoleDeleteConfirmOpen && selectedPlatformRoleDefinition ? (
        <div style={authModalBackdrop} onClick={() => !platformRoleDeleteLoading && setPlatformRoleDeleteConfirmOpen(false)}>
          <div style={authModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Delete Role</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Remove {platformRoleLabelByKey[String(selectedPlatformRoleDefinition?.role || "").trim()] || platformRoleToLabel(selectedPlatformRoleDefinition?.role)} from PCP roles?
                </p>
              </div>
              <button
                type="button"
                onClick={() => !platformRoleDeleteLoading && setPlatformRoleDeleteConfirmOpen(false)}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close platform role delete dialog"
                disabled={platformRoleDeleteLoading}
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 8, fontSize: 13, color: palette.text }}>
              <div><strong>Role:</strong> {platformRoleLabelByKey[String(selectedPlatformRoleDefinition?.role || "").trim()] || platformRoleToLabel(selectedPlatformRoleDefinition?.role)}</div>
              <div><strong>Role Key:</strong> {String(selectedPlatformRoleDefinition?.role || "").trim() || "Not set"}</div>
              <div><strong>Type:</strong> {selectedPlatformRoleDefinition?.is_system ? "System role" : "Custom role"}</div>
              <div><strong>Assignments:</strong> {selectedPlatformRoleAssignmentCount}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...buttonBase, minWidth: 150, background: `linear-gradient(180deg, ${palette.red600} 0%, #a12626 100%)`, borderColor: palette.red600 }}
                disabled={platformRoleDeleteLoading || !canDeletePlatformRoles}
                onClick={() => void removePlatformRoleDefinition(selectedPlatformRoleDefinition)}
              >
                {platformRoleDeleteLoading ? "Deleting..." : "Delete Role"}
              </button>
              <button
                type="button"
                style={{ ...buttonAlt, minWidth: 120 }}
                onClick={() => setPlatformRoleDeleteConfirmOpen(false)}
                disabled={platformRoleDeleteLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {leadAddModalOpen ? (
        <div style={authModalBackdrop} onClick={() => !leadLoading && setLeadAddModalOpen(false)}>
          <div style={{ ...authModalCard, width: "min(760px, calc(100vw - 24px))" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Add Lead</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Create a platform lead manually and place it directly into the PCP lead pipeline.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !leadLoading && setLeadAddModalOpen(false)}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close add lead dialog"
                disabled={leadLoading}
              >
                ×
              </button>
            </div>
            <form onSubmit={createPlatformLead} style={{ display: "grid", gap: 12 }}>
              <div style={modalActionGrid}>
                <label style={modalField}>
                  <span>Contact Name</span>
                  <input value={leadForm.full_name} onChange={(e) => setLeadForm((prev) => ({ ...prev, full_name: e.target.value }))} placeholder="Jordan Rivera" style={modalInput} />
                </label>
                <label style={modalField}>
                  <span>Work Email</span>
                  <input value={leadForm.work_email} onChange={(e) => setLeadForm((prev) => ({ ...prev, work_email: e.target.value }))} placeholder="jordan.rivera@example.gov" style={modalInput} />
                </label>
                <label style={modalField}>
                  <span>Organization</span>
                  <input value={leadForm.city_agency} onChange={(e) => setLeadForm((prev) => ({ ...prev, city_agency: e.target.value }))} placeholder="Ashtabula Public Works" style={modalInput} />
                </label>
                <label style={modalField}>
                  <span>Role / Title</span>
                  <input value={leadForm.role_title} onChange={(e) => setLeadForm((prev) => ({ ...prev, role_title: e.target.value }))} placeholder="Deputy Director" style={modalInput} />
                </label>
                <label style={modalField}>
                  <span>Priority Domain</span>
                  <select value={leadForm.priority_domain} onChange={(e) => setLeadForm((prev) => ({ ...prev, priority_domain: e.target.value }))} style={modalInput}>
                    {[...DOMAIN_OPTIONS, { key: "other", label: "Other" }].map((domain) => (
                      <option key={domain.key} value={domain.key}>{domain.label}</option>
                    ))}
                  </select>
                </label>
                <label style={modalField}>
                  <span>Status</span>
                  <select value={leadForm.status} onChange={(e) => setLeadForm((prev) => ({ ...prev, status: e.target.value }))} style={modalInput}>
                    <option value="new">New</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </div>
              <label style={modalField}>
                <span>Notes</span>
                <textarea value={leadForm.notes} onChange={(e) => setLeadForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="Add lead context, priorities, or follow-up notes." style={{ ...modalInput, minHeight: 110 }} />
              </label>
              {leadStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{leadStatus}</div> : null}
              <div style={modalFooterActions}>
                <button type="submit" style={{ ...modalPrimaryButton, opacity: canEditLead ? 1 : 0.55 }} disabled={!canEditLead || leadLoading}>
                  {leadLoading ? "Creating..." : "Create Lead"}
                </button>
                <button type="button" style={modalSecondaryButton} onClick={() => setLeadAddModalOpen(false)} disabled={leadLoading}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {tenantAssetsManagementView === "add" ? (
        <div style={authModalBackdrop} onClick={() => setTenantAssetsManagementView("list")}>
          <div style={{ ...authModalCard, width: "min(760px, calc(100vw - 24px))" }} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Add Asset</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Upload a new organization asset such as prior report information, coordinates, or boundary/location files.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTenantAssetsManagementView("list")}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close add asset dialog"
              >
                ×
              </button>
            </div>
            <form onSubmit={uploadTenantFile} style={{ display: "grid", gap: 12 }}>
              <div style={modalActionGrid}>
                <label style={modalField}>
                  <span>Asset Category</span>
                  <select
                    value={fileForm.category}
                    onChange={(e) => setFileForm((p) => ({
                      ...p,
                      category: e.target.value,
                      asset_subtype: e.target.value === "asset_coordinates" ? p.asset_subtype : "",
                    }))}
                    style={modalInput}
                  >
                    {TENANT_ASSET_CATEGORIES.map((category) => (
                      <option key={category.key} value={category.key}>{category.label}</option>
                    ))}
                  </select>
                </label>
                {fileForm.category === "asset_coordinates" ? (
                  <label style={modalField}>
                    <span>Related Domain</span>
                    <select
                      value={fileForm.asset_subtype || ""}
                      onChange={(e) => setFileForm((p) => ({ ...p, asset_subtype: e.target.value }))}
                      style={modalInput}
                    >
                      <option value="">Select domain</option>
                      {DOMAIN_OPTIONS.map((domain) => (
                        <option key={domain.key} value={domain.key}>{domain.label}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label style={modalField}>
                  <span>Asset File</span>
                  <input type="file" onChange={(e) => setFileForm((p) => ({ ...p, file: e.target.files?.[0] || null }))} style={modalInput} />
                </label>
                <label style={modalField}>
                  <span>Notes</span>
                  <input value={fileForm.notes} onChange={(e) => setFileForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" style={modalInput} />
                </label>
              </div>
              {status.files ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.files)}</div> : null}
              <div style={modalFooterActions}>
                <button type="submit" style={{ ...modalPrimaryButton, opacity: canEditTenantFiles ? 1 : 0.55 }} disabled={!canEditTenantFiles}>
                  Upload Asset
                </button>
                <button type="button" style={modalSecondaryButton} onClick={() => setTenantAssetsManagementView("list")}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {contactDeleteConfirmIndex != null ? (
        <div style={authModalBackdrop} onClick={() => !contactDeleteLoading && setContactDeleteConfirmIndex(null)}>
          <div style={authModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Delete Contact</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Remove {String(pendingContactDelete?.name || "").trim() || `Contact ${Number(contactDeleteConfirmIndex) + 1}`} from this organization&apos;s points of contact?
                </p>
              </div>
              <button
                type="button"
                onClick={() => !contactDeleteLoading && setContactDeleteConfirmIndex(null)}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close contact delete dialog"
                disabled={contactDeleteLoading}
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 8, fontSize: 13, color: palette.text }}>
              <div><strong>Name:</strong> {String(pendingContactDelete?.name || "").trim() || "Not set"}</div>
              <div><strong>Role / Title:</strong> {String(pendingContactDelete?.title || "").trim() || "Not set"}</div>
              <div><strong>Email:</strong> {String(pendingContactDelete?.email || "").trim() || "Not set"}</div>
              <div><strong>Phone:</strong> {String(pendingContactDelete?.phone || "").trim() || "Not set"}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...buttonBase, minWidth: 150, background: `linear-gradient(180deg, ${palette.red600} 0%, #a12626 100%)`, borderColor: palette.red600 }}
                disabled={contactDeleteLoading || !canEditTenantSetup}
                onClick={() => void confirmAdditionalContactDelete()}
              >
                {contactDeleteLoading ? "Deleting..." : "Delete Contact"}
              </button>
              <button
                type="button"
                style={{ ...buttonAlt, minWidth: 120 }}
                onClick={() => setContactDeleteConfirmIndex(null)}
                disabled={contactDeleteLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {platformTeamDeleteConfirmRow ? (
        <div style={authModalBackdrop} onClick={() => !platformTeamDeleteLoading && setPlatformTeamDeleteConfirmRow(null)}>
          <div style={authModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Remove Team Member</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Remove {formatPlatformUserLabel(platformTeamDeleteConfirmRow?.user_id)} from the {platformRoleLabelByKey[String(platformTeamDeleteConfirmRow?.role || "").trim()] || platformRoleToLabel(platformTeamDeleteConfirmRow?.role)} role?
                </p>
              </div>
              <button
                type="button"
                onClick={() => !platformTeamDeleteLoading && setPlatformTeamDeleteConfirmRow(null)}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close team member removal dialog"
                disabled={platformTeamDeleteLoading}
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 8, fontSize: 13, color: palette.text }}>
              <div><strong>Team Member:</strong> {formatPlatformUserLabel(platformTeamDeleteConfirmRow?.user_id)}</div>
              <div><strong>Role:</strong> {platformRoleLabelByKey[String(platformTeamDeleteConfirmRow?.role || "").trim()] || platformRoleToLabel(platformTeamDeleteConfirmRow?.role)}</div>
              <div><strong>Updated:</strong> {platformTeamDeleteConfirmRow?.updated_at ? new Date(platformTeamDeleteConfirmRow.updated_at).toLocaleString() : "-"}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...buttonBase, minWidth: 160, background: `linear-gradient(180deg, ${palette.red600} 0%, #a12626 100%)`, borderColor: palette.red600 }}
                disabled={platformTeamDeleteLoading || !canRemovePlatformUsers}
                onClick={() => void removePlatformRole(platformTeamDeleteConfirmRow)}
              >
                {platformTeamDeleteLoading ? "Removing..." : "Remove Team Member"}
              </button>
              <button
                type="button"
                style={{ ...buttonAlt, minWidth: 120 }}
                onClick={() => setPlatformTeamDeleteConfirmRow(null)}
                disabled={platformTeamDeleteLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {contractInfoOpen ? (
        <div style={authModalBackdrop} onClick={() => setContractInfoOpen(false)}>
          <div style={authModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>Contract Info</h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  Contract details for {selectedTenantPublicDisplayName || selectedTenantOrganizationName || selectedTenantKey}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContractInfoOpen(false)}
                style={{ ...buttonAlt, minWidth: 0, width: 34, height: 34, padding: 0, borderRadius: 10, fontSize: 18, lineHeight: 1 }}
                aria-label="Close contract info dialog"
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 8, fontSize: 13, color: palette.text }}>
              <div><strong>Status:</strong> {toOrganizationLanguage(String(profileForm.contract_status || "pending"))}</div>
              <div><strong>Start:</strong> {profileForm.contract_start_date || "Not set"}</div>
              <div><strong>End:</strong> {profileForm.contract_end_date || "Not set"}</div>
              <div><strong>Renewal:</strong> {profileForm.renewal_date || "Not set"}</div>
              <div><strong>Billing Email:</strong> {profileForm.billing_email || "Not set"}</div>
              <div><strong>Notes:</strong> {profileForm.notes || "No contract notes saved."}</div>
            </div>
          </div>
        </div>
      ) : null}
      {controlPlaneTabsNavigation}
      {controlPlanePageHeader}
      {controlPlanePage === "organization-reports" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          <div style={{ ...card, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 13.5, color: palette.textMuted }}>
              Platform-wide organization coverage and organization status reporting.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 10 }}>
              {organizationReportFilters.map((filter) => {
                const isActiveFilter = filter.key === activeOrganizationReportFilter?.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    style={{
                      ...metricCardButton,
                      border: isActiveFilter ? `1px solid ${palette.mint700}` : metricCardButton.border,
                      background: isActiveFilter ? "rgba(18,128,106,0.08)" : metricCardButton.background,
                    }}
                    onClick={() => setOrganizationReportFilter(filter.key)}
                  >
                    <div style={{ fontSize: 13, fontWeight: 800, color: palette.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{filter.label}</div>
                    <div style={{ fontSize: 34, fontWeight: 900, color: palette.navy900 }}>{filter.value}</div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>{filter.note}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ ...card, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Organizations</h2>
              <div style={{ fontSize: 13, color: palette.textMuted }}>
                Showing {filteredOrganizationReportRows.length} organization{filteredOrganizationReportRows.length === 1 ? "" : "s"} for {activeOrganizationReportFilter?.label?.toLowerCase() || "all organizations"}.
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCell}>Organization Name</th>
                    <th style={tableHeadCell}>Admins</th>
                    <th style={tableHeadCell}>Employees</th>
                    <th style={tableHeadCell}>Pilot</th>
                    <th style={tableHeadCell}>Status</th>
                    <th style={tableHeadCell}>Assigned Domains</th>
                    <th style={tableHeadCell}>Enabled Domains</th>
                    <th style={tableHeadCell}>Hub Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrganizationReportRows.map((row) => (
                    <tr key={row.tenant_key}>
                      <td style={{ padding: "10px 0" }}>
                        <div style={{ display: "grid", gap: 2 }}>
                          <span style={{ fontWeight: 800, color: palette.navy900 }}>{row.organization_name}</span>
                          {row.public_display_name && row.public_display_name !== row.organization_name ? (
                            <span style={{ fontSize: 11.5, color: palette.textMuted }}>{row.public_display_name}</span>
                          ) : null}
                        </div>
                      </td>
                      <td style={{ padding: "10px 0" }}>{row.admin_count}</td>
                      <td style={{ padding: "10px 0" }}>{row.employee_count}</td>
                      <td style={{ padding: "10px 0" }}>{row.is_pilot ? "Yes" : "No"}</td>
                      <td style={{ padding: "10px 0" }}>{row.status_label}</td>
                      <td style={{ padding: "10px 0" }}>{row.assigned_domain_count}</td>
                      <td style={{ padding: "10px 0" }}>{row.enabled_domain_count}</td>
                      <td style={{ padding: "10px 0" }}>{row.hub_enabled ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {!filteredOrganizationReportRows.length ? (
                    <tr>
                      <td colSpan={8} style={{ padding: "10px 0", color: palette.textMuted }}>
                        No organizations match this report category yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
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
        <section style={controlPlaneSettingsSectionStyle}>
          <div style={controlPlaneSettingsLayoutStyle}>
            {controlPlaneSettingsSidebarContent}
            <div style={controlPlaneSettingsContentPaneStyle}>
              {controlPlaneSettingsActions}
              <div style={{ ...card, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>Account Info</h2>
                  {platformAccountEditMode ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={{ ...buttonBase, opacity: platformAccountSaving ? 0.7 : 1 }}
                        disabled={platformAccountSaving}
                        onClick={() => void savePlatformAccountInfo()}
                      >
                        {platformAccountSaving ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        style={buttonAlt}
                        disabled={platformAccountSaving}
                        onClick={() => {
                          setPlatformAccountEditMode(false);
                          setPlatformAccountDraft({
                            full_name: sessionActorName || sessionDisplayName || "",
                            phone: sessionPhone || "",
                          });
                          setPlatformAccountStatus("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      style={buttonAlt}
                      onClick={() => {
                        setPlatformAccountEditMode(true);
                        setPlatformAccountDraft({
                          full_name: sessionActorName || sessionDisplayName || "",
                          phone: sessionPhone || "",
                        });
                        setPlatformAccountStatus("");
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
                {platformAccountStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{platformAccountStatus}</div> : null}
                <div style={responsiveTwoColGrid}>
                  <div style={{ ...metricCard, minHeight: 78, gap: 3, padding: 10 }}>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>Name</div>
                    {platformAccountEditMode ? (
                      <input
                        value={platformAccountDraft.full_name}
                        onChange={(e) => setPlatformAccountDraft((prev) => ({ ...prev, full_name: e.target.value }))}
                        style={{ ...inputBase, minHeight: 38, fontSize: 15 }}
                        placeholder="Full name"
                        disabled={platformAccountSaving}
                      />
                    ) : (
                      <div style={{ fontSize: 18, fontWeight: 800, color: palette.navy900 }}>{sessionDisplayName || "Platform User"}</div>
                    )}
                  </div>
                  <div style={{ ...metricCard, minHeight: 78, gap: 3, padding: 10 }}>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>Email</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: palette.navy900 }}>{sessionEmail || "No email on file"}</div>
                  </div>
                  <div style={{ ...metricCard, minHeight: 78, gap: 3, padding: 10 }}>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>Phone</div>
                    {platformAccountEditMode ? (
                      <input
                        value={platformAccountDraft.phone}
                        onChange={(e) => setPlatformAccountDraft((prev) => ({ ...prev, phone: e.target.value }))}
                        style={{ ...inputBase, minHeight: 38, fontSize: 15 }}
                        placeholder="(555) 555-0100"
                        disabled={platformAccountSaving}
                      />
                    ) : (
                      <div style={{ fontSize: 16, fontWeight: 700, color: palette.navy900 }}>{sessionPhone || "Not set"}</div>
                    )}
                  </div>
                </div>
                <div style={{ ...subPanel, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <h3 style={{ margin: 0, color: palette.navy900 }}>PIN Security Checkpoint</h3>
                      <p style={{ margin: 0, color: palette.textMuted, fontSize: 12.5 }}>
                        Manage your personal PCP PIN here. Existing PIN changes require your current PIN or your account password.
                      </p>
                    </div>
                    {platformSecurityPinEditMode ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={{ ...buttonBase, opacity: canManagePlatformSecurity ? 1 : 0.55 }}
                          onClick={() => void savePlatformSecurityPin()}
                          disabled={!canManagePlatformSecurity || platformSecuritySaving.pin}
                        >
                          {platformSecuritySaving.pin ? "Saving..." : "Save PIN"}
                        </button>
                        <button
                          type="button"
                          style={buttonAlt}
                          disabled={platformSecuritySaving.pin}
                          onClick={() => {
                            setPlatformSecurityPinEditMode(false);
                            setPlatformSecurityPinDraft(DEFAULT_PLATFORM_SECURITY_PIN_DRAFT);
                            setShowPlatformSecurityPin(false);
                            setShowPlatformSecurityPinConfirm(false);
                            setShowPlatformSecurityCurrentPin(false);
                            setShowPlatformSecurityAccountPassword(false);
                            setPlatformSecurityStatus("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        style={{ ...buttonAlt, opacity: canManagePlatformSecurity ? 1 : 0.55 }}
                        disabled={!canManagePlatformSecurity}
                        onClick={() => {
                          setPlatformSecurityPinEditMode(true);
                          setPlatformSecurityPinDraft(DEFAULT_PLATFORM_SECURITY_PIN_DRAFT);
                          setPlatformSecurityStatus("");
                        }}
                        title={canManagePlatformSecurity ? "Edit PIN" : "You need the Security edit permission"}
                      >
                        Edit PIN
                      </button>
                    )}
                  </div>
                  {platformSecurityStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{platformSecurityStatus}</div> : null}
                  <div style={responsiveTwoColGrid}>
                    <div style={{ ...metricCard, minHeight: 78, gap: 3, padding: 10 }}>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>PIN Requirement</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: palette.navy900 }}>
                        Controlled in Security Checks
                      </div>
                    </div>
                    <div style={{ ...metricCard, minHeight: 78, gap: 3, padding: 10 }}>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>Current PIN</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: palette.navy900 }}>
                        {platformSecurityPinMeta.pin_hash ? "Configured" : "Not set"}
                      </div>
                    </div>
                  </div>
                  {platformSecurityPinEditMode ? (
                    <>
                      <div style={{ display: "grid", gap: 10, gridTemplateColumns: isCompactViewport ? "1fr" : "repeat(2, minmax(0, 1fr))" }}>
                        <label style={{ ...modalField, margin: 0 }}>
                          <span>New PIN</span>
                          <div style={{ position: "relative" }}>
                            <input
                              type={showPlatformSecurityPin ? "text" : "password"}
                              inputMode="numeric"
                              maxLength={4}
                              value={platformSecurityPinDraft.pin}
                              onChange={(event) => setPlatformSecurityPinDraft((prev) => ({ ...prev, pin: event.target.value.replace(/\D/g, "").slice(0, 4) }))}
                              placeholder="4-digit PIN"
                              style={{ ...modalInput, paddingRight: 74 }}
                              disabled={!canManagePlatformSecurity || platformSecuritySaving.pin}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPlatformSecurityPin((prev) => !prev)}
                              style={{
                                position: "absolute",
                                right: 12,
                                top: "50%",
                                transform: "translateY(-50%)",
                                border: "none",
                                background: "transparent",
                                color: "#1f6fd6",
                                fontWeight: 800,
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              {showPlatformSecurityPin ? "Hide" : "Show"}
                            </button>
                          </div>
                        </label>
                        <label style={{ ...modalField, margin: 0 }}>
                          <span>Confirm New PIN</span>
                          <div style={{ position: "relative" }}>
                            <input
                              type={showPlatformSecurityPinConfirm ? "text" : "password"}
                              inputMode="numeric"
                              maxLength={4}
                              value={platformSecurityPinDraft.confirm_pin}
                              onChange={(event) => setPlatformSecurityPinDraft((prev) => ({ ...prev, confirm_pin: event.target.value.replace(/\D/g, "").slice(0, 4) }))}
                              placeholder="Re-enter PIN"
                              style={{ ...modalInput, paddingRight: 74 }}
                              disabled={!canManagePlatformSecurity || platformSecuritySaving.pin}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPlatformSecurityPinConfirm((prev) => !prev)}
                              style={{
                                position: "absolute",
                                right: 12,
                                top: "50%",
                                transform: "translateY(-50%)",
                                border: "none",
                                background: "transparent",
                                color: "#1f6fd6",
                                fontWeight: 800,
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              {showPlatformSecurityPinConfirm ? "Hide" : "Show"}
                            </button>
                          </div>
                        </label>
                        {platformSecurityPinMeta.pin_hash ? (
                          <>
                            <label style={{ ...modalField, margin: 0 }}>
                              <span>Current PIN</span>
                              <div style={{ position: "relative" }}>
                                <input
                                  type={showPlatformSecurityCurrentPin ? "text" : "password"}
                                  inputMode="numeric"
                                  maxLength={4}
                                  value={platformSecurityPinDraft.current_pin}
                                  onChange={(event) => setPlatformSecurityPinDraft((prev) => ({ ...prev, current_pin: event.target.value.replace(/\D/g, "").slice(0, 4) }))}
                                  placeholder="Current PIN"
                                  style={{ ...modalInput, paddingRight: 74 }}
                                  disabled={!canManagePlatformSecurity || platformSecuritySaving.pin}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPlatformSecurityCurrentPin((prev) => !prev)}
                                  style={{
                                    position: "absolute",
                                    right: 12,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    border: "none",
                                    background: "transparent",
                                    color: "#1f6fd6",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  {showPlatformSecurityCurrentPin ? "Hide" : "Show"}
                                </button>
                              </div>
                            </label>
                            <label style={{ ...modalField, margin: 0 }}>
                              <span>Account Password</span>
                              <div style={{ position: "relative" }}>
                                <input
                                  type={showPlatformSecurityAccountPassword ? "text" : "password"}
                                  value={platformSecurityPinDraft.account_password}
                                  onChange={(event) => setPlatformSecurityPinDraft((prev) => ({ ...prev, account_password: event.target.value }))}
                                  placeholder="Current account password"
                                  style={{ ...modalInput, paddingRight: 74 }}
                                  disabled={!canManagePlatformSecurity || platformSecuritySaving.pin}
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowPlatformSecurityAccountPassword((prev) => !prev)}
                                  style={{
                                    position: "absolute",
                                    right: 12,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    border: "none",
                                    background: "transparent",
                                    color: "#1f6fd6",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  {showPlatformSecurityAccountPassword ? "Hide" : "Show"}
                                </button>
                              </div>
                            </label>
                          </>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        {platformSecurityPinMeta.pin_hash
                          ? "Enter your current PIN or your account password to confirm PIN changes. Security Checks decides which PCP actions will prompt for your PIN."
                          : "Set your 4-digit PIN here. Security Checks decides which PCP actions will prompt for your PIN."}
                      </div>
                    </>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    style={buttonBase}
                    onClick={() => {
                      setPlatformAccountStatus("");
                      setChangePasswordError("");
                      setChangePasswordDraft({
                        current_password: "",
                        new_password: "",
                        confirm_new_password: "",
                      });
                      setShowChangePasswordNew(false);
                      setShowChangePasswordConfirm(false);
                      setShowChangePasswordCurrent(false);
                      setChangePasswordOpen(true);
                    }}
                  >
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "domain-registry" ? (
        <section style={controlPlaneSettingsSectionStyle}>
          <div style={controlPlaneSettingsLayoutStyle}>
            {controlPlaneSettingsSidebarContent}
            <div style={controlPlaneSettingsContentPaneStyle}>
              {controlPlaneSettingsActions}
              <div style={{ ...card, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <h2 style={{ margin: 0, color: palette.navy900 }}>Global Domain Registry</h2>
                    <p style={{ margin: 0, color: palette.textMuted }}>
                      Create reusable reportable domains once at the platform level, then assign them to organizations later with tenant-specific routing, billing, and operational settings.
                    </p>
                  </div>
                  <button
                    type="button"
                    style={{
                      ...buttonBase,
                      marginLeft: "auto",
                      alignSelf: "flex-start",
                      opacity: canManageDomainRegistry && !domainRegistrySaving ? 1 : 0.55,
                      background: `linear-gradient(180deg, ${palette.mint600} 0%, ${palette.mint700} 100%)`,
                      border: `1px solid ${palette.mint700}`,
                      boxShadow: "0 10px 20px rgba(15,110,92,0.24)",
                    }}
                    onClick={beginCreateDomainDefinition}
                    disabled={!canManageDomainRegistry || domainRegistrySaving}
                    title={canManageDomainRegistry ? "Create a global domain" : "You need the Domains edit permission"}
                  >
                    New Global Domain
                  </button>
                </div>
                {status.domainRegistry ? (
                  <div style={{ fontSize: 12.5, color: status.domainRegistry.startsWith("Error:") ? palette.red600 : palette.mint700 }}>
                    {status.domainRegistry}
                  </div>
                ) : null}
                {!domainRegistrySchemaReady ? (
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                    Domain registry tables are not available yet in this environment. Run the latest Supabase migration locally before using this page.
                  </div>
                ) : null}
                {domainRegistryEditorOpen && !editingDomainDefinitionKey ? renderDomainRegistryEditor() : null}
                <div style={{ display: "grid", gap: 10 }}>
                  {visibleDomainRegistryRows.length ? visibleDomainRegistryRows.map((domain) => {
                    const isExpanded = editingDomainDefinitionKey === domain.key && domainRegistryEditorOpen;
                    return (
                    <div
                      key={domain.key}
                      style={{
                        ...subPanel,
                        display: "grid",
                        gap: 8,
                        background: "rgba(255,255,255,0.7)",
                        borderColor: "rgba(17,36,69,0.12)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                          {domain.icon_src ? (
                            <div style={{ width: 56, height: 56, borderRadius: 16, border: "1px solid rgba(17,36,69,0.12)", background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
                              <img
                                src={domain.icon_src}
                                alt={`${domain.label} icon`}
                                style={{ width: 40, height: 40, objectFit: "contain" }}
                              />
                            </div>
                          ) : null}
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ color: palette.navy900 }}>{domain.label}</strong>
                              <span style={{ fontSize: 11.5, fontWeight: 800, color: domain.status === "draft" ? palette.navy700 : palette.mint700, background: domain.status === "draft" ? "rgba(17,36,69,0.1)" : "rgba(18,128,106,0.12)", borderRadius: 999, padding: "4px 10px" }}>
                                {domain.status}
                              </span>
                              <span style={{ fontSize: 11.5, fontWeight: 800, color: palette.navy500, background: "rgba(46,98,143,0.12)", borderRadius: 999, padding: "4px 10px" }}>
                                {domain.domain_class === "asset_backed" ? "Asset-Backed" : "Incident-Driven"}
                              </span>
                            </div>
                            <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                              <code>{domain.key}</code>
                              {domain.report_prefix ? ` • Prefix ${domain.report_prefix}` : ""}
                              {domain.allow_report_images ? " • Photos enabled" : ""}
                              {domain.road_required ? " • Road required" : ""}
                              {domain.icon_key ? ` • Icon ${domain.icon_key}` : domain.icon_src ? " • Custom Icon" : ""}
                            </div>
                            {domain.description ? (
                              <div style={{ fontSize: 12.5, color: palette.textMuted }}>{domain.description}</div>
                            ) : null}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {isExpanded ? null : (
                            <button
                              type="button"
                              style={{ ...buttonAlt, opacity: canManageDomainRegistry ? 1 : 0.55 }}
                              disabled={!canManageDomainRegistry}
                              onClick={() => beginEditDomainDefinition(domain.key)}
                            >
                              Edit
                            </button>
                          )}
                          {domain.status !== "archived" ? (
                            <button
                              type="button"
                              style={{ ...buttonAlt, borderColor: "rgba(209,67,67,0.26)", color: palette.red600, opacity: canManageDomainRegistry && !domainRegistrySaving ? 1 : 0.55 }}
                              disabled={!canManageDomainRegistry || domainRegistrySaving}
                              onClick={() => void archiveDomainDefinition(domain.key)}
                            >
                              Archive
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {isExpanded ? (
                        editingDomainDefinitionKey === domain.key && domainRegistryEditorOpen ? (
                          renderDomainRegistryEditor()
                        ) : (
                          <div style={{ display: "grid", gap: 10 }}>
                            <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                              Issue types are configured per tenant after this domain is assigned.
                            </div>
                          </div>
                        )
                      ) : null}
                    </div>
                  );
                  }) : (
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      No global domains have been defined yet in the new registry.
                    </div>
                  )}
                  {archivedDomainRegistryRows.length ? (
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Archived domains: {archivedDomainRegistryRows.map((domain) => domain.label).join(", ")}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "map-ui-theme" ? (
        <section style={controlPlaneSettingsSectionStyle}>
          <div style={controlPlaneSettingsLayoutStyle}>
            {controlPlaneSettingsSidebarContent}
            <div style={controlPlaneSettingsContentPaneStyle}>
              {controlPlaneSettingsActions}
              <div style={{ ...card, display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>Map UI Themes</h2>
                  <p style={{ margin: 0, color: palette.textMuted }}>
                    Build a saved library of default and temporary map UI themes. Draft themes stay in PCP until they are published, and scheduled themes become active only during their effective dates.
                  </p>
                  <p style={{ margin: 0, color: palette.textMuted, fontSize: 12.5 }}>
                    All theme scheduling uses {MAP_UI_THEME_TIME_ZONE_LABEL} ({MAP_UI_THEME_TIME_ZONE}).
                  </p>
                </div>
                <div style={{ ...subPanel, display: "grid", gap: 10, background: "rgba(255,255,255,0.72)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ color: palette.navy900 }}>Theme Library</strong>
                      <div style={{ fontSize: 12.5, color: palette.textMuted, lineHeight: 1.45 }}>
                        The default theme is the permanent fallback theme. Temporary themes can be drafted, scheduled, published, duplicated, and deleted individually from the configurator flow.
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      {sortedMapUiThemeDraftThemes.length} saved theme{sortedMapUiThemeDraftThemes.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: palette.textMuted }}>
                    <span>
                      Draft saved:
                      {" "}
                      {mapUiThemeDraftConfig?.saved_at ? new Date(mapUiThemeDraftConfig.saved_at).toLocaleString() : "Not yet"}
                    </span>
                    <span>
                      Published live:
                      {" "}
                      {mapUiThemePublishedConfig?.published_at ? new Date(mapUiThemePublishedConfig.published_at).toLocaleString() : "Using bundled defaults"}
                    </span>
                    <span>
                      Live now:
                      {" "}
                      {activePublishedMapUiThemeSchedule?.label
                        ? `${activePublishedMapUiThemeSchedule.label} until ${formatMapUiThemeDateTimeDisplay(activePublishedMapUiThemeSchedule.end_at)}`
                        : "Default theme"}
                    </span>
                  </div>
                </div>
                {status.mapUiTheme ? (
                  <div style={{ fontSize: 12.5, color: status.mapUiTheme.startsWith("Error:") ? palette.red600 : palette.mint700 }}>
                    {status.mapUiTheme}
                  </div>
                ) : null}
                {mapUiThemeEditorOpen && mapUiThemeEditorDraft ? (
                  <div style={{ ...subPanel, display: "grid", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <strong style={{ color: palette.navy900 }}>Theme Configurator</strong>
                        <span style={{ fontSize: 12.5, color: palette.textMuted }}>
                          {mapUiThemeEditorDraft.is_default
                            ? "Edit the default fallback theme here. Only PCP super users can publish changes to the default theme."
                            : "Configure a temporary theme, save it as a draft, or publish it to schedule deployment during its effective dates."}
                        </span>
                        {!mapUiThemeEditorDraft.is_default ? (
                          <span style={{ fontSize: 12, color: palette.textMuted }}>
                            Effective dates below are interpreted in {MAP_UI_THEME_TIME_ZONE_LABEL} ({MAP_UI_THEME_TIME_ZONE}).
                          </span>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={{ ...buttonAlt, opacity: canManageDomainRegistry && !mapUiThemeSavingDraft && !mapUiThemePublishing ? 1 : 0.55 }}
                          disabled={!canManageDomainRegistry || mapUiThemeSavingDraft || mapUiThemePublishing}
                          onClick={closeMapUiThemeEditor}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          style={{ ...buttonBase, opacity: canManageDomainRegistry && !mapUiThemeSavingDraft && !mapUiThemePublishing && !mapUiThemeEditorHasInvalidDateWindow ? 1 : 0.55 }}
                          disabled={!canManageDomainRegistry || mapUiThemeSavingDraft || mapUiThemePublishing || mapUiThemeEditorHasInvalidDateWindow}
                          onClick={() => void saveMapUiThemeEditor({ publish: false })}
                        >
                          {mapUiThemeSavingDraft ? "Saving Draft..." : "Save Draft"}
                        </button>
                        <button
                          type="button"
                          style={{ ...buttonBase, opacity: canManageDomainRegistry && !mapUiThemeSavingDraft && !mapUiThemePublishing && !mapUiThemeEditorHasInvalidDateWindow ? 1 : 0.55 }}
                          disabled={!canManageDomainRegistry || mapUiThemeSavingDraft || mapUiThemePublishing || mapUiThemeEditorHasInvalidDateWindow}
                          onClick={() => void saveMapUiThemeEditor({ publish: true })}
                        >
                          {mapUiThemePublishing ? "Publishing..." : mapUiThemeEditorDraft.is_default ? "Publish Default Theme" : "Publish + Schedule"}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: palette.navy900 }}>Theme Name</span>
                        <input
                          type="text"
                          value={mapUiThemeEditorDraft.name}
                          disabled={!canManageDomainRegistry || mapUiThemeSavingDraft || mapUiThemePublishing || (mapUiThemeEditorDraft.is_default && !isPlatformOwner)}
                          onChange={(event) => updateMapUiThemeEditorMeta("name", event.target.value)}
                          style={modalInput}
                          placeholder={mapUiThemeEditorDraft.is_default ? "Default Theme" : "Fourth of July"}
                        />
                      </label>
                      {!mapUiThemeEditorDraft.is_default ? (
                        <>
                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: palette.navy900 }}>Effective Start ({MAP_UI_THEME_TIME_ZONE_LABEL})</span>
                            <input
                              type="datetime-local"
                              value={mapUiThemeEditorDraft.start_at}
                              max={mapUiThemeEditorDateWindow.endAtRaw || undefined}
                              disabled={!canManageDomainRegistry || mapUiThemeSavingDraft || mapUiThemePublishing}
                              onChange={(event) => updateMapUiThemeEditorMeta("start_at", event.target.value)}
                              style={modalInput}
                            />
                          </label>
                          <label style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: palette.navy900 }}>Effective End ({MAP_UI_THEME_TIME_ZONE_LABEL})</span>
                            <input
                              type="datetime-local"
                              value={mapUiThemeEditorDraft.end_at}
                              min={mapUiThemeEditorDateWindow.startAtRaw || undefined}
                              disabled={!canManageDomainRegistry || mapUiThemeSavingDraft || mapUiThemePublishing}
                              onChange={(event) => updateMapUiThemeEditorMeta("end_at", event.target.value)}
                              style={modalInput}
                            />
                          </label>
                        </>
                      ) : (
                        <div style={{ ...subPanel, display: "grid", gap: 6, background: "rgba(248,251,255,0.84)" }}>
                          <strong style={{ color: palette.navy900, fontSize: 12.5 }}>Default Theme Rules</strong>
                          <span style={{ fontSize: 12, color: palette.textMuted }}>
                            The default theme has no effective dates. It is the permanent fallback whenever no active temporary theme is live.
                          </span>
                        </div>
                      )}
                    </div>
                    {!mapUiThemeEditorDraft.is_default && mapUiThemeEditorHasInvalidDateWindow ? (
                      <div style={{ ...subPanel, display: "grid", gap: 4, background: "rgba(209,67,67,0.08)", borderColor: "rgba(209,67,67,0.2)" }}>
                        <strong style={{ color: palette.red600, fontSize: 12.5 }}>Invalid Date Window</strong>
                        <span style={{ fontSize: 12, color: palette.red600 }}>
                          The end time must be after the start time before this temporary theme can be saved or published.
                        </span>
                      </div>
                    ) : null}
                    {!mapUiThemeEditorDraft.is_default && !mapUiThemeEditorHasInvalidDateWindow && mapUiThemeEditorDateWindow.startAtRaw ? (
                      <div style={{ fontSize: 12, color: palette.textMuted }}>
                        End time must be after the selected start time.
                      </div>
                    ) : null}
                    {!mapUiThemeEditorDraft.is_default && !mapUiThemeEditorHasInvalidDateWindow && mapUiThemeEditorConflicts.length ? (
                      <div style={{ ...subPanel, display: "grid", gap: 4, background: "rgba(209,67,67,0.08)", borderColor: "rgba(209,67,67,0.2)" }}>
                        <strong style={{ color: palette.red600, fontSize: 12.5 }}>Date Conflict</strong>
                        <span style={{ fontSize: 12, color: palette.red600 }}>
                          This theme overlaps with {mapUiThemeEditorConflicts.map((entry) => entry.name).join(", ")}. Save the draft if needed, but publish only after the dates no longer conflict.
                        </span>
                      </div>
                    ) : null}
                    <div style={{ display: "grid", gap: 10 }}>
                      <strong style={{ color: palette.navy900 }}>Mobile Preview</strong>
                      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                        {["light", "dark"].map((mode) => renderMapUiThemeMobilePreview(mapUiThemeEditorPreview, mode))}
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
                      {["light", "dark"].map((mode) => renderMapUiThemeColorEditor(
                        mode,
                        mapUiThemeEditorDraft?.themeForm?.[mode] || {},
                        updateMapUiThemeEditorValue,
                        updateMapUiThemeEditorPicker,
                        !canManageDomainRegistry || mapUiThemeSavingDraft || mapUiThemePublishing || (mapUiThemeEditorDraft.is_default && !isPlatformOwner)
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {sortedMapUiThemeDraftThemes.map((themeEntry) => {
                      const statusLabel = formatMapUiThemeStatus(themeEntry);
                      const statusBackground = statusLabel === "Active"
                        ? "rgba(18,128,106,0.12)"
                        : statusLabel === "Scheduled"
                          ? "rgba(37,99,235,0.10)"
                          : statusLabel === "Draft"
                            ? "rgba(245,190,28,0.12)"
                            : statusLabel === "Ended"
                              ? "rgba(107,114,128,0.12)"
                              : "rgba(17,36,69,0.10)";
                      const statusColor = statusLabel === "Active"
                        ? palette.mint700
                        : statusLabel === "Scheduled"
                          ? "#1d4ed8"
                          : statusLabel === "Draft"
                            ? "#7a5a00"
                            : statusLabel === "Ended"
                              ? "#4b5563"
                              : palette.navy700;
                      const themePreview = buildMapUiThemePreview(
                        themeEntry.themeForm || {},
                        themeEntry.is_default ? {} : draftDefaultMapUiThemeEntry?.themeForm || {}
                      );
                      return (
                        <div key={themeEntry.id} style={{ ...subPanel, display: "grid", gap: 12, background: "rgba(255,255,255,0.72)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                            <div style={{ display: "grid", gap: 6 }}>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <strong style={{ color: palette.navy900 }}>{themeEntry.name}</strong>
                                <span style={{ fontSize: 11.5, fontWeight: 800, color: statusColor, background: statusBackground, borderRadius: 999, padding: "4px 10px" }}>
                                  {statusLabel}
                                </span>
                                {themeEntry.is_default ? (
                                  <span style={{ fontSize: 11.5, fontWeight: 800, color: palette.navy700, background: "rgba(17,36,69,0.10)", borderRadius: 999, padding: "4px 10px" }}>
                                    Fallback
                                  </span>
                                ) : null}
                              </div>
                              <span style={{ fontSize: 12, color: palette.textMuted }}>
                                {themeEntry.is_default
                                  ? "Permanent fallback theme used whenever no active temporary theme is live."
                                  : themeEntry.start_at && themeEntry.end_at
                                    ? `${formatMapUiThemeDateTimeDisplay(fromLocalDateTimeInputValue(themeEntry.start_at))} to ${formatMapUiThemeDateTimeDisplay(fromLocalDateTimeInputValue(themeEntry.end_at))}`
                                    : `Draft theme with no effective ${MAP_UI_THEME_TIME_ZONE_LABEL.toLowerCase()} dates yet.`}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                style={{ ...buttonAlt, opacity: canManageDomainRegistry && (!themeEntry.is_default || isPlatformOwner) ? 1 : 0.55 }}
                                disabled={!canManageDomainRegistry || (themeEntry.is_default && !isPlatformOwner)}
                                onClick={() => openMapUiThemeEditor(themeEntry.id)}
                                title={themeEntry.is_default && !isPlatformOwner ? "Only PCP super users can edit the default theme." : "Edit theme"}
                              >
                                Edit
                              </button>
                              {!themeEntry.is_default ? (
                                <button
                                  type="button"
                                  style={{ ...buttonAlt, opacity: canManageDomainRegistry ? 1 : 0.55 }}
                                  disabled={!canManageDomainRegistry}
                                  onClick={() => duplicateMapUiTheme(themeEntry.id)}
                                >
                                  Copy
                                </button>
                              ) : null}
                              {!themeEntry.is_default ? (
                                <button
                                  type="button"
                                  style={{ ...buttonAlt, borderColor: "rgba(209,67,67,0.26)", color: palette.red600, opacity: canManageDomainRegistry ? 1 : 0.55 }}
                                  disabled={!canManageDomainRegistry}
                                  onClick={() => void deleteMapUiTheme(themeEntry.id)}
                                >
                                  Delete
                                </button>
                              ) : null}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {["light", "dark"].map((mode) => {
                              const theme = themePreview?.[mode] || MAP_UI_ICON_THEME_DEFAULTS[mode];
                              return (
                                <div
                                  key={`${themeEntry.id}-${mode}`}
                                  style={{
                                    ...subPanel,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    background: mode === "dark" ? "#102445" : "#f8fbff",
                                    border: `1px solid ${mode === "dark" ? "rgba(255,255,255,0.14)" : "rgba(17,36,69,0.12)"}`,
                                    minWidth: 190,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 42,
                                      height: 42,
                                      borderRadius: 12,
                                      border: `1px solid ${theme.tool_button_border}`,
                                      background: theme.tool_button_bg,
                                      color: theme.tool_button_text,
                                      display: "grid",
                                      placeItems: "center",
                                      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.12)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <span style={{ fontSize: 15, fontWeight: 900 }}>Aa</span>
                                  </div>
                                  <div style={{ display: "grid", gap: 2 }}>
                                    <strong style={{ color: mode === "dark" ? "#f5fbff" : palette.navy900, fontSize: 12.5 }}>
                                      {mode === "dark" ? "Dark Preview" : "Light Preview"}
                                    </strong>
                                    <span style={{ fontSize: 11.5, color: mode === "dark" ? "rgba(245,251,255,0.72)" : palette.textMuted }}>
                                      Mobile map shell preview
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "map-ui-icons" ? (
        <section style={controlPlaneSettingsSectionStyle}>
          <div style={controlPlaneSettingsLayoutStyle}>
            {controlPlaneSettingsSidebarContent}
            <div style={controlPlaneSettingsContentPaneStyle}>
              {controlPlaneSettingsActions}
              <div style={{ ...card, display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>Map UI Icons</h2>
                  <p style={{ margin: 0, color: palette.textMuted }}>
                    Edit the shared app and map control icons here, save them as a draft, and publish the full set at once when you are ready. Theme colors now live on the separate Map UI Theme page.
                  </p>
                </div>
                <div style={{ ...subPanel, display: "grid", gap: 10, background: "rgba(255,255,255,0.72)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ color: palette.navy900 }}>Draft + Publish Flow</strong>
                      <div style={{ fontSize: 12.5, color: palette.textMuted, lineHeight: 1.45 }}>
                        Upload everything into the draft first. When you publish, the app switches to the full draft manifest in one pass, so users do not watch icons change one by one.
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={{ ...buttonAlt, opacity: canManageDomainRegistry && !mapUiIconSavingDraft && !mapUiIconPublishing ? 1 : 0.55 }}
                        disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                        onClick={() => void resetMapUiIconDraftToPublished()}
                      >
                        Reset Draft
                      </button>
                      <button
                        type="button"
                        style={{ ...buttonBase, opacity: canManageDomainRegistry && !mapUiIconSavingDraft && !mapUiIconPublishing ? 1 : 0.55 }}
                        disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                        onClick={() => void persistMapUiIconDraft({ publish: false })}
                      >
                        {mapUiIconSavingDraft ? "Saving Draft..." : "Save Draft"}
                      </button>
                      <button
                        type="button"
                        style={{ ...buttonBase, opacity: canManageDomainRegistry && !mapUiIconSavingDraft && !mapUiIconPublishing ? 1 : 0.55 }}
                        disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                        onClick={() => void persistMapUiIconDraft({ publish: true })}
                      >
                        {mapUiIconPublishing ? "Publishing..." : "Publish Live"}
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: palette.textMuted }}>
                    <span>
                      Draft saved:
                      {" "}
                      {mapUiIconDraftConfig?.saved_at ? new Date(mapUiIconDraftConfig.saved_at).toLocaleString() : "Not yet"}
                    </span>
                    <span>
                      Published live:
                      {" "}
                      {mapUiIconPublishedConfig?.published_at ? new Date(mapUiIconPublishedConfig.published_at).toLocaleString() : "Using bundled defaults"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: palette.textMuted, lineHeight: 1.45 }}>
                    Each icon can now choose its own render mode. Use tintable SVG for monochrome icons, full-color SVG for multi-color vectors, or raster/as-is for PNG and WebP assets. Leave color override fields blank to keep the current CityReport defaults.
                  </div>
                </div>
                {status.mapUiIcons ? (
                  <div style={{ fontSize: 12.5, color: status.mapUiIcons.startsWith("Error:") ? palette.red600 : palette.mint700 }}>
                    {status.mapUiIcons}
                  </div>
                ) : null}
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ ...subPanel, display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 3 }}>
                        <strong style={{ color: palette.navy900 }}>Icon Catalog</strong>
                        <span style={{ fontSize: 12.5, color: palette.textMuted }}>
                          Choose a category first, then select the icon you want to edit from that category.
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <label style={{ display: "grid", gap: 6, minWidth: 220 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: palette.navy900 }}>Icon Category</span>
                          <select
                            value={activeMapUiIconGroup}
                            onChange={(event) => setSelectedMapUiIconGroup(event.target.value)}
                            style={modalInput}
                          >
                            {mapUiIconCatalogGroups.map(({ group }) => (
                              <option key={group} value={group}>{group}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: "grid", gap: 6, minWidth: 240 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: palette.navy900 }}>Select Icon</span>
                          <select
                            value={activeMapUiIconSelectedKey}
                            onChange={(event) => setSelectedMapUiIconKeysByGroup((prev) => ({ ...prev, [activeMapUiIconGroup]: event.target.value }))}
                            style={modalInput}
                          >
                            {activeMapUiIconItems.map((entry) => (
                              <option key={entry.key} value={entry.key}>{entry.label}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 10 }}>
                      {[activeMapUiIconEntry].filter(Boolean).map((entry) => {
                          const row = mapUiIconDraftForm?.[entry.key] || {};
                          const previewSrc = String(row?.preview_url || row?.src || entry.defaultSrc || "").trim();
                          const previewRenderMode = String(row?.render_mode || entry.defaultRenderMode || MAP_UI_ICON_RENDER_MODE.RASTER).trim();
                          const publishedSrc = String(publishedMapUiIconMeta?.[entry.key]?.src || entry.defaultSrc || "").trim();
                          const publishedRenderMode = String(
                            publishedMapUiIconMeta?.[entry.key]?.render_mode || entry.defaultRenderMode || MAP_UI_ICON_RENDER_MODE.RASTER
                          ).trim();
                          const previewUsesTint = previewRenderMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG && isTintableSvgAsset(previewSrc, row?.file);
                          const publishedUsesTint = publishedRenderMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG && isTintableSvgAsset(publishedSrc);
                          const previewLightTint = String(row?.light_tint_color || previewMapUiTheme?.light?.tool_button_text || "#17324d").trim();
                          const previewDarkTint = String(row?.dark_tint_color || previewMapUiTheme?.dark?.tool_button_text || "#f5fbff").trim();
                          const publishedLightTint = String(
                            publishedMapUiIconMeta?.[entry.key]?.light_tint_color
                            || publishedMapUiTheme?.light?.tool_button_text
                            || "#17324d"
                          ).trim();
                          const publishedDarkTint = String(
                            publishedMapUiIconMeta?.[entry.key]?.dark_tint_color
                            || publishedMapUiTheme?.dark?.tool_button_text
                            || "#f5fbff"
                          ).trim();
                          return (
                            <div key={entry.key} style={{ ...subPanel, display: "grid", gap: 10, background: "#f8fbff" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
                                <div style={{ display: "grid", gap: 4 }}>
                                  <strong style={{ color: palette.navy900 }}>{entry.label}</strong>
                                  <span style={{ fontSize: 12.5, color: palette.textMuted }}>{entry.description}</span>
                                  <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                                    Key: <code>{entry.key}</code>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  style={{ ...buttonAlt, opacity: canManageDomainRegistry && !mapUiIconSavingDraft && !mapUiIconPublishing ? 1 : 0.55 }}
                                  disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                                  onClick={() => {
                                    updateMapUiIconDraftFile(entry.key, null);
                                    updateMapUiIconDraftSrc(entry.key, entry.defaultSrc || "");
                                    updateMapUiIconDraftRenderMode(entry.key, entry.defaultRenderMode || MAP_UI_ICON_RENDER_MODE.RASTER);
                                    updateMapUiIconDraftTintColor(entry.key, "light_tint_color", "");
                                    updateMapUiIconDraftTintColor(entry.key, "dark_tint_color", "");
                                    updateMapUiIconDraftEnabled(entry.key, true);
                                  }}
                                >
                                  Use Default
                                </button>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 12,
                                  padding: "10px 12px",
                                  borderRadius: 12,
                                  border: "1px solid rgba(17,36,69,0.10)",
                                  background: row?.enabled === false ? "rgba(255, 244, 244, 0.72)" : "rgba(223, 247, 239, 0.72)",
                                }}
                              >
                                <div style={{ display: "grid", gap: 2 }}>
                                  <strong style={{ color: palette.navy900, fontSize: 12.5 }}>Show In Live UI</strong>
                                  <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                                    Turn this off if you want the related map control or option hidden after publish.
                                  </span>
                                </div>
                                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 800, color: palette.navy900 }}>
                                  <input
                                    type="checkbox"
                                    checked={row?.enabled !== false}
                                    disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                                    onChange={(event) => updateMapUiIconDraftEnabled(entry.key, event.target.checked)}
                                  />
                                  {row?.enabled === false ? "Hidden" : "Visible"}
                                </label>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: 11.5, color: palette.textMuted }}>Draft Preview</span>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {[
                                      {
                                        label: "Light",
                                        background: previewMapUiTheme?.light?.tool_button_bg || "#ffffff",
                                        border: previewMapUiTheme?.light?.tool_button_border || "rgba(17,36,69,0.12)",
                                      },
                                      {
                                        label: "Dark",
                                        background: previewMapUiTheme?.dark?.tool_button_bg || "#102445",
                                        border: previewMapUiTheme?.dark?.tool_button_border || "rgba(255,255,255,0.16)",
                                      },
                                    ].map((surface) => (
                                      <div key={surface.label} style={{ display: "grid", gap: 5, justifyItems: "center" }}>
                                        <div
                                          style={{
                                            width: 68,
                                            height: 68,
                                            borderRadius: 18,
                                            border: `1px solid ${surface.border}`,
                                            background: surface.background,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
                                          }}
                                        >
                                          {previewUsesTint ? (
                                            <span
                                              style={{
                                                width: 34,
                                                height: 34,
                                                display: "block",
                                                backgroundColor: surface.label === "Dark" ? previewDarkTint : previewLightTint,
                                                WebkitMaskImage: `url("${previewSrc}")`,
                                                maskImage: `url("${previewSrc}")`,
                                                WebkitMaskRepeat: "no-repeat",
                                                maskRepeat: "no-repeat",
                                                WebkitMaskPosition: "center",
                                                maskPosition: "center",
                                                WebkitMaskSize: "contain",
                                                maskSize: "contain",
                                              }}
                                            />
                                          ) : previewSrc ? (
                                            <img src={previewSrc} alt={`${entry.label} preview`} style={{ width: 34, height: 34, objectFit: "contain" }} />
                                          ) : (
                                            <span style={{ fontSize: 11.5, color: palette.textMuted }}>None</span>
                                          )}
                                        </div>
                                        <span style={{ fontSize: 11.5, color: palette.textMuted }}>{surface.label}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  <span style={{ fontSize: 11.5, color: palette.textMuted }}>Published Preview</span>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {[
                                      {
                                        label: "Light",
                                        background: publishedMapUiTheme?.light?.tool_button_bg || "#ffffff",
                                        border: publishedMapUiTheme?.light?.tool_button_border || "rgba(17,36,69,0.12)",
                                        tint: publishedLightTint,
                                      },
                                      {
                                        label: "Dark",
                                        background: publishedMapUiTheme?.dark?.tool_button_bg || "#102445",
                                        border: publishedMapUiTheme?.dark?.tool_button_border || "rgba(255,255,255,0.16)",
                                        tint: publishedDarkTint,
                                      },
                                    ].map((surface) => (
                                      <div key={`published-${surface.label}`} style={{ display: "grid", gap: 5, justifyItems: "center" }}>
                                        <div
                                          style={{
                                            width: 68,
                                            height: 68,
                                            borderRadius: 18,
                                            border: `1px solid ${surface.border}`,
                                            background: surface.background,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
                                          }}
                                        >
                                          {publishedUsesTint ? (
                                            <span
                                              style={{
                                                width: 34,
                                                height: 34,
                                                display: "block",
                                                backgroundColor: surface.tint,
                                                WebkitMaskImage: `url("${publishedSrc}")`,
                                                maskImage: `url("${publishedSrc}")`,
                                                WebkitMaskRepeat: "no-repeat",
                                                maskRepeat: "no-repeat",
                                                WebkitMaskPosition: "center",
                                                maskPosition: "center",
                                                WebkitMaskSize: "contain",
                                                maskSize: "contain",
                                              }}
                                            />
                                          ) : publishedSrc ? (
                                            <img src={publishedSrc} alt={`${entry.label} published`} style={{ width: 34, height: 34, objectFit: "contain" }} />
                                          ) : (
                                            <span style={{ fontSize: 11.5, color: palette.textMuted }}>None</span>
                                          )}
                                        </div>
                                        <span style={{ fontSize: 11.5, color: palette.textMuted }}>{surface.label}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div style={responsiveTwoColGrid}>
                                <label style={modalField}>
                                  <span>Render Mode</span>
                                  <select
                                    value={previewRenderMode}
                                    disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                                    onChange={(event) => updateMapUiIconDraftRenderMode(entry.key, event.target.value)}
                                    style={{ ...modalInput, background: !canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing ? "#eef4fb" : modalInput.background }}
                                  >
                                    {MAP_UI_ICON_RENDER_MODE_OPTIONS.map((option) => (
                                      <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label style={{ ...modalField, gridColumn: "1 / -1" }}>
                                  <span>Icon Source URL</span>
                                  <input
                                    value={row?.src || ""}
                                    disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                                    onChange={(event) => updateMapUiIconDraftSrc(entry.key, event.target.value)}
                                    placeholder={entry.defaultSrc}
                                    style={{ ...modalInput, background: !canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing ? "#eef4fb" : modalInput.background }}
                                  />
                                </label>
                                <label style={modalField}>
                                  <span>Replace with File</span>
                                  <input
                                    type="file"
                                    accept={MAP_UI_ICON_ACCEPT}
                                    disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                                    onChange={(event) => updateMapUiIconDraftFile(entry.key, event.target.files?.[0] || null)}
                                    style={{ ...modalInput, padding: "10px 12px", background: !canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing ? "#eef4fb" : modalInput.background }}
                                  />
                                </label>
                                <div style={{ ...modalField, justifyContent: "end" }}>
                                  <span>Current Draft File</span>
                                  <div style={{ fontSize: 12.5, color: palette.textMuted, minHeight: 48, display: "flex", alignItems: "center" }}>
                                    {row?.file?.name || "Using the source URL above"}
                                  </div>
                                </div>
                                <div style={{ ...modalField, gridColumn: "1 / -1" }}>
                                  <span>Visibility Status</span>
                                  <div style={{ fontSize: 12.5, color: palette.textMuted, lineHeight: 1.45 }}>
                                    {row?.enabled === false
                                      ? "This icon's related UI control or option will be hidden after the next publish."
                                      : "This icon is currently set to appear in the live UI after publish."}
                                  </div>
                                </div>
                                {previewRenderMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG ? (
                                  <>
                                    <label style={modalField}>
                                      <span>Light Mode Tint</span>
                                      <input
                                        type="color"
                                        value={row?.light_tint_color || "#17324d"}
                                        disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                                        onChange={(event) => updateMapUiIconDraftTintColor(entry.key, "light_tint_color", event.target.value)}
                                        style={{ ...modalInput, background: !canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing ? "#eef4fb" : modalInput.background, padding: 4, height: 42 }}
                                      />
                                    </label>
                                    <label style={modalField}>
                                      <span>Dark Mode Tint</span>
                                      <input
                                        type="color"
                                        value={row?.dark_tint_color || "#f5fbff"}
                                        disabled={!canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing}
                                        onChange={(event) => updateMapUiIconDraftTintColor(entry.key, "dark_tint_color", event.target.value)}
                                        style={{ ...modalInput, background: !canManageDomainRegistry || mapUiIconSavingDraft || mapUiIconPublishing ? "#eef4fb" : modalInput.background, padding: 4, height: 42 }}
                                      />
                                    </label>
                                  </>
                                ) : null}
                                <div style={{ ...modalField, gridColumn: "1 / -1" }}>
                                  <span>Render Mode Guidance</span>
                                  <div style={{ fontSize: 12.5, color: palette.textMuted, lineHeight: 1.45 }}>
                                    {MAP_UI_ICON_RENDER_MODE_OPTIONS.find((option) => option.key === previewRenderMode)?.description || "Choose how the app should render this icon."}
                                  </div>
                                </div>
                                {previewRenderMode === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG ? (
                                  <div style={{ ...modalField, gridColumn: "1 / -1" }}>
                                    <span>Tint Guidance</span>
                                    <div style={{ fontSize: 12.5, color: palette.textMuted, lineHeight: 1.45 }}>
                                      These tints are used when the icon is idle in light mode or dark mode. Active buttons still use the shared active tool colors so the selected state stays readable.
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "manage-team" ? (
        <section style={controlPlaneSettingsSectionStyle}>
          <div style={controlPlaneSettingsLayoutStyle}>
            {controlPlaneSettingsSidebarContent}
            <div style={controlPlaneSettingsContentPaneStyle}>
              {controlPlaneSettingsActions}
              {platformTeamStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{platformTeamStatus}</div> : null}
              <div style={{ ...card, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>Current Platform Team</h2>
                  <button
                    type="button"
                    style={{ ...buttonBase, opacity: canManagePlatformUsers ? 1 : 0.55 }}
                    disabled={!canManagePlatformUsers}
                    onClick={() => {
                      if (platformTeamManagementView === "add") closePlatformTeamAddModal();
                      else openPlatformTeamAddModal();
                    }}
                  >
                    {platformTeamManagementView === "add" ? "Hide Add Team Member" : "Add Team Member"}
                  </button>
                </div>
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
                      {platformTeamAssignments.map((row) => {
                        const rowKey = `${row.user_id}:${row.role}`;
                        const isEditingRole = editingPlatformAssignmentKey === rowKey;
                        return (
                          <tr key={rowKey}>
                            <td style={{ padding: "10px 0" }}>{formatPlatformUserLabel(row.user_id)}</td>
                            <td style={{ padding: "10px 0" }}>
                              {isEditingRole ? (
                                <select value={editingPlatformAssignmentRole} onChange={(event) => setEditingPlatformAssignmentRole(event.target.value)} style={{ ...inputBase, minWidth: 180 }}>
                                  {assignablePlatformRoles.map((option) => (
                                    <option key={option.role} value={option.role}>
                                      {platformRoleLabelByKey[String(option?.role || "").trim()] || platformRoleToLabel(option?.role)}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                platformRoleLabelByKey[String(row?.role || "").trim()] || platformRoleToLabel(row.role)
                              )}
                            </td>
                            <td style={{ padding: "10px 0" }}>{row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
                            <td style={{ padding: "10px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {isEditingRole ? (
                                <>
                                  <button type="button" style={{ ...buttonBase, opacity: canManagePlatformUsers ? 1 : 0.55 }} disabled={!canManagePlatformUsers} onClick={() => void savePlatformRoleEdit(row)}>
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    style={buttonAlt}
                                    onClick={() => {
                                      setEditingPlatformAssignmentKey("");
                                      setEditingPlatformAssignmentRole("");
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    style={{ ...buttonAlt, opacity: canManagePlatformUsers ? 1 : 0.55 }}
                                    disabled={!canManagePlatformUsers}
                                    onClick={() => {
                                      setEditingPlatformAssignmentKey(rowKey);
                                      setEditingPlatformAssignmentRole(String(row?.role || "").trim());
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    style={{ ...buttonAlt, opacity: canRemovePlatformUsers ? 1 : 0.55 }}
                                    disabled={!canRemovePlatformUsers}
                                    onClick={() => setPlatformTeamDeleteConfirmRow(row)}
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {!platformTeamAssignments.length ? (
                        <tr>
                          <td colSpan={4} style={{ padding: "10px 0", color: palette.textMuted }}>No platform roles have been assigned yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "roles-permissions" ? (
        <section style={controlPlaneSettingsSectionStyle}>
          <div style={controlPlaneSettingsLayoutStyle}>
            {controlPlaneSettingsSidebarContent}
            <div style={controlPlaneSettingsContentPaneStyle}>
              <div style={{ ...card, display: "grid", gap: 12 }}>
                <h2 style={{ margin: 0, color: palette.navy900 }}>Roles and Permissions</h2>
                {platformRoleStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{platformRoleStatus}</div> : null}
                <div style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: palette.navy900 }}>Choose Role</div>
                    <button
                      type="button"
                      style={{ ...buttonBase, opacity: canManagePlatformRoles ? 1 : 0.55 }}
                      disabled={!canManagePlatformRoles}
                      onClick={() => {
                        setPlatformRoleAddModalOpen(true);
                        setPlatformRoleStatus("");
                      }}
                    >
                      Create Role
                    </button>
                  </div>
                  <select value={selectedPlatformRoleKey} onChange={(e) => setSelectedPlatformRoleKey(e.target.value)} style={{ ...inputBase, maxWidth: 360 }}>
                    {sortedPlatformRoleDefinitions.map((row) => {
                      const role = String(row?.role || "").trim();
                      if (!role) return null;
                      return (
                        <option key={role} value={role}>
                          {platformRoleLabelByKey[role] || platformRoleToLabel(role)}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {selectedPlatformRoleDefinition ? (
                  <div style={{ ...subPanel, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 3 }}>
                        <h2 style={{ margin: 0, color: palette.navy900 }}>
                          Manage PCP Role Permissions ({platformRoleLabelByKey[String(selectedPlatformRoleDefinition?.role || "").trim()] || platformRoleToLabel(selectedPlatformRoleDefinition?.role)})
                        </h2>
                        <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                          {selectedPlatformRoleDefinition?.is_system ? "System role" : "Custom role"}
                          {" • "}
                          {selectedPlatformRoleDefinition?.active === false ? "Disabled" : "Active"}
                          {" • "}
                          {selectedPlatformRoleAssignmentCount} assignment{selectedPlatformRoleAssignmentCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {!platformRoleEditMode ? (
                          <button
                            type="button"
                            style={{ ...buttonAlt, opacity: canManagePlatformRoles ? 1 : 0.55 }}
                            disabled={!canManagePlatformRoles}
                            onClick={() => setPlatformRoleEditMode(true)}
                          >
                            Edit
                          </button>
                        ) : (
                          <button
                            type="button"
                            style={{
                              ...buttonAlt,
                              borderColor: palette.red600,
                              color: palette.red600,
                              opacity: canDeletePlatformRoles && selectedPlatformRoleDefinition?.is_system !== true && selectedPlatformRoleAssignmentCount === 0 ? 1 : 0.55,
                            }}
                            disabled={!canDeletePlatformRoles || selectedPlatformRoleDefinition?.is_system === true || selectedPlatformRoleAssignmentCount > 0}
                            title={
                              selectedPlatformRoleDefinition?.is_system === true
                                ? "System roles cannot be removed."
                                : selectedPlatformRoleAssignmentCount > 0
                                  ? "Remove assignments before deleting this role."
                                  : canDeletePlatformRoles
                                    ? "Delete role"
                                    : "You need the Roles delete permission"
                            }
                            onClick={() => setPlatformRoleDeleteConfirmOpen(true)}
                          >
                            Delete Role
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                        <colgroup>
                          <col />
                          {PLATFORM_PERMISSION_ACTIONS.map((action) => (
                            <col key={action.key} style={{ width: 96 }} />
                          ))}
                        </colgroup>
                        <thead>
                          <tr>
                            <th style={tableHeadCell}>Module</th>
                            {PLATFORM_PERMISSION_ACTIONS.map((action) => (
                              <th key={action.key} style={{ ...tableHeadCell, textAlign: "right" }}>{action.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PLATFORM_PERMISSION_MODULES.map((module) => (
                            <tr key={module.key}>
                              <td style={{ padding: "8px 0", fontWeight: 700 }}>{module.label}</td>
                              {PLATFORM_PERMISSION_ACTIONS.map((action) => {
                                const permissionKey = `${module.key}.${action.key}`;
                                return (
                                  <td key={permissionKey} style={{ padding: "8px 0", textAlign: "right" }}>
                                    <span style={{ display: "inline-flex", width: "100%", justifyContent: "flex-end" }}>
                                      <input
                                        type="checkbox"
                                        checked={Boolean(platformRolePermissionDraft?.[permissionKey])}
                                        disabled={!canManagePlatformRoles || !platformRoleEditMode}
                                        onChange={(e) => {
                                          const nextAllowed = e.target.checked;
                                          setPlatformRolePermissionDraft((prev) => ({ ...prev, [permissionKey]: nextAllowed }));
                                          setPlatformRolePermissionDirty(true);
                                        }}
                                      />
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {platformRoleEditMode ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={{ ...buttonBase, opacity: canManagePlatformRoles ? 1 : 0.55 }}
                          disabled={!canManagePlatformRoles || !platformRolePermissionDirty}
                          onClick={() => {
                            void savePlatformRolePermissions();
                            setPlatformRoleEditMode(false);
                          }}
                        >
                          Save Permission Changes
                        </button>
                        <button
                          type="button"
                          style={buttonAlt}
                          onClick={() => {
                            const resetDraft = {};
                            for (const permissionKey of DEFAULT_PLATFORM_PERMISSION_KEYS) {
                              resetDraft[permissionKey] = Boolean(platformRolePermissionMap[`${selectedPlatformRoleKey}:${permissionKey}`]);
                            }
                            setPlatformRolePermissionDraft(resetDraft);
                            setPlatformRolePermissionDirty(false);
                            setPlatformRoleEditMode(false);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                    No PCP roles found.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "security-checks" ? (
        <section style={controlPlaneSettingsSectionStyle}>
          <div style={controlPlaneSettingsLayoutStyle}>
            {controlPlaneSettingsSidebarContent}
            <div style={controlPlaneSettingsContentPaneStyle}>
              {controlPlaneSettingsActions}
              {platformSecurityStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{platformSecurityStatus}</div> : null}
              <div style={{ ...card, display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <h2 style={{ margin: 0, color: palette.navy900 }}>Security Checkpoints</h2>
                    <p style={{ margin: 0, color: palette.textMuted, fontSize: 12.5 }}>
                      Choose which PCP actions should require a PIN checkpoint before completing. PIN setup and PIN changes live under Account Info.
                    </p>
                  </div>
                  {!platformSecurityChecksEditMode ? (
                    <button
                      type="button"
                      style={{ ...buttonAlt, opacity: canManagePlatformSecurity ? 1 : 0.55 }}
                      onClick={() => setPlatformSecurityChecksEditMode(true)}
                      disabled={!canManagePlatformSecurity}
                    >
                      Edit
                    </button>
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {[
                    ["require_pin_for_role_changes", "Require PIN for role and permission changes", "Protect custom role creation, permission edits, and role removal."],
                    ["require_pin_for_team_changes", "Require PIN for team access changes", "Protect platform team assignments and removals."],
                    ["require_pin_for_account_changes", "Require PIN for account changes", "Protect profile updates and password changes."],
                    ["require_pin_for_report_state_changes", "Require PIN for report-state changes", "Protect sensitive report and lead state updates."],
                    ["require_pin_for_organization_info_changes", "Require PIN for organization info changes", "Protect organization details, setup updates, and other core organization information changes."],
                    ["require_pin_for_contact_changes", "Require PIN for points of contact changes", "Protect primary and additional organization contact updates."],
                    ["require_pin_for_organization_user_changes", "Require PIN for organization user and admin changes", "Protect organization user invitations, role edits, assignments, and removals."],
                    ["require_pin_for_organization_role_changes", "Require PIN for organization role and permission changes", "Protect organization role creation, permission edits, and role removal."],
                    ["require_pin_for_domain_settings_changes", "Require PIN for domain and asset settings changes", "Protect domain type updates, notification routing, map settings, and domain asset configuration."],
                  ].map(([key, label, note]) => (
                    <label key={key} style={{ ...subPanel, display: "flex", alignItems: "start", gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(platformSecuritySettingsDraft?.[key])}
                        onChange={(event) => setPlatformSecuritySettingsDraft((prev) => ({ ...prev, [key]: event.target.checked }))}
                        disabled={!canManagePlatformSecurity || !platformSecurityChecksEditMode || platformSecuritySaving.checks}
                        style={{ marginTop: 4 }}
                      />
                      <span style={{ display: "grid", gap: 4 }}>
                        <strong style={{ color: palette.navy900 }}>{label}</strong>
                        <span style={{ color: palette.textMuted, fontSize: 12.5 }}>{note}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {platformSecurityChecksEditMode ? (
                  <div style={modalFooterActions}>
                    <button
                      type="button"
                      style={{ ...modalPrimaryButton, opacity: canManagePlatformSecurity ? 1 : 0.55 }}
                      onClick={() => void savePlatformSecurityChecks()}
                      disabled={!canManagePlatformSecurity || platformSecuritySaving.checks}
                    >
                      {platformSecuritySaving.checks ? "Saving Checkpoints..." : "Save Security Checks"}
                    </button>
                    <button
                      type="button"
                      style={{ ...modalSecondaryButton, opacity: platformSecuritySaving.checks ? 0.7 : 1 }}
                      onClick={() => {
                        setPlatformSecuritySettingsDraft(platformSecuritySettingsSaved);
                        setPlatformSecurityChecksEditMode(false);
                        setPlatformSecurityStatus("");
                      }}
                      disabled={platformSecuritySaving.checks}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {controlPlanePage === "manage-leads" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14, marginTop: isCompactViewport ? 12 : "var(--app-tab-rail-title-gap)" }}>
          <div style={{ ...card, display: "grid", gap: 10 }}>
            {(() => {
              const leadFilterGridStyle = {
                display: "grid",
                gridTemplateColumns: isCompactViewport ? "1fr" : "repeat(6, minmax(0, 1fr))",
                gap: 10,
                alignItems: "end",
              };
              const leadActionButtonStyle = {
                ...alignedFormButton,
                width: isCompactViewport ? "100%" : "auto",
              };
              return (
                <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 3 }}>
                <h2 style={{ margin: 0, color: palette.navy900 }}>Manage Leads</h2>
                <p style={{ margin: 0, color: palette.textMuted }}>
                  Filter the lead pipeline, review the list, and open a lead into its own detail page for follow-up work.
                </p>
              </div>
              <button
                type="button"
                style={{ ...buttonBase, ...leadActionButtonStyle, opacity: canEditLead ? 1 : 0.55 }}
                onClick={() => setLeadAddModalOpen(true)}
                disabled={!canEditLead}
                title={canEditLead ? "Add lead" : "You need the Leads edit permission"}
              >
                Add Lead
              </button>
            </div>
            {leadStatus ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{leadStatus}</div> : null}
            <div style={{ ...subPanel, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 900, color: palette.navy900 }}>Lead Filters</div>
                <button type="button" style={{ ...buttonAlt, ...leadActionButtonStyle }} onClick={() => setLeadFiltersOpen((prev) => !prev)}>
                  {leadFiltersOpen ? "Hide Filters" : "Show Filters"}
                </button>
              </div>
              {leadFiltersOpen ? (
                <div style={leadFilterGridStyle}>
                  <label style={formFieldLabel}>
                    <span>Lead #</span>
                    <input value={leadFilters.lead_number} onChange={(e) => setLeadFilters((prev) => ({ ...prev, lead_number: e.target.value }))} style={inputBase} />
                  </label>
                  <label style={formFieldLabel}>
                    <span>Org Name</span>
                    <input value={leadFilters.org_name} onChange={(e) => setLeadFilters((prev) => ({ ...prev, org_name: e.target.value }))} style={inputBase} />
                  </label>
                  <label style={formFieldLabel}>
                    <span>Priority Domain</span>
                    <select value={leadFilters.priority_domain} onChange={(e) => setLeadFilters((prev) => ({ ...prev, priority_domain: e.target.value }))} style={inputBase}>
                      <option value="">All</option>
                      {DOMAIN_OPTIONS.map((domain) => (
                        <option key={domain.key} value={domain.key}>{domain.label}</option>
                      ))}
                    </select>
                  </label>
                  <label style={formFieldLabel}>
                    <span>Date Submitted</span>
                    <input type="date" value={leadFilters.date_submitted} onChange={(e) => setLeadFilters((prev) => ({ ...prev, date_submitted: e.target.value }))} style={inputBase} />
                  </label>
                  <label style={formFieldLabel}>
                    <span>Status</span>
                    <select value={leadFilters.status} onChange={(e) => setLeadFilters((prev) => ({ ...prev, status: e.target.value }))} style={inputBase}>
                      <option value="">All</option>
                      <option value="new">New</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="contacted">Contacted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <div style={{ display: "grid", alignContent: "end" }}>
                    <button
                      type="button"
                      style={{ ...buttonAlt, ...leadActionButtonStyle }}
                      onClick={() => setLeadFilters({
                        lead_number: "",
                        org_name: "",
                        priority_domain: "",
                        date_submitted: "",
                        status: "",
                      })}
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
                </>
              );
            })()}
            {leadRows.length ? (
              <>
                {isCompactViewport ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {filteredLeadRows.map((lead) => {
                      const leadKey = String(lead?.id || "");
                      const leadNumber = formatLeadNumber(lead?.lead_number || fallbackLeadNumberById?.[leadKey] || 0);
                      return (
                        <button
                          key={leadKey}
                          type="button"
                          onClick={() => openLeadDetailPage(leadKey)}
                          style={{
                            ...subPanel,
                            display: "grid",
                            gap: 8,
                            width: "100%",
                            textAlign: "left",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                            <div style={{ display: "grid", gap: 3 }}>
                              <span style={{ color: palette.mint700, fontWeight: 900 }}>{leadNumber}</span>
                              <span style={{ color: palette.navy900, fontWeight: 900 }}>{lead.city_agency || "Not provided"}</span>
                            </div>
                            <span style={{ fontSize: 11.5, color: palette.textMuted }}>{roleKeyToLabel(lead.status || "new")}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                            {[lead.full_name, lead.work_email, lead.role_title].filter(Boolean).join(" • ") || "Not provided"}
                          </div>
                          <div style={{ display: "grid", gap: 2, fontSize: 11.5, color: palette.textMuted }}>
                            <span>Priority domain: {roleKeyToLabel(lead.priority_domain)}</span>
                            <span>Submitted: {lead.created_at ? new Date(lead.created_at).toLocaleString() : "-"}</span>
                            <span>Last modified: {lead.updated_at ? new Date(lead.updated_at).toLocaleString() : "-"}</span>
                          </div>
                          <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                            {String(lead.internal_notes || lead.notes || "").trim() || "No notes saved."}
                          </div>
                        </button>
                      );
                    })}
                    {!filteredLeadRows.length ? (
                      <div style={{ ...subPanel, color: palette.textMuted }}>No leads match the current filters.</div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th style={tableHeadCell}>Lead #</th>
                          <th style={tableHeadCell}>Organization</th>
                          <th style={tableHeadCell}>POC Info</th>
                          <th style={tableHeadCell}>Lead Status</th>
                          <th style={tableHeadCell}>Date Submitted</th>
                          <th style={tableHeadCell}>Last Modified</th>
                          <th style={tableHeadCell}>Notes</th>
                          <th style={tableHeadCell}>Priority Domain</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLeadRows.map((lead) => {
                          const leadKey = String(lead?.id || "");
                          const leadNumber = formatLeadNumber(lead?.lead_number || fallbackLeadNumberById?.[leadKey] || 0);
                          return (
                            <tr key={leadKey}>
                              <td style={{ padding: "10px 0" }}>
                                <button
                                  type="button"
                                  style={{ border: 0, background: "transparent", color: palette.mint700, font: "inherit", fontWeight: 800, cursor: "pointer", padding: 0 }}
                                  onClick={() => openLeadDetailPage(leadKey)}
                                >
                                  {leadNumber}
                                </button>
                              </td>
                              <td style={{ padding: "10px 0", color: palette.navy900, fontWeight: 800 }}>{lead.city_agency || "Not provided"}</td>
                              <td style={{ padding: "10px 0" }}>
                                {[lead.full_name, lead.work_email, lead.role_title].filter(Boolean).join(" • ") || "Not provided"}
                              </td>
                              <td style={{ padding: "10px 0" }}>{roleKeyToLabel(lead.status || "new")}</td>
                              <td style={{ padding: "10px 0" }}>{lead.created_at ? new Date(lead.created_at).toLocaleString() : "-"}</td>
                              <td style={{ padding: "10px 0" }}>{lead.updated_at ? new Date(lead.updated_at).toLocaleString() : "-"}</td>
                              <td style={{ padding: "10px 0" }}>{String(lead.internal_notes || lead.notes || "").trim() || "—"}</td>
                              <td style={{ padding: "10px 0" }}>{roleKeyToLabel(lead.priority_domain)}</td>
                            </tr>
                          );
                        })}
                        {!filteredLeadRows.length ? (
                          <tr>
                            <td colSpan={8} style={{ padding: "10px 0", color: palette.textMuted }}>No leads match the current filters.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div style={{ ...subPanel, color: palette.textMuted }}>No leads have been captured yet.</div>
            )}
          </div>
        </section>
      ) : null}
      {controlPlanePage === "lead-detail" ? (
        <section style={{ ...fullWidthSection, display: "grid", gap: 14 }}>
          {selectedLead ? (
            <div style={{ ...card, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.textMuted }}>
                  Lead Detail
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: palette.navy900 }}>
                  {selectedLead.city_agency || "Unnamed organization"}
                </div>
                <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                  {[selectedLead.full_name, selectedLead.role_title, selectedLead.work_email].filter(Boolean).join(" • ")}
                </div>
              </div>
              <div style={responsiveTwoColGrid}>
                <div style={metricCard}>
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>POC</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: palette.navy900 }}>{selectedLead.full_name || "Not provided"}</div>
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>{selectedLead.work_email || "No email on file"}</div>
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>{selectedLead.role_title || "No title on file"}</div>
                </div>
                <div style={metricCard}>
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>Lead Summary</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: palette.navy900 }}>
                    {formatLeadNumber(selectedLead?.lead_number || fallbackLeadNumberById?.[String(selectedLead?.id || "").trim()] || 0)}
                  </div>
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>Submitted: {selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleString() : "-"}</div>
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>Priority domain: {roleKeyToLabel(selectedLead.priority_domain)}</div>
                </div>
              </div>
              {(() => {
                const draft = leadDraftById[String(selectedLead.id)] || {};
                return (
                  <>
                    <div style={responsiveTwoColGrid}>
                      <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                        <span>Lead Status</span>
                        <select value={draft.status ?? selectedLead.status ?? "new"} onChange={(e) => updateLeadDraft(selectedLead.id, "status", e.target.value)} style={inputBase}>
                          <option value="new">New</option>
                          <option value="reviewed">Reviewed</option>
                          <option value="contacted">Contacted</option>
                          <option value="closed">Closed</option>
                        </select>
                      </label>
                      <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                        <span>Follow-up Date</span>
                        <input type="date" value={draft.follow_up_on ?? String(selectedLead.follow_up_on || "").slice(0, 10)} onChange={(e) => updateLeadDraft(selectedLead.id, "follow_up_on", e.target.value)} style={inputBase} />
                      </label>
                    </div>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Internal Notes</span>
                      <textarea value={draft.internal_notes ?? selectedLead.internal_notes ?? selectedLead.notes ?? ""} onChange={(e) => updateLeadDraft(selectedLead.id, "internal_notes", e.target.value)} style={{ ...inputBase, minHeight: 88 }} />
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" style={buttonBase} disabled={leadLoading} onClick={() => void saveLeadUpdate(selectedLead)}>
                        {leadLoading ? "Saving..." : "Save Lead"}
                      </button>
                      <button type="button" style={buttonAlt} onClick={() => updateLeadDraft(selectedLead.id, "mark_follow_up", true)}>
                        Mark Follow-up Done On Save
                      </button>
                      {selectedLead.last_follow_up_at ? (
                        <span style={{ fontSize: 12.5, color: palette.textMuted }}>Last follow-up: {new Date(selectedLead.last_follow_up_at).toLocaleString()}</span>
                      ) : null}
                    </div>
                  </>
                );
              })()}
            </div>
          ) : (
            <div style={{ ...card, color: palette.textMuted }}>Lead not found. Return to Manage Leads and select a lead.</div>
          )}
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
              <div style={{ ...subPanel, display: "grid", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: palette.textMuted }}>
                      Organization
                    </div>
                    <div style={{ fontSize: 19, fontWeight: 900, color: palette.navy900 }}>
                      {selectedTenantOrganizationName || selectedTenantKey}
                    </div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Display Name: {selectedTenantPublicDisplayName || selectedTenantOrganizationName || selectedTenantKey}
                    </div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      URL: {normalizePrimarySubdomain(selectedTenant?.primary_subdomain) || `${sanitizeTenantKey(selectedTenantKey)}.cityreport.io`}
                    </div>
                  </div>
                  {selectedTenantHubUrl ? (
                    <a href={selectedTenantHubUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonBase, textDecoration: "none" }}>
                      Open Organization Hub
                    </a>
                  ) : null}
                </div>
                <label style={{ fontSize: 12.5, display: "grid", gap: 6, maxWidth: 360 }}>
                  <span style={{ color: palette.textMuted }}>Workspace Section</span>
                  <select value={activeTab} onChange={(e) => setActiveTab(e.target.value)} style={tabSelectBase}>
                    {availableTenantWorkspaceTabs.map((tab) => (
                      <option key={tab.key} value={tab.key}>{tab.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            </>
          ) : null}
          {status.hydrate ? <div style={{ fontSize: 12.5, color: palette.red600 }}>{toOrganizationLanguage(status.hydrate)}</div> : null}
        </header>

        {showTenantsSection ? (
          <section style={{ display: "grid", gap: 14 }}>
            {(inAddTenantFlow ? addTenantStep === "setup" : true) ? (
              <div style={{ ...card, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <h2 style={{ margin: 0, color: palette.navy900 }}>
                      {inAddTenantFlow ? "Basic Setup" : "Organization Setup"}
                    </h2>
                    <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                      Core organization routing, status, and launch settings.
                    </p>
                  </div>
                  {!inAddTenantFlow ? (
                    tenantReadOnly ? (
                      <button
                        type="button"
                        style={{ ...buttonAlt, opacity: canEditTenantSetup ? 1 : 0.55 }}
                        onClick={() => setIsEditingTenant(true)}
                        disabled={!canEditTenantSetup}
                        title={canEditTenantSetup ? "Edit organization setup" : "You need the Organizations edit permission"}
                      >
                        Edit Organization Setup
                      </button>
                    ) : (
                      <button
                        type="button"
                        style={buttonAlt}
                        onClick={cancelTenantEditing}
                      >
                        Cancel
                      </button>
                    )
                  ) : null}
                </div>
                <form onSubmit={inAddTenantFlow ? finishAddTenantSetup : saveTenant} style={{ display: "grid", gap: 12 }}>
                  <section style={{ ...subPanel, display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ fontWeight: 900, color: palette.navy900 }}>Identity + Routing</div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Stable keys and URL settings used for this organization across the platform.
                      </div>
                    </div>
                    <div style={responsiveTwoColGrid}>
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
                        <input
                          readOnly={tenantReadOnly}
                          value={tenantForm.name}
                          onChange={(e) => setTenantForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Example Municipality"
                          style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }}
                        />
                      </label>
                      <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                        <span>Primary URL Prefix</span>
                        <input
                          readOnly={tenantReadOnly}
                          value={primarySubdomainPrefix(tenantForm.primary_subdomain)}
                          onChange={(e) => setTenantForm((p) => ({ ...p, primary_subdomain: e.target.value }))}
                          placeholder="examplemunicipality"
                          style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }}
                        />
                        <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                          Public map: {normalizePrimarySubdomain(tenantForm.primary_subdomain) || "examplemunicipality.cityreport.io"} • Hub: {(normalizePrimarySubdomain(tenantForm.primary_subdomain) && `https://${normalizePrimarySubdomain(tenantForm.primary_subdomain)}/hub`) || "https://examplemunicipality.cityreport.io/hub"}
                        </span>
                      </label>
                      <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                        <span>Boundary Dataset Key</span>
                        <input
                          readOnly
                          value={tenantForm.boundary_config_key}
                          placeholder="examplemunicipality_city_geojson"
                          style={{ ...inputBase, background: "#eef4fb", cursor: "not-allowed" }}
                        />
                        <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                          Upload a boundary asset in Assets, then set it as the organization boundary.
                        </span>
                      </label>
                    </div>
                  </section>
                  <section style={{ ...subPanel, display: "grid", gap: 10 }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ fontWeight: 900, color: palette.navy900 }}>Experience + Status</div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Control launch state for the organization workspace and public map.
                      </div>
                    </div>
                    <div style={{ ...responsiveActionGrid, marginTop: 2 }}>
                      <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={tenantForm.is_pilot} disabled={tenantReadOnly} onChange={(e) => setTenantForm((p) => ({ ...p, is_pilot: e.target.checked }))} />
                        Pilot Municipality
                      </label>
                      <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={tenantForm.active} disabled={tenantReadOnly} onChange={(e) => setTenantForm((p) => ({ ...p, active: e.target.checked }))} />
                        Active Organization
                      </label>
                    </div>
                  </section>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {inAddTenantFlow ? (
                        <>
                          <button type="button" style={buttonAlt} onClick={() => setAddTenantStep("contacts")}>
                            Back
                          </button>
                          <button type="submit" style={buttonBase}>
                            Create Organization
                          </button>
                        </>
                      ) : !tenantReadOnly ? (
                        <button type="submit" style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }} disabled={!canEditTenantSetup}>
                          Save Organization Setup
                        </button>
                      ) : null}
                    </div>
                    {!inAddTenantFlow && !tenantReadOnly ? (
                      selectedTenantPendingDeletion ? (
                        <button
                          type="button"
                          style={{ ...buttonAlt, borderColor: palette.red600, color: palette.red600, opacity: canDeleteTenant ? 1 : 0.55 }}
                          onClick={() => void cancelOrganizationDeletion()}
                          disabled={!canDeleteTenant || deleteLoading}
                          title={canDeleteTenant ? "Cancel scheduled organization deletion" : "You need the Organizations delete permission"}
                        >
                          {deleteLoading ? "Saving..." : "Cancel Deletion"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={{ ...buttonAlt, borderColor: palette.red600, color: palette.red600, opacity: canDeleteTenant ? 1 : 0.55 }}
                          onClick={() => {
                            setDeleteConfirmOpen((prev) => !prev);
                            setDeleteConfirmText("");
                            setStatus((prev) => ({ ...prev, tenant: "" }));
                          }}
                          disabled={!canDeleteTenant}
                          title={canDeleteTenant ? "Schedule organization deletion" : "You need the Organizations delete permission"}
                        >
                          Schedule Deletion
                        </button>
                      )
                    ) : null}
                  </div>
                </form>
                {!inAddTenantFlow && selectedTenantPendingDeletion ? (
                  <div style={{ fontSize: 12.5, color: palette.red600 }}>
                    This organization is scheduled for deletion on {formatDateTimeDisplay(selectedTenantDeletionScheduledFor)}.
                    The record is being held for {ORGANIZATION_DELETION_HOLD_DAYS} days before removal.
                  </div>
                ) : null}
                {!inAddTenantFlow && !tenantReadOnly && deleteConfirmOpen ? (
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
                {status.tenant ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.tenant)}</div> : null}
              </div>
            ) : null}

            {(inAddTenantFlow ? addTenantStep === "organization" : true) ? (
              <div style={{ ...card, display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>
                    {inAddTenantFlow ? "Organization Information" : "Organization Information"}
                  </h2>
                  <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                    Public identity, mailing address, billing, and contract details for the organization.
                  </p>
                </div>
                <section style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ fontWeight: 900, color: palette.navy900 }}>Naming + Identity</div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Names and outward-facing profile details used across CityReport surfaces.
                      </div>
                    </div>
                    {!inAddTenantFlow ? (
                      organizationSectionReadOnly("identity") ? (
                        <button
                          type="button"
                          style={{ ...buttonAlt, opacity: canEditTenantSetup && !editingOrganizationSection ? 1 : 0.55 }}
                          onClick={() => setEditingOrganizationSection("identity")}
                          disabled={!canEditTenantSetup || Boolean(editingOrganizationSection)}
                        >
                          Edit
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }}
                            onClick={() => void saveTenantProfile()}
                            disabled={!canEditTenantSetup}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            style={buttonAlt}
                            onClick={resetProfileDraft}
                          >
                            Cancel
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                  <div style={responsiveTwoColGrid}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Legal Organization Name</span>
                      <input readOnly={organizationSectionReadOnly("identity")} value={profileForm.legal_name} onChange={(e) => setProfileForm((p) => ({ ...p, legal_name: e.target.value }))} placeholder="Example Municipality Public Works" style={{ ...inputBase, background: organizationSectionReadOnly("identity") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Public Display Name</span>
                      <input readOnly={organizationSectionReadOnly("identity")} value={profileForm.display_name} onChange={(e) => setProfileForm((p) => ({ ...p, display_name: e.target.value }))} placeholder="Example Municipality" style={{ ...inputBase, background: organizationSectionReadOnly("identity") ? "#eef4fb" : inputBase.background }} />
                      <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                        Falls back to Organization Name when a public label has not been set.
                      </span>
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Municipality Website URL</span>
                      <input readOnly={organizationSectionReadOnly("identity")} value={profileForm.website_url} onChange={(e) => setProfileForm((p) => ({ ...p, website_url: e.target.value }))} placeholder="https://www.examplemunicipality.gov" style={{ ...inputBase, background: organizationSectionReadOnly("identity") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Timezone</span>
                      <input readOnly={organizationSectionReadOnly("identity")} value={profileForm.timezone} onChange={(e) => setProfileForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="America/New_York" style={{ ...inputBase, background: organizationSectionReadOnly("identity") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4, gridColumn: "1 / -1" }}>
                      <span>URL Extension (Profile Alias)</span>
                      <input readOnly={organizationSectionReadOnly("identity")} value={profileForm.url_extension} onChange={(e) => setProfileForm((p) => ({ ...p, url_extension: e.target.value }))} placeholder="examplemunicipality" style={{ ...inputBase, background: organizationSectionReadOnly("identity") ? "#eef4fb" : inputBase.background }} />
                      <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                        Stored for profile and future alias use. It does not currently change live cityreport.io routing.
                      </span>
                    </label>
                  </div>
                </section>
                <section style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ fontWeight: 900, color: palette.navy900 }}>Mailing Address</div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Primary mailing and billing address information for the organization.
                      </div>
                    </div>
                    {!inAddTenantFlow ? (
                      organizationSectionReadOnly("address") ? (
                        <button
                          type="button"
                          style={{ ...buttonAlt, opacity: canEditTenantSetup && !editingOrganizationSection ? 1 : 0.55 }}
                          onClick={() => setEditingOrganizationSection("address")}
                          disabled={!canEditTenantSetup || Boolean(editingOrganizationSection)}
                        >
                          Edit
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }}
                            onClick={() => void saveTenantProfile()}
                            disabled={!canEditTenantSetup}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            style={buttonAlt}
                            onClick={resetProfileDraft}
                          >
                            Cancel
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                  <div style={responsiveTwoColGrid}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Address 1</span>
                      <input readOnly={organizationSectionReadOnly("address")} value={profileForm.mailing_address_1} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_address_1: e.target.value }))} placeholder="100 Civic Center Dr" style={{ ...inputBase, background: organizationSectionReadOnly("address") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Address 2</span>
                      <input readOnly={organizationSectionReadOnly("address")} value={profileForm.mailing_address_2} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_address_2: e.target.value }))} placeholder="Building A, Suite 200 (optional)" style={{ ...inputBase, background: organizationSectionReadOnly("address") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>City</span>
                      <input readOnly={organizationSectionReadOnly("address")} value={profileForm.mailing_city} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_city: e.target.value }))} placeholder="Example City" style={{ ...inputBase, background: organizationSectionReadOnly("address") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>State</span>
                      <input readOnly={organizationSectionReadOnly("address")} value={profileForm.mailing_state} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_state: e.target.value }))} placeholder="ST" style={{ ...inputBase, background: organizationSectionReadOnly("address") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>ZIP</span>
                      <input readOnly={organizationSectionReadOnly("address")} value={profileForm.mailing_zip} onChange={(e) => setProfileForm((p) => ({ ...p, mailing_zip: e.target.value }))} placeholder="12345" style={{ ...inputBase, background: organizationSectionReadOnly("address") ? "#eef4fb" : inputBase.background }} />
                    </label>
                  </div>
                </section>
                <section style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ fontWeight: 900, color: palette.navy900 }}>Contract + Billing</div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Billing and agreement details used for operations and account management.
                      </div>
                    </div>
                    {!inAddTenantFlow ? (
                      organizationSectionReadOnly("contract") ? (
                        <button
                          type="button"
                          style={{ ...buttonAlt, opacity: canEditTenantSetup && !editingOrganizationSection ? 1 : 0.55 }}
                          onClick={() => setEditingOrganizationSection("contract")}
                          disabled={!canEditTenantSetup || Boolean(editingOrganizationSection)}
                        >
                          Edit
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }}
                            onClick={() => void saveTenantProfile()}
                            disabled={!canEditTenantSetup}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            style={buttonAlt}
                            onClick={resetProfileDraft}
                          >
                            Cancel
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                  <div style={responsiveTwoColGrid}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Billing Email</span>
                      <input readOnly={organizationSectionReadOnly("contract")} value={profileForm.billing_email} onChange={(e) => setProfileForm((p) => ({ ...p, billing_email: e.target.value }))} placeholder="billing@examplemunicipality.gov" style={{ ...inputBase, background: organizationSectionReadOnly("contract") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Contract Status</span>
                      <select disabled={organizationSectionReadOnly("contract")} value={profileForm.contract_status} onChange={(e) => setProfileForm((p) => ({ ...p, contract_status: e.target.value }))} style={{ ...inputBase, background: organizationSectionReadOnly("contract") ? "#eef4fb" : inputBase.background }}>
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="expired">Expired</option>
                        <option value="terminated">Terminated</option>
                      </select>
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Contract Start Date</span>
                      <input readOnly={organizationSectionReadOnly("contract")} type="date" value={profileForm.contract_start_date} onChange={(e) => setProfileForm((p) => ({ ...p, contract_start_date: e.target.value }))} style={{ ...inputBase, background: organizationSectionReadOnly("contract") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Contract End Date</span>
                      <input readOnly={organizationSectionReadOnly("contract")} type="date" value={profileForm.contract_end_date} onChange={(e) => setProfileForm((p) => ({ ...p, contract_end_date: e.target.value }))} style={{ ...inputBase, background: organizationSectionReadOnly("contract") ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Renewal Date</span>
                      <input readOnly={organizationSectionReadOnly("contract")} type="date" value={profileForm.renewal_date} onChange={(e) => setProfileForm((p) => ({ ...p, renewal_date: e.target.value }))} style={{ ...inputBase, background: organizationSectionReadOnly("contract") ? "#eef4fb" : inputBase.background }} />
                    </label>
                  </div>
                </section>
                <section style={{ ...subPanel, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ fontWeight: 900, color: palette.navy900 }}>Operational Notes</div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Internal onboarding, operations, or account notes for this organization.
                      </div>
                    </div>
                    {!inAddTenantFlow ? (
                      organizationSectionReadOnly("notes") ? (
                        <button
                          type="button"
                          style={{ ...buttonAlt, opacity: canEditTenantSetup && !editingOrganizationSection ? 1 : 0.55 }}
                          onClick={() => setEditingOrganizationSection("notes")}
                          disabled={!canEditTenantSetup || Boolean(editingOrganizationSection)}
                        >
                          Edit
                        </button>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }}
                            onClick={() => void saveTenantProfile()}
                            disabled={!canEditTenantSetup}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            style={buttonAlt}
                            onClick={resetProfileDraft}
                          >
                            Cancel
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Notes</span>
                    <textarea readOnly={organizationSectionReadOnly("notes")} value={profileForm.notes} onChange={(e) => setProfileForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Add context for onboarding, constraints, and operating notes." style={{ ...inputBase, minHeight: 110, background: organizationSectionReadOnly("notes") ? "#eef4fb" : inputBase.background }} />
                  </label>
                </section>
                {inAddTenantFlow ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={buttonBase} onClick={() => setAddTenantStep("contacts")}>
                      Next: Contacts
                    </button>
                  </div>
                ) : null}
                {status.profile ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.profile)}</div> : null}
              </div>
            ) : null}

            {(inAddTenantFlow ? addTenantStep === "contacts" : false) ? (
              <div style={{ ...card, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>
                    {inAddTenantFlow ? "Primary + Additional Contacts" : "Primary + Additional Contacts"}
                  </h2>
                  {!inAddTenantFlow && profileReadOnly ? (
                    <button type="button" style={{ ...buttonAlt, opacity: canEditTenantSetup ? 1 : 0.55 }} onClick={() => setIsEditingProfile(true)} disabled={!canEditTenantSetup}>
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
                    <button type="submit" style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }} disabled={!canEditTenantSetup}>Save Contact Information</button>
                  </form>
                ) : null}
                {status.profile ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.profile)}</div> : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "contacts" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, color: palette.navy900 }}>Points of Contact</h2>
                <button
                  type="button"
                  style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }}
                  disabled={!canEditTenantSetup}
                  onClick={addAdditionalContactFromContactsPage}
                >
                  Add Contact
                </button>
              </div>

              <div style={{ ...subPanel, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 900, color: palette.navy900 }}>Primary Contact</div>
                  {!editingPrimaryContact ? (
                    <button
                      type="button"
                      style={{ ...buttonAlt, opacity: canEditTenantSetup ? 1 : 0.55 }}
                      disabled={!canEditTenantSetup}
                      onClick={() => {
                        setEditingAdditionalContactIndex(null);
                        setEditingPrimaryContact(true);
                      }}
                    >
                      Edit
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }}
                        disabled={!canEditTenantSetup}
                        onClick={() => void saveContactsProfile()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        style={buttonAlt}
                        onClick={resetProfileDraft}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div style={contactFieldGrid}>
                  <label style={contactField}>
                    <span>Name</span>
                    <input
                      readOnly={!editingPrimaryContact}
                      value={profileForm.contact_primary_name}
                      onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_name: e.target.value }))}
                      placeholder="Not set"
                      style={{ ...contactFieldInput, background: editingPrimaryContact ? inputBase.background : "#eef4fb" }}
                    />
                  </label>
                  <label style={contactField}>
                    <span>Role / Title</span>
                    <input
                      readOnly={!editingPrimaryContact}
                      value={profileForm.contact_primary_title}
                      onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_title: e.target.value }))}
                      placeholder="Not set"
                      style={{ ...contactFieldInput, background: editingPrimaryContact ? inputBase.background : "#eef4fb" }}
                    />
                  </label>
                  <label style={contactField}>
                    <span>Email</span>
                    <input
                      readOnly={!editingPrimaryContact}
                      value={profileForm.contact_primary_email}
                      onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_email: e.target.value }))}
                      placeholder="Not set"
                      style={{ ...contactFieldInput, background: editingPrimaryContact ? inputBase.background : "#eef4fb" }}
                    />
                  </label>
                  <label style={contactField}>
                    <span>Phone</span>
                    <input
                      readOnly={!editingPrimaryContact}
                      value={profileForm.contact_primary_phone}
                      onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_phone: e.target.value }))}
                      placeholder="Not set"
                      style={{ ...contactFieldInput, background: editingPrimaryContact ? inputBase.background : "#eef4fb" }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ ...subPanel, display: "grid", gap: 10 }}>
                <div style={{ fontWeight: 900, color: palette.navy900 }}>Additional Contacts</div>
                {Array.isArray(profileForm.additional_contacts) && profileForm.additional_contacts.length ? (
                  <div style={{ display: "grid", gap: 10 }}>
                    {profileForm.additional_contacts.map((contact, index) => {
                      const isEditingContact = editingAdditionalContactIndex === index;
                      return (
                      <div key={`contact-${index}`} style={{ ...subPanel, display: "grid", gap: 8 }}>
                        <div style={{ display: "grid", gap: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <strong style={{ color: palette.navy900 }}>Contact {index + 1}</strong>
                          {isEditingContact ? (
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }}
                                disabled={!canEditTenantSetup}
                                onClick={() => void saveContactsProfile()}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                style={buttonAlt}
                                onClick={resetProfileDraft}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                style={{ ...buttonAlt, borderColor: palette.red600, color: palette.red600, opacity: canEditTenantSetup ? 1 : 0.55 }}
                                disabled={!canEditTenantSetup}
                                onClick={() => setContactDeleteConfirmIndex(index)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              style={{ ...buttonAlt, opacity: canEditTenantSetup ? 1 : 0.55 }}
                              disabled={!canEditTenantSetup}
                              onClick={() => {
                                setEditingPrimaryContact(false);
                                setEditingAdditionalContactIndex(index);
                              }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        <div style={contactFieldGrid}>
                          <label style={contactField}>
                            <span>Name</span>
                            <input
                              readOnly={!isEditingContact}
                              value={contact.name || ""}
                              onChange={(e) => updateAdditionalContact(index, "name", e.target.value)}
                              placeholder="Not set"
                              style={{ ...contactFieldInput, background: isEditingContact ? inputBase.background : "#eef4fb" }}
                            />
                          </label>
                          <label style={contactField}>
                            <span>Role / Title</span>
                            <input
                              readOnly={!isEditingContact}
                              value={contact.title || ""}
                              onChange={(e) => updateAdditionalContact(index, "title", e.target.value)}
                              placeholder="Not set"
                              style={{ ...contactFieldInput, background: isEditingContact ? inputBase.background : "#eef4fb" }}
                            />
                          </label>
                          <label style={contactField}>
                            <span>Email</span>
                            <input
                              readOnly={!isEditingContact}
                              value={contact.email || ""}
                              onChange={(e) => updateAdditionalContact(index, "email", e.target.value)}
                              placeholder="Not set"
                              style={{ ...contactFieldInput, background: isEditingContact ? inputBase.background : "#eef4fb" }}
                            />
                          </label>
                          <label style={contactField}>
                            <span>Phone</span>
                            <input
                              readOnly={!isEditingContact}
                              value={contact.phone || ""}
                              onChange={(e) => updateAdditionalContact(index, "phone", e.target.value)}
                              placeholder="Not set"
                              style={{ ...contactFieldInput, background: isEditingContact ? inputBase.background : "#eef4fb" }}
                            />
                          </label>
                        </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                    No additional contacts saved yet.
                  </div>
                )}
              </div>
              {status.profile ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.profile)}</div> : null}
            </div>
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "users" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, color: palette.navy900 }}>Current Organization Users and Admins</h2>
                <button
                  type="button"
                  style={{ ...buttonBase, opacity: canManageTenantUsers ? 1 : 0.55 }}
                  disabled={!canManageTenantUsers}
                  onClick={() => setTenantUsersManagementView("add")}
                >
                  Add User/Admin
                </button>
              </div>
              {status.users ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.users)}</div> : null}
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
                              style={{ ...inputBase, minWidth: 0, width: 150, maxWidth: "100%" }}
                              disabled={!canManageTenantUsers}
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
                            <div style={{ display: "grid", gap: 10 }}>
                              <button
                                type="button"
                                style={{ ...buttonAlt, opacity: canManageTenantUsers ? 1 : 0.55 }}
                                onClick={() => void saveTenantAdminRoleEdit(row)}
                                disabled={!canManageTenantUsers}
                                title={canManageTenantUsers ? "Save role change" : "You need the Users edit permission"}
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
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                style={{ ...buttonAlt, opacity: canManageTenantUsers ? 1 : 0.55 }}
                                onClick={() => {
                                  setEditingAssignmentKey(rowKey);
                                  setEditingAssignmentRole(String(row?.role || "").trim());
                                }}
                                disabled={!canManageTenantUsers}
                                title={canManageTenantUsers ? "Edit role" : "You need the Users edit permission"}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                style={{ ...buttonAlt, opacity: canDeleteTenantUsers ? 1 : 0.55 }}
                                onClick={() => void removeTenantAdmin(row)}
                                disabled={!canDeleteTenantUsers}
                                title={canDeleteTenantUsers ? "Remove role" : "You need the Users delete permission"}
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
            <div style={{ ...card, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, color: palette.navy900 }}>Roles and Permissions</h2>
                <button
                  type="button"
                  style={{ ...buttonBase, opacity: canManageTenantRoles ? 1 : 0.55 }}
                  disabled={!canManageTenantRoles}
                  onClick={() => setTenantRoleManagementView("add")}
                >
                  Add Role
                </button>
              </div>
              {status.roles ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.roles)}</div> : null}
              <div style={{ display: "grid", gap: 6, maxWidth: 360 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: palette.navy900 }}>Choose Role</div>
                <select value={selectedRoleKey} onChange={(e) => setSelectedRoleKey(e.target.value)} style={inputBase}>
                  {sortedTenantRoleDefinitions.map((row) => {
                    const role = String(row?.role || "").trim();
                    if (!role) return null;
                    return (
                      <option key={role} value={role}>
                        {toOrganizationLanguage(String(row?.role_label || "").trim() || roleKeyToLabel(role))}
                      </option>
                    );
                  })}
                </select>
              </div>
              {selectedRoleDefinition ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <h2 style={{ margin: 0, color: palette.navy900 }}>
                        Manage Role Permission ({toOrganizationLanguage(String(selectedRoleDefinition.role_label || selectedRoleDefinition.role))})
                      </h2>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        {selectedRoleDefinition?.is_system ? "System role" : "Custom role"}
                        {" • "}
                        {selectedRoleDefinition?.active === false ? "Disabled" : "Active"}
                        {" • "}
                        {selectedRoleAssignmentCount} assignment{selectedRoleAssignmentCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {!tenantRoleEditMode ? (
                        <button
                          type="button"
                          style={{ ...buttonAlt, opacity: canManageTenantRoles ? 1 : 0.55 }}
                          disabled={!canManageTenantRoles}
                          onClick={() => setTenantRoleEditMode(true)}
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={{
                            ...buttonAlt,
                            borderColor: palette.red600,
                            color: palette.red600,
                            opacity: canDeleteTenantRoles && selectedRoleDefinition?.is_system !== true && selectedRoleAssignmentCount === 0 ? 1 : 0.55,
                          }}
                          disabled={!canDeleteTenantRoles || selectedRoleDefinition?.is_system === true || selectedRoleAssignmentCount > 0}
                          title={
                            selectedRoleDefinition?.is_system === true
                              ? "System roles cannot be removed."
                              : selectedRoleAssignmentCount > 0
                                ? "Remove assignments before deleting this role."
                                : canDeleteTenantRoles
                                  ? "Delete role"
                                  : "You need the Roles delete permission"
                          }
                          onClick={() => setTenantRoleDeleteConfirmOpen(true)}
                        >
                          Delete Role
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr>
                          <th style={tableHeadCell}>Module</th>
                          {TENANT_PERMISSION_ACTIONS.map((action) => (
                            <th key={action.key} style={tableHeadCell}>{action.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TENANT_PERMISSION_MODULES.map((module) => (
                          <tr key={module.key}>
                            <td style={{ padding: "8px 0", fontWeight: 700 }}>{module.label}</td>
                            {TENANT_PERMISSION_ACTIONS.map((action) => {
                              const permissionKey = `${module.key}.${action.key}`;
                              return (
                                <td key={permissionKey} style={{ padding: "8px 0" }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(rolePermissionDraft?.[permissionKey])}
                                    disabled={!canManageTenantRoles || !tenantRoleEditMode}
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
                      style={{ ...buttonBase, opacity: canManageTenantRoles ? 1 : 0.55 }}
                      disabled={!canManageTenantRoles || !tenantRoleEditMode || !rolePermissionDirty}
                      onClick={() => {
                        void saveRolePermissions();
                        setTenantRoleEditMode(false);
                      }}
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
                        setTenantRoleEditMode(false);
                      }}
                      disabled={!rolePermissionDirty && !tenantRoleEditMode}
                    >
                      {tenantRoleEditMode ? "Cancel" : "Reset Changes"}
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                  No roles found for this organization.
                </p>
              )}
            </div>
          </section>
        ) : null}

        {inTenantWorkspace && ["domains", "map-features", "files"].includes(activeTab) ? (
          <section style={{ display: "grid", gap: 14 }}>
            {activeTab === "domains" ? (
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 3 }}>
                <h2 style={{ margin: 0, color: palette.navy900 }}>Domains</h2>
                <p style={{ margin: 0, color: palette.textMuted }}>
                  Assign platform-defined domains to this organization, then manage each assigned domain&apos;s routing, reporting, notification, and marker settings here.
                </p>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    style={{
                      ...buttonBase,
                      marginLeft: "auto",
                      alignSelf: "flex-start",
                      opacity: canManageDomainRegistry && tenantDomainAssignmentSchemaReady && !tenantDomainAssignmentSaving ? 1 : 0.55,
                      background: `linear-gradient(180deg, ${palette.mint600} 0%, ${palette.mint700} 100%)`,
                      border: `1px solid ${palette.mint700}`,
                      boxShadow: "0 10px 20px rgba(15,110,92,0.24)",
                    }}
                    disabled={!canManageDomainRegistry || !tenantDomainAssignmentSchemaReady || tenantDomainAssignmentSaving}
                    onClick={beginCreateTenantDomainAssignment}
                  >
                    Assign Global Domain
                  </button>
                </div>
                {canViewDomainRegistry && inTenantWorkspace ? (
                  <div style={{ ...subPanel, display: "grid", gap: 12, background: "rgba(255,255,255,0.78)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 3 }}>
                        <div style={{ fontWeight: 900, color: palette.navy900 }}>Assigned Domains</div>
                        <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                          Select an assigned domain and the section you want to review or edit.
                        </div>
                      </div>
                    </div>
                    {status.domainAssignments ? (
                      <div style={{ fontSize: 12.5, color: status.domainAssignments.startsWith("Error:") ? palette.red600 : palette.mint700 }}>
                        {status.domainAssignments}
                      </div>
                    ) : null}
                    {!tenantDomainAssignmentSchemaReady ? (
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Tenant domain assignment tables are not available yet in this environment. Run the latest migration locally to enable assignment management.
                      </div>
                    ) : null}
                    {tenantDomainAssignmentEditorOpen && !editingTenantDomainAssignmentKey ? renderTenantDomainAssignmentEditor() : null}
                    <div style={{ display: "grid", gap: 10 }}>
                      {selectedTenantAssignedDomainRows.length ? (
                        <>
                          <div style={{ display: "grid", gap: 10 }}>
                            <label style={{ ...modalField, maxWidth: 360 }}>
                              <span>Assigned Domain</span>
                              <select
                                value={selectedAssignedDomainRow?.domain?.key || ""}
                                onChange={(event) => toggleAssignedDomainCard(event.target.value)}
                                style={modalInput}
                              >
                                {selectedTenantAssignedDomainRows.map((row) => (
                                  <option key={row.domain.key} value={row.domain.key}>{row.domain.label}</option>
                                ))}
                              </select>
                            </label>
                            <label style={{ ...modalField, maxWidth: 360 }}>
                              <span>Domain Section</span>
                              <select
                                value={selectedAssignedDomainSectionKey}
                                onChange={(event) => setSelectedAssignedDomainSectionKey(event.target.value)}
                                style={modalInput}
                              >
                                {ASSIGNED_DOMAIN_SECTION_OPTIONS.map((option) => (
                                  <option key={option.key} value={option.key}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          {(() => {
                        const assignment = selectedAssignedDomainRow;
                        if (!assignment) return null;
                        const d = assignment.domain;
                        const isExpanded =
                          selectedAssignedDomainKey === d.key
                          || expandedAssignedDomainCardKey === d.key
                          || editingTenantDomainAssignmentKey === d.key
                          || editingDomainKey === d.key;
                        const domainType = String(domainConfigForm?.[d.key]?.domain_type || defaultDomainType(d.key)).trim().toLowerCase() || defaultDomainType(d.key);
                        const coordinateFiles = domainCoordinateFiles?.[d.key] || [];
                        const isAssetBacked = domainType === "asset_backed";
                        const isEditingAssignment = editingTenantDomainAssignmentKey === d.key;
                        const isEditingDomain = editingDomainKey === d.key;
                        const domainFieldsReadOnly = !canEditTenantDomains || !isEditingDomain;
                        const assignmentFieldsReadOnly = !canManageDomainRegistry || !isEditingAssignment;
                        const editLockedByOtherDomain = Boolean(editingDomainKey) && !isEditingDomain;
                        const assignmentEditLockedByOtherDomain = Boolean(editingTenantDomainAssignmentKey) && !isEditingAssignment;
                        const domainTypeOptionRows = normalizeDomainTypeOptionConfigs(domainConfigForm?.[d.key]?.type_options, d.key);
                        const domainDisclosureRows = Array.isArray(domainConfigForm?.[d.key]?.report_disclosures)
                          ? domainConfigForm[d.key].report_disclosures
                          : defaultDomainDisclosures(d.key);
                        return (
                          <div
                            key={`${assignment.tenant_key}:${assignment.domain_key}`}
                            ref={(node) => {
                              if (node) assignedDomainCardRefs.current[d.key] = node;
                              else delete assignedDomainCardRefs.current[d.key];
                            }}
                            style={{
                              ...subPanel,
                              display: "grid",
                              gap: 10,
                              background: "rgba(255,255,255,0.7)",
                              borderColor: "rgba(17,36,69,0.12)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                              <div style={{ display: "grid", gap: 4 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                  <strong style={{ color: palette.navy900 }}>{d.label}</strong>
                                  <span style={{ fontSize: 11.5, fontWeight: 800, color: assignment.active ? palette.mint700 : palette.red600, background: assignment.active ? "rgba(18,128,106,0.12)" : "rgba(209,67,67,0.12)", borderRadius: 999, padding: "4px 10px" }}>
                                    {assignment.active ? "Assignment Active" : "Assignment Inactive"}
                                  </span>
                                  <span style={{ fontSize: 11.5, fontWeight: 800, color: palette.navy500, background: "rgba(46,98,143,0.12)", borderRadius: 999, padding: "4px 10px" }}>
                                    {d.domain_class === "asset_backed" ? "Asset-Backed" : "Incident-Driven"}
                                  </span>
                                  <span style={{
                                    borderRadius: 999,
                                    padding: "4px 10px",
                                    fontSize: 11.5,
                                    fontWeight: 800,
                                    color: domainVisibilityForm[d.key] === "disabled" ? palette.red600 : palette.navy500,
                                    background: domainVisibilityForm[d.key] === "disabled" ? "rgba(209,67,67,0.12)" : "rgba(46,98,143,0.12)",
                                  }}>
                                    {domainVisibilityForm[d.key] === "disabled" ? "Disabled" : "Enabled"}
                                  </span>
                                  {assignment.organization_monitored_repairs !== false ? (
                                    <span style={{ fontSize: 11.5, fontWeight: 800, color: palette.mint700, background: "rgba(18,128,106,0.12)", borderRadius: 999, padding: "4px 10px" }}>
                                      Managed by Organization
                                    </span>
                                  ) : null}
                                </div>
                                <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                  <code>{assignment.domain_key}</code>
                                  {assignment.notification_email ? ` • ${assignment.notification_email}` : ""}
                                  {assignment.billing_status ? ` • Billing Status ${assignment.billing_status}` : ""}
                                  {assignment.billing_model ? ` • Billing ${assignment.billing_model}` : ""}
                                </div>
                                {assignment.billing_notes ? (
                                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>Billing notes: {assignment.billing_notes}</div>
                                ) : null}
                              </div>
                            </div>
                                {selectedAssignedDomainSectionKey === "tenant-assignment" ? (
                                <div
                              style={{
                                ...subPanel,
                                display: "grid",
                                gap: 10,
                                background: "rgba(46,98,143,0.08)",
                                borderColor: "rgba(46,98,143,0.2)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                                <div style={{ display: "grid", gap: 4 }}>
                                  <div style={{ fontSize: 13, fontWeight: 900, color: palette.navy900 }}>Tenant Assignment</div>
                                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                    Activation, routing, billing, and operational ownership for this tenant/domain assignment.
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {!isEditingAssignment ? (
                                    <button
                                      type="button"
                                      style={{ ...buttonAlt, opacity: canManageDomainRegistry && !tenantDomainAssignmentSaving && !isEditingDomain && !editLockedByOtherDomain ? 1 : 0.55 }}
                                      disabled={!canManageDomainRegistry || tenantDomainAssignmentSaving || isEditingDomain || editLockedByOtherDomain || assignmentEditLockedByOtherDomain}
                                      onClick={() => beginEditTenantDomainAssignment(assignment.domain_key)}
                                      title={
                                        assignmentEditLockedByOtherDomain
                                          ? "Finish the current assignment edit before opening another one."
                                          : isEditingDomain
                                            ? "Finish editing settings before editing assignment."
                                            : canManageDomainRegistry
                                              ? `Edit ${d.label} assignment`
                                              : "You need the Domains edit permission"
                                      }
                                    >
                                      Edit Assignment
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        style={{ ...buttonBase, opacity: canManageDomainRegistry ? 1 : 0.55 }}
                                        disabled={!canManageDomainRegistry || tenantDomainAssignmentSaving}
                                        onClick={() => void saveTenantDomainAssignment()}
                                      >
                                        Save Assignment
                                      </button>
                                      <button
                                        type="button"
                                        style={buttonAlt}
                                        disabled={tenantDomainAssignmentSaving}
                                        onClick={cancelTenantDomainAssignmentEditor}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div style={responsiveActionGrid}>
                                <label style={modalField}>
                                  <span>Assignment Active</span>
                                  <select
                                    value={isEditingAssignment ? (tenantDomainAssignmentForm?.active ? "active" : "inactive") : (assignment.active ? "active" : "inactive")}
                                    disabled={assignmentFieldsReadOnly}
                                    onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, active: e.target.value === "active" }))}
                                    style={{ ...modalInput, background: assignmentFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                  </select>
                                </label>
                                <label style={modalField}>
                                  <span>Visibility</span>
                                  <select
                                    value={isEditingAssignment ? (tenantDomainAssignmentForm?.visibility || "enabled") : (assignment.visibility || "enabled")}
                                    disabled={assignmentFieldsReadOnly}
                                    onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, visibility: e.target.value }))}
                                    style={{ ...modalInput, background: assignmentFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  >
                                    {DOMAIN_ASSIGNMENT_VISIBILITY_OPTIONS.map((option) => (
                                      <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label style={modalField}>
                                  <span>Notification Email</span>
                                  <input
                                    readOnly={assignmentFieldsReadOnly}
                                    value={isEditingAssignment ? (tenantDomainAssignmentForm?.notification_email || "") : (assignment.notification_email || "")}
                                    onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, notification_email: e.target.value }))}
                                    placeholder="notifications@examplecity.gov"
                                    style={{ ...modalInput, background: assignmentFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  />
                                </label>
                                <label style={modalField}>
                                  <span>Billing Status</span>
                                  <select
                                    value={isEditingAssignment ? (tenantDomainAssignmentForm?.billing_status || "not_applicable") : (assignment.billing_status || "not_applicable")}
                                    disabled={assignmentFieldsReadOnly}
                                    onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, billing_status: e.target.value }))}
                                    style={{ ...modalInput, background: assignmentFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  >
                                    {DOMAIN_BILLING_STATUS_OPTIONS.map((option) => (
                                      <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label style={modalField}>
                                  <span>Billing Model</span>
                                  <select
                                    value={isEditingAssignment ? (tenantDomainAssignmentForm?.billing_model || "included") : (assignment.billing_model || "included")}
                                    disabled={assignmentFieldsReadOnly}
                                    onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, billing_model: e.target.value }))}
                                    style={{ ...modalInput, background: assignmentFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  >
                                    {DOMAIN_BILLING_MODEL_OPTIONS.map((option) => (
                                      <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label style={modalField}>
                                  <span>Billing Amount</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    readOnly={assignmentFieldsReadOnly}
                                    value={isEditingAssignment ? (tenantDomainAssignmentForm?.billing_amount ?? "0") : String(assignment.billing_amount ?? "0")}
                                    onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, billing_amount: e.target.value }))}
                                    style={{ ...modalInput, background: assignmentFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  />
                                </label>
                                <div style={{ ...modalField, justifyContent: "center" }}>
                                  <span>Repair Monitoring</span>
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      minHeight: 48,
                                      padding: "0 14px",
                                      borderRadius: 14,
                                      border: "1px solid rgba(17, 36, 69, 0.14)",
                                      background: "#eef4fb",
                                      color: palette.navy900,
                                      fontWeight: 700,
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isEditingAssignment ? tenantDomainAssignmentForm?.organization_monitored_repairs !== false : assignment.organization_monitored_repairs !== false}
                                      disabled={assignmentFieldsReadOnly}
                                      onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, organization_monitored_repairs: e.target.checked }))}
                                    />
                                    <span style={{ display: "grid", gap: 2 }}>
                                      <span style={{ fontWeight: 800 }}>Managed by Organization?</span>
                                      <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.78 }}>
                                        {(isEditingAssignment ? tenantDomainAssignmentForm?.organization_monitored_repairs !== false : assignment.organization_monitored_repairs !== false) ? "Yes" : "No"}
                                      </span>
                                    </span>
                                  </label>
                                </div>
                                <label style={{ ...modalField, gridColumn: "1 / -1" }}>
                                  <span>Billing Notes</span>
                                  <textarea
                                    readOnly={assignmentFieldsReadOnly}
                                    value={isEditingAssignment ? (tenantDomainAssignmentForm?.billing_notes || "") : (assignment.billing_notes || "No billing notes.")}
                                    onChange={(e) => setTenantDomainAssignmentForm((prev) => ({ ...prev, billing_notes: e.target.value }))}
                                    rows={3}
                                    placeholder="Optional notes about pricing, review status, or future billing triggers."
                                    style={{ ...modalInput, minHeight: 86, resize: "vertical", background: assignmentFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  />
                                </label>
                              </div>
                            </div>
                                ) : null}
                                {selectedAssignedDomainSectionKey === "marker-icon" ? (
                            <div
                              style={{
                                ...subPanel,
                                display: "grid",
                                gap: 10,
                                background: "linear-gradient(180deg, rgba(18,128,106,0.14) 0%, rgba(18,128,106,0.09) 100%)",
                                borderColor: "rgba(18,128,106,0.26)",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                                <div style={{ display: "grid", gap: 4 }}>
                                  <div style={{ fontSize: 13, fontWeight: 900, color: palette.navy900 }}>Marker and Icon Settings</div>
                                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                    {isAssetBacked
                                      ? "Persistent mapped assets can be seeded with coordinates and also route notifications."
                                      : "Resident and staff reports create incidents in this domain and route to the selected notification inbox."}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {!isEditingDomain ? (
                                    <button
                                      type="button"
                                      style={{ ...buttonAlt, opacity: canEditTenantDomains && !editLockedByOtherDomain && !isEditingAssignment ? 1 : 0.55 }}
                                      disabled={!canEditTenantDomains || editLockedByOtherDomain || isEditingAssignment}
                                      onClick={() => beginDomainEdit(d.key)}
                                      title={
                                        editLockedByOtherDomain
                                          ? "Finish the current domain edit before opening another domain."
                                          : isEditingAssignment
                                            ? "Finish editing assignment before editing settings."
                                            : canEditTenantDomains
                                              ? `Edit ${d.label}`
                                              : "You need the Domains edit permission"
                                      }
                                    >
                                      Edit Settings
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        style={{ ...buttonBase, opacity: canEditTenantDomains ? 1 : 0.55 }}
                                        disabled={!canEditTenantDomains}
                                        onClick={() => void saveDomainAndFeatureSettings(null, { closeEditingDomain: d.key })}
                                      >
                                        Save Settings
                                      </button>
                                      <button
                                        type="button"
                                        style={buttonAlt}
                                        onClick={() => cancelDomainEdit(d.key)}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div style={responsiveActionGrid}>
                                <label style={modalField}>
                                  <span>Display Label</span>
                                  <input
                                    readOnly={domainFieldsReadOnly}
                                    value={domainConfigForm?.[d.key]?.display_label || ""}
                                    onChange={(e) => setDomainConfigForm((prev) => ({
                                      ...prev,
                                      [d.key]: {
                                        ...(prev?.[d.key] || {}),
                                        display_label: e.target.value,
                                      },
                                    }))}
                                    placeholder={defaultDomainLabel(d.key)}
                                    style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  />
                                </label>
                                <label style={modalField}>
                                  <span>Marker Color</span>
                                  <div style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 8, alignItems: "center" }}>
                                    <input
                                      type="color"
                                      value={sanitizeHexColor(domainConfigForm?.[d.key]?.marker_color, defaultDomainMarkerColor(d.key))}
                                      disabled={domainFieldsReadOnly}
                                      onChange={(e) => setDomainConfigForm((prev) => ({
                                        ...prev,
                                        [d.key]: {
                                          ...(prev?.[d.key] || {}),
                                          marker_color: e.target.value,
                                        },
                                      }))}
                                      style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background, padding: 4, height: 42 }}
                                    />
                                    <input
                                      readOnly={domainFieldsReadOnly}
                                      value={domainConfigForm?.[d.key]?.marker_color || ""}
                                      onChange={(e) => setDomainConfigForm((prev) => ({
                                        ...prev,
                                        [d.key]: {
                                          ...(prev?.[d.key] || {}),
                                          marker_color: e.target.value,
                                        },
                                      }))}
                                      onBlur={(e) => setDomainConfigForm((prev) => ({
                                        ...prev,
                                        [d.key]: {
                                          ...(prev?.[d.key] || {}),
                                          marker_color: sanitizeHexColor(normalizeHexDraft(e.target.value, prev?.[d.key]?.marker_color), defaultDomainMarkerColor(d.key)),
                                        },
                                      }))}
                                      placeholder={defaultDomainMarkerColor(d.key)}
                                      style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                    />
                                  </div>
                                </label>
                                <label style={modalField}>
                                  <span>Icon Render Mode</span>
                                  <select
                                    value={domainConfigForm?.[d.key]?.icon_render_mode || defaultTenantDomainIconRenderMode(d.key, String(manageableTenantDomainRowByKey?.[d.key]?.icon_src || "").trim())}
                                    disabled={domainFieldsReadOnly}
                                    onChange={(e) => setDomainConfigForm((prev) => ({
                                      ...prev,
                                      [d.key]: {
                                        ...(prev?.[d.key] || {}),
                                        icon_render_mode: normalizeDomainIconRenderMode(
                                          e.target.value,
                                          String(manageableTenantDomainRowByKey?.[d.key]?.icon_src || "").trim()
                                        ),
                                      },
                                    }))}
                                    style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  >
                                    {MAP_UI_ICON_RENDER_MODE_OPTIONS.map((option) => (
                                      <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label style={modalField}>
                                  <span>Marker Icon Tint</span>
                                  <select
                                    value={domainConfigForm?.[d.key]?.icon_tint_mode || DOMAIN_ICON_TINT_MODE.AUTO_CONTRAST}
                                    disabled={
                                      domainFieldsReadOnly
                                      || normalizeDomainIconRenderMode(
                                        domainConfigForm?.[d.key]?.icon_render_mode,
                                        String(manageableTenantDomainRowByKey?.[d.key]?.icon_src || "").trim()
                                      ) !== MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG
                                    }
                                    onChange={(e) => setDomainConfigForm((prev) => ({
                                      ...prev,
                                      [d.key]: {
                                        ...(prev?.[d.key] || {}),
                                        icon_tint_mode: normalizeDomainIconTintMode(e.target.value),
                                      },
                                    }))}
                                    style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  >
                                    {DOMAIN_ICON_TINT_MODE_OPTIONS.map((option) => (
                                      <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                                {normalizeDomainIconRenderMode(
                                  domainConfigForm?.[d.key]?.icon_render_mode,
                                  String(manageableTenantDomainRowByKey?.[d.key]?.icon_src || "").trim()
                                ) === MAP_UI_ICON_RENDER_MODE.TINTABLE_SVG
                                && normalizeDomainIconTintMode(domainConfigForm?.[d.key]?.icon_tint_mode) === DOMAIN_ICON_TINT_MODE.CUSTOM ? (
                                  <label style={modalField}>
                                    <span>Custom Icon Tint</span>
                                    <div style={{ display: "grid", gridTemplateColumns: "56px minmax(0, 1fr)", gap: 8, alignItems: "center" }}>
                                      <input
                                        type="color"
                                        value={normalizeDomainIconTintColor(
                                          domainConfigForm?.[d.key]?.icon_tint_color,
                                          resolveDomainMarkerIconTintColor({
                                            renderMode: domainConfigForm?.[d.key]?.icon_render_mode,
                                            tintMode: DOMAIN_ICON_TINT_MODE.CUSTOM,
                                            tintColor: domainConfigForm?.[d.key]?.icon_tint_color,
                                            markerColor: domainConfigForm?.[d.key]?.marker_color,
                                          })
                                        )}
                                        disabled={domainFieldsReadOnly}
                                        onChange={(e) => setDomainConfigForm((prev) => ({
                                          ...prev,
                                          [d.key]: {
                                            ...(prev?.[d.key] || {}),
                                            icon_tint_color: e.target.value,
                                          },
                                        }))}
                                        style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background, padding: 4, height: 42 }}
                                      />
                                      <input
                                        readOnly={domainFieldsReadOnly}
                                        value={domainConfigForm?.[d.key]?.icon_tint_color || ""}
                                        onChange={(e) => setDomainConfigForm((prev) => ({
                                          ...prev,
                                          [d.key]: {
                                            ...(prev?.[d.key] || {}),
                                            icon_tint_color: e.target.value,
                                          },
                                        }))}
                                        onBlur={(e) => setDomainConfigForm((prev) => ({
                                          ...prev,
                                          [d.key]: {
                                            ...(prev?.[d.key] || {}),
                                            icon_tint_color: normalizeDomainIconTintColor(e.target.value, prev?.[d.key]?.icon_tint_color || "#111111"),
                                          },
                                        }))}
                                        placeholder="#ffffff"
                                        style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                      />
                                    </div>
                                  </label>
                                ) : null}
                              </div>
                              {isAssetBacked ? (
                                <div style={{ ...subPanel, display: "grid", gap: 8, background: "rgba(255,255,255,0.72)" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <div style={{ display: "grid", gap: 3 }}>
                                      <div style={{ fontSize: 12.5, fontWeight: 800, color: palette.navy900 }}>Coordinate Files</div>
                                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                        {coordinateFiles.length
                                          ? `${coordinateFiles.length} coordinate file${coordinateFiles.length === 1 ? "" : "s"} linked to ${d.label}.`
                                          : `No coordinate files are linked to ${d.label} yet.`}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      style={{ ...buttonAlt, opacity: canEditTenantFiles && isEditingDomain ? 1 : 0.55 }}
                                      disabled={!canEditTenantFiles || !isEditingDomain}
                                      onClick={() => openTenantAssetModal({ category: "asset_coordinates", asset_subtype: d.key })}
                                      title={
                                        !isEditingDomain
                                          ? `Open edit mode to manage ${d.label} coordinates`
                                          : canEditTenantFiles
                                            ? `Add coordinate file for ${d.label}`
                                            : "You need the Files edit permission"
                                      }
                                    >
                                      Add Coordinates
                                    </button>
                                  </div>
                                  {coordinateFiles.length ? (
                                    <div style={{ display: "grid", gap: 6 }}>
                                      {coordinateFiles.slice(0, 3).map((row) => (
                                        <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                          <div style={{ display: "grid", gap: 2 }}>
                                            <strong style={{ color: palette.navy900 }}>{row.file_name || "Unnamed coordinate file"}</strong>
                                            <span style={{ fontSize: 12, color: palette.textMuted }}>
                                              {row.uploaded_at ? new Date(row.uploaded_at).toLocaleString() : "Upload date unavailable"}
                                            </span>
                                          </div>
                                          <button type="button" style={buttonAlt} onClick={() => void openTenantFile(row)}>Open</button>
                                        </div>
                                      ))}
                                      {coordinateFiles.length > 3 ? (
                                        <div style={{ fontSize: 12, color: palette.textMuted }}>
                                          {coordinateFiles.length - 3} more coordinate file{coordinateFiles.length - 3 === 1 ? "" : "s"} available in the asset library.
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                                ) : null}
                                {selectedAssignedDomainSectionKey === "reporting" ? (
                              <div style={{ display: "grid", gap: 10 }}>
                                {!isAssetBacked ? (
                                  <div style={responsiveActionGrid}>
                                    <label style={modalField}>
                                      <span>Public Visibility Threshold</span>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        readOnly={domainFieldsReadOnly}
                                        value={domainConfigForm?.[d.key]?.public_visibility_min_reports ?? defaultDomainPublicVisibilityMinReports(d.key)}
                                        onChange={(e) => setDomainConfigForm((prev) => ({
                                          ...prev,
                                          [d.key]: {
                                            ...(prev?.[d.key] || {}),
                                            public_visibility_min_reports: e.target.value,
                                          },
                                        }))}
                                        onBlur={(e) => setDomainConfigForm((prev) => ({
                                          ...prev,
                                          [d.key]: {
                                            ...(prev?.[d.key] || {}),
                                            public_visibility_min_reports: sanitizePositiveIntegerSetting(
                                              e.target.value,
                                              defaultDomainPublicVisibilityMinReports(d.key),
                                              { min: 1, max: 25 }
                                            ),
                                          },
                                        }))}
                                        style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                      />
                                    </label>
                                    <label style={modalField}>
                                      <span>High Confidence Threshold</span>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        readOnly={domainFieldsReadOnly}
                                        value={domainConfigForm?.[d.key]?.high_confidence_min_reports ?? defaultDomainHighConfidenceMinReports(d.key)}
                                        onChange={(e) => setDomainConfigForm((prev) => ({
                                          ...prev,
                                          [d.key]: {
                                            ...(prev?.[d.key] || {}),
                                            high_confidence_min_reports: e.target.value,
                                          },
                                        }))}
                                        onBlur={(e) => setDomainConfigForm((prev) => {
                                          const publicMin = sanitizePositiveIntegerSetting(
                                            prev?.[d.key]?.public_visibility_min_reports,
                                            defaultDomainPublicVisibilityMinReports(d.key),
                                            { min: 1, max: 25 }
                                          );
                                          return {
                                            ...prev,
                                            [d.key]: {
                                              ...(prev?.[d.key] || {}),
                                              public_visibility_min_reports: publicMin,
                                              high_confidence_min_reports: sanitizePositiveIntegerSetting(
                                                e.target.value,
                                                Math.max(publicMin, defaultDomainHighConfidenceMinReports(d.key)),
                                                { min: publicMin, max: 25 }
                                              ),
                                            },
                                          };
                                        })}
                                        style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                      />
                                    </label>
                                  </div>
                                ) : null}
                              <div
                                style={{
                                  ...subPanel,
                                  display: "grid",
                                  gap: 10,
                                  background: "rgba(255,255,255,0.78)",
                                  borderColor: "rgba(17,36,69,0.12)",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                                  <div style={{ display: "grid", gap: 3 }}>
                                    <div style={{ fontWeight: 900, color: palette.navy900 }}>Issue Types</div>
                                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                      Configure tenant-specific issue type groups and choices for this domain. These options render everywhere in this saved order across the report flow, info windows, reports, and email macros.
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    style={{ ...buttonAlt, opacity: domainFieldsReadOnly ? 0.55 : 1 }}
                                    disabled={domainFieldsReadOnly}
                                    onClick={() => setDomainConfigForm((prev) => ({
                                      ...prev,
                                      [d.key]: {
                                        ...(prev?.[d.key] || {}),
                                        type_options: [
                                          ...(Array.isArray(prev?.[d.key]?.type_options) ? prev[d.key].type_options : []),
                                          {
                                            id: createDomainDisclosureId("type_option"),
                                            option_key: "",
                                            option_label: defaultDomainTypeOptionLabel(d.key, Array.isArray(prev?.[d.key]?.type_options) ? prev[d.key].type_options.length : 0),
                                            choices_input: "",
                                          },
                                        ],
                                      },
                                    }))}
                                  >
                                    Add Issue Type
                                  </button>
                                </div>
                                {domainTypeOptionRows.length ? (
                                  <div style={{ display: "grid", gap: 10 }}>
                                    {domainTypeOptionRows.map((typeOption, typeIndex) => (
                                      <div
                                        key={typeOption.id || `${d.key}:type-option:${typeIndex}`}
                                        style={{
                                          display: "grid",
                                          gap: 10,
                                          padding: 12,
                                          borderRadius: 14,
                                          border: "1px solid rgba(17,36,69,0.12)",
                                          background: "rgba(255,255,255,0.92)",
                                        }}
                                      >
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                            <span style={{ fontSize: 12, fontWeight: 800, color: palette.navy900 }}>
                                              Issue Type {typeIndex + 1}
                                            </span>
                                            <span style={{ fontSize: 11.5, fontWeight: 800, color: palette.navy500, background: "rgba(46,98,143,0.12)", borderRadius: 999, padding: "4px 10px" }}>
                                              {domainTypeOptionMacroToken(typeOption.option_key || typeOption.option_label || `type_option_${typeIndex + 1}`)}
                                            </span>
                                          </div>
                                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                            <button
                                              type="button"
                                              style={{ ...buttonAlt, opacity: domainFieldsReadOnly || typeIndex === 0 ? 0.55 : 1 }}
                                              disabled={domainFieldsReadOnly || typeIndex === 0}
                                              onClick={() => setDomainConfigForm((prev) => {
                                                const rows = Array.isArray(prev?.[d.key]?.type_options) ? [...prev[d.key].type_options] : [];
                                                if (!(typeIndex > 0) || !rows[typeIndex]) return prev;
                                                [rows[typeIndex - 1], rows[typeIndex]] = [rows[typeIndex], rows[typeIndex - 1]];
                                                return {
                                                  ...prev,
                                                  [d.key]: {
                                                    ...(prev?.[d.key] || {}),
                                                    type_options: rows,
                                                  },
                                                };
                                              })}
                                            >
                                              Move Up
                                            </button>
                                            <button
                                              type="button"
                                              style={{ ...buttonAlt, opacity: domainFieldsReadOnly || typeIndex >= domainTypeOptionRows.length - 1 ? 0.55 : 1 }}
                                              disabled={domainFieldsReadOnly || typeIndex >= domainTypeOptionRows.length - 1}
                                              onClick={() => setDomainConfigForm((prev) => {
                                                const rows = Array.isArray(prev?.[d.key]?.type_options) ? [...prev[d.key].type_options] : [];
                                                if (typeIndex >= rows.length - 1 || !rows[typeIndex]) return prev;
                                                [rows[typeIndex], rows[typeIndex + 1]] = [rows[typeIndex + 1], rows[typeIndex]];
                                                return {
                                                  ...prev,
                                                  [d.key]: {
                                                    ...(prev?.[d.key] || {}),
                                                    type_options: rows,
                                                  },
                                                };
                                              })}
                                            >
                                              Move Down
                                            </button>
                                            <button
                                              type="button"
                                              style={{ ...buttonAlt, opacity: domainFieldsReadOnly ? 0.55 : 1 }}
                                              disabled={domainFieldsReadOnly}
                                              onClick={() => setDomainConfigForm((prev) => ({
                                                ...prev,
                                                [d.key]: {
                                                  ...(prev?.[d.key] || {}),
                                                  type_options: (Array.isArray(prev?.[d.key]?.type_options) ? prev[d.key].type_options : [])
                                                    .filter((row, rowIndex) => rowIndex !== typeIndex),
                                                },
                                              }))}
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>
                                        <label style={modalField}>
                                          <span>Issue Type Name</span>
                                          <input
                                            readOnly={domainFieldsReadOnly}
                                            value={typeOption.option_label || ""}
                                            onChange={(e) => setDomainConfigForm((prev) => ({
                                              ...prev,
                                              [d.key]: {
                                                ...(prev?.[d.key] || {}),
                                                type_options: (Array.isArray(prev?.[d.key]?.type_options) ? prev[d.key].type_options : []).map((row, rowIndex) => (
                                                  rowIndex === typeIndex
                                                    ? { ...row, option_label: e.target.value }
                                                    : row
                                                )),
                                              },
                                            }))}
                                            placeholder={defaultDomainTypeOptionLabel(d.key, typeIndex)}
                                            style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                          />
                                        </label>
                                        <label style={{ ...modalField, gridColumn: "1 / -1" }}>
                                          <span>Issue Type Choices</span>
                                          <textarea
                                            readOnly={domainFieldsReadOnly}
                                            value={typeOption.choices_input || ""}
                                            onChange={(e) => setDomainConfigForm((prev) => ({
                                              ...prev,
                                              [d.key]: {
                                                ...(prev?.[d.key] || {}),
                                                type_options: (Array.isArray(prev?.[d.key]?.type_options) ? prev[d.key].type_options : []).map((row, rowIndex) => (
                                                  rowIndex === typeIndex
                                                    ? { ...row, choices_input: e.target.value }
                                                    : row
                                                )),
                                              },
                                            }))}
                                            rows={4}
                                            placeholder={"Choice 1\nChoice 2\nChoice 3"}
                                            style={{ ...modalInput, minHeight: 110, resize: "vertical", background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                          />
                                          <div style={{ fontSize: 11.5, color: palette.textMuted, marginTop: 6 }}>
                                            One choice per line. These choices appear in the report modal under this type option.
                                          </div>
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                    No issue types configured for this domain yet.
                                  </div>
                                )}
                              </div>
                              <div
                                style={{
                                  ...subPanel,
                                  display: "grid",
                                  gap: 10,
                                  background: "rgba(255,255,255,0.78)",
                                  borderColor: "rgba(17,36,69,0.12)",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                                  <div style={{ display: "grid", gap: 3 }}>
                                    <div style={{ fontWeight: 900, color: palette.navy900 }}>Report Disclosures</div>
                                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                      Add informational notices or required acknowledgements for this tenant and domain. Disclosures can appear before the form opens or inside the form before submission.
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    style={{ ...buttonAlt, opacity: domainFieldsReadOnly ? 0.55 : 1 }}
                                    disabled={domainFieldsReadOnly}
                                    onClick={() => setDomainConfigForm((prev) => ({
                                      ...prev,
                                      [d.key]: {
                                        ...(prev?.[d.key] || {}),
                                        report_disclosures: [
                                          ...(Array.isArray(prev?.[d.key]?.report_disclosures) ? prev[d.key].report_disclosures : []),
                                          {
                                            id: createDomainDisclosureId("report_disclosure"),
                                            title: "",
                                            body: "",
                                            required_acknowledgement: false,
                                            display_position: "inside_form",
                                          },
                                        ],
                                      },
                                    }))}
                                  >
                                    Add Disclosure
                                  </button>
                                </div>
                                <div style={{ display: "grid", gap: 10 }}>
                                  {domainDisclosureRows.length ? domainDisclosureRows.map((disclosure, disclosureIndex) => (
                                    <div
                                      key={disclosure.id || `${d.key}:disclosure:${disclosureIndex}`}
                                      style={{
                                        display: "grid",
                                        gap: 10,
                                        padding: 12,
                                        borderRadius: 14,
                                        border: "1px solid rgba(17,36,69,0.12)",
                                        background: "rgba(255,255,255,0.92)",
                                      }}
                                    >
                                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                          <span style={{ fontSize: 12, fontWeight: 800, color: palette.navy900 }}>
                                            Disclosure {disclosureIndex + 1}
                                          </span>
                                          <span style={{ fontSize: 11.5, fontWeight: 800, color: palette.navy500, background: "rgba(46,98,143,0.12)", borderRadius: 999, padding: "4px 10px" }}>
                                            {domainDisclosurePositionLabel(disclosure.display_position)}
                                          </span>
                                          <span style={{ fontSize: 11.5, fontWeight: 800, color: disclosure.required_acknowledgement ? palette.red600 : palette.mint700, background: disclosure.required_acknowledgement ? "rgba(209,67,67,0.12)" : "rgba(18,128,106,0.12)", borderRadius: 999, padding: "4px 10px" }}>
                                            {disclosure.required_acknowledgement ? "Required acknowledgment" : "Informational"}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          style={{ ...buttonAlt, opacity: domainFieldsReadOnly ? 0.55 : 1 }}
                                          disabled={domainFieldsReadOnly}
                                          onClick={() => setDomainConfigForm((prev) => ({
                                            ...prev,
                                            [d.key]: {
                                              ...(prev?.[d.key] || {}),
                                              report_disclosures: (Array.isArray(prev?.[d.key]?.report_disclosures) ? prev[d.key].report_disclosures : [])
                                                .filter((row, rowIndex) => rowIndex !== disclosureIndex),
                                            },
                                          }))}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                      <div style={responsiveActionGrid}>
                                        <label style={modalField}>
                                          <span>Title</span>
                                          <input
                                            readOnly={domainFieldsReadOnly}
                                            value={disclosure.title || ""}
                                            onChange={(e) => setDomainConfigForm((prev) => ({
                                              ...prev,
                                              [d.key]: {
                                                ...(prev?.[d.key] || {}),
                                                report_disclosures: (Array.isArray(prev?.[d.key]?.report_disclosures) ? prev[d.key].report_disclosures : []).map((row, rowIndex) => (
                                                  rowIndex === disclosureIndex
                                                    ? { ...row, title: e.target.value }
                                                    : row
                                                )),
                                              },
                                            }))}
                                            placeholder="Disclosure title"
                                            style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                          />
                                        </label>
                                        <label style={modalField}>
                                          <span>Display Position</span>
                                          <select
                                            value={disclosure.display_position || "inside_form"}
                                            disabled={domainFieldsReadOnly}
                                            onChange={(e) => setDomainConfigForm((prev) => ({
                                              ...prev,
                                              [d.key]: {
                                                ...(prev?.[d.key] || {}),
                                                report_disclosures: (Array.isArray(prev?.[d.key]?.report_disclosures) ? prev[d.key].report_disclosures : []).map((row, rowIndex) => (
                                                  rowIndex === disclosureIndex
                                                    ? { ...row, display_position: e.target.value === "before_form" ? "before_form" : "inside_form" }
                                                    : row
                                                )),
                                              },
                                            }))}
                                            style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                          >
                                            <option value="inside_form">Inside form</option>
                                            <option value="before_form">Before form</option>
                                          </select>
                                        </label>
                                        <div style={{ ...modalField, justifyContent: "center" }}>
                                          <span>Acknowledgement</span>
                                          <label
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: 8,
                                              minHeight: 48,
                                              padding: "0 14px",
                                              borderRadius: 14,
                                              border: "1px solid rgba(17, 36, 69, 0.14)",
                                              background: "#eef4fb",
                                              color: palette.navy900,
                                              fontWeight: 700,
                                            }}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={disclosure.required_acknowledgement === true}
                                              disabled={domainFieldsReadOnly}
                                              onChange={(e) => setDomainConfigForm((prev) => ({
                                                ...prev,
                                                [d.key]: {
                                                  ...(prev?.[d.key] || {}),
                                                  report_disclosures: (Array.isArray(prev?.[d.key]?.report_disclosures) ? prev[d.key].report_disclosures : []).map((row, rowIndex) => (
                                                    rowIndex === disclosureIndex
                                                      ? { ...row, required_acknowledgement: e.target.checked }
                                                      : row
                                                  )),
                                                },
                                              }))}
                                            />
                                            <span style={{ display: "grid", gap: 2 }}>
                                              <span style={{ fontWeight: 800 }}>Require acknowledgement?</span>
                                              <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.78 }}>
                                                {disclosure.required_acknowledgement ? "Reporter must confirm this before continuing." : "Shown as informational text only."}
                                              </span>
                                            </span>
                                          </label>
                                        </div>
                                      </div>
                                      <label style={{ ...modalField, gridColumn: "1 / -1" }}>
                                        <span>Body Text</span>
                                        <textarea
                                          readOnly={domainFieldsReadOnly}
                                          value={disclosure.body || ""}
                                          onChange={(e) => setDomainConfigForm((prev) => ({
                                            ...prev,
                                            [d.key]: {
                                              ...(prev?.[d.key] || {}),
                                              report_disclosures: (Array.isArray(prev?.[d.key]?.report_disclosures) ? prev[d.key].report_disclosures : []).map((row, rowIndex) => (
                                                rowIndex === disclosureIndex
                                                  ? { ...row, body: e.target.value }
                                                  : row
                                              )),
                                            },
                                          }))}
                                          rows={4}
                                          placeholder="Disclosure text shown to the reporter."
                                          style={{ ...modalInput, minHeight: 110, resize: "vertical", background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                        />
                                      </label>
                                    </div>
                                  )) : (
                                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                      No disclosures configured for this domain.
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize: 12.5, color: palette.textMuted, lineHeight: 1.45 }}>
                                {isAssetBacked
                                  ? "Asset-backed domains do not use public incident confidence thresholds."
                                  : "Confidence rules: the public visibility threshold controls when an incident becomes visible to everyone on the map. The high confidence threshold is stored per tenant/domain so future scoring, alerting, and operations workflows can follow local reporting patterns."}
                              </div>
                              </div>
                                ) : null}
                                {selectedAssignedDomainSectionKey === "report-email-template" ? (
                              <div
                                style={{
                                  ...subPanel,
                                  display: "grid",
                                  gap: 10,
                                  background: "rgba(255,255,255,0.78)",
                                  borderColor: "rgba(17,36,69,0.12)",
                                }}
                              >
                                <div style={{ display: "grid", gap: 3 }}>
                                  <div style={{ fontWeight: 900, color: palette.navy900 }}>Report Email Template</div>
                                  <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                    Start from a preset, then edit the subject and body. Macros are replaced with report details when the notification email is sent.
                                  </div>
                                  <div style={{ fontSize: 11.5, color: palette.textMuted }}>
                                    Preset: {domainNotificationTemplateOption(domainConfigForm?.[d.key]?.notification_template_key).label}
                                    {" • "}
                                    {domainNotificationTemplateOption(domainConfigForm?.[d.key]?.notification_template_key).description}
                                  </div>
                                </div>
                                <label style={{ ...modalField, gridColumn: "1 / -1" }}>
                                  <span>Email Template Preset</span>
                                  <select
                                    value={domainConfigForm?.[d.key]?.notification_template_key || DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS[0].key}
                                    disabled={domainFieldsReadOnly}
                                    onChange={(e) => {
                                      const nextTemplate = domainNotificationTemplateOption(e.target.value);
                                      setDomainConfigForm((prev) => ({
                                        ...prev,
                                        [d.key]: {
                                          ...(prev?.[d.key] || {}),
                                          notification_template_key: nextTemplate.key,
                                          notification_subject_template: nextTemplate.subject,
                                          notification_body_template: nextTemplate.body,
                                        },
                                      }));
                                    }}
                                    style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  >
                                    {DOMAIN_NOTIFICATION_TEMPLATE_OPTIONS.map((option) => (
                                      <option key={option.key} value={option.key}>{option.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label style={{ ...modalField, gridColumn: "1 / -1" }}>
                                  <span>Email Subject Template</span>
                                  <input
                                    readOnly={domainFieldsReadOnly}
                                    value={domainConfigForm?.[d.key]?.notification_subject_template || ""}
                                    onChange={(e) => setDomainConfigForm((prev) => ({
                                      ...prev,
                                      [d.key]: {
                                        ...(prev?.[d.key] || {}),
                                        notification_subject_template: e.target.value,
                                      },
                                    }))}
                                    placeholder="{{domain_label}} report ({{report_number}})"
                                    style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                                  />
                                </label>
                                <label style={{ ...modalField, gridColumn: "1 / -1" }}>
                                  <span>Email Body Template</span>
                                  <textarea
                                    readOnly={domainFieldsReadOnly}
                                    value={domainConfigForm?.[d.key]?.notification_body_template || ""}
                                    onChange={(e) => setDomainConfigForm((prev) => ({
                                      ...prev,
                                      [d.key]: {
                                        ...(prev?.[d.key] || {}),
                                        notification_body_template: e.target.value,
                                      },
                                    }))}
                                    rows={11}
                                    placeholder="Use the preset template or write your own body with macros."
                                    style={{
                                      ...modalInput,
                                      minHeight: 220,
                                      resize: "vertical",
                                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                      lineHeight: 1.45,
                                      background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background,
                                    }}
                                  />
                                </label>
                                <div style={{ fontSize: 11.5, color: palette.textMuted }}>
                                  Available macros: {domainNotificationTemplateTokens(domainConfigForm?.[d.key]?.type_options || []).join(", ")}
                                </div>
                              </div>
                                ) : null}
                          </div>
                        );
                      })()}
                        </>
                      ) : (
                        <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                          No domains are assigned yet for this organization.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
                {status.domains ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.domains)}</div> : null}
              </div>
            </div>
            ) : null}

            {activeTab === "map-features" ? (
            <div style={{ ...card, display: "grid", gap: 10 }}>
                <div style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 3 }}>
                      <div style={{ fontWeight: 900, color: palette.navy900 }}>Map Features</div>
                      <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                        Configure how the organization boundary and map framing behave for the public map and the hub.
                      </div>
                    </div>
                    {!mapFeaturesEditMode ? (
                      <button
                        type="button"
                        style={{ ...buttonAlt, opacity: canEditTenantDomains ? 1 : 0.55 }}
                        disabled={!canEditTenantDomains}
                        onClick={beginMapFeaturesEdit}
                        title={canEditTenantDomains ? "Edit map features" : "You need the Domains edit permission"}
                      >
                        Edit Map Features
                      </button>
                    ) : (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={{ ...buttonBase, opacity: canEditTenantDomains ? 1 : 0.55 }}
                          disabled={!canEditTenantDomains}
                          onClick={() => void saveMapFeaturesSettings()}
                        >
                          Save Map Features
                        </button>
                        <button
                          type="button"
                          style={buttonAlt}
                          onClick={cancelMapFeaturesEdit}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {(() => {
                    const mapFeaturesReadOnly = !canEditTenantDomains || !mapFeaturesEditMode;
                    const borderEnabled = !mapFeaturesReadOnly && Boolean(mapFeaturesForm.show_boundary_border);
                    const shadeEnabled = !mapFeaturesReadOnly && Boolean(mapFeaturesForm.shade_outside_boundary);
                    const disabledFieldStyle = {
                      ...inputBase,
                      opacity: 0.55,
                      cursor: "not-allowed",
                      background: "#edf2f7",
                    };
                    const checkboxFieldStyle = {
                      fontSize: 12.5,
                      display: "inline-flex",
                      gap: 6,
                      alignItems: "center",
                      justifySelf: "start",
                      width: "fit-content",
                    };
                    return (
                      <>
                        <label style={checkboxFieldStyle}>
                          <input
                            type="checkbox"
                            checked={Boolean(mapFeaturesForm.show_boundary_border)}
                            disabled={mapFeaturesReadOnly}
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
                              disabled={mapFeaturesReadOnly || !borderEnabled}
                              onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, boundary_border_color: e.target.value }))}
                              style={borderEnabled ? { ...inputBase, padding: 4, height: 42 } : { ...disabledFieldStyle, padding: 4, height: 42 }}
                            />
                            <input
                              type="text"
                              inputMode="text"
                              value={mapFeaturesForm.boundary_border_color}
                              disabled={mapFeaturesReadOnly || !borderEnabled}
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
                            disabled={mapFeaturesReadOnly || !borderEnabled}
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
                        <label style={checkboxFieldStyle}>
                          <input
                            type="checkbox"
                            checked={Boolean(mapFeaturesForm.shade_outside_boundary)}
                            disabled={mapFeaturesReadOnly}
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
                            disabled={mapFeaturesReadOnly || !shadeEnabled}
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
                        <label style={checkboxFieldStyle}>
                          <input
                            type="checkbox"
                            checked={Boolean(mapFeaturesForm.show_alert_icon)}
                            disabled={mapFeaturesReadOnly}
                            onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, show_alert_icon: e.target.checked }))}
                          />
                          Show alert icon on map
                        </label>
                        <label style={checkboxFieldStyle}>
                          <input
                            type="checkbox"
                            checked={Boolean(mapFeaturesForm.show_event_icon)}
                            disabled={mapFeaturesReadOnly}
                            onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, show_event_icon: e.target.checked }))}
                          />
                          Show event icon on map
                        </label>
                      </>
                    );
                  })()}
                </div>
              {status.domains ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.domains)}</div> : null}
            </div>
            ) : null}

            {activeTab === "files" ? (
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 3 }}>
                  <h2 style={{ margin: 0, color: palette.navy900 }}>
                    Assets for {selectedTenantPublicDisplayName || selectedTenantOrganizationName || selectedTenantKey}
                  </h2>
                  <p style={{ margin: 0, color: palette.textMuted }}>
                    Upload and organize domain-related source files like prior report exports, coordinate files, and boundary or location data.
                  </p>
                </div>
                <button
                  type="button"
                  style={{ ...buttonBase, opacity: canEditTenantFiles ? 1 : 0.55 }}
                  disabled={!canEditTenantFiles}
                  onClick={() => openTenantAssetModal()}
                  title={canEditTenantFiles ? "Add a new organization asset" : "You need the Files edit permission"}
                >
                  Add Asset
                </button>
              </div>
              {status.files ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.files)}</div> : null}
              <div style={{ display: "grid", gap: 12 }}>
                {TENANT_ASSET_CATEGORIES.map((category) => {
                  const matchingFiles = groupedTenantFiles[category.key] || [];
                  const categoryLoaded = matchingFiles.length > 0;
                  return (
                    <div key={category.key} style={{ ...subPanel, display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", flexWrap: "wrap" }}>
                        <div style={{ display: "grid", gap: 3 }}>
                          <strong style={{ color: palette.navy900 }}>{category.label}</strong>
                          <span style={{ fontSize: 12.5, color: palette.textMuted }}>{category.description}</span>
                        </div>
                        <span style={{
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: categoryLoaded ? "#0f6e5c" : palette.textMuted,
                          background: categoryLoaded ? "rgba(18,128,106,0.12)" : "rgba(74,97,122,0.12)",
                        }}>
                          {categoryLoaded ? "Loaded" : "Empty"}
                        </span>
                      </div>
                      {categoryLoaded ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {matchingFiles.map((row) => (
                            <div key={row.id} style={{ ...subPanel, display: "grid", gap: 8, background: "#f8fbff" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                                <div style={{ display: "grid", gap: 3 }}>
                                  <strong style={{ color: palette.navy900 }}>{row.file_name || "Unnamed file"}</strong>
                                  <span style={{ fontSize: 12.5, color: palette.textMuted }}>
                                    {summarizeTenantAssetCategory(row.file_category)}
                                    {String(row?.asset_subtype || "").trim() ? ` • ${domainKeyToLabel(String(row.asset_subtype).trim().toLowerCase())}` : ""}
                                    {" • "}
                                    {formatBytes(row.size_bytes)}
                                    {" • "}
                                    {row.uploaded_at ? new Date(row.uploaded_at).toLocaleString() : "Upload date unavailable"}
                                  </span>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  <button type="button" style={buttonAlt} onClick={() => void openTenantFile(row)}>Open</button>
                                  {String(row?.file_category || "").trim().toLowerCase() === "boundary_geojson" ? (
                                    <button type="button" style={buttonAlt} onClick={() => void setBoundaryFromFile(row)}>Set as Boundary</button>
                                  ) : null}
                                  <button type="button" style={{ ...buttonAlt, opacity: canEditTenantFiles ? 1 : 0.55 }} disabled={!canEditTenantFiles} onClick={() => void removeTenantFile(row)}>Remove</button>
                                </div>
                              </div>
                              {String(row?.notes || "").trim() ? (
                                <div style={{ fontSize: 12.5, color: palette.textMuted }}>{String(row.notes).trim()}</div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, color: palette.textMuted }}>No files are currently attached under this category.</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {!tenantFiles.length ? (
                <div style={{ ...subPanel, color: palette.textMuted }}>No uploaded assets are attached to this organization yet.</div>
              ) : null}
            </div>
            ) : null}
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
      {platformSecurityCheckpointRequest ? (
        <div style={authModalBackdrop} onClick={() => !platformSecurityCheckpointVerifying && closePlatformSecurityCheckpoint(false)}>
          <div style={authModalCard} onClick={(event) => event.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: palette.navy900 }}>
                  {platformSecurityCheckpointRequest.title || "Enter Security PIN"}
                </h2>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.35, color: palette.textMuted }}>
                  {platformSecurityCheckpointRequest.description || "Enter your PIN to continue."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !platformSecurityCheckpointVerifying && closePlatformSecurityCheckpoint(false)}
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
                aria-label="Close security PIN dialog"
                disabled={platformSecurityCheckpointVerifying}
              >
                ×
              </button>
            </div>
            <label style={modalField}>
              <span>Security PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                placeholder="4-digit PIN"
                value={platformSecurityCheckpointPin}
                onChange={(event) => {
                  const nextPin = event.target.value.replace(/\D/g, "").slice(0, 4);
                  setPlatformSecurityCheckpointPin(nextPin);
                  if (platformSecurityCheckpointStatus) setPlatformSecurityCheckpointStatus("");
                  if (nextPin.length === 4 && !platformSecurityCheckpointVerifying) {
                    void submitPlatformSecurityCheckpoint(nextPin);
                  }
                }}
                style={modalInput}
                disabled={platformSecurityCheckpointVerifying}
              />
            </label>
            {platformSecurityCheckpointStatus ? (
              <p style={{ margin: 0, color: palette.red600, fontSize: 12.5 }}>{platformSecurityCheckpointStatus}</p>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{ ...buttonAlt, minWidth: 120 }}
                disabled={platformSecurityCheckpointVerifying}
                onClick={() => closePlatformSecurityCheckpoint(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
      {changePasswordOpen ? (
        <div style={authModalBackdrop} onClick={() => !changePasswordSaving && closeChangePasswordModal()}>
          <div
            style={{
              ...authModalCard,
              width: "min(720px, calc(100vw - 24px))",
              padding: 32,
              borderRadius: 24,
              gap: 20,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <h2 style={{ margin: 0, fontSize: 32, lineHeight: 1.05, color: palette.navy900, fontWeight: 900 }}>Change Password</h2>
              <button
                type="button"
                onClick={closeChangePasswordModal}
                disabled={changePasswordSaving}
                style={{
                  ...buttonAlt,
                  minWidth: 0,
                  width: 68,
                  height: 68,
                  padding: 0,
                  borderRadius: 20,
                  fontSize: 30,
                  lineHeight: 1,
                  opacity: changePasswordSaving ? 0.6 : 1,
                  borderColor: "#d8d8d8",
                  background: "#ffffff",
                  color: "#111111",
                }}
                aria-label="Close password update dialog"
              >
                ×
              </button>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <div style={{ position: "relative" }}>
                <input
                  id="pcp-new-password"
                  aria-label="New Password"
                  placeholder="New password"
                  type={showChangePasswordNew ? "text" : "password"}
                  autoComplete="new-password"
                  value={changePasswordDraft.new_password}
                  onChange={(event) => setChangePasswordDraft((prev) => ({ ...prev, new_password: event.target.value }))}
                  style={{
                    ...inputBase,
                    minHeight: 72,
                    width: "100%",
                    borderRadius: 22,
                    paddingLeft: 20,
                    paddingRight: 92,
                    fontSize: 24,
                    color: "#111111",
                    borderColor: "#d7d7d7",
                    background: "#ffffff",
                  }}
                  disabled={changePasswordSaving}
                />
                <button
                  type="button"
                  onClick={() => setShowChangePasswordNew((prev) => !prev)}
                  disabled={changePasswordSaving}
                  style={{
                    position: "absolute",
                    right: 18,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "#1f6fd6",
                    fontSize: 24,
                    fontWeight: 800,
                    cursor: changePasswordSaving ? "default" : "pointer",
                    padding: 0,
                  }}
                >
                  {showChangePasswordNew ? "Hide" : "Show"}
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="pcp-confirm-password"
                  aria-label="Confirm New Password"
                  placeholder="Re-enter new password"
                  type={showChangePasswordConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={changePasswordDraft.confirm_new_password}
                  onChange={(event) => setChangePasswordDraft((prev) => ({ ...prev, confirm_new_password: event.target.value }))}
                  style={{
                    ...inputBase,
                    minHeight: 72,
                    width: "100%",
                    borderRadius: 22,
                    paddingLeft: 20,
                    paddingRight: 92,
                    fontSize: 24,
                    color: "#111111",
                    borderColor: "#d7d7d7",
                    background: "#ffffff",
                  }}
                  disabled={changePasswordSaving}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && changePasswordRequirements.canSubmit && !changePasswordSaving) {
                      event.preventDefault();
                      void savePlatformPassword();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowChangePasswordConfirm((prev) => !prev)}
                  disabled={changePasswordSaving}
                  style={{
                    position: "absolute",
                    right: 18,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "#1f6fd6",
                    fontSize: 24,
                    fontWeight: 800,
                    cursor: changePasswordSaving ? "default" : "pointer",
                    padding: 0,
                  }}
                >
                  {showChangePasswordConfirm ? "Hide" : "Show"}
                </button>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: "#252525" }}>Password Requirements</div>
                <div style={{ display: "grid", gap: 4, fontSize: 18, lineHeight: 1.35 }}>
                  <div style={{ color: changePasswordRequirements.hasLen ? "#2eb872" : "#ff5c57", fontWeight: 800 }}>- 8 or more characters</div>
                  <div style={{ color: changePasswordRequirements.hasUpper ? "#2eb872" : "#ff5c57", fontWeight: 800 }}>- 1 uppercase</div>
                  <div style={{ color: changePasswordRequirements.hasLower ? "#2eb872" : "#ff5c57", fontWeight: 800 }}>- 1 lowercase</div>
                  <div style={{ color: changePasswordRequirements.hasNumber ? "#2eb872" : "#ff5c57", fontWeight: 800 }}>- 1 number</div>
                  <div style={{ color: changePasswordRequirements.hasSpecial ? "#2eb872" : "#ff5c57", fontWeight: 800 }}>- 1 special character</div>
                  <div style={{ color: changePasswordRequirements.matches ? "#2eb872" : "#ff5c57", fontWeight: 800 }}>- Passwords match</div>
                </div>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="pcp-current-password"
                  aria-label="Current Password"
                  placeholder="Current password"
                  type={showChangePasswordCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  value={changePasswordDraft.current_password}
                  onChange={(event) => setChangePasswordDraft((prev) => ({ ...prev, current_password: event.target.value }))}
                  style={{
                    ...inputBase,
                    minHeight: 72,
                    width: "100%",
                    borderRadius: 22,
                    paddingLeft: 20,
                    paddingRight: 92,
                    fontSize: 24,
                    color: "#111111",
                    borderColor: "#d7d7d7",
                    background: "#ffffff",
                  }}
                  disabled={changePasswordSaving}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && changePasswordRequirements.canSubmit && !changePasswordSaving) {
                      event.preventDefault();
                      void savePlatformPassword();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowChangePasswordCurrent((prev) => !prev)}
                  disabled={changePasswordSaving}
                  style={{
                    position: "absolute",
                    right: 18,
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "#1f6fd6",
                    fontSize: 24,
                    fontWeight: 800,
                    cursor: changePasswordSaving ? "default" : "pointer",
                    padding: 0,
                  }}
                >
                  {showChangePasswordCurrent ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {changePasswordError ? <p style={{ margin: 0, color: palette.red600, fontSize: 14, fontWeight: 700 }}>{changePasswordError}</p> : null}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <button
                type="button"
                style={{
                  ...buttonAlt,
                  minHeight: 74,
                  borderRadius: 22,
                  fontSize: 18,
                  fontWeight: 900,
                  borderColor: "#d7d7d7",
                  background: "#ffffff",
                  color: "#111111",
                }}
                disabled={changePasswordSaving}
                onClick={closeChangePasswordModal}
              >
                Cancel
              </button>
              <button
                type="button"
                style={{
                  ...buttonBase,
                  minHeight: 74,
                  borderRadius: 22,
                  fontSize: 18,
                  fontWeight: 900,
                  background: "#8c98ae",
                  borderColor: "#8c98ae",
                  opacity: changePasswordRequirements.canSubmit && !changePasswordSaving ? 1 : 0.75,
                  cursor: changePasswordRequirements.canSubmit && !changePasswordSaving ? "pointer" : "not-allowed",
                }}
                disabled={!changePasswordRequirements.canSubmit || changePasswordSaving}
                onClick={() => void savePlatformPassword()}
              >
                {changePasswordSaving ? "Updating Password" : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
