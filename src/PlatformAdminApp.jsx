import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const TITLE_LOGO_SRC = import.meta.env.VITE_TITLE_LOGO_SRC || "/CityReport-logo.png";
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
  { key: "tenants", label: "Tenant Info" },
  { key: "users", label: "Users/Admins" },
  { key: "roles", label: "Roles + Permissions" },
  { key: "domains", label: "Domains + Features" },
  { key: "files", label: "Files" },
  { key: "audit", label: "Audit" },
];

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

const shell = {
  minHeight: "100vh",
  padding: "28px 18px 42px",
  fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  background: `linear-gradient(180deg, ${palette.mint600} 0%, ${palette.mint700} 100%)`,
  color: palette.text,
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
  fontSize: 13,
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

const brandLockup = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const brandLogo = {
  width: 168,
  maxWidth: "44vw",
  height: "auto",
  display: "block",
};

function initialTenantForm() {
  return {
    tenant_key: "",
    name: "",
    primary_subdomain: "",
    boundary_config_key: "",
    notification_email_potholes: "",
    notification_email_water_drain: "",
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
    contact_technical_name: "",
    contact_technical_email: "",
    contact_technical_phone: "",
    contact_legal_name: "",
    contact_legal_email: "",
    contact_legal_phone: "",
    contract_status: "pending",
    contract_start_date: "",
    contract_end_date: "",
    renewal_date: "",
    notes: "",
  };
}

function profileRowToForm(profile) {
  if (!profile) return initialProfileForm();
  const legacyAddress = String(profile.mailing_address || "").trim();
  const address1 = String(profile.mailing_address_1 || "").trim();
  const address2 = String(profile.mailing_address_2 || "").trim();
  const city = String(profile.mailing_city || "").trim();
  const state = String(profile.mailing_state || "").trim();
  const zip = String(profile.mailing_zip || "").trim();
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
    contact_technical_name: String(profile.contact_technical_name || ""),
    contact_technical_email: String(profile.contact_technical_email || ""),
    contact_technical_phone: String(profile.contact_technical_phone || ""),
    contact_legal_name: String(profile.contact_legal_name || ""),
    contact_legal_email: String(profile.contact_legal_email || ""),
    contact_legal_phone: String(profile.contact_legal_phone || ""),
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

function roleKeyToLabel(roleKey) {
  return String(roleKey || "")
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
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

function makeLiveUrl(primarySubdomain, tenantKey) {
  const host = String(primarySubdomain || "").trim().toLowerCase();
  if (host) {
    if (host.startsWith("http://") || host.startsWith("https://")) {
      return host;
    }
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

function isMissingRelationError(error) {
  const code = String(error?.code || "").trim().toUpperCase();
  const msg = String(error?.message || "").toLowerCase();
  return code === "42P01" || msg.includes("relation") || msg.includes("does not exist");
}

export default function PlatformAdminApp() {
  const [authReady, setAuthReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [sessionActorName, setSessionActorName] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [platformAccessRole, setPlatformAccessRole] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState("tenants");
  const [loading, setLoading] = useState(false);

  const [tenants, setTenants] = useState([]);
  const [tenantAdmins, setTenantAdmins] = useState([]);
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
  const [tenantSearch, setTenantSearch] = useState("");

  const [tenantForm, setTenantForm] = useState(initialTenantForm);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [domainVisibilityForm, setDomainVisibilityForm] = useState(initialDomainVisibilityForm);
  const [mapFeaturesForm, setMapFeaturesForm] = useState(initialMapFeaturesForm);
  const [assignForm, setAssignForm] = useState({ tenant_key: "", user_id: "", role: "tenant_employee" });
  const [fileForm, setFileForm] = useState({ category: "contract", notes: "", file: null });
  const [isEditingTenant, setIsEditingTenant] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

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

  const tenantOptions = useMemo(
    () => (Array.isArray(tenants) ? tenants.map((t) => String(t?.tenant_key || "").trim()).filter(Boolean) : []),
    [tenants]
  );

  const selectedTenant = useMemo(
    () => (tenants || []).find((t) => String(t?.tenant_key || "") === String(selectedTenantKey || "")) || null,
    [tenants, selectedTenantKey]
  );

  const filteredTenantRows = useMemo(() => {
    const q = String(tenantSearch || "").trim().toLowerCase();
    if (!q) return Array.isArray(tenants) ? tenants : [];
    return (tenants || []).filter((row) => {
      const key = String(row?.tenant_key || "").trim().toLowerCase();
      const name = String(row?.name || "").trim().toLowerCase();
      const sub = String(row?.primary_subdomain || "").trim().toLowerCase();
      return key.includes(q) || name.includes(q) || sub.includes(q);
    });
  }, [tenants, tenantSearch]);

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
      out[key] = String(row?.role_label || "").trim() || roleKeyToLabel(key);
    }
    return out;
  }, [tenantRoleDefinitions]);

  const assignableTenantRoles = useMemo(
    () => sortedTenantRoleDefinitions.filter((row) => row?.active !== false),
    [sortedTenantRoleDefinitions]
  );

  const selectedTenantRoleAssignments = useMemo(
    () => (tenantAdmins || []).filter((row) => String(row?.tenant_key || "") === String(selectedTenantKey || "")),
    [tenantAdmins, selectedTenantKey]
  );

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

  const isPlatformOwner = platformAccessRole === "platform_owner" || platformAccessRole === "legacy_admin";
  const isPlatformStaff = platformAccessRole === "platform_staff";
  const canEditTenantCore = isPlatformOwner;
  const canEditTenantOperational = isPlatformOwner || isPlatformStaff;

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
    const { data, error } = await supabase
      .from("tenants")
      .select("tenant_key,name,primary_subdomain,boundary_config_key,notification_email_potholes,notification_email_water_drain,is_pilot,active,updated_at")
      .order("tenant_key", { ascending: true });
    if (error) throw error;
    setTenants(Array.isArray(data) ? data : []);
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
        for (const row of tenantAdmins || []) {
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
  }, [selectedTenantKey, tenantAdmins]);

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

  const refreshControlPlaneData = useCallback(async () => {
    setLoading(true);
    setStatus((prev) => ({ ...prev, hydrate: "Refreshing platform data..." }));
    try {
      await Promise.all([
        loadTenants(),
        loadTenantAdmins(),
        loadTenantRoleConfig(),
        loadTenantProfiles(),
        loadTenantVisibility(),
        loadTenantMapFeatures(),
        loadAudit(),
      ]);
      setStatus((prev) => ({ ...prev, hydrate: "Platform data loaded." }));
    } catch (error) {
      setStatus((prev) => ({ ...prev, hydrate: statusText(error, "") }));
    } finally {
      setLoading(false);
    }
  }, [loadTenants, loadTenantAdmins, loadTenantRoleConfig, loadTenantProfiles, loadTenantVisibility, loadTenantMapFeatures, loadAudit]);

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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoginLoading(false);
    if (error) {
      setLoginError(String(error?.message || "Unable to sign in."));
      return;
    }
    setLoginPassword("");
  }, [loginEmail, loginPassword]);

  const signOutPlatformAdmin = useCallback(async () => {
    await supabase.auth.signOut();
    setIsPlatformAdmin(false);
    setPlatformAccessRole("");
    setLoginPassword("");
    setEntryStep("start");
  }, []);

  const openAddTenantStep = useCallback(() => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, tenant: "Only Platform Owner can create a tenant." }));
      return;
    }
    setEntryStep("add");
    setActiveTab("tenants");
    setTenantForm(initialTenantForm());
    setProfileForm(initialProfileForm());
    setIsEditingTenant(true);
    setIsEditingProfile(true);
    setStatus((prev) => ({ ...prev, tenant: "", profile: "" }));
  }, [canEditTenantCore]);

  const openTenantWorkspace = useCallback((tenantKey) => {
    const key = sanitizeTenantKey(tenantKey);
    if (!key) {
      setStatus((prev) => ({ ...prev, hydrate: "No tenants found yet. Use Add Tenant to create one." }));
      return;
    }
    setSelectedTenantKey(key);
    setEntryStep("tenant");
    setActiveTab("tenants");
    setIsEditingTenant(false);
    setIsEditingProfile(false);
    setStatus((prev) => ({ ...prev, hydrate: `Loaded tenant ${key}.` }));
  }, []);

  const returnToStart = useCallback(() => {
    setEntryStep("start");
    setTenantSearch("");
    setIsEditingTenant(false);
    setIsEditingProfile(false);
  }, []);

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
    if (!tenantOptions.length) return;
    if (!tenantOptions.includes(selectedTenantKey)) {
      setSelectedTenantKey(tenantOptions[0]);
    }
  }, [tenantOptions, selectedTenantKey]);

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

  const saveTenant = useCallback(async (event) => {
    event.preventDefault();
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, tenant: "Only Platform Owner can create or modify core tenant records." }));
      return;
    }
    const resolvedTenantKey = entryStep === "tenant"
      ? sanitizeTenantKey(selectedTenantKey)
      : sanitizeTenantKey(tenantForm.tenant_key);
    const defaultBoundaryKey = buildDefaultBoundaryKey(resolvedTenantKey);
    const payload = {
      tenant_key: resolvedTenantKey,
      name: String(tenantForm.name || "").trim(),
      primary_subdomain: String(tenantForm.primary_subdomain || "").trim().toLowerCase(),
      boundary_config_key: String(tenantForm.boundary_config_key || defaultBoundaryKey).trim() || defaultBoundaryKey,
      notification_email_potholes: cleanOptional(tenantForm.notification_email_potholes),
      notification_email_water_drain: cleanOptional(tenantForm.notification_email_water_drain),
      is_pilot: Boolean(tenantForm.is_pilot),
      active: Boolean(tenantForm.active),
    };

    if (!payload.tenant_key || !payload.name || !payload.primary_subdomain) {
      setStatus((prev) => ({ ...prev, tenant: "Tenant key, name, and primary subdomain are required." }));
      return;
    }

    const { error } = await supabase.from("tenants").upsert([payload], { onConflict: "tenant_key" });
    if (error) {
      setStatus((prev) => ({ ...prev, tenant: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key: payload.tenant_key,
      action: "tenant_upsert",
      entity_type: "tenant",
      entity_id: payload.tenant_key,
      details: {
        primary_subdomain: payload.primary_subdomain,
        boundary_config_key: payload.boundary_config_key,
        is_pilot: payload.is_pilot,
        active: payload.active,
      },
    });

    setStatus((prev) => ({ ...prev, tenant: `Saved tenant ${payload.tenant_key}.` }));
    if (entryStep === "add") {
      setTenantForm(initialTenantForm());
      setIsEditingTenant(true);
    } else {
      setIsEditingTenant(false);
    }
    setSelectedTenantKey(payload.tenant_key);
    await refreshControlPlaneData();
  }, [canEditTenantCore, entryStep, selectedTenantKey, tenantForm, logAudit, refreshControlPlaneData]);

  const toggleTenantActive = useCallback(async (row) => {
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, tenant: "Only Platform Owner can activate/deactivate tenants." }));
      return;
    }
    const key = sanitizeTenantKey(row?.tenant_key);
    if (!key) return;
    const nextActive = !Boolean(row?.active);
    const { error } = await supabase
      .from("tenants")
      .update({ active: nextActive })
      .eq("tenant_key", key);
    if (error) {
      setStatus((prev) => ({ ...prev, tenant: statusText(error, "") }));
      return;
    }
    await logAudit({
      tenant_key: key,
      action: nextActive ? "tenant_activated" : "tenant_deactivated",
      entity_type: "tenant",
      entity_id: key,
      details: { active: nextActive },
    });
    setStatus((prev) => ({ ...prev, tenant: `${nextActive ? "Activated" : "Deactivated"} ${key}.` }));
    await refreshControlPlaneData();
  }, [canEditTenantCore, logAudit, refreshControlPlaneData]);

  const saveTenantProfile = useCallback(async (event) => {
    event.preventDefault();
    if (!canEditTenantOperational) {
      setStatus((prev) => ({ ...prev, profile: "Your platform role does not permit tenant profile changes." }));
      return;
    }
    const key = sanitizeTenantKey(selectedTenantKey);
    if (!key) {
      setStatus((prev) => ({ ...prev, profile: "Select a tenant first." }));
      return;
    }
    if (!String(profileForm.legal_name || "").trim()) {
      setStatus((prev) => ({ ...prev, profile: "Legal organization name is required." }));
      return;
    }
    if (!String(profileForm.contact_primary_email || "").trim()) {
      setStatus((prev) => ({ ...prev, profile: "Primary contact email is required." }));
      return;
    }

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
      contact_technical_name: cleanOptional(profileForm.contact_technical_name),
      contact_technical_email: cleanOptional(profileForm.contact_technical_email),
      contact_technical_phone: cleanOptional(profileForm.contact_technical_phone),
      contact_legal_name: cleanOptional(profileForm.contact_legal_name),
      contact_legal_email: cleanOptional(profileForm.contact_legal_email),
      contact_legal_phone: cleanOptional(profileForm.contact_legal_phone),
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
      return;
    }

    await logAudit({
      tenant_key: key,
      action: "tenant_profile_upsert",
      entity_type: "tenant_profile",
      entity_id: key,
      details: {
        contract_status: payload.contract_status,
        contact_primary_email: payload.contact_primary_email,
      },
    });

    setStatus((prev) => ({ ...prev, profile: `Saved intake profile for ${key}.` }));
    setIsEditingProfile(false);
    await refreshControlPlaneData();
  }, [canEditTenantOperational, selectedTenantKey, profileForm, logAudit, refreshControlPlaneData]);

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
    event.preventDefault();
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, users: "Only Platform Owner can assign tenant roles from this control plane." }));
      return;
    }
    const tenant_key = sanitizeTenantKey(selectedTenantKey);
    const user_id = String(assignForm.user_id || "").trim();
    const role = String(assignForm.role || "").trim().toLowerCase() || String(assignableTenantRoles?.[0]?.role || "tenant_employee");

    if (!tenant_key || !user_id) {
      setStatus((prev) => ({ ...prev, users: "Tenant key and user UUID are required." }));
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

    setStatus((prev) => ({ ...prev, users: `Assigned ${role} role to ${user_id} in ${tenant_key}.` }));
    setAssignForm((prev) => ({ ...prev, tenant_key: "", user_id: "", role }));
    await refreshControlPlaneData();
  }, [canEditTenantCore, assignForm, assignableTenantRoles, selectedTenantKey, logAudit, refreshControlPlaneData]);

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

    setStatus((prev) => ({ ...prev, users: `Removed ${role} role for ${user_id} from ${tenant_key}.` }));
    await refreshControlPlaneData();
  }, [canEditTenantCore, logAudit, refreshControlPlaneData]);

  const createTenantRole = useCallback(async (event) => {
    event.preventDefault();
    if (!canEditTenantCore) {
      setStatus((prev) => ({ ...prev, roles: "Only Platform Owner can create roles." }));
      return;
    }

    const tenant_key = sanitizeTenantKey(selectedTenantKey);
    const role = sanitizeRoleKey(roleForm.role);
    const role_label = String(roleForm.role_label || "").trim() || roleKeyToLabel(role);
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
  const sessionDisplayLabel = sessionEmail || (sessionUserId ? `${sessionUserId.slice(0, 8)}...${sessionUserId.slice(-4)}` : "");

  if (!authReady) {
    return (
      <main style={shell}>
        <section style={{ maxWidth: 1180, margin: "0 auto", ...card }}>
          <div style={{ ...brandLockup, marginBottom: 10 }}>
            <img src={TITLE_LOGO_SRC} alt={TITLE_LOGO_ALT} style={brandLogo} />
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 8, color: palette.navy900 }}>Platform Admin</h1>
          <p style={{ margin: 0, color: palette.textMuted }}>Loading session...</p>
        </section>
      </main>
    );
  }

  if (!sessionUserId) {
    return (
      <main style={shell}>
        <section style={{ maxWidth: 1180, margin: "0 auto", ...card, display: "grid", gap: 10 }}>
          <div style={brandLockup}>
            <img src={TITLE_LOGO_SRC} alt={TITLE_LOGO_ALT} style={brandLogo} />
          </div>
          <h1 style={{ marginTop: 0, marginBottom: 6, color: palette.navy900 }}>Platform Admin</h1>
          <p style={{ margin: 0, color: palette.textMuted }}>
            Sign in with your platform admin account to manage municipalities and operational settings.
          </p>
          <form onSubmit={signInPlatformAdmin} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
            <input
              type="email"
              autoComplete="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Email"
              style={inputBase}
            />
            <input
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              style={inputBase}
            />
            <button type="submit" style={{ ...buttonBase, width: "fit-content", minWidth: 140 }} disabled={loginLoading}>
              {loginLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          {loginError ? <p style={{ margin: 0, color: palette.red600, fontSize: 12.5 }}>{loginError}</p> : null}
        </section>
      </main>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <main style={shell}>
        <section style={{ maxWidth: 1180, margin: "0 auto", ...card }}>
          <div style={{ ...brandLockup, marginBottom: 10 }}>
            <img src={TITLE_LOGO_SRC} alt={TITLE_LOGO_ALT} style={brandLogo} />
          </div>
          <h1 style={{ marginTop: 0, color: palette.navy900 }}>Platform Admin</h1>
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
    <main style={shell}>
      <section style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 14 }}>
        <header style={{ ...card, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={brandLockup}>
                <img src={TITLE_LOGO_SRC} alt={TITLE_LOGO_ALT} style={{ ...brandLogo, width: 176 }} />
              </div>
              <h1 style={{ margin: 0, color: palette.navy900 }}>Platform Control Plane</h1>
              <span style={{ fontSize: 12.5, color: palette.textMuted }}>
                Tenant operations dashboard for implementation, governance, and support.
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {inTenantWorkspace ? (
                <button type="button" style={headerActionButton} onClick={returnToStart}>Switch Tenant</button>
              ) : null}
              {inTenantWorkspace ? (
                <button
                  type="button"
                  style={{ ...headerActionButton, opacity: canEditTenantCore ? 1 : 0.55 }}
                  onClick={openAddTenantStep}
                  disabled={!canEditTenantCore}
                  title={canEditTenantCore ? "Create tenant" : "Only Platform Owner can create tenants"}
                >
                  Add Tenant
                </button>
              ) : null}
              <button type="button" style={signOutButton} onClick={() => void signOutPlatformAdmin()}>
                Sign out
              </button>
            </div>
          </div>
          <p style={{ margin: 0, color: palette.textMuted }}>
            Access: <b>{isPlatformOwner ? "Platform Owner" : isPlatformStaff ? "Platform Staff" : "Platform Administrator"}</b>
            {sessionDisplayLabel ? <>. Account: <b>{sessionDisplayLabel}</b>.</> : "."}
          </p>
          {inEntryPrompt ? (
            <div style={{ ...subPanel, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 20, color: palette.navy900 }}>Start Here</h2>
              <p style={{ margin: 0, fontSize: 13.5, color: palette.textMuted }}>
                Add a new tenant, or search and open an existing tenant workspace.
              </p>
              <button type="button" style={{ ...buttonBase, width: "fit-content" }} onClick={openAddTenantStep}>
                Add Tenant
              </button>
              <input
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                placeholder="Search tenants by name, key, or subdomain"
                style={{ ...inputBase, maxWidth: 620 }}
              />
              <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto", paddingRight: 2 }}>
                {filteredTenantRows.map((row) => {
                  const key = String(row?.tenant_key || "").trim();
                  if (!key) return null;
                  const name = String(row?.name || "").trim() || key;
                  const subdomain = String(row?.primary_subdomain || "").trim();
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => openTenantWorkspace(key)}
                      style={listActionButton}
                    >
                      <span>{name}</span>
                      <span style={{ fontSize: 11.5, opacity: 0.8 }}>{key}{subdomain ? ` • ${subdomain}` : ""}</span>
                    </button>
                  );
                })}
                {!filteredTenantRows.length ? (
                  <div style={{ fontSize: 12.5, color: palette.red600 }}>No tenants match this search.</div>
                ) : null}
              </div>
            </div>
          ) : null}
          {inAddTenantFlow ? (
            <div style={{ ...subPanel, display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, color: palette.textMuted }}>New tenant flow active. Complete the onboarding forms below.</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={buttonAlt} onClick={returnToStart}>Back</button>
              </div>
            </div>
          ) : null}
          {inTenantWorkspace ? (
            <>
              <div style={{ ...subPanel, borderRadius: 10, padding: "10px 12px", display: "grid", gap: 8 }}>
                <div style={{ fontSize: 12, color: palette.textMuted }}>Current Tenant Workspace</div>
                <div style={{ fontSize: 15, fontWeight: 900, color: palette.navy900 }}>
                  {selectedTenant?.name || selectedTenantKey}
                  <span style={{ fontWeight: 600, color: palette.textMuted }}> ({selectedTenantKey})</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TAB_OPTIONS.map((tab) => {
                    const selected = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                          ...buttonBase,
                          border: selected ? `1px solid ${palette.mint700}` : buttonBase.border,
                          background: selected ? `linear-gradient(180deg, ${palette.mint600} 0%, ${palette.mint700} 100%)` : buttonBase.background,
                          color: selected ? "white" : buttonBase.color,
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedTenantLiveUrl ? (
                    <a href={selectedTenantLiveUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonBase, textDecoration: "none" }}>
                      Open Live Map
                    </a>
                  ) : null}
                  {selectedTenantDevUrl ? (
                    <a href={selectedTenantDevUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonBase, textDecoration: "none" }}>
                      Open Dev Map
                    </a>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
          {status.hydrate ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{status.hydrate}</div> : null}
        </header>

        {showTenantsSection ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, color: palette.navy900 }}>{inAddTenantFlow ? "Add Tenant: Basic Setup" : "Tenant Details"}</h2>
                {!inAddTenantFlow ? (
                  tenantReadOnly ? (
                    <button type="button" style={buttonAlt} onClick={() => setIsEditingTenant(true)}>
                      Edit Tenant Details
                    </button>
                  ) : (
                    <button
                      type="button"
                      style={buttonAlt}
                      onClick={() => {
                        if (!selectedTenant) return;
                        setTenantForm({
                          tenant_key: String(selectedTenant.tenant_key || ""),
                          name: String(selectedTenant.name || ""),
                          primary_subdomain: String(selectedTenant.primary_subdomain || ""),
                          boundary_config_key: String(selectedTenant.boundary_config_key || ""),
                          notification_email_potholes: String(selectedTenant.notification_email_potholes || ""),
                          notification_email_water_drain: String(selectedTenant.notification_email_water_drain || ""),
                          is_pilot: Boolean(selectedTenant.is_pilot),
                          active: Boolean(selectedTenant.active),
                        });
                        setIsEditingTenant(false);
                      }}
                    >
                      Cancel
                    </button>
                  )
                ) : null}
              </div>
              {!inAddTenantFlow ? (
                <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                  Review tenant settings here. Use Edit to make changes.
                </p>
              ) : null}
              <form onSubmit={saveTenant} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }}>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>Tenant Key (system ID)</span>
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
                  <span>Tenant Name</span>
                  <input
                    readOnly={tenantReadOnly}
                    value={tenantForm.name}
                    onChange={(e) => setTenantForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Example Municipality"
                    style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }}
                  />
                </label>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>Primary Tenant URL</span>
                  <input
                    readOnly={tenantReadOnly}
                    value={tenantForm.primary_subdomain}
                    onChange={(e) => setTenantForm((p) => ({ ...p, primary_subdomain: e.target.value }))}
                    placeholder="examplemunicipality.cityreport.io"
                    style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }}
                  />
                </label>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>Boundary Dataset Key (auto-managed)</span>
                  <input
                    readOnly
                    value={tenantForm.boundary_config_key}
                    placeholder="examplemunicipality_city_geojson"
                    style={{ ...inputBase, background: "#eef4fb", cursor: "not-allowed" }}
                  />
                  <span style={{ fontSize: 11.5, color: palette.textMuted }}>
                    Upload a `Boundary GeoJSON` file in Files, then set it as boundary.
                  </span>
                </label>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>Pothole Notification Email</span>
                  <input
                    readOnly={tenantReadOnly}
                    value={tenantForm.notification_email_potholes}
                    onChange={(e) => setTenantForm((p) => ({ ...p, notification_email_potholes: e.target.value }))}
                    placeholder="roads@examplemunicipality.gov"
                    style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }}
                  />
                </label>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>Water / Drain Notification Email</span>
                  <input
                    readOnly={tenantReadOnly}
                    value={tenantForm.notification_email_water_drain}
                    onChange={(e) => setTenantForm((p) => ({ ...p, notification_email_water_drain: e.target.value }))}
                    placeholder="utilities@examplemunicipality.gov"
                    style={{ ...inputBase, background: tenantReadOnly ? "#eef4fb" : inputBase.background }}
                  />
                </label>
                <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={tenantForm.is_pilot}
                    disabled={tenantReadOnly}
                    onChange={(e) => setTenantForm((p) => ({ ...p, is_pilot: e.target.checked }))}
                  /> Pilot Municipality
                </label>
                <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={tenantForm.active}
                    disabled={tenantReadOnly}
                    onChange={(e) => setTenantForm((p) => ({ ...p, active: e.target.checked }))}
                  /> Active Tenant
                </label>
                {(inAddTenantFlow || !tenantReadOnly) ? (
                  <button type="submit" style={{ ...buttonBase, gridColumn: "1 / -1", width: "fit-content" }}>
                    {inAddTenantFlow ? "Save Tenant" : "Save Tenant Details"}
                  </button>
                ) : null}
              </form>
              {status.tenant ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{status.tenant}</div> : null}
            </div>

            <div style={{ ...card, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, color: palette.navy900 }}>
                  {inAddTenantFlow ? "Add Tenant: Contact Information" : "Tenant Contact Information"}
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
              <form onSubmit={saveTenantProfile} style={{ display: "grid", gap: 10 }}>
                <section style={{ ...subPanel, display: "grid", gap: 8 }}>
                  <h3 style={{ margin: 0, color: palette.navy900 }}>Organization Information</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Legal Organization Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.legal_name} onChange={(e) => setProfileForm((p) => ({ ...p, legal_name: e.target.value }))} placeholder="Example Municipality Public Works" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Public Display Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.display_name} onChange={(e) => setProfileForm((p) => ({ ...p, display_name: e.target.value }))} placeholder="Example Municipality" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Address 1</span>
                      <input
                        readOnly={profileReadOnly}
                        value={profileForm.mailing_address_1}
                        onChange={(e) => setProfileForm((p) => ({ ...p, mailing_address_1: e.target.value }))}
                        placeholder="100 Civic Center Dr"
                        style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }}
                      />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Address 2</span>
                      <input
                        readOnly={profileReadOnly}
                        value={profileForm.mailing_address_2}
                        onChange={(e) => setProfileForm((p) => ({ ...p, mailing_address_2: e.target.value }))}
                        placeholder="Building A, Suite 200 (optional)"
                        style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }}
                      />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>City</span>
                      <input
                        readOnly={profileReadOnly}
                        value={profileForm.mailing_city}
                        onChange={(e) => setProfileForm((p) => ({ ...p, mailing_city: e.target.value }))}
                        placeholder="Example City"
                        style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }}
                      />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>State</span>
                      <input
                        readOnly={profileReadOnly}
                        value={profileForm.mailing_state}
                        onChange={(e) => setProfileForm((p) => ({ ...p, mailing_state: e.target.value }))}
                        placeholder="ST"
                        style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }}
                      />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>ZIP</span>
                      <input
                        readOnly={profileReadOnly}
                        value={profileForm.mailing_zip}
                        onChange={(e) => setProfileForm((p) => ({ ...p, mailing_zip: e.target.value }))}
                        placeholder="12345"
                        style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }}
                      />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Municipality Website URL</span>
                      <input readOnly={profileReadOnly} value={profileForm.website_url} onChange={(e) => setProfileForm((p) => ({ ...p, website_url: e.target.value }))} placeholder="https://www.examplemunicipality.gov" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>URL Extension (Alias)</span>
                      <input readOnly={profileReadOnly} value={profileForm.url_extension} onChange={(e) => setProfileForm((p) => ({ ...p, url_extension: e.target.value }))} placeholder="examplemunicipality" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
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

                <section style={{ ...subPanel, display: "grid", gap: 8 }}>
                  <h3 style={{ margin: 0, color: palette.navy900 }}>Contact Info</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }}>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Primary Contact Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_primary_name} onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_name: e.target.value }))} placeholder="Primary Contact" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Primary Contact Title</span>
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
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Technical Contact Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_technical_name} onChange={(e) => setProfileForm((p) => ({ ...p, contact_technical_name: e.target.value }))} placeholder="Technical Contact" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Technical Contact Email</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_technical_email} onChange={(e) => setProfileForm((p) => ({ ...p, contact_technical_email: e.target.value }))} placeholder="it@examplemunicipality.gov" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Technical Contact Phone</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_technical_phone} onChange={(e) => setProfileForm((p) => ({ ...p, contact_technical_phone: e.target.value }))} placeholder="(000) 000-0000" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Legal Contact Name</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_legal_name} onChange={(e) => setProfileForm((p) => ({ ...p, contact_legal_name: e.target.value }))} placeholder="Legal Contact" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Legal Contact Email</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_legal_email} onChange={(e) => setProfileForm((p) => ({ ...p, contact_legal_email: e.target.value }))} placeholder="legal@examplemunicipality.gov" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                    <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                      <span>Legal Contact Phone</span>
                      <input readOnly={profileReadOnly} value={profileForm.contact_legal_phone} onChange={(e) => setProfileForm((p) => ({ ...p, contact_legal_phone: e.target.value }))} placeholder="(000) 000-0000" style={{ ...inputBase, background: profileReadOnly ? "#eef4fb" : inputBase.background }} />
                    </label>
                  </div>
                </section>

                {(inAddTenantFlow || !profileReadOnly) ? (
                  <button type="submit" style={{ ...buttonBase, width: "fit-content" }}>
                    Save Contact Information
                  </button>
                ) : null}
              </form>
              {status.profile ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{status.profile}</div> : null}
            </div>
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "users" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Assign Tenant User Role</h2>
              <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                Add a user by Supabase Auth user ID and assign one configured role for this municipality.
              </p>
              <form onSubmit={assignTenantAdmin} style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr auto", gap: 8, alignItems: "end" }}>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>Municipality</span>
                  <input
                    value={selectedTenantKey}
                    readOnly
                    style={{ ...inputBase, background: "#eef4fb", cursor: "not-allowed" }}
                  />
                </label>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>User ID</span>
                  <input
                    value={assignForm.user_id}
                    onChange={(e) => setAssignForm((p) => ({ ...p, user_id: e.target.value }))}
                    placeholder="Paste auth.users UUID"
                    style={inputBase}
                    disabled={!canEditTenantCore}
                  />
                </label>
                <label style={{ fontSize: 12.5, display: "grid", gap: 4 }}>
                  <span>Access Role</span>
                  <select
                    value={assignForm.role}
                    onChange={(e) => setAssignForm((p) => ({ ...p, role: e.target.value }))}
                    style={inputBase}
                    disabled={!canEditTenantCore}
                  >
                    {assignableTenantRoles.map((row) => {
                      const key = String(row?.role || "");
                      if (!key) return null;
                      const label = String(row?.role_label || "").trim() || roleKeyToLabel(key);
                      return (
                        <option key={key} value={key}>{label}</option>
                      );
                    })}
                    {!assignableTenantRoles.length ? (
                      <>
                        <option value="tenant_employee">Tenant Employee</option>
                        <option value="tenant_admin">Tenant Admin</option>
                      </>
                    ) : null}
                  </select>
                </label>
                <button
                  type="submit"
                  style={{ ...buttonBase, opacity: canEditTenantCore ? 1 : 0.55 }}
                  disabled={!canEditTenantCore}
                  title={canEditTenantCore ? "Assign tenant role" : "Only Platform Owner can assign tenant roles here"}
                >
                  Assign Role
                </button>
              </form>
              {status.users ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{status.users}</div> : null}
            </div>

            <div style={{ ...card, display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Tenant Role Assignments</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={tableHeadCell}>Tenant</th>
                      <th style={tableHeadCell}>User</th>
                      <th style={tableHeadCell}>Role</th>
                      <th style={tableHeadCell}>Created</th>
                      <th style={tableHeadCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantAdmins.map((row) => (
                      <tr key={`${row.tenant_key}:${row.user_id}:${row.role}`}>
                        <td style={{ padding: "8px 0" }}>{row.tenant_key}</td>
                        <td style={{ padding: "8px 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{row.user_id}</td>
                        <td style={{ padding: "8px 0" }}>
                          {roleLabelByKey?.[row.role] || roleKeyToLabel(row.role)}
                          <span style={{ marginLeft: 6, color: palette.textMuted, fontSize: 11.5 }}>({row.role})</span>
                        </td>
                        <td style={{ padding: "8px 0" }}>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                        <td style={{ padding: "8px 0" }}>
                          <button
                            type="button"
                            style={{ ...buttonAlt, opacity: canEditTenantCore ? 1 : 0.55 }}
                            onClick={() => void removeTenantAdmin(row)}
                            disabled={!canEditTenantCore}
                            title={canEditTenantCore ? "Remove role" : "Only Platform Owner can remove tenant roles here"}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "roles" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Create Tenant Role</h2>
              <p style={{ margin: 0, fontSize: 12.5, color: palette.textMuted }}>
                Create custom roles for {selectedTenantKey}, then enable or disable module permissions.
              </p>
              <form onSubmit={createTenantRole} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.2fr auto", gap: 8, alignItems: "end" }}>
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
              {status.roles ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{status.roles}</div> : null}
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
                      const roleLabel = String(row?.role_label || "").trim() || roleKeyToLabel(role);
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
                        <td colSpan={5} style={{ padding: "10px 0", opacity: 0.75 }}>No roles found for this tenant.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...card, display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>
                Manage Role Permission {selectedRoleDefinition ? `(${String(selectedRoleDefinition.role_label || selectedRoleDefinition.role)})` : ""}
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(200px, 1fr))", gap: 8 }}>
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
                    <input
                      type="color"
                      value={sanitizeHexColor(mapFeaturesForm.boundary_border_color, "#e53935")}
                      disabled={!borderEnabled}
                      onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, boundary_border_color: e.target.value }))}
                      style={borderEnabled ? { ...inputBase, padding: 4, height: 38 } : { ...disabledFieldStyle, padding: 4, height: 38 }}
                    />
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4, maxWidth: 240, opacity: borderEnabled ? 1 : 0.65 }}>
                    <span>Boundary thickness (0.5 - 8)</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="8"
                      value={mapFeaturesForm.boundary_border_width}
                      disabled={!borderEnabled}
                      onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, boundary_border_width: e.target.value }))}
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
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={mapFeaturesForm.outside_shade_opacity}
                      disabled={!shadeEnabled}
                      onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, outside_shade_opacity: e.target.value }))}
                      style={shadeEnabled ? inputBase : disabledFieldStyle}
                    />
                  </label>
                      </>
                    );
                  })()}
                </div>

                <button type="submit" style={{ ...buttonBase, width: "fit-content" }}>Save Domains + Features</button>
              </form>
              {status.domains ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{status.domains}</div> : null}
            </div>
          </section>
        ) : null}

        {inTenantWorkspace && activeTab === "files" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0, color: palette.navy900 }}>Tenant Files</h2>
              <form onSubmit={uploadTenantFile} style={{ display: "grid", gridTemplateColumns: "220px 1fr 1fr auto", gap: 8, alignItems: "center" }}>
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
              {status.files ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{status.files}</div> : null}
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
            <h2 style={{ margin: 0, color: palette.navy900 }}>Recent Tenant Audit ({selectedTenantKey})</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={tableHeadCell}>When</th>
                    <th style={tableHeadCell}>Tenant</th>
                    <th style={tableHeadCell}>Action</th>
                    <th style={tableHeadCell}>Entity</th>
                    <th style={tableHeadCell}>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "8px 0" }}>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                      <td style={{ padding: "8px 0" }}>{row.tenant_key || "-"}</td>
                      <td style={{ padding: "8px 0" }}>{row.action}</td>
                      <td style={{ padding: "8px 0" }}>{row.entity_type}:{row.entity_id || "-"}</td>
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
            {status.audit ? <div style={{ fontSize: 12.5, color: palette.textMuted }}>{status.audit}</div> : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
