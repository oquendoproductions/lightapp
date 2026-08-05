import { describe, expect, it } from "vitest";

import {
  applyLoadedConfiguredIncidentDomainStateShared,
  mergeLoadedConfiguredIncidentRowsShared,
} from "../lib/mapDeferredConfiguredIncidentDataSupport.js";

describe("configured incident data refresh", () => {
  it("preserves a fresh local commit missing from a stale response", () => {
    const nowTs = 1_000_000;
    const local = {
      id: "fresh-report",
      __cityreport_local_commit_ts: nowTs - 100,
    };
    const loaded = [{ id: "existing-report" }];

    expect(mergeLoadedConfiguredIncidentRowsShared(loaded, [local], { nowTs })).toEqual([
      local,
      loaded[0],
    ]);
  });

  it("allows a later authoritative response to replace expired local-only rows", () => {
    const local = {
      id: "expired-report",
      __cityreport_local_commit_ts: 100,
    };
    const loaded = [{ id: "existing-report" }];

    expect(mergeLoadedConfiguredIncidentRowsShared(loaded, [local], {
      nowTs: 500_000,
      localCommitMaxAgeMs: 1_000,
    })).toBe(loaded);
  });

  it("applies stale loaded pothole state without erasing locally committed rows", () => {
    let seededState = [{ id: "fresh-pothole", __cityreport_local_commit_ts: 9_950 }];
    let reportState = [{ id: "fresh-report", __cityreport_local_commit_ts: 9_950 }];
    const applyUpdater = (current: object[], updater: object[] | ((rows: object[]) => object[])) => (
      typeof updater === "function" ? updater(current) : updater
    );

    applyLoadedConfiguredIncidentDomainStateShared("potholes", {
      seededRows: [{ id: "existing-pothole" }],
      reportRows: [{ id: "existing-report" }],
      nowTs: 10_000,
      setSeededRows: (updater: object[] | ((rows: object[]) => object[])) => {
        seededState = applyUpdater(seededState, updater);
      },
      setReportRows: (updater: object[] | ((rows: object[]) => object[])) => {
        reportState = applyUpdater(reportState, updater);
      },
    }, {
      normalizeDomainKeyOrSlug: (value: string) => value,
      incidentDomainConfiguredSourceTable: () => "pothole_reports",
      incidentDomainNormalizeConfiguredSeededRecord: (_domain: string, row: object) => row,
      incidentDomainNormalizeConfiguredReportRecord: (_domain: string, row: object) => row,
    });

    expect(seededState.map((row: any) => row.id)).toEqual(["fresh-pothole", "existing-pothole"]);
    expect(reportState.map((row: any) => row.id)).toEqual(["fresh-report", "existing-report"]);
  });
});
