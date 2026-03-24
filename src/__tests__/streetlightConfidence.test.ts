import { describe, expect, it } from "vitest";
import { computeStreetlightConfidenceSnapshot } from "../streetlightConfidence";

describe("computeStreetlightConfidenceSnapshot", () => {
  it("keeps a single-user saved light unconfirmed and private", () => {
    const snapshot = computeStreetlightConfidenceSnapshot({
      outageSignals: [{ reporterKey: "uid:1", ts: 1000 }],
      viewerIdentityKey: "uid:1",
      viewerHasSaved: true,
      now: 2000,
    });

    expect(snapshot.state).toBe("unconfirmed");
    expect(snapshot.publicVisibleOutage).toBe(false);
    expect(snapshot.canViewerMarkWorking).toBe(true);
  });

  it("promotes a light to likely outage once score reaches threshold", () => {
    const snapshot = computeStreetlightConfidenceSnapshot({
      outageSignals: [
        { reporterKey: "uid:1", ts: 1000 },
        { reporterKey: "uid:2", ts: 1200 },
      ],
      utilityReportedCount: 2,
      now: 2000,
    });

    expect(snapshot.outageScore).toBe(4);
    expect(snapshot.state).toBe("likely_outage");
    expect(snapshot.publicVisibleOutage).toBe(true);
  });

  it("counts referenced utility reports as stronger outage evidence", () => {
    const snapshot = computeStreetlightConfidenceSnapshot({
      outageSignals: [{ reporterKey: "uid:1", ts: 1000 }],
      utilityReportedCount: 1,
      utilityReferenceCount: 1,
      now: 2000,
    });

    expect(snapshot.outageScore).toBe(3);
    expect(snapshot.utilityReferenceCount).toBe(1);
    expect(snapshot.state).toBe("unconfirmed");
  });

  it("moves to likely resolved after two unique working confirmations", () => {
    const snapshot = computeStreetlightConfidenceSnapshot({
      outageSignals: [
        { reporterKey: "uid:1", ts: 1000 },
        { reporterKey: "uid:2", ts: 1200 },
      ],
      utilityReportedCount: 2,
      workingSignals: [
        { reporterKey: "uid:3", ts: 1500 },
        { reporterKey: "uid:4", ts: 1600 },
      ],
      now: 2000,
    });

    expect(snapshot.state).toBe("likely_resolved");
    expect(snapshot.closed).toBe(true);
    expect(snapshot.publicVisibleOutage).toBe(false);
  });

  it("blocks repeat viewer working submissions until a new outage arrives", () => {
    const firstCycle = computeStreetlightConfidenceSnapshot({
      outageSignals: [{ reporterKey: "uid:1", ts: 1000 }],
      workingSignals: [{ reporterKey: "uid:1", ts: 1500 }],
      viewerIdentityKey: "uid:1",
      viewerHasSaved: true,
      now: 2000,
    });

    expect(firstCycle.viewerHasWorkingAck).toBe(true);
    expect(firstCycle.canViewerMarkWorking).toBe(false);

    const reopenedCycle = computeStreetlightConfidenceSnapshot({
      outageSignals: [
        { reporterKey: "uid:1", ts: 1000 },
        { reporterKey: "uid:2", ts: 2500 },
      ],
      workingSignals: [{ reporterKey: "uid:1", ts: 1500 }],
      viewerIdentityKey: "uid:1",
      viewerHasSaved: true,
      now: 3000,
    });

    expect(reopenedCycle.viewerHasWorkingAck).toBe(false);
    expect(reopenedCycle.canViewerMarkWorking).toBe(true);
  });

  it("archives stale unconfirmed lights after inactivity", () => {
    const snapshot = computeStreetlightConfidenceSnapshot({
      outageSignals: [{ reporterKey: "uid:1", ts: 1000 }],
      viewerIdentityKey: "uid:1",
      viewerHasSaved: true,
      now: 1000 + 15 * 24 * 60 * 60 * 1000,
    });

    expect(snapshot.state).toBe("archived");
    expect(snapshot.closed).toBe(true);
  });

  it("does not count pre-rollout activity toward staleness before March 24, 2026", () => {
    const rolloutStartMs = new Date(2026, 2, 24, 0, 0, 0, 0).getTime();
    const legacySignalTs = new Date(2026, 1, 15, 12, 0, 0, 0).getTime();
    const thirteenDaysAfterRollout = rolloutStartMs + 13 * 24 * 60 * 60 * 1000;
    const fifteenDaysAfterRollout = rolloutStartMs + 15 * 24 * 60 * 60 * 1000;

    const beforeThreshold = computeStreetlightConfidenceSnapshot({
      outageSignals: [{ reporterKey: "uid:1", ts: legacySignalTs }],
      viewerIdentityKey: "uid:1",
      viewerHasSaved: true,
      rolloutStartMs,
      now: thirteenDaysAfterRollout,
    });

    expect(beforeThreshold.state).toBe("unconfirmed");

    const afterThreshold = computeStreetlightConfidenceSnapshot({
      outageSignals: [{ reporterKey: "uid:1", ts: legacySignalTs }],
      viewerIdentityKey: "uid:1",
      viewerHasSaved: true,
      rolloutStartMs,
      now: fifteenDaysAfterRollout,
    });

    expect(afterThreshold.state).toBe("archived");
  });
});
