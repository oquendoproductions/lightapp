import { describe, expect, it } from "vitest";

import {
  hasRenderableMapRuntimeDataShared,
  isIncidentMapSnapshotReadyShared,
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

  it("allows resolved resident reads without hydrating the anonymous cache", () => {
    expect(isMapReadAccessReadyShared({
      authReady: true,
      shouldWaitForAuth: true,
      waitingForReportAccess: false,
    })).toBe(true);
    expect(shouldHydratePublicMapCoreCacheShared({
      tenantKey: "testcity1",
      reportsAdminView: false,
      authReady: true,
      sessionUserId: "user-1",
      waitingForReportAccess: false,
    })).toBe(false);
  });

  it("hydrates the public cache only after anonymous auth resolution", () => {
    expect(shouldHydratePublicMapCoreCacheShared({
      tenantKey: "testcity1",
      reportsAdminView: false,
      authReady: false,
      sessionUserId: "",
      waitingForReportAccess: false,
    })).toBe(false);
    expect(shouldHydratePublicMapCoreCacheShared({
      tenantKey: "testcity1",
      reportsAdminView: false,
      authReady: true,
      sessionUserId: "",
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

  it("publishes an incident snapshot only after access, config, data, and lifecycle sources settle", () => {
    const complete = {
      incidentLayerActive: true,
      publicReadAccessReady: true,
      waitingForTenantDomainConfig: false,
      tenantDomainConfigLoaded: true,
      loading: false,
      pendingConfiguredDomainCount: 0,
      pendingPersistedStateDomainCount: 0,
    };

    expect(isIncidentMapSnapshotReadyShared(complete)).toBe(true);
    expect(isIncidentMapSnapshotReadyShared({ ...complete, publicReadAccessReady: false })).toBe(false);
    expect(isIncidentMapSnapshotReadyShared({ ...complete, loading: true })).toBe(false);
    expect(isIncidentMapSnapshotReadyShared({ ...complete, pendingConfiguredDomainCount: 1 })).toBe(false);
    expect(isIncidentMapSnapshotReadyShared({ ...complete, pendingPersistedStateDomainCount: 1 })).toBe(false);
    expect(isIncidentMapSnapshotReadyShared({
      ...complete,
      loading: true,
      hasCompleteCachedSnapshot: true,
    })).toBe(true);
  });
});
