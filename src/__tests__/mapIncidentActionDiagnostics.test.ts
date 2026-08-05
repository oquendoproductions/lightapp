import { describe, expect, it, vi } from "vitest";
import {
  incidentActionFailureDisplayTextShared,
  recordIncidentActionFailureShared,
} from "../lib/mapIncidentActionDiagnostics.js";

describe("recordIncidentActionFailureShared", () => {
  it("creates a stable, safe reference and records no report content", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", { localStorage: { getItem: () => "[]", setItem } });

    const entry = recordIncidentActionFailureShared({
      stage: "fix_history_insert",
      tenantKey: "TestCity1",
      incidentId: "water_drain_issues:41.63074:-80.81951",
      action: "fix",
      error: { code: "42501", message: "new row violates row-level security policy" },
    });

    expect(entry).toMatchObject({
      reference: expect.stringMatching(/^IA-[A-Z0-9]{6}$/),
      tenantKey: "testcity1",
      action: "fix",
      errorCode: "42501",
    });
    expect(setItem).toHaveBeenCalledOnce();
    expect(incidentActionFailureDisplayTextShared(entry)).toBe(
      "42501: new row violates row-level security policy"
    );
  });
});
