import { describe, expect, it, vi } from "vitest";

import { refreshDeferredBoundaryGeojsonShared } from "../lib/mapDeferredPublicMapFollowupSupport.js";

describe("deferred tenant boundary refresh", () => {
  it("replaces and caches the boundary after a successful refresh", async () => {
    const boundary = { type: "FeatureCollection", features: [] };
    const setCityBoundaryGeojson = vi.fn();
    const writeCachedTenantBoundaryGeojson = vi.fn();
    const setHydrationKey = vi.fn();

    const refreshed = await refreshDeferredBoundaryGeojsonShared({
      readClient: {},
      loadTenantKey: "testcity1",
      hydrationKey: "testcity1::1",
      fetchTenantBoundaryGeojson: vi.fn().mockResolvedValue({ geojson: boundary }),
      setCityBoundaryGeojson,
      setHydrationKey,
    }, {
      writeCachedTenantBoundaryGeojson,
    });

    expect(refreshed).toBe(true);
    expect(setCityBoundaryGeojson).toHaveBeenCalledWith(boundary);
    expect(writeCachedTenantBoundaryGeojson).toHaveBeenCalledWith("testcity1", boundary);
    expect(setHydrationKey).toHaveBeenCalledWith("testcity1::1");
  });

  it("preserves the rendered and cached boundary when a passive refresh is empty", async () => {
    const setCityBoundaryGeojson = vi.fn();
    const writeCachedTenantBoundaryGeojson = vi.fn();
    const clearCachedTenantBoundaryGeojson = vi.fn();
    const setHydrationKey = vi.fn();

    const refreshed = await refreshDeferredBoundaryGeojsonShared({
      readClient: {},
      loadTenantKey: "testcity1",
      hydrationKey: "testcity1::1",
      fetchTenantBoundaryGeojson: vi.fn().mockResolvedValue({ geojson: null }),
      setCityBoundaryGeojson,
      setHydrationKey,
    }, {
      writeCachedTenantBoundaryGeojson,
      clearCachedTenantBoundaryGeojson,
    });

    expect(refreshed).toBe(false);
    expect(setCityBoundaryGeojson).not.toHaveBeenCalled();
    expect(writeCachedTenantBoundaryGeojson).not.toHaveBeenCalled();
    expect(clearCachedTenantBoundaryGeojson).not.toHaveBeenCalled();
    expect(setHydrationKey).not.toHaveBeenCalled();
  });
});
