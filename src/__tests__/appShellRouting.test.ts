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

  it("normalizes legacy gmaps and reports paths into the report workspace", () => {
    expect(normalizeMunicipalityAppPath("/gmaps", "ashtabulacity")).toBe("/report");
    expect(normalizeMunicipalityAppPath("/reports?tab=open", "ashtabulacity")).toBe("/report");
  });

  it("falls back unknown municipality paths to home", () => {
    expect(normalizeMunicipalityAppPath("/something-else", "ashtabulacity")).toBe("/");
  });

  it("builds tenant-prefixed hrefs for dev path hosts", () => {
    expect(buildMunicipalityAppHref("/ashtabulacity/", "ashtabulacity", "/events")).toBe("/ashtabulacity/events");
    expect(buildMunicipalityAppHref("/ashtabulacity/report", "ashtabulacity", "/")).toBe("/ashtabulacity");
  });

  it("builds root-relative hrefs for municipality subdomains", () => {
    expect(buildMunicipalityAppHref("/report", "ashtabulacity", "/alerts")).toBe("/alerts");
  });
});
