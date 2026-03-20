import { useMemo, useRef, useState } from "react";
import { trackEvent } from "../../lib/homepage/analytics.js";
import { submitLead } from "../../lib/homepage/leadApi.js";
import { validateLeadInput } from "../../lib/homepage/validation.js";

const DOMAIN_LABELS = {
  potholes: "Potholes",
  street_signs: "Street signs",
  water_drain_issues: "Water/drain issues",
  streetlights: "Streetlights",
  other: "Other",
};

const INITIAL_FORM = {
  fullName: "",
  workEmail: "",
  cityAgency: "",
  roleTitle: "",
  priorityDomain: "potholes",
  notes: "",
  website: "",
};

export function LeadForm({ submitter = submitLead }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [responseError, setResponseError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showOptional, setShowOptional] = useState(false);
  const hasInteractedRef = useRef(false);
  const focusedAtRef = useRef({});
  const abandonedFieldsRef = useRef(new Set());

  const fieldErrorSummary = useMemo(() => Object.values(errors).filter(Boolean), [errors]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function onFieldFocus(fieldName) {
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true;
      trackEvent("lead_form_interaction", { source: "homepage" });
    }
    focusedAtRef.current[fieldName] = Date.now();
  }

  function onFieldBlur(fieldName, fieldValue) {
    const startTs = focusedAtRef.current[fieldName] || Date.now();
    const focusDurationMs = Date.now() - startTs;
    const isBlank = String(fieldValue || "").trim().length === 0;

    if (isBlank && !abandonedFieldsRef.current.has(fieldName)) {
      abandonedFieldsRef.current.add(fieldName);
      trackEvent("lead_field_abandon", {
        field: fieldName,
        focus_ms: focusDurationMs,
      });
    }
  }

  async function onSubmit(event) {
    event.preventDefault();

    const validation = validateLeadInput(form);
    setErrors(validation.errors);
    setResponseError(null);

    trackEvent("lead_submit_attempt", {
      source: "homepage",
      priority_domain: form.priorityDomain,
    });

    if (!validation.isValid) {
      trackEvent("lead_submit_failure", {
        reason: "validation_error",
      });
      return;
    }

    setSubmitting(true);

    const payload = {
      ...validation.data,
      source: "homepage",
    };

    const result = await submitter(payload);

    setSubmitting(false);

    if (!result.ok) {
      setResponseError(result.message);
      trackEvent("lead_submit_failure", {
        reason: result.code,
      });
      return;
    }

    setSuccessMessage(result.message);
    setForm(INITIAL_FORM);
    setErrors({});

    trackEvent("lead_submit_success", {
      lead_id: result.leadId,
    });
  }

  if (successMessage) {
    return (
      <article className="lead-panel success-panel" aria-live="polite">
        <p className="eyebrow">Request Received</p>
        <h2>Thanks. Pilot demo coordination has started.</h2>
        <p>{successMessage}</p>
        <ol>
          <li>CityReport reviews your requested priority domain and city context.</li>
          <li>A scheduling follow-up is sent to your work email within one business day.</li>
          <li>Demo agenda includes workflow, governance fit, and pilot-readiness checkpoints.</li>
        </ol>
        <button className="btn btn-secondary" onClick={() => setSuccessMessage(null)}>
          Submit another request
        </button>
      </article>
    );
  }

  return (
    <article className="lead-panel" aria-labelledby="lead-panel-title">
      <p className="eyebrow">Book Pilot Demo</p>
      <h2 id="lead-panel-title">Qualified intake for municipal teams</h2>
      <p className="lead-subtext">Provide core details so the walkthrough is aligned to your city workflow.</p>

      {fieldErrorSummary.length > 0 && (
        <div className="form-error-summary" role="alert">
          <p>Review the highlighted fields before submitting.</p>
        </div>
      )}

      {responseError && (
        <div className="form-error-summary" role="alert">
          <p>{responseError}</p>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="fullName">Full name</label>
        <input
          id="fullName"
          name="fullName"
          autoComplete="name"
          value={form.fullName}
          onChange={(event) => setField("fullName", event.target.value)}
          onFocus={() => onFieldFocus("full_name")}
          onBlur={() => onFieldBlur("full_name", form.fullName)}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? "fullName-error" : undefined}
        />
        {errors.fullName && (
          <p id="fullName-error" className="field-error">
            {errors.fullName}
          </p>
        )}

        <label htmlFor="workEmail">Work email</label>
        <input
          id="workEmail"
          type="email"
          name="workEmail"
          autoComplete="email"
          value={form.workEmail}
          onChange={(event) => setField("workEmail", event.target.value)}
          onFocus={() => onFieldFocus("work_email")}
          onBlur={() => onFieldBlur("work_email", form.workEmail)}
          aria-invalid={Boolean(errors.workEmail)}
          aria-describedby={errors.workEmail ? "workEmail-error" : undefined}
        />
        {errors.workEmail && (
          <p id="workEmail-error" className="field-error">
            {errors.workEmail}
          </p>
        )}

        <label htmlFor="cityAgency">City or agency</label>
        <input
          id="cityAgency"
          name="cityAgency"
          value={form.cityAgency}
          onChange={(event) => setField("cityAgency", event.target.value)}
          onFocus={() => onFieldFocus("city_agency")}
          onBlur={() => onFieldBlur("city_agency", form.cityAgency)}
          aria-invalid={Boolean(errors.cityAgency)}
          aria-describedby={errors.cityAgency ? "cityAgency-error" : undefined}
        />
        {errors.cityAgency && (
          <p id="cityAgency-error" className="field-error">
            {errors.cityAgency}
          </p>
        )}

        <label htmlFor="roleTitle">Role/title</label>
        <input
          id="roleTitle"
          name="roleTitle"
          value={form.roleTitle}
          onChange={(event) => setField("roleTitle", event.target.value)}
          onFocus={() => onFieldFocus("role_title")}
          onBlur={() => onFieldBlur("role_title", form.roleTitle)}
          aria-invalid={Boolean(errors.roleTitle)}
          aria-describedby={errors.roleTitle ? "roleTitle-error" : undefined}
        />
        {errors.roleTitle && (
          <p id="roleTitle-error" className="field-error">
            {errors.roleTitle}
          </p>
        )}

        <label htmlFor="priorityDomain">Top infrastructure priority</label>
        <select
          id="priorityDomain"
          name="priorityDomain"
          value={form.priorityDomain}
          onChange={(event) => setField("priorityDomain", event.target.value)}
          onFocus={() => onFieldFocus("priority_domain")}
          aria-invalid={Boolean(errors.priorityDomain)}
          aria-describedby={errors.priorityDomain ? "priorityDomain-error" : undefined}
        >
          {Object.entries(DOMAIN_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {errors.priorityDomain && (
          <p id="priorityDomain-error" className="field-error">
            {errors.priorityDomain}
          </p>
        )}

        <button
          type="button"
          className="optional-toggle"
          onClick={() => setShowOptional((prev) => !prev)}
        >
          {showOptional ? "Hide optional context" : "Add optional context"}
        </button>

        {showOptional && (
          <>
            <label htmlFor="notes">Notes (optional)</label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={(event) => setField("notes", event.target.value)}
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? "notes-error" : undefined}
              placeholder="Optional context: workflow blockers, reporting volume, or pilot timing."
            />
            {errors.notes && (
              <p id="notes-error" className="field-error">
                {errors.notes}
              </p>
            )}
          </>
        )}

        <div className="honeypot" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website || ""}
            onChange={(event) => setField("website", event.target.value)}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Submitting..." : "Request pilot demo"}
        </button>
      </form>
    </article>
  );
}
