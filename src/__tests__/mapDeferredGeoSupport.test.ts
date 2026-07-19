import { describe, expect, it, vi } from "vitest";

import {
  reverseGeocodeRoadLabelRuntimeShared,
  reverseGeocodeRoadLabelShared,
} from "../lib/mapDeferredGeoSupport.js";

describe("shared road validation", () => {
  it("uses the shared road function response for validation", async () => {
    const directFetch = vi.fn();
    const roadValidationRequest = vi.fn().mockResolvedValue({
      ok: true,
      snappedPoints: [
        { location: { latitude: 41.65, longitude: -80.83 } },
      ],
    });

    const result = await reverseGeocodeRoadLabelShared(
      41.65,
      -80.83,
      { useRoadsApi: true, validationOnly: true },
      {
        roadHitThresholdMeters: 5,
        roadValidationRequest,
        fetchImpl: directFetch,
      }
    );

    expect(roadValidationRequest).toHaveBeenCalledWith(41.65, -80.83);
    expect(directFetch).not.toHaveBeenCalled();
    expect(result.isRoad).toBe(true);
    expect(result.validationUnavailable).toBe(false);
  });

  it("reports validation unavailable when the shared function fails", async () => {
    const result = await reverseGeocodeRoadLabelShared(
      41.65,
      -80.83,
      { useRoadsApi: true, validationOnly: true },
      {
        roadValidationRequest: vi.fn().mockRejectedValue(new Error("offline")),
        fetchImpl: vi.fn(),
      }
    );

    expect(result.validationUnavailable).toBe(true);
  });

  it("sends the resolved tenant through the shared road-validation function", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        snappedPoints: [
          { location: { latitude: 41.65, longitude: -80.83 } },
        ],
      }),
    });

    const result = await reverseGeocodeRoadLabelRuntimeShared(
      41.65,
      -80.83,
      { useRoadsApi: true, validationOnly: true },
      { reverseGeocodeInFlightMap: new Map() },
      {
        roadValidationFunctionUrl: "https://example.supabase.co/functions/v1/validate-road",
        roadValidationPublishableKey: "publishable-key",
        roadValidationTenantKey: "testcity1",
        fetchImpl,
        windowLike: {},
      },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, request] = fetchImpl.mock.calls[0];
    expect(request.headers["x-tenant-key"]).toBe("testcity1");
    expect(JSON.parse(request.body)).toMatchObject({
      tenant_key: "testcity1",
      lat: 41.65,
      lng: -80.83,
    });
    expect(result.isRoad).toBe(true);
    expect(result.validationUnavailable).toBe(false);
  });

  it("falls back to the direct function request when the scoped invoke is unavailable", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const roadValidationRequest = vi.fn().mockRejectedValue(new Error("mobile transport failed"));
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        ok: true,
        snappedPoints: [
          { location: { latitude: 41.65, longitude: -80.83 } },
        ],
      }),
    });

    const result = await reverseGeocodeRoadLabelRuntimeShared(
      41.65,
      -80.83,
      { useRoadsApi: true, validationOnly: true },
      { reverseGeocodeInFlightMap: new Map() },
      {
        roadValidationRequest,
        roadValidationFunctionUrl: "https://example.supabase.co/functions/v1/validate-road",
        roadValidationPublishableKey: "publishable-key",
        roadValidationTenantKey: "testcity1",
        fetchImpl,
        windowLike: {},
      },
    );

    expect(roadValidationRequest).toHaveBeenCalledWith(41.65, -80.83);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.isRoad).toBe(true);
    expect(result.validationUnavailable).toBe(false);
    warning.mockRestore();
  });

  it("returns validation unavailable and logs the function response on HTTP failure", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      text: vi.fn().mockResolvedValue('{"error":"tenant_mismatch"}'),
    });

    const result = await reverseGeocodeRoadLabelRuntimeShared(
      41.65,
      -80.83,
      { useRoadsApi: true, validationOnly: true },
      { reverseGeocodeInFlightMap: new Map() },
      {
        roadValidationFunctionUrl: "https://example.supabase.co/functions/v1/validate-road",
        roadValidationPublishableKey: "publishable-key",
        roadValidationTenantKey: "testcity1",
        fetchImpl,
        windowLike: {},
      },
    );

    expect(result.validationUnavailable).toBe(true);
    expect(warning).toHaveBeenCalledWith(
      "[road-validation] function request failed",
      expect.objectContaining({ status: 409, tenantKey: "testcity1" }),
    );
    warning.mockRestore();
  });
});
