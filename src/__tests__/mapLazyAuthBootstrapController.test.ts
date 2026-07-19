import { describe, expect, it } from "vitest";

import { shouldOpenExpiredSessionPrompt } from "../lib/mapAuthBootstrapSupport.js";

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
});
