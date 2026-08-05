import { describe, expect, it } from "vitest";
import { resolveReportTypeOptionDetails } from "../lib/mapReportTypeOptionSupport";
import {
  dedupeReportRowsShared,
  mergeReportGroupsByIncidentShared,
} from "../lib/mapReportDedupSupport";

const runtimeDomainMeta = {
  issueTypesByDomain: new Map(),
  typeOptionsByDomain: new Map([
    ["street_signs", [
      { optionKey: "sign_type", optionLabel: "Sign Type", choices: [{ value: "speed", label: "Speed limit" }] },
      { optionKey: "test_options", optionLabel: "Test options", choices: [{ value: "test_1", label: "test 1" }, { value: "test_3", label: "test 3" }] },
      { optionKey: "issue_type", optionLabel: "What to report?", choices: [{ value: "missing", label: "Missing" }] },
    ]],
  ]),
};

describe("resolveReportTypeOptionDetails", () => {
  it("does not reuse Sign Type as a value for another reporting field", () => {
    const details = resolveReportTypeOptionDetails({
      note: "Type Option Sign Type: Speed limit | Type Option Test options: test 3 | Type Option What to report?: Missing | Test",
      type: "other",
    }, "street_signs", runtimeDomainMeta);

    expect(details).toEqual([
      { key: "sign_type", label: "Sign Type", valueLabel: "Speed limit" },
      { key: "test_options", label: "Test options", valueLabel: "test 3" },
      { key: "issue_type", label: "What to report?", valueLabel: "Missing" },
    ]);
  });

  it("recovers the configured field label for historical report_type-only rows", () => {
    const details = resolveReportTypeOptionDetails({
      report_type: "Court",
      raw_notes: "Test notes",
    }, "park_equipment", {
      issueTypesByDomain: new Map(),
      typeOptionsByDomain: new Map([
        ["park_equipment", [
          {
            optionKey: "equipment_type",
            optionLabel: "Equipment Type",
            choices: [{ value: "court", label: "Court" }],
          },
        ]],
      ]),
    });

    expect(details).toEqual([
      { key: "equipment_type", label: "Equipment Type", valueLabel: "Court" },
    ]);
  });

});

describe("report workspace duplicate protection", () => {
  it("keeps one logical report when the same report number arrives from multiple sources", () => {
    const duplicateRows = [
      { id: "generic-row", report_number: "PE-R00000946", light_id: "PE8149064069", ts: 10 },
      { id: "configured-row", report_number: "PE-R00000946", light_id: "PE8149064069", ts: 10 },
    ];
    expect(dedupeReportRowsShared(duplicateRows, "park_equipment")).toHaveLength(1);
    const groups = mergeReportGroupsByIncidentShared([
      { domainKey: "park_equipment", incidentId: "PE8149064069", mineRows: duplicateRows, lastTs: 10 },
      { domainKey: "park_equipment", incidentId: "PE8149064069", mineRows: duplicateRows, lastTs: 10 },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].count).toBe(1);
  });
});
