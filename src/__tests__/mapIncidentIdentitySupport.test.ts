import { describe, expect, it } from "vitest";

import {
  buildSharedIncidentAuthorizationDisclosures,
  buildSharedIncidentPopupVariantConfig,
  normalizeUuidIncidentPersistenceId,
  resolveSharedIncidentPopupLocationEnsureMode,
  stripCanonicalIncidentPrefix,
} from "../lib/mapIncidentIdentitySupport";
import {
  buildSharedConfiguredIncidentPopupVariantConfig,
  buildSharedIncidentDrivenPopupVariant,
} from "../lib/mapIncidentPopupVariantSupport";
import {
  buildIncidentDrivenPopupVariantShared,
} from "../lib/mapDeferredSelectionPopupRenderSupport";
import {
  buildSharedIncidentLocationCacheEntryPayload,
  buildSharedIncidentReportTarget,
  buildSharedIncidentSavedLocationContext,
  buildSharedIncidentSubmitEmailNoticeArgs,
  buildSharedIncidentSubmitGeoCachePayload,
  buildSharedIncidentSubmitLocationFields,
} from "../lib/mapDeferredIncidentSupport";

describe("stripCanonicalIncidentPrefix", () => {
  it("strips canonical incident prefixes but preserves coordinate-backed lookup ids", () => {
    expect(stripCanonicalIncidentPrefix("pothole:8df55b83-c524-48a8-88ee-3e275e7d35a0"))
      .toBe("8df55b83-c524-48a8-88ee-3e275e7d35a0");
    expect(stripCanonicalIncidentPrefix("potholes:41.62721:-80.82484"))
      .toBe("41.62721:-80.82484");
    expect(stripCanonicalIncidentPrefix("street_signs:abc"))
      .toBe("abc");
  });
});

describe("normalizeUuidIncidentPersistenceId", () => {
  it("keeps raw UUIDs", () => {
    expect(normalizeUuidIncidentPersistenceId("8df55b83-c524-48a8-88ee-3e275e7d35a0"))
      .toBe("8df55b83-c524-48a8-88ee-3e275e7d35a0");
  });

  it("strips canonical incident prefixes before persistence", () => {
    expect(normalizeUuidIncidentPersistenceId("pothole:8df55b83-c524-48a8-88ee-3e275e7d35a0"))
      .toBe("8df55b83-c524-48a8-88ee-3e275e7d35a0");
    expect(normalizeUuidIncidentPersistenceId("potholes:8df55b83-c524-48a8-88ee-3e275e7d35a0"))
      .toBe("8df55b83-c524-48a8-88ee-3e275e7d35a0");
    expect(normalizeUuidIncidentPersistenceId("street_signs:8df55b83-c524-48a8-88ee-3e275e7d35a0"))
      .toBe("8df55b83-c524-48a8-88ee-3e275e7d35a0");
  });

  it("rejects non-uuid incident identifiers", () => {
    expect(normalizeUuidIncidentPersistenceId("potholes:41.62721:-80.82484")).toBe("");
    expect(normalizeUuidIncidentPersistenceId("PH8234662171")).toBe("");
  });
});

describe("resolveSharedIncidentPopupLocationEnsureMode", () => {
  it("preserves explicit helper modes", () => {
    expect(resolveSharedIncidentPopupLocationEnsureMode({
      helperMode: "domain_popup_location",
      popupInfo: { locationPending: false },
      marker: {},
    })).toBe("domain_popup_location");
  });

  it("falls back to generic shared enrichment when no domain override exists", () => {
    expect(resolveSharedIncidentPopupLocationEnsureMode({
      helperMode: "",
      popupInfo: { locationPending: false },
      marker: { _geoLocationPending: false },
    })).toBe("generic");
  });

  it("does not retrigger enrichment while a popup location lookup is already pending", () => {
    expect(resolveSharedIncidentPopupLocationEnsureMode({
      helperMode: "",
      popupInfo: { locationPending: true },
      marker: { _geoLocationPending: false },
    })).toBe("");
    expect(resolveSharedIncidentPopupLocationEnsureMode({
      helperMode: "",
      popupInfo: { locationPending: false },
      marker: { _geoLocationPending: true },
    })).toBe("");
  });
});

describe("shared incident builders", () => {
  it("builds a normalized popup variant config for shared incident domains", () => {
    expect(buildSharedIncidentPopupVariantConfig({
      title: "Pothole",
      domainIdFallback: "PH0000000000",
      fallbackDisplayId: "PH8234662171",
      issueLabelFallback: "Pothole",
      incidentId: "pothole:abc",
      currentState: "",
      isFixedNow: false,
      allowUpdateState: 1,
      clusterReports: null,
    })).toEqual({
      title: "Pothole",
      domainIdFallback: "PH0000000000",
      fallbackDisplayId: "PH8234662171",
      typeOptionDetailsOverride: undefined,
      showIssueFallback: true,
      issueLabelFallback: "Pothole",
      incidentId: "pothole:abc",
      currentState: "reported",
      allowUpdateState: true,
      clusterReports: [],
      adminPopupInfoExtra: undefined,
    });
  });

  it("builds a configured popup variant config from popup info", () => {
    expect(buildSharedConfiguredIncidentPopupVariantConfig({
      title: "Water / Drain",
      domainIdFallback: "WD0000000000",
      fallbackDisplayId: "WD8250261128",
      issueLabelFallback: "Water / Drain Issue",
      incidentId: "water_main:abc",
      popupInfo: { currentState: "", isFixedNow: true },
      allowUpdateState: true,
      clusterReports: [{ id: 1 }],
    })).toEqual({
      title: "Water / Drain",
      domainIdFallback: "WD0000000000",
      fallbackDisplayId: "WD8250261128",
      typeOptionDetailsOverride: undefined,
      showIssueFallback: true,
      issueLabelFallback: "Water / Drain Issue",
      incidentId: "water_main:abc",
      currentState: "fixed",
      allowUpdateState: true,
      clusterReports: [{ id: 1 }],
      adminPopupInfoExtra: undefined,
    });
  });

  it("builds a shared incident-driven popup variant from a shared config", () => {
    expect(buildSharedIncidentDrivenPopupVariant({
      domainKey: "potholes",
      popupInfo: {
        incidentId: "pothole:abc",
        domainLabel: "Potholes",
        currentState: "reported",
        rows: [{ id: 1 }],
      },
      marker: { id: "marker-1" },
      sharedVariantConfig: {
        title: "Pothole",
        domainIdFallback: "PH0000000000",
        fallbackDisplayId: "PH8234662171",
        typeOptionDetailsOverride: undefined,
        showIssueFallback: true,
        issueLabelFallback: "Pothole",
        incidentId: "pothole:abc",
        currentState: "reported",
        clusterReports: [{ id: 1 }],
        allowUpdateState: true,
        resident: { repairIncidentId: "pothole:abc" },
      },
    })).toEqual({
      title: "Pothole",
      domainKey: "potholes",
      popupInfo: {
        incidentId: "pothole:abc",
        domainLabel: "Potholes",
        currentState: "reported",
        rows: [{ id: 1 }],
      },
      renderModelOptions: {
        domainIdFallback: "PH0000000000",
        fallbackDisplayId: "PH8234662171",
        typeOptionDetailsOverride: undefined,
        showIssueFallback: true,
        issueLabelFallback: "Pothole",
      },
      adminPopupInfoExtra: undefined,
      adminAction: {
        incidentId: "pothole:abc",
        currentState: "reported",
        clusterReports: [{ id: 1 }],
        showAllReports: true,
        allReportsDomainOverride: "potholes",
        allowUpdateState: true,
      },
      renderAdminExtras: undefined,
      resident: { repairIncidentId: "pothole:abc" },
    });
  });

  it("falls back to the generic incident-driven popup variant shape", () => {
    expect(buildSharedIncidentDrivenPopupVariant({
      domainKey: "water_drain_issues",
      popupInfo: {
        incidentId: "water_main:abc",
        domainLabel: "Water / Drain",
        currentState: "",
        isFixedNow: false,
        rows: [{ id: 1 }],
      },
      marker: { id: "marker-1" },
      sharedVariantConfig: null,
    })).toEqual({
      title: "Water / Drain",
      domainKey: "water_drain_issues",
      popupInfo: {
        incidentId: "water_main:abc",
        domainLabel: "Water / Drain",
        currentState: "",
        isFixedNow: false,
        rows: [{ id: 1 }],
      },
      renderModelOptions: {
        domainIdFallback: "Incident",
      },
      adminAction: {
        incidentId: "water_main:abc",
        currentState: "reported",
        clusterReports: [{ id: 1 }],
        showAllReports: true,
        allowUpdateState: true,
      },
      resident: {
        showActionSpacer: true,
        reportIssue: {},
        repairIncidentId: "water_main:abc",
      },
    });
  });

  it("builds a shared incident report target with a supplied incident id", () => {
    expect(buildSharedIncidentReportTarget({
      domainKey: "street_signs",
      domainLabel: "Street Signs",
      lat: 41.61105,
      lng: -80.82481,
      incidentId: "street_signs:abc",
      locationLabel: "Near mailbox cluster",
      nearestAddress: "968 Long Shadow Ln",
      nearestLandmark: "Mailbox cluster",
      nearestCrossStreet: "Lake View Dr",
      nearestIntersection: "Lake View Dr & Long Shadow Ln",
      typeValue: "damaged",
      signType: "Stop",
      extra: { custom: true },
    })).toEqual({
      domain: "street_signs",
      domainLabel: "Street Signs",
      lat: 41.61105,
      lng: -80.82481,
      sourceLat: 41.61105,
      sourceLng: -80.82481,
      incident_id: "street_signs:abc",
      lightId: "street_signs:abc",
      locationLabel: "Near mailbox cluster",
      nearestAddress: "968 Long Shadow Ln",
      nearestLandmark: "Mailbox cluster",
      nearestCrossStreet: "Lake View Dr",
      nearestIntersection: "Lake View Dr & Long Shadow Ln",
      typeValue: "damaged",
      signType: "Stop",
      custom: true,
    });
  });

  it("builds a fallback shared incident report target for map taps", () => {
    expect(buildSharedIncidentReportTarget({
      domainKey: "potholes",
      domainLabel: "Potholes",
      lat: 41.62721,
      lng: -80.82484,
      fromMapTap: true,
      domainExplicitlySelected: true,
    })).toEqual({
      domain: "potholes",
      domainLabel: "Potholes",
      lat: 41.62721,
      lng: -80.82484,
      sourceLat: 41.62721,
      sourceLng: -80.82484,
      incident_id: "potholes:41.62721:-80.82484",
      lightId: "potholes:41.62721:-80.82484",
      locationLabel: "41.62721, -80.82484",
      nearestAddress: "",
      nearestLandmark: "",
      nearestCrossStreet: "",
      nearestIntersection: "",
      fromMapTap: true,
      domainExplicitlySelected: true,
    });
  });

  it("builds shared incident authorization disclosures", () => {
    expect(buildSharedIncidentAuthorizationDisclosures({
      authorizationId: "water_drain_submit_authorization",
      authorizationBody: "I agree to submit this report.",
      baseDisclosures: [{ id: "after", title: "After", body: "after" }],
      extraBefore: [{ id: "before", title: "Before", body: "before", required_acknowledgement: false, display_position: "before_form" }],
    })).toEqual([
      { id: "before", title: "Before", body: "before", required_acknowledgement: false, display_position: "before_form" },
      {
        id: "water_drain_submit_authorization",
        title: "Authorization to submit",
        body: "I agree to submit this report.",
        required_acknowledgement: true,
        display_position: "inside_form",
      },
      { id: "after", title: "After", body: "after" },
    ]);
  });

  it("builds shared submit-side location fields", () => {
    expect(buildSharedIncidentSubmitLocationFields({
      submitGeo: {
        nearestAddress: "968 Long Shadow Ln",
        nearestCrossStreet: "Lake View Dr",
        nearestIntersection: "Lake View Dr & Long Shadow Ln",
        nearestLandmark: "Mailbox cluster",
      },
      target: null,
    })).toEqual({
      nearestAddress: "968 Long Shadow Ln",
      nearestLandmark: "Mailbox cluster",
      nearestCrossStreet: "Lake View Dr",
      nearestIntersection: "Lake View Dr & Long Shadow Ln",
    });
  });

  it("builds shared submit geo cache payloads", () => {
    expect(buildSharedIncidentSubmitGeoCachePayload({
      tenantKey: "testcity1",
      domain: "potholes",
      incidentId: "8df55b83-c524-48a8-88ee-3e275e7d35a0",
      locationFields: {
        nearestAddress: "968 Long Shadow Ln",
        nearestCrossStreet: "Lake View Dr",
        nearestIntersection: "Lake View Dr & Long Shadow Ln",
        nearestLandmark: "Mailbox cluster",
      },
    })).toEqual({
      tenant_key: "testcity1",
      domain: "potholes",
      incident_id: "8df55b83-c524-48a8-88ee-3e275e7d35a0",
      nearest_address: "968 Long Shadow Ln",
      nearest_cross_street: "Lake View Dr",
      nearest_intersection: "Lake View Dr & Long Shadow Ln",
      nearest_landmark: "Mailbox cluster",
    });
  });

  it("builds shared submit email notice args", () => {
    expect(buildSharedIncidentSubmitEmailNoticeArgs({
      domainKey: "potholes",
      domainLabel: "Potholes",
      issueTypeLabel: "",
      issueTypeFallback: "Pothole",
      reportNumber: "PH-R000000123",
      notes: "Large pothole in lane",
      lat: 41.61025,
      lng: -80.8247,
      closestAddress: "968 Long Shadow Ln",
      closestLandmark: "Mailbox cluster",
      closestCrossStreet: "Lake View Dr",
      closestIntersection: "Lake View Dr & Long Shadow Ln",
      submittedAtIso: "2026-07-05T20:17:59.000Z",
      reporter: { name: "Test AccountA" },
    })).toEqual({
      domainKey: "potholes",
      domainLabel: "Potholes",
      issueTypeLabel: "Pothole",
      typeOptions: [],
      reportNumber: "PH-R000000123",
      notes: "Large pothole in lane",
      lat: 41.61025,
      lng: -80.8247,
      closestAddress: "968 Long Shadow Ln",
      closestLandmark: "Mailbox cluster",
      closestCrossStreet: "Lake View Dr",
      closestIntersection: "Lake View Dr & Long Shadow Ln",
      submittedAtIso: "2026-07-05T20:17:59.000Z",
      reporter: { name: "Test AccountA" },
    });
  });

  it("builds shared location cache entry payloads", () => {
    expect(buildSharedIncidentLocationCacheEntryPayload({
      nearestAddress: "968 Long Shadow Ln",
      nearestCrossStreet: "Lake View Dr",
      nearestIntersection: "Lake View Dr & Long Shadow Ln",
      nearestLandmark: "Mailbox cluster",
      locationLabel: "968 Long Shadow Ln",
    })).toEqual({
      nearestAddress: "968 Long Shadow Ln",
      nearestCrossStreet: "Lake View Dr",
      nearestIntersection: "Lake View Dr & Long Shadow Ln",
      nearestLandmark: "Mailbox cluster",
      locationLabel: "968 Long Shadow Ln",
    });
  });

  it("builds saved location context from resolved addresses when available", () => {
    expect(buildSharedIncidentSavedLocationContext({
      insertedReportData: { lat: 41.61025, lng: -80.8247 },
      submitLat: 41.61025,
      submitLng: -80.8247,
      nearestAddress: "968 Long Shadow Ln",
      target: { locationLabel: "fallback label" },
      hasUsableAddress: true,
    })).toEqual({
      lat: 41.61025,
      lng: -80.8247,
      locationLabel: "968 Long Shadow Ln",
    });
  });

  it("renders a generic shared popup when a domain has no popup-specific configuration", () => {
    const popupInfo = {
      incidentId: "graffiti:abc",
      domainLabel: "Graffiti",
      currentState: "reported",
      rows: [{ id: 1 }],
    };
    const marker = { id: "marker-1", domain: "graffiti" };

    expect(buildIncidentDrivenPopupVariantShared({
      domainKey: "graffiti",
      popupInfo,
      marker,
      getIncidentDomainHelper: () => ({}),
      buildSharedConfiguredIncidentPopupVariantConfig,
      buildSharedIncidentDrivenPopupVariant,
    })).toEqual({
      title: "Graffiti",
      domainKey: "graffiti",
      popupInfo,
      renderModelOptions: {
        domainIdFallback: "Incident",
      },
      adminAction: {
        incidentId: "graffiti:abc",
        currentState: "reported",
        clusterReports: [{ id: 1 }],
        showAllReports: true,
        allowUpdateState: true,
      },
      resident: {
        showActionSpacer: true,
        reportIssue: {},
        repairIncidentId: "graffiti:abc",
      },
    });
  });
});
