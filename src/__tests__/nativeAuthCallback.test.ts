import { describe, expect, it } from "vitest";
import {
  shouldNavigateToNativeAuthCallback,
  toNativeAuthCallbackLocation,
} from "../platform/nativeAuthCallback.js";

describe("toNativeAuthCallbackLocation", () => {
  it("converts the production callback into the native webview URL", () => {
    expect(
      toNativeAuthCallbackLocation(
        "cityreport://auth/callback?code=one-time-code&type=recovery",
        "capacitor://localhost"
      )
    ).toBe("capacitor://localhost/?code=one-time-code&type=recovery");
  });

  it("does not navigate for arbitrary external URLs", () => {
    expect(toNativeAuthCallbackLocation("https://example.com/reset", "capacitor://localhost")).toBe("");
    expect(toNativeAuthCallbackLocation("cityreport://other/callback", "capacitor://localhost")).toBe("");
  });

  it("does not reload when the webview is already at the callback location", () => {
    const target = "https://localhost/?code=one-time-code&type=recovery";

    expect(shouldNavigateToNativeAuthCallback(target, target)).toBe(false);
    expect(shouldNavigateToNativeAuthCallback(target, "https://localhost/")).toBe(true);
  });
});
