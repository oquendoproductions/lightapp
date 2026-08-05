import { describe, expect, it, vi } from "vitest";

import { submitConfiguredCustomIncidentDomainReportFlowShared } from "../lib/mapDeferredReportSubmitSupport.js";

function neverSettles() {
  return new Promise(() => {});
}

describe("configured incident submit timing", () => {
  it("commits a persisted pothole before post-save maintenance finishes", async () => {
    const events: string[] = [];
    const incidentId = "11111111-1111-4111-8111-111111111111";
    const createdAt = "2026-07-19T20:00:00.000Z";
    const report = {
      id: "report-1",
      pothole_id: incidentId,
      lat: 41.61,
      lng: -80.82,
      note: "test",
      report_number: "PH-R0000001",
      created_at: createdAt,
    };

    const submission = submitConfiguredCustomIncidentDomainReportFlowShared("potholes", {
      target: { domain: "potholes", domainLabel: "Potholes", lat: 41.61, lng: -80.82 },
      serviceSubmitFirst: true,
      isAuthed: true,
      session: { user: { id: "user-1" } },
      name: "Test User",
      email: "test@example.com",
      getInitialIncidentId: () => "",
      getInitialExternalId: () => "",
      buildFallbackExternalId: () => "PH4161000808200",
      assignReportPayloadIncidentId: (payload: Record<string, unknown>, value: string) => {
        payload.pothole_id = value;
      },
    }, {
      normalizeDomainKeyOrSlug: (value: string) => value,
      prepareDomainSubmitGeoAndImage: async () => ({
        submitGeo: { nearestAddress: "1 Main St" },
        imageUrl: "",
        submitLat: 41.61,
        submitLng: -80.82,
      }),
      incidentDomainBuildSubmitAliasContext: (_domain: string, context: object) => context,
      incidentDomainBuildSubmitReportPayload: () => ({ note: "test" }),
      incidentDomainBuildServiceSubmitPayload: () => ({}),
      incidentDomainApplyServiceSubmitResult: (_domain: string, context: any) => ({
        seeded: context.result.data.seeded,
        report: context.result.data.report,
        incidentId,
        externalId: "PH4161000808200",
      }),
      incidentDomainNormalizeConfiguredServiceSubmitResult: (_domain: string, result: object) => result,
      incidentDomainResolveNearbySubmitIncident: () => null,
      incidentDomainNormalizeConfiguredNearbySubmitResult: () => ({ incidentId: "", externalId: "" }),
      incidentDomainBuildRepeatGuardContext: () => ({ incidentId }),
      incidentDomainAllowsRepeatAfterArchive: () => false,
      getIncidentRepairSnapshot: () => null,
      canIdentityReportLight: () => true,
      openNotice: vi.fn(),
      incidentDomainAlreadyReportedMessage: () => "Already reported",
      activeTenantKey: () => "testcity1",
      incidentDomainServiceSubmitFunctionName: () => "submit-domain-report",
      insertConfiguredIncidentDomainSeededWithFallback: vi.fn(),
      incidentDomainBuildLocationInsertPayload: () => ({}),
      incidentDomainShouldUseServiceSubmitFallback: () => false,
      incidentDomainCommitConfiguredInsertedLocation: () => ({
        resolvedIds: { incidentId, externalId: "PH4161000808200" },
      }),
      incidentDomainNormalizeConfiguredInsertedLocationCommit: (_domain: string, commit: any) => ({
        incidentId: commit.resolvedIds.incidentId,
        externalId: commit.resolvedIds.externalId,
      }),
      incidentDomainBuildLocationCacheEntryPayload: () => {
        events.push("cache-started");
        return neverSettles();
      },
      persistConfiguredIncidentDomainSubmitGeoCache: vi.fn(),
      insertConfiguredIncidentDomainReportWithFallback: vi.fn(),
      incidentDomainCommitConfiguredSavedReport: () => ({
        saved: {
          ...report,
          incident_id: incidentId,
          light_id: incidentId,
          ts: Date.parse(createdAt),
        },
        successReportNumbers: [report.report_number],
        successSubmittedAt: Date.parse(createdAt),
      }),
      incidentDomainQueueConfiguredSubmitLocationEnrichment: () => neverSettles(),
      refreshIncidentRepairProgress: () => neverSettles(),
      dispatchDomainSubmitEmailNotice: async () => ({ ok: true }),
      runtimeDomainMeta: {},
      visibleDomainOptions: [],
      notifyAsyncEmailDelivery: vi.fn(),
      onPersistedReport: (payload: any) => {
        events.push("marker-committed");
        expect(payload.submittedReport).toMatchObject({
          incident_id: incidentId,
          domain: "potholes",
          lat: 41.61,
          lng: -80.82,
        });
      },
      supabase: {
        functions: {
          invoke: async () => ({
            data: {
              ok: true,
              seeded: { id: incidentId, ph_id: "PH4161000808200", lat: 41.61, lng: -80.82 },
              report,
            },
            error: null,
          }),
        },
      },
    });

    const result = await Promise.race([
      submission,
      new Promise((_, reject) => setTimeout(() => reject(new Error("submission stayed blocked")), 100)),
    ]);

    expect(result).toMatchObject({ persistedSubmission: true });
    expect(events[0]).toBe("marker-committed");
  });
});
