# Hub staging

`npm run deploy:hub:staging` deploys the Hub to the isolated Cloudflare Pages project `cityreport-hub-staging`.

It deliberately builds with `.env.staging.local`, never `.env.local`, and connects only to the separate staging Supabase project. The deployment also sets `VITE_HUB_PREVIEW_TENANT_KEY=testcity1`, so its Pages URL opens directly into Test City's Hub.

## First-time setup

The staging Supabase project must exist first. It is already configured by `.env.staging.local`; if it ever needs recreating, follow [STAGING_SETUP.md](STAGING_SETUP.md).

Create the Pages project once:

```bash
set -a; source .env.cloudflare.local; set +a
NPM_CONFIG_CACHE=/tmp/npm-cache XDG_CONFIG_HOME=/tmp/cityreport-wrangler-config \
  npx wrangler pages project create cityreport-hub-staging --production-branch staging
```

Do not attach any `cityreport.io` custom domain to this project.

## Deploy and test Hub changes

```bash
npm run deploy:hub:staging
```

Open `https://cityreport-hub-staging.pages.dev`. Make, validate, and share Hub changes there first. Deploying this project cannot alter the live Pages project (`lightapp`) or its domains.

To point the staging Hub at another tenant, use:

```bash
HUB_STAGING_TENANT_KEY=your-tenant-key npm run deploy:hub:staging
```

## Live-data Hub preview

`npm run deploy:hub:preview` deploys the same separate Pages project but builds it with `.env.local`, so it uses production data, accounts, and permissions. It defaults to Test City and is intended for layout and presentation review.

The Pages URL stays separate from `cityreport.io`, but any edits performed through the preview affect production data.

## Safety boundary

- `npm run deploy:hub:staging` — staging Hub only, isolated Pages project + staging Supabase.
- `npm run deploy:hub:preview` — separate Pages project + production Supabase.
- `npm run deploy:pages` — existing live Pages deployment; use only for a production release.
