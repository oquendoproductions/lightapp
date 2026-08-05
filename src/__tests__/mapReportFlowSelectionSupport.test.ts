import { describe, expect, it } from "vitest";
import {
  buildDomainTypeOptionNoteTags,
  buildDomainTypeOptionPayload,
  readDomainTypeOptionMetadataFromNote,
} from "../lib/mapReportFlowSelectionSupport";

describe("buildDomainTypeOptionPayload", () => {
  it("preserves every configured reporting field and uses stable positional macros", () => {
    const fields = [
      { optionKey: "sign_type", optionLabel: "Sign Type", choices: [{ value: "speed", label: "Speed limit" }] },
      { optionKey: "condition", optionLabel: "Issue Description", choices: [{ value: "damaged", label: "Damaged" }] },
      { optionKey: "priority", optionLabel: "Urgency", choices: [{ value: "urgent", label: "Urgent" }] },
    ];

    expect(buildDomainTypeOptionPayload({
      sign_type: "speed",
      condition: "damaged",
      priority: "urgent",
    }, fields)).toEqual([
      { key: "sign_type", label: "Sign Type", value: "speed", valueLabel: "Speed limit", macroKey: "issue_type_1" },
      { key: "condition", label: "Issue Description", value: "damaged", valueLabel: "Damaged", macroKey: "issue_type_2" },
      { key: "priority", label: "Urgency", value: "urgent", valueLabel: "Urgent", macroKey: "issue_type_3" },
    ]);
  });

  it("stores stable reporting-field keys alongside human-readable note tags", () => {
    const fields = [
      { optionKey: "sign_type", optionLabel: "Sign Type", choices: [{ value: "speed", label: "Speed limit" }] },
      { optionKey: "condition", optionLabel: "Issue Description", choices: [{ value: "damaged", label: "Damaged" }] },
    ];
    const tags = buildDomainTypeOptionNoteTags({ sign_type: "speed", condition: "damaged" }, fields);

    expect(tags).toContain("Type Option Sign Type: Speed limit");
    expect(readDomainTypeOptionMetadataFromNote(tags.join(" | "))).toEqual([
      { key: "sign_type", label: "Sign Type", value: "speed", valueLabel: "Speed limit", position: 1 },
      { key: "condition", label: "Issue Description", value: "damaged", valueLabel: "Damaged", position: 2 },
    ]);
  });
});
