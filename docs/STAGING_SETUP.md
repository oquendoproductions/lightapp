# Staging Setup (Isolated From cityreport.io Live)

This workflow creates a separate Supabase project and bootstraps it with this repo's migrations/functions, so production `cityreport.io` is not touched.

## Prerequisites

- `supabase` CLI installed.
- `SUPABASE_ACCESS_TOKEN` exported.
- One Supabase org ID, or set `STAGING_ORG_ID`.

## Create + Bootstrap Staging

From repo root:

```bash
cd /Users/oquendoproductions/Desktop/streetlight-app/streetlight-web
chmod +x scripts/staging/*.sh
export SUPABASE_ACCESS_TOKEN='YOUR_TOKEN'
export STAGING_ORG_ID='YOUR_ORG_ID'   # required if you have multiple orgs
./scripts/staging/create_and_bootstrap_staging.sh
```

Optional environment overrides:

- `STAGING_PROJECT_NAME` (default: `cityreport-staging-<timestamp>`)
- `STAGING_REGION` (default: `us-east-1`)
- `STAGING_SIZE` (default: `nano`)
- `STAGING_DB_PASSWORD` (auto-generated if omitted)
- `STAGING_RESEND_API_KEY`
- `STAGING_PW_REPORT_TO`
- `STAGING_PW_REPORT_FROM`
- `STAGING_ASHTABULA_CITY_GEOJSON`

## Use Staging Locally

```bash
cp .env.staging.local .env.local
npm run dev -- --host 0.0.0.0 --port 4173
```

Then test:

- `http://localhost:4173/`
- `http://localhost:4173/gmaps`
- ngrok `.../gmaps`

## Notes

- The script uses a temporary linked workdir so your existing repo link is not rewritten.
- It deploys functions:
  - `email-pothole-report`
  - `email-water-drain-report`
  - `rate-limit-gate`
  - `cache-official-light-geo`
  - `lead-capture`
