import { describe, expect, it } from "vitest";
import { sanitizeLeadInput, validateLeadInput } from "../lib/validation";
import type { LeadFormInput } from "../lib/types";

const base: LeadFormInput = {
  fullName: "Alex Rivera",
  workEmail: "alex@city.gov",
  cityAgency: "Ashtabula Public Works",
  roleTitle: "Operations Director",
  priorityDomain: "potholes",
  notes: "",
  website: "",
};

describe("validateLeadInput", () => {
  it("accepts valid payload", () => {
    const result = validateLeadInput(base);
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("flags missing required fields", () => {
    const result = validateLeadInput({ ...base, fullName: "", cityAgency: "" });
    expect(result.isValid).toBe(false);
    expect(result.errors.fullName).toBeTruthy();
    expect(result.errors.cityAgency).toBeTruthy();
  });

  it("blocks honeypot content", () => {
    const result = validateLeadInput({ ...base, website: "https://spam.example" });
    expect(result.isValid).toBe(false);
    expect(result.errors.website).toBeTruthy();
  });

  it("normalizes text and email casing", () => {
    const sanitized = sanitizeLeadInput({
      ...base,
      fullName: "  Alex   Rivera  ",
      workEmail: "  ALEX@CITY.GOV  ",
    });
    expect(sanitized.fullName).toBe("Alex Rivera");
    expect(sanitized.workEmail).toBe("alex@city.gov");
  });
});
