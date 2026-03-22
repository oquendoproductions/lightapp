import {
  PRIORITY_DOMAIN_OPTIONS,
  type LeadFieldErrors,
  type LeadFormInput,
} from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizedText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function sanitizeLeadInput(input: LeadFormInput): LeadFormInput {
  return {
    fullName: normalizedText(input.fullName),
    workEmail: normalizedText(input.workEmail).toLowerCase(),
    cityAgency: normalizedText(input.cityAgency),
    roleTitle: normalizedText(input.roleTitle),
    priorityDomain: input.priorityDomain,
    notes: normalizedText(input.notes || ""),
    website: input.website || "",
  };
}

export function validateLeadInput(input: LeadFormInput) {
  const data = sanitizeLeadInput(input);
  const errors: LeadFieldErrors = {};

  if (data.fullName.length < 2) {
    errors.fullName = "Enter the full name of the requester.";
  }

  if (!EMAIL_REGEX.test(data.workEmail)) {
    errors.workEmail = "Enter a valid work email address.";
  }

  if (data.cityAgency.length < 2) {
    errors.cityAgency = "Enter a city or agency name.";
  }

  if (data.roleTitle.length < 2) {
    errors.roleTitle = "Enter the role/title for this request.";
  }

  if (!PRIORITY_DOMAIN_OPTIONS.includes(data.priorityDomain)) {
    errors.priorityDomain = "Select the top infrastructure priority.";
  }

  if (data.notes && data.notes.length > 1000) {
    errors.notes = "Keep notes to 1000 characters or fewer.";
  }

  if ((data.website || "").trim().length > 0) {
    errors.website = "Automated submission blocked.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    data,
    errors,
  };
}
