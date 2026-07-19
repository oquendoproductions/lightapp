import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MapLazyTenantRuntimeController from "../mapLazyTenantRuntimeController.jsx";

const from = vi.fn((table: string) => {
  const result = table === "tenant_map_features"
    ? {
        data: {
          show_boundary_border: true,
          shade_outside_boundary: true,
          show_alert_icon: true,
          show_event_icon: true,
          outside_shade_opacity: 0.42,
          boundary_border_color: "#2563eb",
          boundary_border_width: 3,
        },
        error: null,
      }
    : { data: [], error: null };
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve(result));
  query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return query;
});

const readClient = { from };

const stableProps = {
  loading: false,
  nonCriticalStartupReady: true,
  startupWarmupReady: true,
  tenantReady: true,
  sessionUserId: "user-1",
  resolvedTenantDomainConfigTenantKey: "testcity1",
  tenantScopedReadClient: readClient,
  supabase: readClient,
  enableTenantVisibilityConfig: true,
  setTenantVisibilityByDomain: vi.fn(),
  setTenantVisibilityLoaded: vi.fn(),
  resolvedTenantMapFeaturesTenantKey: "testcity1",
  authReady: true,
  activeTenantKey: vi.fn(() => "testcity1"),
  getSupabaseTenantKey: vi.fn(() => "testcity1"),
  createTenantScopedReadClient: vi.fn(() => readClient),
  defaultTenantMapFeatures: {
    show_boundary_border: true,
    shade_outside_boundary: true,
  },
  tenantMapFeaturesSourceRef: { current: "db-row" },
  setTenantMapFeatures: vi.fn(),
  setTenantMapFeaturesLoaded: vi.fn(),
  pushTenantBoundaryDiagnostic: vi.fn(),
  summarizeTenantMapFeaturesRow: vi.fn(),
  sessionAccessToken: "token",
  tenantTenantKey: "testcity1",
  tenantConfigTenantKey: "testcity1",
  shouldPrioritizeTenantParksLoad: false,
  tenantParksLoaded: true,
  loadTenantParksNow: vi.fn(),
};

describe("MapLazyTenantRuntimeController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not restart tenant configuration loads when map interaction changes", async () => {
    const { rerender } = render(
      <MapLazyTenantRuntimeController {...stableProps} mapInteracting={false} />,
    );

    await waitFor(() => {
      expect(from).toHaveBeenCalledWith("tenant_map_features");
      expect(from).toHaveBeenCalledWith("tenant_visibility_config");
    }, { timeout: 2000 });

    const fetchCountBeforeInteraction = from.mock.calls.length;

    rerender(<MapLazyTenantRuntimeController {...stableProps} mapInteracting />);
    rerender(<MapLazyTenantRuntimeController {...stableProps} mapInteracting={false} />);

    await new Promise((resolve) => window.setTimeout(resolve, 400));
    expect(from).toHaveBeenCalledTimes(fetchCountBeforeInteraction);
  });
});
