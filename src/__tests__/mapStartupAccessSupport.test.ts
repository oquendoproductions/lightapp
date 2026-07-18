import { describe, expect, it } from "vitest";

import {
  hasRenderableMapRuntimeDataShared,
  isMapReadAccessReadyShared,
  shouldHydratePublicMapCoreCacheShared,
  shouldWaitForAuthenticatedMapAccessShared,
} from "../lib/mapStartupAccessSupport.js";

describe("map startup access ordering", () => {
  it("blocks map reads while an authenticated user's tenant access is unresolved", () => {
    const waitingForReportAccess = shouldWaitForAuthenticatedMapAccessShared({
      authReady: true,
      sessionUserId: "user-1",
      adminStateResolved: true,
      reportAccessResolved: false,
    });

    expect(waitingForReportAccess).toBe(true);
    expect(isMapReadAccessReadyShared({
      authReady: true,
      shouldWaitForAuth: true,
      waitingForReportAccess,
    })).toBe(false);
    expect(shouldHydratePublicMapCoreCacheShared({
      tenantKey: "testcity1",
      shouldHydrateAuthEagerly: true,
      authReady: true,
      waitingForReportAccess,
    })).toBe(false);
  });

  it("blocks map reads while platform admin status is unresolved", () => {
    expect(shouldWaitForAuthenticatedMapAccessShared({
      authReady: true,
      sessionUserId: "user-1",
      adminStateResolved: false,
      reportAccessResolved: true,
    })).toBe(true);
  });

  it("allows authenticated map reads only after both access checks resolve", () => {
    expect(shouldWaitForAuthenticatedMapAccessShared({
      authReady: true,
      sessionUserId: "user-1",
      adminStateResolved: true,
      reportAccessResolved: true,
    })).toBe(false);
  });

  it("does not hydrate public cache for an authorized admin map", () => {
    expect(shouldHydratePublicMapCoreCacheShared({
      tenantKey: "testcity1",
      reportsAdminView: true,
      shouldHydrateAuthEagerly: true,
      authReady: true,
      waitingForReportAccess: false,
    })).toBe(false);
  });

  it("allows resolved resident and anonymous public startup", () => {
    expect(isMapReadAccessReadyShared({
      authReady: true,
      shouldWaitForAuth: true,
      waitingForReportAccess: false,
    })).toBe(true);
    expect(shouldHydratePublicMapCoreCacheShared({
      tenantKey: "testcity1",
      reportsAdminView: false,
      shouldHydrateAuthEagerly: true,
      authReady: true,
      waitingForReportAccess: false,
    })).toBe(true);
    expect(isMapReadAccessReadyShared({
      authReady: false,
      shouldWaitForAuth: false,
      waitingForReportAccess: false,
    })).toBe(true);
  });

  it("blocks an eager persisted-session startup until authentication hydrates", () => {
    expect(isMapReadAccessReadyShared({
      authReady: false,
      shouldWaitForAuth: true,
      waitingForReportAccess: false,
    })).toBe(false);
  });

  it("recognizes existing map data that should remain visible during a retry", () => {
    expect(hasRenderableMapRuntimeDataShared()).toBe(false);
    expect(hasRenderableMapRuntimeDataShared({
      sharedIncidentMarkersByDomain: {
        potholes: [{ id: "PH-1" }],
      },
    })).toBe(true);
    expect(hasRenderableMapRuntimeDataShared({
      configuredIncidentReportRowsByDomain: {
        graffiti: [{ id: "GR-1" }],
      },
    })).toBe(true);
  });
});
