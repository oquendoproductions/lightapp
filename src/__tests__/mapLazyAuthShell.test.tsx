import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthGateModal } from "../mapLazyAuthShell.jsx";

describe("AuthGateModal", () => {
  it("opens Forgot Password without passing the click event as an email", () => {
    const onOpenForgotPassword = vi.fn();

    render(
      <AuthGateModal
        open
        step="login"
        setStep={() => {}}
        onContinueGuest={() => {}}
        authEmail="resident@example.com"
        setAuthEmail={() => {}}
        authPassword=""
        setAuthPassword={() => {}}
        authLoading={false}
        loginError=""
        clearLoginError={() => {}}
        onOpenForgotPassword={onOpenForgotPassword}
        onLogin={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(onOpenForgotPassword).toHaveBeenCalledTimes(1);
    expect(onOpenForgotPassword).toHaveBeenCalledWith();
  });
});
