import { describe, expect, it, vi } from "vitest";
import { submitLead } from "../lib/leadApi";
import type { LeadCaptureRequest } from "../lib/types";

const payload: LeadCaptureRequest = {
  fullName: "Alex Rivera",
  workEmail: "alex@city.gov",
  cityAgency: "Ashtabula Public Works",
  roleTitle: "Operations Director",
  priorityDomain: "potholes",
  notes: "",
  source: "homepage",
};

describe("submitLead", () => {
  it("returns success payload", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, leadId: "abc-123", message: "Success" }),
    });

    const result = await submitLead(payload, fakeFetch as unknown as typeof fetch);

    expect(result.ok).toBe(true);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  it("maps 429 to rate limit", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ ok: false, code: "RATE_LIMITED", message: "Too many" }),
    });

    const result = await submitLead(payload, fakeFetch as unknown as typeof fetch);

    expect(result).toEqual({ ok: false, code: "RATE_LIMITED", message: "Too many" });
  });

  it("returns server error on network exception", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error("network"));
    const result = await submitLead(payload, fakeFetch as unknown as typeof fetch);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER_ERROR");
    }
  });
});
