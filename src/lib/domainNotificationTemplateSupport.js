export const DOMAIN_NOTIFICATION_TEMPLATE_TOKENS = Object.freeze([
  "{{tenant_key}}",
  "{{domain_label}}",
  "{{issue_type}}",
  "{{reporting_fields}}",
  "{{incident_id}}",
  "{{report_number}}",
  "{{closest_address}}",
  "{{closest_cross_street}}",
  "{{closest_intersection}}",
  "{{closest_landmark}}",
  "{{location_text}}",
  "{{image_url}}",
  "{{submitted_at_local}}",
  "{{notes}}",
  "{{reporter_type}}",
  "{{reporter_name}}",
  "{{reporter_email}}",
  "{{reporter_phone}}",
]);

/**
 * Stable, position-based reporting-field tokens.  These deliberately do not
 * depend on a tenant's editable field label, so an email template remains
 * valid when "Surface" is renamed to "Property surface", for example.
 */
export function domainReportingFieldTemplateTokens(position) {
  const number = Number(position);
  if (!Number.isInteger(number) || number < 1) return [];
  const base = `{{issue_type_${number}}}`;
  return [
    base,
    `{{issue_type_${number}_label}}`,
    `{{issue_type_${number}_display}}`,
  ];
}
