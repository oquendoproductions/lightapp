export const PRIORITY_DOMAIN_OPTIONS = [
  "potholes",
  "street_signs",
  "water_drain_issues",
  "streetlights",
  "other",
] as const;

export type PriorityDomain = (typeof PRIORITY_DOMAIN_OPTIONS)[number];

export type LeadCaptureRequest = {
  fullName: string;
  workEmail: string;
  cityAgency: string;
  roleTitle: string;
  priorityDomain: PriorityDomain;
  notes?: string;
  website?: string;
  source: "homepage";
};

export type LeadCaptureResponse =
  | { ok: true; leadId: string; message: string }
  | {
      ok: false;
      code: "VALIDATION_ERROR" | "RATE_LIMITED" | "SERVER_ERROR";
      message: string;
    };

export type LeadFormInput = Omit<LeadCaptureRequest, "source">;

export type LeadFieldErrors = Partial<Record<keyof LeadFormInput, string>>;
