import { describe, expect, it } from "vitest";

import {
  canonicalIncidentDrivenIncidentIdShared as canonicalIncidentDrivenIncidentIdCore,
  hasIncidentIdPrefixShared as hasIncidentIdPrefixCore,
  incidentDomainResolveLookupValueByModeShared as incidentDomainResolveLookupValueByModeCore,
  incidentSnapshotCandidateDomainsShared as incidentSnapshotCandidateDomainsCore,
  normalizeIncidentDrivenLookupIdShared as normalizeIncidentDrivenLookupIdCore,
  readIncidentDomainConfiguredCollectionHelperStringShared as readIncidentDomainConfiguredCollectionHelperStringCore,
  readIncidentDomainHelperBooleanShared as readIncidentDomainHelperBooleanCore,
  readIncidentDomainHelperStringShared as readIncidentDomainHelperStringCore,
  resolveIncidentDomainHelperEntryShared as resolveIncidentDomainHelperEntryCore,
  stripConfiguredIncidentLookupPrefixShared as stripConfiguredIncidentLookupPrefixCore,
} from "../lib/mapIncidentDomainHelperCoreSupport";
import {
  canonicalIncidentDrivenIncidentIdShared as canonicalIncidentDrivenIncidentIdFull,
  hasIncidentIdPrefixShared as hasIncidentIdPrefixFull,
  incidentDomainResolveLookupValueByModeShared as incidentDomainResolveLookupValueByModeFull,
  incidentSnapshotCandidateDomainsShared as incidentSnapshotCandidateDomainsFull,
  normalizeIncidentDrivenLookupIdShared as normalizeIncidentDrivenLookupIdFull,
  readIncidentDomainConfiguredCollectionHelperStringShared as readIncidentDomainConfiguredCollectionHelperStringFull,
  readIncidentDomainHelperBooleanShared as readIncidentDomainHelperBooleanFull,
  readIncidentDomainHelperStringShared as readIncidentDomainHelperStringFull,
  resolveIncidentDomainHelperEntryShared as resolveIncidentDomainHelperEntryFull,
  stripConfiguredIncidentLookupPrefixShared as stripConfiguredIncidentLookupPrefixFull,
} from "../lib/mapIncidentDomainHelperSupport";

const TEST_HELPERS = {
  potholes: {
    prefix: "potholes",
    canonicalIncidentPrefix: "potholes",
    canonicalIncidentIdMode: "prefix_lookup",
    usesCanonicalPrefixedId: true,
    reportsLookupField: "pothole_id",
    normalizeReportRecordIncidentIdField: "pothole_id",
    snapshotAliases: ["pothole", "shared_potholes"],
    reportsCollectionName: "pothole_reports",
    seededCollectionName: "potholes",
    popupLocationCompletenessMode: "domain_popup_location",
    roadRequired: true,
  },
  street_signs: {
    prefix: "street_signs",
    canonicalIncidentPrefix: "street_signs",
    canonicalIncidentIdMode: "lookup_or_light_id",
    reportsLookupField: "incident_key",
    snapshotAliases: ["street_signs"],
    reportsCollectionName: "street_sign_reports",
    seededCollectionName: "street_signs",
    adminManaged: false,
  },
};

const testDeps = {
  normalizeDomainKey(candidate: string, opts: { allowUnknown?: boolean } = {}) {
    const normalized = String(candidate || "").trim().toLowerCase();
    if (normalized in TEST_HELPERS) return normalized;
    if (normalized === "pothole") return "potholes";
    if (normalized === "shared_potholes") return "potholes";
    if (opts.allowUnknown) return normalized;
    return "";
  },
  normalizeDomainKeyOrSlug(candidate: string, opts: { allowUnknown?: boolean } = {}) {
    const normalized = String(candidate || "").trim().toLowerCase();
    if (normalized in TEST_HELPERS) return normalized;
    if (normalized === "pothole") return "potholes";
    if (normalized === "shared_potholes") return "potholes";
    if (opts.allowUnknown) return normalized;
    return "";
  },
  getIncidentDomainHelper(domainKeyRaw: string) {
    const key = String(domainKeyRaw || "").trim().toLowerCase();
    return TEST_HELPERS[key as keyof typeof TEST_HELPERS] || null;
  },
};

describe("mapIncidentDomainHelperCoreSupport", () => {
  it("matches helper entry resolution and basic field access", () => {
    expect(resolveIncidentDomainHelperEntryCore("pothole", testDeps)).toEqual(
      resolveIncidentDomainHelperEntryFull("pothole", testDeps)
    );
    expect(readIncidentDomainHelperStringCore("potholes", "reportsCollectionName", "", testDeps)).toBe(
      readIncidentDomainHelperStringFull("potholes", "reportsCollectionName", "", testDeps)
    );
    expect(readIncidentDomainHelperBooleanCore("potholes", "roadRequired", testDeps)).toBe(
      readIncidentDomainHelperBooleanFull("potholes", "roadRequired", testDeps)
    );
    expect(
      readIncidentDomainConfiguredCollectionHelperStringCore(
        "potholes",
        "reports",
        "reportsCollectionName",
        "seededCollectionName",
        testDeps,
      )
    ).toBe(
      readIncidentDomainConfiguredCollectionHelperStringFull(
        "potholes",
        "reports",
        "reportsCollectionName",
        "seededCollectionName",
        testDeps,
      )
    );
  });

  it("matches canonical lookup normalization behavior", () => {
    const prefixedIncidentId = "potholes:41.62721:-80.82484";

    expect(stripConfiguredIncidentLookupPrefixCore("potholes", prefixedIncidentId, testDeps)).toBe(
      stripConfiguredIncidentLookupPrefixFull("potholes", prefixedIncidentId, testDeps)
    );
    expect(normalizeIncidentDrivenLookupIdCore("potholes", prefixedIncidentId, testDeps)).toBe(
      normalizeIncidentDrivenLookupIdFull("potholes", prefixedIncidentId, testDeps)
    );
    expect(hasIncidentIdPrefixCore(prefixedIncidentId, "potholes", testDeps)).toBe(
      hasIncidentIdPrefixFull(prefixedIncidentId, "potholes", testDeps)
    );
    expect(
      canonicalIncidentDrivenIncidentIdCore(
        "potholes",
        { incident_id: prefixedIncidentId },
        "",
        testDeps,
      )
    ).toBe(
      canonicalIncidentDrivenIncidentIdFull(
        "potholes",
        { incident_id: prefixedIncidentId },
        "",
        testDeps,
      )
    );
  });

  it("matches lookup resolution and snapshot candidate behavior", () => {
    const row = {
      incident_id: "",
      pothole_id: "41.62721:-80.82484",
      light_id: "fallback-light-id",
    };

    expect(incidentDomainResolveLookupValueByModeCore("incident_or_domain_report_id", row, "potholes", testDeps)).toBe(
      incidentDomainResolveLookupValueByModeFull("incident_or_domain_report_id", row, "potholes", testDeps)
    );
    expect(incidentSnapshotCandidateDomainsCore("potholes", "potholes:41.62721:-80.82484", testDeps)).toEqual(
      incidentSnapshotCandidateDomainsFull("potholes", "potholes:41.62721:-80.82484", testDeps)
    );
  });
});
