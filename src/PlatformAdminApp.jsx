import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import { useTenant } from "./tenant/useTenant";

const shell = {
  minHeight: "100vh",
  padding: "48px 20px",
  fontFamily: "Manrope, sans-serif",
  background: "#f4f8fd",
  color: "#17314f",
};

const card = {
  background: "white",
  borderRadius: 14,
  border: "1px solid #d7e3f1",
  padding: 18,
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

export default function PlatformAdminApp() {
  const tenant = useTenant();
  const [authReady, setAuthReady] = useState(false);
  const [sessionUserId, setSessionUserId] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [assignStatus, setAssignStatus] = useState("");
  const [tenantForm, setTenantForm] = useState(initialTenantForm);
  const [assignForm, setAssignForm] = useState({ tenant_key: "", user_id: "" });

  const tenantOptions = useMemo(
    () => (Array.isArray(tenants) ? tenants.map((t) => String(t?.tenant_key || "").trim()).filter(Boolean) : []),
    [tenants]
  );

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSessionUserId(String(data?.session?.user?.id || "").trim());
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
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
    let cancelled = false;
    async function loadTenants() {
      if (!isPlatformAdmin) return;
      setLoadingTenants(true);
      const { data, error } = await supabase
        .from("tenants")
        .select("tenant_key,name,primary_subdomain,boundary_config_key,notification_email_potholes,notification_email_water_drain,is_pilot,active,updated_at")
        .order("tenant_key", { ascending: true });
      if (cancelled) return;
      setLoadingTenants(false);
      if (error) {
        setSaveStatus(`Load failed: ${error.message || "unknown error"}`);
        return;
      }
      setTenants(Array.isArray(data) ? data : []);
    }
    loadTenants();
    return () => {
      cancelled = true;
    };
  }, [isPlatformAdmin]);

  async function saveTenant(event) {
    event.preventDefault();
    setSaveStatus("");

    const payload = {
      tenant_key: String(tenantForm.tenant_key || "").trim().toLowerCase(),
      name: String(tenantForm.name || "").trim(),
      primary_subdomain: String(tenantForm.primary_subdomain || "").trim().toLowerCase(),
      boundary_config_key: String(tenantForm.boundary_config_key || "").trim(),
      notification_email_potholes: String(tenantForm.notification_email_potholes || "").trim() || null,
      notification_email_water_drain: String(tenantForm.notification_email_water_drain || "").trim() || null,
      is_pilot: Boolean(tenantForm.is_pilot),
      active: Boolean(tenantForm.active),
    };

    if (!payload.tenant_key || !payload.name || !payload.primary_subdomain || !payload.boundary_config_key) {
      setSaveStatus("Tenant key, name, primary subdomain, and boundary key are required.");
      return;
    }

    const { error } = await supabase.from("tenants").upsert([payload], { onConflict: "tenant_key" });
    if (error) {
      setSaveStatus(`Save failed: ${error.message || "unknown error"}`);
      return;
    }

    setSaveStatus(`Saved tenant ${payload.tenant_key}.`);
    setTenantForm(initialTenantForm());

    const { data } = await supabase
      .from("tenants")
      .select("tenant_key,name,primary_subdomain,boundary_config_key,notification_email_potholes,notification_email_water_drain,is_pilot,active,updated_at")
      .order("tenant_key", { ascending: true });
    setTenants(Array.isArray(data) ? data : []);
  }

  async function assignTenantAdmin(event) {
    event.preventDefault();
    setAssignStatus("");
    const tenant_key = String(assignForm.tenant_key || "").trim().toLowerCase();
    const user_id = String(assignForm.user_id || "").trim();
    if (!tenant_key || !user_id) {
      setAssignStatus("Tenant key and user UUID are required.");
      return;
    }
    const { error } = await supabase.from("tenant_admins").upsert(
      [{
        tenant_key,
        user_id,
        role: "municipality_admin",
      }],
      { onConflict: "tenant_key,user_id" }
    );
    if (error) {
      setAssignStatus(`Assignment failed: ${error.message || "unknown error"}`);
      return;
    }
    setAssignStatus(`Assigned ${user_id} to ${tenant_key}.`);
    setAssignForm({ tenant_key: "", user_id: "" });
  }

  if (!authReady) {
    return (
      <main style={shell}>
        <section style={{ maxWidth: 900, margin: "0 auto" }}>
          <h1 style={{ marginTop: 0 }}>CityReport Platform Admin</h1>
          <p>Loading session...</p>
        </section>
      </main>
    );
  }

  if (!sessionUserId) {
    return (
      <main style={shell}>
        <section style={{ maxWidth: 900, margin: "0 auto", ...card }}>
          <h1 style={{ marginTop: 0 }}>CityReport Platform Admin</h1>
          <p style={{ marginBottom: 0 }}>Sign in with a platform-admin account to access tenant controls.</p>
        </section>
      </main>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <main style={shell}>
        <section style={{ maxWidth: 900, margin: "0 auto", ...card }}>
          <h1 style={{ marginTop: 0 }}>CityReport Platform Admin</h1>
          <p style={{ marginBottom: 0 }}>
            Access denied. This route is restricted to platform-admin users in `public.admins`.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={shell}>
      <section style={{ maxWidth: 980, margin: "0 auto", display: "grid", gap: 18 }}>
        <header style={card}>
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>CityReport Platform Admin</h1>
          <p style={{ margin: 0, opacity: 0.8 }}>
            Tenant control plane active. Mode: <b>{tenant.mode}</b>. Signed in as <b>{sessionUserId}</b>.
          </p>
        </header>

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Create / Update Tenant</h2>
          <form onSubmit={saveTenant} style={{ display: "grid", gap: 10 }}>
            <input
              value={tenantForm.tenant_key}
              onChange={(e) => setTenantForm((prev) => ({ ...prev, tenant_key: e.target.value }))}
              placeholder="tenant_key (example: ashtabulacity)"
            />
            <input
              value={tenantForm.name}
              onChange={(e) => setTenantForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="name"
            />
            <input
              value={tenantForm.primary_subdomain}
              onChange={(e) => setTenantForm((prev) => ({ ...prev, primary_subdomain: e.target.value }))}
              placeholder="primary_subdomain (example: ashtabulacity.cityreport.io)"
            />
            <input
              value={tenantForm.boundary_config_key}
              onChange={(e) => setTenantForm((prev) => ({ ...prev, boundary_config_key: e.target.value }))}
              placeholder="boundary_config_key (example: ashtabula_city_geojson)"
            />
            <input
              value={tenantForm.notification_email_potholes}
              onChange={(e) => setTenantForm((prev) => ({ ...prev, notification_email_potholes: e.target.value }))}
              placeholder="notification_email_potholes (optional)"
            />
            <input
              value={tenantForm.notification_email_water_drain}
              onChange={(e) => setTenantForm((prev) => ({ ...prev, notification_email_water_drain: e.target.value }))}
              placeholder="notification_email_water_drain (optional)"
            />
            <label>
              <input
                type="checkbox"
                checked={tenantForm.is_pilot}
                onChange={(e) => setTenantForm((prev) => ({ ...prev, is_pilot: e.target.checked }))}
              />
              Pilot tenant
            </label>
            <label>
              <input
                type="checkbox"
                checked={tenantForm.active}
                onChange={(e) => setTenantForm((prev) => ({ ...prev, active: e.target.checked }))}
              />
              Active
            </label>
            <button type="submit">Save tenant</button>
          </form>
          {saveStatus ? <p style={{ marginBottom: 0 }}>{saveStatus}</p> : null}
        </section>

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Assign Municipality Admin</h2>
          <form onSubmit={assignTenantAdmin} style={{ display: "grid", gap: 10 }}>
            <input
              list="tenant-options"
              value={assignForm.tenant_key}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, tenant_key: e.target.value }))}
              placeholder="tenant_key"
            />
            <datalist id="tenant-options">
              {tenantOptions.map((key) => (
                <option key={key} value={key} />
              ))}
            </datalist>
            <input
              value={assignForm.user_id}
              onChange={(e) => setAssignForm((prev) => ({ ...prev, user_id: e.target.value }))}
              placeholder="user_id (auth.users UUID)"
            />
            <button type="submit">Assign municipality admin</button>
          </form>
          {assignStatus ? <p style={{ marginBottom: 0 }}>{assignStatus}</p> : null}
        </section>

        <section style={card}>
          <h2 style={{ marginTop: 0 }}>Tenants</h2>
          {loadingTenants ? <p>Loading tenants...</p> : null}
          {!loadingTenants && tenants.length === 0 ? <p>No tenants found.</p> : null}
          {!loadingTenants && tenants.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", paddingBottom: 8 }}>Tenant</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", paddingBottom: 8 }}>Subdomain</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", paddingBottom: 8 }}>Boundary Key</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", paddingBottom: 8 }}>Pilot</th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #d7e3f1", paddingBottom: 8 }}>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((row) => (
                    <tr key={row.tenant_key}>
                      <td style={{ padding: "10px 0" }}>{row.tenant_key}</td>
                      <td style={{ padding: "10px 0" }}>{row.primary_subdomain}</td>
                      <td style={{ padding: "10px 0" }}>{row.boundary_config_key}</td>
                      <td style={{ padding: "10px 0" }}>{row.is_pilot ? "yes" : "no"}</td>
                      <td style={{ padding: "10px 0" }}>{row.active ? "yes" : "no"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
