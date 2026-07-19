import { describe, expect, it } from "vitest";

import {
  buildSubmittedIncidentMapRowShared,
  mergeSubmittedIncidentReportRowShared,
  upsertSubmittedIncidentBaseMarkerShared,
} from "../lib/mapIncidentSubmitMarkerSupport.js";

describe("incident submit marker support", () => {
  it("uses the validated submit target when the saved row omits coordinates", () => {
    const row = buildSubmittedIncidentMapRowShared({
      domainKey: "potholes",
      target: { domain: "potholes", lat: 41.61, lng: -80.82, lightId: "pothole:abc" },
      submittedReport: { id: "report-1", pothole_id: "abc", report_number: "PH-1" },
      submittedAt: 100,
    }, {
      normalizeDomainKey: (value: string) => value,
      resolveIncidentId: () => "pothole:abc",
    });

    expect(row).toMatchObject({
      id: "report-1",
      domain: "potholes",
      incident_id: "pothole:abc",
      lat: 41.61,
      lng: -80.82,
      ts: 100,
    });
  });

  it("replaces an existing submitted report instead of duplicating it", () => {
    const previous = [{ id: "report-1", incident_id: "incident-1", lat: 0, lng: 0, ts: 50 }];
    const submitted = { id: "report-1", incident_id: "incident-1", lat: 41.61, lng: -80.82, ts: 100 };

    expect(mergeSubmittedIncidentReportRowShared(previous, submitted)).toEqual([submitted]);
  });

  it("creates and increments the canonical marker immediately", () => {
    const first = { id: "report-1", domain: "graffiti", incident_id: "incident-1", lat: 41.61, lng: -80.82, ts: 100 };
    const second = { id: "report-2", domain: "graffiti", incident_id: "incident-1", lat: 41.62, lng: -80.83, ts: 200 };

    const created = upsertSubmittedIncidentBaseMarkerShared([], first);
    const updated = upsertSubmittedIncidentBaseMarkerShared(created, second);
    const deduped = upsertSubmittedIncidentBaseMarkerShared(updated, second);

    expect(created[0]).toMatchObject({ incident_id: "incident-1", count: 1 });
    expect(updated[0]).toMatchObject({ lat: 41.62, lng: -80.83, count: 2, lastTs: 200 });
    expect(deduped[0]).toMatchObject({ count: 2 });
    expect(deduped[0].rows).toHaveLength(2);
  });
});
