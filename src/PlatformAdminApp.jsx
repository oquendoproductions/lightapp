import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useTenant } from "./tenant/useTenant";

const DOMAIN_OPTIONS = [
  { key: "streetlights", label: "Streetlights" },
  { key: "street_signs", label: "Street Signs" },
  { key: "potholes", label: "Potholes" },
  { key: "water_drain_issues", label: "Water / Drain" },
  { key: "power_outage", label: "Power Outage" },
  { key: "water_main", label: "Water Main" },
];

const TAB_OPTIONS = [
  { key: "tenants", label: "Tenants" },
  { key: "users", label: "Users/Admins" },
  { key: "domains", label: "Domains + Features" },
  { key: "files", label: "Files" },
  { key: "audit", label: "Audit" },
];

const shell = {
  minHeight: "100vh",
  padding: "28px 18px 42px",
  fontFamily: "Manrope, sans-serif",
  background: "#f4f8fd",
  color: "#17314f",
};

const card = {
  background: "white",
  borderRadius: 14,
  border: "1px solid #d7e3f1",
  padding: 16,
};

const inputBase = {
  width: "100%",
  border: "1px solid #cfe0f1",
  borderRadius: 10,
  padding: "9px 10px",
  fontSize: 13,
  boxSizing: "border-box",
};

const buttonBase = {
  border: "1px solid #c5d9ee",
  background: "#f6fbff",
  color: "#17314f",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
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
    website_url: "",
    url_extension: "",
    billing_email: "",
    timezone: "America/New_York",
    contact_primary_name: "",
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

function initialDomainVisibilityForm() {
  const out = {};
  for (const d of DOMAIN_OPTIONS) out[d.key] = "public";
  return out;
}

function initialMapFeaturesForm() {
  return {
    show_boundary_border: true,
    shade_outside_boundary: true,
    outside_shade_opacity: "0.42",
  };
}

function sanitizeTenantKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function cleanOptional(value) {
  const v = String(value || "").trim();
  return v || null;
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

export default function PlatformAdminApp() {
  const tenant = useTenant();
  const [authReady, setAuthReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState("tenants");
  const [loading, setLoading] = useState(false);

  const [tenants, setTenants] = useState([]);
  const [tenantAdmins, setTenantAdmins] = useState([]);
  const [tenantFiles, setTenantFiles] = useState([]);
  const [auditRows, setAuditRows] = useState([]);

  const [tenantProfilesByTenant, setTenantProfilesByTenant] = useState({});
  const [tenantVisibilityByTenant, setTenantVisibilityByTenant] = useState({});
  const [tenantMapFeaturesByTenant, setTenantMapFeaturesByTenant] = useState({});

  const [selectedTenantKey, setSelectedTenantKey] = useState("ashtabulacity");

  const [tenantForm, setTenantForm] = useState(initialTenantForm);
  const [profileForm, setProfileForm] = useState(initialProfileForm);
  const [domainVisibilityForm, setDomainVisibilityForm] = useState(initialDomainVisibilityForm);
  const [mapFeaturesForm, setMapFeaturesForm] = useState(initialMapFeaturesForm);
  const [assignForm, setAssignForm] = useState({ tenant_key: "", user_id: "", role: "municipality_admin" });
  const [fileForm, setFileForm] = useState({ category: "contract", notes: "", file: null });

  const [status, setStatus] = useState({
    tenant: "",
    profile: "",
    users: "",
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

  const selectedTenantLiveUrl = useMemo(
    () => (selectedTenant ? makeLiveUrl(selectedTenant.primary_subdomain, selectedTenant.tenant_key) : ""),
    [selectedTenant]
  );

  const selectedTenantDevUrl = useMemo(
    () => (selectedTenant ? makeDevUrl(selectedTenant.tenant_key) : ""),
    [selectedTenant]
  );

  const logAudit = useCallback(async (payload) => {
    try {
      await supabase.from("tenant_audit_log").insert([
        {
          tenant_key: cleanOptional(payload?.tenant_key),
          actor_user_id: cleanOptional(sessionUserId),
          action: String(payload?.action || "").trim() || "unknown",
          entity_type: String(payload?.entity_type || "").trim() || "unknown",
          entity_id: cleanOptional(payload?.entity_id),
          details: payload?.details || {},
        },
      ]);
    } catch {
      // non-blocking
    }
  }, [sessionUserId]);

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
      .from("tenant_admins")
      .select("tenant_key,user_id,role,created_at")
      .order("tenant_key", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    setTenantAdmins(Array.isArray(data) ? data : []);
  }, []);

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
      .select("tenant_key,show_boundary_border,shade_outside_boundary,outside_shade_opacity");
    if (error) throw error;
    const next = {};
    for (const row of data || []) {
      const key = sanitizeTenantKey(row?.tenant_key);
      if (!key) continue;
      next[key] = {
        show_boundary_border: row?.show_boundary_border !== false,
        shade_outside_boundary: row?.shade_outside_boundary !== false,
        outside_shade_opacity: Number.isFinite(Number(row?.outside_shade_opacity))
          ? Number(row.outside_shade_opacity)
          : 0.42,
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

  const loadAudit = useCallback(async () => {
    const { data, error } = await supabase
      .from("tenant_audit_log")
      .select("id,tenant_key,actor_user_id,action,entity_type,entity_id,details,created_at")
      .order("created_at", { ascending: false })
      .limit(120);
    if (error) throw error;
    setAuditRows(Array.isArray(data) ? data : []);
  }, []);

  const refreshControlPlaneData = useCallback(async () => {
    setLoading(true);
    setStatus((prev) => ({ ...prev, hydrate: "Refreshing platform data..." }));
    try {
      await Promise.all([
        loadTenants(),
        loadTenantAdmins(),
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
  }, [loadTenants, loadTenantAdmins, loadTenantProfiles, loadTenantVisibility, loadTenantMapFeatures, loadAudit]);

  useEffect(() => {
    let mounted = true;
    const syncSession = (session) => {
      if (!mounted) return;
      const userId = String(session?.user?.id || "").trim();
      setSessionUserId(userId);
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
    setLoginPassword("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkPlatformAdmin() {
      if (!authReady || !sessionUserId) {
        setIsPlatformAdmin(false);
        return;
      }
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", sessionUserId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setIsPlatformAdmin(false);
        return;
      }
      setIsPlatformAdmin(Boolean(data?.user_id));
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
    const key = sanitizeTenantKey(selectedTenantKey);
    if (!key) return;

    const profile = tenantProfilesByTenant?.[key] || null;
    if (profile) {
      setProfileForm({
        organization_type: String(profile.organization_type || "municipality"),
        legal_name: String(profile.legal_name || ""),
        display_name: String(profile.display_name || ""),
        website_url: String(profile.website_url || ""),
        url_extension: String(profile.url_extension || ""),
        billing_email: String(profile.billing_email || ""),
        timezone: String(profile.timezone || "America/New_York"),
        contact_primary_name: String(profile.contact_primary_name || ""),
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
      });
    } else {
      setProfileForm(initialProfileForm());
    }

    const visibility = tenantVisibilityByTenant?.[key] || {};
    const nextVisibility = initialDomainVisibilityForm();
    for (const d of DOMAIN_OPTIONS) {
      const configured = String(visibility?.[d.key] || "").trim().toLowerCase();
      nextVisibility[d.key] = configured === "internal_only" ? "internal_only" : "public";
    }
    setDomainVisibilityForm(nextVisibility);

    const features = tenantMapFeaturesByTenant?.[key] || null;
    if (features) {
      setMapFeaturesForm({
        show_boundary_border: features.show_boundary_border !== false,
        shade_outside_boundary: features.shade_outside_boundary !== false,
        outside_shade_opacity: String(Number.isFinite(Number(features.outside_shade_opacity)) ? Number(features.outside_shade_opacity) : 0.42),
      });
    } else {
      setMapFeaturesForm(initialMapFeaturesForm());
    }

    void loadTenantFiles(key).catch((error) => {
      setStatus((prev) => ({ ...prev, files: statusText(error, "") }));
    });
  }, [selectedTenantKey, tenantProfilesByTenant, tenantVisibilityByTenant, tenantMapFeaturesByTenant, loadTenantFiles]);

  const saveTenant = useCallback(async (event) => {
    event.preventDefault();
    const payload = {
      tenant_key: sanitizeTenantKey(tenantForm.tenant_key),
      name: String(tenantForm.name || "").trim(),
      primary_subdomain: String(tenantForm.primary_subdomain || "").trim().toLowerCase(),
      boundary_config_key: String(tenantForm.boundary_config_key || "").trim(),
      notification_email_potholes: cleanOptional(tenantForm.notification_email_potholes),
      notification_email_water_drain: cleanOptional(tenantForm.notification_email_water_drain),
      is_pilot: Boolean(tenantForm.is_pilot),
      active: Boolean(tenantForm.active),
    };

    if (!payload.tenant_key || !payload.name || !payload.primary_subdomain || !payload.boundary_config_key) {
      setStatus((prev) => ({ ...prev, tenant: "Tenant key, name, primary subdomain, and boundary key are required." }));
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
    setTenantForm(initialTenantForm());
    setSelectedTenantKey(payload.tenant_key);
    await refreshControlPlaneData();
  }, [tenantForm, logAudit, refreshControlPlaneData]);

  const toggleTenantActive = useCallback(async (row) => {
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
  }, [logAudit, refreshControlPlaneData]);

  const saveTenantProfile = useCallback(async (event) => {
    event.preventDefault();
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
      website_url: cleanOptional(profileForm.website_url),
      url_extension: cleanOptional(profileForm.url_extension),
      billing_email: cleanOptional(profileForm.billing_email),
      timezone: String(profileForm.timezone || "America/New_York").trim() || "America/New_York",
      contact_primary_name: cleanOptional(profileForm.contact_primary_name),
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
    await refreshControlPlaneData();
  }, [selectedTenantKey, profileForm, logAudit, refreshControlPlaneData]);

  const saveDomainAndFeatureSettings = useCallback(async (event) => {
    event.preventDefault();
    const key = sanitizeTenantKey(selectedTenantKey);
    if (!key) {
      setStatus((prev) => ({ ...prev, domains: "Select a tenant first." }));
      return;
    }

    const visibilityRows = DOMAIN_OPTIONS.map((d) => ({
      tenant_key: key,
      domain: d.key,
      visibility: String(domainVisibilityForm?.[d.key] || "public").trim().toLowerCase() === "internal_only"
        ? "internal_only"
        : "public",
    }));

    const opacityRaw = Number(mapFeaturesForm?.outside_shade_opacity);
    const opacity = Number.isFinite(opacityRaw) ? Math.max(0, Math.min(1, opacityRaw)) : 0.42;
    const mapPayload = {
      tenant_key: key,
      show_boundary_border: Boolean(mapFeaturesForm?.show_boundary_border),
      shade_outside_boundary: Boolean(mapFeaturesForm?.shade_outside_boundary),
      outside_shade_opacity: opacity,
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
  }, [selectedTenantKey, domainVisibilityForm, mapFeaturesForm, logAudit, refreshControlPlaneData]);

  const assignTenantAdmin = useCallback(async (event) => {
    event.preventDefault();
    const tenant_key = sanitizeTenantKey(assignForm.tenant_key || selectedTenantKey);
    const user_id = String(assignForm.user_id || "").trim();
    const role = String(assignForm.role || "municipality_admin").trim() || "municipality_admin";

    if (!tenant_key || !user_id) {
      setStatus((prev) => ({ ...prev, users: "Tenant key and user UUID are required." }));
      return;
    }

    const { error } = await supabase
      .from("tenant_admins")
      .upsert([{ tenant_key, user_id, role }], { onConflict: "tenant_key,user_id" });
    if (error) {
      setStatus((prev) => ({ ...prev, users: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key,
      action: "tenant_admin_assigned",
      entity_type: "tenant_admin",
      entity_id: user_id,
      details: { role },
    });

    setStatus((prev) => ({ ...prev, users: `Assigned ${user_id} to ${tenant_key}.` }));
    setAssignForm({ tenant_key, user_id: "", role: "municipality_admin" });
    await refreshControlPlaneData();
  }, [assignForm, selectedTenantKey, logAudit, refreshControlPlaneData]);

  const removeTenantAdmin = useCallback(async (row) => {
    const tenant_key = sanitizeTenantKey(row?.tenant_key);
    const user_id = String(row?.user_id || "").trim();
    if (!tenant_key || !user_id) return;

    const { error } = await supabase
      .from("tenant_admins")
      .delete()
      .eq("tenant_key", tenant_key)
      .eq("user_id", user_id);
    if (error) {
      setStatus((prev) => ({ ...prev, users: statusText(error, "") }));
      return;
    }

    await logAudit({
      tenant_key,
      action: "tenant_admin_removed",
      entity_type: "tenant_admin",
      entity_id: user_id,
      details: {},
    });

    setStatus((prev) => ({ ...prev, users: `Removed ${user_id} from ${tenant_key}.` }));
    await refreshControlPlaneData();
  }, [logAudit, refreshControlPlaneData]);

  const uploadTenantFile = useCallback(async (event) => {
    event.preventDefault();
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

    setFileForm({ category: "contract", notes: "", file: null });
    setStatus((prev) => ({ ...prev, files: `Uploaded ${file.name}.` }));
    await loadTenantFiles(tenantKey);
    await loadAudit();
  }, [selectedTenantKey, fileForm, sessionUserId, logAudit, loadTenantFiles, loadAudit]);

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

  const removeTenantFile = useCallback(async (row) => {
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
  }, [logAudit, loadTenantFiles, loadAudit]);

  if (!authReady) {
    return (
      <main style={shell}>
        <section style={{ maxWidth: 1180, margin: "0 auto", ...card }}>
          <h1 style={{ marginTop: 0 }}>CityReport Platform Admin</h1>
          <p>Loading session...</p>
        </section>
      </main>
    );
  }

  if (!sessionUserId) {
    return (
      <main style={shell}>
        <section style={{ maxWidth: 1180, margin: "0 auto", ...card, display: "grid", gap: 10 }}>
          <h1 style={{ marginTop: 0 }}>CityReport Platform Admin</h1>
          <p style={{ margin: 0 }}>Sign in with a platform-admin account to access tenant controls.</p>
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
            <button type="submit" style={buttonBase} disabled={loginLoading}>
              {loginLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          {loginError ? <p style={{ margin: 0, color: "#b91c1c", fontSize: 12.5 }}>{loginError}</p> : null}
        </section>
      </main>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <main style={shell}>
        <section style={{ maxWidth: 1180, margin: "0 auto", ...card }}>
          <h1 style={{ marginTop: 0 }}>CityReport Platform Admin</h1>
          <p style={{ marginBottom: 0 }}>
            Access denied. This route is restricted to platform-admin users in `public.admins`.
          </p>
          <p style={{ marginBottom: 0, fontSize: 12.5 }}>
            Signed in as <b>{sessionUserId}</b>.
          </p>
          <div>
            <button type="button" style={buttonBase} onClick={() => void signOutPlatformAdmin()}>
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
            <h1 style={{ margin: 0 }}>CityReport Platform Control Plane</h1>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={buttonBase} onClick={() => void refreshControlPlaneData()}>
                Refresh
              </button>
              <button type="button" style={buttonBase} onClick={() => void signOutPlatformAdmin()}>
                Sign out
              </button>
            </div>
          </div>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Mode: <b>{tenant.mode}</b>. Signed in as <b>{sessionUserId}</b>.
          </p>
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
                    border: selected ? "1px solid #0f766e" : buttonBase.border,
                    background: selected ? "#0f766e" : buttonBase.background,
                    color: selected ? "white" : buttonBase.color,
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 260px) 1fr", gap: 8, alignItems: "center" }}>
            <select
              value={selectedTenantKey}
              onChange={(e) => setSelectedTenantKey(sanitizeTenantKey(e.target.value))}
              style={inputBase}
            >
              {tenantOptions.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
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
          {status.hydrate ? <div style={{ fontSize: 12.5, opacity: 0.82 }}>{status.hydrate}</div> : null}
        </header>

        {activeTab === "tenants" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0 }}>Create / Update Tenant</h2>
              <form onSubmit={saveTenant} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }}>
                <input value={tenantForm.tenant_key} onChange={(e) => setTenantForm((p) => ({ ...p, tenant_key: e.target.value }))} placeholder="tenant_key" style={inputBase} />
                <input value={tenantForm.name} onChange={(e) => setTenantForm((p) => ({ ...p, name: e.target.value }))} placeholder="Organization display name" style={inputBase} />
                <input value={tenantForm.primary_subdomain} onChange={(e) => setTenantForm((p) => ({ ...p, primary_subdomain: e.target.value }))} placeholder="primary_subdomain" style={inputBase} />
                <input value={tenantForm.boundary_config_key} onChange={(e) => setTenantForm((p) => ({ ...p, boundary_config_key: e.target.value }))} placeholder="boundary_config_key" style={inputBase} />
                <input value={tenantForm.notification_email_potholes} onChange={(e) => setTenantForm((p) => ({ ...p, notification_email_potholes: e.target.value }))} placeholder="notification_email_potholes" style={inputBase} />
                <input value={tenantForm.notification_email_water_drain} onChange={(e) => setTenantForm((p) => ({ ...p, notification_email_water_drain: e.target.value }))} placeholder="notification_email_water_drain" style={inputBase} />
                <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={tenantForm.is_pilot} onChange={(e) => setTenantForm((p) => ({ ...p, is_pilot: e.target.checked }))} /> Pilot
                </label>
                <label style={{ fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={tenantForm.active} onChange={(e) => setTenantForm((p) => ({ ...p, active: e.target.checked }))} /> Active
                </label>
                <button type="submit" style={{ ...buttonBase, gridColumn: "1 / -1" }}>Save Tenant</button>
              </form>
              {status.tenant ? <div style={{ fontSize: 12.5 }}>{status.tenant}</div> : null}
            </div>

            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0 }}>New Tenant Intake</h2>
              <form onSubmit={saveTenantProfile} style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(220px, 1fr))", gap: 8 }}>
                <input value={profileForm.legal_name} onChange={(e) => setProfileForm((p) => ({ ...p, legal_name: e.target.value }))} placeholder="Legal organization name" style={inputBase} />
                <input value={profileForm.display_name} onChange={(e) => setProfileForm((p) => ({ ...p, display_name: e.target.value }))} placeholder="Public display name" style={inputBase} />
                <input value={profileForm.contact_primary_name} onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_name: e.target.value }))} placeholder="Primary contact name" style={inputBase} />
                <input value={profileForm.contact_primary_email} onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_email: e.target.value }))} placeholder="Primary contact email" style={inputBase} />
                <input value={profileForm.contact_primary_phone} onChange={(e) => setProfileForm((p) => ({ ...p, contact_primary_phone: e.target.value }))} placeholder="Primary contact phone" style={inputBase} />
                <input value={profileForm.website_url} onChange={(e) => setProfileForm((p) => ({ ...p, website_url: e.target.value }))} placeholder="Website URL" style={inputBase} />
                <input value={profileForm.url_extension} onChange={(e) => setProfileForm((p) => ({ ...p, url_extension: e.target.value }))} placeholder="URL extension / slug" style={inputBase} />
                <input value={profileForm.billing_email} onChange={(e) => setProfileForm((p) => ({ ...p, billing_email: e.target.value }))} placeholder="Billing email" style={inputBase} />
                <input value={profileForm.contact_technical_name} onChange={(e) => setProfileForm((p) => ({ ...p, contact_technical_name: e.target.value }))} placeholder="Technical contact name" style={inputBase} />
                <input value={profileForm.contact_technical_email} onChange={(e) => setProfileForm((p) => ({ ...p, contact_technical_email: e.target.value }))} placeholder="Technical contact email" style={inputBase} />
                <input value={profileForm.contact_legal_name} onChange={(e) => setProfileForm((p) => ({ ...p, contact_legal_name: e.target.value }))} placeholder="Legal contact name" style={inputBase} />
                <input value={profileForm.contact_legal_email} onChange={(e) => setProfileForm((p) => ({ ...p, contact_legal_email: e.target.value }))} placeholder="Legal contact email" style={inputBase} />
                <select value={profileForm.contract_status} onChange={(e) => setProfileForm((p) => ({ ...p, contract_status: e.target.value }))} style={inputBase}>
                  <option value="pending">Contract: Pending</option>
                  <option value="active">Contract: Active</option>
                  <option value="paused">Contract: Paused</option>
                  <option value="expired">Contract: Expired</option>
                  <option value="terminated">Contract: Terminated</option>
                </select>
                <input type="date" value={profileForm.contract_start_date} onChange={(e) => setProfileForm((p) => ({ ...p, contract_start_date: e.target.value }))} style={inputBase} />
                <input type="date" value={profileForm.contract_end_date} onChange={(e) => setProfileForm((p) => ({ ...p, contract_end_date: e.target.value }))} style={inputBase} />
                <input type="date" value={profileForm.renewal_date} onChange={(e) => setProfileForm((p) => ({ ...p, renewal_date: e.target.value }))} style={inputBase} />
                <textarea value={profileForm.notes} onChange={(e) => setProfileForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Operational notes / onboarding notes" style={{ ...inputBase, minHeight: 90, gridColumn: "1 / -1" }} />
                <button type="submit" style={{ ...buttonBase, gridColumn: "1 / -1" }}>Save Intake Profile</button>
              </form>
              {status.profile ? <div style={{ fontSize: 12.5 }}>{status.profile}</div> : null}
            </div>

            <div style={{ ...card, display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0 }}>Tenants</h2>
              {loading ? <div style={{ fontSize: 12.5 }}>Loading...</div> : null}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Tenant</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Subdomain</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Boundary</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>State</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Shortcuts</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((row) => {
                      const liveUrl = makeLiveUrl(row?.primary_subdomain, row?.tenant_key);
                      const devUrl = makeDevUrl(row?.tenant_key);
                      return (
                        <tr key={row.tenant_key}>
                          <td style={{ padding: "8px 0" }}>{row.tenant_key}</td>
                          <td style={{ padding: "8px 0" }}>{row.primary_subdomain}</td>
                          <td style={{ padding: "8px 0" }}>{row.boundary_config_key}</td>
                          <td style={{ padding: "8px 0" }}>{row.active ? "active" : "inactive"}</td>
                          <td style={{ padding: "8px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <a href={liveUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonBase, textDecoration: "none" }}>Live</a>
                            <a href={devUrl} target="_blank" rel="noopener noreferrer" style={{ ...buttonBase, textDecoration: "none" }}>Dev</a>
                          </td>
                          <td style={{ padding: "8px 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" style={buttonBase} onClick={() => setSelectedTenantKey(row.tenant_key)}>Select</button>
                            <button type="button" style={buttonBase} onClick={() => setTenantForm({
                              tenant_key: row.tenant_key,
                              name: row.name,
                              primary_subdomain: row.primary_subdomain,
                              boundary_config_key: row.boundary_config_key,
                              notification_email_potholes: row.notification_email_potholes || "",
                              notification_email_water_drain: row.notification_email_water_drain || "",
                              is_pilot: Boolean(row.is_pilot),
                              active: Boolean(row.active),
                            })}>Edit</button>
                            <button type="button" style={buttonBase} onClick={() => void toggleTenantActive(row)}>
                              {row.active ? "Deactivate" : "Activate"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "users" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0 }}>Assign Municipality Admin</h2>
              <form onSubmit={assignTenantAdmin} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 2fr 1fr auto", gap: 8, alignItems: "center" }}>
                <input list="tenant-options" value={assignForm.tenant_key || selectedTenantKey} onChange={(e) => setAssignForm((p) => ({ ...p, tenant_key: e.target.value }))} placeholder="tenant_key" style={inputBase} />
                <datalist id="tenant-options">
                  {tenantOptions.map((key) => <option key={key} value={key} />)}
                </datalist>
                <input value={assignForm.user_id} onChange={(e) => setAssignForm((p) => ({ ...p, user_id: e.target.value }))} placeholder="auth.users UUID" style={inputBase} />
                <select value={assignForm.role} onChange={(e) => setAssignForm((p) => ({ ...p, role: e.target.value }))} style={inputBase}>
                  <option value="municipality_admin">municipality_admin</option>
                </select>
                <button type="submit" style={buttonBase}>Assign</button>
              </form>
              {status.users ? <div style={{ fontSize: 12.5 }}>{status.users}</div> : null}
            </div>

            <div style={{ ...card, display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0 }}>Tenant Admin Assignments</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Tenant</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>User</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Role</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Created</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantAdmins.map((row) => (
                      <tr key={`${row.tenant_key}:${row.user_id}`}>
                        <td style={{ padding: "8px 0" }}>{row.tenant_key}</td>
                        <td style={{ padding: "8px 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{row.user_id}</td>
                        <td style={{ padding: "8px 0" }}>{row.role}</td>
                        <td style={{ padding: "8px 0" }}>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                        <td style={{ padding: "8px 0" }}>
                          <button type="button" style={buttonBase} onClick={() => void removeTenantAdmin(row)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "domains" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0 }}>Domain Visibility + Map Features</h2>
              <form onSubmit={saveDomainAndFeatureSettings} style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(200px, 1fr))", gap: 8 }}>
                  {DOMAIN_OPTIONS.map((d) => (
                    <label key={d.key} style={{ display: "grid", gap: 5, border: "1px solid #d7e3f1", borderRadius: 10, padding: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 800 }}>{d.label}</span>
                      <select
                        value={domainVisibilityForm[d.key] || "public"}
                        onChange={(e) => setDomainVisibilityForm((prev) => ({ ...prev, [d.key]: e.target.value }))}
                        style={inputBase}
                      >
                        <option value="public">Public</option>
                        <option value="internal_only">Internal Only</option>
                      </select>
                    </label>
                  ))}
                </div>

                <div style={{ border: "1px solid #d7e3f1", borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
                  <div style={{ fontWeight: 900 }}>Map Feature Toggles ({selectedTenantKey})</div>
                  <label style={{ fontSize: 12.5, display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(mapFeaturesForm.show_boundary_border)}
                      onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, show_boundary_border: e.target.checked }))}
                    />
                    Show boundary border
                  </label>
                  <label style={{ fontSize: 12.5, display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(mapFeaturesForm.shade_outside_boundary)}
                      onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, shade_outside_boundary: e.target.checked }))}
                    />
                    Shade outside boundary
                  </label>
                  <label style={{ fontSize: 12.5, display: "grid", gap: 4, maxWidth: 240 }}>
                    <span>Outside shade opacity (0.0 - 1.0)</span>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={mapFeaturesForm.outside_shade_opacity}
                      onChange={(e) => setMapFeaturesForm((prev) => ({ ...prev, outside_shade_opacity: e.target.value }))}
                      style={inputBase}
                    />
                  </label>
                </div>

                <button type="submit" style={{ ...buttonBase, width: "fit-content" }}>Save Domains + Features</button>
              </form>
              {status.domains ? <div style={{ fontSize: 12.5 }}>{status.domains}</div> : null}
            </div>
          </section>
        ) : null}

        {activeTab === "files" ? (
          <section style={{ display: "grid", gap: 14 }}>
            <div style={{ ...card, display: "grid", gap: 10 }}>
              <h2 style={{ margin: 0 }}>Tenant Files</h2>
              <form onSubmit={uploadTenantFile} style={{ display: "grid", gridTemplateColumns: "220px 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                <select value={fileForm.category} onChange={(e) => setFileForm((p) => ({ ...p, category: e.target.value }))} style={inputBase}>
                  <option value="contract">Contract</option>
                  <option value="asset_coordinates">Asset Coordinates</option>
                  <option value="other">Other</option>
                </select>
                <input type="file" onChange={(e) => setFileForm((p) => ({ ...p, file: e.target.files?.[0] || null }))} style={inputBase} />
                <input value={fileForm.notes} onChange={(e) => setFileForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes" style={inputBase} />
                <button type="submit" style={buttonBase}>Upload</button>
              </form>
              {status.files ? <div style={{ fontSize: 12.5 }}>{status.files}</div> : null}
            </div>

            <div style={{ ...card, display: "grid", gap: 8 }}>
              <h2 style={{ margin: 0 }}>Files for {selectedTenantKey}</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Category</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Name</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Size</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Uploaded</th>
                      <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Actions</th>
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
                          <button type="button" style={buttonBase} onClick={() => void openTenantFile(row)}>Open (signed)</button>
                          <button type="button" style={buttonBase} onClick={() => void removeTenantFile(row)}>Remove</button>
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

        {activeTab === "audit" ? (
          <section style={{ ...card, display: "grid", gap: 8 }}>
            <h2 style={{ margin: 0 }}>Recent Platform Audit</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>When</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Tenant</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Action</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Entity</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", padding: "8px 0" }}>Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "8px 0" }}>{row.created_at ? new Date(row.created_at).toLocaleString() : "-"}</td>
                      <td style={{ padding: "8px 0" }}>{row.tenant_key || "-"}</td>
                      <td style={{ padding: "8px 0" }}>{row.action}</td>
                      <td style={{ padding: "8px 0" }}>{row.entity_type}:{row.entity_id || "-"}</td>
                      <td style={{ padding: "8px 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{row.actor_user_id || "-"}</td>
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
            {status.audit ? <div style={{ fontSize: 12.5 }}>{status.audit}</div> : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
