# Lead Capture Probe

Generated: 2026-03-22 05:48:04 UTC
App URL: https://cityreport.io
Bundle URL: https://cityreport.io/assets/index-ClYgnYtv.js
Supabase URL: https://gjainmoiudfjsmhhvtiz.supabase.co
Mode: live_write

## Output

```json
{
  "generated_at_utc": "2026-03-22T05:48:03.960Z",
  "execute_write": true,
  "endpoint": "https://gjainmoiudfjsmhhvtiz.supabase.co/functions/v1/lead-capture",
  "payload_preview": {
    "name": "Smoke Probe",
    "email": "smoke+1774158483961@cityreport.io",
    "organization": "CityReport Smoke Probe",
    "message": "[lead-capture probe 2026-03-22T05:48:03.960Z]",
    "hp_field": ""
  },
  "mode": "live_write",
  "response": {
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
        "priorityDomain is invalid",
        "source must be homepage"
      ]
    }
  }
}
```
