# Gate D Release Readiness Probe

Generated: 2026-03-22 04:28:03 UTC

## Output

```json
{
  "generated_at_utc": "2026-03-22T04:28:01.200Z",
  "endpoint_checks": {
    "cityreport_root": {
      "status": 200,
      "location": null
    },
    "legal_terms": {
      "status": 308,
      "location": "/legal/terms"
    },
    "legal_privacy": {
      "status": 308,
      "location": "/legal/privacy"
    },
    "legal_governance": {
      "status": 308,
      "location": "/legal/governance"
    },
    "legal_pilot_overview": {
      "status": 308,
      "location": "/legal/pilot-overview"
    },
    "tenant_app": {
      "status": 200,
      "location": null
    },
    "gmaps_redirect": {
      "status": 301,
      "location": "https://ashtabulacity.cityreport.io/"
    }
  },
  "runtime_env_inference": {
    "bundle_url": "https://cityreport.io/assets/index-ClYgnYtv.js",
    "supabase_url": "https://gjainmoiudfjsmhhvtiz.supabase.co",
    "publishable_key_prefix": "sb_publishable_unSNDZS...",
    "lead_endpoint": "https://gjainmoiudfjsmhhvtiz.supabase.co/functions/v1/lead-capture"
  },
  "lead_capture_checks": {
    "valid_submit": {
      "status": 200,
      "body": {
        "ok": true,
        "leadId": "69b9f903-bf8c-4ec5-99a9-ed1bda979e00",
        "message": "Request received. A scheduling follow-up will be sent within one business day."
      }
    },
    "honeypot_submit": {
      "status": 200,
      "body": {
        "ok": true,
        "leadId": "f6123551-b31b-4373-a3bc-947f7ac0fc41",
        "message": "Request received. We will follow up within one business day."
      }
    },
    "invalid_submit": {
      "status": 400,
      "body": {
        "ok": false,
        "code": "VALIDATION_ERROR",
        "message": "Invalid request data.",
        "details": [
          "fullName is required",
          "workEmail must be valid",
          "cityAgency is required",
          "roleTitle is required",
          "priorityDomain is invalid"
        ]
      }
    }
  },
  "legal_local_checks": {
    "terms": {
      "hasEffectiveDate": true,
      "hasContactEmail": true,
      "hasNoEmergency": true
    },
    "privacy": {
      "hasEffectiveDate": true,
      "hasContactEmail": true,
      "hasNoEmergency": false
    },
    "governance": {
      "hasEffectiveDate": true,
      "hasContactEmail": true,
      "hasNoEmergency": true
    },
    "pilot_overview_exists": true
  },
  "dist_artifacts": {
    "terms": true,
    "privacy": true,
    "governance": true,
    "pilot_overview": true
  },
  "static_security_checks": {
    "no_frontend_service_role_key_hits": [],
    "honeypot_present_hits": [
      "src/styles.css:317:.honeypot {",
      "src/homepage.css:448:.honeypot {",
      "src/components/LeadForm.tsx:28:  website: \"\",",
      "src/components/LeadForm.tsx:233:        <div className=\"honeypot\" aria-hidden=\"true\">",
      "src/components/LeadForm.tsx:234:          <label htmlFor=\"website\">Website</label>",
      "src/components/LeadForm.tsx:236:            id=\"website\"",
      "src/components/LeadForm.tsx:237:            name=\"website\"",
      "src/components/LeadForm.tsx:240:            value={form.website || \"\"}",
      "src/components/LeadForm.tsx:241:            onChange={(event) => setField(\"website\", event.target.value)}",
      "src/components/homepage/LeadForm.jsx:21:  website: \"\",",
      "src/components/homepage/LeadForm.jsx:269:        <div className=\"honeypot\" aria-hidden=\"true\">",
      "src/components/homepage/LeadForm.jsx:270:          <label htmlFor=\"website\">Website</label>"
    ],
    "lead_migration_present": true,
    "lead_function_present": true
  }
}```
