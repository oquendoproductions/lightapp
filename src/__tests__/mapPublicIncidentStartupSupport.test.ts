import { describe, expect, it } from "vitest";

import { shouldFallbackFromPublicReportRowsShared } from "../lib/mapDeferredPublicMapLoadSupport";
import { reportDomainForRow } from "../lib/mapReportParsingCoreSupport";

describe("public incident startup support", () => {
  it("keeps nonempty public report rows when the legacy view omits domain fields", () => {
    const rows = [
      {
        id: "report-1",
        light_id: "graffiti:41.60000:-80.80000",
        report_type: "Graffiti",
      },
    ];

    expect(shouldFallbackFromPublicReportRowsShared(rows)).toBe(false);
  });

  it("uses a fallback only when the public read failed or returned no rows", () => {
    expect(shouldFallbackFromPublicReportRowsShared([])).toBe(true);
    expect(shouldFallbackFromPublicReportRowsShared(null)).toBe(true);
    expect(shouldFallbackFromPublicReportRowsShared([], new Error("read failed"))).toBe(true);
  });

  it("infers shared incident domains from namespaced public IDs", () => {
    expect(reportDomainForRow({ light_id: "graffiti:41.6:-80.8" })).toBe("graffiti");
    expect(reportDomainForRow({ light_id: "downed_tree:41.6:-80.8" })).toBe("downed_tree");
    expect(reportDomainForRow({ light_id: "street_signs:41.6:-80.8" })).toBe("street_signs");
    expect(reportDomainForRow({ light_id: "water_drain_issues:41.6:-80.8" })).toBe("water_drain_issues");
  });
});
