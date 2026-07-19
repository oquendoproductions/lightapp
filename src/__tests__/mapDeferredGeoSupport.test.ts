import { describe, expect, it, vi } from "vitest";

import { reverseGeocodeRoadLabelShared } from "../lib/mapDeferredGeoSupport.js";

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
});
