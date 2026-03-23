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
  resetData: () => {},
}));

vi.mock("../supabaseClient", () => {
  const defaultData = () => ({
    tenants: [
      {
        tenant_key: "ashtabulacity",
        name: "Ashtabula City",
        primary_subdomain: "ashtabula",
        boundary_config_key: "ashtabulacity_city_geojson",
        notification_email_potholes: "roads@ashtabula.gov",
        notification_email_water_drain: "utilities@ashtabula.gov",
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
    ],
    tenant_role_permissions: [],
    tenant_profiles: [],
    tenant_visibility_config: [],
    tenant_map_features: [],
    tenant_files: [],
    tenant_audit_log: [],
    platform_user_roles: [
      {
        user_id: "owner-user-id",
        role: "platform_owner",
        status: "active",
      },
    ],
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
    filters: Array<{ column: string; value: unknown }>;
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
      this.filters.push({ column, value });
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
        this.filters.every(({ column, value }) => String(row?.[column] ?? "") === String(value ?? ""))
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
      invoke: vi.fn(async (_name: string, options?: { body?: any }) => {
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
    mockState.resetData();
  });

  async function openUsersAndAdmins() {
    const user = userEvent.setup();
    const { container } = render(<PlatformAdminApp />);

    await screen.findByRole("heading", { name: /platform control plane/i });

    await user.type(screen.getByPlaceholderText(/search tenants by name, key, or subdomain/i), "ashtabula");
    await user.click(await screen.findByRole("button", { name: /ashtabula city/i }));
    await user.selectOptions(screen.getByLabelText(/workspace section/i), "users");

    await screen.findByRole("heading", { name: /users and admins/i });
    return { user, container };
  }

  it("shows the person-first existing-account flow and hides UUIDs in search results", async () => {
    const { user, container } = await openUsersAndAdmins();

    expect(container.textContent?.indexOf("Find Person")).toBeLessThan(container.textContent?.indexOf("Tenant Role") ?? Infinity);

    await user.type(screen.getByPlaceholderText(/exact email, exact phone, or full name/i), "jordan.rivera@example.gov");
    await user.click(screen.getByRole("button", { name: /search accounts/i }));

    await screen.findByRole("button", { name: /jordan rivera/i });
    expect(screen.getByText(/jordan\.rivera@example\.gov/i)).toBeInTheDocument();
    expect(screen.queryByText("user-1")).not.toBeInTheDocument();
  });

  it("shows assignment names with edit controls and can return to Start Here from the logo", async () => {
    const { user } = await openUsersAndAdmins();

    await screen.findByText("Jordan Rivera");
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
    expect(screen.queryByText("user-1")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/return to start here/i));

    await screen.findByRole("heading", { name: /start here/i });
    expect(screen.getByPlaceholderText(/search tenants by name, key, or subdomain/i)).toBeInTheDocument();
  });

  it("updates a tenant role with plain-language status messaging", async () => {
    const { user } = await openUsersAndAdmins();

    const assignmentCell = await screen.findByText("Jordan Rivera", { selector: "td" });
    const assignmentRow = assignmentCell.closest("tr");
    expect(assignmentRow).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /edit/i }));
    await user.selectOptions(within(assignmentRow as HTMLTableRowElement).getByRole("combobox"), "tenant_admin");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText(/updated jordan rivera to tenant admin\./i)).toBeInTheDocument();
    });
  });
});
