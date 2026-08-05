import { describe, expect, it, vi } from "vitest";

import { loadTenantDomainConfigSnapshotShared } from "../lib/mapDeferredTenantDomainConfigSupport.js";

describe("tenant domain configuration authority", () => {
  it("uses the current assignment over a conflicting legacy management flag", async () => {
    const snapshot = await loadTenantDomainConfigSnapshotShared({
      tenantReady: true,
      tenantKey: "testcity1",
      readClient: {},
      fetchTenantDomainPublicConfig: vi.fn().mockResolvedValue([
        {
          domain: "potholes",
          domain_type: "incident_driven",
          organization_monitored_repairs: true,
        },
      ]),
      fetchTenantAssignedDomainsRobust: vi.fn().mockResolvedValue([
        {
          domain_key: "potholes",
          domain_type: "incident_driven",
          organization_monitored_repairs: false,
          public_visibility_min_reports: 2,
          high_confidence_min_reports: 4,
        },
      ]),
      fetchTenantRegistryIncidentDomains: vi.fn(),
    });

    expect(snapshot.domainConfigByDomain.potholes.organization_monitored_repairs).toBe(false);
    expect(snapshot.registryIncidentDomains).toHaveLength(1);
  });
});
