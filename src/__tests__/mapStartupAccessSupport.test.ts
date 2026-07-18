import { describe, expect, it } from "vitest";

import {
  isMapReadAccessReadyShared,
  shouldHydratePublicMapCoreCacheShared,
  shouldWaitForAuthenticatedReportAccessShared,
} from "../lib/mapStartupAccessSupport.js";

describe("map startup access ordering", () => {
  it("blocks map reads while an authenticated user's tenant access is unresolved", () => {
    const waitingForReportAccess = shouldWaitForAuthenticatedReportAccessShared({
      authReady: true,
      sessionUserId: "user-1",
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
});
