import { describe, expect, it, vi } from "vitest";

import { fetchResidentNotificationsSnapshot } from "../lib/mapResidentNotificationSupport.js";

function incidentNotificationQuery(result: unknown) {
  const query = {
    select: () => query,
    is: () => query,
    order: () => query,
    limit: () => query,
    eq: () => query,
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

describe("resident notification snapshot", () => {
  it("uses the public organization display name for every notification kind", async () => {
    const supabase = {
      rpc: vi.fn((name: string) => {
        if (name === "list_resident_notifications") {
          return Promise.resolve({
            data: [{
              id: 31,
              tenant_key: "testcity",
              tenant_label: "Internal test tenant name",
              kind: "alert",
              title: "Road closure",
              unread: true,
              created_at: "2026-08-04T12:00:00.000Z",
            }],
            error: null,
          });
        }
        return Promise.resolve({
          data: [{
            tenant_key: "testcity",
            tenant_label: "Test City",
            tenant_primary_subdomain: "testcity",
          }],
          error: null,
        });
      }),
      from: vi.fn(() => incidentNotificationQuery({
        data: [{
          id: 32,
          tenant_key: "testcity",
          incident_id: "incident-32",
          domain: "roads",
          title: "Report status updated",
          created_at: "2026-08-04T12:01:00.000Z",
          read_at: null,
        }],
        error: null,
      })),
    };

    const snapshot = await fetchResidentNotificationsSnapshot({
      supabase,
      tenantFilter: "testcity",
      communityFeedViewerKey: "resident-1",
      emptyMapCommunityFeedReadState: () => ({}),
      loadMapCommunityFeedReadState: () => ({}),
      isUnreadMapCommunityFeedItem: () => true,
      normalizeResidentNotificationKind: (kind: string) => kind,
    });

    expect(snapshot.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "alert", tenant_label: "Test City" }),
      expect.objectContaining({ kind: "report_update", tenant_label: "Test City" }),
    ]));
    expect(snapshot.locations).toEqual(expect.arrayContaining([
      expect.objectContaining({ tenantKey: "testcity", label: "Test City" }),
    ]));
  });
});
