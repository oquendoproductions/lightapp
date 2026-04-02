import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformAdminApp from "../PlatformAdminApp";

const mockState = vi.hoisted(() => ({
  sessionUser: {
    id: "owner-user-id",
    email: "owner@cityreport.io",
    user_metadata: {
      full_name: "Owner Person",
    },
  },
  platformUsers: [],
  invokeMock: vi.fn(),
  resetData: () => {},
}));

vi.mock("../supabaseClient", () => {
  const platformPermissionKeys = [
    "account.access",
    "organizations.access",
    "organizations.edit",
    "organizations.delete",
    "leads.access",
    "leads.edit",
    "users.access",
    "users.edit",
    "users.delete",
    "roles.access",
    "roles.edit",
    "roles.delete",
    "security.access",
    "reports.access",
    "finance.access",
    "domains.access",
    "domains.edit",
    "files.access",
    "files.edit",
    "audit.access",
  ];

  const defaultData = () => ({
    tenants: [
      {
        tenant_key: "ashtabulacity",
        name: "Ashtabula City",
        primary_subdomain: "ashtabula",
        boundary_config_key: "ashtabulacity_city_geojson",
        notification_email_potholes: "roads@ashtabula.gov",
        notification_email_water_drain: "utilities@ashtabula.gov",
        resident_portal_enabled: false,
        is_pilot: true,
        active: true,
      },
    ],
    tenant_user_roles: [
      {
        tenant_key: "ashtabulacity",
        user_id: "user-1",
        role: "tenant_employee",
        status: "active",
        created_at: "2026-03-22T12:00:00.000Z",
      },
    ],
    tenant_role_definitions: [
      {
        tenant_key: "ashtabulacity",
        role: "tenant_admin",
        role_label: "Tenant Admin",
        is_system: true,
        active: true,
      },
      {
        tenant_key: "ashtabulacity",
        role: "tenant_employee",
        role_label: "Tenant Employee",
        is_system: true,
        active: true,
      },
      {
        tenant_key: "ashtabulacity",
        role: "field_supervisor",
        role_label: "Field Supervisor",
        is_system: false,
        active: true,
      },
    ],
    tenant_role_permissions: [],
    tenant_profiles: [],
    tenant_visibility_config: [],
    tenant_map_features: [],
    tenant_files: [],
    tenant_audit_log: [],
    client_leads: [
      {
        id: "lead-1",
        lead_number: "LD0001",
        created_at: "2026-04-01T13:00:00.000Z",
        full_name: "Morgan Lee",
        work_email: "morgan.lee@example.gov",
        city_agency: "Ashtabula Public Works",
        role_title: "Operations Director",
        priority_domain: "streetlights",
        notes: "Interested in pilot rollout.",
        status: "new",
        internal_notes: "",
        follow_up_on: null,
        last_follow_up_at: null,
        updated_at: "2026-04-01T13:00:00.000Z",
      },
    ],
    platform_user_roles: [
      {
        user_id: "owner-user-id",
        role: "platform_owner",
        status: "active",
        updated_at: "2026-04-02T09:00:00.000Z",
      },
      {
        user_id: "user-2",
        role: "platform_staff",
        status: "active",
        updated_at: "2026-04-01T09:00:00.000Z",
      },
    ],
    platform_role_definitions: [
      {
        role: "platform_owner",
        role_label: "Platform Owner",
        is_system: true,
        active: true,
      },
      {
        role: "platform_staff",
        role_label: "Platform Staff",
        is_system: true,
        active: true,
      },
    ],
    platform_role_permissions: platformPermissionKeys.flatMap((permission_key) => ([
      {
        role: "platform_owner",
        permission_key,
        allowed: true,
      },
      {
        role: "platform_staff",
        permission_key,
        allowed: [
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
        ].includes(permission_key),
      },
    ])),
    platform_permissions_catalog: platformPermissionKeys.map((permission_key, index) => {
      const [module_key, action_key] = permission_key.split(".");
      return {
        permission_key,
        module_key,
        action_key,
        label: permission_key,
        sort_order: index + 1,
      };
    }),
    admins: [],
  });

  let data = defaultData();

  mockState.platformUsers = [
    {
      id: "user-1",
      email: "jordan.rivera@example.gov",
      phone: "(555) 555-0101",
      user_metadata: {
        first_name: "Jordan",
        last_name: "Rivera",
        full_name: "Jordan Rivera",
      },
    },
    {
      id: "user-2",
      email: "alex.chen@example.gov",
      phone: "(555) 555-0102",
      user_metadata: {
        first_name: "Alex",
        last_name: "Chen",
        full_name: "Alex Chen",
      },
    },
  ];

  mockState.resetData = () => {
    data = defaultData();
    mockState.invokeMock.mockClear();
  };

  const normalizeText = (value: unknown) => String(value || "").trim().replace(/\s+/g, " ");
  const normalizeEmail = (value: unknown) => normalizeText(value).toLowerCase();
  const normalizePhone = (value: unknown) => String(value || "").replace(/\D/g, "");
  const buildUserDisplayName = (user: any) => {
    const meta = user?.user_metadata || {};
    const fullName = normalizeText(meta.full_name || meta.name || [meta.first_name, meta.last_name].filter(Boolean).join(" "));
    if (fullName) return fullName;
    if (user?.email) return String(user.email).split("@")[0];
    return String(user?.id || "").trim();
  };
  const toUserSummary = (user: any) => ({
    id: String(user?.id || "").trim(),
    display_name: buildUserDisplayName(user),
    email: normalizeEmail(user?.email),
    phone: String(user?.phone || "").trim(),
  });

  class QueryBuilder {
    table: string;
    action: "select" | "delete";
    filters: Array<{ column: string; value: unknown; op?: "eq" | "in" }>;
    maybeSingleResult: boolean;
    limitCount: number | null;

    constructor(table: string) {
      this.table = table;
      this.action = "select";
      this.filters = [];
      this.maybeSingleResult = false;
      this.limitCount = null;
    }

    select() {
      this.action = "select";
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push({ column, value, op: "eq" });
      return this;
    }

    in(column: string, values: unknown[]) {
      this.filters.push({ column, value: values, op: "in" });
      return this;
    }

    order() {
      return this;
    }

    limit(value: number) {
      this.limitCount = value;
      return this;
    }

    maybeSingle() {
      this.maybeSingleResult = true;
      return this;
    }

    delete() {
      this.action = "delete";
      return this;
    }

    insert(rows: any[]) {
      const existing = Array.isArray((data as Record<string, unknown[]>)[this.table])
        ? ([...(data as Record<string, unknown[]>)[this.table]] as any[])
        : [];
      (data as Record<string, unknown[]>)[this.table] = [...existing, ...rows];
      return Promise.resolve({ data: rows, error: null });
    }

    upsert(rows: any[], options?: { onConflict?: string }) {
      const existing = Array.isArray((data as Record<string, unknown[]>)[this.table])
        ? ([...(data as Record<string, unknown[]>)[this.table]] as any[])
        : [];
      const conflictKeys = String(options?.onConflict || "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      for (const row of rows) {
        if (!conflictKeys.length) {
          existing.push(row);
          continue;
        }
        const index = existing.findIndex((candidate) =>
          conflictKeys.every((key) => String(candidate?.[key] ?? "") === String(row?.[key] ?? ""))
        );
        if (index >= 0) existing[index] = { ...existing[index], ...row };
        else existing.push(row);
      }

      (data as Record<string, unknown[]>)[this.table] = existing;
      return Promise.resolve({ data: rows, error: null });
    }

    async execute() {
      const tableRows = Array.isArray((data as Record<string, unknown[]>)[this.table])
        ? ([...(data as Record<string, unknown[]>)[this.table]] as any[])
        : [];

      if (this.action === "delete") {
        const kept = tableRows.filter((row) =>
          !this.filters.every(({ column, value }) => String(row?.[column] ?? "") === String(value ?? ""))
        );
        (data as Record<string, unknown[]>)[this.table] = kept;
        return { data: [], error: null };
      }

      let rows = tableRows.filter((row) =>
        this.filters.every(({ column, value, op }) => {
          if (op === "in") {
            const allowed = Array.isArray(value) ? value.map((entry) => String(entry ?? "")) : [];
            return allowed.includes(String(row?.[column] ?? ""));
          }
          return String(row?.[column] ?? "") === String(value ?? "");
        })
      );

      if (typeof this.limitCount === "number") {
        rows = rows.slice(0, this.limitCount);
      }

      if (this.maybeSingleResult) {
        return { data: rows[0] || null, error: null };
      }

      return { data: rows, error: null };
    }

    then(resolve: (value: any) => void, reject?: (reason?: unknown) => void) {
      return this.execute().then(resolve, reject);
    }
  }

  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            user: mockState.sessionUser,
            access_token: "platform-session-token",
          },
        },
      })),
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: vi.fn(),
          },
        },
      })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    },
    from: vi.fn((table: string) => new QueryBuilder(table)),
    rpc: vi.fn(async () => ({ data: [], error: null })),
    functions: {
      invoke: mockState.invokeMock.mockImplementation(async (_name: string, options?: { body?: any; headers?: Record<string, string> }) => {
        const action = String(options?.body?.action || "").trim().toLowerCase();

        if (action === "search") {
          const rawQuery = normalizeText(options?.body?.query);
          const query = rawQuery.toLowerCase();
          const phoneDigits = normalizePhone(options?.body?.query);
          const isEmailQuery = query.includes("@");
          const isPhoneQuery = phoneDigits.length >= 7;

          const results = mockState.platformUsers
            .filter((user) => {
              const displayName = buildUserDisplayName(user).toLowerCase();
              const email = normalizeEmail(user.email);
              const phone = normalizePhone(user.phone);
              if (isEmailQuery) return email === query;
              if (isPhoneQuery) return phone === phoneDigits;
              return displayName === query;
            })
            .map(toUserSummary);

          return { data: { ok: true, results }, error: null };
        }

        if (action === "lookup_users") {
          const ids = new Set(
            Array.isArray(options?.body?.user_ids)
              ? options.body.user_ids.map((value: unknown) => String(value || "").trim()).filter(Boolean)
              : []
          );

          const results = mockState.platformUsers
            .filter((user) => ids.has(String(user.id || "").trim()))
            .map(toUserSummary);

          return { data: { ok: true, results }, error: null };
        }

        if (action === "invite_and_assign") {
          const createdUser = {
            id: "user-3",
            email: normalizeEmail(options?.body?.email),
            phone: String(options?.body?.phone || "").trim(),
            user_metadata: {
              first_name: String(options?.body?.first_name || "").trim(),
              last_name: String(options?.body?.last_name || "").trim(),
              full_name: normalizeText(`${options?.body?.first_name || ""} ${options?.body?.last_name || ""}`),
            },
          };
          mockState.platformUsers.push(createdUser);
          return {
            data: {
              ok: true,
              inviteSent: true,
              user: toUserSummary(createdUser),
            },
            error: null,
          };
        }

        return { data: { ok: true }, error: null };
      }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ data: null, error: null })),
        createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://example.com/file" }, error: null })),
        remove: vi.fn(async () => ({ data: null, error: null })),
      })),
    },
  };

  return { supabase };
});

describe("PlatformAdminApp", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    mockState.resetData();
  });

  async function openUsersAndAdmins() {
    const user = userEvent.setup();
    const { container } = render(<PlatformAdminApp />);

    await screen.findByRole("heading", { name: /organization reports/i });
    await user.click(screen.getByRole("button", { name: /manage organizations/i }));
    await screen.findByRole("heading", { name: /start here/i });

    await user.type(screen.getByPlaceholderText(/search organizations by name, key, or subdomain/i), "ashtabula");
    await user.click(await screen.findByRole("button", { name: /ashtabula city/i }));
    await user.selectOptions(screen.getByLabelText(/workspace section/i), "users");

    await screen.findByRole("heading", { name: /current organization users and admins/i });
    await user.click(screen.getByRole("button", { name: /add user\/admin/i }));
    await screen.findByRole("heading", { name: /add user\/admin/i });
    return { user, container };
  }

  async function openRolesAndPermissions() {
    const user = userEvent.setup();
    render(<PlatformAdminApp />);

    await screen.findByRole("heading", { name: /organization reports/i });
    await user.click(screen.getByRole("button", { name: /manage organizations/i }));
    await screen.findByRole("heading", { name: /start here/i });

    await user.type(screen.getByPlaceholderText(/search organizations by name, key, or subdomain/i), "ashtabula");
    await user.click(await screen.findByRole("button", { name: /ashtabula city/i }));
    await user.selectOptions(screen.getByLabelText(/workspace section/i), "roles");

    await screen.findByRole("heading", { name: /roles and permissions/i });
    return { user };
  }

  async function openManageTeam() {
    const user = userEvent.setup();
    window.history.replaceState({}, "", "/?pcp_section=settings&pcp_page=manage-team");
    render(<PlatformAdminApp />);

    await screen.findByRole("heading", { name: /current platform team/i });
    return { user };
  }

  it("shows the person-first existing-account flow and hides UUIDs in search results", async () => {
    const { user, container } = await openUsersAndAdmins();

    expect(container.textContent?.indexOf("Find Person")).toBeLessThan(container.textContent?.indexOf("Organization Role") ?? Infinity);

    await user.type(screen.getByRole("textbox", { name: /find person/i }), "jordan.rivera@example.gov");
    await user.click(screen.getByRole("button", { name: /search accounts/i }));

    await screen.findByRole("button", { name: /jordan rivera/i });
    expect(screen.getByText(/jordan\.rivera@example\.gov/i)).toBeInTheDocument();
    expect(screen.queryByText("user-1")).not.toBeInTheDocument();
    expect(mockState.invokeMock).toHaveBeenLastCalledWith(
      "platform-user-admin",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer platform-session-token",
        }),
      })
    );
  });

  it("shows assignment names with edit controls and can return to Start Here from the logo", async () => {
    const { user } = await openUsersAndAdmins();

    const assignmentCell = await screen.findByText("Jordan Rivera", { selector: "td" });
    const assignmentRow = assignmentCell.closest("tr");
    expect(assignmentRow).not.toBeNull();
    expect(within(assignmentRow as HTMLTableRowElement).getByRole("button", { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.queryByText("user-1")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/return to start here/i));

    await screen.findByRole("heading", { name: /organization reports/i });
    expect(screen.getByText(/platform-wide organization coverage/i)).toBeInTheDocument();
  });

  it("updates a tenant role with plain-language status messaging", async () => {
    const { user } = await openUsersAndAdmins();

    const assignmentCell = await screen.findByText("Jordan Rivera", { selector: "td" });
    const assignmentRow = assignmentCell.closest("tr");
    expect(assignmentRow).not.toBeNull();

    await user.click(within(assignmentRow as HTMLTableRowElement).getByRole("button", { name: /^edit$/i }));
    await user.selectOptions(within(assignmentRow as HTMLTableRowElement).getByRole("combobox"), "tenant_admin");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(
        screen.getAllByText((_, node) => String(node?.textContent || "").includes("Updated Jordan Rivera to Organization Admin.")).length
      ).toBeGreaterThan(0);
    });
  });

  it("shows tenant hub launch labels in the workspace header", async () => {
    await openUsersAndAdmins();

    expect(screen.getByRole("link", { name: /open organization hub/i })).toBeInTheDocument();
  });

  it("shows stored chronological lead codes in manage leads", async () => {
    const user = userEvent.setup();
    render(<PlatformAdminApp />);

    await screen.findByRole("heading", { name: /organization reports/i });
    await user.click(screen.getByRole("button", { name: /manage leads/i }));

    await screen.findByRole("heading", { name: /manage leads/i });
    expect(screen.getAllByText("LD0001").length).toBeGreaterThan(0);
  });

  it("restores the current tenant workspace after refresh-style reload", async () => {
    window.history.replaceState(
      {},
      "",
      "/?pcp_section=organizations&pcp_page=manage-organizations&pcp_entry=tenant&pcp_tenant=ashtabulacity&pcp_tab=roles"
    );

    render(<PlatformAdminApp />);

    await screen.findByRole("heading", { name: /manage organizations/i });
    expect(screen.getByLabelText(/workspace section/i)).toHaveValue("roles");
    expect(screen.getByText(/choose role/i)).toBeInTheDocument();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(1);
  });

  it("shows a confirmation popup before deleting a custom role", async () => {
    const { user } = await openRolesAndPermissions();

    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects[1], "field_supervisor");
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    await user.click(screen.getByRole("button", { name: /delete role/i }));

    await screen.findByRole("heading", { name: /delete role/i });
    expect(screen.getByText(/remove field supervisor from this organization\?/i)).toBeInTheDocument();
    expect(screen.getByText(/role key:/i)).toBeInTheDocument();
  });

  it("shows add team member in the current platform team section", async () => {
    await openManageTeam();

    expect(screen.getByRole("button", { name: /add team member/i })).toBeInTheDocument();
  });

  it("walks through add tenant as a step-by-step wizard", async () => {
    const user = userEvent.setup();
    render(<PlatformAdminApp />);

    await screen.findByRole("heading", { name: /organization reports/i });
    await user.click(screen.getByRole("button", { name: /manage organizations/i }));
    await screen.findByRole("heading", { name: /start here/i });
    await user.click(screen.getAllByRole("button", { name: /^add organization$/i })[0]);

    await screen.findByRole("heading", { name: /organization information/i });
    expect(screen.getByText(/1\. organization contact information/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next: contacts/i }));

    await screen.findByRole("heading", { name: /primary \+ additional contacts/i });
    await user.click(screen.getByRole("button", { name: /next: basic setup/i }));

    await screen.findByRole("heading", { name: /basic setup/i });
    expect(screen.getByRole("button", { name: /create organization/i })).toBeInTheDocument();
  });
});
