import { describe, expect, it } from "vitest";
import {
  buildMunicipalityAppHref,
  normalizeMunicipalityAppPath,
  stripTenantPathPrefix,
} from "../municipality/appShellRouting";

describe("municipality app shell routing", () => {
  it("strips dev tenant prefixes before resolving routes", () => {
    expect(stripTenantPathPrefix("/ashtabulacity/report", "ashtabulacity")).toBe("/report");
    expect(stripTenantPathPrefix("/ashtabulacity/events", "ashtabulacity")).toBe("/events");
  });

  it("normalizes hub-prefixed routes and keeps hub reports on the reports page", () => {
    expect(normalizeMunicipalityAppPath("/hub/report", "ashtabulacity")).toBe("/report");
    expect(normalizeMunicipalityAppPath("/hub/reports", "ashtabulacity")).toBe("/reports");
    expect(normalizeMunicipalityAppPath("/reports?tab=open", "ashtabulacity")).toBe("/reports");
  });

  it("falls back unknown municipality paths to home", () => {
    expect(normalizeMunicipalityAppPath("/something-else", "ashtabulacity")).toBe("/");
  });

  it("builds tenant-prefixed hrefs for dev path hosts", () => {
    expect(buildMunicipalityAppHref("/ashtabulacity/hub", "ashtabulacity", "/events")).toBe("/ashtabulacity/hub/events");
    expect(buildMunicipalityAppHref("/ashtabulacity/hub/report", "ashtabulacity", "/")).toBe("/ashtabulacity/hub");
  });

  it("builds root-relative hrefs for municipality subdomains", () => {
    expect(buildMunicipalityAppHref("/hub/report", "ashtabulacity", "/alerts")).toBe("/hub/alerts");
  });
});
