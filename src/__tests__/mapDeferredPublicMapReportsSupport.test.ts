import { describe, expect, it, vi } from "vitest";

import {
  fetchTenantPublicMapReportsShared,
  mergeTenantPublicAndViewerReportsShared,
} from "../lib/mapDeferredPublicMapLoadSupport";

describe("fetchTenantPublicMapReportsShared", () => {
  it("uses the tenant-scoped public map RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ id: "12", report_domain: "potholes" }],
      error: null,
    });

    const result = await fetchTenantPublicMapReportsShared({ rpc }, " TestCity1 ");

    expect(rpc).toHaveBeenCalledWith("public_map_reports", {
      p_tenant_key: "testcity1",
    });
    expect(result).toEqual({
      data: [{ id: "12", report_domain: "potholes" }],
      error: null,
    });
  });

  it("fails closed when no tenant scope is available", async () => {
    const rpc = vi.fn();

    const result = await fetchTenantPublicMapReportsShared({ rpc }, "");

    expect(rpc).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
    expect(result.error?.code).toBe("CITYREPORT_TENANT_SCOPE_REQUIRED");
  });
});

describe("mergeTenantPublicAndViewerReportsShared", () => {
  it("retains public rows and lets authorized viewer rows supply identity", () => {
    expect(mergeTenantPublicAndViewerReportsShared(
      [
        { id: "public-only", report_domain: "potholes" },
        { id: "shared", report_domain: "graffiti", reporter_user_id: null },
      ],
      [
        { id: "shared", report_domain: "graffiti", reporter_user_id: "user-1" },
        { id: "viewer-only", report_domain: "downed_trees", reporter_user_id: "user-1" },
      ]
    )).toEqual([
      { id: "public-only", report_domain: "potholes" },
      { id: "shared", report_domain: "graffiti", reporter_user_id: "user-1" },
      { id: "viewer-only", report_domain: "downed_trees", reporter_user_id: "user-1" },
    ]);
  });
});
