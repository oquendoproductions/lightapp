# Gate C API Smoke

Generated: 2026-03-22 03:22:04 UTC
App URL: https://ashtabulacity.cityreport.io/
Bundle URL: https://ashtabulacity.cityreport.io/assets/index-DbzmRA_A.js
Supabase URL: https://gjainmoiudfjsmhhvtiz.supabase.co
Tenant key: ashtabulacity

## Output

```json
{
  "generated_at_utc": "2026-03-22T03:22:02.545Z",
  "tenant": "ashtabulacity",
  "bundle_url": "https://ashtabulacity.cityreport.io/assets/index-DbzmRA_A.js",
  "supabase_url": "https://gjainmoiudfjsmhhvtiz.supabase.co",
  "endpoint_checks": {
    "apex": 200,
    "tenant": 200,
    "gmaps": {
      "status": 301,
      "location": "https://ashtabulacity.cityreport.io/"
    }
  },
  "legal_checks": {
    "terms": 200,
    "privacy": 200,
    "governance": 200
  },
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
          "id": 91,
          "pothole_id": "c0117380-e8c2-455a-9902-1ed857680fcd",
          "lat": 41.871793689256,
          "lng": -80.789650063104,
          "note": "[SMOKE_GATE_C_AUTOMATION 2026-03-22T03:22:02.545Z] guest pothole submit probe",
          "reporter_user_id": null,
          "reporter_name": "Smoke Test",
          "reporter_phone": "555-010-2026",
          "reporter_email": "cityreport.io@gmail.com",
          "created_at": "2026-03-22T03:22:03.732393+00:00",
          "report_number": "PHR0000089",
          "tenant_key": "ashtabulacity"
        }
      ]
    },
    "water_drain_insert": {
      "status": 401,
      "data": {
        "code": "42501",
        "details": null,
        "hint": null,
        "message": "new row violates row-level security policy for table \"reports\""
      }
    }
  },
  "export_detail_check": {
    "status": 200,
    "data": [
      {
        "incident_id": "pothole:c0117380-e8c2-455a-9902-1ed857680fcd",
        "domain": "potholes",
        "current_state": "aggregated",
        "submitted_at": "2026-03-22T03:22:03.732393+00:00",
        "report_number": "PHR0000089"
      },
      {
        "incident_id": "1d7aab85-f649-4acb-80e7-400b8fc4f9c9",
        "domain": "streetlights",
        "current_state": "aggregated",
        "submitted_at": "2026-03-19T01:07:18.143819+00:00",
        "report_number": "SLR0000797"
      },
      {
        "incident_id": "pothole:94a14713-9acc-4c85-a8eb-eebf7010f244",
        "domain": "potholes",
        "current_state": "fixed",
        "submitted_at": "2026-03-19T00:58:32.099685+00:00",
        "report_number": "PHR0000084"
      },
      {
        "incident_id": "pothole:3316af9c-77ca-4ff1-b53e-e94804e0f9b7",
        "domain": "potholes",
        "current_state": "reported",
        "submitted_at": "2026-03-18T00:56:02.198864+00:00",
        "report_number": "PHR0000083"
      },
      {
        "incident_id": "pothole:d280d9a6-8e13-44d7-bd46-bf937260a96b",
        "domain": "potholes",
        "current_state": "reported",
        "submitted_at": "2026-03-17T19:16:46.092522+00:00",
        "report_number": "PHR0000082"
      }
    ]
  }
}
```
