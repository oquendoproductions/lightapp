# Gate E Hardening Smoke (Post-Deploy)

Generated: 2026-03-22 04:36:29 UTC

## Output

```json
{
  "generated_at_utc": "2026-03-22T04:36:29.423Z",
  "started_at_utc": "2026-03-22T04:35:49.934Z",
  "staging_supabase_url": "https://madjklbsdwbtrqhpxmfs.supabase.co",
  "tenant_key": "ashtabulacity",
  "post_deploy_duplicate_check": {
    "first_call": {
      "status": 200,
      "body": {
        "allowed": true,
        "remaining": 49,
        "remainingUnits": 49
      }
    },
    "second_call_same_idempotency": {
      "status": 200,
      "body": {
        "allowed": true,
        "duplicate": true,
        "remaining": 49,
        "remainingUnits": 49
      }
    }
  },
  "stress_probe": {
    "iterations": 120,
    "degraded_count": 0,
    "exception_reason_count": 0,
    "sample_responses": [
      {
        "i": 0,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 498,
          "remainingUnits": 498
        }
      },
      {
        "i": 1,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 497,
          "remainingUnits": 497
        }
      },
      {
        "i": 2,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 496,
          "remainingUnits": 496
        }
      },
      {
        "i": 3,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 495,
          "remainingUnits": 495
        }
      },
      {
        "i": 4,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 494,
          "remainingUnits": 494
        }
      },
      {
        "i": 5,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 493,
          "remainingUnits": 493
        }
      },
      {
        "i": 6,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 492,
          "remainingUnits": 492
        }
      },
      {
        "i": 7,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 491,
          "remainingUnits": 491
        }
      },
      {
        "i": 8,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 490,
          "remainingUnits": 490
        }
      },
      {
        "i": 9,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 489,
          "remainingUnits": 489
        }
      },
      {
        "i": 10,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 488,
          "remainingUnits": 488
        }
      },
      {
        "i": 11,
        "status": 200,
        "body": {
          "allowed": true,
          "remaining": 487,
          "remainingUnits": 487
        }
      }
    ]
  },
  "assessment": "PASS: no degraded/exception responses observed in stress probe after deploy."
}```
