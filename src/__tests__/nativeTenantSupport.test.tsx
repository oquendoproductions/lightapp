import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TenantInitialSelectionScreen } from "../tenant/nativeTenantSupport.jsx";

describe("TenantInitialSelectionScreen", () => {
  it("starts with sign in and offers the guest path", async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    const onContinueGuest = vi.fn();

    render(
      <TenantInitialSelectionScreen
        step="login"
        loginEmail="resident@example.com"
        loginPassword="secret"
        onSignIn={onSignIn}
        onContinueGuest={onContinueGuest}
      />
    );

    expect(screen.getAllByText("Sign In")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Continue as Guest" }));
    expect(onContinueGuest).toHaveBeenCalledTimes(1);
  });

  it("shows saved locations before the tenant search", async () => {
    const user = userEvent.setup();
    const onSelectTenant = vi.fn();
    const savedOption = {
      tenantKey: "testcity1",
      displayName: "Test City",
      primarySubdomain: "testcity.cityreport.io",
    };

    render(
      <TenantInitialSelectionScreen
        step="tenant"
        optionsReady
        savedOptions={[savedOption]}
        onSelectTenant={onSelectTenant}
      />
    );

    expect(screen.getByText("Saved Locations")).toBeInTheDocument();
    expect(screen.getByText("Add Another Location")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Test City/i }));
    expect(onSelectTenant).toHaveBeenCalledWith("testcity1");
  });
});
