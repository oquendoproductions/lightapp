import { describe, expect, it } from "vitest";

import {
  summarizeCanonicalIncidentMarkersInViewportShared,
} from "../lib/mapIncidentMarkerSourceSupport.js";

describe("summarizeCanonicalIncidentMarkersInViewportShared", () => {
  it("counts each canonical incident coordinate instead of a cluster container", () => {
    const markers = [
      { domain: "potholes", incident_id: "PH-1", lat: 41.1, lng: -80.1 },
      { domain: "potholes", incident_id: "PH-2", lat: 41.2, lng: -80.2 },
      { domain: "street_signs", incident_id: "SS-1", lat: 42.1, lng: -81.1 },
    ];

    const summary = summarizeCanonicalIncidentMarkersInViewportShared(markers, {
      isPointVisible: (lat: number) => lat < 42,
    });

    expect(summary.count).toBe(2);
    expect(summary.byDomain).toEqual({ potholes: 2 });
    expect(summary.incidentIdsByDomain).toEqual({ potholes: ["PH-1", "PH-2"] });
  });
});
