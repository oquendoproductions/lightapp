import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import "./headerStandards.css";
import {
  STANDARD_LOGIN_EMAIL_INPUT_PROPS,
  STANDARD_LOGIN_FORM_PROPS,
  getStandardLoginPasswordInputProps,
} from "./auth/loginFieldStandards";
import { buildMailtoHref, CITYREPORT_SUPPORT_EMAIL } from "./lib/workspaceSupport";

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

const DOMAIN_TYPE_OPTIONS = [
  { key: "asset_backed", label: "Asset-Backed Domain" },
  { key: "incident_driven", label: "Incident-Driven Domain" },
];

const TAB_OPTIONS = [
  { key: "tenants", label: "Organization Info" },
  { key: "contacts", label: "Points of Contact" },
  { key: "users", label: "Users/Admins" },
  { key: "roles", label: "Roles + Permissions" },
  { key: "domains", label: "Domains + Assets" },
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
  const normalizedTab = requestedTab === "files" ? "domains" : requestedTab;
  const activeTab = TAB_OPTIONS.some((tab) => tab.key === normalizedTab) ? normalizedTab : defaultState.activeTab;
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
  { key: "domains", label: "Domains + Assets" },
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
  { key: "domains", label: "Domains + Assets" },
  { key: "files", label: "Assets" },
  { key: "audit", label: "Audit" },
  { key: "roles", label: "Roles" },
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
  for (const d of DOMAIN_OPTIONS) out[d.key] = "enabled";
  return out;
}

function defaultDomainType(domainKey) {
  const key = String(domainKey || "").trim().toLowerCase();
  if (key === "streetlights" || key === "street_signs") return "asset_backed";
  return "incident_driven";
}

function initialDomainConfigForm() {
  const out = {};
  for (const d of DOMAIN_OPTIONS) {
    out[d.key] = {
      domain_type: defaultDomainType(d.key),
      notification_email: "",
      organization_monitored_repairs: true,
    };
  }
  return out;
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
  const [tenantMapFeaturesByTenant, setTenantMapFeaturesByTenant] = useState({});

  const [selectedTenantKey, setSelectedTenantKey] = useState(initialControlPlaneRouteState.selectedTenantKey);
  const [entryStep, setEntryStep] = useState(initialControlPlaneRouteState.entryStep); // start | add | tenant
  const [addTenantStep, setAddTenantStep] = useState(initialControlPlaneRouteState.addTenantStep);
  const [tenantSearch, setTenantSearch] = useState("");

  const [tenantForm, setTenantForm] = useState(initialTenantForm);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [domainVisibilityForm, setDomainVisibilityForm] = useState(initialDomainVisibilityForm);
  const [domainConfigForm, setDomainConfigForm] = useState(initialDomainConfigForm);
  const [editingDomainKey, setEditingDomainKey] = useState("");
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
        const visibilityConfig = tenantVisibilityByTenant?.[tenantKey] || {};
        const enabledDomainCount = DOMAIN_OPTIONS.reduce((count, domain) => {
          const visibility = String(visibilityConfig?.[domain.key] || "public").trim().toLowerCase();
          if (["private", "disabled", "hidden", "internal_only"].includes(visibility)) return count;
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
          enabled_domain_count: enabledDomainCount,
          hub_enabled: Boolean(tenant?.resident_portal_enabled),
        };
      })
      .sort((left, right) => left.organization_name.localeCompare(right.organization_name));
  }, [tenantAdmins, tenantProfilesByTenant, tenantVisibilityByTenant, tenants]);
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
    () => TAB_OPTIONS.filter((tab) => {
      if (tab.key === "domains") {
        return hasPlatformPermission("domains.access")
          || hasPlatformPermission("domains.edit")
          || hasPlatformPermission("files.access")
          || hasPlatformPermission("files.edit");
      }
      return hasPlatformPermission(TENANT_WORKSPACE_TAB_PERMISSIONS[tab.key] || "");
    }),
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
    const { data, error } = await supabase
      .from("tenant_domain_configs")
      .select("tenant_key,domain,domain_type,notification_email,organization_monitored_repairs");
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
      };
    }
    setTenantDomainConfigsByTenant(next);
  }, [hasPlatformPermission]);

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
        loadTenantMapFeatures(),
        loadAudit(),
      ]);
      setStatus((prev) => ({ ...prev, hydrate: "" }));
    } catch (error) {
      setStatus((prev) => ({ ...prev, hydrate: statusText(error, "") }));
    }
  }, [purgeExpiredOrganizationDeletions, loadTenants, loadTenantAdmins, loadPlatformRoleConfig, loadPlatformTeamAssignments, loadClientLeads, loadTenantRoleConfig, loadTenantProfiles, loadTenantVisibility, loadTenantDomainConfigs, loadTenantMapFeatures, loadAudit]);

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
    if (activeTab === "files") {
      setActiveTab("domains");
      return;
    }
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
      params.set(CONTROL_PLANE_ROUTE_QUERY_KEYS.tab, activeTab === "files" ? "domains" : activeTab);
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
    for (const d of DOMAIN_OPTIONS) {
      const configured = String(visibility?.[d.key] || "").trim().toLowerCase();
      nextVisibility[d.key] = configured === "internal_only" ? "disabled" : "enabled";
    }
    setDomainVisibilityForm(nextVisibility);

    const configuredDomainSettings = tenantDomainConfigsByTenant?.[key] || {};
    const nextDomainConfig = initialDomainConfigForm();
    for (const d of DOMAIN_OPTIONS) {
      const configured = configuredDomainSettings?.[d.key] || null;
      const fallbackNotification = d.key === "potholes"
        ? String(selectedTenant?.notification_email_potholes || "")
        : d.key === "water_drain_issues"
          ? String(selectedTenant?.notification_email_water_drain || "")
          : "";
      nextDomainConfig[d.key] = {
        domain_type: String(configured?.domain_type || defaultDomainType(d.key)).trim().toLowerCase() || defaultDomainType(d.key),
        notification_email: String(configured?.notification_email || fallbackNotification).trim(),
        organization_monitored_repairs: configured?.organization_monitored_repairs !== false,
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
  }, [selectedTenantKey, selectedTenant, tenantProfilesByTenant, tenantVisibilityByTenant, tenantDomainConfigsByTenant, tenantMapFeaturesByTenant, loadTenantFiles, loadTenantRoleConfig, loadAudit]);

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
    setEditingPrimaryContact(false);
    setEditingAdditionalContactIndex(null);
    setContactAddModalOpen(false);
    setNewContactForm(emptyAdditionalContact());
    setContactDeleteConfirmIndex(null);
    setContactDeleteLoading(false);
  }, [selectedTenantKey, tenantProfilesByTenant]);

  const saveTenantProfile = useCallback(async (event) => {
    event.preventDefault();
    const result = await persistTenantProfileRecord({
      checkpointSettingKey: entryStep === "tenant" ? "require_pin_for_organization_info_changes" : "",
      checkpointDescription: "Enter your PIN to save organization information changes.",
    });
    if (!result.ok) return;
    setIsEditingProfile(false);
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
    const checkpointApproved = await requirePlatformSecurityCheckpoint({
      settingKey: "require_pin_for_domain_settings_changes",
      title: "Enter Security PIN",
      description: "Enter your PIN to save domain and asset settings.",
      onBlocked: (message) => setStatus((prev) => ({ ...prev, domains: message })),
    });
    if (!checkpointApproved) return;

    const visibilityRows = DOMAIN_OPTIONS.map((d) => ({
      tenant_key: key,
      domain: d.key,
      visibility: String(domainVisibilityForm?.[d.key] || "enabled").trim().toLowerCase() === "disabled"
        ? "internal_only"
        : "public",
    }));
    const domainConfigRows = DOMAIN_OPTIONS.map((d) => ({
      tenant_key: key,
      domain: d.key,
      domain_type: String(domainConfigForm?.[d.key]?.domain_type || defaultDomainType(d.key)).trim().toLowerCase() || defaultDomainType(d.key),
      notification_email: cleanOptional(domainConfigForm?.[d.key]?.notification_email),
      organization_monitored_repairs: domainConfigForm?.[d.key]?.organization_monitored_repairs !== false,
      updated_by: cleanOptional(sessionUserId),
    }));

    const tenantPayload = {
      notification_email_potholes: cleanOptional(domainConfigForm?.potholes?.notification_email),
      notification_email_water_drain: cleanOptional(domainConfigForm?.water_drain_issues?.notification_email),
    };

    const [{ error: visError }, { error: domainConfigError }, { error: tenantError }] = await Promise.all([
      supabase.from("tenant_visibility_config").upsert(visibilityRows, { onConflict: "tenant_key,domain" }),
      supabase.from("tenant_domain_configs").upsert(domainConfigRows, { onConflict: "tenant_key,domain" }),
      supabase.from("tenants").update(tenantPayload).eq("tenant_key", key),
    ]);

    if (visError || domainConfigError || tenantError) {
      setStatus((prev) => ({ ...prev, domains: statusText(visError || domainConfigError || tenantError, "") }));
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
        notification_emails: tenantPayload,
      },
    });

    setStatus((prev) => ({ ...prev, domains: `Saved domain types and notification routing for ${key}.` }));
    if (String(options?.closeEditingDomain || "").trim()) {
      setEditingDomainKey((current) => current === options.closeEditingDomain ? "" : current);
      setEditingDomainSnapshot((current) => current?.key === options.closeEditingDomain ? null : current);
    }
    await refreshControlPlaneData();
  }, [canEditTenantDomains, selectedTenantKey, domainVisibilityForm, domainConfigForm, sessionUserId, logAudit, refreshControlPlaneData, requirePlatformSecurityCheckpoint]);

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
    setEditingDomainKey(key);
    setEditingDomainSnapshot({
      key,
      visibility: String(domainVisibilityForm?.[key] || "enabled"),
      config: {
        ...(domainConfigForm?.[key] || {
          domain_type: defaultDomainType(key),
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
    if (typeof window !== "undefined") {
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
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
  ) : null;
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
                      <td style={{ padding: "10px 0" }}>{row.enabled_domain_count}</td>
                      <td style={{ padding: "10px 0" }}>{row.hub_enabled ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {!filteredOrganizationReportRows.length ? (
                    <tr>
                      <td colSpan={7} style={{ padding: "10px 0", color: palette.textMuted }}>
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
                          Upload a boundary asset in Domains + Assets, then set it as the organization boundary.
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 4 }}>
                    <h2 style={{ margin: 0, color: palette.navy900 }}>
                      {inAddTenantFlow ? "Organization Information" : "Organization Information"}
                    </h2>
                    <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                      Public identity, mailing address, billing, and contract details for the organization.
                    </p>
                  </div>
                  {!inAddTenantFlow ? (
                    profileReadOnly ? (
                      <button type="button" style={{ ...buttonAlt, opacity: canEditTenantSetup ? 1 : 0.55 }} onClick={() => setIsEditingProfile(true)} disabled={!canEditTenantSetup}>
                        Edit Organization Information
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
                <section style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 3 }}>
                    <div style={{ fontWeight: 900, color: palette.navy900 }}>Naming + Identity</div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Names and outward-facing profile details used across CityReport surfaces.
                    </div>
                  </div>
                  <div style={responsiveTwoColGrid}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Legal Organization Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.legal_name} onChange={(e) => setProfileForm((p) => ({ ...p, legal_name: e.target.value }))} placeholder="Example Municipality Public Works" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Public Display Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.display_name} onChange={(e) => setProfileForm((p) => ({ ...p, display_name: e.target.value }))} placeholder="Example Municipality" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                      <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                        Falls back to Organization Name when a public label has not been set.
                      </span>
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Municipality Website URL</span>
                      <input readOnly={profileReadOnly} value={profileForm.website_url} onChange={(e) => setProfileForm((p) => ({ ...p, website_url: e.target.value }))} placeholder="https://www.examplemunicipality.gov" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Timezone</span>
                      <input readOnly={profileReadOnly} value={profileForm.timezone} onChange={(e) => setProfileForm((p) => ({ ...p, timezone: e.target.value }))} placeholder="America/New_York" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4, gridColumn: "1 / -1" }}>
                      <span>URL Extension (Profile Alias)</span>
                      <input readOnly={profileReadOnly} value={profileForm.url_extension} onChange={(e) => setProfileForm((p) => ({ ...p, url_extension: e.target.value }))} placeholder="examplemunicipality" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                      <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                        Stored for profile and future alias use. It does not currently change live cityreport.io routing.
                      </span>
                    </label>
                  </div>
                </section>
                <section style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 3 }}>
                    <div style={{ fontWeight: 900, color: palette.navy900 }}>Mailing Address</div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Primary mailing and billing address information for the organization.
                    </div>
                  </div>
                  <div style={responsiveTwoColGrid}>
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
                  </div>
                </section>
                <section style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 3 }}>
                    <div style={{ fontWeight: 900, color: palette.navy900 }}>Contract + Billing</div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Billing and agreement details used for operations and account management.
                    </div>
                  </div>
                  <div style={responsiveTwoColGrid}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Billing Email</span>
                      <input readOnly={profileReadOnly} value={profileForm.billing_email} onChange={(e) => setProfileForm((p) => ({ ...p, billing_email: e.target.value }))} placeholder="billing@examplemunicipality.gov" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
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
                  </div>
                </section>
                <section style={{ ...subPanel, display: "grid", gap: 8 }}>
                  <div style={{ display: "grid", gap: 3 }}>
                    <div style={{ fontWeight: 900, color: palette.navy900 }}>Operational Notes</div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Internal onboarding, operations, or account notes for this organization.
                    </div>
                  </div>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                    <span>Notes</span>
                    <textarea readOnly={profileReadOnly} value={profileForm.notes} onChange={(e) => setProfileForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Add context for onboarding, constraints, and operating notes." style={{ ...inputBase, minHeight: 110, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                  </label>
                </section>
                {inAddTenantFlow ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" style={buttonBase} onClick={() => setAddTenantStep("contacts")}>
                      Next: Contacts
                    </button>
                  </div>
                ) : !profileReadOnly ? (
                  <form onSubmit={saveTenantProfile} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="submit" style={{ ...buttonBase, opacity: canEditTenantSetup ? 1 : 0.55 }} disabled={!canEditTenantSetup}>Save Organization Information</button>
                  </form>
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
                    {profileForm.additional_contacts.map((contact, index) => (
                      <div key={`contact-${index}`} style={{ ...subPanel, display: "grid", gap: 8 }}>
                        {(() => {
                          const isEditingContact = editingAdditionalContactIndex === index;
                          return (
                            <>
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
                            </>
                          );
                        })()}
                      </div>
                    ))}
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
                            <>
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
                            </>
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

        {inTenantWorkspace && activeTab === "domains" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 3 }}>
                <h2 style={{ margin: 0, color: palette.navy900 }}>Domains + Assets</h2>
                <p style={{ margin: 0, color: palette.textMuted }}>
                  Manage domain visibility, notification routing, map behavior, and supporting organization assets in one place.
                </p>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ ...subPanel, display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 3 }}>
                    <div style={{ fontWeight: 900, color: palette.navy900 }}>Domain Enablement</div>
                    <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                      Control which reporting domains are active, how each domain is classified, and where notifications should route for {selectedTenantPublicDisplayName || selectedTenantOrganizationName || selectedTenantKey}.
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))", gap: 10, alignItems: "start" }}>
                    {DOMAIN_OPTIONS.map((d) => {
                      const domainType = String(domainConfigForm?.[d.key]?.domain_type || defaultDomainType(d.key)).trim().toLowerCase() || defaultDomainType(d.key);
                      const coordinateFiles = domainCoordinateFiles?.[d.key] || [];
                      const isAssetBacked = domainType === "asset_backed";
                      const isEditingDomain = editingDomainKey === d.key;
                      const domainFieldsReadOnly = !canEditTenantDomains || !isEditingDomain;
                      const editLockedByOtherDomain = Boolean(editingDomainKey) && !isEditingDomain;
                      return (
                        <div
                          key={d.key}
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
                              <div style={{ fontSize: 13, fontWeight: 900, color: palette.navy900 }}>{d.label}</div>
                              <div style={{ fontSize: 12.5, color: palette.textMuted }}>
                                {isAssetBacked
                                  ? "Persistent mapped assets can be seeded with coordinates and also route notifications."
                                  : "Resident and staff reports create incidents in this domain and route to the selected notification inbox."}
                              </div>
                            </div>
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
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {!isEditingDomain ? (
                              <button
                                type="button"
                                style={{ ...buttonAlt, opacity: canEditTenantDomains && !editLockedByOtherDomain ? 1 : 0.55 }}
                                disabled={!canEditTenantDomains || editLockedByOtherDomain}
                                onClick={() => beginDomainEdit(d.key)}
                                title={
                                  editLockedByOtherDomain
                                    ? "Finish the current domain edit before opening another domain."
                                    : canEditTenantDomains
                                      ? `Edit ${d.label}`
                                      : "You need the Domains edit permission"
                                }
                              >
                                Edit
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  style={{ ...buttonBase, opacity: canEditTenantDomains ? 1 : 0.55 }}
                                  disabled={!canEditTenantDomains}
                                  onClick={() => void saveDomainAndFeatureSettings(null, { closeEditingDomain: d.key })}
                                >
                                  Save
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
                          <div style={responsiveActionGrid}>
                            <label style={modalField}>
                              <span>Enablement</span>
                              <select
                                value={domainVisibilityForm[d.key] || "enabled"}
                                disabled={domainFieldsReadOnly}
                                onChange={(e) => setDomainVisibilityForm((prev) => ({ ...prev, [d.key]: e.target.value }))}
                                style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                              >
                                <option value="enabled">Enabled</option>
                                <option value="disabled">Disabled</option>
                              </select>
                            </label>
                            <label style={modalField}>
                              <span>Domain Type</span>
                              <select
                                value={domainType}
                                disabled={domainFieldsReadOnly}
                                onChange={(e) => setDomainConfigForm((prev) => ({
                                  ...prev,
                                  [d.key]: {
                                    ...(prev?.[d.key] || {}),
                                    domain_type: e.target.value,
                                  },
                                }))}
                                style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                              >
                                {DOMAIN_TYPE_OPTIONS.map((option) => (
                                  <option key={option.key} value={option.key}>{option.label}</option>
                                ))}
                              </select>
                            </label>
                            <label style={modalField}>
                              <span>Notification Email</span>
                              <input
                                readOnly={domainFieldsReadOnly}
                                value={domainConfigForm?.[d.key]?.notification_email || ""}
                                onChange={(e) => setDomainConfigForm((prev) => ({
                                  ...prev,
                                  [d.key]: {
                                    ...(prev?.[d.key] || {}),
                                    notification_email: e.target.value,
                                  },
                                }))}
                                placeholder={`notifications+${d.key}@examplemunicipality.gov`}
                                style={{ ...modalInput, background: domainFieldsReadOnly ? "#eef4fb" : modalInput.background }}
                              />
                            </label>
                            <div style={{ ...modalField, justifyContent: "center" }}>
                              <span>Repair Verification</span>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  minHeight: 48,
                                  padding: "0 14px",
                                  borderRadius: 14,
                                  border: "1px solid rgba(17, 36, 69, 0.14)",
                                  background: domainFieldsReadOnly ? "#eef4fb" : "rgba(255,255,255,0.92)",
                                  color: palette.navy900,
                                  fontWeight: 700,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={domainConfigForm?.[d.key]?.organization_monitored_repairs !== false}
                                  disabled={domainFieldsReadOnly}
                                  onChange={(e) => setDomainConfigForm((prev) => ({
                                    ...prev,
                                    [d.key]: {
                                      ...(prev?.[d.key] || {}),
                                      organization_monitored_repairs: e.target.checked,
                                    },
                                  }))}
                                />
                                <span>
                                  {domainConfigForm?.[d.key]?.organization_monitored_repairs !== false
                                    ? "Organization monitored repairs"
                                    : "Public repair confirmations enabled"}
                                </span>
                              </label>
                            </div>
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
                                      {coordinateFiles.length - 3} more coordinate file{coordinateFiles.length - 3 === 1 ? "" : "s"} available in the asset library below.
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>

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
              </div>
              {status.domains ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{toOrganizationLanguage(status.domains)}</div> : null}
            </div>

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
