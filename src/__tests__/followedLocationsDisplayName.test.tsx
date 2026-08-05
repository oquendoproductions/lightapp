import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchTenantPublicDisplayName } = vi.hoisted(() => ({
  fetchTenantPublicDisplayName: vi.fn(),
}));

vi.mock("../lib/followedCitySupport.js", () => ({
  fetchTenantPublicDisplayName,
  loadFollowedTenantKeys: vi.fn(),
  persistFollowedTenantKey: vi.fn(),
}));

import { FollowedLocationsModal } from "../mapLazyAccountPanels.jsx";

describe("FollowedLocationsModal display names", () => {
  beforeEach(() => {
    fetchTenantPublicDisplayName.mockReset();
    fetchTenantPublicDisplayName.mockImplementation(async (tenantKey) => (
      tenantKey === "othercity" ? "Other City Public" : "Test City"
    ));
  });

  it("uses the public display name for an inactive saved location", async () => {
    render(
      <FollowedLocationsModal
        open
        onClose={vi.fn()}
        cities={[
          {
            tenantKey: "testcity1",
            name: "Test City Organization",
            displayName: "Test City",
          },
          {
            tenantKey: "othercity",
            name: "Other City Organization",
          },
        ]}
        followedTenantKeys={["testcity1", "othercity"]}
        currentTenantKey="testcity1"
        currentCityLabel="Test City"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Other City Public")).toBeInTheDocument();
    });
    expect(screen.queryByText("Other City Organization")).not.toBeInTheDocument();
    expect(fetchTenantPublicDisplayName).toHaveBeenCalledWith("othercity");
  });
});
