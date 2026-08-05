import { describe, expect, it } from "vitest";

import { createDeferredConfiguredIncidentStateRuntimeHelpers } from "../lib/mapDeferredConfiguredIncidentStateRuntime.js";
import { createConfiguredIncidentDomainSubmitSupportShared } from "../lib/mapDeferredReportSubmitSupport.js";

const incidentId = "11111111-1111-4111-8111-111111111111";
const createdAt = "2026-07-20T05:04:00.000Z";
const helper = {
  normalizeReportRecordMode: "report_record_with_lookup_ts",
  normalizeReportRecordIncidentIdField: "pothole_id",
  savedReportRecordIncidentIdField: "pothole_id",
};

describe("configured incident optimistic report state", () => {
  it("preserves the persisted creation time while building the optimistic row", () => {
    const support = createConfiguredIncidentDomainSubmitSupportShared({
      normalizeDomainKeyOrSlug: (value: string) => value,
      resolveIncidentDomainHelperEntry: () => ({ domainKey: "potholes", helper }),
    });

    expect(support.incidentDomainBuildSavedReportRecord("potholes", {
      insertedReportData: {
        id: "report-1",
        pothole_id: incidentId,
        created_at: createdAt,
        report_number: "PH-R0000115",
        lat: 41.61,
        lng: -80.82,
      },
    })).toMatchObject({
      id: "report-1",
      pothole_id: incidentId,
      created_at: createdAt,
      ts: Date.parse(createdAt),
    });
  });

  it("does not erase an optimistic timestamp when created_at is unavailable", () => {
    const runtime = createDeferredConfiguredIncidentStateRuntimeHelpers({
      getIncidentDomainHelper: () => helper,
      normalizeDomainKeyOrSlug: (value: string) => value,
    });
    const ts = Date.parse(createdAt);

    const rows = runtime.incidentDomainPrependConfiguredReportState("potholes", [], {
      id: "report-1",
      pothole_id: incidentId,
      ts,
      reporter_user_id: "user-1",
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "report-1",
      incident_id: incidentId,
      ts,
      reporter_user_id: "user-1",
    });
  });
});
