# Gate A Staging Full Smoke (Post-Fix)

Generated: 2026-03-22 04:19:02 UTC
Supabase URL: https://madjklbsdwbtrqhpxmfs.supabase.co
Tenant key: ashtabulacity

## Output

```json
{
  "generated_at_utc": "2026-03-22T04:18:59.795Z",
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
    },
    "streetlight": {
      "id": "b5468bfd-6d38-4160-b790-898c0dec46ae",
      "lat": 41.8652823590733,
      "lng": -80.781387090683
    }
  },
  "guest_submit_checks": {
    "pothole_insert": {
      "status": 201,
      "data": [
        {
          "id": 112,
          "pothole_id": "c0117380-e8c2-455a-9902-1ed857680fcd",
          "lat": 41.871793689256,
          "lng": -80.789650063104,
          "note": "[GATE_A_STAGING_FULL_SMOKE 2026-03-22T04:18:59.795Z] guest pothole submit",
          "reporter_user_id": null,
          "reporter_name": "Smoke Test",
          "reporter_phone": "555-010-2026",
          "reporter_email": "cityreport.io@gmail.com",
          "created_at": "2026-03-22T04:19:01.411471+00:00",
          "report_number": "PHR0000110",
          "tenant_key": "ashtabulacity"
        }
      ]
    },
    "water_drain_insert": {
      "status": 201,
      "data": null
    },
    "streetlight_insert": {
      "status": 201,
      "data": null
    }
  },
  "export_checks": {
    "detail": {
      "status": 200,
      "rows": 5
    },
    "summary": {
      "status": 400,
      "rows": null
    }
  }
}
```
