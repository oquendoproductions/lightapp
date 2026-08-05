import { describe, expect, it } from "vitest";

import {
  DOMAIN_NOTIFICATION_TEMPLATE_TOKENS,
  domainReportingFieldTemplateTokens,
} from "../lib/domainNotificationTemplateSupport";

describe("domain notification template macros", () => {
  it("offers the public incident id separately from the report number", () => {
    expect(DOMAIN_NOTIFICATION_TEMPLATE_TOKENS).toContain("{{incident_id}}");
    expect(DOMAIN_NOTIFICATION_TEMPLATE_TOKENS).toContain("{{report_number}}");
  });

  it("offers one multiline macro for all configured reporting fields", () => {
    expect(DOMAIN_NOTIFICATION_TEMPLATE_TOKENS).toContain("{{reporting_fields}}");
  });

  it("provides stable label and display macros for every reporting field position", () => {
    expect(domainReportingFieldTemplateTokens(2)).toEqual([
      "{{issue_type_2}}",
      "{{issue_type_2_label}}",
      "{{issue_type_2_display}}",
    ]);
  });
});
