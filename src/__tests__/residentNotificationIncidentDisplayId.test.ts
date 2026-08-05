import { describe, expect, it } from "vitest";

import {
  residentNotificationDomainMapMarker,
  residentNotificationIncidentDisplayId,
} from "../lib/mapResidentNotificationSupport.js";

describe("resident notification incident identifiers", () => {
  it("uses the standard ten-digit public ID for potholes backed by UUIDs", () => {
    expect(residentNotificationIncidentDisplayId({
      domain: "potholes",
      incident_id: "pothole:1b44c85a-a6da-4e68-8b53-1b31975bd0fb",
    })).toMatch(/^PH\d{10}$/);
  });

  it("uses the matching domain map-marker presentation for report updates", () => {
    expect(residentNotificationDomainMapMarker({ domain: "water_drain_issues" })).toEqual(expect.objectContaining({
      domainKey: "water_drain_issues",
      iconSrc: "/water_main_icon.png",
      markerColor: "#0288d1",
    }));
  });
});
