import { render } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { shouldOpenExpiredSessionPrompt } from "../lib/mapAuthBootstrapSupport.js";
import MapLazyAuthBootstrapController from "../mapLazyAuthBootstrapController.jsx";

describe("map auth bootstrap", () => {
  it("does not reopen login when first-install hydration settles after an explicit logout", () => {
    expect(shouldOpenExpiredSessionPrompt({
      nextSession: null,
      shouldHydrateMapAuthEagerly: true,
      userInitiatedLogout: true,
    })).toBe(false);
  });

  it("still prompts when a persisted session expires on its own", () => {
    expect(shouldOpenExpiredSessionPrompt({
      nextSession: null,
      shouldHydrateMapAuthEagerly: true,
      userInitiatedLogout: false,
    })).toBe(true);
  });

  it("does not resubscribe to auth when the notice callback changes", () => {
    const unsubscribe = vi.fn();
    const onAuthStateChange = vi.fn(() => ({
      data: { subscription: { unsubscribe } },
    }));
    const stableSetter = vi.fn();
    const baseProps = {
      shouldHydrateMapAuthEagerly: false,
      hydrateImmediately: false,
      supabase: { auth: { onAuthStateChange } },
      sessionUserId: "",
      authReady: true,
      setSession: stableSetter,
      setAuthReady: stableSetter,
      setAccountView: stableSetter,
      setAccountMenuOpen: stableSetter,
      setAuthGateOpen: stableSetter,
      setAuthGateStep: stableSetter,
      setForgotPasswordOpen: stableSetter,
      setRecoveryPasswordValue: stableSetter,
      setRecoveryPasswordValue2: stableSetter,
      setRecoveryPasswordOpen: stableSetter,
      publicAppOnboardingPendingAuthKey: "test-onboarding-auth",
      publicAccountDeletePendingAuthKey: "test-delete-auth",
      readDeleteAccountDeepLinkRequest: () => false,
      clearDeleteAccountQuery: stableSetter,
      openDeleteAccountFlow: stableSetter,
      wasUserInitiatedLogout: () => false,
    };

    const { rerender, unmount } = render(createElement(
      MapLazyAuthBootstrapController,
      { ...baseProps, openNotice: vi.fn() }
    ));
    expect(onAuthStateChange).toHaveBeenCalledTimes(1);

    rerender(createElement(
      MapLazyAuthBootstrapController,
      { ...baseProps, openNotice: vi.fn() }
    ));
    expect(onAuthStateChange).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
