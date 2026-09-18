import { describe, expect, it } from "vitest";
import { toNativeAuthCallbackLocation } from "../platform/nativeAuthCallback.js";

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
});
