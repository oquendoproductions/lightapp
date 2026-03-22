# Gate A Staging API Smoke (Post-Fix)

Generated: 2026-03-22 03:33:11 UTC
Supabase URL: https://madjklbsdwbtrqhpxmfs.supabase.co
Tenant key: ashtabulacity

## Output

```json
{
  "generated_at_utc": "2026-03-22T03:33:10.575Z",
  "tenant": "ashtabulacity",
  "supabase_url": "https://madjklbsdwbtrqhpxmfs.supabase.co",
  "seed_rows": {
    "pothole": {
      "id": "c0117380-e8c2-455a-9902-1ed857680fcd",
      "lat": 41.871793689256,
      "lng": -80.789650063104,
      "ph_id": "PH7896587180"
    },
    "water_drain": {
      "incident_id": "water_drain_issues:41.85698:-80.78544",
      "lat": 41.8569790450637,
      "lng": -80.7854380415123,
      "issue_type": "sewer_backup"
    }
  },
  "guest_submit_checks": {
    "pothole_insert": {
      "status": 201,
      "data": [
        {
          "id": 111,
          "pothole_id": "c0117380-e8c2-455a-9902-1ed857680fcd",
          "lat": 41.871793689256,
          "lng": -80.789650063104,
          "note": "[GATE_A_STAGING_API_SMOKE 2026-03-22T03:33:10.575Z] guest pothole submit probe",
          "reporter_user_id": null,
          "reporter_name": "Smoke Test",
          "reporter_phone": "555-010-2026",
          "reporter_email": "cityreport.io@gmail.com",
          "created_at": "2026-03-22T03:33:11.672395+00:00",
          "report_number": "PHR0000109",
          "tenant_key": "ashtabulacity"
        }
      ]
    },
    "water_drain_insert": {
      "status": 201,
      "data": null
    }
  }
}
```
