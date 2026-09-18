import { describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  isNativeAppRuntime: vi.fn(() => true),
  getCurrentLocationSnapshot: vi.fn(() => ({ origin: "https://cityreport.io" })),
}));

vi.mock("../platform/runtime.js", () => runtime);

import { getPasswordResetRedirectOptions } from "../platform/auth.js";

describe("getPasswordResetRedirectOptions", () => {
  it("uses the exact native callback registered with the auth provider", () => {
    expect(getPasswordResetRedirectOptions()).toEqual({
      redirectTo: "cityreport://auth/callback",
    });
  });
});
