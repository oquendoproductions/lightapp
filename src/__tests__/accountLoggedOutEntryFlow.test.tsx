import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountMenuPanel } from "../mapLazyAccountPanels.jsx";

type AuthGateWindow = Window & {
  __openAuthGate?: (step?: string) => void;
};

afterEach(() => {
  delete (window as AuthGateWindow).__openAuthGate;
});

describe("logged-out Account entry flow", () => {
  it("opens the shared Welcome screen before the login form", () => {
    const onClose = vi.fn();
    const openAuthGate = vi.fn();
    (window as AuthGateWindow).__openAuthGate = openAuthGate;

    render(
      <AccountMenuPanel
        open
        session={null}
        profile={null}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openAuthGate).toHaveBeenCalledWith("welcome");
  });
});
